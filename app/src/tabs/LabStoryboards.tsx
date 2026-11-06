/**
 * ستوري بورد المختبرات (ملحق الأمر 015، «بالإسلام» وحدها): صور بكل نسخها داخل بطاقة المختبر،
 * منفصلة عن معاينات الفيديو. الأحدث يُعرض أولًا، والنسخ السابقة بزر، والمقارنة جنبًا إلى جنب،
 * والتكبير في نافذة تفحص التفاصيل (ملء الشاشة، 100%، 200%، والأصل في تبويب جديد للتكبير باللمس).
 * القرار (معتمد فنيًا / يحتاج تعديلًا) زر صريح بنص مكتوب؛ لا يتغير شيء بمجرد العرض.
 */
import React, { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { STORYBOARD_STATUS_AR, labStoryboardsEnabled, shownStatus, type StoryboardEntry, type StoryboardStatus, type StoryboardVersion } from "../../../src/channel/labStoryboardsShared";

const date = (v?: string | null) => (v ? new Date(v).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }) : "—");
const Status: React.FC<{ v: StoryboardVersion }> = ({ v }) => {
  const s = shownStatus(v);
  return <span className={`lab-badge sbi-${s}`}>{STORYBOARD_STATUS_AR[s]}</span>;
};

type Zoom = "fit" | "100" | "200";
const Lightbox: React.FC<{ src: string; title: string; onClose: () => void }> = ({ src, title, onClose }) => {
  const [zoom, setZoom] = useState<Zoom>("fit");
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="sbi-lightbox" role="dialog" aria-label={title} dir="rtl">
      <div className="sbi-lightbox-bar">
        <b>{title}</b>
        <span className="sbi-zoom">
          {(["fit", "100", "200"] as Zoom[]).map((z) => (
            <button key={z} className={zoom === z ? "on" : ""} onClick={() => setZoom(z)}>
              {z === "fit" ? "ملء الشاشة" : `${z}%`}
            </button>
          ))}
          <a href={src} target="_blank" rel="noreferrer">الأصل في تبويب جديد</a>
          <button onClick={onClose} aria-label="إغلاق">إغلاق ✕</button>
        </span>
      </div>
      <div className={`sbi-lightbox-body z-${zoom}`}>
        <img src={src} alt={title} />
      </div>
    </div>
  );
};

