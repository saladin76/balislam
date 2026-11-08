import React, { useEffect, useState } from "react";
import { api, type LongJob } from "../api";

const ar = (n: number) => Math.round(n).toLocaleString("ar-EG");

/**
 * «اصنع النسخة النهائية» inside step ٤ itself (funnel audit 8 Nov, D36): the owner no longer bounces to
 * «النشر» and back. Same long job as the publish page (`make`, 4K with sound); the server's own gates
 * decide whether it may run. When it finishes the panel re-reads the ledger and shows «اعتماد النسخة
 * النهائية» on the new file.
 */
export const MakeMaster: React.FC<{ episodeId: string; hasVoiceKeys?: boolean; onDone: () => void }> = ({ episodeId, hasVoiceKeys, onDone }) => {
  const [job, setJob] = useState<LongJob | null>(null);
  const [err, setErr] = useState("");
  const running = job?.status === "running";
  useEffect(() => {
    let alive = true;
    api.longJobs().then((list) => {
      const live = list.find((j) => j.episode === episodeId && j.kind === "make" && j.status === "running");
      if (alive && live) setJob(live);
    }).catch(() => {});
    return () => { alive = false; };
  }, [episodeId]);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(async () => {
      const j = (await api.longJobs().catch(() => [] as LongJob[])).find((x) => x.id === job!.id);
      if (!j) return;
      setJob(j);
      if (j.status !== "running") onDone();
    }, 2000);
    return () => clearInterval(t);
  }, [running, job?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setErr("");
    try { setJob(await api.startJob({ kind: "make", episode: episodeId })); }
    catch (e) { setErr((e as Error).message); }
  };
  return (
    <>
      <button className="btn primary" type="button" disabled={running || hasVoiceKeys === false} onClick={() => void start()}>
        {running ? (job!.queued ? "في الطابور…" : `جارٍ الصنع… ${ar(job!.pct)}٪`) : "اصنع النسخة النهائية"}
      </button>
      {hasVoiceKeys === false ? <span className="sp-hint">تحتاج مفتاح الصوت من «الإعدادات».</span> : null}
      {job?.status === "error" ? <span className="sp-hint" role="alert">توقف الصنع: {job.error}</span> : null}
      {err ? <span className="sp-hint" role="alert">{err}</span> : null}
    </>
  );
};
