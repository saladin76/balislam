import path from "node:path";
import { BASMALA_KEY, hasBasmala } from "../voice/basmala";
import { resolveScriptPath } from "../script/episodes";
import { readPlanFile } from "../plan/io";
import { loadStoryboard, storyboardStatus } from "../plan/storyboard";
import { loadVoiceIndex, voiceDirFor } from "../voice/generate";
import { verifiedOwnRecitations } from "../quran/manualAudio";
import { createSceneFirstProduction } from "./sceneProduction";
import { loadChannel } from "../channel";
import { versesAreCitations } from "../quran/citation";
import { NO_BLOCKS } from "./afterPreparation";
import { remoteEngineTokens } from "./remoteChanges";
import { type CurrentInput, sha, fileGeneration, optionalFileGeneration, safeSceneId } from "./sceneLedgerStore";

/** The episode's current inputs as the ledger fingerprints them (script, boards, voice, recitations), read from disk. */
export const sourceNow = async (episode: string): Promise<CurrentInput> => {
  const scriptPath = await resolveScriptPath(episode);
  const plan = await readPlanFile(scriptPath);
  if (!plan || !Array.isArray(plan.chapters)) throw Error("Prepare and save a storyboard plan first.");
  const scenes = plan.chapters.flatMap(chapter => chapter.scenes);
  if (!scenes.length || scenes.some(scene => !safeSceneId(scene.id)))
    throw Error("Every scene needs a stable, safe, unique identifier.");
  const scriptSha256 = await fileGeneration(scriptPath);
  // A real storyboard approval must cover every current scene; a mere JSON
  // file on disk, including an old/stale one, never authorizes production.
  const boardRecord = await loadStoryboard(scriptPath);
  const boardStatus = storyboardStatus(plan, boardRecord);
  const boardSha256 = sha(JSON.stringify([
    await optionalFileGeneration(path.join(path.dirname(scriptPath), "storyboard.json")),
  ]));
  const voice = await loadVoiceIndex(episode);
  const manual = await verifiedOwnRecitations(scriptPath);
  // D68: in a channel whose verses are written citations, a verse card never waits for a recitation.
  const citations = versesAreCitations((() => { try { return loadChannel(path.basename(path.dirname(path.dirname(path.dirname(scriptPath))))); } catch { return null; } })());
  const ready: Record<string, boolean> = {};
  const voiceReadyBy: Record<string, boolean> = {};
  const recitationPending: Record<string, boolean> = {};
  const refs = [];
  const textChanged: Record<string, boolean> = {};
  // D141: a renderer-code change a conversation named for a scene (`Studio-Scenes:` or its «أُصلحت» on the owner's note)
  // does not change the scene's own content, so it is carried as a permanent local marker; a scene without one keeps
  // exactly the fingerprint it had (src/studio/remoteChanges.ts).
  const engine = await remoteEngineTokens(path.dirname(scriptPath));
  for (const chapter of plan.chapters) for (const scene of chapter.scenes) {
    const narration = scene.narration?.trim() ?? "";
    const clip = voice[scene.id];
    textChanged[scene.id] = Boolean(narration && clip && clip.text !== narration);
    let voiceFingerprint = "no-narration";
    let voiceReady = narration.length === 0;
    if (narration) {
      voiceReady = Boolean(clip && clip.text === narration);
      const audioFile = clip && path.basename(clip.file) === clip.file &&
        !clip.file.startsWith(".") ? await optionalFileGeneration(
          path.join(voiceDirFor(scriptPath), clip.file)) : "missing";
      voiceReady = voiceReady && audioFile !== "missing";
      voiceFingerprint = clip
        ? sha(JSON.stringify([clip.text, clip.hash, clip.duration, audioFile]))
        : "missing-narration";
    }
    // The basmala is treated like a verse (owner decision 10 Nov): a scene holding it waits for the owner's
    // approved recording exactly as a verse card waits for its recitation (D35: conditional approval only).
    const basmala = scene.template !== "verse-card" && hasBasmala(narration);
    const rec = scene.template === "verse-card" && scene.ayahKey && !citations
      ? manual[scene.ayahKey] : basmala ? manual[BASMALA_KEY] : undefined;
    const recOk = Boolean(rec && rec.provider === "manual" && rec.sha256 && rec.approvedBy && rec.rightsEvidence);
    const verseReady = (scene.template !== "verse-card" && !basmala) || (scene.template === "verse-card" && citations) ||
      (recOk && (!basmala || (clip?.basmala?.pending === false && clip.basmala.sha256 === rec!.sha256)));
    ready[scene.id] = voiceReady && verseReady;
    voiceReadyBy[scene.id] = voiceReady;
    recitationPending[scene.id] = !verseReady;
    // Scoped invalidation: a scene's inputs are its own content, its own approved board, its own
    // narration clip and recitation. Editing another scene, or the script elsewhere, never re-opens it.
    refs.push({
      id: scene.id,
      sourceSha256: sha(JSON.stringify(["scene-inputs-v2", chapter.title, scene, boardRecord.scenes[scene.id] ?? null,
        voiceFingerprint, rec?.sha256 ?? "no-recitation",
        rec?.approvedAt ?? null, rec?.rightsEvidence ?? null,
        ...(engine[scene.id]?.length ? [["remote-engine", ...engine[scene.id]!]] : [])])),
    });
  }
  return {
    scriptPath, ready, voiceReady: voiceReadyBy, recitationPending, planReady: boardStatus.ok && Boolean(boardStatus.audit?.note?.trim()),
    boardsChanged: [...boardStatus.changed, ...boardStatus.fresh],
    boardState: boardStatus.scenes, textChanged, boardsReviewed: Boolean(boardStatus.audit?.note?.trim()),
    blocks: NO_BLOCKS,
    initial: createSceneFirstProduction({
      channel: path.basename(path.dirname(path.dirname(path.dirname(scriptPath)))),
      episode: path.basename(path.dirname(scriptPath)),
      scriptSha256, storyboardSha256: boardSha256, scenes: refs,
    }),
  };
};
