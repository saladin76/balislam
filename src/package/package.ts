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
import { segmentPlan, shortFileNumber, shortSegments } from "../plan/shorts";
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
import type { Plan } from "../plan/types";
import type { PublishKit } from "./social";
import { sceneStartsFor } from "./chapters";
import { THUMB_KIND_LABEL, THUMB_ON_HOLD, conceptOrder, isSacredScene, renderableConcepts, thumbnailIssues } from "./thumbnails";

export type PackageOptions = {
  episode: string;
  /** بلا رندر فيديو (الوصف والترجمة والصور فقط) */
  skipVideo?: boolean;
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
  const shortPick = shortSegments(plan);
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
  // فصول يوتيوب التي اختارها المالك (publish.json ← long.chapters): من حدود المشاهد الحقيقية في الملف المجمَّع
  const kitPath = path.join(path.dirname(scriptPath), "publish.json");
  const marks = existsSync(kitPath) ? ((JSON.parse(await readFile(kitPath, "utf8")) as PublishKit).long.chapters ?? undefined) : undefined;
  await writeFile(path.join(dir, "youtube.md"), buildYoutubeText(plan, script, media, channel, real, marks));
  await writeFile(path.join(dir, "publish-checklist.md"), publishChecklist(plan, hasVoice, channel));
  await writeFile(path.join(dir, `${id}-episode.${lang}.srt`), buildSrt(plan, scenesOf({ plan }).map((x) => x.scene), media, identity));
  if (stage === "shorts") {
    // شورت قديم رقمه أكبر من عدد المقاطع المحفوظة الآن (حذف المالك مقاطع): يُحذف بترجمته، فلا يبقى بجوار Master
    // ولا يُسلَّم إلى Drive (D152؛ الأرقام 1…N تُكتب من جديد تحت).
    for (const f of await readdir(dir)) {
      const k = shortFileNumber(f);
      if (k !== null && k > shorts.length) await unlink(path.join(dir, f));
    }
    for (const seg of shorts) {
      const sp = segmentPlan(plan, seg);
      await writeFile(path.join(dir, `${id}-short-${seg.n}.${lang}.srt`), buildSrt(plan, scenesOf(sp).map((x) => x.scene), media, identity));
    }
  }
  files.push("youtube.md", "publish-checklist.md", `${id}-episode.${lang}.srt`);

  // حزمة الانتشار (عناوين وكابشن لكل منصة): من publish.json إن وُجد، وإلا نسخة آلية
  {
    const kitFile = path.join(path.dirname(scriptPath), "publish.json");
    const kit = existsSync(kitFile) ? JSON.parse(await readFile(kitFile, "utf8")) : generatePublishKit(plan, script, media, channel);
    if (!existsSync(kitFile)) await writeFile(kitFile, JSON.stringify(kit, null, 2) + "\n");
    // جودة النشر: لا عنوان عام ولا جملة مكررة ولا نص مبتور ولا وسم مكرر (قبل أي رندر مكلف)
    const kq = kitIssues(kit, { ...thumbCtx(plan), starts: sceneStartsFor(plan, media, channelInfo(channel), real),
      channel: channel.id, book: ((parseScript(script).frontmatter ?? {}) as { book?: string }).book, series: plan.series?.name });
    if (kq.some((i) => i.level === "error")) throw new Error(kitBlockMessage(kq));
    await writeFile(path.join(dir, "social.md"), kitToMarkdown(kit, plan.title, chaptersText(plan, media, channelInfo(loadChannel()), real, kit.long.chapters)));
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

  // الأغلفة الثلاثة (عنوان، مشهد، سؤال) مع النسخة الأساسية فقط؛ الحلقة القديمة بلا أغلفة: العنوان والبديلان كما كان
  if (stage === "episode") files.push(...await renderThumbnailSet({ scriptPath, script, plan, dir, id, lang, onProgress: log }));

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
      // بلا حد لعدد الشورتس (D152): تُصنع بالترتيب واحدًا بعد واحد في هذه المهمة.
      for (const seg of shorts) {
        last = -1;
        const n = seg.n;
        const sp = segmentPlan(plan, seg);
        log(`الشورت ${n} من ${shorts.length} بجودة: ${q.label}`);
        // الشورت القديم: قسمه من الخطة كما كان؛ والمقطع المختار: مشاهده وحدها، والبوابات على الخطة كاملة
        const f = await renderEpisode({ episode: ep, orientation: "portrait", ...(seg.chapter !== undefined ? { chapter: seg.chapter } : { segment: { sceneIds: seg.sceneIds } }), quality, plan, media, outFile: path.join(dir, `${id}-short-${n}.mp4`), onProgress: progress(`الشورت ${n} من ${shorts.length}`) });
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

/** سياق فحص الأغلفة من الخطة: عنوان الحلقة ومشاهدها (المشهد موجود وليس آية). */
export const thumbCtx = (plan: Plan) => ({
  title: plan.title,
  scenes: plan.chapters.flatMap((c) => c.scenes).map((s) => ({ id: s.id, sacred: isSacredScene(s) })),
});

/**
 * يرسم الأغلفة في out/package: `<id>-thumbnail-1.png` عنوان، و`-2` مشهد، و`-3` سؤال (الترتيب ثابت لكل فكرة).
 * يحذف أي غلاف قديم قبلها فلا يبقى ملف من فكرة سابقة. يرفض قبل أي رسم إن كانت الأغلفة لا تحقق قواعدها.
 */
export const renderThumbnailSet = async (o: { scriptPath: string; script: string; plan: Plan; dir: string; id: string; lang: string; onProgress?: (m: string) => void }): Promise<string[]> => {
  const log = o.onProgress ?? (() => {});
  const { plan, dir, id } = o;
  const fm = (parseScript(o.script).frontmatter ?? {}) as { alt_titles?: string[]; thumbnail_element?: string; book?: string };
  const element = fm.thumbnail_element ?? plan.chapters.flatMap((c) => c.scenes).find((s) => s.props.element)?.props.element;
  const kitFile = path.join(path.dirname(o.scriptPath), "publish.json");
  const kit = existsSync(kitFile) ? (JSON.parse(await readFile(kitFile, "utf8")) as PublishKit) : null;
  const concepts = kit?.long.thumbnails;
  if (concepts) {
    const bad = thumbnailIssues(concepts, { titles: [plan.title, ...kit!.long.titles.map((t) => t.text)], scenes: thumbCtx(plan).scenes }).filter((i) => i.level === "error");
    if (bad.length) throw new Error(`الأغلفة الثلاثة لا تحقق قواعدها (عدّلها من «٤ النشر ← الأغلفة الثلاثة»): ${bad.map((i) => `${i.where}: ${i.message}`).join(" | ")}`);
  }
  for (const f of await readdir(dir)) if (new RegExp(`^${id}-thumbnail-\\d+\\.png$`).test(f)) await unlink(path.join(dir, f));
  const base = { themeId: plan.themeId, element, book: fm.book, lang: o.lang, series: plan.series };
  const out: string[] = [];
  if (!concepts) {
    const titles = [plan.title, ...(fm.alt_titles ?? [])].slice(0, 3);
    for (const [i, title] of titles.entries()) {
      log(`الصورة المصغّرة ${i + 1}…`);
      out.push(path.basename(await renderThumbnail({ ...base, title }, path.join(dir, `${id}-thumbnail-${i + 1}.png`))));
    }
    return out;
  }
  // KI-120 / D196: «مشهد» و«سؤال» يُرسمان بأسلوب القناة المعتمد اتجاهه («دفتر الأفق»)، وموقوفان في غيره؛ والملف يبقى برقم فكرته
  const { render, held } = renderableConcepts(concepts, loadChannel().brand?.thumbnail);
  const { sceneFrameDataUri } = await import("./thumbnailFrame");
  for (const c of render) {
    const n = conceptOrder(concepts).indexOf(c) + 1;
    const text = c.text.trim();
    let concept: import("../remotion/Thumbnail").ThumbConceptProp = { kind: "title", text };
    if (c.kind === "question") concept = { kind: "question", text };
    if (c.kind === "scene") {
      // اللقطة من فيديو المشهد الذي شاهده المالك واعتمده، لا رسم جديد؛ بلا فيديو للمشهد لا غلاف مشهد
      const frame = c.sceneId ? await sceneFrameDataUri(o.scriptPath, c.sceneId, c.atSeconds) : null;
      if (!frame) { log(`   غلاف «${THUMB_KIND_LABEL[c.kind]}»: لا فيديو للمشهد ${c.sceneId ?? "—"} بعد؛ أنتجه في «٢ المشاهد» ثم اصنع الأغلفة. لم يُرسم.`); continue; }
      concept = { kind: "scene", text, image: frame.uri };
      log(`الغلاف ${n} (${THUMB_KIND_LABEL[c.kind]}: ${c.sceneId} عند ${frame.at} ث)…`);
    } else log(`الغلاف ${n} (${THUMB_KIND_LABEL[c.kind]})…`);
    out.push(path.basename(await renderThumbnail({ ...base, title: plan.title, concept }, path.join(dir, `${id}-thumbnail-${n}.png`))));
  }
  for (const c of held) log(`   غلاف «${THUMB_KIND_LABEL[c.kind]}»: ${THUMB_ON_HOLD[c.kind]}؛ لم يُرسم.`);
  return out;
};

/**
 * «اصنع الأغلفة» وحدها (`bal thumbnails`): بلا فيديو ولا صوت ولا مساس بـMaster. إن كان Master الحالي هو الذي صُنعت معه
 * مجموعة التسليم، تُربط الأغلفة الجديدة بها (بصمة كل صورة)، فيسلّمها Drive مع Master نفسه؛ وإلا تبقى المجموعة كما هي.
 */
export const makeThumbnails = async (episode: string, onProgress?: (m: string) => void) => {
  const scriptPath = await resolveScriptPath(episode);
  const script = await readFile(scriptPath, "utf8");
  const plan = (await loadPlan(episode)) ?? (await regeneratePlan(episode));
  const dir = path.join(await outDirFor(episode), "package");
  await mkdir(dir, { recursive: true });
  const id = plan.episode || episode;
  const lang = plan.lang ?? loadChannel().language;
  const names = await renderThumbnailSet({ scriptPath, script, plan, dir, id, lang, onProgress });
  await rebindThumbnails(dir, id, names);
  return { dir, files: names };
};

/** يحدّث بصمات الأغلفة في `<id>-handoff-set.json` إن كانت المجموعة لـMaster الموجود الآن بعينه. */
export const rebindThumbnails = async (dir: string, id: string, names: string[]) => {
  const setFile = handoffSetFileFor(dir, id);
  const master = path.join(dir, `${id}-episode.mp4`);
  if (!existsSync(setFile) || !existsSync(master)) return false;
  const { createHash } = await import("node:crypto");
  const sha = async (f: string) => createHash("sha256").update(await readFile(f)).digest("hex");
  const set = JSON.parse(await readFile(setFile, "utf8")) as { masterSha256?: string; files?: Record<string, string> };
  if (set.masterSha256 !== (await sha(master))) return false;
  const files = Object.fromEntries(Object.entries(set.files ?? {}).filter(([n]) => !/-thumbnail-\d+\.png$/.test(n)));
  for (const n of names) files[n] = await sha(path.join(dir, n));
  await writeFile(setFile, JSON.stringify({ ...set, files }, null, 2) + "\n");
  return true;
};
