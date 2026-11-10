import React, { useEffect, useMemo, useRef, useState } from "react";
import { Thumbnail } from "@remotion/player";
import type { Plan, PlanScene } from "../../../src/plan/types";
import type { Identity } from "../../../brand/identity/index";
import type { ChannelInfo } from "../../../src/channel/types";
import type { EpisodeMedia } from "../../../src/plan/media";
import { sceneFrames } from "../../../src/plan/duration";
import { introFramesFor } from "../../../src/remotion/scenes/ChannelIntro";
import { chapterEyebrow } from "../../../src/remotion/scenes/eyebrow";
import { boardWords, shotElements, shotFrame, shotKind, shotText } from "../../../src/plan/storyboardView";
import { elementLibrary } from "../../../brand/elements/registry";
import { langPack } from "../../../src/i18n/packs";
import { SceneComp } from "../ui/Preview";
import { api, type EpisodePreview, type LongJob, type ReviewItem, type StoryboardInfo } from "../api";
import { episodeLength } from "../../../src/plan/episodeLength";
import { duration, lengthSource, num, sceneName, verseRef } from "../ui/format";
import { BoardViewer, type BoardShot } from "./BoardViewer";
import config from "../../../config.json";
import { Hint, More } from "../shell/Screen";
import { BoardAuditLog, ChangedBoards, auditLogOnTop } from "./BoardAuditLog";
import "../shell/screens-s12.css";

const ar = (n: number) => num(n);
const fmtAr = (sec: number) => duration(Math.floor(sec));
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
 * One scene's board picture, drawn only when it comes near the screen (the filmstrip of step ٢, direction D).
 * The same renderer and frame as the storyboard boards; nothing is fetched or stored.
 */
