import React, { useEffect, useState } from "react";
import { api } from "../api";
import type { Season, SeasonView } from "../../../src/studio/seasons";

/**
 * «مواسم السنة» (عمود «بالإسلام»، عاشرًا/٦): المواسم المتفق عليها بتاريخها الهجري والميلادي (حساب أم القرى)،
 * والعدّ التنازلي، وموعد «جاهز قبل»، وحلقات كل موسم وشورتسه. يحرر المالك العناوين وموعد النشر ورقم الحلقة.
 */
const ar = (n: number) => n.toLocaleString("ar-EG");
const arDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("ar-EG", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const hijriText = (h: string) => {
  const [y, m, d] = h.split("-").map(Number);
  const months = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];
  return `${ar(d!)} ${months[m! - 1]} ${ar(y!)}هـ`;
};
const countdown = (days: number, past: string) => (days > 0 ? `بعد ${ar(days)} يومًا` : days === 0 ? "اليوم" : past);

const strip = (v: SeasonView): Season => {
  const { name: _n, daysToStart: _a, daysToReady: _b, ruleReadyBy: _r, state: _s, ...s } = v;
  return s;
};

const SeasonCard: React.FC<{ v: SeasonView; onSaved: () => void }> = ({ v, onSaved }) => {
  const [slots, setSlots] = useState(v.episodes);
  const [msg, setMsg] = useState("");
  const dirty = JSON.stringify(slots) !== JSON.stringify(v.episodes);
  const late = v.daysToReady < 0 && v.state === "upcoming";
  const save = async () => {
    setMsg("");
    try {
      await api.saveSeason({ ...strip(v), episodes: slots });
      setMsg("حُفظ");
      onSaved();
    } catch (e) { setMsg((e as Error).message); }
  };
  return (
    <article className={`group season-card is-${v.state}`} data-season={v.id}>
      <h4>{v.name} {ar(v.hijriYear)}هـ <small>{v.state === "running" ? "جارٍ الآن" : v.state === "past" ? "انتهى" : countdown(v.daysToStart, "")}</small></h4>
      <p className="help">
        {hijriText(v.hijri.from)}{v.hijri.to !== v.hijri.from ? ` – ${hijriText(v.hijri.to)}` : ""} · {arDate(v.gregorian.from)}{v.gregorian.to !== v.gregorian.from ? ` – ${arDate(v.gregorian.to)}` : ""} (حساب أم القرى؛ البداية الفعلية برؤية الهلال)
      </p>
      <p className={late ? "warn" : ""}>
        <strong>جاهز قبل:</strong> {arDate(v.readyBy)} — {v.state === "upcoming" ? countdown(v.daysToReady, "فات الموعد") : "—"}
        {v.readyBy !== v.ruleReadyBy && <small className="help"> · قاعدة الأسابيع الستة: {arDate(v.ruleReadyBy)}{v.readyByNote ? ` · ${v.readyByNote}` : ""}</small>}
      </p>
      {slots.length > 0 && (
        <table className="season-slots">
          <thead><tr><th>#</th><th>العنوان</th><th>موعد النشر</th><th>الحلقة</th></tr></thead>
          <tbody>
            {slots.map((e, i) => (
              <tr key={e.slot}>
                <td>{ar(e.slot)}</td>
                <td><input type="text" value={e.title} placeholder="بعد اعتماد المالك" onChange={(x) => setSlots(slots.map((s, k) => (k === i ? { ...s, title: x.target.value } : s)))} /></td>
                <td><input type="date" dir="ltr" value={e.publishOn ?? ""} onChange={(x) => setSlots(slots.map((s, k) => (k === i ? { ...s, ...(x.target.value ? { publishOn: x.target.value } : { publishOn: undefined }) } : s)))} /></td>
                <td><input type="text" dir="ltr" size={4} placeholder="—" value={e.episode ?? ""} onChange={(x) => setSlots(slots.map((s, k) => (k === i ? { ...s, episode: x.target.value.trim() || undefined } : s)))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {(v.shorts ?? []).map((s) => <p key={s.name} className="help">شورتس يومية: «{s.name}» — {ar(s.count)} مقطعًا{s.status ? ` (${s.status})` : ""}</p>)}
      {v.note && <p className="help">{v.note}</p>}
      {dirty && <button type="button" className="btn primary small" onClick={save}>احفظ حلقات الموسم</button>}
      {msg && <small role="status"> {msg}</small>}
    </article>
  );
};

export const ChannelSeasons: React.FC = () => {
  const [data, setData] = useState<{ today: string; seasons: SeasonView[]; issues: string[] } | null>(null);
  const [err, setErr] = useState("");
  const load = () => api.seasons().then(setData, (e) => setErr((e as Error).message));
  useEffect(() => { void load(); }, []);
  if (err) return <p className="warn">{err}</p>;
  if (!data) return <p className="help">جارٍ التحميل…</p>;
  if (!data.seasons.length) return <p className="help">لا مواسم في جدول هذه القناة بعد (`seasons.json`).</p>;
  return (
    <div className="seasons">
      {data.issues.length > 0 && <ul className="warn">{data.issues.map((x) => <li key={x}>{x}</li>)}</ul>}
      {data.seasons.filter((s) => s.state !== "past").map((v) => <SeasonCard key={`${v.id}:${JSON.stringify(v.episodes)}`} v={v} onSaved={load} />)}
    </div>
  );
};
