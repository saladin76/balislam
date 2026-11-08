import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SCENE_INPUT_KEYS, type SceneInputKey } from "../src/workflow/sceneV2";
import { createTrustedSceneV2Service } from "../src/workflow/sceneServiceV2";
import { readSceneLedgerV2 } from "../src/workflow/sceneStoreV2";
import type { SceneFileManifestV2 } from "../src/workflow/sceneArtifactsV2";
import type { WorkflowIdentity } from "../src/workflow/store";

process.env.BAL_WORKFLOW_HMAC_KEY = "STUDIO_V2_SCENE_SERVICE_TEST_ONLY___LONG_RANDOM_EXAMPLE_KEY_2026";
const roots: string[] = [];
const sceneOrder = ["c1-s1", "c1-s2"] as const;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const pathFor = (scene: string, key: SceneInputKey) => ({
  original: "script.md",
  vocalized: "vocalized/" + scene + ".json",
  tone: "tone/" + scene + ".json",
  storyboard: "storyboard/" + scene + ".json",
  assets: "images/" + scene + ".png",
  narration: "voice/" + scene + ".mp3",
  sync: "sync/" + scene + ".json",
  video: "previews/" + scene + ".mp4",
  rights: "rights/" + scene + ".json",
})[key];
const manifest = (scene: string): SceneFileManifestV2 => ({
  sceneId: scene,
  audioMode: "narrated",
  inputs: {
    original: { version: "v1", files: [pathFor(scene, "original")] },
    vocalized: { version: "v1", files: [pathFor(scene, "vocalized")] },
    tone: { version: "v1", files: [pathFor(scene, "tone")] },
    storyboard: { version: "v1", files: [pathFor(scene, "storyboard")] },
    assets: { version: "v1", files: [pathFor(scene, "assets")] },
    narration: { version: "v1", files: [pathFor(scene, "narration")] },
    sync: { version: "v1", files: [pathFor(scene, "sync")] },
    video: { version: "v1", files: [pathFor(scene, "video")] },
    rights: { version: "v1", files: [pathFor(scene, "rights")] },
  },
  shared: {},
});
const fixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-scene-service-v2-"));
  roots.push(root);
  const dir = path.join(root, "balislam", "episodes", "001-test");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "plan.json"), JSON.stringify({
    version: 1, episode: "001", channel: "balislam",
    chapters: [{ number: 1, scenes: sceneOrder.map((id) =>
      ({ id, narration: "Test narrator for " + id })) }],
  }), "utf8");
  const ffprobeBinary = path.join(root, "fake-ffprobe.mjs");
  const validMetadata = {
    format: { format_name: "mov,mp4,m4a,3gp,3g2,mj2", duration: "8.5" },
    streams: [
      { codec_type: "video", codec_name: "h264", width: 1920, height: 1080 },
      { codec_type: "audio", codec_name: "aac", channels: 2 },
    ],
  };
  const setProbeOutput = async (metadata: unknown) => {
    await writeFile(ffprobeBinary,
      "#!/usr/bin/env node\nprocess.stdout.write(" +
      JSON.stringify(JSON.stringify(metadata)) + ");\n", "utf8");
    await chmod(ffprobeBinary, 0o700);
  };
  await setProbeOutput(validMetadata);
  for (const scene of sceneOrder) {
    for (const key of SCENE_INPUT_KEYS) {
      const file = path.join(dir, pathFor(scene, key));
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, "mock-test-bytes:" + scene + ":" + key);
    }
  }
  const scope: WorkflowIdentity = { channelsRoot: root, channel: "balislam", episode: "001-test" };
  const principal: { role: "owner" | "reviewer"; authenticated: boolean } = {
    role: "owner", authenticated: true,
  };
  let sourcesAllowed = true;
  let evidenceAllowed = true;
  let onEvidence: (() => Promise<void>) | undefined;
  let evidenceCalls = 0;
  let lockCalls = 0;
  let last: Promise<void> = Promise.resolve();
  const withArtifactLock = async <T>(job: () => Promise<T>): Promise<T> => {
    lockCalls++;
    const before = last;
    let finish!: () => void;
    last = new Promise<void>((resolve) => { finish = resolve; });
    await before;
    try { return await job(); } finally { finish(); }
  };
  const deps = {
    scope,
    authenticate: async () => ({
      id: "studio-owner", role: principal.role,
      authenticated: principal.authenticated,
    }) as never,
    sceneOrder: async () => sceneOrder,
    currentSceneManifest: async (scene: string) => manifest(scene),
    assertLockedScriptAndStoryboard: async () => {
      if (!sourcesAllowed) throw Error("Script/Storyboard must be approved first.");
    },
    verifyCurrentSceneAvReview: async (proof: {
      sceneId: string; ownerId: string; fingerprint: string; avSha256: string;
    }) => {
      evidenceCalls++;
      expect(proof.ownerId).toBe("studio-owner");
      expect(proof.avSha256).toMatch(/^[a-f0-9]{64}$/);
      if (!evidenceAllowed) throw Error("Owner has not watched full scene AV.");
      if (onEvidence) await onEvidence();
    },
    withArtifactLock,
    ffprobeBinary,
  };
  const service = createTrustedSceneV2Service(deps);
  const begin = (scene: string) => service.command({ action: "begin", sceneId: scene });
  const prepare = (scene: string) => service.command({ action: "prepare", sceneId: scene });
  const current = async (scene: string) => {
    const view = await service.inspect();
    const state = view.scenes.find((s) => s.id === scene);
    if (!state?.fingerprint) throw Error("Scene video is not ready.");
    return state.fingerprint;
  };
  const submit = async (scene: string) => service.command({
    action: "submit", sceneId: scene, expectedFingerprint: await current(scene),
  });
  const approve = async (scene: string) => service.command({
    action: "approve", sceneId: scene, expectedFingerprint: await current(scene),
  });
  const fullyApprove = async (scene: string) => {
    await begin(scene);
    await submit(scene);
    await approve(scene);
  };
  return {
    root, dir, scope, principal, service,
    begin, prepare, current, submit, approve, fullyApprove,
    stopSources: () => { sourcesAllowed = false; },
    stopEvidence: () => { evidenceAllowed = false; },
    duringEvidence: (callback: () => Promise<void>) => { onEvidence = callback; },
    evidenceCalls: () => evidenceCalls,
    lockCalls: () => lockCalls,
    setProbeOutput, validMetadata,
  };
};
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Studio V2 — trusted server AV scene decisions", () => {
  it("requires owner session and refuses browser-supplied identity, media paths or evidence", async () => {
    const x = await fixture();
    x.principal.authenticated = false;
    await expect(x.service.inspect()).rejects.toThrow(/owner session/);
    await expect(x.begin("c1-s1")).rejects.toThrow(/owner session/);
    x.principal.authenticated = true;
    x.principal.role = "reviewer";
    await expect(x.begin("c1-s1")).rejects.toThrow(/owner session/);
    x.principal.role = "owner";
    await expect(x.service.command({
      action: "begin", sceneId: "c1-s1",
      ownerId: "forged", evidence: true, videoPath: "/tmp/forged.mp4",
    } as never)).rejects.toThrow(/server-only/);
    await expect(x.service.command({
      action: "begin", sceneId: "../001-foreign",
    })).rejects.toThrow(/Invalid scene/);
  });

  it("allows preparing future images but refuses final production until predecessor AV approval", async () => {
    const x = await fixture();
    await x.prepare("c1-s2");
    expect((await x.service.inspect()).scenes[1]?.status).toBe("prepared");
    await expect(x.begin("c1-s2")).rejects.toThrow(/c1-s1/);
    await x.fullyApprove("c1-s1");
    expect((await x.service.inspect()).scenes[0]?.status).toBe("approved");
    await x.begin("c1-s2");
    expect((await x.service.inspect()).scenes[1]?.status).toBe("producing");
  });

  it("refuses final production if trusted locked script / Storyboard check fails", async () => {
    const x = await fixture();
    x.stopSources();
    await expect(x.begin("c1-s1")).rejects.toThrow(/Script\/Storyboard/);
    expect((await x.service.inspect()).scenes[0]?.status).toBe("draft");
  });

  it("requires actual video fingerprint on submit, not a client-provided boolean", async () => {
    const x = await fixture();
    await x.begin("c1-s1");
    await expect(x.service.command({
      action: "submit", sceneId: "c1-s1", expectedFingerprint: sha("old bytes"),
    })).rejects.toThrow(/changed/);
    await x.submit("c1-s1");
    const view = await x.service.inspect();
    expect(view.scenes[0]?.status).toBe("in_review");
    expect(view.scenes[0]?.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(x.evidenceCalls()).toBe(0);
  });

  it("rejects a spoofed MP4 file with no real video stream during submission", async () => {
    const x = await fixture();
    await x.begin("c1-s1");
    await x.setProbeOutput({ ...x.validMetadata, streams: [
      { codec_type: "audio", codec_name: "aac", channels: 2 },
    ] });
    await expect(x.submit("c1-s1")).rejects.toThrow(/video stream/);
    expect((await x.service.inspect()).scenes[0]?.status).toBe("producing");
  });

  it("rejects a narrated MP4 without an audio stream even when its hash is current", async () => {
    const x = await fixture();
    await x.begin("c1-s1");
    await x.setProbeOutput({ ...x.validMetadata, streams: [
      { codec_type: "video", codec_name: "h264", width: 1920, height: 1080 },
    ] });
    await expect(x.submit("c1-s1")).rejects.toThrow(/missing its audio track/);
    expect((await x.service.inspect()).scenes[0]?.status).toBe("producing");
  });

  it("requires independent completed video+audio viewing evidence before signoff", async () => {
    const x = await fixture();
    await x.begin("c1-s1");
    await x.submit("c1-s1");
    x.stopEvidence();
    await expect(x.approve("c1-s1")).rejects.toThrow(/not watched/);
    expect((await x.service.inspect()).scenes[0]?.status).toBe("in_review");
    expect(x.evidenceCalls()).toBe(1);
  });

  it("rechecks actual video and audio bytes after asynchronous independent AV verifier", async () => {
    const x = await fixture();
    await x.begin("c1-s1");
    await x.submit("c1-s1");
    x.duringEvidence(async () => {
      // An uncoordinated external writer should be detected by rehashing too.
      await writeFile(path.join(x.dir, pathFor("c1-s1", "narration")), "replaced voice while reviewing");
    });
    await expect(x.approve("c1-s1")).rejects.toThrow(/changed during owner AV review/);
    expect((await x.service.inspect()).scenes[0]?.status).toBe("needs_reapproval");
  });

  it("scopes corrective notes to a second and blocks assembly while any scene is unapproved", async () => {
    const x = await fixture();
    await x.fullyApprove("c1-s1");
    await expect(x.service.assemblyEligibility()).rejects.toThrow(/c1-s2/);
    await x.fullyApprove("c1-s2");
    const good = await x.service.assemblyEligibility();
    expect(good.sceneAssemblyFingerprint).toMatch(/^[a-f0-9]{64}$/);
    const beforeNote = await x.service.inspect();
    await x.service.command({
      action: "request_changes", sceneId: "c1-s1",
      expectedFingerprint: beforeNote.scenes[0]!.fingerprint,
      second: 7, note: "00:07 النطق أسرع من حركة الكاميرا",
    });
    const view = await x.service.inspect();
    expect(view.scenes[0]?.notes[0]).toMatchObject({ second: 7 });
    expect(view.scenes[1]?.status).toBe("approved");
    await expect(x.service.assemblyEligibility()).rejects.toThrow(/c1-s1/);
  });

  it("changes in one scene's narrator invalidate it without changing the other scene approval", async () => {
    const x = await fixture();
    await x.fullyApprove("c1-s1");
    await x.fullyApprove("c1-s2");
    const before = await x.service.assemblyEligibility();
    expect(before.sceneAssemblyFingerprint).toBeTruthy();
    await writeFile(path.join(x.dir, pathFor("c1-s2", "narration")), "new-take-scene-two");
    const view = await x.service.inspect();
    expect(view.scenes[0]?.status).toBe("approved");
    expect(view.scenes[1]?.status).toBe("needs_reapproval");
    await expect(x.service.assemblyEligibility()).rejects.toThrow(/c1-s2/);
  });

  it("uses a signed store and prevents double approvals when two owner commands overlap", async () => {
    const x = await fixture();
    await x.begin("c1-s1");
    await x.submit("c1-s1");
    const fp = await x.current("c1-s1");
    const command = {
      action: "approve" as const, sceneId: "c1-s1", expectedFingerprint: fp,
    };
    const two = await Promise.allSettled([x.service.command(command), x.service.command(command)]);
    expect(two.filter((s) => s.status === "fulfilled")).toHaveLength(1);
    expect(two.filter((s) => s.status === "rejected")).toHaveLength(1);
    const ledger = await readSceneLedgerV2(x.scope, sceneOrder);
    expect(ledger.events.filter((e) => e.action === "approved")).toHaveLength(1);
  });

  it("does not leak raw manifests, file paths or signing records in the browser inspection", async () => {
    const x = await fixture();
    await x.fullyApprove("c1-s1");
    const ui = JSON.stringify(await x.service.inspect());
    expect(ui).not.toMatch(/script\.md|previews\/|BAL_WORKFLOW_HMAC_KEY|integrity|avSha256|ownerId/);
    expect(x.lockCalls()).toBeGreaterThan(0);
  });

  it("rejects browser-supplied approval booleans and does not create a V2 signoff from a preexisting old ledger", async () => {
    const x = await fixture();
    await writeFile(path.join(x.dir, "workflow-approvals.json"), JSON.stringify({ approved: true }));
    await x.begin("c1-s1");
    expect((await x.service.inspect()).scenes[0]?.status).toBe("producing");
    await expect(x.service.command({
      action: "approve", sceneId: "c1-s1",
      expectedFingerprint: await x.current("c1-s1"),
      confirmWatched: true,
    } as never)).rejects.toThrow(/server-only/);
    expect(await readFile(path.join(x.dir, "workflow-approvals.json"), "utf8"))
      .toBe(JSON.stringify({ approved: true }));
  });
});
