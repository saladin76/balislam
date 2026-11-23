/**
 * «راجعها علميًا» (عمود «بالإسلام»، عاشرًا/٥؛ قرار المالك ٢٣ نوفمبر): اسم المراجع المتخصص في وصف الحلقة وآخر الفيديو،
 * **بإذنه المكتوب لهذه الحلقة وحدها**. بلا إذن مسجّل لا يظهر شيء في أي مكان (الوصف، ونص النشر، وشاشة النهاية).
 *
 * - المكان: `publish.json` ← `long.reviewer` (ملف الحلقة نفسها، فالإذن لا ينتقل من حلقة إلى أخرى).
 * - الإذن: التاريخ، وما يشمله (النطاق)، وتأكيد المالك أن الإذن المكتوب موجود عنده، ووقت تسجيله.
 * - القاعدة الأولى: هو شخص لا أداة، والاسم يمر على فحص الآثار مع بقية نصوص الحزمة (`kitTraceHits`).
 */
import { findTraces } from "./traces";

export const REVIEWER_LABEL = "راجعها علميًا";

export type ReviewerPermission = {
  /** تاريخ الإذن المكتوب (YYYY-MM-DD) */
  date: string;
  /** ما يشمله الإذن: مثلًا «الأدلة والأحكام في الحلقة» */
  scope: string;
  /** المالك يؤكد أن عنده إذنًا مكتوبًا من المراجع لهذه الحلقة */
  writtenConfirmed: boolean;
  /** وقت تسجيل الإذن في الاستوديو (ISO) */
  recordedAt: string;
};
export type ReviewerCredit = { name: string; permission?: ReviewerPermission };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (s: unknown): s is string => typeof s === "string" && DATE_RE.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** مشكلات سجل المراجع (فارغ = سليم). خانة بلا اسم ولا إذن ليست مشكلة: لا شيء يظهر. */
export const reviewerIssues = (r: ReviewerCredit | undefined | null): string[] => {
  if (!r) return [];
  const out: string[] = [];
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (r.permission) {
    if (!name) out.push("«راجعها علميًا»: الإذن مسجّل بلا اسم المراجع.");
    if (!validDate(r.permission.date)) out.push("«راجعها علميًا»: تاريخ الإذن المكتوب مطلوب (سنة-شهر-يوم).");
    if (!r.permission.scope?.trim()) out.push("«راجعها علميًا»: اذكر ما يشمله الإذن.");
    if (r.permission.writtenConfirmed !== true) out.push("«راجعها علميًا»: أكّد أن الإذن المكتوب عندك لهذه الحلقة.");
  }
  if (name.length > 80) out.push("«راجعها علميًا»: الاسم أطول من ٨٠ حرفًا.");
  for (const h of findTraces(name)) out.push(`«راجعها علميًا»: أثر لأدوات الإنتاج «${h}» (القاعدة الأولى).`);
  return out;
};

/** السطر الذي يُنشر، أو null: لا يظهر إلا باسم وإذن مكتوب مسجّل مكتمل لهذه الحلقة */
export const reviewerLine = (r: ReviewerCredit | undefined | null): string | null => {
  if (!r?.permission || reviewerIssues(r).length) return null;
  return `${REVIEWER_LABEL}: ${r.name.trim()}`;
};

/**
 * يضيف السطر إلى الوصف قبل فقرة الهاشتاجات الأخيرة (أو في آخره). بلا إذن يعود الوصف كما هو حرفًا بحرف.
 * لا يتكرر إن كان المالك كتبه بيده في الوصف.
 */
export const withReviewerLine = (desc: string, r: ReviewerCredit | undefined | null): string => {
  const line = reviewerLine(r);
  if (!line || desc.includes(line)) return desc;
  const paras = desc.split(/\n{2,}/);
  const last = paras.at(-1)?.trim() ?? "";
  if (paras.length > 1 && /^#\S/.test(last)) return [...paras.slice(0, -1), line, paras.at(-1)!].join("\n\n");
  return desc ? `${desc}\n\n${line}` : line;
};

/** معرّف شاشة النهاية في الخطة: c<N>-end، وإلا آخر مشهد في الحلقة */
export const closingSceneId = (plan: { chapters: { scenes: { id: string }[] }[] }): string | null => {
  const scenes = plan.chapters.flatMap((c) => c.scenes);
  return [...scenes].reverse().find((s) => /^c\d+-end$/.test(s.id))?.id ?? scenes.at(-1)?.id ?? null;
};

type CreditPlan = { chapters: { scenes: { id: string; props: Record<string, string> }[] }[] };
/**
 * يضع سطر المراجع في `props.reviewerCredit` لشاشة النهاية وحدها، أو يحذفه (line = null). يعدّل الخطة نفسها ويعيد
 * هل تغيّرت ومعرّف المشهد؛ بلا تغيير لا يمس شيئًا (فلا يُعاد فتح مشهد بلا سبب).
 */
export const withClosingCredit = (plan: CreditPlan, line: string | null): { changed: boolean; sceneId: string | null } => {
  const id = closingSceneId(plan);
  const scene = plan.chapters.flatMap((c) => c.scenes).find((x) => x.id === id);
  if (!scene) return { changed: false, sceneId: null };
  if ((scene.props?.reviewerCredit ?? null) === line) return { changed: false, sceneId: id };
  const { reviewerCredit: _old, ...props } = scene.props ?? {};
  scene.props = line ? { ...props, reviewerCredit: line } : props;
  return { changed: true, sceneId: id };
};
