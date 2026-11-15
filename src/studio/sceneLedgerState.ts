import path from "node:path";
import { SCENES, countAr } from "../i18n/count";
import { planOrder, sceneNames } from "../i18n/sceneNames";
import { open } from "node:fs/promises";
import { resolveScriptPath } from "../script/episodes";
import { readPlanFile } from "../plan/io";
import { recordBoardsAfterPreparation } from "../plan/storyboard";
import { approveScript, approveStoryboard, changeScript, changeStoryboard, reviseSceneInput, sceneFirstProgress, sceneSeams, type SceneFirstProduction } from "./sceneProduction";
import { correctionInboxView } from "./notesInbox";
import { AFTER_PREPARATION_ACTION, productionBlocks, textBlocks, type AfterPreparationChange, type AfterPreparationWhat } from "./afterPreparation";
import { type AuditEvent, type SignedSceneLedger, type CurrentInput, sign, optionalFileGeneration, stateFileFor, readLedger, saveLedger, serialized, sceneFile, assemblyFile, masterFile, exists } from "./sceneLedgerStore";
import { sourceNow } from "./sceneInputs";

/**
 * The ledger state under its lock: reconciliation with the current inputs, «تحديث بعد التجهيز» (carry-forward,
 * owner decision 11 Nov), stale-preview detection, and the read model the Studio shows.
 */
/**
 * Reconcile the signed ledger with the episode as it is now, scene by scene (QA H3, 10 Nov 2026).
 * Adding, removing or reordering a scene used to wipe every approval; now:
 * - a scene whose id is still present keeps its status and approval; if its own input fingerprint
 *   changed it is re-opened by reviseSceneInput exactly as before (queued stays queued);
 * - a new scene id enters as "queued" at its plan position;
 * - a removed scene id is dropped with its approval;
 * - script / storyboard approvals are kept unless their own hashes changed (changeScript / changeStoryboard);
 * - any change to the list (added, removed or reordered ids) invalidates the assembly, the Master and
 *   the publish permission, because the cut and its seams no longer match.
 * A later scene that stays approved after a newly inserted queued one keeps its approval; the new scene is
 * produced and approved like any other, in any order (D145), and assembly stays blocked until every scene is approved. A different channel/episode still starts over.
 */
export const reconcileSceneLedger = (stored: SceneFirstProduction, current: SceneFirstProduction): SceneFirstProduction => {
  if (stored.channel !== current.channel || stored.episode !== current.episode)
    return current; // a ledger of another episode is never migrated
  const byId = new Map(stored.scenes.map(scene => [scene.id, scene]));
  const sameList = stored.scenes.length === current.scenes.length &&
    stored.scenes.every((s, i) => s.id === current.scenes[i]?.id);
  let state: SceneFirstProduction = sameList ? stored : {
    ...stored,
    scenes: current.scenes.map(s => byId.get(s.id) ?? { id: s.id, sourceSha256: s.sourceSha256, status: "queued" as const }),
    assembly: undefined, master: undefined,
  };
  if (state.script.sha256 !== current.script.sha256)
    state = changeScript(state, current.script.sha256);
  if (state.storyboard.sha256 !== current.storyboard.sha256)
    state = changeStoryboard(state, current.storyboard.sha256);
  for (const s of current.scenes)
    if (state.scenes.find(x => x.id === s.id)?.sourceSha256 !== s.sourceSha256)
      state = reviseSceneInput(state, s.id, s.sourceSha256);
  return state;
};
/**
 * Step ٢'s quiet line «تغيّر بعد التجهيز — راجعه»: for a scene that is not approved, the latest system event that
 * re-opened it, unless the owner approved it after that event.
 */
