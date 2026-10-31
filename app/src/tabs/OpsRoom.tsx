import React, { useEffect, useMemo, useState } from "react";
import { api, type Idea, type OpsChannel, type Overview } from "../api";
import { stagesOf } from "./HomeTab";

/**
 * «غرفة العمليات»: القنوات كلها في شاشة واحدة.
 * - الأسبوع: يوم الحلقة الطويلة لكل قناة، وما سينزل فيه، والشورتس في باقي الأيام.
 * - خط الإنتاج: كل حلقات القنوات حسب مرحلتها.
 * - بنك الأفكار: لكل قناة، وكل فكرة تتحول حلقة بضغطة.
 * - التنوّع: تنبيه إن تكرر أسلوب الحلقة السابقة في القناة نفسها.
 */

const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const COLORS = ["#B5562E", "#2E6F8E", "#5B7F3A", "#7A4E9A", "#A07A1E"];
export const styleNamesAr: Record<string, string> = {
  board: "سبورة متصلة",
  "board-story": "سبورة متصلة",
  glow: "قصة مضيئة",
  "glow-story": "قصة مضيئة",
  kinetic: "نص حركي",
  "kinetic-text": "نص حركي",
  "sketch-board": "سبورة خط اليد",
  "sim-stage": "محاكاة",
  "desk-moment": "لحظة يومية",
  "character-talk": "شخصية تتكلم",
  "big-question": "سؤال كبير",
  comparison: "مقارنة",
  list: "قائمة",
  timeline: "خط زمني",
  symbolic: "رمزي",
  templates: "قوالب متنوعة",
};
const styleKey = (s: string) => ({ board: "board-story", glow: "glow-story", kinetic: "kinetic-text" } as Record<string, string>)[s] ?? s;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Stage = "script" | "scenes" | "voice" | "video" | "ready" | "scheduled" | "published";
const STAGES: { key: Stage; label: string }[] = [
  { key: "script", label: "النص" },
  { key: "scenes", label: "المشاهد" },
  { key: "voice", label: "الصوت" },
  { key: "video", label: "الفيديو" },
  { key: "ready", label: "جاهزة للنشر" },
  { key: "scheduled", label: "مجدولة" },
  { key: "published", label: "منشورة" },
];
const stageOf = (e: Overview): Stage => {
  if (e.status.published) return "published";
  if (e.status.scheduled) return "scheduled";
  const s = stagesOf(e);
  if (s[0]!.state !== "done") return "script";
  if (s[1]!.state !== "done") return "scenes";
  if (s[2]!.state === "todo" || s[2]!.state === "warn") return "voice";
  if (s[3]!.state !== "done") return "video";
  return "ready";
};
const tabFor = (st: Stage): "script" | "episode" | "publish" => (st === "script" ? "script" : st === "scenes" || st === "voice" ? "episode" : "publish");

/** تنبيه التنوّع: الحلقة بأسلوب الحلقة التي قبلها نفسه في القناة. */
const varietyWarnings = (eps: Overview[]) => {
  const out = new Map<string, string>();
  const sorted = [...eps].sort((a, b) => a.id.localeCompare(b.id));
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1]!, b = sorted[i]!;
    if (a.style && b.style && styleKey(a.style) === styleKey(b.style)) out.set(b.id, `نفس أسلوب الحلقة ${a.id} (${styleNamesAr[styleKey(b.style)] ?? b.style}). غيّر الأسلوب الأساسي لتبقى القناة متنوعة.`);
  }
  return out;
};

