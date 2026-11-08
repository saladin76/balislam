/**
 * Single-operator scene-by-scene AV approval service.
 * All file paths, digests and actor identity are derived by the local server.
 * No legacy six-stage decision is automatically promoted to a scene approval.
 *
 * This is an additional fail-closed production barrier; the remaining renderer
 * and publisher adapters must call requireSceneMasterReady before release.
 */
import path from "node:path";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { lstat, open, readFile, rename, rm } from "node:fs/promises";
import { resolveScriptPath } from "../script/episodes";
import { readPlanFile } from "../plan/io";
import { loadStoryboard, storyboardStatus } from "../plan/storyboard";
import { loadVoiceIndex, voiceDirFor } from "../voice/generate";
import { verifiedOwnRecitations } from "../quran/manualAudio";
import { verifyVideoEvidence } from "../workflow/videoEvidence";
import {
  approveScript, approveStoryboard, approveSceneAv, approveFinalMaster, approveAssembly, grantPublish,
  createSceneFirstProduction, changeScript, changeStoryboard, reviseSceneInput,
  submitSceneAvPreview, requestSceneCorrection, submitAssembly, sceneFirstProgress, sceneSeams,
  assertExactMasterApproved, assertExactMasterReadyForPublish, approvedSceneInputsSha256, type SceneFirstProduction,
} from "./sceneProduction";
import { workflowSigningKey } from "../workflow/trust";

export const SCENE_ACTIONS = ["approve-script", "approve-storyboard", "submit-scene",
  "approve-scene", "correct-scene", "assemble", "approve-assembly", "approve-master", "grant-publish"] as const;
type CommandAction = (typeof SCENE_ACTIONS)[number];
export type SceneOwnerCommand = {
  action: CommandAction;
  expectedSha256: string;
  sceneId?: string;
  note?: string;
  confirmedWatched?: boolean;
  /** approve-assembly: every scene-to-scene seam the owner checked ("c1-s1>c1-s2"). */
  seamsChecked?: string[];
};
type AuditEvent = { seq: number; action: CommandAction; sceneId?: string;
  at: string; by: "owner"; resultSha256: string; note: string };
type SignedSceneLedger = {
  version: 1;
  state: SceneFirstProduction;
  revision: number;
  history: AuditEvent[];
  previewEpochs: Record<string, string>;
  /** A trusted render-to-input binding; old ledgers cannot submit new AV without rerender. */
  previewInputs?: Record<string, {
    sourceSha256: string; videoSha256: string; generation: string;
  }>;
  assemblyEpoch?: string;
  masterEpoch?: string;
  mac: string;
};
type CurrentInput = {
  scriptPath: string;
  initial: SceneFirstProduction;
  /** Narration and (for a verse card) its reviewed human recitation are both present. */
  ready: Record<string, boolean>;
  /** Narration is present: an AV draft can be rendered (a verse without recitation gets a silent placeholder). */
  voiceReady: Record<string, boolean>;
  /** Verse card whose reviewed human recitation is not attached yet (owner decision: recitations come last). */
  recitationPending: Record<string, boolean>;
  planReady: boolean;
};
const sha = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const hex64 = (text: unknown): text is string =>
  typeof text === "string" && /^[a-f0-9]{64}$/.test(text);
/**
 * The owner proves presence with a passphrase only they know (set once in the Studio; only its
 * SHA-256 is kept in .env). Ledger integrity uses a separate random machine key
 * (BAL_WORKFLOW_HMAC_KEY), so neither role leaks into the other.
 */
export const ownerPassphraseSha256 = (): string | null => {
  const hashed = process.env.BAL_STUDIO_OWNER_PASSPHRASE_SHA256?.trim();
  if (hashed && hex64(hashed)) return hashed;
  return null;
};
/** Owner-identity failures carry this code so the API answers 403, never a generic 409/500. */
export const OWNER_AUTH_ERROR = "OWNER_AUTH";
const ownerAuthError = (message: string) => Object.assign(new Error(message), { code: OWNER_AUTH_ERROR });
export const isOwnerAuthError = (error: unknown): boolean =>
  (error as { code?: unknown } | null)?.code === OWNER_AUTH_ERROR;
