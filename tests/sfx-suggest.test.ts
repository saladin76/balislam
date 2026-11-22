import { describe, expect, it } from "vitest";
import { SUGGEST, missingSfx, suggestSfx } from "../src/plan/sfxSuggest";
import type { Plan, PlanScene } from "../src/plan/types";

// D158 step 3 (owner, 20 Nov): the studio proposes effects by the six rules; the owner listens and approves.
const sc = (id: string, narration: string, over: Partial<PlanScene> = {}): PlanScene =>
  ({ id, template: "alley-tale", narration, props: {}, sfx: [], ...over } as PlanScene);
const plan = (scenes: PlanScene[], channel = "balislam"): Plan => ({ version: 1, channel, title: "ت", chapters: [{ number: 1, title: "", scenes }] } as never);
const media = { voice: {}, recitations: {} } as never;
const lib = new Set(["whoosh-soft", "page-turn", "market-crowd", "crowd-murmur", "scale-balance", "door-open", "clock-tick"]);

describe("D158 step 3: effect suggestions", () => {
  it("a word in a sentence naming God gets no effect; the same word elsewhere does", () => {
    const s = suggestSfx(plan([sc("c1-s1", "دخل الرجل السوق ونظر حوله."), sc("c1-s2", "والله يعلم ما في الميزان. ثم وقف عند الميزان.")]), media, lib);
    expect(s.some((x) => x.scene === "c1-s1" && x.sfx.id === "market-crowd")).toBe(true);
    const scale = s.filter((x) => x.scene === "c1-s2" && x.sfx.id === "scale-balance");
    expect(scale).toHaveLength(1); // only the second sentence's «الميزان»
  });
  it("a verse card or a dua board gets nothing, and an effect the owner placed is never touched", () => {
    const s = suggestSfx(plan([sc("c1-s1", "في السوق", { sfx: [{ id: "door-open", at: 1 }] }), sc("c1-s2", "باب", { template: "verse-card" }), sc("c1-s3", "السوق", { template: "dua-board" })]), media, lib);
    expect(s.filter((x) => ["c1-s1", "c1-s2", "c1-s3"].includes(x.scene))).toEqual([]);
  });
  it("transitions open the chapter and then come at most every few seconds, never on every cut", () => {
    const scenes = Array.from({ length: 12 }, (_, i) => sc(`c1-s${i + 1}`, "مشى الرجل في الطريق الطويل وهو يفكر في أمره كله", { props: { place: i % 2 ? "market" : "alley" } }));
    const s = suggestSfx(plan(scenes), media, lib).filter((x) => x.sfx.id === "whoosh-soft");
    expect(s[0]!.scene).toBe("c1-s1");
    expect(s.length).toBeLessThan(scenes.length / 2);
  });
  it("the same word effect is not repeated beyond the episode cap", () => {
    const scenes = Array.from({ length: 8 }, (_, i) => sc(`c1-s${i + 1}`, "نظر إلى الميزان"));
    const s = suggestSfx(plan(scenes), media, lib).filter((x) => x.sfx.id === "scale-balance");
    expect(s.length).toBe(SUGGEST.perEpisode);
  });
  it("an effect in the plan with no file in the library is reported", () => {
    expect(missingSfx(plan([sc("c1-s1", "x", { sfx: [{ id: "aah-outro", at: 1 }] })]), lib)).toEqual([{ scene: "c1-s1", id: "aah-outro" }]);
  });
});
