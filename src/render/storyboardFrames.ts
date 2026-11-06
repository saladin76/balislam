import path from "node:path";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { renderStill, selectComposition } from "@remotion/renderer";
import { resolveScriptPath } from "../script/episodes";
import { loadPlan } from "../plan/io";
import { sceneFrames } from "../plan/duration";
import { storyboardHash } from "../plan/storyboard";
import { versesMissingText } from "../plan/storyboard";
import { shotFrame, shotKind, shotText } from "../plan/storyboardView";
import { prepareRenderMedia } from "../plan/collect";
import { loadChannel, loadChannelIdentity, channelInfo } from "../channel";
import { introFramesFor } from "../remotion/scenes/ChannelIntro";
import { scenesOf } from "../remotion/scenes/Episode";
import { getServeUrl } from "./bundle";
import { browserExecutable } from "./bundle";
import type { EpisodeMedia } from "../plan/media";
import type { Plan } from "../plan/types";
import type { ChannelInfo } from "../channel/types";
import config from "../../config.json";

/** Deterministic positions inside the same Episode composition as full render. */
export const storyboardFramePlan = (
  plan: Plan, media: EpisodeMedia, channel?: ChannelInfo,
  fps = config.video.fps,
) => {
  let start = introFramesFor(channel, plan);
  return scenesOf({ plan }).map(({ chapter, scene }) => {
    const duration = sceneFrames(scene, media, fps);
    const frame = start + shotFrame(scene, duration);
    start += duration;
    return { scene, chapter: chapter.number, frame, duration, hash: storyboardHash(scene) };
  });
};

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const goodPng = async (file: string) => {
  try {
    const bytes = await readFile(file);
    return bytes.length > 128 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  } catch { return false; }
};

/**
 * Produce real, self-contained visual frames for ALL episode scenes.
 * Never writes storyboard.json or approves any scene. No movie is rendered.
 * Existing versioned PNGs are preserved; reject corrupt outputs instead of overwriting.
 */
export const renderStoryboardFrames = async (
  episode: string,
  opts: { orientation?: "landscape" | "portrait"; onProgress?: (text: string) => void } = {},
) => {
  const orientation = opts.orientation ?? "landscape";
  const log = opts.onProgress ?? (() => {});
  const scriptPath = await resolveScriptPath(episode);
  const plan = await loadPlan(episode);
  if (!plan) throw new Error("خطة المشاهد غير موجودة؛ أنشئ الخطة أولًا، ولا تُعتمد أي صور تلقائيًا.");
  const missingVerses = versesMissingText(plan);
  if (missingVerses.length)
    throw new Error("لا يمكن إخراج لوحات آيات بنصوص ناقصة: " + missingVerses.slice(0, 12).join("، "));
  const media = await prepareRenderMedia(episode, plan);
  const channel = loadChannel();
  const identity = loadChannelIdentity();
  const channelDetails = channelInfo(channel);
  const storyboardDir = path.join(path.dirname(scriptPath), "storyboard");
  await mkdir(storyboardDir, { recursive: true });
  const frames = storyboardFramePlan(plan, media, channelDetails);
  if (!frames.length) throw new Error("لا توجد مشاهد في خطة الحلقة.");
  const inputProps = { plan, media, identity, channel: channelDetails, orientation };
  log("تجميع نسخة الصور الثابتة للستوري بورد…");
  const serveUrl = await getServeUrl(true);
  const composition = await selectComposition({ serveUrl, id: `episode-${orientation}`, inputProps, browserExecutable: browserExecutable() });
  const rows: { scene: string; file: string; frame: number; duration: number; chapter: number; hash: string }[] = [];
  for (const [index, item] of frames.entries()) {
    if (!/^[a-z0-9][a-z0-9_-]{0,80}$/i.test(item.scene.id)) throw new Error("معرّف مشهد غير آمن للصور الثابتة.");
    const name = `${item.scene.id}-${orientation}-${item.hash}.png`;
    const out = path.join(storyboardDir, name);
    if (!existsSync(out)) {
      log(`${index + 1}/${frames.length}: ${item.scene.id}`);
      await renderStill({ serveUrl, composition, inputProps, frame: item.frame, output: out, browserExecutable: browserExecutable() });
    }
    if (!(await goodPng(out))) throw new Error(`الصورة غير صالحة: ${name}`);
    rows.push({ scene: item.scene.id, file: name, frame: item.frame, duration: item.duration, chapter: item.chapter, hash: item.hash });
  }
  const manifestName = `storyboard-${orientation}-${createHash("sha256").update(JSON.stringify(rows.map(({ hash, scene }) => [scene, hash]))).digest("hex").slice(0, 12)}.md`;
  const lines = [
    `# لوحات Storyboard — ${plan.title}`, "",
    `القناة: ${channel.id} | الحلقة: ${episode} | الاتجاه: ${orientation}`,
    `عدد المشاهد: ${rows.length} | حالة المراجعة: PENDING_REVIEW — غير معتمدة للنشر`, "",
    "كل لوحة صورة ناتجة من التكوين الفعلي للمشهد، وليست ملف plan.json نصيًا. يجب مراجعة كل لوحة قبل الصوت والفيديو.", "",
  ];
  for (const [i, item] of frames.entries()) {
    const row = rows[i]!;
    lines.push(`## ${row.scene} — الفصل ${row.chapter} — ${shotKind(item.scene)}`, "",
      `![${row.scene}](./${row.file})`, "",
      `**التعليق:** ${item.scene.narration.trim() || "بلا تعليق"}`, "",
      `**النبرة المقترحة/المختارة:** ${item.scene.tone ?? "لم تحدد — تُحسم قبل الصوت"}`, "",
      `**العناصر المرئية:** ${shotText(item.scene)}`, "",
      `**إطار المعاينة:** ${row.frame} | **البصمة:** ${row.hash}`, "",
    );
  }
  const manifest = path.join(storyboardDir, manifestName);
  await writeFile(manifest, lines.join("\n") + "\n", "utf8");
  // Browser-printable contact book; no asset is uploaded or shared automatically.
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(plan.title)} — Storyboard</title>
<style>body{font:16px system-ui;margin:28px;color:#21292f;background:#f8fafc}article{break-inside:avoid;background:white;border:1px solid #ddd;border-radius:12px;padding:18px;margin:20px 0}img{width:100%;max-width:850px;object-fit:contain;border:1px solid #eee}h2{font-size:20px}p{line-height:1.7}@media print{body{margin:8px}article{page-break-inside:avoid}}</style></head><body>
<h1>${esc(plan.title)} — Storyboard (${orientation})</h1><p>مراجعة بصرية مطلوبة لكل ${rows.length} مشهد — ليس اعتمادًا للنشر</p>
${frames.map((item, i) => `<article><h2>${esc(item.scene.id)} — ${esc(shotKind(item.scene))}</h2>
<img src="./${rows[i]!.file}" alt="${esc(item.scene.id)}" /><p>${esc(item.scene.narration || "بلا تعليق")}</p>
<p>النبرة: ${esc(item.scene.tone ?? "لم تحدد")}</p></article>`).join("\n")}</body></html>`;
  const htmlFile = manifest.replace(/\.md$/, ".html");
  await writeFile(htmlFile, html, "utf8");
  return { storyboardDir, manifest, htmlFile, rows, approved: false };
};
