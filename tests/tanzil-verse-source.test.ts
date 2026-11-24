/**
 * D220 (قرار المالك ٢٤ نوفمبر): نص Tanzil بالرسم العثماني (رواية حفص) مصدر المطابقة، محفوظًا على الجهاز بترخيصه كما هو،
 * وفحص يمنع أي بطاقة آية لا تطابقه حرفًا حرفًا. لا شبكة هنا، ولا يُرسل نص آية إلى أي صوت.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Plan, PlanScene } from "../src/plan/types";
import { loadTanzil, TANZIL_FILE, TANZIL_SHA256, tanzilAyah, tanzilBasmala, tanzilText, tanzilVerses } from "../src/quran/tanzil";
import { normalizeShownVerse, PARTIAL_MIN_WORDS, planVerseMismatches, scriptVerseMismatches, verseWordCount, withSourceVerseTexts } from "../src/quran/verseSource";
import { parseAyahRef } from "../src/script/quranMeta";
import { parseScript } from "../src/script/parse";
import { quranFromScript } from "../src/quran/scriptText";
import { generatePlan } from "../src/plan/generate";
import { verseRef } from "../src/remotion/dafatir/horizon/kit";
import { verseSourceIssues } from "../src/quran/verseSourceIssues";
import { buildCard, verseSourceItem } from "../src/studio/quality/card";
import { assertNoQuranForTts, QuranTtsError } from "../src/voice/quranGuard";
import { verseReadSeconds } from "../src/remotion/dafatir/horizon/meta";

const root = path.resolve(__dirname, "..");
const scene = (id: string, template: string, extra: Partial<PlanScene> = {}): PlanScene =>
  ({ id, template, narration: "", line: 0, props: {}, sfx: [], durationSec: 6, ...extra });
const planOf = (...scenes: PlanScene[]): Plan => ({ version: 1, episode: "001", title: "t", domain: "faith" as Plan["domain"], themeId: "x" as Plan["themeId"],
  updatedAt: "", channel: "dafatir-alzaman", chapters: [{ number: 1, title: "", scenes }] });
/** البقرة ٣٠ كما كانت في خطة دفاتر الزمن 001 (إملائي) */
const IMLAI_2_30 = "وَإِذْ قَالَ رَبُّكَ لِلْمَلَائِكَةِ إِنِّي جَاعِلٌ فِي الْأَرْضِ خَلِيفَةً قَالُوا أَتَجْعَلُ فِيهَا مَنْ يُفْسِدُ فِيهَا وَيَسْفِكُ الدِّمَاءَ وَنَحْنُ نُسَبِّحُ بِحَمْدِكَ وَنُقَدِّسُ لَكَ قَالَ إِنِّي أَعْلَمُ مَا لَا تَعْلَمُونَ";

