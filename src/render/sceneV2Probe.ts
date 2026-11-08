/** FFprobe contract for V2: verify physical bytes, not declared media metadata. */
import { spawn } from "node:child_process";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";

type Stream = {
  codec_type?: string; codec_name?: string; width?: number; height?: number;
  channels?: number; sample_rate?: string; avg_frame_rate?: string;
  nb_read_frames?: string; start_time?: string; duration?: string;
};
type Probe = { format?: { format_name?: string; duration?: string }; streams?: Stream[] };
export type SceneMediaInspection = {
  durationSec: number;
  video: { codec: string; width: number; height: number; fps: number; frames: number; startSec: number };
  audio: { codec: string; channels: number; sampleRate: number; startSec: number }[];
};
export const resolveExecutable = async (binary: string) => {
  if (!path.isAbsolute(binary)) throw Error("FFprobe must be configured using an absolute executable path.");
  const actual = await realpath(binary);
  if (!(await stat(actual)).isFile()) throw Error("FFprobe executable is not a file.");
  return actual;
};
export const probeMedia = async (
  binary: string, file: string, countFrames = false, timeoutMs = 30000,
): Promise<SceneMediaInspection> => {
  const executable = await resolveExecutable(binary);
  if (!(await stat(file)).isFile()) throw Error("No regular file to probe.");
  const args = ["-v", "error", ...(countFrames ? ["-count_frames"] : []),
    "-show_entries",
    "format=format_name,duration:stream=codec_type,codec_name,width,height,channels,sample_rate,avg_frame_rate,nb_read_frames,start_time,duration",
    "-of", "json", "-i", file];
  const raw = await new Promise<Probe>((resolve, reject) => {
    let out = "", err = "", finished = false, timedOut = false;
    const child = spawn(executable, args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    const timer = setTimeout(() => { timedOut = true; child.kill("SIGKILL"); }, timeoutMs);
    const finish = (e?: Error) => {
      if (finished) return;
      finished = true; clearTimeout(timer);
      if (e) reject(e);
      else {
        try { resolve(JSON.parse(out) as Probe); } catch { reject(Error("Invalid FFprobe JSON.")); }
      }
    };
    child.stdout.on("data", (b: Buffer) => {
      out += b.toString("utf8");
      if (out.length > 262144) { child.kill("SIGKILL"); finish(Error("FFprobe output too large.")); }
    });
    child.stderr.on("data", (b: Buffer) => { if (err.length < 4096) err += b.toString("utf8").slice(0, 4096); });
    child.on("error", (e) => finish(Error("FFprobe could not start: " + e.message)));
    child.on("close", (code) => finish(timedOut ? Error("FFprobe timed out.")
      : code !== 0 ? Error("FFprobe failed: " + err.slice(0, 600)) : undefined));
  });
  if (!raw?.format || !raw.format.format_name?.split(",").includes("mp4") && countFrames)
    throw Error("Rendered scene is not MP4.");
  if (!Array.isArray(raw.streams)) throw Error("Media has no streams.");
  const durationSec = Number(raw.format.duration);
  if (!Number.isFinite(durationSec) || durationSec <= 0 || durationSec > 36000)
    throw Error("Invalid media duration.");
  const videos = raw.streams.filter((s) => s.codec_type === "video");
  if (countFrames && videos.length !== 1) throw Error("MP4 requires exactly one video stream.");
  const v = videos[0];
  const fraction = (s: string | undefined) => {
    const [n, d] = (s ?? "0/1").split("/").map(Number);
    return d && n && Number.isFinite(n / d) ? n / d : 0;
  };
  const fps = fraction(v?.avg_frame_rate);
  const frames = Number(v?.nb_read_frames);
  const video = {
    codec: v?.codec_name ?? "",
    width: Number(v?.width ?? 0), height: Number(v?.height ?? 0),
    fps, frames: Number.isSafeInteger(frames) ? frames : 0,
    startSec: Number(v?.start_time ?? 0),
  };
  const audio = raw.streams.filter((s) => s.codec_type === "audio").map((s) => ({
    codec: s.codec_name ?? "", channels: Number(s.channels ?? 0),
    sampleRate: Number(s.sample_rate ?? 0), startSec: Number(s.start_time ?? 0),
  }));
  if (countFrames && (!video.codec || !video.frames || !video.fps ||
      audio.some((a) => !a.codec || !a.channels || !a.sampleRate)))
    throw Error("Incomplete media streams.");
  return { durationSec, video, audio };
};
