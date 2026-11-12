import React, { useEffect, useRef, useState } from "react";
import { api, type PreparationRead, type SceneProductionRead } from "../api";
import { ScriptFixList } from "./ScriptFixList";
import type { Issue } from "../../../src/script/types";
import { EpisodeTonePick, PrepareAll } from "../workspace/PrepareAll";
import { arNum, sceneName, sceneNames } from "../workspace/sceneNames";
import { SCENES, arabicCountAr } from "../../../src/i18n/count";
import { citationChip, citationNotice } from "./citationNotice";
import { DockChip, DockText } from "./DockText";
import { Icon } from "../ui/icons";

export type StepTab = "script" | "research" | "storyboard" | "episode" | "voice" | "review" | "publish";

/**
 * الخطوات الأربع (funnel v3، قرار صاحب القناة ٨ نوفمبر)، وكل خطوة تملك تبويباتها الفرعية:
 * ١ التجهيز يُعدّه النظام (الستوري بورد والسكريبت والبحث) ويعتمده المالك بزر واحد،
 * ثم ٢ المشاهد خطوة المالك (يعتمد كل مشهد بنصه وحركته وصوته معًا)، ثم ٣ النسخة النهائية، ثم ٤ النشر.
 */
export const STEPS: { n: string; title: string; tabs: StepTab[] }[] = [
  { n: "١", title: "التجهيز", tabs: ["storyboard", "script", "research"] },
  { n: "٢", title: "المشاهد", tabs: ["episode", "voice"] },
  { n: "٣", title: "النسخة النهائية", tabs: ["review"] },
  { n: "٤", title: "النشر", tabs: ["publish"] },
];
export const SUBTABS: Partial<Record<StepTab, string>> = {
  storyboard: "الستوري بورد", script: "السكريبت", research: "البحث والمصادر", episode: "مراجعة المشاهد", voice: "الصوت",
};
export const stepOf = (tab: StepTab) => STEPS.findIndex((s) => s.tabs.includes(tab));

/**
 * حالة الخطوات الأربع من قراءة السجل: التجهيز = السكريبت والستوري بورد معًا، وكل لوحة حالية مسجَّلة.
 * (١١ نوفمبر: «اعتمد التجهيز» مرة واحدة للحلقة؛ أي تغيير بعده يسجّله السجل وحده فلا تعود الخطوة ١ مفتوحة.)
 */
export const stepsDone = (w: Pick<SceneProductionRead, "script" | "storyboard" | "progress" | "boards"> | null): boolean[] => [
  Boolean(w?.script.approved && w?.storyboard.approved && (w?.boards?.current ?? true)),
  Boolean(w?.progress.canAssemble),
  Boolean(w?.progress.masterApproved),
  Boolean(w?.progress.publishAllowed),
];

type Props = {
  episodeId: string; channelId: string; tab: StepTab; scriptErrors: Issue[]; onScriptLine: (line: number) => void;
  refreshKey: number;
  onTab: (t: StepTab) => void; onDecided: () => void;
  /** «جهّز كل المشاهد» without a voice key links here. */
  onOpenSettings?: () => void;
  /** The ledger read, shared with the page so a locked step renders one `LockedStep` (D52). */
  onState?: (w: SceneProductionRead | null) => void;
  /** M1: set the episode tone (the page saves its own plan, so no later save drops it). */
  onEpisodeTone?: (tone: string) => Promise<void>;
  /** D-5/M4: scenes whose designed drawing was made for an earlier text (shown words-only until updated). */
  shotMismatch?: string[];
};

/**
 * ما يلزم الآن في الحلقة (direction D): الخطوات الأربع نفسها في شريط القناة (`Band`)، وهذا المكوّن يقرأ السجل
 * ويضع الفعل التالي الواحد في الشريط العائم أسفل الشاشة: «اعتمد التجهيز» في الخطوة ١ (مع «راجعته بنفسي»
 * وملاحظة اللوحات)، أو سطرًا وزرًا إلى مكان القرار حين يكون المالك خارج خطوته؛ وفي الخطوة ١ ورقة لاصقة
 * «قبل أن تعتمد». الحالة كلها من سجل «إنتاج المشاهد» على الخادم.
 */
