/**
 * وصل السرد بين المشاهد (شكوى المالك ١٦ نوفمبر: «يكون فيه فصلات في الكلام لأنها من تجميع المشاهد ولا يظهر انه سرد واحد
 * بدون توقف»). صافٍ بلا node: ولا قرص: يقرؤه Remotion (Master) والتجميع (src/studio/assembleScenes.ts) والفصول والترجمة
 * والسكون المقصود، فيبقى زمن كل مشهد واحدًا في كل مكان.
 *
 * كان الصمت عند الوصلة = ذيل المشهد (ذيل التصميم في دفاتر الزمن ١٫٠–١٫٩ ث، وذيل الصوت والحد في غيرها) + رأس التالي، فوق
 * بعضهما، بينما الفاصل بين جملتين في المشهد نفسه نحو ٠٫٢–٠٫٤٥ ث. الآن: يبدأ المشهد التالي فوق ذيل السابق، فيصير الصمت
 * بين آخر كلمة وأول كلمة = الفاصل بين جملتين («الفاصل بين الجمل والمشاهد»، D140)، وصورة السابق تذوب تحت التالي في
 * أول ٠٫٤ ث منه (أو أقل) بدل صمت ميت. ملفات المشاهد المعتمدة نفسها لا تتغير.
 *
 * لا يُمس (تبقى الوصلة كما هي، وتُذكر وقفة مقصودة): الآية وتلاوتها، وتمهيدها، والبسملة، والسكون المقصود (ذكر الله)،
 * والمشهد بلا كلام (بطاقة الفصل والختام)، والانتقال المختار في الخطة. ومدة المالك وزمن القراءة وحركة النص لا تُقص:
 * إن أطالت الصمت فوق المختار تُذكر في تقرير الوصلات (`over`) ولا تُغيَّر بصمت.
 */
import config from "../../config.json";
import type { PlanScene } from "./types";
import type { EpisodeMedia } from "./media";
import { sceneFrames, sceneHoldFloor } from "./duration";
import { defaultPauseMs, lastSentenceOf, paceExemption, pausedGap } from "../voice/paceCore";
import { hasBasmala } from "../voice/basmala";
import { engineEnabled } from "./engine";
import { parseTransition, transitionIssues } from "./transitions";

export const SEAM = {
  /** ذوبان صورة المشهد السابق تحت التالي (الحد الأعلى) */
  dissolveSec: 0.4,
  /** ما بعد آخر كلمة يبقى صوته كما هو (نَفَس آخر الحرف وهامش القص) قبل أي تلاشٍ للخلفية الصوتية */
  releaseSec: 0.15,
  /** تلاشٍ متساوي القدرة لخلفية الصوت (الهدوء بين الكلام) عند الوصلة: خروج السابق ودخول التالي */
  floorFadeSec: 0.1,
  /** لا يبدأ التالي قبل هذا بعد آخر كلمة من السابق (لا تظهر صورته على آخر كلمة) */
  afterSpeechSec: 0.05,
  /** سماح التقرير فوق الفاصل المختار (يغطي تقريب الإطار) */
  toleranceSec: 0.1,
} as const;

export type SeamPlan = {
  from: string;
  to: string;
  /** الفاصل المختار بين آخر كلمة وأول كلمة (ث)، أو null حين لا كلام على الجانبين */
  target: number | null;
  /** الصمت لو وُضع المشهدان متتاليين كما كان (ث) */
  stacked: number | null;
  /** الصمت في الحلقة الآن (ث) */
  gap: number | null;
  /** إطارات يبدأ فيها التالي قبل نهاية السابق */
  overlapFrames: number;
  /** إطارات ذوبان صورة السابق تحت التالي (من بداية التالي) */
  dissolveFrames: number;
  /** لماذا بقيت الوصلة كما هي (وقفة مقصودة)، إن بقيت */
  kept?: string;
  /** الصمت أطول من المختار + السماح: يراه المالك قبل المشاهدة، ولماذا */
  over?: string;
};

