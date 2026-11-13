/**
 * ما يُعرض لكل لقطة في الستوري بورد (للاستوديو وللصفحة المرسلة): نوع المشهد، وما يظهر على الشاشة، وعناصره.
 * بلا اعتماد على Node، فيعمل في المتصفح.
 */
import type { PlanScene } from "./types";
import { templateById } from "./templates";
import { HZ_LEAD, HZ_META, hzSentences, type HzExit } from "../remotion/dafatir/horizon/meta";
import { buildTimeline, timelineFromWords } from "../remotion/dafatir/horizon/timeline";

export const shotKind = (s: PlanScene) => {
  if (s.template === "noor-text") return s.props.light === "off" ? "فراغ وكتابة" : s.props.light === "ink" ? "حبر على الصفحة" : "نور وكتابة";
  return templateById(s.template)?.nameAr ?? s.template;
};

const lines = (v?: string) => (v ?? "").split("\n").map((x) => x.trim()).filter(Boolean);

/** ما يظهر على الشاشة من نص (لا التعليق الصوتي) */
export const shotText = (s: PlanScene): string => {
  const p = s.props;
  switch (s.template) {
    case "noor-text":
      return (p.text || "جملة التعليق نفسها، كلمة كلمة وقت نطقها") + (p.subtitle ? ` · ${p.subtitle}` : "");
    case "verse-card":
      // بلا النقطة الوسطى بين السورة والآية: بجوار الأرقام العربية تُقرأ صفرًا (D61)
      return `${(p.reference ?? "").replace(/\s*\u00B7\s*/g, " ")} (نص الآية المكتوب في السكريبت، ينتظر التدقيق الشرعي)`;
    case "symbolic":
      return p.caption ?? "";
    case "timeline":
      return [p.title, ...lines(p.events)].filter(Boolean).join(" ← ");
    case "comparison":
      return `${[p.rightTitle, ...lines(p.rightItems)].filter(Boolean).join(" / ")}  |  ${[p.leftTitle, ...lines(p.leftItems)].filter(Boolean).join(" / ")}`;
    case "list":
      return `${p.title ? `${p.title}: ` : ""}${lines(p.items).join(" · ")}`;
    case "summary":
      return p.text ?? "";
    case "big-question":
      return p.question ?? "";
    case "end-screen":
      return [p.step, p.prompt].filter(Boolean).join(" · ");
    case "doc-plate":
      return [p.title, p.date].filter(Boolean).join(" · ") || "صورة اللوحة";
    case "map-journey":
      return lines(p.places).join(" ← ");
    default:
      return p.text ?? p.caption ?? p.title ?? "";
  }
};

/** معرّفات العناصر المرسومة في المشهد */
export const shotElements = (s: PlanScene): string[] => {
  const p = s.props;
  const ids = [p.element, p.secondElement, p.rightElement, p.leftElement, ...(p.icons ?? "").split(/[,،\n]+/)].map((x) => (x ?? "").trim()).filter(Boolean);
  return [...new Set(ids)];
};

/**
 * «خط الأفق» (دفاتر الزمن): نهاية آخر كلمة منطوقة بالثواني، بالحساب نفسه الذي يبدأ منه خروج المشهد
 * في `HorizonShot` (توقيت الصوت إن طابق النص، وإلا التقدير). بلا قيمة للمشاهد بلا كلام أو ذات الإمساك المحسوب (minEnd).
 */
export const horizonCloseSeconds = (s: PlanScene, words?: { word: string; start: number; end: number }[]): number | undefined => {
  if (s.template !== "horizon-shot") return undefined;
  const meta = HZ_META[String(s.props.shot ?? "")];
  if (!meta || meta.minEnd) return undefined;
  const sentences = hzSentences(s.narration ?? "");
  let tl = buildTimeline(sentences, HZ_LEAD);
  if (words?.length) {
    try { tl = timelineFromWords(sentences, words, 0); } catch { /* عدد الكلمات مختلف: يبقى التقدير كما في المشهد */ }
  }
  return tl.words.length ? tl.words[tl.words.length - 1]!.e : undefined;
};

/**
 * إصدار طريقة اختيار لوحة «خط الأفق» (الأمر 027): يدخل بصمة الاستوري بورد البصرية لمشاهد خط الأفق وحدها،
 * فتغيير ما تعرضه اللوحة يعيد فتح اعتمادها ولا يمس مشاهد القنوات الأخرى.
 */
export const HORIZON_BOARD_VIEW = "settled-close-1";

/** توقيت كلمات صوت المشهد كما يرسمه المشهد في الاستوديو (فقط إن طابق نصه السرد الحالي). */
export const boardWords = (s: PlanScene, media?: { voice: Record<string, { text: string; words: { word: string; start: number; end: number }[] }> }) => {
  const clip = media?.voice[s.id];
  return clip && clip.text === s.narration.trim() ? clip.words : undefined;
};

/**
 * لحظة لوحة الستوري بورد داخل المشهد (بالإطارات): الإطار الذي يمثّل المشهد كما يُرى في الفيديو.
 * - بطاقة الآية: منتصفها.
 * - «خط الأفق» بكلام: لحظة اكتمال آخر كلمة، قبل خروج المشهد (القلب أو الخفوت يبدأ بعدها بـ0.3 ث،
 *   ويعود الكادر قبل القلب بعدها بـ0.05 ث)؛ فاللوحة تعرض المشهد مكتملًا لا صفحة تُقلب أو حبرًا يخفت.
 * - عنوان الفصل: منتصفه (العنوان ظاهر؛ في آخره يصغر إلى رأس الصفحة).
 * - غير ذلك: 80% من المشهد كما كان.
 * `words` توقيت صوت المشهد إن وُجد وطابق النص (كما يرسمه المشهد نفسه).
 */
export const shotFrame = (s: PlanScene, durationInFrames: number, words?: { word: string; start: number; end: number }[], fps = 30) => {
  const clamp = (f: number) => Math.max(0, Math.min(durationInFrames - 1, Math.round(f)));
  if (s.template === "verse-card") return clamp(durationInFrames * 0.55);
  if (s.template === "horizon-shot") {
    if (String(s.props.shot ?? "") === "chapter") return clamp(durationInFrames * 0.5);
    const close = horizonCloseSeconds(s, words);
    if (close !== undefined) {
      const exit = (s.props.exit as HzExit | undefined) || HZ_META[String(s.props.shot ?? "")]?.exit;
      return clamp((close + (exit === "turn" ? 0.03 : 0.25)) * fps);
    }
  }
  return clamp(durationInFrames * 0.8);
};
