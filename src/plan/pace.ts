/**
 * إيقاع الحلقة (طلب المالك ١٥ نوفمبر لدفاتر الزمن 001، «نفّذه الآن رغم التجميد»، D143؛ B-004–B-006).
 *
 * `plan.pace = { rate, gap }` محتوى الحلقة، يُختم في خطتها:
 * - rate: الصوت أسرع بهذه النسبة بلا توليد ولا رصيد. التسجيلات المحفوظة لا تُلمس؛ الرندر يشغّلها بمعدل rate
 *   (تمديد زمني يحفظ طبقة الصوت)، وكل توقيت (الكلمات، والمدة، والرأس، وآخر كلام) يُقسم على rate هنا، فيرى كل
 *   مستهلك (المدة، والخط الزمني، والترجمة) الزمن المسموع نفسه.
 * - gap: الصمت بعد آخر كلمة في المشهد (بدل ذيل التصميم ١–١.٥ ث)، فيتصل السرد. خروج المشهد (قلب الصفحة أو
 *   خفوتها) يبدأ قبل نهاية الكلام إن لزم، إلا عند لفظ الجلالة: لا حركة في سكونه، فيُمد الذيل حتى ينتهي الخروج بعده.
 *
 * بلا `pace` لا يتغير شيء (القنوات الأخرى والحلقات القائمة).
 */
import type { Plan } from "./types";
import type { VoiceClip } from "../voice/generate";
import { HZ_META } from "../remotion/dafatir/horizon/meta";
import { LIB_SACRED } from "../remotion/dafatir/lib/meta";

/** أقل زمن يحتاجه الخروج قبل نهاية المشهد (book.tsx: قلب الصفحة من dur-0.95، والخفوت من dur-0.75) */
export const PACE_EXIT_SECONDS = { turn: 0.95, fade: 0.75, none: 0 } as const;
/** هامش سكون لفظ الجلالة كما في sacredWindows */
const SACRED_PAD = 0.25;
const norm = (w: string) => w.replace(/[ً-ْٰـ]/g, "").replace(/[ىی]/g, "ي").replace(/[أإآ]/g, "ا").replace(/[.,،؛:!؟?»«]/g, "");

export type Pace = { rate: number; gap: number };

export const validPace = (p: unknown): p is Pace =>
  Boolean(p && typeof p === "object" && Number.isFinite((p as Pace).rate) && (p as Pace).rate >= 0.8 && (p as Pace).rate <= 1.3 &&
    Number.isFinite((p as Pace).gap) && (p as Pace).gap >= 0.2 && (p as Pace).gap <= 2);

/** مفتاح الإيقاع في بصمة مدخلات المشهد: تغييره يعيد فتح مشاهد الحلقة للمراجعة */
export const paceKey = (plan: Pick<Plan, "pace">): string => (validPace(plan.pace) ? `${plan.pace.rate}/${plan.pace.gap}` : "none");

export const pacedVoice = <V extends Record<string, VoiceClip>>(voice: V, plan: Plan): V => {
  if (!validPace(plan.pace)) return voice;
  const { rate: r, gap } = plan.pace;
  const shots = new Map(plan.chapters.flatMap((c) => c.scenes).map((s) => [s.id, String((s.props as Record<string, unknown>)?.shot ?? "")]));
  const out: Record<string, VoiceClip> = {};
  for (const [id, c] of Object.entries(voice)) {
    const words = c.words.map((w) => ({ ...w, start: w.start / r, end: w.end / r }));
    const next: VoiceClip = { ...c, words, duration: c.duration / r, rate: r };
    if (c.timing) {
      const speechEnd = c.timing.speechEnd / r;
      const exit = HZ_META[shots.get(id) ?? ""]?.exit ?? "none";
      const sacred = words.filter((w) => LIB_SACRED.test(norm(w.word))).map((w) => w.end + SACRED_PAD);
      const lastSacred = sacred.length ? Math.max(...sacred) : -Infinity;
      // لا يطول الذيل عن تصميمه بعد التسريع، إلا ليتم الخروج بعد سكون لفظ الجلالة
      const sacredTail = lastSacred + PACE_EXIT_SECONDS[exit] - speechEnd;
      const seconds = Math.max(Math.min(c.timing.seconds / r, speechEnd + gap), speechEnd + sacredTail);
      next.timing = { ...c.timing, pre: c.timing.pre / r, speechStart: c.timing.speechStart / r, speechEnd, seconds, tail: seconds - speechEnd };
    }
    out[id] = next;
  }
  return out as V;
};
