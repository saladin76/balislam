/**
 * «الجمل» (D50): the small visible parts shared by the list and the paragraph views — the play controls (one audio
 * for the page, D62/D105), the word chips, the split chooser, the notes under a sentence (D97, D110 and the local
 * pronunciation note), the word popovers wired to the sentence API, the pronunciation lexicon and the basmala row.
 * Display only: every command goes through the panel's `send`.
 */
import React from "react";
import type { SentenceRow, SentenceScene } from "../../api";
import { tones, isTone } from "../../../../src/voice/tones";
import { isNoopSay } from "../../../../src/voice/pronunciationRules";
import { SplitChooser, caretWordIndex } from "../SplitChooser";
import { PronunciationNote } from "../PronunciationNote";
import { RecitationItem } from "../RecitationItem";
import { Icon } from "../../ui/icons";
import type { Clip } from "../sentencePlayer";
import type { SentencesPanelProps } from "../SentencesPanel";
import type { SentencesModel } from "./useSentences";
import { OLDER_TONE, ar, fixNeighbours, reopenTarget } from "./format";
import { WordFixLine, WordFixPopover, WordWhyPopover } from "./WordPopovers";
import { ToneLine } from "./ToneParts";

/** What every part reads: the panel's state and actions, and its props. */
export type SentencesPart = { m: SentencesModel; p: SentencesPanelProps };

/**
 * ▶ (play) → ⏸ (pause) / ▶ (resume) on the same button, a small ■ beside it while this sentence is on, and a
 * thin progress bar of the sentence; one audio for the whole page.
 */
export const PlayControl: React.FC<{ m: SentencesModel; s: SentenceScene; r: SentenceRow; n: number; cls: string; icons: boolean }> = ({ m, s, r, n, cls, icons }) => {
  const { ps, rowActive, clipOf, rowPlayTitle, pressRow, stopPlay } = m;
  const on = rowActive(r);
  const paused = on && Boolean(ps?.paused);
  const c = on ? null : clipOf(s, r);
  const title = rowPlayTitle(s, r, n);
  return (
    <span className={`sv-pc${on ? " is-on" : ""}`}>
      <button type="button" className={cls} disabled={!on && !c} aria-label={title} title={title} aria-pressed={on && !paused}
        data-estimated={(on ? ps?.estimated : c?.estimated) ? "1" : undefined} onClick={() => pressRow(s, r)}>
        {icons ? <Icon name={on && !paused ? "pause" : "play"} /> : on && !paused ? "⏸" : "▶"}
      </button>
      {on ? (
        <>
          <button type="button" className="sv-stop" aria-label={`أوقف الجملة ${ar(n)}`} title="أوقف (Esc)" onClick={stopPlay}>
            {icons ? <Icon name="stop" /> : "■"}
          </button>
          <span className="sv-prog" role="progressbar" aria-label={`تقدم الجملة ${ar(n)}`} aria-valuemin={0} aria-valuemax={100}
            aria-valuenow={Math.round((ps?.progress ?? 0) * 100)}>
            <i style={{ width: `${Math.round((ps?.progress ?? 0) * 1000) / 10}%` }} />
          </span>
          {ps?.estimated ? <small className="sv-approx">تقريبي</small> : null}
        </>
      ) : null}
    </span>
  );
};

/** «شغّل المشهد متتابعًا»: the same button pauses/resumes; ■ stops. */
export const SceneControl: React.FC<{ m: SentencesModel; s: SentenceScene; q: Clip[] }> = ({ m, s, q }) => {
  const { ps, pressScene, stopPlay } = m;
  const on = ps?.key === `scene:${s.id}`;
  return (
    <span className="sv-pc">
      <button type="button" className="btn ghost" disabled={!on && !q.length} aria-pressed={on && !ps?.paused} onClick={() => pressScene(s)}>
        {!on ? "▶ شغّل المشهد متتابعًا" : ps?.paused ? "▶ استأنف المشهد" : "⏸ إيقاف مؤقت"}
      </button>
      {on ? <button type="button" className="btn ghost sv-stop-scene" aria-label="أوقف المشهد" title="أوقف (Esc)" onClick={stopPlay}>■ أوقف</button> : null}
    </span>
  );
};

