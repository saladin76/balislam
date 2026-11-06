import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { projectRoot } from "../config/paths";
import { currentChannelId } from "../channel";

const exec = promisify(execFile);

/**
 * Explicit post-render hook. Never scans worktrees. Failures do not delete or
 * invalidate a successful local render. Audio-only review slots stay local.
 */
export const uploadCloudPreview = async (file: string, episode: string, slot: string): Promise<void> => {
  if (process.env.BAL_PREVIEW_CLOUD_AUTO !== "1" || slot.endsWith("-audio")) return;
  try {
    const script = path.join(projectRoot, "scripts", "studio-preview-cloud.py");
    const python = process.env.BAL_PREVIEW_PYTHON || "python3";
    const { stdout } = await exec(python, [
      script, "upload", "--file", path.resolve(file),
      "--channel", currentChannelId(), "--episode", episode, "--slot", slot,
    ], { maxBuffer: 1024 * 1024 });
    if (stdout.trim()) console.info(stdout.trim());
  } catch (error) {
    console.warn(`CLOUD_PREVIEW_FAILED: ${(error as Error).message}`);
  }
};
