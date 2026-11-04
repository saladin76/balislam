import path from "node:path";
import { existsSync } from "node:fs";
import { loadStoryboard, storyboardBlockMessage, storyboardStatus, unapprovedScenes } from "../plan/storyboard";
import { mkdir } from "node:fs/promises";
import { rename, stat, unlink } from "node:fs/promises";
import { RenderInternals, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { resolveScriptPath } from "../script/episodes";
import { loadPlan, regeneratePlan } from "../plan/io";
import { prepareRenderMedia } from "../plan/collect";
import type { EpisodeMedia } from "../plan/media";
import type { Plan } from "../plan/types";
import type { Orientation } from "../remotion/scenes/types";
import { browserExecutable, getServeUrl } from "./bundle";
import { channelInfo, loadChannel, loadChannelIdentity } from "../channel";
import { QUALITY, type Quality } from "./quality";
import { loadSceneLedger, sceneReviewItems, sceneReviewSummary, sceneReviewBlockMessage } from "../plan/sceneReview";

export type RenderEpisodeOptions = {
  episode: string;
  orientation: Orientation;
  /** فصل واحد فقط (للشورت) */
  chapter?: number;
  outFile?: string;
  /** master لكل ما يُنشر (4K)، وpreview للمعاينات (الافتراضي) */
  quality?: Quality;
  plan?: Plan;
  media?: EpisodeMedia;
  /** استثناء صريح للصيانة فقط؛ لا يُستخدم من الواجهة العامة. */
  allowUnreviewed?: boolean;
  onProgress?: (pct: number, msg: string) => void;
};

export const outDirFor = async (episode: string) => {
  const dir = path.join(path.dirname(await resolveScriptPath(episode)), "out");
  await mkdir(dir, { recursive: true });
  return dir;
};

/** يرندر الحلقة (أو فصلًا) من plan.json بالصوت والمؤثرات إن وُجدت. */
export const renderEpisode = async (opts: RenderEpisodeOptions): Promise<string> => {
  const log = opts.onProgress ?? (() => {});
  const plan = opts.plan ?? (await loadPlan(opts.episode)) ?? (await regeneratePlan(opts.episode));
  log(0, "تجهيز الوسائط…");
  // الوسائط تُنسخ قبل التجميع، لأن Remotion يضمّ مجلد public وقت التجميع
  const media = opts.media ?? (await prepareRenderMedia(opts.episode, plan));
  // لا يُسمح بخروج ملف Master يبدو مكتملًا مع نقص صوت أو مراجعات.
  if (opts.quality === "master") {
    const scriptPath = await resolveScriptPath(opts.episode);
    const { readFile } = await import("node:fs/promises");
    const { parseScript } = await import("../script/parse");
    const { checkForChannel } = await import("../script/checkChannel");
    const { planIssues } = await import("../plan/validate");
    const { loadLedger, reviewItems, reviewSummary } = await import("../script/review");
    const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
    const checked = checkForChannel(parsed);
    if (!checked.ok) throw new Error("السكريبت غير صالح للرندر النهائي؛ راجع تبويب السكريبت وفحوصه.");
    const errors = planIssues(plan, loadChannel()).filter((issue) => issue.level === "error");
    if (errors.length) throw new Error(`خطة الحلقة بها أخطاء تمنع النشر: ${errors.slice(0, 5).map((issue) => issue.message).join("؛ ")}`);
    const citations = reviewSummary(reviewItems(parsed, await loadLedger(scriptPath)));
    if (!citations.ok) throw new Error(`توثيق الاستشهادات غير مكتمل: ${citations.verified} من ${citations.total}. راجع سجل التوثيق قبل الرندر النهائي.`);
    const ids = new Set(plan.chapters.filter((c) => !opts.chapter || c.number === opts.chapter).flatMap((c) => c.scenes.map((s) => s.id)));
    const required = plan.chapters.flatMap((c) => c.scenes).filter((s) => ids.has(s.id) && s.narration.trim());
    const missing = required.filter((s) => {
      const clip = media.voice[s.id];
      return !clip || clip.text !== s.narration.trim() || !existsSync(path.join(path.dirname(scriptPath), "voice", clip.file));
    }).map((s) => s.id);
    if (missing.length) throw new Error(`لا يمكن رندر نسخة نهائية بلا تعليق صوتي مطابق في: ${missing.slice(0, 10).join("، ")}${missing.length > 10 ? "…" : ""}`);
    const sb = storyboardStatus(plan, await loadStoryboard(scriptPath));
    const blocked = unapprovedScenes(sb, [...ids]);
    if (blocked.length) throw new Error(storyboardBlockMessage(blocked, sb));
    if (!opts.allowUnreviewed) {
      const items = sceneReviewItems(plan, await loadSceneLedger(scriptPath)).filter((item) => ids.has(item.id));
      const review = sceneReviewSummary(items);
      if (!review.done) throw new Error(sceneReviewBlockMessage(review, items));
    }
    const { loadStoryboardMotion } = await import("./storyboardMotion");
    const { currentMotionFingerprint } = await import("./motionFingerprint");
    const measured = await loadStoryboardMotion(opts.episode);
    if (measured && (!measured.inputHash || measured.inputHash !== await currentMotionFingerprint(opts.episode, plan, measured.orientation)))
      throw new Error("نتيجة فحص الحركة والمنطق قديمة؛ أعد الفحص بعد آخر تعديل قبل الرندر النهائي.");
  }
  log(0, "تجميع المشروع…");
  const serveUrl = await getServeUrl(!opts.media);
  const channel = loadChannel();
  const inputProps = { plan, orientation: opts.orientation, chapter: opts.chapter, media, identity: loadChannelIdentity(), channel: channelInfo(channel) };
  const composition = await selectComposition({ serveUrl, id: `episode-${opts.orientation}`, inputProps, browserExecutable: browserExecutable() });
  const q = QUALITY[opts.quality ?? "preview"];
  const output = opts.outFile ?? path.join(await outDirFor(opts.episode), `${plan.episode || opts.episode}-${opts.chapter ? `ch${opts.chapter}-` : ""}${opts.orientation}.mp4`);
  await renderMedia({
    serveUrl,
    composition,
    inputProps,
    codec: "h264",
    // الجودة من config.json: master = 4K بترميز بطيء عالي الجودة، preview = 1080p سريع
    scale: q.scale,
    crf: q.crf,
    x264Preset: q.x264Preset,
    audioCodec: "aac",
    audioBitrate: q.audioBitrate,
    colorSpace: "bt709",
    outputLocation: output,
    browserExecutable: browserExecutable(),
    onProgress: ({ progress }) => log(Math.round(progress * 100), "رندر"),
  });
  await cleanMetadata(output, { title: plan.title, artist: channel.name });
  return output;
};

/**
 * قاعدة القناة: الملف المنشور لا يحمل أي أثر لأدوات الإنتاج.
 * يعيد تغليف الفيديو بلا إعادة ترميز: يحذف كل البيانات الوصفية (ومنها «Made with Remotion» ووسم المُرمِّز وتوقيع x264 داخل الصورة)
 * ويضع العنوان واسم القناة فقط، مع نقل فهرس الملف لأوله (تشغيل أسرع على المنصات).
 */
export const cleanMetadata = async (file: string, meta: { title: string; artist: string }) => {
  const tmp = file.replace(/\.mp4$/, ".clean.mp4");
  const args = ["-y", "-i", file, "-map", "0", "-c", "copy", "-map_metadata", "-1", "-map_metadata:s", "-1", "-bsf:v", "filter_units=remove_types=6", "-fflags", "+bitexact", "-flags:v", "+bitexact", "-flags:a", "+bitexact", "-metadata", `title=${meta.title}`, "-metadata", `artist=${meta.artist}`, "-movflags", "+faststart", tmp];
  try {
    await RenderInternals.callFf({ bin: "ffmpeg", args, indent: false, logLevel: "error", binariesDirectory: null, cancelSignal: undefined });
    await rename(tmp, file);
  } catch (e) {
    await unlink(tmp).catch(() => {});
    throw new Error(`تعذّر تنظيف البيانات الوصفية للفيديو: ${(e as Error).message}`);
  }
};

/** حد يوتيوب لحجم الصورة المصغّرة (2MB) مع هامش أمان */
const THUMB_MAX_BYTES = 1.9 * 1024 * 1024;

/**
 * الصورة المصغّرة بعنوان محدد، بدقة مضاعفة (2560×1440) حتى تبقى الحروف والخطوط حادة عند التنزيل والتكبير.
 * إن تجاوز الملف حد يوتيوب تنزل الدقة (1.5× ثم 1×) فلا تُرفض عند الرفع.
 */
export const renderThumbnail = async (input: { themeId: string; title: string; highlight?: string; element?: string; book?: string; lang?: string }, output: string) => {
  const serveUrl = await getServeUrl();
  const channel = loadChannel();
  const props = { ...input, identity: loadChannelIdentity(), channel: channelInfo(channel) };
  const composition = await selectComposition({ serveUrl, id: "thumbnail", inputProps: props, browserExecutable: browserExecutable() });
  for (const scale of [2, 1.5, 1]) {
    await renderStill({ serveUrl, composition, inputProps: props, output, scale, overwrite: true, browserExecutable: browserExecutable() });
    if ((await stat(output)).size <= THUMB_MAX_BYTES) break;
  }
  return output;
};