/** «قسّم…»: the split point chooser under its sentence (nothing is sent before «قسّم هنا»). */
export const SentenceSplit: React.FC<{ m: SentencesModel; r: SentenceRow; n: number }> = ({ m, r, n }) => {
  const { splitting, setSplitting, busy, carets, run, ref } = m;
  const refOf = ref(r);
  return splitting === r.id ? (
    <SplitChooser text={r.text} n={n} busy={busy === `split:${r.id}`} hasAudio={Boolean(r.audio)} initial={caretWordIndex(r.text, carets.current[r.id])}
      onCancel={() => setSplitting(null)}
      onConfirm={async (at) => { if (await run(`split:${r.id}`, { ...refOf, action: "split", at } as never, { edits: true })) setSplitting(null); }} />
  ) : null;
};

/**
 * Every narration sentence shows its words as chips, and every chip opens something (D63): the fix popover when
 * the take has real word timings; with whole-scene audio of exact timings, the scene file is first cut into its
 * sentences («من صوت المشهد», no paid call) and then the popover opens on the same word; otherwise the «why»
 * popover with «ولّد هذه الجملة ثم صحّح الكلمة».
 */
export const WordChips: React.FC<{ m: SentencesModel; r: SentenceRow; inline?: boolean }> = ({ m, r, inline = false }) => {
  const { fixing, why, fixed, chipRefs, busy, chipTitle, fixedWord, pressWord } = m;
  return (
    <span className={inline ? "sv-words is-inline" : "sv-words"} role="group" aria-label="كلمات الجملة: اضغط كلمة لتصحيح نطقها وحدها">
      {r.words.map((w, i) => {
        const open = (fixing?.row === r.id && fixing.index === i) || (why?.row === r.id && why.index === i);
        const near = fixing?.row === r.id && fixNeighbours(r.words.length, fixing.index, fixing.wide).includes(i);
        const fail = fixed?.row === r.id && fixed.index === i && !fixed.result.ok;
        return (
          <React.Fragment key={i}>
            {i ? " " : null}
            <button ref={(el) => { chipRefs.current[`${r.id}:${i}`] = el; }} type="button"
              className={`sv-word${open ? " is-open" : ""}${near ? " is-near" : ""}${fail ? " is-fail" : fixedWord(r, i) ? " is-fixed" : ""}`}
              aria-pressed={open} aria-haspopup="dialog"
              data-fix={r.wordFix.ok ? "take" : r.wordFix.adopt ? "scene" : "why"} aria-busy={busy === `adopt:${r.id}` || undefined}
              disabled={Boolean(busy) || w.quran} title={chipTitle(r, w.quran)}
              onClick={() => void pressWord(r, i)}>{w.word}</button>
          </React.Fragment>
        );
      })}
    </span>
  );
};

/** D97: «قديم — سُجّل على نص سابق» (the old take stays playable; «ولّد» makes the current one), and a take kept under its own tone. */
const TakeOnlyNote: React.FC<{ r: SentenceRow }> = ({ r }) => r.status === "old" ? (
  <p className="sv-old" role="status"><b>قديم — سُجّل على نص سابق.</b> {r.recordedOn ? <>سُجّل على: «{r.recordedOn}». </> : null}
    اسمعه بزر التشغيل؛ لا يدخل صوت المشهد حتى تولّد الجملة بنصها الحالي، ويبقى محفوظًا في التسجيلات السابقة.</p>
) : null;
/** D110: the scene's audio clamped this sentence's word timing to its file (a bounded overshoot): listen to its end. */
const ClampNote: React.FC<{ r: SentenceRow }> = ({ r }) => r.timingClamped ? (
  <p className="sp-hint sv-clamp" role="status">التوقيت ضُبط قليلًا — استمع لآخر الجملة</p>
) : null;
/** Under the sentence: the take notes (D97, D110) and the local pronunciation check's note (العمل ٩). */
export const TakeNote: React.FC<{ m: SentencesModel; r: SentenceRow }> = ({ m, r }) => <><TakeOnlyNote r={r} /><ToneLine m={m} r={r} /><ClampNote r={r} /><PronunciationNote view={m.pron} rowId={r.id} kind={r.kind} /></>;

