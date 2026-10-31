import React, { useEffect, useMemo, useState } from "react";
import { api, type CalendarDay, type Idea, type OpsChannel, type Overview } from "../api";
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
  "set-scene": "مشهد في مكان",
  "map-journey": "خرائط متحركة",
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

  const [weekOffset, setWeekOffset] = useState(0);
  const [editDay, setEditDay] = useState<{ ch: string; date: string } | null>(null);
  const [editCh, setEditCh] = useState<string | null>(null);
  const week = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i + weekOffset * 7));
  }, [weekOffset]);
  const todayIso = iso(new Date());

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
        <div className="toolbar" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>{weekOffset === 0 ? "هذا الأسبوع" : weekOffset === 1 ? "الأسبوع القادم" : weekOffset === -1 ? "الأسبوع الماضي" : `أسبوع ${week[0]!.getDate()}/${week[0]!.getMonth() + 1}`}</h2>
          <span className="help">اضغط على أي يوم لتعدّله، أو على اسم القناة لتغيّر يومها وساعتها.</span>
          <span className="spacer" />
          <button className="btn small" onClick={() => setWeekOffset((w) => w - 1)}>→ السابق</button>
          {weekOffset !== 0 ? <button className="btn small" onClick={() => setWeekOffset(0)}>اليوم</button> : null}
          <button className="btn small" onClick={() => setWeekOffset((w) => w + 1)}>التالي ←</button>
        </div>
        <div className="ops-week" style={{ gridTemplateColumns: `140px repeat(7, minmax(0, 1fr))` }}>
          <div />
          {week.map((d, i) => (
            <div key={i} className={`ops-day ${iso(d) === todayIso ? "today" : ""}`}>
              <b>{iso(d) === todayIso ? "اليوم" : DAYS[d.getDay()]}</b>
              <span>{d.getDate()}/{d.getMonth() + 1}</span>
            </div>
          ))}
          {data.map((d) => {
            const sch = d.channel.schedule;
            const used = new Set<string>();
            // ترتيب الحلقات المرشحة للأيام القادمة: غير المنشورة وغير المجدولة، الأقدم أولًا (000 تجريبية لا تُقترح)
            const queue = d.episodes.filter((e) => e.id !== "000" && !e.status.published && !e.status.scheduled).sort((a, b) => a.id.localeCompare(b.id));
            return (
              <React.Fragment key={d.channel.id}>
                <button className="ops-ch" style={{ borderInlineStartColor: color(d.channel.id) }} onClick={() => setEditCh(d.channel.id)} title="تعديل يوم الحلقة والساعة">
                  <b>{d.channel.name}</b>
                  <span className="help">{sch ? `حلقة كل ${DAYS[sch.longDay]}${sch.time ? ` · ${sch.time}` : ""}` : "بلا جدول"} ✎</span>
                </button>
                {week.map((day, i) => {
                  const date = iso(day);
                  const cal = d.calendar?.[date];
                  const open = () => setEditDay({ ch: d.channel.id, date });
                  const fixed = d.episodes.find((e) => e.status.scheduled === date || e.status.published?.date === date);
                  const isLong = sch && day.getDay() === sch.longDay;
                  const shorts = shortsFor(d, date);
                  const shortsLine = shorts.length ? shorts.map((x) => `شورت ${x.n} من ${x.ep}`).join("، ") : "";
                  if (cal?.off) {
                    return (
                      <button key={i} className="ops-cell off" onClick={open}>
                        <b>بلا نشر</b>
                        {cal.note ? <small>{cal.note}</small> : null}
                      </button>
                    );
                  }
                  if (fixed) {
                    used.add(fixed.id);
                    const st = stageOf(fixed);
                    return (
                      <div key={i} role="button" tabIndex={0} onClick={open} className={`ops-cell long ${st === "published" ? "done" : stagesOf(fixed)[3]!.state !== "done" ? "risk" : "ok"}`} style={{ borderColor: color(d.channel.id) }}>
                        <button className="linkish" onClick={(e) => { e.stopPropagation(); onOpen(d.channel.id, fixed.id, tabFor(st)); }}>🎬 {fixed.id} · {fixed.title || fixed.dir}</button>
                        <small>{st === "published" ? "منشورة" : stagesOf(fixed)[3]!.state === "done" ? "الفيديو جاهز" : "الفيديو لم يكتمل بعد!"}</small>
                        {shortsLine ? <small>+ {shortsLine}</small> : null}
                        {cal?.note ? <small className="ops-note">{cal.note}</small> : null}
                      </div>
                    );
                  }
                  if (isLong && date >= todayIso) {
                    const next = queue.find((e) => !used.has(e.id));
                    if (next) used.add(next.id);
                    return next ? (
                      <div key={i} role="button" tabIndex={0} onClick={open} className="ops-cell long suggest" style={{ borderColor: color(d.channel.id) }}>
                        <span>مقترح: {next.id} · {next.title || next.dir}</span>
                        <button className="btn small primary" onClick={(e) => { e.stopPropagation(); setScheduled(d.channel.id, next, date); }}>ثبّتها لهذا اليوم</button>
                      </div>
                    ) : (
                      <button key={i} className="ops-cell long empty" onClick={open}>
                        <b>فاضي</b>
                        <small>محتاج حلقة لـ{d.channel.name}</small>
                      </button>
                    );
                  }
                  return (
                    <button key={i} className={`ops-cell short ${cal?.shorts ? "set" : ""}`} onClick={open}>
                      <span>{shorts.length ? (shorts.length > 1 ? `${shorts.length} شورتس` : "شورت") : "شورت"}</span>
                      <small>{shortsLine || "لا شورت متاح"}</small>
                      {cal?.note ? <small className="ops-note">{cal.note}</small> : null}
                    </button>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </section>
      {editDay ? (
        <DayEditor
          ops={data.find((d) => d.channel.id === editDay.ch)!}
          date={editDay.date}
          auto={shortsFor({ ...data.find((d) => d.channel.id === editDay.ch)!, calendar: {} }, editDay.date)}
          onClose={() => setEditDay(null)}
          onSaved={() => {
            setEditDay(null);
            setTick((t) => t + 1);
          }}
        />
      ) : null}
      {editCh ? <ChannelScheduleEditor channel={editCh} name={data.find((d) => d.channel.id === editCh)?.channel.name ?? ""} onClose={() => setEditCh(null)} onSaved={() => { setEditCh(null); setTick((t) => t + 1); }} /> : null}

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

/** شورتس يوم: ما حُدد في التقويم، وإلا التلقائي (اليوم n بعد آخر حلقة طويلة = الشورت n منها، حتى 6). */
const shortsFor = (d: OpsChannel, date: string): { ep: string; n: number }[] => {
  const cal = d.calendar?.[date];
  if (cal?.shorts) return cal.shorts;
  if (cal?.off) return [];
  const per = d.channel.schedule?.shortsPerDay ?? 1;
  if (!per) return [];
  const dated = d.episodes
    .map((e) => ({ e, at: e.status.published?.date ?? e.status.scheduled }))
    .filter((x): x is { e: Overview; at: string } => Boolean(x.at) && x.at! < date)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  if (!dated) return [];
  const days = Math.round((Date.parse(date) - Date.parse(dated.at)) / 86400000);
  const out: { ep: string; n: number }[] = [];
  for (let k = 0; k < per; k++) {
    const n = (days - 1) * per + k + 1;
    if (n >= 1 && n <= 6) out.push({ ep: dated.e.id, n });
  }
  return out;
};

const fmtDay = (date: string) => {
  const d = new Date(`${date}T00:00:00`);
  return `${DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
};

/** تعديل يوم في تقويم قناة: الحلقة الطويلة، والشورتس، ويوم بلا نشر، وملاحظة. */
const DayEditor: React.FC<{ ops: OpsChannel; date: string; auto: { ep: string; n: number }[]; onClose: () => void; onSaved: () => void }> = ({ ops, date, auto, onClose, onSaved }) => {
  const ch = ops.channel.id;
  const cal: CalendarDay = ops.calendar?.[date] ?? {};
  const current = ops.episodes.find((e) => e.status.scheduled === date);
  const publishedHere = ops.episodes.find((e) => e.status.published?.date === date);
  const [long, setLong] = useState(current?.id ?? "");
  const [custom, setCustom] = useState(Boolean(cal.shorts));
  const [shorts, setShorts] = useState<{ ep: string; n: number }[]>(cal.shorts ?? auto);
  const [off, setOff] = useState(Boolean(cal.off));
  const [note, setNote] = useState(cal.note ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const longOptions = ops.episodes.filter((e) => !e.status.published && (!e.status.scheduled || e.status.scheduled === date));
  const eps = [...ops.episodes].sort((a, b) => a.id.localeCompare(b.id));

  const save = async () => {
    setBusy(true);
    setErr("");
    try {
      // الحلقة الطويلة: تُنقل من يومها السابق إلى هذا اليوم (أو يُلغى موعدها)
      if (current && current.id !== long) {
        const st = { ...(await api.statusFor(ch, current.id)) };
        delete st.scheduled;
        await api.saveStatusFor(ch, current.id, st);
      }
      if (long && long !== current?.id) {
        const st = { ...(await api.statusFor(ch, long)), scheduled: date };
        await api.saveStatusFor(ch, long, st);
      }
      const next = { ...(ops.calendar ?? {}) };
      const day: CalendarDay = {};
      if (off) day.off = true;
      if (custom && !off) day.shorts = shorts.filter((x) => x.ep && x.n >= 1 && x.n <= 6);
      if (note.trim()) day.note = note.trim();
      if (Object.keys(day).length) next[date] = day;
      else delete next[date];
      await api.saveCalendar(ch, next);
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 560 }}>
        <div className="modal-head"><h3>{ops.channel.name} · {fmtDay(date)}</h3></div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label className="check"><input type="checkbox" checked={off} onChange={(e) => setOff(e.target.checked)} /><span>يوم بلا نشر في هذه القناة</span></label>

          {!off ? (
            <>
              <label className="field">
                <span>الحلقة الطويلة في هذا اليوم {publishedHere ? <small>(نُشرت فيه: {publishedHere.id})</small> : null}</span>
                <select value={long} onChange={(e) => setLong(e.target.value)}>
                  <option value="">بدون حلقة طويلة</option>
                  {longOptions.map((e) => <option key={e.id} value={e.id}>{e.id} · {e.title || e.dir}</option>)}
                </select>
                <span className="help">تقدر تنزّل حلقة طويلة في أي يوم، مش بس يوم القناة. اختيار حلقة مجدولة في يوم تاني بينقلها لهنا.</span>
              </label>

              <div className="field">
                <span>الشورتس</span>
                <label className="check"><input type="checkbox" checked={!custom} onChange={(e) => { setCustom(!e.target.checked); if (e.target.checked) setShorts(auto); }} /><span>تلقائي{auto.length ? `: ${auto.map((x) => `شورت ${x.n} من ${x.ep}`).join("، ")}` : " (لا شورت متاح في هذا اليوم)"}</span></label>
                {custom ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {shorts.map((x, i) => (
                      <div key={i} style={{ display: "flex", gap: 6 }}>
                        <select value={x.ep} onChange={(e) => setShorts(shorts.map((y, k) => (k === i ? { ...y, ep: e.target.value } : y)))} style={{ flex: 1 }}>
                          {eps.map((e) => <option key={e.id} value={e.id}>{e.id} · {e.title || e.dir}</option>)}
                        </select>
                        <select value={x.n} onChange={(e) => setShorts(shorts.map((y, k) => (k === i ? { ...y, n: Number(e.target.value) } : y)))} style={{ width: 110 }}>
                          {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>شورت {n}</option>)}
                        </select>
                        <button className="btn ghost small" onClick={() => setShorts(shorts.filter((_, k) => k !== i))}>حذف</button>
                      </div>
                    ))}
                    <button className="btn small" style={{ alignSelf: "flex-start" }} disabled={!eps.length} onClick={() => setShorts([...shorts, { ep: shorts.at(-1)?.ep ?? eps.at(-1)?.id ?? "", n: Math.min(6, (shorts.at(-1)?.n ?? 0) + 1) }])}>+ أضف شورت</button>
                    {!shorts.length ? <span className="help">بلا شورتس في هذا اليوم.</span> : null}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          <label className="field"><span>ملاحظة</span><input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلًا: يوم عرفة، نشر مبكر، تعاون مع قناة…" /></label>
          {err ? <span className="help" style={{ color: "var(--err)" }}>{err}</span> : null}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn" onClick={onClose}>إلغاء</button>
            <button className="btn primary" disabled={busy} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ"}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

/** يوم الحلقة الطويلة وساعتها وعدد الشورتس اليومي لقناة. */
const ChannelScheduleEditor: React.FC<{ channel: string; name: string; onClose: () => void; onSaved: () => void }> = ({ channel, name, onClose, onSaved }) => {
  const [c, setC] = useState<Awaited<ReturnType<typeof api.channelFor>> | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api.channelFor(channel).then(setC).catch((e) => setErr((e as Error).message));
  }, [channel]);
  const sch = c?.schedule ?? { longDay: 6, time: "19:00", shortsPerDay: 1 };
  const set = (patch: Partial<typeof sch>) => c && setC({ ...c, schedule: { ...sch, ...patch } });
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 460 }}>
        <div className="modal-head"><h3>جدول «{name}»</h3></div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {!c ? <span className="help">{err || "جارٍ التحميل…"}</span> : (
            <>
              <label className="field">
                <span>يوم الحلقة الطويلة</span>
                <select value={sch.longDay} onChange={(e) => set({ longDay: Number(e.target.value) })}>
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </label>
              <label className="field"><span>ساعة النشر</span><input type="text" dir="ltr" value={sch.time ?? ""} onChange={(e) => set({ time: e.target.value })} placeholder="19:00" /></label>
              <label className="field"><span>شورتس في اليوم (تلقائيًا من آخر حلقة)</span><input type="number" min={0} max={3} value={sch.shortsPerDay ?? 1} onChange={(e) => set({ shortsPerDay: Number(e.target.value) })} /></label>
              {err ? <span className="help" style={{ color: "var(--err)" }}>{err}</span> : null}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button className="btn" onClick={onClose}>إلغاء</button>
                <button className="btn primary" onClick={async () => { try { await api.saveChannelFor(channel, c); onSaved(); } catch (e) { setErr((e as Error).message); } }}>حفظ</button>
              </div>
            </>
          )}
        </div>
      </div>
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
