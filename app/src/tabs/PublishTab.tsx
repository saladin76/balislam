import { SocialKit } from "./SocialKit";
import { ShortsPicker } from "./ShortsPicker";
import { shortFileNumber, sortShortFiles } from "../../../src/plan/shorts";
import { DriveHandoffCard, driveOwnsPrimary, driveView } from "./DriveHandoff";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, type DriveHandoffRead, type SceneProductionRead, type EpisodeStatus, type LongJob, type PackageInfo } from "../api";
import { resolveDescription, type PublishKit } from "../../../src/package/social";
import { Hint, More, Stage } from "../shell/Screen";
import "../shell/screens-s45.css";
import { KEYS_PAGE, KeysLink } from "../ui/KeysLink";
import { arDigits, duration, num } from "../ui/format";
import { FramePlayer } from "../workspace/SceneProductionPanel";
import { OwnerText } from "../ui/OwnerText";

/** بنود قائمة النشر (تُحفظ حالتها في status.json للحلقة). */
const CHECKLIST: { id: string; group: string; text: string }[] = [
  { id: "watched", group: "قبل الرفع", text: "شاهدت الحلقة كاملة وكل شورت إلى آخر ثانية" },
  { id: "review", group: "قبل الرفع", text: "المراجع الشرعي وافق على كل آية وحديث" },
  { id: "pronunciation", group: "قبل الرفع", text: "لا أخطاء نطق (وإن وُجدت: قاموس النطق ثم إعادة المشهد فقط)" },
  { id: "upload", group: "يوتيوب ستوديو", text: "رفعت الفيديو والصورة المصغّرة" },
  { id: "meta", group: "يوتيوب ستوديو", text: "لصقت العنوان والوصف والوسوم" },
  { id: "srt", group: "يوتيوب ستوديو", text: "رفعت ملف الترجمة (.srt)" },
  { id: "synthetic", group: "يوتيوب ستوديو", text: "فعّلت «محتوى معدّل أو اصطناعي»: نعم (الصوت مستنسخ)" },
  { id: "endscreen", group: "يوتيوب ستوديو", text: "أضفت عناصر شاشة النهاية في أماكنها" },
  { id: "schedule", group: "يوتيوب ستوديو", text: "جدولت النشر في الموعد" },
  { id: "shorts", group: "الشورتس", text: "جدولت الشورتس كلها: واحد يوميًا أو كما في التقويم" },
  { id: "shortsLink", group: "الشورتس", text: "ربطت كل شورت بالحلقة الكاملة" },
];

/**
 * What the episode-file card says, from the ledger alone (funnel audit 8 Nov, D36). The ledger's Master
 * approval is bound to the exact bytes of out/package/NNN-episode.mp4 — the very file shown here — so a
 * render.json label never contradicts it. `rerenderWarning` is the explicit confirm shown before any
 * action that would overwrite that file and so cancel the approval (and the publish permission).
 */
export type PublishCardState = {
  approved: boolean;
  publishAllowed: boolean;
  pill: string;
  permission: string;
  hint: string | null;
  primary: "download" | null;
  rerenderWarning: string | null;
};
/** The only Master approval is the scene-first ledger's, bound to the exact bytes of the current Master
 * file (the server re-hashes them). Legacy status.json / six-stage records are never a release approval. */
