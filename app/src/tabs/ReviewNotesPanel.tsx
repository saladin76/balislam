import React, { useEffect, useState } from "react";
import { api, type StudioReviewNote } from "../api";

const formatTime = (sec: number) => Math.floor(sec / 60) + ":" + String(Math.floor(sec % 60)).padStart(2, "0");
export const ReviewNotesPanel: React.FC<{
  episodeId: string; sceneIds: string[]; onOpenScene: (id: string) => void;
}> = ({ episodeId, sceneIds, onOpenScene }) => {
  const [notes, setNotes] = useState<StudioReviewNote[]>([]);
  const [sceneId, setSceneId] = useState(sceneIds[0] || "");
  const [time, setTime] = useState("0");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let live = true;
    api.reviewNotes(episodeId).then((x) => live && setNotes(x.notes)).catch((e: Error) => live && setMessage(e.message));
    return () => { live = false; };
  }, [episodeId]);
  useEffect(() => {
    if (!sceneIds.includes(sceneId)) setSceneId(sceneIds[0] || "");
  }, [sceneIds, sceneId]);
  const save = async (next: StudioReviewNote[]) => {
    setBusy(true); setMessage("");
    try {
      const result = await api.saveReviewNotes(episodeId, next);
      setNotes(result.notes);
      setText("");
      setMessage("حُفظت ملاحظات المراجعة دون تغيير اعتماد الحلقة.");
    } catch (e) {
      setMessage("تعذّر حفظ الملاحظة: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const add = () => {
    const sec = Number(time);
    if (!sceneId || !text.trim() || !Number.isFinite(sec) || sec < 0 || sec > 86400) {
      setMessage("حدد المشهد، والتوقيت بالثواني، واكتب ملاحظة واضحة.");
      return;
    }
    void save([...notes, { id: crypto.randomUUID(), sceneId, timeSec: sec, text: text.trim(), createdAt: new Date().toISOString() }]);
  };
  const copy = async () => {
    const content = ["# ملاحظات مراجعة الحلقة " + episodeId, "الحالة: ملاحظات إصلاح، ليست اعتمادًا.", ...notes.map((n) =>
      "- المشهد " + n.sceneId + " عند " + formatTime(n.timeSec) + ": " + n.text)].join("\n");
    try { await navigator.clipboard.writeText(content); setMessage("تم نسخ ملاحظات المراجعة لإرسالها إلى Claude."); }
    catch { setMessage("تعذّر النسخ إلى الحافظة."); }
  };
  return <section className="sb-notebook" aria-labelledby="sb-notebook-title">
    <div className="sb-notebook-head"><div><h3 id="sb-notebook-title">دفتر ملاحظات المراجعة</h3>
      <p className="help">دوّن إصلاحًا مرتبطًا بمشهد وتوقيت محدد. الملاحظات لا تغيّر حالة الاعتماد.</p></div>
      <button type="button" className="btn" onClick={() => void copy()} disabled={!notes.length}>نسخ أمر الإصلاح ({notes.length})</button>
    </div>
    <div className="sb-notebook-form">
      <label>المشهد<select value={sceneId} onChange={(e) => setSceneId(e.target.value)}>
        {sceneIds.map((id) => <option key={id} value={id}>{id}</option>)}
      </select></label>
      <label>التوقيت (ثانية)<input type="number" min="0" max="86400" step="0.1" value={time} onChange={(e) => setTime(e.target.value)} /></label>
      <label className="sb-notebook-text">الملاحظة<textarea rows={2} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder="ما المشكلة؟ ما التصحيح المطلوب؟" /></label>
      <button type="button" className="btn primary" onClick={add} disabled={busy || !sceneIds.length}>حفظ الملاحظة</button>
    </div>
    {message && <p role="status" className="help">{message}</p>}
    {!!notes.length && <div className="sb-notebook-list">{notes.map((note) => <div key={note.id}>
      <button type="button" className="linkish" onClick={() => onOpenScene(note.sceneId)}>{note.sceneId} · {formatTime(note.timeSec)}</button>
      <p>{note.text}</p>
      <button type="button" className="btn small" onClick={() => void save(notes.filter((n) => n.id !== note.id))} disabled={busy}>حذف الملاحظة</button>
    </div>)}</div>}
  </section>;
};
