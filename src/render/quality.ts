import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import config from "../../config.json";

/**
 * جودة الرندر (القاعدة الرابعة في CLAUDE.md):
 * - master: كل ما يُنشر (الحلقة والشورتس/الريلز): 4K (ضعف المقاس)، ترميز بطيء عالي الجودة، وصوت 320k.
 *   يوتيوب يعطي رفع 4K ترميزًا أعلى جودة حتى لمن يشاهد بدقة أقل.
 * - vertical: النسخة العمودية الكاملة 1080×1920 (D242) بإعدادات master نفسها بلا تكبير؛ منها تُقص الشورتس.
 * - preview: المعاينات السريعة فقط (بلا صوت، فصل للتأكد، الاستوديو)، ولا تُنشر.
 */
export type Quality = "master" | "vertical" | "preview";
/**
 * D242 (النسخة العمودية الكاملة): «vertical» 1080×1920 بإعدادات Master نفسها (crf 14، x264 slow، bt709، AAC 320k) لكن
 * بمقياس 1 لا 4K؛ تُرندر الحلقة كلها عمودية على الويندوز، ومنها وحدها تُقص الشورتس. ما يُنشر منه (الشورتس) يُضبط علوه
 * كـMaster (−14 LUFS).
 */
export const isPublishQuality = (q: Quality) => q === "master" || q === "vertical";
export type QualitySpec = {
  label: string; scale: number; crf: number; x264Preset: "slow" | "veryfast" | "medium" | "slower"; audioBitrate: `${number}k`;
  /** Browser tabs rendering at once. Master is 4K: on the owner's 8 GB Mac several 4K tabs swap the machine until
   *  Remotion's 30 s first-frame timeout kills the render (25 Nov, 001 «دفاتر الزمن»), so Master renders one tab at a time. */
  concurrency?: number;
  /** Per-frame delayRender / first-render timeout (ms); Remotion's 30 s default is too short for a 4K frame under load. */
  timeoutMs?: number;
};
export const QUALITY = config.video.quality as Record<Quality, QualitySpec>;

/**
 * The journey test (stabilization brief, work ٤) renders a REAL Master through the real pipeline, only tiny:
 * 320×180 (scale 1/6), fast encoder. BAL_E2E_RENDER=tiny is honoured only inside a test run (VITEST or BAL_E2E=1);
 * anywhere else it is refused loudly, so it can never shrink a Master on the owner's machine.
 */
export const TINY_E2E_SCALE = 1 / 6;
export const tinyE2eRender = (env: NodeJS.ProcessEnv = process.env): boolean => {
  const v = (env.BAL_E2E_RENDER ?? "").trim();
  if (!v) return false;
  if (v !== "tiny") throw new Error(`BAL_E2E_RENDER غير معروف: «${v}».`);
  if (!(env.VITEST || env.BAL_E2E === "1")) throw new Error("الرندر الصغير (BAL_E2E_RENDER=tiny) لاختبار الرحلة وحده، لا خارج الاختبارات.");
  return true;
};
/** The spec a render uses: the configured one, or the tiny e2e one inside the journey test. */
export const qualitySpec = (q: Quality): QualitySpec => tinyE2eRender()
  ? { ...QUALITY[q], scale: TINY_E2E_SCALE, crf: 30, x264Preset: "veryfast", audioBitrate: "96k" }
  : QUALITY[q];

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
