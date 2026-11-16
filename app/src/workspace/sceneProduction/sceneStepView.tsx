/**
 * Step ٢ «المشاهد»: what the scene on screen is (its place, its state, the one lock reason, the keyboard and the
 * dock's edges), computed on each render from the panel's state. Display only; no hook and no server call here.
 */
import React from "react";
import { api } from "../../api";
import { sceneSeconds } from "../../../../src/plan/duration";
import { Icon } from "../../ui/icons";
import { Num } from "../../ui/format";
import type { SceneProductionProps } from "../SceneProductionPanel";
import type { SceneProductionModel } from "./useSceneProduction";
import type { ActionLock } from "./SceneDecisionActions";
import { ar } from "./notes";
import { SCENE_STATE_LABEL, nextUnapproved, sceneStateOf } from "./sceneStates";

export const sceneStepView = (m: SceneProductionModel, p: SceneProductionProps, shownId: string) => {
  const { data, error, pending, reviewed, setViewId, setProblem, setConfirming, problem, confirming, currentId, nextOpenId, scene, draftReady,
    planScenes, issues, order, prepJob, moreRef, reviewCurrent } = m;
  const { episodeId, media } = p;
  const hit = planScenes.find((x) => x.scene.id === shownId);
  const shownIdx = order.indexOf(shownId);
  const shownServer = data?.scenes.find((s) => s.id === shownId);
  const isCurrent = Boolean(data && shownId === currentId && scene);
  const shownVideo = data?.candidates?.scenes[shownId] ? api.scenePreviewUrl(episodeId, shownId, data.candidates.scenes[shownId]) : "";
  const blocking = issues.filter((i) => i.level === "error").length;
  const approvedCount = data?.progress.approvedScenes ?? 0;
  const openIssues = () => {
    const d = moreRef.current?.querySelector("details");
    if (d) { d.open = true; d.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
  };
  // D145: each scene shows its OWN state (no «ينتظر دوره»): لم يُنتج / جاهز للمراجعة / معتمد / بانتظار التعديل / مشروط بالتلاوة
  const statusOf = (id: string) => sceneStateOf(data?.scenes.find((x) => x.id === id));
  const status = statusOf(shownId);
  const prepRunning = prepJob?.status === "running";
  const preparing: "now" | "queued" | null = !prepRunning || !currentId ? null
    : prepJob!.sceneId === currentId ? "now"
    : prepJob!.skipped?.some((x) => x.id === currentId) || prepJob!.failed.some((x) => x.id === currentId) ? null : "queued";
  // The scene on screen is approved (or the state is not read yet): one reason and one way on, never a disabled bar.
  // Any scene not approved is decided right here, whatever the scenes before it (D145).
  const ahead = data ? nextUnapproved(data.scenes, shownId) : null;
  const lock: ActionLock | undefined = !data
    ? { reason: error ? "تعذّر تحميل حالة الحلقة؛ أعد فتحها." : "جارٍ تحميل حالة الحلقة…" }
    : !isCurrent && nextOpenId
      ? { reason: shownServer?.conditional ? "اعتُمد هذا المشهد مشروطًا بالتلاوة؛ يُفتح وحده حين ترفع تلاوته. أي تعديل فيه يعيده للمراجعة."
          : "اعتُمد هذا المشهد. أي تعديل فيه يعيده وحده للمراجعة.",
        ...(ahead ? { action: { label: `إلى المشهد ${ar(order.indexOf(ahead) + 1)} (غير معتمد)`, onClick: () => setViewId(ahead) } } : {}) }
      : !isCurrent
        ? { reason: "لا مشهد ينتظر قرارًا الآن." }
        : undefined;
  const reviewReady = Boolean(isCurrent && scene && ((scene.status === "in_review" && scene.previewSha256) || draftReady));
  const stateText = status === "todo" && preparing === "now" ? "يُجهَّز الآن"
    : status === "todo" && scene?.status === "needs_revision" ? "عُدّل؛ يحتاج إنتاجًا جديدًا"
    : SCENE_STATE_LABEL[status];
  const go = (delta: number) => {
    const i = shownIdx + delta;
    if (i < 0 || i >= order.length) return;
    setViewId(order[i]!);
    setProblem(null); setConfirming(false);
  };
  const approveNow = () => {
    if (!reviewReady || pending) return;
    if (!reviewed) { setProblem(null); setConfirming(true); return; }
    void reviewCurrent("approve-scene");
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key === "Escape") { if (problem || confirming) { setProblem(null); setConfirming(false); } return; }
    const t = e.target as HTMLElement | null;
    if (t?.closest?.("input, textarea, select, [contenteditable='true'], [role='dialog'], .modal")) return;
    if (typeof document !== "undefined" && document.querySelector(".ms-pop, .modal")) return;
    if (e.key === "ArrowLeft") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(-1); }
    else if (e.key === "Enter" && !t?.closest?.("button, a, summary") && isCurrent && reviewReady && !problem) { e.preventDefault(); approveNow(); }
  };
  const secs = (id: string) => { const x = planScenes.find((y) => y.scene.id === id)?.scene; return x ? Math.max(1, sceneSeconds(x, media?.voice ? { voice: media.voice, recitations: media.recitations ?? {} } : undefined)) : 4; };
  const fixes = (data?.scenes ?? []).filter((x) => x.status === "needs_revision");
  const nav = {
    prev: <button type="button" className="ms-nv" onClick={() => go(-1)} disabled={shownIdx <= 0} aria-label="المشهد السابق" title="المشهد السابق (→)"><Icon name="chevR" /></button>,
    next: <button type="button" className="ms-nv" onClick={() => go(1)} disabled={shownIdx >= order.length - 1} aria-label="المشهد التالي" title="المشهد التالي (←)"><Icon name="chev" /></button>,
    count: <><b><Num>{approvedCount}</Num></b> من <Num>{order.length}</Num> معتمدة</>,
  };
  return { shownId, hit, shownIdx, shownServer, isCurrent, shownVideo, blocking, approvedCount, openIssues, statusOf, status, preparing, lock, reviewReady, stateText, onKey, secs, fixes, nav };
};

export type SceneStepView = ReturnType<typeof sceneStepView>;
/** What every visible part of step ٢ reads: the panel's state, its props, and the scene on screen. */
export type StepPart = { m: SceneProductionModel; p: SceneProductionProps; v: SceneStepView };