const voicedClip = (scene: PlanScene, media: Pick<EpisodeMedia, "voice">) => {
  const c = media.voice[scene.id];
  return c && c.text === scene.narration.trim() && Array.isArray(c.words) && c.words.length ? c : undefined;
};
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** انتقال صالح مختار في الخطة لهذا الزوج (كما يرسمه Episode.tsx) */
export const plannedTransition = (scene: PlanScene, prev: PlanScene, channelId?: string) => {
  if (!scene.transition || !engineEnabled("transitions", channelId)) return false;
  const r = parseTransition(scene.transition);
  return Boolean(r && r.ok && !transitionIssues(scene, prev).some((i) => i.level === "error"));
};

/** الفاصل المختار بعد آخر جملة في المشهد: وقفتها الطبيعية بعلامتها، مقصَّرة بـ«الفاصل» الذي طُبّق على صوته */
export const seamTarget = (scene: PlanScene, media: Pick<EpisodeMedia, "voice">) => {
  const clip = voicedClip(scene, media);
  const factor = clip?.paced?.pause ?? 1;
  return r3(pausedGap(defaultPauseMs(lastSentenceOf(scene.narration)) / 1000, factor));
};

const keptReason = (a: PlanScene, b: PlanScene, after: PlanScene | undefined, media: Pick<EpisodeMedia, "voice" | "recitations">, channelId?: string): string | null => {
  if (a.template === "verse-card" || b.template === "verse-card") return "آية: الوقفة قبل التلاوة وبعدها مقصودة";
  const ea = paceExemption(a, b), eb = paceExemption(b, after);
  if (ea || eb) return (ea ?? eb)!.replace(/^.*?: /, "");
  if (hasBasmala(a.narration) || hasBasmala(b.narration) || media.voice[a.id]?.basmala || media.voice[b.id]?.basmala) return "البسملة: تسجيلك كما هو";
  if (!voicedClip(a, media) || !voicedClip(b, media)) return a.narration.trim() && b.narration.trim() ? "صوت أحد المشهدين لم يُركَّب بعد" : "مشهد بلا كلام: وقفة بصرية";
  if (plannedTransition(b, a, channelId)) return "انتقال مختار في الخطة";
  return null;
};

/**
 * وصل كل مشهدين متتاليين في القائمة (ترتيب الحلقة كما تُعرض). fps كإعداد الرندر.
 * المشهد التالي يبدأ عند: آخر كلمة من السابق + الفاصل − رأس التالي قبل أول كلمته، ولا قبل ما يمسكه السابق
 * (sceneHoldFloor)، ولا قبل آخر كلمته بـ afterSpeechSec، ولا بعد نهايته.
 */
export const seamPlan = (scenes: PlanScene[], media: Pick<EpisodeMedia, "voice" | "recitations">, opts: { fps?: number; channelId?: string } = {}): SeamPlan[] => {
  const fps = opts.fps ?? config.video.fps;
  const out: SeamPlan[] = [];
  for (let i = 0; i + 1 < scenes.length; i++) {
    const a = scenes[i]!, b = scenes[i + 1]!;
    const ca = voicedClip(a, media), cb = voicedClip(b, media);
    const framesA = sceneFrames(a, media, fps);
    const S = framesA / fps;
    const endA = ca ? Math.max(...ca.words.map((w) => w.end)) : null;
    const headB = cb ? Math.min(...cb.words.map((w) => w.start)) : null;
    const stacked = endA !== null && headB !== null ? r3(S - endA + headB) : null;
    const target = ca && cb ? seamTarget(a, media) : null;
    const base = { from: a.id, to: b.id, target, stacked };
    const kept = keptReason(a, b, scenes[i + 2], media, opts.channelId);
    if (kept || endA === null || headB === null || target === null || stacked === null) {
      out.push({ ...base, gap: stacked, overlapFrames: 0, dissolveFrames: 0, kept: kept ?? "وقفة مقصودة" });
      continue;
    }
    const floor = sceneHoldFloor(a, media);
    const want = endA + target - headB;
    const start = Math.min(S, Math.max(want, floor, endA + SEAM.afterSpeechSec));
    // الإطار كاملًا: لا يقصر الصمت عن المختار بتقريب
    const overlapFrames = Math.max(0, Math.floor((S - start) * fps + 1e-6));
    const gap = r3(S - overlapFrames / fps - endA + headB);
    const dissolveFrames = Math.min(overlapFrames, Math.round(SEAM.dissolveSec * fps));
    let over: string | undefined;
    if (gap > target + SEAM.toleranceSec) {
      over = headB > target - SEAM.afterSpeechSec ? "أول المشهد التالي صامت قبل كلامه"
        : a.durationSec && a.durationSec > 0 ? "مدة المشهد التي حددتها تبقى كما هي" : "المشهد يمسك صورته للقراءة أو لحركة النص";
    }
    out.push({ ...base, gap, overlapFrames, dissolveFrames, ...(over ? { over } : {}) });
  }
  return out;
};