describe("D220: نص Tanzil محفوظًا كما هو", () => {
  it("الملف بصمته المسجلة، وترخيصه في آخره كما وُزّع، وLICENSE نسخة منه", () => {
    const raw = readFileSync(TANZIL_FILE);
    expect(createHash("sha256").update(raw).digest("hex")).toBe(TANZIL_SHA256);
    const text = raw.toString("utf8");
    expect(text).toContain("# PLEASE DO NOT REMOVE OR CHANGE THIS COPYRIGHT BLOCK");
    expect(text).toContain("Tanzil Quran Text (Uthmani, Version 1.1)");
    expect(text).toContain("License: Creative Commons Attribution 3.0");
    expect(text.endsWith(readFileSync(path.join(root, "assets/quran/LICENSE"), "utf8"))).toBe(true);
  });

  it("٦٢٣٦ آية، والبسملة 1:1، وتُحذف بسملة Tanzil من أول كل سورة (حتى بشدة الباء في التين والقدر) إلا التوبة", () => {
    expect(loadTanzil().size).toBe(6236);
    // الحرفيات هنا بترتيب NFC (المحرر يعيد ترتيب الشدة والحركة)؛ والمقارنة بالمطابقة نفسها
    const nfc = (s: string | undefined) => s?.normalize("NFC");
    expect(nfc(tanzilBasmala())).toBe(nfc("بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ"));
    expect(nfc(tanzilAyah(2, 1))).toBe(nfc("الٓمٓ"));
    expect(nfc(tanzilAyah(95, 1))).toBe(nfc("وَٱلتِّينِ وَٱلزَّيْتُونِ"));
    expect(nfc(tanzilAyah(9, 1))!.startsWith(nfc("بَرَآءَةٌ")!)).toBe(true);
    expect(nfc(tanzilAyah(4, 1))!.startsWith(nfc("يَـٰٓأَيُّهَا")!)).toBe(true);
    expect(tanzilAyah(114, 7)).toBeUndefined();
  });

  it("البحث: آية، ونطاق بالترتيب، واسم السورة، ومرجع غير صالح null", () => {
    expect(tanzilVerses("2:30")!.verses.map((v) => v.number)).toEqual([30]);
    const r = tanzilVerses("2:35-36")!;
    expect([r.key, r.verses.map((v) => v.number)]).toEqual(["2:35-36", [35, 36]]);
    expect(tanzilVerses("البقرة 30")!.key).toBe("2:30");
    expect(tanzilText("2:35-36")).toBe(`${tanzilAyah(2, 35)} ${tanzilAyah(2, 36)}`);
    expect(tanzilVerses("2:300")).toBeNull();
    expect(tanzilVerses("سورة لا توجد 1")).toBeNull();
  });

  it("ملف تغيّر ولو حرفًا واحدًا يُرفض", () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "bal-tanzil-"));
    try {
      const f = path.join(tmp, "t.txt");
      writeFileSync(f, readFileSync(TANZIL_FILE, "utf8").replace("الٓمٓ", "الم"));
      expect(() => loadTanzil(f)).toThrow(/تغيّرت بصمته/);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });
});

