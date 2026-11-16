import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { RenderInternals } from "@remotion/renderer";
import config from "../../config.json";

/** معدل البت من صيغة الإخراج (mp3_44100_192 ← 192k) */
const bitrate = () => `${/mp3_\d+_(\d+)/.exec(config.voice.outputFormat)?.[1] ?? "192"}k`;

/**
 * سرعة الكلام بعد التوليد (للنماذج التي لا تقبل السرعة مثل v4): تمديد زمني يحفظ طبقة الصوت (atempo)،
 * فلا يتغير صوت صاحب القناة، ويتغير إيقاعه فقط. السرعة 1 لا تلمس الملف.
 */
export const applyTempo = async (mp3: Buffer, speed: number): Promise<Buffer> => {
  if (Math.abs(speed - 1) < 0.005) return mp3;
  const dir = await mkdtemp(path.join(os.tmpdir(), "bal-tempo-"));
  try {
    const src = path.join(dir, "in.mp3");
    const out = path.join(dir, "out.mp3");
    await writeFile(src, mp3);
    await RenderInternals.callFf({
      bin: "ffmpeg",
      args: ["-v", "error", "-y", "-i", src, "-filter:a", `atempo=${speed.toFixed(3)}`, "-c:a", "libmp3lame", "-b:a", bitrate(), "-map_metadata", "-1", out],
      indent: false,
      logLevel: "error",
      binariesDirectory: null,
      cancelSignal: undefined,
    });
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

/** توقيت الكلمات بعد تغيير السرعة */
export const scaleTimes = <T extends { start: number; end: number }>(words: T[], speed: number): T[] =>
  Math.abs(speed - 1) < 0.005 ? words : words.map((w) => ({ ...w, start: w.start / speed, end: w.end / speed }));

/**
 * «سرعة الإلقاء» (src/voice/pace.ts): مدّ عينات أحادية بمعامل (أسرع > 1) بالمرشح نفسه atempo الذي يحفظ طبقة الصوت،
 * من WAV إلى WAV بلا ضغط بينهما (لا خسارة MP3 ثانية). atempo موجود في ffmpeg المرفق مع الرندر على كل جهاز.
 * المعامل 1 يعيد العينات كما هي.
 */
export const stretchPcm = async (pcm: Float32Array, sampleRate: number, factor: number): Promise<Float32Array> => {
  if (Math.abs(factor - 1) < 0.0005 || pcm.length === 0) return pcm;
  if (!(factor >= 0.5 && factor <= 2)) throw new Error(`معامل السرعة خارج المدى: ${factor}`);
  const { encodeWav } = await import("../remotion/dafatir/audio/compose");
  const { readWav } = await import("../remotion/dafatir/audio/trim");
  const dir = await mkdtemp(path.join(os.tmpdir(), "bal-pace-"));
  try {
    const src = path.join(dir, "in.wav");
    const out = path.join(dir, "out.wav");
    await writeFile(src, encodeWav(pcm, sampleRate));
    await RenderInternals.callFf({
      bin: "ffmpeg",
      args: ["-v", "error", "-y", "-i", src, "-filter:a", `atempo=${factor.toFixed(4)}`, "-ac", "1", "-ar", String(sampleRate), "-c:a", "pcm_s16le", "-map_metadata", "-1", out],
      indent: false,
      logLevel: "error",
      binariesDirectory: null,
      cancelSignal: undefined,
    });
    return readWav(new Uint8Array(await readFile(out))).samples;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};
