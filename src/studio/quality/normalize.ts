/**
 * علو الحلقة −14 LUFS (خطة «احترافية بلا مثيل»، المرحلة A المهمة ٣): الملف المنشور كله بعلو يوتيوب، بقياسين (EBU R128):
 * القياس الأول يقيس البرنامج كاملًا، والثاني يطبّق كسبًا خطيًا واحدًا (linear) فلا يتغير توازن الراوي والتلاوة والمؤثرات،
 * مع سقف ذروة حقيقية −1.5 dBTP (هامش تحت حد البطاقة −1 لترميز AAC). الصورة تُنسخ كما هي (لا إعادة ترميز).
 * يُطبَّق على الحلقة المجمّعة (joinSceneCuts) وعلى النسخة النهائية والشورتس (renderEpisode، master).
 */
import { execFile } from "node:child_process";
import { rename, rm } from "node:fs/promises";
import { promisify } from "node:util";

const exec = promisify(execFile);

export const PROGRAM_LOUDNESS = { integrated: -14, truePeak: -1.5, lra: 20 } as const;
/** تحت هذا العلو المتكامل لا صوت يُسمع في الملف (بوابة R128 المطلقة −70)؛ يُترك كما هو */
const SILENT_LUFS = -70;

export type LoudnormMeasure = { input_i: string; input_tp: string; input_lra: string; input_thresh: string; target_offset: string; normalization_type?: string; output_i?: string; output_tp?: string };

/** آخر كائن JSON في مخرجات loudnorm */
export const lastLoudnormJson = (stderr: string): LoudnormMeasure => {
  const end = stderr.lastIndexOf("}");
  const start = stderr.lastIndexOf("{", end);
  if (start < 0 || end < 0) throw Error("تعذّر قياس علو الحلقة.");
  return JSON.parse(stderr.slice(start, end + 1)) as LoudnormMeasure;
};

const target = `I=${PROGRAM_LOUDNESS.integrated}:TP=${PROGRAM_LOUDNESS.truePeak}:LRA=${PROGRAM_LOUDNESS.lra}`;

/** مرشح القياس الثاني: الكسب من القياس الأول، خطيًا */
export const secondPassFilter = (m: LoudnormMeasure) =>
  `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true:print_format=json,aresample=48000`;

export type ProgramLoudness = { before: number; after: number | null; truePeak: number | null; type: "linear" | "dynamic" | "silent" };

const ff = async (args: string[]) => String((await exec("ffmpeg", ["-nostdin", "-hide_banner", "-nostats", ...args], { maxBuffer: 64 * 1024 * 1024, timeout: 3_600_000 })).stderr);

/**
 * يضبط علو ملف MP4 في مكانه. الصورة والبيانات الوصفية كما هي (نسخ)، والصوت يُرمَّز AAC بالمعدل المعطى.
 * ملف صامت يُترك كما هو.
 */
export const normalizeProgramLoudness = async (file: string, audioBitrate: string): Promise<ProgramLoudness> => {
  const m = lastLoudnormJson(await ff(["-i", file, "-map", "0:a:0", "-af", `loudnorm=${target}:print_format=json`, "-f", "null", "-"]));
  const before = Number(m.input_i);
  if (!Number.isFinite(before) || before <= SILENT_LUFS) return { before, after: null, truePeak: null, type: "silent" };
  const tmp = file.replace(/\.mp4$/i, "") + ".loudnorm.mp4";
  try {
    const out = lastLoudnormJson(await ff(["-i", file, "-map", "0:v", "-map", "0:a:0", "-c:v", "copy", "-af", secondPassFilter(m),
      "-c:a", "aac", "-b:a", audioBitrate, "-ar", "48000", "-map_metadata", "0", "-movflags", "+faststart", "-y", tmp]));
    await rename(tmp, file);
    return { before, after: Number(out.output_i), truePeak: Number(out.output_tp), type: out.normalization_type === "dynamic" ? "dynamic" : "linear" };
  } finally {
    await rm(tmp, { force: true });
  }
};
