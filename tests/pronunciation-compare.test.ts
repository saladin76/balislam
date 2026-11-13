/**
 * فحص النطق (العمل ٩): التطبيع العربي والمقارنة كلمةً كلمة. دوال صافية، بلا صوت ولا نموذج.
 */
import { describe, expect, it } from "vitest";
import { normalizeArabic, normalizedWords, wordSimilarity } from "../src/voice/pronunciation/normalize";
import { compareTranscript, suspectLine, type RefWord } from "../src/voice/pronunciation/compare";

const ref = (t: string): RefWord[] => t.split(/\s+/).filter(Boolean).map((word) => ({ word }));

describe("التطبيع العربي", () => {
  it("يحذف التشكيل والتطويل وعلامات المصحف", () => {
    expect(normalizeArabic("كَتَبَ الوَلَدُ الدَّرْسَ")).toBe("كتب الولد الدرس");
    expect(normalizeArabic("جـــميل")).toBe("جميل");
    expect(normalizeArabic("الرَّحْمَٰنِ")).toBe("الرحمن");
  });
  it("يوحّد الهمزات: أ إ آ ٱ ← ا، ؤ ← و، ئ ← ي، وتُحذف ء المفردة", () => {
    expect(normalizeArabic("أحمد إبراهيم آدم ٱلله")).toBe("احمد ابراهيم ادم الله");
    expect(normalizeArabic("مؤمن")).toBe("مومن");
    expect(normalizeArabic("سائل")).toBe("سايل");
    expect(normalizeArabic("سماء")).toBe("سما");
  });
  it("التاء المربوطة ← ه، والألف المقصورة ← ي", () => {
    expect(normalizeArabic("مدرسة")).toBe(normalizeArabic("مدرسه"));
    expect(normalizeArabic("مستشفى")).toBe(normalizeArabic("مستشفي"));
  });
  it("NFKC والمحارف الخفية واتجاه الكتابة والترقيم والأرقام الهندية", () => {
    expect(normalizeArabic("‏كتب‌، الدرس؟")).toBe("كتب الدرس");
    expect(normalizeArabic("سنة ١٤٤٥")).toBe("سنه 1445");
    expect(normalizeArabic("ﻻ")).toBe("لا");
    expect(normalizedWords("  «قال»:  نعم!  ")).toEqual(["قال", "نعم"]);
  });
  it("التشابه: ١ للكلمة نفسها، وأقل كلما بعدت", () => {
    expect(wordSimilarity("كتب", "كتب")).toBe(1);
    expect(wordSimilarity("وقال", "قال")).toBeGreaterThanOrEqual(0.75);
    expect(wordSimilarity("الصبر", "الشكر")).toBeLessThan(0.75);
  });
});

describe("المقارنة بالتفريغ", () => {
  it("التفريغ بلا تشكيل وبهمزات وتاء مربوطة مختلفة = سليم", () => {
    const c = compareTranscript(ref("ذَهَبَ أَحْمَدُ إِلَى المَدْرَسَةِ مُبَكِّرًا"), "ذهب احمد الي المدرسه مبكرا");
    expect(c.verdict).toBe("ok");
    expect(c.suspects).toEqual([]);
  });
  it("كلمة استُبدلت تُعلَّم بما سُمع مكانها", () => {
    const c = compareTranscript(ref("الصَّبْرُ مِفْتَاحُ الفَرَجِ"), "الشكر مفتاح الفرج");
    expect(c.verdict).toBe("suspect");
    expect(c.suspects).toEqual([{ index: 0, word: "الصَّبْرُ", heard: "الشكر" }]);
    expect(suspectLine(c)).toBe("كلمة قد تكون نُطقت خطأ: «الصَّبْرُ»");
  });
  it("كلمة سقطت تُعلَّم بلا مسموع", () => {
    const c = compareTranscript(ref("كَانَ الرَّجُلُ يَمْشِي وَحِيدًا فِي الطَّرِيقِ"), "كان الرجل يمشي في الطريق");
    expect(c.suspects.map((s) => [s.word, s.heard])).toEqual([["وَحِيدًا", null]]);
  });
  it("لا تُعلَّم كلمة من حرفين أو أقل (في، من، و)", () => {
    const c = compareTranscript(ref("خَرَجَ مِنْ البَيْتِ فِي الصَّبَاحِ"), "خرج البيت الصباح");
    expect(c.verdict).toBe("ok");
  });
  it("وصل كلمتين أو فصلهما لا يُعدّ خطأ", () => {
    expect(compareTranscript(ref("قَالَ عَبْدُ اللَّهِ نَعَمْ"), "قال عبدالله نعم").verdict).toBe("ok");
    expect(compareTranscript(ref("ذهب عبدالرحمن مبكرا"), "ذهب عبد الرحمن مبكرا").verdict).toBe("ok");
  });
  it("الأرقام المكتوبة أرقامًا في التفريغ تقابل كلماتها", () => {
    expect(compareTranscript(ref("عَاشَ ثَلَاثَمِئَةٍ وَخَمْسِينَ سَنَةً"), "عاش 350 سنة").verdict).toBe("ok");
  });
  it("ما يُرسل بغير كتابته (قاموس النطق) يُقبل", () => {
    const r: RefWord[] = [{ word: "قال" }, { word: "ابن", alt: ["إبن"] }, { word: "تيمية", alt: ["تَيْمِيَّه"] }];
    expect(compareTranscript(r, "قال ابن تيميه").verdict).toBe("ok");
  });
  it("الكلمة القرآنية لا تُعلَّم أبدًا", () => {
    const r: RefWord[] = [{ word: "قال" }, { word: "رَبِّي", skip: true }, { word: "يومًا" }];
    expect(compareTranscript(r, "قال يوما").verdict).toBe("ok");
  });
  it("تفريغ فارغ: «لم يُسمع كلام»، لا قائمة كلمات", () => {
    const c = compareTranscript(ref("هَذِهِ جُمْلَةٌ طَوِيلَةٌ"), "");
    expect(c.verdict).toBe("empty");
    expect(suspectLine(c)).toMatch(/لم يُسمع كلام/);
  });
  it("أكثر من أربع كلمات: أربع ثم «و… غيرها»", () => {
    const c = compareTranscript(ref("كتاب قلم دفتر مكتب كرسي نافذة"), "سيارة طائرة قطار سفينة دراجة حافلة");
    expect(c.suspects.length).toBeGreaterThan(4);
    expect(suspectLine(c)).toMatch(/^كلمات قد تكون نُطقت خطأ: («[^»]+»، ){3}«[^»]+» و[١-٩] غيرها$/);
  });
});
