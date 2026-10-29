import React from "react";
import type { Theme } from "../brand/themes";

/**
 * الشخصيات بلا ملامح وجه (قاعدة ثابتة في ميثاق المحتوى).
 * المشاعر تُنقل بالوضعية واليدين والرموز، لا بالوجه.
 * الشخصيات لا تمثل نبيًا ولا صحابيًا ولا ملكًا.
 */
export type CharacterVariant = "narrator-m" | "narrator-f" | "child" | "elder-m" | "elder-f";
export type CharacterPose =
  | "stand"
  | "point"
  | "think"
  | "walk"
  | "sit"
  | "open-arms"
  | "slump"
  | "raise-hands"
  | "hold"
  | "wave"
  | "listen"
  | "back";

export const characterVariants: CharacterVariant[] = ["narrator-m", "narrator-f", "child", "elder-m", "elder-f"];
export const characterPoses: CharacterPose[] = [
  "stand",
  "point",
  "think",
  "walk",
  "sit",
  "open-arms",
  "slump",
  "raise-hands",
  "hold",
  "wave",
  "listen",
  "back",
];

export const characterPoseNamesAr: Record<CharacterPose, string> = {
  stand: "وقوف",
  point: "إشارة",
  think: "تفكير",
  walk: "مشي",
  sit: "جلوس",
  "open-arms": "ترحيب",
  slump: "حزن وتعب",
  "raise-hands": "دعاء",
  hold: "إمساك",
  wave: "تلويح",
  listen: "إنصات",
  back: "من الخلف",
};

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
  /** رسم الشخصية من الخلف (بلا تفاصيل أمامية) مع أي وضعية. pose="back" تعني الوقوف من الخلف. */
  back?: boolean;
};

const VIEW_W = 160;
const VIEW_H = 300;

/** موضع اليدين في وضعية hold داخل مساحة الرسم 160×300 (قبل تصغير الطفل). */
export const CHARACTER_HOLD_POINT: { x: number; y: number } = { x: 80, y: 160 };

const scaleOf = (variant: CharacterVariant) => (variant === "child" ? 0.68 : 1);

/**
 * موضع اليدين في وضعية hold بالبكسل، نسبةً إلى الزاوية العليا اليسرى لعنصر الشخصية
 * (يراعي تصغير الطفل). تضع القوالب العنصر المحمول (كتاب، مصحف مغلق، كوب...) متمركزًا هنا.
 */
export const characterHoldPoint = (variant: CharacterVariant, height: number): { x: number; y: number } => {
  const s = scaleOf(variant);
  const k = height / VIEW_H;
  return {
    x: ((VIEW_W * (1 - s)) / 2 + s * CHARACTER_HOLD_POINT.x) * k,
    y: (VIEW_H * (1 - s) + s * CHARACTER_HOLD_POINT.y) * k,
  };
};

type Arms = { a: string; b: string; handA: [number, number]; handB: [number, number] };

type PoseDef = {
  arms: Arms;
  /** إزاحة الرأس ودورانه (درجات) حول نقطة العنق */
  head?: { dx: number; dy: number; rot: number };
  /** جسم مخصص: m للذكور والطفل، f للإناث */
  body?: { m: string; f: string };
  /** أقدام تظهر تحت طرف الثوب (تُرسم قبل الجسم) */
  feet?: { cx: number; cy: number; rx: number; ry: number; rot: number }[];
  /** الذراع A خلف الجسم (تُرسم قبله) */
  armABehind?: boolean;
  /** ذراعان أمام الجذع: تُظلَّلان في الثيمات المسطحة لتتميزا عن الثوب */
  frontArms?: boolean;
  /** كفّان مفتوحتان (بيضاوي مائل) بدل اليد الدائرية */
  palms?: { rx: number; ry: number; rot: number; only?: "b" };
  /** ما يُرسم فوق الرأس/الحجاب: الذراعان كاملتين، أو اليد B وحدها */
  overHead?: "arms" | "handB";
  /** خطوط حركة صغيرة قرب اليد */
  motion?: string;
  /** طيّات داخلية (حبر في الثيم الخطي، ظل خفيف في المسطح) */
  folds?: string;
};

const NECK: [number, number] = [80, 88];