export const afterPreparationOf = (history: AuditEvent[], id: string) => {
  for (const h of [...history].reverse()) {
    if (h.sceneId === id && h.action === "approve-scene") return null;
    const hit = h.action === AFTER_PREPARATION_ACTION ? h.change?.scenes.find(x => x.id === id) : undefined;
    if (hit) return { at: h.at, what: hit.what, script: Boolean(h.change?.script) };
  }
  return null;
};
export const view = (data: SignedSceneLedger, current: Pick<CurrentInput, "voiceReady" | "recitationPending" | "planReady" | "boardsChanged" | "blocks">) => {
  const p = data.state, progress = sceneFirstProgress(p);
  return {
    schemaVersion: 1 as const, channel: p.channel, episode: p.episode,
    revision: data.revision, progress,
    script: { sha256: p.script.sha256, approved: Boolean(p.script.approval && p.script.approval.sha256 === p.script.sha256) },
    storyboard: { sha256: p.storyboard.sha256, approved: Boolean(p.storyboard.approval && p.storyboard.approval.sha256 === p.storyboard.sha256) },
    // P-05: the board record covers every current scene. A board edited after «اعتمد التجهيز» re-opens step ١
    // for that board only (`changed`), even while the ledger's storyboard decision still stands.
    boards: { current: current.planReady, changed: current.boardsChanged },
    scenes: p.scenes.map(s => ({ id: s.id, status: s.status,
      sourceSha256: s.sourceSha256, previewSha256: s.previewSha256,
      // readyForAv: an AV draft can be produced now (narration present). A verse card without its
      // recitation is produced with a silent placeholder and can only be approved conditionally.
      readyForAv: Boolean(current.voiceReady[s.id]),
      recitationPending: Boolean(current.recitationPending[s.id]),
      approved: s.status === "approved" && Boolean(s.approval),
      conditional: s.status === "approved" && s.approval?.recitationPending === true,
      // 11 Nov: re-opened by a change after «اعتمد التجهيز» (reviewed here like any scene), and what blocks producing it.
      ...(s.status !== "approved" ? (() => { const a = afterPreparationOf(data.history, s.id); return a ? { afterPreparation: a } : {}; })() : {}),
      ...(current.blocks.scenes[s.id]?.length ? { blocked: current.blocks.scenes[s.id] } : {}) })),
    /** Script errors that belong to no single scene: every scene not yet approved waits for them (shown once in step ٢). */
    episodeBlocked: current.blocks.episode,
    /**
     * «تحديث بعد التجهيز» (step ١ lists its scenes, informative only, with a link to each in step ٢). QA dafatir M5
     * (12 Nov): EVERY scene re-opened by such an event and not approved since, in episode order — not only the
     * latest event's (a later script-only save used to empty the list). `script`: the latest event changed the
     * script; `scriptOnly`: it re-opened no scene (said as one line, so a script-only change is not silent).
     */
    afterPreparation: (() => {
      const last = [...data.history].reverse().find(h => h.action === AFTER_PREPARATION_ACTION);
      if (!last?.change) return null;
      const scenes = p.scenes.filter(s => s.status !== "approved").flatMap(s => {
        const a = afterPreparationOf(data.history, s.id);
        return a ? [{ id: s.id, what: a.what }] : [];
      });
      return { at: last.at, script: Boolean(last.change.script), scriptOnly: Boolean(last.change.script) && !last.change.scenes.length, scenes };
    })(),
    assembly: p.assembly ? { sha256: p.assembly.videoSha256, approved: progress.assemblyApproved } : null,
    seams: sceneSeams(p),
    master: p.master ? { sha256: p.master.fileSha256, approved: true, publishAllowed: progress.publishAllowed } : null,
    recentHistory: data.history.slice(-30),
  };
};
/** The ledger with a reconciled state: approvals of scenes whose inputs changed lose their review epoch and draft proof. */
export const applyReconciled = (doc: SignedSceneLedger, reconciled: SceneFirstProduction,
  extra: Partial<Pick<SignedSceneLedger, "history">> = {}): SignedSceneLedger => {
  const epochs = Object.fromEntries(Object.entries(doc.previewEpochs).filter(([id]) =>
    reconciled.scenes.some(scene => scene.id === id &&
      (scene.status === "approved" || scene.status === "in_review"))));
  // A pre-rendered draft is bound to the inputs it was rendered from: when a scene's inputs
  // change, only that scene's draft proof is discarded (it must be rendered again).
  const drafts = Object.fromEntries(Object.entries(doc.previewInputs ?? {}).filter(([id, proof]) =>
    reconciled.scenes.some(scene => scene.id === id && scene.sourceSha256 === proof.sourceSha256)));
  return sign({ ...doc, ...extra, state: reconciled, revision: doc.revision + 1,
    previewEpochs: epochs,
    ...(doc.previewInputs === undefined ? {} : { previewInputs: drafts }),
    ...(reconciled.assembly ? {} : { assemblyEpoch: undefined, masterEpoch: undefined }) });
};
export const approvedNow = (s: { sha256: string; approval?: { sha256: string } }) => Boolean(s.approval && s.approval.sha256 === s.sha256);
/** «اعتمد التجهيز» was given once by the owner (both ledger decisions exist in the signed history). */
export const preparedByOwner = (doc: SignedSceneLedger) =>
  doc.history.some(h => h.by === "owner" && h.action === "approve-script") &&
  doc.history.some(h => h.by === "owner" && h.action === "approve-storyboard");
