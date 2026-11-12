import React, { useEffect, useState } from "react";
import type { Plan } from "../../src/plan/types";
import type { PlanSaveQueue } from "./planSaveQueue";
import { mergePlans } from "./planMerge";

/**
 * A plan edit that the server refused (D107). The owner is never trapped: the edit stays on the page and in a
 * browser backup, and there are three ways out, all by the owner's button:
 *  - «أعد محاولة الحفظ» (offline / busy);
 *  - «حمّل النسخة الأحدث وأعد تطبيق تعديلي» (409): a three-way merge of the edit onto the newest plan, then a save;
 *    a real conflict (the same field changed on both sides) applies nothing and names the places;
 *  - «افتح النسخة المحفوظة (بعد نسخة من تعديلي)»: downloads the edit, keeps it in this browser, then opens the
 *    saved plan, so navigation works again without a reload.
 */
export const backupKeyFor = (channel: string, episode: string) => `bal-unsaved-plan:${channel}/${episode}`;

const keepInBrowser = (item: { channel: string; episode: string; value: Plan }) => {
  try { localStorage.setItem(backupKeyFor(item.channel, item.episode), JSON.stringify({ at: new Date().toISOString(), plan: item.value })); }
  catch { /* private window or full storage: the download below is the backup */ }
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
  useEffect(() => { if (item) keepInBrowser(item); }, [item]);
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
    keepInBrowser(item);
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
      {note ? <span className="plan-save-note" role="status">{note}</span> : null}
    </section>
  );
};
