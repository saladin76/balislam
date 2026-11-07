import path from "node:path";
import os from "node:os";
import { lstat, mkdtemp, readdir, rm } from "node:fs/promises";
import type { EpisodeMedia } from "../plan/media";
import { defaultRenderMediaRoot, verifyStagedMedia } from "../plan/renderStage";
import { bundle } from "@remotion/bundler";
import { projectRoot } from "../config/paths";
import { assertNoLinkedPath, copyUnlinkedFile, ensureUnlinkedDirectory } from "./fsIsolation";

export const browserExecutable = () => process.env.REMOTION_BROWSER_EXECUTABLE || null;

/** Recursively validate every entry: cp() without this check can follow
 * nested links inside fonts, shared illustrations or staged episode media. */
const copyPublicTree = async (source: string, destination: string): Promise<void> => {
  const stat = await lstat(source);
  if (stat.isSymbolicLink()) throw new Error("رابط رمزي غير آمن داخل أصول Remotion.");
  if (stat.isFile()) {
    await copyUnlinkedFile(source, destination);
    return;
  }
  if (!stat.isDirectory()) throw new Error("نوع ملف غير مدعوم داخل أصول Remotion.");
  await ensureUnlinkedDirectory(destination);
  for (const name of await readdir(source))
    await copyPublicTree(path.join(source, name), path.join(destination, name));
};

/**
 * Only shared, non-private assets plus this episode's selected immutable
 * snapshot reach Remotion. Never stage all of public/_render together.
 */
export const stageRemotionPublicDir = async (
  media: EpisodeMedia,
  opts: { publicRoot?: string; mediaRoot?: string; tempRoot?: string } = {},
): Promise<{ dir: string; cleanup: () => Promise<void> }> => {
  const publicRoot = opts.publicRoot ?? path.join(projectRoot, "public");
  const mediaRoot = opts.mediaRoot ?? (opts.publicRoot ? publicRoot : defaultRenderMediaRoot());
  await assertNoLinkedPath(publicRoot);
  const tempRoot = opts.tempRoot ?? os.tmpdir();
  await assertNoLinkedPath(tempRoot);
  const dir = await mkdtemp(path.join(tempRoot, "studio-remotion-public-"));
  const cleanup = () => rm(dir, { recursive: true, force: true });
  try {
    for (const entry of await readdir(publicRoot, { withFileTypes: true })) {
      if (entry.name.startsWith("_")) continue;
      await copyPublicTree(path.join(publicRoot, entry.name), path.join(dir, entry.name));
    }
    if (media.mode === "static") {
      const base = media.base;
      const render = /^_render\/[a-z0-9]+(?:-[a-z0-9]+)*\/[0-9]{3}-[a-z0-9]+(?:-[a-z0-9]+)*\/[a-f0-9]{24}\/$/;
      const storyboard = /^_storyboard_media\/[a-z0-9]+(?:-[a-z0-9]+)*\/[0-9]{3}-[a-z0-9]+(?:-[a-z0-9]+)*-[a-f0-9]{16}\/$/;
      if (!render.test(base) && !storyboard.test(base))
        throw new Error("مسار وسائط غير معزول في حزمة Remotion.");
      await verifyStagedMedia(mediaRoot, base);
      const source = path.join(mediaRoot, base);
      await assertNoLinkedPath(source);
      const target = path.join(dir, base);
      await copyPublicTree(source, target);
    }
    return { dir, cleanup };
  } catch (e) {
    await cleanup();
    throw e;
  }
};

/** The Webpack bundle itself MUST have an owned output directory, otherwise
 * Remotion creates an implicit remotion-webpack-bundle-* in system /tmp.
 * Keep both directories until the renderer has stopped reading the bundle. */
export const createIsolatedRenderBundle = async (media: EpisodeMedia) => {
  const sandbox = await stageRemotionPublicDir(media);
  let bundleRoot: string | null = null;
  const cleanup = async () => {
    await sandbox.cleanup();
    if (bundleRoot) await rm(bundleRoot, { recursive: true, force: true });
  };
  try {
    await assertNoLinkedPath(os.tmpdir());
    bundleRoot = await mkdtemp(path.join(os.tmpdir(), "studio-remotion-bundle-"));
    const serveUrl = await bundle({
      entryPoint: path.join(projectRoot, "src", "remotion", "index.ts"),
      publicDir: sandbox.dir,
      outDir: bundleRoot,
      enableCaching: false,
    });
    return { serveUrl, cleanup };
  } catch (e) {
    await cleanup();
    throw e;
  }
};
