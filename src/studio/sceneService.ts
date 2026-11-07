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
import { lstat, open, readFile, rename, rm, stat } from "node:fs/promises";
import { resolveScriptPath } from "../script/episodes";
import { readPlanFile } from "../plan/io";
import { loadVoiceIndex, voiceDirFor } from "../voice/generate";
import { verifiedOwnRecitations } from "../quran/manualAudio";
import { verifyVideoEvidence } from "../workflow/videoEvidence";
import {
  approveScript, approveStoryboard, approveSceneAv, approveFinalMaster,
  createSceneFirstProduction, changeScript, changeStoryboard, reviseSceneInput,
  submitSceneAvPreview, requestSceneCorrection, submitAssembly, sceneFirstProgress,
  assertExactMasterReadyForPublish, type SceneFirstProduction,
} from "./sceneProduction";

type CommandAction = "approve-script" | "approve-storyboard" | "submit-scene" |
  "approve-scene" | "correct-scene" | "assemble" | "approve-master";
export type SceneOwnerCommand = {
  action: CommandAction;
  expectedSha256: string;
  sceneId?: string;
  note?: string;
  confirmedWatched?: boolean;
};
type AuditEvent = { seq: number; action: CommandAction; sceneId?: string;
  at: string; by: "owner"; resultSha256: string; note: string };
type SignedSceneLedger = {
  version: 1;
  state: SceneFirstProduction;
  revision: number;
  history: AuditEvent[];
  previewEpochs: Record<string, string>;
  assemblyEpoch?: string;
  masterEpoch?: string;
  mac: string;
};
type CurrentInput = {
  scriptPath: string;
  initial: SceneFirstProduction;
  ready: Record<string, boolean>;
  planReady: boolean;
};
const sha = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const hex64 = (text: unknown): text is string =>
  typeof text === "string" && /^[a-f0-9]{64}$/.test(text);