/** إطارات تقدّم الحلقة بعد بداية كل مشهد حتى بداية التالي (مدته ناقص ما يمر منه تحت التالي) */
export const sceneAdvanceFrames = (scenes: PlanScene[], media: Pick<EpisodeMedia, "voice" | "recitations">, opts: { fps?: number; channelId?: string } = {}): number[] => {
  const fps = opts.fps ?? config.video.fps;
  const seams = seamPlan(scenes, media, opts);
  return scenes.map((s, i) => sceneFrames(s, media, fps) - (seams[i]?.overlapFrames ?? 0));
};

/**
 * صوت المشهد عند الوصلتين: خلفيته (هدوء التسجيل بعد آخر كلمة) تتلاشى تلاشيًا متساوي القدرة في آخر عُشر ثانية من ملفه —
 * لا داخله ولا على كلمة — بينما تدخل خلفية التالي قبل أول كلمته، فلا ينقطع الهدوء إلى صمت رقمي ولا يُسمع «تك».
 */
export type SeamAudio = { fadeOutStart?: number; fadeOutSec?: number; fadeInSec?: number };
export const seamAudio = (scenes: PlanScene[], media: Pick<EpisodeMedia, "voice" | "recitations">, opts: { fps?: number; channelId?: string } = {}): SeamAudio[] => {
  const fps = opts.fps ?? config.video.fps;
  const seams = seamPlan(scenes, media, opts);
  return scenes.map((s, i) => {
    const out: SeamAudio = {};
    const next = seams[i], prev = seams[i - 1];
    const clip = voicedClip(s, media);
    if (next && next.overlapFrames > 0 && clip) {
      const startNext = (sceneFrames(s, media, fps) - next.overlapFrames) / fps;
      const endSpeech = Math.max(...clip.words.map((w) => w.end));
      // never inside the take: after the last word's release AND within the file's own last tenth of a second
      out.fadeOutStart = r3(Math.max(startNext, endSpeech + SEAM.releaseSec, clip.duration - SEAM.floorFadeSec));
      out.fadeOutSec = SEAM.floorFadeSec;
    }
    if (prev && prev.overlapFrames > 0 && clip) {
      const head = Math.min(...clip.words.map((w) => w.start));
      const d = Math.min(SEAM.floorFadeSec, Math.max(0, head - 0.02));
      if (d > 0.005) out.fadeInSec = r3(d);
    }
    return out;
  });
};

/** معامل علوّ الصوت عند الزمن t (ث من بداية المشهد) بتلاشٍ متساوي القدرة */
export const seamVolumeAt = (t: number, a: SeamAudio): number => {
  let v = 1;
  if (a.fadeInSec && t < a.fadeInSec) v *= Math.sin((Math.PI / 2) * Math.max(0, t / a.fadeInSec));
  if (a.fadeOutStart !== undefined && a.fadeOutSec && t > a.fadeOutStart) v *= Math.cos((Math.PI / 2) * Math.min(1, (t - a.fadeOutStart) / a.fadeOutSec));
  return v;
};
