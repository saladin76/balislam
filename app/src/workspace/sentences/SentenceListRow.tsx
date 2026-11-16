/**
 * «الجمل» in the whole-episode list («أدوات وتفاصيل»): one row per sentence — its text (edited in place), its
 * words, its notes, «ولّد»، play, tone, pause, and «⋯» (split, merge, add, restore, heard, delete).
 */
import React from "react";
import type { SentenceRow, SentenceScene } from "../../api";
import { tones, toneIds } from "../../../../src/voice/tones";
import { OLDER_TONE, PAUSES, STATUS, ar, inheritLabel, secAr } from "./format";
import { PlayControl, SentenceFixLine, SentenceSplit, TakeNote, WordChips, type SentencesPart } from "./SentenceParts";
import { SayEditor } from "./SayEditor";
import { SentenceSpeed } from "../../ui/Pace";

export const SentenceListRow: React.FC<SentencesPart & { s: SentenceScene; r: SentenceRow; i: number }> = ({ m, s, r, i }) => {
  const { read, drafts, setDrafts, busy, noKey, playing_, rowKeys, carets, run, ref, chipsFor, setSplitting, setAdding, adding } = m;
  const draft = drafts[r.id];
  const dirty = draft !== undefined && draft.trim() !== r.text;
  const status = r.virtual && s.audio.state === "scene" ? "scene" : r.status;
  const b = (x: string) => busy === `${x}:${r.id}`;
  const anyBusy = Boolean(busy);
  const canGen = r.kind === "narration" && !noKey && r.tashkeel.ok && !anyBusy;
  const genLabel = b("gen") ? "جارٍ التوليد…" : r.audio && r.status !== "missing" ? "أعد التوليد" : "ولّد";
  const why = r.kind === "basmala" ? "البسملة بصوتك: ارفع التسجيل تحت الفقرة؛ لا ينطقها الصوت المستنسخ."
    : r.kind === "verse" ? "نص قرآني: الصوت المستنسخ لا يتلوه."
    : !r.tashkeel.ok ? `التشكيل ${ar(Math.round(r.tashkeel.coverage * 100))}٪ (الحد ٩٨٪): ${r.tashkeel.missing.slice(0, 5).join("، ")}`
    : null;
  const next = s.rows[i + 1];
  return (
    <li className={`sv-row is-${status}${playing_(r.id) ? " is-playing" : ""}`} tabIndex={0} onKeyDown={rowKeys(s, r)}>
      <span className="sv-n" aria-hidden>{ar(i + 1)}</span>
      <div className="sv-main">
        <textarea className="sv-text" dir="rtl" rows={Math.max(1, Math.ceil((draft ?? r.text).length / 70))} value={draft ?? r.text}
          aria-label={`نص الجملة ${ar(i + 1)}`} disabled={anyBusy}
          onChange={(e) => setDrafts({ ...drafts, [r.id]: e.target.value })}
          onSelect={(e) => { carets.current[r.id] = (e.target as HTMLTextAreaElement).selectionStart; }} />
        {dirty ? (
          <div className="sv-dirty">
            <button type="button" className="btn" disabled={anyBusy || !draft!.trim()} onClick={async () => {
              if (await run(`edit:${r.id}`, { ...ref(r), action: "edit", text: draft }, { edits: true })) setDrafts(({ [r.id]: _x, ...rest }) => rest);
            }}>{b("edit") ? "جارٍ الحفظ…" : "احفظ النص"}</button>
            <button type="button" className="btn ghost" onClick={() => setDrafts(({ [r.id]: _x, ...rest }) => rest)}>تراجع</button>
            <span className="sp-hint">يُكتب في نص المشهد، فيعود المشهد لمراجعة جديدة.</span>
          </div>
        ) : null}
        <SentenceSplit m={m} r={r} n={i + 1} />
        {!dirty && chipsFor(r) ? <div className="sv-words-wrap"><WordChips m={m} r={r} />{!r.wordFix.ok && !r.wordFix.adopt && r.wordFix.reason ? <p className="sp-hint sv-words-why">إعادة نطق كلمة: {r.wordFix.reason}</p> : null}</div> : null}
        <SentenceFixLine m={m} r={r} />
        <SayEditor m={m} r={r} n={i + 1} />
        {r.applied.length && r.kind === "narration" ? (
          <p className="sv-spoken sv-applied"><span>{r.appliedState === "sent" ? "نُطقت:" : "ستُنطق:"}</span> {r.applied.map((a) => `${a.word} ← ${a.say}`).join("، ")}</p>
        ) : null}
        {why ? <p className="sv-why">{why}</p> : null}
        <TakeNote m={m} r={r} />
        {r.contextChanged ? <p className="sp-hint">تغيّر ما حولها منذ توليدها؛ أعد توليدها إن بدا الوصل غير طبيعي.</p> : null}
      </div>
      <div className="sv-ctl">
        <span className={`sv-chip is-${status}`}>{STATUS[status]}</span>
        {r.audio?.origin === "scene" ? <small className="sv-origin">من صوت المشهد</small> : null}
        {r.olderTone ? <small className="sv-origin sv-older" title="تسجيلها صالح ولم يُعد توليده آليًا؛ عادت أول نسخة من النبرات (١٢ نوفمبر). «أعد توليد ما وُلّد بنبرة سابقة» في أعلى القائمة.">{OLDER_TONE}</small> : null}
        {r.kind === "narration" ? (
          <button type="button" className={`btn${r.status === "missing" || r.status === "stale" || r.status === "old" ? "" : " ghost"}`} disabled={!canGen}
            title={noKey ? "يتطلب مفتاح الصوت من «الاتصالات والمفاتيح»" : why ?? ""}
            onClick={() => void run(`gen:${r.id}`, { ...ref(r), action: "generate" })}>{genLabel}</button>
        ) : null}
        <PlayControl m={m} s={s} r={r} n={i + 1} cls="btn ghost sv-play" icons={false} />
        <select className="sv-tone" aria-label="نبرة الجملة" value={r.tone} disabled={anyBusy || r.kind !== "narration"}
          title={r.toneSource === "map" ? `اختيار نبرة هنا يكتب إصدارًا جديدًا من خريطة النبرة (${read!.toneMap?.version ?? ""}) لهذه الجملة وحدها` : ""}
          onChange={(e) => void run(`tone:${r.id}`, { ...ref(r), action: "tone", tone: e.target.value || null })}>
          <option value="">{inheritLabel(r)}</option>
          {toneIds.map((t) => <option key={t} value={t}>{tones[t].nameAr}</option>)}
        </select>
        {r.kind === "narration" ? <SentenceSpeed episodeId={m.episodeId} channelId={m.channelId} sceneId={r.sceneId} text={r.text} speed={r.speed}
          inherited={r.inheritedSpeed} exempt={r.paceExempt} disabled={anyBusy} onSaved={() => void m.load()} /> : null}
        {!r.last ? (
          <select className="sv-pause" aria-label="الوقفة بعد الجملة" value={r.pauseAfterMs} disabled={anyBusy}
            onChange={(e) => void run(`pause:${r.id}`, { ...ref(r), action: "pause", ms: Number(e.target.value) })}>
            {[...new Set([...PAUSES, r.pauseAfterMs])].sort((a, z) => a - z).map((ms) => <option key={ms} value={ms}>وقفة {secAr(ms)}</option>)}
          </select>
        ) : <span className="sv-end">نهاية المشهد</span>}
        <details className="sv-menu">
          <summary aria-label="المزيد">⋯</summary>
          <div className="sv-menu-pop is-up" role="menu">
            <button type="button" role="menuitem" disabled={anyBusy} onClick={(e) => {
              (e.currentTarget.closest("details") as HTMLDetailsElement).open = false;
              setSplitting(r.id);
            }}>قسّم…</button>
            <button type="button" role="menuitem" disabled={anyBusy || !next} onClick={(e) => {
              (e.currentTarget.closest("details") as HTMLDetailsElement).open = false;
              void run(`merge:${r.id}`, { ...ref(r), action: "merge" }, { edits: true });
            }}>ادمج مع التالية</button>
            <button type="button" role="menuitem" disabled={anyBusy} onClick={(e) => {
              (e.currentTarget.closest("details") as HTMLDetailsElement).open = false;
              setAdding({ after: r.id, text: "" });
            }}>أضف جملة بعدها</button>
            {r.takes > 0 ? <button type="button" role="menuitem" disabled={anyBusy} onClick={(e) => {
              (e.currentTarget.closest("details") as HTMLDetailsElement).open = false;
              void run(`restore:${r.id}`, { ...ref(r), action: "restore" });
            }}>ارجع إلى التسجيل السابق ({ar(r.takes)})</button> : null}
            {r.audio && (r.status === "generated" || r.status === "heard") ? <button type="button" role="menuitem" disabled={anyBusy} onClick={(e) => {
              (e.currentTarget.closest("details") as HTMLDetailsElement).open = false;
              void run(`heard:${r.id}`, { ...ref(r), action: "heard", value: r.status !== "heard" });
            }}>{r.status === "heard" ? "ألغِ «سمعتها»" : "علّمها «سمعتها»"}</button> : null}
            <button type="button" role="menuitem" className="is-danger" disabled={anyBusy || s.rows.length <= 1} onClick={(e) => {
              (e.currentTarget.closest("details") as HTMLDetailsElement).open = false;
              if (window.confirm("احذف هذه الجملة من نص المشهد؟ يبقى تسجيلها محفوظًا على الجهاز.")) void run(`del:${r.id}`, { ...ref(r), action: "delete" }, { edits: true });
            }}>احذف الجملة</button>
          </div>
        </details>
      </div>
      {adding?.after === r.id ? (
        <form className="sv-add" onSubmit={async (e) => {
          e.preventDefault();
          if (await run(`add:${r.id}`, { ...ref(r), action: "add", text: adding.text }, { edits: true })) setAdding(null);
        }}>
          <textarea rows={2} dir="rtl" autoFocus placeholder="نص الجملة الجديدة (بالتشكيل)" aria-label="نص الجملة الجديدة" value={adding.text}
            onChange={(e) => setAdding({ ...adding, text: e.target.value })} />
          <div className="sv-dirty">
            <button type="submit" className="btn" disabled={anyBusy || !adding.text.trim()}>أضف</button>
            <button type="button" className="btn ghost" onClick={() => setAdding(null)}>إلغاء</button>
          </div>
        </form>
      ) : null}
    </li>
  );
};
