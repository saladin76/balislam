/** Explicit owner script signoff. Never implied by a successful validation or citation review. */
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { parseScript } from "./parse";
import { checkForChannel } from "./checkChannel";
import { quranFromScript } from "../quran/scriptText";

export type ScriptSignoff = { version: 1; sha256: string; reviewer: string; note: string; at: string };
export const scriptSignoffFile = (scriptPath: string) => path.join(path.dirname(scriptPath), "script-signoff.json");
const hash = (data: string) => createHash("sha256").update(data, "utf8").digest("hex");

export const scriptSignoffStatus = async (scriptPath: string): Promise<{
  approved: boolean; changed: boolean; needsReview?: boolean; signedAt?: string; reviewer?: string;
}> => {
  let old: ScriptSignoff | null = null;
  try { old = JSON.parse(await readFile(scriptSignoffFile(scriptPath), "utf8")) as ScriptSignoff; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const script = await readFile(scriptPath, "utf8");
  const current = hash(script);
  const fingerprintMatches = old?.version === 1 && Boolean(old.reviewer?.trim() && old.note?.trim()) &&
    old.sha256 === current;
  const parsed = parseScript(script, scriptPath);
  // Citations are documentation only and never block (CLAUDE.md rule 5; owner decision 10 Nov).
  const quranOk = !quranFromScript(parsed).problems.length;
  const valid = fingerprintMatches && quranOk;
  return { approved: Boolean(valid), changed: Boolean(old && old.sha256 !== current),
    needsReview: Boolean(old && old.sha256 === current && !quranOk),
    signedAt: old?.at, reviewer: old?.reviewer };
};

/** Must be called by an explicit, authenticated reviewer action, never during saves. */
export const approveScript = async (
  scriptPath: string, reviewer: string, note: string, confirmed: boolean,
): Promise<ScriptSignoff> => {
  if (!confirmed || !reviewer?.trim() || note?.trim().length < 20)
    throw new Error("اعتماد السكريبت يتطلب اسم المراجع وملاحظة فعلية وتأكيدًا صريحًا.");
  const text = await readFile(scriptPath, "utf8");
  const parsed = parseScript(text, scriptPath);
  const checked = checkForChannel(parsed);
  if (!checked.ok) throw new Error("السكريبت يحتوي أخطاء؛ صححها قبل اعتماد النص.");
  if (quranFromScript(parsed).problems.length)
    throw new Error("نصوص الآيات ناقصة أو متعارضة؛ راجعها داخل السكريبت.");
  const record: ScriptSignoff = { version: 1, sha256: hash(text), reviewer: reviewer.trim(),
    note: note.trim(), at: new Date().toISOString() };
  const target = scriptSignoffFile(scriptPath);
  const temp = `${target}.${randomUUID()}.tmp`;
  try {
    // Do not sign an older snapshot if the script changes during validation.
    if (await readFile(scriptPath, "utf8") !== text)
      throw new Error("السكريبت تغيّر أثناء الاعتماد؛ أعد المراجعة.");
    await writeFile(temp, JSON.stringify(record, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    await rename(temp, target);
  } finally { await rm(temp, { force: true }); }
  return record;
};

export const assertScriptApproved = async (scriptPath: string) => {
  if (!(await scriptSignoffStatus(scriptPath)).approved)
    throw new Error("السكريبت لم يعتمد صراحة أو تغيّر بعد اعتماده؛ راجع النص أولًا.");
  // Even unchanged script cannot bypass a revoked Quran citation approval.
  const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
  if (quranFromScript(parsed).problems.length)
    throw new Error("موافقة السكريبت أو توثيق الآيات لم تعد صالحة.");
  return true;
};
