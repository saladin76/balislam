/**
 * D158 الخطوة ٤: نسخ بديلة للمؤثرات المتكررة بالكود (مجانًا). كل مؤثر غير الجو له نسختان بعلو دوره نفسه وتحت سقف
 * ذروته، تختلفان عن الأصل؛ والرندر يدور عليها بترتيب الظهور في الحلقة، حتميًا.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sfxLibrary } from "../brand/sfx";
import { MASTER, roleOf } from "../brand/sfxMastering";
import { sfxFileNames, VARIANT_RECIPES, variantFile } from "../src/plan/sfxVariants";
import type { Plan, PlanScene } from "../src/plan/types";

const dir = path.join(import.meta.dirname, "..", "assets", "sfx");
const live = sfxLibrary.filter((d) => existsSync(path.join(dir, `${d.id}.mp3`)));
const scene = (id: string, sfx: { id: string; at: number }[]): PlanScene => ({ id, template: "kinetic-text", narration: "x", line: 0, props: {}, sfx, durationSec: 5 });
const plan = (...scenes: PlanScene[]): Plan => ({ version: 1, episode: "001", title: "t", domain: "faith" as Plan["domain"], themeId: "x" as Plan["themeId"], updatedAt: "", chapters: [{ number: 1, title: "", scenes }] });

describe("النسخ البديلة: التدوير", () => {
  it("الظهور الأول الأصل ثم v2 ثم v3 ثم الأصل، لكل مؤثر وحده، بترتيب الحلقة", () => {
    const p = plan(scene("a", [{ id: "page-turn", at: 0 }, { id: "stamp", at: 1 }]), scene("b", [{ id: "page-turn", at: 0 }]),
      scene("c", [{ id: "page-turn", at: 0 }, { id: "page-turn", at: 2 }]));
    const n = sfxFileNames(p, { "page-turn": ["v2", "v3"], stamp: ["v2", "v3"] });
    expect([...n.entries()]).toEqual([["a#0", "page-turn.mp3"], ["a#1", "stamp.mp3"], ["b#0", "page-turn--v2.mp3"], ["c#0", "page-turn--v3.mp3"], ["c#1", "page-turn.mp3"]]);
    expect(sfxFileNames(p, {}).get("b#0")).toBe("page-turn.mp3");
    expect(sfxFileNames(p, { "page-turn": ["v3"] }).get("b#0")).toBe("page-turn--v3.mp3");
  });
});

describe("النسخ البديلة: الملفات", () => {
  const withVariants = live.filter((d) => roleOf(d.id, d.category) !== "ambience");
  it("كل مؤثر غير الجو له نسخه، وأصوات الجو بلا نسخ", () => {
    expect(withVariants.length).toBeGreaterThan(30);
    for (const d of live) for (const r of VARIANT_RECIPES)
      expect(existsSync(path.join(dir, variantFile(d.id, r.suffix))), `${d.id} ${r.suffix}`).toBe(roleOf(d.id, d.category) !== "ambience");
  });
  it.each(withVariants.map((d) => [d.id, d] as const))("%s: النسخ ٤٨ كيلوهرتز، تحت السقف، بعلو دورها، وتختلف عن الأصل", (_id, d) => {
    const role = roleOf(d.id, d.category);
    const orig = readFileSync(path.join(dir, `${d.id}.mp3`));
    for (const r of VARIANT_RECIPES) {
      const f = path.join(dir, variantFile(d.id, r.suffix));
      expect(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=sample_rate", "-of", "csv=p=0", f], { encoding: "utf8" }).trim()).toBe(String(MASTER.sampleRate));
      const e = String(spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", f, "-af", "ebur128=peak=true,astats=metadata=0", "-f", "null", "-"], { encoding: "utf8" }).stderr);
      const s = e.slice(e.lastIndexOf("Summary"));
      expect(Number(/Peak:\s+(-?[\d.]+) dBFS/.exec(s)?.[1]), `${d.id} ${r.suffix} peak`).toBeLessThanOrEqual(MASTER.truePeak + 0.5);
      const lufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(s)?.[1]);
      const level = lufs > -70 ? lufs : Number(/Overall[\s\S]*?RMS level dB: (-?[\d.]+)/.exec(e)?.[1]);
      expect(Math.abs(level - MASTER.lufs[role]), `${d.id} ${r.suffix} ${level}`).toBeLessThanOrEqual(role === "impact" || lufs <= -70 ? 3 : 2);
      expect(readFileSync(f).equals(orig)).toBe(false);
    }
  }, 30_000);
});
