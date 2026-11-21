/**
 * قياس أداء مشهد الخريطة ثلاثية الأبعاد (شرط رسالة التكليف قبل اعتماد القالب): يرندر نموذج الكرة
 * (١٠ ث) بجودة الماستر 4K ويطبع الزمن وأقصى ذاكرة. يُشغَّل يدويًا، ولا يستورده Root ولا الاستوديو.
 *
 *   npx tsx src/remotion/scenes/globeBench.ts [--gl angle|swangle] [--scale 2] [--frames 0-59] [--stills 0,90,180] [--no-video] [--out /tmp/globe]
 *
 * على ماك المالك الافتراضي gl=angle (معالج الرسوم)؛ وبلا معالج رسوم (CI أو حاوية) gl=swangle.
 */
import path from "node:path";
import os from "node:os";
import { mkdirSync } from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] ?? dflt : dflt;
};

const main = async () => {
  const gl = arg("gl", process.platform === "darwin" ? "angle" : "swangle") as "angle" | "swangle";
  const scale = Number(arg("scale", "2"));
  const out = arg("out", path.join(os.tmpdir(), "globe-bench"));
  const stills = arg("stills", "").split(",").filter(Boolean).map(Number);
  const id = arg("id", "dafatir-lab-globe");
  const concurrency = Number(arg("concurrency", "1"));
  // جزء من المشهد فقط (للقياس السريع): --frames 0-59
  const fr = arg("frames", "").split("-").map(Number);
  const frameRange: [number, number] | null = fr.length === 2 && fr.every(Number.isFinite) ? [fr[0]!, fr[1]!] : null;
  mkdirSync(out, { recursive: true });
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || null;
  const t0 = Date.now();
  const serveUrl = await bundle({ entryPoint: path.join(import.meta.dirname, "../index.ts") });
  const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions: { gl } });
  console.log(`حزمة: ${((Date.now() - t0) / 1000).toFixed(1)} ث · ${composition.width * scale}×${composition.height * scale} · ${composition.durationInFrames} إطار · gl=${gl}`);
  for (const f of stills) {
    const file = path.join(out, `still-${String(f).padStart(4, "0")}.png`);
    await renderStill({ serveUrl, composition, frame: f, output: file, scale, overwrite: true, browserExecutable, chromiumOptions: { gl } });
    console.log(`لقطة ${f}: ${file}`);
  }
  if (process.argv.includes("--no-video")) return;
  let peak = 0;
  const timer = setInterval(() => (peak = Math.max(peak, process.memoryUsage().rss)), 500);
  const t1 = Date.now();
  await renderMedia({
    serveUrl, composition, codec: "h264", crf: 14, x264Preset: "slow", colorSpace: "bt709", scale, concurrency, frameRange,
    outputLocation: path.join(out, `${id}.mp4`), browserExecutable, chromiumOptions: { gl },
    onProgress: ({ progress }) => process.stdout.write(`\rرندر ${Math.round(progress * 100)}%`),
  });
  clearInterval(timer);
  const secs = (Date.now() - t1) / 1000;
  const frames = frameRange ? frameRange[1] - frameRange[0] + 1 : composition.durationInFrames;
  console.log(`\nزمن الرندر: ${secs.toFixed(1)} ث لـ${frames} إطارًا (${(frames / composition.fps).toFixed(1)} ث من المشهد، ${(secs / (frames / composition.fps)).toFixed(1)}× الزمن الحقيقي، ${(secs / frames).toFixed(2)} ث للإطار) · ذاكرة Node القصوى ${(peak / 2 ** 20).toFixed(0)} م.ب · ${path.join(out, `${id}.mp4`)}`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
