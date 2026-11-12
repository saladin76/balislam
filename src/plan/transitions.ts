import { isSacredSentence } from "./sceneCues";
import type { PlanScene } from "./types";

/**
 * الانتقالات بين المشاهد (الأمر 011): حقل `transition` في المشهد يصف كيف **يدخل** هذا المشهد من الذي قبله.
 * بلا الحقل يبقى السلوك القائم حرفيًا (تلاشٍ قصير للخروج ثم للدخول). القطع المباشر خيار إخراجي كامل.
 *
 * الصيغة: نوع ثم معاملاته، ثم اختياريًا `dur <إطارات>` و`ease <منحنى>`:
 *   cut                                 قطع مباشر نظيف (بلا تلاشي الخروج والدخول)
 *   fade                                مزج حقيقي بين المشهدين (لا انطفاء إلى الخلفية)
 *   push left|right|up|down             حركة كاميرا: المشهدان ينزلقان معًا (انتقال بالكاميرا)
 *   zoom in|out [x y]                   اندفاع الكاميرا عبر المشهد نحو نقطة أو ابتعادها
 *   mask arch|circle|wipe [x y] [dir]   كشف المشهد الجديد من شكل يتسع (قوس المحراب، دائرة، مسح)
 *   through xA yA [xB yB]               عبر عنصر مشترك: تقترب الكاميرا من العنصر في الأول وتخرج من مثيله في الثاني
 *   morph <شكل> <شكل> [x y]             تحول هندسي: قناع يتسع ويتحول من شكل إلى شكل (circle، arch، square، star)
 *   light [x y]                         بالضوء: يخبو الأول نحو نقطة ضوء، ومنها ينتشر ضوء الثاني
 *   carry left|right                    استمرار الحركة: البطل يخرج ماشيًا من الأول ويدخل الثاني ماشيًا بالسرعة نفسها (قطع على الحركة)
 *   ease: linear | in | out | inout | spring
 */
export const TRANSITION_KINDS = ["cut", "fade", "push", "zoom", "mask", "through", "morph", "light", "carry"] as const;
export type TransitionKind = (typeof TRANSITION_KINDS)[number];
export const EASES = ["linear", "in", "out", "inout", "spring"] as const;
export type EaseName = (typeof EASES)[number];
export const SHAPES = ["circle", "arch", "square", "star"] as const;
export type ShapeName = (typeof SHAPES)[number];
export type Dir = "left" | "right" | "up" | "down";

export type Transition =
  | { kind: "cut"; dur: 0; ease: EaseName }
  | { kind: "fade"; dur: number; ease: EaseName }
  | { kind: "push"; dir: Dir; dur: number; ease: EaseName }
  | { kind: "zoom"; dir: "in" | "out"; at: { x: number; y: number }; dur: number; ease: EaseName }
  | { kind: "mask"; shape: "arch" | "circle" | "wipe"; at: { x: number; y: number }; dir: Dir; dur: number; ease: EaseName }
  | { kind: "through"; a: { x: number; y: number }; b: { x: number; y: number }; dur: number; ease: EaseName }
  | { kind: "morph"; from: ShapeName; to: ShapeName; at: { x: number; y: number }; dur: number; ease: EaseName }
  | { kind: "light"; at: { x: number; y: number }; dur: number; ease: EaseName }
  | { kind: "carry"; dir: "left" | "right"; dur: 0; ease: EaseName };

/** المدة الافتراضية لكل نوع (إطارات على 30 إطارًا/ث) */
const DEFAULT_DUR: Record<TransitionKind, number> = { cut: 0, fade: 18, push: 20, zoom: 22, mask: 24, through: 30, morph: 30, light: 36, carry: 0 };
export const MIN_DUR = 6;
export const MAX_DUR = 60;

/** الإحداثيات نسبية إلى الإطار (0..1) حتى تصلح للأفقي والعمودي معًا */
const num = (s: string | undefined) => (s !== undefined && /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN);
const isPt = (x: number, y: number) => x >= 0 && x <= 1 && y >= 0 && y <= 1;

