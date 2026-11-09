import React, { useEffect, useState } from "react";
import { api, type LongJob } from "../api";
import { KeysLink } from "../ui/KeysLink";
import { num } from "../ui/format";

const ar = (n: number) => num(Math.round(n));

/**
 * «اصنع النسخة النهائية» inside step ٣ itself (funnel audit 8 Nov, D36): the owner no longer bounces to
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
      {/* No disabled primary (D52): without a voice key the real next action is adding it. */}
      {hasVoiceKeys === false ? (
        <><KeysLink className="btn primary">أضف مفتاح الصوت</KeysLink><span className="sp-hint">النسخة النهائية تحتاج مفتاح الصوت من <KeysLink /> أولًا.</span></>
      ) : (
        <button className="btn primary" type="button" aria-busy={running} onClick={() => { if (!running) void start(); }}>
          {running ? (job!.queued ? "في الطابور…" : `جارٍ الصنع… ${ar(job!.pct)}٪`) : "اصنع النسخة النهائية"}
        </button>
      )}
      {job?.status === "error" ? <span className="sp-hint" role="alert">توقف الصنع: {job.error}</span> : null}
      {err ? <span className="sp-hint" role="alert">{err}</span> : null}
    </>
  );
};
