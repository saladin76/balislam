import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, rename, rm } from "node:fs/promises";
import { createIsolatedRenderBundle } from "./bundle";
import { emptyMedia } from "../plan/media";
import { getCompositions, renderStill } from "@remotion/renderer";
import { projectRoot } from "../config/paths";

export type StillsOptions = {
  /** يرندر ثيمًا واحدًا فقط إن حُدد */
  theme?: string;
  outDir?: string;
  onProgress?: (msg: string) => void;
};

/** يرندر لوحات الهوية (صورة لكل ثيم بكل مقاس) للتحقق البصري. */
export const renderBrandStills = async (opts: StillsOptions = {}): Promise<string[]> => {
  const log = opts.onProgress ?? (() => {});
  const outDir = opts.outDir ?? path.join(projectRoot, "renders", "brand");
  await mkdir(outDir, { recursive: true });

  log("تجميع المشروع…");
  const sandbox = await createIsolatedRenderBundle(emptyMedia);
  try {
  const serveUrl = sandbox.serveUrl;

  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
  const comps = await getCompositions(serveUrl, { browserExecutable });
  const targets = comps.filter((c) => c.id.startsWith("brand-") && (!opts.theme || c.id.startsWith(`brand-${opts.theme}-`)));
  if (targets.length === 0) throw new Error(`لا توجد لوحات هوية للثيم «${opts.theme}».`);

  const written: string[] = [];
  for (const composition of targets) {
    const output = path.join(outDir, `${composition.id}.png`);
    log(`رندر ${composition.id}…`);
    const pending = output + `.${randomUUID()}.part.png`;
    try {
      await renderStill({ serveUrl, composition, output: pending, scale: 2, browserExecutable });
      await rename(pending, output);
      written.push(output);
    } finally {
      await rm(pending, { force: true });
    }
  }
  return written;
  } finally {
    await sandbox.cleanup();
  }
};

/** يرندر صور القنوات للمنصات (صورة الحساب وأغلفة يوتيوب وفيسبوك وX) إلى renders/brand/<القناة>/ */
export const renderChannelArt = async (opts: { channels?: string[]; onProgress?: (msg: string) => void } = {}): Promise<string[]> => {
  const log = opts.onProgress ?? (() => {});
  const { listChannels, loadChannel, loadChannelIdentity, channelInfo } = await import("../channel");
  const ids = opts.channels?.length ? opts.channels : listChannels();
  log("تجميع المشروع…");
  const sandbox = await createIsolatedRenderBundle(emptyMedia);
  try {
  const serveUrl = sandbox.serveUrl;
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
  const written: string[] = [];
  for (const id of ids) {
    const outDir = path.join(projectRoot, "renders", "brand", id);
    await mkdir(outDir, { recursive: true });
    const inputProps = { identity: loadChannelIdentity(id), channel: channelInfo(loadChannel(id)) };
    const comps = await getCompositions(serveUrl, { browserExecutable, inputProps });
    for (const composition of comps.filter((c) => c.id.startsWith("channel-art-"))) {
      const output = path.join(outDir, `${composition.id.replace("channel-art-", "")}.png`);
      log(`رندر ${id} ← ${composition.id}…`);
      // دقة مضاعفة للتنزيل الحاد، ما عدا غلاف يوتيوب: 2560×1440 هو أقصى مقاس يقبله
      const scale = composition.defaultProps.kind === "youtube" ? 1 : 2;
      const pending = output + `.${randomUUID()}.part.png`;
      try {
        await renderStill({ serveUrl, composition, output: pending, scale, browserExecutable, inputProps: { ...inputProps, kind: composition.defaultProps.kind } });
        await rename(pending, output);
        written.push(output);
      } finally {
        await rm(pending, { force: true });
      }
    }
  }
  return written;
};
