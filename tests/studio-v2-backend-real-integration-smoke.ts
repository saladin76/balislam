/**
 * OPT-IN real FFmpeg -> Backend V2 integration test.
 * Exercises actual MP4 bytes, signed manifests, current begin generation,
 * owner receipt state machine, signed AV approval and the next-scene gate.
 *
 * It uses a synthetic QA tone and an injected FFmpeg fixture renderer,
 * NOT PR #86 Remotion nor a real human owner review. Never count this as
 * production creative, human attention, Quran provenance, UI or browser QA.
 *
 * Required on Mac:
 * STUDIO_FFMPEG_BIN=/absolute/ffmpeg STUDIO_FFPROBE_BIN=/absolute/ffprobe \
 *   npx --no-install tsx tests/studio-v2-backend-real-integration-smoke.ts
 */
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { withSceneArtifactLockV2 } from "../src/workflow/sceneLockV2.ts";
import { writeTrustedSceneRenderSpecLockedV2, type TrustedSceneRenderSpecV2 } from "../src/workflow/sceneRenderSpecV2.ts";
import { runTrustedSceneProductionV2 } from "../src/workflow/sceneRenderBridgeV2.ts";
import { requireCurrentSceneRenderLockedV2 } from "../src/workflow/sceneRenderCommitV2.ts";
import { readPlannedSceneOrderV2 } from "../src/workflow/scenePlanV2.ts";
import { approveSceneSourcesV2, inspectSceneSourcesV2, requireApprovedSceneSourcesV2 } from "../src/workflow/sceneSourcesV2.ts";
import { readRegisteredSceneManifestV2 } from "../src/workflow/sceneManifestRegistryV2.ts";
import { collectSceneInputsFromDiskV2 } from "../src/workflow/sceneArtifactsV2.ts";
import { probeSceneAvLockedV2 } from "../src/workflow/sceneMediaV2.ts";
import { createTrustedSceneV2Service } from "../src/workflow/sceneServiceV2.ts";
import { appendCompletedSceneAvReviewV2, requireCompletedSceneAvReviewV2 } from "../src/workflow/sceneReviewAuditV2.ts";
import { startSceneReviewReceiptV2, streamSceneReviewReceiptV2, tickSceneReviewReceiptV2,
  finishSceneReviewReceiptV2, verifySceneReviewReceiptV2 } from "../app/server/studioV2Review.ts";
import { resolveArtifact, sha256FileAndEpoch } from "../src/workflow/artifacts.ts";
import type { WorkflowIdentity } from "../src/workflow/index.ts";

const hash = (buf: string | Buffer) => createHash("sha256").update(buf).digest("hex");
const insist = (x: unknown, message: string) => { if (!x) throw Error(message); };
const ffmpeg = process.env.STUDIO_FFMPEG_BIN;
const ffprobe = process.env.STUDIO_FFPROBE_BIN;
const runFFmpeg = async (args: string[]) => new Promise<void>((resolve, reject) => {
  if (!ffmpeg || !path.isAbsolute(ffmpeg)) return reject(Error("Absolute ffmpeg required"));
  const child = spawn(ffmpeg, ["-hide_banner", "-loglevel", "error", "-nostdin", "-n", ...args],
    { stdio: ["ignore", "ignore", "pipe"], shell: false });
  let error = "";
  const timer = setTimeout(() => child.kill("SIGKILL"), 25000);
  child.stderr?.on("data", (part: Buffer) => {
    if (error.length < 2048) error += part.toString("utf8").slice(0, 2048-error.length);
  });
  child.once("error", (e) => { clearTimeout(timer); reject(e); });
  child.once("close", (code) => {
    clearTimeout(timer);
    code === 0 ? resolve() : reject(Error("FFmpeg integration failed: " + error));
  });
});
const group = (file: string) => ({ version: "qa-technical-v1", files: [file] });
const makeManifest = (id: string, audio: boolean) => ({
  sceneId: id, audioMode: audio ? "narrated" as const : "silent" as const,
  inputs: {
    original: group("script.md"),
    vocalized: group("vocalized/" + id + ".json"),
    tone: group("tone/" + id + ".json"),
    storyboard: group("plan.json"),
    assets: group("assets/" + id + ".png"),
    narration: audio ? group("voice/" + id + ".wav") : { version: "qa-technical-v1", files: [] },
    sync: group("sync/" + id + ".json"),
    video: { version: "pending", files: [] },
    rights: group("rights/" + id + ".json"),
  }, shared: {},
});

