/**
 * نص الآيات من السكريبت (قرار صاحب القناة، التوجيه 027): في القناة التي `rules.quranText = "script"`
 * يكتب صاحب القناة نص الآية بيده داخل علامتها في السكريبت:
 *
 *   [آية: البقرة 42 | نص الآية كما يعتمده صاحب القناة]
 *
 * - السكريبت هو المصدر الوحيد لنص البطاقة في هذه القناة: لا يُقرأ quran.json، ولا يُجلب نص آليًا
 *   (`quran-text-only` يرفض)، ولا يُصحَّح النص آليًا.
 * - النص يُستخرج كما كُتب (توحيد يونيكود NFC وحده، دون حذف تشكيل ولا علامة)، ثم يُقابَل بالمصحف المعتمد
 *   بأداة المطابقة (`auditEpisodeQuran`)، وتُعرض الفروق للمراجعة الشرعية. القرار في «سجل التوثيق» (review.json)،
 *   وأي تعديل على النص بعد التوثيق يعيده للمراجعة (البصمة في `reviewItems`).
 * - الآية التي لم يُكتب نصها تبقى بطاقتها بلا نص (`VERSE_PLACEHOLDER`) ومحجوبة.
 */
import path from "node:path";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { parseScript } from "../script/parse";
import { parseAyahRef } from "../script/quranMeta";
import type { ParsedScript } from "../script/types";

export type QuranTextSource = "script" | "fetch";

/** هوية القناة من مسار السكريبت (channels/<id>/episodes/…)، وإلا القناة الحالية. */
const channelIdOf = (scriptPath: string): string | null => {
  const m = path.resolve(scriptPath).split(path.sep).join("/").match(/\/channels\/([^/]+)\/episodes\//);
  return m ? m[1]! : null;
};

/** مصدر نص الآيات لقناة السكريبت: «script» إن نصت عليه قناته، وإلا «fetch» (السلوك القديم: quran.json). */
export const quranTextSourceFor = (scriptPath: string): QuranTextSource => {
  const id = channelIdOf(scriptPath);
  if (!id) return "fetch";
  const file = path.join(path.resolve(scriptPath).split(`${path.sep}episodes${path.sep}`)[0]!, "channel.json");
  if (!existsSync(file)) return "fetch";
  try {
    const c = JSON.parse(readFileSync(file, "utf8")) as { rules?: { quranText?: QuranTextSource } };
    return c.rules?.quranText === "script" ? "script" : "fetch";
  } catch {
    return "fetch";
  }
};

export type ScriptVerse = { ref: string; key?: string; text?: string; line: number; reason?: string };

/** كل علامة آية في السكريبت بمفتاحها ونصها المكتوب (إن كُتب). */
export const scriptVerses = (parsed: ParsedScript): ScriptVerse[] =>
  parsed.chapters.flatMap((c) => c.blocks).flatMap((b) => {
    if (b.kind !== "ayah") return [];
    const r = parseAyahRef(b.ref);
    const text = b.text?.normalize("NFC").trim() || undefined;
    return [r.ok ? { ref: b.ref, key: r.ref.key, text, line: b.line } : { ref: b.ref, text, line: b.line, reason: r.reason }];
  });

/** نصوص الآيات كما كتبها صاحب القناة في السكريبت: { مفتاح الآية: النص }. */
export const scriptVerseTexts = (parsed: ParsedScript): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const v of scriptVerses(parsed)) if (v.key && v.text) out[v.key] = v.text;
  return out;
};

/**
 * نصوص الآيات التي تُعرض في بطاقات الحلقة، من مصدرها المعتمد للقناة:
 * السكريبت في قناة «script»، وquran.json على الجهاز في غيرها.
 */
export const episodeQuranTexts = async (scriptPath: string): Promise<{ source: QuranTextSource; texts: Record<string, string> }> => {
  if (quranTextSourceFor(scriptPath) === "script") {
    const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
    return { source: "script", texts: scriptVerseTexts(parsed) };
  }
  const file = path.join(path.dirname(scriptPath), "quran.json");
  return { source: "fetch", texts: existsSync(file) ? (JSON.parse(await readFile(file, "utf8")) as Record<string, string>) : {} };
};

/** يرفض الجلب الآلي لنص الآيات في قناة نصها من السكريبت. */
export const assertFetchAllowed = (scriptPath: string) => {
  if (quranTextSourceFor(scriptPath) === "script")
    throw new Error("نص الآيات في هذه القناة يكتبه صاحب القناة في السكريبت ([آية: السورة رقم | النص])، ولا يُجلب آليًا. للمقابلة بالمصحف المعتمد: npx bal quran-script <الحلقة>.");
};
