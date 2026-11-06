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

/** Visual/storyboard identity is deliberately independent of later tone and voice decisions.
 * Voice-only edits must not reset an already reviewed picture. Narration/shot edits still do. */
export const storyboardHash = (s: PlanScene): string => {
  const props = Object.fromEntries(Object.entries(s.props ?? {})
    .filter(([, v]) => v !== "" && v != null)
    .sort(([a], [b]) => a.localeCompare(b)));
  return createHash("sha1").update(JSON.stringify({
    v: 3, t: s.template, p: props, n: s.narration.trim(),
    bg: s.backdrop ?? "", duration: s.durationSec ?? null,
    sfx: s.sfx ?? [], overlays: s.overlays ?? {},
    captions: s.captions ?? null, ayahKey: s.ayahKey ?? "",
    ...(s.transition ? { transition: s.transition } : {}),
  })).digest("hex").slice(0, 12);
};

/** Backward-compatible: existing approvals with the older full-scene hash remain valid
 * until the visual or voice decisions themselves change; new approvals use visual v3. */
const storyboardMatches = (saved: string, scene: PlanScene) =>
  saved === storyboardHash(scene) || saved === sceneHash(scene);

export const storyboardFileFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "storyboard.json");

/**
 * Keep a readable, stable storyboard snapshot separate from source plans.
 * Cloud sync is opt-in and never blocks approval or revocation.
 */
const syncStoryboardFiles = async (scriptPath: string, markdown: string) => {
  const { uploadCloudPreview } = await import("../render/cloudPreview");
  const folder = path.dirname(scriptPath);
  const episode = path.basename(folder);
  const sheet = path.join(folder, "storyboard-review.md");
  await writeFile(sheet, markdown);
  await uploadCloudPreview(storyboardFileFor(scriptPath), episode, "approval-record", "storyboard");
  await uploadCloudPreview(sheet, episode, "review-sheet", "storyboard");
};

const storyboardSheet = (plan: Plan, approved: boolean) => {
  const lines = [
    "# Storyboard — " + plan.title.replace(/\n/g, " "),
    "",
    "Episode: " + plan.episode,
    "Approval: " + (approved ? "approved" : "revoked"),
    "Generated: " + new Date().toISOString(),
    "",
  ];
  for (const chapter of plan.chapters) {
    lines.push("## " + chapter.number + " — " + chapter.title.replace(/\n/g, " "), "");
    for (const scene of chapter.scenes) {
      lines.push("### " + scene.id + " — " + scene.template);
      lines.push("", "**Narration:** " + scene.narration.replace(/\n/g, " "), "");
      lines.push("**On-screen / visual properties:**");
      for (const [key, value] of Object.entries(scene.props)) {
        lines.push("- " + key + ": " + String(value).replace(/\n/g, " "));
      }
      lines.push("");
    }
  }
  return lines.join("\n") + "\n";
};


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
    scenes[s.id] = !h ? "new" : storyboardMatches(h, s) ? "approved" : "changed";
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
  if (missing.length) throw new Error(`لا يُعتمد الستوري بورد وفيه ${missing.length} آية بلا نصها (${missing.slice(0, 6).join("، ")}${missing.length > 6 ? "…" : ""}). اجلب نصوص الآيات أولًا: زر «اجلب نصوص الآيات» في الاستوديو.`);
  const rec: StoryboardRecord = {
    version: 1,
    approvedAt: new Date().toISOString(),
    audit: audit ? { ...audit, at: new Date().toISOString() } : undefined,
    scenes: Object.fromEntries(plan.chapters.flatMap((c) => c.scenes).map((s) => [s.id, storyboardHash(s)])),
  };
  await writeFile(storyboardFileFor(scriptPath), JSON.stringify(rec, null, 2) + "\n");
  try {
    await syncStoryboardFiles(scriptPath, storyboardSheet(plan, true));
  } catch (error) {
    console.warn("STORYBOARD_CLOUD_FAILED: " + (error as Error).message);
  }
  return rec;
};

/** سحب الاعتماد (يعيد الحلقة إلى «لم يُعتمد»). */
export const revokeStoryboard = async (scriptPath: string): Promise<StoryboardRecord> => {
  const rec: StoryboardRecord = { version: 1, scenes: {} };
  await writeFile(storyboardFileFor(scriptPath), JSON.stringify(rec, null, 2) + "\n");
  try {
    await syncStoryboardFiles(scriptPath, "# Storyboard — approval revoked\n\nNo approved storyboard is current for this episode.\n");
  } catch (error) {
    console.warn("STORYBOARD_CLOUD_FAILED: " + (error as Error).message);
  }
  return rec;
};

/** المشاهد المطلوبة غير المعتمدة في الستوري بورد (للصوت: المشاهد التي سيُولَّد صوتها فقط). */
export const unapprovedScenes = (status: StoryboardStatus, ids?: string[]) => (ids ?? Object.keys(status.scenes)).filter((i) => status.scenes[i] !== "approved");

export const storyboardBlockMessage = (ids: string[], status: StoryboardStatus) => {
  const head = status.approved === 0 && !status.changed.length ? "لم يُعتمد الستوري بورد بعد" : `${ids.length} مشهدًا غير معتمد في الستوري بورد`;
  const list = ids.slice(0, 8).join("، ") + (ids.length > 8 ? "…" : "");
  return `${head} (${list}). لا يُولَّد صوت ولا تُصنع النسخة النهائية قبل اعتماده: «المشاهد ← ستوري بورد» في الاستوديو.`;
};
