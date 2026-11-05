/**
 * مراجعة كل مشهد بعد تنفيذه (scene-review.json بجوار السكريبت):
 * هل حركاته سليمة، ومتناسقة مع النص ووقت نطق كل كلمة، وليست عشوائية ولا غير منطقية؟
 * القرار مربوط ببصمة المشهد (القالب والإعدادات والتعليق والنبرة والصوت والخلفية):
 * أي تعديل بعد المراجعة يعيده «تغيّر بعد المراجعة». والنسخة النهائية لا تُصنع قبل مراجعة كل المشاهد.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Plan, PlanScene as Scene } from "./types";

export type SceneReviewStatus = "pending" | "changed" | "ok" | "fix";
export type SceneReviewEntry = { hash: string; status: "ok" | "fix"; note?: string; at: string };
export type SceneReviewLedger = { version: 1; scenes: Record<string, SceneReviewEntry> };
export type SceneReviewItem = { id: string; hash: string; status: SceneReviewStatus; note?: string; at?: string };
export type SceneReviewSummary = { total: number; ok: number; fix: number; pending: number; changed: number; done: boolean };

/** معايير المراجعة (تظهر في الاستوديو، وكلها شرط لاعتماد المشهد). */
export const SCENE_CRITERIA = [
  "الحركات سليمة: لا قفز ولا تداخل ولا عنصر يخرج من الإطار أو يختفي فجأة",
  "متناسقة مع النص: كل عنصر وحركة تظهر وقت نطق كلمتها وتخدم معنى الجملة",
  "ليست عشوائية ولا غير منطقية: لكل حركة سبب في الكلام، ولا مقطع ساكن فوق ثانيتين",
] as const;

export const sceneReviewFileFor = (scriptPath: string) => path.join(path.dirname(scriptPath), "scene-review.json");

export const sceneHash = (s: Scene) => {
  const props = Object.fromEntries(Object.entries(s.props ?? {}).filter(([, v]) => v !== "" && v != null).sort(([a], [b]) => a.localeCompare(b)));
  return createHash("sha1")
    .update(JSON.stringify({ v: 2, t: s.template, p: props, n: s.narration.trim(), tone: s.tone ?? "", voice: s.voice ?? "", bg: s.backdrop ?? "", duration: s.durationSec ?? null, sfx: s.sfx ?? [], overlays: s.overlays ?? {}, captions: s.captions ?? null, ayahKey: s.ayahKey ?? "", ...(s.transition ? { transition: s.transition } : {}) }))
    .digest("hex")
    .slice(0, 12);
};

export const sceneReviewItems = (plan: Plan, ledger: SceneReviewLedger | null): SceneReviewItem[] =>
  plan.chapters.flatMap((c) =>
    c.scenes.map((s) => {
      const hash = sceneHash(s);
      const e = ledger?.scenes[s.id];
      const status: SceneReviewStatus = !e ? "pending" : e.hash !== hash ? "changed" : e.status;
      return { id: s.id, hash, status, note: e?.note, at: e?.at };
    }),
  );

export const sceneReviewSummary = (items: SceneReviewItem[]): SceneReviewSummary => {
  const n = (s: SceneReviewStatus) => items.filter((i) => i.status === s).length;
  return { total: items.length, ok: n("ok"), fix: n("fix"), pending: n("pending"), changed: n("changed"), done: items.length > 0 && n("ok") === items.length };
};

export const loadSceneLedger = async (scriptPath: string): Promise<SceneReviewLedger> => {
  const f = sceneReviewFileFor(scriptPath);
  if (!existsSync(f)) return { version: 1, scenes: {} };
  try {
    return { version: 1, scenes: (JSON.parse(await readFile(f, "utf8")) as SceneReviewLedger).scenes ?? {} };
  } catch {
    return { version: 1, scenes: {} };
  }
};

export const setSceneReview = async (scriptPath: string, plan: Plan, id: string, status: "ok" | "fix" | "pending", note = "") => {
  const ledger = await loadSceneLedger(scriptPath);
  const scene = plan.chapters.flatMap((c) => c.scenes).find((s) => s.id === id);
  if (!scene) throw new Error("المشهد غير موجود في الخطة الحالية.");
  if (status === "pending") delete ledger.scenes[id];
  else {
    if (status === "fix" && !note.trim()) throw new Error("اكتب ما يحتاج إصلاحًا في الملاحظة.");
    ledger.scenes[id] = { hash: sceneHash(scene), status, note: note.trim() || undefined, at: new Date().toISOString() };
  }
  const live = new Set(plan.chapters.flatMap((c) => c.scenes.map((s) => s.id)));
  for (const k of Object.keys(ledger.scenes)) if (!live.has(k)) delete ledger.scenes[k];
  await writeFile(sceneReviewFileFor(scriptPath), JSON.stringify(ledger, null, 2) + "\n", "utf8");
  return sceneReviewItems(plan, ledger);
};

export const sceneReviewBlockMessage = (s: SceneReviewSummary, items: SceneReviewItem[]) => {
  const left = items.filter((i) => i.status !== "ok").map((i) => i.id);
  return `مراجعة المشاهد غير مكتملة: ${s.ok} من ${s.total} مشهدًا سليمًا${s.fix ? `، ${s.fix} يحتاج إصلاحًا` : ""}${s.changed ? `، ${s.changed} تغيّر بعد المراجعة` : ""}${s.pending ? `، ${s.pending} لم يُراجع` : ""} (${left.slice(0, 8).join("، ")}${left.length > 8 ? "…" : ""}). راجع كل مشهد من «المشاهد ← مراجعة المشهد» ثم اصنع النسخة النهائية.`;
};
