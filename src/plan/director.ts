/**
 * Optional, backward-compatible creative direction for illustrated scenes.
 * Scene props remain strings so the existing plan/editor schema is unchanged.
 * All times are narration word offsets in frames (not wall-clock seconds).
 */
export const CAMERA_MODES = ["automatic", "directed", "composed"] as const;
export type CameraMode = (typeof CAMERA_MODES)[number];
/** directed و composed كلاهما يلغي التأطير الآلي المتكرر وحركات الحشو؛ composed يضيف خطة كاميرا محسوبة */
export const isDirected = (mode?: string) => mode === "directed" || mode === "composed";
export const isComposed = (mode?: string) => mode === "composed";

/**
 * الكاميرا المؤلَّفة (composed): حركات قليلة لها سبب في الكلام، بدل قطع آلي مع كل سطر.
 * كل سطر في cameraPlan: «الكلمة أو رقم الإطار | الحجم [الهدف]»
 *   الحجم: wide (واسع) | medium (متوسط) | close (قريب)
 *   الهدف: hero (البطل) | pair (البطل ومن أمامه) | door | board | center
 * السطر الأول بلا كلمة (0) هو التأطير الافتتاحي.
 */
export const CAM_SHOTS = ["wide", "medium", "close"] as const;
export type CamShot = (typeof CAM_SHOTS)[number];
/** other (مع framing = fit فقط، الأمر 013): الطرف الآخر — من أمام البطل، أو الشاهد الثاني */
export const CAM_TARGETS = ["hero", "pair", "door", "board", "center", "other"] as const;
export type CamTarget = (typeof CAM_TARGETS)[number];
export type CameraBeat = {
  at: { frame: number } | { word: string };
  shot: CamShot;
  target: CamTarget;
  /** إزاحة بالإطارات عن نطق الكلمة (موجبة = بعدها): لتصل الكاميرا مع الحدث لا مع الكلمة */
  offset?: number;
  /** مدة الحركة بالإطارات (لحركة واحدة طويلة)؛ إن غابت تُحسب من المسافة */
  dur?: number;
  /** المشهد كله ثابت: لا حركة ولا تنفس كاميرا */
  still?: boolean;
};
/** كلمة «ثابت» أو still في سطر وحده: الكاميرا ساكنة طوال المشهد */
const STILL_WORDS = ["still", "ثابت"];

const SHOT_ZOOM: Record<CamShot, number> = { wide: 1, medium: 1.28, close: 1.6 };
export const shotZoom = (s: CamShot) => SHOT_ZOOM[s];

/** يقرأ خطة الكاميرا؛ السطر غير الصالح يُرجع null في موضعه (ليظهر خطأً في الفحص) */
export const parseCameraPlanLines = (input?: string): (CameraBeat | null)[] =>
  (input ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line): CameraBeat | null => {
      if (STILL_WORDS.includes(line)) return { at: { frame: 0 }, shot: "wide", target: "hero", still: true };
      const [left, right] = line.split("|").map((x) => x.trim());
      if (!left || !right) return null;
      const [shot, target = "hero", durTok] = right.split(/\s+/);
      if (!(CAM_SHOTS as readonly string[]).includes(shot ?? "") || !(CAM_TARGETS as readonly string[]).includes(target)) return null;
      let dur: number | undefined;
      if (durTok !== undefined) {
        if (!/^\d+$/.test(durTok)) return null;
        dur = Number(durTok);
        if (dur < 12 || dur > 300) return null;
      }
      // «الكلمة+12» أو «الكلمة-8»: إزاحة عن نطق الكلمة
      const m = /^(.+?)([+-]\d+)$/.exec(left);
      const offset = m && !/^\d+$/.test(left) ? Number(m[2]) : undefined;
      const word = m && !/^\d+$/.test(left) ? m[1]!.trim() : left;
      const at = /^\d+$/.test(word) ? { frame: Number(word) } : { word };
      return { at, shot: shot as CamShot, target: target as CamTarget, ...(offset !== undefined ? { offset } : {}), ...(dur !== undefined ? { dur } : {}) };
    });
export const parseCameraPlan = (input?: string): CameraBeat[] => parseCameraPlanLines(input).filter((b): b is CameraBeat => b !== null);

/** الكلمات التي تستحق حركة كاميرا (من القائمة المراجَعة)، بترتيب أولويتها */
const CAMERA_CUES: Partial<Record<CueKindLike, { shot: CamShot; target: CamTarget }>> = {
  door: { shot: "medium", target: "door" },
  news: { shot: "medium", target: "board" },
  truth: { shot: "close", target: "hero" },
  heart: { shot: "close", target: "hero" },
  pain: { shot: "close", target: "hero" },
  decide: { shot: "medium", target: "hero" },
  think: { shot: "medium", target: "hero" },
  apologize: { shot: "medium", target: "pair" },
  harsh: { shot: "medium", target: "pair" },
  listen: { shot: "medium", target: "pair" },
  debate: { shot: "medium", target: "pair" },
};
type CueKindLike = string;