export const SceneThumb: React.FC<{ sceneId: string; plan: Plan; identity: Identity; channel: ChannelInfo; media: EpisodeMedia }> = ({ sceneId, plan, identity, channel, media }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || on || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setOn(true), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [on]);
  const hit = useMemo(() => {
    for (const ch of plan.chapters) { const s = ch.scenes.find((x) => x.id === sceneId); if (s) return { s, ch }; }
    return null;
  }, [plan, sceneId]);
  const fps = config.video.fps;
  return (
    <div ref={ref} className="ms-thumb" aria-hidden="true">
      {on && hit ? (() => {
        const d = sceneFrames(hit.s, media);
        return (
          <Thumbnail component={SceneComp}
            inputProps={{ scene: hit.s, themeId: plan.themeId, orientation: "landscape", eyebrow: chapterEyebrow(channel, langPack(plan.lang).strings.chapter, hit.ch), identity, channel, lang: plan.lang, media, episodeOverlays: plan.overlays }}
            compositionWidth={config.video.episode.width} compositionHeight={config.video.episode.height}
            durationInFrames={d} frameToDisplay={shotFrame(hit.s, d, boardWords(hit.s, media), fps)} fps={fps} style={{ width: "100%" }} />
        );
      })() : null}
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
  /** «تحرير المشهد» in the board viewer: the scene's line in the script, inside step ١ (D52). */
  onEditScene: (line: number, sceneId: string) => void;
  onReload: () => void;
  /** The visual sign-off changed the storyboard fingerprint: the spine re-reads it. */
  onSigned?: () => void;
  /** Bumped after an owner decision elsewhere (the dock's «اعتمد التجهيز»): the board states are read again. */
  refreshKey?: number;
}> = ({ episodeId, plan, identity, channel, media, onEditScene, onReload, onSigned, refreshKey }) => {
  const [viewing, setViewing] = useState<number | null>(null);
  const [citations, setCitations] = useState<ReviewItem[] | null>(null);
  useEffect(() => {
    if (viewing === null || citations) return;
    api.review(episodeId).then((r) => setCitations(r.items), () => setCitations([]));
  }, [viewing, citations, episodeId]);
  const [info, setInfo] = useState<StoryboardInfo | null>(null);
  const [job, setJob] = useState<LongJob | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [visualReviewNote, setVisualReviewNote] = useState("");
  const [visualReviewed, setVisualReviewed] = useState(false);
  const [details, setDetails] = useState(false);
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
  }, [episodeId, plan, refreshKey]);

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
  // The same length as the episode list (D52), and where it comes from.
  const length = useMemo(() => episodeLength(plan, media, fps), [plan, media, fps]);
  const flat: BoardShot[] = useMemo(() => rows.flatMap(({ ch, shots }) => shots.map((x) => ({ ...x, chapter: { number: ch.number, title: ch.title } }))), [rows]);
  const order = useMemo(() => flat.map((x) => x.s.id), [flat]);
  const indexOf = useMemo(() => new Map(order.map((id, i) => [id, i])), [order]);
  const thumb = (x: BoardShot, ch: Plan["chapters"][number]) => (
    <Thumbnail
      component={SceneComp}
      inputProps={{ scene: x.s, themeId: plan.themeId, orientation: "landscape", eyebrow: chapterEyebrow(channel, lang.strings.chapter, ch), identity, channel, lang: plan.lang, media, episodeOverlays: plan.overlays }}
      compositionWidth={W}
      compositionHeight={H}
      durationInFrames={x.d}
      frameToDisplay={shotFrame(x.s, x.d, boardWords(x.s, media), fps)}
      fps={fps}
      style={{ width: "100%" }}
    />
  );

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
      onSigned?.();
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

  const sceneCount = rows.reduce((n, r) => n + r.shots.length, 0);
  const noVoice = !Object.keys(media.voice).length;

  const auditLog = (
    <BoardAuditLog st={st} channelId={channel.id} episodeId={episodeId} note={visualReviewNote} onNote={setVisualReviewNote}
      reviewed={visualReviewed} onReviewed={setVisualReviewed} busy={busy} onAct={(a) => void act(a)}
      error={undefined} />
  );
  // شاشة واحدة: شبكة اللوحات؛ وملاحظة مراجعتها تُكتب بجوار «اعتمد التجهيز» في عمود الحلقة (D40)،
  // وكل ما سواها (سجل مراجعة اللوحات، الآيات، الفحص الفني، المعاينات) في «أدوات وتفاصيل».
  return (
    <div className={`storyboard s12-board${details ? " is-detailed" : ""}`}>
      <header className="s12-board-head">
        <Hint>راجع كل لوحة: صورتها ونص تعليقها.</Hint>
        <span className="s12-num" title={lengthSource(length)}>
          {ar(sceneCount)} مشهدًا · {duration(length.seconds)} <span className="s12-soft">({lengthSource(length)})</span>
          {st && st.approved ? <span className="s12-soft"> · معتمد {ar(st.approved)}</span> : null}
        </span>
        {!info && err ? <p className="s12-alert" role="alert">{err}</p> : null}
      </header>

      {/* P-05: boards changed after the approval are listed first; the full log stays in «أدوات وتفاصيل» */}
      {st && auditLogOnTop(st) ? <ChangedBoards st={st} name={(id) => sceneName(order, id)} onOpen={(id) => setViewing(indexOf.get(id) ?? 0)} /> : null}

      {rows.map(({ ch, shots }) => (
        <section key={ch.number} className="sb-chapter s12-chapter">
          <h3 className="s12-chapter-h">
            <span className="s12-num">{ar(ch.number)}</span> {ch.title}
          </h3>
          <div className="sb-grid s12-grid">
            {shots.map(({ s, d, from }) => {
              const m = motionOf(s);
              const state = st?.scenes[s.id];
              const els = shotElements(s);
              return (
                <article key={s.id} className="sb-shot s12-shot" role="button" tabIndex={0} aria-label={`افتح لوحة ${sceneName(order, s.id)}`} title={s.id}
                  onClick={() => setViewing(indexOf.get(s.id) ?? 0)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setViewing(indexOf.get(s.id) ?? 0); } }}>
                  <Lazy>{thumb({ s, d, from, chapter: ch }, ch)}</Lazy>
                  <div className="sb-txt s12-txt">
                    <p className="s12-shot-meta">
                      <span className="s12-id">{sceneName(order, s.id)}</span>
                      {state === "approved" ? <span className="s12-mark ok" title="معتمد">معتمد</span> : state === "changed" ? <span className="s12-mark warn" title="تغيّر بعد الاعتماد">تغيّر</span> : state === "new" && st?.approved ? <span className="s12-mark warn" title="أُضيفت بعد الاعتماد">جديدة</span> : null}
                      <span className="spacer" />
                      <span className="s12-time">{fmtAr(from / fps)}</span>
                    </p>
                    <p className="sb-said">{s.narration || (s.template === "verse-card" ? `[آية: ${verseRef(s.ayahKey ?? s.props.reference)}]` : "بلا تعليق صوتي")}</p>
                    {details ? (
                      <div className="s12-shot-details">
                        <p className="sb-kind">{shotKind(s)}</p>
                        <p className="sb-meta"><b>على الشاشة:</b> {shotText(s) || "—"}</p>
                        <p className="sb-meta"><b>العناصر:</b> {els.length ? els.map((id) => elName.get(id) ?? id).join("، ") : "بلا عناصر"}</p>
                        {m ? (
                          <details className="sb-motion-after-voice" onClick={(e) => e.stopPropagation()}>
                            <summary>تقرير الحركة الفني (مرحلة لاحقة)</summary>
                            <p className={`sb-motion${m.stale ? " stale" : ""}`}>
                              {m.stale ? "تغيّر بعد القياس" : `${ar(m.pct)}٪ حركة · أطول سكون ${ar(m.still)} ث`}
                            </p>
                            {!m.stale && m.logic ? (
                              <div className="sb-logic">
                                <strong>{m.logic.status === "needs-review" ? "مراجعة منطق الحركة مطلوبة" : m.logic.status === "not-assessable" ? "تعذّر تقييم ملاءمة الحركة للنص آليًا" : "لم تُكتشف مخالفات في مراسي الأحداث"}</strong>
                                <span>الكلمات المحفّزة المطابقة: {ar(m.logic.matched)} من {ar(m.logic.total)}</span>
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
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {viewing !== null && flat[viewing] ? (
        <BoardViewer shots={flat} index={viewing} order={order} fps={fps} citations={citations}
          lineEnd={(i) => flat[i + 1]?.s.line ?? Number.MAX_SAFE_INTEGER}
          onIndex={setViewing} onClose={() => setViewing(null)}
          onEdit={(line, id) => { setViewing(null); onEditScene(line, id); }}
          frame={(x) => thumb(x, plan.chapters.find((c) => c.number === x.chapter.number)!)}
          onScreen={(sc) => shotText(sc)}
          elements={(sc) => shotElements(sc).map((id) => elName.get(id) ?? id)}
          state={st?.scenes[flat[viewing]!.s.id]} />
      ) : null}

      {/* فيديوهات الحلقة ظاهرة دائمًا تحت اللوحات، لا مطوية: هي ما يُراجَع */}
      <Previews episodeId={episodeId} />

      <More>
        {err ? <p className="s12-alert" role="alert">{err}</p> : null}
        {job?.status === "error" ? <p className="s12-alert">المهمة فشلت؛ لم تُعتمد نتيجة جديدة. {job.error || ""}</p> : null}

        <section className="s12-tool" aria-label="عرض اللوحات">
          <label className="s12-check">
            <input type="checkbox" checked={details} onChange={(e) => setDetails(e.target.checked)} />
            إظهار تفاصيل كل لوحة (القالب، ما على الشاشة، العناصر، تقرير الحركة)
          </label>
          {noVoice ? <p className="s12-soft">المدة بلا صوت: أقل مدة لكل قالب.</p> : null}
        </section>

        {auditLog}

        <section className="s12-tool sb-quran-text-source" aria-label="نصوص الآيات">
          <h3 className="s12-h">نصوص الآيات</h3>
          <p className="s12-soft">تُكتب الآية داخل السكريبت: [آية: النجم 39 | النص بالتشكيل]. المقارنة تعرض الفروق ولا تعدّل النص ولا تعتمد شيئًا.</p>
          {quranStatus && <p role="status">موجودة محليًا: {ar(quranStatus.existing.length)} · ناقصة: {ar(quranStatus.missing.length)} · غير صالحة: {ar(quranStatus.invalid.length)}</p>}
          {!!quranStatus?.missing.length && <p className="s12-soft">الناقص: {quranStatus.missing.map(verseRef).join("، ")}</p>}
          {!!quranStatus?.invalid.length && <p className="s12-soft">مراجع تحتاج تصحيحًا من المصدر: {quranStatus.invalid.map((x) => verseRef(x.ref) + " (" + x.reason + ")").join("، ")}</p>}
          {quranMessage && <p role="status">{quranMessage}</p>}
          <div className="s12-row">
            <button className="btn" type="button" onClick={() => { setQuranMessage(""); api.missingQuranTexts(episodeId).then(({ status }) => setQuranStatus(status)).catch((e) => setQuranMessage(String(e))); }}>
              إعادة فحص النصوص المحلية
            </button>
            <button className="btn" type="button" disabled={quranBusy} onClick={() => void reviewAgainstMushaf()}>
              {quranBusy ? "جارٍ مقارنة النص…" : "مقارنة مع المصحف (قراءة فقط)"}
            </button>
          </div>
          {quranAudit && <div role="status" className="s12-audit">
            <p>بيئة مرجع المصحف: {quranAudit.environment}. المطابقة التقنية ليست اعتمادًا شرعيًا.</p>
            {quranAudit.audits.map((a) => <div key={a.key}>
              <strong>{verseRef(a.key)}: {a.status === "match" ? "مطابق تقنيًا — يحتاج قرار المراجع" : a.status === "differs" ? "توجد فروق" : a.reason ?? a.status}</strong>
              {!a.numbers.ok && <p className="warn">{a.numbers.notes.join("؛ ")}</p>}
              {a.ops.length > 0 && <ul>{a.ops.map((op, i) => <li key={i}>
                الموضع {ar(op.at + 1)}، {op.cls}، {op.op}: في السكريبت «{op.shown || "∅"}»، في المصحف «{op.ref || "∅"}»
              </li>)}</ul>}
            </div>)}
          </div>}
        </section>

        <section className="s12-tool" aria-label="فحص الحركة الفني">
          <h3 className="s12-h">فحص الحركة (اختياري، لمرحلة الفيديو)</h3>
          {motion ? <p className="s12-soft">آخر قياس: {ar(motion.percent)}٪{staleCount ? ` · ${ar(staleCount)} مشهدًا تغيّر بعده` : ""}</p> : null}
          {motion ? (
            <details className="sb-technical-metrics">
              <summary>نتائج الفحص</summary>
              {stills.length > 0 && <p>مشاهد لها سكون أكثر من ثانيتين: {stills.map((id) => sceneName(order, id)).join("، ")}</p>}
              <p>تحذيرات منطق الحركة: {ar(logicNeedsReview.length)} · غير قابلة للتقييم آليًا: {ar(logicNotAssessable.length)}</p>
              {info?.motionAuditNeedsReview ? <p>تقرير الحركة فيه ملاحظات تُراجع أثناء إنتاج الفيديو، وليست رفضًا للوحات.</p> : null}
            </details>
          ) : null}
          <div className="s12-row">
            <button className="btn" onClick={measure} disabled={job?.status === "running"}>
              {job?.status === "running" ? `يقيس الحركة والمنطق… ${ar(job.pct)}٪` : motion ? "إعادة الفحص" : "تشغيل الفحص"}
            </button>
            {motion ? <button className="btn" onClick={() => void downloadReport()} disabled={reportBusy}>{reportBusy ? "يُجهّز التقرير…" : "تنزيل تقرير الفحص"}</button> : null}
          </div>
        </section>

        <Reviews episodeId={episodeId} />
      </More>
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
    <section className="sb-previews s12-tool">
      <h3 className="s12-h">ملفات المراجعة</h3>
      <p className="s12-soft">أدلة للمراجعة، لا تعتمد شيئًا.</p>
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
  const [files, setFiles] = useState<EpisodePreview[]>([]);
  useEffect(() => {
    api.previews(episodeId).then((r) => setFiles(r.files)).catch(() => setFiles([]));
  }, [episodeId]);
  if (!files.length) return null;
  return (
    <section className="sb-previews s12-tool">
      <h3 className="s12-h">المعاينات</h3>
      <p className="s12-soft">آخر نسخة من كل فيديو، لا تُنشر.</p>
      <div className="sb-previews-grid">
        {files.map((f) => (
          <figure key={f.name} className="sb-preview">
            {f.source === "local" || f.source === "drive-mirror"
              ? <video src={api.previewUrl(episodeId, f.name)} controls preload="metadata" playsInline />
              : <div className="sb-preview-remote">
                  <p className="help">{f.source === "drive-link" ? "الفيديو على Google Drive ولم يتزامن مع هذا الجهاز بعد." : "الفيديو غير موجود على هذا الجهاز."}</p>
                  {f.driveUrl ? <a className="btn small" href={f.driveUrl} target="_blank" rel="noreferrer">افتحه على Google Drive</a> : null}
                </div>}
            <figcaption>
              <b>{f.title}</b>
              <span className="help">رفع رقم {ar(f.version)}{f.updatedAt ? ` · ${new Date(f.updatedAt).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })}` : ""}</span>
              {f.note ? <span className="help">{f.note}</span> : null}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
};