const POSES: Record<CharacterPose, PoseDef> = {
  stand: {
    arms: {
      a: "M50 124 Q38 170 48 212",
      b: "M110 124 Q122 170 112 212",
      handA: [48, 214],
      handB: [112, 214],
    },
  },
  point: {
    arms: {
      a: "M50 124 Q24 118 6 96",
      b: "M110 124 Q122 170 112 212",
      handA: [6, 94],
      handB: [112, 214],
    },
  },
  think: {
    arms: {
      a: "M50 124 Q38 170 48 212",
      b: "M110 124 Q130 100 108 72",
      handA: [48, 214],
      handB: [106, 70],
    },
  },
  walk: {
    arms: {
      a: "M56 126 Q42 162 30 192",
      b: "M110 124 Q124 156 140 180",
      handA: [29, 195],
      handB: [142, 182],
    },
    armABehind: true,
    head: { dx: 4, dy: 0, rot: 4 },
    body: {
      m: "M30 284 L49 116 Q54 88 82 88 Q110 88 113 116 L132 292 Z",
      f: "M24 282 L47 112 Q54 90 82 90 Q110 90 115 112 L138 292 Z",
    },
    feet: [
      { cx: 136, cy: 291, rx: 14, ry: 6, rot: 0 },
      { cx: 38, cy: 285, rx: 10, ry: 5, rot: -26 },
    ],
  },
  sit: {
    arms: {
      a: "M51 208 Q36 226 30 250",
      b: "M109 208 Q124 226 130 250",
      handA: [30, 253],
      handB: [130, 253],
    },
    head: { dx: 0, dy: 86, rot: 0 },
    body: {
      m: "M14 290 Q6 262 32 254 L48 248 L50 202 Q54 174 80 174 Q106 174 110 202 L112 248 L128 254 Q154 262 146 290 Z",
      f: "M12 290 Q4 262 32 254 L46 248 L48 198 Q54 176 80 176 Q106 176 112 198 L114 248 L128 254 Q156 262 148 290 Z",
    },
    folds: "M34 270 Q58 282 80 268 Q102 282 126 270",
  },
  "open-arms": {
    arms: {
      a: "M50 124 Q28 116 16 82",
      b: "M110 124 Q132 116 144 82",
      handA: [15, 78],
      handB: [145, 78],
    },
    head: { dx: 0, dy: -2, rot: 0 },
  },
  slump: {
    arms: {
      a: "M54 132 Q46 176 54 222",
      b: "M106 132 Q114 176 106 222",
      handA: [55, 225],
      handB: [105, 225],
    },
    head: { dx: 2, dy: 16, rot: 14 },
    body: {
      m: "M38 290 L46 132 Q50 100 80 100 Q110 100 114 132 L122 290 Z",
      f: "M32 290 L44 128 Q50 102 80 102 Q110 102 116 128 L128 290 Z",
    },
  },
  "raise-hands": {
    arms: {
      a: "M51 124 Q40 160 46 182 Q56 168 66 150",
      b: "M109 124 Q120 160 114 182 Q104 168 94 150",
      handA: [68, 137],
      handB: [92, 137],
    },
    head: { dx: 0, dy: 2, rot: 0 },
    frontArms: true,
    overHead: "arms",
    palms: { rx: 8.5, ry: 13, rot: -14 },
  },
  hold: {
    arms: {
      a: "M51 124 Q40 160 48 178 Q58 172 72 162",
      b: "M109 124 Q120 160 112 178 Q102 172 88 162",
      handA: [72, 160],
      handB: [88, 160],
    },
    frontArms: true,
  },
  wave: {
    arms: {
      a: "M50 124 Q38 170 48 212",
      b: "M110 124 Q136 116 136 70",
      handA: [137, 66],
      handB: [48, 214],
    },
    head: { dx: 0, dy: 0, rot: -5 },
    motion: "M148 52 Q156 64 150 78 M122 50 Q116 62 120 74",
  },
  listen: {
    arms: {
      a: "M50 124 Q38 170 48 212",
      b: "M110 124 Q138 110 122 66",
      handA: [48, 214],
      handB: [117, 56],
    },
    overHead: "handB",
    palms: { rx: 6.5, ry: 10, rot: 12, only: "b" },
    head: { dx: -4, dy: 2, rot: 9 },
  },
  back: {
    arms: {
      a: "M50 124 Q38 170 48 212",
      b: "M110 124 Q122 170 112 212",
      handA: [48, 214],
      handB: [112, 214],
    },
  },
};