/** An approval in the current state rests on the system's carry-forward, not on the owner's own «اعتمد التجهيز». */
export const carriedBySystem = (p: SceneFirstProduction) => p.script.approval?.by === "system" || p.storyboard.approval?.by === "system";
export const lastApprovedSha = (doc: SignedSceneLedger, kind: "script" | "storyboard"): string | null => {
  for (const h of [...doc.history].reverse()) {
    if (h.action === (kind === "script" ? "approve-script" : "approve-storyboard")) return h.resultSha256;
    if (h.action === AFTER_PREPARATION_ACTION && h.change?.[kind]) return h.change[kind]!.to;
  }
  return null;
};
/**
 * «تحديث بعد التجهيز» (owner decision 11 Nov, all channels; supersedes D60/D65/D66 re-approval). Under the ledger lock,
 * after reconciling: when «اعتمد التجهيز» was given before and the script or storyboard decision is no longer current
 * (or a board changed), the system
 *   1. records the changed/new boards in storyboard.json (recordBoardsAfterPreparation; unchanged boards byte for byte),
 *   2. re-reads the inputs and reconciles again, so exactly the scenes whose own inputs changed re-open,
 *   3. carries the script and storyboard approvals forward to the new fingerprints (`by: "system"`), and
 *   4. appends ONE signed history event with the sources, old/new hashes and each re-opened scene with what changed.
 * Nothing is asked of the owner here: the re-opened scenes are reviewed in step ٢ like any other. The assembly, the
 * Master and the publish permission are invalidated exactly as before (changeScript / changeStoryboard / reviseSceneInput).
 * Boards without a review note (never recorded) are not carried forward: step ١ again. There is no withdrawal (D76, QA 12 Nov).
 * Also the automatic migration of an episode that waited on the old changed-boards re-approval (D60).
 */
