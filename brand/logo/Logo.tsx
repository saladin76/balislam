import React from "react";
import type { Theme } from "../themes";
import { fontFamilies } from "../fonts";

/** مسار حرف الباء ونقطته زر التشغيل، في مربع 120×120. */
export const BAA_PATH = "M92 34V62Q92 76 78 76H42Q28 76 28 62V52";
export const PLAY_POINTS = "54,86 54,104 70,95";

/** شكل رمز القناة: باء التشغيل (بالإسلام)، أو حرف القناة مع زر التشغيل نفسه (عائلة واحدة من الرموز). */
export type LogoSpec = { type: "baa" } | { type: "letter"; letter: string } | { type: "emblem"; emblem: EmblemId };

/**
 * شعارات «شارة» مرسومة لكل قناة (أسلوب سينمائي: خطوط ذهبية رفيعة على خلفية داكنة).
 * main = لون الخطوط (baa)، accent = لون التفاصيل (play)، والخلفية tile.
 */
export type EmblemId = "hourglass-arch" | "book-hourglass" | "clock-dal" | "book-drop" | "book-gem" | "bookmark-star" | "astrolabe" | "gate-light" | "scroll-seal";
export const emblemNamesAr: Record<EmblemId, string> = {
  "hourglass-arch": "ساعة رملية تحت قوس",
  "book-hourglass": "كتاب تنبت منه ساعة رملية",
  "clock-dal": "دال داخل ساعة الزمن",
  "book-drop": "قطرة الزبدة وكتاب مفتوح",
  "book-gem": "جوهرة فوق كتاب",
  "bookmark-star": "كتاب بشريط ونجمة",
  astrolabe: "إسطرلاب",
  "gate-light": "باب قديم يخرج منه الضوء",
  "scroll-seal": "مخطوطة مطوية وختم",
};

const star = (cx: number, cy: number, r: number) => `M${cx} ${cy - r} Q${cx + r * 0.18} ${cy - r * 0.18} ${cx + r} ${cy} Q${cx + r * 0.18} ${cy + r * 0.18} ${cx} ${cy + r} Q${cx - r * 0.18} ${cy + r * 0.18} ${cx - r} ${cy} Q${cx - r * 0.18} ${cy - r * 0.18} ${cx} ${cy - r} Z`;

