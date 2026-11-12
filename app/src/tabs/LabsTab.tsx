/**
 * «مختبرات الإنتاج» (الأمر 017): التجارب الإخراجية ومعايناتها لقناة واحدة، منفصلة عن الحلقات.
 * المختبر ليس حلقة: لا يدخل قائمة الحلقات ولا النشر ولا التصدير. والقسم للقراءة؛ مصدره lab.json في مجلد المختبر.
 */
import { num } from "../ui/format";
import React, { useEffect, useState } from "react";
import { ownerText } from "../../../src/i18n/sceneNames";
import { api } from "../api";
import type { LabStatus, LabSummary } from "../../../src/channel/labs";
import { labStoryboardsEnabled } from "../../../src/channel/labStoryboardsShared";
import { LabStoryboards } from "./LabStoryboards";

const STATUS_AR: Record<LabStatus, string> = { experimental: "تجريبي", review: "جاهز للمراجعة", approved: "معتمد", rejected: "مرفوض" };
const Badge: React.FC<{ s: LabStatus }> = ({ s }) => <span className={`lab-badge lab-${s}`}>{STATUS_AR[s]}</span>;
const date = (v?: string | null) => (v ? new Date(v).toLocaleString("ar-EG", { dateStyle: "medium", ...(v.length > 10 ? { timeStyle: "short" } : {}) }) : "—");

export const LabsTab: React.FC<{ channel: string }> = ({ channel }) => {
  const [labs, setLabs] = useState<LabSummary[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    setLabs(null);
    api.labs(channel).then((r) => setLabs(r.labs), (e: Error) => setErr(e.message));
  }, [channel]);

  if (err) return <div className="panel"><p className="err">{err}</p></div>;
  if (!labs) return <div className="panel"><p className="muted">جارٍ تحميل المختبرات…</p></div>;
  if (!labs.length) return <div className="panel"><p className="muted">لا مختبرات لهذه القناة.</p></div>;

  return (
    <div className="labs-tab" dir="rtl">
      <header className="labs-head">
        <h2>مختبرات الإنتاج</h2>
        <p className="help">تجارب إخراجية قبل اعتمادها إنتاجيًا. ليست حلقات: لا تظهر في قائمة الحلقات ولا تُنشر ولا تُصدَّر. <b>نجاح الفحوص التقنية ليس اعتمادًا إخراجيًا</b>؛ الاعتماد قرار المشرف ويُسجَّل في المختبر.</p>
      </header>
      {labs.map((l) => (
        <section key={l.dir} className="lab-card">
          <div className="lab-title">
            <h3 title={l.dir}>{ownerText(l.title)}</h3>
            <Badge s={l.status} />
            <span className="help">آخر نشاط: {date(l.lastActivity)}</span>
          </div>
          <p>{ownerText(l.purpose)}</p>

          {/* ستوري بورد المختبرات (صور) لبالإسلام وحدها؛ القنوات الأخرى كما هي */}
          <LabStoryboards channel={channel} dir={l.dir} />

          <h4>{labStoryboardsEnabled(channel) ? "المعاينات — فيديو" : "المعاينات"}</h4>
          {l.previews.length ? (
            <div className="sb-previews-grid">
              {l.previews.map((f) => (
                <figure key={f.name} className="sb-preview">
                  <video src={api.labPreviewUrl(channel, l.dir, f.name)} controls preload="metadata" playsInline />
                  <figcaption>
                    <b>{f.title}</b> <Badge s={f.status} />
                    <span className="help">رفع رقم {num(f.version)} — {date(f.updatedAt)}</span>
                    {f.note ? <span className="help">{f.note}</span> : null}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="muted">لا معاينات بعد.</p>
          )}

          <h4>الأدوات تحت الاختبار</h4>
          <table className="lab-table">
            <thead><tr><th>الأداة</th><th>الحالة الإخراجية</th><th>في المكتبة الإنتاجية</th></tr></thead>
            <tbody>
              {l.tools.map((t) => (
                <tr key={t.name}>
                  <td>{t.name}{t.note ? <div className="help">{t.note}</div> : null}</td>
                  <td><Badge s={t.status} /></td>
                  <td>{t.promotedTo ? <span>انتقلت — <code dir="ltr">{t.promotedTo}</code></span> : <span className="muted">لا</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4>نتائج الفحوص التقنية</h4>
          <ul className="lab-checks">
            {l.checks.map((c) => (
              <li key={c.name}><span className={c.ok ? "ok" : "err"}>{c.ok ? "✓" : "✗"}</span> <b>{c.name}</b>{c.detail ? ` — ${c.detail}` : ""}{c.at ? <span className="help"> ({date(c.at)})</span> : null}</li>
            ))}
          </ul>

          <h4>الملاحظات البصرية</h4>
          <ul>{l.visualNotes.map((n, i) => <li key={i}>{n}</li>)}</ul>

          <h4>القرارات</h4>
          <ul>
            {l.decisions.map((d, i) => (
              <li key={i}><Badge s={d.status} /> <b>{d.by}</b> — {date(d.at)} — {d.decision}</li>
            ))}
          </ul>

          <h4>ما انتقل فعلًا إلى المكتبة العامة</h4>
          {l.promoted.length ? <ul>{l.promoted.map((p, i) => <li key={i}>{p}</li>)}</ul> : <p className="muted">لا شيء بعد.</p>}
        </section>
      ))}
    </div>
  );
};
