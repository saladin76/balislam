/**
 * D254: كتابة ملف طلب النطق للحلقة في `~/Desktop/للمراجعة/النطق/طلب-<القناة>-<الحلقة>.md` (من الأمر pron-request، وتلقائيًا
 * بعد «اعتمدت السكريبت» في الاستوديو). لا يرمي في المسار التلقائي: فشله لا يمس الاعتماد.
 */
import path from "node:path";
import os from "node:os";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolveScriptPath } from "../script/episodes";
import { readPlanFile } from "../plan/io";
import { buildTashkeelIndex } from "./tashkeel";
import { loadLexicon } from "./lexicon";
import { buildRequest, exchangeRows } from "./pronunciationExchange";

export const pronDir = () => process.env.BAL_PRON_DIR || path.join(os.homedir(), "Desktop", "للمراجعة", "النطق");

export const pronRowsFor = async (episode: string) => {
  const scriptPath = await resolveScriptPath(episode);
  const plan = await readPlanFile(scriptPath);
  if (!plan) throw new Error("لا plan.json للحلقة؛ لا طلب نطق.");
  const tkFile = path.join(path.dirname(scriptPath), "tashkeel.md");
  const tk = existsSync(tkFile) ? buildTashkeelIndex(await readFile(tkFile, "utf8")) : null;
  const lex = (await loadLexicon()).entries;
  return { scriptPath, rows: exchangeRows(plan, tk, lex), lex };
};

export const writePronRequest = async (channel: string, episode: string): Promise<{ file: string; count: number }> => {
  const r = await pronRowsFor(episode);
  await mkdir(pronDir(), { recursive: true });
  const file = path.join(pronDir(), `طلب-${channel}-${episode}.md`);
  await writeFile(file, buildRequest(channel, episode, r.rows, r.lex));
  return { file, count: r.rows.length };
};
