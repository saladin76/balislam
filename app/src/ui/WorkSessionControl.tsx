import React, { useEffect, useState } from "react";
import { api, type WorkSessionStatus } from "../api";
import { arDigits } from "./format";
import { OwnerText } from "./OwnerText";

/**
 * «ابدأ جلسة عمل — عالج ملاحظاتي تلقائيًا» (D141): في رأس الاستوديو، واحد لكل القنوات. يكتب الاستوديو علمًا على
 * studio-notes (`notes/work-session.json`)، ومهمة مجدولة في السحابة تقرؤه كل ساعة، ثم تعيد مراجعة الملاحظات كل ٥ دقائق
 * ما دامت الجلسة شغّالة. تنتهي الجلسة وحدها عند وقتها، أو بـ«أوقف». ويُظهر آخر ملاحظة عولجت (resolved.json بعد السحب).
 */
export const WORK_SESSION_LABELS: Record<number, string> = { 1: "ساعة", 2: "ساعتان", 3: "٣ ساعات" };
export const WORK_SESSION_START_LABEL = "ابدأ جلسة عمل — عالج ملاحظاتي تلقائيًا";
/** The header line in two parts (owner review, 18 Nov): the part after « — » steps aside on a narrower screen
 * (shell.css .ms-work-more), so the button never runs over the views in the middle; its name stays whole. */
export const LabelParts: React.FC<{ text: string }> = ({ text }) => {
  const i = text.indexOf(" — ");
  return i < 0 ? <>{text}</> : <><span>{text.slice(0, i)}</span><span className="ms-work-more">{text.slice(i)}</span></>;
};
export const WORK_SESSION_FIRST_REVIEW_HINT = "أول مراجعة تبدأ خلال ساعة على الأكثر، ثم كل ٥ دقائق";