export const carryForwardAfterPreparation = async (episode: string, file: string, doc: SignedSceneLedger,
  current: CurrentInput, before: SceneFirstProduction): Promise<{ doc: SignedSceneLedger; current: CurrentInput }> => {
  const p = doc.state;
  if (approvedNow(p.script) && approvedNow(p.storyboard) && !current.boardsChanged.length) return { doc, current };
  if (!preparedByOwner(doc) || !current.boardsReviewed) return { doc, current };
  const plan = await readPlanFile(current.scriptPath);
  if (!plan) return { doc, current };
  const at = new Date().toISOString();
  const boards = current.boardsChanged;
  const boardState = current.boardState;
  let cur = current;
  if (boards.length) {
    await recordBoardsAfterPreparation(current.scriptPath, plan, at);
    cur = await sourceNow(episode);
    if (cur.scriptPath !== current.scriptPath) throw Error("Episode changed while locking.");
  }
  let state = reconcileSceneLedger(p, cur.initial);
  const script = approvedNow(state.script) ? undefined : { from: lastApprovedSha(doc, "script"), to: state.script.sha256 };
  const storyboard = approvedNow(state.storyboard) ? undefined : { from: lastApprovedSha(doc, "storyboard"), to: state.storyboard.sha256 };
  if (script) state = approveScript({ ...state, script: { sha256: state.script.sha256 } }, "system", at, state.script.sha256);
  if (storyboard) state = approveStoryboard({ ...state, storyboard: { sha256: state.storyboard.sha256 } }, "system", at, state.storyboard.sha256);
  const was = new Map(before.scenes.map(x => [x.id, x.sourceSha256]));
  const scenes = state.scenes.filter(x => boards.includes(x.id) || was.get(x.id) !== x.sourceSha256).map(x => {
    const what: AfterPreparationWhat[] = [];
    if (!was.has(x.id) || boardState[x.id] === "new") what.push("new");
    else if (boardState[x.id] === "changed") what.push("board");
    if (cur.textChanged[x.id]) what.push("text");
    if (!what.length) what.push("inputs");
    return { id: x.id, what, from: was.get(x.id) ?? null, to: x.sourceSha256 };
  });
  const change: AfterPreparationChange = {
    source: [...(script ? ["script" as const] : []),
      ...(boards.length || (storyboard && storyboard.from !== storyboard.to) ? ["boards" as const] : [])],
    ...(script ? { script } : {}), ...(storyboard ? { storyboard } : {}), scenes,
  };
  const event: AuditEvent = {
    seq: doc.history.length + 1, action: AFTER_PREPARATION_ACTION, at, by: "system",
    resultSha256: state.storyboard.sha256,
    // QA 12 Nov: the owner reads this note in the board log — scenes by their number, Arabic counting.
    note: `تحديث بعد التجهيز: ${scenes.length ? `يُراجَع ${countAr(scenes.length, SCENES)} في «٢ المشاهد» (${sceneNames(planOrder(plan), scenes.map(x => x.id), 8)})` : "لم يتغيّر مشهد"}${script ? "؛ تغيّر السكريبت" : ""}. لا اعتماد جديد للتجهيز.`,
    change,
  };
  const next = applyReconciled(doc, state, { history: [...doc.history, event] });
  await saveLedger(file, next);
  return { doc: next, current: cur };
};
export const withState = async <T>(episode: string,
  operation: (data: SignedSceneLedger, current: CurrentInput) => Promise<T>,
): Promise<T> => {
  // M9: only the path is needed before the lock; the inputs are computed once, under it.
  const initialPath = await resolveScriptPath(episode);
  const file = stateFileFor(initialPath);
  return serialized(file, async () => {
    let current = await sourceNow(episode);
    if (current.scriptPath !== initialPath) throw Error("Episode changed while locking.");
    let doc = await readLedger(file, current);
    const before = doc.state;
    const reconciled = reconcileSceneLedger(doc.state, current.initial);
    if (JSON.stringify(doc.state) !== JSON.stringify(reconciled)) {
      doc = applyReconciled(doc, reconciled);
      await saveLedger(file, doc);
    }
    ({ doc, current } = await carryForwardAfterPreparation(episode, file, doc, current, before));
    {
      // QA balislam 2: a scene whose text differs from the script is blocked even under the owner's own approval.
      const plan = await readPlanFile(current.scriptPath);
      if (plan) current = { ...current, blocks: carriedBySystem(doc.state)
        ? await productionBlocks(current.scriptPath, plan) : await textBlocks(current.scriptPath, plan) };
    }
    // Detect a changed or edit-and-restored preview/assembly/Master by inode
    // generation as well as bytes. Never silently revive a former approval.
    let next = doc.state;
    const epochs = { ...doc.previewEpochs };
    let stale = false;
    for (const scene of next.scenes) {
      if (scene.status !== "approved" && scene.status !== "in_review") continue;
      const currentEpoch = await optionalFileGeneration(sceneFile(current.scriptPath, scene.id));
      if (!epochs[scene.id] || epochs[scene.id] !== currentEpoch) {
        next = { ...next, scenes: next.scenes.map(other => other.id === scene.id ?
          { id: other.id, sourceSha256: other.sourceSha256, status: "needs_revision" as const } : other),
          assembly: undefined, master: undefined };
        delete epochs[scene.id];
        stale = true;
      }
    }
    if (next.assembly && (!doc.assemblyEpoch ||
        doc.assemblyEpoch !== await optionalFileGeneration(assemblyFile(current.scriptPath)))) {
      next = { ...next, assembly: undefined, master: undefined };
      stale = true;
    }
    if (next.master && (!doc.masterEpoch ||
        doc.masterEpoch !== await optionalFileGeneration(masterFile(current.scriptPath)))) {
      next = { ...next, master: undefined };
      stale = true;
    }
    if (stale) {
      doc = sign({ ...doc, state: next, revision: doc.revision + 1,
        previewEpochs: epochs,
        ...(next.assembly ? {} : { assemblyEpoch: undefined }),
        ...(next.master ? {} : { masterEpoch: undefined }) });
      await saveLedger(file, doc);
    }
    return operation(doc, current);
  });
};
/**
 * A scene's pre-rendered draft (from «جهّز كل المشاهد»): "ready" when the preview on disk is exactly
 * the bytes recorded by a trusted render of the scene's CURRENT inputs, "stale" when a file exists but
 * no longer matches, "none" otherwise. A draft is never a submission or an approval.
 */
