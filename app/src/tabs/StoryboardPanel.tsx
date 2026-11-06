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
}> = ({ episodeId, plan, identity, channel, media, onOpenScene }) => {
  const [info, setInfo] = useState<StoryboardInfo | null>(null);
  const [job, setJob] = useState<LongJob | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<"all" | "pending" | "warnings">("all");
  const [focusView, setFocusView] = useState(false);
  const fps = config.video.fps;
  const W = config.video.episode.width;
  const H = config.video.episode.height;
  const lang = langPack(plan.lang);

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

  const st = info?.status;
  const motion = info?.motion;
  const act = async (action: "approve" | "revoke") => {
    let auditNote: string | undefined;
    if (action === "approve") {
      if (info?.motionStale?.length) {
        setErr("نتيجة الفحص قديمة؛ أعد قياس الحركة والمنطق ثم اعتمد الستوري بورد.");
        return;
      }
      const warnings = Object.values(info?.motion?.scenes ?? {}).filter((s) => s.logic?.status === "needs-review").length;
      if (warnings) {
        const answer = window.prompt(
          `يوجد ${warnings} مشهدًا بها تحذيرات فحص. شاهد المشاهد أولًا، ثم اكتب سبب قبولها رغم التحذيرات أو الإصلاح الذي أجريته. لن تُعتبر التحذيرات اعتمادًا تلقائيًا.`,
          "",
        );
        if (answer === null) return;
        auditNote = answer.trim();
        if (auditNote.length < 10) {
          setErr("اكتب ملاحظة مراجعة من 10 أحرف على الأقل قبل اعتماد المشاهد ذات التحذيرات.");
          return;
        }
      }
    }
    setBusy(true);
    setErr("");
    try {
      setInfo(await api.setStoryboard(episodeId, action, auditNote));
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
    <div className={focusView ? "storyboard sb-focus-view" : "storyboard"}>
      <div className="sb-head">
        <div style={{ display: "grid", gap: 4 }}>
          <h2>ستوري بورد الحلقة {episodeId}</h2>
          <p className="help">
            لقطة لكل مشهد مع نصه وما يظهر على الشاشة وعناصره. القياس يفحص الحركة المرئية ومطابقة كلمات تشغيل الأحداث للنص وترتيبها؛ لا يستطيع الحكم على صحة المعنى من الفيديو وحده. لا يُولَّد صوت ولا تُصنع النسخة النهائية لمشهد قبل اعتماده هنا، وأي تعديل بعد الاعتماد يعيده للاعتماد.
          </p>
          <p className="sb-facts">
            <span>{rows.reduce((n, r) => n + r.shots.length, 0)} مشهدًا</span>
            <span>المدة {fmt(totalSec)}{Object.keys(media.voice).length ? "" : " (بلا صوت: أقل مدة لكل قالب)"}</span>
            {st ? <span className={st.ok ? "ok" : "warn"}>معتمد {st.approved} من {st.total}</span> : null}
            {motion ? <span className={staleCount ? "warn" : motion.percent >= 80 ? "ok" : "warn"}>الحركة {motion.percent}٪{staleCount ? " (قياس قديم)" : ""}</span> : <span className="warn">الحركة لم تُقس</span>}
            {staleCount ? <span className="warn">{staleCount} مشهدًا تغيّر منذ القياس — أعد الفحص قبل الاعتماد.</span> : null}
            {stills.length ? <span className="warn">سكون فوق ثانيتين: {stills.join("، ")}</span> : null}
            {motion && <span className={logicNeedsReview.length || logicNotAssessable.length ? "warn" : "help"}>مطابقة النص: {logicNeedsReview.length} بها تحذيرات · {logicNotAssessable.length} غير قابلة للتقييم الآلي (لا تعادل اعتمادًا فنيًا)</span>}
          </p>
          {st?.changed.length ? <p className="help warn">تغيّر بعد الاعتماد: {st.changed.join("، ")}</p> : null}
          {st?.audit?.note ? <p className="help">ملاحظة اعتماد المراجع: {st.audit.note}</p> : null}
          {info?.auditNeedsReview ? <p className="help warn" role="alert">ظهر تقرير حديث بتحذيرات لم يشملها الاعتماد السابق. راجع المشاهد ثم سجّل سبب قبولها.</p> : null}
          {err ? <p className="help warn" role="alert">{err}</p> : null}
          {job?.status === "error" ? <p className="help warn">المهمة فشلت؛ لم تُعتمد نتيجة جديدة. {job.error || ""}</p> : null}
        </div>
        <div className="sb-actions">
          <button className="btn" onClick={measure} disabled={job?.status === "running"}>
            {job?.status === "running" ? `يقيس الحركة والمنطق… ${job.pct}%` : motion ? "أعد فحص الحركة والمنطق" : "افحص الحركة والمنطق"}
          </button>
          {motion ? <button className="btn" onClick={() => void downloadReport()} disabled={reportBusy}>{reportBusy ? "يُجهّز التقرير…" : "تنزيل تقرير الفحص"}</button> : null}
          {st?.ok && !info?.auditNeedsReview ? (
            <button className="btn" onClick={() => act("revoke")} disabled={busy}>
              اسحب الاعتماد
            </button>
          ) : (
            <button className="btn primary" onClick={() => act("approve")} disabled={busy || !st}>
              {info?.auditNeedsReview ? "راجع تحذيرات القياس واعتمد" : "اعتمد الستوري بورد"}
            </button>
          )}
        </div>
      </div>

      <Reviews episodeId={episodeId} />
      <Previews episodeId={episodeId} />

      <div className="sb-review-controls" role="group" aria-label="أدوات عرض ستوري بورد المراجعة">
        <label>تصفية المشاهد
          <select value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value as "all" | "pending" | "warnings")}>
            <option value="all">جميع المشاهد</option>
            <option value="pending">لم تُعتمد أو تغيّرت</option>
            <option value="warnings">تحذيرات الحركة والمنطق</option>
          </select>
        </label>
        <button type="button" className="btn" aria-pressed={focusView} onClick={() => setFocusView((v) => !v)}>
          {focusView ? "عرض البطاقات المعتاد" : "عرض موسّع للمراجعة"}
        </button>
        <span className="help">اختيار العرض لا يُغير أي اعتماد.</span>
      </div>

      {rows.map(({ ch, shots }) => ({ ch, shots: shots.filter(({ s }) => reviewFilter === "all" ? true :
        reviewFilter === "pending" ? st?.scenes[s.id] !== "approved" :
        Boolean(info?.motionStale?.includes(s.id) || motionOf(s)?.logic?.status === "needs-review" || (motionOf(s)?.still ?? 0) > 2)) }))
        .filter(({ shots }) => shots.length > 0).map(({ ch, shots }) => (
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
                      <>
                        <p className={`sb-motion${m.stale ? " stale" : m.still > 2 ? " warn" : ""}`}>
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
                      </>
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
