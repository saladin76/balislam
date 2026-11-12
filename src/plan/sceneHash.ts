/**
 * بصمة المشهد (القالب والإعدادات والتعليق والنبرة والصوت والخلفية…): تربط اعتماد كل لوحة في `storyboard.json`
 * وتقرير الحركة بمحتوى المشهد، فأي تعديل بعده يعيده للمراجعة. الحقول الجديدة لا تدخلها إلا حين تُستعمل،
 * فلا تتغير بصمات قائمة. نُقلت حرفًا من src/plan/sceneReview.ts حين حُذف سجل المراجعة القديم (D120).
 */
import { createHash } from "node:crypto";
import type { PlanScene as Scene } from "./types";

export const sceneHash = (s: Scene) => {
  const props = Object.fromEntries(Object.entries(s.props ?? {}).filter(([, v]) => v !== "" && v != null).sort(([a], [b]) => a.localeCompare(b)));
  return createHash("sha1")
    .update(JSON.stringify({ v: 2, t: s.template, p: props, n: s.narration.trim(), tone: s.tone ?? "", voice: s.voice ?? "", bg: s.backdrop ?? "", duration: s.durationSec ?? null, sfx: s.sfx ?? [], overlays: s.overlays ?? {}, captions: s.captions ?? null, ayahKey: s.ayahKey ?? "", ...(s.transition ? { transition: s.transition } : {}) }))
    .digest("hex")
    .slice(0, 12);
};
