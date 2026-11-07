import React, { useEffect, useState } from "react";
import { api, type Overview } from "../api";
import type { ChannelInfo } from "../../../src/channel/types";
import { selectHomeCards, type HomeCardFilter, type HomeCardSort } from "./homeList";
import "./ReleaseReadiness.css";

type StageState = "done" | "warn" | "todo" | "na";
type Stage = { key: string; label: string; state: StageState; note: string };

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

/** مراحل الحلقة من السكريبت إلى النشر، وحالة كل مرحلة. */
export const stagesOf = (e: Overview): Stage[] => {
  const stale = e.package.video && e.planUpdatedAt && e.package.updatedAt && e.planUpdatedAt > e.package.updatedAt;
  return [
    { key: "script", label: "السكريبت", state: e.check.ok ? "done" : "warn", note: e.check.ok ? `صالح · ${fmt(e.check.seconds)}` : `${e.check.errors} خطأ` },
    { key: "scenes", label: "المشاهد", state: !e.scenes ? "todo" : e.release ? (e.release.storyboard.done === e.scenes && e.release.scenes.done === e.scenes && !e.blocking ? "done" : "warn") : "warn", note: !e.scenes ? "لم تُولَّد" : e.release ? `اللوحات ${e.release.storyboard.done}/${e.scenes} · المراجعة ${e.release.scenes.done}/${e.scenes}` : "يلزم فحص اعتماد المشاهد" },
    {
      key: "voice",
      label: "الصوت",
      state: e.voice.total === 0 ? "na" : e.voice.done === e.voice.total ? "done" : e.voice.done ? "warn" : "todo",
      note: e.voice.total === 0 ? "—" : `${e.voice.done} من ${e.voice.total}`,
    },
    { key: "video", label: "الفيديو", state: e.release?.master && !stale ? "done" : e.package.video ? "warn" : "todo", note: e.package.video ? (stale ? "أقدم من آخر تعديل" : e.release?.master ? "Master بصوت كامل" : "معاينة / Master غير مثبت") : "لم يُصنع" },
    { key: "publish", label: "النشر", state: e.status.published ? "done" : "todo", note: e.status.published ? e.status.published.date : "لم يُنشر" },
  ];
};

const nextStep = (e: Overview): { text: string; tab: "script" | "episode" | "publish" } => {
  if (e.status.published) return { text: "منشورة", tab: "publish" };
  const s = stagesOf(e);
  if (s[0]!.state !== "done") return { text: "أصلح أخطاء السكريبت", tab: "script" };
  if (s[1]!.state !== "done") return { text: "راجع المشاهد وأكمل الناقص", tab: "episode" };
  if (s[2]!.state === "todo" || s[2]!.state === "warn") return { text: "ولّد الصوت", tab: "episode" };
  if (s[3]!.state !== "done") return { text: "اصنع الحلقة وملفات النشر", tab: "publish" };
  if (!e.release?.ready) return { text: `موانع النشر: ${e.release?.blockers.length ?? "فحص غير متاح"}`, tab: "publish" };
  if (s[4]!.state !== "done") return { text: "النسخة معتمدة · انتقل لخطوات النشر", tab: "publish" };
  return { text: "منشورة", tab: "publish" };
};

