import React, { useEffect, useState } from "react";
import { api, type LibraryRead } from "../api";
import { playlistText, type Playlist } from "../../../src/library/playlists";
import { REVIEW_AR, REVIEW_STATES, type ReviewState, type Scholar } from "../../../src/library/shared";

/**
 * المكتبة في «٤ النشر» (D206): موضع الحلقة (الرف ← العالِم ← الكتاب ← الجزء)، وقوائم التشغيل التلقائية بزر نسخ
 * (تُنشأ أو تُحدَّث في يوتيوب يدويًا، D53)، وسجل العلماء بحالة مراجعة المتخصص وسجل الكتب بطبعتها.
 */
const CopyText: React.FC<{ text: string; disabled?: boolean }> = ({ text, disabled }) => {
  const [m, setM] = useState("");
  return (
    <button type="button" className="btn ghost small" disabled={disabled} onClick={() => navigator.clipboard.writeText(text).then(() => setM("نُسخت"), () => setM("تعذّر النسخ"))}>
      {m || "انسخ القائمة"}
    </button>
  );
};

const stateAr = (s: Playlist["items"][number]) =>
  s.kind !== "episode" ? "" : s.state.kind === "published" ? `منشورة ${s.state.date}` : s.state.kind === "scheduled" ? `مجدولة ${s.state.date}` : "قيد الإنتاج";

export const EpisodePlace: React.FC<{ place?: LibraryRead["places"][string] }> = ({ place }) => {
  if (!place || (!place.shelf && !place.scholar && !place.book)) return null;
  const parts = [place.shelf && `الرف: ${place.shelf.name}`, place.scholar && `العالِم: ${place.scholar.name}`,
    place.book && `الكتاب: «${place.book.title}»`, place.part && `الجزء ${place.part}${place.book?.parts ? ` من ${place.book.parts}` : ""}`].filter(Boolean);
  return <p className="s45-note">موضع الحلقة — {parts.join(" ← ")}</p>;
};

const ScholarRow: React.FC<{ s: Scholar; onSaved: () => void }> = ({ s, onSaved }) => {
  const [err, setErr] = useState("");
  const setState = async (state: ReviewState) => {
    setErr("");
    try { await api.saveScholar({ ...s, review: { ...s.review, state } }); onSaved(); }
    catch (e) { setErr((e as Error).message); }
  };
  return (
    <tr>
      <td>{s.name}</td>
      <td>ت {s.died.hijri}هـ / {s.died.gregorian}م</td>
      <td>{s.place}</td>
      <td>{s.field}</td>
      <td>
        <select value={s.review.state} onChange={(e) => void setState(e.target.value as ReviewState)} aria-label={`مراجعة ${s.name}`}>
          {REVIEW_STATES.map((x) => <option key={x} value={x}>{REVIEW_AR[x]}</option>)}
        </select>
        {s.review.doctrinalDispute ? <small className="s45-note"> عليه خلاف عقدي: لا اعتماد بلا تقرير</small> : null}
        {err ? <small className="s45-note" role="alert"> {err}</small> : null}
      </td>
      <td>{s.intro ? `${s.intro.channel === "dafatir-alzaman" ? "دفاتر الزمن" : s.intro.channel} ${s.intro.episode}` : "لم تُحدد"}</td>
    </tr>
  );
};

export const LibraryPlaylists: React.FC<{ episodeId: string }> = ({ episodeId }) => {
  const [lib, setLib] = useState<LibraryRead | null>(null);
  const [err, setErr] = useState("");
  const load = () => api.library().then(setLib, (e: Error) => setErr(e.message));
  useEffect(() => { void load(); }, []);
  if (err) return <p className="s45-note">{err}</p>;
  if (!lib) return <p className="s45-note">جارٍ التحميل…</p>;
  return (
    <div className="s45-sec">
      <EpisodePlace place={lib.places[episodeId]} />
      {lib.playlists.length ? (
        <>
          <h3>قوائم التشغيل (تُنشأ في يوتيوب يدويًا)</h3>
          {lib.playlists.map((p) => (
            <details key={`${p.kind}:${p.id}`} className="more">
              <summary>{p.kind === "book" ? "كتاب" : p.kind === "scholar" ? "عالِم" : "رف"}: {p.title} ({p.items.length})</summary>
              <div className="more-body">
                <p>{p.description}</p>
                <ol>{p.items.map((i, n) => <li key={n}>{i.kind === "episode" ? `${i.part ? `الجزء ${i.part}: ` : ""}${i.title} — ${stateAr(i)}` : i.kind === "compilation" ? `الفيديو المجمّع: ${i.title}` : `التعريف: ${i.title} (على «دفاتر الزمن» بخاصية التعاون)`}</li>)}</ol>
                {p.notes.map((x, n) => <p key={n} className="s45-note">{x}</p>)}
                {p.traces.length ? <p className="s45-note" role="alert">أثر لأدوات الإنتاج: {p.traces.join("، ")}؛ لا تُنسخ حتى يُصلح.</p> : null}
                <CopyText text={playlistText(p)} disabled={p.traces.length > 0} />
              </div>
            </details>
          ))}
        </>
      ) : null}
      {lib.scholars.length ? (
        <details className="more">
          <summary>سجل العلماء ({lib.scholars.length}) وسجل الكتب ({lib.books.length})</summary>
          <div className="more-body">
            <table className="s45-table">
              <thead><tr><th>العالِم</th><th>الوفاة</th><th>المكان</th><th>المجال</th><th>مراجعة المتخصص</th><th>حلقة التعريف</th></tr></thead>
              <tbody>{lib.scholars.map((s) => <ScholarRow key={s.id} s={s} onSaved={() => void load()} />)}</tbody>
            </table>
            <table className="s45-table">
              <thead><tr><th>الكتاب</th><th>المؤلف</th><th>الطبعة المعتمدة</th><th>الأجزاء</th></tr></thead>
              <tbody>{lib.books.map((b) => (
                <tr key={b.id}><td>«{b.title}»</td><td>{b.author}</td>
                  <td>{[b.edition.publisher, b.edition.year, b.edition.editor].filter(Boolean).join("، ") || "لم تُختر بعد"}</td>
                  <td>{b.parts ?? "لم يُحدد"}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </details>
      ) : null}
    </div>
  );
};
