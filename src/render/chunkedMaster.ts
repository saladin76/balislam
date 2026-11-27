/**
 * D232 (تجربة التسريع «Master على قطع»): Master 4K يُرندر قطعًا متساوية (frameRange)، كل قطعة فيديو h264 وصوت AAC
 * منفصل مُجهَّز للوصل بلا فجوة (forSeamlessAacConcatenation)، ثم يُوصل بـcombineChunks من Remotion نفسه بلا إعادة
 * ترميز للصورة. كل قطعة تُحفظ على العامل ومعها بيان (المدى والمفتاح وبصمتا الملفين)؛ فإن انقطع الرندر وأُعيد إرسال
 * المهمة نفسها لا تُعاد إلا القطع الناقصة أو التي لا تطابق بصمتها. المفتاح معرّف المهمة (يشمل الـcommit والخطة
 * والوسائط والمواصفات)، فلا تُستعمل قطعة من مهمة أخرى.
 *
 * للتجارب وحدها (`render.chunkFrames`)؛ وبعد الوصل يكمل المسار كما هو (العلوّ، والبيانات الوصفية، والنشر الذري).
 */
import path from "node:path";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";

export type ChunkRange = [number, number];
/** القطع: [أول إطار، آخر إطار] شاملًا، كلها بالطول نفسه إلا الأخيرة (شرط الوصل السلس للصوت) */
export const chunkRanges = (totalFrames: number, chunkFrames: number): ChunkRange[] => {
  if (!Number.isInteger(totalFrames) || totalFrames < 1) throw new Error("عدد إطارات Master غير صالح.");
  if (!Number.isInteger(chunkFrames) || chunkFrames < 5) throw new Error("طول القطعة غير صالح.");
  const out: ChunkRange[] = [];
  for (let a = 0; a < totalFrames; a += chunkFrames) out.push([a, Math.min(totalFrames, a + chunkFrames) - 1]);
  return out;
};

const sha256File = (file: string) => new Promise<string>((resolve, reject) => {
  const h = createHash("sha256");
  createReadStream(file).on("error", reject).on("data", (d) => h.update(d)).on("end", () => resolve(h.digest("hex")));
});

export type ChunkManifest = { key: string; index: number; range: ChunkRange; video: string; audio: string; videoSha256: string; audioSha256: string; at: string };
const names = (i: number) => {
  const n = String(i).padStart(4, "0");
  return { video: `chunk-${n}.mp4`, audio: `chunk-${n}.aac`, manifest: `chunk-${n}.json` };
};

/** قطعة محفوظة صالحة للاستئناف: بيانها للمفتاح والمدى نفسيهما، والملفان موجودان ببصمتيهما */
export const reusableChunk = async (dir: string, key: string, i: number, range: ChunkRange): Promise<boolean> => {
  const f = names(i);
  let m: ChunkManifest;
  try { m = JSON.parse(await readFile(path.join(dir, f.manifest), "utf8")) as ChunkManifest; } catch { return false; }
  if (m.key !== key || m.index !== i || m.range?.[0] !== range[0] || m.range?.[1] !== range[1]) return false;
  const v = path.join(dir, f.video), a = path.join(dir, f.audio);
  if (!existsSync(v) || !existsSync(a)) return false;
  return (await sha256File(v)) === m.videoSha256 && (await sha256File(a)) === m.audioSha256;
};

export type RenderChunk = (o: { range: ChunkRange; videoOut: string; audioOut: string; onProgress: (p: number) => void }) => Promise<void>;
export type CombineChunks = (o: { videoFiles: string[]; audioFiles: string[]; outputLocation: string; framesPerChunk: number; totalFrames: number }) => Promise<void>;

/**
 * يرندر القطع الناقصة ويحفظ كلًّا منها ذريًا (ملف مؤقت ثم نقل، ثم البيان آخرًا)، ثم يصلها في output.
 * يعيد عدد القطع المعاد استعمالها والمرندرة (للقياس).
 */
export const renderChunked = async (o: {
  dir: string; key: string; totalFrames: number; chunkFrames: number; output: string;
  renderChunk: RenderChunk; combine: CombineChunks; log?: (pct: number, msg: string) => void;
}) => {
  const log = o.log ?? (() => {});
  const ranges = chunkRanges(o.totalFrames, o.chunkFrames);
  await mkdir(o.dir, { recursive: true });
  let reused = 0, rendered = 0, doneFrames = 0;
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i]!;
    const len = range[1] - range[0] + 1;
    const f = names(i);
    if (await reusableChunk(o.dir, o.key, i, range)) {
      reused++;
      doneFrames += len;
      log(Math.round((doneFrames / o.totalFrames) * 100), `رندر: القطعة ${i + 1}/${ranges.length} محفوظة من قبل`);
      continue;
    }
    await rm(path.join(o.dir, f.manifest), { force: true });
    const vTmp = path.join(o.dir, `${f.video}.part.mp4`), aTmp = path.join(o.dir, `${f.audio}.part.aac`);
    await rm(vTmp, { force: true });
    await rm(aTmp, { force: true });
    const before = doneFrames;
    await o.renderChunk({ range, videoOut: vTmp, audioOut: aTmp,
      onProgress: (p) => log(Math.round(((before + p * len) / o.totalFrames) * 100), `رندر: القطعة ${i + 1}/${ranges.length}`) });
    await rename(vTmp, path.join(o.dir, f.video));
    await rename(aTmp, path.join(o.dir, f.audio));
    const m: ChunkManifest = { key: o.key, index: i, range, video: f.video, audio: f.audio,
      videoSha256: await sha256File(path.join(o.dir, f.video)), audioSha256: await sha256File(path.join(o.dir, f.audio)), at: new Date().toISOString() };
    await writeFile(path.join(o.dir, f.manifest), JSON.stringify(m) + "\n");
    rendered++;
    doneFrames += len;
  }
  log(100, "وصل القطع");
  await o.combine({
    videoFiles: ranges.map((_, i) => path.join(o.dir, names(i).video)), audioFiles: ranges.map((_, i) => path.join(o.dir, names(i).audio)),
    outputLocation: o.output, framesPerChunk: o.chunkFrames, totalFrames: o.totalFrames,
  });
  return { chunks: ranges.length, reused, rendered };
};
