/**
 * صيغة عنوان كل قناة (المرحلة ٢ البند ٢؛ اقترحها Claude بطلب المالك ٢١ نوفمبر «اقترح انت»، إذ لا «وثيقة رؤية» في
 * المستودع). تنبيه في «حزمة الانتشار» لا يمنع الحزمة، فيبقى للمالك أن يخالفها لحلقة بعينها. كلها ≤ ٦٠ حرفًا والموضوع
 * في أول ٤٠ (TITLE_MAX في quality.ts)، وتسمح بلاحقة السلسلة « | ‹السلسلة›» بعدها.
 *
 * - بالإسلام «سؤال من حياة المشاهد»: القناة تقرأ الحياة بعين الإسلام، فالعنوان سؤال يسأله المشاهد نفسه عن يومه
 *   («كيف تعرف أنك على حق؟»)، لا عنوان درس ولا اسم باب.
 * - دفاتر الزمن «الموضوع: الزاوية»: التاريخ قصة، فالعنوان يبدأ بالاسم الذي يبحث عنه الناس (شخصية، أمة، مدينة، حدث)
 *   ثم نقطتان ثم ما يجعله قصة («آدم عليه السلام: كيف بدأت قصة الإنسان؟»).
 * - زبدة الكتب «الفكرة | الكتاب»: الفكرة التي يحلها الكتاب أولًا (ما يبحث عنه المشاهد)، ثم اسم الكتاب بعد «|»
 *   («لماذا نصلي ولا نشعر؟ | أول مرة أصلي»).
 */
import { normalizeArabic } from "../script/quranMeta";

export type TitleFormula = { name: string; pattern: string; example: string; problem: (title: string, ctx: { book?: string; series?: string }) => string | null };

const n = (s: string) => normalizeArabic(s).replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
/** العنوان بلا لاحقة السلسلة « | ‹السلسلة›» (حين يُعرف اسمها). */
const core = (t: string, series?: string) => {
  const parts = t.split("|").map((p) => p.trim());
  return series && parts.length > 1 && n(parts.at(-1)!).includes(n(series)) ? parts.slice(0, -1).join(" | ") : t.trim();
};

export const TITLE_FORMULAS: Record<string, TitleFormula> = {
  balislam: {
    name: "سؤال من حياة المشاهد",
    pattern: "‹سؤال يسأله المشاهد عن يومه›؟",
    example: "كيف تعرف أنك على حق؟",
    problem: (t, c) => (/[؟?]\s*$/.test(core(t, c.series)) ? null : "عنوان «بالإسلام» سؤال من حياة المشاهد ينتهي بـ«؟»."),
  },
  "dafatir-alzaman": {
    name: "الموضوع: الزاوية",
    pattern: "‹الشخصية أو الحدث›: ‹ما الذي يجعله قصة›",
    example: "آدم عليه السلام: كيف بدأت قصة الإنسان؟",
    problem: (t, c) => {
      const m = core(t, c.series).match(/^([^:：|]+)[:：]\s*\S/);
      if (!m) return "عنوان «دفاتر الزمن» يبدأ بالموضوع ثم «:» ثم الزاوية.";
      return Array.from(m[1]!.trim()).length > 30 ? "الموضوع قبل «:» أطول من ٣٠ حرفًا؛ الاسم الذي يُبحث عنه أولًا ثم الزاوية." : null;
    },
  },
  "zubdat-alkutub": {
    name: "الفكرة | الكتاب",
    pattern: "‹الفكرة التي يحلها الكتاب› | ‹اسم الكتاب›",
    example: "لماذا نصلي ولا نشعر؟ | أول مرة أصلي",
    problem: (t, c) => {
      const parts = t.split("|").map((p) => p.trim()).filter(Boolean);
      if (parts.length < 2) return "عنوان «زبدة الكتب» الفكرة أولًا ثم «|» ثم اسم الكتاب.";
      if (c.book && !parts.slice(1).some((p) => n(p).includes(n(c.book!)) || n(c.book!).includes(n(p)))) return `اسم الكتاب «${c.book}» بعد «|».`;
      return null;
    },
  },
};

export const formulaProblem = (channel: string | undefined, title: string, ctx: { book?: string; series?: string } = {}) =>
  channel && TITLE_FORMULAS[channel] && title.trim() ? TITLE_FORMULAS[channel]!.problem(title, ctx) : null;
