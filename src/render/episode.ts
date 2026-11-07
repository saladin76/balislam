import type { ChannelConfig } from "../channel/types";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { loadStoryboard, storyboardBlockMessage, storyboardStatus, unapprovedScenes } from "../plan/storyboard";
import { mkdir } from "node:fs/promises";
import { rename, stat, unlink } from "node:fs/promises";
import { RenderInternals, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { resolveScriptPath } from "../script/episodes";
import { loadPlan, regeneratePlan } from "../plan/io";
import { prepareRenderMedia, studioMediaNamespace } from "../plan/collect";
import { defaultRenderMediaRoot } from "../plan/renderStage";
import { emptyMedia, type EpisodeMedia } from "../plan/media";
import type { Plan } from "../plan/types";
import type { Orientation } from "../remotion/scenes/types";
import { browserExecutable, createIsolatedRenderBundle } from "./bundle";
import { assertEpisodeOutputConfined, assertNoLinkedPath, publishOutputWithoutOverwrite } from "./fsIsolation";
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
/** مشاهد الآيات في النطاق التي ليس لها نص أو تلاوة (حين تختار القناة قارئًا). */
export const versesWithoutRecitation = (plan: { chapters: { scenes: { id: string; template: string; ayahKey?: string }[] }[] }, media: Pick<EpisodeMedia, "recitations">, ids: Set<string>, needsRecitation: boolean) =>
  needsRecitation ? plan.chapters.flatMap((c) => c.scenes).filter((s) => ids.has(s.id) && s.template === "verse-card" && (!s.ayahKey || !media.recitations[s.ayahKey])).map((s) => s.id) : [];

/**
 * بوابات النسخة النهائية (Master): تمنع خروج ملف يبدو مكتملًا مع نقص. كل حالة تستوجب المنع ترمي خطأ بسببها:
 * سكريبت غير صالح، أخطاء خطة (منها آية بلا نص)، توثيق ناقص أو مرفوض، صوت ناقص أو لا يطابق نصه، آية بلا تلاوة،
 * ستوري بورد غير معتمد أو تغيّر بعد اعتماده، ومشاهد لم تُراجع.
 */
export const assertMasterReady = async (o: { scriptPath: string; plan: Plan; media: EpisodeMedia; channel: ChannelConfig; chapter?: number; allowUnreviewed?: boolean }) => {
  const { scriptPath, plan, media } = o;
  const { readFile } = await import("node:fs/promises");
  const { parseScript } = await import("../script/parse");
  const { checkForChannel } = await import("../script/checkChannel");
  const { planIssues } = await import("../plan/validate");
  const { loadLedger, reviewItems, reviewSummary } = await import("../script/review");
  const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
  const checked = checkForChannel(parsed);
  if (!checked.ok) throw new Error("السكريبت غير صالح للرندر النهائي؛ راجع تبويب السكريبت وفحوصه.");
  const errors = planIssues(plan, o.channel).filter((issue) => issue.level === "error");
  if (errors.length) throw new Error(`خطة الحلقة بها أخطاء تمنع النشر: ${errors.slice(0, 5).map((issue) => issue.message).join("؛ ")}`);
  const citations = reviewSummary(reviewItems(parsed, await loadLedger(scriptPath)));
  if (!citations.ok) throw new Error(`توثيق الاستشهادات غير مكتمل: ${citations.verified} من ${citations.total}. راجع سجل التوثيق قبل الرندر النهائي.`);
  const ids = new Set(plan.chapters.filter((c) => !o.chapter || c.number === o.chapter).flatMap((c) => c.scenes.map((s) => s.id)));
  const required = plan.chapters.flatMap((c) => c.scenes).filter((s) => ids.has(s.id) && s.narration.trim());
  const missing = required.filter((s) => {
    const clip = media.voice[s.id];
    return !clip || clip.text !== s.narration.trim() || !existsSync(path.join(path.dirname(scriptPath), "voice", clip.file));
  }).map((s) => s.id);
  if (missing.length) throw new Error(`لا يمكن رندر نسخة نهائية بلا تعليق صوتي مطابق في: ${missing.slice(0, 10).join("، ")}${missing.length > 10 ? "…" : ""}`);
  // القناة التي اختارت قارئًا: لا آية في النسخة النهائية بلا تلاوتها (مرخّصة أو من القارئ المختار)
  const verseGaps = versesWithoutRecitation(plan, media, ids, true);
  const unsafeVerseScenes = plan.chapters.flatMap((chapter) => chapter.scenes)
    .filter((scene) => ids.has(scene.id) && scene.template === "verse-card" &&
      (!scene.ayahKey || media.recitations[scene.ayahKey]?.source !== "manual"))
    .map((scene) => scene.id);
  if (unsafeVerseScenes.length)
    throw new Error("لا يجوز استخدام تلاوة من مصدر خارجي أو مشهد قرآني بلا تسجيل بشري معتمد: " + unsafeVerseScenes.join("، "));
  if (verseGaps.length) throw new Error(`لا يمكن رندر نسخة نهائية وفيها آية بلا تلاوة: ${verseGaps.slice(0, 10).join("، ")}${verseGaps.length > 10 ? "…" : ""}. أرفق التلاوة البشرية الخاصة بالحلقة وراجعها أولًا.`);
  const sbRecord = await loadStoryboard(scriptPath);
  const sb = storyboardStatus(plan, sbRecord);
  const blocked = unapprovedScenes(sb, [...ids]);
  if (blocked.length) throw new Error(storyboardBlockMessage(blocked, sb));
  // Legacy maintenance flags cannot bypass final AV or scene review.
  const items = sceneReviewItems(plan, await loadSceneLedger(scriptPath)).filter((item) => ids.has(item.id));
  const review = sceneReviewSummary(items);
  if (!review.done) throw new Error(sceneReviewBlockMessage(review, items));
  const { assertVoiceApproved } = await import("../voice/review");
  await assertVoiceApproved(scriptPath, plan, media.voice);
  return true;
};

/** Real narration word cues are eligible only when every clip AND the complete
 * episode recording have a valid, current human listening approval. */
export const voiceTimingMode = async (scriptPath: string, plan: Plan, media: EpisodeMedia): Promise<"estimated" | "approved"> => {
  const { episodeVoiceApproved } = await import("../voice/review");
  return await episodeVoiceApproved(scriptPath, plan, media.voice) ? "approved" : "estimated";
};

/** Reject snapshots from other channels or episodes, including caller supplied media. */
export const assertRenderMediaOwnership = (scriptPath: string, media: EpisodeMedia): void => {
  const expected = studioMediaNamespace(scriptPath).render;
  const valid = new RegExp("^_render/[a-z0-9]+(?:-[a-z0-9]+)*/[0-9]{3}-[a-z0-9]+(?:-[a-z0-9]+)*/[a-f0-9]{24}/$");
  if (media.mode !== "static" || !valid.test(media.base) || !media.base.startsWith(expected))
    throw new Error("وسائط الرندر لا تخص القناة والحلقة المختارتين.");
};
export const assertRenderChannelOwnership = (scriptPath: string, activeChannelId: string): void => {
  if (studioMediaNamespace(scriptPath).channelName !== activeChannelId)
    throw new Error("مسار السكريبت لا يخص القناة النشطة.");
};

export const renderEpisode = async (opts: RenderEpisodeOptions): Promise<string> => {
  const log = opts.onProgress ?? (() => {});
  const scriptPath = await resolveScriptPath(opts.episode);
  await assertNoLinkedPath(scriptPath, true);
  assertRenderChannelOwnership(scriptPath, loadChannel().id);
  const plan = opts.plan ?? (await loadPlan(opts.episode)) ?? (await regeneratePlan(opts.episode));
  const requestedOutput = opts.outFile ?? path.join(await outDirFor(opts.episode),
    `${plan.episode || opts.episode}-${opts.chapter ? `ch${opts.chapter}-` : ""}${opts.orientation}.mp4`);
  await assertEpisodeOutputConfined(scriptPath, requestedOutput);
  if (opts.quality === "master") {
    const { requireScenesReadyForMaster } = await import("../studio/sceneService");
    await requireScenesReadyForMaster(opts.episode);
  }
  log(0, "تجهيز الوسائط…");
  // الوسائط تُنسخ قبل التجميع، لأن Remotion يضمّ مجلد public وقت التجميع
  const media = opts.media ?? (await prepareRenderMedia(opts.episode, plan, {
    requireApprovedQuran: opts.quality === "master",
  }));
  assertRenderMediaOwnership(scriptPath, media);
  // لا يُسمح بخروج ملف Master يبدو مكتملًا مع نقص صوت أو مراجعات.
  if (opts.quality === "master") {
    const scriptPath = await resolveScriptPath(opts.episode);
    // Every direct Master path (Studio queue, CLI, package/shorts) must enforce
    // distinct explicit script, visual and complete-audio human signoffs BEFORE
    // assembling the expensive animated Master. Preview remains estimated.
    // The stage snapshot must carry the exact human-reviewed Quran MP3 bytes.
    // Reject fake/old/cloud recordings and any untrusted caller-supplied media.
    const { assertRenderedRecitationsMatchApprovals } = await import("../quran/renderContract");
    await assertRenderedRecitationsMatchApprovals(
      scriptPath, undefined, media, defaultRenderMediaRoot(),
    );
    const { assertMotionStartAuthorized } = await import("../voice/motionGate");
    await assertMotionStartAuthorized(scriptPath, plan, media.voice);
    const { assertWorkflowForEpisode } = await import("../workflow/server");
    await assertWorkflowForEpisode(opts.episode, "master_render");
    const sbRecord = await loadStoryboard(scriptPath);
    await assertMasterReady({ scriptPath, plan, media, channel: loadChannel(), chapter: opts.chapter, allowUnreviewed: opts.allowUnreviewed });
    const { loadStoryboardMotion } = await import("./storyboardMotion");
    const { currentMotionFingerprint } = await import("./motionFingerprint");
    const measured = await loadStoryboardMotion(opts.episode);
    if (measured) {
      const { staleMotionScenes, auditNeedsJustification } = await import("./motionValidity");
      const currentHash = await currentMotionFingerprint(opts.episode, plan, measured.orientation);
      if (staleMotionScenes(plan, measured, currentHash).length)
        throw new Error("نتيجة فحص الحركة والمنطق قديمة أو ناقصة المشاهد؛ أعد الفحص قبل الرندر النهائي.");
      if (auditNeedsJustification(measured, sbRecord.audit))
        throw new Error("يوجد تحذير حركة حديث لم يراجعه صاحب الحلقة؛ افتح الستوري بورد وسجّل سبب الاعتماد قبل Master.");
    }
  }
  log(0, "تجميع المشروع…");
  // Include this episode's immutable media snapshot and shared public assets,
  // never other channels' staged voice/recitation in the Remotion bundle.
  const bundleScope = await createIsolatedRenderBundle(media);
  try {
  const serveUrl = bundleScope.serveUrl;
  const channel = loadChannel();
  const timingMode = await voiceTimingMode(await resolveScriptPath(opts.episode), plan, media);
  const inputProps = { plan, orientation: opts.orientation, chapter: opts.chapter, media, timingMode, identity: loadChannelIdentity(), channel: channelInfo(channel) };
  const composition = await selectComposition({ serveUrl, id: `episode-${opts.orientation}`, inputProps, browserExecutable: browserExecutable() });
  const q = QUALITY[opts.quality ?? "preview"];
  const output = requestedOutput;
  // اترك الملف السابق كما هو عند فشل عملية توليد جديدة؛ لا تُعرَض نتيجة جزئية.
  if (!/\.mp4$/i.test(output)) throw new Error("ملف الرندر النهائي يجب أن يكون MP4.");
  await mkdir(path.dirname(output), { recursive: true });
  // Unique per invocation: concurrent landscape/portrait attempts cannot overwrite
  // or remove one another's partial file. Rename is only performed after success.
  const tempOutput = output.replace(/\.mp4$/i, "") + `.${randomUUID()}.rendering.mp4`;
  try {
    await renderMedia({
      serveUrl,
      composition,
      inputProps,
      codec: "h264",
      scale: q.scale,
      crf: q.crf,
      x264Preset: q.x264Preset,
      audioCodec: "aac",
      audioBitrate: q.audioBitrate,
      colorSpace: "bt709",
      outputLocation: tempOutput,
      browserExecutable: browserExecutable(),
      onProgress: ({ progress }) => log(Math.round(progress * 100), "رندر"),
    });
    await cleanMetadata(tempOutput, { title: plan.title, artist: channel.name });
    if (opts.quality === "master") {
      const { requireScenesReadyForMaster } = await import("../studio/sceneService");
      await requireScenesReadyForMaster(opts.episode);
    }
    return await publishOutputWithoutOverwrite(tempOutput, output);
  } finally {
    await unlink(tempOutput).catch(() => {});
  }
  } finally {
    await bundleScope.cleanup();
  }
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
  // A thumbnail uses shared fonts and art, never unpublished episode audio.
  const sandbox = await createIsolatedRenderBundle(emptyMedia);
  try {
    const serveUrl = sandbox.serveUrl;
    const channel = loadChannel();
    const props = { ...input, identity: loadChannelIdentity(), channel: channelInfo(channel) };
    const composition = await selectComposition({ serveUrl, id: "thumbnail", inputProps: props, browserExecutable: browserExecutable() });
    for (const scale of [2, 1.5, 1]) {
      await renderStill({ serveUrl, composition, inputProps: props, output, scale, overwrite: true, browserExecutable: browserExecutable() });
      if ((await stat(output)).size <= THUMB_MAX_BYTES) break;
    }
    return output;
  } finally {
    await sandbox.cleanup();
  }
};
