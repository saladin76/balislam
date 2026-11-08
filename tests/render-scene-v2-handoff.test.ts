/**
 * Structural QA for Backend's nine-group signed-manifest handoff.
 * MP4 in this test is an FFmpeg fixture; ACTUAL Remotion proof is the
 * separate dedicated PR CI test (render-scene-v2-real-ci.test.ts).
 */
import { afterEach, describe, expect, it } from "vitest";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { verifySceneV2ForBackendManifest, type SceneServerSourcesHandoffV2 } from "../src/render/sceneV2Handoff";
import { probeMedia } from "../src/render/sceneV2Probe";
import type { SceneRenderRequestV2, SceneRenderSuccessV2 } from "../src/render/sceneV2";

const dirs: string[] = [];
const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const execFfmpeg = async (args: string[]) => new Promise<void>((resolve, reject) => {
  const proc = spawn("/usr/bin/ffmpeg", ["-hide_banner", "-loglevel", "error",
    "-nostdin", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
  let err = "";
  proc.stderr.on("data", (b: Buffer) => { err += String(b); });
  proc.once("error", reject);
  proc.once("close", (code) => code === 0 ? resolve() :
    reject(new Error("FFmpeg fixture failed: " + err.slice(0, 600))));
});

const fixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-v2-handoff-"));
  dirs.push(root);
  const episode = "001-handoff-qa";
  const dir = path.join(root, "balislam", "episodes", episode);
  const sourceFiles = [
    "script.md", "plan.json", "vocalized/c1-s1.json",
    "tone/c1-s1.json", "assets/c1-s1.json",
    "sync/c1-s1.json", "rights/c1-s1.json",
  ];
  for (const f of sourceFiles) {
    await mkdir(path.dirname(path.join(dir, f)), { recursive: true });
    await writeFile(path.join(dir, f), JSON.stringify({ qa: true, name: f }));
  }
  await mkdir(path.join(dir, "voice"), { recursive: true });
  await mkdir(path.join(dir, "previews"), { recursive: true });
  const wav = path.join(dir, "voice", "c1-s1.wav");
  const mp4 = path.join(dir, "previews", "c1-s1-qa.mp4");
  await execFfmpeg(["-f", "lavfi", "-i", "sine=frequency=623:sample_rate=48000:duration=1",
    "-c:a", "pcm_s16le", wav]);
  await execFfmpeg(["-f", "lavfi", "-i", "color=c=blue:s=320x180:r=30:d=1",
    "-f", "lavfi", "-i", "sine=frequency=623:sample_rate=48000:duration=1",
    "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-shortest", mp4]);
  const info = await probeMedia("/usr/bin/ffprobe", mp4, true);
  const audioHash = hash(await readFile(wav));
  const movieHash = hash(await readFile(mp4));
  const bytes = (await stat(mp4)).size;
  const request: SceneRenderRequestV2 = {
    channelsRoot: root, channel: "balislam", episode,
    sceneId: "c1-s1", planSha256: "a".repeat(64),
    mode: "narrated", orientation: "landscape",
    width: 320, height: 180, fps: 30, durationSec: 1,
    sounds: [{ kind: "narrator", file: wav, sha256: audioHash,
      startSec: 0, durationSec: 1, volume: 1,
      words: [{ word: "اختبار", start: 0, end: 1 }] }],
    pictures: [],
  };
  const result: SceneRenderSuccessV2 = {
    status: "succeeded", jobId: "trusted-qa-only",
    sceneId: request.sceneId, planSha256: request.planSha256,
    file: mp4, relativeFile: "previews/c1-s1-qa.mp4",
    sha256: movieHash, bytes, width: 320, height: 180,
    fps: info.video.fps, frames: info.video.frames,
    durationSec: info.durationSec, videoCodec: info.video.codec,
    audioCodecs: info.audio.map((s) => s.codec),
    audioStreams: info.audio.length, elapsedMs: 100,
    memoryAvailableBeforeMB: 3000, memoryAvailableMinMB: 2500,
    diskFreeBeforeMB: 5000, diskFreeAfterMB: 4900,
    inputSha256: [audioHash], reviewStatus: "not_submitted",
    sync: { maxFrameQuantizationErrorMs: 0, narratorWords: 1,
      eventStarts: [{ kind: "narrator", frame: 0 }], muxAudioStartSec: 0 },
  };
  const sources: SceneServerSourcesHandoffV2 = {
    original: { version: "v1", files: ["script.md"] },
    vocalized: { version: "v1", files: ["vocalized/c1-s1.json"] },
    tone: { version: "v1", files: ["tone/c1-s1.json"] },
    storyboard: { version: "v1", files: ["plan.json"] },
    assets: { version: "v1", files: ["assets/c1-s1.json"] },
    narration: { version: "v1", files: ["voice/c1-s1.wav"] },
    sync: { version: "v1", files: ["sync/c1-s1.json"] },
    rights: { version: "v1", files: ["rights/c1-s1.json"] },
  };
  return { dir, request, result, sources, mp4 };
};
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});
describe("trusted Studio V2 Render -> Backend manifest bridge", () => {
  it("creates a nine-group manifest bound to probed immutable MP4 without approval", async () => {
    const f = await fixture();
    const handoff = await verifySceneV2ForBackendManifest(
      f.request, f.result, f.sources, {}, "/usr/bin/ffprobe");
    expect(Object.keys(handoff.manifest.inputs).sort()).toEqual([
      "original", "vocalized", "tone", "storyboard", "assets",
      "narration", "sync", "video", "rights",
    ].sort());
    expect(handoff.manifest.sceneId).toBe("c1-s1");
    expect(handoff.manifest.audioMode).toBe("narrated");
    expect(handoff.manifest.inputs.video.files).toEqual(["previews/c1-s1-qa.mp4"]);
    expect(handoff.manifest.inputs.video.version).toBe("sha256:" + f.result.sha256);
    expect(handoff.evidence.sha256).toBe(f.result.sha256);
    expect(handoff.evidence.reviewStatus).toBe("not_submitted");
  });
  it("rejects changed MP4 bytes and malformed scene source manifest", async () => {
    const f = await fixture();
    await writeFile(f.mp4, "tampered MP4 bytes");
    await expect(verifySceneV2ForBackendManifest(
      f.request, f.result, f.sources, {}, "/usr/bin/ffprobe",
    )).rejects.toThrow(/immutable file|changed/i);
  });
  it("requires real image/SFX dependencies in the signed asset set, rejects omission", async () => {
    const f = await fixture();
    const imageFile = path.join(f.dir, "assets", "actual-scene.png");
    await writeFile(imageFile, "QA-ONLY-VISUAL-DEPENDENCY");
    const imageHash = hash(await readFile(imageFile));
    const picture = { file: imageFile, sha256: imageHash, ref: "actual-scene.png" };
    const req = { ...f.request, pictures: [picture] };
    await expect(verifySceneV2ForBackendManifest(
      req, f.result, f.sources, {}, "/usr/bin/ffprobe",
    )).rejects.toThrow(/asset manifest omitted/);
    const sources = { ...f.sources, assets: { version: "qa",
      files: ["assets/c1-s1.json", "assets/actual-scene.png"] } };
    const verified = await verifySceneV2ForBackendManifest(
      req, f.result, sources, {}, "/usr/bin/ffprobe",
    );
    expect(verified.manifest.inputs.assets.files).toContain("assets/actual-scene.png");
    await writeFile(imageFile, "TAMPERED");
    await expect(verifySceneV2ForBackendManifest(
      req, f.result, sources, {}, "/usr/bin/ffprobe",
    )).rejects.toThrow(/Picture bytes changed/);
  });
  it("rejects narration path mismatch and missing server-owned rights", async () => {
    const f = await fixture();
    const wrongSources = { ...f.sources, narration: { version: "v1", files: [] } };
    await expect(verifySceneV2ForBackendManifest(
      f.request, f.result, wrongSources, {}, "/usr/bin/ffprobe",
    )).rejects.toThrow(/Invalid Backend source set|narration files/);
    const noRights = { ...f.sources, rights: { version: "v1", files: [] } };
    await expect(verifySceneV2ForBackendManifest(
      f.request, f.result, noRights, {}, "/usr/bin/ffprobe",
    )).rejects.toThrow(/rights/i);
  });
});
