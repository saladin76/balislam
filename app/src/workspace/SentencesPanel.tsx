import { AYAT, SENTENCES, countAr as countOf } from "../../../src/i18n/count";
import { SplitChooser, caretWordIndex } from "./SplitChooser";
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useScrollLock } from "../ui/scrollLock";
import { api, type OwnRecitationsRead, type SentenceCommand, type SentenceRow, type SentenceScene, type SentencesRead, type WordFixOutcome } from "../api";
import type { Plan } from "../../../src/plan/types";
import type { EpisodeMedia } from "../../../src/plan/media";
import { tones, toneIds, isTone } from "../../../src/voice/tones";
import { dropsShadda, isNoopSay, phoneticVariants } from "../../../src/voice/pronunciationRules";
import { RecitationItem, recitationUrl } from "./RecitationItem";
import { useChannel } from "../../../src/channel/context";
import { versesAreCitations } from "../../../src/quran/citation";
import "./sentences.css";
import { Icon } from "../ui/icons";
import { Num } from "../ui/format";
import { pagePlayer, sentenceClip, type Clip, type PlayerState } from "./sentencePlayer";

const ar = (n: number) => n.toLocaleString("ar-EG");
const secAr = (ms: number) => `${(ms / 1000).toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ث`;
const countAr = (n: number) => (n === 1 ? "جملة واحدة" : n === 2 ? "جملتان" : n <= 10 ? `${ar(n)} جمل` : `${ar(n)} جملة`);
const PAUSES = [0, 150, 250, 350, 450, 600, 800, 1000, 1500, 2000];