/** The word popover (direction D), wired to the existing sentence API (fixword / generate). */
export const SentenceWordPopover: React.FC<SentencesPart> = ({ m, p }) => {
  const { fixing, setFixing, setFixed, scenes, chipRefs, popRef, popPos, busy, noKey, ps, stopPlay, playWord, send, ref } = m;
  const { onOpenSettings } = p;
  if (!fixing) return null;
  const r = scenes.flatMap((x) => x.rows).find((x) => x.id === fixing.row);
  if (!r || !r.words[fixing.index]) return null;
  const f = fixing;
  const s = scenes.find((x) => x.rows.some((y) => y.id === r.id))!;
  const w = r.words[f.index]!;
  const close = () => { const chip = chipRefs.current[`${r.id}:${f.index}`]; setFixing(null); chip?.focus(); };
  const save = () => f.save && !isNoopSay(w.say, f.say);
  const done = (res: Awaited<ReturnType<typeof send>>) => {
    if (!res?.fix) return;
    setFixed({ row: r.id, index: f.index, word: w.word, before: w.sent, say: f.say, save: f.save, result: res.fix });
    setFixing(null);
  };
  return (
    <WordFixPopover popRef={popRef} pos={popPos} words={r.words} rowNo={s.rows.findIndex((y) => y.id === r.id) + 1} draft={f}
      busy={busy ? (busy === `fix:${r.id}` ? "fix" : busy === `gen:${r.id}` ? "gen" : "other") : null} noKey={noKey}
      playing={ps?.key === `word:${r.id}:${f.index}`} onOpenSettings={onOpenSettings}
      onDraft={setFixing} onClose={close}
      onPlay={() => (ps?.key === `word:${r.id}:${f.index}` ? stopPlay() : playWord(r, f.index))}
      onFix={async () => done(await send(`fix:${r.id}`, { ...ref(r), action: "fixword", word: f.index, say: f.say, save: save(), ...(f.wide ? { neighbours: 2 as const } : {}) }))}
      onWhole={async () => { const res = await send(`gen:${r.id}`, { ...ref(r), action: "generate", word: f.index, say: f.say, save: save() }); if (res) setFixing(null); }}
      onUnfix={async () => {
        const res = await send(`unfix:${r.id}`, { ...ref(r), action: "unfix", word: f.index });
        if (!res) return;
        const t = reopenTarget(res.read, s.id, s.rows.findIndex((y) => y.id === r.id), f.index);
        setFixing(t?.kind === "fix" ? { ...t.draft, wide: f.wide } : null);
      }} />
  );
};