export const publishCardState = (
  production: Pick<SceneProductionRead, "master" | "candidates" | "progress"> | null, isMaster: boolean, mine = true,
): PublishCardState => {
  const approved = Boolean(production?.progress.masterApproved && production.master &&
    production.candidates.masterSha256 && production.master.sha256 === production.candidates.masterSha256);
  const publishAllowed = approved && Boolean(production?.master?.publishAllowed);
  return {
    approved, publishAllowed,
    pill: publishAllowed ? "مأذون بالنشر" : approved ? "معتمدة" : isMaster ? "بانتظار اعتمادك" : "معاينة لا تُنشر",
    permission: publishAllowed ? "ممنوح لهذا الملف" : approved ? "بانتظار إذنك (البطاقة أعلى الصفحة)" : "بعد اعتماد النسخة النهائية",
    hint: approved ? null : isMaster ? "اعتمد هذا الملف بعينه بعد مشاهدته كاملًا (الخطوة ٣)." : "معاينة لا تُنشر. النسخة النهائية تُصنع بدقة 4K.",
    primary: publishAllowed && mine ? "download" : null,
    rerenderWarning: publishAllowed
      ? "سيلغي اعتماد النسخة النهائية وإذن النشر الممنوح لهذا الملف، ويلزم بعده مشاهدتها واعتمادها من جديد. متابعة؟"
      : approved ? "سيلغي اعتماد النسخة النهائية، ويلزم بعده مشاهدتها واعتمادها من جديد. متابعة؟" : null,
  };
};

const sizeLabel = (n: number) => (n > 1e6 ? `${num(n / 1e6, 1)} م.ب` : `${num(Math.ceil(n / 1e3))} ك.ب`);

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
  const [done, setDone] = useState<"" | "ok" | "fail">("");
  return (
    <button
      type="button"
      className="btn ghost small"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone("ok");
        } catch {
          setDone("fail"); // المتصفح منع النسخ: يُقال ذلك بدل الصمت
        }
        setTimeout(() => setDone(""), 1600);
      }}
    >
      <span role="status">{done === "ok" ? "نُسخ ✓" : done === "fail" ? "تعذّر النسخ" : label}</span>
    </button>
  );
};

/** رابط بعلامة وقت الملف: المتصفح يجلب النسخة الجديدة بعد كل صناعة. */
const fresh = (url: string, mtime: number) => `${url}${url.includes("?") ? "&" : "?"}v=${Math.round(mtime)}`;

/**
 * هل تعرض لوحة القرار («إنتاج المشاهد») فوق الصفحة زرًا رئيسيًا الآن؟ إن عرضت فهو الإجراء الوحيد المملوء،
 * وأزرار هذه الصفحة هادئة. («إلى النشر» يُخفى هنا لأنه يفتح الصفحة نفسها.)
 */
export const decisionHasPrimary = (p: SceneProductionRead | null): boolean => {
  if (!p || !p.script.approved || !p.storyboard.approved) return false;
  if (!p.progress.canAssemble || !p.assembly || !p.assembly.approved) return true;
  // Assembly approved, no approved Master: the panel makes it («اصنع النسخة النهائية») or approves it.
  if (!p.master) return true;
  return !p.master.publishAllowed;
};

/** One clock for every time on the owner's screens (ui/format.ts): Arabic-Indic digits. */
const clock = (sec: number) => duration(sec);

