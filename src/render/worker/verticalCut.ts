/**
 * D243 — الشورت يُقص من النسخة العمودية الكاملة وحدها (لا رندر عمودي منفصل لكل شورت).
 *
 * الماك يحسب مقاطع الشورت بالإطارات من خطة النسخة العمودية ووسائطها نفسها (verticalSceneSpans: بداية كل مشهد في
 * الحلقة بعد ذوبان الوصلة الداخلة، ونهايته عند بداية التالي)، ويكتب مهمة «cut» ببصمة ملف النسخة العمودية. العامل يجد
 * الملف في done/<مهمة العمودية>/ ويتحقق من بصمته، ثم يقص ويصل بـffmpeg.
 *
 * لماذا إعادة ترميز لا نسخ تيار (stream copy): نسخ التيار يقطع عند الإطارات المفتاحية وحدها (x264 يضعها كل ~٨ ثوانٍ
 * افتراضيًا)، فيبدأ الشورت قبل جملته أو بعدها، ويخالف D241 (لا بداية ولا نهاية في منتصف جملة). القص هنا دقيق بالإطار
 * (trim/atrim ثم concat للأجزاء غير المتتالية)، وبإعدادات النسخة العمودية نفسها (libx264 crf 14 slow، yuv420p، bt709،
 * AAC 320k)، فخسارة الجيل الثاني عند crf 14 لا تُرى؛ ثم العلو −14 LUFS للشورت وحده (كل ما يُنشر)، وتنظيف البيانات الوصفية.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { doneVideoName, queuePaths, safeRelative, sha256File, validateJobV2, type CutSpec, type WorkerJobV2, type WorkerResult } from "./protocol";
import { qualitySpec } from "../quality";
import { cleanMetadata } from "../episode";

const execFileP = promisify(execFile);

/** filter_complex للمقاطع: كل مقطع صورة وصوت من الصفر، ثم وصلها بالترتيب */
export const cutFilter = (ranges: CutSpec["ranges"], fps: number): string => {
  const parts: string[] = [];
  ranges.forEach((r, i) => {
    const a = (r.from / fps).toFixed(6), b = (r.to / fps).toFixed(6);
    parts.push(`[0:v]trim=start_frame=${r.from}:end_frame=${r.to},setpts=PTS-STARTPTS[v${i}]`);
    parts.push(`[0:a]atrim=start=${a}:end=${b},asetpts=PTS-STARTPTS[a${i}]`);
  });
  const inputs = ranges.map((_, i) => `[v${i}][a${i}]`).join("");
  parts.push(`${inputs}concat=n=${ranges.length}:v=1:a=1[v][a]`);
  return parts.join(";");
};

/** وسائط ffmpeg: إعادة ترميز بإعدادات جودة vertical نفسها (config.json ← video.quality.vertical) */
export const cutArgs = (input: string, output: string, ranges: CutSpec["ranges"], fps: number, q = qualitySpec("vertical")): string[] => [
  "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", input,
  "-filter_complex", cutFilter(ranges, fps), "-map", "[v]", "-map", "[a]",
  "-c:v", "libx264", "-preset", q.x264Preset, "-crf", String(q.crf), "-pix_fmt", "yuv420p", "-r", String(fps),
  "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709",
  "-c:a", "aac", "-b:a", q.audioBitrate, "-ar", "48000", "-map_metadata", "-1", "-movflags", "+faststart", output,
];

/** ملف النسخة العمودية لمهمة القص: ناتج مهمة vertical للاستوديو لهذه الحلقة في done/، ببصمتها المكتوبة في مهمة القص. */
export const resolveCutSource = async (share: string, job: WorkerJobV2) => {
  const cut = job.cut!;
  const dir = path.join(queuePaths(share).done, ...safeRelative(cut.source.job));
  if (!existsSync(dir)) throw new Error(`النسخة العمودية ${cut.source.job} غير موجودة في done/.`);
  const src = validateJobV2(JSON.parse(await readFile(path.join(dir, "job.json"), "utf8")));
  if (src.kind !== "vertical" || src.channel !== job.channel || src.episode !== job.episode || src.purpose !== "studio")
    throw new Error(`done/${cut.source.job} ليست النسخة العمودية لهذه الحلقة.`);
  if (src.inputs.planSha256 !== job.inputs.planSha256 || src.inputs.media.base !== job.inputs.media.base)
    throw new Error("مهمة القص ليست من خطة النسخة العمودية ووسائطها نفسها.");
  const result = JSON.parse(await readFile(path.join(dir, "result.json"), "utf8")) as WorkerResult;
  const file = path.join(dir, doneVideoName(src));
  const sha = await sha256File(file);
  if (sha !== cut.source.sha256 || sha !== result.sha256) throw new Error("بصمة النسخة العمودية لا تطابق مهمة القص.");
  return { file, sha256: sha, source: src };
};

/** يقص ويصل، ثم العلو وتنظيف البيانات الوصفية (على العامل؛ والماك يتحقق ويعيد التنظيف عند الاستلام). */
export const cutVertical = async (input: string, output: string, cut: CutSpec, meta: { title: string; artist: string }) => {
  const q = qualitySpec("vertical");
  await execFileP("ffmpeg", cutArgs(input, output, cut.ranges, cut.fps, q), { timeout: 2 * 3_600_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  const { normalizeProgramLoudness } = await import("../../studio/quality/normalize");
  await normalizeProgramLoudness(output, q.audioBitrate);
  await cleanMetadata(output, meta);
  return output;
};