export const Character: React.FC<Props> = ({ theme, variant, pose = "stand", height, back: backProp }) => {
  const c = theme.character;
  const line = c.style === "line";
  const surface = theme.colors.surface;
  const stroke = line ? c.outline : "none";
  const sw = line ? 3 : 0;

  const isChild = variant === "child";
  const isFemale = variant === "narrator-f" || variant === "elder-f";
  const isElder = variant === "elder-m" || variant === "elder-f";
  const back = backProp === true || pose === "back";

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

  const def = POSES[pose];
  const arms = def.arms;
  const scale = scaleOf(variant);
  const width = (height * VIEW_W) / VIEW_H;

  const body = def.body
    ? isFemale
      ? def.body.f
      : def.body.m
    : isFemale
      ? "M32 290 L46 112 Q52 90 80 90 Q108 90 114 112 L128 290 Z"
      : "M38 290 L48 116 Q52 88 80 88 Q108 88 112 116 L122 290 Z";

  // ظل خفيف بلون الحدّ للتمييز في الثيمات المسطحة (الثيم الخطي يكتفي بالحبر)
  const shade = c.outline;

  const head = isFemale ? (
    <>
      <path
        d="M44 58 Q44 14 80 14 Q116 14 116 58 L120 102 Q80 114 40 102 Z"
        fill={scarf}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinejoin="round"
      />
      {back ? (
        line ? null : <path d="M44 58 Q44 14 80 14 Q116 14 116 58 Q80 80 44 58 Z" fill={shade} opacity={0.1} />
      ) : (
        <ellipse cx={80} cy={54} rx={20} ry={24} fill={skin} stroke={stroke} strokeWidth={sw} />
      )}
    </>
  ) : (
    <>
      <circle cx={80} cy={50} r={30} fill={skin} stroke={stroke} strokeWidth={sw} />
      {variant === "elder-m" && !back ? (
        <path d="M56 58 Q80 104 104 58 Q80 74 56 58 Z" fill={line ? surface : "#FFFFFF"} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      ) : null}
      {variant !== "child" ? (
        back ? (
          <path d="M51 44 Q80 2 109 44 Q80 52 51 44 Z" fill={c.cap} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        ) : (
          <path d="M52 40 Q80 6 108 40 Z" fill={c.cap} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        )
      ) : null}
    </>
  );

  const h = def.head;
  const headNode = h ? <g transform={`translate(${h.dx} ${h.dy}) rotate(${h.rot} ${NECK[0]} ${NECK[1]})`}>{head}</g> : head;

  const armA = <path d={arms.a} fill="none" stroke={armStroke} strokeWidth={armWidth} strokeLinecap="round" />;
  const armB = <path d={arms.b} fill="none" stroke={armStroke} strokeWidth={armWidth} strokeLinecap="round" />;
  const armShade =
    def.frontArms && !line ? (
      <path d={`${arms.a} ${arms.b}`} fill="none" stroke={shade} strokeWidth={armWidth} strokeLinecap="round" strokeLinejoin="round" opacity={0.18} />
    ) : null;
  const hand = (p: [number, number], side: -1 | 1) =>
    def.palms && (def.palms.only !== "b" || side === 1) ? (
      <ellipse
        cx={p[0]}
        cy={p[1]}
        rx={def.palms.rx}
        ry={def.palms.ry}
        transform={`rotate(${def.palms.rot * side} ${p[0]} ${p[1]})`}
        fill={skin}
        stroke={stroke}
        strokeWidth={sw}
      />
    ) : (
      <circle cx={p[0]} cy={p[1]} r={7} fill={skin} stroke={stroke} strokeWidth={sw} />
    );

  return (
    <svg width={width} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={characterNamesAr[variant]}>
      <g transform={`translate(${(VIEW_W * (1 - scale)) / 2} ${VIEW_H * (1 - scale)}) scale(${scale})`}>
        {def.feet?.map((f, i) => (
          <ellipse
            key={i}
            cx={f.cx}
            cy={f.cy}
            rx={f.rx}
            ry={f.ry}
            transform={`rotate(${f.rot} ${f.cx} ${f.cy})`}
            fill={garment}
            stroke={stroke}
            strokeWidth={sw}
          />
        ))}
        {!line && def.feet ? (
          <g fill={shade} opacity={0.3}>
            {def.feet.map((f, i) => (
              <ellipse key={i} cx={f.cx} cy={f.cy} rx={f.rx} ry={f.ry} transform={`rotate(${f.rot} ${f.cx} ${f.cy})`} />
            ))}
          </g>
        ) : null}
        {def.armABehind ? armA : null}
        <path d={body} fill={garment} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
        {def.folds ? (
          line ? (
            <path d={def.folds} fill="none" stroke={c.outline} strokeWidth={2.5} strokeLinecap="round" />
          ) : (
            <path d={def.folds} fill="none" stroke={shade} strokeWidth={4} strokeLinecap="round" opacity={0.18} />
          )
        ) : null}
        {back && line ? <path d="M64 96 Q80 104 96 96" fill="none" stroke={c.outline} strokeWidth={2.5} strokeLinecap="round" /> : null}
        {def.overHead === "arms" ? headNode : null}
        {def.armABehind ? null : armA}
        {armB}
        {armShade}
        {hand(arms.handA, -1)}
        {def.overHead === "handB" ? null : hand(arms.handB, 1)}
        {def.motion ? (
          <path d={def.motion} fill="none" stroke={theme.colors.inkSoft} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
        ) : null}

        {def.overHead === "arms" ? null : headNode}
        {def.overHead === "handB" ? hand(arms.handB, 1) : null}
      </g>
    </svg>
  );
};
