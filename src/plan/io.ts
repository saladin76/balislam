import path from "node:path";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { parseScript } from "../script/parse";
import { resolveScriptPath } from "../script/episodes";
import { generatePlan, type QuranTexts } from "./generate";
import { loadChannel } from "../channel";
import type { Plan } from "./types";
import { stripQuran, withQuran } from "./quranText";
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
  return withQuran(plan, (await readJson<QuranTexts>(quranPathFor(scriptPath))) ?? {});
};

export const loadPlan = async (episode: string): Promise<Plan | null> => readPlanFile(await resolveScriptPath(episode));

export const savePlan = async (episode: string, plan: Plan) => {
  const file = planPathFor(await resolveScriptPath(episode));
  await writePlanFile(file, { ...plan, updatedAt: new Date().toISOString() });
  return file;
};

/** يعيد توليد الخطة من السكريبت مع حفظ التعديلات اليدوية، ويكتبها. */
export const regeneratePlan = async (episode: string): Promise<Plan> => {
  const scriptPath = await resolveScriptPath(episode);
  const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
  const previous = await readJson<Plan>(planPathFor(scriptPath));
  const quran = (await readJson<QuranTexts>(quranPathFor(scriptPath))) ?? {};
  const plan = generatePlan(parsed, previous, quran, loadChannel());
  await writePlanFile(planPathFor(scriptPath), plan);
  return plan;
};
