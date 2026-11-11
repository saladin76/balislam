/**
 * مقاطع الشورتس/الريلز لا تُشتق من عدد الأقسام (قرار بانتظار موافقة صاحب المشروع، src/script/divisions.ts):
 * - plan.shorts موجودة (ولو فارغة): هي المقاطع وحدها، كل مقطع من مشهد إلى مشهد بترتيب الحلقة.
 * - غيابها في خطة قديمة فيها قسمان فأكثر: شورت لكل قسم بالترتيب كما كان حرفيًا (توافق مع ما قبل القرار).
 * - غيابها في نص متصل (قسم واحد): لا شورتس حتى يختار المالك مقاطعها؛ لا تُصنع الحلقة كلها 9:16 بدلها.
 * شاشة النهاية لا تدخل أي شورت.
 */
import type { Plan, PlanScene, PlanShort } from "./types";

export type ShortSegment = {
  /** ترتيب الشورت (1…) */
  n: number;
  /** عنوان للنشر وحده (لا يظهر على الشاشة) */
  title: string;
  sceneIds: string[];
  /** شورت قديم بقسم كامل: رقم القسم (يُرندر كما كان) */
  chapter?: number;
};

export type ShortSelection = { source: "plan" | "divisions" | "none"; segments: ShortSegment[]; issues: string[] };

const flatScenes = (plan: Pick<Plan, "chapters">): PlanScene[] =>
  plan.chapters.flatMap((c) => c.scenes).filter((s) => s.template !== "end-screen");

export const shortSegments = (plan: Pick<Plan, "chapters" | "shorts">, max = 6): ShortSelection => {
  const issues: string[] = [];
  if (Array.isArray(plan.shorts)) {
    const all = flatScenes(plan);
    const at = new Map(all.map((s, i) => [s.id, i]));
    const segments: ShortSegment[] = [];
    plan.shorts.forEach((x: PlanShort, k) => {
      const a = at.get(x.from);
      const b = at.get(x.to);
      if (a === undefined || b === undefined) return void issues.push(`الشورت ${k + 1}: المشهد «${a === undefined ? x.from : x.to}» غير موجود في الخطة.`);
      if (a > b) return void issues.push(`الشورت ${k + 1}: «${x.from}» بعد «${x.to}» في ترتيب الحلقة.`);
      if (segments.length >= max) return;
      segments.push({ n: segments.length + 1, title: (x.title ?? "").trim(), sceneIds: all.slice(a, b + 1).map((s) => s.id) });
    });
    return { source: "plan", segments, issues };
  }
  if (plan.chapters.length >= 2) {
    const segments = plan.chapters.slice(0, max).map((c, i) => ({
      n: i + 1, title: c.title, chapter: c.number,
      sceneIds: c.scenes.filter((s) => s.template !== "end-screen").map((s) => s.id),
    }));
    return { source: "divisions", segments, issues };
  }
  issues.push("لا مقاطع شورتس: الحلقة نص متصل؛ اختر مقاطعها في الخطة (plan.shorts: من مشهد إلى مشهد).");
  return { source: "none", segments: [], issues };
};

/**
 * الخطة التي يُرندر منها شورت واحد ورقم قسمه: للشورت القديم الخطة نفسها وقسمه (السلوك السابق حرفيًا)،
 * وللمقطع المختار خطة بقسم واحد بلا عنوان فيه مشاهد المقطع وحدها.
 */
export const segmentPlan = <P extends Plan>(plan: P, seg: ShortSegment): { plan: P; chapter: number } => {
  if (seg.chapter !== undefined) return { plan, chapter: seg.chapter };
  const ids = new Set(seg.sceneIds);
  const scenes = plan.chapters.flatMap((c) => c.scenes).filter((s) => ids.has(s.id));
  return { plan: { ...plan, chapters: [{ number: 1, title: "", scenes }] }, chapter: 1 };
};
