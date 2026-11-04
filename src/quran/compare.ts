/**
 * مقابلة نص الآيات المعروض في بطاقات الحلقة (quran.json) بنص Quran Foundation المعتمد، دون كتابة شيء في quran.json.
 * المقارنة حرفًا وحركةً بعد توحيد ترميز يونيكود (NFC)، فلا يُعد اختلاف طريقة ترميز الهمزة أو ترتيب الشدة والحركة فرقًا،
 * ويُعد أي حرف أو حركة أو علامة مختلفة فرقًا يُعرض بموضعه.
 */
import path from "node:path";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { parseScript } from "../script/parse";
import { parseAyahRef } from "../script/quranMeta";
import { resolveScriptPath } from "../script/episodes";
import { quranPathFor, readJson } from "../plan/io";
import { composeVerses } from "./sync";
import type { QuranClient, Verse } from "./client";

export type TextDiff = { at: number; shown: string; approved: string };
export type VerseCheck = { key: string; status: "match" | "differs" | "missing" | "failed"; diffs: TextDiff[]; reason?: string };

const cp = (s: string) => Array.from(s).map((c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`).join(" ");

/** يقابل نصين ويعيد مواضع الاختلاف (بعد NFC). الفرق يُعرض برموز يونيكود لا بنص الآية. */
export const compareVerseText = (shown: string, approved: string): TextDiff[] => {
  const a = Array.from(shown.normalize("NFC").trim());
  const b = Array.from(approved.normalize("NFC").trim());
  if (a.join("") === b.join("")) return [];
  const diffs: TextDiff[] = [];
  let i = 0;
  while (i < Math.max(a.length, b.length) && diffs.length < 20) {
    if (a[i] !== b[i]) {
      diffs.push({ at: i, shown: cp(a.slice(i, i + 3).join("")), approved: cp(b.slice(i, i + 3).join("")) });
      i += 3;
    } else i++;
  }
  return diffs;
};

/** يجلب نص كل آية في السكريبت من Quran Foundation ويقابله بالنص المعروض، ولا يكتب في quran.json. */
export const checkEpisodeQuran = async (episode: string, client: Pick<QuranClient, "verse">): Promise<VerseCheck[]> => {
  const scriptPath = await resolveScriptPath(episode);
  const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
  const store = (await readJson<Record<string, string>>(quranPathFor(scriptPath))) ?? {};
  const refs = parsed.chapters.flatMap((c) => c.blocks).filter((b) => b.kind === "ayah") as { ref: string }[];
  const out: VerseCheck[] = [];
  for (const { ref } of refs) {
    const r = parseAyahRef(ref);
    if (!r.ok) {
      out.push({ key: ref, status: "failed", diffs: [], reason: r.reason });
      continue;
    }
    const { key, surah, from, to } = r.ref;
    const shown = store[key];
    if (!shown) {
      out.push({ key, status: "missing", diffs: [], reason: "لا نص معروض لهذه الآية في quran.json" });
      continue;
    }
    try {
      const verses: Verse[] = [];
      for (let n = from; n <= to; n++) verses.push(await client.verse(`${surah}:${n}`));
      const diffs = compareVerseText(shown, composeVerses(verses));
      out.push({ key, status: diffs.length ? "differs" : "match", diffs });
    } catch (err) {
      out.push({ key, status: "failed", diffs: [], reason: (err as Error).message });
    }
  }
  return out;
};

const STATUS: Record<VerseCheck["status"], string> = { match: "مطابق", differs: "فيه فروق", missing: "لا نص معروض", failed: "تعذّر الجلب" };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** يكتب نتيجة المقابلة في reviews/quran-check.html (بلا نص الآيات نفسه، احترامًا لشروط Quran Foundation). */
export const writeQuranCheckReport = async (episode: string, checks: VerseCheck[]): Promise<string> => {
  const dir = path.join(path.dirname(await resolveScriptPath(episode)), "reviews");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, "quran-check.html");
  const rows = checks
    .map((c) => `<tr><td>${esc(c.key)}</td><td>${STATUS[c.status]}</td><td>${c.reason ? esc(c.reason) : c.diffs.map((d) => `الموضع ${d.at}: المعروض ${d.shown} · المعتمد ${d.approved}`).join("<br>") || "—"}</td></tr>`)
    .join("");
  const when = new Date().toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
  await writeFile(
    file,
    `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>مقابلة الآيات بنص Quran Foundation — الحلقة ${esc(episode)}</title><meta name="description" content="المقابلة حرفًا وحركةً بين بطاقات الآيات والنص المعتمد (${when}). لا تعتمد شيئًا."><style>body{font:16px/1.7 system-ui,sans-serif;max-width:860px;margin:24px auto;padding:0 16px;background:#fff;color:#111}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:6px 8px;text-align:start;vertical-align:top}</style></head><body><h1>مقابلة الآيات بنص Quran Foundation</h1><p>الحلقة ${esc(episode)} · ${when}. المقارنة حرفًا وحركةً بعد توحيد ترميز يونيكود. الفروق تُعرض برموز يونيكود لا بنص الآية. النتيجة دليل للمراجعة ولا تعتمد شيئًا؛ القرار في «سجل التوثيق».</p><table><thead><tr><th>الآية</th><th>النتيجة</th><th>الفروق</th></tr></thead><tbody>${rows}</tbody></table></body></html>\n`,
    "utf8",
  );
  return file;
};
