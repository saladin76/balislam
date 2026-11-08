import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, type SceneProductionRead, type SceneOwnerAction } from "../api";
import { channelProductionProfile } from "../../../src/channel/productionRules";
import type { Plan } from "../../../src/plan/types";
import type { ChannelInfo } from "../../../src/channel/types";
import { planIssues } from "../../../src/plan/validate";
import type { EpisodeMedia } from "../../../src/plan/media";
import { inheritedToneLabel, tones, toneIds } from "../../../src/voice/tones";
import { MakeMaster } from "./MakeMaster";
import "./scene-production.css";
import "../shell/screens-s3.css";
import { useOwnerSession } from "../shell/ownerSession";
import { More } from "../shell/Screen";
import { PrepareAll } from "./PrepareAll";
import { clockAr, sceneName, seamName } from "./sceneNames";

type Props = {
  episodeId: string;
  channelId: string;
  onOpenScene: (id: string) => void;
  onOpenStoryboard: () => void;
  onOpenScript: () => void;
  onOpenPublish: () => void;
  /**
   * Given only on step ٥ («النشر»): making and approving the final file belong to step ٤, so before the
   * Master is approved this screen points there instead of repeating it (funnel audit 8 Nov, D36).
   */
  onOpenReview?: () => void;
  /** Step ٣ only: once every scene is approved, its one forward action is step ٤ (assembly and final). */
  onOpenFinal?: () => void;
  onUpdated?: () => void;
  /**
   * شاشة «المشاهد» (الخطوة ٣) فقط: الخطة لعرض نص كل مشهد وشريط التقدم، ومحرر المشهد الكامل
   * يُفتح خلف «تحرير المشهد» بدل أن يظهر دائمًا. بدونها تبقى اللوحة شريط القرار في الخطوتين ٤ و٥.
   */
  plan?: Plan;
  channel?: ChannelInfo;
  editor?: (sceneId: string, onSelect: (id: string) => void) => React.ReactNode;
  /** معاينة حية صامتة للمشهد حين لا توجد معاينة بالصوت والصورة بعد */
  livePreview?: (sceneId: string) => React.ReactNode;
  /** طلب فتح مشهد بعينه في المحرر (من الستوري بورد أو الصوت) */
  requestedSceneId?: string;
  onCloseEditor?: () => void;
  /** صوت المشهد الحالي: الملفات الحالية، ومفاتيح التوليد، وحفظ الخطة (لتغيير النبرة) */
  media?: EpisodeMedia;
  onMediaChange?: (media: EpisodeMedia) => void;
  onPlanSave?: (plan: Plan) => Promise<void>;
  hasVoiceKeys?: boolean;
  /** «جهّز كل المشاهد» without a voice key links to «الاتصالات والمفاتيح». */
  onOpenSettings?: () => void;
};