const main = async () => {
  if (!ffmpeg || !ffprobe || !path.isAbsolute(ffmpeg) || !path.isAbsolute(ffprobe))
    throw Error("STUDIO_FFMPEG_BIN and STUDIO_FFPROBE_BIN must be absolute.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "studio-v2-backend-real-phase2-"));
  process.env.BAL_WORKFLOW_HMAC_KEY = "REAL_INTEGRATION_QA_ONLY_HMAC_KEY_NOT_FOR_PRODUCTION_012345";
  const scope: WorkflowIdentity = { channelsRoot: path.join(dir, "channels"),
    channel: "balislam", episode: "001-integrationqa" };
  const root = path.join(scope.channelsRoot, scope.channel, "episodes", scope.episode);
  const save = async (p: string, content: string | Buffer) => {
    const output = path.join(root, p);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, content, { flag: "wx" });
    return output;
  };
  const locked = <T>(work: () => Promise<T>) => withSceneArtifactLockV2(scope, work);
  const ids = ["c1-s1", "c1-s2"];
  try {
    await mkdir(root, { recursive: true });
    await save("script.md", "Backend isolated synthetic QA; no religious material.");
    await save("plan.json", JSON.stringify({ version: 1, episode: "001", channel: "balislam",
      chapters: [{ number: 1, scenes: [
        { id: ids[0], narration: "Hello" },
        { id: ids[1], narration: "" },
      ] }] }));
    for (const id of ids) {
      for (const name of ["vocalized", "tone", "sync", "rights"])
        await save(name + "/" + id + ".json", "{}");
      await save("assets/" + id + ".png", "Synthetic QA placeholder, no actual artwork");
    }
    await runFFmpeg(["-f", "lavfi", "-i",
      "sine=frequency=440:sample_rate=48000:duration=2",
      "-c:a", "pcm_s16le", path.join(root, "voice", ids[0] + ".wav")]);
    const src = await inspectSceneSourcesV2(scope);
    await approveSceneSourcesV2(scope, "script", src.script.fingerprint,
      "qa-studio-owner", "QA approved synthetic source");
    await approveSceneSourcesV2(scope, "storyboard", src.storyboard.fingerprint,
      "qa-studio-owner", "QA approved synthetic storyboard");
    for (const id of ids) {
      const narrated = id === ids[0];
      const spec: TrustedSceneRenderSpecV2 = {
        sceneId: id, width: 320, height: 180, orientation: "landscape",
        durationSec: 2, manifest: makeManifest(id, narrated),
        pictures: [], sounds: narrated ? [{
          file: "voice/" + id + ".wav",
          sha256: hash(await readFile(path.join(root, "voice", id + ".wav"))),
          kind: "narrator", startSec: 0, durationSec: 2, volume: 1,
          words: [{ word: "Hello", start: 0, end: 1 }],
        }] : [],
      };
      await locked(() => writeTrustedSceneRenderSpecLockedV2(scope, spec));
    }
    const session = hash("qa-browser-session");
    let reviewId = "";
    const service = createTrustedSceneV2Service({
      scope,
      authenticate: async () => ({ id: "qa-studio-owner", authenticated: true as const,
        role: "owner" as const }),
      sceneOrder: async () =>
        (await readPlannedSceneOrderV2(scope, async (job) => job())).sceneOrder,
      currentSceneManifest: (id) => readRegisteredSceneManifestV2(scope, id),
      assertLockedScriptAndStoryboard: () => requireApprovedSceneSourcesV2(scope),
      withArtifactLock: locked, ffprobeBinary: ffprobe,
      requireCurrentRenderReceipt: async (proof) =>
        requireCurrentSceneRenderLockedV2(scope, proof.sceneId, proof.sceneOrder, {
          jobId: proof.videoVersion, fingerprint: proof.fingerprint,
          videoSha256: proof.videoSha256, videoEpoch: proof.videoEpoch,
        }),
      verifyCurrentSceneAvReview: async (proof) => {
        const manifest = await readRegisteredSceneManifestV2(scope, proof.sceneId);
        const videoFile = await resolveArtifact(scope, manifest.inputs.video.files[0]!);
        const observed = await sha256FileAndEpoch(videoFile);
        verifySceneReviewReceiptV2(reviewId, session, proof,
          scope.channel + "/" + scope.episode, observed.epoch);
        await requireCompletedSceneAvReviewV2(scope, {
          id: reviewId, sessionId: session, ownerId: proof.ownerId,
          sceneId: proof.sceneId, fingerprint: proof.fingerprint,
          avSha256: proof.avSha256, avEpoch: observed.epoch,
          videoVersion: manifest.inputs.video.version,
        });
      },
    });
    await service.command({ action: "begin", sceneId: ids[0] });
    const testRenderer = async (request: any, adapters: any) =>
      adapters.withProductionLease(request.sceneId, async () => {
        await adapters.withArtifactLock(() => adapters.assertCanRender(request));
        const jobId = randomUUID();
        const relativeFile = "previews/" + request.sceneId + "-" +
          request.planSha256.slice(0, 12) + "-" + jobId + ".mp4";
        const output = path.join(root, relativeFile);
        await mkdir(path.dirname(output), { recursive: true });
        const visual = ["-f", "lavfi", "-i", "testsrc2=size=320x180:rate=30:duration=2"];
        if (request.mode === "narrated")
          await runFFmpeg([...visual, "-i", request.sounds[0].file,
            "-c:v", "mpeg4", "-q:v", "5", "-c:a", "aac", "-b:a", "96k",
            "-shortest", "-movflags", "+faststart", output]);
        else
          await runFFmpeg([...visual, "-c:v", "mpeg4", "-q:v", "5", "-an",
            "-movflags", "+faststart", output]);
        await adapters.withArtifactLock(() => adapters.assertCanRender(request));
        const buf = await readFile(output);
        return { status: "succeeded", jobId, sceneId: request.sceneId,
          planSha256: request.planSha256, file: output, relativeFile,
          sha256: hash(buf), bytes: buf.length, reviewStatus: "not_submitted" };
      });
    const first = await runTrustedSceneProductionV2(scope, ids[0], {
      renderer: testRenderer, ffprobeBinary: ffprobe,
      verifySourceReview: async () => {},
    });
    insist(first.status === "rendered" && first.video.hasAudio,
      "Synthetic narrated MP4 was not registered and verified.");
    console.log("PASS signed render -> actual MP4 -> ffprobe -> current render receipt");
    const status = await service.inspect();
    insist(status.scenes[0]?.currentVideo?.sha256 === first.video.sha256,
      "Server scene read model lost current video SHA.");
    await service.command({ action: "submit", sceneId: ids[0],
      expectedFingerprint: first.fingerprint });
    const manifest = await locked(() => readRegisteredSceneManifestV2(scope, ids[0]));
    const av = await locked(async () => {
      const media = await probeSceneAvLockedV2(scope, manifest, { ffprobeBinary: ffprobe });
      const size = (await stat(await resolveArtifact(scope, manifest.inputs.video.files[0]!))).size;
      const captured = await collectSceneInputsFromDiskV2(scope, manifest, async (job) => job());
      insist(captured.fingerprint === first.fingerprint, "Submit fingerprint mismatch.");
      return { ...media, size };
    });
    const started = startSceneReviewReceiptV2({
      sessionId: session, ownerId: "qa-studio-owner", scope: scope.channel + "/" + scope.episode,
      sceneId: ids[0], fingerprint: first.fingerprint, avSha256: av.sha256,
      avEpoch: av.epoch, videoVersion: first.video.version,
      durationSec: av.durationSec, mediaBytes: av.size,
    });
    reviewId = started.reviewId;
    streamSceneReviewReceiptV2(reviewId, session, 0, av.size);
    let challenge = started.challenge;
    let elapsed = 0;
    while (elapsed < av.durationSec) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      elapsed = Math.min(av.durationSec, elapsed + 1);
      const tick = tickSceneReviewReceiptV2(reviewId, session,
        { positionSec: elapsed, challenge });
      challenge = tick.challenge;
    }
    insist(finishSceneReviewReceiptV2(reviewId, session,
      { confirmation: "reviewed_av" }).completed, "Simulated AV receipt not complete.");
    const receipt = {
      id: reviewId, sessionId: session, ownerId: "qa-studio-owner",
      sceneId: ids[0], fingerprint: first.fingerprint,
      avSha256: av.sha256, avEpoch: av.epoch, videoVersion: first.video.version,
      durationSec: av.durationSec, mediaBytes: av.size,
      playedSec: elapsed, startedAt: Date.now() - elapsed * 1000,
      completedAt: Date.now(), checkpoints: Math.ceil(elapsed),
    };
    await locked(() => appendCompletedSceneAvReviewV2(scope, receipt));
    await service.command({ action: "approve", sceneId: ids[0],
      expectedFingerprint: first.fingerprint });
    console.log("PASS signed owner-review protocol fixture -> signed scene 1 approval");
    await service.command({ action: "begin", sceneId: ids[1] });
    console.log("PASS scene 2 opens only after scene 1 exact AV approval");
    const originalVoice = await readFile(path.join(root, "voice", ids[0] + ".wav"));
    await writeFile(path.join(root, "voice", ids[0] + ".wav"), originalVoice);
    let rendererCalled = false;
    try {
      await runTrustedSceneProductionV2(scope, ids[1], {
        renderer: async () => { rendererCalled = true; throw Error("unsafe"); },
        ffprobeBinary: ffprobe, verifySourceReview: async () => {},
      });
      throw Error("UNSAFE: stale predecessor was permitted.");
    } catch (e) {
      insist(!rendererCalled && !String(e).includes("UNSAFE"),
        "Expired predecessor approval was not rejected before Render.");
    }
    console.log("PASS changed/restored predecessor AV input rejects scene 2 before Render");
    console.log("PASS real Backend AV integration fixture — not a human/Remotion/Chrome signoff");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};
await main().catch((error) => {
  console.error("FAILED Studio V2 Backend real integration:", error);
  process.exitCode = 1;
});
