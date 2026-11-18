import React, { useEffect, useRef, useState } from "react";
import { ERRORS, SCENES, arabicCountAr, countAr, everyWeekday } from "../../../src/i18n/count";
import { api, type EpisodeContents, type Overview, type TrashEntry } from "../api";
import type { ChannelInfo } from "../../../src/channel/types";
import { selectHomeCards, type HomeCardFilter, type HomeCardSort } from "./homeList";
import { Num, arDigits, duration, episodeTitle, latinDigits, lengthSource, num } from "../ui/format";
import { Icon } from "../ui/icons";
import { Dialog } from "../ui/Dialog";
import type { SeriesRead } from "../api";
import type { SeriesKind } from "../../../src/channel/series";
import { GENERAL_SLUG } from "../../../src/channel/series";
import { NewSeriesDialog, SeriesGrid } from "./Series";
import { EPISODE_DRAG_TYPE, dragEpisodes, encodeDrag, episodesIn, seriesOfEpisode, sharedSeries } from "./seriesView";
import { MoveEpisodesDialog, RowMoveButton, SelectionDock, useEpisodeMover } from "./MoveEpisodes";
import { OwnerText } from "../ui/OwnerText";

type StageState = "done" | "warn" | "todo" | "na";
type Stage = { key: string; label: string; state: StageState; note: string };


/** مراحل الحلقة من السكريبت إلى النشر، وحالة كل مرحلة. */
export const stagesOf = (e: Overview): Stage[] => {
  const stale = e.package.video && e.planUpdatedAt && e.package.updatedAt && e.planUpdatedAt > e.package.updatedAt;
  return [
    { key: "script", label: "السكريبت", state: e.check.ok ? "done" : "warn", note: e.check.ok ? (e.length ? `صالح — ${duration(e.length.seconds)} ${e.length.source === "voice" ? "مقيسة" : "مدة الخطة"}` : "صالح") : countAr(e.check.errors, ERRORS) },
    { key: "scenes", label: "المشاهد", state: !e.scenes ? "todo" : e.blocking ? "warn" : "done", note: !e.scenes ? "لم تُولَّد" : e.blocking ? `${num(e.blocking)} يمنع النسخة النهائية` : arabicCountAr(e.scenes, SCENES) },
    {
      key: "voice",
      label: "الصوت",
      state: e.voice.total === 0 ? "na" : e.voice.done === e.voice.total ? "done" : e.voice.done ? "warn" : "todo",
      note: e.voice.total === 0 ? "—" : `${num(e.voice.done)} من ${num(e.voice.total)}`,
    },
    { key: "video", label: "الفيديو", state: e.package.video ? (stale ? "warn" : "done") : "todo", note: e.package.video ? (stale ? "أقدم من آخر تعديل" : `حلقة + ${num(e.package.shorts)} شورت`) : "لم يُصنع" },
    { key: "publish", label: "النشر", state: e.status.published ? "done" : "todo", note: e.status.published ? arDigits(e.status.published.date) : "لم يُنشر" },
  ];
};

/** الخطوات الأربع لكل حلقة من سجل الإنتاج: أين وصلت، وما الخطوة التالية، وأين تُفتح. */
/** The delete confirmation: the episode's number typed in either digit system («001» or «٠٠١»). */
export const confirmsEpisode = (typed: string, id: string): boolean => latinDigits(typed.trim()) === id;
/** KI-019: «انقلها إلى سلة المحذوفات» لا يُضغط قبل كتابة رقم الحلقة الصحيح، ولا أثناء النقل. */
export const deleteReady = (typed: string, id: string, busy?: boolean): boolean => !busy && confirmsEpisode(typed, id);

const mb = (bytes: number) => num(Math.max(0.1, Math.round(bytes / 1e5) / 10), 1);
/**
 * The confirmation says exactly what moves (QA balislam 7): the folder with all its files, its paid recordings and
 * videos, into the local trash. Nothing is deleted for good, nothing goes to GitHub, the archive is not touched.
 */
