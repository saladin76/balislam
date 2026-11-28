/**
 * D244 (قرار المالك ٢٨ نوفمبر، بعد حادثة تنظيف 001): التنظيف بعد النشر (D240) لا يغيّر حالة الحلقة في الاستوديو.
 *
 * الحادثة: حذف تنظيف 001 مقاطع المشاهد المعتمدة ونسخة Master المحلية، وكشف التغيّر في «إنتاج المشاهد» (فحص الجيل
 * previewEpochs/assemblyEpoch/masterEpoch، «لا يُحيا اعتماد سابق بصمت») رأى الملفات مفقودة ففتح المشاهد الـ٤٧ وأسقط
 * التجميع وMaster وإذن النشر من الحالة؛ والسجل نفسه (الأحداث الموقّعة) بقي سليمًا.
 *
 * - «الأرشفة بعد النشر» حدث موقّع (`archive-after-publish`، by "system") يُسجَّل قبل أي حذف: جيل كل ملف معتمد سيُحذف
 *   يصير `archived:<sha256>` (المشهد ببصمة معاينته المعتمدة، والتجميع ببصمته، وMaster ببصمة النسخة الدائمة).
 *   فحص التغيّر يقبل الجيل المؤرشف ما دام الملف **مفقودًا**؛ وإن ظهر ملف في المكان نفسه (أي بايتات) يُفتح المشهد كما كان،
 *   فلا يُحيا اعتماد بصمت أبدًا.
 * - «الاسترجاع من السجل» (`restore-from-history`): يعيد بناء الحالة من الأحداث الموقّعة نفسها بالدوال الخالصة نفسها
 *   (اعتماد المشهد بآخر approve-scene له، ثم التجميع واعتماده وMaster وإذن النشر)، لحلقة منشورة وحدها ونسختها الدائمة
 *   تطابق بصمة إذن النشر. لا يضيف اعتمادًا لم يسجّله المالك.
 * - `predictAfterDeletion`: الحالة التي سيعرضها الاستوديو بعد حذف ملفات بعينها (التجربة بلا حذف تتوقف إن تغيّرت).
 */
import { approveAssembly, approveFinalMaster, grantPublish, submitAssembly, type SceneFirstProduction } from "./sceneProduction";
import type { AuditEvent, SignedSceneLedger } from "./sceneLedgerStore";

export const ARCHIVE_ACTION = "archive-after-publish" as const;
export const RESTORE_ACTION = "restore-from-history" as const;
const ARCHIVED = "archived:";
export const archivedEpoch = (sha256: string) => `${ARCHIVED}${sha256}`;
export const isArchivedEpoch = (epoch: string | undefined): boolean => typeof epoch === "string" && epoch.startsWith(ARCHIVED);

/** هل الجيل المسجّل ما زال صالحًا للملف كما هو الآن؟ المؤرشف صالح والملف مفقود وحده. */
export const epochHolds = (recorded: string | undefined, current: string): boolean =>
  Boolean(recorded) && (recorded === current || (isArchivedEpoch(recorded) && current === "missing"));

export type FileGenerations = { scene: (id: string) => string; assembly: string; master: string };

/** فحص التغيّر الخالص (نفس منطق withState): يعيد الحالة بعد إسقاط ما تغيّر ملفه، وهل تغيّر شيء */
export const staleCheck = (doc: Pick<SignedSceneLedger, "state" | "previewEpochs" | "assemblyEpoch" | "masterEpoch">, gen: FileGenerations) => {
  let next = doc.state;
  const epochs = { ...doc.previewEpochs };
  let stale = false;
  for (const scene of next.scenes) {
    if (scene.status !== "approved" && scene.status !== "in_review") continue;
    if (!epochHolds(epochs[scene.id], gen.scene(scene.id))) {
      next = { ...next, scenes: next.scenes.map((other) => other.id === scene.id
        ? { id: other.id, sourceSha256: other.sourceSha256, status: "needs_revision" as const } : other),
        assembly: undefined, master: undefined };
      delete epochs[scene.id];
      stale = true;
    }
  }
  if (next.assembly && !epochHolds(doc.assemblyEpoch, gen.assembly)) { next = { ...next, assembly: undefined, master: undefined }; stale = true; }
  if (next.master && !epochHolds(doc.masterEpoch, gen.master)) { next = { ...next, master: undefined }; stale = true; }
  return { state: next, epochs, stale };
};

/** ملخص ما يعرضه الاستوديو للحلقة (للمقارنة قبل الحذف وبعده) */
export const shownStatus = (p: SceneFirstProduction) => ({
  approvedScenes: p.scenes.filter((s) => s.status === "approved").length,
  scenes: p.scenes.length,
  assemblyApproved: Boolean(p.assembly?.approval),
  master: p.master?.fileSha256 ?? null,
  published: p.master?.publish?.fileSha256 ?? null,
});
export const sameShown = (a: SceneFirstProduction, b: SceneFirstProduction) => JSON.stringify(shownStatus(a)) === JSON.stringify(shownStatus(b));

/**
 * الحالة بعد حذف `deleted` (مسارات مطلقة) كما سيحسبها الاستوديو، مع الأرشفة التي سيسجّلها التنظيف قبل الحذف.
 * `files` مسارات ملفات المشهد/التجميع/Master، و`gen` أجيالها الآن.
 */
