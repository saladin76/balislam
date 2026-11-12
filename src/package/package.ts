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
import { segmentPlan, shortSegments } from "../plan/shorts";
import { renderEpisode, renderThumbnail, outDirFor } from "../render/episode";
import { buildSrt } from "./captions";
import { assertNoTraces, onScreenTexts } from "./traces";
import { kitBlockMessage, kitIssues } from "./quality";
import { measureMotion, motionSummary, MOTION_MIN, type MotionReport } from "../render/motionMeter";
import { exemptForRender } from "../render/stillness";
import { buildYoutubeText, publishChecklist } from "./youtube";
import { loadChannel, loadChannelIdentity } from "../channel";
import { qualitySpec, renderInfoFile, type Quality, type RenderInfo } from "../render/quality";
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
  // مقاطع الشورتس من الخطة (plan.shorts) لا من عدد الأقسام؛ الخطة القديمة بلا مقاطع: شورت لكل قسم كما كان
  const shortPick = shortSegments(plan, opts.shorts ?? 6);
  const shorts = shortPick.segments;
  const stage = opts.stage ?? "episode";
  const quality: Quality = opts.quality ?? "master";
  const episodePath = path.join(dir, `${id}-episode.mp4`);
  const statusFile = path.join(path.dirname(scriptPath), "status.json");
  const readStatus = async () => (existsSync(statusFile) ? JSON.parse(await readFile(statusFile, "utf8")) : {});
  if (stage === "shorts") {
    // Shorts/reels are cut from the exact Master the owner approved in «إنتاج المشاهد» (scene-first ledger).
    const { requireSceneMasterReady } = await import("../studio/sceneService");
    await requireSceneMasterReady(ep);
    const info = existsSync(renderInfoFile(dir)) ? (JSON.parse(await readFile(renderInfoFile(dir), "utf8")) as RenderInfo) : null;
    if (!info || info.quality !== "master" || !info.voiced) throw new Error("الشورتس تُصنع من النسخة النهائية بأعلى جودة وبصوت كامل. اصنع النسخة النهائية أولًا.");
    if (!shorts.length || shortPick.issues.length) throw new Error(shortPick.issues.join(" ") || "لا مقاطع شورتس في الخطة.");
  }

  log("تجهيز الوسائط…");
  const media = await prepareRenderMedia(ep, plan, {
    requireApprovedQuran: quality === "master" || stage === "shorts",
  });
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
  // Chapters from the approved assembled cuts (the Master is made of the same cuts); an older Master file on
  // disk is not trusted here because this run may replace it (D36).
  const { realEpisodeTimings } = await import("./realTimings");
  const real = { sceneSeconds: (await realEpisodeTimings(scriptPath, plan)).sceneSeconds };
  await writeFile(path.join(dir, "youtube.md"), buildYoutubeText(plan, script, media, opts.shorts ?? 6, channel, real));
  await writeFile(path.join(dir, "publish-checklist.md"), publishChecklist(plan, hasVoice, channel));
  await writeFile(path.join(dir, `${id}-episode.${lang}.srt`), buildSrt(plan, scenesOf({ plan }).map((x) => x.scene), media, identity));
  if (stage === "shorts")
    for (const seg of shorts) {
      const sp = segmentPlan(plan, seg);
      await writeFile(path.join(dir, `${id}-short-${seg.n}.${lang}.srt`), buildSrt(plan, scenesOf(sp).map((x) => x.scene), media, identity));
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
    await writeFile(path.join(dir, "social.md"), kitToMarkdown(kit, plan.title, chaptersText(plan, media, channelInfo(loadChannel()), real)));
    files.push("social.md");
  }

  // قاعدة القناة: لا أثر لأدوات الإنتاج في أي نص منشور (قبل أي رندر مكلف)
  const published = (await readdir(dir)).filter((f) => f === "youtube.md" || f === "social.md" || f.endsWith(".srt"));
  assertNoTraces(await Promise.all(published.map(async (name) => ({ name, text: await readFile(path.join(dir, name), "utf8") }))));
  assertNoTraces([{ name: "العناوين البديلة", text: [plan.title, ...(((parseScript(script).frontmatter ?? {}) as { alt_titles?: string[] }).alt_titles ?? [])].join("\n") }]);
  // and on screen: scene props (text, lines, chapter cards, end screen), chapter titles, frontmatter.book (C2)
  assertNoTraces(onScreenTexts(plan, (parseScript(script).frontmatter ?? {}) as Record<string, unknown>));
  // اسم السلسلة على الشاشة (بطاقتها وشارة المصغّرة) ونصوص نشرها
  if (plan.series) assertNoTraces([{ name: "السلسلة", text: [plan.series.name, plan.series.template.publish?.titlePattern ?? "", plan.series.template.publish?.playlist ?? "", ...(plan.series.template.publish?.tags ?? [])].join("\n") }]);

  // الصور المصغّرة: العنوان والعنوانان البديلان (مع النسخة الأساسية فقط)
  const fm = (parseScript(script).frontmatter ?? {}) as { alt_titles?: string[]; thumbnail_element?: string; book?: string };
  const element = fm.thumbnail_element ?? plan.chapters.flatMap((c) => c.scenes).find((s) => s.props.element)?.props.element;
  const titles = [plan.title, ...(fm.alt_titles ?? [])].slice(0, 3);
  for (const [i, title] of stage === "episode" ? titles.entries() : []) {
    log(`الصورة المصغّرة ${i + 1}…`);
    files.push(path.basename(await renderThumbnail({ themeId: plan.themeId, title, element, book: fm.book, lang, series: plan.series }, path.join(dir, `${id}-thumbnail-${i + 1}.png`))));
  }

  if (!opts.skipVideo) {
    let last = -1;
    let lastFrame = -1;
    const progress = (label: string) => (pct: number) => {
      // M7: every whole percent as a machine line (hidden from the owner's log), for a real progress bar.
      if (pct !== lastFrame) { lastFrame = pct; log(`FRAMES ${label} ${pct}`); }
      const step = Math.floor(pct / 20) * 20;
      if (step !== last) {
        last = step;
        log(`${label}: ${pct}%`);
      }
    };
    // قاعدة القناة: الحركة في 80% من الوقت على الأقل (الهدف 90%) لكل فيديو منشور
    const motion: { label: string; report: MotionReport }[] = [];
    const reportFile = path.join(dir, "motion-report.md");
    const q = qualitySpec(quality);
    if (stage === "episode") {
      // نسخة أساسية جديدة: تلغي الاعتماد السابق والشورتس القديمة (كانت من نسخة أخرى)
      for (const f of await readdir(dir)) if (/-short-\d+\.(mp4|[a-z]+\.srt)$/.test(f)) await unlink(path.join(dir, f));
      const st = await readStatus();
      if (st.approved) {
        delete st.approved;
        await writeFile(statusFile, JSON.stringify(st, null, 2) + "\n");
      }
      log(`الحلقة بجودة: ${q.label}`);
      const episodeFile = await renderEpisode({ episode: ep, orientation: "landscape", quality, plan, media, outFile: episodePath, onProgress: progress("الحلقة") });
      files.push(path.basename(episodeFile));
      motion.push({ label: "الحلقة", report: await measureMotion(episodeFile, "landscape", await exemptForRender(plan, media)) });
      log(motionSummary(motion[0]!.report, "الحلقة"));
      const info: RenderInfo = { quality, label: q.label, width: 1920 * q.scale, height: 1080 * q.scale, voiced: hasVoice, at: new Date().toISOString() };
      await writeFile(renderInfoFile(dir), JSON.stringify(info, null, 2) + "\n");
      await writeFile(reportFile, `# مقياس الحركة · ${plan.title}\n\n${motion.map((m) => `- ${motionSummary(m.report, m.label)}`).join("\n")}\n`);
    } else {
      for (const seg of shorts) {
        last = -1;
        const n = seg.n;
        const sp = segmentPlan(plan, seg);
        log(`الشورت ${n} بجودة: ${q.label}`);
        // الشورت القديم: قسمه من الخطة كما كان؛ والمقطع المختار: مشاهده وحدها، والبوابات على الخطة كاملة
        const f = await renderEpisode({ episode: ep, orientation: "portrait", ...(seg.chapter !== undefined ? { chapter: seg.chapter } : { segment: { sceneIds: seg.sceneIds } }), quality, plan, media, outFile: path.join(dir, `${id}-short-${n}.mp4`), onProgress: progress(`الشورت ${n}`) });
        files.push(path.basename(f));
        motion.push({ label: `الشورت ${n}`, report: await measureMotion(f, "portrait", await exemptForRender(sp.plan, media, sp.chapter)) });
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
    // QA minor (10 Nov): the subtitles and thumbnails written by THIS run, bound to the Master it produced.
    // The Drive handoff sends only these (a failed make leaves newer srt/png beside an older Master).
    if (stage === "episode") await writeHandoffSet(dir, id, files);
  }
  return { dir, files, hasVoice };
};

/** `<id>-handoff-set.json`: the Master's sha256 and the subtitle/thumbnail files made with it (sha256 each). */
export const handoffSetFileFor = (dir: string, id: string) => path.join(dir, `${id}-handoff-set.json`);
const writeHandoffSet = async (dir: string, id: string, files: string[]) => {
  const { createHash } = await import("node:crypto");
  const sha = async (name: string) => createHash("sha256").update(await readFile(path.join(dir, name))).digest("hex");
  const master = `${id}-episode.mp4`;
  if (!existsSync(path.join(dir, master))) return;
  const names = files.filter((f) => /\.srt$/.test(f) || /-thumbnail-\d+\.png$/.test(f));
  const set = { version: 1, master, masterSha256: await sha(master),
    files: Object.fromEntries(await Promise.all(names.map(async (n) => [n, await sha(n)] as const))) };
  await writeFile(handoffSetFileFor(dir, id), JSON.stringify(set, null, 2) + "\n");
};
