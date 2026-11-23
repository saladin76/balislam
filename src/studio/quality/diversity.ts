/**
 * مقياس التنوع (خطة «احترافية بلا مثيل»، قرار المالك ٣، المرحلة A): القوالب بلا تكرار.
 * - لا مشهدان متتاليان في الفيديو نفسه بلقطة واحدة أو بتكوين واحد.
 * - عدد التكوينات المختلفة في الحلقة لا يقل عن حد أدنى.
 *
 * دالة خالصة على الخطة (لا رندر ولا ملفات)، يستعملها تيرمينال C عند بناء القوالب وبطاقة الجودة عند الحكم.
 * «اللقطة» = حركة الكاميرا وتأطيرها، و«التكوين» = ترتيب ما على الشاشة (المكان، من فيها، وضع اللوح…).
 * اللقطة المصمَّمة (props.shot) تحدد التأطير والتكوين معًا، فمفتاحاها واحد: اسمها مع حقول وضعها.
 * الحقول التي تصنع اللقطة والتكوين لكل قالب في COMPOSITION_FIELDS؛ القالب الجديد يضيف سطره هنا
 * (أو يمرّر حقوله في opts.fields) وإلا تُستعمل الحقول العامة DEFAULT_FIELDS.
 */
import type { Plan, PlanScene } from "../../plan/types";

export type CompositionFields = {
  /** حقول حركة الكاميرا والتأطير */
  shot: readonly string[];
  /** حقول ترتيب الشاشة */
  layout: readonly string[];
};

export const DEFAULT_FIELDS: CompositionFields = { shot: ["camera", "cameraMode"], layout: ["layout", "place", "stage", "mode", "kind", "side"] };

export const COMPOSITION_FIELDS: Record<string, CompositionFields> = {
  // بالإسلام: حركة الكاميرا على المكان نفسه لقطة، والمكان ومن معه في المشهد تكوين (الوقت واللون وحدهما لا يغيّرانه)
  "alley-tale": { shot: ["place", "camera", "cameraMode"], layout: ["place", "cast"] },
  "kinetic-text": { shot: [], layout: ["stage", "element"] },
  // لوح الدعاء يُبنى على مراحل: كل مرحلة ظاهرة (shown) تكوين مختلف
  "dua-board": { shot: [], layout: ["shown"] },
  // دفاتر الزمن: كل لقطة مصمَّمة، ووضعها (mode/kind) يغيّر تكوينها
  "horizon-shot": { shot: [], layout: ["mode", "kind"] },
  "ink-shot": { shot: [], layout: ["mode", "kind"] },
  // مكتب الرحّالة: كل لقطة (الإسطرلاب، الخريطة، المدينة، الوثيقة، المكتب) تكوين، والقطعة المخصوصة تكوين
  "rahhala-desk": { shot: [], layout: ["shot", "city"] },
};

/**
 * قوالب السكون المقصود (src/render/stillnessSpans.ts): تتابع آيتين، أو حديثين، أو مراحل لوح الدعاء الواحد
 * ليس تكرارًا قالبيًا؛ لا تُفرض عليها حركة ولا تنويع (التوقير)، فتُذكر ولا تُعد مخالفة.
 */
export const SACRED_TEMPLATES: ReadonlySet<string> = new Set(["verse-card", "hadith-card", "dua-board"]);
/** شاشة الختام ثابتة بطبيعتها: لا تُعد تكوينًا ولا تدخل في التتابع */
export const CLOSING_TEMPLATES: ReadonlySet<string> = new Set(["end-screen"]);

/**
 * الحد الأدنى للتكوينات المختلفة: مؤقت حتى يحدده المالك (الخطة تقول «حد أدنى» بلا رقم).
 * نصف مشاهد الفيديو على الأقل، ولا أقل من ٤ (أو عدد المشاهد إن كانت أقل).
 */
export const MIN_DISTINCT_SHARE = 0.5;
export const MIN_DISTINCT_FLOOR = 4;
export const minDistinctFor = (scenes: number) => Math.min(scenes, Math.max(MIN_DISTINCT_FLOOR, Math.ceil(scenes * MIN_DISTINCT_SHARE)));

const val = (s: PlanScene, k: string) => String(s.props?.[k] ?? "").trim();
const part = (s: PlanScene, keys: readonly string[]) => keys.map((k) => `${k}=${val(s, k)}`).filter((x) => !x.endsWith("=")).join("|");
const fieldsFor = (template: string, extra?: Record<string, CompositionFields>) => extra?.[template] ?? COMPOSITION_FIELDS[template] ?? DEFAULT_FIELDS;

