/**
 * ما يُعرض لكل لقطة في الستوري بورد (للاستوديو وللصفحة المرسلة): نوع المشهد، وما يظهر على الشاشة، وعناصره.
 * بلا اعتماد على Node، فيعمل في المتصفح.
 */
import type { PlanScene } from "./types";
import { templateById } from "./templates";

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
      return `${p.reference ?? ""} (نص الآية المكتوب في السكريبت، ينتظر التدقيق الشرعي)`;
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

/** لحظة اللقطة داخل المشهد (بالإطارات): بعد ظهور عناصره، ومنتصف بطاقة الآية */
export const shotFrame = (s: PlanScene, durationInFrames: number) => Math.max(0, Math.min(durationInFrames - 1, Math.round(durationInFrames * (s.template === "verse-card" ? 0.55 : 0.8))));
