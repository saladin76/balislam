/** Real media-track preflight for owner AV and exact Master approvals. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
export type VideoEvidence = { durationSeconds: number; width: number; height: number; audioTracks: number };

export const verifyVideoEvidence = async (
  file: string, minWidth = 1, minHeight = 1,
): Promise<VideoEvidence> => {
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-print_format", "json", "-show_entries",
    "format=duration:stream=codec_type,width,height", file,
  ], { timeout: 30000, maxBuffer: 2 * 1024 * 1024 });
  const report = JSON.parse(stdout) as {
    streams?: { codec_type?: string; width?: number; height?: number }[];
    format?: { duration?: string };
  };
  const tracks = report.streams ?? [];
  const video = tracks.find(track => track.codec_type === "video");
  const audioTracks = tracks.filter(track => track.codec_type === "audio").length;
  const width = video?.width ?? 0;
  const height = video?.height ?? 0;
  const durationSeconds = Number(report.format?.duration ?? 0);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 1 ||
      !Number.isFinite(width) || !Number.isFinite(height) ||
      width < minWidth || height < minHeight || audioTracks === 0)
    throw Error("AV/Master review requires a playable video with an audio track, valid duration and required resolution.");
  return { durationSeconds, width, height, audioTracks };
};
