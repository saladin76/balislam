/**
 * ستوري بورد الفيديو قبل تنفيذه (المبدأ الثالث في CLAUDE.md، لكل القنوات):
 * لقطة لكل مشهد مع نصه وما يظهر على الشاشة وعناصره، يعتمدها صاحب القناة قبل أي صوت أو نسخة نهائية.
 * الاعتماد في storyboard.json بجوار السكريبت، مربوط ببصمة كل مشهد (sceneHash):
 * مشهد تغيّر بعد الاعتماد يعود «تغيّر بعد الاعتماد» ولا يُولَّد صوته حتى يُعتمد من جديد.
 */
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { sceneHash } from "./sceneReview";
import { createHash } from "node:crypto";
import type { PlanScene } from "./types";
import type { Plan } from "./types";
import { VERSE_PLACEHOLDER } from "./quranText";
import { HORIZON_BOARD_VIEW } from "./storyboardView";

export type StoryboardRecord = { version: 1; approvedAt?: string; scenes: Record<string, string>; audit?: { note: string; inputHash?: string; at: string } };
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
    const r = JSON.parse(await readFile(f, "utf8")) as StoryboardRecord;
    return { version: 1, approvedAt: r.approvedAt, scenes: r.scenes ?? {}, audit: r.audit };
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
  await writeFile(storyboardFileFor(scriptPath), JSON.stringify(rec, null, 2) + "\n");
  return rec;
};

/** سحب الاعتماد (يعيد الحلقة إلى «لم يُعتمد»). */
export const revokeStoryboard = async (scriptPath: string): Promise<StoryboardRecord> => {
  const rec: StoryboardRecord = { version: 1, scenes: {} };
  await writeFile(storyboardFileFor(scriptPath), JSON.stringify(rec, null, 2) + "\n");
  return rec;
};

/** المشاهد المطلوبة غير المعتمدة في الستوري بورد (للصوت: المشاهد التي سيُولَّد صوتها فقط). */
export const unapprovedScenes = (status: StoryboardStatus, ids?: string[]) => (ids ?? Object.keys(status.scenes)).filter((i) => status.scenes[i] !== "approved");

export const storyboardBlockMessage = (ids: string[], status: StoryboardStatus) => {
  const head = status.approved === 0 && !status.changed.length ? "لم يُعتمد الستوري بورد بعد" : `${ids.length} مشهدًا غير معتمد في الستوري بورد`;
  const list = ids.slice(0, 8).join("، ") + (ids.length > 8 ? "…" : "");
  return `${head} (${list}). لا يُولَّد صوت ولا تُصنع النسخة النهائية قبل اعتماده: «المشاهد ← ستوري بورد» في الاستوديو.`;
};
