import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { studioMediaNamespace, voiceForPlan } from "../src/plan/collect";
import { dedupeStageFiles, stageRenderFiles, type RenderStageFile } from "../src/plan/renderStage";
import type { Plan } from "../src/plan/types";

// Funnel QA B1: one repeated line («يقول الله تعالى:», a repeated dua) gives two scenes the SAME
// voice clip file; every render then failed «وسيط مكرر في لقطة الرندر».
const owned: string[] = [];
afterEach(async () => { for (const r of owned.splice(0)) await rm(r, { recursive: true, force: true }); });

describe("shared voice clip across scenes (B1)", () => {
  it("stages one file when several scenes reference the same clip", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "shared-clip-"));
    owned.push(root);
    const clip = path.join(root, "voice", "abc.mp3");
    await import("node:fs/promises").then((fs) => fs.mkdir(path.dirname(clip), { recursive: true }));
    await writeFile(clip, "AUDIO");
    const ns = studioMediaNamespace(path.join(root, "channels", "balislam", "episodes", "001-demo", "script.md")).render;
    const files: RenderStageFile[] = [
      { kind: "voice", name: "abc.mp3", source: clip },
      { kind: "voice", name: "abc.mp3", source: path.join(root, "voice", ".", "abc.mp3") },
    ];
    const publicRoot = path.join(root, "public");
    const base = await stageRenderFiles(ns, files, { publicRoot });
    expect(await readdir(path.join(publicRoot, base, "voice"))).toEqual(["abc.mp3"]);
  });

  it("still refuses two different sources under one staged name", () => {
    expect(() => dedupeStageFiles([
      { kind: "voice", name: "a.mp3", source: "/x/a.mp3" },
      { kind: "voice", name: "a.mp3", source: "/y/a.mp3" },
    ])).toThrow(/وسيط مكرر/);
  });

  it("a single-scene preview carries only that scene's voice", () => {
    const plan = { chapters: [{ scenes: [{ id: "c1-s2" }] }] } as unknown as Plan;
    const voice = { "c1-s1": { file: "a.mp3" }, "c1-s2": { file: "b.mp3" }, "c1-s3": { file: "a.mp3" } };
    expect(voiceForPlan(voice, plan)).toEqual({ "c1-s2": { file: "b.mp3" } });
  });
});