/**
 * خطة آلية مؤلَّفة حين لا يكتب المخرج خطة: تأطير افتتاحي، ثم حركة واحدة أو اثنتان على كلمات المعنى.
 * - لا حركة في مشهد كل جمله ذكر لله أو دعاء أو آية (يبقى ثابتًا).
 * - حركتان على الأكثر، وبينهما ثلاث ثوانٍ على الأقل، فلا «نبض» آلي.
 * - إن لم توجد كلمة معنى: اقتراب واحد هادئ في منتصف المشهد تقريبًا.
 */
export const autoCameraPlan = (opts: {
  cues: { kind: string; at: number }[];
  duration: number;
  fps: number;
  stage: "solo" | "companion" | "witnesses";
  sacred: boolean;
  /**
   * التأطير المحتوي في العمودي (framing = fit، الأمر 013): الشاهدان لا يتسعان معًا في الإطار الضيق،
   * فتنتقل الكاميرا إلى كل شاهد عند كلمة حكمه («ظلم» ثم «عدل») بدل تأطير يقصهما معًا.
   */
  alternate?: boolean;
}): { frame: number; shot: CamShot; target: CamTarget }[] => {
  const { cues, duration, fps, stage, sacred } = opts;
  const open: { frame: number; shot: CamShot; target: CamTarget } = { frame: 0, shot: stage === "companion" ? "medium" : "wide", target: stage === "companion" ? "pair" : stage === "witnesses" ? "center" : "hero" };
  if (sacred) return [open];
  const moves: { frame: number; shot: CamShot; target: CamTarget }[] = [];
  if (opts.alternate && stage === "witnesses") {
    // الحكمان متقاربان عادة في جملة واحدة: يكفي ثانية ونصف بين الحركتين، فلكل حركة سبب في الكلام
    for (const c of [...cues].sort((a, b) => a.at - b.at)) {
      const m = c.kind === "wrong" ? { shot: "medium" as const, target: "hero" as const } : c.kind === "just" ? { shot: "medium" as const, target: "other" as const } : null;
      if (!m || moves.length >= 2 || moves.some((x) => x.target === m.target)) continue;
      const last = moves.at(-1)?.frame ?? -Infinity;
      if (c.at - last < 1.5 * fps || c.at > duration - fps) continue;
      moves.push({ frame: c.at, ...m });
    }
    return [open, ...moves];
  }
  for (const c of [...cues].sort((a, b) => a.at - b.at)) {
    const m = CAMERA_CUES[c.kind];
    if (!m || moves.length >= 2) continue;
    if (stage === "witnesses" && m.target !== "center") continue;
    if (stage !== "companion" && m.target === "pair") continue;
    const last = moves.at(-1)?.frame ?? -Infinity;
    if (c.at - last < 3 * fps || c.at > duration - fps) continue;
    const prevShot = moves.at(-1)?.shot ?? open.shot;
    const prevTarget = moves.at(-1)?.target ?? open.target;
    if (m.shot === prevShot && m.target === prevTarget) continue;
    moves.push({ frame: c.at, ...m });
  }
  // بلا كلمة معنى: تبقى الكاميرا على تأطيرها الافتتاحي (لا حركة حشو بنمط ثابت)
  return [open, ...moves];
};

/**
 * مدة الحركة بين تأطيرين: أطول كلما كبرت المسافة (كاميرا ثقيلة هادئة، لا قفزات سريعة متساوية).
 * من 24 إلى 60 إطارًا.
 */
export const moveFrames = (dz: number, dx: number) => Math.round(Math.max(24, Math.min(60, 22 + Math.abs(dz) * 55 + Math.abs(dx) / 14)));

/** عدد تغيّرات التأطير في المشهد: مقياس بسيط للحركة الآلية المتكررة */
export const framingChanges = (keys: { frame: number }[]) => Math.max(0, keys.length - 1);

/** Explicit pose events: one event per line, "frame | pose".
 * Frame is an integer >= 0; malformed entries are ignored.
 * These events supplement semantic cue poses and replace filler gestures.
 */
export const parsePoseTimeline = (input?: string): { at: number; pose: string }[] =>
  (input ?? "")
    .split("\n")
    .map((line) => line.split("|").map((part) => part.trim()))
    .filter(([at, pose]) => /^\d+$/.test(at ?? "") && Boolean(pose))
    .map(([at, pose]) => ({ at: Number(at), pose: pose! }))
    .filter((event) => Number.isSafeInteger(event.at))
    .sort((a, b) => a.at - b.at);

/** A single controlled framing is intentionally more useful than auto cuts.
 * This helper makes the mode easy to test independently of Remotion rendering.
 */
export const cameraCuts = (starts: number[], duration: number, directed: boolean): number[] => {
  if (directed) return [0];
  const cuts: number[] = [];
  starts.forEach((start, i) => {
    const end = starts[i + 1] ?? duration;
    cuts.push(start);
    if (end - start > 75) cuts.push(start + Math.round((end - start) / 2));
  });
  return cuts.length ? cuts : [0];
};
