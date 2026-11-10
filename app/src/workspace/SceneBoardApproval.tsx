import React, { useState } from "react";
import { api, type SceneProductionRead } from "../api";
import { ownerMessage } from "../serverMessages";

/**
 * B2 (funnel QA, 10 Nov), extended by D66: one scene edited after «اعتمد التجهيز» — its sentence text (its board)
 * and/or its narration in the script — no longer locks step ٢. Beside the sentences of that scene the owner reviews
 * it, writes what they checked, ticks «راجعته بنفسي» and presses «اعتمد تعديل هذا المشهد». The server re-records,
 * for this scene only, the script decision (when only this scene's lines differ from the approved script), its board,
 * and the storyboard decision (src/studio/preparation.ts · approveSceneBoard). Other scenes keep their approvals.
 * Anything wider (other scenes, other parts of the script) shows the server's precise reason and a way to step ١.
 */
export const SceneBoardApproval: React.FC<{
  episodeId: string; channelId: string; sceneId: string; sceneLabel: string;
  data: SceneProductionRead; onApproved: (read: SceneProductionRead) => void; onOpenPreparation?: () => void;
}> = ({ episodeId, channelId, sceneId, sceneLabel, data, onApproved, onOpenPreparation }) => {
  const [note, setNote] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const edit = data.sceneEdit ?? null;
  const changed = data.boards?.changed ?? [];
  const mine = edit ? edit.sceneId === sceneId || (edit.sceneId === null && edit.open && data.progress.currentScene === sceneId)
    : changed.includes(sceneId);
  if (!mine) return null;
  const open = edit ? edit.open : changed.length === 1;
  const approve = async () => {
    setBusy(true); setError("");
    try {
      onApproved(await api.approveSceneBoard(episodeId, channelId, {
        sceneId, storyboardSha256: data.storyboard.sha256, ...(data.script.approved ? {} : { scriptSha256: data.script.sha256 }), reviewed, note }));
      setNote(""); setReviewed(false);
    } catch (e) { setError(ownerMessage((e as Error).message)); } finally { setBusy(false); }
  };
  const what = edit?.script && edit.board ? "نص جملته في المشهد وفي السكريبت" : edit?.script ? "نصه في السكريبت" : "نص جملته";
  const short = note.trim().length < 25;
  return (
    <div className="sp-row sb-scene-board" role="group" aria-label={`${sceneLabel} تغيّر بعد اعتماد التجهيز`}>
      <p className="sp-hint">تغيّر {what} في {sceneLabel} بعد اعتماد التجهيز. لا يُولَّد صوته ولا يُنتج قبل اعتماد هذا التعديل؛ بقية المشاهد تبقى معتمدة كما هي.</p>
      {!open ? (
        <p className="sp-hint" role="note">{edit?.reason ?? "تغيّرت لوحات أخرى أيضًا؛ تُعتمد معًا من «١ التجهيز»."}{onOpenPreparation ? <> <button type="button" className="btn-link" onClick={onOpenPreparation}>إلى التجهيز</button></> : null}</p>
      ) : (
        <>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} aria-label="ملاحظة مراجعتك لهذا المشهد"
            placeholder="ما راجعته في هذا المشهد بعد تعديله (٢٥ حرفًا على الأقل)" />
          <label><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} /> راجعته بنفسي</label>
          <button type="button" className="btn primary" disabled={busy || !reviewed || short} onClick={() => void approve()}
            title={!reviewed ? "ضع علامة «راجعته بنفسي» أولًا" : short ? "اكتب ملاحظتك (٢٥ حرفًا على الأقل)" : undefined}>
            {busy ? "يُعتمد…" : "اعتمد تعديل هذا المشهد"}
          </button>
          <p className="sp-hint">{edit?.script ? "يُسجَّل اعتماد السكريبت (الذي تغيّر فيه هذا المشهد وحده) ثم " : "يُسجَّل "}لوحة هذا المشهد وحدها ويُجدَّد اعتماد الستوري بورد؛ ولا يُفتح غيره من المشاهد.</p>
        </>
      )}
      {error ? <p className="scene-first-error" role="alert">{error}</p> : null}
    </div>
  );
};
