import config from "../../config.json";
import { templateById } from "./templates";
import type { PlanScene } from "./types";
import type { EpisodeMedia } from "./media";
import { recitationSeconds } from "../quran/recitationTimeline";
import { HZ_META, hzEstimateSeconds, hzSentences, verseWindow } from "../remotion/dafatir/horizon/meta";
import { timelineFromWords } from "../remotion/dafatir/horizon/timeline";
import { SILENCE_POLICY } from "../remotion/dafatir/audio/silence";
import type { VoiceClip } from "../voice/generate";

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/**
 * ذيل مشهد «خط الأفق» المسجَّل في توقيت صوته (timing.tail، يُحسب عند تركيب الصوت) لا يزيد على ذيل تصميمه الحالي
 * (HZ_META.tail، أو أقل خروج بصري إن كان أطول، أو باقي التسجيل بعد آخر صوت). تصحيح D217 (v17): ذيل الختام صار ١٫٠ ث في
 * التصميم، لكن صوته رُكّب قبل ذلك بذيل ٣٫٢ فبقي في الحلقة سكوت ٣٫١ ث في آخرها؛ ولا يُعاد تركيب صوت لذلك.
 */
const horizonTail = (scene: PlanScene, timing: NonNullable<VoiceClip["timing"]>, duration: number) => {
  const shot = String(scene.props.shot ?? "");
  const m = HZ_META[shot];
  if (!m) return timing.tail;
  const exit = ((scene.props as Record<string, string | undefined>).exit || m.exit) as keyof typeof SILENCE_POLICY.exitMin;
  const cap = Math.max(m.tail, SILENCE_POLICY.exitMin[exit] ?? 0, duration - timing.speechEnd);
  return Math.min(timing.tail, cap);
};
/** مدة مشهد «خط الأفق» من توقيت صوته بالذيل المقصوص (horizonTail) */
const horizonTimedSeconds = (scene: PlanScene, timing: NonNullable<VoiceClip["timing"]>, duration: number) =>
  timing.seconds - (timing.tail - horizonTail(scene, timing, duration));

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
  // KI-087 (١٨ نوفمبر): مشهد «خط الأفق» فيه آية صامتة لا تقصّره المدة اليدوية عن زمن قراءة آيته ولا عن كلامه وذيله —
  // مدة ١٢٫٥ ث على مشهد آيته تُقرأ في ١٧٫٨ كانت تُخرج الآية قبل قراءتها. باقي المشاهد كما قرر KI-068: قيمة المالك تُحترم
  // ولا تقطع صوت الراوي.
  const silentVerse = scene.template === "horizon-shot" && Boolean((scene.props as Record<string, unknown>).verseText);
  if (scene.durationSec && scene.durationSec > 0) {
    if (silentVerse && voiced) return Math.max(scene.durationSec, sceneSeconds({ ...scene, durationSec: undefined }, media));
    const audio = voiced ? voiced.duration + 0.2 : 0;
    return Math.max(scene.durationSec, audio);
  }
  // خط الأفق: ذيل كل مشهد من تصميمه (قلب الصفحة يحتاج وقته بعد آخر كلمة)
  if (scene.template === "horizon-shot") {
    const shot = String(scene.props.shot ?? "");
    const props = scene.props as Record<string, string | undefined>;
    if (voiced) {
      const m = HZ_META[shot];
      // دفاتر الزمن بأجزاء خريطة النبرة: المدة المقررة بسياسة الصمت (رأس + آخر كلام + ذيل الحد بمالك واحد)،
      // لا مدة الملف + ذيل التصميم (لا يجتمع صمت التسجيل مع الذيل ولا الذيل مع صمت ما قبل التلاوة)
      const base = voiced.timing ? horizonTimedSeconds(scene, voiced.timing, voiced.duration) : voiced.duration + (m?.tail ?? config.voice.tailSeconds);
      // أقل مدة بحسب التصميم (minEnd) مقدرة على التوقيت التقديري ثم مقيسة بنسبة طول الصوت الحقيقي
      // استشهاد بصري صامت (الأمر 032): زمن قراءة الآية يُحسب على كلمات الصوت الحقيقي نفسها التي يرسم بها HorizonShot
      // البطاقة، فلا يقصر المشهد عنه ولا يطول بتقدير؛ و0.9 ث بعده كما في التقدير (خروج البطاقة وقلب الصفحة)
      if (props.verseText && props.verseKey && voiced.words?.length) {
        try {
          const vw = verseWindow(props, timelineFromWords(hzSentences(scene.narration), voiced.words.map((w) => ({ word: w.word, start: w.start, end: w.end })), 0));
          if (vw) return Math.max(MIN_SECONDS, base, vw[1] + 0.3);
        } catch {
          // عدد الكلمات مختلف: يبقى الحساب أدناه
        }
      }
      const est = hzEstimateSeconds(scene.narration, shot, props);
      const plain = hzEstimateSeconds(scene.narration, shot);
      const extra = Math.max(0, est - plain);
      return Math.max(MIN_SECONDS, base + extra);
    }
    return Math.max(MIN_SECONDS, hzEstimateSeconds(scene.narration, shot, props));
  }
  const min = Math.max(templateById(scene.template)?.minSeconds ?? MIN_SECONDS, textSeconds(scene));
  // «الفاصل بين الجمل» المطبَّق يقصّر ذيل المشهد أيضًا (src/voice/pace.ts sceneTailFor)؛ بلا تطبيق كما كان
  if (voiced) return Math.max(min, voiced.duration + (voiced.paced?.tailSeconds ?? config.voice.tailSeconds));
  const n = words(scene.narration);
  if (!n) return base;
  const spoken = (n / config.speech.wordsPerMinute) * 60 + 1.2;
  return Math.max(min, Math.round(spoken * 10) / 10);
};

