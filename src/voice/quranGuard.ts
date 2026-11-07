/**
 * حاجز القرآن أمام الصوت المستنسخ (الأمر 024): لا يصل نص قرآني إلى محرك التعليق أبدًا،
 * لا في العيّنات ولا في التعليق الكامل ولا في إعادة التوليد، ولا في النص المجاور (previous/next).
 *
 * طبقتان مستقلتان:
 * 1. علامات الرسم العثماني والمصحف (ألف الوصل، علامات الوقف والضبط، ﴿﴾، ۝): لا تكتب في تعليق عادي، فتُرفض أينما ظهرت.
 * 2. نصوص آيات الحلقة نفسها (نص السكريبت وquran.json): يُرفض أي تعليق يحوي الآية كاملة أو أربع كلمات متتالية منها،
 *    بعد توحيد الحروف وحذف التشكيل، فلا يمرّ جزء منها لاختلاف ضبطه.
 */
import { normalizeArabic } from "../script/quranMeta";
import { VERSE_PLACEHOLDER } from "../plan/quranText";

/** ألف الوصل، والحروف الصغيرة وعلامات الضبط والوقف في المصحف (U+06D6–U+06ED)، وامتداداتها، وأقواس الآية ونهايتها. */
export const MUSHAF_MARKS = /[ٱۖ-ۭ࣓-ࣿ﴾﴿]/u;
const WINDOW = 4;

export class QuranInSpeechError extends Error {}

const words = (s: string) =>
  normalizeArabic(s.normalize("NFC"))
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);

/** نصوص الآيات التي لا يجوز أن تصل إلى الصوت المستنسخ، من خطة الحلقة. */
export const quranGuardTexts = (plan: { chapters: { scenes: { template: string; ayahText?: string; props?: Record<string, unknown> }[] }[] }, store: Record<string, string> = {}): string[] => {
  const out = new Set<string>();
  for (const s of plan.chapters.flatMap((c) => c.scenes)) {
    if (s.template !== "verse-card") continue;
    if (s.ayahText?.trim()) out.add(s.ayahText);
    const shown = String(s.props?.text ?? "");
    if (shown.trim() && shown !== VERSE_PLACEHOLDER) out.add(shown);
  }
  for (const [k, v] of Object.entries(store)) if (!k.includes("#") && typeof v === "string" && v.trim()) out.add(v);
  return [...out];
};

/** يعيد سبب الرفض إن احتوى النص على قرآن، وإلا null. */
export const findQuranInSpeech = (text: string, guards: string[] = []): string | null => {
  if (!text) return null;
  if (MUSHAF_MARKS.test(text)) return "فيه علامات رسم المصحف (ألف الوصل أو علامات الوقف والضبط أو أقواس الآية)";
  const spoken = ` ${words(text).join(" ")} `;
  for (const g of guards) {
    const w = words(g);
    if (!w.length) continue;
    if (w.length <= WINDOW) {
      if (spoken.includes(` ${w.join(" ")} `)) return "فيه نص آية من الحلقة";
      continue;
    }
    for (let i = 0; i + WINDOW <= w.length; i++)
      if (spoken.includes(` ${w.slice(i, i + WINDOW).join(" ")} `)) return "فيه جزء من نص آية من الحلقة";
  }
  return null;
};

/** يرمي قبل أي طلب إلى محرك الصوت إن وُجد نص قرآني في أي جزء يُرسل إليه. */
export const assertNoQuranInSpeech = (parts: { label: string; text?: string }[], guards: string[] = []) => {
  for (const p of parts) {
    const why = p.text ? findQuranInSpeech(p.text, guards) : null;
    if (why) throw new QuranInSpeechError(`أُوقف إرسال ${p.label} إلى الصوت المستنسخ: ${why}. الصوت المستنسخ لا يتلو القرآن؛ الآيات تُعرض في بطاقتها وتُتلى بتلاوة معتمدة مستقلة.`);
  }
};

/** نصوص آيات كل حلقات القناة الحالية (لعيّنات الاستوديو التي لا ترتبط بحلقة). */
export const channelQuranGuardTexts = async (): Promise<string[]> => {
  const path = await import("node:path");
  const { channelPaths } = await import("../channel");
  const { listScriptEpisodeDirs } = await import("../script/episodes");
  const { readPlanFile } = await import("../plan/io");
  const episodesDir = channelPaths().episodes;
  const out = new Set<string>();
  for (const dir of await listScriptEpisodeDirs(episodesDir)) {
    const plan = await readPlanFile(path.join(episodesDir, dir, "script.md")).catch(() => null);
    if (plan) for (const t of quranGuardTexts(plan)) out.add(t);
  }
  return [...out];
};
