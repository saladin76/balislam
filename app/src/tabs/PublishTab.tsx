import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, type EpisodeStatus, type LongJob, type PackageInfo } from "../api";

/** بنود قائمة النشر (تُحفظ حالتها في status.json للحلقة). */
const CHECKLIST: { id: string; group: string; text: string }[] = [
  { id: "watched", group: "قبل الرفع", text: "شاهدت الحلقة كاملة والشورتس الستة إلى آخر ثانية" },
  { id: "review", group: "قبل الرفع", text: "المراجع الشرعي وافق على كل آية وحديث" },
  { id: "pronunciation", group: "قبل الرفع", text: "لا أخطاء نطق (وإن وُجدت: قاموس النطق ثم إعادة المشهد فقط)" },
  { id: "upload", group: "يوتيوب ستوديو", text: "رفعت الفيديو والصورة المصغّرة" },
  { id: "meta", group: "يوتيوب ستوديو", text: "لصقت العنوان والوصف والوسوم" },
  { id: "srt", group: "يوتيوب ستوديو", text: "رفعت ملف الترجمة (.srt)" },
  { id: "synthetic", group: "يوتيوب ستوديو", text: "فعّلت «محتوى معدّل أو اصطناعي»: نعم (الصوت مستنسخ)" },
  { id: "endscreen", group: "يوتيوب ستوديو", text: "أضفت عناصر شاشة النهاية في أماكنها" },
  { id: "schedule", group: "يوتيوب ستوديو", text: "جدولت النشر في الموعد" },
  { id: "shorts", group: "الشورتس", text: "جدولت الشورتس الستة: واحد يوميًا" },
  { id: "shortsLink", group: "الشورتس", text: "ربطت كل شورت بالحلقة الكاملة" },
];

const sizeLabel = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} م.ب` : `${Math.ceil(n / 1e3)} ك.ب`);

/** يقرأ youtube.md إلى أجزاء يسهل نسخها. */
const parseYoutube = (md: string) => {
  const section = (title: string) => {
    const i = md.indexOf(`## ${title}`);
    if (i < 0) return "";
    const rest = md.slice(i + title.length + 3);
    const end = rest.search(/\n## /);
    return (end < 0 ? rest : rest.slice(0, end)).trim();
  };
  const titles = section("عنوان الحلقة").split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2).replace(/ \(بديل لاختبار A\/B\)$/, ""));
  const description = (section("وصف الحلقة").match(/```\n([\s\S]*?)\n```/)?.[1] ?? "").trim();
  const tags = section("الوسوم");
  const shorts = [...section("الشورتس").matchAll(/### (.+)\n+\*\*العنوان:\*\* (.+)\n[\s\S]*?```\n([\s\S]*?)\n```/g)].map((m) => ({ label: m[1]!, title: m[2]!, description: m[3]!.trim() }));
  return { titles, description, tags, shorts };
};

const Copy: React.FC<{ text: string; label?: string }> = ({ text, label = "نسخ" }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      className="btn small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          /* المتصفح منع النسخ */
        }
      }}
    >
      {done ? "نُسخ ✓" : label}
    </button>
  );
};

/** رابط بعلامة وقت الملف: المتصفح يجلب النسخة الجديدة بعد كل صناعة. */
const fresh = (url: string, mtime: number) => `${url}${url.includes("?") ? "&" : "?"}v=${Math.round(mtime)}`;

