/**
 * بطاقة الجودة على الخادم (المرحلة A، المهمة ٢): يقيس الملف (الحلقة المجمّعة أو النسخة النهائية) مرة لكل نسخة منه،
 * ويحفظ القياس بجواره (previews/<target>.quality.json، محلي لا يُرفع)، ويبني البطاقة، ويمنع ما يجب منعه:
 * «اصنع النسخة النهائية» على بطاقة الحلقة المجمّعة، وإذن النشر على بطاقة النسخة النهائية.
 */
import path from "node:path";
import { readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { loadPlan } from "../../plan/io";
import { collectMedia } from "../../plan/collect";
import { resolveScriptPath } from "../../script/episodes";
import { parseScript } from "../../script/parse";
import { loadLedger, reviewItems } from "../../script/review";
import { intendedStillness } from "../../render/stillnessSpans";
import { assemblyFile, masterFile } from "../sceneLedgerStore";
import { readSeamsRecord } from "../seamsRecord";
import { verifyVideoEvidence } from "../videoEvidence";
import { measureLoudness } from "./audio";
import { checkMix, measureMixLevels } from "./mix";
import config from "../../../config.json";
import { assemblyStillness, detectFreezes, fileStartsFromSeams, interactivityFrom, planSceneStarts, remapSpans } from "./interactivity";
import { detectSilences, frozenReport, recitedVerseSpans, silenceReport } from "./pauses";
import { buildCard, cardRefusal, type CardTarget, type FileMeasurements, type QualityCard } from "./card";
import { compareWithSeries, seriesIdOf, type SeriesDiffReport, type SeriesEpisode } from "./seriesDiff";
import type { PublishKit } from "../../package/social";
import { packagingCard, shortsCard } from "../../package/qualityCard";
import { sceneStartsFor } from "../../package/chapters";
import { isSacredSentence } from "../../plan/sceneCues";
import type { Plan } from "../../plan/types";
import type { EpisodeMedia } from "../../plan/media";

/** يرتفع حين يتغير ما يُقاس أو طريقته، فيُعاد القياس */
export const MEASURE_VERSION = 4; // 4: D217 السكوت الأطول من ثانية والشاشة الواقفة الأطول من ٣ ث

type Stored = FileMeasurements & { version: number; file: { size: number; mtimeMs: number }; at: string };

export const targetFile = (scriptPath: string, target: CardTarget) => (target === "assembly" ? assemblyFile(scriptPath) : masterFile(scriptPath));
export const measurementFile = (scriptPath: string, target: CardTarget) => path.join(path.dirname(scriptPath), "previews", `${target}.quality.json`);

const fileStamp = async (file: string) => {
  const st = await stat(file).catch(() => null);
  return st ? { size: st.size, mtimeMs: st.mtimeMs } : null;
};

/** القياس المحفوظ إن كان للملف الحالي نفسه (الحجم ووقت التعديل) وبإصدار القياس الحالي */
export const readMeasurement = async (scriptPath: string, target: CardTarget): Promise<Stored | null> => {
  const now = await fileStamp(targetFile(scriptPath, target));
  if (!now) return null;
  try {
    const m = JSON.parse(await readFile(measurementFile(scriptPath, target), "utf8")) as Stored;
    return m.version === MEASURE_VERSION && m.file.size === now.size && Math.abs(m.file.mtimeMs - now.mtimeMs) < 1 ? m : null;
  } catch { return null; }
};

const running = new Map<string, Promise<Stored>>();

/** يقيس الملف الحالي (مرة واحدة لكل طلب متزامن) ويحفظ القياس */
export const measureTarget = async (episode: string, target: CardTarget): Promise<Stored> => {
  const scriptPath = await resolveScriptPath(episode);
  const key = `${scriptPath}:${target}`;
  const live = running.get(key);
  if (live) return live;
  const job = (async () => {
    const file = targetFile(scriptPath, target);
    const before = await fileStamp(file);
    if (!before) throw Error(target === "assembly" ? "لا توجد حلقة مجمّعة بعد." : "لا توجد نسخة نهائية بعد.");
    const plan = await loadPlan(episode);
    if (!plan) throw Error("لا توجد خطة للحلقة.");
    const media = await collectMedia(episode, plan);
    const { introFramesFor } = await import("../../remotion/scenes/ChannelIntro");
    const { channelInfo, loadChannel } = await import("../../channel");
    const intro = introFramesFor(channelInfo(loadChannel()), plan) / 30;
    // السكون المقصود في زمن الملف نفسه: المجمّعة بأطوال مشاهدها الفعلية (سجل الوصلات)، والنهائية بزمن الخطة
    const rec = target === "assembly" ? await readSeamsRecord(scriptPath) : null;
    const spans = rec ? assemblyStillness(plan, media, rec as Parameters<typeof assemblyStillness>[2], intro) : intendedStillness(plan, intro, media);
    // D217: بدايات المشاهد في زمن الملف (لتسمية مواضع السكوت والشاشة الواقفة)، ونوافذ الآيات المتلوّة وحدها في زمنه
    const planStarts = planSceneStarts(plan, media, intro);
    const fileStarts = rec ? [...fileStartsFromSeams(rec as Parameters<typeof fileStartsFromSeams>[0])].map(([id, start]) => ({ id, start })) : planStarts;
    const recited = recitedVerseSpans(plan, media, intro);
    const recitedInFile = rec ? remapSpans(recited, planStarts, fileStartsFromSeams(rec as Parameters<typeof fileStartsFromSeams>[0])) : recited;
    const { leadingSilence } = await import("../assembleScenes");
    // مرور واحد لـ freezedetect يخدم التفاعلية والشاشة الواقفة معًا
    const [loudness, headSilence, freezes, video] = await Promise.all([
      measureLoudness(file), leadingSilence(file), detectFreezes(file), verifyVideoEvidence(file),
    ]);
    const interactivity = interactivityFrom(freezes.duration, freezes.freezes, spans);
    const silence = silenceReport(await detectSilences(file, freezes.duration), fileStarts);
    const frozen = frozenReport(freezes.freezes, recitedInFile, fileStarts);
    // فحص الخلط من ملفات الراوي والمؤثرات نفسها، بالعلو الذي يخرج به الرندر (ربح سرد المشهد كما في التجميع وMaster)
    const { sfxDir } = await import("../../voice/sfx");
    const { narrationLoudness } = await import("../narrationLoudness");
    const mix = checkMix(plan, media, await measureMixLevels(scriptPath, plan, media, (file) => path.join(sfxDir, file)), {
      narrationVolume: config.audio.narrationVolume, sfxVolume: config.audio.sfxVolume, narrationGain: (await narrationLoudness(scriptPath, plan, media)).gain });
    const after = await fileStamp(file);
    if (!after || after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw Error("تغيّر الملف أثناء القياس؛ أعد القياس.");
    const stored: Stored = { version: MEASURE_VERSION, file: before, at: new Date().toISOString(), loudness, headSilence,
      interactivity: { percent: interactivity.percent, counted: interactivity.counted, exempt: interactivity.exempt, still: interactivity.still, ok: interactivity.ok },
      video: { width: video.width, height: video.height }, mix, silence, frozen };
    const out = measurementFile(scriptPath, target);
    const tmp = `${out}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(stored, null, 1) + "\n", { mode: 0o600 });
    await rename(tmp, out);
    return stored;
  })();
  running.set(key, job);
  try { return await job; } finally { running.delete(key); }
};

export const isMeasuring = async (episode: string, target: CardTarget) => running.has(`${await resolveScriptPath(episode)}:${target}`);

const citationCount = async (scriptPath: string) => {
  try {
    const items = reviewItems(parseScript(await readFile(scriptPath, "utf8"), scriptPath), await loadLedger(scriptPath));
    return { total: items.length, open: items.filter((i) => i.status !== "verified").length };
  } catch { return undefined; }
};

/** بنود B (التغليف والشورتس) من publish.json والخطة؛ بلا حزمة نشر لا بنود (البطاقة تقول إنها لم تُكتب) */
const readyItems = async (scriptPath: string, plan: Plan, media: Omit<EpisodeMedia, "base" | "mode">) => {
  let kit: PublishKit;
  try { kit = JSON.parse(await readFile(path.join(path.dirname(scriptPath), "publish.json"), "utf8")) as PublishKit; } catch { return undefined; }
  const scenes = plan.chapters.flatMap((c) => c.scenes).map((s) => ({ id: s.id, sacred: s.template === "verse-card" || s.template === "dua-board" || isSacredSentence(s.narration) }));
  try {
    return { packaging: packagingCard(kit, { title: plan.title, scenes, thumbStyle: (await import("../../channel/index")).loadChannel().brand?.thumbnail, starts: sceneStartsFor(plan, { ...media, base: "", mode: "static" } as EpisodeMedia) }), shorts: shortsCard(kit) };
  } catch { return undefined; }
};

/**
 * D204: حلقات السلسلة نفسها قبل هذه الحلقة، من خطط المجلدات المجاورة في القناة (رقم الحلقة أصغر)، قراءةً فقط؛
 * ومعمل القوالب (9xx) والإعلان (000) خارجها. null عند تعذّر القراءة.
 */
export const seriesComparison = async (scriptPath: string, plan: Plan): Promise<SeriesDiffReport | null> => {
  try {
    const dir = path.dirname(scriptPath), root = path.dirname(dir), me = path.basename(dir);
    const id = seriesIdOf(plan);
    const earlier: SeriesEpisode[] = [];
    for (const d of (await readdir(root)).filter((x) => /^\d{3}-/.test(x) && x < me && !/^(000|9\d\d)-/.test(x)).sort()) {
      try {
        const p = JSON.parse(await readFile(path.join(root, d, "plan.json"), "utf8")) as Plan;
        if (Array.isArray(p.chapters) && seriesIdOf(p) === id) earlier.push({ id: d.slice(0, 3), plan: p });
      } catch { /* حلقة بلا خطة: لا تُقارن */ }
    }
    return compareWithSeries(plan, earlier);
  } catch { return null; }
};

/** البطاقة الحالية: النهائية إن وُجدت، وإلا المجمّعة (target يفرض أحدهما) */
export const qualityCard = async (episode: string, target?: CardTarget): Promise<QualityCard & { exists: boolean; measuring: boolean }> => {
  const scriptPath = await resolveScriptPath(episode);
  const t: CardTarget = target ?? ((await fileStamp(masterFile(scriptPath))) ? "master" : "assembly");
  const plan = await loadPlan(episode);
  if (!plan) throw Error("لا توجد خطة للحلقة.");
  const media = await collectMedia(episode, plan);
  const measured = await readMeasurement(scriptPath, t);
  const card = buildCard({ target: t, plan, media, measured, citations: await citationCount(scriptPath), ready: await readyItems(scriptPath, plan, media), series: await seriesComparison(scriptPath, plan) });
  return { ...card, exists: Boolean(await fileStamp(targetFile(scriptPath, t))), measuring: await isMeasuring(episode, t) };
};

/**
 * البوابة تعمل دائمًا على جهاز المالك. داخل الاختبارات (VITEST أو BAL_E2E=1) تُطفأ إلا بـ BAL_QUALITY_GATE=on،
 * فلا تكسر رحلات الاختبار القائمة (رندرها الصغير 320×180 لا يكون 4K أبدًا)؛ وخارجها لا يطفئها شيء.
 */
export const qualityGateOn = (env: NodeJS.ProcessEnv = process.env) => !(env.VITEST || env.BAL_E2E === "1") || env.BAL_QUALITY_GATE === "on";

/** قبل «اصنع النسخة النهائية»: بطاقة الحلقة المجمّعة؛ تُقاس هنا إن لم تُقس (المهمة طويلة أصلًا) */
export const assertQualityForFinal = async (episode: string, onProgress?: (m: string) => void) => {
  if (!qualityGateOn()) return;
  const scriptPath = await resolveScriptPath(episode);
  if (!(await readMeasurement(scriptPath, "assembly"))) {
    onProgress?.("قياس بطاقة الجودة على الحلقة المجمّعة…");
    await measureTarget(episode, "assembly");
  }
  const card = await qualityCard(episode, "assembly");
  if (card.blocks) throw Error(cardRefusal(card, "final"));
};

/** قبل إذن النشر: بطاقة النسخة النهائية نفسها (قيست من «النسخة النهائية» في الاستوديو) */
export const assertQualityForPublish = async (episode: string) => {
  if (!qualityGateOn()) return;
  const card = await qualityCard(episode, "master");
  if (card.publishBlocks) throw Error(cardRefusal(card, "publish"));
};
