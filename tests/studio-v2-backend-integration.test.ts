import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sceneArtifactLockFileV2, withSceneArtifactLockV2 } from "../src/workflow/sceneLockV2";
import {
  approveSceneSourcesV2, inspectSceneSourcesV2, requireApprovedSceneSourcesV2,
} from "../src/workflow/sceneSourcesV2";
import {
  readRegisteredSceneManifestV2, registerRenderedSceneManifestV2,
} from "../src/workflow/sceneManifestRegistryV2";
import {
  appendCompletedSceneAvReviewV2, requireCompletedSceneAvReviewV2,
} from "../src/workflow/sceneReviewAuditV2";
import {
  finishSceneReviewReceiptV2, startSceneReviewReceiptV2, streamSceneReviewReceiptV2,
  tickSceneReviewReceiptV2, verifySceneReviewReceiptV2,
} from "../app/server/studioV2Review";
import {
  loginStudioV2, requireStudioV2Session, requireStudioV2Write,
} from "../app/server/studioV2Session";
import type { WorkflowIdentity } from "../src/workflow/store";
import type { SceneFileManifestV2 } from "../src/workflow/sceneArtifactsV2";

process.env.BAL_WORKFLOW_HMAC_KEY = "BACKEND_V2_TEST_ONLY_SIGNING_KEY_NEVER_USE_THIS_IN_REAL_DEPLOYMENTS";
const folders: string[] = [];
const make = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-backend-v2-"));
  folders.push(root);
  const scope: WorkflowIdentity = {
    channelsRoot: root, channel: "balislam", episode: "001-backend",
  };
  const dir = path.join(root, "balislam", "episodes", "001-backend");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "script.md"), "approved source text");
  await writeFile(path.join(dir, "plan.json"), JSON.stringify({
    version: 1, episode: "001", channel: "balislam",
    chapters: [{ number: 1, scenes: [{ id: "c1-s1", narration: "Hello" }] }],
  }));
  return { root, dir, scope };
};
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
const manifest = (): SceneFileManifestV2 => ({
  sceneId: "c1-s1", audioMode: "narrated",
  inputs: {
    original: { version: "v1", files: ["script.md"] },
    vocalized: { version: "v1", files: ["vocalized/c1-s1.json"] },
    tone: { version: "v1", files: ["tone/c1-s1.json"] },
    storyboard: { version: "v1", files: ["plan.json"] },
    assets: { version: "v1", files: ["images/c1-s1.png"] },
    narration: { version: "v1", files: ["voice/c1-s1.mp3"] },
    sync: { version: "v1", files: ["sync/c1-s1.json"] },
    video: { version: "v1", files: ["out/scenes/c1-s1.mp4"] },
    rights: { version: "v1", files: ["rights/c1-s1.json"] },
  },
  shared: {},
});
afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(folders.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Studio V2 Backend integration security", () => {
  it("serializes episode-wide file operations without stealing or deleting foreign locks", async () => {
    const { scope } = await make();
    const order: string[] = [];
    await Promise.all([
      withSceneArtifactLockV2(scope, async () => {
        order.push("first-enter");
        await new Promise((resolve) => setTimeout(resolve, 35));
        order.push("first-exit");
      }),
      withSceneArtifactLockV2(scope, async () => { order.push("second-enter"); },
        { attempts: 30, delayMs: 5 }),
    ]);
    expect(order).toEqual(["first-enter", "first-exit", "second-enter"]);
    const lockFile = await sceneArtifactLockFileV2(scope);
    await writeFile(lockFile, "foreign-lock");
    await expect(withSceneArtifactLockV2(scope, async () => 1,
      { attempts: 2, delayMs: 1 })).rejects.toThrow(/ARTIFACT_BUSY/);
    expect(await readFile(lockFile, "utf8")).toBe("foreign-lock");
  });

  it("signs explicit script + storyboard decisions and invalidates when source bytes change", async () => {
    const { scope, dir } = await make();
    const before = await inspectSceneSourcesV2(scope);
    expect(before.script.approved).toBe(false);
    await expect(requireApprovedSceneSourcesV2(scope)).rejects.toThrow(/approvals/);
    await approveSceneSourcesV2(scope, "script", before.script.fingerprint,
      "studio-owner", "Reviewed full script and citations");
    await approveSceneSourcesV2(scope, "storyboard", before.storyboard.fingerprint,
      "studio-owner", "Reviewed complete episode storyboard");
    await requireApprovedSceneSourcesV2(scope);
    await writeFile(path.join(dir, "review.json"), '{"version":1,"items":{}}');
    expect((await inspectSceneSourcesV2(scope)).script.approved).toBe(false);
    await expect(requireApprovedSceneSourcesV2(scope)).rejects.toThrow(/approvals/);
  });

  it("rejects source ledger tampering without trusting a browser's status", async () => {
    const { scope, dir } = await make();
    const state = await inspectSceneSourcesV2(scope);
    await approveSceneSourcesV2(scope, "script", state.script.fingerprint,
      "studio-owner", "Source contents were checked");
    const file = path.join(dir, "scene-sources.v2.json");
    const data = JSON.parse(await readFile(file, "utf8"));
    data.approvals.script.ownerId = "forged-owner";
    await writeFile(file, JSON.stringify(data));
    await expect(inspectSceneSourcesV2(scope)).rejects.toThrow(/forged/);
  });

  it("requires a signed server-owned Render manifest bound to the locked plan", async () => {
    const { scope, dir } = await make();
    await expect(readRegisteredSceneManifestV2(scope, "c1-s1")).rejects.toThrow();
    await registerRenderedSceneManifestV2(scope, manifest(), (job) =>
      withSceneArtifactLockV2(scope, job));
    expect((await readRegisteredSceneManifestV2(scope, "c1-s1")).audioMode)
      .toBe("narrated");
    const file = path.join(dir, ".studio-v2-manifests", "c1-s1.json");
    const data = JSON.parse(await readFile(file, "utf8"));
    data.manifest.inputs.video.files[0] = "/tmp/fake.mp4";
    await writeFile(file, JSON.stringify(data));
    await expect(readRegisteredSceneManifestV2(scope, "c1-s1"))
      .rejects.toThrow(/signature mismatch/);
  });

  it("does not issue completed AV evidence from watched=true, skipped progress or stale bytes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-08T10:00:00Z"));
    const info = {
      sessionId: sha("session"), ownerId: "studio-owner",
      scope: "balislam/001-backend", sceneId: "c1-s1",
      fingerprint: sha("fingerprint"), avSha256: sha("video"),
      avEpoch: sha("epoch"), videoVersion: "v1", durationSec: 2, mediaBytes: 1000,
    };
    const started = startSceneReviewReceiptV2(info);
    expect(() => finishSceneReviewReceiptV2(started.reviewId, info.sessionId,
      { watched: true })).toThrow();
    expect(() => tickSceneReviewReceiptV2(started.reviewId, info.sessionId,
      { positionSec: 2, challenge: started.challenge })).toThrow();
    streamSceneReviewReceiptV2(started.reviewId, info.sessionId, 0, 1000);
    vi.advanceTimersByTime(1000);
    const p1 = tickSceneReviewReceiptV2(started.reviewId, info.sessionId,
      { positionSec: 1, challenge: started.challenge });
    vi.advanceTimersByTime(1000);
    tickSceneReviewReceiptV2(started.reviewId, info.sessionId,
      { positionSec: 2, challenge: p1.challenge });
    expect(finishSceneReviewReceiptV2(started.reviewId, info.sessionId,
      { confirmation: "reviewed_av" }).completed).toBe(true);
    const proof = { sceneId: info.sceneId, ownerId: info.ownerId,
      fingerprint: info.fingerprint, avSha256: info.avSha256 };
    expect(() => verifySceneReviewReceiptV2(started.reviewId, info.sessionId,
      proof, info.scope, sha("different-epoch"))).toThrow();
    expect(() => verifySceneReviewReceiptV2(started.reviewId, info.sessionId,
      proof, info.scope, info.avEpoch)).not.toThrow();
  });

  it("persists independent signed owner AV evidence and rejects forged receipt logs", async () => {
    const { scope, dir } = await make();
    const completed = {
      id: "a".repeat(48), sessionId: sha("owner-session"), ownerId: "studio-owner",
      sceneId: "c1-s1", fingerprint: sha("submitted"),
      avSha256: sha("actual-video"), avEpoch: sha("actual-epoch"),
      videoVersion: "v1", durationSec: 3, mediaBytes: 2500,
      playedSec: 3, startedAt: 1_000_000, completedAt: 1_003_100,
      checkpoints: 3,
    };
    await appendCompletedSceneAvReviewV2(scope, completed);
    await requireCompletedSceneAvReviewV2(scope, completed);
    await expect(appendCompletedSceneAvReviewV2(scope, completed))
      .rejects.toThrow(/already committed/);
    await expect(requireCompletedSceneAvReviewV2(scope, {
      ...completed, avSha256: sha("other-video"),
    })).rejects.toThrow(/No current signed/);
    const file = path.join(dir, "scene-av-review.v2.json");
    const json = JSON.parse(await readFile(file, "utf8"));
    json.reviews[0].ownerId = "forged-owner";
    await writeFile(file, JSON.stringify(json));
    await expect(requireCompletedSceneAvReviewV2(scope, completed))
      .rejects.toThrow(/Corrupt or forged/);
  });

  it("derives owner identity from server configuration and rejects role injection/CSRF", () => {
    process.env.STUDIO_V2_OWNER_SECRET = "SESSION_TEST_SECRET_ONLY_32_BYTES_MINIMUM_0123456789";
    process.env.STUDIO_V2_OWNER_ID = "studio-owner";
    const headers: Record<string, string> = {
      host: "localhost:5173", origin: "http://localhost:5173",
      "content-type": "application/json",
    };
    const req = { headers, socket: { remoteAddress: "127.0.0.1" } } as never;
    let cookie = "";
    const res = { setHeader: (name: string, value: string) => {
      if (name === "set-cookie") cookie = value;
    } } as never;
    expect(() => loginStudioV2(req, res, {
      secret: process.env.STUDIO_V2_OWNER_SECRET, role: "owner",
    })).toThrow(/V2_BAD_CREDENTIALS/);
    const result = loginStudioV2(req, res, { secret: process.env.STUDIO_V2_OWNER_SECRET });
    headers.cookie = cookie.split(";")[0]!;
    expect(requireStudioV2Session(req).userId).toBe("studio-owner");
    expect(() => requireStudioV2Write(req)).toThrow(/V2_CSRF_REJECTED/);
    headers["x-studio-v2-csrf"] = result.csrfToken;
    expect(requireStudioV2Write(req).userId).toBe("studio-owner");
    headers.origin = "http://evil.local";
    expect(() => requireStudioV2Write(req)).toThrow(/V2_CROSS_ORIGIN/);
  });
});
