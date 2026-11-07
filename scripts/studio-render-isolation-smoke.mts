/**
 * Synthetic Remotion smoke test: only engine sample compositions, NOT an episode.
 * Invoked solely by studio-render-isolation-acceptance.mjs in approved Mac worktree.
 */
import path from "node:path";
import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import { selectComposition, renderMedia, renderStill } from "@remotion/renderer";
import { browserExecutable, createIsolatedRenderBundle } from "../src/render/bundle";
import { emptyMedia } from "../src/plan/media";

if (process.platform !== "darwin" || process.env.BAL_STUDIO_REVIEW_APPROVED !== "YES" ||
    !process.env.BAL_STUDIO_REVIEW_ROOT)
  throw new Error("No approved isolated Mac review context.");
const evidenceDir = process.argv[2];
if (!evidenceDir || !path.isAbsolute(evidenceDir))
  throw new Error("Absolute isolated evidence directory required.");
const actualRoot = path.resolve(evidenceDir);
const approvedRoot = path.resolve(process.env.BAL_STUDIO_REVIEW_ROOT);
if (!actualRoot.startsWith(path.join(approvedRoot, "renders", "isolated-acceptance") + path.sep))
  throw new Error("Synthetic output must remain inside the approved isolated review root.");

const result: Record<string, unknown> = {
  syntheticOnly: true, usesEpisodeMedia: false, productionRender: false,
  files: [] as { path: string; bytes: number; sha256: string; width?: number; height?: number }[],
};
const bundleScope = await createIsolatedRenderBundle(emptyMedia);
try {
  const serveUrl = bundleScope.serveUrl;
  const browser = browserExecutable();
  for (const orientation of ["landscape", "portrait"] as const) {
    // Renderer-provided sample compositions have no donor/customer/episode data.
    const stillId = `brand-paper-${orientation}`;
    const stillComp = await selectComposition({ serveUrl, id: stillId, browserExecutable: browser });
    const stillOutput = path.join(actualRoot, `synthetic-${orientation}.png`);
    await renderStill({ serveUrl, composition: stillComp, output: stillOutput, scale: 0.4, browserExecutable: browser });
    const png = await readFile(stillOutput);
    if (png.subarray(1, 4).toString() !== "PNG" || png.length < 1000)
      throw new Error(`Invalid PNG smoke output: ${orientation}`);
    const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
    if (orientation === "landscape" && !(w > h) || orientation === "portrait" && !(h > w))
      throw new Error(`Invalid screenshot orientation ${orientation}: ${w}x${h}`);
    (result.files as any[]).push({
      path: stillOutput, bytes: png.length,
      sha256: createHash("sha256").update(png).digest("hex"), width: w, height: h,
    });

    const reelId = `reel-paper-${orientation}`;
    const videoComp = await selectComposition({ serveUrl, id: reelId, browserExecutable: browser });
    const videoOutput = path.join(actualRoot, `synthetic-${orientation}.mp4`);
    await renderMedia({
      serveUrl, composition: videoComp, codec: "h264",
      outputLocation: videoOutput, browserExecutable: browser,
      framesToRender: [0, Math.min(29, videoComp.durationInFrames - 1)],
      scale: 0.25, crf: 28, x264Preset: "ultrafast", muted: true,
    });
    const mp4 = await readFile(videoOutput);
    if (mp4.length < 1000 || mp4.subarray(4, 8).toString() !== "ftyp")
      throw new Error(`Invalid MP4 smoke output: ${orientation}`);
    (result.files as any[]).push({
      path: videoOutput, bytes: (await stat(videoOutput)).size,
      sha256: createHash("sha256").update(mp4).digest("hex"),
    });
  }
  result.result = "PASS_SYNTHETIC_ONLY";
  await writeFile(path.join(actualRoot, "remotion-smoke.json"), JSON.stringify(result, null, 2) + "\n");
} finally {
  await bundleScope.cleanup();
}
