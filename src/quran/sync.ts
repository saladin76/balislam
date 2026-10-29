import { readFile, writeFile } from "node:fs/promises";
import { parseScript } from "../script/parse";
import { parseAyahRef } from "../script/quranMeta";
import { resolveScriptPath } from "../script/episodes";
import { quranPathFor, readJson } from "../plan/io";
import type { QuranClient, Verse } from "./client";

const ar = (n: number) => String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)] ?? d);

/**
 * نص البطاقة: آية واحدة كما هي. للمقطع (2:255-256) تُتبع كل آية بعلامة نهاية الآية ۝ ورقمها،
 * وهي الطريقة المعتادة في المصاحف، دون أي تغيير في النص نفسه.
 */
export const composeVerses = (verses: Verse[]): string =>
  verses.length === 1 ? verses[0]!.text : verses.map((v) => `${v.text} ۝${ar(v.number)}`).join(" ");

export type QuranSyncResult = { fetched: string[]; cached: string[]; failed: { ref: string; reason: string }[] };

/** يجلب نصوص كل آيات السكريبت غير المخزنة ويحفظها في quran.json بجوار السكريبت. */
export const syncQuran = async (episode: string, client: QuranClient, opts: { force?: boolean } = {}): Promise<QuranSyncResult> => {
  const scriptPath = await resolveScriptPath(episode);
  const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
  const file = quranPathFor(scriptPath);
  const store = (await readJson<Record<string, string>>(file)) ?? {};
  const result: QuranSyncResult = { fetched: [], cached: [], failed: [] };

  const refs = parsed.chapters.flatMap((c) => c.blocks).filter((b) => b.kind === "ayah") as { ref: string }[];
  for (const { ref } of refs) {
    const r = parseAyahRef(ref);
    if (!r.ok) {
      result.failed.push({ ref, reason: r.reason });
      continue;
    }
    const { key, surah, from, to } = r.ref;
    if (store[key] && !opts.force) {
      result.cached.push(key);
      continue;
    }
    try {
      const verses: Verse[] = [];
      for (let n = from; n <= to; n++) verses.push(await client.verse(`${surah}:${n}`));
      store[key] = composeVerses(verses);
      result.fetched.push(key);
    } catch (err) {
      result.failed.push({ ref, reason: (err as Error).message });
    }
  }
  await writeFile(file, JSON.stringify(store, null, 2) + "\n", "utf8");
  return result;
};
