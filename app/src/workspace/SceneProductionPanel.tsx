import { FramePlayer } from "./FramePlayer";
export { FramePlayer } from "./FramePlayer";
import React from "react";
import type { SceneProductionRead } from "../api";
import type { Plan } from "../../../src/plan/types";
import type { ChannelInfo } from "../../../src/channel/types";
import type { EpisodeMedia } from "../../../src/plan/media";
import "./scene-production.css";
import "../shell/screens-s3.css";
import { useSceneProduction } from "./sceneProduction/useSceneProduction";
import { SceneStep } from "./sceneProduction/SceneStep";
import { DecisionPanel, FinalSeams, MasterBeforeSeams, SeamsApproved, SeamsBeforeAssembly } from "./sceneProduction/FinalSteps";
import { ar } from "./sceneProduction/notes";

// Work ٨ (D-split): the state and every server call live in `sceneProduction/useSceneProduction.ts`; each visible
// part is its own component under `sceneProduction/`. This file keeps the props, the public exports and which
// screen shows. The older names stay importable from here.
export { fmtTime, problemNote, noteParts, NoteText, noteInboxLine, type ProblemKind } from "./sceneProduction/notes";
export { SceneDecisionActions, type ActionLock } from "./sceneProduction/SceneDecisionActions";
export { SeamRow } from "./sceneProduction/SeamReview";

export type SceneProductionProps = {
  episodeId: string;
  channelId: string;
  onOpenScene: (id: string) => void;
  onOpenStoryboard: () => void;
  onOpenScript: () => void;
  onOpenPublish: () => void;
  /**
   * Given only on step ٤ («النشر»): making and approving the final file belong to step ٣, so before the
   * Master is approved this screen points there instead of repeating it (funnel audit 8 Nov, D36).
   */
  onOpenReview?: () => void;
  /** Step ٢ only: once every scene is approved, its one forward action is step ٣ (assembly and final). */
  onOpenFinal?: () => void;
  /** Step ٢ only: before «اعتمد التجهيز» the whole screen is one line and this one button back to step ١. */
  onOpenPreparation?: () => void;
  onUpdated?: () => void;
  /** Every read model this panel takes (GET or a decision's answer) goes to the band at once (QA: stale «٠ من ١٦٣»). */
  onState?: (w: SceneProductionRead) => void;
  /** Increases after each successful plan save (the App's autosave), so the ledger state is read again. */
  planSaved?: number;
  /** The scene on screen in step ٢ (the App keeps it in the address bar). */
  onShownScene?: (id: string | null) => void;
  /**
   * شاشة «المشاهد» (الخطوة ٢) فقط: الخطة لعرض نص كل مشهد وشريط التقدم، ومحرر المشهد الكامل
   * يُفتح خلف «تحرير المشهد» بدل أن يظهر دائمًا. بدونها تبقى اللوحة شريط القرار في الخطوتين ٣ و٤.
   */
  plan?: Plan;
  channel?: ChannelInfo;
  editor?: (sceneId: string, onSelect: (id: string) => void) => React.ReactNode;
  /** معاينة حية صامتة للمشهد حين لا توجد معاينة بالصوت والصورة بعد */
  livePreview?: (sceneId: string) => React.ReactNode;
  /** طلب فتح مشهد بعينه في المحرر (من الستوري بورد أو الصوت) */
  requestedSceneId?: string;
  onCloseEditor?: () => void;
  /** 11 Nov: show this scene for review (from «تغيّر بعد التجهيز» on top of the storyboard), not its editor. */
  viewSceneId?: string;
  /** صوت المشهد الحالي: الملفات الحالية، ومفاتيح التوليد، وحفظ الخطة (لتغيير النبرة) */
  media?: EpisodeMedia;
  onMediaChange?: (media: EpisodeMedia) => void;
  onPlanSave?: (plan: Plan) => Promise<void>;
  hasVoiceKeys?: boolean;
  /** «جهّز كل المشاهد» without a voice key links to «الاتصالات والمفاتيح». */
  onOpenSettings?: () => void;
  /**
   * First paint only (server-side render in tests): a read model already fetched from the ledger.
   * Display only, never a source of approval; the panel re-reads `api.sceneProduction` on mount.
   */
  initialRead?: SceneProductionRead;
  /** «الجمل» (D50): يُحفظ تعديل الخطة المعلّق قبل أن يكتب الخادم نص مشهد، ثم تُستبدل الخطة بما كتبه (بلا حفظ جديد). */
  onPlanFlush?: () => Promise<void>;
  onPlanReplaced?: (plan: Plan) => void;
  /** Step ٢'s views in the header pill (direction D): the scenes one by one, or those needing a fix. */
  view?: "one" | "fix";
  onView?: (v: "one" | "fix") => void;
  /** Goes up each time the owner asks for «الشورتس» in step ٢: opens «أدوات وتفاصيل» on the shorts picker (owner review, 18 Nov). */
  openShorts?: number;
  /** A scene's board picture for the filmstrip (drawn lazily by the page). */
  thumb?: (sceneId: string) => React.ReactNode;
  /** Step ٣'s views: the seams of the assembled episode, or the final file (the recitations are their own panel). */
  finalView?: "recitations" | "seams" | "master";
  onFinalView?: (v: "recitations" | "seams" | "master") => void;
};

