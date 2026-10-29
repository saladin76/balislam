import config from "../../config.json";
import { templateById } from "./templates";
import type { PlanScene } from "./types";
import type { EpisodeMedia } from "./media";

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** أقصر مدة مقبولة لمشهد مهما قصر صوته. */
const MIN_SECONDS = 2.5;

/**
 * مدة المشهد بالثواني، بالأولوية:
 * 1) المدة اليدوية، 2) طول التلاوة المرخصة لبطاقة الآية، 3) طول صوت التعليق الحقيقي،
 * 4) تقدير من عدد الكلمات بسرعة الكلام في config.json.
 */
export const sceneSeconds = (scene: PlanScene, media?: Pick<EpisodeMedia, "voice" | "recitations">): number => {
  if (scene.durationSec && scene.durationSec > 0) return scene.durationSec;
  const base = templateById(scene.template)?.baseSeconds ?? 5;
  const rec = scene.ayahKey ? media?.recitations[scene.ayahKey] : undefined;
  if (scene.template === "verse-card" && rec) return Math.max(base, rec.duration + 1.6);
  const clip = media?.voice[scene.id];
  if (clip && clip.text === scene.narration.trim()) return Math.max(MIN_SECONDS, clip.duration + config.voice.tailSeconds);
  const n = words(scene.narration);
  if (!n) return base;
  const spoken = (n / config.speech.wordsPerMinute) * 60 + 1.2;
  return Math.max(Math.min(base, 4), Math.round(spoken * 10) / 10);
};

export const sceneFrames = (scene: PlanScene, media?: Pick<EpisodeMedia, "voice" | "recitations">, fps = config.video.fps) =>
  Math.max(fps, Math.round(sceneSeconds(scene, media) * fps));