export const PublishTab: React.FC<{ episodeId: string; hasVoiceKeys: boolean; onChanged: () => void }> = ({ episodeId, hasVoiceKeys, onChanged }) => {
  const [pkg, setPkg] = useState<PackageInfo | null>(null);
  const [status, setStatus] = useState<EpisodeStatus>({});
  const [production, setProduction] = useState<SceneProductionRead | null>(null);
  const [jobs, setJobs] = useState<LongJob[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [err, setErr] = useState("");
  const [kit, setKit] = useState<{ kit: PublishKit; chapters: string } | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [drive, setDrive] = useState<DriveHandoffRead | null>(null);
  const job = jobs.find((j) => j.episode === episodeId);
  const running = job?.status === "running";

  const reload = useCallback(() => {
    api.packageInfo(episodeId).then(setPkg).catch(() => setPkg({ files: [], youtube: "", checklist: "" }));
    api.status(episodeId).then(setStatus).catch(() => {});
    api.sceneProduction(episodeId).then(setProduction).catch(() => setProduction(null));
    api.driveHandoff(episodeId).then(setDrive).catch(() => setDrive(null));
  }, [episodeId]);
  useEffect(reload, [reload]);
  useEffect(() => {
    const refresh = (event: Event) => {
      if ((event as CustomEvent<{ episodeId: string }>).detail?.episodeId === episodeId) reload();
    };
    window.addEventListener("studio-workflow-updated", refresh);
    return () => window.removeEventListener("studio-workflow-updated", refresh);
  }, [episodeId, reload]);
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

  // D53: while the copy to Drive runs in the background, its progress is polled.
  const driveRunning = drive?.job?.status === "running";
  useEffect(() => {
    if (!driveRunning) return;
    const t = setInterval(() => { api.driveHandoff(episodeId).then(setDrive).catch(() => undefined); }, 1500);
    return () => clearInterval(t);
  }, [driveRunning, episodeId]);

  const start = async (kind: "make" | "package" | "shorts", noVoice = false) => {
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
    setErr("");
    // Never show a forged or rejected approval optimistically.
    api.saveStatus(episodeId, s).then(() => {
      setStatus(s);
      onChanged();
    }).catch((e) => {
      setErr((e as Error).message);
      reload();
    });
  };

  const yt = useMemo(() => parseYoutube(pkg?.youtube ?? ""), [pkg?.youtube]);
  const files = pkg?.files ?? [];
  const video = files.find((f) => f.name.endsWith("-episode.mp4"));
  // بلا حد لعددها (D151): كل `-short-<n>.mp4` مرتبة بأرقامها (2 قبل 10)
  const shorts = sortShortFiles(files);
  const thumbs = files.filter((f) => f.name.endsWith(".png"));
  const render = pkg?.render ?? null;
  const isMaster = Boolean(render?.quality === "master" && render.voiced);
  const ready0 = Boolean(production?.script.approved && production?.storyboard.approved);
  const card = publishCardState(production, isMaster, ready0 && !decisionHasPrimary(production));
  const { approved, publishAllowed } = card;
  const checked = status.checklist ?? {};
  const doneCount = CHECKLIST.filter((c) => checked[c.id]).length;
  const groups = [...new Set(CHECKLIST.map((c) => c.group))];

  // زر مملوء واحد في الشاشة: إن كان في لوحة القرار فأزرار هذه الصفحة هادئة
  const ready = Boolean(production?.script.approved && production?.storyboard.approved);
  const mine = ready && !decisionHasPrimary(production);
  const makePrimary = mine && !isMaster && !approved;
  const dView = driveView(drive, approved, publishAllowed, production?.master?.sha256 ?? null);
  const drivePrimary = card.primary === "download" && driveOwnsPrimary(dView);
  const downloadPrimary = (card.primary === "download" && !drivePrimary) || (mine && isMaster && !approved);
  /** Any action that overwrites the Master file asks first when it would cancel an approval. */
  const guarded = (kind: "make" | "package", noVoice = false) => {
    if (card.rerenderWarning && !window.confirm(card.rerenderWarning)) return;
    void start(kind, noVoice);
  };

  const makeButton = (primary: boolean) => (
    <button type="button" className={`btn${primary ? " primary" : ""}`} disabled={running || !hasVoiceKeys} onClick={() => guarded("make")} title={hasVoiceKeys ? "" : `أضف مفتاح الصوت من «${KEYS_PAGE}»`}>
      {approved ? "أعد صنع النسخة النهائية" : "اصنع النسخة النهائية"}
    </button>
  );

  const masterState = card.pill;
  const L = kit?.kit.long;
  const kitTitle = L?.titles[0]?.text ?? yt.titles[0] ?? "";
  const kitDesc = L ? resolveDescription(L.description, kit!.chapters) : yt.description;

  return (
    <div className="s45-page s45-publish">
      <Stage
        title={video ? (isMaster || approved ? "النسخة النهائية" : "ملف الحلقة") : "النسخة النهائية"}
        meta={video ? <span className={`s45-pill${approved ? " is-on" : ""}`}>{masterState}</span> : null}
      >
        {job ? (
          <div className="s45-job" role="status">
            <span className="s45-job-t">{job.title}</span>
            <span className="bar"><i style={{ width: `${job.pct}%`, background: job.status === "error" ? "var(--err)" : undefined }} /></span>
            <span className="s45-job-n">{job.status === "running" ? (job.queued ? "في الطابور" : `${Math.round(job.pct)}%`) : job.status === "done" ? "تم" : "توقف"}</span>
            <button type="button" className="btn ghost small" onClick={() => setShowLog((v) => !v)}>{showLog ? "إخفاء التفاصيل" : "التفاصيل"}</button>
            {job.status === "running" ? <button type="button" className="btn ghost small" onClick={() => void api.cancelJob(job.id).catch((x) => window.alert((x as Error).message))}>إلغاء</button> : null}
            {job.status === "running" ? <span className="s45-note s45-job-line">{job.log[job.log.length - 1] ?? "…"}</span> : null}
            {job.status === "error" ? <span className="s45-note s45-job-line s45-err"><OwnerText text={job.error} /></span> : null}
            {showLog ? <pre className="log s45-job-line">{job.log.join("\n")}</pre> : null}
          </div>
        ) : null}
        {err ? <p className="s45-alert" role="alert"><OwnerText text={err} /></p> : null}

        {!video ? (
          <div className="s45-empty">
            <strong>{pkg ? "لم تُصنع النسخة النهائية بعد" : "جارٍ التحميل…"}</strong>
            <Hint>{hasVoiceKeys ? "تُصنع بدقة 4K من المشاهد المعتمدة." : <>تحتاج مفتاح الصوت من <KeysLink />.</>}</Hint>
            <div className="s45-actions">
              {makeButton(makePrimary)}
              <button type="button" className="btn ghost" disabled={running} onClick={() => guarded("make", true)}>معاينة بلا صوت</button>
            </div>
          </div>
        ) : (
          <div className="s45-master">
            <div className="s45-screen">
              <FramePlayer key={`${video.name}-${video.mtime}`} src={fresh(api.packageUrl(episodeId, video.name), video.mtime)} label="ملف الحلقة"
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || null)} />
            </div>
            <div className="s45-side">
              <dl className="s45-facts">
                <div><dt>الجودة</dt><dd>{render ? `${render.label} — ${arDigits(`${render.width}×${render.height}`)}${render.voiced ? "" : " — بلا صوت"}` : "غير معروفة"}</dd></div>
                <div><dt>المدة</dt><dd>{duration ? clock(duration) : "—"}</dd></div>
                <div><dt>الحجم</dt><dd>{sizeLabel(video.size)}</dd></div>
                <div><dt>إذن النشر</dt><dd>{card.permission}</dd></div>
                {status.published ? <div><dt>النشر</dt><dd className="s45-ok">نُشرت في {status.published.date}</dd></div> : null}
              </dl>
              <div className="s45-actions">
                <a className={`btn${downloadPrimary ? " primary" : ""}`} href={api.packageUrl(episodeId, video.name, true)}>تنزيل بأعلى جودة</a>
                {!isMaster && !approved ? makeButton(makePrimary) : null}
              </div>
              {card.hint ? <Hint>{card.hint}</Hint> : null}
            </div>
          </div>
        )}

        {video ? <DriveHandoffCard episodeId={episodeId} view={dView} primary={drivePrimary} onChanged={setDrive} /> : null}

        {kitTitle || kitDesc ? (
          <section className="s45-kit" aria-label="نص النشر">
            <div className="s45-kit-row">
              <span className="s45-label">العنوان</span>
              <p className="s45-kit-title" dir="auto">{kitTitle || "—"}</p>
              {kitTitle ? <Copy text={kitTitle} /> : null}
            </div>
            <div className="s45-kit-row">
              <span className="s45-label">الوصف</span>
              <p className="s45-kit-desc" dir="auto">{kitDesc || "—"}</p>
              {kitDesc ? <Copy text={kitDesc} /> : null}
            </div>
          </section>
        ) : null}

        <div className="s45-mores">
          <More label="صناعة وتغليف">
            <p className="s45-note">فحص ← آيات ← مشاهد ← صوت ← رندر ← ملفات النشر</p>
            <div className="s45-actions">
              {video && (isMaster || approved) ? makeButton(false) : null}
              <button type="button" className="btn" disabled={running} onClick={() => guarded("make", true)}>معاينة بلا صوت</button>
              <button type="button" className="btn" disabled={running || !video} onClick={() => guarded("package")} title="يعيد التغليف من الصوت والمشاهد الحالية">أعد التغليف</button>
            </div>
            {!hasVoiceKeys ? <p className="s45-note">النسخة النهائية تحتاج مفتاح الصوت من <KeysLink />. المعاينة بلا صوت متاحة الآن.</p> : null}
            {card.rerenderWarning ? <p className="s45-note">أي صناعة جديدة تكتب فوق الملف المعتمد فتلغي اعتماده{publishAllowed ? " وإذن النشر" : ""}؛ ستُسأل قبلها.</p> : null}
            {isMaster && !approved ? <p className="s45-note">اعتماد النسخة النهائية يكون لهذا الملف بعينه في الخطوة ٣؛ أي ملف جديد يحتاج اعتمادًا جديدًا.</p> : null}
          </More>

          <More label={`الشورتس والريلز${shorts.length ? ` — ${num(shorts.length)}` : ""}`}>
            <ShortsPicker episodeId={episodeId} approved={approved} />
            <p className="s45-note">{shorts.length ? `${num(shorts.length)} — ${arDigits("9:16")} بأعلى جودة` : "تُصنع بعد اعتماد النسخة الأساسية."}</p>
            {approved ? (
              <div className="s45-actions">
                <button type="button" className="btn" disabled={running} onClick={() => start("shorts")}>{shorts.length ? "أعد صنع الشورتس والريلز" : "اصنع الشورتس والريلز (من المقاطع المحفوظة)"}</button>
              </div>
            ) : null}
            {shorts.length ? (
              <div className="s45-shorts">
                {shorts.map((s) => (
                  <figure key={`${s.name}-${s.mtime}`}>
                    <figcaption>الشورت {num(shortFileNumber(s.name) ?? 0)}</figcaption>
                    <video src={fresh(api.packageUrl(episodeId, s.name), s.mtime)} controls preload="none" />
                    <a className="btn ghost small" href={api.packageUrl(episodeId, s.name, true)}>تنزيل ({sizeLabel(s.size)})</a>
                  </figure>
                ))}
              </div>
            ) : null}
          </More>

          <More label={`الصور المصغّرة${thumbs.length ? ` — ${num(thumbs.length)}` : ""}`}>
            {thumbs.length ? (
              <div className="s45-thumbs">
                {thumbs.map((t, i) => (
                  <figure key={t.name}>
                    <img src={fresh(api.packageUrl(episodeId, t.name), t.mtime)} alt={`الصورة المصغّرة ${num(i + 1)}`} loading="lazy" />
                    <figcaption>
                      <span>{yt.titles[i] ?? t.name}</span>
                      <a className="btn ghost small" href={api.packageUrl(episodeId, t.name, true)}>تنزيل</a>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : <p className="s45-note">تُصنع مع ملفات النشر.</p>}
          </More>

          <More label="حزمة الانتشار لكل منصة">
            <SocialKit episodeId={episodeId} onKit={(k, chapters) => setKit({ kit: k, chapters })} />
          </More>

          {pkg?.youtube ? (
            <More label="نصوص ملف النشر">
              <div className="s45-sec">
                <h3>العنوان</h3>
                {yt.titles.map((t, i) => (
                  <div key={i} className="s45-copy-row">
                    <span>{t}{i ? <small className="s45-note"> — بديل</small> : null}</span>
                    <Copy text={t} />
                  </div>
                ))}
              </div>
              <div className="s45-sec">
                <h3>الوصف <Copy text={yt.description} /></h3>
                <pre className="s45-pre">{yt.description}</pre>
              </div>
              <div className="s45-sec">
                <h3>الوسوم <Copy text={yt.tags} /></h3>
                <div className="s45-pre">{yt.tags}</div>
              </div>
              {yt.shorts.length ? (
                <div className="s45-sec">
                  <h3>نصوص الشورتس</h3>
                  {yt.shorts.map((s) => (
                    <details key={s.label} className="s45-sub">
                      <summary>{s.label}</summary>
                      <div className="s45-copy-row"><span>{s.title}</span><Copy text={s.title} label="نسخ العنوان" /></div>
                      <pre className="s45-pre">{s.description}</pre>
                      <Copy text={s.description} label="نسخ الوصف" />
                    </details>
                  ))}
                </div>
              ) : null}
            </More>
          ) : null}

          <More label={`قائمة النشر — ${num(doneCount)} من ${num(CHECKLIST.length)}`}>
            {groups.map((g) => (
              <fieldset key={g} className="s45-checks">
                <legend>{g}</legend>
                {CHECKLIST.filter((c) => c.group === g).map((c) => (
                  <label key={c.id}>
                    <input type="checkbox" checked={Boolean(checked[c.id])} onChange={(e) => saveStatus({ ...status, checklist: { ...checked, [c.id]: e.target.checked } })} />
                    <span>{c.text}</span>
                  </label>
                ))}
              </fieldset>
            ))}
            <fieldset className="s45-checks">
              <legend>تسجيل النشر</legend>
              {status.published ? (
                <div className="s45-actions">
                  <span className="s45-ok">نُشرت في {status.published.date}</span>
                  {status.published.url ? <a href={status.published.url} target="_blank" rel="noreferrer" dir="ltr">{status.published.url}</a> : null}
                  <button type="button" className="btn ghost small" onClick={() => window.confirm("إلغاء تسجيل النشر لهذه الحلقة؟") && saveStatus({ ...status, published: undefined })}>تراجع</button>
                </div>
              ) : (
                <PublishForm disabled={!checked.watched || !publishAllowed} onSave={(p) => saveStatus({ ...status, published: p })} />
              )}
              {!checked.watched && !status.published ? <p className="s45-note">علّم «شاهدت الحلقة كاملة» أولًا.</p> : null}
              {!publishAllowed && !status.published ? <p className="s45-note">يلزم اعتماد النسخة النهائية ثم إذن نشرها (الخطوة ٣ ثم ٤) قبل تسجيل النشر.</p> : null}
              {status.published && !approved ? <p className="s45-note">هذا سجل نشر تاريخي؛ لا يثبت اعتماد النسخة النهائية الحالية.</p> : null}
            </fieldset>
          </More>

          {files.length ? (
            <More label={`كل الملفات — ${num(files.length)}`}>
              <ul className="s45-files">
                {files.map((f) => (
                  <li key={f.name}>
                    <code>{f.name}</code>
                    <span className="s45-note">{sizeLabel(f.size)}</span>
                    <a className="btn ghost small" href={api.packageUrl(episodeId, f.name, true)}>تنزيل</a>
                  </li>
                ))}
              </ul>
            </More>
          ) : null}
        </div>
      </Stage>
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
      className="s45-pubform"
    >
      <input id="pub-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} aria-label="تاريخ النشر" dir="ltr" />
      <input id="pub-url" type="url" pattern="https://.*" title="رابط يبدأ بـ https://" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="رابط الحلقة على يوتيوب (اختياري)" dir="ltr" />
      <button className="btn small" disabled={disabled} type="submit">تم النشر</button>
    </form>
  );
};
