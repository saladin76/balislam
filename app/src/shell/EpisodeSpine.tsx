import React, { useEffect, useRef, useState } from "react";
import { api, type PreparationRead, type SceneProductionRead } from "../api";
import { useOwnerSession } from "./ownerSession";
import { ScriptFixList } from "./ScriptFixList";
import type { Issue } from "../../../src/script/types";
import { PrepareAll } from "../workspace/PrepareAll";
import { arNum, sceneName } from "../workspace/sceneNames";
import { arDigits } from "../ui/format";
import { citationNotice } from "./citationNotice";

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

/** حالة الخطوات الأربع من قراءة السجل: التجهيز = السكريبت والستوري بورد معًا. */
export const stepsDone = (w: Pick<SceneProductionRead, "script" | "storyboard" | "progress"> | null): boolean[] => [
  Boolean(w?.script.approved && w?.storyboard.approved),
  Boolean(w?.progress.canAssemble),
  Boolean(w?.progress.masterApproved),
  Boolean(w?.progress.publishAllowed),
];

type Props = {
  episodeId: string; channelId: string; title: string; tab: StepTab; scriptErrors: Issue[]; onScriptLine: (line: number) => void;
  refreshKey: number; saveState: "saved" | "dirty" | "saving" | "error"; unsaved: boolean;
  onTab: (t: StepTab) => void; onDecided: () => void;
  /** «جهّز كل المشاهد» without a voice key links here. */
  onOpenSettings?: () => void;
  /** The ledger read, shared with the page so a locked step renders one `LockedStep` (D52). */
  onState?: (w: SceneProductionRead | null) => void;
};

/**
 * عمود الحلقة: أربع محطات من اليمين إلى اليسار، يمتلئ الخط بلون القناة حتى الخطوة الحالية،
 * وتحتها جملة واحدة بما يلزم الآن وزر واحد. الحالة كلها من سجل «إنتاج المشاهد» على الخادم.
 */