/** «لا توجد أوقات دقيقة…»: why the word can't be cut now, and «ولّد هذه الجملة ثم صحّح الكلمة» (then the fix popover opens). */
export const SentenceWhyPopover: React.FC<SentencesPart> = ({ m, p }) => {
  const { why, setWhy, fixing, scenes, chipRefs, popRef, popPos, busy, noKey, send, ref, reopen } = m;
  const { onOpenSettings } = p;
  if (!why || fixing) return null;
  const s = scenes.find((x) => x.rows.some((y) => y.id === why.row));
  const r = s?.rows.find((x) => x.id === why.row);
  if (!s || !r || !r.words[why.index]) return null;
  const k = s.rows.indexOf(r);
  const close = () => { const chip = chipRefs.current[`${r.id}:${why.index}`]; setWhy(null); chip?.focus(); };
  const ww = r.words[why.index]!;
  const blocked = noKey ? "التوليد يحتاج مفتاح الصوت" : !r.tashkeel.ok ? `التشكيل ${ar(Math.round(r.tashkeel.coverage * 100))}٪ (الحد ٩٨٪)` : null;
  return (
    <WordWhyPopover popRef={popRef} pos={popPos} word={r.words[why.index]!.word} index={why.index} count={r.words.length} rowNo={k + 1}
      reason={r.wordFix.reason ?? "لا تسجيل يُقص لهذه الجملة"} blocked={blocked} busy={busy ? (busy === `gen:${r.id}` ? "gen" : "other") : null}
      onOpenSettings={noKey ? onOpenSettings : undefined} onClose={close}
      onGenerate={async () => { const res = await send(`gen:${r.id}`, { ...ref(r), action: "generate" }); if (res) reopen(res.read, s.id, k, why.index); }}
      correction={ww.correction !== null ? { say: ww.correction, auto: ww.auto ?? ww.sent } : null}
      onUnfix={async () => { if (await send(`unfix:${r.id}`, { ...ref(r), action: "unfix", word: why.index })) setWhy(null); }} />
  );
};

/** Under the sentence after a word fix: «مُصحَّحة نُطقت: X ← Y» with listen/undo, or the failure and what to try. */
export const SentenceFixLine: React.FC<{ m: SentencesModel; r: SentenceRow }> = ({ m, r }) => {
  const { fixed, setFixed, setFixing, busy, noKey, playClips, rowKey, urlOf, run, ref } = m;
  if (!fixed || fixed.row !== r.id) return null;
  return (
    <WordFixLine fixed={fixed} busy={busy === `restore:${r.id}` ? "restore" : busy === `gen:${r.id}` ? "gen" : busy ? "other" : null} noKey={noKey}
      canListen={Boolean(r.audio)} canUndo={r.takes > 0}
      onListen={() => r.audio && playClips(rowKey(r), [{ id: r.id, url: urlOf(r.audio.file, "sentences") }])}
      onUndo={async () => { if (await run(`restore:${r.id}`, { ...ref(r), action: "restore" })) setFixed(null); }}
      onRetry={() => setFixing({ row: r.id, index: fixed.index, say: fixed.say, save: fixed.save, wide: false })}
      onWhole={async () => { if (await run(`gen:${r.id}`, { ...ref(r), action: "generate", word: fixed.index, say: fixed.say, save: fixed.save })) setFixed(null); }} />
  );
};

