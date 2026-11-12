/**
 * KI-051 (found by the full-journey test, work ٤): editing ONE scene's text in the script re-opened ANOTHER approved
 * scene whose tone the owner had set with «النبرة غير مناسبة».
 *
 * Cause: the scene's input fingerprint in the signed ledger (sceneService sourceNow) hashes the plan scene as JSON,
 * so it follows the order of its keys. The page saves the owner's tone as `{ ...scene, tone, edited: true }`; saving
 * the script regenerates the plan (generatePlan) and rebuilt that scene with `edited` before `tone`: the same scene,
 * other bytes, a new fingerprint, and the approved scene re-opened. D76: only the scenes whose inputs changed re-open.
 *
 * Fix: a regenerated scene keeps the key order of the scene it continues (and of its props), so an unchanged scene is
 * byte-for-byte the scene already approved. Fingerprints themselves are untouched (no approved scene re-opens).
 */
import { describe, expect, it } from "vitest";
import { generatePlan } from "../src/plan/generate";
import { parseScript } from "../src/script/parse";
import { loadChannel } from "../src/channel";

const script = (third: string) => `---
title: "ترتيب المفاتيح"
domain: psychology
episode: "001"
---

يَبْدَأُ كُلُّ يَوْمٍ بِخُطْوَةٍ صَغِيرَةٍ نَحْوَ مَا نُرِيدُ.

وَالصَّبْرُ يُعَلِّمُنَا الهُدُوءَ.

${third}

## الخطوة العملية

اخْتَرْ خُطْوَةً وَاحِدَةً صَغِيرَةً اليَوْمَ.
`;

describe("KI-051: regenerating the plan keeps an unchanged scene byte for byte", () => {
  it("a tone set from the page survives a script edit elsewhere without changing the scene's JSON", () => {
    const channel = loadChannel("balislam");
    const first = generatePlan(parseScript(script("فَالسَّعْيُ يَصْنَعُ الفَرْقَ.")), null, {}, channel);
    // «النبرة غير مناسبة» on scene 1, exactly as the page saves it (SceneProductionPanel submitTone).
    const s1 = first.chapters[0]!.scenes[0]!;
    const owner = { ...first, chapters: first.chapters.map((c) => ({ ...c, scenes: c.scenes.map((s) => s.id === s1.id ? { ...s, tone: "intimate", edited: true } : s) })) } as typeof first;
    // A tone on scene 2 too, then a props edit in another order (the scene editor), to cover props as well.
    const s2 = owner.chapters[0]!.scenes[1]!;
    owner.chapters[0]!.scenes[1] = { ...s2, edited: true, props: Object.fromEntries(Object.entries(s2.props).reverse()), tone: "warm" };
    const before = owner.chapters[0]!.scenes.map((s) => JSON.stringify(s));

    // The owner edits scene 3's text in the script; the plan is regenerated from it.
    const next = generatePlan(parseScript(script("فَالسَّعْيُ الصَّادِقُ يَصْنَعُ الفَرْقَ.")), owner, {}, channel);
    const after = next.chapters[0]!.scenes.map((s) => JSON.stringify(s));
    expect(after[0], "scene 1 (tone from the page) is byte for byte the approved scene").toBe(before[0]);
    expect(after[1], "scene 2 (props reordered by the editor) is byte for byte the approved scene").toBe(before[1]);
    expect(after[2], "scene 3 changed").not.toBe(before[2]);
    expect(next.chapters[0]!.scenes[0]).toMatchObject({ tone: "intimate", edited: true });
  });
});
