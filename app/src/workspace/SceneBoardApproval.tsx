import React, { useState } from "react";
import { api, type SceneProductionRead } from "../api";
import { ownerMessage } from "../serverMessages";

/**
 * B2 (funnel QA, 10 Nov): editing a sentence's text changes this scene's board, and nothing could be produced
 * for it until the owner went back to step ١. This line sits with the sentences, in step ٢: the owner reviews
 * this one board, writes what they checked, ticks «راجعته بنفسي» and presses «اعتمد لوحة هذا المشهد». The server
 * records only this board and takes the storyboard decision again (src/studio/preparation.ts · approveSceneBoard).
 */
export const SceneBoardApproval: React.FC<{
  episodeId: string; channelId: string; sceneId: string; sceneLabel: string;
  data: SceneProductionRead; onApproved: (read: SceneProductionRead) => void; onOpenPreparation?: () => void;
}> = ({ episodeId, channelId, sceneId, sceneLabel, data, onApproved, onOpenPreparation }) => {
  const [note, setNote] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changed = data.boards?.changed ?? [];
  if (!changed.includes(sceneId)) return null;
  const others = changed.length - 1;
  const approve = async () => {
    setBusy(true); setError("");
    try {
      onApproved(await api.approveSceneBoard(episodeId, channelId, { sceneId, storyboardSha256: data.storyboard.sha256, reviewed, note }));
      setNote(""); setReviewed(false);
    } catch (e) { setError(ownerMessage((e as Error).message)); } finally { setBusy(false); }
  };
  const short = note.trim().length < 25;
  return (
    <div className="sp-row sb-scene-board" role="group" aria-label={`لوحة ${sceneLabel} تغيّرت`}>
      <p className="sp-hint">تغيّرت لوحة {sceneLabel} بعد اعتماد التجهيز (نصها تغيّر). لا يُولَّد صوتها ولا يُنتج المشهد قبل اعتمادها؛ راجعها هنا ثم اعتمدها وحدها.</p>
      {others > 0 ? (
        <p className="sp-hint" role="note">تغيّرت لوحات أخرى أيضًا؛ تُعتمد معًا من «١ التجهيز».{onOpenPreparation ? <> <button type="button" className="btn-link" onClick={onOpenPreparation}>إلى التجهيز</button></> : null}</p>
      ) : (
        <>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} aria-label="ملاحظة مراجعتك لهذه اللوحة"
            placeholder="ما راجعته في هذه اللوحة فعلًا (٢٥ حرفًا على الأقل)" />
          <label><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} /> راجعته بنفسي</label>
          <button type="button" className="btn primary" disabled={busy || !reviewed || short} onClick={() => void approve()}
            title={!reviewed ? "ضع علامة «راجعته بنفسي» أولًا" : short ? "اكتب ملاحظتك (٢٥ حرفًا على الأقل)" : undefined}>
            {busy ? "يُعتمد…" : "اعتمد لوحة هذا المشهد"}
          </button>
        </>
      )}
      {error ? <p className="scene-first-error" role="alert">{error}</p> : null}
    </div>
  );
};
