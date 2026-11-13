import React from "react";
import { createPortal } from "react-dom";
import { inheritedToneLabel, tones, toneIds } from "../../../../src/voice/tones";
import { toneMapKeepLabel, toneMapNote } from "../toneMapCopy";
import { Icon } from "../../ui/icons";
import { DockText } from "../../shell/DockText";
import { Num } from "../../ui/format";
import { OwnerText } from "../../ui/OwnerText";
import { fmtTime, type ProblemKind } from "./notes";

export type VoiceState = "none" | "missing" | "stale" | "ok";

/** سبب يمنع القرار كله الآن (تحميل الحالة، أو مشهد غير الحالي)، وفعل واحد يحلّه (الزر الممتلئ الوحيد حينها). */
export type ActionLock = { reason: string; action?: { label: string; onClick: () => void } };

/**
 * قرار المشهد الحالي في الخطوة ٢ (funnel v3، قرار صاحب القناة ٨ نوفمبر): المالك يعتمد أولًا النص مع الحركة
 * مع الصوت معًا، ثم أزرار حل المشكلات بعده. الترتيب ثابت من اليمين: «اعتمد المشهد» (الممتلئ الوحيد، أكبر)، ثم
 * «الحركة غير مناسبة» (بملاحظة)، ثم «النبرة غير مناسبة» (بملاحظة)، ثم «أعد توليد الصوت».
 * المشهد غير الجاهز بعد: «اعتمد» ينتظر وسطر واحد بتقدمه (يُجهَّز الآن / في الدور)، و«أنتج هذا المشهد» هادئًا
 * حين لا يعمل التجهيز. لا يغيّر الشريط أي بوابة: كل زر يمر بالمسار القائم نفسه، والخادم يرفض ما لا يحق.
 * المِرسَم (direction D): الشريط داكن عائم أسفل الشاشة، والسطر والتأكيد والملاحظة بطاقات صغيرة فوقه.
 */
