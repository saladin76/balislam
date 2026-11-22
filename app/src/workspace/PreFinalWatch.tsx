import React, { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { PreFinalWatchView } from "../../../src/studio/preFinalApprove";
import { BULK_REASON_AR, playbackTracker, type Span } from "../../../src/studio/preFinalWatch";
import { sceneName } from "../../../src/i18n/sceneNames";
import { num } from "../ui/format";
import { OwnerText } from "../ui/OwnerText";

/**
 * D199 (owner decision 22 Nov): «اعتمد المشاهد التي شاهدتها كاملة في المعاينة قبل النهائية».
 * The pre-final player reports only what is really played at 1× (a seek, a skip, another speed or a pause breaks the
 * chain: src/studio/preFinalWatch.ts playbackTracker); the server keeps it for this exact file. The button shows the
 * list first — what will be approved and what will not, with why — and approves only after the owner confirms it.
 * Each scene is approved through its own «اعتمد» path and the signed log says it was approved after the pre-final.
 */
export const usePreFinalWatch = (episodeId: string, channelId: string) => {
  const [view, setView] = useState<PreFinalWatchView | null>(null);
  const tracker = useRef(playbackTracker());
  const buffer = useRef<Span[]>([]);
  const reload = async () => setView(await api.preFinalWatch(episodeId, channelId).catch(() => null));
  useEffect(() => { void reload(); }, [episodeId, channelId]); // eslint-disable-line react-hooks/exhaustive-deps
  const flush = async () => {
    if (!view?.available || !buffer.current.length) return;
    const spans = buffer.current.splice(0);
    try { await api.addPreFinalWatch(episodeId, channelId, view.fileSha256, spans); await reload(); }
    catch { /* a changed pre-final: the next reload says so */ }
  };
  const handlers = {
    onTimeUpdate: (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const v = e.currentTarget;
      const s = tracker.current.tick(v.currentTime, { paused: v.paused, rate: v.playbackRate, seeking: v.seeking });
      if (s) buffer.current.push(s);
      if (buffer.current.length >= 20) void flush();
    },
    onSeeking: () => { tracker.current.seek(); },
    onPause: () => { tracker.current.seek(); void flush(); },
  };
  return { view, reload, handlers };
};

export const PreFinalApproveWatched: React.FC<{ episodeId: string; channelId: string; order: string[]; view: PreFinalWatchView | null;
  onDone: () => void }> = ({ episodeId, channelId, order, view, onDone }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  if (!view) return null;
  if (!view.available) return <p className="sp-hint">{view.reason}</p>;
  const name = (id: string) => sceneName(order, id);
  const total = view.eligible.length + view.excluded.length;
  const confirm = async () => {
    setBusy(true); setError(""); setMsg("");
    try {
      const r = await api.approveWatchedPreFinal(episodeId, channelId, view.fileSha256, view.eligible);
      setMsg(`اعتُمد ${num(r.approved.length)} مشهد${r.failed.length ? `؛ لم يُعتمد ${num(r.failed.length)}: ${r.failed.map((f) => `${name(f.id)} (${f.error})`).join("، ")}` : ""}.`);
      setOpen(false);
      onDone();
    } catch (e) { setError((e as Error).message); onDone(); }
    finally { setBusy(false); }
  };
  return (
    <div className="pf-watch" aria-label="اعتماد ما شاهدته كاملًا">
      <p className="sp-hint">شاهدت كاملًا حتى نهايته (بلا تقديم ولا تخطٍّ وبالسرعة العادية): {num(view.eligible.length)} مشهد جاهز للاعتماد من {num(total)}.</p>
      <button type="button" className="btn" disabled={!view.eligible.length || busy} onClick={() => setOpen(true)}>
        اعتمد المشاهد التي شاهدتها كاملة في المعاينة قبل النهائية
      </button>
      {open ? (
        <div className="pf-confirm" role="dialog" aria-label="قائمة الاعتماد قبل التأكيد">
          <h4>سيُعتمد ({num(view.eligible.length)})</h4>
          <p className="sp-hint">كل مشهد هنا شاهدته كاملًا حتى نهايته في هذه المعاينة، ونسخته فيها هي نسخته الحالية، ولا ملاحظة مفتوحة عليه. يُعتمد كل مشهد كما يُعتمد وحده، ويُسجَّل في السجل الموقّع أنه اعتُمد بعد مشاهدة المعاينة قبل النهائية كاملة.</p>
          <ul>{view.eligible.map((id) => <li key={id}>{name(id)}</li>)}</ul>
          {view.excluded.length ? <>
            <h4>لن يُعتمد ({num(view.excluded.length)})</h4>
            <ul>{view.excluded.map((x) => <li key={x.id}>{name(x.id)}: {BULK_REASON_AR[x.reason]}</li>)}</ul>
          </> : null}
          <div className="sp-actions">
            <button type="button" className="btn primary" aria-busy={busy} disabled={busy} onClick={() => void confirm()}>
              {busy ? "جارٍ الاعتماد…" : `أكّد اعتماد ${num(view.eligible.length)} مشهد`}
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => setOpen(false)}>إلغاء</button>
          </div>
        </div>
      ) : null}
      {error ? <p className="scene-first-error" role="alert"><OwnerText text={error} /></p> : null}
      {msg ? <p className="sp-hint" role="status"><OwnerText text={msg} /></p> : null}
    </div>
  );
};
