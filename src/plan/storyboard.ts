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
import type { Plan } from "./types";

export type StoryboardRecord = { version: 1; approvedAt?: string; scenes: Record<string, string> };
export type StoryboardSceneStatus = "approved" | "changed" | "new";
export type StoryboardStatus = {
  total: number;
  approved: number;
  changed: string[];
  fresh: string[];
  /** كل المشاهد معتمدة ببصمتها الحالية */
  ok: boolean;
  approvedAt?: string;
  scenes: Record<string, StoryboardSceneStatus>;
};

export const storyboardFileFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "storyboard.json");

export const loadStoryboard = async (scriptPath: string): Promise<StoryboardRecord> => {
  const f = storyboardFileFor(scriptPath);
  if (!existsSync(f)) return { version: 1, scenes: {} };
  try {
    const r = JSON.parse(await readFile(f, "utf8")) as StoryboardRecord;
    return { version: 1, approvedAt: r.approvedAt, scenes: r.scenes ?? {} };
  } catch {
    return { version: 1, scenes: {} };
  }
};

export const storyboardStatus = (plan: Plan, rec: StoryboardRecord): StoryboardStatus => {
  const scenes: Record<string, StoryboardSceneStatus> = {};
  for (const s of plan.chapters.flatMap((c) => c.scenes)) {
    const h = rec.scenes[s.id];
    scenes[s.id] = !h ? "new" : h === sceneHash(s) ? "approved" : "changed";
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
    scenes,
  };
};

/** اعتماد الستوري بورد كما هو الآن (كل المشاهد ببصماتها الحالية). */
export const approveStoryboard = async (scriptPath: string, plan: Plan): Promise<StoryboardRecord> => {
  const rec: StoryboardRecord = {
    version: 1,
    approvedAt: new Date().toISOString(),
    scenes: Object.fromEntries(plan.chapters.flatMap((c) => c.scenes).map((s) => [s.id, sceneHash(s)])),
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
