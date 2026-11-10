import React, { useEffect, useRef, useState } from "react";
import { api, type ScenePrepareRead } from "../api";
import { ownerMessage } from "../serverMessages";
import { nameSceneIds, sceneName, sceneNames } from "./sceneNames";
import { tones, toneIds } from "../../../src/voice/tones";

/**
 * M1: when the episode has no tone the voice cannot be made and preparing stops at once. The choice is
 * offered where the owner reads it: «لا نبرة للحلقة — اخترها هنا». Sets the episode tone only (plan.tone).
 */
export const EpisodeTonePick: React.FC<{ onPick: (tone: string) => Promise<void>; scenes: string[]; order: string[] }> = ({ onPick, scenes, order }) => {
  const [busy, setBusy] = useState(false);
  return (
    <label className="prep-tone">
      <span>لا نبرة للحلقة{scenes.length ? ` (${sceneNames(order, scenes, 4)})` : ""} — اخترها هنا:</span>{" "}
      <select value="" disabled={busy} aria-label="نبرة الصوت في الحلقة"
        onChange={(e) => { const t = e.target.value; if (!t) return; setBusy(true); void onPick(t).finally(() => setBusy(false)); }}>
        <option value="">اختر نبرة الحلقة…</option>
        {toneIds.map((t) => <option key={t} value={t}>{tones[t].nameAr}: {tones[t].useAr}</option>)}
      </select>
    </label>
  );
};

const ar = (n: number) => n.toLocaleString("ar-EG");

/**
 * Preparing the scenes (funnel v3): it starts ON ITS OWN right after «اعتمد التجهيز» (step ١) and generates
 * the missing voices, then pre-renders every remaining scene's AV draft in the background, in order. This is
 * only a status line «جاهز ١٢ من ١١٤» with «أوقف» while it runs and «استأنف» when it stopped (a Studio restart,
 * «أوقف», or an error). A finished run with scenes still waiting (no voice yet) says why instead of offering a
 * button that would skip them again. Drafts are not approvals: each scene is still watched and approved in order.
 */