export const OpsRoom: React.FC<{
  onOpen: (channel: string, episode: string, tab: "script" | "episode" | "publish") => void;
  onStartIdea: (channel: string, idea: Idea, suggested: string) => void;
  refreshKey?: number;
}> = ({ onOpen, onStartIdea, refreshKey }) => {
  const [data, setData] = useState<OpsChannel[] | null>(null);
  const [err, setErr] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    api.ops().then(setData).catch((e) => setErr((e as Error).message));
  }, [tick, refreshKey]);

  const week = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, []);

  if (err) return <div className="render-box"><b>غرفة العمليات</b><span className="help">{err}</span></div>;
  if (!data) return <div className="render-box"><span className="help">جارٍ تجهيز غرفة العمليات…</span></div>;

  const color = (id: string) => COLORS[data.findIndex((d) => d.channel.id === id) % COLORS.length]!;
  const all = data.flatMap((d) => d.episodes.map((e) => ({ ch: d.channel, e, stage: stageOf(e) })));
  const warnings = new Map(data.flatMap((d) => [...varietyWarnings(d.episodes)].map(([id, w]) => [`${d.channel.id}/${id}`, w] as const)));

  const longThisWeek = data.filter((d) => d.channel.schedule && week.some((day) => day.getDay() === d.channel.schedule!.longDay && d.episodes.some((e) => e.status.scheduled === iso(day) || e.status.published?.date === iso(day)))).length;
  const scheduledCount = data.filter((d) => d.channel.schedule).length;
  const readyCount = all.filter((x) => x.stage === "ready").length;
  const ideasCount = data.reduce((n, d) => n + d.ideas.length, 0);

  const setScheduled = async (ch: string, e: Overview, date: string | undefined) => {
    const status = { ...(await api.statusFor(ch, e.id)) };
    if (date) status.scheduled = date;
    else delete status.scheduled;
    await api.saveStatusFor(ch, e.id, status);
    setTick((t) => t + 1);
  };

  const saveIdeas = async (ch: string, ideas: Idea[]) => {
    setData((cur) => cur?.map((d) => (d.channel.id === ch ? { ...d, ideas } : d)) ?? cur);
    await api.saveIdeas(ch, ideas);
  };

  return (
    <div className="ops">
      <div className="home-head">
        <div>
          <h1>غرفة العمليات</h1>
          <p className="help">القنوات كلها في مكان واحد: ما ينزل هذا الأسبوع، وأين وصلت كل حلقة، وبنك الأفكار.</p>
        </div>
        <div className="kpis">
          <div><b>{longThisWeek}/{scheduledCount}</b><span>حلقات الأسبوع</span></div>
          <div><b>{readyCount}</b><span>جاهزة للنشر</span></div>
          <div><b>{all.length}</b><span>حلقة في الإنتاج</span></div>
          <div><b>{ideasCount}</b><span>فكرة في البنك</span></div>
        </div>
      </div>

      {/* الأسبوع */}
      <section className="ops-sec">
        <h2>هذا الأسبوع</h2>
        <div className="ops-week" style={{ gridTemplateColumns: `140px repeat(7, minmax(0, 1fr))` }}>
          <div />
          {week.map((d, i) => (
            <div key={i} className={`ops-day ${i === 0 ? "today" : ""}`}>
              <b>{i === 0 ? "اليوم" : DAYS[d.getDay()]}</b>
              <span>{d.getDate()}/{d.getMonth() + 1}</span>
            </div>
          ))}
          {data.map((d) => {
            const sch = d.channel.schedule;
            const used = new Set<string>();
            // ترتيب الحلقات المرشحة للأيام القادمة: غير المنشورة وغير المجدولة، الأقدم أولًا
            // الحلقة 000 تجريبية لا تُقترح للنشر
            const queue = d.episodes.filter((e) => e.id !== "000" && !e.status.published && !e.status.scheduled).sort((a, b) => a.id.localeCompare(b.id));
            return (
              <React.Fragment key={d.channel.id}>
                <div className="ops-ch" style={{ borderInlineStartColor: color(d.channel.id) }}>
                  <b>{d.channel.name}</b>
                  <span className="help">{sch ? `حلقة كل ${DAYS[sch.longDay]}` : "بلا جدول"}</span>
                </div>
                {week.map((day, i) => {
                  const date = iso(day);
                  const isLong = sch && day.getDay() === sch.longDay;
                  if (!isLong) {
                    const source = [...d.episodes].filter((e) => (e.status.published?.date ?? e.status.scheduled ?? "9999") <= date).sort((a, b) => b.id.localeCompare(a.id))[0];
                    return (
                      <div key={i} className="ops-cell short">
                        <span>شورت</span>
                        <small>{source ? `من الحلقة ${source.id}` : "لا حلقة بعد"}</small>
                      </div>
                    );
                  }
                  const fixed = d.episodes.find((e) => e.status.scheduled === date || e.status.published?.date === date);
                  if (fixed) {
                    used.add(fixed.id);
                    const st = stageOf(fixed);
                    return (
                      <div key={i} className={`ops-cell long ${st === "published" ? "done" : st === "scheduled" && stagesOf(fixed)[3]!.state !== "done" ? "risk" : "ok"}`} style={{ borderColor: color(d.channel.id) }}>
                        <button className="linkish" onClick={() => onOpen(d.channel.id, fixed.id, tabFor(st))}>🎬 {fixed.id} · {fixed.title || fixed.dir}</button>
                        <small>{st === "published" ? "منشورة" : stagesOf(fixed)[3]!.state === "done" ? "الفيديو جاهز" : "الفيديو لم يكتمل بعد!"}</small>
                        {st !== "published" ? <button className="btn ghost small" onClick={() => setScheduled(d.channel.id, fixed, undefined)}>إلغاء الموعد</button> : null}
                      </div>
                    );
                  }
                  const next = queue.find((e) => !used.has(e.id));
                  if (next) used.add(next.id);
                  return next ? (
                    <div key={i} className="ops-cell long suggest" style={{ borderColor: color(d.channel.id) }}>
                      <span>مقترح: {next.id} · {next.title || next.dir}</span>
                      <button className="btn small primary" onClick={() => setScheduled(d.channel.id, next, date)}>ثبّتها لهذا اليوم</button>
                    </div>
                  ) : (
                    <div key={i} className="ops-cell long empty">
                      <b>فاضي</b>
                      <small>محتاج حلقة لـ{d.channel.name}</small>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </section>

      {/* خط الإنتاج */}
      <section className="ops-sec">
        <h2>خط الإنتاج</h2>
        <div className="ops-board">
          {STAGES.map((st) => {
            const items = all.filter((x) => x.stage === st.key);
            return (
              <div key={st.key} className="ops-col">
                <div className="ops-col-h"><b>{st.label}</b><span className="badge">{items.length}</span></div>
                {items.map(({ ch, e }) => {
                  const w = warnings.get(`${ch.id}/${e.id}`);
                  return (
                    <button key={`${ch.id}/${e.id}`} className="ops-card" style={{ borderInlineStartColor: color(ch.id) }} onClick={() => onOpen(ch.id, e.id, tabFor(st.key))}>
                      <span className="ops-card-ch" style={{ color: color(ch.id) }}>{ch.name} · {e.id}</span>
                      <b>{e.title || e.dir}</b>
                      <span className="ops-card-meta">
                        {e.style ? <span className="chip">{styleNamesAr[styleKey(e.style)] ?? e.style}</span> : null}
                        {e.status.scheduled ? <span className="help">{e.status.scheduled}</span> : null}
                      </span>
                      {w ? <span className="ops-warn" title={w}>⚠ أسلوب مكرر</span> : null}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        {warnings.size ? (
          <div className="ops-warnings">
            {[...warnings].map(([k, w]) => <div key={k}>⚠ <b>{data.find((d) => k.startsWith(`${d.channel.id}/`))?.channel.name} {k.split("/")[1]}</b>: {w}</div>)}
          </div>
        ) : null}
      </section>

      {/* بنك الأفكار */}
      <section className="ops-sec">
        <h2>بنك الأفكار</h2>
        <div className="ops-ideas">
          {data.map((d) => (
            <IdeasColumn
              key={d.channel.id}
              ops={d}
              color={color(d.channel.id)}
              lastStyle={[...d.episodes].sort((a, b) => b.id.localeCompare(a.id))[0]?.style ?? ""}
              onSave={(ideas) => saveIdeas(d.channel.id, ideas)}
              onStart={(idea) => onStartIdea(d.channel.id, idea, String(d.episodes.reduce((m, e) => Math.max(m, Number(e.id)), 0) + 1).padStart(3, "0"))}
            />
          ))}
        </div>
      </section>
    </div>
  );
};

const STYLE_OPTIONS = ["board", "sim-stage", "desk-moment", "kinetic", "glow", "sketch-board", "templates"];

const IdeasColumn: React.FC<{ ops: OpsChannel; color: string; lastStyle: string; onSave: (ideas: Idea[]) => void; onStart: (idea: Idea) => void }> = ({ ops, color, lastStyle, onSave, onStart }) => {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const domains = Object.entries(ops.channel.domains);
  const [domain, setDomain] = useState(domains[0]?.[0] ?? "");
  const add = () => {
    if (!title.trim()) return;
    onSave([{ id: `i${Date.now().toString(36)}`, title: title.trim(), note: note.trim() || undefined, domain, createdAt: new Date().toISOString() }, ...ops.ideas]);
    setTitle("");
    setNote("");
  };
  return (
    <div className="ops-ideas-col" style={{ borderTopColor: color }}>
      <div className="ops-col-h"><b>{ops.channel.name}</b><span className="badge">{ops.ideas.length}</span></div>
      <input type="text" placeholder="عنوان الفكرة أو سؤالها" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
      <textarea rows={2} placeholder="ملاحظة: الزاوية، المصدر، الأسلوب المقترح…" value={note} onChange={(e) => setNote(e.target.value)} />
      <div style={{ display: "flex", gap: 6 }}>
        <select value={domain} onChange={(e) => setDomain(e.target.value)} style={{ flex: 1 }}>
          {domains.map(([id, dm]) => <option key={id} value={id}>{dm.name}</option>)}
        </select>
        <button className="btn small primary" onClick={add} disabled={!title.trim()}>أضف</button>
      </div>
      {ops.ideas.map((idea) => (
        <div key={idea.id} className="ops-idea">
          <b>{idea.title}</b>
          {idea.note ? <span className="help">{idea.note}</span> : null}
          <div className="ops-idea-row">
            <select
              value={idea.style ?? ""}
              onChange={(e) => onSave(ops.ideas.map((x) => (x.id === idea.id ? { ...x, style: e.target.value || undefined } : x)))}
              title="الأسلوب الأساسي المقترح"
            >
              <option value="">الأسلوب: يُختار لاحقًا</option>
              {STYLE_OPTIONS.map((s) => <option key={s} value={s}>{styleNamesAr[styleKey(s)] ?? s}{lastStyle && styleKey(lastStyle) === styleKey(s) ? " (نفس آخر حلقة)" : ""}</option>)}
            </select>
            <button className="btn small" onClick={() => onStart(idea)}>ابدأ حلقة</button>
            <button className="btn ghost small" onClick={() => window.confirm("حذف الفكرة؟") && onSave(ops.ideas.filter((x) => x.id !== idea.id))}>حذف</button>
          </div>
        </div>
      ))}
      {!ops.ideas.length ? <span className="help">لا أفكار بعد. أضف أول فكرة.</span> : null}
    </div>
  );
};
