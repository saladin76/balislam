/**
 * D242 — مقاطع الشورت داخل النسخة العمودية الكاملة (نقي، بلا قرص ولا رندر).
 *
 * النسخة العمودية هي تكوين «الحلقة» نفسه عموديًا (Episode.tsx): كل مشهد يبدأ بعد السابق بطوله ناقصًا وصلة السرد بينهما
 * (seamPlan.overlapFrames، الصورة التالية تذوب فوق ذيل السابق). لذلك يبدأ مقطع المشهد في القص بعد انتهاء الوصلة الداخلة
 * (لا يُرى فيه ذيل المشهد السابق)، وينتهي عند بداية المشهد التالي (قبل أن يبدأ ذوبانه). والأجزاء المتتالية من الخطة مقطع
 * واحد بوصلاتها الداخلية كما في الحلقة؛ وغير المتتالية (D241: segments) تُوصل بقطع مباشر.
 */
import config from "../../../config.json";
import { sceneFrames } from "../../plan/duration";
import { seamPlan } from "../../plan/seams";
import type { EpisodeMedia } from "../../plan/media";
import type { Plan, PlanScene } from "../../plan/types";
import type { ShortSegment } from "../../plan/shorts";
import type { CutSpec } from "./protocol";

export const VERTICAL_FPS = (config as { video: { fps: number } }).video.fps;

export type SceneSpan = {
  id: string;
  /** أول إطار للمشهد في الحلقة (تبدأ عنده وصلته الداخلة) */
  start: number;
  /** أول إطار بعد انتهاء الوصلة الداخلة: هنا يبدأ القص */
  clean: number;
  /** بداية المشهد التالي (أو آخر الحلقة): هنا ينتهي القص */
  end: number;
};

/** مواضع كل مشاهد الحلقة في النسخة العمودية بالإطارات، بترتيب الخطة كاملة (introFrames: الافتتاحية إن وُجدت) */
export const verticalSceneSpans = (plan: Pick<Plan, "chapters" | "channel">, media: EpisodeMedia, introFrames = 0, fps = VERTICAL_FPS): SceneSpan[] => {
  const scenes: PlanScene[] = plan.chapters.flatMap((c) => c.scenes);
  const seams = seamPlan(scenes, media, { fps, channelId: plan.channel });
  const out: SceneSpan[] = [];
  let t = introFrames;
  scenes.forEach((s, i) => {
    const frames = sceneFrames(s, media, fps);
    const overlapIn = i > 0 ? seams[i - 1]?.overlapFrames ?? 0 : 0;
    const end = t + frames - (seams[i]?.overlapFrames ?? 0);
    out.push({ id: s.id, start: t, clean: Math.min(t + overlapIn, end - 1), end });
    t = end;
  });
  return out;
};

/** أجزاء الشورت: أجزاؤه المعلنة (D241)، وإلا كل تتابع متصل من مشاهده في ترتيب الحلقة جزء */
export const shortRuns = (spans: SceneSpan[], seg: Pick<ShortSegment, "sceneIds" | "parts">): string[][] => {
  if (seg.parts?.length) return seg.parts;
  const at = new Map(spans.map((s, i) => [s.id, i]));
  const runs: string[][] = [];
  let prev = -2;
  for (const id of seg.sceneIds) {
    const i = at.get(id);
    if (i === undefined) throw new Error(`المشهد ${id} ليس في النسخة العمودية.`);
    if (i === prev + 1 && runs.length) runs[runs.length - 1]!.push(id); else runs.push([id]);
    prev = i;
  }
  return runs;
};

/** مقاطع القص بالإطارات لشورت واحد، بترتيب الحلقة ولا تتداخل */
export const cutRangesFor = (spans: SceneSpan[], seg: Pick<ShortSegment, "sceneIds" | "parts">): CutSpec["ranges"] => {
  const byId = new Map(spans.map((s) => [s.id, s]));
  const ranges = shortRuns(spans, seg).map((run) => {
    const a = byId.get(run[0]!), b = byId.get(run[run.length - 1]!);
    if (!a || !b) throw new Error(`مشاهد الجزء ${run.join("،")} ليست في النسخة العمودية.`);
    return { from: a.clean, to: b.end };
  });
  for (let i = 1; i < ranges.length; i++)
    if (ranges[i]!.from < ranges[i - 1]!.to) throw new Error("أجزاء الشورت متداخلة أو بغير ترتيب الحلقة.");
  return ranges;
};

export const cutSeconds = (ranges: CutSpec["ranges"], fps = VERTICAL_FPS) => Math.round((ranges.reduce((n, r) => n + r.to - r.from, 0) / fps) * 1000) / 1000;

/**
 * بداية كل مشهد من مشاهد الشورت داخل الملف المقصوص بالثواني (قد تكون سالبة قليلًا لأول مشهد في جزء: قُص منه ذيل الوصلة):
 * للترجمة (buildSrt) حتى تطابق الكلمات صوتها في الشورت المقصوص.
 */
export const sceneStartsInCut = (spans: SceneSpan[], seg: Pick<ShortSegment, "sceneIds" | "parts">, ranges = cutRangesFor(spans, seg), fps = VERTICAL_FPS): Map<string, number> => {
  const byId = new Map(spans.map((s) => [s.id, s]));
  const out = new Map<string, number>();
  let offset = 0;
  shortRuns(spans, seg).forEach((run, k) => {
    const r = ranges[k]!;
    for (const id of run) out.set(id, (offset + byId.get(id)!.start - r.from) / fps);
    offset += r.to - r.from;
  });
  return out;
};
