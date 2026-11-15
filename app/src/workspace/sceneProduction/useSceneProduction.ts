/**
 * Step ٢/٣/٤ decision state (work ٨, D-split): every hook and every server call of `SceneProductionPanel`, in the
 * same order as before the split, so the panel's components only display. Nothing here grants an approval: each
 * decision goes through `api.decideScene` and the server ledger decides.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { api, type SceneProductionRead, type SceneOwnerAction, type ScenePrepareRead } from "../../api";
import { channelProductionProfile } from "../../../../src/channel/productionRules";
import type { Plan } from "../../../../src/plan/types";
import { planIssues } from "../../../../src/plan/validate";
import { inheritedToneLabel, tones } from "../../../../src/voice/tones";
import { toneMapKeepLabel } from "../toneMapCopy";
import { NOTES_STATUS_EVENT } from "../../ui/NotesBadge";
import { NO_VOICE_KEY_AFTER_NOTE, voiceResultMessage } from "../voiceResult";
import type { SceneProductionProps } from "../SceneProductionPanel";
import { noop, problemNote, type ProblemKind } from "./notes";
import type { VoiceState } from "./SceneDecisionActions";
import type { VoiceProgress } from "./liveAudio";

export const useSceneProduction = (props: SceneProductionProps) => {
  const {
    episodeId, channelId, onUpdated, onState, onShownScene, planSaved,
    plan, channel, editor, requestedSceneId, viewSceneId, media, onMediaChange, onPlanSave, hasVoiceKeys,
    initialRead, view = "one", onView,
  } = props;
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
  const [videoSeconds, setVideoSeconds] = useState<{ id: string; seconds: number } | null>(null);
  const [problem, setProblem] = useState<{ kind: ProblemKind; at: number } | null>(null);
  const [problemText, setProblemText] = useState("");
  const [toneChoice, setToneChoice] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sentNotes, setSentNotes] = useState<Record<string, string>>({});
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState("");
  // بعد «اعتمد» يُعرض المشهد التالي فورًا، وتبدأ مسودته الجاهزة بالتشغيل
  const [advanced, setAdvanced] = useState(false);
  const [shortsOpen, setShortsOpen] = useState(false);
  /** dafatir M9: after a tone note or a scene regeneration the sentence rows are read again (their tone and status). */
  const [sentencesKey, setSentencesKey] = useState(0);
  /** D131: how many narration sentences of each scene have a current take (from «الجمل»), said under a silent preview */
  const [voiceProgress, setVoiceProgress] = useState<Record<string, VoiceProgress>>({});
  const onVoiceProgress = (sceneId: string, p: VoiceProgress) =>
    setVoiceProgress((m) => (m[sceneId]?.done === p.done && m[sceneId]?.total === p.total ? m : { ...m, [sceneId]: p }));
  // «جمل الحلقة كلها» في «أدوات وتفاصيل»: تُفتح بطلب المالك فقط (القائمة طويلة)
  const [allSentences, setAllSentences] = useState(false);
  // التجهيز في الخلفية (يبدأ وحده بعد «اعتمد التجهيز»): يقول تحت المشهد غير الجاهز «يُجهَّز الآن» أو «في الدور»
  const [prepJob, setPrepJob] = useState<ScenePrepareRead["job"]>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  // النسخة المجمعة: زر كل وصلة ينقل المشغّل إلى لحظتها
  const assemblyRef = useRef<HTMLVideoElement>(null);

  // M6: the heard seams live on the server, per assembly fingerprint (a reload or another tab keeps them).
  const assemblySha = data?.assembly && !data.assembly.approved ? data.assembly.sha256 : null;
  useEffect(() => {
    if (!assemblySha) return;
    let alive = true;
    api.seamChecks(episodeId, channelId).then((r) => {
      if (alive && r.assembly === assemblySha) setSeams(Object.fromEntries(Object.keys(r.heard).map((k) => [k, true])));
    }, () => {});
    return () => { alive = false; };
  }, [episodeId, channelId, assemblySha]);
  const markSeam = async (seam: string, heard: boolean, how?: "played" | "confirmed", playedSec?: number) => {
    if (!assemblySha) return;
    try {
      const r = await api.recordSeam(episodeId, channelId, { seam, assemblySha256: assemblySha, heard, ...(how ? { how } : {}), ...(playedSec !== undefined ? { playedSec } : {}) });
      setSeams(Object.fromEntries(Object.keys(r.heard).map((k) => [k, true])));
      setError("");
    } catch (e) { setError((e as Error).message); }
  };
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
  // KI-001: the line under a sent note follows the notes indicator (sent, or the real reason) without a reload
  useEffect(() => {
    const on = () => { void api.sceneProduction(episodeId, channelId).then(setData).catch(() => {}); };
    window.addEventListener(NOTES_STATUS_EVENT, on);
    return () => window.removeEventListener(NOTES_STATUS_EVENT, on);
  }, [episodeId, channelId]);
  const onStateRef = useRef(onState);
  onStateRef.current = onState;
  useEffect(() => { if (data) onStateRef.current?.(data); }, [data]);
  useEffect(() => {
    if (editor && requestedSceneId) setEditing(requestedSceneId);
  }, [requestedSceneId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (viewSceneId) setViewId(viewSceneId); }, [viewSceneId]);

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
      // M8: the decision's response IS the full read model (the same shape as GET: candidates, drafts,
      // seams) — the screen takes it at once instead of a second read that could race the Drive start.
      const fresh = await api.decideScene(episodeId, channelId, {
        action, expectedSha256, ...(sceneId ? { sceneId } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(reviewed ? { confirmedWatched: true } : {}),
        ...(seamsChecked ? { seamsChecked } : {}),
        ...(extra?.tone ? { tone: extra.tone } : {}),
      });
      setData(fresh);
      onUpdated?.();
      // The publish page (files, Drive status) refreshes now: after «إذن النشر» the copy to Drive has started.
      try { window.dispatchEvent(new CustomEvent("studio-workflow-updated", { detail: { episodeId } })); } catch { /* no window (SSR) */ }
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

  const seamsAll = data?.seams ?? [];
  const seamsDone = seamsAll.filter((x) => seams[x]).length;

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

  // dafatir M6: every plan save from this screen (editor fields, tone, text) re-reads the scene state, so a scene
  // waiting for a change unlocks as soon as its inputs changed (no reload).
  const savedSeen = useRef(planSaved);
  useEffect(() => {
    if (!sceneMode || savedSeen.current === planSaved) return;
    savedSeen.current = planSaved;
    void refresh().catch(() => {});
  }, [planSaved, sceneMode]); // eslint-disable-line react-hooks/exhaustive-deps
  const onShownRef = useRef(onShownScene);
  onShownRef.current = onShownScene;
  useEffect(() => { if (sceneMode && data) onShownRef.current?.(shownId); }, [sceneMode, data, shownId]);
  // صوت المشهد: لا تعليق، أو بلا ملف، أو ملف لنص قديم، أو مطابق
  const voiceOf = (id: string): VoiceState => {
    const narr = planScenes.find((x) => x.scene.id === id)?.scene.narration.trim() ?? "";
    if (!narr) return "none";
    const clip = media?.voice[id];
    if (!clip) return "missing";
    return clip.text === narr ? "ok" : "stale";
  };
  // M5: a voice message (or refusal) belongs to its scene; it never follows the owner to another one.
  useEffect(() => { setVoiceMsg(""); }, [currentId, shownId]);
  /** توليد صوت هذا المشهد وحده بنقرة المالك (الواجهة نفسها في «الصوت» والمحرر). */
  const generateVoice = async (sceneId: string, force: boolean): Promise<boolean> => {
    setVoiceBusy(true);
    setVoiceMsg("");
    try {
      let r = await api.voice(episodeId, { scenes: [sceneId], force });
      // D136: nothing that would be sent changed: say so, and generate only after the owner confirms
      if (r.confirm) {
        if (!window.confirm(r.confirm.message)) { setVoiceMsg(`${r.confirm.message.split(":")[0]}؛ لم يُولَّد شيء.`); return false; }
        r = await api.voice(episodeId, { scenes: [sceneId], force, confirmSame: true });
      }
      onMediaChange?.(r.media);
      // Never a success line without a real result (QA balislam 3): no key = a dry run, nothing was made.
      const said = voiceResultMessage(r);
      setVoiceMsg(said.text);
      setSentencesKey((n) => n + 1);
      if (!said.ok) return false;
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
    setSentencesKey((k) => k + 1);
    if (!map) {
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
    }
    // No voice key: the note and the tone are saved, and nothing is generated (never a success line for nothing).
    if (!hasVoiceKeys) { setVoiceMsg(NO_VOICE_KEY_AFTER_NOTE); return; }
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
  // Chosen from «تحتاج إصلاحًا» (or the strip there): that scene takes the screen — its header and its dock — and the focus.
  const headRef = useRef<HTMLHeadingElement>(null);
  const [reasonsHost, setReasonsHost] = useState<HTMLDivElement | null>(null);
  const focusHead = useRef(false);
  useEffect(() => {
    if (!focusHead.current || view === "fix") return;
    focusHead.current = false;
    headRef.current?.focus({ preventScroll: false });
  });
  const openScene = (id: string) => { setViewId(id); setProblem(null); setConfirming(false); if (view === "fix") { focusHead.current = true; onView?.("one"); } };
  // Step ٣: the seam on screen in the assembled episode.
  const [seamAt, setSeamAt] = useState(0);

  return {
    data, setData, error, setError, pending, note, setNote, reviewed, setReviewed, seams, viewId, setViewId, editing, setEditing,
    stripRef, videoRef, videoSeconds, setVideoSeconds, problem, setProblem, problemText, setProblemText, toneChoice, setToneChoice,
    confirming, setConfirming, sentNotes, voiceBusy, voiceMsg, advanced, shortsOpen, setShortsOpen, sentencesKey,
    allSentences, setAllSentences, prepJob, setPrepJob, moreRef, assemblyRef, voiceProgress, onVoiceProgress,
    markSeam, refresh, renderCurrentScene, assembleScenes, humanReviewFocus, currentId, scene, candidate, previewUrl, allApproved,
    act, draftReady, reviewCurrent, seamsAll, seamsDone, planScenes, issues, sceneMode, order, shownId,
    voiceOf, generateVoice, submitTone, keys, reelOpen, setReelOpen, headRef, reasonsHost, setReasonsHost, openScene, seamAt, setSeamAt,
  };
};

export type SceneProductionModel = ReturnType<typeof useSceneProduction>;
