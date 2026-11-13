/**
 * «الجمل» (D50): the state of the sentences panel and every server call it makes, in the same hook order as before
 * the split (work ٨), so its components only display. One audio for the whole page (D62/D105: `pagePlayer`).
 */
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { usePronunciationCheck } from "../../pronunciationApi";
import { api, type OwnRecitationsRead, type SentenceCommand, type SentenceRow, type SentenceScene, type SentencesRead, type WordFixOutcome } from "../../api";
import { useChannel } from "../../../../src/channel/context";
import { versesAreCitations } from "../../../../src/quran/citation";
import { pagePlayer, sentenceClip, type Clip, type PlayerState } from "../sentencePlayer";
import { recitationUrl } from "../RecitationItem";
import type { SentencesPanelProps } from "../SentencesPanel";
import { ar, reopenTarget, toneUpgradeConfirm, wordClick, type WordFixDraft } from "./format";

export const useSentences = ({ episodeId, channelId, sceneId, onBeforeEdit, onPlanReplaced, onMediaChange, onChanged, hasVoiceKeys }: SentencesPanelProps) => {
  /** D68: a channel whose verses are written citations shows the verse as a silent card, never «ارفع التلاوة». */
  const cited = versesAreCitations(useChannel());
  const [read, setRead] = useState<SentencesRead | null>(null);
  /** العمل ٩: تنبيهات فحص النطق المحلي (مطفأ أو غير مثبّت: لا شيء) */
  const pron = usePronunciationCheck(episodeId, channelId, read);
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


  // Hooks stay above every early return below (rules of hooks): the panel first renders «جارٍ تحميل الجمل…»
  // and then the scene, so a hook after those returns crashed step ٢ on its first loaded render (white page, D89).
  /** «أعد توليد ما وُلّد بنبرة سابقة»: أمر المالك الصريح وحده، بعد عرض العدد والحروف (رصيد مدفوع). */
  const olderCount = (read?.scenes ?? []).reduce((n, x) => n + x.rows.filter((r) => r.olderTone).length + (x.olderTone ? 1 : 0), 0);
  // تقدير الرصيد للإشارة: dryRun وحده (لا طلب صوت مدفوع)، ويُحسب من جديد كلما تغيّر العدد
  const [olderPlan, setOlderPlan] = useState<{ chars: number; credits: number } | null>(null);
  useEffect(() => {
    if (sceneId || !olderCount) { setOlderPlan(null); return; }
    let live = true;
    api.toneUpgrade(episodeId, channelId, true).then((r) => { if (live && r.plan) setOlderPlan({ chars: r.plan.chars, credits: r.plan.credits }); }).catch(() => { /* التقدير اختياري */ });
    return () => { live = false; };
  }, [episodeId, channelId, sceneId, olderCount]);

  const noKey = !(hasVoiceKeys ?? read?.voiceKey);
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
  const upgradeAll = async () => {
    setBusy("upgrade-tone"); setError(""); setMsg("");
    try {
      const p = (await api.toneUpgrade(episodeId, channelId, true)).plan!;
      if (!p.sentences.length && !p.sceneJobs.ids.length) { setMsg("لا تسجيل بنبرة سابقة في هذه الحلقة."); return; }
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

  return {
    cited, read, setRead, pron, recs, error, setError, msg, busy, drafts, setDrafts, adding, setAdding, ps, owner, fixing, setFixing, why, setWhy,
    fixed, setFixed, cur, setCur, editing, setEditing, chipRefs, wrap, popRef, popPos, lexDrafts, setLexDrafts, carets, splitting, setSplitting,
    load, anchor, scenes, send, run, ref, lexicon, urlOf, stopPlay, playClips, sceneQueue, clipOf, rowKey, playing_, rowActive, pressRow, pressScene,
    rowPlayTitle, rowKeys, playWord, olderCount, olderPlan, noKey, total, voiced, chipsFor, reopen, pressWord, chipTitle, fixedWord, upgradeAll,
  };
};

export type SentencesModel = ReturnType<typeof useSentences>;
