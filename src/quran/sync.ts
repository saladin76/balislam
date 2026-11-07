import path from "node:path";
import { toEasternDigits } from "../i18n/packs";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { audioDuration } from "../voice/generate";
import { parseScript } from "../script/parse";
import { quranFromScript } from "./scriptText";
import { parseAyahRef } from "../script/quranMeta";
import { resolveScriptPath } from "../script/episodes";
import { quranPathFor, readJson } from "../plan/io";
import type { QuranClient, Verse } from "./client";
import { loadChannel } from "../channel/index";
import { createAlQuranClient } from "./alquranCloud";
import { activeRecitation, isCloudRecitation, recitationIdentity, requireCloudPublicationRights } from "./provider";

/** مفتاح ترجمة المعنى داخل quran.json بجوار نص الآية. */
export const meaningKey = (key: string) => `${key}#meaning`;

const ar = toEasternDigits;

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
export type RecitationIndex = Record<string, { parts: { file: string; duration: number }[]; reciter: string; recitationId?: number; provider?: "alquran-cloud" | "quran-foundation" | "manual"; edition?: string; fetchedAt: string; approvedAt?: string; approvedBy?: string; sha256?: string; textSha256?: string; rightsEvidence?: string }>;
export const recitationsDirFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "recitations");

/** Synchronize licensed recitations and optional meaning translations; never write Quran text. */
export const syncQuran = async (episode: string, client: QuranClient, opts: { force?: boolean } = {}): Promise<QuranSyncResult> => {
  const scriptPath = await resolveScriptPath(episode);
  const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
  const authored = quranFromScript(parsed);
  const file = quranPathFor(scriptPath);
  const store = (await readJson<Record<string, string>>(file)) ?? {};
  const result: QuranSyncResult = { fetched: [], cached: [], failed: [], recited: [] };
  const channel = loadChannel();
  const recitation = channel.rules.quran ? await activeRecitation(scriptPath, channel.recitation) : undefined;
  // Fail closed: a chosen Cloud voice must have documented publication rights, not merely preview access.
  if (recitation && isCloudRecitation(recitation)) requireCloudPublicationRights(recitation);
  const cloud = recitation && isCloudRecitation(recitation) ? createAlQuranClient(client.fetch) : null;
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
    if (!authored.texts[key] || authored.problems.some((p) => p.key === key)) {
      result.failed.push({ ref, reason: "يجب كتابة نص الآية داخل السكريبت وإزالة أي تعارض قبل تنزيل تلاوتها." });
      continue;
    }
    // تلاوة الآيات من المصدر المختار؛ يبقى نص المصحف وترجمته من Quran Foundation.
    // A human-approved local recording is never overwritten by an automatic provider sync.
    if (recitation && recIndex[key]?.provider !== "manual") {
      const id = recitationIdentity(recitation);
      const have = recIndex[key];
      const same = have && (isCloudRecitation(recitation)
        ? have.provider === "alquran-cloud" && have.edition === recitation.edition
        : have.provider !== "alquran-cloud" && have.recitationId === recitation.id);
      if (opts.force || !same || !fresh(have?.fetchedAt) ||
          have?.parts.some((p) => !existsSync(path.join(recDir, p.file)))) {
        const created: string[] = [];
        try {
          await mkdir(recDir, { recursive: true });
          const parts: { file: string; duration: number }[] = [];
          for (let n = from; n <= to; n++) {
            const url = cloud
              ? (await cloud.ayah(surah, n, recitation && isCloudRecitation(recitation) ? recitation.edition : "")).audio
              : await client.verseAudioUrl(!isCloudRecitation(recitation) ? recitation.id : 0, `${surah}:${n}`);
            const res = await client.fetch(url);
            if (!res.ok) throw new Error(`تعذّر تنزيل تلاوة ${surah}:${n} (${res.status}).`);
            const len = Number(res.headers.get("content-length") ?? 0);
            if (len > 20_000_000) throw new Error("حجم ملف التلاوة أكبر من الحد الآمن.");
            const bytes = Buffer.from(await res.arrayBuffer());
            if (bytes.length < 100 || bytes.length > 20_000_000) throw new Error("ملف التلاوة غير صالح أو كبير جدًا.");
            // Preserve the existing Quran Foundation filename contract for old episodes.
            // A fresh Cloud filename prevents a failed refresh from deleting previous good clips.
            // Keep Quran Foundation's legacy filenames unchanged for existing episodes.
            const file = isCloudRecitation(recitation)
              ? `${id}-${surah}-${n}-${Date.now().toString(36)}.mp3`
              : `${recitation.id}-${surah}-${n}.mp3`;
            const destination = path.join(recDir, file);
            const existedBefore = existsSync(destination);
            const temp = path.join(recDir, `${file}.tmp`);
            await writeFile(temp, bytes);
            try {
              const duration = await audioDuration(temp);
              if (!duration || duration <= 0) throw new Error("تعذّر التحقق من مدة تلاوة الآية.");
              await rename(temp, destination);
              if (!existedBefore) created.push(file);
              parts.push({ file, duration });
            } finally { await unlink(temp).catch(() => {}); }
          }
          recIndex[key] = {
            parts, reciter: recitation.name, fetchedAt: new Date().toISOString(),
            ...(isCloudRecitation(recitation)
              ? { provider: "alquran-cloud" as const, edition: recitation.edition }
              : { provider: "quran-foundation" as const, recitationId: recitation.id }),
          };
          result.recited.push(key);
        } catch (err) {
          // Do not replace the previous verified index when a remote fetch fails.
          for (const file of created) await unlink(path.join(recDir, file)).catch(() => {});
          result.failed.push({ ref: `${ref} (التلاوة)`, reason: err instanceof Error ? err.message : String(err) });
        }
      }
    }
    // The script is always the source of Quran text. A separate historical
    // quran.json may retain meanings, but sync never creates/overwrites verse text.
    if (fresh(store[atKey(key)]) && (!translationId ||
        (store[meaningKey(key)] && store[`${key}#meaningSource`])) && !opts.force) {
      result.cached.push(key);
      continue;
    }
    if (!translationId) {
      store[atKey(key)] = new Date().toISOString();
      result.cached.push(key);
      continue;
    }
    try {
      const verses: Verse[] = [];
      for (let n = from; n <= to; n++) {
        const expected = `${surah}:${n}`;
        const verse = await client.verse(expected, { translationId });
        if (verse.key !== expected || verse.number !== n)
          throw new Error(`المصحف أعاد مرجعًا مغايرًا لـ ${expected}؛ لن تُحفظ ترجمة غير موثّقة.`);
        verses.push(verse);
      }
      const meanings = verses.map((v) => v.meaning ?? "").filter(Boolean);
      if (meanings.length !== verses.length)
        throw new Error("الترجمة غير مكتملة؛ احتُفظ بالنسخة التاريخية دون استبدال.");
      const source = channel.quranTranslation?.name?.trim();
      if (!source) throw new Error("المترجم غير محدد؛ لن تُحفظ ترجمة بلا نسبة صحيحة.");
      store[meaningKey(key)] = verses.length === 1 ? meanings[0]! :
        verses.map((v, i) => `(${v.number}) ${meanings[i]}`).join(" ");
      store[`${key}#meaningSource`] = source;
      store[atKey(key)] = new Date().toISOString();
      result.fetched.push(key);
    } catch (err) {
      result.failed.push({ ref, reason: (err as Error).message });
    }
  }
  await writeFile(file, JSON.stringify(store, null, 2) + "\n", "utf8");
  if (recitation || Object.keys(recIndex).length) {
    // بلا قارئ مختار: تُحذف تلاوات Quran Foundation المخزنة؛ ومع قارئ: تُحذف الملفات غير المستخدمة
    const keep: RecitationIndex = recitation ? recIndex : Object.fromEntries(
      Object.entries(recIndex).filter(([, value]) => value?.provider === "manual"));
    // Never delete unindexed MP3s or another producer's clips. Retiring a
    // provider selection changes the pointer, not the original recordings.
    await mkdir(recDir, { recursive: true });
    await writeFile(recIndexFile, JSON.stringify(keep, null, 2) + "\n", "utf8");
  }
  return result;
};
