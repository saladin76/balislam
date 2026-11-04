import type { Plan } from "../plan/types";
import type { EpisodeMedia } from "../plan/media";
import { sceneSeconds } from "../plan/duration";
import { normalizeArabic } from "../script/quranMeta";
import { estimateTimings } from "../remotion/scenes/timing";

/**
 * السكون المقصود (قرار صاحب القناة، مراجعة G5 للحلقة 001 بزبدة الكتب): لا تُفرض حركة عند كلام الله
 * ولا عند ذكره. هذه المقاطع تُستثنى من نسبة الحركة الوظيفية ومن «المقاطع الساكنة»، ويُعلن زمنها في التقرير.
 * - مشهد الآية (verse-card) كله، وتمهيد الآية (ink-shot بمشهد verse-intro-*).
 * - كل ذكر لله داخل أي مشهد: من قبل الكلمة بربع ثانية إلى بعدها بربع ثانية.
 */
export const SACRED_WORD = /الله|لله|ربنا|ربه|ربك|سبحانه|تعالي|تعالى/;

export type Span = { from: number; to: number; why: string };

export const intendedStillness = (plan: Plan, startSec: number, media?: Pick<EpisodeMedia, "voice" | "recitations">, chapter?: number): Span[] => {
  const spans: Span[] = [];
  let t = startSec;
  for (const c of plan.chapters) {
    if (chapter && c.number !== chapter) continue;
    for (const s of c.scenes) {
      const d = sceneSeconds(s, media);
      const shot = String(s.props?.shot ?? "");
      if (s.template === "verse-card") spans.push({ from: t, to: t + d, why: "آية" });
      else if (s.template === "ink-shot" && shot.startsWith("verse-intro")) spans.push({ from: t, to: t + d, why: "تمهيد آية" });
      else if (s.narration) {
        const clip = media?.voice[s.id];
        const words = clip && clip.text === s.narration.trim() ? clip.words.map((w) => ({ word: w.word, start: w.start * 30, end: w.end * 30 })) : estimateTimings(s.narration, 6, Math.round(d * 30) - 12);
        for (const w of words) if (SACRED_WORD.test(normalizeArabic(w.word))) spans.push({ from: t + w.start / 30 - 0.25, to: t + w.end / 30 + 0.25, why: "ذكر الله" });
      }
      t += d;
    }
  }
  return spans;
};

/** دمج الفترات المتداخلة أو المتلاصقة، فلا تُحسب مساحة التداخل مرتين (ذكران متقاربان، أو ذكر داخل مشهد آية) */
export const mergeSpans = (spans: Span[]): Span[] => {
  const sorted = [...spans].filter((x) => x.to > x.from).sort((a, b) => a.from - b.from);
  const out: Span[] = [];
  for (const x of sorted) {
    const last = out[out.length - 1];
    if (last && x.from <= last.to) {
      last.to = Math.max(last.to, x.to);
      if (!last.why.split("، ").includes(x.why)) last.why += `، ${x.why}`;
    } else out.push({ ...x });
  }
  return out;
};

/** الثواني الصحيحة التي يغطي السكون المقصود أغلبها (بعد دمج الفترات المتداخلة) */
export const exemptSeconds = (spans: Span[], seconds: number): Set<number> => {
  const out = new Set<number>();
  const merged = mergeSpans(spans);
  for (let s = 0; s < seconds; s++) {
    const cover = merged.reduce((a, x) => a + Math.max(0, Math.min(s + 1, x.to) - Math.max(s, x.from)), 0);
    if (cover >= 0.5) out.add(s);
  }
  return out;
};

/** ثواني السكون المقصود في فيديو مرندر من الخطة (الحلقة كلها أو فصل واحد للشورت) */
export const exemptForRender = async (plan: Plan, media?: Pick<EpisodeMedia, "voice" | "recitations">, chapter?: number): Promise<Set<number>> => {
  const { introFramesFor } = await import("../remotion/scenes/ChannelIntro");
  const { channelInfo, loadChannel } = await import("../channel/index");
  const start = introFramesFor(channelInfo(loadChannel()), plan, chapter) / 30;
  const spans = intendedStillness(plan, start, media, chapter);
  const end = spans.reduce((a, x) => Math.max(a, x.to), 0);
  return exemptSeconds(spans, Math.ceil(end) + 1);
};
