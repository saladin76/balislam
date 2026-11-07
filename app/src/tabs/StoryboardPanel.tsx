import React, { useEffect, useMemo, useRef, useState } from "react";
import { Thumbnail } from "@remotion/player";
import type { Plan, PlanScene } from "../../../src/plan/types";
import type { Identity } from "../../../brand/identity/index";
import type { ChannelInfo } from "../../../src/channel/types";
import type { EpisodeMedia } from "../../../src/plan/media";
import { sceneFrames } from "../../../src/plan/duration";
import { introFramesFor } from "../../../src/remotion/scenes/ChannelIntro";
import { chapterEyebrow } from "../../../src/remotion/scenes/eyebrow";
import { shotElements, shotFrame, shotKind, shotText } from "../../../src/plan/storyboardView";
import { elementLibrary } from "../../../brand/elements/registry";
import { langPack } from "../../../src/i18n/packs";
import { SceneComp } from "../ui/Preview";
import { api, type LongJob, type StoryboardInfo } from "../api";
import config from "../../../config.json";

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
const elName = new Map(elementLibrary.map((e) => [e.id, e.nameAr]));

/** الصورة تُرسم فقط حين تقترب البطاقة من الشاشة (126 مشهدًا لا تُرسم دفعة واحدة) */
const Lazy: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || on) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setOn(true), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [on]);
  return (
    <div ref={ref} className="sb-frame">
      {on ? children : null}
    </div>
  );
};

/**
 * ستوري بورد الفيديو قبل تنفيذه: لقطة لكل مشهد مع نصه وما يظهر على الشاشة وعناصره وحركته المقيسة.
 * لا يُولَّد صوت ولا تُصنع النسخة النهائية لمشهد لم يُعتمد هنا ببصمته الحالية.
 */
