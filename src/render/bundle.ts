import path from "node:path";
import os from "node:os";
import { existsSync } from "node:fs";
import { lstat, mkdir, mkdtemp, readdir, rename, rm, stat, utimes, writeFile } from "node:fs/promises";
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
    // three: خامات العدّة ثلاثية الأبعاد، CC0 وحدها ومسجلة في src/remotion/three/materials.ts (D166)
    const sharedAssets = new Set(["fonts", "illus", "three"]);
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
export const createIsolatedRenderBundle = async (media: EpisodeMedia, o: { cacheKey?: string } = {}) => {
  if (o.cacheKey) return cachedRenderBundle(media, o.cacheKey);
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

/**
 * D232 (تجربة التسريع «حزمة واحدة للحلقة»): حزمة Remotion محفوظة على العامل يعيد استعمالها كل مشهد من الحلقة نفسها.
 * المفتاح بصمة الـcommit ولقطة الوسائط (الكود والأصول المشتركة ثابتة في الـcommit، والوسائط ثابتة ببصمتها)، فلا تُستعمل
 * حزمة لمحتوى آخر. تُبنى في مجلد مؤقت ثم تُنقل ذريًا، ولا تُحذف بعد الرندر؛ ويبقى أحدث BUNDLE_CACHE_KEEP منها.
 * للتجارب وحدها (`render.bundleCache` في مهمة العامل)؛ وكل رندر آخر يبني حزمته ويحذفها كما كان.
 */
export const BUNDLE_CACHE_KEEP = 3;
export const bundleCacheRoot = () => process.env.BAL_BUNDLE_CACHE_DIR || path.join(projectRoot, "renders", "bundle-cache");
export const cachedRenderBundle = async (media: EpisodeMedia, cacheKey: string, o: { build?: typeof bundle } = {}) => {
  if (!/^[a-f0-9]{16,64}$/.test(cacheKey)) throw new Error("مفتاح الحزمة المحفوظة غير صالح.");
  const root = bundleCacheRoot();
  await mkdir(root, { recursive: true });
  await assertNoLinkedPath(root);
  const dir = path.join(root, cacheKey);
  const marker = `${dir}.complete`;
  const noop = async () => {};
  if (existsSync(marker) && existsSync(dir)) {
    const now = new Date();
    await utimes(marker, now, now).catch(() => undefined);
    return { serveUrl: dir, cleanup: noop, reused: true as const };
  }
  if (!o.build) await ensureRenderBrowser();
  const sandbox = await stageRemotionPublicDir(media);
  const tmp = await mkdtemp(path.join(root, `${cacheKey}.building-`));
  try {
    await (o.build ?? bundle)({ entryPoint: path.join(projectRoot, "src", "remotion", "index.ts"), publicDir: sandbox.dir, outDir: tmp, enableCaching: false });
    await rm(dir, { recursive: true, force: true });
    await rename(tmp, dir);
    await writeFile(marker, JSON.stringify({ at: new Date().toISOString(), base: media.mode === "static" ? media.base : null }) + "\n");
  } catch (e) {
    await rm(tmp, { recursive: true, force: true });
    throw e;
  } finally {
    await sandbox.cleanup();
  }
  await pruneBundleCache(root, cacheKey);
  return { serveUrl: dir, cleanup: noop, reused: false as const };
};

/** يبقي أحدث BUNDLE_CACHE_KEEP حزمة (بوقت آخر استعمال)، ويحذف الباقي وبقايا البناء المنقطع. */
export const pruneBundleCache = async (root: string, keepKey: string) => {
  const names = await readdir(root);
  for (const n of names.filter((x) => x.includes(".building-"))) await rm(path.join(root, n), { recursive: true, force: true });
  const done = await Promise.all(names.filter((n) => n.endsWith(".complete"))
    .map(async (n) => ({ key: n.slice(0, -".complete".length), at: (await stat(path.join(root, n))).mtimeMs })));
  const old = done.filter((d) => d.key !== keepKey).sort((a, b) => b.at - a.at).slice(BUNDLE_CACHE_KEEP - 1);
  for (const d of old) {
    await rm(path.join(root, `${d.key}.complete`), { force: true });
    await rm(path.join(root, d.key), { recursive: true, force: true });
  }
};