export const PublishTab: React.FC<{ episodeId: string; hasVoiceKeys: boolean; onChanged: () => void }> = ({ episodeId, hasVoiceKeys, onChanged }) => {
  const [pkg, setPkg] = useState<PackageInfo | null>(null);
  const [status, setStatus] = useState<EpisodeStatus>({});
  const [jobs, setJobs] = useState<LongJob[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [err, setErr] = useState("");
  const job = jobs.find((j) => j.episode === episodeId);
  const running = job?.status === "running";

  const reload = useCallback(() => {
    api.packageInfo(episodeId).then(setPkg).catch(() => setPkg({ files: [], youtube: "", checklist: "" }));
    api.status(episodeId).then(setStatus).catch(() => {});
  }, [episodeId]);
  useEffect(reload, [reload]);
  useEffect(() => {
    api.longJobs().then(setJobs).catch(() => {});
  }, []);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(async () => {
      const list = await api.longJobs().catch(() => jobs);
      setJobs(list);
      const j = list.find((x) => x.id === job?.id);
      if (j && j.status !== "running") {
        reload();
        onChanged();
      }
    }, 1500);
    return () => clearInterval(t);
  }, [running, job?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async (kind: "make" | "package", noVoice = false) => {
    setErr("");
    try {
      await api.startJob({ kind, episode: episodeId, noVoice });
      setJobs(await api.longJobs());
      setShowLog(false);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const saveStatus = (s: EpisodeStatus) => {
    setStatus(s);
    api.saveStatus(episodeId, s).then(onChanged).catch((e) => setErr((e as Error).message));
  };

  const yt = useMemo(() => parseYoutube(pkg?.youtube ?? ""), [pkg?.youtube]);
  const files = pkg?.files ?? [];
  const video = files.find((f) => f.name.endsWith("-episode.mp4"));
  const shorts = files.filter((f) => /-short-\d\.mp4$/.test(f.name));
  const thumbs = files.filter((f) => f.name.endsWith(".png"));
  const checked = status.checklist ?? {};
  const doneCount = CHECKLIST.filter((c) => checked[c.id]).length;
  const groups = [...new Set(CHECKLIST.map((c) => c.group))];

  return (
    <div className="publish">
      <section className="pub-make">
        <div className="toolbar">
          <h2>صناعة الحلقة</h2>
          <span className="help">فحص ← آيات ← مشاهد ← صوت ← رندر ← ملفات النشر</span>
          <span className="spacer" />
          <button className="btn" disabled={running} onClick={() => start("make", true)}>معاينة بلا صوت</button>
          <button className="btn" disabled={running || !video} onClick={() => start("package")} title="يعيد التغليف من الصوت والمشاهد الحالية">أعد التغليف</button>
          <button className="btn primary" disabled={running || !hasVoiceKeys} onClick={() => start("make")} title={hasVoiceKeys ? "" : "أضف مفاتيح ElevenLabs من تبويب الإعدادات"}>
            اصنع النسخة النهائية
          </button>
        </div>
        {!hasVoiceKeys ? <p className="help">النسخة النهائية تحتاج مفاتيح ElevenLabs (تبويب «الإعدادات»). المعاينة بلا صوت متاحة الآن.</p> : null}
        {job ? (
          <div className="job-box">
            <div className="job">
              <span style={{ minWidth: 220 }}>{job.title}</span>
              <span className="bar"><i style={{ width: `${job.pct}%`, background: job.status === "error" ? "var(--err)" : undefined }} /></span>
              <span style={{ minWidth: 70, fontVariantNumeric: "tabular-nums" }}>{job.status === "running" ? `${Math.round(job.pct)}%` : job.status === "done" ? "تم" : "توقف"}</span>
              <button className="btn ghost small" onClick={() => setShowLog((v) => !v)}>{showLog ? "إخفاء التفاصيل" : "التفاصيل"}</button>
            </div>
            {job.status === "running" ? <div className="help">{job.log[job.log.length - 1] ?? "…"}</div> : null}
            {job.status === "error" ? <div className="help" style={{ color: "var(--err)" }}>{job.error}</div> : null}
            {showLog ? <pre className="log">{job.log.join("\n")}</pre> : null}
          </div>
        ) : null}
        {err ? <div className="help" style={{ color: "var(--err)" }}>{err}</div> : null}
      </section>

      {!video ? (
        <div className="empty-state" style={{ margin: "20px auto" }}>
          <h2>لم تُصنع ملفات النشر بعد</h2>
          <p>ابدأ بـ «معاينة بلا صوت» لترى الحلقة كاملة، أو «اصنع النسخة النهائية» بعد ربط ElevenLabs.</p>
        </div>
      ) : (
        <div className="pub-grid">
          <section className="pub-col">
            <h3>الحلقة</h3>
            <video key={`${video.name}-${video.mtime}`} src={fresh(api.packageUrl(episodeId, video.name), video.mtime)} controls preload="metadata" className="pub-video" />
            <h3>الشورتس <small>{shorts.length}</small></h3>
            <div className="shorts-row">
              {shorts.map((s) => (
                <video key={`${s.name}-${s.mtime}`} src={fresh(api.packageUrl(episodeId, s.name), s.mtime)} controls preload="metadata" />
              ))}
            </div>
            <h3>الصور المصغّرة <small>اختر واحدة أو جرّبها كلها في اختبار العناوين</small></h3>
            <div className="thumbs">
              {thumbs.map((t, i) => (
                <figure key={t.name}>
                  <img src={fresh(api.packageUrl(episodeId, t.name), t.mtime)} alt={`الصورة المصغّرة ${i + 1}`} />
                  <figcaption>
                    <span>{yt.titles[i] ?? t.name}</span>
                    <a className="btn small" href={api.packageUrl(episodeId, t.name, true)}>تنزيل</a>
                  </figcaption>
                </figure>
              ))}
            </div>
            <h3>كل الملفات</h3>
            <ul className="files">
              {files.map((f) => (
                <li key={f.name}>
                  <code>{f.name}</code>
                  <span className="help">{sizeLabel(f.size)}</span>
                  <a className="btn small" href={api.packageUrl(episodeId, f.name, true)}>تنزيل</a>
                </li>
              ))}
            </ul>
          </section>

          <section className="pub-col">
            <h3>العنوان</h3>
            {yt.titles.map((t, i) => (
              <div key={i} className="copy-row">
                <span>{t}{i ? <small className="help"> · بديل</small> : null}</span>
                <Copy text={t} />
              </div>
            ))}
            <h3>الوصف <Copy text={yt.description} /></h3>
            <pre className="desc">{yt.description}</pre>
            <h3>الوسوم <Copy text={yt.tags} /></h3>
            <div className="desc">{yt.tags}</div>
            <h3>نصوص الشورتس</h3>
            {yt.shorts.map((s) => (
              <details key={s.label} className="short-meta">
                <summary>{s.label}</summary>
                <div className="copy-row"><span>{s.title}</span><Copy text={s.title} label="نسخ العنوان" /></div>
                <pre className="desc">{s.description}</pre>
                <Copy text={s.description} label="نسخ الوصف" />
              </details>
            ))}
          </section>

          <section className="pub-col">
            <h3>قائمة النشر <small>{doneCount} من {CHECKLIST.length}</small></h3>
            {groups.map((g) => (
              <div key={g} className="check-group">
                <b>{g}</b>
                {CHECKLIST.filter((c) => c.group === g).map((c) => (
                  <label key={c.id} className="check">
                    <input type="checkbox" checked={Boolean(checked[c.id])} onChange={(e) => saveStatus({ ...status, checklist: { ...checked, [c.id]: e.target.checked } })} />
                    <span>{c.text}</span>
                  </label>
                ))}
              </div>
            ))}
            <div className="check-group">
              <b>النشر</b>
              {status.published ? (
                <>
                  <span className="help" style={{ color: "var(--ok)" }}>نُشرت في {status.published.date}</span>
                  {status.published.url ? <a href={status.published.url} target="_blank" rel="noreferrer">{status.published.url}</a> : null}
                  <button className="btn small" onClick={() => window.confirm("إلغاء تسجيل النشر لهذه الحلقة؟") && saveStatus({ ...status, published: undefined })}>تراجع</button>
                </>
              ) : (
                <PublishForm disabled={!checked.watched} onSave={(p) => saveStatus({ ...status, published: p })} />
              )}
              {!checked.watched && !status.published ? <span className="help">علّم «شاهدت الحلقة كاملة» أولًا.</span> : null}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

const PublishForm: React.FC<{ disabled: boolean; onSave: (p: { date: string; url?: string }) => void }> = ({ disabled, onSave }) => {
  const [url, setUrl] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ date, url: url.trim() || undefined });
      }}
      style={{ display: "flex", flexDirection: "column", gap: 6 }}
    >
      <input id="pub-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} aria-label="تاريخ النشر" dir="ltr" />
      <input id="pub-url" type="url" pattern="https://.*" title="رابط يبدأ بـ https://" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="رابط الحلقة على يوتيوب (اختياري)" dir="ltr" />
      <button className="btn primary small" disabled={disabled} type="submit">تم النشر</button>
    </form>
  );
};
