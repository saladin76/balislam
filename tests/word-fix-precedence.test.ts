/**
 * D66 — pronunciation precedence (owner report 10 Nov, زبدة الكتب 001 c1-s3: the owner wrote «أَوَّلَ», the lexicon
 * mapped «أَوَّلُ» → «أَوَّلَ», yet «أَوَّلُ» was sent: the episode's voweled copy (tashkeel.md) replaced the written
 * word by bare letters, and the lexicon then matched the written form exactly and found nothing).
 */
import { describe, expect, it } from "vitest";
import { buildTashkeelIndex, vowelize } from "../src/voice/tashkeel";
import { applyDictionary } from "../src/voice/words";
import { applyLexicon, checkSay } from "../src/voice/lexicon";
import {
  dropsShadda, fillFromVoweled, isNoopSay, lexiconEffects, lexiconSay, marksCompatible, phoneticVariants,
} from "../src/voice/pronunciationRules";
import { reopenTarget, sendPreview } from "../app/src/workspace/SentencesPanel";
import type { SentencesRead } from "../src/voice/sentenceVoice";

const TK = buildTashkeelIndex("فِي كِتَابِ «أَوَّلُ مَرَّةٍ أُصَلِّي، وَكَانَ لِلصَّلَاةِ طَعْمٌ آخَرُ»، يَصْحَبُنَا الدُّكْتُورُ");
const send = (text: string, entries: { word: string; say: string; at: string; match?: "exact" | "letters" }[], corrections?: { index: number; word: string; say: string }[]) => {
  const ws = text.split(" ");
  const d = applyDictionary(text, {}, vowelize(ws, TK));
  return applyLexicon(d.original, d.spoken.split(" "), d.owner, entries, { corrections }).spoken.join(" ");
};

describe("what is sent for a written word", () => {
  const text = "فِي كِتَابِ «أَوَّلَ مَرَّةٍ أُصَلِّي، وَكَانَ";
  it("the owner's written fatha is sent even when tashkeel.md has the damma, and a damma→fatha lexicon entry changes nothing else", () => {
    expect(send(text, [])).toContain("«أَوَّلَ ");
    expect(send(text, [{ word: "أَوَّلُ", say: "أَوَّلَ", at: "" }])).toContain("«أَوَّلَ ");
    // The real channel lexicon of the report: «مَرَّةٍ» → «مرةٍ» still applies (exact form), flagged below as dropping the shadda.
    expect(send(text, [{ word: "مَرَّةٍ", say: "مرةٍ", at: "" }, { word: "أَوَّلُ", say: "أَوَّلَ", at: "" }])).toBe("فِي كِتَابِ «أَوَّلَ مرةٍ أُصَلِّي، وَكَانَ");
  });
  it("a bare written word still takes its tashkeel from tashkeel.md; a written word whose marks agree takes the fuller form", () => {
    expect(send("في كتاب «اول مرة", [])).toBe("فِي كِتَابِ «أَوَّلُ مَرَّةٍ");
    expect(fillFromVoweled("كِتاب", "كِتَابِ")).toBe("كِتَابِ");
    expect(marksCompatible("أَوَّلَ", "أَوَّلُ")).toBe(false);
    expect(marksCompatible("أوَّل", "أَوَّلُ")).toBe(true);
  });
  it("a per-sentence correction typed in the popover wins over the lexicon and the written form", () => {
    const lex = [{ word: "أَوَّلَ", say: "أَوَّلَا", at: "" }];
    expect(send(text, lex)).toContain("«أَوَّلَا ");
    expect(send(text, lex, [{ index: 2, word: "«أَوَّلَ", say: "أَوْوَلَ" }])).toContain("«أَوْوَلَ ");
  });
  it("lexicon: exact tashkeel form first; a bare-letter match only for an entry saved «letters», never over the owner's contradicting marks", () => {
    const exact = [{ word: "أَوَّلُ", say: "أَوَّلَ" }];
    expect(lexiconSay("أَوَّلُ", exact)?.say).toBe("أَوَّلَ");
    expect(lexiconSay("أَوَّلَ", exact)).toBeUndefined();
    expect(lexiconSay("أول", exact)).toBeUndefined();
    const loose = [{ word: "اول", say: "أَوَّلَ", match: "letters" as const }];
    expect(lexiconSay("أول", loose)?.say).toBe("أَوَّلَ");
    expect(lexiconSay("أوَّل", loose)?.say).toBe("أَوَّلَ");
    expect(lexiconSay("أَوَّلُ", loose)).toBeUndefined(); // the owner wrote a damma: not replaced by another tashkeel
    // An exact entry beats a letters entry for the same word.
    expect(lexiconSay("أَوَّلُ", [...loose, { word: "أَوَّلُ", say: "أَوَّلِ" }])?.say).toBe("أَوَّلِ");
  });
  it("no-op and shadda-dropping pronunciations are recognised; the effects list explains an entry that no longer matches", () => {
    expect(isNoopSay("«أَوَّلَ", "أَوَّلَ")).toBe(true);
    expect(isNoopSay("أَوَّلَ", "أَوَّلُ")).toBe(false);
    expect(dropsShadda("مَرَّةٍ", "مرةٍ")).toBe(true);
    expect(dropsShadda("مَرَّةٍ", "مَرَّةً")).toBe(false);
    const fx = lexiconEffects([{ word: "مَرَّةٍ", say: "مرةٍ" }, { word: "أَوَّلُ", say: "أَوَّلَ" }, { word: "كِتَابِ", say: "كِتَابِ" }],
      text.split(" "));
    expect(fx[0]).toMatchObject({ applies: ["مَرَّةٍ"] });
    expect(fx[0]!.warnings.join(" ")).toContain("الشدّة");
    expect(fx[1]).toMatchObject({ applies: [], skipped: ["أَوَّلَ"] });
    expect(fx[1]!.warnings.join(" ")).toContain("لا يطابق");
    expect(fx[2]!.warnings.join(" ")).toContain("لا يغيّر شيئًا");
  });
});

describe("the word popover", () => {
  it("«جرّب صيغة أخرى»: three phonetic variants, each fully voweled enough to be sent", () => {
    const v = phoneticVariants("أَوَّلَ");
    expect(v).toEqual(["أَوَّلَا", "أَوْوَلَ", "أوَّلَ"]);
    for (const x of v) expect(checkSay(x)).toBeNull();
    expect(phoneticVariants("«أَوَّلَ»،")).toEqual(v);
    expect(phoneticVariants("اول")).toEqual([]);
  });
  it("«سيُرسل»: exactly the field with the written word's punctuation", () => {
    expect(sendPreview("«أَوَّلَ", " أَوَّلَا ")).toBe("«أَوَّلَا");
    expect(sendPreview("أُصَلِّي،", "أُصَلِّي")).toBe("أُصَلِّي،");
  });
  it("re-opening after a server round fills the field with the written word, not what was sent or heard before", () => {
    const read = { scenes: [{ id: "c1-s3", rows: [{ id: "t1", wordFix: { ok: true },
      words: [{ word: "«أَوَّلَ", say: "أَوَّلَ", sent: "أَوَّلُ", source: "tashkeel", correction: null, auto: "أَوَّلُ", start: 0, end: 1, quran: false }] }] }] } as unknown as SentencesRead;
    expect(reopenTarget(read, "c1-s3", 0, 0)).toEqual({ kind: "fix", draft: { row: "t1", index: 0, say: "أَوَّلَ", save: false, wide: false } });
  });
});