describe("D220: المطابقة حرفًا حرفًا", () => {
  const src = tanzilAyah(2, 30)!;
  it("التطبيع: المسافات وعلامة نهاية الآية برقمها وNFC فقط", () => {
    expect(normalizeShownVerse(`  ${src.replace(/ /g, "  \n")} `)).toBe(src.normalize("NFC"));
    // نص Tanzil ليس بترتيب NFC في كل موضع (الشدة قبل الحركة)؛ الترتيب المتكافئ يُرسم واحدًا فلا يُعد فرقًا
    expect(scriptVerseMismatches([{ key: "2:30", text: src.normalize("NFC"), line: 1 }], tanzilVerses)).toEqual([]);
    const range = `${tanzilAyah(2, 35)} ۝٣٥ ${tanzilAyah(2, 36)} ۝٣٦`;
    expect(scriptVerseMismatches([{ key: "2:35-36", text: range, line: 1 }], tanzilVerses)).toEqual([]);
    expect(scriptVerseMismatches([{ key: "2:35-36", text: `${tanzilAyah(2, 35)} ﴿٣٥﴾ ${tanzilAyah(2, 36)}`, line: 1 }], tanzilVerses)).toEqual([]);
  });

  it("الإملائي يُرفض، وحذف علامة وقف أو تطويل أو تغيير حركة يُرفض، ونص المصدر يمر", () => {
    const m = (text: string) => scriptVerseMismatches([{ key: "2:30", text, line: 3 }], tanzilVerses);
    const swap = (a: string, b: string) => {
      const s = src.normalize("NFC"), r = s.replace(a.normalize("NFC"), b.normalize("NFC"));
      expect(r).not.toBe(s);
      return r;
    };
    expect(m(src)).toEqual([]);
    expect(m(IMLAI_2_30)[0]!.message).toMatch(/لا يطابق المصدر.*الكلمة ٤/);
    expect(m(swap(" ۖ", ""))).toHaveLength(1); // علامة وقف
    expect(m(swap("لِلْمَلَـٰٓئِكَةِ", "لِلْمَلَٰٓئِكَةِ"))).toHaveLength(1); // تطويل
    expect(m(swap("جَاعِلٌ", "جَاعِلُ"))).toHaveLength(1); // حركة
    expect(m(`${src} زيادة`)).toHaveLength(1);
    expect(scriptVerseMismatches([{ key: "2:999", text: src, line: 1 }], tanzilVerses)[0]!.message).toMatch(/غير صالح/);
  });

  it("الخطة: لقطة «خط الأفق» (verseText/verseKey) وبطاقة الآية (text/ayahKey)، ونص بلا مرجع خطأ", () => {
    const p = planOf(
      scene("c1-s8", "horizon-shot", { props: { shot: "verse-tag", verseKey: "2:30", verseText: IMLAI_2_30 } }),
      scene("c1-s9", "horizon-shot", { props: { shot: "x", verseKey: "2:31", verseText: tanzilAyah(2, 31)! } }),
      scene("c1-s10", "verse-card", { ayahKey: "2:34", props: { text: "نص آخر", reference: "البقرة ٣٤" } }),
      scene("c1-s11", "verse-card", { ayahKey: "2:38", props: { text: "‹نص الآية مطلوب داخل السكريبت›" } }),
      scene("c1-s12", "horizon-shot", { props: { verseText: "نص بلا مرجع" } }),
    );
    expect(planVerseMismatches(p, tanzilVerses).map((x) => x.sceneId).sort()).toEqual(["c1-s10", "c1-s12", "c1-s8"]);
    expect(verseSourceIssues(p).every((i) => i.level === "error" && i.early)).toBe(true);
  });

  it("«انسخ نص المصدر» يستبدل verseText وحده بنص المصدر كما هو، والنطاق بعلامات نهايته", () => {
    const s = scene("c1-s8", "horizon-shot", { narration: "كلام", props: { shot: "verse-tag", verseKey: "2:30", verseText: IMLAI_2_30, pageHead: "عنوان" } });
    const r2 = scene("c1-s9", "horizon-shot", { props: { verseKey: "2:35-36", verseText: "قديم" } });
    const { plan, changed } = withSourceVerseTexts(planOf(s, r2), tanzilVerses);
    expect(changed).toEqual([{ sceneId: "c1-s8", key: "2:30" }, { sceneId: "c1-s9", key: "2:35-36" }]);
    const [a, b] = plan.chapters[0]!.scenes;
    expect(a).toEqual({ ...s, props: { ...s.props, verseText: tanzilAyah(2, 30) } });
    expect(b!.props.verseText).toBe(`${tanzilAyah(2, 35)} ۝٣٥ ${tanzilAyah(2, 36)} ۝٣٦`);
    expect(planVerseMismatches(plan, tanzilVerses)).toEqual([]);
    expect(withSourceVerseTexts(plan, tanzilVerses).changed).toEqual([]);
  });

  it("بند البطاقة «لا بطاقة آية تخالف المصدر»: بلا آية ✓، ولم يُقابل «لم يُقس»، والمخالف ✗ يمنع", () => {
    const none = planOf(scene("a", "horizon-shot"));
    expect(verseSourceItem(none).status).toBe("pass");
    const p = planOf(scene("c1-s8", "horizon-shot", { props: { verseKey: "2:30", verseText: IMLAI_2_30 } }));
    expect(verseSourceItem(p).status).toBe("unmeasured");
    const mismatches = planVerseMismatches(p, tanzilVerses);
    const bad = verseSourceItem(p, { mismatches });
    expect([bad.status, bad.reason]).toEqual(["fail", expect.stringContaining("c1-s8")]);
    const card = buildCard({ target: "assembly", plan: p, measured: null, verseSource: { mismatches } });
    expect(card.blockers.some((b) => b.includes("لا بطاقة آية تخالف المصدر"))).toBe(true);
    expect(verseSourceItem(p, { mismatches: [] }).status).toBe("pass");
  });
});