export const EpisodeSpine: React.FC<Props> = ({ episodeId, channelId, title, tab, scriptErrors, onScriptLine, refreshKey, saveState, unsaved, onTab, onDecided, onOpenSettings, onState }) => {
  const owner = useOwnerSession();
  const [w, setW] = useState<SceneProductionRead | null>(null);
  const [err, setErr] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [boardNote, setBoardNote] = useState("");
  useEffect(() => {
    let live = true;
    setErr("");
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
  const prepOpen = Boolean(w && !(w.script.approved && w.storyboard.approved));
  // Item 12: before the preparation approval, how many citations are still unverified (informative only).
  const [citations, setCitations] = useState("");
  useEffect(() => {
    if (!prepOpen) return setCitations("");
    let live = true;
    api.review(episodeId).then((r) => live && setCitations(citationNotice(r.items)), () => live && setCitations(""));
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
  const here = stepOf(tab);

  /** ما يلزم الآن، وزره: إما قرار يُتخذ هنا، أو انتقال إلى مكانه */
  const next = ((): { text: string; label: string; go?: StepTab; fix?: "script" | "verses"; decide?: "approve-preparation" } | null => {
    if (!w) return null;
    if (!done[0]) {
      if (scriptErrors.length || (prep?.scriptErrors ?? 0) > 0) return { text: "", label: "افتح السكريبت", go: "script", fix: "script" };
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

  const needNote = Boolean(prep && !prep.boardsRecorded);
  const noteOk = !needNote || boardNote.trim().length >= 25;
  /**
   * «اعتمد التجهيز»: one owner action. The server writes the script approval, then (if needed) the board
   * record, then the storyboard approval, each checked on its own; then the scenes start preparing.
   */
  const approvePreparation = async (secret: string) => {
    if (!w) return;
    setBusy(true); setErr("");
    try {
      await api.approvePreparation(episodeId, channelId, secret, {
        scriptSha256: w.script.sha256, storyboardSha256: w.storyboard.sha256, reviewed,
        ...(needNote ? { note: boardNote.trim() } : {}),
      });
      setReviewed(false); setBoardNote("");
      setTick((t) => t + 1); onDecided();
      // The next step is the owner's: the scenes, each shown ready as it is prepared.
      onTab("episode");
    } catch (e) {
      setErr((e as Error).message);
      // Re-read the ledger: a stale fingerprint (e.g. the boards were just signed) must not stay stuck.
      setTick((t) => t + 1);
    }
    finally { setBusy(false); }
  };

  /**
   * The primary button is never shown disabled (D52): it says what it does, and on click it asks for
   * what is still missing, next to itself: the «راجعته بنفسي» tick, the board note, then the passphrase
   * (anchored popover), and then completes the approval.
   */
  const onApprove = async () => {
    setNeeds("");
    if (!reviewed) { setNeeds("ضع علامة «راجعته بنفسي» بعد مراجعة التجهيز، ثم اضغط الزر."); reviewedBox.current?.focus(); return; }
    if (!noteOk) { setNeeds("اكتب ملاحظتك على اللوحات (٢٥ حرفًا على الأقل)."); noteBox.current?.focus(); return; }
    const secret = owner.open ? owner.secret : await owner.ensure(approveBtn.current);
    if (!secret) return;
    await approvePreparation(secret);
  };
  // «راجعته بنفسي» belongs to one decision: never carried over to another.
  const decideTarget = next?.decide ?? "";
  useEffect(() => setReviewed(false), [decideTarget]);

  const fill = current < 0 ? 100 : (current / (STEPS.length - 1)) * 100;
  const inStep1 = here === 0;
  return (
    <section className="spine" aria-label="خطوات الحلقة">
      <div className="spine-head">
        <div className="spine-title">
          <span className="spine-ep">{arDigits(episodeId)}</span>
          <h1>{title}</h1>
        </div>
        <span className={`spine-save${saveState === "error" ? " is-err" : unsaved || saveState !== "saved" ? " is-dirty" : ""}`} role="status">
          {saveState === "error" ? "تعذّر الحفظ" : saveState === "saving" ? "جارٍ الحفظ…" : unsaved || saveState === "dirty" ? "تعديلات غير محفوظة" : "محفوظ"}
        </span>
      </div>
      <ol className="spine-track" style={{ "--fill": `${fill}%` } as React.CSSProperties}>
        {STEPS.map((s, i) => {
          const state = done[i] ? "done" : i === current ? "now" : "later";
          return (
            <li key={s.n} className={`spine-step is-${state}${i === here ? " is-here" : ""}`}>
              <button type="button" onClick={() => onTab(s.tabs[0]!)} aria-current={i === here ? "step" : undefined}>
                <span className="spine-n" aria-hidden="true">{s.n}</span>
                <span className="spine-label">{s.title}</span>
                <span className="spine-state">{done[i] ? "تم" : i === current ? "الآن" : ""}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {/* Step ٢ before «اعتمد التجهيز» is itself one line and one button back to step ١: nothing repeated here. */}
      {/* A locked step screen (D52) carries its own one button: the spine does not repeat it. */}
      {next && !(w && ((!done[0] && (here === 1 || here === 2)) || (!done[2] && here === 3))) ? (
        <div className={`spine-next${next.fix === "script" && inStep1 ? " has-fix" : ""}${next.decide ? " is-decide" : ""}`}>
          {next.fix === "script"
            ? inStep1 && scriptErrors.length
              ? <ScriptFixList errors={scriptErrors} onLine={onScriptLine} />
              : <p>التجهيز لم يُعتمد بعد: {arNum(scriptErrors.length || prep?.scriptErrors || 0)} {(scriptErrors.length || prep?.scriptErrors) === 1 ? "تصحيح ينتظرك" : "تصحيحات تنتظرك"} في السكريبت.</p>
            : <div className="spine-text">
                <p>{next.text}</p>
                {next.decide && citations ? (
                  <p className="spine-hint">{citations}{tab !== "script" ? <> <button type="button" className="prep-link" onClick={() => onTab("script")}>سجل التوثيق</button></> : null}</p>
                ) : null}
              </div>}
          {next.decide ? (
            <div className="spine-decide">
              {needNote ? (
                <input ref={noteBox} type="text" className="spine-note" value={boardNote} maxLength={3000} onChange={(e) => { setBoardNote(e.target.value); setNeeds(""); }}
                  aria-label="ملاحظة مراجعتك للوحات" placeholder="ملاحظتك على اللوحات: ما راجعته فعلًا (٢٥ حرفًا على الأقل)" />
              ) : null}
              <label><input ref={reviewedBox} type="checkbox" checked={reviewed} onChange={(e) => { setReviewed(e.target.checked); setNeeds(""); }} /> راجعته بنفسي</label>
              <button ref={approveBtn} type="button" className="btn primary" aria-busy={busy} onClick={() => { if (!busy) void onApprove(); }}>{busy ? "جارٍ الاعتماد…" : next.label}</button>
              {needs ? <span className="spine-hint spine-needs" role="alert">{needs}</span> : null}
            </div>
          ) : next.go && (next.fix ? tab !== next.go : !STEPS[stepOf(next.go)]!.tabs.includes(tab)) ? (
            <div className="spine-decide">
              {/* الخطوة ٢ الآن وأنت خارج شاشتها: سطر «جاهز ١٢ من ١١٤» هنا، وفي شاشة المشاهد نفسها هناك */}
              {current === 1 && w ? <PrepareAll episodeId={episodeId} channelId={channelId} prepared={w.prepared} order={w.scenes.map((x) => x.id)} onOpenSettings={onOpenSettings} onChanged={() => setTick((t) => t + 1)} /> : null}
              <button type="button" className="btn primary" onClick={() => onTab(next.go!)}>{next.label}</button>
            </div>
          ) : null}
        </div>
      ) : err ? <div className="spine-next"><p className="spine-err" role="alert">حالة الاعتمادات غير متاحة: {err}</p></div> : null}
      {next && err ? <p className="spine-err" role="alert">{err}</p> : null}
      {STEPS[here] && STEPS[here]!.tabs.length > 1 ? (
        <nav className="spine-sub" aria-label="أقسام الخطوة">
          {STEPS[here]!.tabs.map((t) => (
            <button key={t} type="button" aria-pressed={tab === t} onClick={() => onTab(t)}>{SUBTABS[t]}</button>
          ))}
        </nav>
      ) : null}
    </section>
  );
};
