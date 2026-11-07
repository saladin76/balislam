import path from "node:path";
import { toEasternDigits } from "../i18n/packs";
import { link, lstat, mkdir, open, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { decodedAudioDuration, isOwnedRegularAudio } from "../voice/audioIntegrity";
import { parseScript } from "../script/parse";
import { quranFromScript, historicalMeaningConflict } from "./scriptText";
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
const fresh = (iso?: string) => {
  const at = Date.parse(iso ?? "");
  const age = Date.now() - at;
  return Number.isFinite(at) && age >= -60_000 && age < QF_MAX_AGE_MS;
};

/** فهرس تلاوات Quran Foundation للحلقة: recitations/index.json بجوار السكريبت. */
export type RecitationIndex = Record<string, { parts: { file: string; duration: number; sha256?: string }[]; reciter: string; recitationId?: number; provider?: "alquran-cloud" | "quran-foundation" | "manual"; edition?: string; fetchedAt: string; approvedAt?: string; approvedBy?: string; reviewNote?: string; sha256?: string; textSha256?: string;
  rightsEvidence?: string; originalFile?: string; originalName?: string; originalSha256?: string }>;
export const recitationsDirFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "recitations");
const ensureSafeRecitationDirectory = async (dir: string) => {
  await mkdir(dir, { recursive: true });
  const info = await lstat(dir);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error("مجلد التلاوات مرتبط رمزيًا خارج نطاق الحلقة؛ رُفضت المزامنة.");
};


/**
 * Write-once provider MP3 publication. A hard link is an atomic no-overwrite
 * operation on the same filesystem. Content mismatch fails WITHOUT replacing
 * the old source; newly-created temp files remain owned by the caller.
 */
