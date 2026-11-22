/**
 * D199 (owner decision 22 Nov): «اعتمد المشاهد التي شاهدتها كاملة في المعاينة قبل النهائية» — the server part.
 *
 * - The pre-final's seams record (previews/prefinal-no-recitation.seams.json) carries the exact bytes of each scene cut
 *   joined into it and the file's own sha256 (assembleScenes.ts, written when the pre-final is made).
 * - What the owner actually played is kept on his machine, keyed by that file sha256: `<episode>/.studio/prefinal-watch.json`
 *   (.gitignore; never uploaded). A new pre-final (another sha256) starts from nothing.
 * - The list (condition 3) and every check are recomputed here before approving; each scene is then approved through the
 *   SAME path as its own «اعتمد» (decideSceneProduction: owner check D54, current preview bytes, render proof, signed log),
 *   one scene at a time, with `via: prefinal-watched` + the pre-final sha256 in its signed log event.
 * Assembly, Master and the publish permission are untouched.
 */
import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolveScriptPath } from "../script/episodes";
import { readSeamsRecord } from "./seamsRecord";
import { joinNotes, readInbox, readResolved } from "./notesInbox";
import { bulkPlan, mergeSpans, PREFINAL_APPROVAL_NOTE, type BulkPlan, type Span } from "./preFinalWatch";

/** The pre-final preview slot (same value as assembleScenes.ts PRE_FINAL_SLOT; kept here to avoid loading the joiner). */
export const PREFINAL_SLOT = "prefinal-no-recitation";
const hex64 = (s: unknown): s is string => typeof s === "string" && /^[a-f0-9]{64}$/.test(s);

export const watchFileFor = (scriptPath: string) => path.join(path.dirname(scriptPath), ".studio", "prefinal-watch.json");
type WatchDoc = { version: 1; fileSha256: string; spans: Span[] };

const readWatch = async (scriptPath: string, fileSha256: string): Promise<Span[]> => {
  try {
    const d = JSON.parse(await readFile(watchFileFor(scriptPath), "utf8")) as WatchDoc;
    return d.version === 1 && d.fileSha256 === fileSha256 && Array.isArray(d.spans) ? mergeSpans(d.spans) : [];
  } catch { return []; }
};

/** The current pre-final's record, only if it carries the D199 fields (an older one: make the pre-final again). */
const currentRecord = async (scriptPath: string) => {
  const rec = await readSeamsRecord(scriptPath, PREFINAL_SLOT);
  return rec && hex64(rec.fileSha256) && rec.sceneSha256 ? { ...rec, fileSha256: rec.fileSha256 } : null;
};

/** Scenes with an owner note still open or in progress (condition 3). */
export const openNoteScenes = async (scriptPath: string): Promise<Set<string>> => {
  const dir = path.dirname(scriptPath);
  try {
    const notes = joinNotes((await readInbox(dir)).notes, await readResolved(dir));
    return new Set(notes.filter((n) => n.sceneId && (n.status === "open" || n.status === "in-progress")).map((n) => n.sceneId));
  } catch { return new Set(); }
};

export type PreFinalWatchView = { available: false; reason: string } | ({ available: true; watched: Span[]; duration: number } & BulkPlan);

/** GET: the watched spans of the current pre-final and the list the button would show. */
export const preFinalWatchView = async (episode: string): Promise<PreFinalWatchView> => {
  const { currentCutStates } = await import("./sceneService");
  const scriptPath = await resolveScriptPath(episode);
  const rec = await currentRecord(scriptPath);
  if (!rec) return { available: false, reason: "اصنع المعاينة قبل النهائية (أو حدّثها) أولًا؛ ثم شاهدها." };
  const watched = await readWatch(scriptPath, rec.fileSha256);
  const plan = bulkPlan(rec, watched, await currentCutStates(episode), await openNoteScenes(scriptPath));
  const duration = Object.values(rec.sceneSeconds).reduce((a, b) => a + b, 0);
  return { available: true, watched, duration, ...plan };
};

