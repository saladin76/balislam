import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { decodedAudioDuration, isOwnedRegularAudio } from "./audioIntegrity";
import { isTone } from "./tones";
import type { Plan, PlanScene } from "../plan/types";
import type { EpisodeMedia } from "../plan/media";
import type { VoiceClip } from "./generate";

export type VoiceReviewRecord = { version: 1; scenes: Record<string, {
  fingerprint: string; reviewer: string; note: string; at: string
}>; episode?: { fingerprint: string; reviewer: string; note: string; at: string } };
export type VoiceReviewItem = {
  id: string; state: "needs_tone" | "missing_audio" | "pending" | "changed" | "approved";
  fingerprint?: string
};
const hasHumanEvidence = (item: { reviewer?: string; note?: string; at?: string } | undefined, minNote: number) =>
  Boolean(item && typeof item.reviewer === "string" && item.reviewer.trim().length >= 2 &&
    typeof item.note === "string" && item.note.trim().length >= minNote &&
    typeof item.at === "string" && Number.isFinite(Date.parse(item.at)) &&
    Date.parse(item.at) <= Date.now() + 60000);
export const voiceReviewFile = (scriptPath: string) => path.join(path.dirname(scriptPath), "voice-review.json");
export const loadVoiceReview = async (scriptPath: string): Promise<VoiceReviewRecord> => {
  try {
    const doc = JSON.parse(await readFile(voiceReviewFile(scriptPath), "utf8")) as VoiceReviewRecord;
    return { version: 1, scenes: doc?.version === 1 && doc.scenes && typeof doc.scenes === "object" ? doc.scenes : {},
      ...(doc?.version === 1 && doc.episode && typeof doc.episode.fingerprint === "string" ? { episode: doc.episode } : {}),
    };
  } catch { return { version: 1, scenes: {} }; }
};

/** An approval is tied to the actual MP3 bytes, narration, tone and voice settings. */
export const voiceFingerprint = async (scene: PlanScene, clip: VoiceClip | undefined, scriptPath: string): Promise<string | null> => {
  if (!isTone(scene.tone) || !clip || clip.text !== scene.narration.trim()) return null;
  if (!Number.isFinite(clip.duration) || clip.duration <= 0) return null;
  if (!Array.isArray(clip.words) || clip.words.some((word) =>
    typeof word?.word !== "string" || !word.word.trim() ||
    !Number.isFinite(word.start) || !Number.isFinite(word.end) ||
    word.start < 0 || word.end < word.start || word.end > clip.duration + 0.25)) return null;
  if (typeof clip.file !== "string" || !/^[a-z0-9][a-z0-9_.-]{0,150}\.mp3$/i.test(clip.file)) return null;
  const audioRoot = path.join(path.dirname(scriptPath), "voice");
  const audioPath = path.join(audioRoot, clip.file);
  let bytes: Buffer;
  try {
    if (!await isOwnedRegularAudio(audioRoot, clip.file)) return null;
    bytes = await readFile(audioPath);
  } catch { return null; }
  if (!bytes.length) return null;
  // Probe every decoded frame, not merely a valid MP3 header or duration tag.
  // Any unreadable part invalidates the same fingerprint used by UI and gate.
  const actualDuration = await decodedAudioDuration(audioPath, { mp3Only: true });
  if (!actualDuration || Math.abs(actualDuration - clip.duration) > Math.max(0.2, clip.duration * 0.04))
    return null;
  const digest = createHash("sha256").update(bytes).digest("hex");
  return createHash("sha256").update(JSON.stringify({
    version: 1, sceneId: scene.id, text: scene.narration.trim(), tone: scene.tone,
    speaker: scene.voice ?? "", cacheHash: clip.hash ?? "", audioSha256: digest,
    duration: clip.duration, words: clip.words,
  })).digest("hex");
};

export const voiceReviewItems = async (
  scriptPath: string, plan: Plan, voice: EpisodeMedia["voice"], existingRecord?: VoiceReviewRecord,
): Promise<VoiceReviewItem[]> => {
  const record = existingRecord ?? await loadVoiceReview(scriptPath);
  const scenes = plan.chapters.flatMap((c) => c.scenes).filter((s) => s.narration.trim());
  return Promise.all(scenes.map(async (scene) => {
    if (!isTone(scene.tone)) return { id: scene.id, state: "needs_tone" as const };
    const fingerprint = await voiceFingerprint(scene, voice[scene.id], scriptPath);
    if (!fingerprint) return { id: scene.id, state: "missing_audio" as const };
    const old = record.scenes[scene.id];
    return { id: scene.id, fingerprint, state: !old ? "pending" as const :
      old.fingerprint !== fingerprint ? "changed" as const :
      hasHumanEvidence(old, 12) ? "approved" as const : "pending" as const };
  }));
};

