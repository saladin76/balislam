import { interpolate } from "remotion";

/**
 * خطة الإضاءة (الأمر 008): تحليل حقل `lighting` في خطة المشهد وحساب حالته عند كل إطار.
 * دوال خالصة بلا رسم (يستعملها فحص الخطة والمحرك معًا). الرسم في src/remotion/illus/light.tsx.
 */
const GROUND = 860;
const WW = 1920;
const clampOpt = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export type LightKind = "lamp" | "sun";
export type ShadowMode = "soft" | "hard" | "off";
export type LightEvent = { kind: "fade"; from: number; to: number; at: { word: string } | { frame: number }; dur: number } | { kind: "move"; x: number; y: number; at: { word: string } | { frame: number }; dur: number };

export type LightRig = {
  key: { kind: LightKind; x: number; y: number } | null;
  intensity: number;
  ambient: number;
  warmth: number;
  back: number;
  shadow: { mode: ShadowMode; length: number };
  depth: { dof: number; fog: number; parallax: number; fg: boolean };
  events: LightEvent[];
};

const NEUTRAL: LightRig = {
  key: null,
  intensity: 0.8,
  ambient: 1,
  warmth: 0,
  back: 0,
  shadow: { mode: "soft", length: 1 },
  depth: { dof: 0, fog: 0, parallax: 1, fg: false },
  events: [],
};

/** إعدادات جاهزة (بألوان الهوية: الفجر والنحاس للدفء، والليل الزمردي للبرودة) */
export const LIGHT_PRESETS: Record<string, Partial<LightRig>> = {
  // ليل الحارة: مصباح جداري قرب الباب، وظل طويل ناعم، وليل بارد قليلًا حوله
  "night-lamp": { key: { kind: "lamp", x: 1420, y: GROUND - 430 }, intensity: 0.9, ambient: 0.62, warmth: 0.35, back: 0.35, shadow: { mode: "soft", length: 1 } },
  // فجر: شمس منخفضة من الأفق، ظل طويل، دفء متوسط
  "dawn-sun": { key: { kind: "sun", x: 2300, y: GROUND - 260 }, intensity: 0.8, ambient: 0.9, warmth: 0.55, back: 0.55, shadow: { mode: "soft", length: 1.5 } },
  // نهار: شمس عالية، ظل قصير أوضح، محايد
  "day-sun": { key: { kind: "sun", x: 700, y: -900 }, intensity: 0.7, ambient: 1, warmth: 0.1, back: 0.15, shadow: { mode: "hard", length: 0.6 } },
  // داخل البيت: مصباح المكان نفسه (Home عند 520) دافئ، والنافذة خلفية
  "interior-lamp": { key: { kind: "lamp", x: 520, y: GROUND - 520 }, intensity: 0.95, ambient: 0.5, warmth: 0.6, back: 0.4, shadow: { mode: "soft", length: 0.9 } },
  // داخل البيت بضوء النافذة: أبرد، والمصدر النافذة (Home عند 1360)
  "interior-window": { key: { kind: "lamp", x: 1360, y: GROUND - 460 }, intensity: 0.85, ambient: 0.7, warmth: -0.3, back: 0.5, shadow: { mode: "soft", length: 1.1 } },
};
export const LIGHT_PRESET_IDS = Object.keys(LIGHT_PRESETS);

const num = (s: string | undefined) => (s !== undefined && /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN);
const when = (s: string | undefined): { word: string } | { frame: number } | null => (s === undefined ? null : /^\d+$/.test(s) ? { frame: Number(s) } : { word: s });

/** تحليل حقل lighting: سطر لكل إعداد؛ السطر غير المفهوم يعود null في موضعه (لفحص الخطة) */
export type LightFeature = "preset" | "key" | "intensity" | "ambient" | "warmth" | "back" | "shadow" | "shadow.length" | "fade" | "move" | "depth.dof" | "depth.fog" | "depth.parallax" | "depth.fg";
export type FeatureUse = { feature: LightFeature; line: number };

