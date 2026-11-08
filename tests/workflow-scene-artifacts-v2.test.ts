import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { link, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { WorkflowIdentity } from "../src/workflow/store";
import { SCENE_INPUT_KEYS, type SceneInputKey } from "../src/workflow/sceneV2";
import {
  collectSceneInputsFromDiskV2, type SceneFileManifestV2, type SceneFileSetV2,
} from "../src/workflow/sceneArtifactsV2";

const roots: string[] = [];
const hash = (contents: string | Buffer) =>
  createHash("sha256").update(contents).digest("hex");

const fileByKey: Record<SceneInputKey, string> = {
  original: "script.md",
  vocalized: "vocalized/c1-s1.json",
  tone: "tone/c1-s1.json",
  storyboard: "storyboard/c1-s1.json",
  assets: "images/c1-s1.png",
  narration: "voice/c1-s1.mp3",
  sync: "sync/c1-s1.json",
  video: "previews/c1-s1.mp4",
  rights: "rights/c1-s1.json",
};
const sceneFile = (key: SceneInputKey): SceneFileSetV2 => ({
  version: "v1", files: [fileByKey[key]],
});
const manifest = (): SceneFileManifestV2 => ({
  sceneId: "c1-s1",
  inputs: {
    original: sceneFile("original"),
    vocalized: sceneFile("vocalized"),
    tone: sceneFile("tone"),
    storyboard: sceneFile("storyboard"),
    assets: sceneFile("assets"),
    narration: sceneFile("narration"),
    sync: sceneFile("sync"),
    video: sceneFile("video"),
    rights: sceneFile("rights"),
  },
  shared: { "channel-logo": { version: "v1", files: ["channel-images/logo.svg"] } },
});

const make = async (
  channel: WorkflowIdentity["channel"] = "balislam",
  episode = "001-sample",
) => {
  const channelsRoot = await mkdtemp(path.join(os.tmpdir(), "studio-scene-artifact-v2-"));
  roots.push(channelsRoot);
  const dir = path.join(channelsRoot, channel, "episodes", episode);
  const images = path.join(channelsRoot, channel, "images");
  await mkdir(dir, { recursive: true });
  await mkdir(images, { recursive: true });
  for (const key of SCENE_INPUT_KEYS) {
    const relative = fileByKey[key];
    const file = path.join(dir, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, key === "video" ? Buffer.from("mock-video-not-production-mp4") : "scene:" + key);
  }
  await writeFile(path.join(images, "logo.svg"), "<svg>channel-logo</svg>");
  const scope: WorkflowIdentity = { channelsRoot, channel, episode };
  let lockCalls = 0;
  const withLock = async <T>(work: () => Promise<T>): Promise<T> => {
    lockCalls++;
    return work();
  };
  const collect = (m = manifest()) => collectSceneInputsFromDiskV2(scope, m, withLock);
  return { scope, dir, images, collect, withLock, lockCalls: () => lockCalls };
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Studio V2 — current scene inputs derived from real file bytes", () => {
  it("hashes all nine input groups and exact composed MP4 bytes under the provided lock", async () => {
    const x = await make();
    const result = await x.collect();
    expect(Object.keys(result.inputs).sort()).toEqual([...SCENE_INPUT_KEYS, "shared"].sort());
    expect(result.inputs.video.sha256).toBe(hash(await readFile(path.join(x.dir, fileByKey.video))));
    expect(result.inputs.video.epoch).toMatch(/^[a-f0-9]{64}$/);
    expect(result.inputs.narration.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.inputs.original.sha256).not.toBe(result.inputs.video.sha256);
    expect(result.inputs.shared["channel-logo"]?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(x.lockCalls()).toBe(1);
  });

  it("is stable across repeat reads without changes", async () => {
    const x = await make();
    const a = await x.collect();
    const b = await x.collect();
    expect(b).toEqual(a);
  });

  it("changing narration changes the scene fingerprint without changing the MP4 hash", async () => {
    const x = await make();
    const a = await x.collect();
    await writeFile(path.join(x.dir, fileByKey.narration), "second-voice-recording");
    const b = await x.collect();
    expect(b.inputs.narration.sha256).not.toBe(a.inputs.narration.sha256);
    expect(b.inputs.video.sha256).toBe(a.inputs.video.sha256);
    expect(b.fingerprint).not.toBe(a.fingerprint);
  });

  it("changing one byte of scene video is detectable independently of its name", async () => {
    const x = await make();
    const a = await x.collect();
    await writeFile(path.join(x.dir, fileByKey.video), "mock-video-not-production-mp5");
    const b = await x.collect();
    expect(b.inputs.video.sha256).not.toBe(a.inputs.video.sha256);
    expect(b.fingerprint).not.toBe(a.fingerprint);
  });

  it("changing a shared channel image changes the associated scene input fingerprint", async () => {
    const x = await make();
    const a = await x.collect();
    await writeFile(path.join(x.images, "logo.svg"), "<svg>logo-2</svg>");
    const b = await x.collect();
    expect(b.inputs.shared["channel-logo"]?.sha256).not.toBe(a.inputs.shared["channel-logo"]?.sha256);
    expect(b.fingerprint).not.toBe(a.fingerprint);
  });

  it("does not confuse exact same input bytes across channels", async () => {
    const a = await make("balislam");
    const b = await make("dafatir-alzaman");
    const left = await a.collect();
    const right = await b.collect();
    expect(left.inputs.video.sha256).toBe(right.inputs.video.sha256);
    expect(left.fingerprint).not.toBe(right.fingerprint);
  });

  it("rejects missing video, missing narration, missing original script and extra keys", async () => {
    const x = await make();
    const missingVideo = manifest();
    missingVideo.inputs.video = { version: "v1", files: ["previews/missing.mp4"] };
    await expect(x.collect(missingVideo)).rejects.toThrow();

    const missingAudio = manifest();
    missingAudio.inputs.narration = { version: "v1", files: ["sync/c1-s1.json"] };
    await expect(x.collect(missingAudio)).rejects.toThrow(/narration|audio/);

    const noScript = manifest();
    noScript.inputs.original = { version: "v1", files: ["tone/c1-s1.json"] };
    await expect(x.collect(noScript)).rejects.toThrow(/script.md/);

    const extras = manifest();
    Object.assign(extras.inputs, { "unapproved-extra": { version: "v1", files: ["script.md"] } });
    await expect(x.collect(extras)).rejects.toThrow(/Every scene input/);
  });

  it("never hashes a signature ledger, duplicate file, path traversal or arbitrary video extension", async () => {
    const x = await make();
    const ledger = manifest();
    ledger.inputs.rights = { version: "v1", files: ["scene-workflow.v2.json"] };
    await expect(x.collect(ledger)).rejects.toThrow(/Unsafe|sensitive/);
    const duplicates = manifest();
    duplicates.inputs.assets = { version: "v1", files: ["script.md", "script.md"] };
    await expect(x.collect(duplicates)).rejects.toThrow(/duplicate/);
    const outside = manifest();
    outside.inputs.assets = { version: "v1", files: ["../other-episode/logo.svg"] };
    await expect(x.collect(outside)).rejects.toThrow(/Unsafe/);
    const noVideo = manifest();
    noVideo.inputs.video = { version: "v1", files: ["voice/c1-s1.mp3"] };
    await expect(x.collect(noVideo)).rejects.toThrow(/MP4/);
  });

  it("rejects symbolic links and hard-linked media from other episodes", async () => {
    const x = await make();
    const target = path.join(x.dir, fileByKey.narration);
    const symlinkPath = path.join(x.dir, "voice", "linked.mp3");
    await symlink(target, symlinkPath);
    const symbolic = manifest();
    symbolic.inputs.narration = { version: "v1", files: ["voice/linked.mp3"] };
    await expect(x.collect(symbolic)).rejects.toThrow(/Symlink/);
    const hardlinkPath = path.join(x.dir, "voice", "hardlink.mp3");
    await link(target, hardlinkPath);
    const hardlinked = manifest();
    hardlinked.inputs.narration = { version: "v1", files: ["voice/hardlink.mp3"] };
    await expect(x.collect(hardlinked)).rejects.toThrow(/hardlink|regular|unlinked/);
  });

  it("requires a real lock callback and never mutates the file manifest", async () => {
    const x = await make();
    const m = manifest();
    const snapshot = structuredClone(m);
    await expect(collectSceneInputsFromDiskV2(x.scope, m, undefined as never))
      .rejects.toThrow(/artifact lock/);
    await x.collect(m);
    expect(m).toEqual(snapshot);
  });

  it("fails when real artifact bytes are edited then restored by detecting epoch changes", async () => {
    const x = await make();
    const before = await x.collect();
    const file = path.join(x.dir, fileByKey.narration);
    const old = await readFile(file);
    await writeFile(file, "changed voice");
    await writeFile(file, old);
    const after = await x.collect();
    expect(after.inputs.narration.sha256).toBe(before.inputs.narration.sha256);
    expect(after.inputs.narration.epoch).not.toBe(before.inputs.narration.epoch);
    expect(after.fingerprint).not.toBe(before.fingerprint);
  });
});
