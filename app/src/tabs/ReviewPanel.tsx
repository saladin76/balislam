import React, { useEffect, useState } from "react";
import { api, type ReviewItem, type ReviewSummary } from "../api";
import { OwnerText } from "../ui/OwnerText";

const STATUS: Record<ReviewItem["status"], { label: string; color: string }> = {
  verified: { label: "موثّق", color: "var(--ok)" },
  rejected: { label: "مرفوض", color: "var(--err)" },
  pending: { label: "بانتظار المراجعة", color: "var(--warn)" },
  changed: { label: "تغيّر بعد الاعتماد", color: "var(--warn)" },
};

/**
 * سجل التوثيق: لكل استشهاد (آية، حديث، مصدر، صفحة كتاب) قرار المراجع وملاحظته.
 * الاعتماد على نص الاستشهاد الحالي؛ تعديله بعد الاعتماد يعيده للمراجعة. السجل للتوثيق ولا يوقف توليد الصوت.
 */
const arD = (t: string) => t.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);
export const ReviewPanel: React.FC<{ episodeId: string; savedText: string; onGoTo: (line: number) => void }> = ({ episodeId, savedText, onGoTo }) => {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");

  const apply = (r: { items: ReviewItem[]; summary: ReviewSummary }) => {
    setItems(r.items);
    setSummary(r.summary);
  };
  useEffect(() => {
    if (!episodeId) return;
    api.review(episodeId).then(apply).catch((e) => setMsg((e as Error).message));
  }, [episodeId, savedText]);

  const decide = async (it: ReviewItem, status: "verified" | "rejected" | "pending") => {
    setBusy(it.key);
    setMsg("");
    try {
      apply(await api.setReview(episodeId, { key: it.key, status, note: notes[it.key] ?? it.note ?? "" }));
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  if (!summary) return msg ? <p className="help"><OwnerText text={msg} /></p> : null;
  return (
    <div className="review-panel" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="col-head">
        <h2>سجل التوثيق</h2>
        <span className="spacer" />
        <span className="help" style={{ color: summary.ok ? "var(--ok)" : "var(--warn)", fontWeight: 600 }}>
          {summary.total === 0 ? "لا استشهادات" : `${arD(String(summary.verified))} من ${arD(String(summary.total))} موثّق${summary.ok ? " ✓" : ""}`}
        </span>
      </div>
      {!summary.ok ? <p className="help">وثّق كل استشهاد قبل النشر. الفحص البرمجي للصيغ والدرجات لا يغني عن مراجعة المضمون؛ والمسائل الشرعية المتخصصة لمراجع مؤهل.</p> : null}
      {items.map((it) => {
        const st = STATUS[it.status];
        return (
          <div key={it.key} style={{ border: "1px solid var(--line)", borderInlineStart: `4px solid ${st.color}`, borderRadius: 8, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
              <b>{it.label}</b>
              <button type="button" className="btn ghost small" onClick={() => onGoTo(it.line)} title="اذهب إلى السطر"
                aria-label={`اذهب إلى سطر ${it.label}${it.ref ? ` (${arD(it.ref)})` : ""}${it.line ? ` — السطر ${arD(String(it.line))}` : ""}`}>{it.ref ? arD(it.ref) : "—"}</button>
              <span className="spacer" />
              <span className="help" style={{ color: st.color, fontWeight: 600 }}>{st.label}</span>
            </div>
            {it.detail ? <span className="help">{arD(it.detail)}</span> : null}
            {it.text ? <span className="help">النص في التعليق: {arD(it.text)}</span> : null}
            {it.status === "verified" || it.status === "rejected" ? (
              <span className="help">
                {it.note ? `ملاحظة: ${it.note} — ` : ""}
                {it.at ? new Date(it.at).toLocaleDateString("ar") : ""}
              </span>
            ) : null}
            <input
              type="text"
              aria-label={`ملاحظة المراجع على ${it.label}${it.ref ? ` ${arD(it.ref)}` : ""}`}
              placeholder="ملاحظة المراجع (مصدر التحقق، الصفحة، سبب الرفض…)"
              value={notes[it.key] ?? it.note ?? ""}
              onChange={(e) => setNotes({ ...notes, [it.key]: e.target.value })}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="btn small primary" disabled={busy === it.key || it.status === "verified"} onClick={() => decide(it, "verified")}>موثّق</button>
              <button type="button" className="btn small danger" disabled={busy === it.key} onClick={() => decide(it, "rejected")}>مرفوض</button>
              {it.status === "verified" || it.status === "rejected" ? <button className="btn small ghost" disabled={busy === it.key} onClick={() => decide(it, "pending")}>إلغاء القرار</button> : null}
            </div>
          </div>
        );
      })}
      {msg ? <p className="help" style={{ color: "var(--err)" }}><OwnerText text={msg} /></p> : null}
    </div>
  );
};
