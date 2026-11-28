/**
 * D244: جانب الملفات من الأرشفة والاسترجاع (ledgerArchive.ts خالص). كل عملية تحت قفل السجل (withState) وتوقّع حدثها.
 */
import { stateFileFor, saveLedger, sign, optionalFileGeneration, byteSha256, sceneFile, assemblyFile, masterFile, type SignedSceneLedger, type CurrentInput } from "./sceneLedgerStore";
import { withState } from "./sceneLedgerState";
import { ARCHIVE_ACTION, RESTORE_ACTION, archiveEpochs, archivedEpoch, predictAfterDeletion, replayFromHistory, sameShown, shownStatus, type FileGenerations } from "./ledgerArchive";
import type { SceneFirstProduction } from "./sceneProduction";

const filesOf = (scriptPath: string) => ({ scene: (id: string) => sceneFile(scriptPath, id), assembly: assemblyFile(scriptPath), master: masterFile(scriptPath) });
const gensOf = async (doc: SignedSceneLedger, scriptPath: string): Promise<FileGenerations> => {
  const g: Record<string, string> = {};
  for (const s of doc.state.scenes) g[s.id] = await optionalFileGeneration(sceneFile(scriptPath, s.id));
  return { scene: (id) => g[id] ?? "missing", assembly: await optionalFileGeneration(assemblyFile(scriptPath)), master: await optionalFileGeneration(masterFile(scriptPath)) };
};

export type CleanupPrediction = { before: ReturnType<typeof shownStatus>; after: ReturnType<typeof shownStatus>; same: boolean; archived: string[] };

/** D244 البند ٦: الحالة التي سيعرضها الاستوديو بعد حذف هذه الملفات (مع الأرشفة التي تسبق الحذف). لا يكتب شيئًا. */
export const predictCleanup = (episode: string, deleted: Set<string>, permanentMasterSha256: string | null): Promise<CleanupPrediction> =>
  withState(episode, async (doc, current: CurrentInput) => {
    const files = filesOf(current.scriptPath);
    let arch: ReturnType<typeof archiveEpochs> | null = null;
    try { arch = archiveEpochs(doc, files, deleted, permanentMasterSha256); } catch { arch = null; }
    const after: SceneFirstProduction = predictAfterDeletion(doc, files, await gensOf(doc, current.scriptPath), deleted, arch);
    return { before: shownStatus(doc.state), after: shownStatus(after), same: sameShown(doc.state, after), archived: arch?.archived ?? [] };
  });

/** يسجّل «الأرشفة بعد النشر» موقّعة قبل الحذف. يرمي إن لم تكن الحلقة منشورة أو لم تطابق النسخة الدائمة. */
export const archiveBeforeCleanup = (episode: string, deleted: Set<string>, permanentMasterSha256: string): Promise<{ archived: string[] }> =>
  withState(episode, async (doc, current) => {
    if (!doc.state.master?.publish || doc.state.master.publish.fileSha256 !== permanentMasterSha256)
      throw new Error("لا أرشفة: الحلقة ليست منشورة بإذن نشر لبصمة النسخة الدائمة نفسها.");
    const arch = archiveEpochs(doc, filesOf(current.scriptPath), deleted, permanentMasterSha256);
    const event = { seq: doc.history.length + 1, action: ARCHIVE_ACTION, at: new Date().toISOString(), by: "system" as const,
      resultSha256: permanentMasterSha256, note: `أرشفة بعد النشر (D240/D244): ${arch.archived.length} مشهد${doc.state.assembly ? " والتجميع" : ""} وMaster؛ الملفات تُحذف ويبقى الاعتماد.` };
    const next = sign({ ...doc, revision: doc.revision + 1, history: [...doc.history, event],
      previewEpochs: arch.previewEpochs, assemblyEpoch: arch.assemblyEpoch, masterEpoch: arch.masterEpoch });
    await saveLedger(stateFileFor(current.scriptPath), next);
    return { archived: arch.archived };
  });

export type RestoreResult = { before: ReturnType<typeof shownStatus>; after: ReturnType<typeof shownStatus>; written: boolean };

/**
 * D244: يعيد حالة حلقة منشورة من أحداثها الموقّعة (replayFromHistory). شرطه: إذن النشر الأخير في السجل لبصمة
 * `permanentMasterSha256` (النسخة الدائمة على المجلد المشترك). الملفات المفقودة تُسجَّل مؤرشفة، والموجودة بجيلها إن
 * طابقت بصمتها المعتمدة؛ ملف موجود ببصمة أخرى يمنع الاسترجاع.
 */
export const restoreFromHistory = (episode: string, permanentMasterSha256: string, write: boolean): Promise<RestoreResult> =>
  withState(episode, async (doc, current) => {
    const pub = [...doc.history].reverse().find((h) => h.action === "grant-publish");
    if (!pub || pub.resultSha256 !== permanentMasterSha256) throw new Error("لا استرجاع: آخر إذن نشر في السجل ليس لبصمة النسخة الدائمة.");
    const state = replayFromHistory(doc.state, doc.history);
    const files = filesOf(current.scriptPath);
    const previewEpochs = { ...doc.previewEpochs };
    const epochFor = async (file: string, sha256: string): Promise<string> => {
      const g = await optionalFileGeneration(file);
      if (g === "missing") return archivedEpoch(sha256);
      if (await byteSha256(file) !== sha256) throw new Error(`لا استرجاع: ${file} موجود ببصمة غير المعتمدة.`);
      return g;
    };
    for (const s of state.scenes) if (s.status === "approved" && s.approval) previewEpochs[s.id] = await epochFor(files.scene(s.id), s.approval.previewSha256);
    const assemblyEpoch = await epochFor(files.assembly, state.assembly!.videoSha256);
    const masterEpoch = await epochFor(files.master, state.master!.fileSha256);
    const result = { before: shownStatus(doc.state), after: shownStatus(state), written: false };
    if (!write) return result;
    const event = { seq: doc.history.length + 1, action: RESTORE_ACTION, at: new Date().toISOString(), by: "system" as const,
      resultSha256: permanentMasterSha256, note: "استرجاع الحالة من أحداث السجل الموقّعة نفسها بعد حادثة تنظيف ٢٨ نوفمبر (D244)؛ لا اعتماد جديد." };
    const next = sign({ ...doc, state, revision: doc.revision + 1, history: [...doc.history, event], previewEpochs, assemblyEpoch, masterEpoch });
    await saveLedger(stateFileFor(current.scriptPath), next);
    return { ...result, written: true };
  });
