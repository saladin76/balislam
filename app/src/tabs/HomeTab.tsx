import React, { useEffect, useState } from "react";
import { api, type Overview } from "../api";
import type { ChannelInfo } from "../../../src/channel/types";

type StageState = "done" | "warn" | "todo" | "na";
type Stage = { key: string; label: string; state: StageState; note: string };

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

/** مراحل الحلقة من السكريبت إلى النشر، وحالة كل مرحلة. */
export const stagesOf = (e: Overview): Stage[] => {
  const stale = e.package.video && e.planUpdatedAt && e.package.updatedAt && e.planUpdatedAt > e.package.updatedAt;
  return [
    { key: "script", label: "السكريبت", state: e.check.ok ? "done" : "warn", note: e.check.ok ? `صالح · ${fmt(e.check.seconds)}` : `${e.check.errors} خطأ` },
    { key: "scenes", label: "المشاهد", state: !e.scenes ? "todo" : e.blocking ? "warn" : "done", note: !e.scenes ? "لم تُولَّد" : e.blocking ? `${e.blocking} يمنع النسخة النهائية` : `${e.scenes} مشهدًا` },
    {
      key: "voice",
      label: "الصوت",
      state: e.voice.total === 0 ? "na" : e.voice.done === e.voice.total ? "done" : e.voice.done ? "warn" : "todo",
      note: e.voice.total === 0 ? "—" : `${e.voice.done} من ${e.voice.total}`,
    },
    { key: "video", label: "الفيديو", state: e.package.video ? (stale ? "warn" : "done") : "todo", note: e.package.video ? (stale ? "أقدم من آخر تعديل" : `حلقة + ${e.package.shorts} شورت`) : "لم يُصنع" },
    { key: "publish", label: "النشر", state: e.status.published ? "done" : "todo", note: e.status.published ? e.status.published.date : "لم يُنشر" },
  ];
};

const nextStep = (e: Overview): { text: string; tab: "script" | "episode" | "publish" } => {
  const s = stagesOf(e);
  if (s[0]!.state !== "done") return { text: "أصلح أخطاء السكريبت", tab: "script" };
  if (s[1]!.state !== "done") return { text: "راجع المشاهد وأكمل الناقص", tab: "episode" };
  if (s[2]!.state === "todo" || s[2]!.state === "warn") return { text: "ولّد الصوت", tab: "episode" };
  if (s[3]!.state !== "done") return { text: "اصنع الحلقة وملفات النشر", tab: "publish" };
  if (s[4]!.state !== "done") return { text: "شاهدها كاملة ثم انشرها", tab: "publish" };
  return { text: "منشورة", tab: "publish" };
};

export const HomeTab: React.FC<{
  channel: ChannelInfo;
  onOpen: (id: string, tab: "script" | "episode" | "publish") => void;
  onNew: () => void;
}> = ({ channel, onOpen, onNew }) => {
  const [items, setItems] = useState<Overview[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api.overview().then(setItems).catch((e) => setErr((e as Error).message));
  }, [channel.id]);

  if (err) return <div className="empty-state"><h2>تعذّر التحميل</h2><p>{err}</p></div>;
  if (!items) return <div className="empty-state"><h2>جارٍ التحميل…</h2></div>;

  const published = items.filter((e) => e.status.published).length;
  const ready = items.filter((e) => stagesOf(e).slice(0, 4).every((s) => s.state === "done" || s.state === "na") && !e.status.published).length;
  const minutes = items.reduce((n, e) => n + e.check.seconds, 0) / 60;

  return (
    <div className="home">
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
        <div className="ep-grid">
          {items.map((e) => {
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
                <footer>
                  <button className={`btn ${next.text === "منشورة" ? "" : "primary"} small`} onClick={() => onOpen(e.id, next.tab)}>
                    {next.text === "منشورة" ? "عرض" : `التالي: ${next.text}`}
                  </button>
                  <button className="btn ghost small" onClick={() => onOpen(e.id, "episode")}>المشاهد</button>
                  <button className="btn ghost small" onClick={() => onOpen(e.id, "script")}>السكريبت</button>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
