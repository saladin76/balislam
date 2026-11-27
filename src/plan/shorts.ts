/**
 * مقاطع الشورتس/الريلز لا تُشتق من عدد الأقسام (D82، اعتمده صاحب المشروع ١١ نوفمبر (D83)؛ src/script/divisions.ts):
 * - plan.shorts موجودة (ولو فارغة): هي المقاطع وحدها، كل مقطع من مشهد إلى مشهد بترتيب الحلقة، أو أجزاء مرتبة
 *   من مشاهد غير متتالية من الحلقة نفسها (`segments`، D241) توصل كما هي بلا جملة ولا صوت جديد.
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
  /** D241: مشاهد كل جزء بالترتيب (جزء واحد للمقطع المتصل)؛ sceneIds = الأجزاء موصولة */
  parts?: string[][];
  /** D241: أول جملة خطاف وليست سؤالًا */
  hook?: "line";
  /** D241: آخر جملة سؤال للتعليقات مقصود */
  closingQuestion?: "comment";
};

/** أجزاء شورت من الخطة: `segments` إن وُجدت، وإلا الجزء الواحد من `from` إلى `to` */
export const shortParts = (x: Pick<PlanShort, "from" | "to" | "segments">): { from: string; to: string }[] =>
  Array.isArray(x.segments) && x.segments.length ? x.segments : [{ from: x.from, to: x.to }];

export type ShortSelection = { source: "plan" | "divisions" | "none"; segments: ShortSegment[]; issues: string[] };

const flatScenes = (plan: Pick<Plan, "chapters">): PlanScene[] =>
  plan.chapters.flatMap((c) => c.scenes).filter((s) => s.template !== "end-screen");

