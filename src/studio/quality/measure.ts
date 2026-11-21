/**
 * بطاقة الجودة على الخادم (المرحلة A، المهمة ٢): يقيس الملف (الحلقة المجمّعة أو النسخة النهائية) مرة لكل نسخة منه،
 * ويحفظ القياس بجواره (previews/<target>.quality.json، محلي لا يُرفع)، ويبني البطاقة، ويمنع ما يجب منعه:
 * «اصنع النسخة النهائية» على بطاقة الحلقة المجمّعة، وإذن النشر على بطاقة النسخة النهائية.
 */
import path from "node:path";
import { readFile, rename, stat, writeFile } from "node:fs/promises";
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
import { assemblyStillness, measureInteractivity } from "./interactivity";
import { buildCard, cardRefusal, type CardTarget, type FileMeasurements, type QualityCard } from "./card";

/** يرتفع حين يتغير ما يُقاس أو طريقته، فيُعاد القياس */
export const MEASURE_VERSION = 1;

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
    const { leadingSilence } = await import("../assembleScenes");
    const [loudness, headSilence, interactivity, video] = await Promise.all([
      measureLoudness(file), leadingSilence(file), measureInteractivity(file, spans), verifyVideoEvidence(file),
    ]);
    const after = await fileStamp(file);
    if (!after || after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw Error("تغيّر الملف أثناء القياس؛ أعد القياس.");
    const stored: Stored = { version: MEASURE_VERSION, file: before, at: new Date().toISOString(), loudness, headSilence,
      interactivity: { percent: interactivity.percent, counted: interactivity.counted, exempt: interactivity.exempt, still: interactivity.still, ok: interactivity.ok },
      video: { width: video.width, height: video.height } };
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

/** البطاقة الحالية: النهائية إن وُجدت، وإلا المجمّعة (target يفرض أحدهما) */
export const qualityCard = async (episode: string, target?: CardTarget): Promise<QualityCard & { exists: boolean; measuring: boolean }> => {
  const scriptPath = await resolveScriptPath(episode);
  const t: CardTarget = target ?? ((await fileStamp(masterFile(scriptPath))) ? "master" : "assembly");
  const plan = await loadPlan(episode);
  if (!plan) throw Error("لا توجد خطة للحلقة.");
  const media = await collectMedia(episode, plan);
  const measured = await readMeasurement(scriptPath, t);
  const card = buildCard({ target: t, plan, media, measured, citations: await citationCount(scriptPath) });
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
  if (card.blocks) throw Error(cardRefusal(card, "publish"));
};
