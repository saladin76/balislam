import React, { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";

/**
 * شريط «تحديث جديد»: يتحقق من GitHub كل دقيقتين (وعند العودة للنافذة)،
 * ويحدّث الاستوديو بضغطة واحدة دون إغلاق الـ Terminal.
 */
export const UpdateBanner: React.FC<{ beforeUpdate: () => Promise<void>; hasUnsaved: boolean }> = ({ beforeUpdate, hasUnsaved }) => {
  const [st, setSt] = useState<{ behind: number; changes: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);

  const check = useCallback((force = false) => {
    api.updateStatus(force).then((s) => setSt(s.available ? s : null)).catch(() => {});
  }, []);
  useEffect(() => {
    check();
    const t = setInterval(() => check(), 60_000);
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, [check]);

  // تحديث تلقائي: إن لم يكن هناك شيء غير محفوظ، يبدأ عدّ تنازلي قصير ثم يحدّث وحده
  const [countdown, setCountdown] = useState<number | null>(null);
  const [postponed, setPostponed] = useState(false);
  const applyRef = useRef<(auto?: boolean) => void>(() => {});
  useEffect(() => {
    if (!st || hasUnsaved || postponed || busy) {
      setCountdown(null);
      return;
    }
    let n = 10;
    setCountdown(n);
    const t = setInterval(() => {
      n -= 1;
      setCountdown(n);
      if (n <= 0) {
        clearInterval(t);
        applyRef.current(true);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [st, hasUnsaved, postponed, busy]);

  if (!st && !msg) return null;
  const apply = async (auto = false) => {
    if (!auto && hasUnsaved && !window.confirm("في السكريبت تعديلات لم تُحفظ بعد. احفظها أولًا (Ctrl+S) وإلا ستضيع عند التحديث. هل تريد المتابعة؟")) return;
    setBusy(true);
    try {
      await beforeUpdate();
      const r = await api.applyUpdate();
      if (r.reinstalled) setMsg({ text: `${r.message} نزلت حزم جديدة: أغلق الاستوديو (Ctrl + C) وشغّله مرة أخيرة.` });
      else {
        setMsg({ text: `${r.message} جارٍ إعادة التحميل…` });
        setTimeout(() => window.location.reload(), 1500);
      }
      setSt(null);
    } catch (e) {
      // التحديث يغيّر ملفات الخادم نفسه فيُعاد تشغيله وينقطع الطلب: ننتظر عودته ثم نعيد التحميل
      if (e instanceof TypeError || /fetch|network|Load failed/i.test((e as Error).message)) {
        setMsg({ text: "تم تنزيل التحديث، والاستوديو يعيد تشغيل نفسه… لحظات" });
        setSt(null);
        for (let i = 0; i < 40; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          try {
            await api.updateStatus(true);
            window.location.reload();
            return;
          } catch {
            /* لم يعد بعد */
          }
        }
        setMsg({ text: "لم يرجع الاستوديو. أعد تحميل الصفحة (Cmd + R).", err: true });
      } else setMsg({ text: (e as Error).message, err: true });
    } finally {
      setBusy(false);
    }
  };
  applyRef.current = (auto) => void apply(auto);
  return (
    <div className={`update-banner ${msg?.err ? "err" : ""}`} role="status">
      {msg ? (
        <span>{msg.text}</span>
      ) : st ? (
        <>
          <b>تحديث جديد متاح</b>
          <span className="help" title={st.changes.join("\n")}>{st.changes[0] ?? ""}{st.behind > 1 ? ` (+${st.behind - 1})` : ""}</span>
          {countdown !== null && !busy ? <span className="help">يتحدّث تلقائيًا خلال {countdown} ث</span> : hasUnsaved ? <span className="help">احفظ تعديلاتك ليتحدّث تلقائيًا</span> : null}
          <button className="btn primary small" disabled={busy} onClick={() => apply()}>{busy ? "جارٍ التحديث…" : "حدّث الآن"}</button>
          {countdown !== null && !busy ? <button className="btn ghost small" onClick={() => setPostponed(true)}>لاحقًا</button> : null}
        </>
      ) : null}
      {msg ? <button className="btn ghost small" onClick={() => setMsg(null)}>إغلاق</button> : null}
    </div>
  );
};
