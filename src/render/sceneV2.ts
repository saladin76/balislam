/**
 * Studio V2 scene render. Run ONLY from trusted Backend with the same episode
 * artifact lock and an exclusive per-scene production lease as workflow V2.
 * Preparations may run in parallel; final render is gated by Backend.
 *
 * Does not approve scenes, synthesize narration/recitation, or replace files.
 */
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { bundle } from "@remotion/bundler";
import { makeCancelSignal, renderMedia, selectComposition } from "@remotion/renderer";
import { copyFile, link, mkdir, mkdtemp, readFile, realpath, rm, stat, statfs, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectRoot } from "../config/paths";
import type { Plan, PlanScene } from "../plan/types";
import type { EpisodeMedia } from "../plan/media";
import type { Orientation } from "../remotion/scenes/types";
import type { SceneV2Props, SceneV2Track } from "../remotion/SceneV2";
import type { TimedWord } from "../voice/words";
import type { ChannelInfo } from "../channel/types";
import type { Identity } from "../../brand/identity/index";
import { memoryInfo } from "./pool";
import { probeMedia, type SceneMediaInspection } from "./sceneV2Probe";

export type SceneAudioModeV2 = "silent" | "narrated" | "recitation" | "mixed";
export type SceneAssetV2 = Readonly<{
  /** Trusted, episode-owned physical input, never a client-supplied arbitrary path. */
  file: string;
  sha256: string;
}>;
export type SceneSoundV2 = SceneAssetV2 & Readonly<{
  kind: "narrator" | "recitation" | "sfx";
  startSec: number;
  durationSec: number;
  volume: number;
  /** Must match the locked Storyboard SFX cue ID and startSec. */
  cueId?: string;
  /** Exact alignment from the REAL narrator file, not synthesized estimates. */
  words?: TimedWord[];
}>;
export type ScenePictureV2 = SceneAssetV2 & Readonly<{ ref: string }>;
export type SceneRenderRequestV2 = Readonly<{
  channelsRoot: string; channel: string; episode: string; sceneId: string;
  /** Exact SHA-256 of episode plan.json bytes, pinned by Backend. */
  planSha256: string;
  mode: SceneAudioModeV2;
  orientation: Orientation; width: number; height: number; fps: 30;
  /** Minimum intentional scene duration; never truncates actual audio. */
  durationSec: number;
  sounds: readonly SceneSoundV2[];
  pictures: readonly ScenePictureV2[];
  /** Backend-attested provenance of the exact owner-uploaded human recitation. */
  recitationEvidence?: { origin: "owner-upload"; sha256: string; recordId: string };
  channelInfo?: ChannelInfo;
  identity?: Identity;
}>;
export type SceneRenderSuccessV2 = {
  status: "succeeded";
  jobId: string; sceneId: string; planSha256: string; file: string;
  relativeFile: string; sha256: string; bytes: number;
  durationSec: number; frames: number; fps: number; width: number; height: number;
  videoCodec: string; audioCodecs: string[]; audioStreams: number;
  elapsedMs: number; peakRssMB?: number;
  memoryAvailableBeforeMB: number; memoryAvailableMinMB: number;
  sync: { maxFrameQuantizationErrorMs: number; narratorWords: number;
    eventStarts: { kind: string; frame: number }[]; muxAudioStartSec?: number };
  diskFreeBeforeMB: number;
  diskFreeAfterMB: number; inputSha256: string[];
  /** Review is always pending regardless of successful render. */
  reviewStatus: "not_submitted";
};
export type SceneRenderFailureV2 = {
  status: "failed" | "cancelled"; jobId: string; sceneId: string;
  elapsedMs: number; reason: string; retryable: boolean;
};
export type SceneRenderOutcomeV2 = SceneRenderSuccessV2 | SceneRenderFailureV2;
export type SceneRenderBackendV2 = {
  /** Shared V2 artifact writer lock; lock ONLY preflight and publication. */
  withArtifactLock<T>(work: () => Promise<T>): Promise<T>;
  /** Long-lived distributed lease: at most one active FINAL render for this scene. */
  withProductionLease<T>(sceneId: string, work: () => Promise<T>): Promise<T>;
  /** Must validate script, storyboard, prior scene approval and current plan. */
  assertCanRender(request: SceneRenderRequestV2): Promise<void>;
  ffprobeBinary: string;
  browserExecutable?: string;
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
};

