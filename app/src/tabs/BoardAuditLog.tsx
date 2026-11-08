import React from "react";
import type { StoryboardStatus } from "../../../src/plan/storyboard";

const ar = (n: number) => n.toLocaleString("ar-EG");

/**
 * Funnel v3 (owner decision 8 Nov): the board review note is now written next to «اعتمد التجهيز» in step ١
 * (one button records the script approval, this board record and the storyboard approval in order), so this
 * log always lives under «أدوات وتفاصيل» (history, the reviewer's note, «اسحب الاعتماد»). Audit item 13's
 * "on top while unrecorded" placement is retired: one filled button per screen.
 */
export const auditLogOnTop = (_st: StoryboardStatus | undefined | null) => false;

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
