/**
 * الخطاف المسبق (cold open، D198، قرار المالك ٢٢ نوفمبر لـ«دفاتر الزمن 001»): تبدأ الحلقة بجملة مسجّلة من مشهد لاحق كما هي
 * (تسجيل المشهد نفسه، مقطوعًا بعد نهاية كلمة؛ لا صوت جديد ولا توليد)، فوق صورة ذلك المشهد نفسه، ثم قلب صفحة إلى
 * أول مشهد، والحلقة بعدها كما هي (والمشهد المصدر في مكانه: يعود السؤال صدى).
 * يأخذ خانة «الافتتاحية» في الخط الزمني (introFramesFor)، فكل ما يحسب الأزمنة بعدها (الوصل، والسكون المقصود، والفصول،
 * والمقياس، والتجميع) يتأخر بمدته تلقائيًا. ليس افتتاحية قناة (D155 باقٍ): هو مضمون الحلقة نفسها.
 */
import type { Plan, PlanScene } from "./types";

/**
 * scene: المشهد المصدر · words: عدد الكلمات من أول تسجيله (ما يُقال فعلًا، لا يتأثر بالإيقاع) · to: نهاية القطع بالثواني في
 * التسجيل الذي يُرندر (بعد الإيقاع إن كان)، في الوقفة بعد الكلمة الأخيرة وقبل التالية. المدة من `to` وحده (الخطة بلا وسائط).
 */
export type ColdOpen = { scene: string; to: number; words?: number };
/** ذيل الخطاف (ثوانٍ): خفوت الحبر إلى الدفتر كله ثم قلب ورقة (٠٫٨ ث) إلى أول مشهد */
export const COLD_OPEN_TAIL_SEC = 1.2;
/** أطول خطاف مسموح (ثوانٍ): جملة أو جملتان، لا مقطع */
export const COLD_OPEN_MAX_SEC = 12;
type TimedWord = { word: string; start: number; end: number };
type Clip = { file: string; text: string; duration?: number; words: TimedWord[] };

/**
 * الخطاف مفعّل لهذه الخطة (الحلقة كاملة لا فصل منها ولا شورت). مستقل عن `intro` (افتتاحية القناة المطفأة بـD155):
 * رندر مشهد غير الأول يحذف `coldOpen` من خطته (src/render/shotsPreview.ts).
 */
