import config from "../../config.json";
import { templateById } from "./templates";
import type { PlanScene } from "./types";

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** مدة المشهد بالثواني: اليدوية إن وُجدت، وإلا من طول التعليق بسرعة الكلام في config.json. */
export const sceneSeconds = (scene: PlanScene): number => {
  if (scene.durationSec && scene.durationSec > 0) return scene.durationSec;
  const base = templateById(scene.template)?.baseSeconds ?? 5;
  const n = words(scene.narration);
  if (!n) return base;
  const spoken = (n / config.speech.wordsPerMinute) * 60 + 1.2;
  return Math.max(Math.min(base, 4), Math.round(spoken * 10) / 10);
};

export const sceneFrames = (scene: PlanScene, fps = config.video.fps) => Math.max(fps, Math.round(sceneSeconds(scene) * fps));
