import type { Plan, PlanScene } from "./types";

/**
 * الخطة المصمَّمة (حادثة دفاتر الزمن 001، ٨ نوفمبر ٢٠٢٦): خطة فيها مشاهد بُنيت يدويًا
 * لا يعرف المولِّد كيف يعيدها. إعادة توليدها من السكريبت تمحو التصميم، فلا تُكتب ضمنيًا أبدًا.
 *
 * الكشف يعمل على الخطط القائمة بلا ترحيل:
 * - علم صريح `designed: true` على الخطة (يُختم من الآن عند الحاجة، ولا يُشترط).
 * - مشهد بقالب «لقطة مصمَّمة» (`horizon-shot` لدفاتر الزمن، `ink-shot` لزبدة الكتب، وأي قالب `*-shot`).
 * - مشهد فيه `props.shot` غير فارغ (لقطات بالإسلام المصمَّمة في `alley-tale` وأخواته).
 * المولِّد (`src/plan/generate.ts`) لا ينتجها إلا إن سمّى السكريبت اللقطة بنفسه (`[مشهد: ink-shot | shot=…]` في
 * زبدة الكتب)، وفي الحالين المشهد مصمَّم بيد بشرية: لا يُعاد توليده ضمنيًا.
 */
export const isDesignedScene = (s: Pick<PlanScene, "template" | "props">): boolean =>
  /-shot$/.test(s.template ?? "") || Boolean(String(s.props?.shot ?? "").trim());

/**
 * KI-053: the closing card (`c<N>-end`) is the generator's own, rebuilt from the channel's outro on every
 * regeneration with its edits kept (src/plan/generate.ts); an outro that is a shot (`ink-shot`, «زبدة الكتب»)
 * does not make the plan «designed».
 */
const isClosingCard = (s: Pick<PlanScene, "id">) => /^c\d+-end$/.test(String(s.id ?? ""));

export const designedScenes = (plan: Pick<Plan, "chapters"> | null | undefined): PlanScene[] =>
  (plan?.chapters ?? []).flatMap((c) => c.scenes ?? []).filter((s) => isDesignedScene(s) && !isClosingCard(s));

export const isDesignedPlan = (plan: (Pick<Plan, "chapters"> & { designed?: boolean }) | null | undefined): boolean =>
  Boolean(plan) && (plan!.designed === true || designedScenes(plan).length > 0);

/** خطأ رفض الكتابة فوق خطة مصمَّمة؛ الخادم يحوّله إلى 409 والأمر إلى رسالة واضحة. */
export class DesignedPlanError extends Error {
  readonly code = "designed-plan";
  constructor(readonly episode: string, readonly designedCount: number) {
    super(`الخطة ${episode} مصمَّمة (${designedCount} مشهدًا مصمَّمًا)؛ إعادة توليدها من السكريبت تمحو التصميم، فلم تُكتب. `
      + "عدّل المشاهد من محرر المشهد، أو أعد التوليد صراحةً مع تأكيد المحو (تُحفظ نسخة احتياطية أولًا).");
    this.name = "DesignedPlanError";
  }
}

const norm = (x: string) => x.replace(/\s+/g, " ").trim();
const sentences = (x: string) => norm(x).split(/(?<=[.؟?!…:؛])\s+/).filter(Boolean);

export type ScriptPlanDivergence = {
  /** مشاهد الخطة التي لم يعد نصها موجودًا في السكريبت كما هو */
  scenes: { id: string; narration: string }[];
  /** نص في السكريبت لا يغطيه أي مشهد في الخطة (بأسطر السكريبت) */
  unplaced: { line: number; text: string }[];
};

/**
 * يقارن نص التعليق في الخطة بما يولّده السكريبت (دون كتابة شيء). مشهد مصمَّم قد يقسم فقرة السكريبت
 * إلى عدة لقطات، أو يضم فقرتين؛ لذلك المطابقة بالاحتواء لا بالتساوي:
 * - نص المشهد يجب أن يوجد متصلًا في نص السكريبت المولَّد.
 * - كل جملة من السكريبت يجب أن توجد في نص الخطة.
 */
export const scriptPlanDivergence = (plan: Plan, fromScript: Plan): ScriptPlanDivergence => {
  const planScenes = plan.chapters.flatMap((c) => c.scenes).filter((s) => s.narration.trim());
  const scriptScenes = fromScript.chapters.flatMap((c) => c.scenes).filter((s) => s.narration.trim());
  const scriptText = scriptScenes.map((s) => norm(s.narration)).join(" ");
  const planText = planScenes.map((s) => norm(s.narration)).join(" ");
  const scenes = planScenes.filter((s) => !scriptText.includes(norm(s.narration))).map((s) => ({ id: s.id, narration: s.narration }));
  const unplaced: ScriptPlanDivergence["unplaced"] = [];
  for (const s of scriptScenes) {
    const missing = sentences(s.narration).filter((t) => !planText.includes(t));
    if (missing.length) unplaced.push({ line: s.line, text: missing.join(" ") });
  }
  return { scenes, unplaced };
};

/** اسم النسخة الاحتياطية قبل أي كتابة صريحة فوق خطة مصمَّمة. */
export const backupNameFor = (date = new Date()) => `plan.backup-${date.toISOString().replace(/[:.]/g, "-")}.json`;

/**
 * M4 (PUT /plan): what a replacement plan would lose of a designed plan — the designed scenes (by id) that
 * are missing from it or no longer designed, and the explicit `designed: true` flag. Editing props,
 * adding or reordering ordinary scenes loses nothing; a plan regenerated from the script loses its shots.
 */
export const designedPlanLoss = (
  current: (Pick<Plan, "chapters"> & { designed?: boolean }) | null | undefined,
  next: (Pick<Plan, "chapters"> & { designed?: boolean }) | null | undefined,
): { scenes: string[]; flag: boolean } => {
  if (!isDesignedPlan(current)) return { scenes: [], flag: false };
  const after = new Map((next?.chapters ?? []).flatMap((c) => c.scenes ?? []).map((s) => [s.id, s]));
  const scenes = designedScenes(current).filter((s) => { const n = after.get(s.id); return !n || !isDesignedScene(n); }).map((s) => s.id);
  return { scenes, flag: current!.designed === true && next?.designed !== true };
};

/** Refusal of PUT /plan replacing a designed plan with one that drops its design (409 in the Studio). */
export class DesignedPlanReplaceError extends Error {
  readonly code = "designed-plan-replace";
  constructor(readonly episode: string, readonly lost: string[]) {
    super(`الخطة ${episode} مصمَّمة، والخطة المرسلة تُسقط ${lost.length || "علم"} ${lost.length ? `مشهدًا مصمَّمًا (${lost.slice(0, 12).join("، ")})` : "التصميم"}؛ لم تُحفظ. `
      + "للاستبدال الصريح أرسلها مع تأكيد المحو ورقم الحلقة مكتوبًا (تُحفظ نسخة احتياطية أولًا).");
    this.name = "DesignedPlanReplaceError";
  }
}
