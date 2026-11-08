import React, { useEffect, useRef, useState } from "react";
import { api, type ScenePrepareRead } from "../api";
import { useOwnerSession } from "../shell/ownerSession";
import { ownerMessage } from "../serverMessages";
import { sceneName } from "./sceneNames";

const ar = (n: number) => n.toLocaleString("ar-EG");

/**
 * «جهّز كل المشاهد»: one owner action (step ٣ screen and the spine) that generates the missing voices
 * and pre-renders every remaining scene's AV draft in the background, in order. A compact line shows
 * «جاهز ١٢ من ٣١». Drafts are not approvals: each scene is still watched and approved in order.
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
}> = ({ episodeId, channelId, prepared, onOpenSettings, onChanged, order = [], className }) => {
  const owner = useOwnerSession();
  const [info, setInfo] = useState<ScenePrepareRead | null>(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const seen = useRef("");
  const changed = useRef(onChanged);
  changed.current = onChanged;

  const load = async () => {
    try {
      const r = await api.scenePrepare(episodeId, channelId);
      setInfo(r);
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
  const noKey = info && !info.voiceKey && (info.needVoice ?? 0) > 0;
  const failed = job && !running ? job.failed.length : 0;
  // Audit item 5: never «يولّد الصوت…» when no voice can be made; the blocker is said at once.
  const label = running
    ? job!.phase === "voice" && job!.voice.status === "pending" ? "يولّد الصوت…"
      : job!.sceneId ? `يجهّز ${sceneName(order, job!.sceneId)}…` : "يجهّز…"
    : prepared && prepared.ready > 0 ? "جهّز الباقي" : "جهّز كل المشاهد";
  const waitingVoice = job?.skipped?.filter((x) => x.reason === "voice").length ?? 0;
  const failedBefore = job && !running ? job.skipped?.filter((x) => x.reason === "failed-before") ?? [] : [];

  return (
    <div className={`prep${className ? ` ${className}` : ""}`} role="group" aria-label="تجهيز المشاهد">
      {!allReady || running ? (
        <button type="button" className="btn" disabled={running || starting || !owner.open} onClick={() => void start()}
          title={owner.open ? "يولّد الصوت الناقص ويُنتج مسودة كل مشهد بالترتيب؛ الاعتماد يبقى لك مشهدًا مشهدًا" : "افتح جلسة المالك أولًا"}>
          {starting ? "جارٍ البدء…" : label}
        </button>
      ) : null}
      {running ? (
        <button type="button" className="btn ghost" disabled={!owner.open || job?.stopRequested} onClick={() => void stop()}
          title="يُكمل المشهد الجاري ويحفظه، ولا يبدأ غيره؛ والمسودات الجاهزة باقية">
          {job?.stopRequested ? "يتوقف بعد المشهد الجاري…" : "أوقف"}
        </button>
      ) : null}
      {prepared ? <span className="prep-count" role="status">جاهز {ar(prepared.ready)} من {ar(prepared.total)}</span> : null}
      {noKey ? (
        <span className="prep-note">لا يوجد مفتاح صوت: يُجهَّز ما قبل أول مشهد ينقصه صوته فقط{waitingVoice ? ` (${ar(waitingVoice)} ينتظر الصوت)` : ""}{onOpenSettings ? <> — <button type="button" className="prep-link" onClick={onOpenSettings}>الإعدادات</button></> : null}</span>
      ) : job?.voice.status === "error" && !running ? (
        <span className="prep-note is-err" title={job.voice.error}>توقف توليد الصوت: {job.voice.error?.split("\n")[0]}</span>
      ) : failed ? (
        <span className="prep-note is-err" title={job!.failed.map((f) => `${sceneName(order, f.id)}: ${ownerMessage(f.error)}`).join("\n")}>تعذّر {ar(failed)} ({sceneName(order, job!.failed[0]!.id)}): {ownerMessage(job!.failed[0]!.error.split("\n")[0]!)}</span>
      ) : failedBefore.length ? (
        <span className="prep-note" title={failedBefore.map((f) => `${sceneName(order, f.id)}: ${ownerMessage(f.error ?? "")}`).join("\n")}>لم يُعَد {sceneName(order, failedBefore[0]!.id)}{failedBefore.length > 1 ? ` و${ar(failedBefore.length - 1)} غيره` : ""}: تعذّر بالمدخلات نفسها في المرة السابقة. أعد إنتاجه بنفسه حين يصل دوره.</span>
      ) : job?.status === "stopped" ? (
        <span className="prep-note">أُوقف التجهيز؛ المسودات الجاهزة محفوظة، و«{prepared && prepared.ready > 0 ? "جهّز الباقي" : "جهّز كل المشاهد"}» يكمل من حيث توقف.</span>
      ) : job?.status === "error" ? (
        <span className="prep-note is-err">{job.error}</span>
      ) : null}
      {error ? <span className="prep-note is-err" role="alert">{error}</span> : null}
    </div>
  );
};
