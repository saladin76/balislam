import React from "react";
import type { StoryboardStatus } from "../../../src/plan/storyboard";
import { AFTER_PREPARATION_WHAT, type AfterPreparationWhat } from "../api";

const ar = (n: number) => n.toLocaleString("ar-EG");

/**
 * Funnel v3 (owner decision 8 Nov): the board review note is written next to «اعتمد التجهيز» in step ١ (one button
 * records the script approval, this board record and the storyboard approval in order).
 *
 * 11 Nov (owner, D76): «اعتمد التجهيز» once per episode. A change after it is recorded by the ledger as «تحديث بعد التجهيز»;
 * the top of the storyboard only lists the scenes it re-opened (informative), each a link to that scene in step ٢,
 * where it is reviewed like any other scene. There is no second approval of boards.
 *
 * 12 Nov (QA balislam 1): «سجل مراجعة اللوحات» under «أدوات وتفاصيل» is READ-ONLY history. It used to carry
 * «اسحب الاعتماد», which emptied the board record in one click and re-opened step ١ (against D76), and the legacy
 * «تسجيل اعتماد اللوحات المرئية». Both are gone, and the server refuses a withdrawal (PUT storyboard «revoke»).
 */
export const AfterPreparationList: React.FC<{
  scenes: { id: string; what: AfterPreparationWhat[] }[];
  /** QA dafatir M5: the latest change touched the script only (no scene re-opened); said, never silent. */
  scriptOnly?: boolean;
  name: (id: string) => string;
  onOpenScene: (id: string) => void;
}> = ({ scenes, scriptOnly, name, onOpenScene }) => scenes.length || scriptOnly ? (
  <section className="s12-tool sb-after-prep" aria-label="تغيّر بعد التجهيز">
    <h3 className="s12-h">تغيّر بعد التجهيز</h3>
    {scriptOnly ? <p className="s12-soft">آخر تحديث غيّر السكريبت وحده ولم يغيّر نص أي مشهد؛ سُجّل في السجل ولا يُطلب شيء.</p> : null}
    {scenes.length ? <p className="s12-soft">سُجّل التغيير وحده. هذه المشاهد تُراجَع في «٢ المشاهد» كأي مشهد؛ لا اعتماد ثانٍ للتجهيز.</p> : null}
    {scenes.length ? <div className="s12-row">
      {scenes.map((x) => (
        <button key={x.id} type="button" className="ms-link" onClick={() => onOpenScene(x.id)}
          title={x.what.map((w) => AFTER_PREPARATION_WHAT[w]).join("، ")}>{name(x.id)}</button>
      ))}
    </div> : null}
  </section>
) : null;

export const BoardAuditLog: React.FC<{
  st: StoryboardStatus | undefined | null;
  channelId: string;
  episodeId: string;
}> = ({ st, channelId, episodeId }) => (
  <section className="s12-tool sb-visual-approval" aria-label="سجل مراجعة اللوحات">
    <h3 className="s12-h">سجل مراجعة اللوحات</h3>
    {st ? <p className="s12-soft">سُجّلت مراجعة {ar(st.approved)} من {ar(st.total)} لوحة{st.audit?.at ? ` (${new Date(st.audit.at).toLocaleDateString("ar-EG")})` : ""}.</p> : null}
    {st?.audit?.note ? <p className="s12-soft">ملاحظتك مع «اعتمد التجهيز»: {st.audit.note}</p> : null}
    <p className="s12-soft">للقراءة فقط: التجهيز يُعتمد مرة واحدة للحلقة، وما يتغيّر بعده يسجّله النظام وتُراجَع مشاهده في «٢ المشاهد».</p>
    {channelId === "zubdat-alkutub" && episodeId === "001" ? (
      <p><a href="https://drive.google.com/file/d/1MTtTbSufZN2N0OFueEAjsOlLiaBSglMd/view" target="_blank" rel="noreferrer">فتح PDF المرئي V021 — 31 مشهدًا (PENDING_REVIEW، ليس اعتمادًا)</a></p>
    ) : null}
    {channelId === "dafatir-alzaman" && episodeId === "001" ? (
      <p><a href="https://github.com/saladin76/balislam/blob/main/channels/dafatir-alzaman/episodes/001-adam-beginning/tech-reviews/020/docs/storyboard-001-v1.1.pdf" target="_blank" rel="noreferrer">فتح Storyboard V1.1 — 80 مشهدًا (نسخة GitHub، نقل Drive لم يُتحقق منه)</a></p>
    ) : null}
  </section>
);
