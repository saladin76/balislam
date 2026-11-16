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
import { existsSync, statSync } from "node:fs";
import { correctionInboxView } from "./notesInbox";
import { optionalSha, sceneFile, assemblyFile, masterFile } from "./sceneLedgerStore";
import { view, withState, draftOf, awaitingChange } from "./sceneLedgerState";

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
export const inspectSceneProduction = async (episode: string) => withNewerTakes(episode, await inspectLedger(episode));

/**
 * KI-066: «فيه تسجيل جديد لم يدخل الفيديو» beside the scene's player, the same in the three channels. `produce`: the
 * new take is in the scene's sound (or can be composed into it) and «أنتج هذا المشهد» carries it; `blocked`: other
 * sentences have no current take yet (`missing`), so the sound cannot hold it and the video stays as it is.
 * Read only; a failure to read the sentences never hides the step (no line then).
 */
const withNewerTakes = async <T extends Awaited<ReturnType<typeof inspectLedger>>>(episode: string, read: T) => {
  let notices: Record<string, import("../voice/sceneTakes").SceneTakeNotice> = {};
  try { notices = await (await import("../voice/sceneTakes")).sceneTakeNotices(episode); } catch { /* no line */ }
  const scriptPath = read.scriptPath;
  const scenes = read.scenes.map((s) => {
    const n = notices[s.id];
    if (!n) return s;
    const video = read.candidates.scenes[s.id] ? sceneFile(scriptPath, s.id) : null;
    const videoAt = video && existsSync(video) ? statSync(video).mtimeMs : null;
    // The sound is newer than the cut on screen, and that cut is not the scene's current draft or submission.
    const videoOlder = Boolean(videoAt !== null && n.soundAt !== null && n.soundAt > videoAt && s.draft !== "ready" && s.status !== "in_review" && !s.approved);
    if (!n.outside.length && !videoOlder) return s;
    const blocked = n.outside.length > 0 && n.missing.length > 0;
    return { ...s, newerTake: { state: blocked ? "blocked" as const : "produce" as const, sentences: n.outside, missing: blocked ? n.missing : [] } };
  });
  const { scriptPath: _sp, ...rest } = read;
  return { ...rest, scenes };
};

const inspectLedger = (episode: string) =>
  withState(episode, async (doc, current) => {
    const v = view(doc, current);
    const candidates = Object.fromEntries(await Promise.all(doc.state.scenes.map(async scene =>
      [scene.id, await optionalSha(sceneFile(current.scriptPath, scene.id))] as const)));
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
      return { ...s, draft, ...(waiting ? { awaitingChange: true } : {}), ...(correction ? { correction: { note: correction.note, at: correction.at,
        ...(correction.inbox ? { inbox: correction.inbox } : {}) } } : {}) };
    }));
    return {
      ...v, scenes: scenes as (typeof scenes[number] & { newerTake?: { state: "produce" | "blocked"; sentences: number[]; missing: number[] } })[],
      scriptPath: current.scriptPath,
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