const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const shaPattern = /^[0-9a-f]{64}$/;
const finite = (x: number, lo: number, hi: number) => Number.isFinite(x) && x >= lo && x <= hi;
const within = (root: string, file: string) => file.startsWith(root + path.sep);
const shaFile = async (file: string): Promise<string> => {
  const hash = createHash("sha256");
  for await (const part of createReadStream(file)) hash.update(part);
  return hash.digest("hex");
};
const freeMB = async (folder: string) => {
  const fs = await statfs(folder);
  return (fs.bavail * fs.bsize) / (1024 * 1024);
};
const checkAbort = (signal?: AbortSignal) => {
  if (signal?.aborted) throw Error("SCENE_RENDER_CANCELLED");
};
const validateRequest = (r: SceneRenderRequestV2) => {
  if (!r || !path.isAbsolute(r.channelsRoot) || !idPattern.test(r.channel) ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,100}$/.test(r.episode) ||
      !/^c[1-9]\d*-[sv]\d+$/.test(r.sceneId) || !shaPattern.test(r.planSha256) ||
      !["silent", "narrated", "recitation", "mixed"].includes(r.mode) ||
      !["landscape", "portrait"].includes(r.orientation) ||
      !Number.isSafeInteger(r.width) || !Number.isSafeInteger(r.height) ||
      r.width < 320 || r.height < 180 || r.width > 3840 || r.height > 3840 ||
      r.width % 2 || r.height % 2 || r.fps !== 30 ||
      !finite(r.durationSec, 0.5, 600) ||
      !Array.isArray(r.sounds) || r.sounds.length > 30 ||
      !Array.isArray(r.pictures) || r.pictures.length > 40)
    throw Error("Invalid trusted Studio V2 scene render request.");
  const counts = { narrator: 0, recitation: 0, sfx: 0 };
  for (const a of r.sounds) {
    if (!["narrator", "recitation", "sfx"].includes(a.kind) ||
        !shaPattern.test(a.sha256) || !path.isAbsolute(a.file) ||
        !finite(a.startSec, 0, 600) || !finite(a.durationSec, 0.05, 600) ||
        !finite(a.volume, 0, 1) || a.startSec + a.durationSec > 600 ||
        (a.kind === "sfx" && (!a.cueId || !idPattern.test(a.cueId))))
      throw Error("Invalid scene sound.");
    if (a.kind === "narrator") counts.narrator++;
    else if (a.kind === "recitation") counts.recitation++;
    else if (a.kind === "sfx") counts.sfx++;
  }
  for (const a of r.pictures) {
    if (!shaPattern.test(a.sha256) || !path.isAbsolute(a.file) ||
        !/^(?:lib:)?[a-zA-Z0-9_.-]{1,150}$/.test(a.ref) || a.ref.includes(".."))
      throw Error("Invalid scene picture reference.");
  }
  const expected = r.mode === "silent" ? [0, 0] :
    r.mode === "narrated" ? [1, 0] : r.mode === "recitation" ? [0, 1] : [1, 1];
  if (counts.narrator !== expected[0] || counts.recitation !== expected[1])
    throw Error("Sound tracks do not match declared scene mode.");
  if (counts.recitation && (r.recitationEvidence?.origin !== "owner-upload" ||
      r.recitationEvidence.sha256 !== r.sounds.find((s) => s.kind === "recitation")?.sha256 ||
      !/^[a-zA-Z0-9_-]{3,120}$/.test(r.recitationEvidence.recordId)))
    throw Error("Human recitation requires Backend-verified owner-upload evidence.");
  if (r.mode === "mixed") {
    const voices = r.sounds.filter((a) => a.kind !== "sfx");
    if (Math.max(voices[0]!.startSec, voices[1]!.startSec) <
        Math.min(voices[0]!.startSec + voices[0]!.durationSec,
                 voices[1]!.startSec + voices[1]!.durationSec) - 1 / r.fps)
      throw Error("Narrator and Quran recitation cannot overlap.");
  }
};
export const validateSceneV2Request = validateRequest;
const planScene = (plan: Plan, r: SceneRenderRequestV2): { scene: PlanScene; chapter: number; plan: Plan } => {
  if (plan.version !== 1 || plan.episode !== r.episode.slice(0, 3) ||
      (plan.channel && plan.channel !== r.channel))
    throw Error("Plan does not belong to requested channel and episode.");
  const scenes = plan.chapters.flatMap((c) => c.scenes.map((scene) => ({ scene, chapter: c.number })));
  const found = scenes.filter((x) => x.scene.id === r.sceneId);
  if (found.length !== 1) throw Error("Scene not unique in pinned plan.");
  const scene = found[0]!.scene;
  if (Boolean(scene.narration.trim()) !== r.sounds.some((s) => s.kind === "narrator"))
    throw Error("Narration track must match the locked scene text.");
  if (Boolean(scene.ayahKey) !== r.sounds.some((s) => s.kind === "recitation"))
    throw Error("Human recitation track must match locked scene ayahKey.");
  for (const sound of r.sounds.filter((s) => s.kind === "sfx")) {
    if (!scene.sfx.some((cue) => cue.id === sound.cueId && Math.abs(cue.at - sound.startSec) < 0.001))
      throw Error("SFX event is not pinned to the locked Storyboard scene.");
  }
  if (scene.ayahKey && !scene.props.text?.trim())
    throw Error("Recitation scene requires verified Quran text in locked plan.");
  const expectedImages = [scene.props.image, scene.props.image2, scene.props.image3].filter(Boolean);
  if (expectedImages.some((ref) => !r.pictures.some((p) =>
    p.ref === ref || p.ref.replace(/\.[^.]+$/, "") === ref)))
    throw Error("Locked visual reference is missing a pinned picture asset.");
  return { ...found[0]!, plan };
};
const readPinned = async (root: string, r: SceneRenderRequestV2) => {
  const file = path.join(root, "plan.json");
  const content = await readFile(file);
  if (createHash("sha256").update(content).digest("hex") !== r.planSha256)
    throw Error("Pinned production plan has changed.");
  return planScene(JSON.parse(content.toString("utf8")) as Plan, r);
};
const stageAsset = async (asset: SceneAssetV2, root: string, destination: string) => {
  const source = await realpath(asset.file);
  if (!within(root, source)) throw Error("Scene asset must be episode-owned.");
  const info = await stat(source);
  if (!info.isFile() || info.nlink !== 1 || info.size <= 0 || info.size > 512 * 1024 * 1024)
    throw Error("Invalid scene source asset.");
  if ((await shaFile(source)) !== asset.sha256) throw Error("Pinned scene input hash changed.");
  await copyFile(source, destination);
  if ((await shaFile(destination)) !== asset.sha256) throw Error("Scene asset changed during staging.");
  return info.size;
};
/** Explicit output filename; no previous or approved MP4 can be overwritten. */
export const sceneV2OutputName = (sceneId: string, planHash: string, jobId: string) =>
  `${sceneId}-${planHash.slice(0, 12)}-${jobId}.mp4`;