/** كل المقاطع بلا حد لعددها (D152، طلب المالك ١٦ نوفمبر: «غير محدود»)؛ القواعد على كل شورت وحده كما هي. */
export const shortSegments = (plan: Pick<Plan, "chapters" | "shorts">): ShortSelection => {
  const issues: string[] = [];
  if (Array.isArray(plan.shorts)) {
    const all = flatScenes(plan);
    const at = new Map(all.map((s, i) => [s.id, i]));
    const segments: ShortSegment[] = [];
    plan.shorts.forEach((x: PlanShort, k) => {
      const parts: string[][] = [];
      for (const p of shortParts(x)) {
        const a = at.get(p.from);
        const b = at.get(p.to);
        if (a === undefined || b === undefined) return void issues.push(`الشورت ${k + 1}: المشهد «${a === undefined ? p.from : p.to}» غير موجود في الخطة.`);
        if (a > b) return void issues.push(`الشورت ${k + 1}: «${p.from}» بعد «${p.to}» في ترتيب الحلقة.`);
        parts.push(all.slice(a, b + 1).map((s) => s.id));
      }
      const sceneIds = parts.flat();
      if (new Set(sceneIds).size !== sceneIds.length) return void issues.push(`الشورت ${k + 1}: مشهد مكرر في أجزائه.`);
      segments.push({ n: segments.length + 1, title: (x.title ?? "").trim(), sceneIds, ...(x.segments?.length ? { parts } : {}),
        ...(x.hook === "line" ? { hook: "line" as const } : {}), ...(x.closingQuestion === "comment" ? { closingQuestion: "comment" as const } : {}) });
    });
    return { source: "plan", segments, issues };
  }
  if (plan.chapters.length >= 2) {
    const segments = plan.chapters.map((c, i) => ({
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
  // بترتيب المقطع نفسه (D241: أجزاء غير متتالية توصل بترتيبها)؛ للمقطع المتصل هو ترتيب الحلقة
  const byId = new Map(plan.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s]));
  const scenes = [...new Set(seg.sceneIds)].map((id) => byId.get(id)).filter((s): s is PlanScene => Boolean(s));
  return { plan: { ...plan, chapters: [{ number: 1, title: "", scenes }] }, chapter: 1 };
};

/* ── اختيار المالك لمقاطع الشورتس من الاستوديو (D83): «النشر ← الشورتس والريلز ← مقاطع الشورتس» ── */

/*
 * لا حد لعدد الشورتس في الحلقة (D152، طلب المالك ١٦ نوفمبر: «خلي عدد الشورتس او الريلز داخل الاستديو غير محدود»).
 * كان هنا SHORTS_MAX = 6 (شورت يومي لأسبوع الحلقة). الأرقام في أسماء الملفات بلا أصفار (`-short-12.mp4`)
 * وتُرتّب ترتيبًا عدديًا بـ shortFileNumber؛ والصناعة بالترتيب واحدًا بعد واحد في المهمة نفسها.
 */

/** رقم الشورت من اسم ملفه (`<id>-short-<n>.mp4` أو ترجمته)، أو null */
export const shortFileNumber = (name: string): number | null => {
  const m = name.match(/-short-(\d+)\.(?:mp4|[a-z]{2,3}\.srt)$/);
  return m ? Number(m[1]) : null;
};
/** ملفات الشورتس (mp4) مرتبة بأرقامها: 2 قبل 10 */
export const sortShortFiles = <T extends { name: string } | string>(files: readonly T[]): T[] =>
  files
    .filter((f) => /-short-\d+\.mp4$/.test(typeof f === "string" ? f : f.name))
    .sort((a, b) => shortFileNumber(typeof a === "string" ? a : a.name)! - shortFileNumber(typeof b === "string" ? b : b.name)!);
/** عنوان المقطع للنشر وحده: سطر واحد قصير */
export const SHORT_TITLE_MAX = 100;

/** مشهد كما يراه المالك في محدد المقاطع: رقمه في الحلقة، قسمه، نصه، ومدته التقريبية */
export type ShortsScene = { id: string; n: number; division: number; divisionTitle: string; text: string; seconds: number; spoken: boolean };

/** نص المشهد للمعاينة: التعليق، أو وصف قصير لما لا يُنطق (بطاقة آية، مشهد صامت) */
export const shortsSceneText = (s: Pick<PlanScene, "narration" | "template" | "props">): string => {
  const n = s.narration.trim();
  if (n) return n;
  if (s.template === "verse-card") return `بطاقة آية${s.props?.reference ? `: ${s.props.reference}` : ""}`;
  if (s.template === "hadith-card") return `بطاقة حديث${s.props?.reference ? `: ${s.props.reference}` : ""}`;
  return "مشهد بلا تعليق";
};

/** مشاهد الحلقة القابلة للقص (بلا شاشة النهاية) مرقّمة كما يرقّمها الاستوديو (ترتيب كل مشاهد الخطة) */
export const shortsScenes = (plan: Pick<Plan, "chapters">, secondsOf: (s: PlanScene) => number): ShortsScene[] => {
  const order = plan.chapters.flatMap((c) => c.scenes.map((s) => s.id));
  return plan.chapters.flatMap((c) => c.scenes.filter((s) => s.template !== "end-screen").map((s) => ({
    id: s.id, n: order.indexOf(s.id) + 1, division: c.number, divisionTitle: c.title,
    text: shortsSceneText(s), seconds: Math.round(secondsOf(s) * 10) / 10, spoken: Boolean(s.narration.trim()),
  })));
};

/** مشاهد مقطع واحد من قائمة المشاهد (فارغ إن لم يصح المقطع) */
export const shortRange = (scenes: readonly Pick<ShortsScene, "id">[], from: string, to: string) => {
  const a = scenes.findIndex((s) => s.id === from);
  const b = scenes.findIndex((s) => s.id === to);
  return a < 0 || b < 0 || a > b ? [] : scenes.slice(a, b + 1);
};

/**
 * ما يقترحه المحدد حين لم يُحفظ اختيار: مقاطع الأقسام كما يصنعها المحرك اليوم، أو لا شيء للنص المتصل.
 * بلا عنوان: عنوان القسم بيانات إنتاج (D82)، فلا يصير عنوانًا منشورًا إلا إن كتبه المالك بنفسه.
 */
export const suggestedShorts = (plan: Pick<Plan, "chapters" | "shorts">): PlanShort[] => {
  if (Array.isArray(plan.shorts)) return plan.shorts.map((x) => ({ ...x }));
  const pick = shortSegments({ chapters: plan.chapters });
  return pick.segments.filter((s) => s.sceneIds.length).map((s) => ({ from: s.sceneIds[0]!, to: s.sceneIds.at(-1)! }));
};

export type ShortsInputCheck = { shorts: PlanShort[]; errors: string[]; warnings: string[] };

/**
 * يفحص ما يرسله الاستوديو قبل كتابته في `plan.shorts`. لا يُصلح شيئًا ضمنيًا: أي خطأ يرفض الحفظ كله.
 * - قائمة (ولو فارغة) من {from, to, title?}، بلا حد لعددها (D152)، أو بأجزاء مرتبة `segments: [{from, to}…]` لا تتداخل
 *   (D241)، و`hook: "line"` و`closingQuestion: "comment"` اختياريان؛
 * - المشهدان موجودان في الخطة وليسا شاشة النهاية، والبداية قبل النهاية أو هي (يعبر الأقسام بلا قيد)؛
 * - العنوان سطر واحد حتى SHORT_TITLE_MAX حرفًا وبلا أثر لأدوات الإنتاج (القاعدة الأولى: نص منشور)؛
 * - لا مقطعان متطابقان. والتداخل بين مقطعين تنبيه لا خطأ.
 * `findTraces` يُمرَّر من الخادم (src/package/traces.ts) حتى تبقى هذه الوحدة خفيفة للصفحة.
 */
export const checkShortsInput = (plan: Pick<Plan, "chapters">, input: unknown, findTraces: (text: string) => string[] = () => []): ShortsInputCheck => {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!Array.isArray(input)) return { shorts: [], errors: ["المقاطع يجب أن تكون قائمة."], warnings };
  const all = flatScenes(plan);
  const at = new Map(all.map((s, i) => [s.id, i]));
  const shorts: PlanShort[] = [];
  const ranges: { key: string; idx: [number, number][] }[] = [];
  input.forEach((raw, k) => {
    const label = `الشورت ${k + 1}`;
    const x = raw as { from?: unknown; to?: unknown; title?: unknown; segments?: unknown; hook?: unknown; closingQuestion?: unknown } | null;
    if (!x || typeof x !== "object") return void errors.push(`${label}: اختر مشهد البداية ومشهد النهاية.`);
    // D241: أجزاء مرتبة من مشاهد غير متتالية، أو جزء واحد من from إلى to
    const hasSegments = x.segments !== undefined;
    if (hasSegments && (!Array.isArray(x.segments) || !x.segments.length)) return void errors.push(`${label}: الأجزاء قائمة فيها جزء واحد على الأقل.`);
    const rawParts = (hasSegments ? (x.segments as unknown[]) : [x]) as ({ from?: unknown; to?: unknown } | null)[];
    const parts: { from: string; to: string }[] = [];
    const idx: [number, number][] = [];
    for (const [j, p] of rawParts.entries()) {
      const pl = hasSegments && rawParts.length > 1 ? `${label}، الجزء ${j + 1}` : label;
      if (!p || typeof p !== "object" || typeof p.from !== "string" || typeof p.to !== "string")
        return void errors.push(`${pl}: اختر مشهد البداية ومشهد النهاية.`);
      const a = at.get(p.from);
      const b = at.get(p.to);
      if (a === undefined) return void errors.push(`${pl}: مشهد البداية «${p.from}» غير موجود في الخطة.`);
      if (b === undefined) return void errors.push(`${pl}: مشهد النهاية «${p.to}» غير موجود في الخطة.`);
      if (a > b) return void errors.push(`${pl}: مشهد البداية «${p.from}» بعد مشهد النهاية «${p.to}».`);
      if (idx.some(([p0, q0]) => a <= q0 && p0 <= b)) return void errors.push(`${pl}: يتداخل مع جزء قبله في الشورت نفسه.`);
      idx.push([a, b]);
      parts.push({ from: p.from, to: p.to });
    }
    if (x.hook !== undefined && x.hook !== "line") return void errors.push(`${label}: الخطاف "line" أو لا شيء.`);
    if (x.closingQuestion !== undefined && x.closingQuestion !== "comment") return void errors.push(`${label}: سؤال الختام "comment" أو لا شيء.`);
    if (x.title !== undefined && typeof x.title !== "string") return void errors.push(`${label}: العنوان نص.`);
    const title = String(x.title ?? "").replace(/\s+/g, " ").trim();
    if (/[\r\n]/.test(String(x.title ?? "").trim())) errors.push(`${label}: العنوان سطر واحد.`);
    if (title.length > SHORT_TITLE_MAX) errors.push(`${label}: العنوان أطول من ${SHORT_TITLE_MAX} حرفًا.`);
    const hits = title ? findTraces(title) : [];
    if (hits.length) errors.push(`${label}: العنوان يكشف أدوات الإنتاج (${hits.join("، ")})؛ أزله.`);
    const key = idx.map(([p0, q0]) => `${p0}-${q0}`).join(",");
    if (ranges.some((r) => r.key === key)) errors.push(`${label}: المقطع نفسه مكرر.`);
    else if (ranges.some((r) => r.idx.some(([p0, q0]) => idx.some(([p1, q1]) => p1 <= q0 && p0 <= q1)))) warnings.push(`${label} يتداخل مع شورت قبله (مشاهد مشتركة).`);
    ranges.push({ key, idx });
    shorts.push({ from: parts[0]!.from, to: parts.at(-1)!.to, ...(title ? { title } : {}),
      ...(hasSegments && parts.length > 1 ? { segments: parts } : {}),
      ...(x.hook === "line" ? { hook: "line" as const } : {}), ...(x.closingQuestion === "comment" ? { closingQuestion: "comment" as const } : {}) });
  });
  return { shorts, errors, warnings };
};
