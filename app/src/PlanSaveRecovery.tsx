import React, { useEffect, useState } from "react";
import { OwnerText } from "./ui/OwnerText";
import type { Plan } from "../../src/plan/types";
import type { PlanSaveQueue } from "./planSaveQueue";
import { mergePlans } from "./planMerge";

/**
 * A plan edit that the server refused (D110). The owner is never trapped: the edit stays on the page and in a
 * browser backup, and there are three ways out, all by the owner's button:
 *  - «أعد محاولة الحفظ» (offline / busy);
 *  - «حمّل النسخة الأحدث وأعد تطبيق تعديلي» (409): a three-way merge of the edit onto the newest plan, then a save;
 *    a real conflict (the same field changed on both sides) applies nothing and names the places;
 *  - «افتح النسخة المحفوظة (بعد نسخة من تعديلي)»: downloads the edit, keeps it in this browser, then opens the
 *    saved plan, so navigation works again without a reload.
 */
export const backupKeyFor = (channel: string, episode: string) => `bal-unsaved-plan:${channel}/${episode}`;

/** The browser copy of an unsaved edit: the edit and the version it started from (for the three-way merge). */
export type PlanBackup = { at: string; plan: Plan; base?: Plan };
const keepInBrowser = (item: { channel: string; episode: string; value: Plan }, base?: Plan) => {
  try { localStorage.setItem(backupKeyFor(item.channel, item.episode), JSON.stringify({ at: new Date().toISOString(), plan: item.value, ...(base ? { base } : {}) })); }
  catch { /* private window or full storage: the download below is the backup */ }
};
export const readPlanBackup = (channel: string, episode: string): PlanBackup | null => {
  try {
    const raw = localStorage.getItem(backupKeyFor(channel, episode));
    if (!raw) return null;
    const b = JSON.parse(raw) as PlanBackup;
    return b && b.plan && Array.isArray(b.plan.chapters) ? b : null;
  } catch { return null; }
};
export const clearPlanBackup = (channel: string, episode: string) => {
  try { localStorage.removeItem(backupKeyFor(channel, episode)); } catch { /* nothing stored */ }
};
const download = (item: { channel: string; episode: string; value: Plan }) => {
  try {
    const url = URL.createObjectURL(new Blob([JSON.stringify(item.value, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = item.channel + "-" + item.episode + "-unsaved-plan.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch { /* the browser backup remains */ }
};

export const PlanSaveRecovery: React.FC<{
  queue: PlanSaveQueue<Plan>;
  conflict: boolean;
  retry: () => Promise<void>;
  latest: (channel: string, episode: string) => Promise<Plan>;
  revisionOf: (plan: Plan) => Promise<string>;
  /** The merged plan is now the page's plan (pending against the newest revision). */
  onPlan: (plan: Plan) => void;
  /** The edit was left (after its backup): open the saved plan of that episode. */
  onLeft: (channel: string, episode: string) => void;
}> = ({ queue, conflict, retry, latest, revisionOf, onPlan, onLeft }) => {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const item = queue.snapshot;
  useEffect(() => { if (item) keepInBrowser(item, queue.baseOf(item.channel, item.episode)); }, [item, queue]);
  if (!item) return null;

  const reapply = async () => {
    setBusy(true); setNote("");
    try {
      const theirs = await latest(item.channel, item.episode);
      const base = queue.baseOf(item.channel, item.episode);
      if (!base) { setNote("لا نعرف النسخة التي بدأ منها تعديلك، فلم نطبّقه. نزّل تعديلك، ثم افتح النسخة المحفوظة."); return; }
      const r = mergePlans(base, item.value, theirs);
      if (!r.ok) {
        const where = r.conflicts.slice(0, 4).join("، ") + (r.conflicts.length > 4 ? "…" : "");
        setNote(`تعديلك والنسخة الأحدث غيّرا الموضع نفسه (${where})، فلم نطبّق شيئًا. نزّل تعديلك، ثم افتح النسخة المحفوظة وأعد التعديل فيها.`);
        return;
      }
      queue.rebase(item.channel, item.episode, revisionOf(theirs), theirs, r.plan);
      onPlan(r.plan);
      await retry();
    } catch (e) {
      setNote((e as Error).message);
    } finally { setBusy(false); }
  };
  const leave = () => {
    if (!window.confirm("يُنزَّل تعديلك ملفًا ويُحفظ نسخة في هذا المتصفح، ثم تُفتح النسخة المحفوظة دون تعديلك. هل تتابع؟")) return;
    keepInBrowser(item, queue.baseOf(item.channel, item.episode));
    download(item);
    try { queue.discard(); } catch (e) { setNote((e as Error).message); return; }
    onLeft(item.channel, item.episode);
  };

  return (
    <section className="plan-save-recovery" role="alert" aria-label="تعديل خطة لم يُحفظ">
      <strong>لم تُحفظ الخطة؛ تعديلك ما زال في هذه الصفحة.</strong>
      <span>{conflict
        ? "تغيّرت الخطة في مكان آخر بعد أن فتحتها. يمكن تطبيق تعديلك فوق النسخة الأحدث، أو فتح النسخة المحفوظة بعد نسخة من تعديلك."
        : "أعد المحاولة. ويمكنك تنزيل تعديلك أو فتح النسخة المحفوظة بعد نسخة منه."}</span>
      {conflict
        ? <button type="button" className="btn primary" disabled={busy} onClick={() => { void reapply(); }}>حمّل النسخة الأحدث وأعد تطبيق تعديلي</button>
        : <button type="button" className="btn" disabled={busy} onClick={() => { void retry().catch(() => {}); }}>أعد محاولة الحفظ</button>}
      <button type="button" className="btn ghost" disabled={busy} onClick={() => download(item)}>نزّل نسخة تعديلك</button>
      <button type="button" className="btn ghost" disabled={busy} onClick={leave}>افتح النسخة المحفوظة (بعد نسخة من تعديلي)</button>
      {note ? <span className="plan-save-note" role="status"><OwnerText text={note} /></span> : null}
    </section>
  );
};

/**
 * «استعد تعديلي المحفوظ» (D110): a browser copy of an edit left by the way out (or by a reload while a save was
 * refused) is shown when the episode is open with nothing pending. Restoring re-applies it with the same
 * three-way merge onto the plan on screen; a real conflict applies nothing and keeps the copy. The copy is cleared
 * after the restored edit is saved (App.tsx), or by «احذف النسخة».
 */
export const PlanBackupRestore: React.FC<{
  channel: string; episode: string; backup: PlanBackup;
  /** the newest saved plan, read from the server */
  latest: () => Promise<Plan>;
  /** queue the merged edit as pending against `theirs`, and save it */
  apply: (merged: Plan, theirs: Plan) => Promise<void>;
  onDropped: () => void;
}> = ({ channel, episode, backup, latest, apply, onDropped }) => {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const when = (() => { try { return new Date(backup.at).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }); } catch { return ""; } })();
  const restore = async () => {
    setBusy(true); setNote("");
    try {
      const current = await latest();
      const r = mergePlans(backup.base ?? current, backup.plan, current);
      if (!r.ok) {
        const where = r.conflicts.slice(0, 4).join("، ") + (r.conflicts.length > 4 ? "…" : "");
        setNote(`تعديلك المحفوظ والنسخة الحالية غيّرا الموضع نفسه (${where})، فلم نطبّق شيئًا. نزّله وأعد التعديل يدويًا.`);
        return;
      }
      await apply(r.plan, current);
    } catch (e) { setNote((e as Error).message); } finally { setBusy(false); }
  };
  const drop = () => {
    if (!window.confirm("حذف النسخة المحفوظة في هذا المتصفح من تعديلك؟ لا يتغير شيء في الخطة.")) return;
    clearPlanBackup(channel, episode);
    onDropped();
  };
  return (
    <section className="plan-save-recovery" role="status" aria-label="تعديل محفوظ في المتصفح">
      <strong>في هذا المتصفح نسخة من تعديل لم يُحفظ{when ? ` (${when})` : ""}.</strong>
      <span>يمكن إعادة تطبيقها فوق الخطة الحالية؛ ما تغيّر في الموضع نفسه لا يُطبَّق ويُذكر.</span>
      <button type="button" className="btn primary" disabled={busy} onClick={() => { void restore(); }}>استعد تعديلي المحفوظ</button>
      <button type="button" className="btn ghost" disabled={busy} onClick={() => download({ channel, episode, value: backup.plan })}>نزّل النسخة</button>
      <button type="button" className="btn ghost" disabled={busy} onClick={drop}>احذف النسخة</button>
      {note ? <span className="plan-save-note" role="status"><OwnerText text={note} /></span> : null}
    </section>
  );
};
