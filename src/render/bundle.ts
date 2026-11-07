import path from "node:path";
import os from "node:os";
import { cp, lstat, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import type { EpisodeMedia } from "../plan/media";
import { bundle } from "@remotion/bundler";
import { projectRoot } from "../config/paths";

let cached: Promise<string> | null = null;

/** تجميع مشروع Remotion مرة واحدة لكل تشغيل (يُعاد استخدامه لكل الرندرات). */
export const getServeUrl = (fresh = false) => {
  // Fresh episode snapshots must never reuse a bundle assembled before their assets existed.
  // Do not replace the shared cache while another render is consuming its serve URL.
  const build = () => bundle({ entryPoint: path.join(projectRoot, "src", "remotion", "index.ts"), publicDir: path.join(projectRoot, "public") });
  if (fresh) return build();
  if (!cached) cached = build().catch((e) => { cached = null; throw e; });
  return cached;
};

export const browserExecutable = () => process.env.REMOTION_BROWSER_EXECUTABLE || null;

/**
 * Give each Remotion bundle an isolated publicDir. A generic bundle of
 * projectRoot/public would also publish every other episode's staged private
 * narration/recitations, regardless of which media.base the current plan uses.
 * Preserve the regular shared (non-underscore) public assets such as fonts.
 */
export const stageRemotionPublicDir = async (
  media: EpisodeMedia,
  opts: { publicRoot?: string; tempRoot?: string } = {},
): Promise<{ dir: string; cleanup: () => Promise<void> }> => {
  const publicRoot = opts.publicRoot ?? path.join(projectRoot, "public");
  const dir = await mkdtemp(path.join(opts.tempRoot ?? os.tmpdir(), "studio-remotion-public-"));
  const cleanup = () => rm(dir, { recursive: true, force: true });
  try {
    for (const entry of await readdir(publicRoot, { withFileTypes: true })) {
      if (entry.name.startsWith("_")) continue;
      // No symlink traversal into unrelated media even for shared assets.
      if (entry.isSymbolicLink()) throw new Error("رابط رمزي غير آمن داخل public.");
      await cp(path.join(publicRoot, entry.name), path.join(dir, entry.name), { recursive: true, force: false, errorOnExist: true });
    }
    if (media.mode === "static") {
      const base = media.base;
      const render = /^_render\/[a-z0-9]+(?:-[a-z0-9]+)*\/[0-9]{3}-[a-z0-9]+(?:-[a-z0-9]+)*\/[a-f0-9]{24}\/$/;
      const storyboard = /^_storyboard_media\/[a-z0-9]+(?:-[a-z0-9]+)*\/[0-9]{3}-[a-z0-9]+(?:-[a-z0-9]+)*-[a-f0-9]{16}\/$/;
      if (!render.test(base) && !storyboard.test(base))
        throw new Error("مسار وسائط غير معزول في حزمة Remotion.");
      const source = path.join(publicRoot, base);
      const info = await lstat(source);
      if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("مجلد وسائط غير آمن.");
      const target = path.join(dir, base);
      await mkdir(path.dirname(target), { recursive: true });
      await cp(source, target, { recursive: true, force: false, errorOnExist: true });
    }
    return { dir, cleanup };
  } catch (e) {
    await cleanup();
    throw e;
  }
};

/** Keep the sandbox alive until the renderer finishes reading its serve URL. */
export const createIsolatedRenderBundle = async (media: EpisodeMedia) => {
  const sandbox = await stageRemotionPublicDir(media);
  try {
    const serveUrl = await bundle({
      entryPoint: path.join(projectRoot, "src", "remotion", "index.ts"),
      publicDir: sandbox.dir,
    });
    return { serveUrl, cleanup: sandbox.cleanup };
  } catch (e) {
    await sandbox.cleanup();
    throw e;
  }
};
