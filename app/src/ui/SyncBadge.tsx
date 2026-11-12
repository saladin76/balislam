import React, { useEffect, useRef, useState } from "react";
import { api, type SyncStatus } from "../api";
import { arDigits } from "./format";

/**
 * «محفوظ في كل الأماكن ✓» (D101): حالة الحفظ الآلي لعمل المالك في المستودع واستقبال التحديثات.
 * تسأل الخادم كل بضع ثوانٍ. حين يصل تحديث ويُطبَّق تعيد الصفحة تحميل نفسها في مكانها (الرابط نفسه، D85)
 * بعد أن يتوقف المالك عن الكتابة، فلا يضيع ما يكتبه. إن غيّر التحديث كود الخادم يُعاد تشغيله آليًا.
 */
const LABEL: Record<SyncStatus["state"], string> = {
  off: "", synced: "محفوظ في كل الأماكن ✓", saving: "يحفظ…", pending: "لم يُحفظ في المستودع بعد",
  updating: "تحديث جديد يصل…", conflict: "يحتاج قرارك", error: "تعذّر الحفظ الآلي",
};
const typing = () => {
  const a = document.activeElement as HTMLElement | null;
  return !!a && (a.tagName === "TEXTAREA" || a.tagName === "INPUT" || a.tagName === "SELECT" || a.isContentEditable);
};
const time = (iso?: string) => iso ? arDigits(new Date(iso).toLocaleTimeString("ar-EG-u-nu-latn", { hour: "2-digit", minute: "2-digit" })) : "";

export const SyncBadge: React.FC<{ hasUnsaved?: boolean }> = ({ hasUnsaved }) => {
  const [st, setSt] = useState<SyncStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const seenUpdate = useRef<string | undefined | null>(null);
  const lastKey = useRef(Date.now());
  const unsaved = useRef(false);
  unsaved.current = !!hasUnsaved;

  useEffect(() => {
    const onKey = () => { lastKey.current = Date.now(); };
    window.addEventListener("keydown", onKey, true);
    let alive = true;
    let lost = false;
    const poll = async () => {
      try {
        const s = await api.syncStatus();
        if (!alive) return;
        if (lost) {
          if (!typing() && !unsaved.current) window.location.reload();
          return;
        } // عاد الخادم بعد إعادة تشغيله
        setSt(s);
        if (seenUpdate.current === null) seenUpdate.current = s.lastUpdateAt;
        else if (s.lastUpdateAt && s.lastUpdateAt !== seenUpdate.current && !s.restartNeeded) {
          // تحديث وصل: أعد تحميل البيانات في المكان نفسه حين يهدأ المالك
          if (!typing() && !unsaved.current && Date.now() - lastKey.current > 8_000) window.location.reload();
        }
      } catch {
        // الخادم يُعاد تشغيله بعد تحديث (D101): تُعاد الصفحة حين يعود
        if (st?.supervised || st?.restartNeeded) lost = true;
      }
    };
    void poll();
    const t = setInterval(poll, 5_000);
    return () => { alive = false; clearInterval(t); window.removeEventListener("keydown", onKey, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st?.supervised, st?.restartNeeded]);

  if (!st || !st.enabled || st.state === "off") return null;
  const tone = st.state === "synced" ? "" : st.state === "saving" || st.state === "updating" ? " is-busy" : st.state === "error" ? " is-err" : " is-warn";
  const label = st.state === "pending" ? "لم يُحفظ في المستودع بعد" + (st.pending.length ? " (" + arDigits(st.pending.length) + ")" : "")
    : st.state === "conflict"
    ? (st.conflicts === 1 ? "يحتاج قرارك (ملف واحد)" : `يحتاج قرارك (${arDigits(st.conflicts)} ملفات)`)
    : st.restartNeeded && st.state === "synced" ? "تحديث جديد وصل" : LABEL[st.state];
  return (
    <div className={`ms-sync${tone}`}>
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} title="الحفظ في المستودع والتحديثات">{label}</button>
      {open ? (
        <div className="ms-sync-pop" role="dialog" aria-label="الحفظ في المستودع">
          <strong>{st.state === "pending" ? "نسخة المستودع لم تُحدّث بعد" : "حالة الحفظ والمزامنة"}</strong>
          <div>حفظ الملفات على جهازك مستقل عن حفظ نسخة منها في المستودع.</div>
          <details className="sync-diagnostics" open={st.state === "error" || undefined}>
            <summary>سبب الحالة والتشخيص</summary>
            <pre>{st.message}</pre>
          </details>
          {st.lastSavedAt ? <div>آخر حفظ في المستودع: {time(st.lastSavedAt)}</div> : null}
          {st.lastUpdateAt ? <div>آخر تحديث وصل: {time(st.lastUpdateAt)}</div> : null}
          {st.pending.length ? (<>
            <div>تنتظر الحفظ ({arDigits(st.pending.length)}):</div>
            <ul>{st.pending.slice(0, 12).map((f) => <li key={f}>{f}</li>)}</ul>
          </>) : null}
          {st.skipped.length ? (<>
            <div>لا تُرسل آليًا:</div>
            <ul>{st.skipped.slice(0, 12).map((f) => <li key={f}>{f}</li>)}</ul>
          </>) : null}
          {st.conflicts ? <div>اختر لكل ملف «أبقِ نسختي» أو «خذ الجديد» في الشريط أعلى الصفحة.</div> : null}
          {note ? <div role="status">{note}</div> : null}
          <div className="acts">
            <button type="button" onClick={async () => { setNote(null); try { setSt(await api.syncNow()); } catch (e) { setNote((e as Error).message); } }}>احفظ وحدّث الآن</button>
            {st.restartNeeded ? (
              <button type="button" onClick={async () => { try { setNote((await api.restartStudio()).message); } catch (e) { setNote((e as Error).message); } }}>أعد التشغيل</button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};
