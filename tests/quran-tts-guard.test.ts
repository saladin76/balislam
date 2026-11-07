import { describe, expect, it } from "vitest";
import { parseScript } from "../src/script/parse";
import { assertNoQuranInTts } from "../src/quran/ttsGuard";

const script = parseScript(`---
title: اختبار حماية التلاوة
domain: psychology
episode: "999"
---
## الفصل 1 · المقارنة
[آية: النجم 39 | وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ]
[آية: الإخلاص 1 | قُلْ هُوَ اللَّهُ أَحَدٌ]
`);

describe("never send script-authored Quran to synthetic voice", () => {
  it("allows normal independent narration", () => {
    expect(() => assertNoQuranInTts(script, ["نشرح المعنى التاريخي واللغوي دون تلاوة نص الآية."])).not.toThrow();
  });
  it("blocks exact and unvowelized verse text, references and short verses", () => {
    for (const audio of [
      "وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ",
      "وان ليس للانسان الا ما سعى",
      "قال المعلق: وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ هذا هو المعنى",
      "قل هو الله احد",
      "[آية: الإخلاص 1 | نص]",
    ]) {
      expect(() => assertNoQuranInTts(script, [audio])).toThrow();
    }
  });
  it("fails closed on an authored Quran reference missing its manual text", () => {
    const broken = parseScript(`---
title: اختبار
domain: psychology
episode: "999"
---
## الفصل 1 · اختبار
[آية: النجم 39]
`);
    expect(() => assertNoQuranInTts(broken, ["سرد غير قرآني"])).toThrow();
  });
});