/**
 * The only visible approval surface for scene-first Studio V2.
 * Never infer approval from a video existing or a checkbox in the browser.
 * All decisions are server-authenticated, bound to real bytes and serialized.
 */
export const SceneProductionPanel: React.FC<SceneProductionProps> = (props) => {
  const { editor, onCloseEditor, onOpenPreparation, onOpenStoryboard, onOpenFinal, onPlanFlush, finalView } = props;
  const m = useSceneProduction(props);
  const { data, sceneMode, editing, setEditing, setViewId, refresh, order, shownId, nextOpenId } = m;

  if (sceneMode && editing) {
    // dafatir M6: an edit in the editor changes the scene's inputs; the state is read again on the way back
    // (after the pending plan save), so «أنتج هذا المشهد» unlocks without a reload.
    const close = () => {
      setViewId(editing); setEditing(null); onCloseEditor?.();
      void Promise.resolve(onPlanFlush?.()).then(() => refresh()).catch(() => {});
    };
    const idx = order.indexOf(editing);
    return (
      <>
        <div className="s3-editbar">
          <button type="button" className="btn ghost" onClick={close}>→ العودة إلى المراجعة</button>
          <span title={editing}>تحرير المشهد {idx >= 0 ? ar(idx + 1) : ""}</span>
        </div>
        {editor!(editing, (id) => setEditing(id))}
      </>
    );
  }

  // Before «اعتمد التجهيز» (step ١) step ٢ is one line and one button back; never a disabled action bar.
  // After it (11 Nov) a change is carried forward by the ledger, so this never shows again for the same episode.
  if (sceneMode && data && (!data.script.approved || !data.storyboard.approved)) {
    return (
      <section className="stage s3 s3-gated" aria-label="المشاهد قبل اعتماد التجهيز">
        <div className="s3-gate">
          <p>المشاهد تبدأ بعد اعتماد التجهيز (الستوري بورد والسكريبت) في الخطوة ١.</p>
          <button type="button" className="btn primary" onClick={onOpenPreparation ?? onOpenStoryboard}>إلى التجهيز</button>
        </div>
      </section>
    );
  }
  // Item 16: after the last approval step ٢ keeps its strip and player, so any approved scene can be rewatched.
  // D145: any scene opens here in any order; the decision dock acts on the scene on screen when it is not approved yet.
  const allDoneHere = Boolean(sceneMode && onOpenFinal && data && data.script.approved && data.storyboard.approved && !nextOpenId);
  if (sceneMode && shownId && (!data || nextOpenId || allDoneHere)) {
    return <SceneStep m={m} p={props} shownId={shownId} allDoneHere={allDoneHere} />;
  }

  // التجهيز (السكريبت والستوري بورد) يُعتمد من عمود الخطوات أعلى الصفحة بزر واحد؛ هذه اللوحة لما بعده
  if (data && (!data.script.approved || !data.storyboard.approved)) return null;
  if (data && finalView === "seams" && data.assembly && !data.assembly.approved) return <FinalSeams m={m} p={props} />;
  if (data && finalView === "seams" && !data.assembly && !data.progress.assemblyApproved) return <SeamsBeforeAssembly m={m} p={props} />;
  if (data && finalView === "master" && !data.progress.assemblyApproved) return <MasterBeforeSeams m={m} p={props} />;
  if (data && finalView === "seams" && data.progress.assemblyApproved) return <SeamsApproved m={m} p={props} />;
  return <DecisionPanel m={m} p={props} />;
};