export type ProblemKind = "motion" | "tone";
/** ٧٢٫٤ ثانية ← «1:12» */
export const fmtTime = (sec: number) => {
  const t = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
/** ملاحظة التصحيح كما تُسجَّل: «[الحركة @0:12] …» أو «[النبرة @0:12] …» */
export const problemNote = (kind: ProblemKind, at: number, text: string) =>
  `[${kind === "motion" ? "الحركة" : "النبرة"} @${fmtTime(at)}] ${text.trim()}`.trim();

const ar = (n: number) => n.toLocaleString("ar-EG");
const noop = () => {};

/**
 * The only visible approval surface for scene-first Studio V2.
 * Never infer approval from a video existing or a checkbox in the browser.
 * All decisions are server-authenticated, bound to real bytes and serialized.
 */
export const SceneProductionPanel: React.FC<Props> = ({
  episodeId, channelId, onOpenScene, onOpenStoryboard, onOpenScript, onOpenPublish, onOpenReview, onOpenFinal, onUpdated,
  plan, channel, editor, livePreview, requestedSceneId, onCloseEditor, media, onMediaChange, onPlanSave, hasVoiceKeys, onOpenSettings,
}) => {
  const [data, setData] = useState<SceneProductionRead | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const owner = useOwnerSession();
  const sessionSecret = owner.secret;
  const [noteDraft, setNote] = useState("");
  const note = noteDraft;
  const [reviewed, setReviewed] = useState(false);
  // وصلات المشاهد التي فحصها المالك في النسخة المجمعة
  const [seams, setSeams] = useState<Record<string, boolean>>({});
  // شاشة المشاهد: المشهد المعروض (يُنظر إليه فقط)، والمشهد المفتوح في المحرر
  const [viewId, setViewId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(editor && requestedSceneId ? requestedSceneId : null);
  const stripRef = useRef<HTMLOListElement>(null);
  // قرار المشهد: مشكلة في لحظة بعينها (الحركة أو النبرة)، وخطوة تأكيد الاعتماد، وتوليد الصوت
  const videoRef = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<{ kind: ProblemKind; at: number } | null>(null);
  const [problemText, setProblemText] = useState("");
  const [toneChoice, setToneChoice] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sentNotes, setSentNotes] = useState<Record<string, string>>({});
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState("");
  // بعد «اعتمد» يُعرض المشهد التالي فورًا، وتبدأ مسودته الجاهزة بالتشغيل
  const [advanced, setAdvanced] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  // النسخة المجمعة: زر كل وصلة ينقل المشغّل إلى لحظتها
  const assemblyRef = useRef<HTMLVideoElement>(null);

  const refresh = async () => {
    const result = await api.sceneProduction(episodeId, channelId);
    setData(result);
    setError("");
  };
  useEffect(() => {
    let alive = true;
    setData(null);
    setError("");
    setNote("");
    setReviewed(false);
    setSeams({});
    setViewId(null);
    void api.sceneProduction(episodeId, channelId).then(
      value => { if (alive) setData(value); },
      cause => { if (alive) setError((cause as Error).message); },
    );
    return () => { alive = false; };
  }, [episodeId, channelId]);
  useEffect(() => {
    if (editor && requestedSceneId) setEditing(requestedSceneId);
  }, [requestedSceneId]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderCurrentScene = async (sceneId: string, sourceSha256: string) => {
    if (!sessionSecret.trim()) {
      setError("افتح جلسة المالك من أعلى الصفحة أولًا.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await api.renderSceneAv(episodeId, channelId, sessionSecret, sceneId, sourceSha256);
      await refresh();
      onUpdated?.();
      setReviewed(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  const assembleScenes = async () => {
    if (!sessionSecret.trim()) return setError("افتح جلسة المالك من أعلى الصفحة أولًا.");
    setPending(true);
    setError("");
    try {
      await api.assembleSceneAv(episodeId, channelId, sessionSecret);
      // One click: the file just built from the approved cuts is recorded for the 1× review at once,
      // so an older file at the same path (e.g. a legacy preview) is never what gets recorded.
      const fresh = await api.sceneProduction(episodeId, channelId);
      const built = fresh.candidates?.assemblySha256;
      if (built) await api.decideScene(episodeId, channelId, sessionSecret, { action: "assemble", expectedSha256: built });
      await refresh();
      onUpdated?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };

  const humanReviewFocus = channelProductionProfile({ id: channelId }).reviewFocus;
  const currentId = data?.progress.currentScene ?? null;
  const scene = data?.scenes.find(item => item.id === currentId);
  const candidate = currentId ? data?.candidates?.scenes[currentId] : null;
  const previewUrl = currentId && candidate ? api.previewUrl(episodeId, `scene-${currentId}-av.mp4`) : "";
  const allApproved = Boolean(data?.progress.canAssemble);

  const act = async (action: SceneOwnerAction["action"], expectedSha256: string, sceneId?: string, noteText?: string): Promise<boolean> => {
    const fail = (msg: string) => { setError(msg); return false; };
    const note = noteText ?? noteDraft;
    if (!data || pending || !sessionSecret.trim()) return fail("افتح جلسة المالك من أعلى الصفحة أولًا.");
    if (["approve-script", "approve-storyboard", "approve-scene", "approve-assembly", "approve-master", "grant-publish"].includes(action) && !reviewed)
      return fail("أكّد المراجعة البشرية الفعلية قبل الاعتماد.");
    const seamsChecked = action === "approve-assembly" ? (data.seams ?? []).filter((x) => seams[x]) : undefined;
    if (action === "approve-assembly" && seamsChecked!.length !== (data.seams ?? []).length)
      return fail("افحص كل وصلة بين مشهدين في النسخة المجمعة وعلّمها قبل اعتماد التجميع.");
    if (action === "correct-scene" && !note.trim())
      return fail("اكتب ملاحظة التصحيح قبل إعادة المشهد.");
    setPending(true);
    setError("");
    try {
      await api.decideScene(episodeId, channelId, sessionSecret, {
        action, expectedSha256, ...(sceneId ? { sceneId } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(reviewed ? { confirmedWatched: true } : {}),
        ...(seamsChecked ? { seamsChecked } : {}),
      });
      // Re-read the full model (candidates, drafts) before rendering: never render a partial response.
      const fresh = await api.sceneProduction(episodeId, channelId);
      setData(fresh);
      onUpdated?.();
      setNote("");
      setReviewed(false);
      setViewId(null);
      setProblem(null);
      setProblemText("");
      setConfirming(false);
      if (action === "correct-scene" && sceneId) setSentNotes((m) => ({ ...m, [sceneId]: note.trim() }));
      if (action === "approve-assembly") setSeams({});
      setAdvanced(action === "approve-scene");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setPending(false);
    }
  };

  /**
   * Decide on the current scene. A pre-rendered draft becomes reviewable once its scene is current:
   * the exact draft bytes the owner watched are submitted first (server checks the render proof), and
   * the decision is then taken on those same bytes. Nothing is approved without the owner's click.
   */
  const draftReady = Boolean(scene && candidate && scene.status !== "in_review" && scene.draft === "ready" && scene.readyForAv);
  const reviewCurrent = async (action: "approve-scene" | "correct-scene", noteText?: string): Promise<boolean> => {
    if (!scene || !currentId) return false;
    let sha = scene.status === "in_review" ? scene.previewSha256 : undefined;
    if (!sha) {
      if (!draftReady || !candidate) return false;
      if (!sessionSecret.trim()) { setError("افتح جلسة المالك من أعلى الصفحة أولًا."); return false; }
      setPending(true);
      setError("");
      try {
        const sub = await api.decideScene(episodeId, channelId, sessionSecret, {
          action: "submit-scene", expectedSha256: scene.sourceSha256, sceneId: currentId,
        });
        if (sub.scenes.find((x) => x.id === currentId)?.previewSha256 !== candidate) {
          setData(await api.sceneProduction(episodeId, channelId));
          setError("تغيّرت المسودة منذ عرضها؛ شاهدها من جديد.");
          return false;
        }
        sha = candidate;
      } catch (e) {
        setError((e as Error).message);
        return false;
      } finally {
        setPending(false);
      }
    }
    return act(action, sha, currentId, noteText);
  };

  // القرار الحالي في سطر واحد: يظهر فيه ما يُشاهَد، وما يُؤكَّد، والزر
  const confirm = (label: string) => owner.open ? (
    <label className="sp-confirm"><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} /> {label}</label>
  ) : <span className="sp-hint">افتح جلسة المالك من أعلى الصفحة لتعتمد.</span>;
  const seamsAll = data?.seams ?? [];
  const seamsDone = seamsAll.filter((x) => seams[x]).length;
  const criteria = (
    <details className="sp-criteria">
      <summary>معايير مراجعة هذه القناة</summary>
      <ul>{humanReviewFocus.map((item) => <li key={item}>{item}</li>)}</ul>
    </details>
  );

  // ── شاشة «المشاهد»: قرار المشهد الحالي، وشريط التقدم، والمحرر خلف «تحرير المشهد» ──
  const planScenes = useMemo(() => plan ? plan.chapters.flatMap((c) => c.scenes.map((s) => ({ scene: s, chapter: c }))) : [], [plan]);
  const issues = useMemo(() => plan && channel ? planIssues(plan, channel) : [], [plan, channel]);
  const sceneMode = Boolean(editor && plan);
  const order = sceneMode ? (data?.scenes.length ? data.scenes.map((s) => s.id) : planScenes.map((x) => x.scene.id)) : [];
  const shownId = viewId && order.includes(viewId) ? viewId : currentId && order.includes(currentId) ? currentId : order[0] ?? null;
  useEffect(() => {
    // الشريط يتمرر أفقيًا وحده حتى يظهر المشهد الحالي، دون تحريك الصفحة
    const strip = stripRef.current;
    const now = strip?.querySelector<HTMLElement>("[data-now]");
    if (!strip || !now) return;
    const s = strip.getBoundingClientRect(), n = now.getBoundingClientRect();
    strip.scrollLeft += (n.left + n.width / 2) - (s.left + s.width / 2);
  }, [currentId, sceneMode, order.length]);

  // صوت المشهد: لا تعليق، أو بلا ملف، أو ملف لنص قديم، أو مطابق
  const voiceOf = (id: string): VoiceState => {
    const narr = planScenes.find((x) => x.scene.id === id)?.scene.narration.trim() ?? "";
    if (!narr) return "none";
    const clip = media?.voice[id];
    if (!clip) return "missing";
    return clip.text === narr ? "ok" : "stale";
  };
  /** توليد صوت هذا المشهد وحده بنقرة المالك (الواجهة نفسها في «الصوت» والمحرر). */
  const generateVoice = async (sceneId: string, force: boolean): Promise<boolean> => {
    setVoiceBusy(true);
    setVoiceMsg("");
    try {
      const r = await api.voice(episodeId, { scenes: [sceneId], force });
      onMediaChange?.(r.media);
      setVoiceMsg("وُلّد الصوت.");
      await refresh().catch(() => {});
      onUpdated?.();
      return true;
    } catch (e) {
      setVoiceMsg((e as Error).message);
      return false;
    } finally {
      setVoiceBusy(false);
    }
  };
  /**
   * «النبرة غير مناسبة»: يُسجَّل التصحيح أولًا (والمشهد ما زال قيد المراجعة بملفه نفسه)،
   * ثم تُحفظ النبرة في الخطة، ثم يُعاد توليد صوت هذا المشهد وحده.
   */
  const submitTone = async (sceneId: string, at: number) => {
    if (!plan) return;
    const name = toneChoice && toneChoice in tones ? tones[toneChoice as keyof typeof tones].nameAr : inheritedToneLabel(plan.tone);
    const text = problemText.trim() ? `${name} — ${problemText.trim()}` : name;
    const ok = await reviewCurrent("correct-scene", problemNote("tone", at, text));
    if (!ok) return;
    const next: Plan = {
      ...plan,
      chapters: plan.chapters.map((c) => ({ ...c, scenes: c.scenes.map((s) => (s.id === sceneId ? { ...s, tone: toneChoice || undefined, edited: true } : s)) })),
    };
    try {
      await onPlanSave?.(next);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    await generateVoice(sceneId, true);
  };

  if (sceneMode && editing) {
    const close = () => { setViewId(editing); setEditing(null); onCloseEditor?.(); };
    const idx = order.indexOf(editing);
    return (
      <>
        <div className="s3-editbar">
          <button type="button" className="btn ghost" onClick={close}>→ العودة إلى المراجعة</button>
          <span title={editing}>تحرير المشهد {idx >= 0 ? ar(idx + 1) : ""}</span>
        </div>
        {editor!(editing, (id) => setEditing(id))}
      </>
    );
  }

  // Item 16: after the last approval step ٣ keeps its strip and player, so any approved scene can be rewatched.
  const allDoneHere = Boolean(sceneMode && onOpenFinal && data && data.script.approved && data.storyboard.approved && !currentId);
  if (sceneMode && shownId && (!data || !data.script.approved || !data.storyboard.approved || (currentId && scene) || allDoneHere)) {
    const hit = planScenes.find((x) => x.scene.id === shownId);
    const shownIdx = order.indexOf(shownId);
    const shownServer = data?.scenes.find((s) => s.id === shownId);
    const gated = Boolean(data && (!data.script.approved || !data.storyboard.approved));
    const isCurrent = Boolean(data && !gated && shownId === currentId && scene);
    const shownVideo = data?.candidates?.scenes[shownId] ? api.previewUrl(episodeId, `scene-${shownId}-av.mp4`) : "";
    const blocking = issues.filter((i) => i.level === "error").length;
    const approvedCount = data?.progress.approvedScenes ?? 0;
    const chapterStarts = new Set(plan!.chapters.map((c) => c.scenes[0]?.id).filter(Boolean));
    const openIssues = () => {
      const d = moreRef.current?.querySelector("details");
      if (d) { d.open = true; d.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
    };
    const statusOf = (id: string) => {
      const s = data?.scenes.find((x) => x.id === id);
      if (s?.approved) return "done";
      if (id === currentId) return "now";
      return "later";
    };
    const status = gated ? "later" : statusOf(shownId);
    // «جهّز كل المشاهد» في شريط الأفعال نفسه، لا في الرأس
    const prepare = data && !gated && !data.progress.canAssemble ? (
      <PrepareAll episodeId={episodeId} channelId={channelId} prepared={data.prepared} onOpenSettings={onOpenSettings} order={order}
        onChanged={() => {
          void refresh().catch(() => {});
          // الصوت المولَّد في الخلفية يظهر في أزرار المشهد دون إعادة فتح الحلقة
          void api.episode(episodeId, channelId).then((d) => onMediaChange?.(d.media), () => {});
          onUpdated?.();
        }} />
    ) : undefined;
    // الأفعال ظاهرة دائمًا؛ وحين لا تتاح بعد، سبب واحد حقيقي من حالة الحلقة ورابط إلى الخطوة الناقصة
    const lock: ActionLock | undefined = !data
      ? { reason: error ? "تعذّر تحميل حالة الحلقة؛ أعد فتحها." : "جارٍ تحميل حالة الحلقة…" }
      : !data.script.approved
        ? { reason: "تُفتح بعد اعتماد السكريبت والستوري بورد — اعتمدهما من الخطوتين ١ و٢.", action: { label: "اعتمد السكريبت (الخطوة ١)", onClick: onOpenScript } }
        : !data.storyboard.approved
          ? { reason: "تُفتح بعد اعتماد الستوري بورد — اعتمده من الخطوة ٢.", action: { label: "اعتمد الستوري بورد (الخطوة ٢)", onClick: onOpenStoryboard } }
          : !isCurrent && currentId
            ? { reason: status === "done" ? "اعتُمد هذا المشهد؛ القرار الآن على المشهد الحالي." : "يُعتمد بعد ما قبله، بالترتيب.", action: { label: `إلى المشهد الحالي (${ar(order.indexOf(currentId) + 1)})`, onClick: () => setViewId(null) } }
            : !isCurrent
              ? { reason: "لا مشهد ينتظر قرارًا الآن." }
              : undefined;
    return (
      <section className="stage s3" aria-label="المشهد الحالي في إنتاج الحلقة">
        <header className="s3-head">
          <div className="s3-title">
            <h2>المشهد {shownIdx >= 0 ? ar(shownIdx + 1) : ""} <span className="s3-of">من {ar(order.length)}</span></h2>
            {hit ? <span className="s3-sub">الفصل {ar(hit.chapter.number)} · {hit.chapter.title}</span> : null}
          </div>
          <div className="s3-headact">
            <button type="button" className="btn" onClick={() => setEditing(shownId)}>تحرير المشهد</button>
          </div>
        </header>

        <ol className="s3-strip" ref={stripRef} aria-label={`تقدم المشاهد: ${ar(approvedCount)} معتمد من ${ar(order.length)}`}>
          {order.map((id, i) => {
            const st = statusOf(id);
            return (
              <li key={id} className={chapterStarts.has(id) && i > 0 ? "s3-ch" : undefined}>
                <button type="button" className={`s3-dot is-${st}${id === shownId ? " is-shown" : ""}`} data-now={st === "now" ? "" : undefined}
                  aria-current={id === shownId ? "true" : undefined} onClick={() => setViewId(id)}
                  title={`${sceneName(order, id)} · ${st === "done" ? "معتمد" : st === "now" ? "الحالي" : "لاحقًا"}`}>
                  {ar(i + 1)}
                </button>
              </li>
            );
          })}
        </ol>

        {error ? <p className="scene-first-error" role="alert">{error}</p> : null}

        <div className="s3-grid">
          <div className="s3-media">
            {isCurrent && previewUrl ? (
              <video key={`${currentId}:${candidate}`} ref={videoRef} className="scene-first-video" controls preload="metadata" autoPlay={advanced} src={previewUrl} aria-label={`${sceneName(order, currentId)} بالصوت والصورة`} />
            ) : !isCurrent && shownVideo ? (
              <video key={shownId} className="scene-first-video" controls preload="metadata" src={shownVideo} aria-label={`${sceneName(order, shownId)} بالصوت والصورة`} />
            ) : livePreview ? (
              <div className="s3-live">{livePreview(shownId)}<span className="s3-tag">معاينة صامتة</span></div>
            ) : (
              <div className="sp-empty">لم يُنتج هذا المشهد بعد.</div>
            )}
            {allDoneHere ? (
              <div className="sp-row s3-alldone" role="group" aria-label="المشاهد معتمدة">
                <div>
                  <h3>كل المشاهد معتمدة</h3>
                  <p className="sp-hint">{(data!.progress.recitationPending?.length ?? 0) > 0
                    ? `${ar(data!.progress.recitationPending!.length)} مشهد آية معتمد «مشروطًا بالتلاوة»؛ التلاوات والمعاينة قبل النهائية في الخطوة ٤.`
                    : "اختر أي مشهد من الشريط لتعيد مشاهدته. التجميع والنسخة النهائية في الخطوة ٤."}</p>
                </div>
                <div className="sp-actions"><button className="btn primary" type="button" onClick={onOpenFinal}>إلى النسخة النهائية</button></div>
              </div>
            ) : isCurrent && currentId && scene ? (
              <SceneDecisionActions
                prepare={prepare}
                onOpenSettings={onOpenSettings}
                stage={(scene.status === "in_review" && scene.previewSha256) || draftReady ? "review" : candidate && scene.readyForAv && !scene.correction ? "submit" : "render"}
                voice={voiceOf(currentId)}
                voiceBusy={voiceBusy}
                voiceMsg={voiceMsg}
                canVoice={Boolean(hasVoiceKeys)}
                readyForAv={scene.readyForAv}
                ownerOpen={owner.open}
                pending={pending}
                problem={problem}
                problemText={problemText}
                tone={toneChoice}
                confirming={confirming}
                reviewed={reviewed}
                onVoice={() => void generateVoice(currentId, voiceOf(currentId) === "ok")}
                onProblem={(kind) => {
                  // يوقف المعاينة ويلتقط لحظة المشكلة
                  const v = videoRef.current;
                  v?.pause();
                  setConfirming(false);
                  setProblemText("");
                  setToneChoice(planScenes.find((x) => x.scene.id === currentId)?.scene.tone ?? "");
                  setProblem(problem?.kind === kind ? null : { kind, at: v?.currentTime ?? 0 });
                }}
                onProblemText={setProblemText}
                onTone={setToneChoice}
                episodeTone={plan?.tone}
                onCancelProblem={() => setProblem(null)}
                onSubmitProblem={() => {
                  if (!problem || !(scene.previewSha256 || draftReady)) return;
                  if (problem.kind === "motion") {
                    void reviewCurrent("correct-scene", problemNote("motion", problem.at, problemText));
                    return;
                  }
                  void submitTone(currentId, problem.at);
                }}
                onConfirm={(v) => setReviewed(v)}
                onApprove={() => {
                  if (!reviewed) { setProblem(null); setConfirming(true); return; }
                  void reviewCurrent("approve-scene");
                }}
                onSubmitScene={() => void act("submit-scene", scene.sourceSha256, currentId)}
                onRender={() => void renderCurrentScene(currentId, scene.sourceSha256)}
              />
            ) : (
              <SceneDecisionActions
                locked={lock ?? { reason: "لا مشهد ينتظر قرارًا الآن." }}
                stage="render"
                voice={voiceOf(shownId)}
                voiceBusy={false}
                canVoice={Boolean(hasVoiceKeys)}
                readyForAv={false}
                ownerOpen={owner.open}
                pending={pending}
                problem={null}
                problemText=""
                tone=""
                confirming={false}
                reviewed={false}
                onOpenSettings={onOpenSettings}
                onVoice={noop} onProblem={noop} onProblemText={noop} onTone={noop} onCancelProblem={noop}
                onSubmitProblem={noop} onConfirm={noop} onApprove={noop} onSubmitScene={noop} onRender={noop}
              />
            )}
          </div>
          <div className="s3-side">
            <span className={`s3-state is-${status}`}>{status === "done" ? (shownServer?.conditional ? "معتمد مشروطًا بالتلاوة" : "معتمد") : status === "now" ? (scene?.status === "in_review" || (isCurrent && draftReady) ? "بانتظار قرارك" : scene?.status === "needs_revision" ? (scene.correction ? "بانتظار التعديل" : "عُدّل؛ يحتاج إنتاجًا جديدًا") : "المشهد الحالي") : gated ? "قبل الإنتاج" : "لاحقًا"}</span>
            <p className="s3-narr">{hit?.scene.narration || "بلا تعليق صوتي"}</p>

            {isCurrent && scene?.status === "needs_revision" && (sentNotes[currentId!] || scene.correction?.note) ? (
              <p className="s3-sent"><b>{draftReady ? "ملاحظتك على النسخة السابقة:" : "ملاحظتك (بانتظار التعديل ثم إعادة الإنتاج):"}</b> {sentNotes[currentId!] || scene.correction?.note}</p>
            ) : null}
            {isCurrent && scene && !scene.readyForAv ? <p className="sp-hint">ينقصه صوت الراوي.</p> : null}
            {shownServer?.recitationPending ? (
              <p className="sp-hint" role="note">التلاوة تُضاف لاحقًا: مسودة هذه الآية صامتة مكان التلاوة، واعتمادها الآن «مشروط بالتلاوة» يكمل الترتيب؛ وحين ترفع التلاوة في الخطوة ٤ يُفتح هذا المشهد وحده لمراجعة سريعة. التجميع والنسخة النهائية لا يُفتحان قبلها.</p>
            ) : null}
            {isCurrent && (scene?.status === "in_review" || draftReady) ? criteria : null}
          </div>
        </div>

        {issues.length ? (
          <button type="button" className={`s3-issues${blocking ? " is-block" : ""}`} onClick={openIssues}>
            {blocking ? `${ar(blocking)} ملاحظات تمنع النسخة النهائية` : `${ar(issues.length)} تنبيهات قبل النسخة النهائية`} · عرضها
          </button>
        ) : null}

        <div ref={moreRef}>
          <More>
            {issues.length ? (
              <div className="s3-more-group">
                <h3>قبل النسخة النهائية</h3>
                <ul className="s3-issue-list">
                  {issues.map((issue, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => setEditing(issue.sceneId)}>
                        <span className={`s3-lv is-${issue.level}`}>{issue.level === "error" ? "يمنع" : "تنبيه"}</span>
                        <span className="s3-id" title={issue.sceneId}>{sceneName(order, issue.sceneId)}</span>
                        <span>{issue.message}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {!(isCurrent && (scene?.status === "in_review" || draftReady)) ? <div className="s3-more-group">{criteria}</div> : null}
            <p className="hint">التحرير الكامل (القالب، الخلفية، النبرة، التصدير) في «تحرير المشهد».</p>
          </More>
        </div>
      </section>
    );
  }

  // السكريبت والستوري بورد يُعتمدان من عمود الخطوات أعلى الصفحة؛ هذه اللوحة لما بعدهما
  if (data && (!data.script.approved || !data.storyboard.approved)) return null;
  // Step ٣ after its last scene is handled above (allDoneHere): strip, rewatch, one forward action.
  return (
    <section className="scene-first-panel sp" aria-label="القرار الحالي في إنتاج الحلقة">
      {!data && !error ? <p role="status">جارٍ تحميل حالة الحلقة…</p> : null}
      {error ? <p className="scene-first-error" role="alert">{error}</p> : null}
      {!data ? null : currentId && scene ? (
        <div className="sp-grid">
          <div className="sp-media">
            {previewUrl ? (
              <video className="scene-first-video" controls preload="metadata" src={previewUrl} aria-label={`${sceneName(data.scenes.map((x) => x.id), currentId)} بالصوت والصورة`} />
            ) : (
              <div className="sp-empty">{scene.readyForAv ? "لم يُنتج هذا المشهد بعد." : "ينقص هذا المشهد صوت الراوي."}</div>
            )}
          </div>
          <div className="sp-side">
            <p className="sp-kicker">{sceneName(data.scenes.map((x) => x.id), currentId)}، {ar(data.progress.approvedScenes + 1)} من {ar(data.progress.totalScenes)}</p>
            <div className="scene-first-meter" role="progressbar" aria-valuenow={data.progress.approvedScenes} aria-valuemin={0} aria-valuemax={data.progress.totalScenes}>
              <span style={{ width: `${100 * data.progress.approvedScenes / Math.max(1, data.progress.totalScenes)}%` }} />
            </div>
            {scene.status === "in_review" && scene.previewSha256 ? (
              <>
                <h3>شاهده بالصوت والصورة، ثم قرر</h3>
                {confirm("شاهدته كاملًا بصوته")}
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة التعديل، مثل: الثانية 00:08 — الكاميرا سريعة" aria-label="ملاحظة التعديل" />
                <div className="sp-actions">
                  <button className="btn primary" disabled={pending || !reviewed} onClick={() => void act("approve-scene", scene.previewSha256!, currentId)}>اعتماد المشهد</button>
                  <button className="btn" disabled={pending || !note.trim()} onClick={() => void act("correct-scene", scene.previewSha256!, currentId)}>طلب تعديل</button>
                </div>
              </>
            ) : candidate && scene.readyForAv ? (
              <>
                <h3>المعاينة جاهزة</h3>
                <p className="sp-hint">أرسلها للمراجعة لتعتمدها، أو أعد إنتاجها بعد تعديل المشهد.</p>
                <div className="sp-actions">
                  <button className="btn primary" disabled={pending} onClick={() => void act("submit-scene", scene.sourceSha256, currentId)}>إرسال للمراجعة</button>
                  <button className="btn" disabled={pending} onClick={() => void renderCurrentScene(currentId, scene.sourceSha256)}>إعادة الإنتاج</button>
                </div>
              </>
            ) : (
              <>
                <h3>{scene.status === "needs_revision" ? "عُدّل المشهد؛ أنتجه من جديد" : "أنتج المشهد بالصوت والصورة"}</h3>
                <div className="sp-actions">
                  <button className="btn primary" disabled={pending || !scene.readyForAv || !owner.open} onClick={() => void renderCurrentScene(currentId, scene.sourceSha256)}>
                    {pending ? "جارٍ الإنتاج…" : "إنتاج المشهد"}
                  </button>
                  <button className="btn" type="button" onClick={() => onOpenScene(currentId)}>أدوات المشهد</button>
                </div>
                {!owner.open ? <span className="sp-hint">افتح جلسة المالك من أعلى الصفحة لتُنتج.</span> : null}
              </>
            )}
          </div>
        </div>
      ) : (data.progress.recitationPending?.length ?? 0) > 0 ? (
        <div className="sp-row">
          <div>
            <h3>كل المشاهد معتمدة، وبانتظار التلاوات</h3>
            <p className="sp-hint">{ar(data.progress.recitationPending!.length)} مشهد آية معتمد «مشروطًا بالتلاوة». شاهد «المعاينة قبل النهائية» ثم ارفع التلاوات أدناه؛ بعد اعتماد كل تلاوة يُفتح مشهدها وحده لمراجعة سريعة. التجميع والنسخة النهائية والنشر لا تُفتح قبل ذلك.</p>
          </div>
        </div>
      ) : allApproved && !data.assembly ? (
        <div className="sp-row">
          <div><h3>كل المشاهد معتمدة</h3><p className="sp-hint">تُدمج ملفات المشاهد المعتمدة نفسها بالترتيب في نسخة واحدة للمشاهدة الكاملة.</p></div>
          <div className="sp-actions">
            <button className="btn primary" disabled={pending || !owner.open} onClick={() => void assembleScenes()}>{pending ? "جارٍ الدمج…" : "دمج المشاهد للمراجعة"}</button>
            {sceneMode && order[0] ? <button type="button" className="btn" onClick={() => setEditing(order[0]!)}>تحرير المشهد</button> : null}
          </div>
        </div>
      ) : data.assembly && !data.assembly.approved ? (
        <div className="sp-grid">
          <div className="sp-media">
            <video ref={assemblyRef} className="scene-first-video" controls preload="metadata" src={api.previewUrl(episodeId, "episode.mp4")} aria-label="الحلقة المجمعة" />
          </div>
          <div className="sp-side">
            <h3>شاهد الحلقة كاملة بسرعة 1×، وافحص كل وصلة</h3>
            <fieldset className="scene-first-seams">
              <legend>الوصلات: {seamsDone} من {seamsAll.length}</legend>
              {seamsAll.map((seam) => (
                <SeamRow key={seam} label={seamName(data.scenes.map((x) => x.id), seam)} at={data.seamTimes?.[seam]}
                  checked={Boolean(seams[seam])} onCheck={(v) => setSeams({ ...seams, [seam]: v })}
                  onJump={(t) => {
                    // يبدأ قبل الوصلة بثانيتين ليُسمع آخر المشهد وأول التالي
                    const v = assemblyRef.current;
                    if (!v) return;
                    v.currentTime = Math.max(0, t - 2);
                    void v.play().catch(() => {});
                  }} />
              ))}
            </fieldset>
            {confirm("شاهدت الحلقة كاملة 1×")}
            <div className="sp-actions">
              <button className="btn primary" disabled={pending || !reviewed || seamsDone !== seamsAll.length} onClick={() => void act("approve-assembly", data.assembly!.sha256)}>اعتماد التجميع</button>
            </div>
          </div>
        </div>
      ) : data.assembly && !data.master && onOpenReview ? (
        <div className="sp-row">
          <div><h3>النسخة النهائية لم تُعتمد بعد</h3><p className="sp-hint">تُصنع النسخة النهائية وتُشاهد وتُعتمد في الخطوة ٤؛ وبعدها يُمنح إذن النشر هنا.</p></div>
          <div className="sp-actions"><button className="btn primary" type="button" onClick={onOpenReview}>إلى الخطوة ٤</button></div>
        </div>
      ) : data.assembly && !data.master ? (
        <div className="sp-row">
          <div>
            <h3>{data.candidates.masterSha256 ? "شاهد النسخة النهائية كاملة واعتمد هذا الملف" : "اصنع النسخة النهائية 4K"}</h3>
            <p className="sp-hint">{data.candidates.masterSha256 ? "الاعتماد لهذا الملف بعينه؛ أي ملف جديد يحتاج اعتمادًا جديدًا." : "تُصنع بدقة 4K بالصوت من المشاهد المعتمدة نفسها، ثم تشاهدها هنا وتعتمدها."}</p>
          </div>
          <div className="sp-actions">
            {data.candidates.masterSha256 ? (<>
              {confirm("شاهدتها كاملة 1×")}
              <button className="btn primary" disabled={pending || !reviewed} onClick={() => void act("approve-master", data.candidates.masterSha256!)}>اعتماد النسخة النهائية</button>
            </>) : <MakeMaster episodeId={episodeId} hasVoiceKeys={hasVoiceKeys} onDone={() => { void refresh(); onUpdated?.(); }} />}
          </div>
        </div>
      ) : data.master && !data.master.publishAllowed && !onOpenReview ? (
        <div className="sp-row">
          <div><h3>النسخة النهائية معتمدة</h3><p className="sp-hint">الخطوة التالية: إذن النشر لهذا الملف بعينه في «النشر» (الخطوة ٥).</p></div>
          <div className="sp-actions"><button className="btn primary" type="button" onClick={onOpenPublish}>إلى النشر</button></div>
        </div>
      ) : data.master && !data.master.publishAllowed ? (
        <div className="sp-row">
          <div><h3>النسخة النهائية معتمدة</h3><p className="sp-hint">الشورتس والريلز تُصنع منها الآن. النشر قرار منفصل لهذا الملف.</p></div>
          <div className="sp-actions">
            {confirm("أوافق على نشر هذا الملف")}
            <button className="btn primary" disabled={pending || !reviewed} onClick={() => void act("grant-publish", data.master!.sha256)}>إذن النشر</button>
          </div>
        </div>
      ) : (
        <div className="sp-row"><div><h3>مأذون بنشر هذه النسخة</h3><p className="sp-hint">أي تعديل في أي مشهد يلغي الإذن تلقائيًا.</p></div></div>
      )}
      {data ? criteria : null}
    </section>
  );
};

type VoiceState = "none" | "missing" | "stale" | "ok";

/** وصلة في النسخة المجمعة: اسمها بالأرقام، وزر ينقل المشغّل إليها (لا يعلّمها مفحوصة؛ العلامة للمالك). */
export const SeamRow: React.FC<{ label: string; at?: number; checked: boolean; onCheck: (v: boolean) => void; onJump: (t: number) => void }> = ({ label, at, checked, onCheck, onJump }) => (
  <div className="sp-seam">
    <label><input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} /> {label}</label>
    {at != null ? <button type="button" className="prep-link" onClick={() => onJump(at)} title="يشغّل من قبل الوصلة بثانيتين">عند {clockAr(at)}</button> : null}
  </div>
);

/** سبب تعطّل الشريط كله، والخطوة الأولى غير المكتملة (الزر الممتلئ الوحيد حينها). */
export type ActionLock = { reason: string; action?: { label: string; onClick: () => void } };

/**
 * أفعال المشهد تحت المعاينة، ظاهرة دائمًا بالترتيب نفسه:
 * «جهّز كل المشاهد»، «توليد الصوت»، «الحركة غير مناسبة»، «النبرة غير مناسبة»، «اعتمد».
 * ما لا يتاح بعد يبقى ظاهرًا معطّلًا، وسببه في سطر واحد تحت الشريط (مع رابط إلى الخطوة الناقصة).
 * زر ممتلئ واحد فقط: «اعتمد» حين يُتاح، وإلا الفعل التالي (إنتاج المشهد، إرساله، أو الخطوة الناقصة).
 * لا يغيّر الشريط أي بوابة: كل زر يمر بالمسار القائم نفسه، والخادم يرفض ما لا يحق.
 */
export const SceneDecisionActions: React.FC<{
  stage: "review" | "submit" | "render";
  voice: VoiceState;
  voiceBusy: boolean;
  voiceMsg?: string;
  canVoice: boolean;
  readyForAv: boolean;
  ownerOpen: boolean;
  pending: boolean;
  problem: { kind: ProblemKind; at: number } | null;
  problemText: string;
  tone: string;
  confirming: boolean;
  reviewed: boolean;
  /** «جهّز كل المشاهد» الفعلي (PrepareAll) حين يُتاح؛ وإلا يظهر زره معطّلًا */
  prepare?: React.ReactNode;
  /** الشريط كله معطّل لسبب واحد (قبل اعتماد السكريبت والستوري بورد، أو مشهد غير الحالي) */
  locked?: ActionLock;
  onOpenSettings?: () => void;
  onVoice: () => void;
  onProblem: (kind: ProblemKind) => void;
  onProblemText: (text: string) => void;
  onTone: (tone: string) => void;
  /** نبرة الحلقة الموروثة (تُسمّى في خيار «مثل الحلقة») */
  episodeTone?: string;
  onCancelProblem: () => void;
  onSubmitProblem: () => void;
  onConfirm: (reviewed: boolean) => void;
  onApprove: () => void;
  onSubmitScene: () => void;
  onRender: () => void;
}> = (p) => {
  const needVoice = p.voice === "missing" || p.voice === "stale";
  const at = p.problem ? fmtTime(p.problem.at) : "";
  const problemReady = p.problem?.kind === "motion" ? Boolean(p.problemText.trim()) : Boolean(p.problem);
  const locked = p.locked;
  const review = !locked && p.stage === "review";
  const voiceLabel = p.voiceBusy ? "جارٍ توليد الصوت…" : p.voice === "ok" ? "إعادة توليد الصوت" : "توليد الصوت";
  const voiceOff = Boolean(locked) || p.voice === "none" || p.voiceBusy || p.pending || !p.canVoice;
  // سطر السبب: سبب واحد واضح لما هو معطّل، بالأولوية
  const reasons: React.ReactNode[] = [];
  if (locked) reasons.push(locked.reason);
  else if (!review) reasons.push(p.stage === "submit"
    ? "«الحركة غير مناسبة» و«النبرة غير مناسبة» و«اعتمد» تُفتح بعد إرسال المسودة للمراجعة."
    : "«الحركة غير مناسبة» و«النبرة غير مناسبة» و«اعتمد» تُفتح بعد إنتاج معاينة المشهد بالصوت والصورة.");
  if (!p.ownerOpen) reasons.push("افتح جلسة المالك من أعلى الصفحة لتقرر.");
  if (!p.canVoice && p.voice !== "none") reasons.push(
    p.onOpenSettings ? <>أضف مفتاح الصوت من <button type="button" className="prep-link" onClick={p.onOpenSettings}>الإعدادات</button>.</> : "أضف مفتاح الصوت من الإعدادات.",
  );
  if (p.voice === "none" && !locked) reasons.push("لا تعليق صوتي في هذا المشهد، فلا صوت يُولَّد.");
  return (
    <div className="s3-act">
      <div className="s3-actbar" role="group" aria-label="قرار المشهد" data-locked={locked ? "" : undefined}>
        {p.prepare && !locked ? p.prepare : (
          <button type="button" className="btn ghost" disabled>جهّز كل المشاهد</button>
        )}
        <button type="button" className={`btn ${needVoice && !locked ? "s3-cta" : "ghost"}`} disabled={voiceOff}
          title={p.canVoice ? "" : "يتطلب مفتاح الصوت من «الإعدادات»"} onClick={p.onVoice}>
          {voiceLabel}
        </button>
        {!locked && p.stage === "submit" ? (
          <>
            <button type="button" className="btn ghost" disabled={p.pending} onClick={p.onRender}>إعادة الإنتاج</button>
            <button type="button" className="btn primary" disabled={p.pending} onClick={p.onSubmitScene}>إرسال للمراجعة</button>
          </>
        ) : !locked && p.stage === "render" ? (
          <button type="button" className="btn primary" disabled={p.pending || !p.readyForAv || !p.ownerOpen || p.voiceBusy} onClick={p.onRender}>
            {p.pending ? "جارٍ الإنتاج…" : "إنتاج المشهد"}
          </button>
        ) : null}
        <button type="button" className="btn ghost" aria-pressed={p.problem?.kind === "motion"} disabled={!review || p.pending || !p.ownerOpen} onClick={() => p.onProblem("motion")}>الحركة غير مناسبة</button>
        <button type="button" className="btn ghost" aria-pressed={p.problem?.kind === "tone"} disabled={!review || p.pending || !p.ownerOpen} onClick={() => p.onProblem("tone")}>النبرة غير مناسبة</button>
        <button type="button" className={`btn ${review ? "primary" : "ghost"} s3-approve`} disabled={!review || p.pending || !p.ownerOpen || (p.confirming && !p.reviewed)} onClick={p.onApprove}>
          {review && p.pending ? "جارٍ…" : "اعتمد"}
        </button>
      </div>
      {reasons.length ? (
        <div className="s3-why" role="note">
          {reasons.map((r, i) => <p key={i} className="sp-hint">{r}</p>)}
          {locked?.action ? <button type="button" className="btn primary s3-why-go" onClick={locked.action.onClick}>{locked.action.label}</button> : null}
        </div>
      ) : null}
      {p.voiceMsg ? <p className="sp-hint" role="status">{p.voiceMsg}</p> : null}
      {p.confirming && review ? (
        <label className="sp-confirm s3-confirm"><input type="checkbox" checked={p.reviewed} onChange={(e) => p.onConfirm(e.target.checked)} autoFocus /> شاهدته بالصوت كاملًا</label>
      ) : null}
      {p.problem && review ? (
        <form className="s3-problem" onSubmit={(e) => { e.preventDefault(); if (problemReady) p.onSubmitProblem(); }}>
          <span className="s3-problem-at">{p.problem.kind === "motion" ? "الحركة" : "النبرة"} عند <b dir="ltr">{at}</b></span>
          {p.problem.kind === "tone" ? (
            <select aria-label="النبرة المناسبة" value={p.tone} onChange={(e) => p.onTone(e.target.value)}>
              <option value="">{inheritedToneLabel(p.episodeTone)}</option>
              {toneIds.map((t) => <option key={t} value={t}>{tones[t].nameAr}</option>)}
            </select>
          ) : null}
          <textarea rows={2} value={p.problemText} onChange={(e) => p.onProblemText(e.target.value)} placeholder={p.problem.kind === "motion" ? "ما المشكلة؟" : "ما المشكلة؟ (اختياري)"} aria-label="ما المشكلة؟" autoFocus />
          <div className="sp-actions">
            <button type="submit" className="btn" disabled={p.pending || !problemReady}>{p.problem.kind === "tone" ? "أرسل وأعد توليد الصوت" : "أرسل الملاحظة"}</button>
            <button type="button" className="btn ghost" onClick={p.onCancelProblem}>إلغاء</button>
          </div>
        </form>
      ) : null}
    </div>
  );
};
