import config from "../../config.json";
import type { Identity } from "../../brand/identity/index";
import { sceneSeconds } from "../plan/duration";
import { estimateTimings } from "../remotion/scenes/timing";
import type { EpisodeMedia } from "../plan/media";
import type { Plan, PlanScene } from "../plan/types";

const ts = (sec: number) => {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(r).padStart(3, "0")}`;
};

/**
 * ملف ترجمة عربية SRT يُرفع إلى يوتيوب مع الفيديو. يستخدم توقيت كلمات الصوت الحقيقي،
 * وإن لم يوجد صوت يقدّر التوقيت. السطر الواحد بعدد كلمات سطر الترجمة في الهوية.
 */
export const buildSrt = (plan: Plan, scenes: PlanScene[], media: EpisodeMedia, identity?: Pick<Identity, "motion">): string => {
  const per = Math.max(3, identity?.motion.captionWords ?? 6);
  const fps = config.video.fps;
  const cues: { start: number; end: number; text: string }[] = [];
  let offset = 0;
  for (const scene of scenes) {
    const dur = sceneSeconds(scene, media);
    const clip = media.voice[scene.id];
    const words =
      clip && clip.text === scene.narration.trim()
        ? clip.words
        : scene.narration
          ? estimateTimings(scene.narration, 6, Math.round(dur * fps) - 12).map((w) => ({ word: w.word, start: w.start / fps, end: w.end / fps }))
          : [];
    for (let i = 0; i < words.length; i += per) {
      const chunk = words.slice(i, i + per);
      cues.push({ start: offset + chunk[0]!.start, end: offset + chunk[chunk.length - 1]!.end + 0.15, text: chunk.map((w) => w.word).join(" ") });
    }
    offset += dur;
  }
  return cues
    .map((c, i) => {
      const next = cues[i + 1]?.start ?? Infinity;
      const end = Math.max(c.start + 0.05, Math.min(Math.max(c.end, c.start + 0.6), next - 0.02));
      return `${i + 1}\n${ts(c.start)} --> ${ts(end)}\n${c.text}\n`;
    })
    .join("\n");
};
