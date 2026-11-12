import React, { useState } from "react";
import { api, type DriveHandoffRead } from "../api";
import { Hint } from "../shell/Screen";
import { arDigits } from "../ui/format";
import { OwnerText } from "../ui/OwnerText";

/**
 * «إلى Drive» في خطوة النشر (D53): النشر يدوي بالكامل بيد المالك. بعد «إذن النشر» يرسل الاستوديو الملفات
 * المعتمدة بجودتها الأصلية إلى مجلد Google Drive على جهازه. هذه البطاقة تعرض الحالة وزرًا واحدًا عند الحاجة.
 */
export type DriveView =
  | { kind: "hidden" }
  | { kind: "waiting-permission" }
  | { kind: "no-drive"; message: string }
  | { kind: "running"; pct: number; current: string }
  | { kind: "delivered"; folder: string; files: { name: string; size: number }[] }
  | { kind: "failed"; reason: string }
  | { kind: "not-sent" };

/** What the card shows, from the server status and the ledger read alone (pure, tested). */
export const driveView = (s: DriveHandoffRead | null, approved: boolean, publishAllowed: boolean, masterSha256: string | null): DriveView => {
  if (!approved) return { kind: "hidden" };
  if (!publishAllowed) return { kind: "waiting-permission" };
  if (!s) return { kind: "hidden" };
  if (s.job?.status === "running") return { kind: "running", pct: s.job.pct, current: s.job.current };
  if (!s.drive.found) return { kind: "no-drive", message: s.drive.message ?? "لم يُعثر على مجلد Google Drive." };
  const last = s.last;
  if (last?.status === "done" && last.masterSha256 === masterSha256)
    return { kind: "delivered", folder: last.folder, files: last.files.map((f) => ({ name: f.name, size: f.size })) };
  if (last?.status === "error") return { kind: "failed", reason: last.error };
  if (last?.status === "done") return { kind: "failed", reason: "في Drive نسخة نهائية أقدم من الملف المأذون الآن." };
  return { kind: "not-sent" };
};
/** One filled button per screen: the Drive card owns it when its action is the next step. */
export const driveOwnsPrimary = (v: DriveView) => v.kind === "delivered" || v.kind === "failed" || v.kind === "not-sent";

const sizeLabel = (n: number) => arDigits(n > 1e9 ? `${(n / 1e9).toFixed(2)} ج.ب` : n > 1e6 ? `${(n / 1e6).toFixed(1)} م.ب` : `${Math.max(1, Math.ceil(n / 1e3))} ك.ب`);
/** «balislam-publish/<القناة>/<الحلقة>» بدل المسار الكامل. */
const shortFolder = (folder: string) => folder.split("/").slice(-3).join("/");

export const DriveHandoffCard: React.FC<{ episodeId: string; view: DriveView; primary: boolean; onChanged: (s: DriveHandoffRead) => void }> = ({ episodeId, view, primary, onChanged }) => {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (view.kind === "hidden") return null;
  if (view.kind === "waiting-permission")
    return <p className="s45-note s45-drive">بعد «إذن النشر» تُنسخ الملفات بأعلى جودة إلى Google Drive، والنشر نفسه بيدك.</p>;
  /** Each action works directly on click (no passphrase, owner decision 9 Nov). */
  const act = async (fn: () => Promise<unknown>) => {
    setErr("");
    setBusy(true);
    try { await fn(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
    api.driveHandoff(episodeId).then(onChanged).catch(() => undefined);
  };
  const resend = (filled: boolean) => (
    <button type="button" className={`btn${filled ? " primary" : ""}`} disabled={busy}
      onClick={() => act(() => api.resendToDrive(episodeId))}>أعد الإرسال إلى Drive</button>
  );
  return (
    <section className="s45-kit s45-drive" aria-label="Google Drive">
      {view.kind === "running" ? (
        <div className="s45-job" role="status">
          <span className="s45-job-t">بانتظار… يُرسل إلى Drive</span>
          <span className="bar"><i style={{ width: `${view.pct}%` }} /></span>
          <span className="s45-job-n">{arDigits(Math.round(view.pct))}٪</span>
          {view.current ? <span className="s45-note s45-job-line" dir="ltr">{view.current}</span> : null}
        </div>
      ) : view.kind === "delivered" ? (
        <>
          <p className="s45-ok" role="status">أُرسلت إلى Drive ✓ <span dir="ltr">({shortFolder(view.folder)})</span></p>
          <ul className="s45-files">
            {view.files.map((f) => <li key={f.name}><code>{f.name}</code><span className="s45-note">{sizeLabel(f.size)}</span></li>)}
          </ul>
          <div className="s45-actions">
            <button type="button" className={`btn${primary ? " primary" : ""}`} disabled={busy}
              onClick={() => act(() => api.openDriveFolder(episodeId))}>افتح المجلد</button>
            {resend(false)}
          </div>
          <Hint>النسخة في مجلد Drive تشغل مساحة على القرص حتى يرفعها Drive. بعد اكتمال الرفع يمكنك جعلها «متاحة عبر الإنترنت فقط» من Finder؛ الاستوديو لا يحذف شيئًا لأنه لا يستطيع التأكد من اكتمال الرفع.</Hint>
        </>
      ) : view.kind === "no-drive" ? (
        <>
          <p className="s45-note" role="status">{view.message}</p>
          <div className="s45-actions">{resend(false)}</div>
        </>
      ) : (
        <>
          <p className={view.kind === "failed" ? "s45-alert" : "s45-note"} role="status">
            {view.kind === "failed" ? `فشل الإرسال إلى Drive: ${view.reason}` : "لم تُرسل الملفات إلى Drive بعد."}
          </p>
          <div className="s45-actions">{resend(primary)}</div>
        </>
      )}
      {err ? <p className="s45-alert" role="alert"><OwnerText text={err} /></p> : null}
    </section>
  );
};
