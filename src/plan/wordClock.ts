/**
 * لحظة بداية كل كلمة في المشهد بالإطارات، كما يرسمها المشهد في المعاينة (D56): من صوت الراوي إن طابق نصه،
 * وإلا من التقدير الذي يستعمله القالب نفسه. يستعملها محرر المشهد ليقفز بالمعاينة الصغيرة إلى كلمة مختارة.
 * سجل بالقالب (لا بالقناة): القالب الذي يقدّر توقيته بطريقة خاصة يضيف ساعته هنا.
 */
import type { PlanScene } from "./types";
import { estimateTimings } from "../remotion/scenes/timing";
import { buildTimeline, timelineFromWords } from "../remotion/dafatir/horizon/timeline";
import { HZ_LEAD, hzSentences } from "../remotion/dafatir/horizon/meta";
import { sentenceTokens } from "./sceneSlots";

type Words = { word: string; start: number; end: number }[];
type Clock = (narration: string, words: Words | undefined, dur: number, fps: number) => number[];

const horizon: Clock = (narration, words, _dur, fps) => {
  const sentences = hzSentences(narration);
  let tl = buildTimeline(sentences, HZ_LEAD);
  if (words?.length) {
    try { tl = timelineFromWords(sentences, words, 0); } catch { /* عدد الكلمات مختلف: يبقى التقدير كما في المشهد */ }
  }
  return tl.words.map((w) => Math.round(w.s * fps));
};

const CLOCKS: Record<string, Clock> = { "horizon-shot": horizon };

/** بداية كل كلمة من كلمات sentenceTokens بالإطارات */
export const wordStartFrames = (scene: PlanScene, media: { voice: Record<string, { text: string; words: Words }> } | undefined, dur: number, fps: number): number[] => {
  const narration = scene.narration ?? "";
  const n = sentenceTokens(narration).length;
  const clip = media?.voice[scene.id];
  const words = clip && clip.text === narration.trim() ? clip.words : undefined;
  const own = CLOCKS[scene.template];
  if (own) {
    const out = own(narration, words, dur, fps);
    if (out.length === n) return out;
  }
  if (words && words.length === n) return words.map((w) => Math.round(w.start * fps));
  return estimateTimings(sentenceTokens(narration).map((t) => t.raw).join(" "), 6, dur - 12).map((t) => t.start);
};
