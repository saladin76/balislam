/**
 * لوحة الستوري بورد المرئية للحلقة كاملة (عقد الإنتاج: Storyboard ← Tone ← Voice ← Motion، ٦ نوفمبر):
 * لكل مشهد بترتيبه: المعرّف والفصل، والتكوين والعناصر والشخصيات، والكاميرا، والانتقال، والنصوص والكابشن،
 * والنص المنطوق، والمدة التقريبية، والإحساس المقترح، والقيود الشرعية والفنية، وملاحظات المراجعة.
 * هذا الجزء خالص (بلا رندر ولا ملفات): يبني صفوف اللوحة من الخطة وملف الملاحظات التحريري.
 * اللوحة ليست اعتمادًا: الاعتماد قرار صاحب القناة في storyboard.json بعد مراجعتها بصريًا.
 */
import type { Plan, PlanScene } from "./types";
import { templateById } from "./templates";
import { shotElements, shotFrame, shotKind, shotText } from "./storyboardView";
import { cueNamesAr, isSacredSentence, parseCues } from "./sceneCues";
import { SHOTS } from "../remotion/illus/shots";
import { VERSE_PLACEHOLDER } from "./quranText";

/** ملف تحريري بجوار الحلقة (storyboard/board-notes.json): الإحساس المقترح لكل فصل ومشهد، وملاحظات المراجعة السابقة */
export type BoardNotes = {
  /** الإحساس المقترح لكل فصل (رقم الفصل) */
  chapterFeeling?: Record<string, string>;
  /** إحساس مشهد بعينه إن اختلف عن فصله */
  sceneFeeling?: Record<string, string>;
  /** ملاحظات مراجعة سابقة تُدرج في صف المشهد */
  sceneNotes?: Record<string, string[]>;
  /** إطارات بعينها (داخل المشهد) بدل اللحظتين الافتراضيتين، مثل حدث متعدد الزوايا */
  keyframes?: Record<string, number[]>;
  /** مشاهد تُعرض كحدث واحد (معرّف أول مشهد ← كل المعرّفات) */
  events?: Record<string, { title: string; ids: string[] }>;
};

export type BoardScene = {
  id: string;
  chapter: number;
  chapterTitle: string;
  /** ترتيبه في الحلقة (من 1) */
  order: number;
  template: string;
  kind: string;
  narration: string;
  /** أول إطار للمشهد في الحلقة بلا افتتاحية، ومدته بالإطارات (تقديرية بلا صوت) */
  start: number;
  frames: number;
  seconds: number;
  /** إطارات اللقطات داخل المشهد */
  shots: number[];
  composition: string[];
  camera: string;
  transition: string;
  onScreen: string;
  captions: string;
  feeling: string;
  constraints: string[];
  issues: string[];
  notes: string[];
  event?: string;
};

const fieldLabel = (template: string, key: string, value: string) => {
  const f = templateById(template)?.fields.find((x) => x.key === key);
  const opt = f?.options?.find((o) => o.value === value);
  return { label: f?.label ?? key, value: opt?.label ?? value };
};

/** خصائص المشهد المعبّأة بأسماء حقولها العربية (ما عدا ما يُعرض في خانة أخرى) */
const describeProps = (s: PlanScene, skip: string[]) =>
  Object.entries(s.props ?? {})
    .filter(([k, v]) => typeof v === "string" && v.trim() && !skip.includes(k))
    .map(([k, v]) => {
      const { label, value } = fieldLabel(s.template, k, v as string);
      return `${label}: ${value.replace(/\s*\n\s*/g, " · ")}`;
    });

const CAMERA_KEYS = ["camera", "cameraMode", "cameraPlan", "cameraPlanPortrait", "framing"];
const TEXT_KEYS = ["text", "dua", "step", "prompt", "emphasis", "caption", "title", "question"];

export const describeCamera = (s: PlanScene): string => {
  const shot = s.props.shot ? SHOTS[s.props.shot] : undefined;
  if (shot) return `لقطة مصمَّمة «${shot.nameAr}»: كاميرا خاصة بها مضبوطة على كلمات الجملة، بتأطير مستقل للعمودي`;
  const parts = CAMERA_KEYS.filter((k) => s.props[k]?.trim()).map((k) => {
    const { label, value } = fieldLabel(s.template, k, s.props[k]!);
    return `${label}: ${value.replace(/\s*\n\s*/g, " · ")}`;
  });
  if (parts.length) return parts.join(" · ");
  if (s.template === "verse-card") return "ثابتة (سكون مقصود)";
  return "حركة القالب الافتراضية";
};

export const describeTransition = (s: PlanScene, prev: PlanScene | undefined, chapterStart: boolean): string => {
  if (!prev) return "بداية الحلقة";
  const t = s.transition?.trim();
  const base = t ? `انتقال «${t}»` : "تلاشٍ قصير (الافتراضي)";
  return chapterStart ? `${base} · بداية فصل` : base;
};

