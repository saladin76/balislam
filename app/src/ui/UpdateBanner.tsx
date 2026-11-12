import React, { useCallback, useEffect, useState } from "react";
import { api, type UpdateConflict } from "../api";
import { updateOutcome } from "./updateOutcome";
import { OwnerText } from "./OwnerText";

/**
 * شريط «تحديث جديد»: يتحقق من GitHub كل دقيقة (وعند العودة للنافذة)،
 * ويحدّث الاستوديو بضغطة واحدة دون إغلاق الـ Terminal.
 */
export const UpdateBanner: React.FC<{ beforeUpdate: () => Promise<void>; hasUnsaved: boolean }> = ({ beforeUpdate, hasUnsaved }) => {
  const [st, setSt] = useState<{ behind: number; changes: string[]; blocked?: string; local?: number } | null>(null);
  const [conflicts, setConflicts] = useState<UpdateConflict[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);

  const check = useCallback((force = false) => {
    api.updateStatus(force).then((s) => {
      setSt(s.available ? s : null);
      setConflicts(s.conflicts ?? []);
    }).catch(() => {});
  }, []);
  const resolve = async (file: string, choice: "mine" | "new") => {
    setBusy(true);
    try {
      const r = await api.resolveUpdateConflict(file, choice);
      setConflicts((list) => list.filter((c) => c.file !== file));
      setMsg({ text: `${r.message} أعد تحميل الصفحة ليظهر الملف في الاستوديو.` });
    } catch (e) {
      setMsg({ text: (e as Error).message, err: true });
    } finally {
      setBusy(false);
    }
  };
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

  if (!st && !msg && !conflicts.length) return null;
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
      setConflicts(r.conflicts ?? []);
      if (outcome === "failure") {
        setMsg({ text: r.message || "تعذّر تحديث الاستوديو؛ لم تُطبّق العملية.", err: true });
        return;
      }
      if (outcome === "restart") setMsg({ text: r.reinstalled ? `${r.message} نزلت حزم جديدة.` : r.message });
      else if (r.conflicts?.length) setMsg({ text: r.message });
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
  const conflictCard = conflicts.length ? (
    <div className="update-conflicts" role="alert" data-testid="update-conflicts">
      <b>{conflicts.length === 1 ? "ملف يحتاج قرارك بعد التحديث" : `${conflicts.length} ملفات تحتاج قرارك بعد التحديث`}</b>
      <span className="help">تغيّر الملف على جهازك وفي التحديث معًا في الموضع نفسه. الجديد الآن في مكانه، ونسختك محفوظة. اختر لكل ملف وحده:</span>
      <ul>
        {conflicts.map((c) => (
          <li key={c.file}>
            <span className="uc-file"><span className="uc-ch">{c.channel}</span> <bdi dir="ltr">{c.file}</bdi>
              {c.reason === "deleted-here-changed-there" ? <span className="help"> (حذفتَه على جهازك وتغيّر في التحديث)</span> : null}</span>
            <span className="uc-actions">
              <button className="btn small" disabled={busy} onClick={() => resolve(c.file, "mine")}>أبقِ نسختي</button>
              <button className="btn primary small" disabled={busy} onClick={() => resolve(c.file, "new")}>خذ الجديد</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  ) : null;
  if (!st && !msg) return conflictCard;
  return (
    <>
    <div className={`update-banner ${msg?.err ? "err" : ""}`} role="status">
      {msg ? (
        <span style={{ whiteSpace: "pre-line" }}><OwnerText text={msg.text} /></span>
      ) : st ? (
        <>
          <b>تحديث جديد متاح</b>
          <span className="help" title={st.changes.join("\n")}>{st.changes[0] ?? ""}{st.behind > 1 ? ` (+${st.behind - 1})` : ""}</span>
          <span className="help">{hasUnsaved ? "احفظ التعديلات أولًا ثم حدّث يدويًا"
            : st.local ? `تعديلاتك على هذا الجهاز (${st.local}) تُحفظ نسخة منها وتبقى كما هي` : "لن يبدأ التحديث دون موافقتك"}</span>
          <button className="btn primary small" disabled={busy || hasUnsaved} onClick={() => apply()}>{busy ? "جارٍ التحديث…" : "حدّث الآن"}</button>
        </>
      ) : null}
      {msg ? <button className="btn ghost small" onClick={() => setMsg(null)}>إغلاق</button> : null}
    </div>
    {conflictCard}
    </>
  );
};