export const coldOpenOf = (plan?: Pick<Plan, "coldOpen"> | null, chapter?: number): ColdOpen | null => {
  const c = plan?.coldOpen;
  if (chapter || !c || typeof c.scene !== "string" || !Number.isFinite(c.to) || c.to <= 0) return null;
  return { scene: c.scene, to: Math.min(COLD_OPEN_MAX_SEC, c.to), ...(Number.isInteger(c.words) && c.words! > 0 ? { words: c.words } : {}) };
};
export const coldOpenFrames = (plan?: Pick<Plan, "coldOpen"> | null, chapter?: number, fps = 30): number => {
  const c = coldOpenOf(plan, chapter);
  return c ? Math.round((c.to + COLD_OPEN_TAIL_SEC) * fps) : 0;
};
/** المشهد المصدر: من الخطة، أو من النسخة المرفقة حين تُقصر الخطة على مشهد واحد (معاينة المشهد الأول) */
export const coldOpenSource = (plan: Pick<Plan, "chapters" | "coldOpenSource" | "coldOpen">): PlanScene | null => {
  const id = plan.coldOpen?.scene;
  if (!id) return null;
  return plan.chapters.flatMap((c) => c.scenes).find((s) => s.id === id) ?? (plan.coldOpenSource?.id === id ? plan.coldOpenSource : null);
};
/** كلمات الخطاف: أول `words` كلمة من تسجيل المشهد المصدر إن حُدد عددها، وإلا التي تنتهي قبل حد القطع؛ والنص منها */
export const coldOpenCut = (clip: Pick<Clip, "words">, to: number, count?: number): { words: TimedWord[]; text: string } => {
  const words = count ? clip.words.slice(0, count) : clip.words.filter((w) => w.end <= to + 0.05);
  return { words, text: words.map((w) => w.word).join(" ") };
};
/** فحص الخطاف قبل الرندر: المشهد موجود وله تسجيل مطابق لنصه، والقطع بعد نهاية كلمة وقبل الكلمة التالية */
export const coldOpenIssues = (plan: Pick<Plan, "chapters" | "coldOpen" | "coldOpenSource">, voice: Record<string, Clip | undefined>): string[] => {
  const c = plan.coldOpen;
  if (!c) return [];
  const out: string[] = [];
  if (typeof c.scene !== "string" || !Number.isFinite(c.to) || c.to <= 0) return ["الخطاف المسبق: حدد المشهد ونهاية القطع بالثواني."];
  if (c.to > COLD_OPEN_MAX_SEC) out.push(`الخطاف المسبق أطول من ${COLD_OPEN_MAX_SEC} ث.`);
  const src = coldOpenSource(plan);
  if (!src) return [...out, `الخطاف المسبق: المشهد «${c.scene}» غير موجود في الخطة.`];
  const clip = voice[src.id];
  if (!clip || clip.text !== (src.narration ?? "").trim() || !clip.words?.length) return [...out, `الخطاف المسبق: لا تسجيل مطابق لنص المشهد «${c.scene}».`];
  if (c.words !== undefined && (!Number.isInteger(c.words) || c.words < 1 || c.words > clip.words.length))
    return [...out, `الخطاف المسبق: عدد الكلمات ${c.words} خارج تسجيل المشهد «${c.scene}» (${clip.words.length} كلمة).`];
  const cut = coldOpenCut(clip, c.to, c.words);
  if (!cut.words.length) out.push("الخطاف المسبق: لا كلمة كاملة قبل نهاية القطع.");
  const lastEnd = cut.words[cut.words.length - 1]?.end ?? 0;
  const next = clip.words[cut.words.length];
  // القطع في الوقفة بعد آخر كلمة: لا تُبتر الأخيرة، ولا يُسمع أول التالية
  if (lastEnd > c.to + 0.05 || (next && next.start < c.to))
    out.push(`الخطاف المسبق: القطع عند ${c.to} ث ليس في الوقفة بعد «${cut.words[cut.words.length - 1]?.word ?? ""}»؛ اجعله بين ${lastEnd} و${next?.start ?? lastEnd + 0.5} ث في التسجيل المستعمل.`);
  return out;
};

/**
 * The plan a scene cut (or its 4K cover still) is rendered from, and the plan its media is collected from (D198, D196 v6).
 * The first scene of the episode carries the channel intro slot and the cold open, with the cold open's source scene attached
 * as a snapshot (the plan keeps only the rendered scenes) and its recording and page-turn collected with it. Any other scene
 * drops both, so its frame 0 is its own first frame (a later scene's cover moment is never shifted by an empty slot).
 */
export const cutPlans = (full: Plan, ids: string[], sceneDraft = true): { plan: Plan; mediaPlan: Plan } => {
  const opensEpisode = full.chapters[0]?.scenes[0]?.id === ids[0];
  const source = opensEpisode ? coldOpenSource(full) : null;
  const plan: Plan = { ...full, ...(sceneDraft && !opensEpisode ? { intro: false, coldOpen: undefined } : {}),
    ...(source ? { coldOpenSource: source } : {}),
    chapters: full.chapters.map((c) => ({ ...c, scenes: c.scenes.filter((s) => ids.includes(s.id)) })).filter((c) => c.scenes.length) };
  const mediaPlan: Plan = source
    ? { ...plan, chapters: [...plan.chapters, { number: -1, title: "", scenes: [{ ...source, id: `${source.id}`, sfx: [...source.sfx, { id: "page-turn", at: 0 }] }] }] }
    : plan;
  return { plan, mediaPlan };
};