const STATUS: Record<SentenceRow["status"] | "scene" | "verse-missing" | "verse-pending" | "verse-approved", string> = {
  missing: "بلا صوت",
  generated: "بصوت",
  stale: "تحتاج توليدًا",
  old: "قديم — سُجّل على نص سابق",
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
 * What pressing a word does (D63): «fix» opens the word popover now (the take has real word timings); «adopt» first
 * cuts the scene's single file into its sentences on the server (no paid call), then opens it; «why» opens the
 * popover that says why in one line and offers «ولّد هذه الجملة ثم صحّح الكلمة». Quranic words do nothing.
 */
export const wordClick = (r: Pick<SentenceRow, "kind" | "wordFix" | "words">, i: number): "fix" | "adopt" | "why" | null =>
  !r.words[i] || r.words[i]!.quran || r.kind !== "narration" ? null : r.wordFix.ok ? "fix" : r.wordFix.adopt ? "adopt" : "why";
/** After a server round (adopt / generate): the same word of the same sentence, by scene and position (a virtual id becomes real). */
export const reopenTarget = (next: SentencesRead, sceneId: string, k: number, i: number):
  { kind: "fix"; draft: WordFixDraft } | { kind: "why"; row: string; index: number } | null => {
  const row = next.scenes.find((x) => x.id === sceneId)?.rows[k];
  if (!row || !row.words[i]) return null;
  return row.wordFix.ok ? { kind: "fix", draft: { row: row.id, index: i, say: row.words[i]!.say, save: false, wide: false } } : { kind: "why", row: row.id, index: i };
};

/**
 * «الجمل» (D50): تعليق المشهد جملةً جملة. لكل جملة نصها (يُعدَّل)، ونبرتها، و«ولّد» لها وحدها، وتشغيلها،
 * وحالتها، ووقفتها، وقائمة (قسّم، ادمج مع التالية، احذف، أضف بعدها). صف الآية «ارفع التلاوة» ولا يولَّد أبدًا.
 * كل فعل يعمل مباشرة بالضغط والخادم يتحقق (بلا كلمة مرور، قرار ٩ نوفمبر)؛ صوت المشهد يُركَّب من جمله حين تكتمل، فيعيد السجل فتح ذلك المشهد وحده.
 */
export const SentencesPanel: React.FC<Props> = ({ episodeId, channelId, sceneId, onBeforeEdit, onPlanReplaced, onMediaChange, onChanged, hasVoiceKeys, onOpenSettings, variant = "list" }) => {
  /** D68: a channel whose verses are written citations shows the verse as a silent card, never «ارفع التلاوة». */
  const cited = versesAreCitations(useChannel());
  const [read, setRead] = useState<SentencesRead | null>(null);
  const [recs, setRecs] = useState<OwnRecitationsRead | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<{ after: string; text: string } | null>(null);
  /** The page-wide player (one audio at a time): what plays now, paused or not, and how far. */
  const [ps, setPs] = useState<PlayerState | null>(() => pagePlayer().state());
  const owner = useRef(`sv-${Math.random().toString(36).slice(2)}`).current;
  /** «أعد نطق الكلمة»: الكلمة المفتوحة ونطقها المكتوب ونتيجة آخر محاولة */
  const [fixing, setFixing] = useState<WordFixDraft | null>(null);
  /**
   * A word pressed whose sentence has no take that can be cut (no exact word timings in the scene's single file,
   * or a stale/estimated take): a popover anchored to it says why in one line and offers «ولّد هذه الجملة ثم صحّح
   * الكلمة» (then the fix popover opens on the same word) or «إلغاء». Never a dead click (D63).
   */
  const [why, setWhy] = useState<{ row: string; index: number } | null>(null);
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
  /** «قسّم…»: the sentence whose split point the owner is choosing (nothing is sent before «قسّم هنا»). */
  const [splitting, setSplitting] = useState<string | null>(null);
  const splitBox = (r: { id: string; text: string; audio?: unknown }, n: number, refOf: Record<string, unknown>) => splitting === r.id ? (
    <SplitChooser text={r.text} n={n} busy={busy === `split:${r.id}`} hasAudio={Boolean(r.audio)} initial={caretWordIndex(r.text, carets.current[r.id])}
      onCancel={() => setSplitting(null)}
      onConfirm={async (at) => { if (await run(`split:${r.id}`, { ...refOf, action: "split", at } as never, { edits: true })) setSplitting(null); }} />
  ) : null;
  useEffect(() => {
    const p = pagePlayer();
    setPs(p.state());
    const off = p.subscribe(setPs);
    p.setErrorHandler(owner, setError);
    return () => { off(); p.setErrorHandler(owner, null); p.stopOwner(owner); };
  }, [owner]);

  const load = async () => {
    const r = await api.sentences(episodeId, channelId);
    setRead(r);
    if (r.scenes.some((s) => (s.verse && !cited) || s.rows.some((x) => x.kind === "basmala"))) setRecs(await api.ownRecitations(episodeId, channelId).catch(() => null));
  };
  useEffect(() => {
    setRead(null); setError(""); setMsg(""); setDrafts({}); setAdding(null); setFixing(null); setWhy(null); setFixed(null); setCur(null); setEditing(null);
    void load().catch((e) => setError((e as Error).message));
    return () => pagePlayer().stopOwner(owner);
  }, [episodeId, channelId, sceneId]); // eslint-disable-line react-hooks/exhaustive-deps

  // The word popover is anchored to its chip (direction D): above it with an arrow on a wide screen, a bottom
  // sheet on a phone with the sentence kept in view. Esc closes it and gives the focus back to the chip.
  const anchor = fixing ?? why;
  useLayoutEffect(() => {
    if (!anchor) { setPopPos(null); return; }
    const chip = chipRefs.current[`${anchor.row}:${anchor.index}`];
    const box = wrap.current;
    if (!chip || !box) return;
    const sheet = typeof window !== "undefined" && window.innerWidth <= 720;
    if (sheet) {
      // Keep the sentence in view above the sheet: scroll the page (only vertically) so the word sits near the top.
      // The page is the scroller (D64); the sheet's own lock starts after this, on its mount.
      window.scrollBy(0, chip.getBoundingClientRect().top - 90);
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
  }, [anchor?.row, anchor?.index, fixing?.wide, Boolean(fixing)]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!anchor) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      const chip = chipRefs.current[`${anchor.row}:${anchor.index}`];
      setFixing(null);
      setWhy(null);
      chip?.focus();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [anchor]);

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

  // ── التشغيل (D62): مشغّل واحد للصفحة؛ الجملة وحدها بحدّيها، والمشهد متتابعًا، والكلمة بسياقها ──
  const urlOf = (file: string, kind: "sentences" | "voice") =>
    `/api/episodes/${encodeURIComponent(episodeId)}/media/${kind}/${encodeURIComponent(file)}?channel=${encodeURIComponent(channelId)}`;
  const stopPlay = () => pagePlayer().stop();
  const playClips = (key: string, clips: Clip[]) => {
    setError("");
    if (!pagePlayer().play(key, clips, owner)) setMsg("لا صوت لتشغيله بعد في هذا المشهد.");
  };
  const sceneQueue = (s: SentenceScene): Clip[] => {
    if (s.verse) return s.verse.file ? [{ id: s.verse.id, url: recitationUrl(episodeId, channelId, s.verse.file) }] : [];
    if (!s.managed) return s.audio.file && s.audio.state !== "stale" ? [{ id: s.id, url: urlOf(s.audio.file, "voice") }] : [];
    // A take recorded on an earlier text («قديم», D97) is heard alone, not inside the scene sequence.
    return s.rows.filter((r) => r.audio && r.status !== "old").map((r) => ({ id: r.id, url: urlOf(r.audio!.file, "sentences"), pauseAfterMs: r.pauseAfterMs }));
  };
  /** The sentence alone: its own take, or its span of the scene's single file (estimated spans say «تقريبي»). */
  const clipOf = (s: SentenceScene, r: SentenceRow) => sentenceClip(r, s, urlOf);
  const rowKey = (r: SentenceRow) => `row:${r.id}`;
  /** Sound is on this sentence now (alone, in the scene queue, or a word of it). */
  const playing_ = (id: string) => ps?.id === id;
  const rowActive = (r: SentenceRow) => ps?.key === rowKey(r);
  /** ▶ / ⏸ on a sentence: the first press plays it alone; then the same button pauses and resumes. */
  const pressRow = (s: SentenceScene, r: SentenceRow) => {
    if (rowActive(r)) { pagePlayer().toggle(); return; }
    const c = clipOf(s, r);
    if (c) playClips(rowKey(r), [c]);
  };
  const pressScene = (s: SentenceScene) => {
    if (ps?.key === `scene:${s.id}`) pagePlayer().toggle(); else playClips(`scene:${s.id}`, sceneQueue(s));
  };
  const rowPlayTitle = (s: SentenceScene, r: SentenceRow, n: number) => {
    if (rowActive(r)) return ps?.paused ? `استأنف الجملة ${ar(n)}` : `إيقاف مؤقت للجملة ${ar(n)}`;
    const c = clipOf(s, r);
    if (!c) return "لا صوت لهذه الجملة بعد";
    if (c.start === undefined) return `شغّل الجملة ${ar(n)}`;
    return c.estimated ? `شغّل الجملة ${ar(n)} من صوت المشهد (حدودها تقريبي)` : `شغّل الجملة ${ar(n)} من صوت المشهد`;
  };
  /** Space on a focused sentence row plays or pauses it (not inside its fields or buttons). */
  const rowKeys = (s: SentenceScene, r: SentenceRow) => (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== " " || e.target !== e.currentTarget) return;
    e.preventDefault();
    pressRow(s, r);
  };
  // Esc stops whatever this panel started (the word popover keeps Esc for itself while open).
  useEffect(() => {
    if (!ps || ps.owner !== owner || anchor) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); pagePlayer().stop(); } };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [Boolean(ps), ps?.owner, owner, anchor]); // eslint-disable-line react-hooks/exhaustive-deps
  /** الكلمة وحدها بسياق ٠٫٣ ث قبلها وبعدها، وتتوقف وحدها */
  const playWord = (r: SentenceRow, i: number) => {
    const w = r.words[i];
    if (!r.audio || !w || w.start === null || w.end === null) return;
    playClips(`word:${r.id}:${i}`, [{ id: r.id, url: urlOf(r.audio.file, "sentences"), start: Math.max(0, w.start - 0.3), end: w.end + 0.3 }]);
  };

  /**
   * ▶ (play) → ⏸ (pause) / ▶ (resume) on the same button, a small ■ beside it while this sentence is on, and a
   * thin progress bar of the sentence; one audio for the whole page.
   */
  const playCtl = (s: SentenceScene, r: SentenceRow, n: number, cls: string, icons: boolean) => {
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
  const sceneCtl = (s: SentenceScene, q: Clip[]) => {
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

  // Hooks stay above every early return below (rules of hooks): the panel first renders «جارٍ تحميل الجمل…»
  // and then the scene, so a hook after those returns crashed step ٢ on its first loaded render (white page, D89).
  /** «أعد توليد ما وُلّد بالنبرة القوية»: أمر المالك الصريح وحده، بعد عرض العدد والحروف (رصيد مدفوع). */
  const olderCount = (read?.scenes ?? []).reduce((n, x) => n + x.rows.filter((r) => r.olderTone).length + (x.olderTone ? 1 : 0), 0);
  // تقدير الرصيد للإشارة: dryRun وحده (لا طلب صوت مدفوع)، ويُحسب من جديد كلما تغيّر العدد
  const [olderPlan, setOlderPlan] = useState<{ chars: number; credits: number } | null>(null);
  useEffect(() => {
    if (sceneId || !olderCount) { setOlderPlan(null); return; }
    let live = true;
    api.toneUpgrade(episodeId, channelId, true).then((r) => { if (live && r.plan) setOlderPlan({ chars: r.plan.chars, credits: r.plan.credits }); }).catch(() => { /* التقدير اختياري */ });
    return () => { live = false; };
  }, [episodeId, channelId, sceneId, olderCount]);
  if (!read) return error ? <p className="scene-first-error" role="alert">{error}</p> : <p className="sp-hint sv-loading">جارٍ تحميل الجمل…</p>;
  if (!scenes.length) return null;

  const noKey = !(hasVoiceKeys ?? read.voiceKey);
  const total = scenes.reduce((n, s) => n + s.rows.length, 0);
  const voiced = scenes.reduce((n, s) => n + s.rows.filter((r) => r.status === "generated" || r.status === "heard" || (r.virtual && s.audio.state === "scene")).length, 0);

  /**
   * Every narration sentence shows its words as chips, and every chip opens something (D63): the fix popover when
   * the take has real word timings; with whole-scene audio of exact timings, the scene file is first cut into its
   * sentences («من صوت المشهد», no paid call) and then the popover opens on the same word; otherwise the «why»
   * popover with «ولّد هذه الجملة ثم صحّح الكلمة».
   */
  const chipsFor = (r: SentenceRow) => r.kind === "narration";
  /** After a server round (adopt / generate): the same word of the same sentence (by scene and position; a virtual id becomes real). */
  const reopen = (next: SentencesRead, sid: string, k: number, i: number) => {
    const t = reopenTarget(next, sid, k, i);
    if (!t) return;
    if (t.kind === "fix") { setCur(t.draft.row); setWhy(null); setFixing(t.draft); }
    else { setCur(t.row); setWhy({ row: t.row, index: t.index }); }
  };
  const pressWord = async (r: SentenceRow, i: number) => {
    const w = r.words[i];
    const kind = wordClick(r, i);
    if (!w || !kind) return;
    setFixed(null);
    if ((fixing?.row === r.id && fixing.index === i) || (why?.row === r.id && why.index === i)) { setFixing(null); setWhy(null); return; }
    setCur(r.id);
    if (kind === "fix") { setWhy(null); setFixing({ row: r.id, index: i, say: w.say, save: false, wide: false }); return; }
    setFixing(null);
    if (kind === "adopt") {
      const sc = scenes.find((x) => x.rows.some((y) => y.id === r.id));
      if (!sc) return;
      const k = sc.rows.findIndex((y) => y.id === r.id);
      const res = await send(`adopt:${r.id}`, { ...ref(r), action: "adopt" });
      if (res) reopen(res.read, sc.id, k, i); else setWhy({ row: r.id, index: i });
      return;
    }
    setWhy({ row: r.id, index: i });
  };
  const chipTitle = (r: SentenceRow, quran: boolean) =>
    quran ? "نص قرآني: لا يُعاد نطقه" : r.wordFix.ok ? "أعد نطق هذه الكلمة وحدها"
      : r.wordFix.adopt ? "صحّح نطق هذه الكلمة (تُقص جملتها من صوت المشهد أولًا، بلا توليد)" : `صحّح نطق هذه الكلمة — ${r.wordFix.reason ?? ""}`;
  const fixedWord = (r: SentenceRow, i: number) =>
    (fixed?.row === r.id && fixed.index === i && fixed.result.ok) || (r.appliedState === "sent" && r.applied.some((a) => a.word === r.words[i]?.word));
  const wordChips = (r: SentenceRow, inline = false) => (
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

  /** The word popover (direction D), wired to the existing sentence API (fixword / generate). */
  const wordPopover = () => {
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
        onWhole={async () => { const res = await send(`gen:${r.id}`, { ...ref(r), action: "generate", word: f.index, say: f.say, save: save() }); if (res) setFixing(null); }} />
    );
  };

  /** «لا توجد أوقات دقيقة…»: why the word can't be cut now, and «ولّد هذه الجملة ثم صحّح الكلمة» (then the fix popover opens). */
  const whyPopover = () => {
    if (!why || fixing) return null;
    const s = scenes.find((x) => x.rows.some((y) => y.id === why.row));
    const r = s?.rows.find((x) => x.id === why.row);
    if (!s || !r || !r.words[why.index]) return null;
    const k = s.rows.indexOf(r);
    const close = () => { const chip = chipRefs.current[`${r.id}:${why.index}`]; setWhy(null); chip?.focus(); };
    const blocked = noKey ? "التوليد يحتاج مفتاح الصوت" : !r.tashkeel.ok ? `التشكيل ${ar(Math.round(r.tashkeel.coverage * 100))}٪ (الحد ٩٨٪)` : null;
    return (
      <WordWhyPopover popRef={popRef} pos={popPos} word={r.words[why.index]!.word} index={why.index} count={r.words.length} rowNo={k + 1}
        reason={r.wordFix.reason ?? "لا تسجيل يُقص لهذه الجملة"} blocked={blocked} busy={busy ? (busy === `gen:${r.id}` ? "gen" : "other") : null}
        onOpenSettings={noKey ? onOpenSettings : undefined} onClose={close}
        onGenerate={async () => { const res = await send(`gen:${r.id}`, { ...ref(r), action: "generate" }); if (res) reopen(res.read, s.id, k, why.index); }} />
    );
  };

  /** Under the sentence after a word fix: «مُصحَّحة نُطقت: X ← Y» with listen/undo, or the failure and what to try. */
  const fixLine = (r: SentenceRow) => {
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
              const fx = (read.lexiconEffects ?? []).find((x) => x.word === e.word);
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

  const row = (s: SentenceScene, r: SentenceRow, i: number) => {
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
      <li key={r.id} className={`sv-row is-${status}${playing_(r.id) ? " is-playing" : ""}`} tabIndex={0} onKeyDown={rowKeys(s, r)}>
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
          {splitBox(r, i + 1, ref(r))}
          {!dirty && chipsFor(r) ? <div className="sv-words-wrap">{wordChips(r)}{!r.wordFix.ok && !r.wordFix.adopt && r.wordFix.reason ? <p className="sp-hint sv-words-why">إعادة نطق كلمة: {r.wordFix.reason}</p> : null}</div> : null}
          {fixLine(r)}
          {r.spoken && r.spoken !== r.text && r.kind === "narration" ? <p className="sv-spoken"><span>النطق:</span> {r.spoken}</p> : null}
          {r.applied.length && r.kind === "narration" ? (
            <p className="sv-spoken sv-applied"><span>{r.appliedState === "sent" ? "نُطقت:" : "ستُنطق:"}</span> {r.applied.map((a) => `${a.word} ← ${a.say}`).join("، ")}</p>
          ) : null}
          {why ? <p className="sv-why">{why}</p> : null}
          {takeNote(r)}
          {r.contextChanged ? <p className="sp-hint">تغيّر ما حولها منذ توليدها؛ أعد توليدها إن بدا الوصل غير طبيعي.</p> : null}
        </div>
        <div className="sv-ctl">
          <span className={`sv-chip is-${status}`}>{STATUS[status]}</span>
          {r.audio?.origin === "scene" ? <small className="sv-origin">من صوت المشهد</small> : null}
          {r.olderTone ? <small className="sv-origin sv-older" title="تسجيلها صالح ولم يُعد توليده آليًا؛ عادت النبرات كما كانت (أُلغي قرار النبرات القوية، ١١ نوفمبر). «أعد توليد ما وُلّد بالنبرة القوية» في أعلى القائمة.">{OLDER_TONE}</small> : null}
          {r.kind === "narration" ? (
            <button type="button" className={`btn${r.status === "missing" || r.status === "stale" || r.status === "old" ? "" : " ghost"}`} disabled={!canGen}
              title={noKey ? "يتطلب مفتاح الصوت من «الاتصالات والمفاتيح»" : why ?? ""}
              onClick={() => void run(`gen:${r.id}`, { ...ref(r), action: "generate" })}>{genLabel}</button>
          ) : null}
          {playCtl(s, r, i + 1, "btn ghost sv-play", false)}
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

  /**
   * The basmala (owner decision 10 Nov): its sentence is the owner's own recording, never the cloned voice —
   * «ارفع التسجيل» through the same recitation flow (processed copy beside the original, listen, approve). One
   * recording serves every scene that holds it; approving it composes those scenes again and re-opens them.
   */
  const basmalaBlock = (s: SentenceScene) => s.rows.some((x) => x.kind === "basmala") ? (
    <div className="sv-basmala" role="group" aria-label="البسملة بصوتك">
      <p className="sp-hint">البسملة تُعامَل كالآية: تسجّلها بصوتك ولا ينطقها الصوت المستنسخ. ارفع التسجيل واعتمده؛ وحتى ذلك تبقى مكانها صامتة بعلامة «التلاوة تُضاف لاحقًا»، وبقية الجمل تُولَّد كالمعتاد.</p>
      <ul className="pf-rec-list sv-verse">
        <RecitationItem compact episodeId={episodeId} channelId={channelId} ayahKey="basmala" scenes={[s.id]} recs={recs}
          onChanged={async () => { await load(); onChanged?.(); }} />
      </ul>
    </div>
  ) : null;

  /** صوت المشهد ملفًا واحدًا بالنبرة القوية المُلغاة: إشارة هادئة، لا تغيير في حالته */
  const olderNote = (s: SentenceScene) => (s.olderTone ? <p className="sp-hint sv-older">صوت المشهد {OLDER_TONE.replace("وُلّدت", "وُلّد")}؛ صالح ولم يُعد توليده آليًا.</p> : null);
  const sceneBlock = (s: SentenceScene) => {
    if (s.verse) {
      const v = s.verse;
      return (
        <section key={s.id} className="sv-scene is-verse" aria-label={`المشهد ${ar(s.index)}: آية`}>
          {!sceneId ? <h4 className="sv-scene-h">المشهد {ar(s.index)} <span>آية — {v.reference}</span></h4> : null}
          {cited ? (
            <p className="sp-hint sv-citation" role="note">استشهاد مكتوب: تظهر الآية بنصها ومرجعها صامتة، بلا تلاوة ولا تسجيل (قرار القناة). لا يولَّد القرآن بالصوت المستنسخ أبدًا.</p>
          ) : (<>
          <ul className="pf-rec-list sv-verse">
            <RecitationItem compact episodeId={episodeId} channelId={channelId} ayahKey={v.ayahKey} scenes={[s.id]} recs={recs}
              onChanged={async () => { await load(); onChanged?.(); }} />
          </ul>
          <p className="sp-hint">تلاوة بشرية ترفعها بنفسك؛ لا يولَّد القرآن بالصوت المستنسخ أبدًا. اعتمادها يعيد فتح مشهدها وحده.</p>
          </>)}
        </section>
      );
    }
    const q = sceneQueue(s);
    return (
      <section key={s.id} className="sv-scene" aria-label={`جمل المشهد ${ar(s.index)}`}>
        <header className="sv-scene-head">
          {sceneId ? <h3>الجمل <span className="sv-meta">{countAr(s.rows.length)}</span></h3>
            : <h4 className="sv-scene-h">المشهد {ar(s.index)}{s.divided ? <span>الفصل {ar(s.chapter)}{s.chapterTitle ? ` — ${s.chapterTitle}` : ""}</span> : null}</h4>}
          {sceneCtl(s, q)}
        </header>
        {!s.managed ? (
          <p className="sp-hint">{s.audio.state === "scene" ? "صوت المشهد الحالي ملف واحد. أي فعل على جملة يبدأ العمل جملةً جملة، ويُقص صوت المشهد إلى جمله إن كانت الوقفات بينها واضحة؛ والملف الأصلي يبقى محفوظًا."
            : "قُسّم التعليق آليًا عند علامات الجملة. ولّد الجمل واحدة واحدة، ويُركَّب صوت المشهد منها حين تكتمل."}</p>
        ) : s.import?.state === "unreliable" && s.audio.state !== "sentences" ? <p className="sp-hint">{s.import.note}</p> : null}
        {s.managed && s.waiting ? <p className="sv-wait" role="status">{s.waiting}</p> : null}
        {olderNote(s)}
        <ol className="sv-list">{s.rows.map((r, i) => row(s, r, i))}</ol>
        {basmalaBlock(s)}
      </section>
    );
  };

  /**
   * The scene's sentences as one readable paragraph (direction D). Each sentence keeps its number (✓ once
   * heard); the current one is in full ink, shows its words as chips when it has a take, and has its controls
   * in one quiet row: play, tone, pause, «ولّد الجملة», «عدّل النص», «⋯». No filled button here.
   */
  /** D97: «قديم — سُجّل على نص سابق» (the old take stays playable; «ولّد» makes the current one), and a take kept under its own tone. */
  const takeNote = (r: SentenceRow) => r.status === "old" ? (
    <p className="sv-old" role="status"><b>قديم — سُجّل على نص سابق.</b> {r.recordedOn ? <>سُجّل على: «{r.recordedOn}». </> : null}
      اسمعه بزر التشغيل؛ لا يدخل صوت المشهد حتى تولّد الجملة بنصها الحالي، ويبقى محفوظًا في التسجيلات السابقة.</p>
  ) : r.recordedTone && isTone(r.recordedTone) && r.recordedTone !== r.inheritedTone && !r.tone ? (
    <p className="sp-hint sv-rectone">سُجّلت بنبرة «{tones[r.recordedTone].nameAr}»؛ تسجيلها صالح كما هو، ونبرة الحلقة تسري على ما يُولَّد بعده.</p>
  ) : null;
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
    const scenePlaying = ps?.key === `scene:${s.id}`;
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
        {olderNote(s)}
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
                  {chipsFor(x) && editing !== x.id ? wordChips(x, true) : isCur ? <span className="sv-sn-t">{x.text}</span>
                    : <span className="sv-sn-t" onClick={() => { setCur(x.id); setFixing(null); setWhy(null); setFixed(null); setEditing(null); }}>{x.text}</span>}
                </span>
              </React.Fragment>
            );
          })}
        </p>
        {basmalaBlock(s)}
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
        {splitBox(r, i + 1, ref(r))}
        {fixLine(r)}
        {!fixed && r.applied.length && r.kind === "narration" ? (
          <p className="sv-spoken sv-applied"><span>{r.appliedState === "sent" ? "نُطقت:" : "ستُنطق:"}</span> {r.applied.map((a) => `${a.word} ← ${a.say}`).join("، ")}</p>
        ) : null}
        {r.spoken && r.spoken !== r.text && r.kind === "narration" && !r.applied.length ? <p className="sv-spoken"><span>النطق:</span> {r.spoken}</p> : null}
        {why ? <p className="sv-why">{why}</p> : null}
        {takeNote(r)}
        {r.contextChanged ? <p className="sp-hint">تغيّر ما حولها منذ توليدها؛ أعد توليدها إن بدا الوصل غير طبيعي.</p> : null}
        <div className="sv-tools" role="group" aria-label={`أدوات الجملة ${ar(i + 1)}`}>
          <span className="sv-lb">الجملة {ar(i + 1)}{r.audio?.origin === "scene" ? <small className="sv-origin">من صوت المشهد</small> : null}{r.audio ? <small><Num>{`${(Math.round(r.audio.duration * 10) / 10).toLocaleString("ar-EG")} ث`}</Num></small> : null}</span>
          {playCtl(s, r, i + 1, "sv-rb", true)}
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
          {scenePlaying ? <span className="sv-scene-on" role="status">المشهد متتابعًا {sceneCtl(s, q)}</span> : null}
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

  const paragraph = variant === "paragraph" && Boolean(sceneId);
  const upgradeAll = async () => {
    setBusy("upgrade-tone"); setError(""); setMsg("");
    try {
      const p = (await api.toneUpgrade(episodeId, channelId, true)).plan!;
      if (!p.sentences.length && !p.sceneJobs.ids.length) { setMsg("لا تسجيل بالنبرة القوية في هذه الحلقة."); return; }
      const ok = window.confirm(toneUpgradeConfirm(p));
      if (!ok) return;
      const r = await api.toneUpgrade(episodeId, channelId, false);
      if (r.media) onMediaChange?.(r.media);
      setRead(await api.sentences(episodeId, channelId));
      const res = r.result!;
      setMsg(`أُعيد التوليد بالنبرة كما كانت (الجمل: ${ar(res.sentences)}، مقاطع المشاهد: ${ar(res.sceneJobs)})؛ التسجيلات السابقة محفوظة.${res.errors.length ? ` تعذّر ${ar(res.errors.length)}: ${res.errors[0]!.error}` : ""}`);
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };
  return (
    <div ref={wrap} className={`sv${sceneId ? " is-scene" : " is-episode"}${paragraph ? " is-para" : ""}`} dir="rtl">
      {!sceneId ? <p className="sv-summary">{ar(voiced)} من {countOf(total, SENTENCES)} بصوت — {countOf(scenes.filter((s) => s.verse).length, AYAT, "بلا آيات")}</p> : null}
      {noKey && !paragraph ? (
        <p className="sv-why">«ولّد» يحتاج مفتاح الصوت{onOpenSettings ? <> من <button type="button" className="prep-link" onClick={onOpenSettings}>الاتصالات والمفاتيح</button></> : " من الإعدادات"}.</p>
      ) : null}
      {!sceneId && olderCount ? (
        <p className="sv-why sv-older-all" role="status">{ar(olderCount)} تسجيل وُلّد بالنبرة القوية (المُلغاة)؛ كلها صالحة ولا يُعاد شيء منها آليًا. عادت النبرات كما كانت.{olderPlan ? ` إعادتها تصرف نحو ${ar(olderPlan.credits)} من رصيد الصوت (${ar(olderPlan.chars)} حرفًا).` : ""}{" "}
          <button type="button" className="btn ghost" disabled={Boolean(busy) || noKey} title={noKey ? "يتطلب مفتاح الصوت" : "يعرض العدد والحروف أولًا ثم يطلب تأكيدك"}
            onClick={() => void upgradeAll()}>{busy === "upgrade-tone" ? "جارٍ التوليد…" : `${UPGRADE_ALL} (${ar(olderCount)})`}</button>
        </p>
      ) : null}
      {!sceneId ? lexiconBlock() : null}
      {scenes.map((s) => (paragraph && !s.verse ? paraBlock(s) : sceneBlock(s)))}
      {wordPopover()}
      {whyPopover()}
      {error ? <p className="scene-first-error" role="alert">{error}</p> : null}
      {msg ? <p className="sp-hint" role="status">{msg}</p> : null}
    </div>
  );
};

