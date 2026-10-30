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
/**
 * أقل وقت تحتاجه حركة النص على الشاشة حتى تكتمل (الكلمات تظهر تباعًا ثم قلم التمييز)،
 * حتى لا يُقطع المشهد قبل أن يُقرأ السؤال أو الفقاعة.
 */
const textSeconds = (scene: PlanScene): number => {
  const fps = config.video.fps;
  if (scene.template === "big-question") return (12 + words(scene.props.question ?? "") * 5 + 40) / fps + 0.8;
  if (scene.template === "sketch-board") {
    const items = (scene.props.items ?? "").split(/\n|؛/).filter((x) => x.trim()).slice(0, 4);
    return (Math.max(18, (scene.props.title ?? "").length * 1.1) + 60 + items.length * 26 + 50) / fps + 0.8;
  }
  if (scene.template === "glow-story") return (10 + Array.from(scene.props.quote ?? "").length * 1.5 + 50) / fps + 1;
  if (scene.template === "character-talk") return (16 + words(scene.props.line ?? "") * 4 + 30) / fps + 0.8;
  return 0;
};

export const sceneSeconds = (scene: PlanScene, media?: Pick<EpisodeMedia, "voice" | "recitations">): number => {
  const base = templateById(scene.template)?.baseSeconds ?? 5;
  const rec = scene.ayahKey ? media?.recitations[scene.ayahKey] : undefined;
  const clip = media?.voice[scene.id];
  const voiced = clip && clip.text === scene.narration.trim() ? clip : undefined;
  // المدة اليدوية تُحترم، لكنها لا تقطع الصوت أو التلاوة في منتصفهما
  if (scene.durationSec && scene.durationSec > 0) {
    const audio = scene.template === "verse-card" && rec ? rec.duration + 1 : voiced ? voiced.duration + 0.2 : 0;
    return Math.max(scene.durationSec, audio);
  }
  if (scene.template === "verse-card" && rec) return Math.max(base, rec.duration + 1.6);
  const min = Math.max(templateById(scene.template)?.minSeconds ?? MIN_SECONDS, textSeconds(scene));
  if (voiced) return Math.max(min, voiced.duration + config.voice.tailSeconds);
  const n = words(scene.narration);
  if (!n) return base;
  const spoken = (n / config.speech.wordsPerMinute) * 60 + 1.2;
  return Math.max(min, Math.round(spoken * 10) / 10);
};

export const sceneFrames = (scene: PlanScene, media?: Pick<EpisodeMedia, "voice" | "recitations">, fps = config.video.fps) =>
  Math.max(fps, Math.round(sceneSeconds(scene, media) * fps));
