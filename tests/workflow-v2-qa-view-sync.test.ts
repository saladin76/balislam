/**
 * QA-04 UI read-model contract: the trusted service must reveal a revoked
 * current AV version, not keep showing "approved" after new MP4 bytes arrive.
 *
 * This is an isolated server adapter test with FAKE ffprobe metadata and a
 * fake review receipt, NOT browser screenshots or real human viewing.
 */
import { afterEach, describe, expect, it } from "vitest";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SCENE_INPUT_KEYS, type SceneInputKey } from "../src/workflow/sceneV2";
import { createTrustedSceneV2Service } from "../src/workflow/sceneServiceV2";
import { type SceneFileManifestV2 } from "../src/workflow/sceneArtifactsV2";

const owns: string[] = [];
const initialKey = process.env.BAL_WORKFLOW_HMAC_KEY;
const order = ["c1-s1", "c1-s2"];
const fileFor = (id: string, key: SceneInputKey) =>
  key === "original" ? "script.md"
    : key === "narration" ? "voice/" + id + ".wav"
      : key === "video" ? "previews/" + id + ".mp4"
        : "qa/" + id + "-" + key + ".json";
const manifest = (id: string): SceneFileManifestV2 => ({
  sceneId: id, audioMode: "narrated",
  inputs: Object.fromEntries(SCENE_INPUT_KEYS.map((key) =>
    [key, { version: "qa-1", files: [fileFor(id, key)] }])) as unknown as SceneFileManifestV2["inputs"],
  shared: {},
});
const fixture = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-v2-qa-ui-view-"));
  owns.push(root);
  process.env.BAL_WORKFLOW_HMAC_KEY = "QA_ONLY_UI_READ_MODEL_KEY_20261108_SAFELY_ISOLATED";
  const dir = path.join(root, "balislam", "episodes", "001-qa-view");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "plan.json"), JSON.stringify({
    version: 1, channel: "balislam", episode: "001",
    chapters: [{ number: 1, scenes: order.map((id) => ({ id, narration: "test " + id })) }],
  }));
  await writeFile(path.join(dir, "script.md"), "locked QA scene script");
  for (const id of order) for (const key of SCENE_INPUT_KEYS) {
    const target = path.join(dir, fileFor(id, key));
    await mkdir(path.dirname(target), { recursive: true });
    // The script is shared across both scenes by design.
    if (key !== "original") await writeFile(target, id + ":" + key + ":v1");
  }
  const fakeProbe = path.join(root, "ffprobe-test.mjs");
  await writeFile(fakeProbe,
    "#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify(" +
    JSON.stringify({
      format: { format_name: "mov,mp4,m4a,3gp,3g2,mj2", duration: "3.25" },
      streams: [
        { codec_type: "video", codec_name: "h264", width: 320, height: 180 },
        { codec_type: "audio", codec_name: "aac", channels: 2 },
      ],
    }) + "));\n");
  await chmod(fakeProbe, 0o700);
  const service = createTrustedSceneV2Service({
    scope: { channelsRoot: root, channel: "balislam", episode: "001-qa-view" },
    authenticate: async () => ({ id: "studio-owner", role: "owner" as const, authenticated: true as const }),
    sceneOrder: async () => order,
    currentSceneManifest: async (id) => manifest(id),
    assertLockedScriptAndStoryboard: async () => undefined, // test-only source gate
    verifyCurrentSceneAvReview: async () => undefined, // mock; NOT owner evidence
    withArtifactLock: async (work) => work(), // isolated; NOT a production writer lock
    ffprobeBinary: fakeProbe,
  });
  const fingerprint = async (id: string) => {
    const item = (await service.inspect()).scenes.find((s) => s.id === id);
    if (!item?.fingerprint) throw Error("Current AV fingerprint is missing.");
    return item.fingerprint;
  };
  const approve = async (id: string) => {
    await service.command({ action: "begin", sceneId: id });
    await service.command({ action: "submit", sceneId: id, expectedFingerprint: await fingerprint(id) });
    await service.command({ action: "approve", sceneId: id, expectedFingerprint: await fingerprint(id) });
  };
  return { dir, service, approve, fingerprint };
};
afterEach(async () => {
  if (initialKey === undefined) delete process.env.BAL_WORKFLOW_HMAC_KEY;
  else process.env.BAL_WORKFLOW_HMAC_KEY = initialKey;
  for (const root of owns.splice(0)) await rm(root, { recursive: true, force: true });
});

describe("QA-04: UI AV version invalidation read-model contract", () => {
  it("drops the old approval on a new scene MP4 but retains another scene's approval", async () => {
    const x = await fixture();
    await x.approve("c1-s1");
    await x.approve("c1-s2");
    const before = await x.service.inspect();
    expect(before.scenes.map((s) => s.status)).toEqual(["approved", "approved"]);
    const oldFingerprint = before.scenes[0]?.fingerprint;
    await writeFile(path.join(x.dir, "previews", "c1-s1.mp4"), "new-version:v2");
    const changed = await x.service.inspect();
    expect(changed.scenes[0]?.status).toBe("needs_reapproval");
    expect(changed.scenes[0]?.approvedAt).toBeUndefined();
    expect(changed.scenes[0]?.fingerprint).not.toBe(oldFingerprint);
    expect(changed.scenes[1]?.status).toBe("approved");
    await expect(x.service.assemblyEligibility()).rejects.toThrow(/c1-s1/);
    await writeFile(path.join(x.dir, "previews", "c1-s1.mp4"), "c1-s1:video:v1");
    const restored = await x.service.inspect();
    expect(restored.scenes[0]?.status).toBe("needs_reapproval");
    expect(restored.scenes[1]?.status).toBe("approved");
  });

  it("a video update between submit and approve refuses a stale browser fingerprint", async () => {
    const x = await fixture();
    await x.service.command({ action: "begin", sceneId: "c1-s1" });
    const original = await x.fingerprint("c1-s1");
    await x.service.command({
      action: "submit", sceneId: "c1-s1", expectedFingerprint: original,
    });
    await writeFile(path.join(x.dir, "previews", "c1-s1.mp4"), "second-submission-video");
    await expect(x.service.command({
      action: "approve", sceneId: "c1-s1", expectedFingerprint: original,
    })).rejects.toThrow(/changed/);
    const current = await x.service.inspect();
    expect(current.scenes[0]?.status).toBe("needs_reapproval");
    expect(current.scenes[0]?.approvedAt).toBeUndefined();
  });
});
