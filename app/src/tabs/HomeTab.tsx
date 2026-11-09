import React, { useEffect, useRef, useState } from "react";
import { api, type Overview } from "../api";
import type { ChannelInfo } from "../../../src/channel/types";
import { selectHomeCards, type HomeCardFilter, type HomeCardSort } from "./homeList";
import { arDigits, duration, lengthSource, num } from "../ui/format";
import { Dialog } from "../ui/Dialog";

type StageState = "done" | "warn" | "todo" | "na";
type Stage = { key: string; label: string; state: StageState; note: string };


/** مراحل الحلقة من السكريبت إلى النشر، وحالة كل مرحلة. */
export const stagesOf = (e: Overview): Stage[] => {
  const stale = e.package.video && e.planUpdatedAt && e.package.updatedAt && e.planUpdatedAt > e.package.updatedAt;
  return [
    { key: "script", label: "السكريبت", state: e.check.ok ? "done" : "warn", note: e.check.ok ? (e.length ? `صالح · ${duration(e.length.seconds)}` : "صالح") : `${num(e.check.errors)} خطأ` },
    { key: "scenes", label: "المشاهد", state: !e.scenes ? "todo" : e.blocking ? "warn" : "done", note: !e.scenes ? "لم تُولَّد" : e.blocking ? `${num(e.blocking)} يمنع النسخة النهائية` : `${num(e.scenes)} مشهدًا` },
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
  if (!p.canAssemble) return { text: `المشهد ${num(p.approvedScenes + 1)} من ${num(p.totalScenes)} ينتظر قرارك`, tab: "episode" };
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
}> = ({ channel, onOpen, onNew, onDeleted }) => {
  const [del, setDel] = useState<{ id: string; title: string; typed: string; busy?: boolean; msg?: string } | null>(null);
  const [items, setItems] = useState<Overview[] | null>(null);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<HomeCardFilter>("all");
  const [sort, setSort] = useState<HomeCardSort>("recent");
  useEffect(() => {
    let active = true;
    setItems(null);
    setErr("");
    setSearch("");
    setFilter("all");
    api.overview().then((results) => { if (active) setItems(results); }).catch((e) => { if (active) setErr((e as Error).message); });
    return () => { active = false; };
  }, [channel.id]);

  if (err) return <div className="empty-state"><h2>تعذّر التحميل</h2><p>{err}</p></div>;
  if (!items) return <div className="empty-state"><h2>جارٍ التحميل…</h2></div>;

  const visible = selectHomeCards(items, search, filter, sort, (e) => Boolean(e.production?.masterApproved));
  const deleteDialog = del ? (
    <Dialog labelledBy="del-title" onClose={() => { if (!del.busy) setDel(null); }}>
        <div className="modal-head"><h3 id="del-title">حذف الحلقة {arDigits(del.id)} نهائيًا</h3></div>
        <p>«{del.title}»</p>
        <p className="help">تُحذف نهائيًا ولا يمكن استرجاعها: السكريبت والتشكيل والمشاهد والصوت والفيديو والصور المصغّرة، من جهازك ومن أرشيف البداية النظيفة ومن GitHub.</p>
        <label className="field"><span>اكتب رقم الحلقة ({del.id}) للتأكيد</span><input id="del-confirm" type="text" dir="ltr" value={del.typed} onChange={(ev) => setDel({ ...del, typed: ev.target.value.trim() })} autoFocus /></label>
        {del.msg ? <p className="help" style={{ color: "var(--err)" }}>{del.msg}</p> : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-start" }}>
          <button
            className="btn primary danger"
            aria-busy={del.busy}
            onClick={async () => {
              if (del.busy) return;
              if (del.typed !== del.id) { setDel({ ...del, msg: `اكتب رقم الحلقة (${del.id}) في الخانة للتأكيد.` }); document.getElementById("del-confirm")?.focus(); return; }
              setDel({ ...del, busy: true, msg: undefined });
              try {
                const r = await api.deleteEpisode(del.id, del.typed);
                setItems((xs) => (xs ?? []).filter((x) => x.id !== del.id));
                setDel(null);
                onDeleted?.(del.id);
                if (r.note) window.alert(r.note);
              } catch (x) {
                setDel({ ...del, busy: false, msg: (x as Error).message });
              }
            }}
          >
            {del.busy ? "جارٍ الحذف…" : "احذف نهائيًا"}
          </button>
          <button className="btn" disabled={del.busy} onClick={() => setDel(null)}>إلغاء</button>
        </div>
    </Dialog>
  ) : null;

  return (
    <div className="ledger">
      {deleteDialog}
      <header className="ledger-head">
        <h1>{channel.name}</h1>
        <button className="btn primary" onClick={onNew}>حلقة جديدة</button>
      </header>

      {items.length === 0 ? (
        <div className="ledger-empty">
          <p>لا توجد حلقات في هذه القناة بعد. كل حلقة تمر بأربع خطوات: التجهيز، المشاهد، النسخة النهائية، النشر.</p>
          <button className="btn primary" onClick={onNew}>ابدأ أول حلقة</button>
        </div>
      ) : (
        <>
          {items.length > 6 ? (
            <div className="ledger-tools" role="search" aria-label="البحث في حلقات القناة">
              <input type="search" aria-label="البحث عن حلقة" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالعنوان أو الرقم" />
              <select aria-label="حالة الحلقة" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}><option value="all">كل الحلقات</option><option value="attention">قيد العمل</option><option value="ready">النسخة النهائية معتمدة</option><option value="published">منشورة</option></select>
              <select aria-label="الترتيب" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="recent">الأحدث</option><option value="oldest">الأقدم</option><option value="title">بالعنوان</option></select>
            </div>
          ) : null}
          {visible.length === 0 ? (
            <div className="ledger-empty"><p>لا حلقة تطابق البحث.</p><button className="btn" type="button" onClick={() => { setSearch(""); setFilter("all"); }}>اعرض كل الحلقات</button></div>
          ) : (
            <ol className="ledger-list">
              {visible.map((e) => {
                const steps = fourSteps(e);
                const doneCount = steps.findIndex((s) => !s.done);
                const at = doneCount === -1 ? steps.length : doneCount;
                const next = nextLine(e);
                return (
                  <li key={e.id} className="ledger-row">
                    <button type="button" className="ledger-open" onClick={() => onOpen(e.id, next.tab)}>
                      <span className="ledger-num"><span>{arDigits(e.id)}</span></span>
                      <span className="ledger-title">
                        <b>{e.title || e.dir}</b>
                        <span className="ledger-next">{next.text}</span>
                      </span>
                    </button>
                    <ol className="ledger-steps" aria-label={`الخطوة ${Math.min(at + 1, steps.length)} من ${steps.length}`}>
                      {steps.map((s, i) => (
                        <li key={s.n} className={s.done ? "is-done" : i === at ? "is-now" : ""}>
                          <button type="button" title={s.title} aria-label={`${s.title}${s.done ? " (مكتملة)" : i === at ? " (الحالية)" : ""}`} onClick={() => onOpen(e.id, s.tab)}>{s.n}</button>
                        </li>
                      ))}
                    </ol>
                    <span className="ledger-len" title={e.length ? lengthSource(e.length) : undefined}>
                      {e.length ? <>{duration(e.length.seconds)}<small>{e.length.source === "voice" ? "مقيسة" : "مدة الخطة"}</small></> : null}
                    </span>
                    <RowMenu label={`خيارات الحلقة ${arDigits(e.id)}`} items={[{ label: "حذف الحلقة…", danger: true, onSelect: () => setDel({ id: e.id, title: e.title || e.dir, typed: "" }) }]} />
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
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
