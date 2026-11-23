import React, { useEffect, useState } from "react";
import { api, type StockOverview } from "../api";
import { OwnerText } from "../ui/OwnerText";
import type { Stock, StockSlot } from "../../../src/studio/stock";

/**
 * «ترتيب النشر» (D168 وD213): حلقات المرحلة بأسابيعها ويوم القناة، ترتيب لا مواعيد. الخانة بلا مجلد حلقة «مخططة».
 * يعدّل المالك الأسبوع والعنوان والسلسلة ورقم الحلقة والدفعة، ويحفظ.
 */
const ar = (n: number) => n.toLocaleString("ar-EG");

export const PublishOrder: React.FC = () => {
  const [ov, setOv] = useState<StockOverview | null>(null);
  const [slots, setSlots] = useState<StockSlot[]>([]);
  const [msg, setMsg] = useState("");
  const load = () => api.stock().then((o) => {
    setOv(o);
    setSlots(o.views.filter((v) => v.week !== null).map((v) => ({ week: v.week!, title: v.title, batch: v.batch ?? 0,
      ...(v.series ? { series: v.series } : {}), ...(v.episode ? { episode: v.episode } : {}), ...(v.specialist.length ? { specialist: v.specialist } : {}), ...(v.note ? { note: v.note } : {}) })));
  }, (e) => setMsg((e as Error).message));
  useEffect(() => { void load(); }, []);
  if (!ov) return <p className="help">{msg || "جارٍ التحميل…"}</p>;
  const set = (i: number, p: Partial<StockSlot>) => setSlots(slots.map((s, k) => (k === i ? { ...s, ...p } : s)));
  const save = async () => {
    setMsg("");
    const stock: Stock = { version: 1, phase: ov.phase, ...(ov.frozen ? { frozen: ov.frozen } : {}), slots };
    try { await api.saveStock(stock); setMsg("حُفظ ترتيب النشر"); void load(); } catch (e) { setMsg((e as Error).message); }
  };
  const day = ov.views[0]?.day ?? "";
  const exists = new Map(ov.views.map((v) => [v.episode, v.exists]));
  return (
    <div className="publish-order">
      <p className="help">المرحلة {ar(ov.phase)}: أسبوع بأسبوع{day ? ` (يوم القناة: ${day})` : ""}. ترتيب لا مواعيد؛ النشر يبدأ بعد اعتماد الشكل و«دفاتر الزمن 001» ومراجعة المتخصص.</p>
      {ov.frozen && <p className="warn">إنتاج الفيديو في هذه القناة مجمّد ({ov.frozen.decision}).</p>}
      {ov.issues.length > 0 && <ul className="warn">{ov.issues.map((x) => <li key={x}><OwnerText text={x} /></li>)}</ul>}
      <table className="season-slots">
        <thead><tr><th>الأسبوع</th><th>العنوان</th><th>السلسلة</th><th>الحلقة</th><th>الدفعة</th><th>الحالة</th></tr></thead>
        <tbody>
          {slots.map((s, i) => (
            <tr key={i}>
              <td><input type="number" min={1} max={52} dir="ltr" value={s.week} onChange={(x) => set(i, { week: Number(x.target.value) })} /></td>
              <td><input type="text" value={s.title} onChange={(x) => set(i, { title: x.target.value })} /></td>
              <td><input type="text" dir="ltr" size={10} value={s.series ?? ""} onChange={(x) => set(i, { series: x.target.value.trim() || undefined })} /></td>
              <td><input type="text" dir="ltr" size={4} value={s.episode ?? ""} onChange={(x) => set(i, { episode: x.target.value.trim() || undefined })} /></td>
              <td><input type="number" min={0} dir="ltr" value={s.batch} onChange={(x) => set(i, { batch: Number(x.target.value) })} /></td>
              <td>{s.episode && exists.get(s.episode) ? "مسودة أو حلقة" : "مخططة"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn primary small" onClick={() => void save()}>احفظ ترتيب النشر</button>
      {msg && <small role="status"> <OwnerText text={msg} /></small>}
    </div>
  );
};