describe("D220: الرسم العثماني لا يُضعف حارس الصوت ولا يطيل زمن القراءة", () => {
  it("كلمات الآية الخمس بالإملائي في كلام الراوي تُرفض والآية المعروفة بالعثماني", () => {
    expect(() => assertNoQuranForTts("قال تعالى: وإذ قال ربك للملائكة إني جاعل في الأرض خليفة", null, { verses: [tanzilAyah(2, 30)!] })).toThrow(QuranTtsError);
    expect(() => assertNoQuranForTts("رب العالمين يرى الناس جميعًا في كل حين", null, { verses: [tanzilAyah(2, 30)!] })).not.toThrow();
  });

  it("علامة الوقف المنفصلة ليست كلمة في زمن قراءة البطاقة", () => {
    expect(verseReadSeconds(tanzilAyah(2, 30)!)).toBe(verseReadSeconds(tanzilAyah(2, 30)!.replace(/ [ۖۗۚۛۙۘ]/gu, "")));
  });
});

describe("D220: خطط المستودع في القنوات غير المجمّدة تطابق المصدر", () => {
  const frozen = (ch: string) => { try { return Boolean(JSON.parse(readFileSync(path.join(root, "channels", ch, "stock.json"), "utf8")).frozen); } catch { return false; } };
  const channels = readdirSync(path.join(root, "channels")).filter((c) => existsSync(path.join(root, "channels", c, "episodes")) && !frozen(c));
  it.each(channels)("%s: كل verseText في plan.json يطابق Tanzil، و«انسخ نص المصدر» يصلح كل مخالف", (ch) => {
    const dir = path.join(root, "channels", ch, "episodes");
    for (const ep of readdirSync(dir).filter((e) => existsSync(path.join(dir, e, "plan.json")))) {
      const plan = JSON.parse(readFileSync(path.join(dir, ep, "plan.json"), "utf8")) as Plan;
      expect(planVerseMismatches(plan, tanzilVerses).map((m) => `${m.sceneId}: ${m.message}`), `${ch}/${ep}`).toEqual([]);
      expect(planVerseMismatches(withSourceVerseTexts(plan, tanzilVerses).plan, tanzilVerses), `${ch}/${ep}`).toEqual([]);
    }
  });
});

