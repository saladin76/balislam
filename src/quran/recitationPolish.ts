/**
 * Polish of the owner's own uploaded Quran recording (owner decision, 8 Nov: recitations come last;
 * «تظبط جودتها وتضيفها»). The ORIGINAL upload stays untouched beside it, and the owner may choose it.
 *
 * The processed copy only:
 *  1. trims SILENCE at the two edges, never inside, with generous margins so no letter is eaten
 *     (frame levels and the floor/peak thresholds from the dafatir trimmer, src/remotion/dafatir/audio/trim.ts);
 *  2. applies a gentle, conservative FFT denoise (afftdn nr=6 dB);
 *  3. matches loudness to the episode's narration with EBU R128 two-pass loudnorm (default -16 LUFS
 *     integrated, true peak -1.5 dBTP), linear gain whenever possible.
 * No pitch shift, no time stretch, no resynthesis, no content cut. Nothing is fetched or generated.
 */
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { frameLevels, readWav, TRIM_DEFAULTS } from "../remotion/dafatir/audio/trim";

const run = promisify(execFile);

export type Loudness = { integrated: number; truePeak: number; lra: number; threshold: number };
export type EdgeTrim = { start: number; end: number; duration: number; trimmedHead: number; trimmedTail: number };

/** Loudness target: the narration's (EBU R128) when measurable, else the channel default. */
export const RECITATION_LOUDNESS = { integrated: -16, truePeak: -1.5, lra: 11 } as const;
/** Conservative denoise: 6 dB of reduction over an estimated -50 dB noise floor. */
export const RECITATION_DENOISE = "afftdn=nr=6:nf=-50";
/** Margins kept around the first and last audible sound (a madd or ghunna tail fades slowly). */
export const RECITATION_TRIM = { onsetPadSec: 0.12, releasePadSec: 0.35, minCutSec: 0.05 } as const;

const ff = (args: string[]) => run("ffmpeg", ["-nostdin", "-hide_banner", "-y", ...args],
  { timeout: 180_000, maxBuffer: 16 * 1024 * 1024 });

const lastJson = (text: string): Record<string, string> => {
  const end = text.lastIndexOf("}");
  const start = text.lastIndexOf("{", end);
  if (start < 0 || end < 0) throw Error("تعذّر قياس علوّ الصوت.");
  return JSON.parse(text.slice(start, end + 1)) as Record<string, string>;
};

/** EBU R128 integrated loudness and true peak of a file, optionally after a filter chain. */
export const measureLoudness = async (file: string, pre = ""): Promise<Loudness> => {
  const { stderr } = await ff(["-i", file, "-vn", "-af",
    `${pre ? pre + "," : ""}loudnorm=I=${RECITATION_LOUDNESS.integrated}:TP=${RECITATION_LOUDNESS.truePeak}:LRA=${RECITATION_LOUDNESS.lra}:print_format=json`,
    "-f", "null", "-"]);
  const j = lastJson(stderr);
  const n = (k: string) => Number(j[k]);
  return { integrated: n("input_i"), truePeak: n("input_tp"), lra: n("input_lra"), threshold: n("input_thresh") };
};

/**
 * Where the edge silence ends and starts again. Only leading/trailing frames that stay below the soft
 * threshold (the level of a whispered letter) are removed, then a margin is given back on each side.
 * When the edges are not clearly silent, nothing is trimmed.
 */
export const edgeSilence = (samples: Float32Array, sampleRate: number): EdgeTrim => {
  const frame = TRIM_DEFAULTS.frameSec;
  const lv = frameLevels(samples, sampleRate, frame);
  const duration = samples.length / sampleRate;
  const none = { start: 0, end: duration, duration, trimmedHead: 0, trimmedTail: 0 };
  if (lv.length < 20) return none;
  // Digital silence (exact zeros the phone recorder pads at the start or end) is not room tone: it would pull
  // the floor to -120 dB, and the real room tone (~-55 dB) would then count as sound and never be trimmed.
  const audible = lv.filter((x) => x > -100);
  const sorted = [...(audible.length ? audible : lv)].sort((a, b) => a - b);
  // The noise floor is the room tone: the 10th percentile of the audible frames. (The very first frames of a phone
  // recording fade in from silence, far below the room tone; taking them as the floor made the room tone itself
  // count as sound, so the edges were never trimmed: recordings of 9 Nov.)
  const floorDb = sorted[Math.floor(sorted.length * 0.1)] ?? -120;
  const peakDb = sorted[sorted.length - 1] ?? -120;
  if (peakDb <= floorDb + TRIM_DEFAULTS.softAboveFloorDb) return none;
  const soft = Math.max(floorDb + TRIM_DEFAULTS.softAboveFloorDb, peakDb - TRIM_DEFAULTS.softBelowPeakDb);
  // A lone 10 ms blip (a breath, a tap on the phone) is not sound: a frame counts only when at least
  // 3 of the 5 frames around it are above the soft threshold.
  const loud = (i: number) => {
    let n = 0;
    for (let k = i - 2; k <= i + 2; k++) if ((lv[k] ?? -120) >= soft) n++;
    return lv[i]! >= soft && n >= 3;
  };
  let first = 0;
  while (first < lv.length && !loud(first)) first++;
  let last = lv.length - 1;
  while (last > first && !loud(last)) last--;
  if (first >= lv.length) return none;
  const start = Math.max(0, first * frame - RECITATION_TRIM.onsetPadSec);
  const end = Math.min(duration, (last + 1) * frame + RECITATION_TRIM.releasePadSec);
  const head = start >= RECITATION_TRIM.minCutSec ? start : 0;
  const tail = duration - end >= RECITATION_TRIM.minCutSec ? end : duration;
  return { start: head, end: tail, duration, trimmedHead: head, trimmedTail: duration - tail };
};