export const trashWhat = (p?: { dir: string; trash: string; contents: EpisodeContents }): string => {
  if (!p) return "تُنقل الحلقة كلها إلى سلة المحذوفات على جهازك؛ لا يُحذف شيء نهائيًا، ولا يُرفع شيء إلى GitHub، و«تراجع» يعيدها.";
  const c = p.contents;
  return [
    `يُنقل المجلد ${p.dir} كله (${num(c.files)} ملفًا، ${mb(c.bytes)} م.ب`,
    c.voiceFiles ? `، منها ${num(c.voiceFiles)} من ملفات الصوت والتسجيلات المدفوعة` : "",
    c.videoFiles ? `، و${num(c.videoFiles)} فيديو` : "",
    `) إلى سلة المحذوفات على جهازك: ${p.trash}.`,
    " لا يُحذف شيء نهائيًا، ولا يُرفع شيء إلى GitHub، ولا يُمس أرشيف البداية النظيفة، و«تراجع» يعيدها إلى مكانها.",
    c.tracked ? ` في المجلد ${num(c.tracked)} ملفًا من Git ستظهر محذوفة في نسختك المحلية حتى تتراجع أو يُقرَّر حذفها من main بمراجعة.` : "",
  ].join("");
};

export type HomeStep = { n: string; title: string; done: boolean; tab: HomeStepTab };
type HomeStepTab = "script" | "storyboard" | "episode" | "review" | "publish";
export const fourSteps = (e: Overview): HomeStep[] => {
  const p = e.production;
  return [
    { n: "١", title: "التجهيز", done: Boolean(p?.script && p?.storyboard), tab: "storyboard" },
    { n: "٢", title: "المشاهد", done: Boolean(p?.canAssemble), tab: "episode" },
    { n: "٣", title: "النسخة النهائية", done: Boolean(p?.masterApproved), tab: "review" },
    { n: "٤", title: "النشر", done: Boolean(p?.publishAllowed && e.status.published), tab: "publish" },
  ];
};
export const nextLine = (e: Overview): { text: string; tab: HomeStepTab } => {
  const p = e.production;
  if (!e.check.ok) return { text: `في السكريبت ما يحتاج إصلاحًا (${num(e.check.errors)})`, tab: "script" };
  if (!p) return { text: "افتح الحلقة لقراءة حالتها", tab: "storyboard" };
  if (!p.script || !p.storyboard) return { text: "راجع التجهيز (الستوري بورد والسكريبت) واعتمده", tab: "storyboard" };
  // D145: scenes are approved in any order, so the line counts what is left rather than naming «the next» one.
  if (!p.canAssemble) return p.totalScenes > p.approvedScenes
    ? { text: `باقي ${countAr(p.totalScenes - p.approvedScenes, SCENES)} من ${num(p.totalScenes)} للاعتماد، بأي ترتيب`, tab: "episode" }
    : { text: "كل المشاهد معتمدة؛ آيات بانتظار تلاواتها", tab: "review" };
  if (!p.assemblyApproved) return { text: "شاهد الحلقة مجمّعة واعتمدها", tab: "review" };
  if (!p.masterApproved) return { text: "اعتمد النسخة النهائية", tab: "review" };
  if (!p.publishAllowed) return { text: "امنح إذن النشر", tab: "publish" };
  if (!e.status.published) return { text: "جاهزة للنشر", tab: "publish" };
  return { text: `نُشرت ${arDigits(e.status.published.date)}`, tab: "publish" };
};

