import path from "node:path";
import { lstat } from "node:fs/promises";
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

/**
 * Refuse a relative audio path that escapes its owning episode, including
 * via a symbolic link hidden in an intermediate directory.
 * Never unlink an unexpected path. Caller is still responsible for data SHA.
 */
export const isOwnedRegularAudio = async (root: string, relative: string): Promise<boolean> => {
  try {
    if (typeof relative !== "string" || !relative || relative.includes("\\") ||
        relative.includes("\0") || path.isAbsolute(relative)) return false;
    const base = path.resolve(root);
    const resolved = path.resolve(base, relative);
    if (!resolved.startsWith(base + path.sep)) return false;
    const rootInfo = await lstat(base);
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) return false;
    let cursor = base;
    const parts = path.relative(base, resolved).split(path.sep);
    for (let index = 0; index < parts.length; index++) {
      cursor = path.join(cursor, parts[index]!);
      const info = await lstat(cursor);
      if (info.isSymbolicLink()) return false;
      if (index === parts.length - 1 ? !info.isFile() : !info.isDirectory()) return false;
    }
    return true;
  } catch { return false; }
};
