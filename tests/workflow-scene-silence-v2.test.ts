import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { collectSceneInputsFromDiskV2, type SceneFileManifestV2, type SceneAudioModeV2 } from "../src/workflow/sceneArtifactsV2";
import type { WorkflowIdentity } from "../src/workflow/store";

const roots: string[] = [];
const bytesHash = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const plans = () => ({
  version: 1, episode: "001", channel: "dafatir-alzaman",
  chapters: [
    { number: 1, scenes: [
      { id: "c1-s0", narration: "" },
      { id: "c1-s1", narration: "Narrated opening" },
    ] },
    { number: 2, scenes: [
      { id: "c2-v1", narration: "", ayahKey: "2:30" },
      { id: "c2-s2", narration: "Narrated closing" },
      { id: "c2-v2", narration: "Narration with ayah", ayahKey: "2:31" },
    ] },
  ],
});

const fileSet = (file: string) => ({ version: "v1", files: [file] });
const manifest = (id: string, mode: SceneAudioModeV2): SceneFileManifestV2 => ({
  sceneId: id,
  audioMode: mode,
  inputs: {
    original: fileSet("script.md"),
    vocalized: fileSet("vocalized/" + id + ".json"),
    tone: fileSet("tone/" + id + ".json"),
    storyboard: fileSet("storyboard/" + id + ".json"),
    assets: fileSet("images/" + id + ".png"),
    narration: { version: "v1", files: mode === "silent" ? [] :
      mode === "recitation" ? ["recitations/" + id + ".wav"] :
      mode === "mixed" ? ["voice/" + id + ".mp3", "recitations/" + id + ".wav"] :
      ["voice/" + id + ".mp3"] },
    sync: fileSet("sync/" + id + ".json"),
    video: fileSet("previews/" + id + ".mp4"),
    rights: fileSet("rights/" + id + ".json"),
  },
  shared: {},
});
const make = async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-v2-silent-scenes-"));
  roots.push(root);
  const scope: WorkflowIdentity = {
    channelsRoot: root, channel: "dafatir-alzaman", episode: "001-demo",
  };
  const dir = path.join(root, scope.channel, "episodes", scope.episode);
  await mkdir(dir, { recursive: true });
  const write = async (name: string, content: string | Buffer = "test-media") => {
    const file = path.join(dir, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  };
  await write("plan.json", JSON.stringify(plans()));
  await write("script.md", "One current locked original script");
  for (const [id, mode] of [
    ["c1-s0", "silent"], ["c1-s1", "narrated"],
    ["c2-v1", "recitation"], ["c2-s2", "narrated"],
    ["c2-v2", "mixed"],
  ] as const) {
    const m = manifest(id, mode);
    for (const input of Object.values(m.inputs)) {
      for (const name of input.files) if (name !== "script.md") await write(name, "fixture:" + name);
    }
  }
  let locks = 0;
  const sharedWriterLock = async <T>(job: () => Promise<T>): Promise<T> => {
    locks++;
    return job();
  };
  const collect = (id: string, mode: SceneAudioModeV2, override?: SceneFileManifestV2) =>
    collectSceneInputsFromDiskV2(scope, override ?? manifest(id, mode), sharedWriterLock);
  return { dir, scope, write, collect, locks: () => locks };
};
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Studio V2 D2 — legitimate silence, human recitation and composite AV", () => {
  it("accepts a real plan-verified silent visual scene with NO narrator file", async () => {
    const x = await make();
    const result = await x.collect("c1-s0", "silent");
    expect(result.inputs.narration.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.inputs.narration.epoch).toMatch(/^[a-f0-9]{64}$/);
    expect(result.inputs.video.sha256).toBe(bytesHash(await readFile(path.join(x.dir, "previews/c1-s0.mp4"))));
    expect(x.locks()).toBe(1);
  });

  it("does not conflate silent scene and regular voiced scene fingerprints", async () => {
    const x = await make();
    const silent = await x.collect("c1-s0", "silent");
    const voiced = await x.collect("c1-s1", "narrated");
    expect(silent.inputs.narration.sha256).not.toBe(voiced.inputs.narration.sha256);
    expect(silent.fingerprint).not.toBe(voiced.fingerprint);
  });

  it("rejects reclassifying narrated speech as silent", async () => {
    const x = await make();
    await expect(x.collect("c1-s1", "silent", manifest("c1-s1", "silent")))
      .rejects.toThrow(/conflicts with locked episode plan/);
  });

  it("rejects skipping owner-provided Quran recitation by claiming silence", async () => {
    const x = await make();
    await expect(x.collect("c2-v1", "silent", manifest("c2-v1", "silent")))
      .rejects.toThrow(/conflicts with locked episode plan/);
  });

  it("requires an audio file for human recitation and narrated-with-recitation scenes", async () => {
    const x = await make();
    const recitation = await x.collect("c2-v1", "recitation");
    const mixed = await x.collect("c2-v2", "mixed");
    expect(recitation.inputs.narration.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(mixed.inputs.narration.sha256).toMatch(/^[a-f0-9]{64}$/);
    const missing = manifest("c2-v1", "recitation");
    missing.inputs.narration.files = [];
    await expect(x.collect("c2-v1", "recitation", missing)).rejects.toThrow(/manifest|narration/);
  });

  it("requires separate episode-owned voice and recitation paths for a mixed scene", async () => {
    const x = await make();
    const mixed = manifest("c2-v2", "mixed");
    mixed.inputs.narration.files = ["voice/c2-v2.mp3"];
    await expect(x.collect("c2-v2", "mixed", mixed))
      .rejects.toThrow(/required narrator and\/or human-recitation/);
    const onlyRecitation = manifest("c2-v1", "recitation");
    onlyRecitation.inputs.narration.files = ["voice/c2-v1.mp3"];
    await expect(x.collect("c2-v1", "recitation", onlyRecitation))
      .rejects.toThrow(/required narrator and\/or human-recitation/);
    const onlyNarration = manifest("c1-s1", "narrated");
    onlyNarration.inputs.narration.files = ["recitations/c1-s1.wav"];
    await expect(x.collect("c1-s1", "narrated", onlyNarration))
      .rejects.toThrow(/required narrator and\/or human-recitation/);
  });

  it("rejects mismatching the required type of a Quran scene", async () => {
    const x = await make();
    await expect(x.collect("c2-v2", "narrated", manifest("c2-v2", "narrated")))
      .rejects.toThrow(/conflicts with locked episode plan/);
    await expect(x.collect("c1-s0", "recitation", manifest("c1-s0", "recitation")))
      .rejects.toThrow(/conflicts with locked episode plan/);
  });

  it("detects changes to the plan while a silent scene contains no separate audio", async () => {
    const x = await make();
    const original = await x.collect("c1-s0", "silent");
    const changed = plans();
    changed.chapters[0]!.scenes[1]!.narration = "Edited narrator";
    await x.write("plan.json", JSON.stringify(changed));
    const after = await x.collect("c1-s0", "silent");
    expect(after.inputs.narration.sha256).not.toBe(original.inputs.narration.sha256);
    expect(after.fingerprint).not.toBe(original.fingerprint);
  });

  it("detects an edit-and-restore of original plan through its OS file epoch", async () => {
    const x = await make();
    const first = await x.collect("c1-s0", "silent");
    const original = await readFile(path.join(x.dir, "plan.json"));
    await x.write("plan.json", "temporary altered plan");
    await x.write("plan.json", original);
    const restored = await x.collect("c1-s0", "silent");
    expect(restored.inputs.narration.sha256).not.toBe(first.inputs.narration.sha256);
    expect(restored.fingerprint).not.toBe(first.fingerprint);
  });

  it("refuses undeclared silent media files and fabricated audio mode", async () => {
    const x = await make();
    const withFake = manifest("c1-s0", "silent");
    withFake.inputs.narration.files = ["voice/pretend-silence.mp3"];
    await expect(x.collect("c1-s0", "silent", withFake)).rejects.toThrow(/no narration files/);
    const forged = manifest("c1-s0", "silent");
    Object.assign(forged, { audioMode: "always-valid" }); // simulate malformed runtime JSON
    await expect(x.collect("c1-s0", "silent", forged)).rejects.toThrow(/Unknown scene audio policy/);
  });

  it("refuses a silent scene with missing, malformed or foreign plan", async () => {
    const x = await make();
    await x.write("plan.json", JSON.stringify({ ...plans(), channel: "balislam" }));
    await expect(x.collect("c1-s0", "silent")).rejects.toThrow(/locked channel\/episode/);
    await x.write("plan.json", "invalid JSON");
    await expect(x.collect("c1-s0", "silent")).rejects.toThrow(/Malformed/);
  });
});