const ownerSecret = (): Buffer => {
  // Keep a single local owner secret; Studio must not ask its sole operator
  // for a second confirmation code to review each scene.
  const value = process.env.BAL_STUDIO_OWNER_TOKEN;
  if (!value || Buffer.byteLength(value, "utf8") < 32)
    throw new Error("Local Studio owner session secret is not configured; approvals are disabled.");
  return Buffer.from(value, "utf8");
};
export const assertSceneOwner = (token: unknown): void => {
  if (typeof token !== "string" || !token || token.length > 4096)
    throw Error("Owner session authentication is required.");
  const a = sha(ownerSecret()), b = sha(token);
  if (!timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex")))
    throw Error("Owner session authentication is required.");
};
const signature = (doc: Omit<SignedSceneLedger, "mac">): string =>
  createHmac("sha256", ownerSecret())
    .update(JSON.stringify(["studio-scene-ledger-v1", doc.version, doc.state, doc.revision, doc.history, doc.previewEpochs, doc.assemblyEpoch, doc.masterEpoch]))
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
  // Keep local scene edits separate from the approved overall storyboard.
  const boardSha256 = sha(JSON.stringify([
    await optionalFileGeneration(path.join(path.dirname(scriptPath), "storyboard.json")),
  ]));
  const voice = await loadVoiceIndex(episode);
  const manual = await verifiedOwnRecitations(scriptPath);
  const ready: Record<string, boolean> = {};
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
    refs.push({
      id: scene.id,
      sourceSha256: sha(JSON.stringify([chapter.title, scene, scriptSha256, boardSha256,
        voiceFingerprint, rec?.sha256 ?? "no-recitation",
        rec?.approvedAt ?? null, rec?.rightsEvidence ?? null])),
    });
  }
  return {
    scriptPath, ready, planReady: true,
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
    return sign({ version: 1, state: fresh.initial, revision: 0, history: [], previewEpochs: {} });
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
const serialized = async <T>(file: string, work: () => Promise<T>): Promise<T> => {
  const name = file + ".lock";
  let fd: Awaited<ReturnType<typeof open>> | undefined;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { fd = await open(name, "wx", 0o600); break; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (attempt === 59) throw Error("Scene approval ledger is busy. Never delete another writer lock.");
      await sleep(25);
    }
  }
  if (!fd) throw Error("Cannot lock scene approvals.");
  const token = randomUUID();
  try {
    await fd.writeFile(token); await fd.sync();
    return await work();
  } finally {
    await fd.close();
    if (await readFile(name, "utf8").catch(() => null) === token)
      await rm(name, { force: true });
  }
};
const view = (data: SignedSceneLedger, ready: Record<string, boolean>) => {
  const p = data.state, progress = sceneFirstProgress(p);
  return {
    schemaVersion: 1 as const, channel: p.channel, episode: p.episode,
    revision: data.revision, progress,
    script: { sha256: p.script.sha256, approved: Boolean(p.script.approval) },
    storyboard: { sha256: p.storyboard.sha256, approved: Boolean(p.storyboard.approval) },
    scenes: p.scenes.map(s => ({ id: s.id, status: s.status,
      sourceSha256: s.sourceSha256, previewSha256: s.previewSha256,
      readyForAv: Boolean(ready[s.id]), approved: s.status === "approved" && Boolean(s.approval) })),
    assembly: p.assembly ? { sha256: p.assembly.videoSha256 } : null,
    master: p.master ? { sha256: p.master.fileSha256, approved: true } : null,
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
      doc = sign({ ...doc, state: reconciled, revision: doc.revision + 1 }); // invalidate changes permanently, even if a command later fails
      await saveLedger(file, doc);
    }
    return operation(doc, current);
  });
};
export const inspectSceneProduction = (episode: string) =>
  withState(episode, async (doc, current) => view(doc, current.ready));

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
  if (!command || !["approve-script", "approve-storyboard", "submit-scene",
      "approve-scene", "correct-scene", "assemble", "approve-master"].includes(command.action) ||
      !hex64(command.expectedSha256) ||
      (command.note !== undefined && (typeof command.note !== "string" || command.note.length > 4000)))
    throw Error("Malformed scene review command.");
  return withState(episode, async (doc, current) => {
    const p = doc.state, at = new Date().toISOString(), by = "owner";
    let next: SceneFirstProduction;
    let resultSha256 = command.expectedSha256;
    if (command.action === "approve-script") {
      if (p.script.sha256 !== command.expectedSha256) throw Error("Script changed before review.");
      next = approveScript(p, by, at, command.expectedSha256);
    } else if (command.action === "approve-storyboard") {
      if (p.storyboard.sha256 !== command.expectedSha256) throw Error("Storyboard changed before review.");
      next = approveStoryboard(p, by, at, command.expectedSha256);
    } else if (command.action === "assemble") {
      const file = assemblyFile(current.scriptPath);
      await verifyVideoEvidence(file);
      resultSha256 = await fileGeneration(file);
      if (resultSha256 !== command.expectedSha256) throw Error("The assembled video changed.");
      next = submitAssembly(p, resultSha256);
    } else if (command.action === "approve-master") {
      if (command.confirmedWatched !== true) throw Error("Full-episode human 1× review is required.");
      const file = masterFile(current.scriptPath);
      await verifyVideoEvidence(file);
      resultSha256 = await fileGeneration(file);
      if (resultSha256 !== command.expectedSha256) throw Error("The Master file changed.");
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
        if (!current.ready[id]) throw Error("Narration or the reviewed Quran recording is missing.");
        if (scene.sourceSha256 !== command.expectedSha256) throw Error("Scene inputs changed.");
        const file = sceneFile(current.scriptPath, id);
        await verifyVideoEvidence(file);
        resultSha256 = await fileGeneration(file);
        next = submitSceneAvPreview(p, id, scene.sourceSha256, resultSha256);
      } else if (command.action === "correct-scene") {
        if (scene.previewSha256 !== command.expectedSha256 || !command.note?.trim())
          throw Error("A current scene preview and a correction reason are required.");
        next = requestSceneCorrection(p, id);
      } else {
        if (command.confirmedWatched !== true)
          throw Error("Please review the complete scene with picture and sound.");
        const file = sceneFile(current.scriptPath, id);
        await verifyVideoEvidence(file);
        resultSha256 = await fileGeneration(file);
        if (scene.previewSha256 !== resultSha256 ||
            command.expectedSha256 !== resultSha256)
          throw Error("The preview changed since it was shown for review.");
        next = approveSceneAv(p, id, {
          by, at, previewSha256: resultSha256, watchedWithAudio: true,
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
      at, by, resultSha256, note: command.note?.trim() || "تأكيد مراجعة المالك",
    }];
    const saved = sign({ version: 1, state: next, revision: doc.revision + 1, history });
    await saveLedger(stateFileFor(current.scriptPath), saved);
    return view(saved, current.ready);
  });
};
export const requireSceneMasterReady = async (episode: string): Promise<void> => {
  await withState(episode, async (doc, current) => {
    const file = masterFile(current.scriptPath);
    await verifyVideoEvidence(file);
    assertExactMasterReadyForPublish(doc.state, await fileGeneration(file));
  });
};
