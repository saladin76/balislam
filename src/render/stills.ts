import path from "node:path";
import { mkdir } from "node:fs/promises";
import { bundle } from "@remotion/bundler";
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
  const serveUrl = await bundle({
    entryPoint: path.join(projectRoot, "src", "remotion", "index.ts"),
    publicDir: path.join(projectRoot, "public"),
  });

  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
  const comps = await getCompositions(serveUrl, { browserExecutable });
  const targets = comps.filter((c) => c.id.startsWith("brand-") && (!opts.theme || c.id.startsWith(`brand-${opts.theme}-`)));
  if (targets.length === 0) throw new Error(`لا توجد لوحات هوية للثيم «${opts.theme}».`);

  const written: string[] = [];
  for (const composition of targets) {
    const output = path.join(outDir, `${composition.id}.png`);
    log(`رندر ${composition.id}…`);
    await renderStill({ serveUrl, composition, output, browserExecutable });
    written.push(output);
  }
  return written;
};

/** يرندر صور القنوات للمنصات (صورة الحساب وأغلفة يوتيوب وفيسبوك وX) إلى renders/brand/<القناة>/ */
export const renderChannelArt = async (opts: { channels?: string[]; onProgress?: (msg: string) => void } = {}): Promise<string[]> => {
  const log = opts.onProgress ?? (() => {});
  const { listChannels, loadChannel, loadChannelIdentity, channelInfo } = await import("../channel");
  const ids = opts.channels?.length ? opts.channels : listChannels();
  log("تجميع المشروع…");
  const serveUrl = await bundle({ entryPoint: path.join(projectRoot, "src", "remotion", "index.ts"), publicDir: path.join(projectRoot, "public") });
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
      await renderStill({ serveUrl, composition, output, browserExecutable, inputProps: { ...inputProps, kind: composition.defaultProps.kind } });
      written.push(output);
    }
  }
  return written;
};
