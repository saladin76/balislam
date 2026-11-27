import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { assertOneMachine, episodeSceneMachines, machineOfResult, MAC_MACHINE, previewMachines, provenanceFile } from "../src/render/worker/provenance";
import { assertCutsOneMachine } from "../src/render/worker/macJobs";
import { queuePaths } from "../src/render/worker/protocol";

// D233 (owner): every episode is rendered whole on one machine; no scenes from both machines in one episode
// (Chrome on Windows draws Arabic text a few pixels lower than on the Mac).
const owned: string[] = [];
afterEach(async () => { for (const d of owned.splice(0)) await rm(d, { recursive: true, force: true }); });
const tmp = async () => { const d = await mkdtemp(path.join(tmpdir(), "bal-one-machine-")); owned.push(d); return d; };
const root = path.join(__dirname, "..");
const src = (f: string) => readFileSync(path.join(root, f), "utf8");

describe("D233: one machine per episode", () => {
  it("a scene without provenance is the Mac's; a worker result names its host", () => {
    expect(machineOfResult(undefined)).toBe(MAC_MACHINE);
    expect(machineOfResult({})).toBe(MAC_MACHINE);
    expect(machineOfResult({ worker: "Salah" })).toBe("Salah");
  });
  it("one machine passes; mixed machines are refused naming the scenes, their machines and what to re-render", () => {
    expect(assertOneMachine([{ sceneId: "c1-s2", machine: "mac" }, { sceneId: "c1-s3", machine: "mac" }], "تجميع")).toBe("mac");
    expect(assertOneMachine([], "تجميع")).toBeNull();
    let msg = "";
    try {
      assertOneMachine([{ sceneId: "c1-s2", machine: "mac" }, { sceneId: "c1-s3", machine: "Salah" }, { sceneId: "c1-s4", machine: "mac" }], "تجميع");
    } catch (e) { msg = (e as Error).message; }
    expect(msg).toMatch(/لا تجميع/);
    expect(msg).toMatch(/D233/);
    expect(msg).toContain("الماك (2): c1-s2، c1-s4");
    expect(msg).toContain("جهاز الرندر «Salah» (1): c1-s3");
    expect(msg).toMatch(/أعد رندر c1-s3 \(رُندرت على جهاز الرندر «Salah»\) على الماك/);
  });
  it("the Mac's previews: provenance only while the recorded file is still the current one", async () => {
    const dir = await tmp();
    expect((await previewMachines(dir, [{ sceneId: "c1-s2" }])).map((x) => x.machine)).toEqual(["mac"]);
    const bytes = "cut-from-windows";
    await writeFile(path.join(dir, "scene-c1-s3-av.mp4"), bytes);
    await writeFile(path.join(dir, "scene-c1-s2-av.mp4"), "mac-cut");
    const sha = createHash("sha256").update(bytes).digest("hex");
    await writeFile(provenanceFile(dir), JSON.stringify({ version: 1, scenes: { "c1-s3": { machine: "Salah", sha256: sha } } }));
    const rows = await episodeSceneMachines(dir, ["c1-s2", "c1-s3"]);
    expect(rows.map((x) => x.machine)).toEqual(["mac", "Salah"]);
    expect(() => assertOneMachine(rows, "Master")).toThrow(/c1-s3/);
    // re-rendered on the Mac afterwards: the record no longer matches the file, so it is the Mac's again
    await writeFile(path.join(dir, "scene-c1-s3-av.mp4"), "re-rendered-on-mac");
    expect((await episodeSceneMachines(dir, ["c1-s2", "c1-s3"])).map((x) => x.machine)).toEqual(["mac", "mac"]);
  });
  it("a join job's finished cuts in done/ are checked from their result.json (no worker name = Mac)", async () => {
    const share = await tmp();
    const done = queuePaths(share).done;
    for (const [job, worker] of [["a", "Salah"], ["b", "Salah"], ["c", undefined]] as const) {
      await mkdir(path.join(done, job), { recursive: true });
      await writeFile(path.join(done, job, "result.json"), JSON.stringify(worker ? { worker } : {}));
    }
    await expect(assertCutsOneMachine(share, [{ sceneId: "s1", job: "a" }, { sceneId: "s2", job: "b" }, { sceneId: "s9", job: "not-yet" }], "تجميع")).resolves.toBe("Salah");
    await expect(assertCutsOneMachine(share, [{ sceneId: "s1", job: "a" }, { sceneId: "s3", job: "c" }], "تجميع")).rejects.toThrow(/s3/);
  });
  it("every assembly, pre-final and Master path checks before it joins or renders", () => {
    const asm = src("src/studio/assembleScenes.ts");
    for (const fn of ["export const assemblePreFinalPreview", "export const assembleApprovedSceneAv"]) {
      const body = asm.slice(asm.indexOf(fn));
      expect(body.indexOf("assertOneMachine(")).toBeGreaterThan(0);
      expect(body.indexOf("assertOneMachine(")).toBeLessThan(body.indexOf("joinSceneCuts("));
    }
    const ep = src("src/render/episode.ts");
    const re = ep.slice(ep.indexOf("export const renderEpisode"), ep.indexOf("export type RenderCompositionOptions"));
    expect(re.indexOf("episodeSceneMachines(")).toBeGreaterThan(0);
    expect(re.indexOf("episodeSceneMachines(")).toBeLessThan(re.indexOf("renderComposition("));
    const w = src("src/render/worker/untrustedRender.ts");
    const v2 = w.slice(w.indexOf("export const renderWorkerJobV2"));
    expect(v2.indexOf("assertOneMachine(")).toBeGreaterThan(0);
    expect(v2.indexOf("assertOneMachine(")).toBeLessThan(v2.indexOf("joinSceneCuts("));
    const mj = src("src/render/worker/macJobs.ts");
    expect(mj.slice(mj.indexOf("export const buildJoinJob"), mj.indexOf("export const buildMasterJob"))).toContain("assertCutsOneMachine(");
    expect(mj.slice(mj.indexOf("export const buildMasterJob"), mj.indexOf("export const enqueue"))).toContain("episodeSceneMachines(");
  });
});