/**
 * أول لحظة (بالثواني من بداية المشهد) يجوز عندها أن يبدأ المشهد التالي فوقه (وصل السرد، src/plan/seams.ts):
 * بعد آخر كلمة، وبعد كل ما يمسكه المشهد عمدًا — مدة المالك (تُحترم كما هي)، وزمن قراءة الاستشهاد البصري، وزمن حركة
 * النص الذي يحتاجه القالب. ذيل الخروج وحده (قلب الصفحة، خفوت الحبر، الإمساك بعد الكلام) يجوز أن يمر تحت بداية التالي.
 * بلا صوت مطابق: المشهد كله.
 */
export const sceneHoldFloor = (scene: PlanScene, media?: Pick<EpisodeMedia, "voice" | "recitations">): number => {
  const S = sceneSeconds(scene, media);
  const clip = media?.voice[scene.id];
  const voiced = clip && clip.text === scene.narration.trim() && clip.words?.length ? clip : undefined;
  if (!voiced || scene.template === "verse-card") return S;
  const end = Math.max(...voiced.words.map((w) => w.end));
  const silentVerse = scene.template === "horizon-shot" && Boolean((scene.props as Record<string, unknown>).verseText);
  if (scene.durationSec && scene.durationSec > 0 && !silentVerse) return Math.min(S, Math.max(end, scene.durationSec));
  if (scene.template === "horizon-shot") {
    const shot = String(scene.props.shot ?? "");
    const m = HZ_META[shot];
    const props = scene.props as Record<string, string | undefined>;
    const tail = voiced.timing ? horizonTail(scene, voiced.timing, voiced.duration) : (m?.tail ?? config.voice.tailSeconds);
    let floor = Math.max(end, S - tail);
    if (props.verseText && props.verseKey) {
      try {
        const vw = verseWindow(props, timelineFromWords(hzSentences(scene.narration), voiced.words.map((w) => ({ word: w.word, start: w.start, end: w.end })), 0));
        if (vw) floor = Math.max(floor, vw[1]);
      } catch {
        return S;
      }
    }
    // مدة المالك تُمسك كما هي فوق نافذة الآية (KI-087)
    if (scene.durationSec && scene.durationSec > 0) floor = Math.max(floor, scene.durationSec);
    return Math.min(S, floor);
  }
  const min = Math.max(templateById(scene.template)?.minSeconds ?? MIN_SECONDS, textSeconds(scene));
  const audio = voiced.duration + (voiced.paced?.tailSeconds ?? config.voice.tailSeconds);
  // مدة يفرضها زمن حركة النص في القالب: تُمسك كلها
  return min > audio ? S : Math.min(S, end);
};

export const sceneFrames = (scene: PlanScene, media?: Pick<EpisodeMedia, "voice" | "recitations">, fps = config.video.fps) => {
  const rec = scene.template === "verse-card" && scene.ayahKey ? media?.recitations[scene.ayahKey] : undefined;
  if (rec && recitationSeconds(rec) > 0)
    return Math.max(1, Math.round(recitationSeconds(rec) * fps));
  return Math.max(fps, Math.round(sceneSeconds(scene, media) * fps));
};
