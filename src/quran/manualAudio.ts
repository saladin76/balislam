/** Rights-reviewed local Quran recording workflow. No external provider or TTS.
 * The uploader need not be the script author or the reciter; the original audio is provided explicitly; ffmpeg applies gentle leveling only (no pitch
 * shift, time stretch, speech synthesis or cuts). Pending clips never render.
 */
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { lstat, open, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { resolveScriptPath } from "../script/episodes";
import { parseScript } from "../script/parse";
import { quranFromScript } from "./scriptText";
import { recitationsDirFor, type RecitationIndex } from "./sync";

import { decodedAudioDuration, isOwnedRegularAudio } from "../voice/audioIntegrity";

const ffmpeg = promisify(execFile);
export type OwnAudioCandidate = {
  file: string; originalFile: string; originalName: string; duration: number; sha256: string; originalSha256: string;
  textSha256: string; createdAt: string;
};
export type OwnAudioReview = Record<string, OwnAudioCandidate>;
export const ownAudioReviewFile = (scriptPath: string) => path.join(recitationsDirFor(scriptPath), "review.json");
const validName = (f: string) => /^manual-\d+-\d+(?:-\d+)?-[a-f0-9]{12}\.mp3$/.test(f);
const validOriginal = (f: string) =>
  /^originals\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(?:wav|mp3|m4a|aac|ogg|flac)$/.test(f);
const durationClose = (expected: number, actual: number) =>
  Number.isFinite(expected) && expected > 0 && Math.abs(actual - expected) <= Math.max(0.15, expected * 0.03);
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
export const pendingRecitationMatchesText = (candidate: { textSha256?: string } | null | undefined,
  text: string): boolean =>
  Boolean(candidate && typeof candidate.textSha256 === "string" &&
    /^[a-f0-9]{64}$/.test(candidate.textSha256) &&
    candidate.textSha256 === sha(Buffer.from(text, "utf8")));
const readJson = async <T>(file: string, fallback: T): Promise<T> => {
  try {
    const info = await lstat(file);
    if (!info.isFile() || info.isSymbolicLink())
      throw Error("ملف مراجعة القرآن ليس ملفًا محليًا عاديًا.");
    const value: unknown = JSON.parse(await readFile(file, "utf8"));
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
  const state = await lstat(dir);
  if (!state.isDirectory() || state.isSymbolicLink())
    throw Error("مجلد تسجيلات الحلقة ليس مجلدًا محليًا آمنًا.");
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
  const authoredText = await requested(episode, key);
  if (!/^\d{1,3}:\d{1,3}(?:-\d{1,3})?$/.test(key)) throw Error("مرجع التلاوة غير صالح.");
  if (typeof filename !== "string" || filename.length > 255)
    throw Error("اسم الملف الأصلي غير صالح.");
  const originalName = filename.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";
  if (!originalName || originalName === "." || originalName === "..")
    throw Error("اسم الملف الأصلي غير صالح.");
  const ext = path.extname(originalName).toLowerCase();
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
    const rootInfo = await lstat(dir);
    const originalsInfo = await lstat(originalDir);
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink() ||
        !originalsInfo.isDirectory() || originalsInfo.isSymbolicLink())
      throw Error("مجلد التسجيلات الأصلي مرتبط رمزيًا خارج مساحة الحلقة.");
    const originalFile = path.join("originals", nonce + ext);
    const input = path.join(dir, originalFile);
    const temp = path.join(dir, "." + name + ".tmp.mp3");
    const output = path.join(dir, name);
    let moved = false;
    try {
      await writeFile(input, source, { flag:"wx", mode:0o600 });
      const inputDuration = await decodedAudioDuration(input, { maxSeconds: 600 });
      if (!inputDuration || inputDuration < 0.3 || inputDuration > 600)
        throw Error("مدة التلاوة الأصلية غير صالحة أو تزيد على عشر دقائق؛ لن نقتطع منها شيئًا.");
      await ffmpeg("ffmpeg", [
        "-nostdin","-hide_banner","-loglevel","error","-y",
        "-i",input,"-vn",
        "-af","highpass=f=70,lowpass=f=14000,loudnorm=I=-18:TP=-2:LRA=11",
        "-ar","48000","-ac","1","-c:a","libmp3lame","-b:a","192k",
        temp,
      ], { timeout:120000, maxBuffer:1024*1024 });
      const duration = await decodedAudioDuration(temp, { mp3Only: true, maxSeconds: 600 });
      if (!duration || duration < 0.3 || duration > 600)
        throw Error("تعذّر قراءة مدة تسجيل التلاوة بعد التحسين.");
      const bytes = await readFile(temp);
      if (!bytes.length) throw Error("الناتج الصوتي فارغ.");
      await rename(temp, output);
      moved = true;
      // Do not queue a recording against a script verse that changed while
      // FFmpeg was processing the original audio.
      if ((await requested(episode, key)) !== authoredText)
        throw Error("تغيّر نص الآية أثناء رفع التسجيل؛ أعد الاستماع والرفع للنص الجديد.");
      const record = {
        file:name, originalFile, originalName, duration, sha256:sha(bytes), originalSha256:sha(source),
        textSha256:sha(Buffer.from(authoredText, "utf8")),
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
/** Separate human-reviewed audio from production eligibility.
 * The render team's collector has not integrated provider=manual yet.
 * Never expose a clip as render-approved merely because the review index says approved.
 */
export const ownAudioStatusForScript = async (scriptPath: string) => {
  const dir = recitationsDirFor(scriptPath);
  const pending = await readJson<OwnAudioReview>(ownAudioReviewFile(scriptPath), {});
  const index = await readJson<RecitationIndex>(path.join(dir, "index.json"), {});
  const reviewed = await verifiedOwnRecitations(scriptPath);
  const stale = Object.keys(index).filter((key) => index[key]?.provider === "manual" && !reviewed[key]);
  return {
    pending,
    reviewed, // Recorded human decision, hashes and audio decode rechecked right now.
    stale, // Previously approved but changed, missing or corrupt: needs explicit rereview.
    approved: {} as RecitationIndex, // No manual clip may claim production readiness yet.
    renderIntegrated: false as const,
  };
};

export const ownAudioStatus = async (episode: string) =>
  ownAudioStatusForScript(await resolveScriptPath(episode));
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
    if (!candidate || !validName(candidate.file) || !validOriginal(candidate.originalFile) ||
        typeof candidate.originalName !== "string" || !candidate.originalName.trim())
      throw Error("لا توجد نسخة تلاوة أصلية وصالحة تنتظر المراجعة.");
    if (!pendingRecitationMatchesText(candidate, approvedText))
      throw Error("تغيّر نص الآية منذ رفع التسجيل أو فُقدت بصمته؛ ارفع تلاوة جديدة للمراجعة.");
    if (!await isOwnedRegularAudio(dir, candidate.file) ||
        !await isOwnedRegularAudio(dir, candidate.originalFile))
      throw Error("لا يُقبل اعتماد تسجيل بملف مرتبط رمزيًا خارج المجلد.");
    const bytes=await readFile(path.join(dir,candidate.file));
    const original=await readFile(path.join(dir,candidate.originalFile));
    const decoded = await decodedAudioDuration(path.join(dir,candidate.file), { mp3Only:true, maxSeconds:600 });
    if (sha(bytes)!==candidate.sha256 || sha(original)!==candidate.originalSha256 ||
        !(await decodedAudioDuration(path.join(dir,candidate.originalFile), { maxSeconds:600 })) ||
        !decoded || !durationClose(candidate.duration,decoded))
      throw Error("التسجيل الأصلي أو المعالج تالف أو تغيّر؛ أوقف الاعتماد.");
    if ((await requested(episode,key)) !== approvedText)
      throw Error("تغيّر نص الآية أثناء مراجعة التسجيل؛ أوقف الاعتماد.");
    const indexFile=path.join(dir,"index.json");
    const current=await readJson<RecitationIndex>(indexFile,{});
    const entry:RecitationIndex[string]={
      provider:"manual",reciter:attribution.reciter.trim(),rightsEvidence:attribution.rightsEvidence.trim(),
      parts:[{file:candidate.file,duration:candidate.duration}],
      fetchedAt:candidate.createdAt,approvedAt:new Date().toISOString(),
      approvedBy:reviewer.trim(),reviewNote:note.trim(),sha256:candidate.sha256,
      originalFile:candidate.originalFile, originalName:candidate.originalName,
      originalSha256:candidate.originalSha256,
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
    if (!rec || rec.provider !== "manual" || !rec.approvedAt ||
        !Number.isFinite(Date.parse(rec.approvedAt)) || Date.parse(rec.approvedAt) > Date.now() + 60000 ||
        typeof rec.approvedBy !== "string" || rec.approvedBy.trim().length < 2 ||
        typeof rec.reviewNote !== "string" || rec.reviewNote.trim().length < 12 ||
        typeof rec.originalName !== "string" || !rec.originalName.trim() ||
        !rec.reciter?.trim() || !rec.rightsEvidence?.trim() ||
        authored.problems.some((p) => p.key === key) ||
        !rec.sha256 || !rec.textSha256 || rec.parts?.length !== 1) continue;
    const part = rec.parts[0]!;
    if (!validName(part.file) || !validOriginal(rec.originalFile ?? "") || !rec.originalSha256 ||
        !Number.isFinite(part.duration) || part.duration <= 0 ||
        !texts[key] || sha(Buffer.from(texts[key], "utf8")) !== rec.textSha256) continue;
    try {
      if (!await isOwnedRegularAudio(dir, part.file) ||
          !await isOwnedRegularAudio(dir, rec.originalFile!)) continue;
      const data = await readFile(path.join(dir, part.file));
      const original = await readFile(path.join(dir, rec.originalFile!));
      if (sha(data) === rec.sha256 && sha(original) === rec.originalSha256 &&
          await decodedAudioDuration(path.join(dir, rec.originalFile!), { maxSeconds:600 })) {
        const decoded = await decodedAudioDuration(path.join(dir, part.file), { mp3Only:true, maxSeconds:600 });
        if (decoded && durationClose(part.duration, decoded)) ready[key] = rec;
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
  return ready;
};
