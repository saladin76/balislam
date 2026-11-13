import React, { useEffect, useRef, useState } from "react";
import { api, type NotesStatus } from "../api";
import { arDigits } from "./format";

/**
 * «ملاحظات لم تُرسل: N» (D107، العمل ٢ من مرحلة الاستقرار): كشف لحالة موجودة لا ميزة جديدة. يظهر في الشريط
 * العلوي حين يكون على هذا الجهاز ملاحظة واحدة أو أكثر لم تصل إلى صندوق Claude (`studio-notes`)، والضغط عليه
 * يقول السبب الحقيقي لآخر محاولة (D102)، ونص Git الأصلي تحت «تفاصيل». يسأل الخادم كل بضع ثوانٍ، وحين تتغير
 * الحالة يُعلم شاشة «المشاهد» فيتغير السطر تحت الملاحظة بلا تحديث للصفحة (KI-001).
 */
export const NOTES_STATUS_EVENT = "bal:notes-status";

/** السبب بكلمات المالك. */
export const notesReasonText = (s: Pick<NotesStatus, "reason" | "sending">): string =>
  s.reason === "offline" ? "لا اتصال بالإنترنت الآن. محفوظة على جهازك وتُرسل وحدها حين يعود الاتصال."
    : s.reason === "rejected" ? "تغيّر صندوق الملاحظات على GitHub أثناء الإرسال؛ يُعاد الإرسال وحده خلال دقائق."
    : s.reason === "auth" ? "لم تُرسل: GitHub لم يقبل صلاحية الدفع من هذا الجهاز (ليس انقطاع اتصال). محفوظة على جهازك؛ أخبر Claude."
    : s.reason === "not-owner" ? "هذه النسخة ليست استوديو المالك (نسخة تجريبية أو عمل أو سحابية)، فلا تُرسل ملاحظاتها إلى صندوقه."
    : s.reason ? "لم تُرسل: تعذّر الدفع إلى GitHub (ليس انقطاع اتصال). محفوظة على جهازك ويُعاد الإرسال وحده كل ١٠ دقائق؛ إن تكرر فأخبر Claude."
    : s.sending ? "تُرسل الآن…"
    : "لم تُجرَّب بعد؛ تُرسل وحدها خلال لحظات.";

export const NotesBadge: React.FC = () => {
  const [st, setSt] = useState<NotesStatus | null>(null);
  const [open, setOpen] = useState(false);
  const seen = useRef("");
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const s = await api.notesStatus();
        if (!alive) return;
        setSt(s);
        const key = `${s.pending}|${s.reason ?? ""}|${s.lastAttemptAt ?? ""}`;
        if (seen.current && key !== seen.current) window.dispatchEvent(new CustomEvent(NOTES_STATUS_EVENT, { detail: s }));
        seen.current = key;
      } catch { /* الخادم يُعاد تشغيله: المحاولة التالية */ }
    };
    void poll();
    const t = setInterval(poll, 4_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!st || st.pending <= 0) return null;
  const tone = st.sending && !st.reason ? " is-busy" : st.reason === "offline" || st.reason === "rejected" || !st.reason ? " is-warn" : " is-err";
  return (
    <div className={`ms-sync ms-notes${tone}`}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} title="ملاحظاتك إلى Claude">
        ملاحظات لم تُرسل: {arDigits(st.pending)}
      </button>
      {open ? (
        <div className="ms-sync-pop" role="dialog" aria-label="ملاحظات لم تُرسل">
          <div role="status">{notesReasonText(st)}</div>
          {st.where.length ? (
            <ul>{st.where.map((w) => <li key={`${w.channel}/${w.episode}`}>{w.channel} / {w.episode || "عام"}: {arDigits(w.count)}</li>)}</ul>
          ) : null}
          {st.detail ? (
            <details><summary>تفاصيل</summary><pre dir="ltr">{st.detail}</pre></details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
