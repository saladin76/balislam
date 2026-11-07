/**
 * A metadata header is not proof that the full recording is decodable.
 * Fail closed if FFmpeg cannot decode the complete audio stream; no synthesis.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseFile } from "music-metadata";

const run = promisify(execFile);

/** Returns verified metadata duration, or null on damaged/unreadable audio. */
export const decodedAudioDuration = async (
  file: string, opts: { mp3Only?: boolean; maxSeconds?: number } = {},
): Promise<number | null> => {
  try {
    const metadata = await parseFile(file, { duration: true });
    const duration = metadata.format.duration ?? 0;
    if (!Number.isFinite(duration) || duration <= 0 ||
        (opts.maxSeconds && duration > opts.maxSeconds) ||
        (opts.mp3Only && !/MPEG.*Layer 3|MP3/i.test(metadata.format.codec ?? ""))) return null;
    // A decode to the null muxer is read-only and inspects the whole stream,
    // including trailing frames that music-metadata may never examine.
    await run("ffmpeg", [
      "-nostdin", "-hide_banner", "-loglevel", "error", "-xerror", "-err_detect", "explode",
      "-i", file, "-map", "0:a:0", "-vn", "-f", "null", "-",
    ], { timeout: 120000, maxBuffer: 1024 * 1024 });
    return duration;
  } catch { return null; }
};
