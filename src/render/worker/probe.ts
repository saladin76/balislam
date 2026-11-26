import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

export type VideoProbe = {
  videoCodec: string | null;
  width: number;
  height: number;
  audioCodec: string | null;
  /** مدة مسار الصورة (الإطارات ÷ المعدل)، وإلا مدة الملف */
  durationSec: number;
  /** كل البيانات الوصفية: وسوم الملف ثم وسوم كل مسار، «المفتاح=القيمة» */
  tags: string[];
};

type Raw = {
  streams?: { codec_type?: string; codec_name?: string; width?: number; height?: number; duration?: string; tags?: Record<string, string> }[];
  format?: { duration?: string; tags?: Record<string, string> };
};

export const parseProbe = (json: string): VideoProbe => {
  const r = JSON.parse(json) as Raw;
  const streams = r.streams ?? [];
  const v = streams.find((s) => s.codec_type === "video");
  const a = streams.find((s) => s.codec_type === "audio");
  const vd = Number(v?.duration);
  const fd = Number(r.format?.duration);
  const tags = [r.format?.tags ?? {}, ...streams.map((s) => s.tags ?? {})].flatMap((t) => Object.entries(t).map(([k, x]) => `${k}=${x}`));
  return {
    videoCodec: v?.codec_name ?? null, width: v?.width ?? 0, height: v?.height ?? 0, audioCodec: a?.codec_name ?? null,
    durationSec: Number.isFinite(vd) && vd > 0 ? vd : Number.isFinite(fd) ? fd : 0, tags,
  };
};

/** ffprobe النظام (ماك: Homebrew، ويندوز: winget Gyan.FFmpeg). */
export const probeVideo = async (file: string): Promise<VideoProbe> => {
  const { stdout } = await run("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file],
    { timeout: 60_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  return parseProbe(String(stdout));
};
