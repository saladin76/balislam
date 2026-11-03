/**
 * ألوان الرسوم المصوَّرة لقناة «بالإسلام» (محراب النور).
 * كل لون هنا مشتق من ألوان الهوية الخمسة بالمزج مع الأسود أو الأبيض أو ببعضها، وألوان البشرة من الهوية نفسها،
 * فلا يدخل لون غريب على الهوية مهما تعددت الأماكن والأمزجة.
 */
export const ID = {
  night: "#0B1F1C",
  copper: "#C9A24A",
  dawn: "#F2B35B",
  paper: "#F4EEE2",
  seal: "#C2412D",
} as const;

export const SKIN = ["#E7C3A0", "#D2A782"] as const;

const hex = (h: string) => {
  const s = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const toHex = (c: number[]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("")}`;

/** مزج لونين: t=0 الأول، t=1 الثاني */
export const mix = (a: string, b: string, t: number) => {
  const x = hex(a);
  const y = hex(b);
  return toHex(x.map((v, i) => v + ((y[i] ?? 0) - v) * t));
};
export const darken = (a: string, t: number) => mix(a, "#000000", t);
export const lighten = (a: string, t: number) => mix(a, "#FFFFFF", t);

/** المزاج: سماء (ثلاث درجات من الأعلى للأفق)، ولون الضوء، وشدة إضاءة الحجر */
export type Mood = "night" | "deep" | "dusk" | "predawn" | "dawn" | "day";
export type MoodSpec = { sky: [string, string, string]; light: string; stone: number; stars: number; moon: boolean; sun: number };

export const MOODS: Record<Mood, MoodSpec> = {
  // ليل زمردي: سؤال وتأمل
  night: { sky: [darken(ID.night, 0.45), ID.night, mix(ID.night, ID.copper, 0.12)], light: ID.dawn, stone: 0.06, stars: 1, moon: true, sun: 0 },
  // ليل أعمق: ثقل وإنكار
  deep: { sky: [darken(ID.night, 0.7), darken(ID.night, 0.35), darken(ID.night, 0.1)], light: ID.dawn, stone: 0.0, stars: 0.6, moon: false, sun: 0 },
  // غروب: تأثر وذكرى
  dusk: { sky: [ID.night, mix(ID.night, ID.seal, 0.28), mix(ID.seal, ID.dawn, 0.35)], light: ID.dawn, stone: 0.3, stars: 0.25, moon: false, sun: 0 },
  // قبيل الفجر: بداية الفهم
  predawn: { sky: [darken(ID.night, 0.3), mix(ID.night, ID.copper, 0.22), mix(ID.copper, ID.paper, 0.15)], light: ID.dawn, stone: 0.24, stars: 0.4, moon: true, sun: 0.2 },
  // الفجر: الخلاصة والحق
  dawn: { sky: [mix(ID.night, ID.copper, 0.25), mix(ID.copper, ID.dawn, 0.55), lighten(ID.dawn, 0.35)], light: ID.dawn, stone: 0.62, stars: 0, moon: false, sun: 0.75 },
  // نهار هادئ: الحياة اليومية
  day: { sky: [mix(ID.paper, ID.night, 0.18), lighten(ID.paper, 0.2), lighten(ID.dawn, 0.55)], light: ID.paper, stone: 1, stars: 0, moon: false, sun: 1 },
};

/** الحجر: من ليل الحجر إلى ورقه، بحسب المزاج */
export const stoneFor = (mood: Mood, shade = 0) => {
  const base = mix(darken(ID.copper, 0.62), mix(ID.copper, ID.paper, 0.45), MOODS[mood].stone);
  return shade >= 0 ? darken(base, shade) : lighten(base, -shade);
};

/** ألوان الثياب: مشتقة من الهوية، بدرجات مختلفة حتى يتميز كل شخص */
export const CLOTH = {
  emerald: mix(ID.night, ID.paper, 0.32),
  teal: mix(mix(ID.night, ID.paper, 0.22), ID.copper, 0.12),
  copper: darken(ID.copper, 0.25),
  clay: mix(ID.seal, ID.night, 0.45),
  sand: mix(ID.copper, ID.paper, 0.35),
  ink: mix(ID.night, "#000000", 0.2),
  paper: mix(ID.paper, ID.copper, 0.12),
  dusk: mix(ID.night, ID.seal, 0.3),
} as const;
export type ClothId = keyof typeof CLOTH;
