import path from "node:path";
import { verifyVideoEvidence } from "./videoEvidence";
import { approveScript, approveStoryboard, approveSceneAv, approveFinalMaster, approveAssembly, grantPublish, submitSceneAvPreview, requestSceneCorrection, submitAssembly, sceneFirstProgress, approvedSceneInputsSha256, type SceneFirstProduction } from "./sceneProduction";
import { appendStudioNote } from "./notesInbox";
import { scheduleStudioNotesSync } from "./notesSync";
import { channelsDir } from "../channel";
import { SCENE_ACTIONS, type SceneOwnerCommand, hex64, sign, byteSha256, fileGeneration, safeSceneId, stateFileFor, saveLedger, sceneFile, assemblyFile, masterFile, exists } from "./sceneLedgerStore";
import { sourceNow } from "./sceneInputs";
import { view, withState } from "./sceneLedgerState";
import { assertSceneOwner, NO_MASTER_MESSAGE, MASTER_NOT_APPROVED_MESSAGE } from "./sceneGates";

/** The owner's decisions on the ledger («اعتمد» for script, storyboard, scene, assembly, Master, publish), each with its checks in order. */
/** No assembled file yet (step ٣ makes it after every scene is approved). */
export const NO_ASSEMBLY_MESSAGE = "لا توجد نسخة مجمعة بعد: تُدمج المشاهد في «٣ النسخة النهائية» بعد اعتمادها كلها.";
/**
 * The gate a decision waits for, by order only (no file hashed): assembly after every scene and recitation, its approval
 * after an assembly exists, the Master after the approved assembly, the publish permission after the approved Master.
 * Scenes have no order among themselves (D145). Throws the refusal; the full checks (bytes, epochs, proofs) follow as before.
 */
export const gateOrderRefusal = async (p: SceneFirstProduction, command: SceneOwnerCommand, scriptPath: string): Promise<void> => {
  const progress = sceneFirstProgress(p);
  if (command.action === "assemble") {
    approvedSceneInputsSha256(p);
    if (!await exists(assemblyFile(scriptPath))) throw Error(NO_ASSEMBLY_MESSAGE);
  } else if (command.action === "approve-assembly") {
    if (!p.assembly) throw Error("No assembled episode awaits review.");
    if (!await exists(assemblyFile(scriptPath))) throw Error(NO_ASSEMBLY_MESSAGE);
  } else if (command.action === "approve-master") {
    if (!progress.assemblyApproved) throw Error("Approve the assembled episode and its scene transitions before the Master.");
    if (!await exists(masterFile(scriptPath))) throw Error(NO_MASTER_MESSAGE);
  } else if (command.action === "grant-publish") {
    if (!await exists(masterFile(scriptPath))) throw Error(NO_MASTER_MESSAGE);
    if (!progress.masterApproved) throw Error(MASTER_NOT_APPROVED_MESSAGE);
  }
  // D145 (owner decision 15 Nov 2026): a scene is decided in any order; no scene waits for the one before it.
};

