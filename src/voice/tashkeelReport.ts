/**
 * مدقق التشكيل قبل توليد الصوت: هل كل كلمة ستُنطق لها نظير مشكول في tashkeel.md (أو في قاموس النطق)؟
 * الكلمة التي لا نظير لها تُرسل إلى الصوت بلا تشكيل فيخمّن النموذج نطقها؛ هذا التقرير يكشفها قبل صرف أي رصيد،
 * ويكشف الكلمات التي لها في الملف أكثر من نطق (عِلْم / عَلِمَ) لمراجعة السياق.
 */
import config from "../../config.json";
import { normWord, stripTashkeel, vowelize, type TashkeelIndex } from "./tashkeel";

export type TashkeelGap = { sceneId: string; words: string[]; narration: string };
export type TashkeelAmbiguity = { word: string; forms: string[]; scenes: string[] };
export type TashkeelReport = {
  /** ملف tashkeel.md موجود */
  file: boolean;
  /** الكلمات العربية المنطوقة التي تحتاج تشكيلًا */
  words: number;
  covered: number;
  /** نسبة التغطية من 0 إلى 1 */
  coverage: number;
  min: number;
  /** يُسمح بتوليد الصوت */
  ok: boolean;
  gaps: TashkeelGap[];
  ambiguous: TashkeelAmbiguity[];
  /** كل كلمات التعليق المنطوقة في المشاهد المفحوصة (قبل الاستبعاد)؛ words = spoken − المستبعد */
  spoken?: number;
  /**
   * ما لا يدخل المقام ولماذا: حروف لا يلتبس نطقها وجاءت بلا تشكيل (PLAIN_OK، بعددها لكل حرف)،
   * ورموز بلا حرف عربي (أرقام، علامات، لاتينية).
   */
  excluded?: { plain: number; plainWords: Record<string, number>; nonArabic: number; nonArabicSamples: string[] };
  /** مشاهد لا تدخل الفحص أصلًا (تُملأ في generate.ts): الآيات (تلاوة بشرية)، والصامتة، والمُدارة جملةً جملة */
  skipped?: { verseScenes: number; silentScenes: number; managedScenes: number };
};

export const TASHKEEL = { required: true, minCoverage: 0.98, ...((config as { tashkeel?: { required?: boolean; minCoverage?: number } }).tashkeel ?? {}) };

/** حروف لا يلتبس نطقها، فلا تُحسب إن جاءت بلا تشكيل. */
const PLAIN_OK = new Set(["في", "الي", "عن", "يا", "او", "ثم", "قد", "هل", "لا", "و", "ف", "ب", "ل"]);
const MARK = /[ً-ٰٟ]/;
const ARABIC = /[ء-ي]/;
const core = (w: string) => w.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "");
/**
 * بصمة النطق المميِّزة: حركات أول حرفين بعد «ال» (بلا السكون). الإعراب وحركة ما قبل الضمير لا تدخلها،
 * فـ«نَفْسَه» و«نَفْسِه» واحدة، و«عِلْم» و«عَلِمَ» و«مِن» و«مَن» مختلفة.
 */
const stem = (w: string) => {
  const letters = [...stripTashkeel(core(w)).replace(/^[اأإآٱ]ل/u, "")].length;
  const groups = [...core(w).matchAll(/([ء-ي])([ً-ْٰ]*)/gu)].map((m) => m[2]!.replace(/ْ/g, ""));
  const start = groups.length - letters;
  // حرف الإعراب (الأخير) لا يدخل البصمة
  const from = Math.max(0, start);
  return groups.slice(from, Math.min(from + 2, groups.length - 1 > from ? groups.length - 1 : from + 1)).join("|");
};

type Dict = { entries?: { text: string; say: string }[] };

