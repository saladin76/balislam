import React, { useEffect, useState } from "react";
import { api, type SceneProductionRead } from "../api";
import { useOwnerSession } from "./ownerSession";
import { ScriptFixList } from "./ScriptFixList";
import type { Issue } from "../../../src/script/types";
import { PrepareAll } from "../workspace/PrepareAll";

export type StepTab = "script" | "research" | "storyboard" | "episode" | "voice" | "review" | "publish";

/** الخطوات الخمس، وكل خطوة تملك تبويباتها الفرعية */
export const STEPS: { n: string; title: string; tabs: StepTab[] }[] = [
  { n: "١", title: "إعداد الحلقة", tabs: ["script", "research"] },
  { n: "٢", title: "الستوري بورد", tabs: ["storyboard"] },
  { n: "٣", title: "المشاهد", tabs: ["episode", "voice"] },
  { n: "٤", title: "النسخة النهائية", tabs: ["review"] },
  { n: "٥", title: "النشر", tabs: ["publish"] },
];
export const SUBTABS: Partial<Record<StepTab, string>> = {
  script: "السكريبت", research: "البحث والمصادر", episode: "إنتاج المشاهد", voice: "الصوت",
};
export const stepOf = (tab: StepTab) => STEPS.findIndex((s) => s.tabs.includes(tab));

type Props = {
  episodeId: string; channelId: string; title: string; tab: StepTab; scriptErrors: Issue[]; onScriptLine: (line: number) => void;
  refreshKey: number; saveState: "saved" | "dirty" | "saving" | "error"; unsaved: boolean;
  onTab: (t: StepTab) => void; onDecided: () => void;
  /** «جهّز كل المشاهد» without a voice key links here. */
  onOpenSettings?: () => void;
};

/**
 * عمود الحلقة: خمس محطات من اليمين إلى اليسار، يمتلئ الخط بلون القناة حتى الخطوة الحالية،
 * وتحتها جملة واحدة بما يلزم الآن وزر واحد. الحالة كلها من سجل «إنتاج المشاهد» على الخادم.
 */
