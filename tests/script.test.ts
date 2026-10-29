import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseScript } from "../src/script/parse";
import { checkScript, type CheckConfig } from "../src/script/check";
import { AYAH_COUNTS, SURAH_NAMES, parseAyahRef, surahNumber } from "../src/script/quranMeta";

const valid = readFileSync(path.join(__dirname, "fixtures", "valid.md"), "utf8");

/** إعداد اختبار: الفصول التجريبية قصيرة، فنوسع نطاق المدة حتى لا تظهر تنبيهات الطول. */
const testConfig: CheckConfig = {
  wordsPerMinute: 130,
  chapters: 6,
  chapterSeconds: { min: 1, max: 999 },
  maxSentenceWords: 20,
  maxTitleChars: 60,
};

const run = (source: string) => checkScript(parseScript(source), testConfig);
const codes = (source: string, level: "error" | "warning" = "error") =>
  run(source)
    .issues.filter((i) => i.level === level)
    .map((i) => i.code);

describe("جدول السور", () => {
  it("فيه 114 سورة ومجموع آياتها 6236", () => {
    expect(SURAH_NAMES).toHaveLength(114);
    expect(AYAH_COUNTS).toHaveLength(114);
    expect(AYAH_COUNTS.reduce((a, b) => a + b, 0)).toBe(6236);
  });

  it("يقبل اختلاف الهمزات وكلمة «سورة» والأرقام العربية", () => {
    expect(surahNumber("ابراهيم")).toBe(14);
    expect(surahNumber("سورة النجم")).toBe(53);
    expect(parseAyahRef("البقرة ٢٥٥").ok && parseAyahRef("البقرة ٢٥٥")).toMatchObject({ ref: { key: "2:255" } });
    expect(parseAyahRef("البقرة 255-256")).toMatchObject({ ok: true, ref: { key: "2:255-256" } });
  });

  it("يرفض سورة غير موجودة أو آية خارج النطاق", () => {
    expect(parseAyahRef("الفاتحة 8").ok).toBe(false);
    expect(parseAyahRef("سورة الأحلام 3").ok).toBe(false);
    expect(parseAyahRef("النجم").ok).toBe(false);
  });
});

describe("قراءة السكريبت", () => {
  it("يقرأ الترويسة والفصول الستة والعلامات والاستشهادات", () => {
    const s = parseScript(valid);
    expect(s.frontmatter).toMatchObject({ domain: "psychology", episode: "001" });
    expect(s.chapters).toHaveLength(6);
    expect(s.chapters[0]?.title).toBe("السؤال");
    const kinds = s.chapters.flatMap((c) => c.blocks.map((b) => b.kind));
    expect(kinds).toContain("scene");
    expect(kinds).toContain("ayah");
    expect(kinds).toContain("hadith");
    expect(kinds).toContain("sfx");
    expect(kinds).toContain("bridge");
    expect(s.citations.map((c) => c.kind)).toEqual(["ayah", "hadith"]);
    expect(s.practicalStep?.text).toContain("خمس دقائق");
  });

  it("خيارات المشهد تُقرأ بعد |", () => {
    const scene = parseScript(valid).chapters[0]?.blocks.find((b) => b.kind === "scene" && b.template === "character-talk");
    expect(scene).toMatchObject({ options: ["pose=think"] });
  });
});

describe("فحص السكريبت", () => {
  it("السكريبت الصحيح يمر بلا أخطاء ولا تنبيهات", () => {
    const r = run(valid);
    expect(r.issues).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.stats.chapters).toHaveLength(6);
  });

  it("يرفض نقص الفصول", () => {
    const five = valid.replace(/## الفصل 6[\s\S]*?(?=## الاستشهادات)/, "");
    expect(codes(five)).toContain("chapter-count");
  });

  it("يرفض ترويسة بمجال غير معروف", () => {
    expect(codes(valid.replace("domain: psychology", "domain: tech"))).toContain("frontmatter-invalid");
  });

  it("يرفض مرجع آية خاطئًا", () => {
    expect(codes(valid.replace("[آية: النجم 39]", "[آية: النجم 99]"))).toContain("ayah-ref");
  });

  it("يرفض آية غير مذكورة في الاستشهادات", () => {
    expect(codes(valid.replace("- آية | النجم 39 | القارئ: …", ""))).toContain("ayah-not-cited");
  });

  it("يرفض الحديث الضعيف", () => {
    expect(codes(valid.replace("| صحيح | تحقق", "| ضعيف | تحقق"))).toContain("hadith-weak");
  });

  it("يرفض حديثًا بلا درجة", () => {
    expect(codes(valid.replace("| صحيح | تحقق: الدرر السنية", ""))).toContain("citation-hadith-grade");
  });

  it("يرفض الإحالة لفصل سابق", () => {
    expect(codes(valid.replace("حين نؤجل،", "كما قلنا، حين نؤجل،"))).toContain("back-reference");
  });

  it("يرفض رمز ﷺ ويطلب كتابتها كاملة", () => {
    expect(codes(valid.replace("رسول الله صلى الله عليه وسلم", "رسول الله ﷺ"))).toContain("salawat-symbol");
  });

  it("يرفض كتابة آية داخل نص التعليق", () => {
    expect(codes(valid.replace("القرآن يربط", "﴿ وَأَن لَّيْسَ لِلْإِنسَانِ إِلَّا مَا سَعَىٰ ﴾ القرآن يربط"))).toContain("ayah-inline");
  });

  it("يرفض جملة ربط في الفصل الأخير", () => {
    expect(codes(valid.replace("تبدأ الآن.", "تبدأ الآن.\n\nbridge: إلى اللقاء."))).toContain("bridge-last");
  });

  it("يرفض قالب مشهد غير موجود وعلامة غير معروفة", () => {
    const bad = valid.replace("[مشهد: summary]", "[مشهد: explosion]").replace("[صوت: page-turn]", "[موسيقى: خلفية]");
    const c = codes(bad);
    expect(c).toContain("scene-unknown");
    expect(c).toContain("directive-unknown");
  });

  it("يرفض غياب قسم الاستشهادات والخطوة العملية", () => {
    const bare = valid.split("## الاستشهادات")[0] ?? "";
    const c = codes(bare);
    expect(c).toContain("citations-missing");
    expect(c).toContain("step-missing");
  });

  it("ينبّه على الأرقام والجمل الطويلة والبداية المعلقة", () => {
    const long = Array.from({ length: 25 }, () => "كلمة").join(" ");
    const bad = valid
      .replace("ابدأ بخطوة صغيرة جدًا", "ابدأ بخطوة صغيرة جدًا لمدة 5 دقائق")
      .replace("القلق لا يختفي، بل يكبر كل يوم.", `${long}.`)
      .replace("حين نؤجل، نشتري", "هذا حين نؤجل، نشتري");
    const w = codes(bad, "warning");
    expect(w).toContain("digits");
    expect(w).toContain("sentence-long");
    expect(w).toContain("dangling-start");
  });

  it("يقدّر المدة وينبّه حين يقصر الفصل عن الحد", () => {
    const r = checkScript(parseScript(valid), { ...testConfig, chapterSeconds: { min: 60, max: 80 } });
    expect(r.issues.some((i) => i.code === "chapter-length")).toBe(true);
    expect(r.ok).toBe(true);
  });
});