describe("D222: جزء تام المعنى من آية طويلة جدًا، معلَّمًا", () => {
  const words = (s: number, a: number) => tanzilAyah(s, a)!.split(" ");
  const head = (s: number, a: number, n: number) => `${words(s, a).slice(0, n).join(" ")} …`;
  const p282 = head(2, 282, 15); // «… بِٱلْعَدْلِ ۚ» ثم «…»
  it("المرجع «(جزء)» يُقرأ لآية واحدة، والنطاق يُرفض", () => {
    const r = parseAyahRef("البقرة 282 (جزء)");
    expect(r.ok && [r.ref.key, r.ref.partial]).toEqual(["2:282", true]);
    expect(parseAyahRef("البقرة 282").ok && (parseAyahRef("البقرة 282") as { ref: { partial?: true } }).ref.partial).toBeUndefined();
    expect(parseAyahRef("البقرة 281-282 (جزء)").ok).toBe(false);
  });

  it("يُقبل المعلَّم: كلمات متصلة من المصدر، و«…» في كل طرف مقطوع وحده", () => {
    const m = (text: string, partial = true) => scriptVerseMismatches([{ key: "2:282", text, line: 1, partial }], tanzilVerses);
    expect(m(p282)).toEqual([]);
    const mid = `… ${words(2, 282).slice(56, 60).join(" ")} …`; // «وَٱسْتَشْهِدُوا۟ شَهِيدَيْنِ مِن رِّجَالِكُمْ»
    expect(m(mid)).toEqual([]);
    const tail = `… ${words(2, 282).slice(-4).join(" ")}`;
    expect(m(tail)).toEqual([]);
    expect(m(p282.replace(" …", ""))[0]!.message).toMatch(/«…» في الطرف المقطوع/); // آخره مقطوع بلا «…»
    expect(m(`… ${p282}`)[0]!.message).toMatch(/«…» في الطرف المقطوع/); // أوله ليس مقطوعًا
    expect(m(`${words(2, 282).slice(0, 3).join(" ")} … ${words(2, 282).slice(5, 9).join(" ")} …`)[0]!.message).toMatch(/في وسطه/);
    expect(m(p282.replace(words(2, 282)[3]!, "إذا"))[0]!.message).toMatch(/ليس كلمات متصلة/); // تعديل داخل الجزء
    expect(m(`${words(2, 282).join(" ")}`)[0]!.message).toMatch(/الآية كاملة/);
  });

  it("الجزء غير المعلَّم يُرفض ويُقال إنه ينقصه التعليم؛ وجزء آية ≤ ٣٠ كلمة يُرفض", () => {
    const unflagged = scriptVerseMismatches([{ key: "2:282", text: p282, line: 1 }], tanzilVerses);
    expect(unflagged[0]!.message).toMatch(/معلَّمًا «\(جزء\)»/);
    expect(verseWordCount(tanzilAyah(2, 30)!)).toBe(28);
    const short = scriptVerseMismatches([{ key: "2:30", text: head(2, 30, 9), line: 1, partial: true }], tanzilVerses);
    expect(short[0]!.message).toMatch(/تُعرض كاملة/);
    expect(PARTIAL_MIN_WORDS).toBe(30);
  });

  it("الخطة: partial لبطاقة الآية وversePartial للقطة «خط الأفق»، و«انسخ نص المصدر» لا يمس الجزء", () => {
    const card = scene("c1-s2", "verse-card", { ayahKey: "2:282", props: { text: p282, partial: "1" } });
    const hz = scene("c1-s3", "horizon-shot", { props: { verseKey: "2:282", verseText: p282, versePartial: "1" } });
    const bare = scene("c1-s4", "horizon-shot", { props: { verseKey: "2:282", verseText: p282 } });
    expect(planVerseMismatches(planOf(card, hz, bare), tanzilVerses).map((x) => x.sceneId)).toEqual(["c1-s4"]);
    expect(withSourceVerseTexts(planOf(hz), tanzilVerses).changed).toEqual([]);
  });

  it("السكريبت: «[آية: البقرة 282 (جزء) | …]» يصير بطاقة معلَّمة بمرجع «(جزء)»", () => {
    const parsed = parseScript(`---\ntitle: t\n---\n# فصل\n\nكلام.\n\n[آية: البقرة 282 (جزء) | ${p282}]\n`, "x.md");
    const q = quranFromScript(parsed);
    expect(q.ayahs.map((a) => [a.key, a.partial])).toEqual([["2:282", true]]);
    expect(scriptVerseMismatches(q.ayahs, tanzilVerses)).toEqual([]);
    const plan = generatePlan(parsed, null, q.texts) as Plan;
    const v = plan.chapters.flatMap((c) => c.scenes).find((s) => s.template === "verse-card")!;
    expect([v.ayahKey, v.props.partial, v.props.reference]).toEqual(["2:282", "1", "البقرة · ٢٨٢ (جزء)"]);
    expect(verseRef("2:282", true)).toBe("البقرة: ٢٨٢ (جزء)");
  });

  it("زمن القراءة قدر ما يظهر وحده: «…» وعلامة الوقف ليستا كلمة", () => {
    expect(verseReadSeconds(p282)).toBe(2 + 0.5 * 14);
    expect(verseReadSeconds(p282)).toBeLessThan(verseReadSeconds(tanzilAyah(2, 282)!));
  });
});
