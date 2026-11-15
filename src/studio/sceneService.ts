/**
 * Single-operator scene-by-scene AV approval service.
 * All file paths, digests and actor identity are derived by the local server.
 * No legacy six-stage decision is automatically promoted to a scene approval.
 *
 * This is an additional fail-closed production barrier; the remaining renderer
 * and publisher adapters must call requireSceneMasterReady before release.
 *
 * The public module of the scene ledger (every caller imports from here). Work ٨ split it by responsibility:
 *   sceneLedgerStore.ts  the signed ledger file, its lock, file paths and digests (file operations);
 *   sceneInputs.ts       the episode's current inputs, read from disk;
 *   sceneLedgerState.ts  reconciliation, «تحديث بعد التجهيز» and the read model, under the lock;
 *   sceneGates.ts        the owner check and every gate (render, voice, assembly, Master, publish);
 *   sceneDecisions.ts    the owner's decisions and their checks, in order.
 * This file keeps the two read models of step ٢ and the home list.
 */
import path from "node:path";
import { stat } from "node:fs/promises";
import { correctionInboxView } from "./notesInbox";
import { optionalSha, sceneFile, assemblyFile, masterFile } from "./sceneLedgerStore";
import { view, withState, draftOf, awaitingChange } from "./sceneLedgerState";
import { readRemoteChanges, remoteChangeFor } from "./remoteChanges";

export { SCENE_ACTIONS, lockOwnerIsDead, LEDGER_LOCK_WAIT_MS, serialized } from "./sceneLedgerStore";
export type { SceneOwnerCommand } from "./sceneLedgerStore";
export { reconcileSceneLedger } from "./sceneLedgerState";
export type { SceneDraft } from "./sceneLedgerState";
export {
  OWNER_AUTH_ERROR, isOwnerAuthError, assertSceneOwner, assertSceneNotAwaitingChange, assertSceneRenderAllowed,
  assertCurrentSceneRenderAllowed, recordSceneRenderEvidence, approvedSceneCutsForAssembly, currentSceneCutsForPreFinal,
  requireScenesReadyForMaster, requireSceneMasterReady, requirePublishAllowed, publishHandoffFacts, requireScriptApproved,
  requireScriptAndStoryboardApproved, requireScenesProducible, requireSceneProductionReady, NO_MASTER_MESSAGE, MASTER_NOT_APPROVED_MESSAGE,
} from "./sceneGates";
export type { SceneRenderMode, PublishHandoffFacts } from "./sceneGates";
export { decideSceneProduction, NO_ASSEMBLY_MESSAGE } from "./sceneDecisions";

/**
 * ملخص خفيف لحالة الحلقة في الخطوات الأربع (للقائمة الرئيسية): بلا حساب بصمات الملفات الكبيرة.
 * `steps`: التجهيز (السكريبت والستوري بورد معًا) ← المشاهد ← النسخة النهائية ← إذن النشر.
 */
export const summarizeSceneProduction = (episode: string) =>
  withState(episode, async (doc, current) => {
    const v = view(doc, current);
    const preparation = v.script.approved && v.storyboard.approved && v.boards.current;
    return { steps: [preparation, v.progress.canAssemble, v.progress.masterApproved, v.progress.publishAllowed] as [boolean, boolean, boolean, boolean],
      preparation, script: v.script.approved, storyboard: v.storyboard.approved,
      approvedScenes: v.progress.approvedScenes, totalScenes: v.progress.totalScenes,
      canAssemble: v.progress.canAssemble, assemblyApproved: v.progress.assemblyApproved,
      masterApproved: v.progress.masterApproved, publishAllowed: v.progress.publishAllowed,
      recitationPending: v.progress.recitationPending.length };
  });
export const inspectSceneProduction = (episode: string) =>
  withState(episode, async (doc, current) => {
    const v = view(doc, current);
    const candidates = Object.fromEntries(await Promise.all(doc.state.scenes.map(async scene =>
      [scene.id, await optionalSha(sceneFile(current.scriptPath, scene.id))] as const)));
    // D141: what a conversation changed on this machine's scenes since their video was made (local, never pushed).
    const remote = await readRemoteChanges(path.dirname(current.scriptPath));
    const scenes = await Promise.all(v.scenes.map(async s => {
      // The owner's latest correction of this scene (shown until the scene is approved).
      const fix = [...doc.history].reverse().find(h => h.sceneId === s.id && (h.action === "correct-scene" || h.action === "approve-scene"));
      const correction = fix?.action === "correct-scene" && s.status === "needs_revision"
        ? { note: fix.note ?? "", at: fix.at, sha256: fix.resultSha256,
            // Notes inbox (docs/studio/notes-inbox.md): sent to the notes branch or still queued, and Claude's answer.
            inbox: await correctionInboxView(path.dirname(current.scriptPath), fix.seq) } : undefined;
      // Once submitted or approved the preview is no longer a draft; a cut the owner sent back for a fix
      // is never offered again as a "ready" draft: the scene must be rendered again.
      const draft = s.status === "approved" || s.status === "in_review" ? "none" as const
        : correction && correction.sha256 && correction.sha256 === candidates[s.id] ? "stale" as const
        : await draftOf(doc, current.scriptPath, s.id, s.sourceSha256, candidates[s.id] ?? null);
      const waiting = await awaitingChange(doc, current.scriptPath, s);
      const videoAt = candidates[s.id] ? (await stat(sceneFile(current.scriptPath, s.id)).catch(() => null))?.mtimeMs ?? null : null;
      const remoteChange = remoteChangeFor(remote, s.id, videoAt);
      return { ...s, draft, ...(waiting ? { awaitingChange: true } : {}),
        ...(remoteChange ? { remoteChange: { at: remoteChange.at, what: remoteChange.what, subjects: remoteChange.subjects,
          ...(remoteChange.answer ? { answer: remoteChange.answer } : {}) } } : {}), ...(correction ? { correction: { note: correction.note, at: correction.at,
        ...(correction.inbox ? { inbox: correction.inbox } : {}) } } : {}) };
    }));
    return {
      ...v, scenes,
      /** «جاهز ١٢ من ٣١»: approved, submitted for review, or with a current draft ready to watch. */
      prepared: {
        ready: scenes.filter(s => s.approved || (s.status === "in_review" && s.previewSha256) || s.draft === "ready").length,
        total: scenes.length,
      },
      candidates: {
        scenes: candidates,
        assemblySha256: await optionalSha(assemblyFile(current.scriptPath)),
        masterSha256: await optionalSha(masterFile(current.scriptPath)),
      },
      /** Episode tone map (دفاتر الزمن): «النبرة غير مناسبة» updates it for the scene. null elsewhere. */
      toneMap: await (await import("../voice/toneMapOverride")).toneMapSummary(current.scriptPath),
    };
  });
