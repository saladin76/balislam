/**
 * معاينة موضعية صامتة لمشاهد مختارة من حلقة (بالإسلام، الحلقة 001 · حدث الميزان): بهوية القناة نفسها
 * وتوقيت المشهد كما في الحلقة (التقديري إن لم يوجد صوت)، بلا افتتاحية ولا شاشة نهاية، وبجودة المعاينة.
 * لا تغيّر الخطة ولا الاعتمادات، ولا تُنشر؛ والرفع إلى «المعاينات» خطوة منفصلة (upload-preview).
 */
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { loadPlan } from "../plan/io";
import type { Plan } from "../plan/types";
import { projectRoot } from "../config/paths";
import { renderEpisode } from "./episode";

/** خطة جزئية: المشاهد المطلوبة بترتيبها في الحلقة، في فصولها، بلا افتتاحية */
export const planForScenes = (plan: Plan, ids: string[]): Plan => {
  const want = new Set(ids);
  const chapters = plan.chapters.map((c) => ({ ...c, scenes: c.scenes.filter((s) => want.has(s.id)) })).filter((c) => c.scenes.length);
  const found = new Set(chapters.flatMap((c) => c.scenes.map((s) => s.id)));
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) throw new Error(`مشاهد غير موجودة في الخطة: ${missing.join("، ")}`);
  return { ...plan, intro: false, chapters };
};

export const renderScenesPreview = async (o: { episode: string; ids: string[]; orientation: "landscape" | "portrait"; out?: string; onProgress?: (pct: number, msg: string) => void }) => {
  const plan = await loadPlan(o.episode);
  if (!plan) throw new Error(`لا خطة للحلقة ${o.episode}`);
  const part = planForScenes(plan, o.ids);
  const out = o.out ?? path.join(projectRoot, "renders", "scenes", `${plan.episode || o.episode}-${o.ids.join("_")}-${o.orientation}.mp4`);
  await mkdir(path.dirname(out), { recursive: true });
  return renderEpisode({ episode: o.episode, plan: part, orientation: o.orientation, quality: "preview", outFile: out, onProgress: o.onProgress });
};
