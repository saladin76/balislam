import type { Plan, PlanScene } from "./types";
import type { EpisodeMedia } from "./media";
import { sceneSeconds } from "./duration";
import { intendedStillness, mergeSpans } from "../render/stillness";
import { AMBIENCE } from "../../brand/sfxMastering";

/**
 * D158، الخطوة ٢: قواعد خلط المؤثرات عند الرندر (القواعد ٤ و٥ من قرار المالك).
 * - التوقير: لا مؤثر في نافذة السكون المقصود نفسها التي تسكن فيها الصورة (src/render/stillness.ts: ذكر الله ±٠٫٢٥ ث،
 *   والبسملة، والدعاء، والآية، وتمهيدها، والآية الصامتة)، ولا مؤثر أصلًا في بطاقة آية أو لوح دعاء.
 * - صوت الجو ينخفض تحت كلام الراوي (ducking) ويعود في الصمت؛ وباقي المؤثرات بعلوها (المكتبة معالجة بأدوارها، الخطوة ١).
 * التحول ناعم (ramp) فلا «طقّة» عند الدخول والخروج.
 */
export const SFX_MIX = { duck: 0.35, ramp: 0.15, speechGap: 0.35 } as const;
export const SACRED_TEMPLATES = new Set(["verse-card", "dua-board"]);
export type Window = { from: number; to: number };

/** نوافذ السكون المقصود داخل المشهد بالثواني من أوله؛ المشهد التالي يعرّف «تمهيد الآية» */
export const sceneSacredSpans = (scene: PlanScene, next: PlanScene | undefined, media: Pick<EpisodeMedia, "voice" | "recitations">, channel?: string): Window[] => {
  const d = sceneSeconds(scene, media);
  if (SACRED_TEMPLATES.has(scene.template)) return [{ from: -1, to: d + 1 }];
  const plan = { version: 1, channel, chapters: [{ number: 1, title: "", scenes: next ? [scene, next] : [scene] }] } as unknown as Plan;
  return mergeSpans(intendedStillness(plan, 0, media)).filter((s) => s.from < d).map((s) => ({ from: s.from, to: Math.min(s.to, d + 1) }));
};

/** فترات كلام الراوي في المشهد (من توقيت كلماته المطابق لنصه)؛ الفجوات القصيرة تُضم */
export const speechSpans = (scene: PlanScene, media: Pick<EpisodeMedia, "voice">): Window[] => {
  const clip = media.voice[scene.id];
  if (!clip || clip.text !== scene.narration.trim() || !clip.words.length) return [];
  const out: Window[] = [];
  for (const w of clip.words) {
    const last = out[out.length - 1];
    if (last && w.start - last.to <= SFX_MIX.speechGap) last.to = Math.max(last.to, w.end);
    else out.push({ from: w.start, to: w.end });
  }
  return out;
};

/** ٠ داخل النافذة، ١ بعيدًا عنها بقدر ramp، وخطي بينهما */
const edge = (t: number, w: Window, ramp: number) => (t >= w.from && t <= w.to ? 0 : Math.min(1, Math.min(Math.abs(t - w.from), Math.abs(t - w.to)) / ramp));

/** معامل علو المؤثر عند الثانية t من أول المشهد */
export const sfxGainAt = (t: number, sacred: Window[], speech: Window[], ambience: boolean): number => {
  let g = 1;
  for (const w of sacred) g = Math.min(g, edge(t, w, SFX_MIX.ramp));
  if (ambience && speech.length) {
    const near = Math.min(...speech.map((w) => edge(t, w, SFX_MIX.ramp)));
    g *= SFX_MIX.duck + (1 - SFX_MIX.duck) * near;
  }
  return g;
};

export const isAmbience = (id: string) => AMBIENCE.has(id);