export type SceneComposition = { id: string; template: string; shot: string; composition: string };

export const sceneComposition = (s: PlanScene, extra?: Record<string, CompositionFields>): SceneComposition => {
  const f = fieldsFor(s.template, extra);
  const designed = val(s, "shot");
  if (designed) {
    const key = [`${s.template}#${designed}`, part(s, f.layout)].filter(Boolean).join("|");
    return { id: s.id, template: s.template, shot: key, composition: key };
  }
  const composition = [s.template, part(s, f.layout)].filter(Boolean).join("|");
  // قالب بلا حقول لقطة: تأطيره من تكوينه
  return { id: s.id, template: s.template, shot: f.shot.length ? [s.template, part(s, f.shot)].filter(Boolean).join("|") : composition, composition };
};

export type DiversityRepeat = { a: string; b: string; same: ("shot" | "composition")[]; key: string };
export type DiversityReport = {
  /** مشاهد الفيديو المحسوبة (بلا شاشة الختام) */
  scenes: number;
  distinct: number;
  minDistinct: number;
  repeats: DiversityRepeat[];
  /** تتابع آيات أو أحاديث: يُذكر ولا يُعد مخالفة */
  sacredPairs: { a: string; b: string }[];
  ok: boolean;
  compositions: SceneComposition[];
};

export type DiversityOptions = {
  /** حقول قوالب جديدة لم تُضف بعد إلى COMPOSITION_FIELDS */
  fields?: Record<string, CompositionFields>;
  /** فصل واحد (شورت) بدل الحلقة كلها */
  chapter?: number;
  /** مشاهد بعينها بالترتيب (مقطع شورت يعبر الفصول) */
  sceneIds?: readonly string[];
};

/** مشاهد الفيديو بترتيب ظهورها */
export const videoScenes = (plan: Plan, opts: Pick<DiversityOptions, "chapter" | "sceneIds"> = {}): PlanScene[] => {
  const all = plan.chapters.filter((c) => !opts.chapter || c.number === opts.chapter).flatMap((c) => c.scenes);
  if (!opts.sceneIds) return all;
  const byId = new Map(all.map((s) => [s.id, s]));
  return opts.sceneIds.map((id) => byId.get(id)).filter((s): s is PlanScene => Boolean(s));
};

export const measureDiversity = (plan: Plan, opts: DiversityOptions = {}): DiversityReport => {
  const scenes = videoScenes(plan, opts).filter((s) => !CLOSING_TEMPLATES.has(s.template));
  const comps = scenes.map((s) => sceneComposition(s, opts.fields));
  const repeats: DiversityRepeat[] = [];
  const sacredPairs: { a: string; b: string }[] = [];
  for (let i = 1; i < comps.length; i++) {
    const p = comps[i - 1]!;
    const c = comps[i]!;
    const same: ("shot" | "composition")[] = [];
    if (p.shot === c.shot) same.push("shot");
    if (p.composition === c.composition) same.push("composition");
    if (!same.length) continue;
    if (SACRED_TEMPLATES.has(p.template) && SACRED_TEMPLATES.has(c.template)) sacredPairs.push({ a: p.id, b: c.id });
    else repeats.push({ a: p.id, b: c.id, same, key: same.includes("composition") ? c.composition : c.shot });
  }
  const distinct = new Set(comps.map((c) => c.composition)).size;
  const minDistinct = minDistinctFor(comps.length);
  return { scenes: comps.length, distinct, minDistinct, repeats, sacredPairs, ok: !repeats.length && distinct >= minDistinct, compositions: comps };
};

const sameAr = (same: DiversityRepeat["same"]) => same.length === 2 ? "اللقطة والتكوين نفساهما" : same[0] === "shot" ? "اللقطة نفسها" : "التكوين نفسه";

export const diversitySummary = (r: DiversityReport): string => {
  const head = `التنوع: تكوينات مختلفة ${r.distinct} من ${r.scenes} مشهدًا (الحد الأدنى ${r.minDistinct}) · ${r.repeats.length ? `تكرارات متتالية: ${r.repeats.length}` : "لا تكرار متتالٍ"}`;
  const lines = r.repeats.map((x) => `- ${x.a} ← ${x.b}: ${sameAr(x.same)} (${x.key})`);
  return [head, ...lines].join("\n");
};
