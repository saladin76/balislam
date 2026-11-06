import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, type StudioDelivery, type StudioTransferOverview } from "../api";
import "./DeliveryCenter.css";

const CHANNELS: Record<string, string> = { balislam: "بالإسلام", "dafatir-alzaman": "دفاتر الزمن", "zubdat-alkutub": "زبدة الكتب" };
const makeReport = (items: StudioDelivery[]) => [
  "# تقرير تسليم للمراجعة — Balislam Studio",
  "الحالة: بانتظار المراجعة، لا يوجد اعتماد بصري أو نهائي.",
  ...items.map((d) => [CHANNELS[d.channel] || d.channel, d.episode, d.kind, d.slot, d.url, d.md5, d.updated].join(" | ")),
  "يُرفق المنفذ تقرير الاختبارات والمراجعة البصرية بشكل مستقل؛ الرفع لا يعني الاعتماد."
].join("\n");

export const DeliveryCenter: React.FC<{ onOpenEpisode?: (channel: string, episode: string) => void }> = ({ onOpenEpisode }) => {
  const [overview, setOverview] = useState<StudioTransferOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const refresh = useCallback(() => {
    setLoading(true); setError("");
    api.studioTransfers().then(setOverview).catch((e: Error) => setError(e.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const deliveries = useMemo(() => (overview?.deliveries ?? []).filter((d) =>
    (filter === "all" || d.channel === filter) &&
    (d.episode + " " + d.slot + " " + d.channel).toLowerCase().includes(query.trim().toLowerCase())
  ), [overview, filter, query]);
  const chosen = deliveries.filter((d) => selected.includes(d.id));
  const copyReport = async () => {
    if (!deliveries.length) return;
    try { await navigator.clipboard.writeText(makeReport(chosen.length ? chosen : deliveries)); setCopied(true); }
    catch { setError("تعذر النسخ تلقائيًا. يمكنك فتح الروابط ونسخها يدويًا."); }
  };
  return <section className="delivery-center" aria-labelledby="delivery-title">
    <div className="delivery-hero">
      <div><span className="delivery-eyebrow">التنسيق بين التنفيذ والمراجعة</span><h1 id="delivery-title">مركز التسليمات</h1>
        <p>ملفات الفيديو والـStoryboard التي تحقّق النظام من رفعها إلى Drive. التسليم ليس اعتمادًا للمحتوى.</p></div>
      <div className="delivery-actions">
        <button className="btn" type="button" onClick={refresh} disabled={loading}>تحديث</button>
        <button className="btn primary" type="button" onClick={copyReport} disabled={!deliveries.length}>{copied ? "تم نسخ التقرير" : "نسخ تقرير المراجعة"}</button>
      </div>
    </div>
    <div className="delivery-summary" aria-label="ملخص التسليمات">
      <div><span>ملفات موثقة</span><strong>{overview?.deliveries.length ?? "—"}</strong></div>
      <div><span>طلبات الجسر المكتملة</span><strong>{overview?.bridgeDeliveredJobs ?? "—"}</strong></div>
      <div><span>حالة الاعتماد</span><strong>بانتظار قرار المالك</strong></div>
    </div>
    {error && <p className="delivery-error" role="alert">{error}</p>}
    {!overview?.configured && !loading && <p className="delivery-empty">فهرس التسليمات غير موجود في بيئة Studio الحالية. تأكد أن Studio يعمل على Mac الذي توجد عليه أداة المزامنة.</p>}
    {!!overview?.pendingJobs.length && <section className="delivery-queue" aria-label="قائمة طلبات الجسر">
      <h2>طلبات التسليم من Claude السحابي</h2>
      <p>هذه الحالات من نسخة GitHub المحفوظة محليًا على Mac. لا تعني وصول الملفات أو اعتمادها.</p>
      <div className="delivery-queue-items">
        {overview.pendingJobs.map((job) => <div key={job.id}>
          <span>{CHANNELS[job.channel]} · {job.episode} · {job.slot}</span>
          <strong>{job.state === "delivered" ? "سُجل تنفيذ الطلب" : "بانتظار تنفيذ Mac"}</strong>
        </div>)}
      </div>
    </section>}
    <div className="delivery-toolbar">
      <label>القناة <select value={filter} onChange={(e) => { setFilter(e.target.value); setSelected([]); }}>
        <option value="all">جميع القنوات</option>
        {Object.entries(CHANNELS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select></label>
      <label>البحث <input type="search" value={query} placeholder="رقم الحلقة أو اسم الخانة" onChange={(e) => setQuery(e.target.value)} /></label>
      <span className="delivery-count">{deliveries.length} ملف</span>
    </div>
    {loading ? <p role="status" className="delivery-empty">جارٍ قراءة التسليمات…</p> : deliveries.length === 0 ?
      <p className="delivery-empty">لا توجد ملفات موثقة مطابقة. الملفات التي لم تصل إلى Mac لن تظهر هنا.</p> :
      <div className="delivery-list">{deliveries.map((d) => <article key={d.id} className="delivery-item">
        <div className="delivery-item-top">
          <label><input type="checkbox" checked={selected.includes(d.id)} aria-label={"تحديد " + d.slot}
            onChange={(e) => setSelected((old) => e.target.checked ? [...old, d.id] : old.filter((id) => id !== d.id))} />
            <span>{d.kind === "video" ? "فيديو" : "Storyboard"}</span></label>
          <span className="delivery-state">تم الرفع · بانتظار المراجعة</span>
        </div>
        <h2>{d.slot}</h2><p>{CHANNELS[d.channel]} · الحلقة <b dir="ltr">{d.episode}</b></p>
        <small>التحقق: {new Date(d.updated).toLocaleString("ar")} · MD5 <code dir="ltr">{d.md5.slice(0, 12)}…</code></small>
        <div className="delivery-item-footer">
          <a href={d.url} target="_blank" rel="noopener noreferrer">فتح على Google Drive</a>
          {onOpenEpisode && /^\d{3}/.test(d.episode) && <button className="btn small" type="button" onClick={() => onOpenEpisode(d.channel, d.episode.slice(0, 3))}>فتح الحلقة</button>}
        </div>
      </article>)}</div>}
    <p className="delivery-footnote">هذه معلومات التسليم المحلي فقط؛ لا تُغيّر اعتماد المشاهد أو النشر داخل Studio.</p>
  </section>;
};