/** «قاموس النطق»: a word as written ← how it is said, for every coming generation of the channel. */
export const LexiconBlock: React.FC<{ m: SentencesModel }> = ({ m }) => {
  const { read, lexDrafts, setLexDrafts, busy, lexicon } = m;
  const list = read!.lexicon ?? [];
  return (
    <details className="sv-lex">
      <summary>قاموس النطق <span className="sv-meta">{list.length ? ar(list.length) : "فارغ"}</span></summary>
      <p className="sp-hint">كلمة كما كُتبت ← كيف تُنطق. يُطبَّق على كل توليد قادم في القناة (الجمل والمشاهد)، ولا يغيّر النص ولا الترجمة، ولا يمس نصًا قرآنيًا. التسجيلات الحالية تبقى كما هي. يُضاف من «احفظ هذا النطق للقناة» عند إعادة نطق كلمة.</p>
      {list.length ? (
        <ul className="sv-lex-list">
          {list.map((e) => {
            const d = lexDrafts[e.word];
            const dirty = d !== undefined && d.trim() !== e.say;
            const fx = (read!.lexiconEffects ?? []).find((x) => x.word === e.word);
            return (
              <li key={e.word}>
                <span className="sv-lex-word">{e.word}</span>
                <span aria-hidden>←</span>
                <input dir="rtl" aria-label={`نطق «${e.word}»`} value={d ?? e.say} disabled={Boolean(busy)}
                  onChange={(x) => setLexDrafts({ ...lexDrafts, [e.word]: x.target.value })} />
                {dirty ? <button type="button" className="btn ghost" disabled={Boolean(busy)} onClick={async () => {
                  if (await lexicon(`lex:${e.word}`, { op: "set", word: e.word, say: d! })) setLexDrafts(({ [e.word]: _x, ...rest }) => rest);
                }}>احفظ</button> : null}
                <button type="button" className="btn ghost is-danger" disabled={Boolean(busy)} onClick={() => {
                  if (window.confirm(`احذف «${e.word}» من قاموس النطق؟ التسجيلات الحالية لا تتغير.`)) void lexicon(`lex:${e.word}`, { op: "remove", word: e.word });
                }}>احذف</button>
                {fx ? (
                  <span className="sv-lex-fx">
                    <small>{fx.match === "letters" ? "بالحروف (أي تشكيل لا يخالفه)" : "بالتشكيل نفسه فقط"} — {fx.applies.length
                      ? `يغيّر في هذه الحلقة: ${fx.applies.map((w) => `«${w}»`).join("، ")}` : "لا يغيّر شيئًا في هذه الحلقة"}</small>
                    {fx.warnings.map((m) => <small key={m} className="is-warn">{m}</small>)}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </details>
  );
};

/**
 * The basmala (owner decision 10 Nov): its sentence is the owner's own recording, never the cloned voice —
 * «ارفع التسجيل» through the same recitation flow (processed copy beside the original, listen, approve). One
 * recording serves every scene that holds it; approving it composes those scenes again and re-opens them.
 */
export const BasmalaBlock: React.FC<SentencesPart & { s: SentenceScene }> = ({ m, p, s }) => {
  const { recs, load } = m;
  const { episodeId, channelId, onChanged } = p;
  if (!s.rows.some((x) => x.kind === "basmala")) return null;
  // D239: the owner's one approved basmala clip serves every episode without its own recording; never generated.
  if (recs?.basmalaClip?.installed) return (
    <div className="sv-basmala" role="group" aria-label="البسملة بصوتك">
      <p className="sp-hint">البسملة: النسخة المعتمدة بصوتك (قرار ٢٧ نوفمبر)، نفسها في كل الحلقات بلا توليد جديد. لا رفع ولا اعتماد هنا، وبقية الجمل تُولَّد كالمعتاد.</p>
    </div>
  );
  return (
    <div className="sv-basmala" role="group" aria-label="البسملة بصوتك">
      {recs?.basmalaClip?.reason ? <p className="sp-hint">{recs.basmalaClip.reason}</p> : null}
      <p className="sp-hint">البسملة لا ينطقها الصوت المستنسخ أبدًا. حتى تُثبَّت نسختها المعتمدة أو يُعتمد تسجيل للحلقة تبقى مكانها صامتة بعلامة «التلاوة تُضاف لاحقًا»، وبقية الجمل تُولَّد كالمعتاد.</p>
      <ul className="pf-rec-list sv-verse">
        <RecitationItem compact episodeId={episodeId} channelId={channelId} ayahKey="basmala" scenes={[s.id]} recs={recs}
          onChanged={async () => { await load(); onChanged?.(); }} />
      </ul>
    </div>
  );
};

/** صوت المشهد ملفًا واحدًا بنبرة سابقة: إشارة هادئة، لا تغيير في حالته */
export const OlderNote: React.FC<{ s: SentenceScene }> = ({ s }) => (s.olderTone ? <p className="sp-hint sv-older">صوت المشهد {OLDER_TONE.replace("وُلّدت", "وُلّد")}؛ صالح ولم يُعد توليده آليًا.</p> : null);
