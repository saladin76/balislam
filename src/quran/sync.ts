import path from "node:path";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { audioDuration } from "../voice/generate";
import { parseScript } from "../script/parse";
import { parseAyahRef } from "../script/quranMeta";
import { resolveScriptPath } from "../script/episodes";
import { quranPathFor, readJson } from "../plan/io";
import type { QuranClient, Verse } from "./client";
import { loadChannel } from "../channel/index";

/** مفتاح ترجمة المعنى داخل quran.json بجوار نص الآية. */
export const meaningKey = (key: string) => `${key}#meaning`;

const ar = (n: number) => String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)] ?? d);

/**
 * نص البطاقة: آية واحدة كما هي. للمقطع (2:255-256) تُتبع كل آية بعلامة نهاية الآية ۝ ورقمها،
 * وهي الطريقة المعتادة في المصاحف، دون أي تغيير في النص نفسه.
 */
export const composeVerses = (verses: Verse[]): string =>
  verses.length === 1 ? verses[0]!.text : verses.map((v) => `${v.text} ۝${ar(v.number)}`).join(" ");

export type QuranSyncResult = { fetched: string[]; cached: string[]; failed: { ref: string; reason: string }[]; recited: string[] };

/** شروط Quran Foundation: لا يُحتفظ بمحتواها أكثر من أسبوع؛ ما هو أقدم يُجلب من جديد. */
export const QF_MAX_AGE_MS = 6.5 * 24 * 3600 * 1000;
const atKey = (key: string) => `${key}#at`;
const fresh = (iso?: string) => Boolean(iso && Date.now() - Date.parse(iso) < QF_MAX_AGE_MS);

/** فهرس تلاوات Quran Foundation للحلقة: recitations/index.json بجوار السكريبت. */
export type RecitationIndex = Record<string, { parts: { file: string; duration: number }[]; reciter: string; recitationId: number; fetchedAt: string }>;
export const recitationsDirFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "recitations");

/** يجلب نصوص كل آيات السكريبت غير المخزنة ويحفظها في quran.json بجوار السكريبت. */
export const syncQuran = async (episode: string, client: QuranClient, opts: { force?: boolean } = {}): Promise<QuranSyncResult> => {
  const scriptPath = await resolveScriptPath(episode);
  const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
  const file = quranPathFor(scriptPath);
  const store = (await readJson<Record<string, string>>(file)) ?? {};
  const result: QuranSyncResult = { fetched: [], cached: [], failed: [], recited: [] };
  const channel = loadChannel();
  const recitation = channel.rules.quran ? channel.recitation : undefined;
  const recDir = recitationsDirFor(scriptPath);
  const recIndexFile = path.join(recDir, "index.json");
  const recIndex: RecitationIndex = (await readJson<RecitationIndex>(recIndexFile)) ?? {};
  // ترجمة المعنى للقنوات غير العربية (معرّفها في channel.json ← quranTranslation)
  const translationId = loadChannel().quranTranslation?.id;

  const refs = parsed.chapters.flatMap((c) => c.blocks).filter((b) => b.kind === "ayah") as { ref: string }[];
  for (const { ref } of refs) {
    const r = parseAyahRef(ref);
    if (!r.ok) {
      result.failed.push({ ref, reason: r.reason });
      continue;
    }
    const { key, surah, from, to } = r.ref;
    // التلاوة (إن اختارت القناة قارئًا): ملف لكل آية، تُشغَّل متتالية في البطاقة
    if (recitation) {
      const have = recIndex[key];
      if (opts.force || !have || have.recitationId !== recitation.id || !fresh(have.fetchedAt) || have.parts.some((p) => !existsSync(path.join(recDir, p.file)))) {
        try {
          await mkdir(recDir, { recursive: true });
          const parts: { file: string; duration: number }[] = [];
          for (let n = from; n <= to; n++) {
            const url = await client.verseAudioUrl(recitation.id, `${surah}:${n}`);
            const res = await client.fetch(url);
            if (!res.ok) throw new Error(`تعذّر تنزيل تلاوة ${surah}:${n} (${res.status}).`);
            const file = `${recitation.id}-${surah}-${n}.mp3`;
            await writeFile(path.join(recDir, file), Buffer.from(await res.arrayBuffer()));
            parts.push({ file, duration: (await audioDuration(path.join(recDir, file))) ?? 0 });
          }
          recIndex[key] = { parts, reciter: recitation.name, recitationId: recitation.id, fetchedAt: new Date().toISOString() };
          result.recited.push(key);
        } catch (err) {
          result.failed.push({ ref: `${ref} (التلاوة)`, reason: (err as Error).message });
        }
      }
    }
    if (store[key] && fresh(store[atKey(key)]) && (!translationId || store[meaningKey(key)]) && !opts.force) {
      result.cached.push(key);
      continue;
    }
    try {
      const verses: Verse[] = [];
      for (let n = from; n <= to; n++) verses.push(await client.verse(`${surah}:${n}`, { translationId }));
      store[key] = composeVerses(verses);
      if (translationId) {
        const meanings = verses.map((v) => v.meaning ?? "").filter(Boolean);
        if (meanings.length === verses.length) store[meaningKey(key)] = verses.length === 1 ? meanings[0]! : verses.map((v, i) => `(${v.number}) ${meanings[i]}`).join(" ");
      }
      store[atKey(key)] = new Date().toISOString();
      result.fetched.push(key);
    } catch (err) {
      result.failed.push({ ref, reason: (err as Error).message });
    }
  }
  await writeFile(file, JSON.stringify(store, null, 2) + "\n", "utf8");
  if (recitation || Object.keys(recIndex).length) {
    // بلا قارئ مختار: تُحذف تلاوات Quran Foundation المخزنة؛ ومع قارئ: تُحذف الملفات غير المستخدمة
    const keep = recitation ? recIndex : {};
    const used = new Set(Object.values(keep).flatMap((r) => r.parts.map((p) => p.file)));
    if (existsSync(recDir)) for (const f of await readdir(recDir)) if (f.endsWith(".mp3") && !used.has(f)) await unlink(path.join(recDir, f)).catch(() => {});
    await mkdir(recDir, { recursive: true });
    await writeFile(recIndexFile, JSON.stringify(keep, null, 2) + "\n", "utf8");
  }
  return result;
};
