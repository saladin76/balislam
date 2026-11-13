/**
 * Step ٢: the quick preview drawn in the page (before the scene's AV draft is produced) — does it have sound, and the
 * one plain line under it (بلاغ المالك ١٣ نوفمبر، D131: «ليه بعد ما ولدت الصوت الفيديو فوق بلا صوت؟»).
 *
 * The scene's sound is its composed clip (voice/index.json): it exists only once every narration sentence of the scene
 * has a current take («يُركَّب صوت المشهد من جمله حين تُولَّد كلها»). Before that the preview is silent and says why,
 * with how many sentences are done; once the clip exists the preview plays WITH its sound (never left muted), and the
 * line says that the reviewed preview is made by «أنتج هذا المشهد». Pure: no React, no server call.
 */
import type { EpisodeMedia } from "../../../../src/plan/media";
import type { PlanScene } from "../../../../src/plan/types";

export type VoiceProgress = { done: number; total: number };
export type LiveAudio = { audible: boolean; line: string; key: string };

const ar = (n: number) => n.toLocaleString("ar-EG");
const sentences = (n: number) => (n === 1 ? "جملة واحدة" : n === 2 ? "جملتين" : n <= 10 ? `${ar(n)} جمل` : `${ar(n)} جملة`);

export const liveAudio = (scene: PlanScene | undefined, media: EpisodeMedia | undefined, progress?: VoiceProgress | null, current = true): LiveAudio => {
  if (!scene) return { audible: false, line: "معاينة صامتة", key: "silent" };
  if (scene.template === "verse-card") {
    const rec = scene.ayahKey ? media?.recitations?.[scene.ayahKey] : undefined;
    return rec ? { audible: true, line: "معاينة سريعة بالتلاوة", key: `rec:${scene.ayahKey}` }
      : { audible: false, line: "معاينة صامتة: مشهد الآية بلا تلاوة معتمدة بعد", key: "silent" };
  }
  const narr = scene.narration?.trim() ?? "";
  if (!narr) return { audible: false, line: "معاينة صامتة: مشهد بلا تعليق صوتي", key: "silent" };
  const clip = media?.voice?.[scene.id];
  if (clip && clip.text === narr)
    return { audible: true, key: `voice:${clip.file}`,
      line: current ? "معاينة سريعة بصوت المشهد — المعاينة التي تُعتمد يصنعها «أنتج هذا المشهد»" : "معاينة سريعة بصوت المشهد" };
  if (clip) return { audible: false, key: "silent", line: "معاينة صامتة لأن صوت المشهد سُجّل على نص سابق — ولّد جمله المتغيّرة تحتها، فيُركَّب من جديد" };
  if (progress && progress.total > 0) {
    if (progress.done >= progress.total)
      return { audible: false, key: "silent", line: "معاينة صامتة: جمل المشهد كلها بصوت، وصوت المشهد لم يُركَّب منها بعد — السبب تحت الجمل" };
    return { audible: false, key: "silent",
      line: `معاينة صامتة لأن صوت المشهد لم يُركَّب بعد — اكتمل صوت ${ar(progress.done)} من ${sentences(progress.total)}؛ يُركَّب حين تكتمل كلها` };
  }
  return { audible: false, key: "silent", line: "معاينة صامتة لأن صوت المشهد لم يُولَّد بعد — ولّد جمله تحتها، فيُركَّب صوت المشهد حين تكتمل" };
};

/** A preview with sound may start by itself only after the owner has clicked in the page (the browser refuses otherwise). */
export const mayAutoplayWithSound = (): boolean => {
  try { return Boolean((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive); }
  catch { return false; }
};
