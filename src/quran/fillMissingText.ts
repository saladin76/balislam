/**
 * One Quran text workflow for every Studio channel:
 * inspect scripted ayah references -> ask the owner -> save the exact supplied
 * text -> manual review. No external API, generated verses or plan rewrites.
 */
import path from "node:path";
import { randomUUID } from "node:crypto";
import { open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { parseScript } from "../script/parse";
import { parseAyahRef } from "../script/quranMeta";
import { resolveScriptPath } from "../script/episodes";
import { quranPathFor } from "../plan/io";

export type RequiredAyah = { key: string; label: string; status: "missing" | "existing" };
export type ManualTextStatus = {
  required: RequiredAyah[];
  missing: string[];
  existing: string[];
  invalid: { ref: string; reason: string }[];
};
export type ManualTextResult = { key: string; saved: boolean; status: ManualTextStatus };
const textFile = async (file: string): Promise<string | null> =>
  readFile(file, "utf8").catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return null;
    throw e;
  });
const parseStore = (raw: string | null): Record<string, string> => {
  if (raw === null) return {};
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("ملف quran.json غير صالح.");
  return value as Record<string, string>;
};
const requiredRefs = (script: string, scriptPath: string) =>
  parseScript(script, scriptPath).chapters.flatMap(ch => ch.blocks)
    .filter(block => block.kind === "ayah").map(block => {
      const label = (block as { ref: string }).ref;
      const parsed = parseAyahRef(label);
      return parsed.ok ? { label, key: parsed.ref.key } : { label, error: parsed.reason };
    });

export const inspectMissingQuranTexts = async (episode: string): Promise<ManualTextStatus> => {
  const scriptPath = await resolveScriptPath(episode);
  const refs = requiredRefs(await readFile(scriptPath, "utf8"), scriptPath);
  const saved = parseStore(await textFile(quranPathFor(scriptPath)));
  const required: RequiredAyah[] = [];
  const invalid: { ref: string; reason: string }[] = [];
  const seen = new Set<string>();
  for (const entry of refs) {
    if (!("key" in entry) || !entry.key) {
      invalid.push({ ref: entry.label, reason: "error" in entry ? entry.error : "مرجع غير صالح" });
      continue;
    }
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    required.push({ key: entry.key, label: entry.label, status: saved[entry.key]?.trim() ? "existing" : "missing" });
  }
  return {
    required, invalid,
    missing: required.filter(r => r.status === "missing").map(r => r.key),
    existing: required.filter(r => r.status === "existing").map(r => r.key),
  };
};

/**
 * Single-key insert only. An existing value cannot be silently overwritten.
 * Exclusive per-episode lock ensures concurrent manual edits do not lose data.
 * The original Unicode text (including tashkeel) is persisted byte-for-byte.
 */
export const saveManualQuranText = async (episode: string, key: string, text: string): Promise<ManualTextResult> => {
  if (typeof key !== "string" || !/^\d{1,3}:\d{1,3}(?:-\d{1,3})?$/.test(key))
    throw Error("مفتاح السورة والآية غير صالح.");
  if (typeof text !== "string" || !text.trim() || text.length > 16000 ||
      !/\p{Script=Arabic}/u.test(text) || /[<>\u0000-\u0008\u000E-\u001F]/u.test(text))
    throw Error("نص الآية غير صالح؛ أرسل النص العربي كما هو مع تشكيله.");
  const scriptPath = await resolveScriptPath(episode);
  const scriptSnapshot = await readFile(scriptPath, "utf8");
  const required = requiredRefs(scriptSnapshot, scriptPath);
  if (!required.some(r => "key" in r && r.key === key))
    throw Error("الآية غير مطلوبة في سكريبت هذه الحلقة؛ لم يُغيّر أي ملف.");
  const target = quranPathFor(scriptPath);
  const lock = target + ".manual.lock";
  const handle = await open(lock, "wx", 0o600).catch((e: NodeJS.ErrnoException) => {
    if (e.code === "EEXIST") throw Error("هناك تعديل متزامن لنصوص القرآن؛ أعد المحاولة بعد انتهائه.");
    throw e;
  });
  const temp = path.join(path.dirname(target), "." + path.basename(target) + "." + randomUUID() + ".tmp");
  let saved = false;
  try {
    const current = parseStore(await textFile(target));
    if (current[key]?.trim()) {
      if (current[key] !== text) throw Error("هناك نص محفوظ لهذه الآية؛ لا يُستبدل دون مراجعة صريحة.");
    } else {
      if ((await readFile(scriptPath, "utf8")) !== scriptSnapshot)
        throw Error("تغيّر السكريبت أثناء إدراج الآية؛ لم يُغيَّر المخزن.");
      current[key] = text;
      current[key + "#source"] = "manual-owner";
      current[key + "#at"] = new Date().toISOString();
      await writeFile(temp, JSON.stringify(current, null, 2) + "\n", { flag: "wx", mode: 0o600 });
      // Verify script a second time before atomic replacement.
      if ((await readFile(scriptPath, "utf8")) !== scriptSnapshot)
        throw Error("تغيّر السكريبت أثناء الحفظ؛ لم يُغيَّر المخزن.");
      await rename(temp, target);
      saved = true;
    }
  } finally {
    await handle.close();
    await rm(temp, { force: true });
    await rm(lock, { force: true });
  }
  return { key, saved, status: await inspectMissingQuranTexts(episode) };
};
