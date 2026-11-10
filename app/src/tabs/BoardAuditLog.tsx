import React from "react";
import type { StoryboardStatus } from "../../../src/plan/storyboard";

const ar = (n: number) => n.toLocaleString("ar-EG");

/**
 * Funnel v3 (owner decision 8 Nov): the board review note is written next to «اعتمد التجهيز» in step ١
 * (one button records the script approval, this board record and the storyboard approval in order), so the
 * full log (history, the reviewer's note, «اسحب الاعتماد») lives under «أدوات وتفاصيل».
 *
 * P-05 (10 Nov): when boards changed AFTER a recorded review, the log comes to the top of step ١ as the list
 * of those boards (`ChangedBoards`), so the owner sees exactly what to review again; the one action stays the
 * dock's «اعتمد اللوحات المتغيّرة» (one filled button per screen).
 */
export const auditLogOnTop = (st: StoryboardStatus | undefined | null) =>
  Boolean(st && st.audit?.note?.trim() && st.approved > 0 && (st.changed.length > 0 || st.fresh.length > 0));

/** The boards to review again, in episode order (changed after the record, or new). */
export const changedBoardIds = (st: StoryboardStatus) => Object.keys(st.scenes).filter((id) => st.scenes[id] !== "approved");

export const ChangedBoards: React.FC<{
  st: StoryboardStatus;
  name: (id: string) => string;
  onOpen: (id: string) => void;
}> = ({ st, name, onOpen }) => {
  const ids = changedBoardIds(st);
  return (
    <section className="s12-tool sb-changed-boards" aria-label="لوحات تغيّرت بعد اعتماد التجهيز">
      <h3 className="s12-h">{ids.length === 1 ? "لوحة تغيّرت" : `${ar(ids.length)} ${ids.length <= 10 ? "لوحات تغيّرت" : "لوحة تغيّرت"}`} بعد اعتماد التجهيز</h3>
      <p className="s12-soft">راجع هذه وحدها، ثم اكتب ملاحظتك واضغط «اعتمد اللوحات المتغيّرة» أسفل الشاشة. بقية اللوحات ومشاهدها المعتمدة لا تُفتح من جديد.</p>
      <div className="s12-row">
        {ids.map((id) => (
          <button key={id} type="button" className="ms-link" onClick={() => onOpen(id)}>
            {name(id)}{st.scenes[id] === "new" ? " (جديدة)" : ""}
          </button>
        ))}
      </div>
      {st.audit?.note ? <p className="s12-soft">ملاحظة المراجعة السابقة: {st.audit.note}</p> : null}
    </section>
  );
};

export const BoardAuditLog: React.FC<{
  st: StoryboardStatus | undefined | null;
  channelId: string;
  episodeId: string;
  note: string;
  onNote: (v: string) => void;
  reviewed: boolean;
  onReviewed: (v: boolean) => void;
  busy: boolean;
  onAct: (action: "approve" | "revoke") => void;
  error?: string;
}> = ({ st, channelId, episodeId, note, onNote, reviewed, onReviewed, busy, onAct, error }) => (
  <section className="s12-tool sb-visual-approval" aria-label="مراجعة Storyboard المرئي">
    <h3 className="s12-h">سجل مراجعة اللوحات</h3>
    {st ? <p className="s12-soft">معتمد {ar(st.approved)} من {ar(st.total)}{st.changed.length ? ` · تغيّر بعد الاعتماد: ${st.changed.join("، ")}` : ""}</p> : null}
    {st?.audit?.note ? <p className="s12-soft">ملاحظة اعتماد المراجع: {st.audit.note}</p> : null}
    {channelId === "zubdat-alkutub" && episodeId === "001" ? (
      <p><a href="https://drive.google.com/file/d/1MTtTbSufZN2N0OFueEAjsOlLiaBSglMd/view" target="_blank" rel="noreferrer">فتح PDF المرئي V021 — 31 مشهدًا (PENDING_REVIEW، ليس اعتمادًا)</a></p>
    ) : null}
    {channelId === "dafatir-alzaman" && episodeId === "001" ? (
      <p><a href="https://github.com/saladin76/balislam/blob/main/channels/dafatir-alzaman/episodes/001-adam-beginning/tech-reviews/020/docs/storyboard-001-v1.1.pdf" target="_blank" rel="noreferrer">فتح Storyboard V1.1 — 80 مشهدًا (نسخة GitHub، نقل Drive لم يُتحقق منه)</a></p>
    ) : null}
    <label htmlFor="sb-visual-review-note" className="s12-soft">ملاحظة المراجع: إصدار اللوحات، نطاق المشاهدة، والتعديلات المطلوبة أو سبب الموافقة</label>
    <textarea id="sb-visual-review-note" value={note} rows={3} maxLength={3000}
      onChange={(e) => onNote(e.target.value)}
      placeholder="راجعت كل لوحات الإصدار ...، والتكوين والنصوص متطابقة، والمشاهد التي تحتاج إصلاحًا..." />
    <label className="s12-check"><input type="checkbox" checked={reviewed} onChange={(e) => onReviewed(e.target.checked)} />
      أؤكد أنني شاهدت جميع اللوحات المرئية لهذه الحلقة، وليس عينات متفرقة فقط.</label>
    <div className="s12-row">
      {st?.ok ? (
        <button className="btn" onClick={() => onAct("revoke")} disabled={busy}>اسحب الاعتماد</button>
      ) : (
        <button className="btn" onClick={() => onAct("approve")} disabled={busy || !st}>تسجيل اعتماد اللوحات المرئية</button>
      )}
    </div>
    {error ? <p className="s12-alert" role="alert">{error}</p> : null}
  </section>
);
