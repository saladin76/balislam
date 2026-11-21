import React, { useCallback, useEffect, useState } from "react";
import { api, type QualityCardRead } from "../api";
import { OwnerText } from "../ui/OwnerText";

/**
 * بطاقة الجودة في الخطوة ٣ (المرحلة A من خطة «احترافية بلا مثيل»، قرار المالك ١): يحسبها الاستوديو وحده على الملف الحالي
 * (الحلقة المجمّعة قبل النسخة النهائية، والنسخة النهائية قبل النشر). عرض فقط: المنع في الخادم نفسه («اصنع النسخة
 * النهائية» وإذن النشر)، وسبب كل ✗ مكتوب بجواره. «قِس الآن» يقيس في الخلفية ولا يغيّر الملف ولا يصرف شيئًا.
 */
const MARK: Record<string, { sign: string; label: string }> = {
  pass: { sign: "✓", label: "ناجح" },
  fail: { sign: "✗", label: "يمنع" },
  unmeasured: { sign: "…", label: "لم يُقس" },
  warn: { sign: "!", label: "للعلم" },
  later: { sign: "—", label: "لم يُبنَ بعد" },
};

export const QualityCardView: React.FC<{ episodeId: string; target: "assembly" | "master" }> = ({ episodeId, target }) => {
  const [card, setCard] = useState<QualityCardRead | null>(null);
  const [err, setErr] = useState("");
  const read = useCallback(async () => {
    try { setCard(await api.qualityCard(episodeId, target)); setErr(""); }
    catch (e) { setErr((e as Error).message); }
  }, [episodeId, target]);
  useEffect(() => { void read(); }, [read]);
  useEffect(() => {
    if (!card?.measuring) return;
    const t = setInterval(() => void read(), 3000);
    return () => clearInterval(t);
  }, [card?.measuring, read]);
  const measure = async () => {
    setErr("");
    try { await api.measureQuality(episodeId, target); setCard((c) => (c ? { ...c, measuring: true } : c)); }
    catch (e) { setErr((e as Error).message); }
  };
  if (!card && !err) return <p className="sp-hint" role="status">جارٍ قراءة بطاقة الجودة…</p>;
  const unmeasured = card?.sections.some((s) => s.items.some((i) => i.status === "unmeasured"));
  return (
    <section className="quality-card" aria-label="بطاقة الجودة" data-blocks={card?.blocks ? "yes" : "no"}>
      <div className="quality-card-head">
        <h4>بطاقة الجودة — {target === "assembly" ? "الحلقة المجمّعة" : "النسخة النهائية"}</h4>
        {card ? <span className={`quality-verdict ${card.blocks ? "bad" : "good"}`}>{card.blocks ? "تمنع" : "كلها بلا ✗"}</span> : null}
        {card?.exists ? (
          <button type="button" className="btn ghost" disabled={card.measuring} onClick={() => void measure()}>
            {card.measuring ? "جارٍ القياس…" : unmeasured ? "قِس الآن" : "أعد القياس"}
          </button>
        ) : null}
      </div>
      {card && !card.exists ? <p className="sp-hint">لا يوجد ملف {target === "assembly" ? "مجمّع" : "نهائي"} بعد؛ تُقاس البطاقة عليه حين يُصنع.</p> : null}
      {card?.measuredAt ? <p className="sp-hint">قيست على الملف الحالي: {new Date(card.measuredAt).toLocaleString("ar-EG")}.</p> : null}
      {card ? card.sections.map((s) => (
        <div key={s.id} className="quality-section">
          <h5>{s.label}</h5>
          <ul>
            {s.items.map((i) => (
              <li key={i.id} className={`quality-item ${i.status}`} data-item={i.id} data-status={i.status}>
                <span className="quality-mark" aria-label={MARK[i.status]!.label}>{MARK[i.status]!.sign}</span>
                <span className="quality-label">{i.label}</span>
                <span className="quality-value">{i.value ?? ""}</span>
                <span className="quality-need">المطلوب: {i.need}</span>
                {i.reason ? <span className="quality-reason"><OwnerText text={i.reason} /></span> : null}
              </li>
            ))}
          </ul>
        </div>
      )) : null}
      {err ? <p className="sp-hint" role="alert"><OwnerText text={err} /></p> : null}
    </section>
  );
};
