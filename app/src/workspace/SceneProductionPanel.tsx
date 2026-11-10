import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, type SceneProductionRead, type SceneOwnerAction, type ScenePrepareRead } from "../api";
import { channelProductionProfile } from "../../../src/channel/productionRules";
import type { Plan } from "../../../src/plan/types";
import type { ChannelInfo } from "../../../src/channel/types";
import { planIssues } from "../../../src/plan/validate";
import type { EpisodeMedia } from "../../../src/plan/media";
import { inheritedToneLabel, tones, toneIds } from "../../../src/voice/tones";
import { toneMapKeepLabel, toneMapNote } from "./toneMapCopy";
import { MakeMaster } from "./MakeMaster";
import "./scene-production.css";
import "../shell/screens-s3.css";
import { More } from "../shell/Screen";
import { PrepareAll } from "./PrepareAll";
import { SentencesPanel } from "./SentencesPanel";
import { clockAr, sceneName, seamName } from "./sceneNames";
import { sceneSeconds } from "../../../src/plan/duration";
import { Icon } from "../ui/icons";
import { Num, duration as clock } from "../ui/format";

type Props = {
  episodeId: string;
  channelId: string;
  onOpenScene: (id: string) => void;
  onOpenStoryboard: () => void;
  onOpenScript: () => void;
  onOpenPublish: () => void;
  /**
   * Given only on step ٤ («النشر»): making and approving the final file belong to step ٣, so before the
   * Master is approved this screen points there instead of repeating it (funnel audit 8 Nov, D36).
   */
  onOpenReview?: () => void;
  /** Step ٢ only: once every scene is approved, its one forward action is step ٣ (assembly and final). */
  onOpenFinal?: () => void;
  /** Step ٢ only: before «اعتمد التجهيز» the whole screen is one line and this one button back to step ١. */
  onOpenPreparation?: () => void;
  onUpdated?: () => void;
  /**
   * شاشة «المشاهد» (الخطوة ٢) فقط: الخطة لعرض نص كل مشهد وشريط التقدم، ومحرر المشهد الكامل
   * يُفتح خلف «تحرير المشهد» بدل أن يظهر دائمًا. بدونها تبقى اللوحة شريط القرار في الخطوتين ٣ و٤.
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
  /**
   * First paint only (server-side render in tests): a read model already fetched from the ledger.
   * Display only, never a source of approval; the panel re-reads `api.sceneProduction` on mount.
   */
  initialRead?: SceneProductionRead;
  /** «الجمل» (D50): يُحفظ تعديل الخطة المعلّق قبل أن يكتب الخادم نص مشهد، ثم تُستبدل الخطة بما كتبه (بلا حفظ جديد). */
  onPlanFlush?: () => Promise<void>;
  onPlanReplaced?: (plan: Plan) => void;
  /** Step ٢'s views in the header pill (direction D): the scenes one by one, or those needing a fix. */
  view?: "one" | "fix";
  onView?: (v: "one" | "fix") => void;
  /** A scene's board picture for the filmstrip (drawn lazily by the page). */
  thumb?: (sceneId: string) => React.ReactNode;
  /** Step ٣'s views: the seams of the assembled episode, or the final file (the recitations are their own panel). */
  finalView?: "recitations" | "seams" | "master";
  onFinalView?: (v: "recitations" | "seams" | "master") => void;
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

/** سطر هادئ واحد تحت ملاحظة التصحيح: هل وصلت الملاحظة، وهل أُصلح المشهد (docs/studio/notes-inbox.md). */
export const noteInboxLine = (inbox: { sync: "pending" | "sent"; status: string; answer: string | null }) =>
  inbox.status === "fixed" ? `أُصلحت — أنتج المشهد من جديد${inbox.answer ? ` (${inbox.answer})` : ""}`
    : inbox.status === "wont-fix" ? `لن تُعدَّل${inbox.answer ? `: ${inbox.answer}` : ""}`
    : inbox.sync === "sent" ? "أُرسلت الملاحظة" : "بانتظار الإرسال (بلا اتصال)";

const ar = (n: number) => n.toLocaleString("ar-EG");
const noop = () => {};

/**
 * The only visible approval surface for scene-first Studio V2.
 * Never infer approval from a video existing or a checkbox in the browser.
 * All decisions are server-authenticated, bound to real bytes and serialized.
 */
export const SceneProductionPanel: React.FC<Props> = ({
  episodeId, channelId, onOpenScene, onOpenStoryboard, onOpenScript, onOpenPublish, onOpenReview, onOpenFinal, onOpenPreparation, onUpdated,
  plan, channel, editor, livePreview, requestedSceneId, onCloseEditor, media, onMediaChange, onPlanSave, hasVoiceKeys, onOpenSettings,
  initialRead, onPlanFlush, onPlanReplaced, view = "one", onView, thumb, finalView, onFinalView,
}) => {
  const [data, setData] = useState<SceneProductionRead | null>(initialRead ?? null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
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
  // «جمل الحلقة كلها» في «أدوات وتفاصيل»: تُفتح بطلب المالك فقط (القائمة طويلة)
  const [allSentences, setAllSentences] = useState(false);
  // التجهيز في الخلفية (يبدأ وحده بعد «اعتمد التجهيز»): يقول تحت المشهد غير الجاهز «يُجهَّز الآن» أو «في الدور»
  const [prepJob, setPrepJob] = useState<ScenePrepareRead["job"]>(null);
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
    setPending(true);
    setError("");
    try {
      await api.renderSceneAv(episodeId, channelId, sceneId, sourceSha256);
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
    setPending(true);
    setError("");
    try {
      await api.assembleSceneAv(episodeId, channelId);
      // One click: the file just built from the approved cuts is recorded for the 1× review at once,
      // so an older file at the same path (e.g. a legacy preview) is never what gets recorded.
      const fresh = await api.sceneProduction(episodeId, channelId);
      const built = fresh.candidates?.assemblySha256;
      if (built) await api.decideScene(episodeId, channelId, { action: "assemble", expectedSha256: built });
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

  const act = async (action: SceneOwnerAction["action"], expectedSha256: string, sceneId?: string, noteText?: string, extra?: { tone?: string }): Promise<boolean> => {
    const fail = (msg: string) => { setError(msg); return false; };
    const note = noteText ?? noteDraft;
    if (!data || pending) return false;
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
      await api.decideScene(episodeId, channelId, {
        action, expectedSha256, ...(sceneId ? { sceneId } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(reviewed ? { confirmedWatched: true } : {}),
        ...(seamsChecked ? { seamsChecked } : {}),
        ...(extra?.tone ? { tone: extra.tone } : {}),
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
  const reviewCurrent = async (action: "approve-scene" | "correct-scene", noteText?: string, extra?: { tone?: string }): Promise<boolean> => {
    if (!scene || !currentId) return false;
    let sha = scene.status === "in_review" ? scene.previewSha256 : undefined;
    if (!sha) {
      if (!draftReady || !candidate) return false;
      setPending(true);
      setError("");
      try {
        const sub = await api.decideScene(episodeId, channelId, {
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
    return act(action, sha, currentId, noteText, extra);
  };

  // القرار الحالي في سطر واحد: يظهر فيه ما يُشاهَد، وما يُؤكَّد، والزر
  const confirm = (label: string) => (
    <label className="sp-confirm"><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} /> {label}</label>
  );
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
    const map = data?.toneMap;
    const name = toneChoice && toneChoice in tones ? tones[toneChoice as keyof typeof tones].nameAr : map ? toneMapKeepLabel : inheritedToneLabel(plan.tone);
    const text = problemText.trim() ? `${name} — ${problemText.trim()}` : name;
    // Tone-map episode: the server writes the choice into a new tone-map version for this scene; the plan stays as is.
    const ok = await reviewCurrent("correct-scene", problemNote("tone", at, text), map && toneChoice ? { tone: toneChoice } : undefined);
    if (!ok) return;
    if (map) { await generateVoice(sceneId, true); return; }
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

  // Keyboard on step ٢ (direction D): ←/→ the next/previous scene, Enter approves when it is allowed, Esc closes.
  const keys = useRef<(e: KeyboardEvent) => void>(noop);
  useEffect(() => {
    if (!sceneMode) return;
    const on = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [sceneMode]);
  // The filmstrip starts folded on a short screen, so the sentence and its tools stay clear above the dock.
  const [reelOpen, setReelOpen] = useState(() => typeof window === "undefined" || window.innerHeight >= 1000);
  // Step ٣: the seam on screen in the assembled episode.
  const [seamAt, setSeamAt] = useState(0);

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

  // Before «اعتمد التجهيز» (step ١) step ٢ is one line and one button back; never a disabled action bar.
  if (sceneMode && data && (!data.script.approved || !data.storyboard.approved)) {
    return (
      <section className="stage s3 s3-gated" aria-label="المشاهد قبل اعتماد التجهيز">
        <div className="s3-gate">
          <p>المشاهد تبدأ بعد اعتماد التجهيز (الستوري بورد والسكريبت) في الخطوة ١.</p>
          <button type="button" className="btn primary" onClick={onOpenPreparation ?? onOpenStoryboard}>إلى التجهيز</button>
        </div>
      </section>
    );
  }
  // Item 16: after the last approval step ٢ keeps its strip and player, so any approved scene can be rewatched.
  const allDoneHere = Boolean(sceneMode && onOpenFinal && data && data.script.approved && data.storyboard.approved && !currentId);
  if (sceneMode && shownId && (!data || (currentId && scene) || allDoneHere)) {
    const hit = planScenes.find((x) => x.scene.id === shownId);
    const shownIdx = order.indexOf(shownId);
    const shownServer = data?.scenes.find((s) => s.id === shownId);
    const isCurrent = Boolean(data && shownId === currentId && scene);
    const shownVideo = data?.candidates?.scenes[shownId] ? api.previewUrl(episodeId, `scene-${shownId}-av.mp4`) : "";
    const blocking = issues.filter((i) => i.level === "error").length;
    const approvedCount = data?.progress.approvedScenes ?? 0;
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
    const status = statusOf(shownId);
    // التجهيز يبدأ وحده بعد «اعتمد التجهيز»: سطر حالته فقط («جاهز ١٢ من ١١٤» مع أوقف/استأنف)، لا زر في شريط القرار
    const prepLine = data && !data.progress.canAssemble ? (
      <PrepareAll className="s3-prep" episodeId={episodeId} channelId={channelId} prepared={data.prepared} onOpenSettings={onOpenSettings} order={order}
        onJob={setPrepJob}
        onChanged={() => {
          void refresh().catch(() => {});
          // الصوت المولَّد في الخلفية يظهر في أزرار المشهد دون إعادة فتح الحلقة
          void api.episode(episodeId, channelId).then((d) => onMediaChange?.(d.media), () => {});
          onUpdated?.();
        }} />
    ) : null;
    const prepRunning = prepJob?.status === "running";
    const preparing: "now" | "queued" | null = !prepRunning || !currentId ? null
      : prepJob!.sceneId === currentId ? "now"
      : prepJob!.skipped?.some((x) => x.id === currentId) || prepJob!.failed.some((x) => x.id === currentId) ? null : "queued";
    // مشهد غير الحالي، أو الحالة لم تُقرأ بعد: سبب واحد وزر واحد، بلا شريط معطّل
    const lock: ActionLock | undefined = !data
      ? { reason: error ? "تعذّر تحميل حالة الحلقة؛ أعد فتحها." : "جارٍ تحميل حالة الحلقة…" }
      : !isCurrent && currentId
        ? { reason: status === "done" ? "اعتُمد هذا المشهد؛ القرار الآن على المشهد الحالي." : "يُعتمد بعد ما قبله، بالترتيب.", action: { label: `إلى المشهد الحالي (${ar(order.indexOf(currentId) + 1)})`, onClick: () => setViewId(null) } }
        : !isCurrent
          ? { reason: "لا مشهد ينتظر قرارًا الآن." }
          : undefined;
    const reviewReady = Boolean(isCurrent && scene && ((scene.status === "in_review" && scene.previewSha256) || draftReady));
    const stateText = status === "done" ? (shownServer?.conditional ? "معتمد مشروطًا بالتلاوة" : "معتمد")
      : status === "now" ? (scene?.status === "in_review" || (isCurrent && draftReady) ? "جاهز للمراجعة" : scene?.status === "needs_revision" ? (scene.correction ? "بانتظار التعديل" : "عُدّل؛ يحتاج إنتاجًا جديدًا") : preparing === "now" ? "يُجهَّز الآن" : "المشهد الحالي")
      : "لاحقًا";
    const go = (delta: number) => {
      const i = shownIdx + delta;
      if (i < 0 || i >= order.length) return;
      setViewId(order[i]!);
      setProblem(null); setConfirming(false);
    };
    const approveNow = () => {
      if (!reviewReady || pending) return;
      if (!reviewed) { setProblem(null); setConfirming(true); return; }
      void reviewCurrent("approve-scene");
    };
    keys.current = (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.key === "Escape") { if (problem || confirming) { setProblem(null); setConfirming(false); } return; }
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, select, [contenteditable='true'], [role='dialog'], .modal")) return;
      if (typeof document !== "undefined" && document.querySelector(".ms-pop, .modal")) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(-1); }
      else if (e.key === "Enter" && !t?.closest?.("button, a, summary") && isCurrent && reviewReady && !problem) { e.preventDefault(); approveNow(); }
    };
    const secs = (id: string) => { const x = planScenes.find((y) => y.scene.id === id)?.scene; return x ? Math.max(1, sceneSeconds(x, media?.recitations ? media : undefined)) : 4; };
    const fixes = (data?.scenes ?? []).filter((x) => x.status === "needs_revision");
    const nav = {
      prev: <button type="button" className="ms-nv" onClick={() => go(-1)} disabled={shownIdx <= 0} aria-label="المشهد السابق" title="المشهد السابق (→)"><Icon name="chevR" /></button>,
      next: <button type="button" className="ms-nv" onClick={() => go(1)} disabled={shownIdx >= order.length - 1} aria-label="المشهد التالي" title="المشهد التالي (←)"><Icon name="chev" /></button>,
      count: <><b><Num>{approvedCount}</Num></b> من <Num>{order.length}</Num> معتمدة</>,
    };
    return (
      <section className="stage s3" aria-label="المشهد الحالي في إنتاج الحلقة">
        <div className="s3-col">
          {/* «قبل أن تعتمد»: this channel's review criteria (from its production rules), on a sticky note in the gutter */}
          <aside className="ms-note s3-note" aria-label="معايير مراجعة هذه القناة">
            <h2>قبل أن تعتمد</h2>
            <ol>{humanReviewFocus.map((item) => <li key={item}>{item}</li>)}</ol>
          </aside>
          <header className="s3-head">
            <div className="s3-title">
              <h2>المشهد {shownIdx >= 0 ? ar(shownIdx + 1) : ""} <span className="s3-of">من {ar(order.length)}</span></h2>
              {hit ? <span className="s3-sub" title={`الفصل ${ar(hit.chapter.number)}`}>{hit.chapter.title}</span> : null}
            </div>
            <div className="s3-meta">
              <span className={`s3-state is-${status}`}>{stateText}</span>
              {hit ? <span className="s3-len"><Num>{clock(secs(shownId))}</Num></span> : null}
              {prepLine}
              <button type="button" className="btn ghost s3-edit" onClick={() => setEditing(shownId)}><Icon name="doc" />تحرير المشهد</button>
            </div>
          </header>

          {error ? <p className="scene-first-error" role="alert">{error}</p> : null}

          {view === "fix" ? (
            <section className="s3-fixes" aria-label="مشاهد تحتاج إصلاحًا">
              {fixes.length ? (
                <ul className="s3-fixlist">
                  {fixes.map((x) => (
                    <li key={x.id}>
                      <button type="button" onClick={() => { setViewId(x.id); onView?.("one"); }}>
                        <b>{sceneName(order, x.id)}</b>
                        <span>{x.correction?.note || (sentNotes[x.id] ?? "عُدّل؛ يحتاج إنتاجًا جديدًا")}</span>
                        {x.correction?.inbox ? <small>{noteInboxLine(x.correction.inbox)}</small> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="s3-empty">لا مشهد يحتاج إصلاحًا الآن. ما تطلب تعديله بـ«الحركة غير مناسبة» أو «النبرة غير مناسبة» يظهر هنا حتى يُصلح.</p>}
            </section>
          ) : (
          <>
          <div className="s3-media">
            {isCurrent && previewUrl ? (
              <FramePlayer key={`${currentId}:${candidate}`} ref={videoRef} autoPlay={advanced} src={previewUrl} label={`${sceneName(order, currentId)} بالصوت والصورة`} />
            ) : !isCurrent && shownVideo ? (
              <FramePlayer key={shownId} src={shownVideo} label={`${sceneName(order, shownId)} بالصوت والصورة`} />
            ) : livePreview ? (
              // The tag sits under the frame, never over it: burned-in captions run along the top of the picture.
              <figure className="s3-livebox">
                <div className="s3-live">{livePreview(shownId)}</div>
                <figcaption className="s3-tag">معاينة صامتة{isCurrent ? " · المعاينة بالصوت تظهر هنا حين تُجهَّز" : ""}</figcaption>
              </figure>
            ) : (
              <div className="sp-empty">لم يُنتج هذا المشهد بعد.</div>
            )}
          </div>

          <div className="s3-side">
            {isCurrent && scene?.status === "needs_revision" && (sentNotes[currentId!] || scene.correction?.note) ? (
              <p className="s3-sent"><b>{draftReady ? "ملاحظتك على النسخة السابقة:" : "ملاحظتك (بانتظار التعديل ثم إعادة الإنتاج):"}</b> {sentNotes[currentId!] || scene.correction?.note}</p>
            ) : null}
            {isCurrent && scene?.status === "needs_revision" && scene.correction?.inbox ? (
              <p className="sp-hint" role="status">{noteInboxLine(scene.correction.inbox)}</p>
            ) : null}
            {isCurrent && scene && !scene.readyForAv ? <p className="sp-hint">ينقصه صوت الراوي.</p> : null}
            {shownServer?.recitationPending ? (
              <p className="sp-hint" role="note">التلاوة تُضاف لاحقًا: مسودة هذه الآية صامتة مكان التلاوة، واعتمادها الآن «مشروط بالتلاوة» يكمل الترتيب؛ وحين ترفع التلاوة في الخطوة ٣ يُفتح هذا المشهد وحده لمراجعة سريعة. التجميع والنسخة النهائية لا يُفتحان قبلها.</p>
            ) : null}
            {!hit?.scene.narration.trim() && hit?.scene.template !== "verse-card" ? <p className="s3-narr">بلا تعليق صوتي</p> : null}
          </div>

          {hit?.scene.narration.trim() || hit?.scene.template === "verse-card" ? (
            <SentencesPanel variant="paragraph" episodeId={episodeId} channelId={channelId} sceneId={shownId} hasVoiceKeys={hasVoiceKeys} onOpenSettings={onOpenSettings}
              onBeforeEdit={onPlanFlush} onPlanReplaced={onPlanReplaced} onMediaChange={onMediaChange}
              onChanged={() => { void refresh().catch(() => {}); onUpdated?.(); }} />
          ) : null}

          {allDoneHere ? (
            <div className="sp-row s3-alldone" role="group" aria-label="المشاهد معتمدة">
              <div>
                <h3>كل المشاهد معتمدة</h3>
                <p className="sp-hint">{(data!.progress.recitationPending?.length ?? 0) > 0
                  ? `${ar(data!.progress.recitationPending!.length)} مشهد آية معتمد «مشروطًا بالتلاوة»؛ التلاوات والمعاينة قبل النهائية في الخطوة ٣.`
                  : "اختر أي مشهد من الشريط لتعيد مشاهدته. التجميع والنسخة النهائية في الخطوة ٣."}</p>
              </div>
            </div>
          ) : null}

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
              <div className="s3-more-group">
                <h3>جمل الحلقة كلها</h3>
                <p className="sp-hint">كل مشاهد الحلقة جملةً جملة بالترتيب، والآيات في مواضعها برفع التلاوة؛ وفيها قاموس النطق.</p>
                <button type="button" className="btn" aria-expanded={allSentences} onClick={() => setAllSentences((v) => !v)}>{allSentences ? "أخفِ جمل الحلقة" : "اعرض جمل الحلقة كلها"}</button>
                {allSentences ? (
                  <SentencesPanel episodeId={episodeId} channelId={channelId} hasVoiceKeys={hasVoiceKeys} onOpenSettings={onOpenSettings}
                    onBeforeEdit={onPlanFlush} onPlanReplaced={onPlanReplaced} onMediaChange={onMediaChange}
                    onChanged={() => { void refresh().catch(() => {}); onUpdated?.(); }} />
                ) : null}
              </div>
              <p className="hint">التحرير الكامل (القالب، الخلفية، النبرة، التصدير) في «تحرير المشهد».</p>
            </More>
          </div>
          </>
          )}
        </div>

        {/* The whole episode as a filmstrip above the dock: widths by duration, chapters, states, verses hatched */}
        <section className={`s3-reel${reelOpen ? "" : " is-folded"}`} aria-label={`الحلقة كاملة: ${ar(approvedCount)} معتمد من ${ar(order.length)}`}>
          <div className="s3-reel-head">
            <b>الحلقة كاملة</b>
            <span><Num>{ar(order.length)}</Num> مشهدًا، <Num>{clock(order.reduce((n, id) => n + secs(id), 0))}</Num></span>
            <button type="button" className="s3-fold" aria-expanded={reelOpen} onClick={() => setReelOpen((v) => !v)}><Icon name={reelOpen ? "down" : "up"} />{reelOpen ? "اطوِ" : "افتح"}</button>
            <span className="s3-legend" aria-hidden="true"><span><i className="is-now" />الحالي</span><span><i className="is-ready" />جاهز للمراجعة</span><span><i className="is-later" />يُجهَّز</span><span><i className="is-verse" />آية، سكون</span></span>
          </div>
          <div className="s3-chaps" aria-hidden="true">
            {plan!.chapters.map((c) => (
              <span key={c.number} style={{ flex: c.scenes.reduce((n, x) => n + secs(x.id), 0) + c.scenes.length * 0.2 }}>{c.title}</span>
            ))}
          </div>
          <ol className="s3-strip" ref={stripRef}>
            {order.map((id, i) => {
              const st = statusOf(id);
              const srv = data?.scenes.find((x) => x.id === id);
              const verse = planScenes.find((x) => x.scene.id === id)?.scene.template === "verse-card";
              const ready = Boolean(srv && (srv.approved || srv.status === "in_review" || srv.draft === "ready"));
              return (
                <li key={id} style={{ flex: secs(id) }}>
                  <button type="button" className={`s3-dot is-${st}${ready ? " is-ready" : ""}${verse ? " is-verse" : ""}${id === shownId ? " is-shown" : ""}`} data-now={st === "now" ? "" : undefined}
                    aria-current={id === shownId ? "true" : undefined} onClick={() => setViewId(id)}
                    title={`${sceneName(order, id)} · ${st === "done" ? "معتمد" : st === "now" ? "الحالي" : "لاحقًا"}`}>
                    {thumb && !verse && Math.abs(i - shownIdx) <= 8 ? thumb(id) : null}
                    <span className="s3-dot-n">{verse ? "آية" : ar(i + 1)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
        <div className="s3-reelm" aria-hidden="true">
          <span>الحلقة كاملة</span>
          <span className="s3-reelm-bar">{order.map((id) => <i key={id} className={id === shownId ? "is-shown" : statusOf(id) === "done" ? "is-done" : ""} style={{ flex: secs(id) }} />)}</span>
          <span><Num>{approvedCount}</Num> من <Num>{order.length}</Num></span>
        </div>

        {isCurrent && currentId && scene ? (
          <SceneDecisionActions
            nav={nav}
            onOpenSettings={onOpenSettings}
            preparing={(scene.status === "in_review" && scene.previewSha256) || draftReady ? null : preparing}
            stage={(scene.status === "in_review" && scene.previewSha256) || draftReady ? "review" : "render"}
            voice={voiceOf(currentId)}
            voiceBusy={voiceBusy}
            voiceMsg={voiceMsg}
            canVoice={Boolean(hasVoiceKeys)}
            readyForAv={scene.readyForAv}
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
              setToneChoice(data?.toneMap?.tones[currentId] || (planScenes.find((x) => x.scene.id === currentId)?.scene.tone ?? ""));
              setProblem(problem?.kind === kind ? null : { kind, at: v?.currentTime ?? 0 });
            }}
            onProblemText={setProblemText}
            onTone={setToneChoice}
            episodeTone={plan?.tone}
            toneMapVersion={data?.toneMap?.version}
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
            onRender={() => void renderCurrentScene(currentId, scene.sourceSha256)}
          />
        ) : allDoneHere ? (
          <div className="s3-act ms-dock" role="group" aria-label="المشاهد معتمدة">
            <div className="ms-dock-in">
              {nav.prev}
              <button className="btn primary" type="button" onClick={onOpenFinal}>إلى النسخة النهائية<Icon name="chev" /></button>
              <span className="ms-dv" aria-hidden="true" />
              <span className="ms-ct">{nav.count}</span>
              {nav.next}
            </div>
          </div>
        ) : (
          <SceneDecisionActions
            nav={nav}
            locked={lock ?? { reason: "لا مشهد ينتظر قرارًا الآن." }}
            stage="render"
            voice={voiceOf(shownId)}
            voiceBusy={false}
            canVoice={Boolean(hasVoiceKeys)}
            readyForAv={false}
            pending={pending}
            problem={null}
            problemText=""
            tone=""
            confirming={false}
            reviewed={false}
            onOpenSettings={onOpenSettings}
            onVoice={noop} onProblem={noop} onProblemText={noop} onTone={noop} onCancelProblem={noop}
            onSubmitProblem={noop} onConfirm={noop} onApprove={noop} onRender={noop}
          />
        )}
      </section>
    );
  }

  // التجهيز (السكريبت والستوري بورد) يُعتمد من عمود الخطوات أعلى الصفحة بزر واحد؛ هذه اللوحة لما بعده
  if (data && (!data.script.approved || !data.storyboard.approved)) return null;
  // Step ٣ in views (direction D): the seams of the assembled episode get their own screen.
  if (data && finalView === "seams" && data.assembly && !data.assembly.approved) {
    const ids = data.scenes.map((x) => x.id);
    return (
      <SeamReview episodeId={episodeId} data={data} order={ids} plan={plan} thumb={thumb} at={Math.min(seamAt, Math.max(0, seamsAll.length - 1))} onAt={setSeamAt}
        heard={seams} onHeard={(seam, v) => setSeams({ ...seams, [seam]: v })} reviewed={reviewed} onReviewed={setReviewed} pending={pending} error={error}
        onApprove={() => void act("approve-assembly", data.assembly!.sha256)} />
    );
  }
  if (data && finalView === "master" && !data.progress.assemblyApproved) {
    return (
      <section className="scene-first-panel sp" aria-label="النسخة الأساسية">
        <div className="sp-row">
          <div><h3>النسخة الأساسية تُصنع بعد الوصلات</h3><p className="sp-hint">{data.assembly ? "استمع لكل وصلة بين مشهدين في الحلقة المجمعة واعتمدها؛ بعدها تُصنع النسخة الأساسية 4K هنا." : "تُجمع المشاهد المعتمدة أولًا في نسخة واحدة وتُسمع وصلاتها."}</p></div>
          <div className="sp-actions"><button className="btn primary" type="button" onClick={() => onFinalView?.(data.progress.canAssemble ? "seams" : "recitations")}>{data.progress.canAssemble ? "إلى الوصلات" : "إلى التلاوات"}</button></div>
        </div>
      </section>
    );
  }
  if (data && finalView === "seams" && data.progress.assemblyApproved) {
    return (
      <section className="scene-first-panel sp" aria-label="الوصلات">
        <div className="sp-row">
          <div><h3>اعتُمدت الوصلات كلها</h3><p className="sp-hint">سُمعت الحلقة المجمعة كاملة ١× وكل وصلة فيها. التالي: النسخة الأساسية 4K.</p></div>
          <div className="sp-actions"><button className="btn primary" type="button" onClick={() => onFinalView?.("master")}>إلى النسخة الأساسية</button></div>
        </div>
      </section>
    );
  }
  // Step ٢ after its last scene is handled above (allDoneHere): strip, rewatch, one forward action.
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
                  <button className="btn primary" disabled={pending || !scene.readyForAv} onClick={() => void renderCurrentScene(currentId, scene.sourceSha256)}>
                    {pending ? "جارٍ الإنتاج…" : "إنتاج المشهد"}
                  </button>
                  <button className="btn" type="button" onClick={() => onOpenScene(currentId)}>أدوات المشهد</button>
                </div>
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
            <button className="btn primary" disabled={pending} onClick={() => void assembleScenes()}>{pending ? "جارٍ الدمج…" : "دمج المشاهد للمراجعة"}</button>
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
          <div><h3>النسخة النهائية لم تُعتمد بعد</h3><p className="sp-hint">تُصنع النسخة النهائية وتُشاهد وتُعتمد في الخطوة ٣؛ وبعدها يُمنح إذن النشر هنا.</p></div>
          <div className="sp-actions"><button className="btn primary" type="button" onClick={onOpenReview}>إلى الخطوة ٣</button></div>
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
          <div><h3>النسخة النهائية معتمدة</h3><p className="sp-hint">الخطوة التالية: إذن النشر لهذا الملف بعينه في «النشر» (الخطوة ٤).</p></div>
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

/** سبب يمنع القرار كله الآن (تحميل الحالة، أو مشهد غير الحالي)، وفعل واحد يحلّه (الزر الممتلئ الوحيد حينها). */
export type ActionLock = { reason: string; action?: { label: string; onClick: () => void } };

/**
 * قرار المشهد الحالي في الخطوة ٢ (funnel v3، قرار صاحب القناة ٨ نوفمبر): المالك يعتمد أولًا النص مع الحركة
 * مع الصوت معًا، ثم أزرار حل المشكلات بعده. الترتيب ثابت من اليمين: «اعتمد المشهد» (الممتلئ الوحيد، أكبر)، ثم
 * «الحركة غير مناسبة» (بملاحظة)، ثم «النبرة غير مناسبة» (بملاحظة)، ثم «أعد توليد الصوت».
 * المشهد غير الجاهز بعد: «اعتمد» ينتظر وسطر واحد بتقدمه (يُجهَّز الآن / في الدور)، و«أنتج هذا المشهد» هادئًا
 * حين لا يعمل التجهيز. لا يغيّر الشريط أي بوابة: كل زر يمر بالمسار القائم نفسه، والخادم يرفض ما لا يحق.
 * المِرسَم (direction D): الشريط داكن عائم أسفل الشاشة، والسطر والتأكيد والملاحظة بطاقات صغيرة فوقه.
 */
export const SceneDecisionActions: React.FC<{
  /** review: معاينة المشهد بصوته جاهزة للقرار؛ render: لم تُجهَّز بعد */
  stage: "review" | "render";
  voice: VoiceState;
  voiceBusy: boolean;
  voiceMsg?: string;
  canVoice: boolean;
  readyForAv: boolean;
  pending: boolean;
  problem: { kind: ProblemKind; at: number } | null;
  problemText: string;
  tone: string;
  confirming: boolean;
  reviewed: boolean;
  /** التجهيز يعمل: "now" هذا المشهد قيد التجهيز، "queued" في الدور */
  preparing?: "now" | "queued" | null;
  /** القرار كله غير متاح لسبب واحد (لا شريط معطّل): السبب وزر واحد */
  locked?: ActionLock;
  /** السابق والتالي وعدد المعتمد، على طرفي الشريط (خارج مجموعة القرار) */
  nav?: { prev: React.ReactNode; next: React.ReactNode; count: React.ReactNode };
  onOpenSettings?: () => void;
  onVoice: () => void;
  onProblem: (kind: ProblemKind) => void;
  onProblemText: (text: string) => void;
  onTone: (tone: string) => void;
  /** نبرة الحلقة الموروثة (تُسمّى في خيار «مثل الحلقة») */
  episodeTone?: string;
  /** الحلقة لها خريطة نبرة: الاختيار يحدّثها لهذا المشهد (toneMapCopy.ts) */
  toneMapVersion?: string;
  onCancelProblem: () => void;
  onSubmitProblem: () => void;
  onConfirm: (reviewed: boolean) => void;
  onApprove: () => void;
  onRender: () => void;
}> = (p) => {
  const edges = (bar: React.ReactNode) => (
    <div className="ms-dock-in">
      {p.nav ? p.nav.prev : null}
      {bar}
      {p.nav ? <><span className="ms-dv" aria-hidden="true" /><span className="ms-ct">{p.nav.count}</span>{p.nav.next}</> : null}
    </div>
  );
  if (p.locked) {
    return (
      <div className="s3-act ms-dock">
        {edges(
          <div className="s3-why" role="note">
            <p className="sp-hint ms-dock-text">{p.locked.reason}</p>
            {p.locked.action ? <button type="button" className="btn primary s3-why-go" onClick={p.locked.action.onClick}>{p.locked.action.label}</button> : null}
          </div>,
        )}
      </div>
    );
  }
  const at = p.problem ? fmtTime(p.problem.at) : "";
  const problemReady = p.problem?.kind === "motion" ? Boolean(p.problemText.trim()) : Boolean(p.problem);
  const review = p.stage === "review";
  const voiceLabel = p.voiceBusy ? "جارٍ توليد الصوت…" : p.voice === "ok" ? "أعد توليد الصوت" : "ولّد الصوت";
  const voiceOff = p.voiceBusy || p.pending || !p.canVoice || Boolean(p.preparing);
  const needVoice = p.voice === "missing" || p.voice === "stale";
  // سطر واحد بما ينتظره «اعتمد»، ثم ما يمنع غيره
  const reasons: React.ReactNode[] = [];
  if (!review) reasons.push(
    p.preparing === "now" ? "يُجهَّز هذا المشهد الآن بصوته وحركته؛ «اعتمد» يُفتح حين تكتمل معاينته."
      : p.preparing === "queued" ? "هذا المشهد في دور التجهيز؛ «اعتمد» يُفتح حين تكتمل معاينته."
      : !p.readyForAv ? "ينقص هذا المشهد صوت الراوي: ولّد الصوت، ثم أنتج المشهد."
      : "لم تُجهَّز معاينة هذا المشهد بعد: أنتجه ليُعرض بصوته وحركته.");
  if (!p.canVoice && needVoice) reasons.push(
    p.onOpenSettings ? <>أضف مفتاح الصوت من <button type="button" className="prep-link" onClick={p.onOpenSettings}>الاتصالات والمفاتيح</button>.</> : "أضف مفتاح الصوت من الإعدادات.",
  );
  const tool = (label: string, icon: "motion" | "tone" | "regen" | "film", rest: React.ButtonHTMLAttributes<HTMLButtonElement> & { cta?: boolean }) => {
    const { cta, ...attrs } = rest;
    return (
      <button type="button" className={`btn ${cta ? "s3-cta" : "ghost"}`} aria-label={label} title={label} {...attrs}>
        <Icon name={icon} /><span className="lbl">{label}</span>
      </button>
    );
  };
  return (
    <div className="s3-act ms-dock">
      {edges(
        <div className="s3-actbar" role="group" aria-label="قرار المشهد">
          <button type="button" className="btn primary s3-approve" disabled={!review || p.pending || (p.confirming && !p.reviewed)} onClick={p.onApprove}>
            <Icon name="check" />{review && p.pending ? "جارٍ…" : "اعتمد المشهد"}<kbd aria-hidden="true">⏎</kbd>
          </button>
          <span className="ms-dv" aria-hidden="true" />
          {tool("الحركة غير مناسبة", "motion", { "aria-pressed": p.problem?.kind === "motion", disabled: !review || p.pending, onClick: () => p.onProblem("motion") })}
          {tool("النبرة غير مناسبة", "tone", { "aria-pressed": p.problem?.kind === "tone", disabled: !review || p.pending, onClick: () => p.onProblem("tone") })}
          {p.voice !== "none" ? tool(voiceLabel, "regen", { cta: needVoice && !p.preparing, disabled: voiceOff, title: p.canVoice ? voiceLabel : "يتطلب مفتاح الصوت من «الاتصالات والمفاتيح»", onClick: p.onVoice }) : null}
          {!review && !p.preparing ? tool(p.pending ? "جارٍ الإنتاج…" : "أنتج هذا المشهد", "film", { disabled: p.pending || !p.readyForAv || p.voiceBusy, onClick: p.onRender }) : null}
        </div>,
      )}
      {reasons.length ? (
        <div className="s3-why ms-float is-quiet" role="note">
          {reasons.map((r, i) => <p key={i} className="sp-hint">{r}</p>)}
        </div>
      ) : null}
      {p.voiceMsg ? <p className="sp-hint ms-float is-quiet" role="status">{p.voiceMsg}</p> : null}
      {p.confirming && review ? (
        <label className="sp-confirm s3-confirm ms-float"><input type="checkbox" checked={p.reviewed} onChange={(e) => p.onConfirm(e.target.checked)} autoFocus /> شاهدته بالصوت كاملًا</label>
      ) : null}
      {p.problem && review ? (
        <form className="s3-problem ms-float" onSubmit={(e) => { e.preventDefault(); if (problemReady) p.onSubmitProblem(); }}
          onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); p.onCancelProblem(); } }}>
          <span className="s3-problem-at">{p.problem.kind === "motion" ? "الحركة" : "النبرة"} عند <b dir="ltr">{at}</b></span>
          {p.problem.kind === "tone" ? (
            <select aria-label="النبرة المناسبة" value={p.tone} onChange={(e) => p.onTone(e.target.value)}>
              <option value="">{p.toneMapVersion ? toneMapKeepLabel : inheritedToneLabel(p.episodeTone)}</option>
              {toneIds.map((t) => <option key={t} value={t}>{tones[t].nameAr}</option>)}
            </select>
          ) : null}
          {p.problem.kind === "tone" && p.toneMapVersion ? <p className="sp-hint">{toneMapNote(p.toneMapVersion)}</p> : null}
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

/**
 * The scene's frame (direction D): the picture on the channel's paper, a small play pill and a thin progress
 * line. The same <video>: «الحركة/النبرة غير مناسبة» read its current time through the forwarded ref.
 */
export const FramePlayer = React.forwardRef<HTMLVideoElement, { src: string; label: string; autoPlay?: boolean }>(({ src, label, autoPlay }, ref) => {
  const own = useRef<HTMLVideoElement | null>(null);
  const [t, setT] = useState(0);
  const [d, setD] = useState(0);
  const [playing, setPlaying] = useState(false);
  const setRef = (el: HTMLVideoElement | null) => {
    own.current = el;
    if (typeof ref === "function") ref(el); else if (ref) ref.current = el;
  };
  const toggle = () => { const v = own.current; if (!v) return; if (v.paused) void v.play().catch(noop); else v.pause(); };
  return (
    <div className="s3-frame">
      <video ref={setRef} className="scene-first-video" preload="metadata" playsInline autoPlay={autoPlay} src={src} aria-label={label}
        onClick={toggle} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setT(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setD(e.currentTarget.duration || 0)} />
      <div className="s3-play" dir="ltr">
        <button type="button" onClick={toggle} aria-label={playing ? "أوقف" : "شغّل"}><Icon name={playing ? "pause" : "play"} /></button>
        <Num>{`${clockAr(t)} / ${clockAr(d)}`}</Num>
      </div>
      <input className="s3-prog" type="range" min={0} max={d || 0} step={0.05} value={Math.min(t, d || 0)} aria-label="موضع التشغيل"
        style={{ "--p": `${d ? (100 * t) / d : 0}%` } as React.CSSProperties}
        onChange={(e) => { const v = own.current; if (v) v.currentTime = Number(e.target.value); }} />
    </div>
  );
});
FramePlayer.displayName = "FramePlayer";

/**
 * Step ٣ «الوصلات» (direction D): one seam at a time between two scenes of the assembled episode: the last
 * moment of one scene and the first of the next (both frames from the assembled file itself), when it falls,
 * what is said on each side, «استمع للوصلة» (three seconds before and after), and the whole episode as a
 * timeline with a diamond per seam (heard / on screen / not heard) and a dot on each verse for its recitation.
 * «الوصلة سليمة» marks the seam heard and moves on; when every seam is heard, the one filled button approves
 * the assembly after the full 1× viewing, through the same `approve-assembly` decision (seams checked, 1× confirmed).
 * No seam timing can be changed here: there is no API for it; the pause is shown, not edited.
 */
const SeamReview: React.FC<{
  episodeId: string; data: SceneProductionRead; order: string[]; plan?: Plan; thumb?: (id: string) => React.ReactNode;
  at: number; onAt: (i: number) => void; heard: Record<string, boolean>; onHeard: (seam: string, v: boolean) => void;
  reviewed: boolean; onReviewed: (v: boolean) => void; pending: boolean; error: string; onApprove: () => void;
}> = ({ episodeId, data, order, plan, thumb, at, onAt, heard, onHeard, reviewed, onReviewed, pending, error, onApprove }) => {
  const player = useRef<HTMLVideoElement>(null);
  const stopAt = useRef<number | null>(null);
  const [needs, setNeeds] = useState("");
  const seams = data.seams;
  const seam = seams[at] ?? "";
  const [a, b] = seam.split(">");
  const times = data.seamTimes ?? {};
  const tAt = times[seam];
  const src = api.previewUrl(episodeId, "episode.mp4");
  const heardCount = seams.filter((x) => heard[x]).length;
  const allHeard = heardCount === seams.length;
  const scenesOf = new Map((plan?.chapters ?? []).flatMap((c) => c.scenes.map((x) => [x.id, { scene: x, chapter: c }] as const)));
  const words = (t: string | undefined, take: number, end: boolean) => {
    const w = (t ?? "").trim().split(/\s+/).filter(Boolean);
    if (!w.length) return "";
    return end ? `…${w.slice(-take).join(" ")}` : `${w.slice(0, take).join(" ")}…`;
  };
  // Each scene's length in the assembled file, from the seam times (the ruler and the timeline widths).
  const starts = [0, ...seams.map((x) => times[x] ?? NaN)];
  const known = starts.every((x) => Number.isFinite(x));
  const lastScene = scenesOf.get(order[order.length - 1] ?? "")?.scene;
  const total = known && seams.length ? starts[starts.length - 1]! + Math.max(2, lastScene ? sceneSeconds(lastScene) : 4) : 0;
  const len = (i: number) => (known && total ? (i + 1 < starts.length ? starts[i + 1]! - starts[i]! : total - starts[i]!) : 1);
  const listen = () => {
    const v = player.current;
    if (!v || tAt === undefined) return;
    v.currentTime = Math.max(0, tAt - 3);
    stopAt.current = tAt + 3;
    void v.play().catch(noop);
  };
  const ok = () => {
    if (!allHeard) {
      onHeard(seam, true);
      const nextIdx = seams.findIndex((x, i) => i > at && !heard[x]);
      if (nextIdx >= 0) onAt(nextIdx);
      return;
    }
    if (!reviewed) { setNeeds("ضع علامة «شاهدت الحلقة كاملة ١×» بعد مشاهدتها كاملة، ثم اضغط الزر."); return; }
    setNeeds("");
    onApprove();
  };
  const verse = (id: string) => scenesOf.get(id)?.scene.template === "verse-card";
  const pendingRec = new Set(data.progress.recitationPending ?? []);
  const chapterOf = (id: string) => scenesOf.get(id)?.chapter;
  return (
    <section className="ms-final" aria-label="الوصلات بين المشاهد">
      <header className="ms-final-head">
        <div><h1 className="ms-title">النسخة النهائية</h1><p className="ms-sub">استمع لكل وصلة بين مشهدين؛ بعدها تُصنع النسخة الأساسية 4K.</p></div>
        <dl className="ms-stats">
          <div><dt>مشهدًا معتمدًا</dt><dd><Num>{data.progress.approvedScenes}</Num></dd></div>
          <div><dt>وصلة مسموعة</dt><dd><Num>{`${heardCount} من ${seams.length}`}</Num></dd></div>
        </dl>
      </header>
      {error ? <p className="scene-first-error" role="alert">{error}</p> : null}
      {seam ? (
        <>
          <div className="ms-seam">
            <figure className="ms-seam-f">
              {tAt !== undefined ? <video src={`${src}#t=${Math.max(0, tAt - 0.12).toFixed(2)}`} preload="metadata" muted playsInline aria-label={`آخر لحظة من ${sceneName(order, a)}`} /> : <div className="sp-empty">بلا توقيت</div>}
              <figcaption>آخر {sceneName(order, a)}</figcaption>
            </figure>
            <div className="ms-seam-mid">
              <span>الوصلة <Num>{`${sceneNoOr(order, a)} ← ${sceneNoOr(order, b)}`}</Num></span>
              <b>{tAt !== undefined ? <Num>{clockAr(tAt)}</Num> : "—"}</b>
              <span>موضعها في الحلقة</span>
            </div>
            <figure className="ms-seam-f">
              {tAt !== undefined ? <video src={`${src}#t=${(tAt + 0.12).toFixed(2)}`} preload="metadata" muted playsInline aria-label={`أول لحظة من ${sceneName(order, b)}`} /> : <div className="sp-empty">بلا توقيت</div>}
              <figcaption className="is-start">أول {sceneName(order, b)}</figcaption>
            </figure>
          </div>
          {plan ? (
            <div className="ms-said">
              <span><em>آخر ما يُقال</em>{words(scenesOf.get(a!)?.scene.narration, 4, true) || (verse(a!) ? "آية" : "—")}</span>
              <span />
              <span><em>أول ما يُقال</em>{words(scenesOf.get(b!)?.scene.narration, 4, false) || (verse(b!) ? "آية" : "—")}</span>
            </div>
          ) : null}
          <div className="ms-seamtools">
            <button type="button" className="ms-listen" onClick={listen} disabled={tAt === undefined}><Icon name="play" />استمع للوصلة<small>٣ ث قبلها و٣ بعدها</small></button>
            <label className="sp-confirm"><input type="checkbox" checked={Boolean(heard[seam])} onChange={(e) => onHeard(seam, e.target.checked)} /> سمعتها</label>
            {chapterOf(a!) ? <span className="ms-seam-where">داخل الفصل <Num>{String(chapterOf(a!)!.number)}</Num> «{chapterOf(a!)!.title}»</span> : null}
          </div>
        </>
      ) : null}
      <section className="ms-tl" aria-label="الحلقة كاملة">
        <div className="ms-tl-head">
          <b>الحلقة كاملة</b>
          <span><Num>{order.length}</Num> مشهدًا{total ? <>، <Num>{clockAr(total)}</Num></> : null}</span>
          <span className="s3-legend" aria-hidden="true"><span><i className="d is-on" />الوصلة الحالية</span><span><i className="d is-ok" />مسموعة</span><span><i className="d" />لم تُسمع</span><span><i className="is-verse" />آية، سكون مقصود</span><span><i className="r is-ok" />تلاوة مرفقة</span><span><i className="r" />تنتظر التلاوة</span></span>
        </div>
        <ol className="ms-tl-strip">
          {order.map((id, i) => (
            <React.Fragment key={id}>
              <li className={`ms-tl-clip${verse(id) ? " is-verse" : ""}`} style={{ flex: len(i) }} title={sceneName(order, id)}>
                {verse(id) ? <><span className={`r${pendingRec.has(id) ? "" : " is-ok"}`} aria-label={pendingRec.has(id) ? "تنتظر التلاوة" : "تلاوة مرفقة"} /><b>آية</b></>
                  : <>{thumb && Math.abs(i - at) <= 6 ? thumb(id) : null}<span className="s3-dot-n">{arNumOf(i + 1)}</span></>}
              </li>
              {i < order.length - 1 ? (
                <li className={`ms-tl-sm${i === at ? " is-on" : heard[seams[i]!] ? " is-ok" : ""}`}>
                  <button type="button" onClick={() => onAt(i)} aria-current={i === at ? "true" : undefined}
                    aria-label={`${seamName(order, seams[i]!)}${heard[seams[i]!] ? " (مسموعة)" : ""}`}><i /></button>
                </li>
              ) : null}
            </React.Fragment>
          ))}
        </ol>
        {known && total ? (
          <div className="ms-ruler" aria-hidden="true">
            {Array.from({ length: Math.floor(total / 60) + 1 }, (_, m) => <span key={m} style={{ insetInlineStart: `${(100 * m * 60) / total}%` }}><Num>{`${m}:00`}</Num></span>)}
          </div>
        ) : null}
      </section>
      <details className="more ms-full" open={allHeard}>
        <summary>شاهد الحلقة كاملة ١×</summary>
        <div className="more-body">
          <video ref={player} className="scene-first-video" controls preload="metadata" src={src} aria-label="الحلقة المجمعة"
            onTimeUpdate={(e) => { if (stopAt.current !== null && e.currentTarget.currentTime >= stopAt.current) { e.currentTarget.pause(); stopAt.current = null; } }} />
          <fieldset className="scene-first-seams">
            <legend>كل الوصلات: <Num>{`${heardCount} من ${seams.length}`}</Num></legend>
            {seams.map((x) => (
              <SeamRow key={x} label={seamName(order, x)} at={times[x]} checked={Boolean(heard[x])} onCheck={(v) => onHeard(x, v)}
                onJump={(t) => { const v = player.current; if (!v) return; v.currentTime = Math.max(0, t - 2); void v.play().catch(noop); }} />
            ))}
          </fieldset>
        </div>
      </details>
      <div className="ms-dock" role="group" aria-label="قرار الوصلة">
        {needs ? <p className="ms-float spine-needs" role="alert">{needs}</p> : null}
        <div className="ms-dock-in">
          <button type="button" className="ms-nv" disabled={at <= 0} onClick={() => onAt(at - 1)} aria-label="الوصلة السابقة"><Icon name="chevR" /></button>
          {allHeard ? <label className="ms-cb"><input type="checkbox" checked={reviewed} onChange={(e) => { onReviewed(e.target.checked); setNeeds(""); }} /> شاهدت الحلقة كاملة ١×</label> : null}
          <button type="button" className="btn primary" disabled={pending} onClick={ok}>
            <Icon name="check" />{allHeard ? (pending ? "جارٍ الاعتماد…" : "اعتمد الوصلات") : "الوصلة سليمة"}
          </button>
          <span className="ms-dv" aria-hidden="true" />
          <span className="ms-ct"><b><Num>{heardCount}</Num></b> من <Num>{seams.length}</Num> وصلة مسموعة</span>
          <button type="button" className="ms-nv" disabled={at >= seams.length - 1} onClick={() => onAt(at + 1)} aria-label="الوصلة التالية"><Icon name="chev" /></button>
        </div>
      </div>
    </section>
  );
};
const arNumOf = (n: number) => n.toLocaleString("ar-EG");
const sceneNoOr = (order: string[], id?: string) => { const i = id ? order.indexOf(id) : -1; return i >= 0 ? String(i + 1) : "؟"; };
