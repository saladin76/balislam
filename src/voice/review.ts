import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import { isTone } from "./tones";
import type { Plan, PlanScene } from "../plan/types";
import type { EpisodeMedia } from "../plan/media";
import type { VoiceClip } from "./generate";

export type VoiceReviewRecord = { version: 1; scenes: Record<string, {
  fingerprint: string; reviewer: string; note: string; at: string
}> };
export type VoiceReviewItem = {
  id: string; state: "needs_tone" | "missing_audio" | "pending" | "changed" | "approved";
  fingerprint?: string
};
export const voiceReviewFile = (scriptPath: string) => path.join(path.dirname(scriptPath), "voice-review.json");
export const loadVoiceReview = async (scriptPath: string): Promise<VoiceReviewRecord> => {
  try {
    const doc = JSON.parse(await readFile(voiceReviewFile(scriptPath), "utf8")) as VoiceReviewRecord;
    return { version: 1, scenes: doc?.version === 1 && doc.scenes && typeof doc.scenes === "object" ? doc.scenes : {} };
  } catch { return { version: 1, scenes: {} }; }
};

/** An approval is tied to the actual MP3 bytes, narration, tone and voice settings. */
export const voiceFingerprint = async (scene: PlanScene, clip: VoiceClip | undefined, scriptPath: string): Promise<string | null> => {
  if (!isTone(scene.tone) || !clip || clip.text !== scene.narration.trim()) return null;
  if (typeof clip.file !== "string" || !/^[a-z0-9][a-z0-9_.-]{0,150}\.mp3$/i.test(clip.file)) return null;
  let bytes: Buffer;
  try { bytes = await readFile(path.join(path.dirname(scriptPath), "voice", clip.file)); }
  catch { return null; }
  if (!bytes.length) return null;
  const digest = createHash("sha256").update(bytes).digest("hex");
  return createHash("sha256").update(JSON.stringify({
    version: 1, sceneId: scene.id, text: scene.narration.trim(), tone: scene.tone,
    speaker: scene.voice ?? "", cacheHash: clip.hash ?? "", audioSha256: digest,
  })).digest("hex");
};

export const voiceReviewItems = async (
  scriptPath: string, plan: Plan, voice: EpisodeMedia["voice"], record = await loadVoiceReview(scriptPath),
): Promise<VoiceReviewItem[]> => {
  const scenes = plan.chapters.flatMap((c) => c.scenes).filter((s) => s.narration.trim());
  return Promise.all(scenes.map(async (scene) => {
    if (!isTone(scene.tone)) return { id: scene.id, state: "needs_tone" as const };
    const fingerprint = await voiceFingerprint(scene, voice[scene.id], scriptPath);
    if (!fingerprint) return { id: scene.id, state: "missing_audio" as const };
    const old = record.scenes[scene.id];
    return { id: scene.id, fingerprint, state: !old ? "pending" as const :
      old.fingerprint === fingerprint ? "approved" as const : "changed" as const };
  }));
};

export const assertVoiceApproved = async (scriptPath: string, plan: Plan, voice: EpisodeMedia["voice"]) => {
  const items = await voiceReviewItems(scriptPath, plan, voice);
  const pending = items.filter((item) => item.state !== "approved");
  if (pending.length) throw new Error(
    "لا يُرندر Master قبل تحديد النبرة واعتماد الاستماع للصوت لكل مقطع: " +
    pending.slice(0, 10).map((item) => `${item.id} (${item.state})`).join("، ") +
    (pending.length > 10 ? "…" : "") + ". افتح مراجعة الصوت ولا تعتمد ملفًا لم تسمعه.",
  );
  return true;
};

/** Must be called only after an actual human listens to the clip. */
export const approveVoiceScene = async (
  scriptPath: string, plan: Plan, voice: EpisodeMedia["voice"],
  sceneId: string, reviewer: string, note: string,
) => {
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