export const Emblem: React.FC<{ id: EmblemId; main: string; accent: string }> = ({ id, main, accent }) => {
  const L = (w: number) => ({ fill: "none", stroke: main, strokeWidth: w, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });
  switch (id) {
    case "hourglass-arch":
      return (
        <g>
          <path {...L(3.5)} d="M30 98 V54 Q30 27 60 15 Q90 27 90 54 V98" />
          <path {...L(1.2)} opacity={0.55} d="M36 98 V56 Q36 33 60 22 Q84 33 84 56 V98" />
          <path {...L(3.5)} d="M44 33 H76 M44 91 H76" />
          <path {...L(2.4)} d="M48 33 Q48 52 60 62 Q72 52 72 33 M48 91 Q48 72 60 62 Q72 72 72 91" />
          <path fill={accent} d="M52 42 Q60 46 68 42 Q66 51 60 56 Q54 51 52 42 Z" />
          <path fill={accent} d="M51 90 Q60 76 69 90 Z" />
          <path stroke={accent} strokeWidth={1.3} d="M60 62 V84" />
          <path {...L(3.5)} d="M22 98 H98" />
        </g>
      );
    case "book-hourglass":
      return (
        <g>
          <path {...L(2.2)} d="M47 20 H73 M47 70 H73" />
          <path {...L(2)} d="M50 20 Q50 36 60 45 Q70 36 70 20 M50 70 Q50 54 60 45 Q70 54 70 70" />
          <path fill={accent} d="M54 27 Q60 30 66 27 Q64 34 60 38 Q56 34 54 27 Z" />
          <path fill={accent} d="M53 69 Q60 58 67 69 Z" />
          <path fill={main} d="M16 82 Q38 72 60 82 Q82 72 104 82 V92 Q82 83 60 93 Q38 83 16 92 Z" />
          <path {...L(1.2)} opacity={0.6} d="M22 78 Q40 69 58 78 M62 78 Q80 69 98 78" />
          <circle cx={60} cy={104} r={2.6} fill={accent} />
        </g>
      );
    case "clock-dal":
      return (
        <g>
          <circle {...L(3)} cx={60} cy={60} r={44} />
          <circle {...L(1)} opacity={0.5} cx={60} cy={60} r={38} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i * Math.PI) / 6;
            const r1 = i % 3 ? 41 : 38;
            return <path key={i} {...L(i % 3 ? 1.4 : 2.6)} d={`M${60 + Math.sin(a) * r1} ${60 - Math.cos(a) * r1} L${60 + Math.sin(a) * 44} ${60 - Math.cos(a) * 44}`} />;
          })}
          <text x={60} y={70} textAnchor="middle" dominantBaseline="middle" fontFamily={fontFamilies.heading} fontWeight={800} fontSize={56} fill={main}>د</text>
          {[[82, 78, 2], [88, 70, 1.4], [90, 84, 1.2], [78, 88, 1.6]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={accent} />)}
        </g>
      );
    case "book-drop":
      return (
        <g>
          <path {...L(3.5)} d="M60 12 Q88 46 88 70 A28 28 0 0 1 32 70 Q32 46 60 12 Z" />
          <path {...L(1.2)} opacity={0.5} d="M60 22 Q81 49 81 70 A21 21 0 0 1 39 70 Q39 49 60 22 Z" />
          <path fill={main} d="M40 76 Q50 70 60 76 Q70 70 80 76 V87 Q70 81 60 87 Q50 81 40 87 Z" />
          <path fill={accent} d={star(60, 52, 9)} />
        </g>
      );
    case "book-gem":
      return (
        <g>
          <path {...L(3)} d="M60 14 L84 36 L60 66 L36 36 Z" />
          <path {...L(1.4)} d="M36 36 H84 M48 25 L54 36 L60 66 M72 25 L66 36 L60 66 M48 25 H72" />
          <path fill={accent} opacity={0.85} d="M54 36 H66 L60 60 Z" />
          <path fill={main} d="M16 82 Q38 72 60 82 Q82 72 104 82 V92 Q82 83 60 93 Q38 83 16 92 Z" />
          <path {...L(1.2)} opacity={0.6} d="M22 78 Q40 69 58 78 M62 78 Q80 69 98 78" />
        </g>
      );
    case "astrolabe":
      return (
        <g>
          <circle {...L(3)} cx={60} cy={64} r={40} />
          <circle {...L(1.2)} opacity={0.6} cx={60} cy={64} r={33} />
          <path {...L(3)} d="M52 24 Q60 12 68 24" />
          <circle {...L(2.4)} cx={60} cy={16} r={5} />
          {Array.from({ length: 24 }, (_, i) => {
            const a = (i * Math.PI) / 12;
            const r1 = i % 2 ? 37 : 35;
            return <path key={i} {...L(1.2)} d={`M${60 + Math.sin(a) * r1} ${64 - Math.cos(a) * r1} L${60 + Math.sin(a) * 40} ${64 - Math.cos(a) * 40}`} />;
          })}
          <ellipse {...L(1.6)} cx={60} cy={64} rx={33} ry={14} />
          <path {...L(1.6)} d="M60 31 V97 M27 64 H93" opacity={0.7} />
          <path {...L(3)} d="M30 84 L90 44" />
          <circle cx={60} cy={64} r={4.5} fill={accent} />
          <path fill={accent} d={star(76, 50, 7)} />
        </g>
      );
    case "gate-light":
      return (
        <g>
          <path fill={main} opacity={0.32} d="M44 104 V58 Q44 38 60 30 Q76 38 76 58 V104 Z" />
          <path fill={main} opacity={0.18} d="M44 104 L10 118 H110 L76 104 Z" />
          <path {...L(3.5)} d="M34 104 V54 Q34 26 60 14 Q86 26 86 54 V104" />
          <path {...L(1.4)} opacity={0.6} d="M40 104 V56 Q40 32 60 21 Q80 32 80 56 V104" />
          <path {...L(3.5)} d="M24 104 H96" />
          <path {...L(2)} d="M44 58 L32 64 V100 L44 104 M76 58 L88 64 V100 L76 104" />
          <path fill={main} d={star(60, 56, 9)} />
          <circle cx={60} cy={56} r={14} fill={main} opacity={0.18} />
        </g>
      );
    case "scroll-seal":
      return (
        <g>
          <path {...L(3)} d="M28 26 H84 Q92 26 92 34 V84" />
          <path {...L(3)} d="M28 26 Q20 26 20 34 Q20 42 28 42 H36 V94 H88 Q96 94 96 86 Q96 78 88 78 H80" />
          <path {...L(3)} d="M36 42 V34 Q36 26 28 26" />
          <path {...L(1.6)} opacity={0.6} d="M46 46 H80 M46 56 H80 M46 66 H70" />
          <circle cx={74} cy={84} r={14} fill={accent} />
          <circle cx={74} cy={84} r={9} fill="none" stroke={main} strokeWidth={1.4} opacity={0.8} />
          <path fill={accent} d="M66 95 L62 110 L69 105 L73 112 L75 97 Z" />
        </g>
      );
    case "bookmark-star":
      return (
        <g>
          <path {...L(3.5)} d="M34 16 H84 Q90 16 90 22 V98 Q90 104 84 104 H34 Q28 104 28 98 V22 Q28 16 34 16 Z" />
          <path {...L(1.5)} opacity={0.6} d="M38 16 V104" />
          <path fill={accent} d="M68 12 V46 L74 40 L80 46 V12 Z" />
          <path fill={main} d={star(60, 70, 14)} />
          <path {...L(1.2)} opacity={0.5} d="M46 92 H74" />
        </g>
      );
  }
};

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
        {mark?.type === "emblem" ? (
          <Emblem id={mark.emblem} main={colors.baa} accent={colors.play} />
        ) : mark?.type === "letter" ? (
          <text x={60} y={66} textAnchor="middle" dominantBaseline="middle" fontFamily={fontFamilies.wordmark} fontWeight={700} fontSize={62} fill={colors.baa}>
            {mark.letter}
          </text>
        ) : (
          <path d={BAA_PATH} fill="none" stroke={colors.baa} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {mark?.type === "emblem" ? null : <polygon points={mark?.type === "letter" ? "84,82 84,100 100,91" : PLAY_POINTS} fill={colors.play} />}
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