export const HomeTab: React.FC<{
  channel: ChannelInfo;
  onOpen: (id: string, tab: "script" | "episode" | "publish") => void;
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

  const published = items.filter((e) => e.status.published).length;
  const ready = items.filter((e) => e.release?.ready === true && !e.status.published).length;
  const minutes = items.reduce((n, e) => n + e.check.seconds, 0) / 60;
  const visible = selectHomeCards(items, search, filter, sort, (e) =>
    e.release?.ready === true);

  return (
    <div className="home">
      {del ? (
        <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="del-title">
          <div className="modal">
            <div className="modal-head"><h3 id="del-title">حذف الحلقة {del.id} نهائيًا</h3></div>
            <p>«{del.title}»</p>
            <p className="help">تُحذف نهائيًا ولا يمكن استرجاعها: السكريبت والتشكيل والمشاهد والصوت والفيديو والصور المصغّرة، من جهازك ومن أرشيف البداية النظيفة ومن GitHub.</p>
            <label className="field"><span>اكتب رقم الحلقة ({del.id}) للتأكيد</span><input id="del-confirm" type="text" dir="ltr" value={del.typed} onChange={(ev) => setDel({ ...del, typed: ev.target.value.trim() })} autoFocus /></label>
            {del.msg ? <p className="help" style={{ color: "var(--err)" }}>{del.msg}</p> : null}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-start" }}>
              <button
                className="btn primary danger"
                disabled={del.typed !== del.id || del.busy}
                onClick={async () => {
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
          </div>
        </div>
      ) : null}
      <div className="home-head">
        <div>
          <h1>{channel.name}</h1>
          <p className="help">كل حلقات القناة ومرحلة كل واحدة. اضغط على الخطوة التالية لتنتقل إليها.</p>
        </div>
        <div className="kpis">
          <div><b>{items.length}</b><span>حلقة</span></div>
          <div><b>{ready}</b><span>جاهزة للنشر</span></div>
          <div><b>{published}</b><span>منشورة</span></div>
          <div><b>{minutes.toFixed(0)}</b><span>دقيقة محتوى</span></div>
        </div>
        <button className="btn primary" onClick={onNew}>+ حلقة جديدة</button>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <h2>لا توجد حلقات بعد</h2>
          <p>ابدأ بأول حلقة: اكتب سؤالها، ثم السكريبت، وستظهر المشاهد تلقائيًا.</p>
          <button className="btn primary" onClick={onNew}>+ حلقة جديدة</button>
        </div>
      ) : (
        <>
          <div className="episode-list-tools" role="search" aria-label="البحث في حلقات القناة">
            <label className="field"><span>البحث عن حلقة</span><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="اسم الحلقة أو رقمها أو المجال" /></label>
            <label className="field"><span>حالة الحلقة</span><select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}><option value="all">جميع الحالات</option><option value="attention">قيد العمل</option><option value="ready">جاهزة للنشر</option><option value="published">منشورة</option></select></label>
            <label className="field"><span>الترتيب</span><select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="recent">الأحدث رقمًا</option><option value="oldest">الأقدم رقمًا</option><option value="title">العنوان أبجديًا</option></select></label>
            <span className="episode-list-count" role="status">{visible.length} من {items.length} حلقة</span>
          </div>
          {visible.length === 0 ? <div className="episode-list-empty"><strong>لا توجد حلقات مطابقة.</strong><p className="help">جرّب تغيير البحث أو الحالة.</p><button className="btn" type="button" onClick={() => { setSearch(""); setFilter("all"); }}>مسح البحث والفلاتر</button></div> : null}
          <div className="ep-grid">
          {visible.map((e) => {
            const stages = stagesOf(e);
            const next = nextStep(e);
            return (
              <article key={e.id} className="ep-card">
                <header>
                  <span className="ep-num">{e.id}</span>
                  <div className="ep-title">
                    <b>{e.title || e.dir}</b>
                    <span className="help">{e.domain}{e.lang ? ` · ${e.lang}` : ""}</span>
                  </div>
                </header>
                <ol className="stages">
                  {stages.map((s) => (
                    <li key={s.key} className={`st ${s.state}`}>
                      <i aria-hidden="true" />
                      <span className="st-l">{s.label}</span>
                      <span className="st-n">{s.note}</span>
                    </li>
                  ))}
                </ol>
                {!e.status.published && e.release && !e.release.ready ? <details className="release-blockers"><summary>موانع النشر ({e.release.blockers.length})</summary><ul>{e.release.blockers.map((reason, i) => <li key={i}>{reason}</li>)}</ul></details> : null}
                <footer>
                  <button className={`btn ${next.text === "منشورة" ? "" : "primary"} small`} onClick={() => onOpen(e.id, next.tab)}>
                    {next.text === "منشورة" ? "عرض" : `التالي: ${next.text}`}
                  </button>
                  <button className="btn ghost small" onClick={() => onOpen(e.id, "episode")}>المشاهد</button>
                  <button className="btn ghost small" onClick={() => onOpen(e.id, "script")}>السكريبت</button>
                  <span className="spacer" />
                  <button className="btn ghost small danger" onClick={() => setDel({ id: e.id, title: e.title || e.dir, typed: "" })}>حذف</button>
                </footer>
              </article>
            );
          })}
          </div>
        </>
      )}
    </div>
  );
};
