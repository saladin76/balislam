import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validatePartsContext } from "../src/voice/dafatirParts";
import { analyzeToneMapSync, orthoForm, syncToneMap } from "../src/voice/toneMapSync";
import type { Plan } from "../src/plan/types";

// KI-088 (18 Nov): the master gate refused «دفاتر الزمن 001» — tone-map v1.67 carried the tashkeel fingerprint of
// 11 Nov while tashkeel.md had changed. The map is synced by TEXT, never rebuilt; tones and pauses stay; the gate stays.
const E = path.join(import.meta.dirname, "..", "channels/dafatir-alzaman/episodes/001-adam-beginning");
const read = (f: string) => readFileSync(path.join(E, f), "utf8");
const v167 = read("tone-map.v1.67.json"); // the map as the master gate refused it (18 Nov)
const current = JSON.parse(read("tone-map.json"));
const tashkeel = read("tashkeel.md");
const plan = JSON.parse(read("plan.json")) as Plan;
const map = JSON.parse(v167);
const inPlan = new Set(plan.chapters.flatMap((c) => c.scenes.map((x) => x.id)));
const dropScenes = [...new Set(map.segments.map((x: { scene: string }) => x.scene).filter((x: string) => !inPlan.has(x)))] as string[];

describe("KI-088: the tone map follows the current tashkeel, by text", () => {
  it("reproduces the refusal on a map whose fingerprint is an old tashkeel (the gate is kept)", () => {
    const stale = { ...map, source: { ...map.source, tashkeel: { path: "tashkeel.md", sha256: "75486554f57bc334e50ba934f57f5c20430b39a405d40f147641ea2dcf0eaa2d" } } };
    expect(() => validatePartsContext(stale, plan, tashkeel)).toThrow(/تشكيل قديم/);
  });

  it("matches all 84 segments to their lines by text, in order; nothing unmatched", () => {
    const r = analyzeToneMapSync(map.segments, tashkeel);
    expect(r.unmatched).toEqual([]);
    expect(r.rows).toHaveLength(map.segments.length);
    expect(map.segments.length).toBe(84);
  });

  it("writing alone is not pronunciation: mark order, the article's sukun, «ءا» = «آ»", () => {
    expect(orthoForm("اللَّهُ")).toBe(orthoForm("اللَّهُ".normalize("NFD")));
    expect(orthoForm("الْأَرْضُ")).toBe(orthoForm("الأَرْضُ"));
    expect(orthoForm("لِلْإِنْسَانِ")).toBe(orthoForm("لِلإِنْسَانِ"));
    expect(orthoForm("سَوْءَاتِهِمَا")).toBe(orthoForm("سَوْآتِهِمَا"));
    expect(orthoForm("نَنْسُبُ")).not.toBe(orthoForm("نَنْسِبُ"));
  });

  it("owner decision «لا تغيّر شيئًا في النطق الحالي»: every text stays as recorded; the differing words become written exceptions", () => {
    const r = syncToneMap(v167, tashkeel, { at: "2026-11-18T23:00:00.000Z", plan: read("plan.json"), script: read("script.md"), keepRecorded: true, dropScenes });
    const next = JSON.parse(r.raw);
    expect(() => validatePartsContext(next, plan, tashkeel)).not.toThrow();
    expect(dropScenes).toEqual(["c1-s1"]); // the basmala scene left the plan on 16 Nov; its part cannot be voiced anyway
    expect(next.previous.at(-1)).toEqual({ version: map.version, path: `tone-map.${map.version}.json` });
    for (const k of ["decisions", "sceneTones", "recitations", "direction", "legend", "order"]) expect(next[k], k).toEqual(map[k]);
    const old = new Map(map.segments.map((x: { id: string }) => [x.id, x]));
    for (const x of next.segments) for (const k of ["text", "marked", "emphasis", "tone", "pauses", "speed", "wpm", "feel", "transition", "audioPart"]) expect(x[k], `${x.id}.${k}`).toEqual((old.get(x.id) as Record<string, unknown>)[k]);
    expect(r.changedScenes).toEqual([]);
    expect(next.tashkeelSyncs.at(-1).keptRecorded.segments.map((x: { id: string }) => x.id)).toEqual(["s099", "s102", "s125", "s147", "s162"]);
  });

  it("the map on main (v1.68) passes the gate as is", () => {
    expect(() => validatePartsContext(current, plan, tashkeel)).not.toThrow();
  });

  it("the gate still refuses a pronunciation drift that no owner decision lists", () => {
    const drifted = structuredClone(current);
    const seg = drifted.segments.find((x: { id: string }) => x.id === "s146");
    seg.text = seg.text.replace("نَصًّا", "نُصًّا");
    expect(() => validatePartsContext(drifted, plan, tashkeel)).toThrow(/يخالف التشكيل الحالي/);
  });
});
