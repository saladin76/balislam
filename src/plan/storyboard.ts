/**
 * ستوري بورد الفيديو قبل تنفيذه (المبدأ الثالث في CLAUDE.md، لكل القنوات):
 * لقطة لكل مشهد مع نصه وما يظهر على الشاشة وعناصره، يعتمدها صاحب القناة قبل أي صوت أو نسخة نهائية.
 * الاعتماد في storyboard.json بجوار السكريبت، مربوط ببصمة كل مشهد (sceneHash):
 * مشهد تغيّر بعد الاعتماد يعود «تغيّر بعد الاعتماد» ولا يُولَّد صوته حتى يُعتمد من جديد.
 */
import { existsSync } from "node:fs";
import { readJsonFile, writeJsonAtomic } from "../io/atomicJson";
import path from "node:path";
import { sceneHash } from "./sceneReview";
import { createHash } from "node:crypto";
import type { PlanScene } from "./types";
import type { Plan } from "./types";
import { VERSE_PLACEHOLDER } from "./quranText";
import { HORIZON_BOARD_VIEW } from "./storyboardView";

export type StoryboardAudit = { note: string; inputHash?: string; at: string; /** Only these boards were recorded by this note (a re-review of changed boards). */ scenes?: string[] };
export type StoryboardRecord = { version: 1; approvedAt?: string; scenes: Record<string, string>; audit?: StoryboardAudit;
  /** Earlier review notes, oldest first (kept when only the changed boards are re-recorded). */
  history?: StoryboardAudit[] };
export type StoryboardSceneStatus = "approved" | "changed" | "new";
export type StoryboardStatus = {
  total: number;
  approved: number;
  changed: string[];
  fresh: string[];
  /** كل المشاهد معتمدة ببصمتها الحالية */
  ok: boolean;
  approvedAt?: string;
  audit?: StoryboardRecord["audit"];
  scenes: Record<string, StoryboardSceneStatus>;
};

/** A visual approval must survive the LATER selection of voice and tone.
 * Changing displayed scene content, narration, layout or timing still invalidates it.
 * Legacy full-scene hash records remain readable, never auto-migrated/approved.
 */
export const storyboardVisualHash = (scene: PlanScene): string => {
  const props = Object.fromEntries(Object.entries(scene.props ?? {})
    .filter(([, value]) => value != null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right)));
  return createHash("sha1").update(JSON.stringify({
    version: 3, template: scene.template, props, narration: scene.narration.trim(),
    backdrop: scene.backdrop ?? "", durationSec: scene.durationSec ?? null,
    sfx: scene.sfx ?? [], overlays: scene.overlays ?? {}, captions: scene.captions ?? null,
    ayahKey: scene.ayahKey ?? "", transition: scene.transition ?? "",
    // «خط الأفق»: اللوحة المعروضة تتبع طريقة اختيار لحظتها؛ تغييرها يعيد فتح الستوري بورد لتلك المشاهد وحدها
    ...(scene.template === "horizon-shot" ? { board: HORIZON_BOARD_VIEW } : {}),
  })).digest("hex").slice(0, 12);
};
const matchesVisual = (saved: string, scene: PlanScene) =>
  saved === storyboardVisualHash(scene) || saved === sceneHash(scene);

export const storyboardFileFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "storyboard.json");

export const loadStoryboard = async (scriptPath: string): Promise<StoryboardRecord> => {
  const f = storyboardFileFor(scriptPath);
  if (!existsSync(f)) return { version: 1, scenes: {} };
  try {
    // يُعاد مرة عند خطأ القراءة؛ وملف تالف بعدها = «لم يُعتمد» (إغلاق آمن)
    const r = await readJsonFile<StoryboardRecord>(f);
    if (!r) return { version: 1, scenes: {} };
    return { version: 1, approvedAt: r.approvedAt, scenes: r.scenes ?? {}, audit: r.audit, ...(Array.isArray(r.history) ? { history: r.history } : {}) };
  } catch {
    return { version: 1, scenes: {} };
  }
};

export const storyboardStatus = (plan: Plan, rec: StoryboardRecord): StoryboardStatus => {
  const scenes: Record<string, StoryboardSceneStatus> = {};
  for (const s of plan.chapters.flatMap((c) => c.scenes)) {
    const h = rec.scenes[s.id];
    scenes[s.id] = !h ? "new" : matchesVisual(h, s) ? "approved" : "changed";
  }
  const ids = Object.keys(scenes);
  const approved = ids.filter((i) => scenes[i] === "approved").length;
  return {
    total: ids.length,
    approved,
    changed: ids.filter((i) => scenes[i] === "changed"),
    fresh: ids.filter((i) => scenes[i] === "new"),
    ok: ids.length > 0 && approved === ids.length,
    approvedAt: rec.approvedAt,
    audit: rec.audit,
    scenes,
  };
};

