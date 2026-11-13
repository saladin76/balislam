import path from "node:path";
import { isOwnerContext } from "./ownerContext";
import { lstat } from "node:fs/promises";
import { verifyVideoEvidence } from "./videoEvidence";
import { sceneFirstProgress, assertExactMasterApproved, assertExactMasterReadyForPublish, approvedSceneInputsSha256, type SceneFirstProduction } from "./sceneProduction";
import { type CommandAction, type SignedSceneLedger, type CurrentInput, sha, hex64, sign, byteSha256, fileGeneration, safeSceneId, stateFileFor, saveLedger, optionalSha, sceneFile, assemblyFile, masterFile, exists } from "./sceneLedgerStore";
import { withState, draftOf, awaitingChange } from "./sceneLedgerState";

/**
 * The gates (work ٨): the owner check, which scene may be rendered, and every requirement before voice, assembly,
 * Master, shorts and publishing. Each reads the reconciled ledger under its lock and throws the refusal.
 */
/** Owner-identity failures carry this code so the API answers 403, never a generic 409/500. */
export const OWNER_AUTH_ERROR = "OWNER_AUTH";
export const ownerAuthError = (message: string) => Object.assign(new Error(message), { code: OWNER_AUTH_ERROR });
export const isOwnerAuthError = (error: unknown): boolean =>
  (error as { code?: unknown } | null)?.code === OWNER_AUTH_ERROR;
/**
 * The one owner policy (owner decision, 9 Nov 2026 — no passphrase; supersedes D49): a Studio request
 * that reached the server over loopback and passed the same-origin checks, or the owner's own CLI /
 * script outside any Studio request (src/studio/ownerContext.ts). Anything else is refused. No secret
 * is read or required. Ledger integrity is the separate machine key (BAL_WORKFLOW_HMAC_KEY), and every
 * gate after this check is unchanged.
 */
export const assertSceneOwner = (): void => {
  if (!isOwnerContext())
    throw ownerAuthError("Owner actions are allowed only from the Studio on this device (127.0.0.1, same page).");
};
/** Refuses a render of a scene that still waits for a change after the owner's correction (M4). */
export const assertSceneNotAwaitingChange = async (episode: string, sceneId: string): Promise<void> => {
  await withState(episode, async (doc, current) => {
    const scene = doc.state.scenes.find(x => x.id === sceneId);
    if (scene && await awaitingChange(doc, current.scriptPath, scene))
      throw Error("This scene awaits a change after your correction; producing it again from the same inputs gives the same cut.");
  });
};
/**
 * Which scene may be rendered into its AV preview slot.
 *
 * - "current": the first unapproved scene only (the single-scene «إنتاج المشهد» button).
 * - "ahead": «جهّز كل المشاهد» pre-renders DRAFTS for the current scene and every later scene that is
 *   neither approved nor submitted (status queued/needs_revision). This is safe because a render never
 *   changes approval state: it only records a render-to-input proof (previewInputs). Approval still
 *   requires, strictly in order, an owner-authenticated submit of the exact bytes on disk (bound to the
 *   proof and to the scene's current inputs), then an owner-authenticated approval of those same bytes
 *   after watching with sound (canWorkOn refuses any scene whose predecessors are not approved).
 *   Approved and in-review scenes are never re-rendered here, so their reviewed bytes stay untouched.
 *
 * Source fingerprint and human approvals are verified by the trusted local server, never by
 * client-supplied flags.
 */
