/** Rights-reviewed local Quran recording workflow. No external provider or TTS.
 * The uploader need not be the script author or the reciter; the original audio is provided explicitly; ffmpeg applies gentle leveling only (no pitch
 * shift, time stretch, speech synthesis or cuts). Pending clips never render.
 */
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { open, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolveScriptPath } from "../script/episodes";
import { parseScript } from "../script/parse";
import { quranFromScript } from "./scriptText";
import { recitationsDirFor, type RecitationIndex } from "./sync";

import { audioDuration } from "../voice/generate";

const ffmpeg = promisify(execFile);
export type OwnAudioCandidate = {
  file: string; originalFile: string; duration: number; sha256: string; originalSha256: string; createdAt: string;
};
export type OwnAudioReview = Record<string, OwnAudioCandidate>;
export const ownAudioReviewFile = (scriptPath: string) => path.join(recitationsDirFor(scriptPath), "review.json");
const validName = (f: string) => /^manual-\d+-\d+(?:-\d+)?-[a-f0-9]{12}\.mp3$/.test(f);
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const readJson = async <T>(file: string, fallback: T): Promise<T> => {
  try {
    const content = await readFile(file, "utf8");
    const value: unknown = JSON.parse(content);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("بيانات المراجعة غير صالحة.");
    return value as T;
  } catch(e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw e;
  }
};
const atomicJson = async (target: string, value: unknown) => {
  const tmp = target + "." + randomUUID() + ".tmp";
  try {
    await writeFile(tmp, JSON.stringify(value, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    await rename(tmp, target);
  } finally { await rm(tmp, { force: true }); }
};
const withLock = async <T>(scriptPath: string, fn: (dir: string) => Promise<T>): Promise<T> => {
  const dir = recitationsDirFor(scriptPath);
  await mkdir(dir, { recursive: true });
  const lockFile = path.join(dir, ".manual-audio.lock");
  const lock = await open(lockFile, "wx", 0o600).catch((e: NodeJS.ErrnoException) => {
    if (e.code === "EEXIST") throw Error("هناك عملية تلاوة أخرى قيد التنفيذ؛ جرّب بعد انتهائها.");
    throw e;
  });
  try { return await fn(dir); }
  finally { await lock.close(); await rm(lockFile, { force: true }); }
};
const requested = async (episode: string, key: string): Promise<string> => {
  const scriptPath = await resolveScriptPath(episode);
  const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
  const source = quranFromScript(parsed);
  if (source.problems.some((p) => p.key === key) || !source.texts[key])
    throw Error("مرجع التلاوة ونصها المعتمد للمراجعة يجب أن يكونا مكتوبين داخل السكريبت، بلا تعارض.");
  return source.texts[key];
};
/** Upload caller supplies bytes from a locally selected recording file. */
export const prepareOwnRecitation = async (
  episode: string, key: string, filename: string, source: Uint8Array,
): Promise<OwnAudioCandidate> => {
  await requested(episode, key);
  if (!/^\d{1,3}:\d{1,3}(?:-\d{1,3})?$/.test(key)) throw Error("مرجع التلاوة غير صالح.");
  const ext = path.extname(filename).toLowerCase();
  if (![".wav",".mp3",".m4a",".aac",".ogg",".flac"].includes(ext))
    throw Error("التسجيل يجب أن يكون WAV أو MP3 أو M4A أو AAC أو OGG أو FLAC.");
  if (source.byteLength < 500 || source.byteLength > 25 * 1024 * 1024)
    throw Error("ملف التلاوة يجب أن يكون بين 500 بايت و25 ميجابايت.");
  const scriptPath = await resolveScriptPath(episode);
  return withLock(scriptPath, async dir => {
    const reviewFile = ownAudioReviewFile(scriptPath);
    const pending = await readJson<OwnAudioReview>(reviewFile, {});
    if (pending[key]) throw Error("يوجد تسجيل ينتظر المراجعة لهذه الآية؛ راجعه أولًا.");
    const nonce = randomUUID();
    const name = `manual-${key.replace(/[:]/g, "-")}-${nonce.replace(/-/g,"").slice(0,12)}.mp3`;
    const originalDir = path.join(dir, "originals");
    await mkdir(originalDir, { recursive: true });
    const originalFile = path.join("originals", nonce + ext);
    const input = path.join(dir, originalFile);
    const temp = path.join(dir, "." + name + ".tmp.mp3");
    const output = path.join(dir, name);
    let moved = false;
    try {
      await writeFile(input, source, { flag:"wx", mode:0o600 });
      const inputDuration = await audioDuration(input);
      if (!inputDuration || inputDuration < 0.3 || inputDuration > 600)
        throw Error("مدة التلاوة الأصلية غير صالحة أو تزيد على عشر دقائق؛ لن نقتطع منها شيئًا.");
      await ffmpeg("ffmpeg", [
        "-nostdin","-hide_banner","-loglevel","error","-y",
        "-i",input,"-vn",
        "-af","highpass=f=70,lowpass=f=14000,loudnorm=I=-18:TP=-2:LRA=11",
        "-ar","48000","-ac","1","-c:a","libmp3lame","-b:a","192k",
        temp,
      ], { timeout:120000, maxBuffer:1024*1024 });
      const duration = await audioDuration(temp);
      if (!duration || duration < 0.3 || duration > 600)
        throw Error("تعذّر قراءة مدة تسجيل التلاوة بعد التحسين.");
      const bytes = await readFile(temp);
      if (!bytes.length) throw Error("الناتج الصوتي فارغ.");
      await rename(temp, output);
      moved = true;
      const record = {
        file:name, originalFile, duration, sha256:sha(bytes), originalSha256:sha(source),
        createdAt:new Date().toISOString(),
      };
      await atomicJson(reviewFile, { ...pending, [key]:record });
      return record;
    } catch(e) {
      if (moved) await rm(output, { force:true });
      await rm(input, { force: true });
      throw e;
    } finally {
      // Keep the original recording beside its review candidate for lossless rollback.
      await rm(temp, { force:true });
    }
  });
};
export const ownAudioStatus = async (episode: string) => {
  const scriptPath = await resolveScriptPath(episode);
  const dir = recitationsDirFor(scriptPath);
  const pending = await readJson<OwnAudioReview>(ownAudioReviewFile(scriptPath), {});
  const approved = await verifiedOwnRecitations(scriptPath);
  // Verified means hashes and decoding match. Final renderer integration remains separate.
  return { pending, approved, renderIntegrated: false };
};
/** Explicit owner signoff after listening; never changes the script, plan or other approvals. */
export const approveOwnRecitation = async (
  episode: string, key: string, reviewer: string, note: string, listened: boolean,
  attribution: { reciter: string; rightsEvidence: string },
) => {
  if (!listened || !reviewer?.trim() || note?.trim().length < 12)
    throw Error("استمع إلى التلاوة كاملةً وأدخل اسم المراجع وملاحظة فعلية قبل الاعتماد.");
  if (!attribution?.reciter?.trim() || !attribution.rightsEvidence?.trim() || attribution.rightsEvidence.trim().length < 12)
    throw Error("حدّد اسم القارئ ودليل حق استخدام التسجيل، دون افتراض أنه صوت كاتب السكريبت.");
  const approvedText = await requested(episode,key);
  const scriptPath = await resolveScriptPath(episode);
  return withLock(scriptPath, async dir => {
    const file=ownAudioReviewFile(scriptPath);
    const pending=await readJson<OwnAudioReview>(file,{});
    const candidate=pending[key];
    if (!candidate || !validName(candidate.file)) throw Error("لا توجد نسخة تلاوة صالحة تنتظر المراجعة.");
    const bytes=await readFile(path.join(dir,candidate.file));
    if (sha(bytes)!==candidate.sha256 ||
        !(await audioDuration(path.join(dir,candidate.file))))
      throw Error("التسجيل تالف أو تغيّر بعد التحسين؛ أوقف الاعتماد.");
    if ((await requested(episode,key)) !== approvedText)
      throw Error("تغيّر نص الآية أثناء مراجعة التسجيل؛ أوقف الاعتماد.");
    const indexFile=path.join(dir,"index.json");
    const current=await readJson<RecitationIndex>(indexFile,{});
    const entry:RecitationIndex[string]={
      provider:"manual",reciter:attribution.reciter.trim(),rightsEvidence:attribution.rightsEvidence.trim(),
      parts:[{file:candidate.file,duration:candidate.duration}],
      fetchedAt:candidate.createdAt,approvedAt:new Date().toISOString(),
      approvedBy:reviewer.trim(),sha256:candidate.sha256,
      textSha256:sha(Buffer.from(approvedText,"utf8")),
    };
    // Keep old/source recordings intact; only the approved pointer changes.
    await atomicJson(indexFile,{...current,[key]:entry});
    delete pending[key];
    await atomicJson(file,pending);
    return entry;
  });
};

/** Shared, fail-closed verification for both full video renders and special previews.
 * A manual clip is usable only while both audio bytes and the reviewed ayah
 * text match the exact hashes at the moment of human approval.
 */
export const verifiedOwnRecitations = async (scriptPath: string): Promise<RecitationIndex> => {
  const dir = recitationsDirFor(scriptPath);
  const index = await readJson<RecitationIndex>(path.join(dir, "index.json"), {});
  const parsed = parseScript(await readFile(scriptPath, "utf8"), scriptPath);
  const authored = quranFromScript(parsed);
  const texts = authored.texts;
  const ready: RecitationIndex = {};
  for (const [key, rec] of Object.entries(index)) {
    if (!rec || rec.provider !== "manual" || !rec.approvedAt || !rec.approvedBy ||
        !rec.reciter?.trim() || !rec.rightsEvidence?.trim() ||
        authored.problems.some((p) => p.key === key) ||
        !rec.sha256 || !rec.textSha256 || rec.parts?.length !== 1) continue;
    const part = rec.parts[0]!;
    if (!validName(part.file) || !Number.isFinite(part.duration) || part.duration <= 0 ||
        !texts[key] || sha(Buffer.from(texts[key], "utf8")) !== rec.textSha256) continue;
    try {
      const data = await readFile(path.join(dir, part.file));
      if (sha(data) === rec.sha256 && (await audioDuration(path.join(dir, part.file))))
        ready[key] = rec;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
  return ready;
};
