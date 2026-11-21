/**
 * قياس صوت الفيديو لبطاقة الجودة: العلو المتكامل (EBU R128، LUFS) والذروة الحقيقية (dBTP) بمرشح ffmpeg «ebur128».
 * قياس فقط: لا يغيّر الملف.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export type Loudness = { integrated: number; truePeak: number };

/** ملخص ebur128 في آخر المخرجات: «I: -16.2 LUFS» و«Peak: -1.3 dBFS» (تحت True peak) */
export const parseEbur128 = (stderr: string): Loudness => {
  const tail = stderr.slice(stderr.lastIndexOf("Summary:"));
  const i = /I:\s*(-?[\d.]+|-inf)\s*LUFS/.exec(tail);
  const p = /True peak:\s*Peak:\s*(-?[\d.]+|-inf)\s*dBFS/.exec(tail);
  if (!i || !p) throw Error("تعذّر قراءة علو الصوت من الملف.");
  const n = (x: string) => (x === "-inf" ? -Infinity : Number(x));
  return { integrated: n(i[1]!), truePeak: n(p[1]!) };
};

export const measureLoudness = async (file: string): Promise<Loudness> => {
  const r = await exec("ffmpeg", ["-hide_banner", "-nostats", "-nostdin", "-i", file, "-map", "0:a:0", "-af", "ebur128=peak=true", "-f", "null", "-"],
    { maxBuffer: 64 * 1024 * 1024, timeout: 3_600_000 });
  return parseEbur128(String(r.stderr));
};