export const StoryboardPanel: React.FC<{
  episodeId: string;
  plan: Plan;
  identity: Identity;
  channel: ChannelInfo;
  media: EpisodeMedia;
  onOpenScene: (id: string) => void;
  onReload: () => void;
}> = ({ episodeId, plan, identity, channel, media, onOpenScene, onReload }) => {
  const [info, setInfo] = useState<StoryboardInfo | null>(null);
  const [job, setJob] = useState<LongJob | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [visualReviewNote, setVisualReviewNote] = useState("");
  const [visualReviewed, setVisualReviewed] = useState(false);
  const [quranStatus, setQuranStatus] = useState<{ missing: string[]; existing: string[]; invalid: { ref: string; reason: string }[] } | null>(null);
  const [quranBusy, setQuranBusy] = useState(false);
  const [quranAudit, setQuranAudit] = useState<Awaited<ReturnType<typeof api.auditQuranScript>> | null>(null);
  const [quranMessage, setQuranMessage] = useState("");

  const fps = config.video.fps;
  const W = config.video.episode.width;
  const H = config.video.episode.height;
  const lang = langPack(plan.lang);

  useEffect(() => {
    let alive = true;
    setQuranStatus(null); setQuranMessage(""); setQuranAudit(null);
    api.missingQuranTexts(episodeId).then(({ status }) => {
      if (alive) setQuranStatus(status);
    }).catch((e) => {
      if (alive) setQuranMessage("تعذّر فحص النصوص القرآنية المحلية: " + (e instanceof Error ? e.message : String(e)));
    });
    return () => { alive = false; };
  }, [episodeId]);

  const reviewAgainstMushaf = async () => {
    setQuranBusy(true); setQuranMessage(""); setQuranAudit(null);
    try { setQuranAudit(await api.auditQuranScript(episodeId)); }
    catch (e) { setQuranMessage("تعذّر فحص المصحف: " + (e instanceof Error ? e.message : String(e))); }
    finally { setQuranBusy(false); }
  };

  useEffect(() => {
    const t = setTimeout(() => api.storyboard(episodeId).then(setInfo).catch((e) => setErr((e as Error).message)), info ? 1200 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId, plan]);

  useEffect(() => {
    let active = true;
    api.longJobs().then((jobs) => {
      if (!active) return;
      const current = jobs.find((j) => j.kind === "storyboard-motion" && j.episode === episodeId && j.status === "running");
      if (current) setJob(current);
    }).catch(() => {});
    return () => { active = false; };
  }, [episodeId]);

  // متابعة قياس الحركة حتى ينتهي
  useEffect(() => {
    if (!job || job.status !== "running") return;
    const t = setInterval(async () => {
      const all = await api.longJobs().catch(() => [] as LongJob[]);
      const j = all.find((x) => x.id === job.id);
      if (!j) return;
      setJob(j);
      if (j.status !== "running") {
        if (j.status === "error") setErr(j.error || j.log.slice(-2).join(" ") || "فشل فحص الحركة؛ افتح سجل المهمة.");
        else setErr("");
        api.storyboard(episodeId).then(setInfo).catch((e) => setErr((e as Error).message));
      }
    }, 3000);
    return () => clearInterval(t);
  }, [job, episodeId]);

  const rows = useMemo(() => {
    let t = introFramesFor(channel, plan);
    return plan.chapters.map((ch) => ({
      ch,
      shots: ch.scenes.map((s) => {
        const d = sceneFrames(s, media);
        const from = t;
        t += d;
        return { s, d, from };
      }),
    }));
  }, [plan, media, channel]);
  const totalSec = rows.reduce((n, r) => n + r.shots.reduce((m, x) => m + x.d, 0), 0) / fps;

  useEffect(() => {
    setVisualReviewNote("");
    setVisualReviewed(false);
  }, [episodeId, plan.updatedAt]);
  const st = info?.status;
  const motion = info?.motion;
  const act = async (action: "approve" | "revoke") => {
    const auditNote = visualReviewNote.trim();
    if (action === "approve" && (!visualReviewed || auditNote.length < 25)) {
      setErr("الاعتماد هنا للـStoryboard المرئي فقط: افتح اللوحات كلها، ثم أكّد مشاهدتها واكتب إصدارها وملاحظة فعلية من 25 حرفًا على الأقل.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      setInfo(await api.setStoryboard(episodeId, action, action === "approve" ? auditNote : undefined));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const measure = async () => {
    setErr("");
    try {
      setJob(await api.startJob({ kind: "storyboard-motion", episode: episodeId }));
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const downloadReport = async () => {
    setReportBusy(true);
    setErr("");
    try {
      const { markdown } = await api.storyboardReport(episodeId);
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `storyboard-motion-report-${episodeId}.md`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setReportBusy(false);
    }
  };
  const motionOf = (s: PlanScene) => {
    const m = motion?.scenes[s.id];
    return m ? { ...m, stale: Boolean(info?.motionStale?.includes(s.id)) } : null;
  };
  const stills = motion ? Object.entries(motion.scenes).filter(([k, v]) => !info?.motionStale?.includes(k) && v.still > 2).map(([k]) => k) : [];
  const staleCount = info?.motionStale?.length ?? 0;
  const logicNeedsReview = motion ? Object.entries(motion.scenes).filter(([id, v]) => !info?.motionStale?.includes(id) && v.logic?.status === "needs-review").map(([id]) => id) : [];
  const logicNotAssessable = motion ? Object.entries(motion.scenes).filter(([id, v]) => !info?.motionStale?.includes(id) && (!v.logic || v.logic.status === "not-assessable")).map(([id]) => id) : [];

  return (
    <div className="storyboard">
      <div className="sb-head">
        <div style={{ display: "grid", gap: 4 }}>
          <h2>ستوري بورد الحلقة {episodeId}</h2>
          <p className="help">
            هذه المرحلة لاعتماد تصميم الـStoryboard المرئي بعد مشاهدة جميع اللوحات، قبل اختيار النبرات وإنتاج الصوت. فحص الحركة الصامتة القديم تشخيص اختياري لمرحلة الفيديو اللاحقة، ولا يمنع عرض اللوحات أو اعتماد تصميمها. نصوص الآيات غير المجلوبة تمنع الاعتماد النهائي حتى التحقق من المصدر.
          </p>
          <p className="sb-facts">
            <span>{rows.reduce((n, r) => n + r.shots.length, 0)} مشهدًا</span>
            <span>المدة {fmt(totalSec)}{Object.keys(media.voice).length ? "" : " (بلا صوت: أقل مدة لكل قالب)"}</span>
            {st ? <span className={st.ok ? "ok" : "warn"}>معتمد {st.approved} من {st.total}</span> : null}
            {motion ? <span className="help">فحص حركة تشخيصي لاحق: {motion.percent}٪{staleCount ? " (نسخة قديمة)" : ""}</span> : null}

          </p>
          {motion && <details className="sb-technical-metrics">
            <summary>نتائج فحص الحركة القديم — للمرحلة اللاحقة بعد الصوت فقط</summary>
            <p className="help">هذا فحص استرشادي لتوقيت العناصر قبل اعتماد الصوت. التحذيرات لا تعادل رفض تصميم اللوحات ولا يطلب منك تجاوزها الآن.</p>
            {staleCount > 0 && <p>مشاهد تحتاج تحديث القياس عند إنتاج الحركة: {staleCount}</p>}
            {stills.length > 0 && <p>مشاهد لها سكون أكثر من ثانيتين: {stills.join("، ")}</p>}
            <p>تحذيرات منطق الحركة: {logicNeedsReview.length} · غير قابلة للتقييم آليًا: {logicNotAssessable.length}</p>
          </details>}
          {st?.changed.length ? <p className="help warn">تغيّر بعد الاعتماد: {st.changed.join("، ")}</p> : null}
          {st?.audit?.note ? <p className="help">ملاحظة اعتماد المراجع: {st.audit.note}</p> : null}
          {info?.motionAuditNeedsReview ? <p className="help">تنبيه فني مستقل: تقرير الحركة يحتوي ملاحظات تُراجع بعد اعتماد الصوت وأثناء إنتاج الفيديو؛ لا تُعامل باعتبارها رفضًا للـStoryboard المرئي.</p> : null}
          {err ? <p className="help warn" role="alert">{err}</p> : null}
          {job?.status === "error" ? <p className="help warn">المهمة فشلت؛ لم تُعتمد نتيجة جديدة. {job.error || ""}</p> : null}
        </div>
        <div className="sb-actions">
          <button className="btn" onClick={measure} disabled={job?.status === "running"} title="فحص تشخيصي اختياري لمرحلة إنتاج الفيديو، وليس شرط اعتماد الستوري بورد">
            {job?.status === "running" ? `يقيس الحركة والمنطق… ${job.pct}%` : motion ? "إعادة الفحص الفني (اختياري)" : "فحص الحركة الفني (اختياري)"}
          </button>
          {motion ? <button className="btn" onClick={() => void downloadReport()} disabled={reportBusy}>{reportBusy ? "يُجهّز التقرير…" : "تنزيل تقرير الفحص"}</button> : null}
          {st?.ok ? (
            <button className="btn" onClick={() => act("revoke")} disabled={busy}>
              اسحب الاعتماد
            </button>
          ) : (
            <button className="btn primary" onClick={() => act("approve")} disabled={busy || !st}>
              اعتماد اللوحات المرئية بعد مراجعتها
            </button>
          )}
        </div>
      </div>

      <section className="sb-quran-text-source" aria-label="نصوص الآيات" style={{ display: "grid", gap: 8, padding: 18, border: "1px solid var(--line, #d5dbe2)", borderRadius: 12, marginBottom: 18 }}>
        <h3>نصوص الآيات — قبل اعتماد اللوحات</h3>
        <p className="help">صاحب المشروع يكتب الآية داخل السكريبت: [آية: النجم 39 | النص بالتشكيل]. مقارنة المصحف تعرض الفروق دون تعديل النص أو تسجيل اعتماد شرعي آلي.</p>
        {quranStatus && <p role="status">مراجع نصية محلية موجودة: {quranStatus.existing.length} · ناقصة: {quranStatus.missing.length} · غير صالحة: {quranStatus.invalid.length}</p>}
        {!!quranStatus?.missing.length && <p className="warn">الناقص: {quranStatus.missing.join("، ")}</p>}
        {!!quranStatus?.invalid.length && <p className="warn">مراجع تحتاج تصحيحًا من المصدر: {quranStatus.invalid.map((x) => x.ref + " (" + x.reason + ")").join("، ")}</p>}
        {quranMessage && <p role="status">{quranMessage}</p>}
        <div>
          <button className="btn" type="button" onClick={() => { setQuranMessage(""); api.missingQuranTexts(episodeId).then(({ status }) => setQuranStatus(status)).catch((e) => setQuranMessage(String(e))); }}>
            إعادة فحص النصوص المحلية
          </button>
          <button className="btn" type="button" disabled={quranBusy}
             onClick={() => void reviewAgainstMushaf()}>{quranBusy ? "جارٍ مقارنة النص…" : "مقارنة نص السكريبت مع المصحف — قراءة فقط"}</button>
        </div>
        {quranAudit && <div role="status" className="field">
          <p>بيئة مرجع المصحف: {quranAudit.environment}. المطابقة التقنية ليست اعتمادًا شرعيًا.</p>
          {quranAudit.audits.map((a) => <div key={a.key} className="field">
            <strong>{a.key}: {a.status === "match" ? "مطابق تقنيًا — يحتاج قرار المراجع" : a.status === "differs" ? "توجد فروق" : a.reason ?? a.status}</strong>
            {!a.numbers.ok && <p className="warn">{a.numbers.notes.join("؛ ")}</p>}
            {a.ops.length > 0 && <ul>{a.ops.map((op, i) => <li key={i}>
              الموضع {op.at + 1}، {op.cls}، {op.op}: في السكريبت «{op.shown || "∅"}»، في المصحف «{op.ref || "∅"}»
            </li>)}</ul>}
          </div>)}
        </div>}
      </section>

      <section className="sb-visual-approval" aria-label="مراجعة Storyboard المرئي" style={{ display: "grid", gap: 10, padding: 18, border: "1px solid var(--line, #d5dbe2)", borderRadius: 12, marginBottom: 20 }}>
        <h3>المرحلة الأولى — مراجعة لوحات Storyboard المرئية</h3>
        <p className="help">يُمكن عرض أو تسليم PDF وصور النسخ V1/V2 أثناء وجود ملاحظات الحركة والصوت. لا تضغط الاعتماد إلا بعد مراجعة كل مشاهد التصميم، ومطابقة آيات القرآن من مصدرها. نتيجة فحص الحركة القديمة ليست شرطًا لهذه المرحلة.</p>
        {channel.id === "zubdat-alkutub" && episodeId === "001" ? (
          <p><a href="https://drive.google.com/file/d/1MTtTbSufZN2N0OFueEAjsOlLiaBSglMd/view" target="_blank" rel="noreferrer">فتح PDF المرئي V021 — 31 مشهدًا (PENDING_REVIEW، ليس اعتمادًا)</a></p>
        ) : null}
        {channel.id === "dafatir-alzaman" && episodeId === "001" ? (
          <p><a href="https://github.com/saladin76/balislam/blob/main/channels/dafatir-alzaman/episodes/001-adam-beginning/tech-reviews/020/docs/storyboard-001-v1.1.pdf" target="_blank" rel="noreferrer">فتح Storyboard V1.1 — 80 مشهدًا (نسخة GitHub، نقل Drive لم يُتحقق منه)</a></p>
        ) : null}
        <label htmlFor="sb-visual-review-note">ملاحظة المراجع: إصدار اللوحات، نطاق المشاهدة، والتعديلات المطلوبة أو سبب الموافقة</label>
        <textarea id="sb-visual-review-note" value={visualReviewNote} rows={3} maxLength={3000}
          onChange={(e) => setVisualReviewNote(e.target.value)}
          placeholder="راجعت كل لوحات الإصدار ...، والتكوين والنصوص متطابقة، والمشاهد التي تحتاج إصلاحًا..." />
        <label><input type="checkbox" checked={visualReviewed} onChange={(e) => setVisualReviewed(e.target.checked)} />
          أؤكد أنني شاهدت جميع اللوحات المرئية لهذه الحلقة، وليس عينات متفرقة فقط.</label>
        <p className="help">إذا كانت الآيات ناقصة، اكتبها داخل السكريبت ثم أعد مقارنة المصحف والمراجعة الشرعية؛ يبقى Storyboard في PENDING_REVIEW ولا تعتمد ملفات PDF تلقائيًا.</p>
      </section>

      <Reviews episodeId={episodeId} />
      <Previews episodeId={episodeId} />

      {rows.map(({ ch, shots }) => (
        <section key={ch.number} className="sb-chapter">
          <h3>
            <span className="sb-tape">الفصل {ch.number}</span> {ch.title}
          </h3>
          <div className="sb-grid">
            {shots.map(({ s, d, from }) => {
              const m = motionOf(s);
              const state = st?.scenes[s.id];
              const els = shotElements(s);
              return (
                <article key={s.id} className="sb-shot" role="button" tabIndex={0} onClick={() => onOpenScene(s.id)} onKeyDown={(e) => e.key === "Enter" && onOpenScene(s.id)}>
                  <Lazy>
                    <Thumbnail
                      component={SceneComp}
                      inputProps={{ scene: s, themeId: plan.themeId, orientation: "landscape", eyebrow: chapterEyebrow(channel, lang.strings.chapter, ch), identity, channel, lang: plan.lang, media, episodeOverlays: plan.overlays }}
                      compositionWidth={W}
                      compositionHeight={H}
                      durationInFrames={d}
                      frameToDisplay={shotFrame(s, d)}
                      fps={fps}
                      style={{ width: "100%" }}
                    />
                    <span className="sb-id">{s.id}</span>
                    <span className="sb-time">{fmt(from / fps)}</span>
                  </Lazy>
                  <div className="sb-txt">
                    <p className="sb-kind">
                      {shotKind(s)}
                      {state === "approved" ? <span className="badge ok">معتمد</span> : state === "changed" ? <span className="badge edited">تغيّر بعد الاعتماد</span> : null}
                    </p>
                    <p className="sb-said">{s.narration || (s.template === "verse-card" ? `[آية: ${s.props.reference ?? ""}]` : "بلا تعليق صوتي")}</p>
                    <p className="sb-meta">
                      <b>على الشاشة:</b> {shotText(s) || "—"}
                    </p>
                    <p className="sb-meta">
                      <b>العناصر:</b> {els.length ? els.map((id) => elName.get(id) ?? id).join("، ") : "بلا عناصر"}
                    </p>
                    {m ? (
                      <details className="sb-motion-after-voice" onClick={(e) => e.stopPropagation()}>
                        <summary>تقرير الحركة الفني (مرحلة لاحقة)</summary>
                        <p className={`sb-motion${m.stale ? " stale" : ""}`}>
                          {m.stale ? "تغيّر بعد القياس" : `${m.pct}٪ حركة · أطول سكون ${m.still} ث`}
                        </p>
                        {!m.stale && m.logic ? (
                          <div className="sb-logic">
                            <strong>{m.logic.status === "needs-review" ? "مراجعة منطق الحركة مطلوبة" : m.logic.status === "not-assessable" ? "تعذّر تقييم ملاءمة الحركة للنص آليًا" : "لم تُكتشف مخالفات في مراسي الأحداث"}</strong>
                            <span>الكلمات المحفّزة المطابقة: {m.logic.matched} من {m.logic.total}</span>
                            {m.logic.findings.filter((f) => f.level === "warning").map((f, i) => (
                              <p key={i} className="warn">{f.message}</p>
                            ))}
                            <details onClick={(e) => e.stopPropagation()}>
                              <summary>حدود الفحص وملاحظاته</summary>
                              {m.logic.findings.filter((f) => f.level === "info").map((f, i) => (
                                <p key={i}>{f.message}</p>
                              ))}
                            </details>
                          </div>
                        ) : null}
                      </details>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

/** ملفات المراجعة والاعتماد للحلقة (reviews/): تقارير داخلية تُفتح في نافذة مستقلة، لا تُنشر. */
const Reviews: React.FC<{ episodeId: string }> = ({ episodeId }) => {
  const [files, setFiles] = useState<{ name: string; title: string; note: string; mtime: number }[]>([]);
  useEffect(() => {
    api.reviews(episodeId).then((r) => setFiles(r.files)).catch(() => setFiles([]));
  }, [episodeId]);
  if (!files.length) return null;
  return (
    <section className="sb-previews">
      <h3>ملفات المراجعة</h3>
      <p className="help">تقارير الاعتماد التحريري والشرعي للحلقة. القرار في كل بند يبقى في «السكريبت ← سجل التوثيق»؛ هذه الملفات أدلة ولا تعتمد شيئًا.</p>
      <ul className="sb-reviews">
        {files.map((f) => (
          <li key={f.name}>
            <a href={api.reviewUrl(episodeId, f.name)} target="_blank" rel="noreferrer">
              <b>{f.title}</b>
            </a>
            <span className="help"> · {new Date(f.mtime).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}</span>
            {f.note ? <div className="help">{f.note}</div> : null}
          </li>
        ))}
      </ul>
    </section>
  );
};

/** معاينات الحلقة المرفوعة للمراجعة (previews/): صامتة وخفيفة، لا تُنشر. */
const Previews: React.FC<{ episodeId: string }> = ({ episodeId }) => {
  const [files, setFiles] = useState<{ name: string; size: number; mtime: number; title: string; note: string; version: number; updatedAt: string | null }[]>([]);
  useEffect(() => {
    api.previews(episodeId).then((r) => setFiles(r.files)).catch(() => setFiles([]));
  }, [episodeId]);
  if (!files.length) return null;
  return (
    <section className="sb-previews">
      <h3>المعاينات</h3>
      <p className="help">كل فيديو يُصنع للحلقة يظهر هنا، وأي تعديل يستبدل القديم بالجديد. المعاينات لا تُنشر.</p>
      <div className="sb-previews-grid">
        {files.map((f) => (
          <figure key={f.name} className="sb-preview">
            <video src={api.previewUrl(episodeId, f.name)} controls preload="metadata" playsInline />
            <figcaption>
              <b>{f.title}</b>
              <span className="help">رفع رقم {f.version}{f.updatedAt ? ` · ${new Date(f.updatedAt).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}` : ""}</span>
              {f.note ? <span className="help">{f.note}</span> : null}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
};
