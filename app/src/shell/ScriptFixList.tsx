import React, { useState } from "react";
import type { Issue } from "../../../src/script/types";

/** آية ذُكر رقمها في السكريبت بلا نصها: «البقرة 30» */
const verseRef = (i: Issue): string | null =>
  /\[آية: ([^|\]]+?) \|/.exec(i.message)?.[1]?.trim() ?? null;

const toArabicDigits = (s: string) => s.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);

/**
 * ما يمنع اعتماد السكريبت، مرتبًا ليُصلَح: الآيات التي تنقصها نصوصها مجموعة معًا كشارات
 * (كل شارة تفتح سطرها في المحرر)، ثم بقية الأخطاء بنص كل خطأ وسطره.
 */
export const ScriptFixList: React.FC<{ errors: Issue[]; onLine: (line: number) => void }> = ({ errors, onLine }) => {
  const [all, setAll] = useState(false);
  const verses = errors.filter((i) => verseRef(i));
  const others = errors.filter((i) => !verseRef(i));
  const LIMIT = 12;
  const shown = all ? verses : verses.slice(0, LIMIT);
  return (
    <div className="fix">
      <p className="fix-title">
        قبل اعتماد السكريبت أصلح ما يلي، وكل عنصر يفتح سطره في المحرر:
      </p>
      {verses.length ? (
        <section className="fix-group" aria-label="آيات تنقصها نصوصها">
          <h3>آيات تنقصها نصوصها <span className="fix-count">{toArabicDigits(String(verses.length))}</span></h3>
          <p className="fix-how">
            اكتب نص كل آية بالتشكيل من مصحف موثوق، في سطرها: <code dir="rtl">[آية: البقرة ٣٠ | نص الآية]</code>
          </p>
          <ul className="fix-chips">
            {shown.map((i, k) => (
              <li key={`${i.line}-${k}`}>
                <button type="button" onClick={() => i.line && onLine(i.line)} title={i.line ? `افتح السطر ${i.line}` : undefined}>
                  <b>{toArabicDigits(verseRef(i)!)}</b>
                  {i.line ? <span>سطر {toArabicDigits(String(i.line))}</span> : null}
                </button>
              </li>
            ))}
            {verses.length > LIMIT ? (
              <li><button type="button" className="fix-more" onClick={() => setAll(!all)}>{all ? "أقل" : `و${toArabicDigits(String(verses.length - LIMIT))} أخرى`}</button></li>
            ) : null}
          </ul>
        </section>
      ) : null}
      {others.length ? (
        <section className="fix-group" aria-label="أخطاء أخرى">
          <h3>أخطاء أخرى <span className="fix-count">{toArabicDigits(String(others.length))}</span></h3>
          <ul className="fix-list">
            {others.map((i, k) => (
              <li key={`${i.line}-${k}`}>
                <button type="button" disabled={!i.line} onClick={() => i.line && onLine(i.line)}>
                  <span className="fix-msg">{i.message}</span>
                  {i.line ? <span className="fix-ln">سطر {toArabicDigits(String(i.line))}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
};
