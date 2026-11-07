import path from "node:path";
import { channelInfo } from "../channel/types";
import { chaptersText, generatePublishKit, kitToMarkdown } from "./social";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolveScriptPath } from "../script/episodes";
import { parseScript } from "../script/parse";
import { loadPlan, regeneratePlan } from "../plan/io";
import { prepareRenderMedia } from "../plan/collect";
import { scenesOf } from "../remotion/scenes/Episode";
import { renderEpisode, renderThumbnail, outDirFor } from "../render/episode";
import { buildSrt } from "./captions";
import { assertNoTraces } from "./traces";
import { kitBlockMessage, kitIssues } from "./quality";
import { loadSceneLedger, sceneReviewBlockMessage, sceneReviewItems, sceneReviewSummary } from "../plan/sceneReview";
import { measureMotion, motionSummary, MOTION_MIN, type MotionReport } from "../render/motionMeter";
import { exemptForRender } from "../render/stillness";
import { buildYoutubeText, publishChecklist } from "./youtube";
import { loadChannel, loadChannelIdentity } from "../channel";
import { approvalValid, QUALITY, renderInfoFile, type Quality, type RenderInfo } from "../render/quality";
import { unlink } from "node:fs/promises";

export type PackageOptions = {
  episode: string;
  /** بلا رندر فيديو (الوصف والترجمة والصور فقط) */
  skipVideo?: boolean;
  /** عدد الشورتس (فصل لكل شورت) */
  shorts?: number;
  /**
   * المرحلة: episode = النسخة الأساسية (الحلقة والنصوص والصور المصغّرة)؛
   * shorts = الشورتس/الريلز، ولا تُصنع إلا بعد اعتماد النسخة الأساسية في الاستوديو
   */
  stage?: "episode" | "shorts";
  /** جودة الرندر: master لما يُنشر (الافتراضي)، preview للمعاينة بلا صوت */
  quality?: Quality;
  onProgress?: (msg: string) => void;
  /** صناعة النسخة النهائية قبل اكتمال مراجعة المشاهد (من سطر الأوامر فقط) */
  ignoreSceneReview?: boolean;
};

/**
 * يجهّز كل ما يُرفع إلى يوتيوب في out/package، على مرحلتين:
 * ١) النسخة الأساسية: الحلقة 16:9 بأعلى جودة، و3 صور مصغّرة، وترجمة الحلقة، والوصف، وقائمة النشر.
 * ٢) بعد اعتمادها في الاستوديو: شورت/ريل 9:16 لكل فصل بأعلى جودة مع ترجمته.
 */
