import React from "react";
import type { StoryboardStatus } from "../../../src/plan/storyboard";
import { AFTER_PREPARATION_WHAT, type AfterPreparationWhat } from "../api";

const ar = (n: number) => n.toLocaleString("ar-EG");

/**
 * Funnel v3 (owner decision 8 Nov): the board review note is written next to «اعتمد التجهيز» in step ١
 * (one button records the script approval, this board record and the storyboard approval in order), so the
 * full log (history, the reviewer's note, «اسحب الاعتماد») lives under «أدوات وتفاصيل».
 *
 * 11 Nov (owner): «اعتمد التجهيز» once per episode. A change after it is recorded by the ledger as «تحديث بعد التجهيز»;
 * the top of the storyboard only lists the scenes it re-opened (informative), each a link to that scene in step ٢,
 * where it is reviewed like any other scene. There is no second approval of boards.
 */
export const AfterPreparationList: React.FC<{
  scenes: { id: string; what: AfterPreparationWhat[] }[];
  name: (id: string) => string;
  onOpenScene: (id: string) => void;
}> = ({ scenes, name, onOpenScene }) => scenes.length ? (
  <section className="s12-tool sb-after-prep" aria-label="تغيّر بعد التجهيز">
    <h3 className="s12-h">تغيّر بعد التجهيز</h3>
    <p className="s12-soft">سُجّل التغيير وحده. هذه المشاهد تُراجَع في «٢ المشاهد» كأي مشهد؛ لا اعتماد ثانٍ للتجهيز.</p>
    <div className="s12-row">
      {scenes.map((x) => (
        <button key={x.id} type="button" className="ms-link" onClick={() => onOpenScene(x.id)}
          title={x.what.map((w) => AFTER_PREPARATION_WHAT[w]).join("، ")}>{name(x.id)}</button>
      ))}
    </div>
  </section>
) : null;

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
    {st ? <p className="s12-soft">معتمد {ar(st.approved)} من {ar(st.total)}{st.changed.length ? ` — تغيّر بعد الاعتماد: ${st.changed.join("، ")}` : ""}</p> : null}
    {st?.audit?.note ? <p className="s12-soft">ملاحظة اعتماد المراجع: {st.audit.note}</p> : null}
    {channelId === "zubdat-alkutub" && episodeId === "001" ? (
      <p><a href="https://drive.google.com/file/d/1MTtTbSufZN2N0OFueEAjsOlLiaBSglMd/view" target="_blank" rel="noreferrer">فتح PDF المرئي V021 — 31 مشهدًا (PENDING_REVIEW، ليس اعتمادًا)</a></p>
    ) : null}
    {channelId === "dafatir-alzaman" && episodeId === "001" ? (
      <p><a href="https://github.com/saladin76/balislam/blob/main/channels/dafatir-alzaman/episodes/001-adam-beginning/tech-reviews/020/docs/storyboard-001-v1.1.pdf" target="_blank" rel="noreferrer">فتح Storyboard V1.1 — 80 مشهدًا (نسخة GitHub، نقل Drive لم يُتحقق منه)</a></p>
    ) : null}
    <label htmlFor="sb-visual-review-note" className="s12-soft">ملاحظة المراجع (اختيارية، سطر واحد)</label>
    <input id="sb-visual-review-note" type="text" value={note} maxLength={300}
      onChange={(e) => onNote(e.target.value.replace(/[\r\n]+/g, " "))}
      placeholder="ملاحظة (اختيارية، سطر واحد)" />
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
