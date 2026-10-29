import React from "react";
import type { Theme } from "../themes";
import { fontFamilies } from "../fonts";

/** مسار حرف الباء ونقطته زر التشغيل، في مربع 120×120. */
export const BAA_PATH = "M92 34V62Q92 76 78 76H42Q28 76 28 62V52";
export const PLAY_POINTS = "54,86 54,104 70,95";

/** شكل رمز القناة: باء التشغيل (بالإسلام)، أو حرف القناة مع زر التشغيل نفسه (عائلة واحدة من الرموز). */
export type LogoSpec = { type: "baa" } | { type: "letter"; letter: string };

type MarkProps = {
  mark?: LogoSpec;
  size: number;
  colors: { tile?: string; baa: string; play: string };
  /** مربع ملون بزوايا دائرية خلف الرمز */
  tile?: boolean;
  /** مربع كامل بلا زوايا (لصور الحساب التي تقصّها المنصات دائرة) */
  square?: boolean;
};

/** رمز «باء التشغيل». */
export const LogoMark: React.FC<MarkProps> = ({ size, colors, tile = true, square = false, mark }) => {
  const viewBox = tile ? "0 0 120 120" : "14 20 92 92";
  const dy = square ? -9 : 0;
  return (
    <svg width={size} height={size} viewBox={viewBox} aria-label="شعار بالإسلام" role="img">
      {tile ? <rect width="120" height="120" rx={square ? 0 : 28} fill={colors.tile} /> : null}
      <g transform={`translate(0 ${dy})`}>
        {mark?.type === "letter" ? (
          <text x={60} y={66} textAnchor="middle" dominantBaseline="middle" fontFamily={fontFamilies.wordmark} fontWeight={700} fontSize={62} fill={colors.baa}>
            {mark.letter}
          </text>
        ) : (
          <path d={BAA_PATH} fill="none" stroke={colors.baa} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
        )}
        <polygon points={mark?.type === "letter" ? "84,82 84,100 100,91" : PLAY_POINTS} fill={colors.play} />
      </g>
    </svg>
  );
};

/** الشعار مع اسم القناة (يمين: الرمز، يسار: الاسم). */
export const LogoLockup: React.FC<{ theme: Theme; height: number; color?: string }> = ({ theme, height, color }) => (
  <div style={{ display: "flex", alignItems: "center", gap: height * 0.28, direction: "rtl" }}>
    <LogoMark size={height} colors={theme.logo} />
    <span
      style={{
        fontFamily: fontFamilies.wordmark,
        fontWeight: 700,
        fontSize: height * 0.62,
        lineHeight: 1,
        color: color ?? theme.colors.ink,
      }}
    >
      بالإسلام
    </span>
  </div>
);
