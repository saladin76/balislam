/**
 * «سرعة الإلقاء» و«الفاصل بين الجمل»: الخيارات وحدها (بلا أي استيراد)، تقرؤها الواجهة والخادم معًا (src/voice/pace.ts).
 */
export type SpeedId = "relaxed" | "medium" | "fast";
export type PauseId = "normal" | "shorter" | "shortest";

/**
 * المعامل فوق سرعة النبرة نفسها (التي وُلّد بها التسجيل). «متوسط» = سرعة النبرة كما هي (الافتراضي، فلا يتغير شيء قائم
 * حتى يختار المالك)، و«هادئ» أبطأ قليلًا، و«سريع» أسرع. القيم في القرار (D140) وفحصها في tests/pace-stretch.test.ts.
 */
export const SPEEDS: Record<SpeedId, { nameAr: string; factor: number; hintAr: string }> = {
  relaxed: { nameAr: "هادئ", factor: 0.93, hintAr: "أبطأ قليلًا من النبرة" },
  medium: { nameAr: "متوسط", factor: 1, hintAr: "سرعة النبرة كما هي" },
  fast: { nameAr: "سريع", factor: 1.15, hintAr: "أسرع بنحو ١٥٪" },
};
export const speedIds = Object.keys(SPEEDS) as SpeedId[];
export const isSpeed = (x: unknown): x is SpeedId => typeof x === "string" && x in SPEEDS;

/** معامل الوقفات بين الجمل وبعد آخر جملة (وذيل المشهد قبل التالي). */
export const PAUSES: Record<PauseId, { nameAr: string; factor: number }> = {
  normal: { nameAr: "عادي", factor: 1 },
  shorter: { nameAr: "أقصر", factor: 0.6 },
  shortest: { nameAr: "الأقصر", factor: 0.35 },
};
export const pauseIds = Object.keys(PAUSES) as PauseId[];
export const isPause = (x: unknown): x is PauseId => typeof x === "string" && x in PAUSES;

export const DEFAULT_SPEED: SpeedId = "medium";
export const DEFAULT_PAUSE: PauseId = "normal";