export type SceneRenderMode = "current" | "ahead";
export const checkRenderAllowed = (state: SceneFirstProduction, current: CurrentInput, sceneId: string,
  expectedSha256: string, mode: SceneRenderMode): void => {
  const target = state.scenes.find(scene => scene.id === sceneId);
  if (!state.script.approval || state.script.approval.sha256 !== state.script.sha256 ||
      !state.storyboard.approval || state.storyboard.approval.sha256 !== state.storyboard.sha256 ||
      !current.planReady)
    throw Error("Approve the current script and complete storyboard before producing a scene.");
  const now = sceneFirstProgress(state).currentScene;
  if (mode === "current") {
    if (!target || sceneFirstProgress(state).currentScene !== sceneId || target.sourceSha256 !== expectedSha256)
      throw Error("The scene is not current or its inputs changed.");
  } else {
    const at = state.scenes.findIndex(scene => scene.id === sceneId);
    const from = now ? state.scenes.findIndex(scene => scene.id === now) : -1;
    if (!target || from < 0 || at < from || target.sourceSha256 !== expectedSha256)
      throw Error("Only the current or a later unapproved scene can be prepared, with its current inputs.");
    if (target.status !== "queued" && target.status !== "needs_revision")
      throw Error("An approved or submitted scene is never re-rendered as a draft.");
  }
  // 11 Nov: after a carried-forward change, what refuses is scoped to the scene (a verse without its text, a script
  // error on its narration); a script error belonging to no scene waits for every scene not yet approved.
  const blocked = [...(current.blocks.scenes[sceneId] ?? []), ...current.blocks.episode];
  if (blocked.length) throw Error(`لا يُنتج هذا المشهد قبل إصلاح: ${blocked.join(" — ")}`);
  // A verse card without its recitation renders as a DRAFT with a silent placeholder (recitations come last).
  if (!current.voiceReady[sceneId])
    throw Error("The scene narration is not ready for AV production.");
};
export const assertSceneRenderAllowed = async (
  episode: string, sceneId: string, expectedSha256: string, mode: SceneRenderMode,
): Promise<void> => {
  assertSceneOwner();
  if (!safeSceneId(sceneId) || !hex64(expectedSha256))
    throw Error("Invalid scene preview request.");
  await withState(episode, async (doc, current) =>
    checkRenderAllowed(doc.state, current, sceneId, expectedSha256, mode));
};
export const assertCurrentSceneRenderAllowed = (
  episode: string, sceneId: string, expectedSha256: string,
): Promise<void> => assertSceneRenderAllowed(episode, sceneId, expectedSha256, "current");

/** Everything in the ledger that carries a human decision; a render must leave it byte-identical. */
export const decisionDigest = (doc: Omit<SignedSceneLedger, "mac">): string =>
  sha(JSON.stringify([doc.state, doc.history, doc.previewEpochs, doc.assemblyEpoch ?? null, doc.masterEpoch ?? null]));

/**
 * Persist the relationship between the actual produced AV bytes and the
 * input snapshot under the same signed scene ledger, without treating a
 * successful render as a human approval. Server-side invariant: the decision
 * state (approvals, statuses, history, review epochs) is unchanged by this write.
 */
export const recordSceneRenderEvidence = async (
  episode: string, sceneId: string, expectedSha256: string,
  mode: SceneRenderMode = "current",
): Promise<void> => {
  await assertSceneRenderAllowed(episode, sceneId, expectedSha256, mode);
  await withState(episode, async (doc, current) => {
    try { checkRenderAllowed(doc.state, current, sceneId, expectedSha256, mode); }
    catch { throw Error("Scene changed before the AV evidence was recorded."); }
    const video = sceneFile(current.scriptPath, sceneId);
    await verifyVideoEvidence(video);
    const proof = {
      sourceSha256: expectedSha256,
      videoSha256: await byteSha256(video),
      generation: await fileGeneration(video),
    };
    const next = sign({
      ...doc, revision: doc.revision + 1,
      previewInputs: { ...doc.previewInputs, [sceneId]: proof },
    });
    if (decisionDigest(next) !== decisionDigest(doc))
      throw Error("A render may never change an approval decision.");
    await saveLedger(stateFileFor(current.scriptPath), next);
  });
};

/** Verify each exact reviewed scene cut before and after a full-episode assembly. */
export const approvedSceneCutsForAssembly = async (
  episode: string,
): Promise<{ sceneId: string; file: string; sha256: string }[]> => {
  assertSceneOwner();
  return withState(episode, async (doc, current) => {
    approvedSceneInputsSha256(doc.state);
    if (!current.planReady)
      throw Error("Current storyboard review is missing or stale.");
    const cuts: { sceneId: string; file: string; sha256: string }[] = [];
    for (const scene of doc.state.scenes) {
      const file = sceneFile(current.scriptPath, scene.id);
      if (!scene.previewSha256 || !scene.approval ||
          scene.approval.previewSha256 !== scene.previewSha256 ||
          scene.approval.sourceSha256 !== scene.sourceSha256 ||
          doc.previewEpochs[scene.id] !== await fileGeneration(file) ||
          scene.previewSha256 !== await byteSha256(file))
        throw Error("Scene " + scene.id + " has changed after audiovisual approval.");
      await verifyVideoEvidence(file);
      cuts.push({ sceneId: scene.id, file, sha256: scene.previewSha256 });
    }
    return cuts;
  });
};