export const EpisodeSpine: React.FC<Props> = ({ episodeId, channelId, title, tab, scriptErrors, onScriptLine, refreshKey, saveState, unsaved, onTab, onDecided, onOpenSettings }) => {
  const owner = useOwnerSession();
  const [w, setW] = useState<SceneProductionRead | null>(null);
  const [err, setErr] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setErr("");
    api.sceneProduction(episodeId, channelId).then((d) => live && setW(d), (e) => live && (setW(null), setErr((e as Error).message)));
    return () => { live = false; };
  }, [episodeId, channelId, refreshKey, tick]);
  useEffect(() => setReviewed(false), [episodeId, tab]);

  const done = [
    Boolean(w?.script.approved),
    Boolean(w?.storyboard.approved),
    Boolean(w?.progress.canAssemble),
    Boolean(w?.progress.masterApproved),
    Boolean(w?.progress.publishAllowed),
  ];
  const current = done.findIndex((d) => !d);
  const here = stepOf(tab);

  /** ما يلزم الآن، وزره: إما قرار يُتخذ هنا، أو انتقال إلى مكانه */
  const next = ((): { text: string; label: string; go?: StepTab; fix?: boolean; decide?: "approve-script" | "approve-storyboard" } | null => {
    if (!w) return null;
    if (!done[0]) return scriptErrors.length
      ? { text: "", label: "افتح السكريبت", go: "script", fix: true }
      : { text: "راجع النص والمصادر، ثم اعتمد السكريبت المحفوظ.", label: "اعتماد السكريبت", decide: "approve-script" };
    if (!done[1]) return { text: "راجع لوحة كل مشهد، وسجّل مراجعتك في «سجل مراجعة اللوحات» (أدوات وتفاصيل أسفل اللوحات)، ثم اعتمده كاملًا.", label: "اعتماد الستوري بورد", decide: "approve-storyboard" };
    if (!done[2] && !w.progress.currentScene && (w.progress.recitationPending?.length ?? 0) > 0)
      return { text: "كل المشاهد معتمدة، وآيات بانتظار تلاواتها: شاهد المعاينة قبل النهائية وارفع التلاوات.", label: "إلى التلاوات", go: "review" };
    if (!done[2]) return { text: `المشهد ${w.progress.currentScene ?? ""} هو التالي: أنتجه بالصوت والصورة وشاهده قبل اعتماده. (${w.progress.approvedScenes} من ${w.progress.totalScenes})`, label: "إلى المشهد الحالي", go: "episode" };
    // Step ٤ owns everything after the scenes: assembly, its review, making and approving the final file.
    // Step ٥ owns only the publish permission and the files (funnel audit 8 Nov, D36: no bouncing).
    if (!w.assembly) return { text: "كل المشاهد معتمدة. ادمجها في نسخة واحدة للمشاهدة الكاملة.", label: "إلى التجميع", go: "review" };
    if (!w.progress.assemblyApproved) return { text: "شاهد الحلقة المجمعة كاملة 1× وافحص كل وصلة بين مشهدين.", label: "إلى مراجعة التجميع", go: "review" };
    if (!done[3]) return { text: "اصنع النسخة النهائية بدقة 4K، شاهدها كاملة، ثم اعتمد هذا الملف بعينه.", label: "إلى النسخة النهائية", go: "review" };
    if (!done[4]) return { text: "Master معتمد. النشر قرار منفصل لهذا الملف.", label: "إلى النشر", go: "publish" };
    return { text: "مأذون بنشر هذا Master. أي تعديل في مشهد يلغي الإذن.", label: "إلى النشر", go: "publish" };
  })();

  const decide = async (action: "approve-script" | "approve-storyboard") => {
    if (!w) return;
    setBusy(true); setErr("");
    try {
      await api.decideScene(episodeId, channelId, owner.secret, {
        action, expectedSha256: action === "approve-script" ? w.script.sha256 : w.storyboard.sha256, confirmedWatched: true,
        note: action === "approve-script" ? "راجعت السكريبت والمصادر" : "راجعت لوحات الستوري بورد كاملة",
      });
      setReviewed(false);
      setTick((t) => t + 1); onDecided();
    } catch (e) {
      setErr((e as Error).message);
      // Re-read the ledger: a stale fingerprint (e.g. the boards were just signed) must not stay stuck.
      setTick((t) => t + 1);
    }
    finally { setBusy(false); }
  };

  // «راجعته بنفسي» belongs to one decision: never carried from the script over to the storyboard.
  const decideTarget = next?.decide ?? "";
  useEffect(() => setReviewed(false), [decideTarget]);

  const fill = current < 0 ? 100 : (current / (STEPS.length - 1)) * 100;
  return (
    <section className="spine" aria-label="خطوات الحلقة">
      <div className="spine-head">
        <div className="spine-title">
          <span className="spine-ep" dir="ltr">{episodeId}</span>
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
      {next ? (
        <div className={`spine-next${next.fix && here === 0 ? " has-fix" : ""}`}>
          {next.fix
            ? here === 0
              ? <ScriptFixList errors={scriptErrors} onLine={onScriptLine} />
              : <p>السكريبت لم يُعتمد بعد: {scriptErrors.length.toLocaleString("ar-EG")} {scriptErrors.length === 1 ? "تصحيح ينتظرك" : "تصحيحات تنتظرك"} في «إعداد الحلقة».</p>
            : <p>{next.text}</p>}
          {next.decide ? (
            <div className="spine-decide">
              {!owner.open ? <span className="spine-hint">افتح جلسة المالك من أعلى الصفحة لتعتمد.</span> : (
                <label><input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} /> راجعته بنفسي</label>
              )}
              <button type="button" className="btn primary" disabled={!owner.open || !reviewed || busy} onClick={() => void decide(next.decide!)}>{busy ? "جارٍ الاعتماد…" : next.label}</button>
              {next.decide === "approve-storyboard" && tab !== "storyboard" ? <button type="button" className="btn" onClick={() => onTab("storyboard")}>فتح الستوري بورد</button> : null}
            </div>
          ) : next.go && !STEPS[stepOf(next.go)]!.tabs.includes(tab) ? (
            <div className="spine-decide">
              {/* الخطوة ٣ الآن وأنت خارج شاشتها: «جهّز كل المشاهد» هنا، وفي شاشة المشاهد نفسها هناك */}
              {current === 2 && w ? <PrepareAll episodeId={episodeId} channelId={channelId} prepared={w.prepared} onOpenSettings={onOpenSettings} onChanged={() => setTick((t) => t + 1)} /> : null}
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
