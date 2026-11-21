import { describe, expect, it } from "vitest";
import { SFX_MIX, isAmbience, sceneSacredSpans, sfxGainAt, speechSpans } from "../src/plan/sfxMix";
import type { PlanScene } from "../src/plan/types";

// D158, step 2 (owner, 20 Nov): no effect in a sentence with God's name, a verse or a dua; ambience ducks under the narrator.
const scene = (over: Partial<PlanScene>): PlanScene => ({ id: "c1-s5", template: "alley-tale", narration: "", props: {}, sfx: [], ...over } as PlanScene);
const words = (ws: [string, number, number][]) => ws.map(([word, start, end]) => ({ word, start, end }));

describe("D158: effects are silent where the picture is still, and ambience ducks under the voice", () => {
  it("a sentence naming God silences every effect ±0.25 s around the word, ramping back in", () => {
    const s = scene({ narration: "وقد قال الله تعالى في كتابه" });
    const media = { voice: { [s.id]: { text: s.narration, file: "x.mp3", duration: 3, hash: "h", words: words([["وقد", 0.1, 0.3], ["قال", 0.35, 0.6], ["الله", 0.65, 1.0], ["تعالى", 1.05, 1.5], ["في", 1.55, 1.7], ["كتابه", 1.75, 2.2]]) } }, recitations: {} } as never;
    const sacred = sceneSacredSpans(s, undefined, media);
    expect(sacred.length).toBeGreaterThan(0);
    expect(sfxGainAt(0.8, sacred, [], false)).toBe(0);
    const out = Math.max(...sacred.map((w) => w.to));
    expect(sfxGainAt(out + SFX_MIX.ramp + 0.01, sacred, [], false)).toBe(1);
    expect(sfxGainAt(out + SFX_MIX.ramp / 2, sacred, [], false)).toBeGreaterThan(0);
    expect(sfxGainAt(out + SFX_MIX.ramp / 2, sacred, [], false)).toBeLessThan(1);
  });
  it("a verse card or a dua board has no effect at all", () => {
    for (const template of ["verse-card", "dua-board"]) {
      const sacred = sceneSacredSpans(scene({ template, narration: "نص" }), undefined, { voice: {}, recitations: {} } as never);
      for (const t of [0, 1, 2]) expect(sfxGainAt(t, sacred, [], false), template).toBe(0);
    }
  });
  it("ambience ducks while the narrator speaks; a page turn or a knock keeps its level", () => {
    const s = scene({ narration: "في سوق صغير وقف شخصان" });
    const media = { voice: { [s.id]: { text: s.narration, file: "x.mp3", duration: 3, hash: "h", words: words([["في", 0.5, 0.7], ["سوق", 0.75, 1.0], ["صغير", 1.05, 1.4], ["وقف", 2.0, 2.3], ["شخصان", 2.35, 2.8]]) } } } as never;
    const speech = speechSpans(s, media);
    expect(speech.length).toBe(2); // the 0.6 s pause after «صغير» opens the ambience again
    expect(isAmbience("market-crowd")).toBe(true);
    expect(isAmbience("page-turn")).toBe(false);
    expect(sfxGainAt(0.9, [], speech, true)).toBeCloseTo(SFX_MIX.duck, 5);
    expect(sfxGainAt(0.9, [], speech, false)).toBe(1);
    expect(sfxGainAt(1.7, [], speech, true)).toBe(1);
    expect(sfxGainAt(0.0, [], speech, true)).toBe(1);
  });
});
