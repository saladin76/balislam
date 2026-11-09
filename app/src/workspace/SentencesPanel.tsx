import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, type OwnRecitationsRead, type SentenceCommand, type SentenceRow, type SentenceScene, type SentencesRead, type WordFixOutcome } from "../api";
import type { Plan } from "../../../src/plan/types";
import type { EpisodeMedia } from "../../../src/plan/media";
import { tones, toneIds, isTone } from "../../../src/voice/tones";
import { RecitationItem, recitationUrl } from "./RecitationItem";
import "./sentences.css";

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
};

/**
 * «الجمل» (D50): تعليق المشهد جملةً جملة. لكل جملة نصها (يُعدَّل)، ونبرتها، و«ولّد» لها وحدها، وتشغيلها،
 * وحالتها، ووقفتها، وقائمة (قسّم، ادمج مع التالية، احذف، أضف بعدها). صف الآية «ارفع التلاوة» ولا يولَّد أبدًا.
 * كل فعل يعمل مباشرة بالضغط والخادم يتحقق (بلا كلمة مرور، قرار ٩ نوفمبر)؛ صوت المشهد يُركَّب من جمله حين تكتمل، فيعيد السجل فتح ذلك المشهد وحده.
 */
export const SentencesPanel: React.FC<Props> = ({ episodeId, channelId, sceneId, onBeforeEdit, onPlanReplaced, onMediaChange, onChanged, hasVoiceKeys, onOpenSettings }) => {
  const [read, setRead] = useState<SentencesRead | null>(null);
  const [recs, setRecs] = useState<OwnRecitationsRead | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<{ after: string; text: string } | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  /** «أعد نطق الكلمة»: الكلمة المفتوحة ونطقها المكتوب ونتيجة آخر محاولة */
  const [fixing, setFixing] = useState<{ row: string; index: number; say: string; save: boolean; result?: WordFixOutcome } | null>(null);
  const [lexDrafts, setLexDrafts] = useState<Record<string, string>>({});
  const carets = useRef<Record<string, number>>({});
  const player = useRef<{ audio: HTMLAudioElement | null; timer: ReturnType<typeof setTimeout> | null; stop: boolean }>({ audio: null, timer: null, stop: false });

  const load = async () => {
    const r = await api.sentences(episodeId, channelId);
    setRead(r);
    if (r.scenes.some((s) => s.verse)) setRecs(await api.ownRecitations(episodeId, channelId).catch(() => null));
  };
  useEffect(() => {
    setRead(null); setError(""); setMsg(""); setDrafts({}); setAdding(null); setFixing(null);
    void load().catch((e) => setError((e as Error).message));
    return () => stopPlay();
  }, [episodeId, channelId, sceneId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const wordChips = (r: SentenceRow) => (
    <div className="sv-words-wrap">
      <div className="sv-words" role="group" aria-label="كلمات الجملة: اضغط كلمة لإعادة نطقها وحدها">
        {r.words.map((w, i) => {
          const open = fixing?.row === r.id && fixing.index === i;
          return (
            <button key={i} type="button" className={`sv-word${open ? " is-open" : ""}`} aria-pressed={open} aria-haspopup="dialog"
              disabled={Boolean(busy) || !r.wordFix.ok || w.quran} title={w.quran ? "نص قرآني: لا يُعاد نطقه" : r.wordFix.reason ?? "أعد نطق هذه الكلمة وحدها"}
              onClick={() => setFixing(open ? null : { row: r.id, index: i, say: w.say, save: false })}>{w.word}</button>
          );
        })}
      </div>
      {!r.wordFix.ok && r.wordFix.reason ? <p className="sp-hint sv-words-why">إعادة نطق كلمة: {r.wordFix.reason}</p> : null}
    </div>
  );
  const fixPanel = (r: SentenceRow) => {
    const f = fixing!;
    const w = r.words[f.index];
    if (!w) return null;
    const failed = f.result && !f.result.ok ? f.result : null;
    const b = (x: string) => busy === `${x}:${r.id}`;
    const wordPlaying = playing?.startsWith(`word:${r.id}:${f.index}|`);
    return (
      <div className="sv-fix" role="dialog" aria-label={`إعادة نطق «${w.word}»`}>
        <div className="sv-fix-head">
          <strong className="sv-fix-word">{w.word}</strong>
          <button type="button" className="btn ghost sv-play" disabled={w.start === null} onClick={() => (wordPlaying ? stopPlay() : playWord(r, f.index))}
            aria-label={wordPlaying ? "أوقف" : "اسمع الكلمة في التسجيل"}>{wordPlaying ? "■" : "▶"} الكلمة</button>
          <button type="button" className="sv-fix-x" aria-label="أغلق" onClick={() => setFixing(null)}>×</button>
        </div>
        <label className="sv-fix-say">
          <span>اكتبها كما يجب أن تُنطق</span>
          <input dir="rtl" value={f.say} maxLength={80} autoFocus disabled={Boolean(busy)}
            onChange={(e) => setFixing({ ...f, say: e.target.value, result: undefined })} />
        </label>
        <label className="sv-fix-check">
          <input type="checkbox" checked={f.save} disabled={Boolean(busy)} onChange={(e) => setFixing({ ...f, save: e.target.checked })} />
          <span>احفظ هذا النطق للقناة</span>
        </label>
        <p className="sp-hint">غيّر التشكيل أو اكتبها كما تُسمع. يُطلب مقطع قصير (الكلمة بين جارتيها) ويوصل مكانها وحدها؛ التسجيل الحالي يبقى في «ارجع إلى التسجيل السابق».</p>
        <div className="sv-dirty">
          <button type="button" className="btn" disabled={Boolean(busy) || noKey || !f.say.trim()} title={noKey ? "يتطلب مفتاح الصوت من «الإعدادات»" : ""}
            onClick={async () => {
              const res = await send(`fix:${r.id}`, { ...ref(r), action: "fixword", word: f.index, say: f.say, save: f.save });
              if (!res?.fix) return;
              setFixing(res.fix.ok ? null : { ...f, result: res.fix });
            }}>{b("fix") ? "جارٍ إعادة النطق…" : "أعد نطق الكلمة"}</button>
        </div>
        {failed ? (
          <div className="sv-fix-fail" role="alert">
            <p>لم يندمج بشكل طبيعي — جرّب نطقًا آخر أو ولّد الجملة</p>
            {failed.reasons.length ? <ul>{failed.reasons.map((x) => <li key={x}>{x}</li>)}</ul> : null}
            <button type="button" className="btn ghost" disabled={Boolean(busy) || noKey} onClick={async () => {
              const res = await send(`gen:${r.id}`, { ...ref(r), action: "generate", word: f.index, say: f.say, save: f.save });
              if (res) setFixing(null);
            }}>{b("gen") ? "جارٍ التوليد…" : "ولّد الجملة كاملة بهذا النطق"}</button>
          </div>
        ) : null}
      </div>
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
          {!dirty && r.kind === "narration" && r.audio && (r.status === "generated" || r.status === "heard") ? wordChips(r) : null}
          {fixing?.row === r.id ? fixPanel(r) : null}
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
              title={noKey ? "يتطلب مفتاح الصوت من «الإعدادات»" : why ?? ""}
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

  return (
    <div className={`sv${sceneId ? " is-scene" : " is-episode"}`} dir="rtl">
      {!sceneId ? <p className="sv-summary">{ar(voiced)} من {ar(total)} جملة بصوت · {ar(scenes.filter((s) => s.verse).length)} آية</p> : null}
      {noKey ? (
        <p className="sv-why">«ولّد» يحتاج مفتاح الصوت{onOpenSettings ? <> من <button type="button" className="prep-link" onClick={onOpenSettings}>الإعدادات</button></> : " من الإعدادات"}.</p>
      ) : null}
      {!sceneId ? lexiconBlock() : null}
      {scenes.map(sceneBlock)}
      {error ? <p className="scene-first-error" role="alert">{error}</p> : null}
      {msg ? <p className="sp-hint" role="status">{msg}</p> : null}
    </div>
  );
};
