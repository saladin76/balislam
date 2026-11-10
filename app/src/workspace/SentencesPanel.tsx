import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api, type OwnRecitationsRead, type SentenceCommand, type SentenceRow, type SentenceScene, type SentencesRead, type WordFixOutcome } from "../api";
import type { Plan } from "../../../src/plan/types";
import type { EpisodeMedia } from "../../../src/plan/media";
import { tones, toneIds, isTone } from "../../../src/voice/tones";
import { RecitationItem, recitationUrl } from "./RecitationItem";
import "./sentences.css";
import { Icon } from "../ui/icons";
import { Num } from "../ui/format";

const ar = (n: number) => n.toLocaleString("ar-EG");
const secAr = (ms: number) => `${(ms / 1000).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ث`;
const countAr = (n: number) => (n === 1 ? "جملة واحدة" : n === 2 ? "جملتان" : n <= 10 ? `${ar(n)} جمل` : `${ar(n)} جملة`);
const PAUSES = [0, 150, 250, 350, 450, 600, 800, 1000, 1500, 2000];

const STATUS: Record<SentenceRow["status"] | "scene" | "verse-missing" | "verse-pending" | "verse-approved", string> = {
  missing: "بلا صوت",
  generated: "بصوت",
  stale: "تحتاج توليدًا",
  heard: "سمعتها",
  scene: "ضمن صوت المشهد",
  "verse-missing": "لم تُرفع التلاوة",
  "verse-pending": "بانتظار استماعك",
  "verse-approved": "تلاوة معتمدة",
};

const toneName = (t: string) => (isTone(t) ? tones[t].nameAr : "");
const inheritLabel = (r: SentenceRow) => {
  const n = toneName(r.inheritedTone);
  if (r.toneSource === "map") return n ? `نبرة الخريطة (${n})` : "نبرة الخريطة";
  if (!n) return "مثل الحلقة — لم تُختر نبرة بعد";
  return r.toneSource === "scene" ? `مثل المشهد (${n})` : r.toneSource === "episode" ? `مثل الحلقة (${n})` : `مثل القناة (${n})`;
};
/** موضع المؤشر في النص ← رقم الكلمة التي يبدأ عندها النصف الثاني */
const wordIndexAt = (text: string, caret: number) => text.slice(0, caret).trim().split(/\s+/).filter(Boolean).length;

type Props = {
  episodeId: string;
  channelId: string;
  /** جمل مشهد واحد (تحت معاينته في «المشاهد»)، أو كل الحلقة بلا sceneId */
  sceneId?: string;
  /** يحفظ أي تعديل للخطة ينتظر الحفظ التلقائي قبل أن يكتب الخادم نص المشهد */
  onBeforeEdit?: () => Promise<void>;
  /** الخطة كما كتبها الخادم بعد تعديل نص جملة (بلا حفظ جديد من الواجهة) */
  onPlanReplaced?: (plan: Plan) => void;
  onMediaChange?: (media: EpisodeMedia) => void;
  /** تغيّر صوت مشهد أو نصه: يعيد قراءة سجل المشاهد */
  onChanged?: () => void;
  hasVoiceKeys?: boolean;
  onOpenSettings?: () => void;
  /**
   * «paragraph» (step ٢ under the scene, direction D): the scene's sentences as one readable paragraph; the
   * current sentence shows its words as chips (when it has a take) and its controls in one row.
   * «list» (default; the whole episode in «أدوات وتفاصيل»): one row per sentence.
   */
  variant?: "paragraph" | "list";
};

/** «أعد نطق الكلمة»: the open word, its written pronunciation, and how much of the sentence is re-said with it. */
export type WordFixDraft = { row: string; index: number; say: string; save: boolean; wide: boolean };
/** The neighbours re-said with the word (one each side by default; two under «المزيد»), clipped to the sentence. */
export const fixNeighbours = (count: number, index: number, wide: boolean): number[] => {
  const n = wide ? 2 : 1;
  const out: number[] = [];
  for (let k = index - n; k <= index + n; k++) if (k !== index && k >= 0 && k < count) out.push(k);
  return out;
};
/** The hint under the field: which neighbours are re-said with the word. */
export const neighbourHint = (words: string[], index: number, wide: boolean): string => {
  const nb = fixNeighbours(words.length, index, wide);
  const before = nb.filter((k) => k < index).map((k) => words[k]).join(" ");
  const after = nb.filter((k) => k > index).map((k) => words[k]).join(" ");
  const parts = [before, after].filter(Boolean).map((x) => `«${x}»`);
  if (!parts.length) return "تُعاد هذه الكلمة وحدها، وبقية الجملة كما هي.";
  const who = wide ? (parts.length > 1 ? `مع كلمتين من كل جانب ${parts.join(" و")}` : `مع ما يجاورها ${parts[0]}`)
    : parts.length > 1 ? `مع جارتيها ${parts.join(" و")}` : `مع جارتها ${parts[0]}`;
  return `تُعاد هذه الكلمة ${who} حتى يبقى الوصل طبيعيًا، وبقية الجملة كما هي.`;
};

/**
 * «الجمل» (D50): تعليق المشهد جملةً جملة. لكل جملة نصها (يُعدَّل)، ونبرتها، و«ولّد» لها وحدها، وتشغيلها،
 * وحالتها، ووقفتها، وقائمة (قسّم، ادمج مع التالية، احذف، أضف بعدها). صف الآية «ارفع التلاوة» ولا يولَّد أبدًا.
 * كل فعل يعمل مباشرة بالضغط والخادم يتحقق (بلا كلمة مرور، قرار ٩ نوفمبر)؛ صوت المشهد يُركَّب من جمله حين تكتمل، فيعيد السجل فتح ذلك المشهد وحده.
 */
