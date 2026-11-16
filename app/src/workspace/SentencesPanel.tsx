import { AYAT, SENTENCES, countAr as countOf } from "../../../src/i18n/count";
import React from "react";
import type { Plan } from "../../../src/plan/types";
import type { EpisodeMedia } from "../../../src/plan/media";
import "./sentences.css";
import { OwnerText } from "../ui/OwnerText";
import { useSentences } from "./sentences/useSentences";
import { UPGRADE_ALL, ar } from "./sentences/format";
import { LexiconBlock, SentenceWhyPopover, SentenceWordPopover } from "./sentences/SentenceParts";
import { SentenceParagraph } from "./sentences/SentenceParagraph";
import { SentenceSceneBlock } from "./sentences/SentenceSceneBlock";

// Work ٨ (D-split): the state and every server call live in `sentences/useSentences.ts`; each visible part is its
// own component under `sentences/`. This file keeps the props, the public exports and the panel's frame.
export {
  fixNeighbours, neighbourHint, wordClick, reopenTarget, sendPreview, currentSay, sourceLabel, OLDER_TONE, UPGRADE_ALL, toneUpgradeConfirm, type WordFixDraft,
} from "./sentences/format";
export { WordFixPopover, WordWhyPopover, WordFixLine } from "./sentences/WordPopovers";

export type SentencesPanelProps = {
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
  /** D131: each shown scene's narration sentences with a current take, so step ٢ can say why its preview is silent */
  onVoiceProgress?: (sceneId: string, p: { done: number; total: number }) => void;
};

/**
 * «الجمل» (D50): تعليق المشهد جملةً جملة. لكل جملة نصها (يُعدَّل)، ونبرتها، و«ولّد» لها وحدها، وتشغيلها،
 * وحالتها، ووقفتها، وقائمة (قسّم، ادمج مع التالية، احذف، أضف بعدها). صف الآية «ارفع التلاوة» ولا يولَّد أبدًا.
 * كل فعل يعمل مباشرة بالضغط والخادم يتحقق (بلا كلمة مرور، قرار ٩ نوفمبر)؛ صوت المشهد يُركَّب من جمله حين تكتمل، فيعيد السجل فتح ذلك المشهد وحده.
 */
export const SentencesPanel: React.FC<SentencesPanelProps> = (props) => {
  const { sceneId, onOpenSettings, variant = "list" } = props;
  const m = useSentences(props);
  const { read, error, msg, busy, scenes, wrap, noKey, total, voiced, olderCount, olderPlan, upgradeAll } = m;
  if (!read) return error ? <p className="scene-first-error" role="alert"><OwnerText text={error} /></p> : <p className="sp-hint sv-loading">جارٍ تحميل الجمل…</p>;
  if (!scenes.length) return null;

  const paragraph = variant === "paragraph" && Boolean(sceneId);
  return (
    <div ref={wrap} className={`sv${sceneId ? " is-scene" : " is-episode"}${paragraph ? " is-para" : ""}`} dir="rtl">
      {!sceneId ? <p className="sv-summary">{ar(voiced)} من {countOf(total, SENTENCES)} بصوت — {countOf(scenes.filter((s) => s.verse).length, AYAT, "بلا آيات")}</p> : null}
      {noKey && !paragraph ? (
        <p className="sv-why">«ولّد» يحتاج مفتاح الصوت{onOpenSettings ? <> من <button type="button" className="prep-link" onClick={onOpenSettings}>الاتصالات والمفاتيح</button></> : " من الإعدادات"}.</p>
      ) : null}
      {!sceneId && olderCount ? (
        <p className="sv-why sv-older-all" role="status">{ar(olderCount)} تسجيل وُلّد بنبرة سابقة؛ كلها صالحة ولا يُعاد شيء منها آليًا. صارت كل نبرة تُسمع بأدائها على الصوت الحالي (D136)، فإعادتها تُسمعك الفرق.{olderPlan ? ` إعادتها تصرف نحو ${ar(olderPlan.credits)} من رصيد الصوت (${ar(olderPlan.chars)} حرفًا).` : ""}{" "}
          <button type="button" className="btn ghost" disabled={Boolean(busy) || noKey} title={noKey ? "يتطلب مفتاح الصوت" : "يعرض العدد والحروف أولًا ثم يطلب تأكيدك"}
            onClick={() => void upgradeAll()}>{busy === "upgrade-tone" ? "جارٍ التوليد…" : `${UPGRADE_ALL} (${ar(olderCount)})`}</button>
        </p>
      ) : null}
      {!sceneId ? <LexiconBlock m={m} /> : null}
      {scenes.map((s) => (paragraph && !s.verse ? <SentenceParagraph key={s.id} m={m} p={props} s={s} /> : <SentenceSceneBlock key={s.id} m={m} p={props} s={s} />))}
      <SentenceWordPopover m={m} p={props} />
      <SentenceWhyPopover m={m} p={props} />
      {error ? <p className="scene-first-error" role="alert"><OwnerText text={error} /></p> : null}
      {msg ? <p className="sp-hint" role="status"><OwnerText text={msg} /></p> : null}
    </div>
  );
};
