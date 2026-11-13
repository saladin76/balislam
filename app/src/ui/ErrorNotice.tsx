import React, { useEffect, useState } from "react";
import { onStudioError, sendProblem, type StudioErrorEvent } from "../errorCapture";

/**
 * Not a crash of the screen, but an unexpected error all the same (D112): an error the page did not catch
 * (`window.onerror`, `unhandledrejection`) or one the server logged (a 500 with its number). One small card in the
 * corner: a plain Arabic sentence, «أرسل المشكلة», and the technical text folded under «تفاصيل» (D108).
 * The screen keeps working; nothing is cleared. A newer error replaces the card's content.
 */
export const ErrorNotice: React.FC<{ initial?: StudioErrorEvent }> = ({ initial }) => {
  const [ev, setEv] = useState<StudioErrorEvent | null>(initial ?? null);
  const [sent, setSent] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  // An error the owner closed does not come back on every poll that repeats it (same message).
  const [closed] = useState(() => new Set<string>());
  useEffect(() => onStudioError((e) => { if (closed.has(e.message)) return; setEv(e); setSent(null); }), [closed]);
  if (!ev) return null;
  const where = ev.source === "server" ? "في الاستوديو على جهازك" : "في هذه الصفحة";
  return (
    <aside className="error-notice" role="alert" aria-labelledby="error-notice-title">
      <div className="error-notice-head">
        <strong id="error-notice-title">حدث خطأ لم يُتوقع {where}</strong>
        <button type="button" className="error-notice-close" aria-label="إغلاق" onClick={() => { closed.add(ev.message); setEv(null); }}>×</button>
      </div>
      <p>لم يُمسح شيء ولم يُحذف. اضغط «أرسل المشكلة» فيصل الخطأ إلى Claude بتفاصيله، بلا صورة شاشة ولا شرح.</p>
      {sent ? <p role="status" className={sent.ok ? "is-ok" : "is-err"}>{sent.text}</p> : null}
      {!sent?.ok ? (
        <button type="button" className="btn primary" disabled={busy}
          onClick={async () => { setBusy(true); setSent(await sendProblem(ev.id)); setBusy(false); }}>
          {busy ? "يُرسل…" : "أرسل المشكلة"}
        </button>
      ) : null}
      <details className="owner-details">
        <summary>تفاصيل</summary>
        <code dir="ltr">{`${ev.message}\n[${ev.id}]`}</code>
      </details>
    </aside>
  );
};