export type SceneDraft = "ready" | "stale" | "none";
export const draftOf = async (doc: SignedSceneLedger, scriptPath: string, id: string, sourceSha256: string,
  candidate: string | null): Promise<SceneDraft> => {
  if (!candidate) return "none";
  const proof = doc.previewInputs?.[id];
  if (proof && proof.sourceSha256 === sourceSha256 && proof.videoSha256 === candidate &&
      proof.generation === await optionalFileGeneration(sceneFile(scriptPath, id)))
    return "ready";
  return "stale";
};
/**
 * M4 (funnel QA, 10 Nov): a scene the owner sent back («الحركة غير مناسبة» / «النبرة غير مناسبة») waits for a
 * change. Re-rendering the same inputs gives the same cut, so it is not re-rendered — neither by the queue nor
 * by «أنتج هذا المشهد» — until its inputs change (a new tone, an edited text, a new board…) or the owner's note
 * is answered «أُصلحت» (a fix in the engine itself, which the scene's inputs cannot show).
 * Waiting = needs_revision, the latest decision on it is that correction, the trusted render proof is still
 * the corrected cut, and that proof was made from the scene's current inputs.
 */
export const awaitingChange = async (doc: SignedSceneLedger, scriptPath: string, scene: { id: string; status: string; sourceSha256: string }) => {
  if (scene.status !== "needs_revision") return null;
  const fix = [...doc.history].reverse().find(h => h.sceneId === scene.id && (h.action === "correct-scene" || h.action === "approve-scene"));
  if (fix?.action !== "correct-scene") return null;
  const proof = doc.previewInputs?.[scene.id];
  if (!proof || proof.videoSha256 !== fix.resultSha256 || proof.sourceSha256 !== scene.sourceSha256) return null;
  const inbox = await correctionInboxView(path.dirname(scriptPath), fix.seq);
  if (inbox?.status === "fixed") return null;
  return { note: fix.note ?? "" };
};
