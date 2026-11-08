import path from "node:path";
import os from "node:os";
import { lstat, mkdtemp, readdir, rm } from "node:fs/promises";
import type { EpisodeMedia } from "../plan/media";
import { defaultRenderMediaRoot, verifyStagedMedia } from "../plan/renderStage";
import { bundle } from "@remotion/bundler";
import { projectRoot } from "../config/paths";
import { assertNoLinkedPath, copyUnlinkedFile, ensureUnlinkedDirectory } from "./fsIsolation";

export const browserExecutable = () => process.env.REMOTION_BROWSER_EXECUTABLE || null;

/** رسالة المالك حين يتعذّر تجهيز متصفح الرندر (تجربة الفانل ٨ نوفمبر، D36). */
export const renderBrowserFailureMessage = (cause: unknown) => {
  const raw = cause instanceof Error ? cause.message : String(cause ?? "");
  const offline = /ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|getaddrinfo|network|fetch failed/i.test(raw);
  return "تعذّر تجهيز متصفح الرندر" + (offline ? " لأن الجهاز غير متصل بالإنترنت" : "") +
    ": يُنزَّل مرة واحدة عند أول رندر ولم يكتمل. صِل الجهاز بالإنترنت ثم اضغط الزر نفسه مرة أخرى، " +
    "أو ضع مسار متصفح Chrome موجود على الجهاز في REMOTION_BROWSER_EXECUTABLE داخل ملف .env ثم أعد تشغيل الاستوديو. " +
    "الاستوديو ما زال يعمل، ولم يُحذف أي شيء." + (raw ? ` (${raw.slice(0, 160)})` : "");
};

/**
 * يجهّز متصفح الرندر قبل أي رندر وينتظره صراحة، فيصير فشل التنزيل خطأً عاديًا يصل إلى الزر
 * برسالة عربية، لا رفضًا غير ممسوك يُسقط خادم الاستوديو كله.
 */
export const ensureRenderBrowser = async (
  ensure: (o: { browserExecutable: string | null }) => Promise<unknown> = async (o) => (await import("@remotion/renderer")).ensureBrowser(o),
) => {
  try {
    await ensure({ browserExecutable: browserExecutable() });
  } catch (e) {
    throw new Error(renderBrowserFailureMessage(e));
  }
};

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
    // Explicit allowlist: do not bundle a future misplaced private file from
    // public/ merely because its filename does not start with an underscore.
    const sharedAssets = new Set(["fonts", "illus"]);
    for (const entry of await readdir(publicRoot, { withFileTypes: true })) {
      if (!sharedAssets.has(entry.name)) continue;
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
  await ensureRenderBrowser();
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
