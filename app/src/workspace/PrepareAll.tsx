import React, { useEffect, useRef, useState } from "react";
import { api, type ScenePrepareRead } from "../api";
import { useOwnerSession } from "../shell/ownerSession";
import { ownerMessage } from "../serverMessages";
import { sceneName } from "./sceneNames";

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
}> = ({ episodeId, channelId, prepared, onOpenSettings, onChanged, order = [], className, onJob }) => {
  const owner = useOwnerSession();
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
    if (!owner.open) return setError("افتح جلسة المالك من أعلى الصفحة أولًا.");
    setStarting(true);
    setError("");
    try {
      const r = await api.startScenePrepare(episodeId, channelId, owner.secret);
      setInfo((old) => ({ ...(old ?? { voiceKey: r.voiceKey }), ...r }));
      seen.current = r.job ? `${r.job.status}:${r.job.rendered.length}:${r.job.voice.generated}` : "";
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const stop = async () => {
    if (!owner.open) return setError("افتح جلسة المالك من أعلى الصفحة أولًا.");
    setError("");
    try {
      const r = await api.stopScenePrepare(episodeId, channelId, owner.secret);
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

  return (
    <div className={`prep${className ? ` ${className}` : ""}`} role="group" aria-label="تجهيز المشاهد">
      {prepared ? <span className="prep-count" role="status">جاهز {ar(prepared.ready)} من {ar(prepared.total)}{running ? ` · ${label}` : ""}</span> : null}
      {running ? (
        <button type="button" className="btn ghost" disabled={!owner.open || job?.stopRequested} onClick={() => void stop()}
          title="يُكمل المشهد الجاري ويحفظه، ولا يبدأ غيره؛ والمسودات الجاهزة باقية">
          {job?.stopRequested ? "يتوقف بعد المشهد الجاري…" : "أوقف"}
        </button>
      ) : !allReady && (!job || job.status === "stopped" || job.status === "error") ? (
        <button type="button" className="btn ghost" disabled={starting || !owner.open} onClick={() => void start()}
          title={owner.open ? "يكمل تجهيز المشاهد الباقية بالترتيب؛ الاعتماد يبقى لك مشهدًا مشهدًا" : "افتح جلسة المالك أولًا"}>
          {starting ? "جارٍ البدء…" : label}
        </button>
      ) : null}
      {noKey ? (
        <span className="prep-note">لا يوجد مفتاح صوت: يُجهَّز ما قبل أول مشهد ينقصه صوته فقط{waitingVoice ? ` (${ar(waitingVoice)} ينتظر الصوت)` : ""}{onOpenSettings ? <> — <button type="button" className="prep-link" onClick={onOpenSettings}>الإعدادات</button></> : null}</span>
      ) : job?.voice.status === "error" && !running ? (
        <span className="prep-note is-err" title={job.voice.error}>توقف توليد الصوت: {job.voice.error?.split("\n")[0]}</span>
      ) : failed ? (
        <span className="prep-note is-err" title={job!.failed.map((f) => `${sceneName(order, f.id)}: ${ownerMessage(f.error)}`).join("\n")}>تعذّر {ar(failed)} ({sceneName(order, job!.failed[0]!.id)}): {ownerMessage(job!.failed[0]!.error.split("\n")[0]!)}</span>
      ) : failedBefore.length ? (
        <span className="prep-note" title={failedBefore.map((f) => `${sceneName(order, f.id)}: ${ownerMessage(f.error ?? "")}`).join("\n")}>لم يُعَد {sceneName(order, failedBefore[0]!.id)}{failedBefore.length > 1 ? ` و${ar(failedBefore.length - 1)} غيره` : ""}: تعذّر بالمدخلات نفسها في المرة السابقة. أعد إنتاجه بنفسه حين يصل دوره.</span>
      ) : job?.status === "stopped" ? (
        <span className="prep-note">أُوقف التجهيز؛ المسودات الجاهزة محفوظة، و«استأنف التجهيز» يكمل من حيث توقف.</span>
      ) : job?.status === "error" ? (
        <span className="prep-note is-err">{job.error}</span>
      ) : null}
      {error ? <span className="prep-note is-err" role="alert">{error}</span> : null}
    </div>
  );
};
