import path from "node:path";
import { existsSync } from "node:fs";
import { copyFile, readFile } from "node:fs/promises";
import { readJsonFile, writeJsonAtomic } from "../io/atomicJson";
import { parseScript } from "../script/parse";
import { resolveScriptPath } from "../script/episodes";
import { generatePlan, type QuranTexts } from "./generate";
import { loadChannel } from "../channel";
import type { Plan, PlanShort } from "./types";
import { withSeriesStamp, type SeriesStamp } from "../channel/series";
import { stripQuran, withQuran } from "./quranText";
import { syncScriptNarration } from "../script/narrationSync";
import { quranFromScript, historicalMeanings } from "../quran/scriptText";
import { backupNameFor, designedPlanLoss, DesignedPlanReplaceError, designedScenes, DesignedPlanError, isDesignedPlan, scriptPlanDivergence, type ScriptPlanDivergence } from "./designed";
export { stripQuran, withQuran, VERSE_PLACEHOLDER } from "./quranText";

export const planPathFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "plan.json");
export const quranPathFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "quran.json");

/** يقرأ JSON (null إن لم يوجد)؛ خطأ القراءة يُعاد مرة ثم رسالة عربية واضحة (src/io/atomicJson.ts). */
export const readJson = <T>(file: string): Promise<T | null> => readJsonFile<T>(file);

/** يكتب الخطة بلا نصوص الآيات، كتابة ذرية (ملف مؤقت ثم fsync ثم إعادة تسمية). */
export const writePlanFile = (file: string, plan: Plan) => writeJsonAtomic(file, stripQuran(plan));

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

/** The rolling backup written before every owner save of plan.json (local, ignored by git). */
export const lastPlanBackupFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "plan.backup-last.json");

/**
 * PUT /plan (M4): the designed-plan guard (D46) applies to a plan sent whole, too. A designed plan is never
 * replaced by one that drops designed scenes (or the `designed` flag) unless the owner confirms explicitly
 * with the episode number (`overwriteDesigned: true, confirmEpisode: "<n>"`); then a timestamped backup is
 * written first. Every save also writes the rolling backup `plan.backup-last.json` before overwriting.
 */
export const savePlanFromStudio = async (episode: string, plan: Plan, o: { overwriteDesigned?: unknown; confirmEpisode?: unknown } = {}): Promise<{ backup?: string }> => {
  const scriptPath = await resolveScriptPath(episode);
  const file = planPathFor(scriptPath);
  const current = await readJson<Plan>(file);
  const loss = designedPlanLoss(current, plan);
  let backup: string | undefined;
  if (loss.scenes.length || loss.flag) {
    const confirmed = o.overwriteDesigned === true && String(o.confirmEpisode ?? "").trim() === episode;
    if (!confirmed) throw new DesignedPlanReplaceError(episode, loss.scenes);
    backup = path.basename(await backupPlanFile(scriptPath));
  }
  if (current) await copyFile(file, lastPlanBackupFor(scriptPath));
  // ختم السلسلة يملكه انتماء الحلقة (seriesStore.moveEpisode)، لا الصفحة: خطة قديمة في المتصفح لا تعيد ختمًا قبل النقل (D77)
  const next: Plan = { ...plan, updatedAt: new Date().toISOString() };
  if (current?.series) next.series = current.series;
  else if (current) delete next.series;
  await writePlanFile(file, next);
  // QA balislam 2: a scene's narration changed in the scene editor is written into script.md too, when the change
  // can be placed unambiguously (src/script/narrationSync.ts); otherwise the divergence check names the scene.
  if (current) {
    const was = new Map(current.chapters.flatMap((c) => c.scenes).map((s) => [s.id, s.narration ?? ""]));
    for (const s of next.chapters.flatMap((c) => c.scenes)) {
      const before = was.get(s.id);
      if (before !== undefined && s.template !== "verse-card" && (s.narration ?? "") !== before)
        await syncScriptNarration(scriptPath, before, s.narration ?? "");
    }
  }
  return backup ? { backup } : {};
};

/**
 * يكتب اختيار المالك لمقاطع الشورتس (D83) في `plan.shorts` وحده: لا يمس مشهدًا ولا ختمًا ولا `updatedAt`
 * (فلا تتغير بصمة مشهد ولا ستوري بورد ولا يُعاد فتح اعتماد). `null` يحذف الحقل فيعود السلوك القديم
 * (شورت لكل قسم إن كان فيها قسمان فأكثر). الفحص في `checkShortsInput` قبله، والنسخة المتدحرجة قبل الكتابة.
 */
export const saveShortsSelection = async (episode: string, shorts: PlanShort[] | null): Promise<Plan> => {
  const scriptPath = await resolveScriptPath(episode);
  const file = planPathFor(scriptPath);
  const current = await readJson<Plan>(file);
  if (!current) throw new Error("لا خطة لهذه الحلقة بعد؛ لم تُحفظ المقاطع.");
  await copyFile(file, lastPlanBackupFor(scriptPath));
  // الحقل قبل المشاهد كما يكتبه المولِّد (src/plan/generate.ts)
  const { chapters, shorts: _old, ...rest } = current;
  const next: Plan = shorts === null ? { ...rest, chapters }
    : { ...rest, shorts: shorts.map((x) => ({ from: x.from, to: x.to, ...(x.title ? { title: x.title } : {}) })), chapters };
  await writePlanFile(file, next);
  return next;
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
  const plan = generatePlan(parsed, previous, quran, loadChannel());
  return withSeriesStamp(plan, previous, await readJson<{ stamp?: SeriesStamp }>(path.join(path.dirname(scriptPath), "series.json")).then((x) => x?.stamp, () => undefined));
};

/**
 * The plan the script alone would give (nothing written): what «اعتمد التجهيز» compares the plan's narration with
 * (src/plan/scriptSync.ts, QA balislam 2).
 */
export const planFromScriptOnly = (scriptPath: string): Promise<Plan> => generateFromScript(scriptPath, null);

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
