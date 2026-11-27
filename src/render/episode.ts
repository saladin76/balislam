import { planOrder, sceneNames } from "../i18n/sceneNames";
import { assertTemplatesApproved } from "../plan/templateApproval";
import { assertEditorPassed, scriptPathFromRenderMedia } from "../studio/scriptPipelineStore";
import { consumeMacRenderPermit } from "./macRenderPermit";
import type { ChannelConfig } from "../channel/types";
import { versesAreCitations } from "../quran/citation";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { loadStoryboard, storyboardBlockMessage, storyboardStatus, unapprovedScenes } from "../plan/storyboard";
import { mkdir } from "node:fs/promises";
import { rename, stat, unlink } from "node:fs/promises";
import { RenderInternals, renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { resolveScriptPath } from "../script/episodes";
import { loadPlan, regeneratePlan } from "../plan/io";
import { segmentPlan } from "../plan/shorts";
import { prepareRenderMedia, studioMediaNamespace } from "../plan/collect";
import { defaultRenderMediaRoot } from "../plan/renderStage";
import { emptyMedia, type EpisodeMedia } from "../plan/media";
import type { Plan } from "../plan/types";
import type { Orientation } from "../remotion/scenes/types";
import { browserExecutable, createIsolatedRenderBundle } from "./bundle";
import { assertEpisodeOutputConfined, assertNoLinkedPath, publishOutputWithoutOverwrite } from "./fsIsolation";
import { channelInfo, loadChannel, loadChannelIdentity } from "../channel";
import { qualitySpec, type Quality } from "./quality";

export type RenderEpisodeOptions = {
  episode: string;
  orientation: Orientation;
  /** فصل واحد فقط (للشورت) */
  chapter?: number;
  /**
   * شورت بمقطع يختاره المالك (plan.shorts، src/plan/shorts.ts): المشاهد وحدها تُرندر قسمًا واحدًا بلا عنوان،
   * وكل البوابات تُفحص على الخطة كاملة كما هي.
   */
  segment?: { sceneIds: string[] };
  /** الشورت وحده (تكملة D207): سؤاله من حزمة النشر عنوانًا هادئًا على الشاشة (src/remotion/scenes/ShortTitle.tsx) */
  shortTitle?: string;
  outFile?: string;
  /** master لكل ما يُنشر (4K)، وpreview للمعاينات (الافتراضي) */
  quality?: Quality;
  plan?: Plan;
  media?: EpisodeMedia;
  /** استثناء صريح للصيانة فقط؛ لا يُستخدم من الواجهة العامة. */
  allowUnreviewed?: boolean;
  /** True only for an owner-authorized single-scene review cut. Never a Master approval. */
  scenePreview?: boolean;
  /**
   * Studio-only draft marks burned into a scene review draft: verse scenes rendered with a silent
   * placeholder because their human recitation comes last («التلاوة تُضاف لاحقًا»). Refused for Master.
   */
  draftMarks?: { pendingRecitation: string[] };
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
 * سكريبت غير صالح، أخطاء خطة (منها آية بلا نص)، صوت ناقص أو لا يطابق نصه، آية بلا تلاوة،
 * ستوري بورد غير معتمد أو تغيّر بعد اعتماده، ومشاهد لم تُراجع.
 */
export const assertMasterReady = async (o: { scriptPath: string; plan: Plan; media: EpisodeMedia; channel: ChannelConfig; chapter?: number; allowUnreviewed?: boolean }) => {
  const { scriptPath, plan, media } = o;
  const { readFile } = await import("node:fs/promises");
  const { parseScript } = await import("../script/parse");
  const { checkForChannel } = await import("../script/checkChannel");
  const { planIssues } = await import("../plan/validate");
  const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
  const checked = checkForChannel(parsed);
  if (!checked.ok) throw new Error("السكريبت غير صالح للرندر النهائي؛ راجع تبويب السكريبت وفحوصه.");
  // D220: نص كل آية معروضة يطابق Tanzil بالرسم العثماني حرفًا حرفًا
  const { verseSourceIssues } = await import("../quran/verseSourceIssues");
  const errors = [...planIssues(plan, o.channel), ...verseSourceIssues(plan)].filter((issue) => issue.level === "error");
  if (errors.length) throw new Error(`خطة الحلقة بها أخطاء تمنع النشر: ${errors.slice(0, 5).map((issue) => issue.message).join("؛ ")}`);
  // Citations are documentation and never block (CLAUDE.md rule 5; owner decision 10 Nov): the count is
  // shown in step ١ and step ٣ as information only, never a Master, publish or Drive gate.
  const ids = new Set(plan.chapters.filter((c) => !o.chapter || c.number === o.chapter).flatMap((c) => c.scenes.map((s) => s.id)));
  const required = plan.chapters.flatMap((c) => c.scenes).filter((s) => ids.has(s.id) && s.narration.trim());
  const missing = required.filter((s) => {
    const clip = media.voice[s.id];
    return !clip || clip.text !== s.narration.trim() || !existsSync(path.join(path.dirname(scriptPath), "voice", clip.file));
  }).map((s) => s.id);
  if (missing.length) throw new Error(`لا يمكن رندر نسخة نهائية بلا تعليق صوتي مطابق في: ${sceneNames(planOrder(plan), missing, 10)}`);
  // The basmala is the owner's approved audio (10 Nov; D239: the episode's recording or the one approved clip): never a Master with its placeholder.
  const basmalaPending = required.filter((s) => media.voice[s.id]?.basmala?.pending).map((s) => s.id);
  if (basmalaPending.length) throw new Error(`لا يمكن رندر نسخة نهائية والبسملة بلا تسجيلك المعتمد في: ${sceneNames(planOrder(plan), basmalaPending, 10)}. ثبّت نسخة البسملة المعتمدة (npx bal basmala install <الملف> ثم npx bal basmala apply) أو ارفع تسجيل الحلقة واعتمده.`);
  // القناة التي اختارت قارئًا: لا آية في النسخة النهائية بلا تلاوتها (مرخّصة أو من القارئ المختار)
  // D68: a channel whose verses are written citations has no recitation to wait for (the card is silent text).
  const cited = versesAreCitations(o.channel);
  const verseGaps = versesWithoutRecitation(plan, media, ids, !cited);
  const unsafeVerseScenes = plan.chapters.flatMap((chapter) => chapter.scenes)
    .filter((scene) => !cited && ids.has(scene.id) && scene.template === "verse-card" &&
      (!scene.ayahKey || media.recitations[scene.ayahKey]?.source !== "manual"))
    .map((scene) => scene.id);
  if (unsafeVerseScenes.length)
    throw new Error("لا يجوز استخدام تلاوة من مصدر خارجي أو مشهد قرآني بلا تسجيل بشري معتمد: " + sceneNames(planOrder(plan), unsafeVerseScenes, 10));
  if (verseGaps.length) throw new Error(`لا يمكن رندر نسخة نهائية وفيها آية بلا تلاوة: ${sceneNames(planOrder(plan), verseGaps, 10)}. أرفق التلاوة البشرية الخاصة بالحلقة وراجعها أولًا.`);
  const sbRecord = await loadStoryboard(scriptPath);
  const sb = storyboardStatus(plan, sbRecord);
  const blocked = unapprovedScenes(sb, [...ids]);
  if (blocked.length) throw new Error(storyboardBlockMessage(blocked, sb));
  // Human approvals (each scene with sound and picture, then the assembly) are enforced by the
  // scene-first ledger in renderEpisode (requireScenesReadyForMaster); nothing else is an authority.
  return true;
};

/**
 * Motion follows the REAL word timings whenever every narrated scene has its current clip with
 * word timings (plan task 3: timing from the recording, not an estimate). The human listens to the
 * voice inside each scene's AV approval; there is no separate voice approval.
 */
export const voiceTimingMode = async (_scriptPath: string, plan: Plan, media: EpisodeMedia): Promise<"estimated" | "approved"> => {
  const narrated = plan.chapters.flatMap((c) => c.scenes).filter((s) => s.narration.trim());
  const real = narrated.length > 0 && narrated.every((s) => {
    const clip = media.voice[s.id];
    return Boolean(clip && clip.text === s.narration.trim() && Array.isArray(clip.words) && clip.words.length);
  });
  return real ? "approved" : "estimated";
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

/**
 * The Master gates of every Master path (D232 phase 2: the Mac render and the Windows Master, before it is sent and again
 * before its file is imported): the approved assembly (requireScenesReadyForMaster), the exact reviewed recitations in the
 * media snapshot, the motion start authorization, assertMasterReady and a current storyboard motion check.
 */
export const assertMasterRenderGates = async (o: { episode: string; plan: Plan; media: EpisodeMedia; chapter?: number; allowUnreviewed?: boolean }) => {
  const { requireScenesReadyForMaster } = await import("../studio/sceneService");
  await requireScenesReadyForMaster(o.episode);
  const scriptPath = await resolveScriptPath(o.episode);
  const { plan, media } = o;
  // Every direct Master path (Studio queue, CLI, package/shorts, the Windows worker) must enforce
  // distinct explicit script, visual and complete-audio human signoffs BEFORE
  // assembling the expensive animated Master. Preview remains estimated.
  // The stage snapshot must carry the exact human-reviewed Quran MP3 bytes.
  // Reject fake/old/cloud recordings and any untrusted caller-supplied media.
  const { assertRenderedRecitationsMatchApprovals } = await import("../quran/renderContract");
  await assertRenderedRecitationsMatchApprovals(
    scriptPath, undefined, media, defaultRenderMediaRoot(),
  );
  const { assertMotionStartAuthorized } = await import("../voice/motionGate");
  await assertMotionStartAuthorized(o.episode, scriptPath, plan, media.voice);
  const sbRecord = await loadStoryboard(scriptPath);
  await assertMasterReady({ scriptPath, plan, media, channel: loadChannel(), chapter: o.chapter, allowUnreviewed: o.allowUnreviewed });
  const { loadStoryboardMotion } = await import("./storyboardMotion");
  const { currentMotionFingerprint } = await import("./motionFingerprint");
  const measured = await loadStoryboardMotion(o.episode);
  if (measured) {
    const { staleMotionScenes, auditNeedsJustification } = await import("./motionValidity");
    const currentHash = await currentMotionFingerprint(o.episode, plan, measured.orientation);
    if (staleMotionScenes(plan, measured, currentHash).length)
      throw new Error("نتيجة فحص الحركة والمنطق قديمة أو ناقصة المشاهد؛ أعد الفحص قبل الرندر النهائي.");
    if (auditNeedsJustification(measured, sbRecord.audit))
      throw new Error("يوجد تحذير حركة حديث لم يراجعه صاحب الحلقة؛ افتح الستوري بورد وسجّل سبب الاعتماد قبل Master.");
  }
};

export const renderEpisode = async (opts: RenderEpisodeOptions): Promise<string> => {
  if (opts.scenePreview && opts.quality === "master")
    throw Error("A scene review preview cannot be used as a Master approval.");
  if (opts.draftMarks && (opts.quality === "master" || !opts.scenePreview))
    throw Error("Draft marks (a pending recitation) belong only to a scene review draft, never to a Master.");
  const log = opts.onProgress ?? (() => {});
  const scriptPath = await resolveScriptPath(opts.episode);
  await assertNoLinkedPath(scriptPath, true);
  assertRenderChannelOwnership(scriptPath, loadChannel().id);
  // D234: لا رندر (معاينة مشهد أو تجميع أو نسخة نهائية) لسكريبت فيه جملة لم تمرّ بمحرر المحتوى، قبل تجهيز الوسائط
  await assertEditorPassed(scriptPath);
  const plan = opts.plan ?? (await loadPlan(opts.episode)) ?? (await regeneratePlan(opts.episode));
  const requestedOutput = opts.outFile ?? path.join(await outDirFor(opts.episode),
    `${plan.episode || opts.episode}-${opts.chapter ? `ch${opts.chapter}-` : ""}${opts.orientation}.mp4`);
  await assertEpisodeOutputConfined(scriptPath, requestedOutput);
  if (opts.quality === "master") {
    const { requireScenesReadyForMaster } = await import("../studio/sceneService");
    await requireScenesReadyForMaster(opts.episode);
    // D233: the whole episode on one machine. Master renders here, on the Mac, so its scene cuts must be the Mac's too.
    const { assertOneMachine, episodeSceneMachines, MAC_MACHINE } = await import("./worker/provenance");
    const machine = assertOneMachine(await episodeSceneMachines(path.join(path.dirname(scriptPath), "previews"),
      plan.chapters.flatMap((c) => c.scenes.map((s) => s.id))), "Master");
    if (machine && machine !== MAC_MACHINE)
      throw new Error(`لا Master على الماك: مشاهد الحلقة رُندرت على جهاز الرندر «${machine}» (D233: كل حلقة تُرندر كاملة على جهاز واحد). اصنع Master على الجهاز نفسه.`);
  }
  log(0, "تجهيز الوسائط…");
  // الوسائط تُنسخ قبل التجميع، لأن Remotion يضمّ مجلد public وقت التجميع
  const media = opts.media ?? (await prepareRenderMedia(opts.episode, plan, {
    requireApprovedQuran: opts.quality === "master",
  }));
  assertRenderMediaOwnership(scriptPath, media);
  // لا يُسمح بخروج ملف Master يبدو مكتملًا مع نقص صوت أو مراجعات.
  if (opts.quality === "master")
    await assertMasterRenderGates({ episode: opts.episode, plan, media, chapter: opts.chapter, allowUnreviewed: opts.allowUnreviewed });
  const timingMode = opts.scenePreview ? "scene-preview" as const
    : await voiceTimingMode(await resolveScriptPath(opts.episode), plan, media);
  // One narration bed (owner, 16 Nov): every narrated scene at the episode's own median loudness, in the Master exactly as
  // in the assembly (src/studio/narrationLoudness.ts). A single-scene review cut keeps its own level.
  const narrationGain = opts.scenePreview ? undefined
    : (await (await import("../studio/narrationLoudness")).narrationLoudness(scriptPath, plan, media)).gain;
  return renderComposition({
    plan, media, orientation: opts.orientation, chapter: opts.chapter, segment: opts.segment, shortTitle: opts.shortTitle,
    quality: opts.quality ?? "preview", scenePreview: opts.scenePreview, draftMarks: opts.draftMarks, timingMode, narrationGain,
    output: requestedOutput, onProgress: log,
    // The Master ledger is checked again after the expensive render, before the file is published.
    afterRender: opts.quality === "master" ? async () => {
      const { requireScenesReadyForMaster } = await import("../studio/sceneService");
      await requireScenesReadyForMaster(opts.episode);
    } : undefined,
  });
};

export type RenderCompositionOptions = {
  plan: Plan;
  media: EpisodeMedia;
  orientation: Orientation;
  chapter?: number;
  segment?: { sceneIds: string[] };
  shortTitle?: string;
  quality: Quality;
  scenePreview?: boolean;
  draftMarks?: { pendingRecitation: string[] };
  timingMode: "estimated" | "approved" | "scene-preview";
  narrationGain?: Record<string, number>;
  output: string;
  /** Re-checked after the expensive render, before the file is published (the Master ledger gate). */
  afterRender?: () => Promise<void>;
  onProgress?: (pct: number, msg: string) => void;
  /** D232 trials only (the worker refuses it on a studio job): browser tabs, to measure; production follows config.json. */
  concurrency?: number;
  /** D232 speed trials only (the worker refuses them on a studio job), each measured alone; production follows config.json:
   *  the x264 preset of a Master at the same crf, */
  x264Preset?: "medium" | "slow";
  /** one Remotion bundle reused by every scene of the episode (key: commit + media snapshot; src/render/bundle.ts), */
  bundleCacheKey?: string;
  /** and a Master rendered in resumable chunks, joined without re-encoding the picture (src/render/chunkedMaster.ts). */
  chunks?: { frames: number; dir: string; key: string };
};

/**
 * The render itself, with NO gate of its own (D226): the Remotion bundle of this media snapshot, renderMedia at the
 * quality's settings, loudness and metadata cleaning, then an atomic publish. Every caller gates before it:
 * renderEpisode (the ledger, recitation, storyboard and Master gates above), and the Windows render worker
 * (src/render/worker/untrustedRender.ts), whose output is UNTRUSTED until `bal worker-collect` verifies it on the Mac.
 * tests/render-worker-gates.test.ts allows no other caller.
 */
export const renderComposition = async (o: RenderCompositionOptions): Promise<string> => {
  const log = o.onProgress ?? (() => {});
  const { plan, media } = o;
  // D228: لا يُرندر مشهد بقالب أو لقطة غير معتمدة من المالك (ستوري بورد ← اختيار النموذج ← اعتماده)
  assertTemplatesApproved(plan);
  // D234: ولا رندر لسكريبت فيه جملة لم تمرّ بمحرر المحتوى (الحلقة من وصف وسائطها؛ على الماك وعلى العامل بالـcommit نفسه)
  const editorScript = scriptPathFromRenderMedia(media.base);
  if (!editorScript) throw new Error("وسائط الرندر لا تسمّي حلقتها؛ لا يُعرف سكريبتها لفحص المحرر (D234).");
  await assertEditorPassed(editorScript);
  // D241: كل رندر عمودي لمقطع أو قسم شورت؛ لا يُرندر شورت ليس فكرة كاملة وحده (على الماك وعلى العامل)
  if (o.orientation === "portrait" && (o.segment || o.chapter !== undefined))
    (await import("../package/shortIdeaPlan")).assertShortRenderIdea(plan, o.segment ? { sceneIds: o.segment.sceneIds } : { chapter: o.chapter });
  // D232: الماك لا يرندر إلا بإذن المالك الصريح لهذه المرة (العامل على ويندوز لا يحتاجه)
  await consumeMacRenderPermit(`رندر ${o.quality}${o.scenePreview ? " (قطعة مشهد)" : ""}`, { episode: path.basename(path.dirname(editorScript)) });
  log(0, "تجميع المشروع…");
  // Include this episode's immutable media snapshot and shared public assets,
  // never other channels' staged voice/recitation in the Remotion bundle.
  const bundleScope = await createIsolatedRenderBundle(media, o.bundleCacheKey ? { cacheKey: o.bundleCacheKey } : {});
  try {
  const serveUrl = bundleScope.serveUrl;
  const channel = loadChannel();
  const { timingMode, narrationGain } = o;
  const shown = o.segment ? segmentPlan(plan, { n: 1, title: "", sceneIds: o.segment.sceneIds }) : { plan, chapter: o.chapter };
  const inputProps = { plan: shown.plan, orientation: o.orientation, chapter: shown.chapter, media, timingMode, identity: loadChannelIdentity(), channel: channelInfo(channel),
    ...(narrationGain && Object.keys(narrationGain).length ? { narrationGain } : {}),
    ...(o.orientation === "portrait" && o.shortTitle?.trim() ? { shortTitle: o.shortTitle.trim() } : {}),
    ...(o.draftMarks?.pendingRecitation.length ? { draftMarks: { pendingRecitation: o.draftMarks.pendingRecitation } } : {}) };
  const composition = await selectComposition({ serveUrl, id: `episode-${o.orientation}`, inputProps, browserExecutable: browserExecutable() });
  const q = qualitySpec(o.quality);
  const output = o.output;
  // اترك الملف السابق كما هو عند فشل عملية توليد جديدة؛ لا تُعرَض نتيجة جزئية.
  if (!/\.mp4$/i.test(output)) throw new Error("ملف الرندر النهائي يجب أن يكون MP4.");
  await mkdir(path.dirname(output), { recursive: true });
  // Unique per invocation: concurrent landscape/portrait attempts cannot overwrite
  // or remove one another's partial file. Rename is only performed after success.
  const tempOutput = output.replace(/\.mp4$/i, "") + `.${randomUUID()}.rendering.mp4`;
  try {
    const common = {
      serveUrl,
      composition,
      inputProps,
      codec: "h264" as const,
      scale: q.scale,
      crf: q.crf,
      x264Preset: o.x264Preset ?? q.x264Preset,
      audioCodec: "aac" as const,
      audioBitrate: q.audioBitrate,
      // A scene with no narration (closing card) still needs a (silent) audio track: AV review,
      // assembly and Master all require one, and concat needs the same track layout in every cut.
      enforceAudioTrack: true,
      colorSpace: "bt709" as const,
      browserExecutable: browserExecutable(),
      ...(o.concurrency ? { concurrency: o.concurrency } : q.concurrency ? { concurrency: q.concurrency } : {}),
      ...(q.timeoutMs ? { timeoutInMilliseconds: q.timeoutMs } : {}),
    };
    if (o.chunks) {
      // D232 trial: chunks kept on the worker (resume after an interruption), then Remotion's own seamless join
      const { renderChunked } = await import("./chunkedMaster");
      const { combineChunks } = await import("@remotion/renderer");
      const r = await renderChunked({
        dir: o.chunks.dir, key: o.chunks.key, totalFrames: composition.durationInFrames, chunkFrames: o.chunks.frames, output: tempOutput, log,
        renderChunk: async ({ range, videoOut, audioOut, onProgress }) => {
          await renderMedia({ ...common, frameRange: range, outputLocation: videoOut, separateAudioTo: audioOut,
            forSeamlessAacConcatenation: true, compositionStart: 0, onProgress: ({ progress }) => onProgress(progress) });
        },
        combine: ({ videoFiles, audioFiles, outputLocation, framesPerChunk, totalFrames }) => combineChunks({
          outputLocation, videoFiles, audioFiles, codec: "h264", fps: composition.fps, framesPerChunk, preferLossless: false,
          compositionDurationInFrames: totalFrames, audioCodec: "aac", audioBitrate: q.audioBitrate }),
      });
      log(100, `رندر: ${r.chunks} قطعة (${r.reused} محفوظة من قبل، ${r.rendered} رُندرت الآن)`);
    } else {
      await renderMedia({
        ...common,
        // A silent placeholder verse draft still carries an (empty) audio track, so every scene cut can be
        // reviewed with sound and concatenated with the others.
        ...(o.scenePreview ? { enforceAudioTrack: true } : {}),
        outputLocation: tempOutput,
        onProgress: ({ progress }) => log(Math.round(progress * 100), "رندر"),
      });
    }
    // المرحلة A (المهمة ٣): ما يُنشر (الحلقة والشورتس) بعلو −14 LUFS بقياسين وكسب خطي (src/studio/quality/normalize.ts)
    if (o.quality === "master" && !o.scenePreview) {
      const { normalizeProgramLoudness } = await import("../studio/quality/normalize");
      const r = await normalizeProgramLoudness(tempOutput, q.audioBitrate);
      if (r.type !== "silent") log(100, `علو الصوت: ${r.before.toFixed(1)} ← ${r.after?.toFixed(1)} LUFS`);
    }
    await cleanMetadata(tempOutput, { title: plan.title, artist: channel.name });
    await o.afterRender?.();
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
export const renderThumbnail = async (input: { themeId: string; title: string; highlight?: string; element?: string; book?: string; lang?: string; /** سلسلة الحلقة (plan.series): شارتها بأسلوب القناة */ series?: import("../channel/series").SeriesStamp;
  /** غلاف من الأغلفة الثلاثة (src/package/thumbnails.ts) */ concept?: import("../remotion/Thumbnail").ThumbConceptProp }, output: string) => {
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