export const EpisodeSpine: React.FC<Props> = ({ episodeId, channelId, tab, scriptErrors, onScriptLine, refreshKey, onTab, onDecided, onOpenSettings, onState, onEpisodeTone, shotMismatch = [] }) => {
  const [w, setW] = useState<SceneProductionRead | null>(null);
  const [err, setErr] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [boardNote, setBoardNote] = useState("");
  // M2: a refused «اعتمد التجهيز» re-reads the ledger (a stale fingerprint must not stay stuck), and that
  // re-read must not wipe the refusal the owner has to read. It clears on their next change or success.
  const keepErr = useRef(false);
  useEffect(() => {
    let live = true;
    if (!keepErr.current) setErr("");
    api.sceneProduction(episodeId, channelId).then(
      (d) => { if (live) { setW(d); onState?.(d); } },
      (e) => { if (live) { setW(null); setErr((e as Error).message); onState?.(null); } });
    return () => { live = false; };
  }, [episodeId, channelId, refreshKey, tick]);
  useEffect(() => setReviewed(false), [episodeId, tab]);
  const approveBtn = useRef<HTMLButtonElement>(null);
  const reviewedBox = useRef<HTMLInputElement>(null);
  const noteBox = useRef<HTMLInputElement>(null);
  const [needs, setNeeds] = useState("");
  const prepOpen = Boolean(w && !stepsDone(w)[0]);
  // Item 12: before the preparation approval, how many citations are still unverified (informative only).
  const [citations, setCitations] = useState("");
  const [citeChip, setCiteChip] = useState("");
  useEffect(() => {
    if (!prepOpen) { setCiteChip(""); return setCitations(""); }
    let live = true;
    api.review(episodeId).then((r) => { if (live) { setCitations(citationNotice(r.items)); setCiteChip(citationChip(r.items)); } }, () => { if (live) { setCitations(""); setCiteChip(""); } });
    return () => { live = false; };
  }, [episodeId, prepOpen, refreshKey, tick]);
  // What still blocks «اعتمد التجهيز» on the server (script errors, verses without text, the board record).
  const [prep, setPrep] = useState<PreparationRead | null>(null);
  useEffect(() => {
    if (!prepOpen) return setPrep(null);
    let live = true;
    api.preparation(episodeId, channelId).then((r) => live && setPrep(r), () => live && setPrep(null));
    return () => { live = false; };
  }, [episodeId, channelId, prepOpen, refreshKey, tick]);

  const done = stepsDone(w);
  const current = done.findIndex((d) => !d);
  const div = prep?.textDiverged;
  const diverged = Boolean(div && (div.scenes.length || div.unplaced.length));
  const divergedLine = div ? [
    div.scenes.length ? `نص ${sceneNames(w?.scenes.map((x) => x.id) ?? [], div.scenes, 4)} يختلف عن السكريبت` : "",
    div.unplaced.length ? `ونص في السكريبت لا يقوله أي مشهد (السطر ${div.unplaced.slice(0, 4).map((n) => arNum(n)).join("، ")})` : "",
  ].filter(Boolean).join(" ") : "";
  const here = stepOf(tab);

  /** ما يلزم الآن، وزره: إما قرار يُتخذ هنا، أو انتقال إلى مكانه */
  const next = ((): { text: string; label: string; go?: StepTab; fix?: "script" | "verses"; decide?: "approve-preparation" } | null => {
    if (!w) return null;
    if (!done[0]) {
      if (scriptErrors.length || (prep?.scriptErrors ?? 0) > 0) return { text: "", label: "افتح السكريبت", go: "script", fix: "script" };
      // QA balislam 2: the boards and the script must say the same text before the approval (the server refuses too).
      if (diverged) return { text: `اللوحات والسكريبت مختلفان: ${divergedLine}. عدّل نص المشهد أو السكريبت حتى يتطابقا، ثم اعتمد التجهيز.`, label: "افتح السكريبت", go: "script", fix: "verses" };
      if (prep?.versesMissing.length) return { text: `آيات بلا نصها في السكريبت: ${arNum(prep.versesMissing.length)}. اكتب نص كل آية في سطرها ثم اعتمد التجهيز.`, label: "افتح السكريبت", go: "script", fix: "verses" };
      // Outside step ١ the decision is not repeated: step ٢ shows its own one line and one button back.
      if (stepOf(tab) !== 0) return { text: "التجهيز (الستوري بورد والسكريبت) لم يُعتمد بعد.", label: "إلى التجهيز", go: "storyboard" };
      return { text: "راجع الستوري بورد والسكريبت والمصادر، ثم اعتمد التجهيز؛ بعده تبدأ المشاهد تُجهَّز وحدها.", label: "اعتمد التجهيز", decide: "approve-preparation" };
    }
    if (!done[1] && !w.progress.currentScene && (w.progress.recitationPending?.length ?? 0) > 0)
      return { text: "كل المشاهد معتمدة، وآيات بانتظار تلاواتها: شاهد المعاينة قبل النهائية وارفع التلاوات.", label: "إلى التلاوات", go: "review" };
    if (!done[1]) return { text: `${sceneName(w.scenes.map((x) => x.id), w.progress.currentScene)} ينتظر قرارك: شاهده بنصه وحركته وصوته، ثم اعتمده. (معتمد ${arNum(w.progress.approvedScenes)} من ${arNum(w.progress.totalScenes)})`, label: "إلى المشهد الحالي", go: "episode" };
    // Step ٣ owns everything after the scenes: assembly, its review, making and approving the final file.
    // Step ٤ owns only the publish permission and the files (funnel audit 8 Nov, D36: no bouncing).
    if (!w.assembly) return { text: "كل المشاهد معتمدة. ادمجها في نسخة واحدة للمشاهدة الكاملة.", label: "إلى التجميع", go: "review" };
    if (!w.progress.assemblyApproved) return { text: "شاهد الحلقة المجمعة كاملة ١× وافحص كل وصلة بين مشهدين.", label: "إلى مراجعة التجميع", go: "review" };
    if (!done[2]) return { text: "اصنع النسخة النهائية بدقة 4K، شاهدها كاملة، ثم اعتمد هذا الملف بعينه.", label: "إلى النسخة النهائية", go: "review" };
    if (!done[3]) return { text: "النسخة النهائية معتمدة. النشر قرار منفصل لهذا الملف.", label: "إلى النشر", go: "publish" };
    return { text: "مأذون بنشر هذه النسخة النهائية. أي تعديل في مشهد يلغي الإذن.", label: "إلى النشر", go: "publish" };
  })();

  // 11 Nov: the board note is optional and one line (no minimum); «راجعته بنفسي» is the confirmation.
  const needNote = Boolean(prep && !prep.boardsRecorded);
  /**
   * «اعتمد التجهيز»: one owner action. The server writes the script approval, then (if needed) the board
   * record, then the storyboard approval, each checked on its own; then the scenes start preparing.
   */
  const approvePreparation = async () => {
    if (!w) return;
    setBusy(true); setErr("");
    try {
      await api.approvePreparation(episodeId, channelId, {
        scriptSha256: w.script.sha256, storyboardSha256: w.storyboard.sha256, reviewed,
        ...(needNote && boardNote.trim() ? { note: boardNote.trim() } : {}),
      });
      keepErr.current = false;
      setReviewed(false); setBoardNote("");
      setTick((t) => t + 1); onDecided();
      // The next step is the owner's: the scenes, each shown ready as it is prepared.
      onTab("episode");
    } catch (e) {
      setErr((e as Error).message);
      keepErr.current = true;
      // Re-read the ledger: a stale fingerprint (e.g. the boards were just signed) must not stay stuck.
      setTick((t) => t + 1);
    }
    finally { setBusy(false); }
  };

  /**
   * The primary button is never shown disabled (D52): it says what it does, and on click it asks for
   * what is still missing, next to itself: the «راجعته بنفسي» tick; then it completes
   * the approval directly (no passphrase, owner decision 9 Nov).
   */
  const onApprove = async () => {
    setNeeds("");
    keepErr.current = false;
    if (!reviewed) { setNeeds("ضع علامة «راجعته بنفسي» بعد مراجعة التجهيز، ثم اضغط الزر."); reviewedBox.current?.focus(); return; }
    await approvePreparation();
  };
  // «راجعته بنفسي» belongs to one decision: never carried over to another.
  const decideTarget = next?.decide ?? "";
  useEffect(() => setReviewed(false), [decideTarget]);

  const inStep1 = here === 0;
  // A locked step screen (D52) carries its own one button, and step ٢ before «اعتمد التجهيز» is itself
  // one line and one button back to step ١: the spine repeats neither.
  const quiet = Boolean(w && ((!done[0] && (here === 1 || here === 2)) || (!done[2] && here === 3)));
  // The note sits in the gutter of the boards view only: over the script or the research it would cover the text.
  const showNote = Boolean(w && !done[0] && inStep1 && tab === "storyboard");
  const scriptFixes = scriptErrors.length || prep?.scriptErrors || 0;
  return (
    <>
      {/* «قبل أن تعتمد»: what the preparation approval rests on, on a sticky note in the gutter (direction D) */}
      {showNote ? (
        <aside className="ms-note ms-spine-note" aria-label="قبل أن تعتمد">
          <h2>قبل أن تعتمد</h2>
          <ul>
            <li className={scriptFixes || diverged ? "is-warn" : undefined}><i aria-hidden="true">{scriptFixes || diverged ? "!" : <Icon name="check" />}</i>
              <span>السكريبت<small>{scriptFixes ? <>{arNum(scriptFixes)} {scriptFixes === 1 ? "تصحيح ينتظرك" : "تصحيحات تنتظرك"}</> : diverged ? "لا يطابق اللوحات (انظر أدناه)" : "بلا أخطاء تمنع الاعتماد"}</small></span></li>
            {diverged ? (
              <li className="is-warn"><i aria-hidden="true">!</i><span>اللوحات والسكريبت<small>{divergedLine}. ما يُعتمد يجب أن يكون ما يُنطق.</small></span></li>
            ) : null}
            {shotMismatch.length ? (
              <li className="is-warn"><i aria-hidden="true">!</i><span>الرسوم<small>{arabicCountAr(shotMismatch.length, SCENES)} {shotMismatch.length === 1 ? "رسمه صُمم" : "رسمها صُمم"} لنص سابق ({sceneNames(w?.scenes.map((x) => x.id) ?? shotMismatch, shotMismatch, 4)})؛ تُعرض بالكلمات وحدها حتى تُحدَّث.</small></span></li>
            ) : null}
            <li className={prep && !prep.boardsRecorded ? "is-warn" : undefined}><i aria-hidden="true">{prep && !prep.boardsRecorded ? "!" : <Icon name="check" />}</i>
              <span>اللوحات<small>{prep && !prep.boardsRecorded ? "راجعها كلها؛ ملاحظتك بجوار الزر اختيارية" : "سُجّلت مراجعتها"}</small></span></li>
            {prep?.versesMissing.length ? (
              <li className="is-warn"><i aria-hidden="true">!</i><span>آيات بلا نصها<small>{arNum(prep.versesMissing.length)} في السكريبت</small></span></li>
            ) : null}
            {prep?.toneMissing?.length ? (
              <li className="is-warn spine-tone"><i aria-hidden="true">!</i><span>النبرة<small>{onEpisodeTone
                ? <EpisodeTonePick scenes={prep.toneMissing} order={w!.scenes.map((x) => x.id)} episodeId={episodeId} channelId={channelId} onPick={async (t) => { await onEpisodeTone(t); setTick((k) => k + 1); }} />
                : `لا نبرة للحلقة (${sceneNames(w!.scenes.map((x) => x.id), prep.toneMissing, 4)}): اخترها في تحرير المشهد ← «نبرة الصوت في الحلقة».`}
                {" "}بدونها يتوقف تجهيز الصوت فور بدئه.</small></span></li>
            ) : null}
            {citations ? (
              <li className="is-warn"><i aria-hidden="true">!</i><span>الاستشهادات<small>{citations}{tab !== "script" ? <> <button type="button" className="ms-link" onClick={() => onTab("script")}>سجل التوثيق</button></> : null}</small></span></li>
            ) : null}
          </ul>
        </aside>
      ) : null}
      {next && !quiet && next.fix === "script" && inStep1 && scriptErrors.length ? (
        <section className="ms-spine-fix" aria-label="ما يمنع اعتماد التجهيز"><ScriptFixList errors={scriptErrors} onLine={onScriptLine} /></section>
      ) : null}
      {next && !quiet ? (
        next.decide ? (
          <div className="ms-dock" role="group" aria-label="اعتماد التجهيز">
            {needs || err ? <p className="ms-float spine-needs" role="alert">{needs || err}</p> : null}
            <div className="ms-dock-in is-wrap">
              <div className="ms-dock-ctl">
              {citations && citeChip ? <DockChip label={citeChip} text={citations}>{tab !== "script" ? <button type="button" className="ms-link" onClick={() => onTab("script")}>افتح سجل التوثيق</button> : null}</DockChip> : null}
              {needNote ? (
                <input ref={noteBox} type="text" className="ms-dock-note spine-note" value={boardNote} maxLength={300} onChange={(e) => { setBoardNote(e.target.value.replace(/[\r\n]+/g, " ")); setNeeds(""); }}
                  aria-label="ملاحظة مراجعتك للوحات (اختيارية)" placeholder="ملاحظة (اختيارية، سطر واحد)" />
              ) : null}
              <label className="ms-cb"><input ref={reviewedBox} type="checkbox" checked={reviewed} onChange={(e) => { setReviewed(e.target.checked); setNeeds(""); }} /> راجعته بنفسي</label>
              <button ref={approveBtn} type="button" className="btn primary" aria-busy={busy} onClick={() => { if (!busy) void onApprove(); }}>
                <Icon name="check" />{busy ? "جارٍ الاعتماد…" : next.label}
              </button>
              </div>
            </div>
          </div>
        ) : next.fix === "script" && inStep1 && scriptErrors.length ? null : next.go && (next.fix ? tab !== next.go : !STEPS[stepOf(next.go)]!.tabs.includes(tab)) ? (
          <div className="ms-dock" role="group" aria-label="الخطوة التالية">
            {err ? <p className="ms-float spine-err" role="alert">{err}</p> : null}
            <div className="ms-dock-in is-wrap">
              <DockText line={next.fix === "script"
                ? <>التجهيز لم يُعتمد بعد: {arNum(scriptFixes)} {scriptFixes === 1 ? "تصحيح ينتظرك" : "تصحيحات تنتظرك"} في السكريبت.</>
                : next.text} />
              {/* الخطوة ٢ الآن وأنت خارج شاشتها: سطر «جاهز ١٢ من ١١٤» هنا، وفي شاشة المشاهد نفسها هناك */}
              <div className="ms-dock-ctl">
              {current === 1 && w ? <PrepareAll episodeId={episodeId} channelId={channelId} prepared={w.prepared} order={w.scenes.map((x) => x.id)} onOpenSettings={onOpenSettings} onChanged={() => setTick((t) => t + 1)} onEpisodeTone={onEpisodeTone} /> : null}
              {/* Navigation to where the decision is: outlined, so the screen's own action stays the one filled button */}
              <button type="button" className="btn ms-go-nav" onClick={() => onTab(next.go!)}>{next.label}<Icon name="chev" /></button>
              </div>
            </div>
          </div>
        ) : err ? <div className="ms-dock"><p className="ms-float spine-err" role="alert">{err}</p></div> : null
      ) : err && !next ? <div className="ms-dock"><p className="ms-float spine-err" role="alert">حالة الاعتمادات غير متاحة: {err}</p></div> : null}
    </>
  );
};