let activeRenders = 0;
const renderInternals = async (args: {
  props: SceneV2Props; width: number; height: number; fps: number;
  tmpFile: string; bundleDir: string;
  browserExecutable?: string; signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
}) => {
  const { cancelSignal, cancel } = makeCancelSignal();
  const abort = () => cancel();
  args.signal?.addEventListener("abort", abort, { once: true });
  try {
    checkAbort(args.signal);
    const serveUrl = await bundle({
      entryPoint: path.join(projectRoot, "src", "remotion", "index.ts"),
      publicDir: path.join(projectRoot, "public"),
      outDir: args.bundleDir,
    });
    checkAbort(args.signal);
    const comp = await selectComposition({
      serveUrl, id: "studio-v2-scene", inputProps: args.props,
      browserExecutable: args.browserExecutable ?? null,
    });
    await renderMedia({
      serveUrl, inputProps: args.props,
      composition: { ...comp, width: args.width, height: args.height,
        fps: args.fps, durationInFrames: args.props.frames },
      codec: "h264", crf: 20, x264Preset: "veryfast", audioCodec: "aac",
      audioBitrate: "192k", colorSpace: "bt709",
      outputLocation: args.tmpFile,
      browserExecutable: args.browserExecutable ?? null,
      concurrency: 1, cancelSignal,
      onProgress: ({ progress }) => args.onProgress?.(progress),
    });
    checkAbort(args.signal);
  } finally {
    args.signal?.removeEventListener("abort", abort);
  }
};

