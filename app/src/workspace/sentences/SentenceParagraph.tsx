/**
 * The scene's sentences as one readable paragraph (direction D). Each sentence keeps its number (✓ once
 * heard); the current one is in full ink, shows its words as chips when it has a take, and has its controls
 * in one quiet row: play, tone, pause, «ولّد الجملة», «عدّل النص», «⋯». No filled button here.
 */
import React from "react";
import type { SentenceScene } from "../../api";
import { tones, toneIds } from "../../../../src/voice/tones";
import { SentenceSpeed } from "../../ui/Pace";
import { Icon } from "../../ui/icons";
import { Num } from "../../ui/format";
import { PAUSES, STATUS, ar, inheritLabel, secAr } from "./format";
import {
  BasmalaBlock, OlderNote, PlayControl, SceneControl, SentenceFixLine, SentenceSplit, TakeNote, WordChips, type SentencesPart,
} from "./SentenceParts";
import { SayEditor } from "./SayEditor";
import { SceneToneBar } from "./ToneParts";

export const SentenceParagraph: React.FC<SentencesPart & { s: SentenceScene }> = ({ m, p, s }) => {
  const { read, cur, setCur, busy, drafts, setDrafts, noKey, editing, setEditing, chipsFor, ps, sceneQueue, fixing, setFixing, setWhy, fixed, setFixed,
    playing_, rowKeys, carets, run, ref, pressScene, stopPlay, setSplitting, setAdding, adding } = m;
  const rows = s.rows;
  const r = rows.find((x) => x.id === cur) ?? rows.find((x) => x.status !== "heard") ?? rows[0];
  if (!r) return null;
  const i = rows.indexOf(r);
  const b = (x: string) => busy === `${x}:${r.id}`;
  const anyBusy = Boolean(busy);
  const draft = drafts[r.id];
  const dirty = draft !== undefined && draft.trim() !== r.text;
  const canGen = r.kind === "narration" && !noKey && r.tashkeel.ok && !anyBusy;
  const why = r.kind === "verse" ? "نص قرآني: الصوت المستنسخ لا يتلوه."
    : !r.tashkeel.ok ? `التشكيل ${ar(Math.round(r.tashkeel.coverage * 100))}٪ (الحد ٩٨٪): ${r.tashkeel.missing.slice(0, 5).join("، ")}`
    : null;
  const chips = chipsFor(r) && editing !== r.id;
  const scenePlaying = ps?.key === `scene:${s.id}`;
  const q = sceneQueue(s);
  const next = rows[i + 1];
  const closeMenu = (e: React.MouseEvent) => { (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; };
  return (
    <section className={`sv-para${fixing ? " is-fixing" : ""}`} aria-label={`جمل المشهد ${ar(s.index)}`}>
      {!s.managed ? (
        <p className="sp-hint sv-note">{s.audio.state === "scene" ? "صوت المشهد ملف واحد؛ أي فعل على جملة يبدأ العمل جملةً جملة، والملف الأصلي يبقى محفوظًا."
          : "قُسّم التعليق آليًا عند علامات الجملة. ولّد الجمل واحدة واحدة، ويُركَّب صوت المشهد منها حين تكتمل."}</p>
      ) : s.import?.state === "unreliable" && s.audio.state !== "sentences" ? <p className="sp-hint sv-note">{s.import.note}</p> : null}
      {s.managed && s.waiting ? <p className="sv-wait" role="status">{s.waiting}</p> : null}
      <OlderNote s={s} />
      <SceneToneBar m={m} p={p} s={s} />
      <p className="sv-paragraph">
        {rows.map((x, k) => {
          const isCur = x.id === r.id;
          const heard = x.status === "heard";
          return (
            <React.Fragment key={x.id}>
              {k ? " " : null}
              <span className={`sv-sn${isCur ? " is-cur" : heard ? " is-heard" : ""}${playing_(x.id) ? " is-playing" : ""}`}
                tabIndex={isCur ? 0 : undefined} onKeyDown={isCur ? rowKeys(s, x) : undefined}
                style={playing_(x.id) ? { ["--sv-p" as string]: String(ps?.progress ?? 0) } : undefined}
                aria-label={isCur ? `الجملة ${ar(k + 1)} — المسافة تشغّلها أو توقفها مؤقتًا` : undefined}>
                <button type="button" className="sv-sup" aria-pressed={isCur} onClick={() => { setCur(x.id); setFixing(null); setWhy(null); setFixed(null); setEditing(null); }}
                  aria-label={`الجملة ${ar(k + 1)}: ${STATUS[x.virtual && s.audio.state === "scene" ? "scene" : x.status]}`} title={STATUS[x.virtual && s.audio.state === "scene" ? "scene" : x.status]}>
                  {heard ? <Icon name="check" /> : ar(k + 1)}
                </button>
                {chipsFor(x) && editing !== x.id ? <WordChips m={m} r={x} inline /> : isCur ? <span className="sv-sn-t">{x.text}</span>
                  : <span className="sv-sn-t" onClick={() => { setCur(x.id); setFixing(null); setWhy(null); setFixed(null); setEditing(null); }}>{x.text}</span>}
              </span>
            </React.Fragment>
          );
        })}
      </p>
      <BasmalaBlock m={m} p={p} s={s} />
      {editing === r.id ? (
        <div className="sv-edit">
          <textarea className="sv-text" dir="rtl" rows={2} value={draft ?? r.text} aria-label={`نص الجملة ${ar(i + 1)}`} disabled={anyBusy} autoFocus
            onChange={(e) => setDrafts({ ...drafts, [r.id]: e.target.value })}
            onSelect={(e) => { carets.current[r.id] = (e.target as HTMLTextAreaElement).selectionStart; }} />
          <div className="sv-dirty">
            <button type="button" className="btn" disabled={anyBusy || !dirty || !draft!.trim()} onClick={async () => {
              if (await run(`edit:${r.id}`, { ...ref(r), action: "edit", text: draft }, { edits: true })) { setDrafts(({ [r.id]: _x, ...rest }) => rest); setEditing(null); }
            }}>{b("edit") ? "جارٍ الحفظ…" : "احفظ النص"}</button>
            <button type="button" className="btn ghost" onClick={() => { setDrafts(({ [r.id]: _x, ...rest }) => rest); setEditing(null); }}>تراجع</button>
            <span className="sp-hint">يُكتب في نص المشهد، فيعود المشهد لمراجعة جديدة.</span>
          </div>
        </div>
      ) : null}
      <SentenceSplit m={m} r={r} n={i + 1} />
      <SentenceFixLine m={m} r={r} />
      {!fixed && r.applied.length && r.kind === "narration" ? (
        <p className="sv-spoken sv-applied"><span>{r.appliedState === "sent" ? "نُطقت:" : "ستُنطق:"}</span> {r.applied.map((a) => `${a.word} ← ${a.say}`).join("، ")}</p>
      ) : null}
      <SayEditor m={m} r={r} n={i + 1} />
      {why ? <p className="sv-why">{why}</p> : null}
      <TakeNote m={m} r={r} />
      {r.contextChanged ? <p className="sp-hint">تغيّر ما حولها منذ توليدها؛ أعد توليدها إن بدا الوصل غير طبيعي.</p> : null}
      <div className="sv-tools" role="group" aria-label={`أدوات الجملة ${ar(i + 1)}`}>
        <span className="sv-lb">الجملة {ar(i + 1)}{r.audio?.origin === "scene" ? <small className="sv-origin">من صوت المشهد</small> : null}{r.audio ? <small><Num>{`${(Math.round(r.audio.duration * 10) / 10).toLocaleString("ar-EG")} ث`}</Num></small> : null}</span>
        <PlayControl m={m} s={s} r={r} n={i + 1} cls="sv-rb" icons />
        <label className="sv-sel"><Icon name="tone" /><span className="ms-vh">نبرة الجملة</span>
          <select className="sv-tone" value={r.tone} disabled={anyBusy || r.kind !== "narration"}
            title={r.toneSource === "map" ? `اختيار نبرة هنا يكتب إصدارًا جديدًا من خريطة النبرة (${read!.toneMap?.version ?? ""}) لهذه الجملة وحدها` : "نبرة الجملة"}
            onChange={(e) => void run(`tone:${r.id}`, { ...ref(r), action: "tone", tone: e.target.value || null })}>
            <option value="">{inheritLabel(r)}</option>
            {toneIds.map((t) => <option key={t} value={t}>{tones[t].nameAr}</option>)}
          </select>
        </label>
        {r.kind === "narration" ? (
          <label className="sv-sel is-speed"><span className="ms-vh">سرعة الجملة</span>
            <SentenceSpeed episodeId={m.episodeId} channelId={m.channelId} sceneId={r.sceneId} text={r.text} speed={r.speed}
              inherited={r.inheritedSpeed} exempt={r.paceExempt} disabled={anyBusy} onSaved={() => void m.load()} />
          </label>
        ) : null}
        {!r.last ? (
          <label className="sv-sel is-pause"><span className="ms-vh">الوقفة بعد الجملة</span>
            <select className="sv-pause" value={r.pauseAfterMs} disabled={anyBusy}
              onChange={(e) => void run(`pause:${r.id}`, { ...ref(r), action: "pause", ms: Number(e.target.value) })}>
              {[...new Set([...PAUSES, r.pauseAfterMs])].sort((a, z) => a - z).map((ms) => <option key={ms} value={ms}>وقفة {secAr(ms)}</option>)}
            </select>
          </label>
        ) : <span className="sv-end">نهاية المشهد</span>}
        {r.kind === "narration" ? (
          <button type="button" className="sv-t" disabled={!canGen} title={noKey ? "يتطلب مفتاح الصوت من «الاتصالات والمفاتيح»" : why ?? ""}
            onClick={() => void run(`gen:${r.id}`, { ...ref(r), action: "generate" })}><Icon name="regen" />{b("gen") ? "جارٍ التوليد…" : "ولّد الجملة"}</button>
        ) : null}
        <button type="button" className="sv-t" aria-pressed={editing === r.id} disabled={anyBusy} onClick={() => { setFixing(null); setEditing(editing === r.id ? null : r.id); }}><Icon name="doc" />عدّل النص</button>
        <details className="sv-menu">
          <summary aria-label="المزيد"><Icon name="more" /></summary>
          <div className="sv-menu-pop is-up" role="menu">
            <button type="button" role="menuitem" disabled={!scenePlaying && !q.length} onClick={(e) => { closeMenu(e); pressScene(s); }}>{!scenePlaying ? "شغّل المشهد متتابعًا" : ps?.paused ? "استأنف المشهد" : "إيقاف مؤقت للمشهد"}</button>
            {scenePlaying ? <button type="button" role="menuitem" onClick={(e) => { closeMenu(e); stopPlay(); }}>أوقف المشهد</button> : null}
            <button type="button" role="menuitem" disabled={anyBusy} onClick={(e) => { closeMenu(e); setSplitting(r.id); }}>قسّم…</button>
            <button type="button" role="menuitem" disabled={anyBusy || !next} onClick={(e) => { closeMenu(e); void run(`merge:${r.id}`, { ...ref(r), action: "merge" }, { edits: true }); }}>ادمج مع التالية</button>
            <button type="button" role="menuitem" disabled={anyBusy} onClick={(e) => { closeMenu(e); setAdding({ after: r.id, text: "" }); }}>أضف جملة بعدها</button>
            {r.takes > 0 ? <button type="button" role="menuitem" disabled={anyBusy} onClick={(e) => { closeMenu(e); void run(`restore:${r.id}`, { ...ref(r), action: "restore" }); }}>ارجع إلى التسجيل السابق ({ar(r.takes)})</button> : null}
            {r.audio && (r.status === "generated" || r.status === "heard") ? <button type="button" role="menuitem" disabled={anyBusy} onClick={(e) => { closeMenu(e); void run(`heard:${r.id}`, { ...ref(r), action: "heard", value: r.status !== "heard" }); }}>{r.status === "heard" ? "ألغِ «سمعتها»" : "علّمها «سمعتها»"}</button> : null}
            <button type="button" role="menuitem" className="is-danger" disabled={anyBusy || rows.length <= 1} onClick={(e) => {
              closeMenu(e);
              if (window.confirm("احذف هذه الجملة من نص المشهد؟ يبقى تسجيلها محفوظًا على الجهاز.")) void run(`del:${r.id}`, { ...ref(r), action: "delete" }, { edits: true });
            }}>احذف الجملة</button>
          </div>
        </details>
        {scenePlaying ? <span className="sv-scene-on" role="status">المشهد متتابعًا <SceneControl m={m} s={s} q={q} /></span> : null}
        <span className="sv-hint">{chips ? <>اضغط <i>كلمة</i> لتصحيح نطقها وحدها</> : null}</span>
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
    </section>
  );
};
