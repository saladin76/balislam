import React from "react";
import type { Theme } from "../brand/themes";

/**
 * الشخصيات بلا ملامح وجه (قاعدة ثابتة في ميثاق المحتوى).
 * المشاعر تُنقل بالوضعية واليدين والرموز، لا بالوجه.
 * الشخصيات لا تمثل نبيًا ولا صحابيًا ولا ملكًا.
 */
export type CharacterVariant = "narrator-m" | "narrator-f" | "child" | "elder-m" | "elder-f";
export type CharacterPose = "stand" | "point" | "think";

export const characterVariants: CharacterVariant[] = ["narrator-m", "narrator-f", "child", "elder-m", "elder-f"];
export const characterPoses: CharacterPose[] = ["stand", "point", "think"];

export const characterNamesAr: Record<CharacterVariant, string> = {
  "narrator-m": "الراوي",
  "narrator-f": "الراوية",
  child: "الطفل",
  "elder-m": "الكبير",
  "elder-f": "الكبيرة",
};

type Props = {
  theme: Theme;
  variant: CharacterVariant;
  pose?: CharacterPose;
  /** ارتفاع الشخصية بالبكسل */
  height: number;
};

const VIEW_W = 160;
const VIEW_H = 300;

const ARMS: Record<CharacterPose, { a: string; b: string; handA: [number, number]; handB: [number, number] }> = {
  stand: {
    a: "M50 124 Q38 170 48 212",
    b: "M110 124 Q122 170 112 212",
    handA: [48, 214],
    handB: [112, 214],
  },
  point: {
    a: "M50 124 Q24 118 6 96",
    b: "M110 124 Q122 170 112 212",
    handA: [6, 94],
    handB: [112, 214],
  },
  think: {
    a: "M50 124 Q38 170 48 212",
    b: "M110 124 Q130 100 108 72",
    handA: [48, 214],
    handB: [106, 70],
  },
};

export const Character: React.FC<Props> = ({ theme, variant, pose = "stand", height }) => {
  const c = theme.character;
  const line = c.style === "line";
  const surface = theme.colors.surface;
  const stroke = line ? c.outline : "none";
  const sw = line ? 3 : 0;

  const isChild = variant === "child";
  const isFemale = variant === "narrator-f" || variant === "elder-f";
  const isElder = variant === "elder-m" || variant === "elder-f";

  const skin = line ? surface : isElder ? c.skin[1] : c.skin[0];
  const garmentIndex: Record<CharacterVariant, number> = {
    "narrator-m": 0,
    "narrator-f": 1,
    child: 2,
    "elder-m": 3,
    "elder-f": 4,
  };
  const garment = line ? surface : (c.garments[garmentIndex[variant]] ?? c.garments[0]);
  const scarf = line ? surface : isElder ? c.cap : garment;
  const armStroke = line ? c.outline : garment;
  const armWidth = line ? 3 : 16;

  const arms = ARMS[pose];
  const scale = isChild ? 0.68 : 1;
  const width = (height * VIEW_W) / VIEW_H;

  const body = isFemale
    ? "M32 290 L46 112 Q52 90 80 90 Q108 90 114 112 L128 290 Z"
    : "M38 290 L48 116 Q52 88 80 88 Q108 88 112 116 L122 290 Z";

  return (
    <svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={characterNamesAr[variant]}>
      <g transform={`translate(${(VIEW_W * (1 - scale)) / 2} ${VIEW_H * (1 - scale)}) scale(${scale})`}>
        <path d={body} fill={garment} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        <path d={arms.a} fill="none" stroke={armStroke} strokeWidth={armWidth} strokeLinecap="round" />
        <path d={arms.b} fill="none" stroke={armStroke} strokeWidth={armWidth} strokeLinecap="round" />
        <circle cx={arms.handA[0]} cy={arms.handA[1]} r={7} fill={skin} stroke={stroke} strokeWidth={sw} />
        <circle cx={arms.handB[0]} cy={arms.handB[1]} r={7} fill={skin} stroke={stroke} strokeWidth={sw} />

        {isFemale ? (
          <>
            <path
              d="M44 58 Q44 14 80 14 Q116 14 116 58 L120 102 Q80 114 40 102 Z"
              fill={scarf}
              stroke={stroke}
              strokeWidth={sw}
              strokeLinejoin="round"
            />
            <ellipse cx={80} cy={54} rx={20} ry={24} fill={skin} stroke={stroke} strokeWidth={sw} />
          </>
        ) : (
          <>
            <circle cx={80} cy={50} r={30} fill={skin} stroke={stroke} strokeWidth={sw} />
            {variant === "elder-m" ? (
              <path d="M56 58 Q80 104 104 58 Q80 74 56 58 Z" fill={line ? surface : "#FFFFFF"} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
            ) : null}
            {variant !== "child" ? (
              <path d="M52 40 Q80 6 108 40 Z" fill={c.cap} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
            ) : null}
          </>
        )}
      </g>
    </svg>
  );
};