/** Public V2 backend entrypoint; every failure returns a typed status. */
export const renderSceneV2 = async (
  r: SceneRenderRequestV2, deps: SceneRenderBackendV2,
): Promise<SceneRenderOutcomeV2> => {
  const t0 = Date.now(), jobId = randomUUID();
  let stage: string | undefined, work: string | undefined;
  let published: string | undefined, reportPath: string | undefined;
  try {
    validateRequest(r);
    if (!deps || typeof deps.withArtifactLock !== "function" ||
        typeof deps.withProductionLease !== "function" ||
        typeof deps.assertCanRender !== "function" || !path.isAbsolute(deps.ffprobeBinary))
      throw Error("Trusted Backend scene gating and ffprobe are required.");
    return await deps.withProductionLease(r.sceneId, async () => {
      if (activeRenders > 0) throw Error("Another Studio V2 scene render is busy.");
      activeRenders++;
      try {
      checkAbort(deps.signal);
      const trustedRoot = await realpath(r.channelsRoot);
      const episodeRoot = await realpath(path.join(trustedRoot, r.channel, "episodes", r.episode));
      if (!within(trustedRoot, episodeRoot)) throw Error("Episode escapes trusted channels root.");
      const publicRoot = path.join(projectRoot, "public");
      const memory = memoryInfo();
      let minAvailableMB = memory.availableMB;
      const diskFreeBeforeMB = await freeMB(episodeRoot);
      const inputBytes = (await Promise.all([...r.sounds, ...r.pictures].map(async (a) =>
        (await stat(await realpath(a.file))).size))).reduce((a, b) => a + b, 0);
      if (memory.availableMB < 1800 || diskFreeBeforeMB < 1024 + (inputBytes / 1048576) * 2)
        throw Error("Insufficient resources for safe Remotion render.");
      const { scene, chapter, plan } = await deps.withArtifactLock(async () => {
        await deps.assertCanRender(r);
        return readPinned(episodeRoot, r);
      });
      if (r.mode !== "silent") {
        const voice = r.sounds.find((a) => a.kind === "narrator");
        const tokens = scene.narration.trim().split(/\s+/).filter(Boolean);
        if (voice && (!voice.words?.length || voice.words.length !== tokens.length ||
            voice.words.some((w, i) => w.word !== tokens[i] || !finite(w.start, 0, voice.durationSec) ||
              !finite(w.end, w.start, voice.durationSec) ||
              (i > 0 && w.start < (voice.words?.[i-1]?.start ?? 0)))))
          throw Error("Exact narrator word timestamps are required for synchronized motion.");
      }
      for (const a of r.sounds) {
        const av = await probeMedia(deps.ffprobeBinary, a.file);
        if (av.audio.length !== 1 ||
            Math.abs(av.durationSec - a.durationSec) > 0.18)
          throw Error("Source sound does not contain the declared real audio duration.");
      }
      await mkdir(path.join(episodeRoot, ".studio-v2-render"), { recursive: true });
      await mkdir(path.join(publicRoot, "_studio_v2"), { recursive: true });
      work = await mkdtemp(path.join(episodeRoot, ".studio-v2-render", "run-"));
      stage = await mkdtemp(path.join(publicRoot, "_studio_v2", "run-"));
      await mkdir(path.join(stage, "audio"), { recursive: true });
      await mkdir(path.join(stage, "images"), { recursive: true });
      await mkdir(path.join(work, "tmp"), { recursive: true });
      const relativeBase = `_studio_v2/${path.basename(stage)}/`;
      const tracks: SceneV2Track[] = [];
      for (const [i, a] of r.sounds.entries()) {
        const ext = path.extname(a.file).toLowerCase();
        if (![".mp3", ".wav", ".m4a", ".flac", ".ogg"].includes(ext))
          throw Error("Unsupported audio asset extension.");
        const name = `track-${i}${ext}`;
        await stageAsset(a, episodeRoot, path.join(stage, "audio", name));
        tracks.push({ file: name, kind: a.kind, fromFrame: Math.round(a.startSec * r.fps),
          durationInFrames: Math.max(1, Math.round((a.startSec + a.durationSec) * r.fps) -
            Math.round(a.startSec * r.fps)), volume: a.volume });
      }
      for (const picture of r.pictures) {
        const filename = picture.ref.replace(/^lib:/, "lib__");
        await stageAsset(picture, episodeRoot, path.join(stage, "images", filename));
      }
      const ends = r.sounds.map((a) => a.startSec + a.durationSec);
      const seconds = Math.max(r.durationSec, ...ends);
      const frames = Math.ceil(seconds * r.fps);
      const recitation = r.sounds.find((a) => a.kind === "recitation");
      const narrator = r.sounds.find((a) => a.kind === "narrator");
      const media: EpisodeMedia = {
        mode: "static", base: relativeBase, voice: {}, sfx: [],
        recitations: recitation && scene.ayahKey ? {
          [scene.ayahKey]: { file: "owner-provided", duration: recitation.durationSec, source: "licensed" },
        } : {},
        images: r.pictures.map((a) => a.ref),
      };
      const words = narrator?.words?.map((w) =>
        ({ ...w, start: w.start + narrator.startSec, end: w.end + narrator.startSec })) ?? [];
      const props: SceneV2Props = {
        plan: { ...plan, intro: false }, scene, chapterNumber: chapter, orientation: r.orientation,
        frames, media, tracks, words, channel: r.channelInfo, identity: r.identity,
      };
      const temporary = path.join(work, "scene.tmp.mp4");
      const sampleMemory = setInterval(() => {
        minAvailableMB = Math.min(minAvailableMB, memoryInfo().availableMB);
      }, 500);
      try {
      await renderInternals({
        props, width: r.width, height: r.height, fps: r.fps, tmpFile: temporary,
        bundleDir: path.join(work, "bundle"),
        browserExecutable: deps.browserExecutable, signal: deps.signal,
        onProgress: deps.onProgress,
      });
      } finally {
        clearInterval(sampleMemory);
        minAvailableMB = Math.min(minAvailableMB, memoryInfo().availableMB);
      }
      const inspected: SceneMediaInspection = await probeMedia(deps.ffprobeBinary, temporary, true, 60000);
      if (inspected.video.codec !== "h264" || inspected.video.width !== r.width ||
          inspected.video.height !== r.height || Math.abs(inspected.video.fps - r.fps) > 0.01 ||
          inspected.video.frames !== frames || Math.abs(inspected.durationSec - frames / r.fps) > 0.15 ||
          (r.sounds.length > 0 && (inspected.audio.length !== 1 || inspected.audio[0]?.codec !== "aac")) ||
          (r.sounds.length === 0 && inspected.audio.length !== 0))
        throw Error("Rendered MP4 failed codec/dimension/frame count/audio verification.");
      const digest = await shaFile(temporary);
      const bytes = (await stat(temporary)).size;
      // Re-check source hashes and workflow under the shared lock; fail closed
      // if the plan, source audio, or previous-scene approval changed mid-render.
      const success = await deps.withArtifactLock(async (): Promise<SceneRenderSuccessV2> => {
        checkAbort(deps.signal);
        await deps.assertCanRender(r);
        await readPinned(episodeRoot, r);
        for (const a of [...r.sounds, ...r.pictures])
          if ((await shaFile(await realpath(a.file))) !== a.sha256)
            throw Error("Source asset changed during render.");
        const relativeFile = path.posix.join("previews", sceneV2OutputName(r.sceneId, r.planSha256, jobId));
        const output = path.join(episodeRoot, relativeFile);
        await mkdir(path.dirname(output), { recursive: true });
        const realPreviews = await realpath(path.dirname(output));
        if (realPreviews !== path.join(episodeRoot, "previews")) throw Error("Unsafe preview output directory.");
        // hard-link is atomic and fails with EEXIST: no overwrite of approved or prior bytes.
        await link(temporary, output);
        published = output;
        const result: SceneRenderSuccessV2 = {
          status: "succeeded", jobId, sceneId: r.sceneId, planSha256: r.planSha256,
          file: output, relativeFile, sha256: digest, bytes,
          durationSec: inspected.durationSec, frames: inspected.video.frames,
          fps: inspected.video.fps, width: inspected.video.width, height: inspected.video.height,
          videoCodec: inspected.video.codec, audioCodecs: inspected.audio.map((a) => a.codec),
          audioStreams: inspected.audio.length, elapsedMs: Date.now() - t0,
          memoryAvailableBeforeMB: memory.availableMB, memoryAvailableMinMB: minAvailableMB,
          sync: {
            maxFrameQuantizationErrorMs: Math.max(0,
              ...r.sounds.map((s) => Math.abs(Math.round(s.startSec * r.fps) / r.fps - s.startSec) * 1000),
              ...words.map((w) => Math.abs(Math.round(w.start * r.fps) / r.fps - w.start) * 1000)),
            narratorWords: words.length,
            eventStarts: tracks.map((t) => ({ kind: t.kind, frame: t.fromFrame })),
            ...(inspected.audio[0] ? { muxAudioStartSec: inspected.audio[0].startSec } : {}),
          },
          diskFreeBeforeMB, diskFreeAfterMB: await freeMB(episodeRoot),
          inputSha256: [...r.sounds, ...r.pictures].map((a) => a.sha256),
          reviewStatus: "not_submitted",
        };
        reportPath = output + ".json";
        await writeFile(reportPath, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
        return result;
      });
      return success;
      } finally { activeRenders--; }
    });
  } catch (e) {
    // Only this attempt's newly linked, unapproved output can be rolled back.
    if (reportPath) await rm(reportPath, { force: true }).catch(() => {});
    if (published) await rm(published, { force: true }).catch(() => {});
    return {
      status: deps?.signal?.aborted || String(e).includes("SCENE_RENDER_CANCELLED")
        ? "cancelled" : "failed",
      sceneId: r?.sceneId ?? "unknown", jobId, elapsedMs: Date.now() - t0,
      reason: e instanceof Error ? e.message : String(e),
      retryable: Boolean(deps?.signal?.aborted) || /resource|temporary|timed out|cancelled|busy/i.test(String(e)),
    };
  } finally {
    // These roots belong exclusively to this invocation; never remove shared folders.
    if (stage) await rm(stage, { recursive: true, force: true }).catch(() => {});
    if (work) await rm(work, { recursive: true, force: true }).catch(() => {});
  }
};