/**
 * «معاينة قبل النهائية» (owner decision, 8 Nov): every scene's CURRENT cut, in episode order, whatever
 * its decision state: the approved or submitted preview (exact reviewed bytes), otherwise a ready draft
 * bound to the scene's current inputs. Verse scenes without a recitation are silent placeholder drafts.
 * Read-only: it records nothing, and the result is never an assembly, a Master or an approval.
 */
export const currentSceneCutsForPreFinal = async (
  episode: string,
): Promise<{ sceneId: string; file: string; sha256: string; state: "approved" | "conditional" | "in_review" | "draft";
  recitationPending: boolean }[]> => {
  assertSceneOwner();
  return withState(episode, async (doc, current) => {
    const cuts = [];
    const missing: string[] = [];
    for (const scene of doc.state.scenes) {
      const file = sceneFile(current.scriptPath, scene.id);
      const bytes = await optionalSha(file);
      const reviewed = (scene.status === "approved" || scene.status === "in_review") && scene.previewSha256 === bytes;
      if (!bytes || !(reviewed || await draftOf(doc, current.scriptPath, scene.id, scene.sourceSha256, bytes) === "ready")) {
        missing.push(scene.id);
        continue;
      }
      cuts.push({ sceneId: scene.id, file, sha256: bytes,
        state: scene.status === "approved" ? (scene.approval?.recitationPending ? "conditional" as const : "approved" as const)
          : scene.status === "in_review" ? "in_review" as const : "draft" as const,
        recitationPending: Boolean(current.recitationPending[scene.id]) });
    }
    if (missing.length)
      throw Error(`مشاهد بلا مسودة حالية: ${missing.slice(0, 12).join("، ")}${missing.length > 12 ? "…" : ""}؛ اضغط «ابدأ التجهيز» (أو «استأنف التجهيز») في «٢ المشاهد» أولًا.`);
    return cuts;
  });
};

/** Protect every final-Master queue/CLI/API entrypoint before expensive rendering. */
export const requireScenesReadyForMaster = async (episode: string): Promise<void> => {
  await withState(episode, async (doc, current) => {
    approvedSceneInputsSha256(doc.state);
    if (!sceneFirstProgress(doc.state).assemblyApproved)
      throw Error("Watch the assembled episode at 1× and approve it with every scene transition before creating Master.");
    if (!doc.state.assembly || !doc.assemblyEpoch ||
        doc.assemblyEpoch !== await fileGeneration(assemblyFile(current.scriptPath)) ||
        doc.state.assembly.videoSha256 !== await byteSha256(assemblyFile(current.scriptPath)))
      throw Error("Approve and assemble all current audiovisual scenes before creating Master.");
    await verifyVideoEvidence(assemblyFile(current.scriptPath));
  });
};

/** Exact approved Master (enough to cut shorts/reels from it). Publishing needs requirePublishAllowed. */
export const requireSceneMasterReady = (episode: string): Promise<void> => masterCheck(episode, assertExactMasterApproved);
/** The only gate for publishing: approved Master AND an explicit publish permission for those bytes. */
export const requirePublishAllowed = (episode: string): Promise<void> => masterCheck(episode, assertExactMasterReadyForPublish);

/**
 * What the Drive handoff (D53, src/package/driveHandoff.ts) may deliver: the same gate as publishing
 * (approved Master AND an explicit publish permission for those exact bytes), plus the approval records it
 * writes into manifest.json. Read-only; throws exactly like requirePublishAllowed when publishing is blocked.
 */
export type PublishHandoffFacts = {
  channel: string; episode: string; episodeDir: string; scriptPath: string; masterFile: string;
  masterSha256: string; ledgerRevision: number;
  master: { by: string; at: string; seq: number | null };
  publish: { by: string; at: string; seq: number | null };
};
export const publishHandoffFacts = async (episode: string): Promise<PublishHandoffFacts> => {
  let facts: PublishHandoffFacts | null = null;
  await masterCheck(episode, (p, actual) => assertExactMasterReadyForPublish(p, actual), (doc, current, actual) => {
    const m = doc.state.master!;
    const last = (action: CommandAction) => [...doc.history].reverse().find(h => h.action === action && h.resultSha256 === actual)?.seq ?? null;
    facts = {
      channel: doc.state.channel, episode, episodeDir: path.dirname(current.scriptPath),
      scriptPath: current.scriptPath, masterFile: masterFile(current.scriptPath), masterSha256: actual,
      ledgerRevision: doc.revision,
      master: { by: m.by, at: m.at, seq: last("approve-master") },
      publish: { by: m.publish!.by, at: m.publish!.at, seq: last("grant-publish") },
    };
  });
  if (!facts) throw Error("Publishing is blocked.");
  return facts;
};

