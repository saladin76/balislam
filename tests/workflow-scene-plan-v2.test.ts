import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { WorkflowIdentity } from "../src/workflow/store";
import { readPlannedSceneOrderV2 } from "../src/workflow/scenePlanV2";

const roots: string[] = [];
const samplePlan = () => ({
  version: 1, episode: "001", channel: "dafatir-alzaman",
  chapters: [
    { number: 1, title: "المقدمة", scenes: [
      { id: "c1-s0", narration: "", sfx: [] },
      { id: "c1-s1", narration: "بسم الله الرحمن الرحيم.", sfx: [] },
    ] },
    { number: 2, title: "آية قرآنية", scenes: [
      { id: "c2-v1", narration: "", ayahKey: "2:30", sfx: [] },
      { id: "c2-s2", narration: "خاتمة المشهد", sfx: [] },
    ] },
  ],
});
const make = async () => {
  const channelsRoot = await mkdtemp(path.join(os.tmpdir(), "studio-v2-plan-"));
  roots.push(channelsRoot);
  const dir = path.join(channelsRoot, "dafatir-alzaman", "episodes", "001-demo");
  await mkdir(dir, { recursive: true });
  const scope: WorkflowIdentity = {
    channelsRoot, channel: "dafatir-alzaman", episode: "001-demo",
  };
  let locks = 0;
  const withLock = async <T>(work: () => Promise<T>): Promise<T> => {
    locks++;
    return work();
  };
  const put = async (plan: unknown) =>
    writeFile(path.join(dir, "plan.json"), JSON.stringify(plan), "utf8");
  const load = () => readPlannedSceneOrderV2(scope, withLock);
  await put(samplePlan());
  return { dir, scope, put, load, withLock, locks: () => locks };
};
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("Studio V2 — real Storyboard scene order and audio requirements", () => {
  it("derives exact scene order including non-narrated visual scenes and human Quran recitation", async () => {
    const x = await make();
    const result = await x.load();
    expect(result.sceneOrder).toEqual(["c1-s0", "c1-s1", "c2-v1", "c2-s2"]);
    expect(result.scenes).toEqual([
      { id: "c1-s0", chapter: 1, narratorRequired: false, recitationRequired: false },
      { id: "c1-s1", chapter: 1, narratorRequired: true, recitationRequired: false },
      { id: "c2-v1", chapter: 2, narratorRequired: false, recitationRequired: true },
      { id: "c2-s2", chapter: 2, narratorRequired: true, recitationRequired: false },
    ]);
    expect(x.locks()).toBe(1);
  });

  it("fails closed on no shared artifact writer lock", async () => {
    const x = await make();
    await expect(readPlannedSceneOrderV2(x.scope, undefined as never))
      .rejects.toThrow(/writer lock/);
  });

  it("rejects foreign episode and mismatched channel plan", async () => {
    const x = await make();
    await x.put({ ...samplePlan(), episode: "002" });
    await expect(x.load()).rejects.toThrow(/locked channel\/episode/);
    await x.put({ ...samplePlan(), channel: "balislam" });
    await expect(x.load()).rejects.toThrow(/locked channel\/episode/);
  });

  it("rejects duplicate scenes even across chapters and reordered chapter IDs", async () => {
    const x = await make();
    const duplicate = samplePlan();
    duplicate.chapters[1]!.scenes[0]!.id = "c1-s1";
    await x.put(duplicate);
    await expect(x.load()).rejects.toThrow(/duplicate|chapter-mismatched/);
    const wrong = samplePlan();
    wrong.chapters[0]!.scenes[1]!.id = "c2-s5";
    await x.put(wrong);
    await expect(x.load()).rejects.toThrow(/chapter-mismatched/);
  });

  it("rejects duplicate chapter and invalid scene identity", async () => {
    const x = await make();
    const duplicated = samplePlan();
    duplicated.chapters[1]!.number = 1;
    await x.put(duplicated);
    await expect(x.load()).rejects.toThrow(/duplicate chapter|Invalid or duplicate chapter/);
    const malformed = samplePlan();
    malformed.chapters[0]!.scenes[0]!.id = "../c1-s0";
    await x.put(malformed);
    await expect(x.load()).rejects.toThrow(/Malformed/);
  });

  it("rejects invalid Quran verse identity rather than inferring recitation", async () => {
    const x = await make();
    const plan = samplePlan();
    plan.chapters[1]!.scenes[0]!.ayahKey = "../etc";
    await x.put(plan);
    await expect(x.load()).rejects.toThrow(/Malformed/);
  });

  it("rejects tampered plan JSON and absent plan", async () => {
    const x = await make();
    await writeFile(path.join(x.dir, "plan.json"), "{not-json", "utf8");
    await expect(x.load()).rejects.toThrow(/Malformed.*JSON/);
    await rm(path.join(x.dir, "plan.json"));
    await expect(x.load()).rejects.toThrow();
  });

  it("rejects a symbolic link to another episode plan", async () => {
    const x = await make();
    const first = path.join(x.dir, "plan.json");
    const target = path.join(x.dir, "plan-backup.json");
    await writeFile(target, JSON.stringify(samplePlan()));
    await rm(first);
    await symlink(target, first);
    await expect(x.load()).rejects.toThrow(/Symlink/);
  });

  it("keeps narration types separate without granting any approval", async () => {
    const x = await make();
    const got = await x.load();
    expect(got.scenes.filter((s) => s.narratorRequired)).toHaveLength(2);
    expect(got.scenes.filter((s) => s.recitationRequired)).toHaveLength(1);
    expect(Object.keys(got)).toEqual(["sceneOrder", "scenes"]);
    expect(JSON.stringify(got)).not.toMatch(/approved|ownerId|sha256|mac/);
  });
});