/** «HH:MM» بتوقيت جهاز المالك، بأرقام عربية. */
export const clockText = (iso: string, d = new Date(iso)) =>
  arDigits(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
export const workSessionLiveLabel = (until: string) => `جلسة العمل شغّالة حتى ${clockText(until)} — تُراجَع ملاحظاتك كل ٥ دقائق`;

/** لماذا لم يصل العلم إلى GitHub، بكلمات المالك. */
export const workSessionPushText = (push: WorkSessionStatus["push"]): string | null => {
  if (!push || push.state !== "failed") return null;
  const r = push.reason;
  return r === "offline" ? "لم تصل جلسة العمل إلى GitHub: لا اتصال بالإنترنت الآن. يُعاد الإرسال وحده حين يعود الاتصال."
    : r === "auth" ? "لم تصل جلسة العمل إلى GitHub: لم يقبل GitHub صلاحية الدفع من هذا الجهاز (ليس انقطاع اتصال). أخبر Claude."
    : r === "rejected" ? "لم تصل جلسة العمل إلى GitHub بعد: تغيّر صندوق الملاحظات أثناء الإرسال؛ يُعاد وحده خلال دقائق."
    : r === "not-owner" ? "هذه النسخة ليست استوديو المالك (نسخة تجريبية أو عمل أو سحابية)، فلا تكتب جلسة العمل في صندوقه."
    : "لم تصل جلسة العمل إلى GitHub: تعذّر الدفع (ليس انقطاع اتصال). يُعاد وحده خلال دقائق؛ إن تكرر فأخبر Claude.";
};

/** «آخر ملاحظة عولجت: …» */
export const lastResolvedText = (lr: WorkSessionStatus["lastResolved"], live: boolean): string => {
  if (!lr) return "لم تُعالَج ملاحظة بعد.";
  const d = new Date(lr.at);
  const today = new Date().toDateString() === d.toDateString();
  const when = today ? clockText(lr.at) : `${arDigits(`${d.getDate()}/${d.getMonth() + 1}`)} ${clockText(lr.at)}`;
  return `آخر ملاحظة عولجت: ${when}${live && lr.sinceStart ? ` (${arDigits(lr.sinceStart)} منذ بدء الجلسة)` : ""}`;
};

export const WorkSessionControl: React.FC = () => {
  const [st, setSt] = useState<WorkSessionStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justStarted, setJustStarted] = useState(false);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try { const s = await api.workSession(); if (alive) setSt(s); } catch { /* الخادم يُعاد تشغيله */ }
    };
    void poll();
    const t = setInterval(poll, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  // تنتهي وحدها عند وقتها: يتغير الزر في اللحظة نفسها ولو لم يحن السؤال التالي.
  useEffect(() => {
    if (!st?.live || !st.session) return;
    const ms = Date.parse(st.session.until) - Date.now();
    const t = setTimeout(() => { void api.workSession().then(setSt).catch(() => undefined); }, Math.max(1_000, ms + 1_000));
    return () => clearTimeout(t);
  }, [st?.live, st?.session?.until]);

  const act = async (work: () => Promise<WorkSessionStatus>, started = false) => {
    setBusy(true); setError(null);
    try { const s = await work(); setSt(s); setJustStarted(started && s.live); if (!started) setOpen(false); }
    catch (e) { setError((e as Error).message || "تعذّر تنفيذ الطلب."); }
    finally { setBusy(false); }
  };

  const live = !!st?.live && !!st.session;
  const pushText = workSessionPushText(st?.push ?? null);
  const tone = pushText ? " is-err" : live ? "" : " is-busy";
  return (
    <div className={`ms-sync ms-work${tone}`} data-testid="work-session">
      {live ? (
        <span className="ms-work-live">
          <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} title={`${justStarted ? `${WORK_SESSION_FIRST_REVIEW_HINT}. ` : ""}${lastResolvedText(st!.lastResolved, true)}`}>
            <LabelParts text={workSessionLiveLabel(st!.session!.until)} />
          </button>
          <button type="button" className="ms-work-stop" disabled={busy} onClick={() => void act(api.stopWorkSession)}>أوقف</button>
        </span>
      ) : (
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} aria-label={WORK_SESSION_START_LABEL} title={WORK_SESSION_START_LABEL}><LabelParts text={WORK_SESSION_START_LABEL} /></button>
      )}
      {open ? (
        <div className="ms-sync-pop" role="dialog" aria-label="جلسة العمل">
          {live ? (
            <>
              <div role="status">{workSessionLiveLabel(st!.session!.until)}</div>
              {justStarted ? <div className="ms-work-hint">{WORK_SESSION_FIRST_REVIEW_HINT}</div> : null}
            </>
          ) : (
            <>
              <div>يعالج Claude ملاحظاتك («أرسل المشكلة» و«غير مناسبة») وحده ما دامت الجلسة شغّالة.</div>
              <fieldset className="ms-work-hours">
                <legend>مدة الجلسة</legend>
                {(st?.hours ?? [1, 2, 3]).map((h) => (
                  <label key={h}>
                    <input type="radio" name="work-session-hours" value={h} checked={hours === h} onChange={() => setHours(h)} />
                    {WORK_SESSION_LABELS[h] ?? arDigits(h)}
                  </label>
                ))}
              </fieldset>
              <div className="acts">
                <button type="button" disabled={busy} onClick={() => void act(() => api.startWorkSession(hours), true)}>
                  {busy ? "يبدأ…" : "ابدأ"}
                </button>
              </div>
            </>
          )}
          {pushText ? <div role="alert" className="ms-work-err">{pushText}</div> : null}
          {st?.push?.state === "failed" && st.push.message ? (
            <details><summary>تفاصيل</summary><pre dir="ltr">{st.push.message}</pre></details>
          ) : null}
          {error ? <div role="alert" className="ms-work-err"><OwnerText text={error} /></div> : null}
          <div className="ms-work-resolved">{lastResolvedText(st?.lastResolved ?? null, live)}</div>
        </div>
      ) : null}
    </div>
  );
};