export type ParseResult = { ok: true; t: Transition } | { ok: false; error: string };
export const parseTransition = (text: string | undefined): ParseResult | null => {
  const raw = (text ?? "").trim();
  if (!raw) return null;
  const words = raw.split(/\s+/);
  const kind = words[0] as TransitionKind;
  if (!TRANSITION_KINDS.includes(kind)) return { ok: false, error: `نوع انتقال غير معروف «${words[0]}»؛ المتاح: ${TRANSITION_KINDS.join("، ")}.` };
  // dur وease في أي موضع بعد النوع
  let dur = DEFAULT_DUR[kind];
  let ease: EaseName = kind === "carry" || kind === "cut" ? "linear" : "inout";
  const args: string[] = [];
  for (let i = 1; i < words.length; i++) {
    const w = words[i]!;
    if (w === "dur") {
      const d = num(words[++i]);
      if (Number.isNaN(d) || d < MIN_DUR || d > MAX_DUR) return { ok: false, error: `المدة يجب أن تكون بين ${MIN_DUR} و${MAX_DUR} إطارًا.` };
      if (kind === "cut" || kind === "carry") return { ok: false, error: `«${kind}» قطع مباشر بلا مدة.` };
      dur = Math.round(d);
    } else if (w === "ease") {
      const e = words[++i] as EaseName;
      if (!EASES.includes(e)) return { ok: false, error: `منحنى غير معروف «${words[i] ?? ""}»؛ المتاح: ${EASES.join("، ")}.` };
      ease = e;
    } else args.push(w);
  }
  const pt = (i: number, dx = 0.5, dy = 0.5) => {
    if (args[i] === undefined) return { x: dx, y: dy };
    const x = num(args[i]);
    const y = num(args[i + 1]);
    return Number.isNaN(x) || Number.isNaN(y) || !isPt(x, y) ? null : { x, y };
  };
  const bad = (msg: string): ParseResult => ({ ok: false, error: msg });
  const DIRS: Dir[] = ["left", "right", "up", "down"];
  switch (kind) {
    case "cut":
    case "fade":
      return args.length ? bad(`«${kind}» بلا معاملات.`) : { ok: true, t: { kind, dur, ease } as Transition };
    case "push": {
      const dir = args[0] as Dir;
      if (!DIRS.includes(dir) || args.length !== 1) return bad("push يحتاج اتجاهًا: left أو right أو up أو down.");
      return { ok: true, t: { kind, dir, dur, ease } };
    }
    case "zoom": {
      const dir = args[0] as "in" | "out";
      if (dir !== "in" && dir !== "out") return bad("zoom يحتاج in أو out ثم نقطة اختيارية (x y بين 0 و1).");
      const at = pt(1);
      if (!at || args.length > 3) return bad("نقطة zoom تُكتب x y بين 0 و1.");
      return { ok: true, t: { kind, dir, at, dur, ease } };
    }
    case "mask": {
      const shape = args[0] as "arch" | "circle" | "wipe";
      if (!["arch", "circle", "wipe"].includes(shape)) return bad("mask يحتاج شكلًا: arch أو circle أو wipe.");
      if (shape === "wipe") {
        const dir = (args[1] ?? "left") as Dir;
        if (!DIRS.includes(dir) || args.length > 2) return bad("mask wipe يأخذ اتجاهًا فقط: left أو right أو up أو down.");
        return { ok: true, t: { kind, shape, at: { x: 0.5, y: 0.5 }, dir, dur, ease } };
      }
      const at = pt(1, 0.5, 0.62);
      if (!at || args.length > 3) return bad(`نقطة mask ${shape} تُكتب x y بين 0 و1.`);
      return { ok: true, t: { kind, shape, at, dir: "left", dur, ease } };
    }
    case "through": {
      const a = pt(0);
      const b = args.length > 2 ? pt(2) : a;
      if (args.length < 2 || !a || !b || (args.length !== 2 && args.length !== 4)) return bad("through يحتاج موضع العنصر في المشهد الأول x y (0..1)، واختياريًا موضعه في الثاني.");
      return { ok: true, t: { kind, a, b, dur, ease } };
    }
    case "morph": {
      const from = args[0] as ShapeName;
      const to = args[1] as ShapeName;
      if (!SHAPES.includes(from) || !SHAPES.includes(to)) return bad(`morph يحتاج شكلين من: ${SHAPES.join("، ")}.`);
      const at = pt(2, 0.5, 0.55);
      if (!at || args.length > 4) return bad("نقطة morph تُكتب x y بين 0 و1.");
      return { ok: true, t: { kind, from, to, at, dur, ease } };
    }
    case "light": {
      const at = pt(0, 0.5, 0.4);
      if (!at || args.length > 2) return bad("نقطة الضوء تُكتب x y بين 0 و1.");
      return { ok: true, t: { kind, at, dur, ease } };
    }
    case "carry": {
      const dir = (args[0] ?? "left") as "left" | "right";
      if ((dir !== "left" && dir !== "right") || args.length > 1) return bad("carry يحتاج اتجاه المشي: left أو right.");
      return { ok: true, t: { kind, dir, dur: 0, ease } };
    }
  }
};

/** منحنيات التسارع والتباطؤ (0..1 → 0..1) */
export const easeOf = (e: EaseName) => (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  switch (e) {
    case "linear":
      return x;
    case "in":
      return x * x * x;
    case "out":
      return 1 - (1 - x) ** 3;
    case "inout":
      return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
    case "spring": {
      // نابض مخمَّد يتجاوز قليلًا ثم يستقر عند 1 تمامًا في النهاية
      if (x >= 1) return 1;
      return 1 - Math.exp(-6 * x) * Math.cos(9 * x) * (1 - x) - x * Math.exp(-6) * Math.cos(9);
    }
  }
};

