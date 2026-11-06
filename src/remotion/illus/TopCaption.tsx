import React from "react";
import { interpolate, spring } from "remotion";
import { ID } from "./palette";
import type { WordTiming } from "../scenes/timing";
import { normalizeArabic } from "../../script/quranMeta";

/**
 * كابشن «بالإسلام» العلوي: الجملة التي تُقال الآن في أعلى الشاشة (سطر واحد في الأفقي)،
 * الكلمات المنطوقة كاملة الوضوح والقادمة خافتة، والكلمة المفتاحية تضيء بلون الفجر لحظة نطقها.
 * يقع في أعلى 12% من الإطار الأفقي، فلا يُحسب حركةً في مقياس الحركة.
 */
export const bareWord = (w: string) => normalizeArabic(w.replace(/[«»"“”'؟?!.,،:؛…ـ]/g, ""));

/** يقسم توقيتات الكلمات إلى أسطر: ينتهي السطر عند علامة وقف أو عند max كلمات */
export const captionLines = (timings: WordTiming[], max: number) => {
  const out: WordTiming[][] = [];
  let cur: WordTiming[] = [];
  timings.forEach((w, i) => {
    cur.push(w);
    const left = timings.length - i - 1;
    const stop = /[.؟?!؛:…]$/.test(w.word) || (/[،,]$/.test(w.word) && cur.length >= Math.ceil(max * 0.6));
    if (stop || (cur.length >= max && left > 2)) {
      out.push(cur);
      cur = [];
    }
  });
  if (cur.length) out.push(cur);
  return out;
};

/** contrast (0..1، الأمر 019): الكلمات القادمة أوضح وظل النص أعمق فوق الخلفيات الفاتحة؛ 0 = القائم */
export const TopCaption: React.FC<{ frame: number; fps: number; timings: WordTiming[]; keys: string[]; portrait: boolean; out?: number; keyColor?: string; size?: number; contrast?: number }> = ({ frame, fps, timings, keys, portrait, out = 1, keyColor = ID.dawn, size: sizeOverride, contrast = 0 }) => {
  if (!timings.length) return null;
  const lines = captionLines(timings, portrait ? 6 : 10);
  const idx = Math.max(
    0,
    lines.findIndex((l, i) => frame >= (l[0]?.start ?? 0) - 4 && frame < ((lines[i + 1]?.[0]?.start ?? Infinity) - 4)),
  );
  const line = lines[idx] ?? [];
  const keySet = new Set(keys.map(bareWord).filter(Boolean));
  const lineIn = spring({ frame: frame - ((line[0]?.start ?? 0) - 4), fps, config: { damping: 20, stiffness: 160 } });
  const size = sizeOverride ?? (portrait ? 62 : 54);
  return (
    <div
      style={{
        position: "absolute",
        top: portrait ? 250 : 34,
        left: portrait ? 70 : 120,
        right: portrait ? 70 : 120,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: portrait ? "4px 18px" : "0 16px",
        direction: "rtl",
        fontFamily: "'Tajawal', 'IBM Plex Sans Arabic', sans-serif",
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1.35,
        opacity: out * lineIn,
        transform: `translateY(${(1 - lineIn) * -10}px)`,
        textShadow: contrast > 0 ? `0 2px 14px rgba(0,0,0,${(0.55 + 0.3 * contrast).toFixed(2)}), 0 0 3px rgba(0,0,0,${(0.5 * contrast).toFixed(2)})` : "0 2px 14px rgba(0,0,0,.55)",
      }}
    >
      {line.map((w, i) => {
        const said = interpolate(frame, [w.start - 3, w.start + 4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        const key = keySet.has(bareWord(w.word));
        const pop = key ? spring({ frame: frame - w.start, fps, config: { damping: 12, stiffness: 200, mass: 0.6 } }) : 0;
        return (
          <span
            key={`${idx}-${i}`}
            style={{
              color: key && said > 0.5 ? keyColor : ID.paper,
              opacity: 0.38 + 0.22 * contrast + (0.62 - 0.22 * contrast) * said,
              display: "inline-block",
              transform: key ? `scale(${1 + 0.1 * pop * (1 - Math.min(1, (frame - w.start) / 30))})` : undefined,
            }}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );
};