export const SentencesPanel: React.FC<Props> = ({ episodeId, channelId, sceneId, onBeforeEdit, onPlanReplaced, onMediaChange, onChanged, hasVoiceKeys, onOpenSettings, variant = "list" }) => {
  const [read, setRead] = useState<SentencesRead | null>(null);
  const [recs, setRecs] = useState<OwnRecitationsRead | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<{ after: string; text: string } | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  /** «أعد نطق الكلمة»: الكلمة المفتوحة ونطقها المكتوب ونتيجة آخر محاولة */
  const [fixing, setFixing] = useState<WordFixDraft | null>(null);
  /** The last word fix and how it ended: the line under its sentence (success with «تراجع», or failure with what to try). */
  const [fixed, setFixed] = useState<{ row: string; index: number; word: string; before: string; say: string; save: boolean; result: WordFixOutcome } | null>(null);
  /** The sentence on stage in the paragraph view, and the one whose text is being edited. */
  const [cur, setCur] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const wrap = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [popPos, setPopPos] = useState<{ top: number; left: number; arrow: number; sheet: boolean } | null>(null);
  const [lexDrafts, setLexDrafts] = useState<Record<string, string>>({});
  const carets = useRef<Record<string, number>>({});
  const player = useRef<{ audio: HTMLAudioElement | null; timer: ReturnType<typeof setTimeout> | null; stop: boolean }>({ audio: null, timer: null, stop: false });

  const load = async () => {
    const r = await api.sentences(episodeId, channelId);
    setRead(r);
    if (r.scenes.some((s) => s.verse)) setRecs(await api.ownRecitations(episodeId, channelId).catch(() => null));
  };
  useEffect(() => {
    setRead(null); setError(""); setMsg(""); setDrafts({}); setAdding(null); setFixing(null); setFixed(null); setCur(null); setEditing(null);
    void load().catch((e) => setError((e as Error).message));
    return () => stopPlay();
  }, [episodeId, channelId, sceneId]); // eslint-disable-line react-hooks/exhaustive-deps

  // The word popover is anchored to its chip (direction D): above it with an arrow on a wide screen, a bottom
  // sheet on a phone with the sentence kept in view. Esc closes it and gives the focus back to the chip.
  useLayoutEffect(() => {
    if (!fixing) { setPopPos(null); return; }
    const chip = chipRefs.current[`${fixing.row}:${fixing.index}`];
    const box = wrap.current;
    if (!chip || !box) return;
    const sheet = typeof window !== "undefined" && window.innerWidth <= 720;
    if (sheet) {
      // Keep the sentence in view above the sheet: scroll the page (only vertically) so the word sits near the top.
      const sc = chip.closest<HTMLElement>(".studio-main");
      const dy = chip.getBoundingClientRect().top - (sc ? sc.getBoundingClientRect().top : 0) - 90;
      if (sc) sc.scrollTop += dy; else window.scrollBy(0, dy);
      setPopPos({ top: 0, left: 0, arrow: 0, sheet: true });
      return;
    }
    const place = () => {
      const c = chip.getBoundingClientRect(), b = box.getBoundingClientRect();
      const ph = popRef.current?.offsetHeight ?? 420, pw = popRef.current?.offsetWidth ?? 408;
      const mid = c.left + c.width / 2 - b.left;
      const left = Math.min(Math.max(mid - pw / 2, -40), b.width - pw + 40);
      const above = c.top - b.top - ph - 14;
      const top = c.top - ph - 14 < 70 ? c.bottom - b.top + 14 : above;
      setPopPos({ top, left, arrow: Math.max(18, Math.min(pw - 18, mid - left)), sheet: false });
    };
    place();
    const raf = requestAnimationFrame(place);
    return () => cancelAnimationFrame(raf);
  }, [fixing?.row, fixing?.index, fixing?.wide]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!fixing) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      const chip = chipRefs.current[`${fixing.row}:${fixing.index}`];
      setFixing(null);
      chip?.focus();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [fixing]);

  const scenes = useMemo(() => (read?.scenes ?? []).filter((s) => !sceneId || s.id === sceneId), [read, sceneId]);

  const send = async (label: string, cmd: SentenceCommand, opts: { edits?: boolean } = {}) => {
    setBusy(label);
    setError("");
    setMsg("");
    try {
      if (opts.edits) await onBeforeEdit?.();
      const r = await api.sentenceAction(episodeId, channelId, cmd);
      setRead(r.read);
      if (r.plan) onPlanReplaced?.(r.plan);
      if (r.media) onMediaChange?.(r.media);
      const parts = [r.fix && !r.fix.ok ? "" : r.message, r.composed?.composed ? "رُكّب صوت المشهد من جمله؛ يُعرض المشهد لمراجعة جديدة." : ""].filter(Boolean);
      if (parts.length) setMsg(parts.join(" "));
      if (r.planChanged || r.composed?.composed) onChanged?.();
      return r;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setBusy("");
    }
  };
  const run = async (label: string, cmd: SentenceCommand, opts: { edits?: boolean } = {}) => Boolean(await send(label, cmd, opts));
  const ref = (r: SentenceRow): SentenceCommand => ({ action: "init", id: r.id });
  const lexicon = async (label: string, body: Parameters<typeof api.lexiconAction>[2]) => {
    setBusy(label); setError(""); setMsg("");
    try {
      setRead((await api.lexiconAction(episodeId, channelId, body)).read);
      return true;
    } catch (e) { setError((e as Error).message); return false; } finally { setBusy(""); }
  };

  // ── التشغيل المتتابع ──
  const urlOf = (file: string, kind: "sentences" | "voice") =>
    `/api/episodes/${encodeURIComponent(episodeId)}/media/${kind}/${encodeURIComponent(file)}?channel=${encodeURIComponent(channelId)}`;
  function stopPlay() {
    const p = player.current;
    p.stop = true;
    p.audio?.pause();
    if (p.timer) clearTimeout(p.timer);
    p.audio = null; p.timer = null;
    setPlaying(null);
  }
  const playQueue = (key: string, items: { id: string; url: string; pauseMs: number }[]) => {
    stopPlay();
    if (!items.length) { setMsg("لا صوت لتشغيله بعد في هذا المشهد."); return; }
    const p = player.current;
    p.stop = false;
    setPlaying(key);
    const step = (k: number) => {
      if (p.stop) return;
      const it = items[k];
      if (!it) { setPlaying(null); return; }
      const a = new Audio(it.url);
      p.audio = a;
      setPlaying(`${key}|${it.id}`);
      a.onended = () => { p.timer = setTimeout(() => step(k + 1), it.pauseMs); };
      a.onerror = () => step(k + 1);
      void a.play().catch(() => { setError("يتطلب المتصفح الضغط على تشغيل مرة أخرى."); setPlaying(null); });
    };
    step(0);
  };
  const sceneQueue = (s: SentenceScene) => {
    if (s.verse) return s.verse.file ? [{ id: s.verse.id, url: recitationUrl(episodeId, channelId, s.verse.file), pauseMs: 0 }] : [];
    if (!s.managed) return s.audio.file && s.audio.state !== "stale" ? [{ id: s.id, url: urlOf(s.audio.file, "voice"), pauseMs: 0 }] : [];
    return s.rows.filter((r) => r.audio).map((r) => ({ id: r.id, url: urlOf(r.audio!.file, "sentences"), pauseMs: r.pauseAfterMs }));
  };
  const playing_ = (id: string) => Boolean(playing && playing.split("|")[1] === id);
  /** الكلمة وحدها بسياق ٠٫٣ ث قبلها وبعدها */
  const playWord = (r: SentenceRow, i: number) => {
    const w = r.words[i];
    if (!r.audio || !w || w.start === null || w.end === null) return;
    stopPlay();
    const p = player.current;
    p.stop = false;
    const a = new Audio(urlOf(r.audio.file, "sentences"));
    p.audio = a;
    const from = Math.max(0, w.start - 0.3), len = w.end + 0.3 - from;
    setPlaying(`word:${r.id}:${i}|${r.id}`);
    const go = () => {
      a.currentTime = from;
      void a.play().then(() => { p.timer = setTimeout(() => stopPlay(), len * 1000); })
        .catch(() => { setError("يتطلب المتصفح الضغط على تشغيل مرة أخرى."); setPlaying(null); });
    };
    if (a.readyState >= 1) go(); else a.addEventListener("loadedmetadata", go, { once: true });
  };

  if (!read) return error ? <p className="scene-first-error" role="alert">{error}</p> : <p className="sp-hint sv-loading">جارٍ تحميل الجمل…</p>;
  if (!scenes.length) return null;

  const noKey = !(hasVoiceKeys ?? read.voiceKey);
  const total = scenes.reduce((n, s) => n + s.rows.length, 0);
  const voiced = scenes.reduce((n, s) => n + s.rows.filter((r) => r.status === "generated" || r.status === "heard" || (r.virtual && s.audio.state === "scene")).length, 0);

  /** Chips can be pressed: the current take has real word timings and nothing is busy. */
  const chipsFor = (r: SentenceRow) => r.kind === "narration" && Boolean(r.audio) && (r.status === "generated" || r.status === "heard");
  const fixedWord = (r: SentenceRow, i: number) =>
    (fixed?.row === r.id && fixed.index === i && fixed.result.ok) || (r.appliedState === "sent" && r.applied.some((a) => a.word === r.words[i]?.word));
  const wordChips = (r: SentenceRow, inline = false) => (
    <span className={inline ? "sv-words is-inline" : "sv-words"} role="group" aria-label="كلمات الجملة: اضغط كلمة لتصحيح نطقها وحدها">
      {r.words.map((w, i) => {
        const open = fixing?.row === r.id && fixing.index === i;
        const near = fixing?.row === r.id && fixNeighbours(r.words.length, fixing.index, fixing.wide).includes(i);
        const fail = fixed?.row === r.id && fixed.index === i && !fixed.result.ok;
        return (
          <React.Fragment key={i}>
            {i ? " " : null}
            <button ref={(el) => { chipRefs.current[`${r.id}:${i}`] = el; }} type="button"
              className={`sv-word${open ? " is-open" : ""}${near ? " is-near" : ""}${fail ? " is-fail" : fixedWord(r, i) ? " is-fixed" : ""}`}
              aria-pressed={open} aria-haspopup="dialog"
              disabled={Boolean(busy) || !r.wordFix.ok || w.quran} title={w.quran ? "نص قرآني: لا يُعاد نطقه" : r.wordFix.reason ?? "أعد نطق هذه الكلمة وحدها"}
              onClick={() => { setFixed(null); setFixing(open ? null : { row: r.id, index: i, say: w.say, save: false, wide: false }); }}>{w.word}</button>
          </React.Fragment>
        );
      })}
    </span>
  );

  /** The word popover (direction D), wired to the existing sentence API (fixword / generate). */
  const wordPopover = () => {
    if (!fixing) return null;
    const r = scenes.flatMap((x) => x.rows).find((x) => x.id === fixing.row);
    if (!r || !r.words[fixing.index]) return null;
    const f = fixing;
    const s = scenes.find((x) => x.rows.some((y) => y.id === r.id))!;
    const w = r.words[f.index]!;
    const close = () => { const chip = chipRefs.current[`${r.id}:${f.index}`]; setFixing(null); chip?.focus(); };
    const done = (res: Awaited<ReturnType<typeof send>>) => {
      if (!res?.fix) return;
      setFixed({ row: r.id, index: f.index, word: w.word, before: w.say, say: f.say, save: f.save, result: res.fix });
      setFixing(null);
    };
    return (
      <WordFixPopover popRef={popRef} pos={popPos} words={r.words} rowNo={s.rows.findIndex((y) => y.id === r.id) + 1} draft={f}
        busy={busy ? (busy === `fix:${r.id}` ? "fix" : busy === `gen:${r.id}` ? "gen" : "other") : null} noKey={noKey}
        playing={Boolean(playing?.startsWith(`word:${r.id}:${f.index}|`))} onOpenSettings={onOpenSettings}
        onDraft={setFixing} onClose={close}
        onPlay={() => (playing?.startsWith(`word:${r.id}:${f.index}|`) ? stopPlay() : playWord(r, f.index))}
        onFix={async () => done(await send(`fix:${r.id}`, { ...ref(r), action: "fixword", word: f.index, say: f.say, save: f.save, ...(f.wide ? { neighbours: 2 as const } : {}) }))}
        onWhole={async () => { const res = await send(`gen:${r.id}`, { ...ref(r), action: "generate", word: f.index, say: f.say, save: f.save }); if (res) setFixing(null); }} />
    );
  };

  /** Under the sentence after a word fix: «مُصحَّحة نُطقت: X ← Y» with listen/undo, or the failure and what to try. */
  const fixLine = (r: SentenceRow) => {
    if (!fixed || fixed.row !== r.id) return null;
    return (
      <WordFixLine fixed={fixed} busy={busy === `restore:${r.id}` ? "restore" : busy === `gen:${r.id}` ? "gen" : busy ? "other" : null} noKey={noKey}
        canListen={Boolean(r.audio)} canUndo={r.takes > 0}
        onListen={() => r.audio && playQueue(`row:${r.id}`, [{ id: r.id, url: urlOf(r.audio.file, "sentences"), pauseMs: 0 }])}
        onUndo={async () => { if (await run(`restore:${r.id}`, { ...ref(r), action: "restore" })) setFixed(null); }}
        onRetry={() => setFixing({ row: r.id, index: fixed.index, say: fixed.say, save: fixed.save, wide: false })}
        onWhole={async () => { if (await run(`gen:${r.id}`, { ...ref(r), action: "generate", word: fixed.index, say: fixed.say, save: fixed.save })) setFixed(null); }} />
    );
  };

  const lexiconBlock = () => {
    const list = read.lexicon ?? [];
    return (
      <details className="sv-lex">
        <summary>قاموس النطق <span className="sv-meta">{list.length ? ar(list.length) : "فارغ"}</span></summary>
        <p className="sp-hint">كلمة كما كُتبت ← كيف تُنطق. يُطبَّق على كل توليد قادم في القناة (الجمل والمشاهد)، ولا يغيّر النص ولا الترجمة، ولا يمس نصًا قرآنيًا. التسجيلات الحالية تبقى كما هي. يُضاف من «احفظ هذا النطق للقناة» عند إعادة نطق كلمة.</p>
        {list.length ? (
          <ul className="sv-lex-list">
            {list.map((e) => {
              const d = lexDrafts[e.word];
              const dirty = d !== undefined && d.trim() !== e.say;
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
                </li>
              );
            })}
          </ul>
        ) : null}
      </details>
    );
  };

  const row = (s: SentenceScene, r: SentenceRow, i: number) => {
    const draft = drafts[r.id];
    const dirty = draft !== undefined && draft.trim() !== r.text;
    const status = r.virtual && s.audio.state === "scene" ? "scene" : r.status;
    const b = (x: string) => busy === `${x}:${r.id}`;
    const anyBusy = Boolean(busy);
    const canGen = r.kind === "narration" && !noKey && r.tashkeel.ok && !anyBusy;
    const genLabel = b("gen") ? "جارٍ التوليد…" : r.audio && r.status !== "missing" ? "أعد التوليد" : "ولّد";
    const why = r.kind === "verse" ? "نص قرآني: الصوت المستنسخ لا يتلوه."
      : !r.tashkeel.ok ? `التشكيل ${ar(Math.round(r.tashkeel.coverage * 100))}٪ (الحد ٩٨٪): ${r.tashkeel.missing.slice(0, 5).join("، ")}`
      : null;
    const next = s.rows[i + 1];
    return (
      <li key={r.id} className={`sv-row is-${status}${playing_(r.id) ? " is-playing" : ""}`}>
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
          {!dirty && chipsFor(r) ? <div className="sv-words-wrap">{wordChips(r)}{!r.wordFix.ok && r.wordFix.reason ? <p className="sp-hint sv-words-why">إعادة نطق كلمة: {r.wordFix.reason}</p> : null}</div> : null}
          {fixLine(r)}
          {r.spoken && r.spoken !== r.text && r.kind === "narration" ? <p className="sv-spoken"><span>النطق:</span> {r.spoken}</p> : null}
          {r.applied.length && r.kind === "narration" ? (
            <p className="sv-spoken sv-applied"><span>{r.appliedState === "sent" ? "نُطقت:" : "ستُنطق:"}</span> {r.applied.map((a) => `${a.word} ← ${a.say}`).join("، ")}</p>
          ) : null}
          {why ? <p className="sv-why">{why}</p> : null}
          {r.contextChanged ? <p className="sp-hint">تغيّر ما حولها منذ توليدها؛ أعد توليدها إن بدا الوصل غير طبيعي.</p> : null}
        </div>
        <div className="sv-ctl">
          <span className={`sv-chip is-${status}`}>{STATUS[status]}</span>
          {r.kind === "narration" ? (
            <button type="button" className={`btn${r.status === "missing" || r.status === "stale" ? "" : " ghost"}`} disabled={!canGen}
              title={noKey ? "يتطلب مفتاح الصوت من «الاتصالات والمفاتيح»" : why ?? ""}
              onClick={() => void run(`gen:${r.id}`, { ...ref(r), action: "generate" })}>{genLabel}</button>
          ) : null}
          <button type="button" className="btn ghost sv-play" disabled={!r.audio && !(r.virtual && s.audio.file)}
            aria-label={playing_(r.id) ? "أوقف" : `شغّل الجملة ${ar(i + 1)}`}
            onClick={() => playing_(r.id) ? stopPlay() : r.audio ? playQueue(`row:${r.id}`, [{ id: r.id, url: urlOf(r.audio.file, "sentences"), pauseMs: 0 }]) : playQueue(`scene:${s.id}`, sceneQueue(s))}>
            {playing_(r.id) ? "■" : "▶"}
          </button>
          <select className="sv-tone" aria-label="نبرة الجملة" value={r.tone} disabled={anyBusy || r.kind !== "narration"}
            title={r.toneSource === "map" ? `اختيار نبرة هنا يكتب إصدارًا جديدًا من خريطة النبرة (${read.toneMap?.version ?? ""}) لهذه الجملة وحدها` : ""}
            onChange={(e) => void run(`tone:${r.id}`, { ...ref(r), action: "tone", tone: e.target.value || null })}>
            <option value="">{inheritLabel(r)}</option>
            {toneIds.map((t) => <option key={t} value={t}>{tones[t].nameAr}</option>)}
          </select>
          {!r.last ? (
            <select className="sv-pause" aria-label="الوقفة بعد الجملة" value={r.pauseAfterMs} disabled={anyBusy}
              onChange={(e) => void run(`pause:${r.id}`, { ...ref(r), action: "pause", ms: Number(e.target.value) })}>
              {[...new Set([...PAUSES, r.pauseAfterMs])].sort((a, z) => a - z).map((ms) => <option key={ms} value={ms}>وقفة {secAr(ms)}</option>)}
            </select>
          ) : <span className="sv-end">نهاية المشهد</span>}
          <details className="sv-menu">
            <summary aria-label="المزيد">⋯</summary>
            <div className="sv-menu-pop" role="menu">
              <button type="button" role="menuitem" disabled={anyBusy} onClick={(e) => {
                (e.currentTarget.closest("details") as HTMLDetailsElement).open = false;
                const at = wordIndexAt(r.text, carets.current[r.id] ?? Math.floor(r.text.length / 2));
                void run(`split:${r.id}`, { ...ref(r), action: "split", at }, { edits: true });
              }}>قسّم عند المؤشر</button>
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

  const sceneBlock = (s: SentenceScene) => {
    if (s.verse) {
      const v = s.verse;
      return (
        <section key={s.id} className="sv-scene is-verse" aria-label={`المشهد ${ar(s.index)}: آية`}>
          {!sceneId ? <h4 className="sv-scene-h">المشهد {ar(s.index)} <span>آية · {v.reference}</span></h4> : null}
          <ul className="pf-rec-list sv-verse">
            <RecitationItem compact episodeId={episodeId} channelId={channelId} ayahKey={v.ayahKey} scenes={[s.id]} recs={recs}
              onChanged={async () => { await load(); onChanged?.(); }} />
          </ul>
          <p className="sp-hint">تلاوة بشرية ترفعها بنفسك؛ لا يولَّد القرآن بالصوت المستنسخ أبدًا. اعتمادها يعيد فتح مشهدها وحده.</p>
        </section>
      );
    }
    const q = sceneQueue(s);
    const isPlaying = Boolean(playing?.startsWith(`scene:${s.id}`));
    return (
      <section key={s.id} className="sv-scene" aria-label={`جمل المشهد ${ar(s.index)}`}>
        <header className="sv-scene-head">
          {sceneId ? <h3>الجمل <span className="sv-meta">{countAr(s.rows.length)}</span></h3>
            : <h4 className="sv-scene-h">المشهد {ar(s.index)} <span>الفصل {ar(s.chapter)} · {s.chapterTitle}</span></h4>}
          <button type="button" className="btn ghost" disabled={!q.length} onClick={() => isPlaying ? stopPlay() : playQueue(`scene:${s.id}`, q)}>
            {isPlaying ? "■ أوقف" : "▶ شغّل المشهد متتابعًا"}
          </button>
        </header>
        {!s.managed ? (
          <p className="sp-hint">{s.audio.state === "scene" ? "صوت المشهد الحالي ملف واحد. أي فعل على جملة يبدأ العمل جملةً جملة، ويُقص صوت المشهد إلى جمله إن كانت الوقفات بينها واضحة؛ والملف الأصلي يبقى محفوظًا."
            : "قُسّم التعليق آليًا عند علامات الجملة. ولّد الجمل واحدة واحدة، ويُركَّب صوت المشهد منها حين تكتمل."}</p>
        ) : s.import?.state === "unreliable" && s.audio.state !== "sentences" ? <p className="sp-hint">{s.import.note}</p> : null}
        {s.managed && s.waiting ? <p className="sv-wait" role="status">{s.waiting}</p> : null}
        <ol className="sv-list">{s.rows.map((r, i) => row(s, r, i))}</ol>
      </section>
    );
  };

  /**
   * The scene's sentences as one readable paragraph (direction D). Each sentence keeps its number (✓ once
   * heard); the current one is in full ink, shows its words as chips when it has a take, and has its controls
   * in one quiet row: play, tone, pause, «ولّد الجملة», «عدّل النص», «⋯». No filled button here.
   */
  const paraBlock = (s: SentenceScene) => {
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
    const isPlaying = Boolean(playing?.startsWith(`scene:${s.id}`));
    const q = sceneQueue(s);
    const next = rows[i + 1];
    const closeMenu = (e: React.MouseEvent) => { (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; };
    return (
      <section key={s.id} className={`sv-para${fixing ? " is-fixing" : ""}`} aria-label={`جمل المشهد ${ar(s.index)}`}>
        {!s.managed ? (
          <p className="sp-hint sv-note">{s.audio.state === "scene" ? "صوت المشهد ملف واحد؛ أي فعل على جملة يبدأ العمل جملةً جملة، والملف الأصلي يبقى محفوظًا."
            : "قُسّم التعليق آليًا عند علامات الجملة. ولّد الجمل واحدة واحدة، ويُركَّب صوت المشهد منها حين تكتمل."}</p>
        ) : s.import?.state === "unreliable" && s.audio.state !== "sentences" ? <p className="sp-hint sv-note">{s.import.note}</p> : null}
        {s.managed && s.waiting ? <p className="sv-wait" role="status">{s.waiting}</p> : null}
        <p className="sv-paragraph">
          {rows.map((x, k) => {
            const isCur = x.id === r.id;
            const heard = x.status === "heard";
            return (
              <React.Fragment key={x.id}>
                {k ? " " : null}
                <span className={`sv-sn${isCur ? " is-cur" : heard ? " is-heard" : ""}${playing_(x.id) ? " is-playing" : ""}`}>
                  <button type="button" className="sv-sup" aria-pressed={isCur} onClick={() => { setCur(x.id); setFixing(null); setFixed(null); setEditing(null); }}
                    aria-label={`الجملة ${ar(k + 1)}: ${STATUS[x.virtual && s.audio.state === "scene" ? "scene" : x.status]}`} title={STATUS[x.virtual && s.audio.state === "scene" ? "scene" : x.status]}>
                    {heard ? <Icon name="check" /> : ar(k + 1)}
                  </button>
                  {isCur && chips ? wordChips(x, true) : isCur ? <span className="sv-sn-t">{x.text}</span>
                    : <span className="sv-sn-t" onClick={() => { setCur(x.id); setFixing(null); setFixed(null); setEditing(null); }}>{x.text}</span>}
                </span>
              </React.Fragment>
            );
          })}
        </p>
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
        {fixLine(r)}
        {!fixed && r.applied.length && r.kind === "narration" ? (
          <p className="sv-spoken sv-applied"><span>{r.appliedState === "sent" ? "نُطقت:" : "ستُنطق:"}</span> {r.applied.map((a) => `${a.word} ← ${a.say}`).join("، ")}</p>
        ) : null}
        {r.spoken && r.spoken !== r.text && r.kind === "narration" && !r.applied.length ? <p className="sv-spoken"><span>النطق:</span> {r.spoken}</p> : null}
        {why ? <p className="sv-why">{why}</p> : null}
        {r.contextChanged ? <p className="sp-hint">تغيّر ما حولها منذ توليدها؛ أعد توليدها إن بدا الوصل غير طبيعي.</p> : null}
        <div className="sv-tools" role="group" aria-label={`أدوات الجملة ${ar(i + 1)}`}>
          <span className="sv-lb">الجملة {ar(i + 1)}{r.audio ? <small><Num>{`${(Math.round(r.audio.duration * 10) / 10).toLocaleString("ar-EG")} ث`}</Num></small> : null}</span>
          <button type="button" className="sv-rb" disabled={!r.audio && !(r.virtual && s.audio.file)}
            aria-label={playing_(r.id) ? "أوقف" : `شغّل الجملة ${ar(i + 1)}`}
            onClick={() => playing_(r.id) ? stopPlay() : r.audio ? playQueue(`row:${r.id}`, [{ id: r.id, url: urlOf(r.audio.file, "sentences"), pauseMs: 0 }]) : playQueue(`scene:${s.id}`, sceneQueue(s))}>
            <Icon name={playing_(r.id) ? "pause" : "play"} />
          </button>
          <label className="sv-sel"><Icon name="tone" /><span className="ms-vh">نبرة الجملة</span>
            <select className="sv-tone" value={r.tone} disabled={anyBusy || r.kind !== "narration"}
              title={r.toneSource === "map" ? `اختيار نبرة هنا يكتب إصدارًا جديدًا من خريطة النبرة (${read.toneMap?.version ?? ""}) لهذه الجملة وحدها` : "نبرة الجملة"}
              onChange={(e) => void run(`tone:${r.id}`, { ...ref(r), action: "tone", tone: e.target.value || null })}>
              <option value="">{inheritLabel(r)}</option>
              {toneIds.map((t) => <option key={t} value={t}>{tones[t].nameAr}</option>)}
            </select>
          </label>
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
            <div className="sv-menu-pop" role="menu">
              <button type="button" role="menuitem" disabled={!q.length} onClick={(e) => { closeMenu(e); if (isPlaying) stopPlay(); else playQueue(`scene:${s.id}`, q); }}>{isPlaying ? "أوقف المشهد" : "شغّل المشهد متتابعًا"}</button>
              <button type="button" role="menuitem" disabled={anyBusy} onClick={(e) => {
                closeMenu(e);
                const at = wordIndexAt(r.text, carets.current[r.id] ?? Math.floor(r.text.length / 2));
                void run(`split:${r.id}`, { ...ref(r), action: "split", at }, { edits: true });
              }}>قسّم عند المؤشر</button>
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
          <span className="sv-hint">{chips ? (r.wordFix.ok ? <>اضغط <i>كلمة</i> لتصحيح نطقها وحدها</> : <>إعادة نطق كلمة: {r.wordFix.reason}</>) : r.kind === "narration" && !r.audio ? (noKey ? <>«ولّد» يحتاج مفتاح الصوت{onOpenSettings ? <> من <button type="button" className="prep-link" onClick={onOpenSettings}>الاتصالات والمفاتيح</button></> : null}</> : "ولّد الجملة لتصحّح كلماتها") : null}</span>
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

  const paragraph = variant === "paragraph" && Boolean(sceneId);
  return (
    <div ref={wrap} className={`sv${sceneId ? " is-scene" : " is-episode"}${paragraph ? " is-para" : ""}`} dir="rtl">
      {!sceneId ? <p className="sv-summary">{ar(voiced)} من {ar(total)} جملة بصوت · {ar(scenes.filter((s) => s.verse).length)} آية</p> : null}
      {noKey && !paragraph ? (
        <p className="sv-why">«ولّد» يحتاج مفتاح الصوت{onOpenSettings ? <> من <button type="button" className="prep-link" onClick={onOpenSettings}>الاتصالات والمفاتيح</button></> : " من الإعدادات"}.</p>
      ) : null}
      {!sceneId ? lexiconBlock() : null}
      {scenes.map((s) => (paragraph && !s.verse ? paraBlock(s) : sceneBlock(s)))}
      {wordPopover()}
      {error ? <p className="scene-first-error" role="alert">{error}</p> : null}
      {msg ? <p className="sp-hint" role="status">{msg}</p> : null}
    </div>
  );
};

type WordFixResult = { index: number; word: string; before: string; say: string; save: boolean; result: WordFixOutcome };

/**
 * «أعد نطق الكلمة» (direction D): anchored to its chip with an arrow over a dimmed page (a bottom sheet on a phone):
 * the word big and where it is («الكلمة ٢ من ٩ في الجملة ٣»)، ▶ الكلمة، the sentence with the word highlighted and the
 * neighbours that are re-said with it underlined, the field, «احفظ هذا النطق للقناة», and under «المزيد» two
 * neighbours on each side; «أعد نطق الكلمة» first, «ولّد الجملة كاملة بهذا النطق» as the fallback.
 */
export const WordFixPopover: React.FC<{
  words: SentenceRow["words"]; rowNo: number; draft: WordFixDraft;
  busy: "fix" | "gen" | "other" | null; noKey: boolean; playing: boolean;
  pos?: { top: number; left: number; arrow: number; sheet: boolean } | null;
  popRef?: React.Ref<HTMLDivElement>;
  onDraft: (d: WordFixDraft) => void; onClose: () => void; onPlay: () => void; onFix: () => void; onWhole: () => void; onOpenSettings?: () => void;
}> = ({ words, rowNo, draft: f, busy, noKey, playing, pos, popRef, onDraft, onClose, onPlay, onFix, onWhole, onOpenSettings }) => {
  const w = words[f.index]!;
  const nb = fixNeighbours(words.length, f.index, f.wide);
  const id = `fx-${rowNo}-${f.index}`;
  return (
    <>
      <div className="ms-scrim" aria-hidden="true" onClick={onClose} />
      <div ref={popRef} className={`ms-pop sv-fix${pos?.sheet ? " is-sheet" : ""}`} role="dialog" aria-modal="true" aria-labelledby={id}
        style={pos && !pos.sheet ? { top: pos.top, left: pos.left, ["--ax" as string]: `${pos.arrow}px` } : pos ? undefined : { visibility: "hidden" }}>
        <div className="ms-pop-top">
          <strong className="ms-pop-big sv-fix-word" id={id}>{w.word}</strong>
          <span className="ms-pop-lbl"><b>الكلمة <Num>{`${f.index + 1} من ${words.length}`}</Num></b>في الجملة <Num>{rowNo}</Num></span>
          <button type="button" className="ms-pop-pw sv-play" disabled={w.start === null} onClick={onPlay}
            aria-label={playing ? "أوقف" : "اسمع الكلمة في التسجيل"}><Icon name={playing ? "stop" : "play"} />الكلمة</button>
          <button type="button" className="ms-pop-x sv-fix-x" aria-label="أغلق" onClick={onClose}><Icon name="x" /></button>
        </div>
        <p className="ms-pop-ctx" aria-label="الجملة">
          {words.map((x, i) => (
            <React.Fragment key={i}>{i ? " " : null}<span className={i === f.index ? "me" : nb.includes(i) ? "nb" : undefined}>{x.word}</span></React.Fragment>
          ))}
        </p>
        <label className="ms-pop-fl sv-fix-say">
          <span>اكتبها كما يجب أن تُنطق</span>
          <span className="ms-pop-inp">
            <input dir="rtl" value={f.say} maxLength={80} autoFocus disabled={Boolean(busy)} onChange={(e) => onDraft({ ...f, say: e.target.value })} />
            <small>سُمعت «{w.say}»</small>
          </span>
        </label>
        <p className="ms-pop-hint"><Icon name="info" /><span>{neighbourHint(words.map((x) => x.word), f.index, f.wide)}</span></p>
        <label className="ms-pop-chk sv-fix-check">
          <input type="checkbox" checked={f.save} disabled={Boolean(busy)} onChange={(e) => onDraft({ ...f, save: e.target.checked })} />
          <span>احفظ هذا النطق للقناة<small>يُستعمل في كل حلقة</small></span>
        </label>
        <details className="ms-pop-more" open={f.wide || undefined}>
          <summary>المزيد</summary>
          <label className="ms-pop-chk">
            <input type="checkbox" checked={f.wide} disabled={Boolean(busy)} onChange={(e) => onDraft({ ...f, wide: e.target.checked })} />
            <span>أعدها مع كلمتين من كل جانب<small>لوصل أنعم حين لا تكفي الجارتان؛ والتسجيل الحالي يبقى في «ارجع إلى التسجيل السابق».</small></span>
          </label>
        </details>
        {noKey ? <p className="ms-pop-hint is-warn"><Icon name="warn" /><span>إعادة النطق تحتاج مفتاح الصوت{onOpenSettings ? <> من <button type="button" className="prep-link" onClick={onOpenSettings}>الاتصالات والمفاتيح</button></> : " من الإعدادات"}.</span></p> : null}
        <div className="ms-pop-acts">
          <button type="button" className="ms-pop-go" disabled={Boolean(busy) || noKey || !f.say.trim()} title={noKey ? "يتطلب مفتاح الصوت من «الاتصالات والمفاتيح»" : ""} onClick={onFix}>
            <Icon name="regen" />{busy === "fix" ? "جارٍ إعادة النطق…" : "أعد نطق الكلمة"}
          </button>
          <button type="button" className="ms-pop-alt" disabled={Boolean(busy) || noKey || !f.say.trim()} onClick={onWhole}>{busy === "gen" ? "جارٍ التوليد…" : "ولّد الجملة كاملة بهذا النطق"}</button>
        </div>
      </div>
    </>
  );
};

/** The line under the sentence after a word fix: success («مُصحَّحة» with listen and undo) or failure (what to try). */
export const WordFixLine: React.FC<{
  fixed: WordFixResult; busy: "restore" | "gen" | "other" | null; noKey: boolean; canListen: boolean; canUndo: boolean;
  onListen: () => void; onUndo: () => void; onRetry: () => void; onWhole: () => void;
}> = ({ fixed, busy, noKey, canListen, canUndo, onListen, onUndo, onRetry, onWhole }) => fixed.result.ok ? (
  <div className="sv-fixln" role="status">
    <b className="sv-okl">مُصحَّحة</b>
    <span>نُطقت:</span>
    <span className="sv-wd"><s>{fixed.before}</s> <span aria-hidden="true">←</span> {fixed.say}</span>
    {canListen ? <button type="button" className="sv-t" onClick={onListen}><Icon name="play" />استمع للجملة</button> : null}
    {canUndo ? <button type="button" className="sv-t" disabled={Boolean(busy)} onClick={onUndo}><Icon name="undo" />{busy === "restore" ? "جارٍ…" : "تراجع"}</button> : null}
    {fixed.save ? <span className="sv-sv">حُفظ النطق للقناة</span> : null}
  </div>
) : (
  <div className="sv-fixln is-bad sv-fix-fail" role="alert">
    <span className="sv-ic"><Icon name="warn" /></span>
    <div>
      <b>لم يندمج بشكل طبيعي — جرّب نطقًا آخر أو ولّد الجملة</b>
      {fixed.result.reasons.length ? <ul>{fixed.result.reasons.map((x) => <li key={x}>{x}</li>)}</ul> : null}
    </div>
    <button type="button" className="sv-t" disabled={Boolean(busy)} onClick={onRetry}>جرّب نطقًا آخر</button>
    <button type="button" className="sv-t" disabled={Boolean(busy) || noKey} onClick={onWhole}><Icon name="regen" />{busy === "gen" ? "جارٍ التوليد…" : "ولّد الجملة"}</button>
  </div>
);
