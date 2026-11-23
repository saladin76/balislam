import React, { useEffect, useState } from "react";
import { api } from "../api";
import { OwnerText } from "../ui/OwnerText";

/**
 * «غرفة العمليات ← الليل والأسبوع» (D191): ملخص الليلة الأخير، وضبط ساعة الطابور الليلي وتشغيله، والمراجعة الأسبوعية.
 * الطابور يرندر ما اعتمدته وحده، بلا صوت مدفوع ولا نشر؛ والمراجعة من تصديرات YouTube Studio المستوردة على هذا الجهاز.
 */
const Md: React.FC<{ text: string }> = ({ text }) => (
  <div className="night-md" dir="rtl">
    {text.split("\n").map((l, i) =>
      l.startsWith("# ") ? <h3 key={i}>{l.slice(2)}</h3>
        : l.startsWith("## ") ? <h4 key={i}>{l.slice(3)}</h4>
          : l.startsWith("- ") ? <p key={i} className="night-li">• {l.slice(2).replace(/\*\*/g, "")}</p>
            : l.trim() ? <p key={i}>{l.replace(/\*\*/g, "")}</p> : null)}
  </div>
);

type Night = { settings: { enabled: boolean; hour: number }; running: boolean; markdown: string | null };

export const NightlyPanel: React.FC = () => {
  const [night, setNight] = useState<Night | null>(null);
  const [weekly, setWeekly] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const load = () => {
    api.nightly().then(setNight).catch((e: Error) => setMsg(e.message));
    api.weekly().then((w) => setWeekly(w.markdown)).catch(() => undefined);
  };
  useEffect(load, []);
  useEffect(() => {
    if (!night?.running) return;
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [night?.running]);
  if (!night) return <p>{msg ? <OwnerText text={msg} /> : "…"}</p>;
  const save = (s: Night["settings"]) => api.saveNightly(s).then((r) => setNight({ ...night, settings: r.settings })).catch((e: Error) => setMsg(e.message));
  const runNow = () => api.runNightly().then(() => { setNight({ ...night, running: true }); setMsg("بدأ الطابور الليلي الآن."); }).catch((e: Error) => setMsg(e.message));
  return (
    <div className="nightly">
      <h2>الطابور الليلي</h2>
      <p>يرندر ما اعتمدته وحده (النسخة النهائية بعد اعتماد التجميع، والشورتس بعد اعتماد Master) ويجهز حزم النشر، بلا صوت مدفوع ولا نشر، ويكتب ملخصًا صباحيًا هنا.</p>
      <label><input type="checkbox" checked={night.settings.enabled} onChange={(e) => save({ ...night.settings, enabled: e.target.checked })} /> يعمل كل ليلة</label>{" "}
      <label>الساعة{" "}
        <select value={night.settings.hour} onChange={(e) => save({ ...night.settings, hour: Number(e.target.value) })}>
          {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
        </select>
      </label>{" "}
      <button type="button" disabled={night.running} onClick={runNow}>{night.running ? "يعمل الآن…" : "شغّل الآن"}</button>
      {msg ? <p role="status"><OwnerText text={msg} /></p> : null}
      {night.markdown ? <Md text={night.markdown} /> : <p>لا ملخص بعد: أول تشغيل الليلة.</p>}

      <h2>المراجعة الأسبوعية</h2>
      <p>نسبة النقر، ومتوسط المشاهدة، وأكبر تسرب، وتحسين واحد لكل قناة؛ من تصديرات YouTube Studio المستوردة على هذا الجهاز وحدها (<code>bal analytics-import</code>).</p>
      <button type="button" onClick={() => api.buildWeekly().then((w) => setWeekly(w.markdown)).catch((e: Error) => setMsg(e.message))}>ابنِ مراجعة هذا الأسبوع</button>
      {weekly ? <Md text={weekly} /> : <p>لا بيانات بعد.</p>}
    </div>
  );
};
