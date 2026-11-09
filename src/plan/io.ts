import path from "node:path";
import { existsSync } from "node:fs";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import { parseScript } from "../script/parse";
import { resolveScriptPath } from "../script/episodes";
import { generatePlan, type QuranTexts } from "./generate";
import { loadChannel } from "../channel";
import type { Plan } from "./types";
import { stripQuran, withQuran } from "./quranText";
import { quranFromScript, historicalMeanings } from "../quran/scriptText";
import { backupNameFor, designedScenes, DesignedPlanError, isDesignedPlan, scriptPlanDivergence, type ScriptPlanDivergence } from "./designed";
export { stripQuran, withQuran, VERSE_PLACEHOLDER } from "./quranText";

export const planPathFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "plan.json");
export const quranPathFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "quran.json");

export const readJson = async <T>(file: string): Promise<T | null> => (existsSync(file) ? (JSON.parse(await readFile(file, "utf8")) as T) : null);

/** يكتب الخطة بلا نصوص الآيات. */
export const writePlanFile = (file: string, plan: Plan) => writeFile(file, JSON.stringify(stripQuran(plan), null, 2) + "\n", "utf8");

/** يقرأ الخطة ويدمج نصوص الآيات المخزنة على الجهاز. */
export const readPlanFile = async (scriptPath: string): Promise<Plan | null> => {
  const plan = await readJson<Plan>(planPathFor(scriptPath));
  if (!plan) return null;
  const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
  const authored = quranFromScript(parsed);
  const legacy = (await readJson<QuranTexts>(quranPathFor(scriptPath))) ?? {};
  const sources = Object.fromEntries(plan.chapters.flatMap((c) => c.scenes)
    .filter((s) => s.ayahKey && s.props?.meaningSource).map((s) => [s.ayahKey!, s.props.meaningSource!]));
  return withQuran(plan, { ...historicalMeanings(legacy, sources), ...authored.texts });
};

export const loadPlan = async (episode: string): Promise<Plan | null> => readPlanFile(await resolveScriptPath(episode));

export const savePlan = async (episode: string, plan: Plan) => {
  const file = planPathFor(await resolveScriptPath(episode));
  await writePlanFile(file, { ...plan, updatedAt: new Date().toISOString() });
  return file;
};

export type RegenerateOptions = {
  /**
   * الكتابة فوق خطة مصمَّمة (`isDesignedPlan`) ممنوعة ضمنيًا. لا تُمرَّر إلا بقرار صريح من المالك
   * (`bal plan --force-overwrite-designed`، أو تأكيد الاستوديو بكتابة رقم الحلقة)؛ وتُكتب نسخة احتياطية أولًا.
   */
  forceOverwriteDesigned?: boolean;
  /** تُستدعى بمسار النسخة الاحتياطية قبل الكتابة فوق خطة مصمَّمة */
  onBackup?: (file: string) => void;
};

const generateFromScript = async (scriptPath: string, previous: Plan | null) => {
  const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
  const legacy = (await readJson<QuranTexts>(quranPathFor(scriptPath))) ?? {};
  const sources = Object.fromEntries((previous?.chapters ?? []).flatMap((c) => c.scenes)
    .filter((s) => s.ayahKey && s.props?.meaningSource).map((s) => [s.ayahKey!, s.props.meaningSource!]));
  const quran = { ...historicalMeanings(legacy, sources), ...quranFromScript(parsed).texts };
  return generatePlan(parsed, previous, quran, loadChannel());
};

/** نسخة احتياطية بجوار الخطة (`plan.backup-<الوقت>.json`، محلية لا تُرفع) قبل أي كتابة صريحة فوق خطة مصمَّمة. */
export const backupPlanFile = async (scriptPath: string): Promise<string> => {
  const file = path.join(path.dirname(scriptPath), backupNameFor());
  await copyFile(planPathFor(scriptPath), file);
  return file;
};

/**
 * يعيد توليد الخطة من السكريبت مع حفظ التعديلات اليدوية، ويكتبها.
 * يرفض (`DesignedPlanError`) إن كانت الخطة القائمة مصمَّمة، إلا مع `forceOverwriteDesigned`،
 * وحينها يكتب نسخة احتياطية قبل الكتابة (حادثة دفاتر الزمن 001، ٨ نوفمبر).
 */
export const regeneratePlan = async (episode: string, opts: RegenerateOptions = {}): Promise<Plan> => {
  const scriptPath = await resolveScriptPath(episode);
  const previous = await readJson<Plan>(planPathFor(scriptPath));
  if (isDesignedPlan(previous)) {
    if (!opts.forceOverwriteDesigned) throw new DesignedPlanError(episode, designedScenes(previous).length);
    opts.onBackup?.(await backupPlanFile(scriptPath));
  }
  const plan = await generateFromScript(scriptPath, previous);
  await writePlanFile(planPathFor(scriptPath), plan);
  return plan;
};

export type ScriptSaveResult =
  | { designed: false; plan: Plan }
  | { designed: true; plan: Plan; designedCount: number; divergence: ScriptPlanDivergence };

/**
 * ما يحدث للخطة بعد حفظ السكريبت (السكريبت نفسه يُحفظ قبلها دائمًا):
 * - خطة عادية: تُعاد كما كانت (توليد مع إبقاء التعديلات اليدوية).
 * - خطة مصمَّمة: لا تُلمس plan.json أبدًا (ولا يُعاد فتح أي مشهد في السجل)، وتُرجع قائمة
 *   المشاهد التي اختلف نصها عن السكريبت والنص الذي لا مشهد له، ليُطبَّق من محرر المشهد.
 */
export const planAfterScriptSave = async (episode: string): Promise<ScriptSaveResult> => {
  const scriptPath = await resolveScriptPath(episode);
  const previous = await readJson<Plan>(planPathFor(scriptPath));
  if (!isDesignedPlan(previous)) return { designed: false, plan: await regeneratePlan(episode) };
  const fromScript = await generateFromScript(scriptPath, null);
  const plan = (await readPlanFile(scriptPath))!;
  return { designed: true, plan, designedCount: designedScenes(previous).length, divergence: scriptPlanDivergence(previous!, fromScript) };
};
