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
  const fps = config.video.fps;
  const W = config.video.episode.width;
  const H = config.video.episode.height;
  const lang = langPack(plan.lang);

  useEffect(() => {
    const t = setTimeout(() => api.storyboard(episodeId).then(setInfo).catch((e) => setErr((e as Error).message)), info ? 1200 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId, plan]);

  // متابعة قياس الحركة حتى ينتهي
  useEffect(() => {
    if (!job || job.status !== "running") return;
    const t = setInterval(async () => {
      const all = await api.longJobs().catch(() => [] as LongJob[]);
      const j = all.find((x) => x.id === job.id);
      if (!j) return;
      setJob(j);
      if (j.status !== "running") api.storyboard(episodeId).then(setInfo).catch(() => {});
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
    setBusy(true);
    setErr("");
    try {
      setInfo(await api.setStoryboard(episodeId, action));
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

  const motionOf = (s: PlanScene) => {
    const m = motion?.scenes[s.id];
    return m ? { ...m, stale: Boolean(info?.motionStale?.includes(s.id)) } : null;
  };
  const stills = motion ? Object.entries(motion.scenes).filter(([, v]) => v.still > 2).map(([k]) => k) : [];
  const logicNeedsReview = motion ? Object.entries(motion.scenes).filter(([id, v]) => !info?.motionStale?.includes(id) && v.logic?.status === "needs-review").map(([id]) => id) : [];

  return (
    <div className="storyboard">
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
            {motion ? <span className={motion.percent >= 80 ? "ok" : "warn"}>الحركة {motion.percent}٪</span> : <span className="warn">الحركة لم تُقس</span>}
            {stills.length ? <span className="warn">سكون فوق ثانيتين: {stills.join("، ")}</span> : null}
            {motion && <span className={logicNeedsReview.length ? "warn" : "help"}>مراجعة العلاقة بالنص: {logicNeedsReview.length ? `${logicNeedsReview.length} مشهدًا يحتاج فحصًا` : "لا تحذيرات آلية"} (ليست اعتمادًا فنيًا)</span>}
          </p>
          {st?.changed.length ? <p className="help warn">تغيّر بعد الاعتماد: {st.changed.join("، ")}</p> : null}
          {err ? <p className="help warn">{err}</p> : null}
        </div>
        <div className="sb-actions">
          <button className="btn" onClick={measure} disabled={job?.status === "running"}>
            {job?.status === "running" ? `يقيس الحركة والمنطق… ${job.pct}%` : motion ? "أعد فحص الحركة والمنطق" : "افحص الحركة والمنطق"}
          </button>
          {st?.ok ? (
            <button className="btn" onClick={() => act("revoke")} disabled={busy}>
              اسحب الاعتماد
            </button>
          ) : (
            <button className="btn primary" onClick={() => act("approve")} disabled={busy || !st}>
              اعتمد الستوري بورد
            </button>
          )}
        </div>
      </div>

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
                      <>
                        <p className={`sb-motion${m.stale ? " stale" : m.still > 2 ? " warn" : ""}`}>
                          {m.stale ? "تغيّر بعد القياس" : `${m.pct}٪ حركة · أطول سكون ${m.still} ث`}
                        </p>
                        {!m.stale && m.logic ? (
                          <div className="sb-logic">
                            <strong>{m.logic.status === "needs-review" ? "مراجعة منطق الحركة مطلوبة" : "لا تحذيرات آلية عن ارتباط الأحداث بالنص"}</strong>
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