export const OLDER_TONE = "وُلّدت بالنبرة القوية (المُلغاة)";
export const UPGRADE_ALL = "أعد توليد ما وُلّد بالنبرة القوية";
/** نص التأكيد: كم جملة وكم مشهد، وأنه يصرف رصيدًا */
export const toneUpgradeConfirm = (p: { sentences: unknown[]; sceneJobs: { ids: unknown[] }; scenes: unknown[]; chars: number; credits: number }) =>
  `${UPGRADE_ALL}؟\nالجمل: ${ar(p.sentences.length)}، ومقاطع المشاهد: ${ar(p.sceneJobs.ids.length)}، في المشاهد: ${ar(p.scenes.length)}.\n` +
  `يصرف نحو ${ar(p.credits)} من رصيد الصوت (${ar(p.chars)} حرفًا). التسجيلات السابقة تبقى محفوظة، والمشاهد المتأثرة تعود لمراجعتك.`;

type WordFixResult = { index: number; word: string; before: string; say: string; save: boolean; result: WordFixOutcome };

/**
 * «أعد نطق الكلمة» (direction D): anchored to its chip with an arrow over a dimmed page (a bottom sheet on a phone):
 * the word big and where it is («الكلمة ٢ من ٩ في الجملة ٣»)، ▶ الكلمة، the sentence with the word highlighted and the
 * neighbours that are re-said with it underlined, the field, «احفظ هذا النطق للقناة», and under «المزيد» two
 * neighbours on each side; «أعد نطق الكلمة» first, «ولّد الجملة كاملة بهذا النطق» as the fallback.
 */