export const episodeVoiceFingerprint = (items: VoiceReviewItem[]): string | null => {
  if (!items.length || items.some((item) => item.state !== "approved" || !item.fingerprint)) return null;
  return createHash("sha256").update(JSON.stringify(items.map((item) => [item.id, item.fingerprint]))).digest("hex");
};

export const episodeVoiceApproved = async (scriptPath: string, plan: Plan, voice: EpisodeMedia["voice"]) => {
  const record = await loadVoiceReview(scriptPath);
  const items = await voiceReviewItems(scriptPath, plan, voice, record);
  const fingerprint = episodeVoiceFingerprint(items);
  return Boolean(fingerprint && record.episode?.fingerprint === fingerprint &&
    hasHumanEvidence(record.episode, 20));
};

/** The full narration approval is separate from the approval of each voice clip. */
export const approveVoiceEpisode = async (
  scriptPath: string, plan: Plan, voice: EpisodeMedia["voice"], reviewer: string, note: string,
  listenedInFull: boolean,
) => {
  if (listenedInFull !== true)
    throw new Error("يلزم التأكيد الصريح للاستماع الكامل بالترتيب الطبيعي قبل اعتماد الحلقة الصوتية.");
  if (!reviewer.trim() || note.trim().length < 20)
    throw new Error("اعتماد الحلقة الصوتية يتطلب اسم المراجع وملاحظة الاستماع الكامل.");
  const record = await loadVoiceReview(scriptPath);
  const items = await voiceReviewItems(scriptPath, plan, voice, record);
  const fingerprint = episodeVoiceFingerprint(items);
  if (!fingerprint) throw new Error("أكمل اعتماد جميع المقاطع الصوتية قبل الاستماع واعتماد الحلقة كاملة.");
  record.episode = { fingerprint, reviewer: reviewer.trim(), note: note.trim(), at: new Date().toISOString() };
  const target = voiceReviewFile(scriptPath);
  const temp = `${target}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, JSON.stringify(record, null, 2) + "\n", { flag: "wx", mode: 0o600 });
    await rename(temp, target);
  } finally { await rm(temp, { force: true }); }
  return record.episode;
};

export const assertVoiceApproved = async (scriptPath: string, plan: Plan, voice: EpisodeMedia["voice"]) => {
  const items = await voiceReviewItems(scriptPath, plan, voice);
  if (!items.length) throw new Error("لا توجد مقاطع تعليق صوتي يمكن الاستماع إليها واعتمادها؛ لا تبدأ الحركة النهائية.");
  const pending = items.filter((item) => item.state !== "approved");
  if (pending.length) throw new Error(
    "لا يُرندر Master قبل تحديد النبرة واعتماد الاستماع للصوت لكل مقطع: " +
    pending.slice(0, 10).map((item) => `${item.id} (${item.state})`).join("، ") +
    (pending.length > 10 ? "…" : "") + ". افتح مراجعة الصوت ولا تعتمد ملفًا لم تسمعه.",
  );
  const record = await loadVoiceReview(scriptPath);
  const digest = episodeVoiceFingerprint(items);
  if (!digest || record.episode?.fingerprint !== digest || !hasHumanEvidence(record.episode, 20))
    throw new Error("لا يُرندر Master قبل الاستماع إلى التعليق الصوتي كاملًا واعتماده للمونتاج.");
  return true;
};

/** Must be called only after an actual human listens to the clip. */
export const approveVoiceScene = async (
  scriptPath: string, plan: Plan, voice: EpisodeMedia["voice"],
  sceneId: string, reviewer: string, note: string, listened: boolean,
) => {
  if (listened !== true)
    throw new Error("يلزم التأكيد الصريح أنك استمعت إلى التسجيل كاملًا قبل اعتماد المقطع.");
  if (!reviewer.trim() || note.trim().length < 12)
    throw new Error("اذكر المراجع وملاحظة الاستماع الفعلية قبل اعتماد الصوت.");
  const scene = plan.chapters.flatMap((c) => c.scenes).find((s) => s.id === sceneId && s.narration.trim());
  if (!scene) throw new Error("المقطع المنطوق غير موجود في الخطة الحالية.");
  const fingerprint = await voiceFingerprint(scene, voice[sceneId], scriptPath);
  if (!fingerprint) throw new Error("لا يمكن اعتماد مقطع بلا نبرة صريحة وصوت موجود مطابق.");
  const record = await loadVoiceReview(scriptPath);
  record.scenes[sceneId] = { fingerprint, reviewer: reviewer.trim(), note: note.trim(), at: new Date().toISOString() };
  const target = voiceReviewFile(scriptPath);
  const temp = `${target}.${process.pid}.${randomUUID()}.tmp`;
  try { await writeFile(temp, JSON.stringify(record, null, 2) + "\n", { flag: "wx", mode: 0o600 }); await rename(temp, target); }
  finally { await rm(temp, { force: true }); }
  return voiceReviewItems(scriptPath, plan, voice, record);
};