export const publishImmutableRecitationPart = async (
  dir: string, name: string, temp: string, expectedSha256: string,
): Promise<string> => {
  const base = path.resolve(dir);
  if (!/^[a-z0-9][a-z0-9._-]{0,190}\.mp3$/i.test(name) || name.includes("..") ||
      !/^[a-f0-9]{64}$/.test(expectedSha256) || path.dirname(path.resolve(temp)) !== base)
    throw new Error("اسم أو بصمة التسجيل القادم من المصدر غير آمنة.");
  const root = await lstat(base);
  if (!root.isDirectory() || root.isSymbolicLink() ||
      !await isOwnedRegularAudio(base, path.basename(temp)))
    throw new Error("ملف التلاوة المؤقت ليس مملوكًا لمجلد الحلقة.");
  const source = await readFile(temp);
  if (createHash("sha256").update(source).digest("hex") !== expectedSha256)
    throw new Error("محتوى التسجيل المؤقت لا يطابق بصمته.");
  const destination = path.join(base, name);
  try { await link(temp, destination); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  if (!await isOwnedRegularAudio(base, name))
    throw new Error("التسجيل الموجود ليس ملفًا محليًا عاديًا.");
  const stored = await readFile(destination);
  if (createHash("sha256").update(stored).digest("hex") !== expectedSha256)
    throw new Error("تسجيل سابق بهذا الاسم تغيّر؛ لن يُكتب فوقه.");
  return destination;
};

/** A provider cache is trustworthy only while actual bytes, decode and timing agree. */
export const verifiedProviderPart = async (
  dir: string, part: { file: string; duration: number; sha256?: string },
): Promise<boolean> => {
  if (!part || typeof part.file !== "string" ||
      !/^[a-z0-9][a-z0-9._-]{0,190}\.mp3$/i.test(part.file) ||
      part.file.includes("..") || !/^[a-f0-9]{64}$/.test(part.sha256 ?? "") ||
      !Number.isFinite(part.duration) || part.duration <= 0 ||
      !await isOwnedRegularAudio(dir, part.file)) return false;
  try {
    const bytes = await readFile(path.join(dir, part.file));
    if (createHash("sha256").update(bytes).digest("hex") !== part.sha256) return false;
    const decoded = await decodedAudioDuration(path.join(dir, part.file), { mp3Only: true, maxSeconds: 600 });
    return Boolean(decoded && Math.abs(decoded - part.duration) <= Math.max(0.15, part.duration * 0.03));
  } catch { return false; }
};

/** Never let an external-provider sync replace a new, explicitly reviewed human clip. */
export const preserveManualRecitations = (staged: RecitationIndex, latest: RecitationIndex): RecitationIndex => {
  const result = { ...staged };
  for (const [key, value] of Object.entries(latest))
    if (value?.provider === "manual") result[key] = value;
  return result;
};

const atomicJson = async (file: string, value: unknown) => {
  const tmp = file + "." + randomUUID() + ".tmp";
  try {
    await writeFile(tmp, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    await rename(tmp, file);
  } finally { await rm(tmp, { force: true }); }
};

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
      // A parseable, recent index with missing SHA or broken MP3 is never a hit.
      const cacheReady = Boolean(have && have.parts.length &&
        (await Promise.all(have.parts.map((part) => verifiedProviderPart(recDir, part)))).every(Boolean));
      if (opts.force || !same || !fresh(have?.fetchedAt) || !cacheReady) {
        try {
          await ensureSafeRecitationDirectory(recDir);
          const parts: { file: string; duration: number; sha256: string }[] = [];
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
            // Immutable content-addressed filenames prevent a partial failed
            // multi-ayah refresh from overwriting a prior working recording.
            const digest = createHash("sha256").update(bytes).digest("hex");
            const file = `${id}-${surah}-${n}-${digest.slice(0,24)}.mp3`;
            const destination = path.join(recDir, file);
            const temp = path.join(recDir, `.${file}.${randomUUID()}.tmp.mp3`);
            await writeFile(temp, bytes, { flag: "wx", mode: 0o600 });
            try {
              const duration = await decodedAudioDuration(temp, { mp3Only: true, maxSeconds: 600 });
              if (!duration) throw new Error("تسجيل المصدر الخارجي غير قابل لفك الترميز كاملًا.");
              await publishImmutableRecitationPart(recDir, file, temp, digest);
              const storedDuration = await decodedAudioDuration(destination, { mp3Only: true, maxSeconds: 600 });
              if (!storedDuration || Math.abs(storedDuration - duration) > Math.max(0.15, duration * 0.03))
                throw new Error("مدة التسجيل المخزّن لا تطابق الملف القادم من المصدر.");
              parts.push({ file, duration: storedDuration, sha256: digest });
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
          // An immutable, shared file may be used by another sync. Never
          // delete it on a later ayah failure; the index stays unchanged.
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
      const nextMeaning = verses.length === 1 ? meanings[0]! :
        verses.map((v, i) => `(${v.number}) ${meanings[i]}`).join(" ");
      const conflict = historicalMeaningConflict(store, key, nextMeaning, source);
      if (conflict) throw new Error(conflict);
      store[meaningKey(key)] = nextMeaning;
      store[`${key}#meaningSource`] = source;
      store[atKey(key)] = new Date().toISOString();
      result.fetched.push(key);
    } catch (err) {
      result.failed.push({ ref, reason: (err as Error).message });
    }
  }
  await atomicJson(file, store);
  if (recitation || Object.keys(recIndex).length) {
    // بلا قارئ مختار: تُحذف تلاوات Quran Foundation المخزنة؛ ومع قارئ: تُحذف الملفات غير المستخدمة
    const keep: RecitationIndex = recitation ? recIndex : Object.fromEntries(
      Object.entries(recIndex).filter(([, value]) => value?.provider === "manual"));
    // Never delete unindexed MP3s or another producer's clips. Retiring a
    // provider selection changes the pointer, not the original recordings.
    await ensureSafeRecitationDirectory(recDir);
    // The manual uploader/approver uses the SAME lock file; a simultaneous
    // approval must never be silently overwritten by a slower provider sync.
    const lockFile = path.join(recDir, ".manual-audio.lock");
    const lock = await open(lockFile, "wx", 0o600).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "EEXIST")
        throw new Error("توجد مراجعة تلاوة يدوية جارية؛ أعد مزامنة القارئ بعد انتهائها.");
      throw error;
    });
    try {
      const latest = (await readJson<RecitationIndex>(recIndexFile)) ?? {};
      await atomicJson(recIndexFile, preserveManualRecitations(keep, latest));
    } finally {
      await lock.close();
      await rm(lockFile, { force: true });
    }
  }
  return result;
};