/** Script approved in the scene-first ledger (needed before the visual storyboard can be recorded). */
export const requireScriptApproved = async (episode: string): Promise<void> => {
  await withState(episode, async (doc) => {
    const p = doc.state;
    if (!p.script.approval || p.script.approval.sha256 !== p.script.sha256)
      throw Error("اعتمد السكريبت الحالي أولًا: «١ التجهيز» ← «اعتمد التجهيز».");
  });
};

/** Script and storyboard approved in the scene-first ledger (no other approval authority exists). */
export const requireScriptAndStoryboardApproved = async (episode: string): Promise<void> => {
  await withState(episode, async (doc) => {
    const p = doc.state;
    if (!p.script.approval || p.script.approval.sha256 !== p.script.sha256)
      throw Error("اعتمد السكريبت الحالي أولًا: «١ التجهيز» ← «اعتمد التجهيز».");
    if (!p.storyboard.approval || p.storyboard.approval.sha256 !== p.storyboard.sha256)
      throw Error("اعتمد الستوري بورد الحالي أولًا: «١ التجهيز» ← «اعتمد التجهيز».");
  });
};

/**
 * Voice for these scenes may be made (11 Nov): script and storyboard approved (a change after «اعتمد التجهيز» is carried
 * forward by this same read), and none of the scenes is blocked by a verse without its text or a script error.
 */
export const requireScenesProducible = async (episode: string, sceneIds: string[]): Promise<void> => {
  await requireScriptAndStoryboardApproved(episode);
  await withState(episode, async (_doc, current) => {
    const why = [...new Set([...sceneIds.flatMap(id => current.blocks.scenes[id] ?? []), ...current.blocks.episode])];
    if (why.length) throw Error(`لا يُنتج هذا قبل إصلاح: ${why.join(" — ")}`);
  });
};

/** Scene production may start: script and storyboard approved, and every current storyboard board reviewed. */
export const requireSceneProductionReady = async (episode: string): Promise<void> => {
  await requireScriptAndStoryboardApproved(episode);
  await withState(episode, async (_doc, current) => {
    if (!current.planReady)
      throw Error("لم يُعتمد التجهيز بعد: «١ التجهيز» ← «اعتمد التجهيز»، قبل تجهيز المشاهد.");
  });
};

/** No Master file yet (shorts and publishing are cut from it). */
export const NO_MASTER_MESSAGE = "لا توجد نسخة نهائية بعد: الشورتس والنشر يُصنعان من النسخة النهائية المعتمدة. اصنعها واعتمدها في «٣ النسخة النهائية» أولًا.";
/** A Master file exists but the owner has not approved it (never, or it was re-made after an approval was voided). */
export const MASTER_NOT_APPROVED_MESSAGE = "النسخة النهائية لم تُعتمد بعد: شاهدها كاملة واعتمدها في «٣ النسخة النهائية»، ثم تُصنع الشورتس ويُمنح إذن النشر.";

export const masterCheck = async (episode: string, check: (p: SceneFirstProduction, sha: string) => void,
  after?: (doc: SignedSceneLedger, current: CurrentInput, sha: string) => void): Promise<void> => {
  await withState(episode, async (doc, current) => {
    const file = masterFile(current.scriptPath);
    // P-07: say which case it is, in Arabic (the CLI `bal package --shorts` prints it as is, the Studio too).
    if (!await lstat(file).then(() => true, () => false))
      throw Error(NO_MASTER_MESSAGE);
    await verifyVideoEvidence(file);
    if (!doc.masterEpoch || !doc.state.master)
      throw Error(MASTER_NOT_APPROVED_MESSAGE);
    if (doc.masterEpoch !== await fileGeneration(file))
      throw Error("Master changed after the owner's final approval.");
    if (!doc.assemblyEpoch ||
        doc.assemblyEpoch !== await fileGeneration(assemblyFile(current.scriptPath)) ||
        doc.state.assembly?.videoSha256 !== await byteSha256(assemblyFile(current.scriptPath)))
      throw Error("Final assembly changed after approval.");
    const actual = await byteSha256(file);
    check(doc.state, actual);
    after?.(doc, current, actual);
  });
};
