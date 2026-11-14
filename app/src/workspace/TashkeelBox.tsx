import React from "react";
import type { TashkeelReport } from "../api";
import { WORDS, countAr } from "../../../src/i18n/count";
import { sceneName } from "./sceneNames";

const arNumE = (n: number) => n.toLocaleString("ar-EG");

/** مدقق التشكيل: نسبة التغطية، والكلمات التي ستُنطق بلا تشكيل، والكلمات التي لها أكثر من نطق. */
export const TashkeelBox: React.FC<{ t: TashkeelReport; order: string[] }> = ({ t, order }) => {
  const pct = Math.round(t.coverage * 1000) / 10;
  const color = t.ok ? "var(--ok)" : "var(--err)";
  return (
    <div className="help" style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
      <span style={{ color, fontWeight: 600 }}>
        {!t.file
          ? "التشكيل: لا توجد نسخة مشكولة (tashkeel.md) لهذه الحلقة؛ التوليد متوقف حتى تُضاف."
          : `التشكيل: ${arNumE(pct)}٪ (${arNumE(t.covered)} من ${countAr(t.words, WORDS)}) — الحد ${arNumE(Math.round(t.min * 100))}٪ ${t.ok ? "✓" : "— التوليد متوقف حتى يكتمل"}`}
      </span>
      {t.gaps.length ? (
        <details open={!t.ok}>
          <summary>كلمات ستُنطق بلا تشكيل ({arNumE(t.words - t.covered)})</summary>
          {t.gaps.map((g, i) => (
            <div key={`${g.sceneId}-${i}`}>
              <b title={g.sceneId}>{sceneName(order, g.sceneId)}</b>: {g.words.join("، ")}
            </div>
          ))}
        </details>
      ) : null}
      {t.ambiguous.length ? (
        <details>
          <summary>كلمات لها أكثر من نطق في الملف ({arNumE(t.ambiguous.length)}) — راجع أن كل موضع بنطقه الصحيح</summary>
          {t.ambiguous.map((a) => (
            <div key={a.word}>
              {a.forms.join(" / ")} ← <span title={a.scenes.join(", ")}>{a.scenes.map((id) => sceneName(order, id)).join("، ")}</span>
            </div>
          ))}
        </details>
      ) : null}
    </div>
  );
};

