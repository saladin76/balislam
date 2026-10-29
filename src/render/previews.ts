import path from "node:path";
import { mkdir } from "node:fs/promises";
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia, renderStill } from "@remotion/renderer";
import { projectRoot } from "../config/paths";

export type PreviewOptions = {
  /** بادئة أو أكثر لمعرّف التكوين، مثل reel-paper أو scene-verse-card-night */
  prefix: string | string[];
  outDir?: string;
  /** صور ثابتة عند إطارات محددة بدل الفيديو */
  stills?: number[];
  onProgress?: (msg: string) => void;
};

/** يرندر تكوينات المعاينة (فيديو MP4 أو لقطات ثابتة). */
export const renderPreviews = async (opts: PreviewOptions): Promise<string[]> => {
  const log = opts.onProgress ?? (() => {});
  const outDir = opts.outDir ?? path.join(projectRoot, "renders", "previews");
  await mkdir(outDir, { recursive: true });
  log("تجميع المشروع…");
  const serveUrl = await bundle({ entryPoint: path.join(projectRoot, "src", "remotion", "index.ts"), publicDir: path.join(projectRoot, "public") });
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
  const prefixes = Array.isArray(opts.prefix) ? opts.prefix : [opts.prefix];
  const comps = (await getCompositions(serveUrl, { browserExecutable })).filter((c) => prefixes.some((p) => c.id.startsWith(p)));
  if (!comps.length) throw new Error(`لا يوجد تكوين يبدأ بـ «${opts.prefix}».`);
  const written: string[] = [];
  for (const composition of comps) {
    if (opts.stills) {
      for (const wanted of opts.stills) {
        const frame = Math.min(wanted, composition.durationInFrames - 1);
        const output = path.join(outDir, `${composition.id}-f${frame}.png`);
        await renderStill({ serveUrl, composition, output, frame, browserExecutable });
        written.push(output);
      }
      log(`لقطات ${composition.id}`);
    } else {
      const output = path.join(outDir, `${composition.id}.mp4`);
      let last = -1;
      await renderMedia({
        serveUrl,
        composition,
        codec: "h264",
        crf: 20,
        x264Preset: "veryfast",
        outputLocation: output,
        browserExecutable,
        onProgress: ({ progress }) => {
          const pct = Math.floor(progress * 10) * 10;
          if (pct !== last) {
            last = pct;
            log(`${composition.id}: ${pct}%`);
          }
        },
      });
      written.push(output);
    }
  }
  return written;
};