export const tashkeelReport = (scenes: { id: string; narration: string }[], idx: TashkeelIndex | null, dict: Dict = {}): TashkeelReport => {
  const say = new Set((dict.entries ?? []).filter((e) => e.text && e.say).map((e) => e.text));
  // كل نطق للكلمة في الملف (بلا حركة الإعراب)
  const forms = new Map<string, Map<string, string>>();
  if (idx)
    idx.plain.forEach((p, i) => {
      if (!p || !MARK.test(idx.voweled[i]!)) return;
      const m = forms.get(p) ?? new Map<string, string>();
      const k = stem(idx.voweled[i]!);
      if (!m.has(k)) m.set(k, core(idx.voweled[i]!));
      forms.set(p, m);
    });

  let words = 0;
  let covered = 0;
  let spoken = 0;
  let nonArabic = 0;
  const nonArabicSamples: string[] = [];
  const plainWords: Record<string, number> = {};
  const gaps: TashkeelGap[] = [];
  const amb = new Map<string, TashkeelAmbiguity>();
  for (const sc of scenes) {
    const ws = sc.narration.trim().split(/\s+/).filter(Boolean);
    const v = vowelize(ws, idx);
    const missing: string[] = [];
    ws.forEach((w, i) => {
      spoken++;
      const c = core(w);
      if (!ARABIC.test(c)) {
        nonArabic++;
        if (nonArabicSamples.length < 8 && !nonArabicSamples.includes(w)) nonArabicSamples.push(w);
        return;
      }
      const n = normWord(c);
      if (say.has(c)) return void (words++, covered++);
      if (PLAIN_OK.has(n) && !MARK.test(c)) return void (plainWords[n] = (plainWords[n] ?? 0) + 1);
      words++;
      const got = v[i];
      // الكلمة مشكولة في السكريبت نفسه، أو لها نظير مشكول في الملف
      if (MARK.test(c) || (got && MARK.test(got))) covered++;
      else missing.push(stripTashkeel(c));
      const f = forms.get(n);
      if (f && f.size > 1) {
        const a = amb.get(n) ?? { word: stripTashkeel(c), forms: [...f.values()], scenes: [] };
        if (!a.scenes.includes(sc.id)) a.scenes.push(sc.id);
        amb.set(n, a);
      }
    });
    if (missing.length) gaps.push({ sceneId: sc.id, words: missing, narration: sc.narration.trim() });
  }
  const coverage = words ? covered / words : 1;
  const file = Boolean(idx);
  const ok = (file || !TASHKEEL.required) && coverage >= TASHKEEL.minCoverage - 1e-9;
  const plain = Object.values(plainWords).reduce((a, b) => a + b, 0);
  return { file, words, covered, coverage, min: TASHKEEL.minCoverage, ok, gaps, ambiguous: [...amb.values()],
    spoken, excluded: { plain, plainWords, nonArabic, nonArabicSamples } };
};

/**
 * سطر المقام كاملًا: «مفحوصة X من Y كلمة منطوقة، مستبعدة Z: …»، حتى لا يُقرأ «X من X» على أنه عدد كلمات النص كله.
 */
export const tashkeelDenominatorLine = (r: TashkeelReport): string => {
  const ex = r.excluded;
  if (r.spoken === undefined || !ex) return `مفحوصة ${r.words} كلمة`;
  const z = r.spoken - r.words;
  const parts: string[] = [];
  if (ex.plain) {
    const top = Object.entries(ex.plainWords).sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w} ${n}`).join("، ");
    parts.push(`${ex.plain} حرفًا لا يلتبس نطقه بلا تشكيل (${top})`);
  }
  if (ex.nonArabic) parts.push(`${ex.nonArabic} رمزًا بلا حرف عربي (${ex.nonArabicSamples.join(" ")})`);
  const sk = r.skipped;
  const outside = sk ? [sk.verseScenes ? `${sk.verseScenes} مشهد آية (تلاوة بشرية لا صوت مولَّد)` : "", sk.silentScenes ? `${sk.silentScenes} مشهدًا صامتًا` : "", sk.managedScenes ? `${sk.managedScenes} مشهدًا صوته جملةً جملة (يُفحص في «الجمل»)` : ""].filter(Boolean) : [];
  return `مفحوصة ${r.words} من ${r.spoken} كلمة منطوقة، مستبعدة ${z}${parts.length ? `: ${parts.join("؛ ")}` : ""}${outside.length ? `. وخارج الفحص: ${outside.join("، ")}` : ""}.`;
};

/** سطر واحد يشرح سبب المنع. */
export const tashkeelBlockMessage = (r: TashkeelReport) => {
  if (!r.file) return "لا توجد نسخة مشكولة (tashkeel.md) لهذه الحلقة؛ أضفها قبل توليد الصوت حتى لا يخمّن النموذج النطق.";
  const sample = r.gaps.slice(0, 4).map((g) => `${g.sceneId}: ${g.words.slice(0, 4).join("، ")}`).join(" | ");
  return `تغطية التشكيل ${Math.round(r.coverage * 1000) / 10}% وأقل من الحد ${Math.round(r.min * 100)}%: ${r.words - r.covered} كلمة ستُنطق بلا تشكيل (${sample}). حدّث tashkeel.md ثم أعد المحاولة.`;
};
