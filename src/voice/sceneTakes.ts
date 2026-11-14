/**
 * KI-066 (owner, 14 Nov): «أعدت توليد الجملة… ثم ضغطت «أنتج هذا المشهد» ولكن لم يطبق الصوت على الفيديو».
 * The scene video is rendered from the scene's sound (voice/index.json), and that sound is composed from its sentences
 * only once EVERY sentence has a current take (composeSentenceScene). A sentence regenerated while another one has no
 * current take stayed outside the scene's sound, and «أنتج هذا المشهد» rendered the old sound again without a word.
 *
 * Read only here (nothing generated, nothing deleted): which sentence takes are not in the scene's sound, and which
 * sentences still lack a current take; and, for the render route, composing the sound again when it can be.
 */
import path from "node:path";
import { existsSync, statSync } from "node:fs";
import { resolveScriptPath } from "../script/episodes";
import { readJson } from "../plan/io";
import { voiceDirFor, type VoiceClip, type VoiceIndex } from "./generate";
import { reconcileScene, type Sentence } from "./sentences";
import { allScenes, isNarrated, loadCtx, saveDoc, sceneSentences, sentencesFileFor, voiceOf, fresh, type Ctx } from "./sentenceContext";
import { compositionHash, composeSentenceScene } from "./sentenceStitch";

export type SceneTakeNotice = {
  /** sentences (1-based in the scene) whose current take is not in the scene's sound */
  outside: number[];
  /** sentences with no current take: the sound is composed again only once they have one */
  missing: number[];
  /** when the scene's sound file was written (ms), to compare with its video */
  soundAt: number | null;
};

const isCurrent = (ctx: Ctx, scene: Parameters<typeof voiceOf>[1], list: Sentence[], s: Sentence) =>
  s.kind === "basmala" || (s.kind === "narration" && Boolean(s.audio) && s.audio!.fingerprint === voiceOf(ctx, scene, list, s).fingerprint);

/** Which sentences of `list` the scene's sound `clip` holds as they are now. */
export const heldBy = (clip: VoiceClip, list: Sentence[]): ((s: Sentence) => boolean) => {
  const takes = clip.sentences?.takes;
  if (takes) return (s) => Boolean(s.audio) && takes[s.id] === s.audio!.file;
  if (clip.sentences) {
    // Composed before 14 Nov (no take list): the same composition hash means the same takes.
    if (list.some((s) => s.kind === "basmala")) return () => true;
    const same = list.every((s) => s.audio) &&
      compositionHash(list.map((s) => [s.id, s.audio!.file, s.audio!.fingerprint, s.pauseAfterMs]), clip.timing?.pre ?? 0) === clip.sentences.hash;
    return (s) => same || s.audio?.origin === "scene";
  }
  // The scene's sound as one file: only a cut of that file is in it.
  return (s) => s.audio?.origin === "scene";
};

/** Per narrated scene with a sound for its current text: the takes outside it and the sentences still to generate. */
export const sceneTakeNotices = async (episode: string): Promise<Record<string, SceneTakeNotice>> => {
  const ctx = await loadCtx(episode);
  const vdir = voiceDirFor(ctx.scriptPath);
  const index = (await readJson<VoiceIndex>(path.join(vdir, "index.json"))) ?? {};
  const out: Record<string, SceneTakeNotice> = {};
  for (const { scene } of allScenes(ctx.plan)) {
    if (!isNarrated(scene) || !ctx.doc.scenes[scene.id]) continue;
    const clip = index[scene.id];
    if (!clip || clip.text !== scene.narration.trim()) continue;
    const { list } = sceneSentences(ctx, scene);
    const held = heldBy(clip, list);
    const outside: number[] = [], missing: number[] = [];
    list.forEach((s, k) => {
      if (s.kind !== "narration") return;
      if (s.audio && !held(s)) outside.push(k + 1);
      if (!isCurrent(ctx, scene, list, s)) missing.push(k + 1);
    });
    const file = path.join(vdir, clip.file);
    out[scene.id] = { outside, missing, soundAt: path.basename(clip.file) === clip.file && existsSync(file) ? statSync(file).mtimeMs : null };
  }
  return out;
};

const ar = (n: number) => n.toLocaleString("ar-EG");
const list = (ns: number[]) => (ns.length === 1 ? `الجملة ${ar(ns[0]!)}` : `الجمل ${ns.map(ar).join("، ")}`);

/** The owner's line when «أنتج هذا المشهد» cannot carry the new take yet (sentences without a current take). */
export const newerTakeBlockedMessage = (n: Pick<SceneTakeNotice, "outside" | "missing">) =>
  `لم يُنتج المشهد: التسجيل الجديد (${list(n.outside)}) لم يدخل صوت المشهد بعد، لأن ${list(n.missing)} بلا تسجيل حالي. ` +
  `ولّدها من «الجمل»، ثم اضغط «أنتج هذا المشهد». لم يتغيّر الفيديو.`;

/**
 * Before «أنتج هذا المشهد»: compose the scene's sound again from its sentences when every one has a current take and
 * the sound does not hold them. No voice request, no take deleted (an earlier composed file is rebuilt from its takes).
 * True when the sound changed (the scene's inputs, so its fingerprint, changed with it).
 */
export const composeSceneForRender = async (episode: string, sceneId: string): Promise<boolean> => {
  const { serialized } = await import("../studio/sceneService");
  const scriptPath = await resolveScriptPath(episode);
  let changed = false;
  await serialized(sentencesFileFor(scriptPath), async () => {
    const ctx = await loadCtx(episode);
    const hit = allScenes(ctx.plan).find((x) => x.scene.id === sceneId);
    const rec = ctx.doc.scenes[sceneId];
    if (!hit || !rec || !isNarrated(hit.scene)) return;
    rec.sentences = reconcileScene(rec.sentences, sceneId, hit.scene.narration);
    if (!fresh(ctx, hit.scene, rec.sentences)) return;
    const before = (await readJson<VoiceIndex>(path.join(voiceDirFor(scriptPath), "index.json")))?.[sceneId]?.file;
    const r = await composeSentenceScene(ctx, hit.scene, rec.sentences);
    changed = r.composed && r.file !== before;
    await saveDoc(scriptPath, ctx.doc);
  });
  return changed;
};