export const predictAfterDeletion = (doc: SignedSceneLedger, files: { scene: (id: string) => string; assembly: string; master: string },
  gen: FileGenerations, deleted: Set<string>, archive: { previewEpochs: Record<string, string>; assemblyEpoch?: string; masterEpoch?: string } | null) => {
  const g: FileGenerations = {
    scene: (id) => (deleted.has(files.scene(id)) ? "missing" : gen.scene(id)),
    assembly: deleted.has(files.assembly) ? "missing" : gen.assembly,
    master: deleted.has(files.master) ? "missing" : gen.master,
  };
  const base = archive ? { ...doc, previewEpochs: archive.previewEpochs, assemblyEpoch: archive.assemblyEpoch, masterEpoch: archive.masterEpoch } : doc;
  return staleCheck(base, g).state;
};

/**
 * أجيال الأرشفة: كل مشهد معتمد سيُحذف ملفه يأخذ archived:<بصمة معاينته المعتمدة>، والتجميع المعتمد كذلك، وMaster ببصمة
 * النسخة الدائمة (يجب أن تساوي بصمته المعتمدة). ما لا يُحذف يبقى بجيله.
 */
export const archiveEpochs = (doc: SignedSceneLedger, files: { scene: (id: string) => string; assembly: string; master: string },
  deleted: Set<string>, permanentMasterSha256: string | null) => {
  const previewEpochs = { ...doc.previewEpochs };
  const archived: string[] = [];
  for (const s of doc.state.scenes) {
    if (s.status !== "approved" || !s.approval || !deleted.has(files.scene(s.id))) continue;
    previewEpochs[s.id] = archivedEpoch(s.approval.previewSha256);
    archived.push(s.id);
  }
  let assemblyEpoch = doc.assemblyEpoch;
  if (doc.state.assembly?.approval && deleted.has(files.assembly)) assemblyEpoch = archivedEpoch(doc.state.assembly.videoSha256);
  let masterEpoch = doc.masterEpoch;
  if (doc.state.master && deleted.has(files.master)) {
    if (permanentMasterSha256 !== doc.state.master.fileSha256) throw new Error("لا أرشفة لـ Master: النسخة الدائمة لا تطابق بصمته المعتمدة.");
    masterEpoch = archivedEpoch(doc.state.master.fileSha256);
  }
  return { previewEpochs, assemblyEpoch, masterEpoch, archived };
};

const SCENE_DECISIONS = new Set(["submit-scene", "approve-scene", "correct-scene"]);

/**
 * يعيد بناء اعتمادات حلقة منشورة من أحداثها الموقّعة: لكل مشهد آخر حدث قرار عليه؛ إن كان approve-scene (بلا تحديث بعد
 * التجهيز يمسه بعده) يُعتمد ببصمة معاينته ووقته. ثم آخر assemble ← approve-assembly ← approve-master ← grant-publish
 * بالدوال الخالصة نفسها، فترمي إن لم تتسق الأحداث. لا يضيف قرارًا ليس في السجل.
 */
export const replayFromHistory = (state: SceneFirstProduction, history: AuditEvent[]): SceneFirstProduction => {
  const lastFor = (id: string) => [...history].reverse().find((h) =>
    (h.sceneId === id && SCENE_DECISIONS.has(h.action)) || (h.action === "update-after-preparation" && h.change?.scenes.some((x) => x.id === id)));
  let p: SceneFirstProduction = { ...state, assembly: undefined, master: undefined, scenes: state.scenes.map((s) => {
    const h = lastFor(s.id);
    if (h?.action !== "approve-scene") return s;
    return { id: s.id, sourceSha256: s.sourceSha256, status: "approved" as const, previewSha256: h.resultSha256,
      approval: { by: h.by, at: h.at, previewSha256: h.resultSha256, sourceSha256: s.sourceSha256 } };
  }) };
  const last = (action: string) => [...history].reverse().find((h) => h.action === action);
  const asm = last("assemble"), asmOk = last("approve-assembly"), mas = last("approve-master"), pub = last("grant-publish");
  if (!asm || !asmOk || !mas || !pub) throw new Error("لا سلسلة كاملة (تجميع ← اعتماده ← Master ← إذن نشر) في السجل.");
  if (!(asm.seq < asmOk.seq && asmOk.seq < mas.seq && mas.seq < pub.seq)) throw new Error("أحداث التجميع وMaster والنشر ليست بترتيبها في السجل.");
  const changedAfter = history.some((h) => h.seq > asm.seq && (SCENE_DECISIONS.has(h.action) || h.action === "update-after-preparation"));
  if (changedAfter) throw new Error("تغيّر مشهد بعد التجميع في السجل؛ لا استرجاع.");
  p = submitAssembly(p, asm.resultSha256);
  p = approveAssembly(p, { by: asmOk.by, at: asmOk.at, videoSha256: asmOk.resultSha256 });
  p = approveFinalMaster(p, { by: mas.by, at: mas.at, masterSha256: mas.resultSha256, assembledVideoSha256: asm.resultSha256 });
  p = grantPublish(p, { by: pub.by, at: pub.at, masterSha256: pub.resultSha256 });
  return p;
};