export const assertSceneOwner = (token: unknown): void => {
  const expected = ownerPassphraseSha256();
  if (!expected) throw ownerAuthError("Set the owner passphrase in the Studio first; approvals are disabled until then.");
  if (typeof token !== "string" || !token || token.length > 4096)
    throw ownerAuthError("Owner session authentication is required.");
  if (!timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sha(token), "hex")))
    throw ownerAuthError("Owner session authentication is required.");
};
const signature = (doc: Omit<SignedSceneLedger, "mac">): string =>
  createHmac("sha256", workflowSigningKey())
    .update(JSON.stringify(["studio-scene-ledger-v1", doc.version, doc.state, doc.revision, doc.history, doc.previewEpochs, doc.assemblyEpoch, doc.masterEpoch,
      ...(doc.previewInputs === undefined ? [] : [doc.previewInputs])]))
    .digest("hex");
const sign = (doc: Omit<SignedSceneLedger, "mac">): SignedSceneLedger =>
  ({ ...doc, mac: signature(doc) });
const byteSha256 = async (file: string): Promise<string> => sha(await readFile(file));
const fileGeneration = async (file: string): Promise<string> => {
  const st = await lstat(file, { bigint: true });
  if (!st.isFile() || st.isSymbolicLink()) throw Error("A Studio source is not a regular file.");
  const bytes = await readFile(file);
  return sha(JSON.stringify([sha(bytes), st.ino.toString(), st.ctimeNs.toString(), st.size.toString()]));
};
const optionalFileGeneration = async (file: string): Promise<string> => {
  try { return await fileGeneration(file); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "missing";
    throw error;
  }
};
const safeSceneId = (id: string): boolean =>
  /^[a-z0-9][a-z0-9-]{0,70}$/.test(id);
const stateFileFor = (scriptPath: string) =>
  path.join(path.dirname(scriptPath), "scene-production.v1.json");
const sourceNow = async (episode: string): Promise<CurrentInput> => {
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
  const ready: Record<string, boolean> = {};
  const voiceReadyBy: Record<string, boolean> = {};
  const recitationPending: Record<string, boolean> = {};
  const refs = [];
  for (const chapter of plan.chapters) for (const scene of chapter.scenes) {
    const narration = scene.narration?.trim() ?? "";
    const clip = voice[scene.id];
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
    const rec = scene.template === "verse-card" && scene.ayahKey
      ? manual[scene.ayahKey] : undefined;
    const verseReady = scene.template !== "verse-card" ||
      Boolean(rec && rec.provider === "manual" && rec.sha256 &&
        rec.approvedBy && rec.rightsEvidence);
    ready[scene.id] = voiceReady && verseReady;
    voiceReadyBy[scene.id] = voiceReady;
    recitationPending[scene.id] = !verseReady;
    // Scoped invalidation: a scene's inputs are its own content, its own approved board, its own
    // narration clip and recitation. Editing another scene, or the script elsewhere, never re-opens it.
    refs.push({
      id: scene.id,
      sourceSha256: sha(JSON.stringify(["scene-inputs-v2", chapter.title, scene, boardRecord.scenes[scene.id] ?? null,
        voiceFingerprint, rec?.sha256 ?? "no-recitation",
        rec?.approvedAt ?? null, rec?.rightsEvidence ?? null])),
    });
  }
  return {
    scriptPath, ready, voiceReady: voiceReadyBy, recitationPending, planReady: boardStatus.ok && Boolean(boardStatus.audit?.note?.trim()),
    initial: createSceneFirstProduction({
      channel: path.basename(path.dirname(path.dirname(path.dirname(scriptPath)))),
      episode: path.basename(path.dirname(scriptPath)),
      scriptSha256, storyboardSha256: boardSha256, scenes: refs,
    }),
  };
};
const reconcile = (stored: SceneFirstProduction, current: SceneFirstProduction): SceneFirstProduction => {
  if (stored.channel !== current.channel || stored.episode !== current.episode ||
      stored.scenes.length !== current.scenes.length ||
      stored.scenes.some((s, i) => s.id !== current.scenes[i]?.id))
    return current; // no implicit migration of incompatible/renumbered scenes
  let state = stored;
  if (state.script.sha256 !== current.script.sha256)
    state = changeScript(state, current.script.sha256);
  if (state.storyboard.sha256 !== current.storyboard.sha256)
    state = changeStoryboard(state, current.storyboard.sha256);
  for (const s of current.scenes)
    if (state.scenes.find(x => x.id === s.id)?.sourceSha256 !== s.sourceSha256)
      state = reviseSceneInput(state, s.id, s.sourceSha256);
  return state;
};
const readLedger = async (file: string, fresh: CurrentInput): Promise<SignedSceneLedger> => {
  let data: SignedSceneLedger;
  try {
    const st = await lstat(file);
    if (!st.isFile() || st.isSymbolicLink()) throw Error("Scene ledger is not a regular file.");
    data = JSON.parse(await readFile(file, "utf8")) as SignedSceneLedger;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return sign({ version: 1, state: fresh.initial, revision: 0, history: [], previewEpochs: {}, previewInputs: {} });
  }
  if (!data || data.version !== 1 || !hex64(data.mac) || !data.state ||
      !Array.isArray(data.history) || !data.previewEpochs || typeof data.previewEpochs !== "object" ||
      !Number.isSafeInteger(data.revision) ||
      data.state.channel !== fresh.initial.channel ||
      data.state.episode !== fresh.initial.episode)
    throw Error("Scene approval ledger is invalid; manual recovery required.");
  const { mac, ...unsigned } = data;
  const expected = signature(unsigned);
  if (!timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(expected, "hex")))
    throw Error("Scene approval ledger signature changed; approvals are blocked.");
  return data;
};
const saveLedger = async (file: string, doc: SignedSceneLedger): Promise<void> => {
  const temp = file + "." + randomUUID() + ".tmp";
  const fd = await open(temp, "wx", 0o600);
  try {
    try { await fd.writeFile(JSON.stringify(doc, null, 2) + "\n"); await fd.sync(); }
    finally { await fd.close(); }
    await rename(temp, file);
  } finally { await rm(temp, { force: true }); }
};
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
/** A lock left by a writer process that no longer exists on this machine (Studio crashed or was killed
 * mid-write). Only "<pid> <uuid>" locks of a dead process qualify; a live writer is never touched. */