export const packageEpisode = async (opts: PackageOptions) => {
  const log = opts.onProgress ?? (() => {});
  const ep = opts.episode;
  const scriptPath = await resolveScriptPath(ep);
  const script = await readFile(scriptPath, "utf8");
  const plan = (await loadPlan(ep)) ?? (await regeneratePlan(ep));
  const dir = path.join(await outDirFor(ep), "package");
  await mkdir(dir, { recursive: true });
  const id = plan.episode || ep;
  const shorts = Math.min(opts.shorts ?? 6, plan.chapters.length);
  const stage = opts.stage ?? "episode";
  const quality: Quality = opts.quality ?? "master";
  const episodePath = path.join(dir, `${id}-episode.mp4`);
  const statusFile = path.join(path.dirname(scriptPath), "status.json");
  const readStatus = async () => (existsSync(statusFile) ? JSON.parse(await readFile(statusFile, "utf8")) : {});
  // قاعدة: كل مشهد يُراجَع بعد تنفيذه (حركاته سليمة ومتناسقة مع النص وغير عشوائية) قبل النسخة النهائية
  if (quality === "master" && !opts.skipVideo && !opts.ignoreSceneReview) {
    const items = sceneReviewItems(plan, await loadSceneLedger(scriptPath));
    const sum = sceneReviewSummary(items);
    if (!sum.done) throw new Error(sceneReviewBlockMessage(sum, items));
  }
  if (stage === "shorts") {
    // Shorts are distribution artifacts: require owner approval of the exact Master.
    const { assertWorkflowForEpisode } = await import("../workflow/server");
    await assertWorkflowForEpisode(ep, "publish");
    const info = existsSync(renderInfoFile(dir)) ? (JSON.parse(await readFile(renderInfoFile(dir), "utf8")) as RenderInfo) : null;
    if (!info || info.quality !== "master" || !info.voiced) throw new Error("الشورتس تُصنع من النسخة النهائية بأعلى جودة وبصوت كامل. اصنع النسخة النهائية أولًا.");
    if (!approvalValid((await readStatus()).approved, episodePath)) throw new Error("اعتمد النسخة الأساسية من تبويب «النشر» بعد مشاهدتها كاملة، ثم اصنع الشورتس.");
  }

  log("تجهيز الوسائط…");
  const media = await prepareRenderMedia(ep, plan);
  // الصوت «كامل» فقط إن كان لكل مشهد متكلَّم مقطع يطابق نصه الحالي
  const narrated = plan.chapters.flatMap((c) => c.scenes).filter((s) => s.narration.trim());
  const voicedOk = narrated.filter((s) => {
    const clip = media.voice[s.id];
    return clip?.text === s.narration.trim() && existsSync(path.join(path.dirname(scriptPath), "voice", clip.file));
  }).length;
  const hasVoice = narrated.length > 0 && voicedOk === narrated.length;
  if (narrated.length && !hasVoice && quality === "master" && !opts.skipVideo)
    throw new Error(`النسخة النهائية تتطلب صوتًا مطابقًا في كل مشهد: ${voicedOk} من ${narrated.length}. أكمل الصوت أو استخدم معاينة غير قابلة للنشر.`);
  if (narrated.length && !hasVoice) log(`⚠️ الصوت ناقص: ${voicedOk} من ${narrated.length} مشهدًا فقط لها صوت مطابق لنصها؛ الباقي صامت بتوقيت تقديري.`);
  const files: string[] = [];

  // النصوص أولًا: سريعة ولا تحتاج رندر
  const channel = loadChannel();
  const identity = loadChannelIdentity();
  const lang = plan.lang ?? channel.language;
  await writeFile(path.join(dir, "youtube.md"), buildYoutubeText(plan, script, media, shorts, channel));
  await writeFile(path.join(dir, "publish-checklist.md"), publishChecklist(plan, hasVoice, channel));
  await writeFile(path.join(dir, `${id}-episode.${lang}.srt`), buildSrt(plan, scenesOf({ plan }).map((x) => x.scene), media, identity));
  if (stage === "shorts")
    for (let n = 1; n <= shorts; n++) {
      const ch = plan.chapters[n - 1]!;
      await writeFile(path.join(dir, `${id}-short-${n}.${lang}.srt`), buildSrt(plan, scenesOf({ plan, chapter: ch.number }).map((x) => x.scene), media, identity));
    }
  files.push("youtube.md", "publish-checklist.md", `${id}-episode.${lang}.srt`);

  // حزمة الانتشار (عناوين وكابشن لكل منصة): من publish.json إن وُجد، وإلا نسخة آلية
  {
    const kitFile = path.join(path.dirname(scriptPath), "publish.json");
    const kit = existsSync(kitFile) ? JSON.parse(await readFile(kitFile, "utf8")) : generatePublishKit(plan, script, media, channel);
    if (!existsSync(kitFile)) await writeFile(kitFile, JSON.stringify(kit, null, 2) + "\n");
    // جودة النشر: لا عنوان عام ولا جملة مكررة ولا نص مبتور ولا وسم مكرر (قبل أي رندر مكلف)
    const kq = kitIssues(kit);
    if (kq.some((i) => i.level === "error")) throw new Error(kitBlockMessage(kq));
    await writeFile(path.join(dir, "social.md"), kitToMarkdown(kit, plan.title, chaptersText(plan, media, channelInfo(loadChannel()))));
    files.push("social.md");
  }

  // قاعدة القناة: لا أثر لأدوات الإنتاج في أي نص منشور (قبل أي رندر مكلف)
  const published = (await readdir(dir)).filter((f) => f === "youtube.md" || f === "social.md" || f.endsWith(".srt"));
  assertNoTraces(await Promise.all(published.map(async (name) => ({ name, text: await readFile(path.join(dir, name), "utf8") }))));
  assertNoTraces([{ name: "العناوين البديلة", text: [plan.title, ...(((parseScript(script).frontmatter ?? {}) as { alt_titles?: string[] }).alt_titles ?? [])].join("\n") }]);

  // الصور المصغّرة: العنوان والعنوانان البديلان (مع النسخة الأساسية فقط)
  const fm = (parseScript(script).frontmatter ?? {}) as { alt_titles?: string[]; thumbnail_element?: string; book?: string };
  const element = fm.thumbnail_element ?? plan.chapters.flatMap((c) => c.scenes).find((s) => s.props.element)?.props.element;
  const titles = [plan.title, ...(fm.alt_titles ?? [])].slice(0, 3);
  for (const [i, title] of stage === "episode" ? titles.entries() : []) {
    log(`الصورة المصغّرة ${i + 1}…`);
    files.push(path.basename(await renderThumbnail({ themeId: plan.themeId, title, element, book: fm.book, lang }, path.join(dir, `${id}-thumbnail-${i + 1}.png`))));
  }

  if (!opts.skipVideo) {
    let last = -1;
    const progress = (label: string) => (pct: number) => {
      const step = Math.floor(pct / 20) * 20;
      if (step !== last) {
        last = step;
        log(`${label}: ${pct}%`);
      }
    };
    // قاعدة القناة: الحركة في 80% من الوقت على الأقل (الهدف 90%) لكل فيديو منشور
    const motion: { label: string; report: MotionReport }[] = [];
    const reportFile = path.join(dir, "motion-report.md");
    const q = QUALITY[quality];
    if (stage === "episode") {
      // نسخة أساسية جديدة: تلغي الاعتماد السابق والشورتس القديمة (كانت من نسخة أخرى)
      for (const f of await readdir(dir)) if (/-short-\d+\.(mp4|[a-z]+\.srt)$/.test(f)) await unlink(path.join(dir, f));
      const st = await readStatus();
      if (st.approved) {
        delete st.approved;
        await writeFile(statusFile, JSON.stringify(st, null, 2) + "\n");
      }
      log(`الحلقة بجودة: ${q.label}`);
      const episodeFile = await renderEpisode({ episode: ep, orientation: "landscape", quality, plan, media, allowUnreviewed: opts.ignoreSceneReview, outFile: episodePath, onProgress: progress("الحلقة") });
      files.push(path.basename(episodeFile));
      motion.push({ label: "الحلقة", report: await measureMotion(episodeFile, "landscape", await exemptForRender(plan, media)) });
      log(motionSummary(motion[0]!.report, "الحلقة"));
      const info: RenderInfo = { quality, label: q.label, width: 1920 * q.scale, height: 1080 * q.scale, voiced: hasVoice, at: new Date().toISOString() };
      await writeFile(renderInfoFile(dir), JSON.stringify(info, null, 2) + "\n");
      await writeFile(reportFile, `# مقياس الحركة · ${plan.title}\n\n${motion.map((m) => `- ${motionSummary(m.report, m.label)}`).join("\n")}\n`);
    } else {
      for (let n = 1; n <= shorts; n++) {
        last = -1;
        const ch = plan.chapters[n - 1]!;
        log(`الشورت ${n} بجودة: ${q.label}`);
        const f = await renderEpisode({ episode: ep, orientation: "portrait", chapter: ch.number, quality, plan, media, allowUnreviewed: opts.ignoreSceneReview, outFile: path.join(dir, `${id}-short-${n}.mp4`), onProgress: progress(`الشورت ${n}`) });
        files.push(path.basename(f));
        motion.push({ label: `الشورت ${n}`, report: await measureMotion(f, "portrait", await exemptForRender(plan, media, ch.number)) });
      }
      const prev = existsSync(reportFile) ? (await readFile(reportFile, "utf8")).trimEnd() : `# مقياس الحركة · ${plan.title}\n`;
      await writeFile(reportFile, `${prev}\n${motion.map((m) => `- ${motionSummary(m.report, m.label)}`).join("\n")}\n`);
    }
    files.push("motion-report.md");
    const weak = motion.filter((m) => m.report.percent < MOTION_MIN);
    if (weak.length) {
      // يظل المقطع متاحًا للتشخيص، لكنه يُعزل خارج ملفات النشر المعتمدة.
      const quarantine = path.join(dir, "qc-failed");
      await mkdir(quarantine, { recursive: true });
      for (const name of files.filter((f) => f.endsWith(".mp4"))) {
        await rename(path.join(dir, name), path.join(quarantine, name));
      }
      if (stage === "episode") await unlink(renderInfoFile(dir)).catch(() => {});
      throw new Error(`قاعدة القناة: الحركة أقل من ${MOTION_MIN}% في: ${weak.map((m) => `${m.label} (${m.report.percent}%)`).join("، ")}. نُقلت الفيديوهات إلى qc-failed/ للتشخيص ولن تظهر ضمن ملفات النشر؛ راجع motion-report.md.`);
    }
  }
  return { dir, files, hasVoice };
};
