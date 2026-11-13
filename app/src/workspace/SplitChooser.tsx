/**
 * «قسّم…» (QA 12 Nov, balislam Major 4): the owner chooses the split point between two words, sees both halves,
 * and confirms. Nothing is sent before «قسّم هنا». The sentence's recording is cut at the same point when the cut
 * is reliable; otherwise it stays in the sentence's history («ارجع إلى التسجيل السابق») and is never deleted.
 */
import React, { useState } from "react";

const words = (t: string) => t.trim().split(/\s+/).filter(Boolean);

/** The word index after which a caret falls (1…n−1), or null when it is not between two words. */
export const caretWordIndex = (text: string, caret: number | undefined): number | null => {
  if (caret === undefined || caret <= 0) return null;
  const n = words(text.slice(0, caret)).length;
  return n >= 1 && n < words(text).length ? n : null;
};

export const SplitChooser: React.FC<{
  text: string; n: number; busy: boolean; hasAudio: boolean; initial?: number | null;
  onConfirm: (at: number) => void; onCancel: () => void;
}> = ({ text, n, busy, hasAudio, initial = null, onConfirm, onCancel }) => {
  const ws = words(text);
  const [at, setAt] = useState<number | null>(initial);
  const ar = (x: number) => x.toLocaleString("ar-EG");
  if (ws.length < 2) {
    return (
      <div className="sv-split" role="group" aria-label={`تقسيم الجملة ${ar(n)}`}>
        <p className="sp-hint">الجملة كلمة واحدة؛ لا تُقسم.</p>
        <div className="sv-dirty"><button type="button" className="btn ghost" onClick={onCancel}>إغلاق</button></div>
      </div>
    );
  }
  return (
    <div className="sv-split" role="group" aria-label={`تقسيم الجملة ${ar(n)}`}>
      <p className="sp-hint">اختر موضع التقسيم بين كلمتين، ثم اضغط «قسّم هنا».</p>
      <p className="sv-split-words" dir="rtl">
        {ws.map((w, i) => (
          <React.Fragment key={i}>
            <span className={`sv-split-w${at !== null && i < at ? " is-a" : at !== null ? " is-b" : ""}`}>{w}</span>
            {i < ws.length - 1 ? (
              <button type="button" className={`sv-split-gap${at === i + 1 ? " is-on" : ""}`} aria-pressed={at === i + 1}
                aria-label={`قسّم بعد «${w}»`} title={`قسّم بعد «${w}»`} disabled={busy} onClick={() => setAt(i + 1)}>
                <span aria-hidden="true">|</span>
              </button>
            ) : null}
          </React.Fragment>
        ))}
      </p>
      {at !== null ? (
        <p className="sv-split-preview">الأولى: «{ws.slice(0, at).join(" ")}» — الثانية: «{ws.slice(at).join(" ")}»</p>
      ) : null}
      {hasAudio ? <p className="sp-hint">تسجيل الجملة يُقص عند الموضع نفسه إن أمكن؛ وإلا يبقى محفوظًا في سجلها («ارجع إلى التسجيل السابق») وتحتاج الجملتان توليدًا. لا يُحذف تسجيل.</p> : null}
      <div className="sv-dirty">
        <button type="button" className="btn" disabled={busy || at === null} onClick={() => at !== null && onConfirm(at)}>{busy ? "جارٍ التقسيم…" : "قسّم هنا"}</button>
        <button type="button" className="btn ghost" disabled={busy} onClick={onCancel}>إلغاء</button>
      </div>
    </div>
  );
};