export const lockOwnerIsDead = (content: string | null, ownPid = process.pid): boolean => {
  const pid = Number(content?.match(/^(\d+) [0-9a-f-]{36}$/)?.[1]);
  if (!Number.isInteger(pid) || pid <= 0 || pid === ownPid) return false;
  try { process.kill(pid, 0); return false; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "ESRCH"; }
};
/**
 * How long a decision or read waits for another writer (funnel audit item 9). A ledger operation hashes
 * every scene input (and the Master file) under the lock, which can take seconds on a loaded machine;
 * the old 60×25 ms (1.5 s) made the owner see «busy» for no reason. The wait is bounded by time, with a
 * short backoff, and still never deletes a live writer's lock.
 */
export const LEDGER_LOCK_WAIT_MS = 30_000;
export const serialized = async <T>(file: string, work: () => Promise<T>,
  waitMs = LEDGER_LOCK_WAIT_MS): Promise<T> => {
  const name = file + ".lock";
  let fd: Awaited<ReturnType<typeof open>> | undefined;
  const deadline = Date.now() + waitMs;
  for (let attempt = 0; ; attempt++) {
    try { fd = await open(name, "wx", 0o600); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const held = await readFile(name, "utf8").catch(() => null);
      // Recover only a dead process's lock, and only if it is still the same lock we inspected.
      if (lockOwnerIsDead(held) && await readFile(name, "utf8").catch(() => null) === held) {
        await rm(name, { force: true });
        continue;
      }
      if (Date.now() >= deadline) throw Error("Scene approval ledger is busy. Never delete another writer lock.");
      await sleep(Math.min(250, 25 * (1 + Math.floor(attempt / 4))));
    }
  }
  if (!fd) throw Error("Cannot lock scene approvals.");
  const token = `${process.pid} ${randomUUID()}`;
  try {
    await fd.writeFile(token); await fd.sync();
    return await work();
  } finally {
    await fd.close();
    if (await readFile(name, "utf8").catch(() => null) === token)
      await rm(name, { force: true });
  }
};
const view = (data: SignedSceneLedger, current: Pick<CurrentInput, "voiceReady" | "recitationPending">) => {
  const p = data.state, progress = sceneFirstProgress(p);
  return {
    schemaVersion: 1 as const, channel: p.channel, episode: p.episode,
    revision: data.revision, progress,
    script: { sha256: p.script.sha256, approved: Boolean(p.script.approval && p.script.approval.sha256 === p.script.sha256) },
    storyboard: { sha256: p.storyboard.sha256, approved: Boolean(p.storyboard.approval && p.storyboard.approval.sha256 === p.storyboard.sha256) },
    scenes: p.scenes.map(s => ({ id: s.id, status: s.status,
      sourceSha256: s.sourceSha256, previewSha256: s.previewSha256,
      // readyForAv: an AV draft can be produced now (narration present). A verse card without its
      // recitation is produced with a silent placeholder and can only be approved conditionally.
      readyForAv: Boolean(current.voiceReady[s.id]),
      recitationPending: Boolean(current.recitationPending[s.id]),
      approved: s.status === "approved" && Boolean(s.approval),
      conditional: s.status === "approved" && s.approval?.recitationPending === true })),
    assembly: p.assembly ? { sha256: p.assembly.videoSha256, approved: progress.assemblyApproved } : null,
    seams: sceneSeams(p),
    master: p.master ? { sha256: p.master.fileSha256, approved: true, publishAllowed: progress.publishAllowed } : null,
    recentHistory: data.history.slice(-30),
  };
};
const withState = async <T>(episode: string,
  operation: (data: SignedSceneLedger, current: CurrentInput) => Promise<T>,
): Promise<T> => {
  const initial = await sourceNow(episode);
  const file = stateFileFor(initial.scriptPath);
  return serialized(file, async () => {
    const current = await sourceNow(episode);
    if (current.scriptPath !== initial.scriptPath) throw Error("Episode changed while locking.");
    let doc = await readLedger(file, current);
    const reconciled = reconcile(doc.state, current.initial);
    if (JSON.stringify(doc.state) !== JSON.stringify(reconciled)) {
      const epochs = Object.fromEntries(Object.entries(doc.previewEpochs).filter(([id]) =>
        reconciled.scenes.some(scene => scene.id === id &&
          (scene.status === "approved" || scene.status === "in_review"))));
      // A pre-rendered draft is bound to the inputs it was rendered from: when a scene's inputs
      // change, only that scene's draft proof is discarded (it must be rendered again).
      const drafts = Object.fromEntries(Object.entries(doc.previewInputs ?? {}).filter(([id, proof]) =>
        reconciled.scenes.some(scene => scene.id === id && scene.sourceSha256 === proof.sourceSha256)));
      doc = sign({ ...doc, state: reconciled, revision: doc.revision + 1,
        previewEpochs: epochs,
        ...(doc.previewInputs === undefined ? {} : { previewInputs: drafts }),
        ...(reconciled.assembly ? {} : { assemblyEpoch: undefined, masterEpoch: undefined }) });
      await saveLedger(file, doc);
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
const optionalSha = async (file: string): Promise<string | null> => {
  try { return await byteSha256(file); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
};
/** ملخص خفيف لحالة الحلقة في الخطوات الخمس (للقائمة الرئيسية): بلا حساب بصمات الملفات الكبيرة. */
export const summarizeSceneProduction = (episode: string) =>
  withState(episode, async (doc, current) => {
    const v = view(doc, current);
    return { script: v.script.approved, storyboard: v.storyboard.approved,
      approvedScenes: v.progress.approvedScenes, totalScenes: v.progress.totalScenes,
      canAssemble: v.progress.canAssemble, assemblyApproved: v.progress.assemblyApproved,
      masterApproved: v.progress.masterApproved, publishAllowed: v.progress.publishAllowed,
      recitationPending: v.progress.recitationPending.length };
  });
/**
 * A scene's pre-rendered draft (from «جهّز كل المشاهد»): "ready" when the preview on disk is exactly
 * the bytes recorded by a trusted render of the scene's CURRENT inputs, "stale" when a file exists but
 * no longer matches, "none" otherwise. A draft is never a submission or an approval.
 */
export type SceneDraft = "ready" | "stale" | "none";
const draftOf = async (doc: SignedSceneLedger, scriptPath: string, id: string, sourceSha256: string,
  candidate: string | null): Promise<SceneDraft> => {
  if (!candidate) return "none";
  const proof = doc.previewInputs?.[id];
  if (proof && proof.sourceSha256 === sourceSha256 && proof.videoSha256 === candidate &&
      proof.generation === await optionalFileGeneration(sceneFile(scriptPath, id)))
    return "ready";
  return "stale";
};
export const inspectSceneProduction = (episode: string) =>
  withState(episode, async (doc, current) => {
    const v = view(doc, current);
    const candidates = Object.fromEntries(await Promise.all(doc.state.scenes.map(async scene =>
      [scene.id, await optionalSha(sceneFile(current.scriptPath, scene.id))] as const)));
    const scenes = await Promise.all(v.scenes.map(async s => {
      // The owner's latest correction of this scene (shown until the scene is approved).
      const fix = [...doc.history].reverse().find(h => h.sceneId === s.id && (h.action === "correct-scene" || h.action === "approve-scene"));
      const correction = fix?.action === "correct-scene" && s.status === "needs_revision"
        ? { note: fix.note ?? "", at: fix.at, sha256: fix.resultSha256 } : undefined;
      // Once submitted or approved the preview is no longer a draft; a cut the owner sent back for a fix
      // is never offered again as a "ready" draft: the scene must be rendered again.
      const draft = s.status === "approved" || s.status === "in_review" ? "none" as const
        : correction && correction.sha256 && correction.sha256 === candidates[s.id] ? "stale" as const
        : await draftOf(doc, current.scriptPath, s.id, s.sourceSha256, candidates[s.id] ?? null);
      return { ...s, draft, ...(correction ? { correction: { note: correction.note, at: correction.at } } : {}) };
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
    };
  });

const sceneFile = (scriptPath: string, id: string) => {
  if (!safeSceneId(id)) throw Error("Invalid scene id.");
  return path.join(path.dirname(scriptPath), "previews", `scene-${id}-av.mp4`);
};
const assemblyFile = (scriptPath: string) =>
  path.join(path.dirname(scriptPath), "previews", "episode.mp4");
const masterFile = (scriptPath: string) =>
  path.join(path.dirname(scriptPath), "out", "package",
    `${path.basename(path.dirname(scriptPath)).slice(0, 3)}-episode.mp4`);

export const decideSceneProduction = async (episode: string,
  command: SceneOwnerCommand, sessionToken: unknown) => {
  assertSceneOwner(sessionToken);
  if (!command || !(SCENE_ACTIONS as readonly string[]).includes(command.action) ||
      !hex64(command.expectedSha256) ||
      (command.seamsChecked !== undefined && (!Array.isArray(command.seamsChecked) || command.seamsChecked.length > 2000 ||
        command.seamsChecked.some((x) => typeof x !== "string" || x.length > 160))) ||
      (command.note !== undefined && (typeof command.note !== "string" || command.note.length > 4000)))
    throw Error("Malformed scene review command.");
  return withState(episode, async (doc, current) => {
    const p = doc.state, at = new Date().toISOString();
    const by: "owner" = "owner";
    let next: SceneFirstProduction;
    let resultSha256 = command.expectedSha256;
    const previewEpochs = { ...doc.previewEpochs };
    let assemblyEpoch = doc.assemblyEpoch;
    let masterEpoch = doc.masterEpoch;
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
    return view(saved, current);
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
const checkRenderAllowed = (state: SceneFirstProduction, current: CurrentInput, sceneId: string,
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
  // A verse card without its recitation renders as a DRAFT with a silent placeholder (recitations come last).
  if (!current.voiceReady[sceneId])
    throw Error("The scene narration is not ready for AV production.");
};
export const assertSceneRenderAllowed = async (
  episode: string, sceneId: string, expectedSha256: string, token: unknown, mode: SceneRenderMode,
): Promise<void> => {
  assertSceneOwner(token);
  if (!safeSceneId(sceneId) || !hex64(expectedSha256))
    throw Error("Invalid scene preview request.");
  await withState(episode, async (doc, current) =>
    checkRenderAllowed(doc.state, current, sceneId, expectedSha256, mode));
};
export const assertCurrentSceneRenderAllowed = (
  episode: string, sceneId: string, expectedSha256: string, token: unknown,
): Promise<void> => assertSceneRenderAllowed(episode, sceneId, expectedSha256, token, "current");

/** Everything in the ledger that carries a human decision; a render must leave it byte-identical. */
const decisionDigest = (doc: Omit<SignedSceneLedger, "mac">): string =>
  sha(JSON.stringify([doc.state, doc.history, doc.previewEpochs, doc.assemblyEpoch ?? null, doc.masterEpoch ?? null]));

/**
 * Persist the relationship between the actual produced AV bytes and the
 * input snapshot under the same signed scene ledger, without treating a
 * successful render as a human approval. Server-side invariant: the decision
 * state (approvals, statuses, history, review epochs) is unchanged by this write.
 */
export const recordSceneRenderEvidence = async (
  episode: string, sceneId: string, expectedSha256: string, token: unknown,
  mode: SceneRenderMode = "current",
): Promise<void> => {
  await assertSceneRenderAllowed(episode, sceneId, expectedSha256, token, mode);
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
  episode: string, token: unknown,
): Promise<{ sceneId: string; file: string; sha256: string }[]> => {
  assertSceneOwner(token);
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
  episode: string, token: unknown,
): Promise<{ sceneId: string; file: string; sha256: string; state: "approved" | "conditional" | "in_review" | "draft";
  recitationPending: boolean }[]> => {
  assertSceneOwner(token);
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
      throw Error(`مشاهد بلا مسودة حالية: ${missing.slice(0, 12).join("، ")}${missing.length > 12 ? "…" : ""}. شغّل «جهّز كل المشاهد» أولًا.`);
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

/** Script approved in the scene-first ledger (needed before the visual storyboard can be recorded). */
export const requireScriptApproved = async (episode: string): Promise<void> => {
  await withState(episode, async (doc) => {
    const p = doc.state;
    if (!p.script.approval || p.script.approval.sha256 !== p.script.sha256)
      throw Error("اعتمد السكريبت الحالي أولًا من «إنتاج المشاهد».");
  });
};

/** Script and storyboard approved in the scene-first ledger (no other approval authority exists). */
export const requireScriptAndStoryboardApproved = async (episode: string): Promise<void> => {
  await withState(episode, async (doc) => {
    const p = doc.state;
    if (!p.script.approval || p.script.approval.sha256 !== p.script.sha256)
      throw Error("اعتمد السكريبت الحالي أولًا من «إنتاج المشاهد».");
    if (!p.storyboard.approval || p.storyboard.approval.sha256 !== p.storyboard.sha256)
      throw Error("اعتمد الستوري بورد الحالي أولًا من «إنتاج المشاهد».");
  });
};

/** Scene production may start: script and storyboard approved, and every current storyboard board reviewed. */
export const requireSceneProductionReady = async (episode: string): Promise<void> => {
  await requireScriptAndStoryboardApproved(episode);
  await withState(episode, async (_doc, current) => {
    if (!current.planReady)
      throw Error("راجع لوحات الستوري بورد المعدّلة وسجّل ملاحظتك، ثم اعتمد الستوري بورد، قبل تجهيز المشاهد.");
  });
};

const masterCheck = async (episode: string, check: (p: SceneFirstProduction, sha: string) => void): Promise<void> => {
  await withState(episode, async (doc, current) => {
    const file = masterFile(current.scriptPath);
    await verifyVideoEvidence(file);
    if (!doc.masterEpoch || doc.masterEpoch !== await fileGeneration(file))
      throw Error("Master changed after the owner's final approval.");
    if (!doc.assemblyEpoch ||
        doc.assemblyEpoch !== await fileGeneration(assemblyFile(current.scriptPath)) ||
        doc.state.assembly?.videoSha256 !== await byteSha256(assemblyFile(current.scriptPath)))
      throw Error("Final assembly changed after approval.");
    check(doc.state, await byteSha256(file));
  });
};
