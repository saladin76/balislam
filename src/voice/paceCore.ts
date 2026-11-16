/**
 * «الفاصل بين الجمل والمشاهد» (D140): القواعد الصافية التي يقرؤها الخادم والرندر معًا (بلا node: ولا قرص)، فيحسب Remotion
 * وصل المشاهد (src/plan/seams.ts) بالأرقام نفسها التي يُقصَّر بها الصمت بين جملتين في التسجيل (src/voice/pace.ts).
 */
import type { PlanScene } from "../plan/types";
import { HZ_META } from "../remotion/dafatir/horizon/meta";

/** أقل وقفة بين جملتين بعد التقصير، وأقل صمت بعد آخر كلمة، وأقل ذيل للمشهد (ثوانٍ) */
export const MIN_GAP = 0.08;
export const MIN_TAIL = 0.1;
export const MIN_SCENE_TAIL = 0.15;
/** هامش حول الكلام يبقى معه حين يُمد (لا تُقص نهاية حرف) */
export const MARGIN = 0.04;

export const keepOf = (len: number, factor: number, floor: number) =>
  factor >= 1 ? len : Math.min(len, Math.max(len * factor, Math.min(len, floor)));

/** وقفة افتراضية بعد الجملة بحسب علامتها */
export const defaultPauseMs = (text: string): number => {
  const t = text.trim();
  if (/[؟?!]["»”)\]]*$/u.test(t)) return 500;
  if (/[.…]["»”)\]]*$/u.test(t)) return 450;
  if (/[:؛;]["»”)\]]*$/u.test(t)) return 300;
  if (/[،,]["»”)\]]*$/u.test(t)) return 220;
  return 250;
};

/**
 * الصمت بين آخر كلمة في جملة وأول كلمة في التالية بعد «الفاصل»، كما يصنعه planPace في التسجيل نفسه: هامشان حول الكلام
 * يبقيان، والباقي يُقصَّر بالمعامل ولا يقل عن MIN_GAP. factor = 1 («عادي»): الوقفة كما هي.
 */
export const pausedGap = (gapSec: number, factor: number): number => {
  const g = Math.max(0, gapSec);
  if (factor >= 1) return g;
  const m = Math.min(MARGIN, g / 2);
  return 2 * m + keepOf(g - 2 * m, factor, MIN_GAP);
};

/** آخر جملة في نص المشهد (تنتهي بعلامتها) */
export const lastSentenceOf = (narration: string) => {
  const parts = narration.trim().match(/[^.؟?!…:؛;]+[.؟?!…:؛;]*["»”)\]]*/gu) ?? [];
  return (parts[parts.length - 1] ?? narration).trim();
};

/**
 * مشهد لا تمسه السرعة ولا الفاصل أبدًا، ولماذا: الآية، وتمهيدها، ولقطات السكون المقصود (كما في src/render/stillness.ts).
 * التلاوة والسكون المقصود يبقيان كما هما حرفًا؛ وما قبلها وما بعدها لا يُعوَّض بحركة (القاعدة الثانية).
 */
export const paceExemption = (scene: PlanScene, next?: PlanScene): string | null => {
  const shot = String(scene.props?.shot ?? "");
  if (scene.template === "verse-card") return "مشهد آية: التلاوة لا تُمد ولا تُقص";
  if (scene.template === "ink-shot" && shot.startsWith("verse-intro")) return "تمهيد آية: سكون مقصود";
  if (scene.template === "horizon-shot" && HZ_META[shot]?.still) return HZ_META[shot]!.still === "dhikr" ? "ذكر الله: سكون مقصود" : "تمهيد آية: سكون مقصود";
  if (scene.narration && next?.template === "verse-card" && /[:：]\s*$/.test(scene.narration.trim())) return "تمهيد آية: سكون مقصود";
  return null;
};