export const PrepareAll: React.FC<{
  episodeId: string;
  channelId: string;
  /** From the scene ledger read: approved + submitted + current drafts, of all scenes. */
  prepared?: { ready: number; total: number };
  onOpenSettings?: () => void;
  /** Called whenever a draft lands or the queue finishes, to refresh the ledger read. */
  onChanged?: () => void;
  /** Scene ids in episode order: the owner reads «المشهد ٣», never «c1-s3» (audit item 11). */
  order?: string[];
  className?: string;
  /** The queue as last read (step ٢ uses it to say «يُجهَّز الآن» under a scene that is not ready yet). */
  onJob?: (job: ScenePrepareRead["job"]) => void;
  /** M1: set the episode's tone from the stopped line (the page saves its plan); then «استأنف التجهيز». */
  onEpisodeTone?: (tone: string) => Promise<void>;
}> = ({ episodeId, channelId, prepared, onOpenSettings, onChanged, order = [], className, onJob, onEpisodeTone }) => {
  const [info, setInfo] = useState<ScenePrepareRead | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const seen = useRef("");
  const changed = useRef(onChanged);
  changed.current = onChanged;
  const jobSeen = useRef(onJob);
  jobSeen.current = onJob;

  const load = async () => {
    try {
      const r = await api.scenePrepare(episodeId, channelId);
      setInfo(r);
      jobSeen.current?.(r.job);
      const mark = r.job ? `${r.job.status}:${r.job.rendered.length}:${r.job.voice.generated}` : "";
      if (seen.current && mark !== seen.current) changed.current?.();
      seen.current = mark;
    } catch { /* the status line is optional; the decision screen stays usable */ }
  };
  useEffect(() => { seen.current = ""; void load(); }, [episodeId, channelId]); // eslint-disable-line react-hooks/exhaustive-deps
  const running = info?.job?.status === "running";
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => void load(), 2500);
    return () => clearInterval(id);
  }, [running, episodeId, channelId]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setStarting(true);
    setError("");
    try {
      const r = await api.startScenePrepare(episodeId, channelId);
      setInfo((old) => ({ ...(old ?? { voiceKey: r.voiceKey }), ...r }));
      seen.current = r.job ? `${r.job.status}:${r.job.rendered.length}:${r.job.voice.generated}` : "";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const stop = async () => {
    setError("");
    try {
      const r = await api.stopScenePrepare(episodeId, channelId);
      setInfo((old) => ({ ...(old ?? { voiceKey: r.voiceKey }), ...r }));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const job = info?.job;
  const allReady = Boolean(prepared && prepared.total > 0 && prepared.ready >= prepared.total);
  const failed = job && !running ? job.failed.length : 0;
  const noKey = info && !info.voiceKey && (info.needVoice ?? 0) > 0;
  // Audit item 5: never «يولّد الصوت…» when no voice can be made; the blocker is said at once.
  const label = running
    ? noKey ? (job!.sceneId ? `يجهّز ${sceneName(order, job!.sceneId)}…` : "يجهّز…")
    : job!.phase === "voice" && job!.voice.status === "pending" ? "يولّد الصوت…"
      : job!.sceneId ? `يجهّز ${sceneName(order, job!.sceneId)}…` : "يجهّز…"
    : prepared && prepared.ready > 0 ? "استأنف التجهيز" : "ابدأ التجهيز";
  const waitingVoice = job?.skipped?.filter((x) => x.reason === "voice").length ?? 0;
  const failedBefore = job && !running ? job.skipped?.filter((x) => x.reason === "failed-before") ?? [] : [];
  // M1/M3: a run that finished with a voice error or failed scenes offers «استأنف التجهيز» (it retries them).
  const finishedWithErrors = Boolean(job && job.status === "done" && (job.voice.status === "error" || job.failed.length > 0 || failedBefore.length > 0));
  const toneMissing = info?.toneMissing ?? [];
  const named = (m?: string) => nameSceneIds(ownerMessage(m ?? ""), order);

  return (
    <div className={`prep${className ? ` ${className}` : ""}`} role="group" aria-label="تجهيز المشاهد">
      {prepared ? <span className="prep-count" role="status">جاهز {ar(prepared.ready)} من {ar(prepared.total)}{running ? ` — ${label}` : ""}</span> : null}
      {running ? (
        <button type="button" className="btn ghost" disabled={job?.stopRequested} onClick={() => void stop()}
          title="يُكمل المشهد الجاري ويحفظه، ولا يبدأ غيره؛ والمسودات الجاهزة باقية">
          {job?.stopRequested ? "يتوقف بعد المشهد الجاري…" : "أوقف"}
        </button>
      ) : !allReady && (!job || job.status === "stopped" || job.status === "error" || finishedWithErrors) ? (
        <button type="button" className="btn ghost" disabled={starting} onClick={() => void start()}
          title="يكمل تجهيز المشاهد الباقية بالترتيب؛ الاعتماد يبقى لك مشهدًا مشهدًا">
          {starting ? "جارٍ البدء…" : label}
        </button>
      ) : null}
      {noKey ? (
        <span className="prep-note">لا يوجد مفتاح صوت: يُجهَّز ما قبل أول مشهد ينقصه صوته فقط{waitingVoice ? ` (${ar(waitingVoice)} ينتظر الصوت)` : ""}{onOpenSettings ? <> — <button type="button" className="prep-link" onClick={onOpenSettings}>الاتصالات والمفاتيح</button></> : null}</span>
      ) : job?.voice.status === "error" && !running ? (
        <span className="prep-note is-err" title={named(job.voice.error)}>توقف توليد الصوت: {toneMissing.length && onEpisodeTone
          ? <EpisodeTonePick scenes={toneMissing} order={order} onPick={async (t) => { await onEpisodeTone(t); await load(); }} />
          : named(job.voice.error?.split("\n")[0])}</span>
      ) : failed ? (
        <span className="prep-note is-err" title={job!.failed.map((f) => `${sceneName(order, f.id)}: ${named(f.error)}`).join("\n")}>تعذّر {ar(failed)} ({sceneName(order, job!.failed[0]!.id)}): {named(job!.failed[0]!.error.split("\n")[0]!)}</span>
      ) : failedBefore.length ? (
        <span className="prep-note" title={failedBefore.map((f) => `${sceneName(order, f.id)}: ${named(f.error)}`).join("\n")}>لم يُعَد {sceneName(order, failedBefore[0]!.id)}{failedBefore.length > 1 ? ` و${ar(failedBefore.length - 1)} غيره` : ""}: تعذّر بالمدخلات نفسها في المرة السابقة. «استأنف التجهيز» يعيد محاولته.</span>
      ) : job?.status === "stopped" ? (
        <span className="prep-note">أُوقف التجهيز؛ المسودات الجاهزة محفوظة، و«استأنف التجهيز» يكمل من حيث توقف.</span>
      ) : job?.status === "error" ? (
        <span className="prep-note is-err">{named(job.error)}</span>
      ) : null}
      {error ? <span className="prep-note is-err" role="alert">{error}</span> : null}
    </div>
  );
};
