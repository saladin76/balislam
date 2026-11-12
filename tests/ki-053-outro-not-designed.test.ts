/**
 * KI-053 (found by the full-journey test, work ٤): in «زبدة الكتب» every new episode's plan counted as «designed»
 * (D46) from its first save, because the closing card the generator builds from the channel's outro is an
 * `ink-shot` (`shot: "outro"`). So saving the script after «اعتمد التجهيز» never reached the plan: the owner's
 * text edit stayed out of the scene and out of the video, with nothing re-opened (D76 says the edited scene re-opens).
 *
 * The closing card is the generator's own (it is rebuilt from channel.outro on every regeneration, its edits kept):
 * it does not make a plan «designed». A scene named as a designed shot in the script still does.
 */
import { describe, expect, it } from "vitest";
import { generatePlan } from "../src/plan/generate";
import { parseScript } from "../src/script/parse";
import { loadChannel } from "../src/channel";
import { isDesignedPlan } from "../src/plan/designed";

const script = (shot = "") => `---
title: "خلاصة كتاب"
domain: self
episode: "001"
---

${shot}يَقُولُ الكِتَابُ إِنَّ العَادَةَ تَبْدَأُ صَغِيرَةً.

فَابْدَأْ بِعَادَةٍ وَاحِدَةٍ صَغِيرَةٍ هَذَا الأُسْبُوعَ.

## الخطوة العملية

اخْتَرْ عَادَةً وَاحِدَةً صَغِيرَةً.
`;

describe("KI-053: the channel's closing card does not make a plan «designed»", () => {
  it("a new زبدة الكتب episode follows its script; a scene named as a shot still protects the plan", () => {
    const channel = loadChannel("zubdat-alkutub");
    const plain = generatePlan(parseScript(script()), null, {}, channel);
    const end = plain.chapters.at(-1)!.scenes.at(-1)!;
    expect(end).toMatchObject({ id: "c1-end", template: "ink-shot" }); // the channel outro
    expect(isDesignedPlan(plain), "a plan whose only shot is the outro is not designed").toBe(false);
    const named = generatePlan(parseScript(script("[مشهد: ink-shot | shot=habit-heart]\n\n")), null, {}, channel);
    expect(isDesignedPlan(named), "a shot named in the script is designed").toBe(true);
  });
});