/** Decode for analysis only (mono, 16 kHz PCM); the analysis file is removed right after. */
const analyse = async (input: string, workDir: string): Promise<EdgeTrim> => {
  const wav = path.join(workDir, `.analysis-${randomUUID()}.wav`);
  try {
    await ff(["-loglevel", "error", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav]);
    const { samples, sampleRate } = readWav(await readFile(wav));
    return edgeSilence(samples, sampleRate);
  } finally { await rm(wav, { force: true }); }
};

/** Median integrated loudness of up to five narration clips (the level the recitation should sit at). */
export const narrationLoudness = async (files: string[]): Promise<number | null> => {
  const values: number[] = [];
  for (const f of files.slice(0, 5)) {
    try {
      const l = await measureLoudness(f);
      if (Number.isFinite(l.integrated) && l.integrated > -40) values.push(l.integrated);
    } catch { /* an unreadable clip is simply not used as reference */ }
  }
  if (!values.length) return null;
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)]!;
};

export type PolishReport = {
  trim: EdgeTrim;
  before: Loudness;
  after: Loudness;
  target: { integrated: number; truePeak: number; source: "narration" | "default" };
  filters: string;
};

const mp3 = ["-ar", "48000", "-c:a", "libmp3lame", "-b:a", "192k"];

/**
 * Processed copy of `input` at `output` (MP3, 48 kHz mono). `narrationLufs` is the narration's measured
 * integrated loudness when known; a value outside a sane speech range falls back to the default.
 */
/** QA 12 Nov (balislam Major 5): a silent or empty upload is said in Arabic, never as ffmpeg's «-inf» command line. */
export const RECITATION_SILENT = "الملف صامت أو فارغ: لا صوت مسموع فيه. سجّل التلاوة من جديد وارفعها.";
export const RECITATION_UNREADABLE = "تعذّرت قراءة الملف الصوتي: صيغته غير مدعومة أو هو تالف. ارفعه بصيغة MP3 أو WAV أو M4A.";
/** Below this integrated loudness (LUFS) a file holds no audible recitation (−70 is R128's absolute gate). */
const SILENT_LUFS = -70;
const audible = (x: string | number | undefined) => Number.isFinite(Number(x)) && Number(x) > SILENT_LUFS;

export const polishRecitation = async (input: string, output: string, opts: { narrationLufs?: number | null } = {}): Promise<PolishReport> => {
  try {
    return await polishRecitationOnce(input, output, opts);
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (msg === RECITATION_SILENT || /-inf|out of range|measured_I/i.test(msg)) throw Object.assign(new Error(RECITATION_SILENT), { code: "RECITATION_SILENT", details: msg.slice(0, 600) });
    if (/^Command failed: ffmpeg|Invalid data found|could not find codec|does not contain any stream/i.test(msg))
      throw Object.assign(new Error(RECITATION_UNREADABLE), { code: "RECITATION_UNREADABLE", details: msg.slice(0, 600) });
    throw e;
  }
};
const polishRecitationOnce = async (input: string, output: string, opts: { narrationLufs?: number | null }): Promise<PolishReport> => {
  const before = await measureLoudness(input);
  if (!audible(before.integrated)) throw new Error(RECITATION_SILENT);
  const trim = await analyse(input, path.dirname(output));
  const fromNarration = typeof opts.narrationLufs === "number" && opts.narrationLufs >= -24 && opts.narrationLufs <= -12;
  const target = { integrated: fromNarration ? Math.round(opts.narrationLufs! * 10) / 10 : RECITATION_LOUDNESS.integrated,
    truePeak: RECITATION_LOUDNESS.truePeak, source: fromNarration ? "narration" as const : "default" as const };
  const cut = trim.trimmedHead > 0 || trim.trimmedTail > 0
    ? `atrim=start=${trim.start.toFixed(3)}:end=${trim.end.toFixed(3)},asetpts=PTS-STARTPTS,` : "";
  const pre = `${cut}aformat=channel_layouts=mono,highpass=f=60,${RECITATION_DENOISE}`;
  const norm = `loudnorm=I=${target.integrated}:TP=${target.truePeak}:LRA=${RECITATION_LOUDNESS.lra}`;
  // Pass 1: measure the trimmed, denoised signal; pass 2: apply one linear gain to reach the target.
  const { stderr } = await ff(["-i", input, "-vn", "-af", `${pre},${norm}:print_format=json`, "-f", "null", "-"]);
  const m = lastJson(stderr);
  if (!audible(m.input_i)) throw new Error(RECITATION_SILENT);
  const filters = `${pre},${norm}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  await ff(["-loglevel", "error", "-i", input, "-vn", "-af", filters, "-ac", "1", ...mp3, output]);
  const after = await measureLoudness(output);
  return { trim, before, after, target, filters };
};

/** The owner's original as an MP3 for playback in the episode: no filter, no trim, no gain. */
export const plainRecitationCopy = async (input: string, output: string): Promise<Loudness> => {
  await ff(["-loglevel", "error", "-i", input, "-vn", ...mp3, output]);
  return measureLoudness(output);
};
