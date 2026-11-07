import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import config from "../../config.json";

/**
 * جودة الرندر (القاعدة الرابعة في CLAUDE.md):
 * - master: كل ما يُنشر (الحلقة والشورتس/الريلز): 4K (ضعف المقاس)، ترميز بطيء عالي الجودة، وصوت 320k.
 *   يوتيوب يعطي رفع 4K ترميزًا أعلى جودة حتى لمن يشاهد بدقة أقل.
 * - preview: المعاينات السريعة فقط (بلا صوت، فصل للتأكد، الاستوديو)، ولا تُنشر.
 */
export type Quality = "master" | "preview";
export type QualitySpec = { label: string; scale: number; crf: number; x264Preset: "slow" | "veryfast" | "medium" | "slower"; audioBitrate: `${number}k` };
export const QUALITY = config.video.quality as Record<Quality, QualitySpec>;

/** ما يُكتب بجوار ملفات الحزمة: بأي جودة رُندرت الحلقة، وهل بصوت كامل */
export type RenderInfo = { quality: Quality; label: string; width: number; height: number; voiced: boolean; at: string; /** Selected immutable output filename, when a previous filename was already occupied. */ outputFile?: string };
export const renderInfoFile = (packageDir: string) => path.join(packageDir, "render.json");
export const readRenderInfo = async (packageDir: string): Promise<RenderInfo | null> =>
  existsSync(renderInfoFile(packageDir)) ? JSON.parse(await readFile(renderInfoFile(packageDir), "utf8")) : null;

/** اعتماد النسخة الأساسية: يُحفظ في status.json ببصمة ملف الحلقة (الحجم ووقت التعديل)؛ أي رندر جديد يلغيه */
export type Approval = { at: string; size: number; mtime: number };
export const approvalValid = (approved: Approval | undefined, episodeFile: string) => {
  if (!approved || !existsSync(episodeFile)) return false;
  const st = statSync(episodeFile);
  return st.size === approved.size && Math.abs(st.mtimeMs - approved.mtime) < 1;
};
