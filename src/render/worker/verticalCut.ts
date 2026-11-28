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
 *
 * عنوان الشورت (قرار المالك ٢٨ نوفمبر): العنوان القصير (خطاف الشورت) أول ثلاث ثوانٍ فقط داخل المنطقة الآمنة ثم يختفي. يُرسم
 * بأسلوب القناة صورةً شفافة (تكوين «short-title»، ShortTitleStill) على العامل، ويُركَّب في إعادة الترميز نفسها بتلاشٍ ٠٫٣ ث
 * عند الظهور والغياب. مدته يحسبها الماك (لا يظهر في نافذة سكون مقصود)، ونصه يمر بفحص الأثر على الماك وعلى العامل.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { doneVideoName, queuePaths, safeRelative, sha256File, validateJobV2, type CutSpec, type WorkerJobV2, type WorkerResult } from "./protocol";
import { qualitySpec } from "../quality";
import { cleanMetadata } from "../episode";
import { findTraces } from "../../package/traces";

const execFileP = promisify(execFile);

/** تلاشي ظهور العنوان وغيابه بالثواني (كـ SHORT_TITLE_FADE_SEC في الرندر) */
export const TITLE_FADE_SEC = 0.3;

/** filter_complex للمقاطع: كل مقطع صورة وصوت من الصفر، ثم وصلها بالترتيب؛ وإن وُجد عنوان (الإدخال الثاني PNG) يُركَّب أول ثوانيه */
export const cutFilter = (ranges: CutSpec["ranges"], fps: number, titleSeconds?: number): string => {
  const parts: string[] = [];
  ranges.forEach((r, i) => {
    const a = (r.from / fps).toFixed(6), b = (r.to / fps).toFixed(6);
    parts.push(`[0:v]trim=start_frame=${r.from}:end_frame=${r.to},setpts=PTS-STARTPTS[v${i}]`);
    parts.push(`[0:a]atrim=start=${a}:end=${b},asetpts=PTS-STARTPTS[a${i}]`);
  });
  const inputs = ranges.map((_, i) => `[v${i}][a${i}]`).join("");
  if (!titleSeconds) {
    parts.push(`${inputs}concat=n=${ranges.length}:v=1:a=1[v][a]`);
    return parts.join(";");
  }
  const out = Math.max(0, titleSeconds - TITLE_FADE_SEC).toFixed(3);
  parts.push(`${inputs}concat=n=${ranges.length}:v=1:a=1[vc][a]`);
  parts.push(`[1:v]format=rgba,fade=t=in:st=0:d=${TITLE_FADE_SEC}:alpha=1,fade=t=out:st=${out}:d=${TITLE_FADE_SEC}:alpha=1[t]`);
  parts.push(`[vc][t]overlay=0:0:eof_action=pass:format=auto,format=yuv420p[v]`);
  return parts.join(";");
};

/** وسائط ffmpeg: إعادة ترميز بإعدادات جودة vertical نفسها (config.json ← video.quality.vertical) */
export const cutArgs = (input: string, output: string, ranges: CutSpec["ranges"], fps: number, q = qualitySpec("vertical"),
  title?: { png: string; seconds: number }): string[] => [
  "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", input,
  // العنوان: الصورة الشفافة مكررة بالإطارات نفسها مدة ظهوره وحدها (ثم يمضي الفيديو بلا عنوان: eof_action=pass)
  ...(title ? ["-framerate", String(fps), "-loop", "1", "-t", title.seconds.toFixed(3), "-i", title.png] : []),
  "-filter_complex", cutFilter(ranges, fps, title?.seconds), "-map", "[v]", "-map", "[a]",
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
  let png: string | null = null;
  if (cut.title) {
    // القاعدة الأولى: نص يُنشر على الشاشة، يُفحص قبل رسمه
    const traces = findTraces(cut.title.text);
    if (traces.length) throw new Error(`أثر لأدوات الإنتاج في عنوان الشورت: ${traces.join("، ")}`);
    png = output.replace(/\.mp4$/i, ".title.png");
    await renderShortTitlePng(cut.title.text, png);
  }
  try {
    await execFileP("ffmpeg", cutArgs(input, output, cut.ranges, cut.fps, q, png && cut.title ? { png, seconds: cut.title.seconds } : undefined),
      { timeout: 2 * 3_600_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  } finally {
    if (png) await rm(png, { force: true });
  }
  const { normalizeProgramLoudness } = await import("../../studio/quality/normalize");
  await normalizeProgramLoudness(output, q.audioBitrate);
  await cleanMetadata(output, meta);
  return output;
};

/** صورة العنوان الشفافة 1080×1920 بأسلوب القناة (تكوين «short-title»)؛ خطوط القناة وحدها، بلا وسائط الحلقة */
export const renderShortTitlePng = async (text: string, output: string) => {
  const { renderStill, selectComposition } = await import("@remotion/renderer");
  const { browserExecutable, createIsolatedRenderBundle } = await import("../bundle");
  const { emptyMedia } = await import("../../plan/media");
  const sandbox = await createIsolatedRenderBundle(emptyMedia);
  try {
    const inputProps = { text };
    const composition = await selectComposition({ serveUrl: sandbox.serveUrl, id: "short-title", inputProps, browserExecutable: browserExecutable() });
    await renderStill({ serveUrl: sandbox.serveUrl, composition, inputProps, output, imageFormat: "png", scale: 1, overwrite: true, browserExecutable: browserExecutable() });
    return output;
  } finally {
    await sandbox.cleanup();
  }
};