/** المشاهد التي لا يُستعمل معها إلا القطع أو المزج: الآية والحديث والدعاء وذكر الله (السكون المقصود والتوقير) */
const SACRED_TEMPLATES = new Set(["verse-card", "hadith-card", "dua-board"]);
export const sacredScene = (s: Pick<PlanScene, "template" | "narration" | "ayahKey">) => SACRED_TEMPLATES.has(s.template) || Boolean(s.ayahKey) || isSacredSentence(s.narration ?? "");

/** القوالب التي تمر بالغلاف المشترك (SceneShell) فيقدر الانتقال على إيقاف تلاشيها؛ السبورة لها انتقالها المتصل الخاص */
export const NO_TRANSITION_TEMPLATES: Record<string, string> = {
  "dua-board": "السبورة لها انتقالها المتصل الخاص بين لوحاتها",
};

/** شروط استمرار الحركة: قالب الحارة بالكاميرا المؤلَّفة وبطل وحده يمشي (حيث نظام الحركة الطبيعية) */
export const carryReady = (s: Pick<PlanScene, "template" | "props">) => {
  const p = s.props ?? {};
  if (s.template !== "alley-tale") return "استمرار الحركة يحتاج قالب «الحارة» في المشهدين";
  if (p.shot) return "اللقطة المصمَّمة لها حركتها الخاصة";
  if (p.cameraMode !== "composed") return "استمرار الحركة يعمل مع الكاميرا المؤلَّفة (cameraMode = composed) حيث نظام المشي الطبيعي";
  if ((p.cast ?? "solo") !== "solo") return "استمرار الحركة لبطل وحده (cast = solo)";
  if (/sit/.test(p.poses ?? "")) return "البطل جالس في هذا المشهد";
  return null;
};

export type TransitionIssue = { level: "error" | "warning"; message: string };
/**
 * فحص انتقال مشهد بالنسبة للذي قبله في الفصل نفسه: يُرفض كل ما لا ينفذه المحرك أو لا يليق بالمشهد،
 * برسالة واضحة، بدل قبوله دون أثر.
 */
export const transitionIssues = (scene: PlanScene, prev: PlanScene | undefined): TransitionIssue[] => {
  const r = parseTransition(scene.transition);
  if (!r) return [];
  if (!r.ok) return [{ level: "error", message: `الانتقال: ${r.error}` }];
  const t = r.t;
  const out: TransitionIssue[] = [];
  if (!prev) return [{ level: "error", message: "الانتقال: أول مشهد في الحلقة لا مشهد قبله يُنتقل منه (والشورت يبدأ بلا انتقال)؛ احذف الحقل." }];
  for (const s of [scene, prev]) {
    const why = NO_TRANSITION_TEMPLATES[s.template];
    if (why) out.push({ level: "error", message: `الانتقال غير مدعوم مع قالب «${s.template}»: ${why}.` });
  }
  if (t.kind !== "cut" && t.kind !== "fade" && (sacredScene(scene) || sacredScene(prev)))
    out.push({ level: "error", message: `الانتقال «${t.kind}» لا يُستعمل قبل مشهد فيه آية أو دعاء أو ذكر لله ولا بعده؛ يكفي cut أو fade (السكون المقصود والتوقير).` });
  if (scene.template === "alley-tale" && prev.template === "alley-tale" && (scene.props?.place ?? "alley") === (prev.props?.place ?? "alley") && t.kind !== "cut" && t.kind !== "carry")
    out.push({ level: "error", message: "الانتقال: المشهدان في المكان نفسه في «الحارة» ومتصلان بلا قطع أصلًا؛ يكفي cut أو carry، أو غيّر المكان." });
  if (t.kind === "carry") {
    const a = carryReady(prev);
    const b = carryReady(scene);
    if (a) out.push({ level: "error", message: `الانتقال carry: المشهد السابق — ${a}.` });
    if (b) out.push({ level: "error", message: `الانتقال carry: هذا المشهد — ${b}.` });
  }
  return out;
};

/** نص المساعدة في الاستوديو */
export const TRANSITION_HELP =
  "فارغ = كما هو (تلاشٍ قصير). cut قطع مباشر · fade مزج · push left|right|up|down · zoom in|out [x y] · mask arch|circle|wipe [x y | اتجاه] · through xA yA [xB yB] (عنصر مشترك) · morph شكل شكل [x y] (circle، arch، square، star) · light [x y] · carry left|right (استمرار المشي). ثم اختياريًا dur إطارات (6..60) وease linear|in|out|inout|spring. النقاط نسبية للإطار (0..1).";