export const decideSceneProduction = async (episode: string,
  command: SceneOwnerCommand) => {
  assertSceneOwner();
  if (!command || !(SCENE_ACTIONS as readonly string[]).includes(command.action) ||
      !hex64(command.expectedSha256) ||
      (command.seamsChecked !== undefined && (!Array.isArray(command.seamsChecked) || command.seamsChecked.length > 2000 ||
        command.seamsChecked.some((x) => typeof x !== "string" || x.length > 160))) ||
      (command.note !== undefined && (typeof command.note !== "string" || command.note.length > 4000)) ||
      (command.tone !== undefined && (typeof command.tone !== "string" || command.tone.length > 32 ||
        command.action !== "correct-scene")))
    throw Error("Malformed scene review command.");
  let noteQueued = false;
  const view_ = await withState(episode, async (doc, current) => {
    const p = doc.state, at = new Date().toISOString();
    const by: "owner" = "owner";
    let next: SceneFirstProduction;
    let resultSha256 = command.expectedSha256;
    const previewEpochs = { ...doc.previewEpochs };
    let assemblyEpoch = doc.assemblyEpoch;
    let masterEpoch = doc.masterEpoch;
    let toneOverride: import("../voice/toneMapOverride").PreparedToneOverride | null = null;
    // QA 12 Nov (balislam 24, dafatir 8): the order of the gates is checked BEFORE any file is read, so a step taken
    // too early is refused with its own reason (in the owner's words), never with a raw ffprobe «No such file».
    await gateOrderRefusal(p, command, current.scriptPath);
    if (command.action === "approve-script") {
      if (p.script.sha256 !== command.expectedSha256) throw Error("Script changed before review.");
      next = approveScript(p, by, at, command.expectedSha256);
    } else if (command.action === "approve-storyboard") {
      if (!current.planReady)
        throw Error("Review and approve every current storyboard scene with a review note before starting AV production.");
      if (p.storyboard.sha256 !== command.expectedSha256) throw Error("Storyboard changed before review.");
      next = approveStoryboard(p, by, at, command.expectedSha256);
    } else if (command.action === "assemble") {
      const file = assemblyFile(current.scriptPath);
      await verifyVideoEvidence(file);
      resultSha256 = await byteSha256(file);
      if (resultSha256 !== command.expectedSha256) throw Error("The assembled video changed.");
      assemblyEpoch = await fileGeneration(file);
      masterEpoch = undefined;
      next = submitAssembly(p, resultSha256);
    } else if (command.action === "approve-assembly") {
      if (command.confirmedWatched !== true) throw Error("Watch the full assembled episode at 1× first.");
      const file = assemblyFile(current.scriptPath);
      await verifyVideoEvidence(file);
      resultSha256 = await byteSha256(file);
      if (resultSha256 !== command.expectedSha256) throw Error("The assembled video changed.");
      if (!assemblyEpoch || assemblyEpoch !== await fileGeneration(file))
        throw Error("Assembled episode changed after it was recorded; record it again.");
      masterEpoch = undefined;
      next = approveAssembly(p, { by, at, videoSha256: resultSha256, watchedFullEpisodeAt1x: true,
        seamsChecked: command.seamsChecked ?? [] });
    } else if (command.action === "grant-publish") {
      if (command.confirmedWatched !== true) throw Error("Confirm the publish decision explicitly.");
      const file = masterFile(current.scriptPath);
      resultSha256 = await byteSha256(file);
      if (resultSha256 !== command.expectedSha256) throw Error("The Master file changed.");
      if (!masterEpoch || masterEpoch !== await fileGeneration(file))
        throw Error("Master changed after the owner's final approval.");
      next = grantPublish(p, { by, at, masterSha256: resultSha256 });
    } else if (command.action === "approve-master") {
      if (command.confirmedWatched !== true) throw Error("Full-episode human 1× review is required.");
      const file = masterFile(current.scriptPath);
      await verifyVideoEvidence(file);
      resultSha256 = await byteSha256(file);
      if (resultSha256 !== command.expectedSha256) throw Error("The Master file changed.");
      if (!p.assembly || !assemblyEpoch ||
          assemblyEpoch !== await fileGeneration(assemblyFile(current.scriptPath)) ||
          p.assembly.videoSha256 !== await byteSha256(assemblyFile(current.scriptPath)))
        throw Error("Assembled episode changed before Master review.");
      masterEpoch = await fileGeneration(file);
      next = approveFinalMaster(p, {
        by, at, masterSha256: resultSha256,
        assembledVideoSha256: p.assembly?.videoSha256 ?? "",
        watchedFullEpisodeAt1x: true,
      });
    } else {
      const id = command.sceneId ?? "";
      const scene = p.scenes.find(s => s.id === id);
      if (!scene || !safeSceneId(id)) throw Error("Unknown scene.");
      if (command.action === "submit-scene") {
        // A verse card without its recitation may be submitted (silent placeholder draft); its approval
        // is then recorded as conditional and never unlocks assembly or Master.
        if (!current.voiceReady[id]) throw Error("The narration for this scene is missing.");
        if (scene.sourceSha256 !== command.expectedSha256) throw Error("Scene inputs changed.");
        const file = sceneFile(current.scriptPath, id);
        await verifyVideoEvidence(file);
        resultSha256 = await byteSha256(file);
        const proof = doc.previewInputs?.[id];
        const generation = await fileGeneration(file);
        if (!proof || proof.sourceSha256 !== scene.sourceSha256 ||
            proof.videoSha256 !== resultSha256 || proof.generation !== generation)
          throw Error("Preview lacks a current trusted render-to-source proof; rerender this scene.");
        previewEpochs[id] = generation;
        assemblyEpoch = undefined; masterEpoch = undefined;
        next = submitSceneAvPreview(p, id, scene.sourceSha256, resultSha256);
      } else if (command.action === "correct-scene") {
        if (scene.previewSha256 !== command.expectedSha256 || !command.note?.trim())
          throw Error("A current scene preview and a correction reason are required.");
        // Tone-map episode: the owner's tone becomes a new tone-map version for this scene only.
        // Fully validated here, written only after the correction itself is recorded.
        if (command.tone)
          toneOverride = await (await import("../voice/toneMapOverride")).prepareSceneToneOverride(current.scriptPath,
            { scene: id, tone: command.tone, note: command.note, at });
        delete previewEpochs[id];
        assemblyEpoch = undefined; masterEpoch = undefined;
        next = requestSceneCorrection(p, id);
      } else {
        if (command.confirmedWatched !== true)
          throw Error("Please review the complete scene with picture and sound.");
        const file = sceneFile(current.scriptPath, id);
        await verifyVideoEvidence(file);
        resultSha256 = await byteSha256(file);
        if (!previewEpochs[id] || previewEpochs[id] !== await fileGeneration(file))
          throw Error("Preview generation changed; submit it again.");
        if (scene.previewSha256 !== resultSha256 ||
            command.expectedSha256 !== resultSha256)
          throw Error("The preview changed since it was shown for review.");
        next = approveSceneAv(p, id, {
          by, at, previewSha256: resultSha256, watchedWithAudio: true,
          recitationPending: Boolean(current.recitationPending[id]),
        });
      }
    }
    // Source files cannot change while the decision is recorded. The Studio
    // integration must additionally share this lock with every content writer.
    const after = await sourceNow(episode);
    if (JSON.stringify(after.initial) !== JSON.stringify(current.initial))
      throw Error("Source files changed during review; reload before approving.");
    const history = [...doc.history, {
      seq: doc.history.length + 1, action: command.action,
      ...(command.sceneId ? { sceneId: command.sceneId } : {}),
      at, by, resultSha256,
      note: (command.action === "approve-scene" && command.sceneId && current.recitationPending[command.sceneId]
        ? "اعتماد مشروط بالتلاوة — " : "") + (command.note?.trim() || "تأكيد مراجعة المالك"),
    }];
    const saved = sign({ version: 1, state: next, revision: doc.revision + 1,
      history, previewEpochs, previewInputs: doc.previewInputs, assemblyEpoch, masterEpoch });
    await saveLedger(stateFileFor(current.scriptPath), saved);
    // Still under the ledger lock. The map is not a scene input (only the regenerated clip is), so this
    // write reopens nothing by itself; regenerating this scene's voice reopens this scene alone.
    if (toneOverride) await toneOverride.commit();
    // Notes inbox: only now — after the owner check and the recorded correction — the note is queued
    // for Claude (docs/studio/notes-inbox.md). A failure here never undoes or fails the correction itself.
    if (command.action === "correct-scene" && command.sceneId) {
      const scene = p.scenes.find(s => s.id === command.sceneId)!;
      try {
        await appendStudioNote(path.dirname(current.scriptPath), {
          channel: p.channel, episode: p.episode, sceneId: command.sceneId, raw: command.note ?? "",
          tone: command.tone ?? null, createdAt: at, sceneInputSha256: scene.sourceSha256,
          previewSha256: command.expectedSha256, ledgerSeq: history.length });
        noteQueued = true;
      } catch (error) {
        console.error("[studio] owner note not queued for the notes inbox:", (error as Error).message);
      }
    }
    return view(saved, current);
  });
  // Outside the ledger lock and never awaited: offline or auth failures keep the note queued locally.
  if (noteQueued) scheduleStudioNotesSync(channelsDir());
  return view_;
};