/** POST from the player: spans actually played at 1× (never a seek). Owner-only; only for the current pre-final file. */
export const addPreFinalWatch = async (episode: string, fileSha256: unknown, spans: unknown): Promise<Span[]> => {
  const { assertSceneOwner } = await import("./sceneService");
  assertSceneOwner();
  const scriptPath = await resolveScriptPath(episode);
  const rec = await currentRecord(scriptPath);
  if (!rec || fileSha256 !== rec.fileSha256) throw Error("تغيّرت المعاينة قبل النهائية؛ أعد تحميل الصفحة وشاهد النسخة الحالية.");
  const total = Object.values(rec.sceneSeconds).reduce((a, b) => a + b, 0) + 1;
  if (!Array.isArray(spans) || spans.length > 5000 || spans.some((s) => !Array.isArray(s) || s.length !== 2 ||
      !s.every((x) => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= total) || s[1] <= s[0] || s[1] - s[0] > 1.01))
    throw Error("Malformed playback spans.");
  const merged = mergeSpans([...(await readWatch(scriptPath, rec.fileSha256)), ...(spans as Span[])]);
  const file = watchFileFor(scriptPath);
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify({ version: 1, fileSha256: rec.fileSha256, spans: merged } satisfies WatchDoc) + "\n", { mode: 0o600 });
  await rename(tmp, file);
  return merged;
};

export type BulkResult = { approved: string[]; failed: { id: string; error: string }[] };

/**
 * POST after the owner confirmed the list he was shown. The list is recomputed: if it is not exactly the one shown
 * (a scene changed, a note was opened, the pre-final was remade), nothing is approved and the owner sees the new list.
 */
export const approveWatchedPreFinal = async (episode: string, body: { fileSha256?: unknown; sceneIds?: unknown; confirmed?: unknown }): Promise<BulkResult> => {
  const svc = await import("./sceneService");
  svc.assertSceneOwner();
  if (body?.confirmed !== true) throw Error("أكّد القائمة أولًا.");
  const view = await preFinalWatchView(episode);
  if (!view.available) throw Error(view.reason);
  if (body.fileSha256 !== view.fileSha256) throw Error("تغيّرت المعاينة قبل النهائية؛ أعد تحميل الصفحة.");
  const shown = Array.isArray(body.sceneIds) ? (body.sceneIds as unknown[]).filter((x): x is string => typeof x === "string") : [];
  if (!shown.length || shown.length !== view.eligible.length || shown.some((id, i) => id !== view.eligible[i]))
    throw Error("تغيّرت قائمة المشاهد منذ عرضها؛ راجع القائمة الجديدة ثم أكّد.");
  const scriptPath = await resolveScriptPath(episode);
  const rec = (await currentRecord(scriptPath))!;
  const out: BulkResult = { approved: [], failed: [] };
  for (const id of view.eligible) {
    try {
      let scene = (await svc.inspectSceneProduction(episode)).scenes.find((s) => s.id === id);
      if (!scene) throw Error("Unknown scene.");
      // A watched draft becomes reviewable exactly as the single «اعتمد» does it: the same bytes are submitted first
      if (scene.status !== "in_review") {
        await svc.decideSceneProduction(episode, { action: "submit-scene", expectedSha256: scene.sourceSha256, sceneId: id });
        scene = (await svc.inspectSceneProduction(episode)).scenes.find((s) => s.id === id)!;
      }
      // Condition (1) once more, on the bytes about to be approved
      if (!scene.previewSha256 || scene.previewSha256 !== rec.sceneSha256![id])
        throw Error("The preview changed since the pre-final was made.");
      await svc.decideSceneProduction(episode, {
        action: "approve-scene", expectedSha256: scene.previewSha256, sceneId: id, confirmedWatched: true,
        note: `${PREFINAL_APPROVAL_NOTE} (${rec.fileSha256.slice(0, 12)})`, viaPreFinal: rec.fileSha256,
      });
      out.approved.push(id);
    } catch (error) {
      out.failed.push({ id, error: (error as Error).message });
    }
  }
  return out;
};
