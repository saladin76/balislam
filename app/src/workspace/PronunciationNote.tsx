import React from "react";
import { suspectLine } from "../../../src/voice/pronunciation/compare";
import type { EpisodeView } from "../pronunciationApi";

/**
 * فحص النطق (العمل ٩): السطر تحت الجملة، بجوار أدواتها («ولّد الجملة» / «أعد التوليد»).
 * تنبيه للأذن فقط: لا يمنع «اعتمد» ولا يغيّر شيئًا، والمالك يقرر بالاستماع. لا يظهر لصف آية ولا بسملة
 * (لا تُفحص أصلًا)، ولا يظهر شيء والفحص مطفأ أو غير مثبّت.
 */
export const PronunciationNote: React.FC<{ view: EpisodeView | null; rowId: string; kind: string }> = ({ view, rowId, kind }) => {
  if (!view || view.state !== "on" || kind !== "narration") return null;
  const r = view.results[rowId];
  if (!r || r.verdict === "ok" || r.verdict === "error") return null;
  const line = suspectLine(r);
  if (!line) return null;
  const heard = r.suspects.filter((s) => s.heard).slice(0, 4).map((s) => `«${s.word.replace(/[\p{P}]+$/u, "")}» ← «${s.heard}»`);
  return (
    <p className="sp-hint sv-pron" role="note">
      <b>{line}</b>
      {heard.length ? <> — سُمعت: {heard.join("، ")}</> : null}
      <span className="sv-pron-why"> تنبيه فقط، ولا يمنع الاعتماد: استمع إليها؛ إن كانت سليمة فلا شيء عليك، وإلا اضغط الكلمة لتصحيح نطقها أو أعد توليد الجملة.</span>
    </p>
  );
};