/** اعتماد الستوري بورد كما هو الآن (كل المشاهد ببصماتها الحالية). */
/** بطاقات الآيات التي لم يُجلب نصها بعد: لا يُعتمد ستوري بورد يعرض نصًا مؤقتًا مكان كلام الله. */
export const versesMissingText = (plan: Plan) =>
  plan.chapters.flatMap((c) => c.scenes).filter((s) => s.template === "verse-card" && (!s.props.text?.trim() || s.props.text === VERSE_PLACEHOLDER)).map((s) => s.id);

export const approveStoryboard = async (scriptPath: string, plan: Plan, audit?: { note: string; inputHash?: string }): Promise<StoryboardRecord> => {
  const missing = versesMissingText(plan);
  if (missing.length) throw new Error(`لا يُعتمد الستوري بورد وفيه ${missing.length} آية بلا نصها (${missing.slice(0, 6).join("، ")}${missing.length > 6 ? "…" : ""}). أضف نص الآيات كاملًا داخل السكريبت وراجعه قبل الاعتماد.`);
  const rec: StoryboardRecord = {
    version: 1,
    approvedAt: new Date().toISOString(),
    audit: audit ? { ...audit, at: new Date().toISOString() } : undefined,
    scenes: Object.fromEntries(plan.chapters.flatMap((c) => c.scenes).map((s) => [s.id, storyboardVisualHash(s)])),
  };
  await writeJsonAtomic(storyboardFileFor(scriptPath), rec);
  return rec;
};

/**
 * P-05: re-record ONLY the boards that changed (or are new) since the last board review, after the owner reviewed
 * them. The other boards keep their recorded fingerprint byte for byte, so their scenes' inputs (sceneService
 * `sourceSha256`) do not change and no approved scene is re-opened; boards of removed scenes are dropped.
 * The earlier note is kept in `history`. Refuses when nothing was recorded before (that is the full review).
 */
export const recordChangedBoards = async (scriptPath: string, plan: Plan, audit: { note: string; inputHash?: string }): Promise<{ record: StoryboardRecord; scenes: string[] }> => {
  const missing = versesMissingText(plan);
  if (missing.length) throw new Error(`لا تُعتمد اللوحات وفيها ${missing.length} آية بلا نصها (${missing.slice(0, 6).join("، ")}${missing.length > 6 ? "…" : ""}). أضف نص الآيات كاملًا داخل السكريبت وراجعه قبل الاعتماد.`);
  const prev = await loadStoryboard(scriptPath);
  if (!prev.audit?.note?.trim()) throw new Error("لم تُسجَّل مراجعة اللوحات من قبل: راجع اللوحات كلها واعتمد التجهيز.");
  const st = storyboardStatus(plan, prev);
  const changed = [...st.changed, ...st.fresh];
  const all = plan.chapters.flatMap((c) => c.scenes);
  const at = new Date().toISOString();
  const record: StoryboardRecord = {
    version: 1,
    approvedAt: at,
    audit: { ...audit, at, scenes: changed },
    history: [...(prev.history ?? []), prev.audit],
    scenes: Object.fromEntries(all.map((s) => [s.id, st.scenes[s.id] === "approved" ? prev.scenes[s.id]! : storyboardVisualHash(s)])),
  };
  await writeJsonAtomic(storyboardFileFor(scriptPath), record);
  return { record, scenes: changed };
};

/** سحب الاعتماد (يعيد الحلقة إلى «لم يُعتمد»). */
export const revokeStoryboard = async (scriptPath: string): Promise<StoryboardRecord> => {
  const rec: StoryboardRecord = { version: 1, scenes: {} };
  await writeJsonAtomic(storyboardFileFor(scriptPath), rec);
  return rec;
};

/** المشاهد المطلوبة غير المعتمدة في الستوري بورد (للصوت: المشاهد التي سيُولَّد صوتها فقط). */
export const unapprovedScenes = (status: StoryboardStatus, ids?: string[]) => (ids ?? Object.keys(status.scenes)).filter((i) => status.scenes[i] !== "approved");

/**
 * Why voice / the final file is refused for boards that are not recorded, and exactly where to fix it:
 * step ١ «التجهيز» (the storyboard opens first there). A board changed after the approval is listed at the
 * top of that screen with one button that re-approves only the changed boards.
 */
export const storyboardBlockMessage = (ids: string[], status: StoryboardStatus) => {
  const list = ids.slice(0, 8).join("، ") + (ids.length > 8 ? "…" : "");
  if (status.approved === 0) return `لم يُعتمد التجهيز بعد (${list}). لا يُولَّد صوت ولا تُصنع النسخة النهائية قبله: افتح «١ التجهيز» في الاستوديو، راجع اللوحات والسكريبت، ثم اضغط «اعتمد التجهيز».`;
  return `${ids.length === 1 ? "لوحة تغيّرت" : `${ids.length} لوحات تغيّرت`} بعد اعتماد التجهيز (${list}). لا يُولَّد صوتها ولا تُصنع النسخة النهائية حتى تُعتمد: افتح «١ التجهيز»، فاللوحات المتغيّرة في أعلاه، واضغط «اعتمد اللوحات المتغيّرة».`;
};
