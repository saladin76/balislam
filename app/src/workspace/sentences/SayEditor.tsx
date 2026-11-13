/**
 * «النطق» (طلب صاحب المشروع ١٣ نوفمبر، D131): لكل جملة راوٍ في القنوات الثلاث، ظاهر دائمًا ويُعدَّل مباشرة. هو النص
 * الذي يُرسل إلى الصوت بتشكيله، لا نص الجملة: حفظه لا يغيّر نص الجملة ولا نص المشهد ولا السكريبت ولا الترجمة، ويجعل
 * تسجيلها «تحتاج توليدًا» دون أن يولّد شيئًا. لا يظهر لصف آية ولا بسملة (لا يُرسلان إلى الصوت أبدًا)، والخادم يرفض
 * فيه القرآن والبسملة والتشكيل تحت ٩٨٪.
 */
import React from "react";
import type { SentenceRow } from "../../api";
import type { SentencesModel } from "./useSentences";
import { ar } from "./format";

export const SAY_LABEL = "النطق";
export const SAY_HINT = "ما يُرسل إلى الصوت بتشكيله؛ لا يغيّر نص الجملة ولا السكريبت ولا الترجمة.";

export const SayEditor: React.FC<{ m: SentencesModel; r: SentenceRow; n: number }> = ({ m, r, n }) => {
  const { sayDrafts, setSayDrafts, busy, run, ref } = m;
  if (r.kind !== "narration" || !r.say) return null;
  const draft = sayDrafts[r.id];
  const value = draft ?? r.spoken;
  const dirty = draft !== undefined && draft.trim().split(/\s+/).join(" ") !== r.spoken;
  const anyBusy = Boolean(busy);
  const drop = () => setSayDrafts(({ [r.id]: _x, ...rest }) => rest);
  return (
    <div className={`sv-say${r.say.custom ? " is-custom" : ""}`}>
      <label className="sv-say-lb" htmlFor={`say-${r.id}`}>
        <b>{SAY_LABEL}:</b> <small>{r.say.custom ? "مكتوب بيدك لهذه الجملة" : "آلي"} — {SAY_HINT}</small>
      </label>
      <textarea id={`say-${r.id}`} className="sv-say-text" dir="rtl" rows={Math.max(1, Math.ceil(value.length / 70))} value={value}
        aria-label={`نطق الجملة ${ar(n)}`} disabled={anyBusy} spellCheck={false}
        onChange={(e) => setSayDrafts({ ...sayDrafts, [r.id]: e.target.value })} />
      {dirty || r.say.custom ? (
        <div className="sv-dirty">
          {dirty ? <>
            <button type="button" className="btn" disabled={anyBusy || !draft!.trim()} onClick={async () => {
              if (await run(`say:${r.id}`, { ...ref(r), action: "say", pronunciation: draft! })) drop();
            }}>{busy === `say:${r.id}` ? "جارٍ الحفظ…" : "احفظ النطق"}</button>
            <button type="button" className="btn ghost" onClick={drop}>تراجع</button>
            <span className="sp-hint">تحتاج الجملة بعده توليدًا («ولّد الجملة»)؛ لا يُولَّد شيء وحده.</span>
          </> : null}
          {r.say.custom ? (
            <button type="button" className="btn ghost" disabled={anyBusy} title={`النطق الآلي: ${r.say.auto}`} onClick={async () => {
              if (await run(`say:${r.id}`, { ...ref(r), action: "say", pronunciation: null })) drop();
            }}>ارجع إلى النطق الآلي</button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