/** Exactly what is sent for the word (D66): the field, with the written word's punctuation around it. */
export const sendPreview = (written: string, say: string) => {
  const lead = written.match(/^[\p{P}\p{S}]+/u)?.[0] ?? "";
  const trail = written.match(/[\p{P}\p{S}]+$/u)?.[0] ?? "";
  return `${lead}${say.trim().replace(/\s+/g, " ")}${trail}`;
};

export const WordFixPopover: React.FC<{
  words: SentenceRow["words"]; rowNo: number; draft: WordFixDraft;
  busy: "fix" | "gen" | "other" | null; noKey: boolean; playing: boolean;
  pos?: { top: number; left: number; arrow: number; sheet: boolean } | null;
  popRef?: React.Ref<HTMLDivElement>;
  onDraft: (d: WordFixDraft) => void; onClose: () => void; onPlay: () => void; onFix: () => void; onWhole: () => void; onOpenSettings?: () => void;
}> = ({ words, rowNo, draft: f, busy, noKey, playing, pos, popRef, onDraft, onClose, onPlay, onFix, onWhole, onOpenSettings }) => {
  const w = words[f.index]!;
  const nb = fixNeighbours(words.length, f.index, f.wide);
  const noop = isNoopSay(w.say, f.say);
  const variants = useMemo(() => phoneticVariants(w.say), [w.say]);
  const id = `fx-${rowNo}-${f.index}`;
  const box = useRef<HTMLDivElement | null>(null);
  const field = useRef<HTMLInputElement | null>(null);
  const placed = Boolean(pos);
  useScrollLock();
  // Keyboard (D52): the popover is measured hidden first, so `autoFocus` alone lands nowhere; once it is placed
  // the focus goes to the field, and the chip that opened it gets it back on close (the panel's onClose/Escape).
  useEffect(() => { if (placed) field.current?.focus({ preventScroll: true }); }, [placed, f.row, f.index]);
  const setBox = (el: HTMLDivElement | null) => {
    box.current = el;
    if (typeof popRef === "function") popRef(el); else if (popRef) (popRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
  };
  // aria-modal: Tab and Shift+Tab stay inside the popover
  const trap = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab" || !box.current) return;
    const all = [...box.current.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), summary, [tabindex]:not([tabindex='-1'])")].filter((x) => x.offsetParent !== null);
    if (!all.length) return;
    const first = all[0]!, last = all[all.length - 1]!;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  return (
    <>
      <div className="ms-scrim" aria-hidden="true" onClick={onClose} />
      <div ref={setBox} className={`ms-pop sv-fix${pos?.sheet ? " is-sheet" : ""}`} role="dialog" aria-modal="true" aria-labelledby={id} onKeyDown={trap}
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
          <span>اكتبها كما يجب أن تُنطق<small>يغيّر ما يُرسل إلى الصوت وحده؛ نص السكريبت والترجمة كما هما</small></span>
          <span className="ms-pop-inp">
            <input ref={field} dir="rtl" value={f.say} maxLength={80} autoFocus disabled={Boolean(busy)} onChange={(e) => onDraft({ ...f, say: e.target.value })} />
            {w.sent !== w.say ? <small>يُرسل الآن «{w.sent}»{w.source === "lexicon" ? " (من قاموس النطق)" : w.source === "sentence" ? " (تصحيح سابق لهذه الجملة)" : w.source === "tashkeel" ? " (من النسخة المشكولة)" : ""}</small> : null}
          </span>
        </label>
        <p className="ms-pop-hint sv-fix-send" aria-live="polite"><Icon name="info" /><span>سيُرسل: «{sendPreview(w.word, f.say)}»{noop ? " — الكلمة كما كُتبت" : ""}</span></p>
        {variants.length ? (
          <div className="sv-fix-variants" role="group" aria-label="جرّب صيغة أخرى">
            <span>جرّب صيغة أخرى:</span>
            {variants.map((v) => (
              <button key={v} type="button" className="sv-t" disabled={Boolean(busy)} aria-pressed={f.say.trim() === v}
                onClick={() => onDraft({ ...f, say: v })}>{v}</button>
            ))}
          </div>
        ) : null}
        <p className="ms-pop-hint"><Icon name="info" /><span>{neighbourHint(words.map((x) => x.word), f.index, f.wide)}</span></p>
        <label className="ms-pop-chk sv-fix-check">
          <input type="checkbox" checked={f.save && !noop} disabled={Boolean(busy) || noop} onChange={(e) => onDraft({ ...f, save: e.target.checked })} />
          <span>احفظ هذا النطق للقناة<small>{noop ? "لا يُحفظ نطق مثل الكلمة تمامًا" : "يُستعمل في كل حلقة، للكلمة بتشكيلها هذا"}</small></span>
        </label>
        {f.save && !noop && dropsShadda(w.say, f.say) ? <p className="ms-pop-hint is-warn"><Icon name="warn" /><span>النطق يحذف الشدّة التي في «{w.say}»؛ تأكد أن هذا مقصود قبل حفظه للقناة.</span></p> : null}
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

/**
 * The word can't be cut now (D63): the word, one line why («لا توجد أوقات دقيقة لكلمات هذا المشهد»), the primary
 * «ولّد هذه الجملة ثم صحّح الكلمة» (the fix popover then opens on the same word by itself), and «إلغاء».
 */
export const WordWhyPopover: React.FC<{
  word: string; index: number; count: number; rowNo: number; reason: string; blocked: string | null;
  busy: "gen" | "other" | null; pos?: { top: number; left: number; arrow: number; sheet: boolean } | null;
  popRef?: React.Ref<HTMLDivElement>; onClose: () => void; onGenerate: () => void; onOpenSettings?: () => void;
}> = ({ word, index, count, rowNo, reason, blocked, busy, pos, popRef, onClose, onGenerate, onOpenSettings }) => {
  const id = `fw-${rowNo}-${index}`;
  const go = useRef<HTMLButtonElement | null>(null);
  const cancel = useRef<HTMLButtonElement | null>(null);
  const placed = Boolean(pos);
  useScrollLock();
  useEffect(() => { if (placed) (go.current && !go.current.disabled ? go.current : cancel.current)?.focus({ preventScroll: true }); }, [placed, rowNo, index]);
  return (
    <>
      <div className="ms-scrim" aria-hidden="true" onClick={onClose} />
      <div ref={popRef} className={`ms-pop sv-fix sv-why-pop${pos?.sheet ? " is-sheet" : ""}`} role="dialog" aria-modal="true" aria-labelledby={id}
        style={pos && !pos.sheet ? { top: pos.top, left: pos.left, ["--ax" as string]: `${pos.arrow}px` } : pos ? undefined : { visibility: "hidden" }}>
        <div className="ms-pop-top">
          <strong className="ms-pop-big sv-fix-word" id={id}>{word}</strong>
          <span className="ms-pop-lbl"><b>الكلمة <Num>{`${index + 1} من ${count}`}</Num></b>في الجملة <Num>{rowNo}</Num></span>
          <button type="button" className="ms-pop-x sv-fix-x" aria-label="أغلق" onClick={onClose}><Icon name="x" /></button>
        </div>
        <p className="ms-pop-hint is-warn sv-why-line"><Icon name="info" /><span>{reason}</span></p>
        {blocked ? <p className="ms-pop-hint"><Icon name="warn" /><span>{blocked}{onOpenSettings ? <> — <button type="button" className="prep-link" onClick={onOpenSettings}>الاتصالات والمفاتيح</button></> : null}</span></p> : null}
        <div className="ms-pop-acts">
          <button ref={go} type="button" className="ms-pop-go" disabled={Boolean(busy) || Boolean(blocked)} onClick={onGenerate}>
            <Icon name="regen" />{busy === "gen" ? "جارٍ توليد الجملة…" : "ولّد هذه الجملة ثم صحّح الكلمة"}
          </button>
          <button ref={cancel} type="button" className="ms-pop-alt" disabled={busy === "gen"} onClick={onClose}>إلغاء</button>
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
