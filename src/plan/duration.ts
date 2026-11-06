import config from "../../config.json";
import { templateById } from "./templates";
import type { PlanScene } from "./types";
import type { EpisodeMedia } from "./media";
import { recitationSeconds } from "../quran/recitationTimeline";
import { HZ_META, hzEstimateSeconds } from "../remotion/dafatir/horizon/meta";

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
  // قارئ الآية يبدأ مع كادر الآية وينتهي بانتهائه بالضبط؛ لا مقدمة أو ذيل صامت،
  // حتى لو كانت للخطة مدة يدوية قديمة أو حد ثابت للقالب.
  if (scene.template === "verse-card" && rec && recitationSeconds(rec) > 0)
    return recitationSeconds(rec);
  // المدة اليدوية لباقي القوالب تُحترم، لكنها لا تقطع صوت الراوي.
  if (scene.durationSec && scene.durationSec > 0) {
    const audio = voiced ? voiced.duration + 0.2 : 0;
    return Math.max(scene.durationSec, audio);
  }
  // خط الأفق: ذيل كل مشهد من تصميمه (قلب الصفحة يحتاج وقته بعد آخر كلمة)
  if (scene.template === "horizon-shot") {
    const shot = String(scene.props.shot ?? "");
    const props = scene.props as Record<string, string | undefined>;
    if (voiced) {
      const m = HZ_META[shot];
      const base = voiced.duration + (m?.tail ?? config.voice.tailSeconds);
      // أقل مدة بحسب التصميم (minEnd) مقدرة على التوقيت التقديري ثم مقيسة بنسبة طول الصوت الحقيقي
      const est = hzEstimateSeconds(scene.narration, shot, props);
      const plain = hzEstimateSeconds(scene.narration, shot);
      const extra = Math.max(0, est - plain);
      return Math.max(MIN_SECONDS, base + extra);
    }
    return Math.max(MIN_SECONDS, hzEstimateSeconds(scene.narration, shot, props));
  }
  const min = Math.max(templateById(scene.template)?.minSeconds ?? MIN_SECONDS, textSeconds(scene));
  if (voiced) return Math.max(min, voiced.duration + config.voice.tailSeconds);
  const n = words(scene.narration);
  if (!n) return base;
  const spoken = (n / config.speech.wordsPerMinute) * 60 + 1.2;
  return Math.max(min, Math.round(spoken * 10) / 10);
};

export const sceneFrames = (scene: PlanScene, media?: Pick<EpisodeMedia, "voice" | "recitations">, fps = config.video.fps) => {
  const rec = scene.template === "verse-card" && scene.ayahKey ? media?.recitations[scene.ayahKey] : undefined;
  if (rec && recitationSeconds(rec) > 0)
    return Math.max(1, Math.round(recitationSeconds(rec) * fps));
  return Math.max(fps, Math.round(sceneSeconds(scene, media) * fps));
};