export const parseLightingLines = (text: string | undefined): { rig: LightRig | null; bad: number[]; uses: FeatureUse[] } => {
  const lines = (text ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { rig: null, bad: [], uses: [] };
  const rig: LightRig = { ...NEUTRAL, shadow: { ...NEUTRAL.shadow }, depth: { ...NEUTRAL.depth }, events: [] };
  const bad: number[] = [];
  const uses: FeatureUse[] = [];
  lines.forEach((line, i) => {
    const [k, ...a] = line.split(/\s+/);
    const use = (feature: LightFeature) => uses.push({ feature, line: i + 1 });
    const ok = (() => {
      if (k && LIGHT_PRESETS[k] && a.length === 0) {
        const p = LIGHT_PRESETS[k]!;
        Object.assign(rig, { ...p, shadow: { ...rig.shadow, ...p.shadow }, depth: { ...rig.depth, ...p.depth } });
        use("preset");
        return true;
      }
      switch (k) {
        case "key": {
          if (a[0] === "off" && a.length === 1) return (rig.key = null), use("key"), true;
          const x = num(a[1]);
          const y = num(a[2]);
          if ((a[0] !== "lamp" && a[0] !== "sun") || Number.isNaN(x) || Number.isNaN(y) || a.length !== 3) return false;
          rig.key = { kind: a[0], x, y };
          use("key");
          return true;
        }
        case "intensity":
        case "ambient":
        case "warmth":
        case "back": {
          const v = num(a[0]);
          const [lo, hi] = k === "warmth" ? [-1, 1] : k === "intensity" ? [0, 1.5] : k === "ambient" ? [0.2, 1.2] : [0, 1];
          if (a.length !== 1 || Number.isNaN(v) || v < lo || v > hi) return false;
          rig[k] = v;
          use(k);
          return true;
        }
        case "shadow": {
          const mode = a[0] as ShadowMode;
          if (!["soft", "hard", "off"].includes(mode) || a.length > 2) return false;
          const len = a[1] === undefined ? rig.shadow.length : num(a[1]);
          if (Number.isNaN(len) || len < 0.3 || len > 2.5) return false;
          rig.shadow = { mode, length: len };
          use("shadow");
          if (a[1] !== undefined) use("shadow.length");
          return true;
        }
        case "depth": {
          for (let j = 0; j < a.length; j++) {
            const w = a[j];
            if (w === "fg") (rig.depth.fg = true), use("depth.fg");
            else if (w === "dof" || w === "fog" || w === "parallax") {
              const v = num(a[++j]);
              if (Number.isNaN(v) || v < 0 || v > (w === "parallax" ? 2 : 1)) return false;
              rig.depth[w] = v;
              use(`depth.${w}`);
            } else return false;
          }
          return a.length > 0;
        }
        case "fade": {
          const from = num(a[0]);
          const to = num(a[1]);
          const at = when(a[2]);
          const dur = a[3] === undefined ? 30 : num(a[3]);
          if (Number.isNaN(from) || Number.isNaN(to) || !at || Number.isNaN(dur) || dur < 1 || dur > 300 || a.length > 4) return false;
          rig.events.push({ kind: "fade", from, to, at, dur });
          use("fade");
          return true;
        }
        case "move": {
          const x = num(a[0]);
          const y = num(a[1]);
          const at = when(a[2]);
          const dur = a[3] === undefined ? 60 : num(a[3]);
          if (Number.isNaN(x) || Number.isNaN(y) || !at || Number.isNaN(dur) || dur < 1 || dur > 300 || a.length > 4) return false;
          rig.events.push({ kind: "move", x, y, at, dur });
          use("move");
          return true;
        }
        default:
          return false;
      }
    })();
    if (!ok) bad.push(i + 1);
  });
  return { rig, bad, uses };
};
/**
 * الحقل نفسه في كل إطار: يُحلَّل مرة واحدة ويُعاد من الذاكرة (الأمر 009). الإعداد لا يُعدَّل بعد التحليل
 * (lightAt ينسخ ما يغيره)، فمشاركته بين الإطارات آمنة.
 */
const parsed = new Map<string, LightRig | null>();
export const parseLighting = (text: string | undefined) => {
  if (!text) return null;
  if (!parsed.has(text)) {
    if (parsed.size > 200) parsed.clear();
    parsed.set(text, parseLightingLines(text).rig);
  }
  return parsed.get(text)!;
};

/** حالة الإضاءة عند إطار: تُطبَّق التغيرات التدريجية (fade/move) بمنحنى ناعم */
export type LightState = { key: { kind: LightKind; x: number; y: number } | null; intensity: number; ambient: number; warmth: number; back: number; rig: LightRig };
export const lightAt = (rig: LightRig, frame: number, wordAt: (w: string) => number | undefined): LightState => {
  let key = rig.key ? { ...rig.key } : null;
  let intensity = rig.intensity;
  const ease = (t: number) => t * t * (3 - 2 * t);
  const fades = rig.events.filter((e) => e.kind === "fade");
  if (fades.length) intensity = (fades[0] as Extract<LightEvent, { kind: "fade" }>).from;
  for (const e of rig.events) {
    const at = "frame" in e.at ? e.at.frame : wordAt(e.at.word);
    if (at === undefined) continue;
    const p = ease(interpolate(frame, [at, at + e.dur], [0, 1], clampOpt));
    if (e.kind === "fade") intensity = intensity + (e.to - intensity) * p;
    else if (key) key = { ...key, x: key.x + (e.x - key.x) * p, y: key.y + (e.y - key.y) * p };
  }
  return { key, intensity, ambient: rig.ambient, warmth: rig.warmth, back: rig.back, rig };
};


/**
 * ما ينفذه كل قالب فعلًا (الأمر 009). مصدر واحد للحقيقة: فحص الخطة يرفض ما ليس هنا،
 * ونص المساعدة في الاستوديو يُولَّد منه، واختبار يتحقق أن لكل خاصية مقبولة أثرًا في رسم القالب.
 */
const ALL: LightFeature[] = ["preset", "key", "intensity", "ambient", "warmth", "back", "shadow", "shadow.length", "fade", "move", "depth.dof", "depth.fog", "depth.parallax", "depth.fg"];
export const LIGHTING_SUPPORT: Record<string, { name: string; features: LightFeature[]; reasons: Partial<Record<LightFeature, string>> }> = {
  "alley-tale": { name: "الحارة", features: ALL, reasons: {} },
  "road-journey": {
    name: "الطريق",
    features: ALL.filter((f) => f !== "depth.fg"),
    reasons: { "depth.fg": "طبقة المقدمة (حافة عمود المحراب) تؤطر مكانًا مغلقًا، ولا مكان لها على طريق مفتوح" },
  },
};
export const lightingTemplates = () => Object.keys(LIGHTING_SUPPORT);

const FEATURE_LABEL: Record<LightFeature, string> = {
  preset: "الإعداد الجاهز",
  key: "key",
  intensity: "intensity",
  ambient: "ambient",
  warmth: "warmth",
  back: "back",
  shadow: "shadow",
  "shadow.length": "طول الظل",
  fade: "fade",
  move: "move",
  "depth.dof": "depth dof",
  "depth.fog": "depth fog",
  "depth.parallax": "depth parallax",
  "depth.fg": "depth fg",
};

export type LightingIssue = { level: "error" | "warning"; message: string };
/** فحص حقل lighting لقالب بعينه: لا يُقبل إعداد لا أثر له في هذا القالب */
export const lightingIssues = (template: string, props: Record<string, string | undefined>): LightingIssue[] => {
  const text = props.lighting;
  if (!text || !text.trim()) return [];
  const out: LightingIssue[] = [];
  const sup = LIGHTING_SUPPORT[template];
  if (!sup) {
    const names = Object.values(LIGHTING_SUPPORT).map((t) => `«${t.name}»`).join(" و");
    return [{ level: "error", message: `الإضاءة غير مدعومة في هذا القالب بعد؛ تدعمها ${names} فقط. احذف حقل lighting أو غيّر القالب.` }];
  }
  if (template === "alley-tale" && props.shot) out.push({ level: "error", message: "اللقطة المصمَّمة (shot) لها إضاءتها الخاصة ولا تقرأ حقل lighting بعد؛ احذف أحدهما." });
  const { rig, bad, uses } = parseLightingLines(text);
  for (const n of bad) out.push({ level: "error", message: `الإضاءة غير صالحة في السطر ${n}. الإعدادات الجاهزة: ${LIGHT_PRESET_IDS.join("، ")}.` });
  for (const u of uses) {
    if (!sup.features.includes(u.feature)) {
      const why = sup.reasons[u.feature];
      out.push({ level: "error", message: `الإضاءة: «${FEATURE_LABEL[u.feature]}» في السطر ${u.line} غير مدعوم في «${sup.name}»${why ? ` (${why})` : ""}؛ احذفه.` });
    }
  }
  if (rig && !rig.key) {
    // بلا مصدر رئيسي: ما يخص المصدر لا أثر له، فلا يُقبل بصمت
    for (const u of uses) {
      if (u.feature === "fade" || u.feature === "move" || u.feature === "intensity" || u.feature === "shadow.length")
        out.push({ level: "error", message: `الإضاءة: «${FEATURE_LABEL[u.feature]}» في السطر ${u.line} لا أثر له بلا مصدر (key off)؛ أضف key أو احذف السطر.` });
    }
    const hard = uses.find((u) => u.feature === "shadow") && rig.shadow.mode === "hard";
    if (hard) out.push({ level: "error", message: "الإضاءة: الظل الحاد (shadow hard) يحتاج مصدرًا يُلقي الظل؛ بلا key يبقى ظل التماس وحده." });
  }
  if (rig && template === "alley-tale" && rig.depth.parallax !== 1 && uses.some((u) => u.feature === "depth.parallax")) {
    const still = props.cameraMode === "composed" ? /^\s*(ثابت|still)\s*$/m.test(props.cameraPlan ?? "") : props.cameraMode === "directed" && (!props.camera || props.camera === "still");
    if (still) out.push({ level: "warning", message: "الإضاءة: معامل المنظور (parallax) لا يظهر إلا مع حركة الكاميرا، والكاميرا هنا ثابتة." });
  }
  return out;
};

/** نص المساعدة لحقل الإضاءة في الاستوديو: يُولَّد مما ينفذه القالب فعلًا */
export const lightingHelp = (template: string) => {
  const sup = LIGHTING_SUPPORT[template];
  if (!sup) return "";
  const has = (f: LightFeature) => sup.features.includes(f);
  const parts = [
    `فارغ = كما هو. إعداد جاهز: ${LIGHT_PRESET_IDS.join(" أو ")}، ثم سطور تعدّله:`,
    "key lamp|sun x y (أو key off)",
    "intensity 0..1.5",
    "ambient 0.2..1.2",
    "warmth -1 بارد .. 1 دافئ",
    "back 0..1 (ضوء خلفي)",
    "shadow soft|hard|off [طول 0.3..2.5]",
    `depth ${["dof", "fog", "parallax"].filter((w) => has(`depth.${w}` as LightFeature)).map((w) => `${w} قيمة`).join(" ")}${has("depth.fg") ? " fg" : ""}`,
    "fade من إلى الكلمة [مدة]",
    "move x y الكلمة [مدة]",
  ];
  const missing = ALL.filter((f) => !has(f)).map((f) => `${FEATURE_LABEL[f]} غير مدعوم هنا`);
  return parts.join(" · ") + (missing.length ? ` · (${missing.join("، ")})` : "");
};
