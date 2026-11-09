import React from "react";
import type { SceneProductionRead } from "../api";
import { STEPS, stepsDone, type StepTab } from "./EpisodeSpine";

/**
 * One way to show a step that is not open yet (UX review 9 Nov, D52). Every locked step looks the same:
 * its title, why it is locked, what unlocks it, and ONE button that goes to the real next action. What is
 * intentionally allowed early (e.g. recitation uploads, D35) appears under «يمكنك الآن», explicitly. No
 * player, no disabled controls, nothing that contradicts the lock.
 */
export type LockedStepProps = {
  step: 1 | 2 | 3;
  reason: string;
  unlocks: string;
  action: { label: string; onClick: () => void };
  /** Things allowed before the step opens. */
  now?: React.ReactNode;
  nowNote?: string;
};

export const LockedStep: React.FC<LockedStepProps> = ({ step, reason, unlocks, action, now, nowNote }) => (
  <section className="locked-step" aria-labelledby={`locked-${step}`}>
    <div className="locked-card">
      <p className="locked-eyebrow">الخطوة {STEPS[step]!.n} · لم تُفتح بعد</p>
      <h2 id={`locked-${step}`}>{STEPS[step]!.title}</h2>
      <p className="locked-reason">{reason}</p>
      <p className="locked-unlocks"><b>يُفتح حين:</b> {unlocks}</p>
      <button type="button" className="btn primary" onClick={action.onClick}>{action.label}</button>
    </div>
    {now ? (
      <div className="locked-now">
        <h3>يمكنك الآن</h3>
        {nowNote ? <p className="locked-now-note">{nowNote}</p> : null}
        {now}
      </div>
    ) : null}
  </section>
);

/** The first step not done yet and where its work happens: the one button of every locked step. */
export const nextAction = (w: Pick<SceneProductionRead, "script" | "storyboard" | "progress"> | null): { label: string; tab: StepTab } => {
  const done = stepsDone(w);
  if (!done[0]) return { label: "إلى التجهيز", tab: "storyboard" };
  if (!done[1]) return { label: "إلى المشاهد", tab: "episode" };
  if (!done[2]) return { label: "إلى النسخة النهائية", tab: "review" };
  return { label: "إلى النشر", tab: "publish" };
};

/**
 * Which step screen is locked, from the ledger alone: ٢ and ٣ before «اعتمد التجهيز»; ٤ before the
 * final file is approved. Returns null when the screen is open (or the ledger is not read yet).
 */
export const lockedStep = (tab: StepTab, w: Pick<SceneProductionRead, "script" | "storyboard" | "progress"> | null): 1 | 2 | 3 | null => {
  if (!w) return null;
  const done = stepsDone(w);
  if (tab === "episode" && !done[0]) return 1;
  if (tab === "review" && !done[0]) return 2;
  if (tab === "publish" && !done[2]) return 3;
  return null;
};

export const LOCK_COPY: Record<1 | 2 | 3, { reason: string; unlocks: string }> = {
  1: {
    reason: "المشاهد تُجهَّز من السكريبت والستوري بورد المعتمدين، ولم يُعتمد التجهيز بعد.",
    unlocks: "تعتمد التجهيز في الخطوة ١؛ بعده تبدأ المشاهد تُجهَّز وحدها وتظهر هنا واحدًا واحدًا.",
  },
  2: {
    reason: "النسخة النهائية تُجمع من المشاهد المعتمدة، ولم يبدأ إنتاج المشاهد بعد.",
    unlocks: "تعتمد التجهيز ثم كل المشاهد؛ بعدها تُجمع الحلقة وتُشاهَد كاملة هنا.",
  },
  3: {
    reason: "النشر لملف النسخة النهائية المعتمد وحده، ولم يُعتمد ملف بعد.",
    unlocks: "تصنع النسخة النهائية في الخطوة ٣ وتشاهدها كاملة وتعتمدها؛ بعدها تمنح إذن النشر هنا.",
  },
};
