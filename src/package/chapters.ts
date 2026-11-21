/**
 * فصول يوتيوب من حدود المشاهد الحقيقية (خطة «احترافية بلا مثيل»، المرحلة ٢ البند ٢).
 *
 * المالك يختار المشهد الذي يبدأ عنده كل فصل ويكتب عنوانه (`publish.json` ← `long.chapters`)، فللنص المتصل
 * («دفاتر الزمن 001»: قسم واحد بلا عنوان) فصول أيضًا. الوقت لا يُكتب يدويًا أبدًا: يُحسب من بداية المشهد في الملف
 * المجمَّع نفسه (`sceneSeconds` في سجل التجميع `previews/episode.seams.json`، وفيه قصّ بداية الحلقة `headTrimmed`
 * مطروحًا من المشهد الأول، KI-091)، وقبل التجميع من الخطة ويُعلَّم «تقديري» للاستوديو وحده.
 *
 * قواعد يوتيوب: الأول 0:00، وثلاثة فصول على الأقل، وكل فصل ١٠ ثوانٍ على الأقل، والأوقات تصاعدية، ولا فصل
 * عند نهاية الفيديو أو بعدها؛ وعنوان كل فصل تام بلا أثر لأدوات الإنتاج.
 */
import config from "../../config.json";
import { introFramesFor } from "../remotion/scenes/ChannelIntro";
import { sceneAdvanceFrames } from "../plan/seams";
import { emptyMedia, type EpisodeMedia } from "../plan/media";
import type { Plan } from "../plan/types";
import type { ChannelInfo } from "../channel/types";
import type { RealTimings } from "./chapterTimes";
import { findTraces } from "./traces";

export type ChapterMark = { sceneId: string; title: string };
export type SceneStarts = { starts: Record<string, number>; total: number; estimated: boolean };
export type ChapterIssue = { level: "error" | "warning"; message: string };

/** YouTube: at least three chapters, each at least ten seconds. */
export const CHAPTERS_MIN = 3;
export const CHAPTER_MIN_SECONDS = 10;

/**
 * Where every scene starts in the published file. Real (assembled cuts, `real.sceneSeconds`) when every scene has
 * one, else the plan's timing (exactly what the renderer uses) and `estimated`.
 */
export const sceneStartsFor = (plan: Plan, media?: EpisodeMedia, channel?: ChannelInfo, real: RealTimings = {}): SceneStarts => {
  const fps = config.video.fps;
  const scenes = plan.chapters.flatMap((c) => c.scenes);
  const intro = introFramesFor(channel, plan) / fps;
  const cuts = real.sceneSeconds;
  const assembled = Boolean(cuts && scenes.length && scenes.every((s) => Number.isFinite(cuts[s.id]) && (cuts[s.id] ?? 0) > 0));
  const lengths = assembled
    ? scenes.map((s) => cuts![s.id]!)
    : sceneAdvanceFrames(scenes, media ?? emptyMedia, { channelId: plan.channel }).map((f) => f / fps);
  const sum = lengths.reduce((n, x) => n + x, 0);
  const master = real.totalSeconds && real.totalSeconds > 0 ? real.totalSeconds : undefined;
  const total = master ?? intro + sum;
  // The Master may carry the channel intro in front of the same cuts (D155 made it none); never more than the intro.
  let t = Math.min(Math.max(total - sum, 0), intro);
  const starts: Record<string, number> = {};
  scenes.forEach((s, i) => { starts[s.id] = i === 0 ? 0 : t; t += lengths[i]!; });
  if (scenes[0]) starts[scenes[0].id] = 0;
  return { starts, total, estimated: !assembled };
};

const clock = (sec: number) => {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60));
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${mm.padStart(2, "0")}:${ss}` : `${mm}:${ss}`;
};

/** The marks in time order with their real start, and every rule YouTube enforces (an error = chapters would not show). */
export const resolveChapters = (marks: ChapterMark[], at: SceneStarts): { lines: string[]; times: { mark: ChapterMark; start: number }[]; issues: ChapterIssue[] } => {
  const issues: ChapterIssue[] = [];
  const err = (message: string) => issues.push({ level: "error", message });
  const times: { mark: ChapterMark; start: number }[] = [];
  for (const m of marks) {
    const start = at.starts[m.sceneId];
    if (start === undefined) { err(`الفصل «${m.title || "بلا عنوان"}»: المشهد ${m.sceneId} ليس في الخطة.`); continue; }
    times.push({ mark: m, start });
  }
  times.sort((a, b) => a.start - b.start);
  if (times[0] && times[0].start !== 0) err("الفصل الأول يبدأ من أول مشهد (0:00)؛ يوتيوب لا يعرض الفصول بدونه.");
  if (times.length < CHAPTERS_MIN) err(`${times.length} فصول؛ يوتيوب يعرض الفصول من ${CHAPTERS_MIN} فأكثر.`);
  times.forEach((x, i) => {
    const name = `الفصل «${x.mark.title.trim() || "بلا عنوان"}»`;
    if (!x.mark.title.trim()) err(`${name}: اكتب عنوانه.`);
    const hits = findTraces(x.mark.title);
    if (hits.length) err(`${name}: أثر أدوات الإنتاج: ${hits.join("، ")}.`);
    const next = times[i + 1]?.start ?? at.total;
    if (next - x.start < CHAPTER_MIN_SECONDS) err(`${name}: ${Math.max(0, Math.round(next - x.start))} ث؛ كل فصل ${CHAPTER_MIN_SECONDS} ثوانٍ على الأقل.`);
    if (i > 0 && x.start === times[i - 1]!.start) err(`${name}: يبدأ عند الفصل الذي قبله.`);
  });
  if (at.estimated && times.length) issues.push({ level: "warning", message: "التوقيتات تقديرية من الخطة حتى تُجمَّع المشاهد المعتمدة؛ تُحسب بعدها من الملف نفسه." });
  return { lines: times.map((x) => `${clock(x.start)} ${x.mark.title.trim()}`), times, issues };
};

/** The «فصول الحلقة» block for the description, or "" when the marks would not show on YouTube. */
export const chapterMarksText = (marks: ChapterMark[], at: SceneStarts, heading = "فصول الحلقة:") => {
  const r = resolveChapters(marks, at);
  return r.issues.some((i) => i.level === "error") ? "" : [heading, ...r.lines].join("\n");
};