const Decide: React.FC<{ channel: string; dir: string; slot: string; v: StoryboardVersion; onDone: () => void }> = ({ channel, dir, slot, v, onDone }) => {
  const [open, setOpen] = useState<StoryboardStatus | null>(null);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const submit = async () => {
    if (!open) return;
    try {
      await api.decideLabStoryboard(channel, dir, slot, v.version, open, note);
      setOpen(null);
      setNote("");
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  if (!open)
    return (
      <div className="sbi-decide">
        <span className="help">قرارك على النسخة {v.version}:</span>
        <button onClick={() => setOpen("approved")}>اعتمدها فنيًا…</button>
        <button onClick={() => setOpen("changes")}>تحتاج تعديلًا…</button>
        {v.status !== "review" ? <button onClick={() => setOpen("review")}>أعدها للمراجعة…</button> : null}
      </div>
    );
  return (
    <div className="sbi-decide open">
      <label>
        {open === "approved" ? "ما الذي تعتمده في هذه النسخة؟" : open === "changes" ? "ما الذي يحتاج تعديلًا؟" : "سبب إعادتها للمراجعة"}
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} dir="rtl" />
      </label>
      <button disabled={!note.trim()} onClick={submit}>سجّل «{STORYBOARD_STATUS_AR[open]}»</button>
      <button onClick={() => setOpen(null)}>إلغاء</button>
      {err ? <p className="err">{err}</p> : null}
    </div>
  );
};

const Version: React.FC<{ channel: string; dir: string; e: StoryboardEntry; v: StoryboardVersion; label: string; onZoom: (v: StoryboardVersion) => void }> = ({ channel, dir, e, v, label, onZoom }) => (
  <figure className="sbi-version">
    {/* بعرض البطاقة كاملًا في إطار يُمرَّر داخله، فتُقرأ التفاصيل دون تصغير الصورة الطويلة إلى ارتفاع الشاشة */}
    <div className="sbi-thumb" tabIndex={0} aria-label={`${v.title}: مرّر داخل الإطار، أو كبّر`}>
      <img src={api.labStoryboardUrl(channel, dir, v.file)} alt={v.title} loading="lazy" onClick={() => onZoom(v)} />
    </div>
    <figcaption>
      <span className="sbi-line">
        <span className="sbi-kind">صورة</span> <b>{label}</b> <Status v={v} />
        <button className="sbi-zoom-btn" onClick={() => onZoom(v)}>تكبير وفحص التفاصيل</button>
      </span>
      <span className="help">النسخة {v.version} · {date(v.uploadedAt)} · <code dir="ltr">{v.file}</code>{v.source && v.source !== v.file ? <> (الأصل <code dir="ltr">{v.source}</code>)</> : null}</span>
      <span>{v.title}</span>
      {v.note ? <span className="help">{v.note}</span> : null}
      {v.decision ? (
        <span className="sbi-decision">
          قرار {v.decision.by} · {date(v.decision.at)}: {v.decision.note}
        </span>
      ) : null}
    </figcaption>
  </figure>
);

export const LabStoryboards: React.FC<{ channel: string; dir: string }> = ({ channel, dir }) => {
  const [entries, setEntries] = useState<StoryboardEntry[] | null>(null);
  const [err, setErr] = useState("");
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [compare, setCompare] = useState<Record<string, boolean>>({});
  const [zoom, setZoom] = useState<{ src: string; title: string } | null>(null);
  const load = useCallback(() => {
    api.labStoryboards(channel, dir).then((r) => setEntries(r.entries), (e: Error) => setErr(e.message));
  }, [channel, dir]);
  useEffect(() => {
    if (labStoryboardsEnabled(channel)) load();
  }, [channel, load]);

  if (!labStoryboardsEnabled(channel)) return null;
  if (err) return <p className="err">{err}</p>;
  if (!entries) return <p className="muted">جارٍ تحميل الستوري بورد…</p>;
  return (
    <div className="sbi">
      <h4>ستوري بورد · صور</h4>
      <p className="help">صور التخطيط قبل الرندر، بكل نسخها (لا تُحذف نسخة سابقة). الحفظ أو العرض ليس اعتمادًا؛ الحالة تتغير بقرارك المكتوب وحده.</p>
      {!entries.length ? <p className="muted">لا ستوري بورد بعد.</p> : null}
      {entries.map((e) => {
        const cur = e.versions.find((v) => v.version === picked[e.slot]) ?? e.latest;
        const prev = e.versions.find((v) => v.version < cur.version);
        const zoomOf = (v: StoryboardVersion) => setZoom({ src: api.labStoryboardUrl(channel, dir, v.file), title: `${e.title} · النسخة ${v.version}` });
        const labelOf = (v: StoryboardVersion) => (v.version === e.latest.version ? `النسخة ${v.version} · الأحدث` : `النسخة ${v.version}`);
        return (
          <section key={e.slot} className="sbi-entry">
            <div className="sbi-head">
              <h5>{e.title}</h5>
              {e.order ? <span className="sbi-order">الأمر {e.order}</span> : null}
              <span className="sbi-tabs" role="tablist">
                {e.versions.map((v) => (
                  <button key={v.version} role="tab" aria-selected={v.version === cur.version} className={v.version === cur.version ? "on" : ""} onClick={() => setPicked({ ...picked, [e.slot]: v.version })}>
                    {labelOf(v)}
                  </button>
                ))}
                {prev ? (
                  <button className={compare[e.slot] ? "on" : ""} onClick={() => setCompare({ ...compare, [e.slot]: !compare[e.slot] })}>
                    {compare[e.slot] ? "إخفاء المقارنة" : `قارن بالنسخة ${prev.version}`}
                  </button>
                ) : null}
              </span>
            </div>
            {e.problems.length ? <p className="err">{e.problems.join(" · ")}</p> : null}
            <div className={compare[e.slot] && prev ? "sbi-compare" : ""}>
              <Version channel={channel} dir={dir} e={e} v={cur} label={labelOf(cur)} onZoom={zoomOf} />
              {compare[e.slot] && prev ? <Version channel={channel} dir={dir} e={e} v={prev} label={labelOf(prev)} onZoom={zoomOf} /> : null}
            </div>
            <Decide channel={channel} dir={dir} slot={e.slot} v={cur} onDone={load} />
          </section>
        );
      })}
      {zoom ? <Lightbox src={zoom.src} title={zoom.title} onClose={() => setZoom(null)} /> : null}
    </div>
  );
};