export const SceneDecisionActions: React.FC<{
  /** review: معاينة المشهد بصوته جاهزة للقرار؛ render: لم تُجهَّز بعد */
  stage: "review" | "render";
  voice: VoiceState;
  voiceBusy: boolean;
  voiceMsg?: string;
  canVoice: boolean;
  readyForAv: boolean;
  pending: boolean;
  problem: { kind: ProblemKind; at: number } | null;
  problemText: string;
  tone: string;
  confirming: boolean;
  reviewed: boolean;
  /** التجهيز يعمل: "now" هذا المشهد قيد التجهيز، "queued" في الدور */
  preparing?: "now" | "queued" | null;
  /** M4: «بانتظار التعديل» — sent back with this note, inputs unchanged: no re-render until they change. */
  awaitingChange?: string | null;
  /** القرار كله غير متاح لسبب واحد (لا شريط معطّل): السبب وزر واحد */
  locked?: ActionLock;
  /** السابق والتالي وعدد المعتمد، على طرفي الشريط (خارج مجموعة القرار) */
  nav?: { prev: React.ReactNode; next: React.ReactNode; count: React.ReactNode };
  /**
   * Where the reason «اعتمد» waits for is read (a place in the page's column, under the frame). Without one it floats
   * above the dock; with one it sits in the page's flow, so it never covers the filmstrip, the sentences or «أدوات وتفاصيل».
   */
  reasonsHost?: HTMLElement | null;
  onOpenSettings?: () => void;
  onVoice: () => void;
  onProblem: (kind: ProblemKind) => void;
  onProblemText: (text: string) => void;
  onTone: (tone: string) => void;
  /** نبرة الحلقة الموروثة (تُسمّى في خيار «مثل الحلقة») */
  episodeTone?: string;
  /** الحلقة لها خريطة نبرة: الاختيار يحدّثها لهذا المشهد (toneMapCopy.ts) */
  toneMapVersion?: string;
  onCancelProblem: () => void;
  onSubmitProblem: () => void;
  onConfirm: (reviewed: boolean) => void;
  onApprove: () => void;
  onRender: () => void;
}> = (p) => {
  const edges = (bar: React.ReactNode) => (
    <div className="ms-dock-in">
      {p.nav ? p.nav.prev : null}
      {bar}
      {p.nav ? <><span className="ms-dv" aria-hidden="true" /><span className="ms-ct">{p.nav.count}</span>{p.nav.next}</> : null}
    </div>
  );
  if (p.locked) {
    return (
      <div className="s3-act ms-dock">
        {edges(
          <div className="s3-why" role="note">
            <DockText className="sp-hint" line={p.locked.reason} />
            {p.locked.action ? <button type="button" className="btn primary s3-why-go" onClick={p.locked.action.onClick}>{p.locked.action.label}</button> : null}
          </div>,
        )}
      </div>
    );
  }
  const at = p.problem ? fmtTime(p.problem.at) : "";
  const problemReady = p.problem?.kind === "motion" ? Boolean(p.problemText.trim()) : Boolean(p.problem);
  const review = p.stage === "review";
  const voiceLabel = p.voiceBusy ? "جارٍ توليد الصوت…" : p.voice === "ok" ? "أعد توليد الصوت" : "ولّد الصوت";
  const voiceOff = p.voiceBusy || p.pending || !p.canVoice || Boolean(p.preparing);
  const needVoice = p.voice === "missing" || p.voice === "stale";
  // سطر واحد بما ينتظره «اعتمد»، ثم ما يمنع غيره
  const reasons: React.ReactNode[] = [];
  if (!review) reasons.push(
    // QA 12 Nov: the note itself is shown once, above, with its badge («الحركة عند ٠:٠٠»), never its raw «[الحركة @0:00]» tag
    p.awaitingChange != null ? `بانتظار التعديل: إنتاجه بالمدخلات نفسها يعطي النسخة نفسها؛ يُنتج من جديد حين يتغيّر (نبرة، نص، لوحة) أو حين تُجاب ملاحظتك «أُصلحت».`
    : p.preparing === "now" ? "يُجهَّز هذا المشهد الآن بصوته وحركته؛ «اعتمد» يُفتح حين تكتمل معاينته."
      : p.preparing === "queued" ? "هذا المشهد في دور التجهيز؛ «اعتمد» يُفتح حين تكتمل معاينته."
      : !p.readyForAv ? "ينقص هذا المشهد صوت الراوي: ولّد الصوت، ثم أنتج المشهد."
      : "لم تُجهَّز معاينة هذا المشهد بعد: أنتجه ليُعرض بصوته وحركته.");
  if (!p.canVoice && needVoice) reasons.push(
    p.onOpenSettings ? <>أضف مفتاح الصوت من <button type="button" className="prep-link" onClick={p.onOpenSettings}>الاتصالات والمفاتيح</button>.</> : "أضف مفتاح الصوت من الإعدادات.",
  );
  const tool = (label: string, icon: "motion" | "tone" | "regen" | "film", rest: React.ButtonHTMLAttributes<HTMLButtonElement> & { cta?: boolean }) => {
    const { cta, ...attrs } = rest;
    return (
      <button type="button" className={`btn ${cta ? "s3-cta" : "ghost"}`} aria-label={label} title={label} {...attrs}>
        <Icon name={icon} /><span className="lbl">{label}</span>
      </button>
    );
  };
  return (
    <div className="s3-act ms-dock">
      {edges(
        <div className="s3-actbar" role="group" aria-label="قرار المشهد">
          <button type="button" className="btn primary s3-approve" disabled={!review || p.pending || (p.confirming && !p.reviewed)} onClick={p.onApprove}>
            <Icon name="check" />{review && p.pending ? "جارٍ…" : "اعتمد المشهد"}<kbd aria-hidden="true">⏎</kbd>
          </button>
          <span className="ms-dv" aria-hidden="true" />
          {tool("الحركة غير مناسبة", "motion", { "aria-pressed": p.problem?.kind === "motion", disabled: !review || p.pending, onClick: () => p.onProblem("motion") })}
          {tool("النبرة غير مناسبة", "tone", { "aria-pressed": p.problem?.kind === "tone", disabled: !review || p.pending, onClick: () => p.onProblem("tone") })}
          {p.voice !== "none" ? tool(voiceLabel, "regen", { cta: needVoice && !p.preparing, disabled: voiceOff, title: p.canVoice ? voiceLabel : "يتطلب مفتاح الصوت من «الاتصالات والمفاتيح»", onClick: p.onVoice }) : null}
          {!review && !p.preparing ? tool(p.pending ? "جارٍ الإنتاج…" : "أنتج هذا المشهد", "film", { disabled: p.pending || !p.readyForAv || p.voiceBusy || p.awaitingChange != null,
            ...(p.awaitingChange != null ? { title: "بانتظار التعديل: يُنتج من جديد حين تتغيّر مدخلاته" } : {}), onClick: p.onRender }) : null}
        </div>,
      )}
      {reasons.length && p.reasonsHost ? createPortal(
        <div className="s3-why s3-why-inline" role="note">
          {reasons.map((r, i) => <p key={i} className="sp-hint">{r}</p>)}
        </div>, p.reasonsHost,
      ) : reasons.length ? (
        <div className="s3-why ms-float is-quiet" role="note">
          {reasons.map((r, i) => <p key={i} className="sp-hint">{r}</p>)}
        </div>
      ) : null}
      {p.voiceMsg ? <p className="sp-hint ms-float is-quiet" role="status"><OwnerText text={p.voiceMsg} /></p> : null}
      {p.confirming && review ? (
        <label className="sp-confirm s3-confirm ms-float"><input type="checkbox" checked={p.reviewed} onChange={(e) => p.onConfirm(e.target.checked)} autoFocus /> {p.voice === "none" ? "شاهدته كاملًا" : "شاهدته بالصوت كاملًا"}</label>
      ) : null}
      {p.problem && review ? (
        <form className="s3-problem ms-float" onSubmit={(e) => { e.preventDefault(); if (problemReady) p.onSubmitProblem(); }}
          onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); p.onCancelProblem(); } }}>
          <span className="s3-problem-at">{p.problem.kind === "motion" ? "الحركة" : "النبرة"} عند <b><Num className="clk">{at}</Num></b></span>
          {p.problem.kind === "tone" ? (
            <select aria-label="النبرة المناسبة" value={p.tone} onChange={(e) => p.onTone(e.target.value)}>
              <option value="">{p.toneMapVersion ? toneMapKeepLabel : inheritedToneLabel(p.episodeTone)}</option>
              {toneIds.map((t) => <option key={t} value={t}>{tones[t].nameAr}</option>)}
            </select>
          ) : null}
          {p.problem.kind === "tone" && p.toneMapVersion ? <p className="sp-hint">{toneMapNote(p.toneMapVersion)}</p> : null}
          <textarea rows={2} value={p.problemText} onChange={(e) => p.onProblemText(e.target.value)} placeholder={p.problem.kind === "motion" ? "ما المشكلة؟" : "ما المشكلة؟ (اختياري)"} aria-label="ما المشكلة؟" autoFocus />
          <div className="sp-actions">
            <button type="submit" className="btn" disabled={p.pending || !problemReady}>{p.problem.kind === "tone" && p.canVoice ? "أرسل وأعد توليد الصوت" : "أرسل الملاحظة"}</button>
            <button type="button" className="btn ghost" onClick={p.onCancelProblem}>إلغاء</button>
          </div>
        </form>
      ) : null}
    </div>
  );
};
