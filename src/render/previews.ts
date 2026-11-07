import path from "node:path";
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { ensureUnlinkedDirectory, publishOutputWithoutOverwrite } from "./fsIsolation";
import { createIsolatedRenderBundle } from "./bundle";
import { emptyMedia } from "../plan/media";
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
  await ensureUnlinkedDirectory(outDir);
  log("تجميع المشروع…");
  const sandbox = await createIsolatedRenderBundle(emptyMedia);
  try {
  const serveUrl = sandbox.serveUrl;
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
        const pending = output + `.${randomUUID()}.part.png`;
        try {
          await renderStill({ serveUrl, composition, output: pending, frame, browserExecutable });
          written.push(await publishOutputWithoutOverwrite(pending, output));
        } finally {
          await rm(pending, { force: true });
        }
      }
      log(`لقطات ${composition.id}`);
    } else {
      const output = path.join(outDir, `${composition.id}.mp4`);
      const pending = output + `.${randomUUID()}.part.mp4`;
      let last = -1;
      try {
      await renderMedia({
        serveUrl,
        composition,
        codec: "h264",
        crf: 20,
        x264Preset: "veryfast",
        outputLocation: pending,
        browserExecutable,
        onProgress: ({ progress }) => {
          const pct = Math.floor(progress * 10) * 10;
          if (pct !== last) {
            last = pct;
            log(`${composition.id}: ${pct}%`);
          }
        },
      });
      written.push(await publishOutputWithoutOverwrite(pending, output));
      } finally {
        await rm(pending, { force: true });
      }
    }
  }
  return written;
  } finally {
    await sandbox.cleanup();
  }
};