/** القيود الشرعية والفنية لكل مشهد من نوعه ونصه */
export const sceneConstraints = (s: PlanScene): string[] => {
  const out: string[] = [];
  const sacred = isSacredSentence(s.narration ?? "");
  if (s.template === "verse-card") {
    out.push("كلام الله: لا عناصر ولا رموز ولا حركة زخرفية؛ سكون مقصود");
    out.push("نص الآية من مصدر معتمد بالرسم العثماني، والتلاوة مرخّصة أو من قارئ معتمد مع النسبة؛ لا يتلوها الصوت المستنسخ");
    if (!s.props.text?.trim() || s.props.text === VERSE_PLACEHOLDER) out.push("نص الآية لم يُجلب بعد: يمنع اعتماد الستوري بورد (versesMissingText)");
  } else if (s.template === "dua-board") {
    out.push("دعاء: لا أحداث ولا رموز بجواره، والنص كما في السكريبت");
    if (s.props.source) out.push(`النسبة كما في السكريبت: «${s.props.source}» (لا يُنسب إلى النبي ﷺ دون سند)`);
  } else if (sacred) {
    out.push("في الجملة ذكر الله أو دعاء أو اقتباس: لا أحداث ولا رموز فيها (سكون مقصود)");
  }
  if (s.template === "alley-tale") out.push("شخصيات بلا ملامح؛ الأحداث من قائمة المعاني المراجَعة وحدها (sceneCues)");
  if (s.template === "kinetic-text") out.push("الكلمة المبرزة تظهر وقت نطقها؛ لا عنصر لا يطابق المعنى");
  return out;
};

const cueText = (s: PlanScene) => {
  const cues = parseCues(s.props.cues);
  return cues.length ? `أحداث على الكلمات: ${cues.map((c) => `${cueNamesAr[c.kind] ?? c.kind} عند «${c.word}»`).join("، ")}` : "";
};

/** صفوف اللوحة بترتيب الحلقة. frameOf: مدة المشهد بالإطارات (sceneFrames مع وسائط الحلقة) */
export const boardScenes = (plan: Plan, frameOf: (s: PlanScene) => number, notes: BoardNotes = {}, issues: { sceneId: string; level: string; message: string }[] = [], fps = 30): BoardScene[] => {
  const rows: BoardScene[] = [];
  let t = 0;
  let prev: PlanScene | undefined;
  const eventOf = new Map<string, string>();
  for (const e of Object.values(notes.events ?? {})) for (const id of e.ids) eventOf.set(id, e.title);
  for (const c of plan.chapters) {
    c.scenes.forEach((s, i) => {
      const frames = frameOf(s);
      const shots = notes.keyframes?.[s.id]?.filter((f) => f >= 0 && f < frames) ?? [...new Set([Math.round(frames * 0.35), shotFrame(s, frames)])];
      const composition = [
        `نوع اللقطة: ${shotKind(s)}`,
        // اللقطة المصمَّمة تحدد شخوصها ووضعياتها بنفسها: لا تُعرض حقول الإخراج العام التي لا أثر لها فيها
        ...describeProps(s, [...CAMERA_KEYS, ...TEXT_KEYS, "cues", "shot", ...(s.props.shot && SHOTS[s.props.shot] ? ["poses", "poseTimeline", "look", "gait"] : [])]),
        cueText(s),
        shotElements(s).length ? `عناصر المكتبة: ${shotElements(s).join("، ")}` : "",
      ].filter(Boolean);
      const onScreen = s.template === "alley-tale" ? "" : shotText(s);
      rows.push({
        id: s.id,
        chapter: c.number,
        chapterTitle: c.title,
        order: rows.length + 1,
        template: s.template,
        kind: shotKind(s),
        narration: s.narration ?? "",
        start: t,
        frames,
        seconds: Math.round((frames / fps) * 10) / 10,
        shots,
        composition,
        camera: describeCamera(s),
        transition: describeTransition(s, prev, i === 0),
        onScreen,
        captions: s.captions === false || !s.narration?.trim() ? "بلا كابشن" : "كابشن أعلى الشاشة: جملة التعليق، والكلمة المنطوقة مبرزة",
        feeling: notes.sceneFeeling?.[s.id] ?? notes.chapterFeeling?.[String(c.number)] ?? "",
        constraints: sceneConstraints(s),
        issues: issues.filter((x) => x.sceneId === s.id).map((x) => `${x.level === "error" ? "خطأ" : "تنبيه"}: ${x.message}`),
        notes: notes.sceneNotes?.[s.id] ?? [],
        ...(eventOf.has(s.id) ? { event: eventOf.get(s.id) } : {}),
      });
      t += frames;
      prev = s;
    });
  }
  return rows;
};
