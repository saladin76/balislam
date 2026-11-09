import React, { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { updateOutcome } from "./updateOutcome";

/**
 * شريط «تحديث جديد»: يتحقق من GitHub كل دقيقة (وعند العودة للنافذة)،
 * ويحدّث الاستوديو بضغطة واحدة دون إغلاق الـ Terminal.
 */
export const UpdateBanner: React.FC<{ beforeUpdate: () => Promise<void>; hasUnsaved: boolean }> = ({ beforeUpdate, hasUnsaved }) => {
  const [st, setSt] = useState<{ behind: number; changes: string[]; blocked?: string } | null>(null);
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

  if (!st && !msg) return null;
  const apply = async () => {
    if (hasUnsaved) {
      window.alert("هناك تغييرات لم تُحفظ. احفظها أولًا قبل تحديث الاستوديو.");
      return;
    }
    if (!window.confirm("هل تريد تحديث الاستوديو الآن؟ تحقق من أنك لا تشغّل رندرًا أو عملية إنتاج قبل الموافقة.")) return;
    setBusy(true);
    try {
      await beforeUpdate();
      const r = await api.applyUpdate();
      const outcome = updateOutcome(r);
      if (outcome === "failure") {
        setMsg({ text: r.message || "تعذّر تحديث الاستوديو؛ لم تُطبّق العملية.", err: true });
        return;
      }
      if (outcome === "restart") setMsg({ text: `${r.message} نزلت حزم جديدة: أغلق الاستوديو (Ctrl + C) وشغّله مرة أخيرة.` });
      else {
        setMsg({ text: `${r.message} جارٍ إعادة التحميل…` });
        setTimeout(() => window.location.reload(), 1500);
      }
      setSt(null);
    } catch (e) {
      // التحديث يغيّر ملفات الخادم نفسه فيُعاد تشغيله وينقطع الطلب: ننتظر عودته ثم نعيد التحميل
      if (e instanceof TypeError || /fetch|network|Load failed/i.test((e as Error).message)) {
        setMsg({ text: "انقطع الاتصال أثناء طلب التحديث؛ نتحقق من عودة الاستوديو دون افتراض نجاح العملية.", err: true });
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
  return (
    <div className={`update-banner ${msg?.err ? "err" : ""}`} role="status">
      {msg ? (
        <span style={{ whiteSpace: "pre-line" }}>{msg.text}</span>
      ) : st ? (
        <>
          <b>تحديث جديد متاح</b>
          <span className="help" title={st.changes.join("\n")}>{st.changes[0] ?? ""}{st.behind > 1 ? ` (+${st.behind - 1})` : ""}</span>
          {st.blocked ? <span className="help" style={{ whiteSpace: "pre-line" }}>{st.blocked}</span>
            : <span className="help">{hasUnsaved ? "احفظ التعديلات أولًا ثم حدّث يدويًا" : "لن يبدأ التحديث دون موافقتك"}</span>}
          <button className="btn primary small" disabled={busy || hasUnsaved || Boolean(st.blocked)} onClick={() => apply()}>{busy ? "جارٍ التحديث…" : "حدّث الآن"}</button>
        </>
      ) : null}
      {msg ? <button className="btn ghost small" onClick={() => setMsg(null)}>إغلاق</button> : null}
    </div>
  );
};
