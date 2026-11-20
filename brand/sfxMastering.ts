/**
 * معالجة مكتبة المؤثرات (قرار المالك ٢٠ نوفمبر: «نخليها احترافية»). الأصل يُحفظ في assets/sfx/original/،
 * والمعالَج مكانه في assets/sfx/ فلا يتغير مسار الرندر. الدور (لا موضوع المؤثر) يحدد العلو وطريقة البداية والنهاية.
 */
export type SfxRole = "ambience" | "impact" | "transition" | "action";

/** أصوات الجو: طويلة، خافتة تحت الكلام، وتلتف بلا أن يبين موضع البداية */
export const AMBIENCE = new Set(["wind", "rain", "birds-morning", "night-crickets", "water-stream", "waves", "fire-crackle",
  "leaves-rustle", "market-crowd", "crowd-murmur", "hall-echo", "silence-room", "kids-laugh-far", "clock-tick"]);
/** الضربات: هجومها الحاد هو صوتها، فلا يُنعَّم أولها */
export const IMPACT = new Set(["knock", "stamp", "click", "tick", "pop", "camera-shutter", "coin-drop", "door-close", "book-close",
  "counter-tick", "register", "card-swipe", "notification", "water-drop", "drop-soft"]);

export const roleOf = (id: string, category: string): SfxRole =>
  AMBIENCE.has(id) ? "ambience" : IMPACT.has(id) ? "impact" : category === "transition" ? "transition" : "action";

/** العلو المتكامل لكل دور (LUFS) وسقف الذروة الحقيقية (dBTP) ومعدل العينات */
export const MASTER = {
  lufs: { ambience: -32, impact: -24, transition: -27, action: -24 } as Record<SfxRole, number>,
  truePeak: -3,
  sampleRate: 48_000,
  /** تدرّج البداية والنهاية بالثواني */
  fadeIn: { ambience: 0.3, impact: 0.002, transition: 0.01, action: 0.01 } as Record<SfxRole, number>,
  fadeOut: { ambience: 0.4, impact: 0.04, transition: 0.06, action: 0.08 } as Record<SfxRole, number>,
  /** طول الالتفاف في أصوات الجو: آخرها يذوب في أولها */
  loopCrossfade: 0.5,
} as const;