export const HomeTab: React.FC<{
  channel: ChannelInfo;
  onOpen: (id: string, tab: HomeStepTab) => void;
  onNew: () => void;
  onDeleted?: (id: string) => void;
  /** «تراجع» after a delete: the episode is back in its place (the page re-reads the list). */
  onRestored?: (id: string) => void;
  /** The series page («#/<channel>/series/<id>») */
  onOpenSeries?: (id: string) => void;
}> = ({ channel, onOpen, onNew, onDeleted, onRestored, onOpenSeries }) => {
  const [series, setSeries] = useState<SeriesRead | null>(null);
  const [seriesFilter, setSeriesFilter] = useState("all");
  const [newSeries, setNewSeries] = useState<SeriesKind | null>(null);
  const [del, setDel] = useState<{ id: string; title: string; typed: string; busy?: boolean; msg?: string; preview?: { dir: string; trash: string; contents: EpisodeContents } } | null>(null);
  // QA balislam 7: what was moved to the local trash, with «تراجع» until the owner leaves the page.
  const [trashed, setTrashed] = useState<{ entry: TrashEntry; trash: string; busy?: boolean; msg?: string } | null>(null);
  useEffect(() => {
    if (!del || del.preview) return;
    let live = true;
    api.trashPreview(del.id).then((p) => { if (live) setDel((d) => (d && d.id === del.id ? { ...d, preview: p } : d)); }, () => {});
    return () => { live = false; };
  }, [del?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [items, setItems] = useState<Overview[] | null>(null);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<HomeCardFilter>("all");
  const [sort, setSort] = useState<HomeCardSort>("recent");
  // Moving episodes between series (D77): the selection, the dialog, and the rows being dragged
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [moving, setMoving] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState<string[] | null>(null);
  const mover = useEpisodeMover(async () => {
    const [o, r] = await Promise.all([api.overview(), api.series()]);
    setItems(o); setSeries(r); setSelected(new Set());
  });
  useEffect(() => {
    let active = true;
    setItems(null);
    setErr("");
    setSearch("");
    setFilter("all");
    api.overview().then((results) => { if (active) setItems(results); }).catch((e) => { if (active) setErr((e as Error).message); });
    setSeriesFilter("all");
    api.series().then((r) => { if (active) setSeries(r); }).catch(() => { if (active) setSeries(null); });
    return () => { active = false; };
  }, [channel.id]);

  // The channel's rhythm under its name (direction D): «حلقة كل أربعاء، وشورتس يومية منها».
  const [tagline, setTagline] = useState("");
  useEffect(() => {
    let live = true;
    const DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    api.channel().then((c) => {
      if (!live) return;
      const day = c.schedule ? DAYS[c.schedule.longDay] : undefined;
      setTagline(day ? `حلقة ${everyWeekday(day)}${c.schedule?.shortsPerDay ? "، وشورتس يومية منها" : ""}` : c.description ?? "");
    }, () => live && setTagline(""));
    return () => { live = false; };
  }, [channel.id]);

  if (err) return <div className="empty-state"><h2>تعذّر التحميل</h2><p><OwnerText text={err} /></p></div>;
  if (!items) return <div className="empty-state"><h2>جارٍ التحميل…</h2></div>;

  const inSeries = series && seriesFilter !== "all" ? new Set(episodesIn(seriesFilter, series.series, items).map((e) => e.id)) : null;
  const visible = selectHomeCards(items, search, filter, sort, (e) => Boolean(e.production?.masterApproved)).filter((e) => !inSeries || inSeries.has(e.id));
  const seriesName = (id: string) => series?.series.find((x) => x.id === id);
  // Moving needs somewhere to go: another active series or category than «عام»
  const canMove = Boolean(series && series.series.some((x) => x.id !== GENERAL_SLUG && x.status !== "archived"));
  const generalIds = items.filter((e) => seriesOfEpisode(e) === GENERAL_SLUG).map((e) => e.id);
  const toggle = (id: string) => setSelected((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const moveDialog = moving && series ? (
    <MoveEpisodesDialog episodes={moving} current={sharedSeries(moving, items)} data={series} onClose={() => setMoving(null)}
      onPick={async (to) => { await mover.move(to, moving); setMoving(null); }} />
  ) : null;
  const deleteDialog = del ? (
    <Dialog labelledBy="del-title" onClose={() => { if (!del.busy) setDel(null); }}>
        <div className="modal-head"><h3 id="del-title">حذف الحلقة {arDigits(del.id)}</h3></div>
        <p>«{episodeTitle(del.title)}»</p>
        <p className="help">{trashWhat(del.preview)}</p>
        <label className="field"><span>اكتب رقم الحلقة (<Num>{del.id}</Num>) للتأكيد</span><input id="del-confirm" type="text" dir="ltr" inputMode="numeric" placeholder={arDigits(del.id)} value={del.typed} onChange={(ev) => setDel({ ...del, typed: ev.target.value.trim() })} autoFocus /></label>
        {del.msg ? <p className="help" style={{ color: "var(--err)" }}>{del.msg}</p> : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-start" }}>
          <button
            className="btn primary danger"
            aria-busy={del.busy}
            disabled={!deleteReady(del.typed, del.id, del.busy)}
            onClick={async () => {
              if (del.busy) return;
              if (!confirmsEpisode(del.typed, del.id)) { setDel({ ...del, msg: `اكتب رقم الحلقة (${arDigits(del.id)}) في الخانة للتأكيد.` }); document.getElementById("del-confirm")?.focus(); return; }
              setDel({ ...del, busy: true, msg: undefined });
              try {
                const r = await api.deleteEpisode(del.id, latinDigits(del.typed.trim()));
                setItems((xs) => (xs ?? []).filter((x) => x.id !== del.id));
                setDel(null);
                setTrashed({ entry: r.entry, trash: r.trash });
                onDeleted?.(del.id);
              } catch (x) {
                setDel({ ...del, busy: false, msg: (x as Error).message });
              }
            }}
          >
            {del.busy ? "جارٍ النقل…" : "انقلها إلى سلة المحذوفات"}
          </button>
          <button className="btn" disabled={del.busy} onClick={() => setDel(null)}>إلغاء</button>
        </div>
    </Dialog>
  ) : null;

  // The episode that waits for the owner first is lifted on a card (direction D).
  const hot = visible.find((e) => fourSteps(e).some((s) => !s.done))?.id;
  const undo = async () => {
    if (!trashed || trashed.busy) return;
    setTrashed({ ...trashed, busy: true, msg: undefined });
    try {
      await api.restoreTrash(trashed.entry.id);
      setTrashed(null);
      setItems(await api.overview());
      onRestored?.(trashed.entry.from);
    } catch (x) {
      setTrashed({ ...trashed, busy: false, msg: (x as Error).message });
    }
  };
  return (
    <div className="ledger">
      {deleteDialog}

      <header className="ms-hero ledger-head">
        <h1>{channel.name}</h1>
        {tagline ? <p>{tagline}</p> : null}
      </header>
      {trashed ? (
        // Inline under the heading (the page's own dock stays at the bottom): what moved, and «تراجع».
        <section className="trash-undo" role="status" aria-label="نُقلت الحلقة إلى سلة المحذوفات">
          <p>نُقلت الحلقة «{episodeTitle(trashed.entry.title || trashed.entry.from.split("/").pop() || "")}» إلى سلة المحذوفات على جهازك ({trashed.trash}). لم يُحذف شيء نهائيًا ولم يُرفع شيء.{trashed.msg ? ` ${trashed.msg}` : ""}</p>
          <div className="trash-undo-ctl">
            <button type="button" className="btn primary" aria-busy={trashed.busy} onClick={() => void undo()}>{trashed.busy ? "جارٍ الاسترجاع…" : "تراجع"}</button>
            <button type="button" className="btn ghost" onClick={() => setTrashed(null)}>إغلاق</button>
          </div>
        </section>
      ) : null}
      {moveDialog}
      {mover.node}
      {series ? <SeriesGrid data={series} items={items} onOpen={(id) => onOpenSeries?.(id)} onNew={setNewSeries}
        dragging={canMove ? dragging : null}
        onDropEpisodes={canMove ? (to, ids) => { setDragging(null); void mover.move(to, ids).catch((x) => mover.setToast({ line: (x as Error).message, err: true })); } : undefined}
        onMoveGeneral={canMove && generalIds.length ? () => { setSelected(new Set(generalIds)); setMoving(generalIds); } : undefined} /> : null}
      {newSeries && series ? <NewSeriesDialog kind={newSeries} data={series} onClose={() => setNewSeries(null)} onCreated={(id) => { setNewSeries(null); onOpenSeries?.(id); }} /> : null}
      {items.length ? (
        <div className="all-eps-head">
          <h2>كل الحلقات</h2>
          {canMove ? (
            <div className="all-eps-acts">
              {generalIds.length ? <button type="button" className="btn ghost" onClick={() => setSelected(new Set(generalIds))}>تحديد الكل في «عام»</button> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="ledger-empty">
          <p>لا توجد حلقات في هذه القناة بعد. كل حلقة تمر بأربع خطوات: التجهيز، المشاهد، النسخة النهائية، النشر.</p>
        </div>
      ) : (
        <>
          {items.length > 6 || (series && series.series.length > 1) ? (
            <div className="ledger-tools" role="search" aria-label="البحث في حلقات القناة">
              {series && series.series.length > 1 ? (
                <select aria-label="السلسلة" value={seriesFilter} onChange={(e) => setSeriesFilter(e.target.value)}>
                  <option value="all">كل السلاسل</option>
                  {series.series.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              ) : null}
              <input type="search" aria-label="البحث عن حلقة" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالعنوان أو الرقم" />
              <select aria-label="حالة الحلقة" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}><option value="all">كل الحلقات</option><option value="attention">قيد العمل</option><option value="ready">النسخة النهائية معتمدة</option><option value="published">منشورة</option></select>
              <select aria-label="الترتيب" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="recent">الأحدث</option><option value="oldest">الأقدم</option><option value="title">بالعنوان</option></select>
            </div>
          ) : null}
          {visible.length === 0 ? (
            <div className="ledger-empty"><p>لا حلقة تطابق البحث.</p><button className="btn" type="button" onClick={() => { setSearch(""); setFilter("all"); setSeriesFilter("all"); }}>اعرض كل الحلقات</button></div>
          ) : (
            <ol className={`ledger-list${canMove ? " is-pickable" : ""}`}>
              {visible.map((e) => {
                const steps = fourSteps(e);
                const doneCount = steps.findIndex((s) => !s.done);
                const at = doneCount === -1 ? steps.length : doneCount;
                const next = nextLine(e);
                return (
                  <li key={e.id} className={`ledger-row${e.id === hot ? " is-hot" : ""}${selected.has(e.id) ? " is-picked" : ""}${dragging?.includes(e.id) ? " is-dragged" : ""}`}
                    draggable={canMove || undefined}
                    onDragStart={canMove ? (ev) => { const ids = dragEpisodes(e.id, selected); ev.dataTransfer.setData(EPISODE_DRAG_TYPE, encodeDrag(ids)); ev.dataTransfer.effectAllowed = "move"; setDragging(ids); } : undefined}
                    onDragEnd={canMove ? () => setDragging(null) : undefined}>
                    {canMove ? (
                      <label className="ledger-pick" title="حدّد لنقلها مع غيرها">
                        <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} aria-label={`حدّد الحلقة ${arDigits(e.id.replace(/^0+(?=\d)/, ""))}`} />
                      </label>
                    ) : null}
                    <span className="ledger-num" aria-hidden="true"><Num>{e.id.replace(/^0+(?=\d)/, "")}</Num></span>
                    <div className="ledger-main">
                      <button type="button" className="ledger-open" onClick={() => onOpen(e.id, next.tab)}>
                        <span className="ledger-k">الحلقة {arDigits(e.id.replace(/^0+(?=\d)/, ""))}{series && seriesOfEpisode(e) !== GENERAL_SLUG ? <span className="ledger-series">، <i style={{ background: seriesName(seriesOfEpisode(e))?.derived?.accent }} aria-hidden="true" />{seriesName(seriesOfEpisode(e))?.name ?? ""}</span> : null}</span>
                        <span className="ledger-title"><b>{episodeTitle(e.title) || e.dir}</b></span>
                      </button>
                      <div className="ledger-pg">
                        <ol className="ledger-steps" aria-label={`الخطوة ${Math.min(at + 1, steps.length)} من ${steps.length}`}>
                          {steps.map((s, i) => (
                            <li key={s.n} className={s.done ? "is-done" : i === at ? "is-now" : ""}>
                              <button type="button" title={s.title} aria-label={`${s.title}${s.done ? " (مكتملة)" : i === at ? " (الحالية)" : ""}`} onClick={() => onOpen(e.id, s.tab)}>{s.n}</button>
                            </li>
                          ))}
                        </ol>
                        <span className="ledger-next">{next.text}</span>
                        {canMove ? <RowMoveButton episode={e.id} onMove={() => setMoving([e.id])} /> : null}
                      </div>
                    </div>
                    <span className="ledger-len" title={e.length ? lengthSource(e.length) : undefined}>
                      {e.length ? <><b><Num className="clk">{duration(e.length.seconds)}</Num></b>{e.length.source === "voice" ? "مقيسة" : "مدة الخطة"}</> : null}
                    </span>
                    <RowMenu label={`خيارات الحلقة ${arDigits(e.id)}`} items={[...(canMove ? [{ label: "انقل إلى سلسلة…", onSelect: () => setMoving([e.id]) }] : []), { label: "حذف الحلقة…", danger: true, onSelect: () => setDel({ id: e.id, title: e.title || e.dir, typed: "" }) }]} />
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
      {/* The one next action on the channel's episodes: a new episode, in the dock */}
      <div className="ms-dock" role="group" aria-label="حلقات القناة">
        <div className="ms-dock-in">
          {selected.size ? (
            <SelectionDock count={selected.size} onMove={() => setMoving([...selected].sort())} onClear={() => setSelected(new Set())} />
          ) : <button className="btn primary" type="button" onClick={onNew}><Icon name="plus" />{items.length ? "حلقة جديدة" : "ابدأ أول حلقة"}</button>}
        </div>
      </div>
    </div>
  );
};

/** «⋯» for rare, destructive row actions (D52): delete is never a bare word beside every episode. */
const RowMenu: React.FC<{ label: string; items: { label: string; danger?: boolean; onSelect: () => void }[] }> = ({ label, items }) => {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    box.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", key); };
  }, [open]);
  return (
    <div className="row-menu" ref={box}>
      <button ref={btn} type="button" className="ledger-more" aria-haspopup="menu" aria-expanded={open} aria-label={label} title={label} onClick={() => setOpen((v) => !v)}>⋯</button>
      {open ? (
        <div className="row-menu-pop" role="menu">
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" className={it.danger ? "is-danger" : undefined} onClick={() => { setOpen(false); it.onSelect(); }}>{it.label}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
