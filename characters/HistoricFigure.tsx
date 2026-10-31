import React from "react";

/**
 * شخصيات تاريخية بملامح (لقناة «دفاتر الزمن» وكل قناة تسمح بالوجوه):
 * عالم، قائد، تاجر، حاكم، امرأة، شاب، شيخ، رحّالة/غريب.
 * ملامح بسيطة معبّرة (عينان ترمشان، حاجبان، فم يتكلم) بأسلوب مسطح بخط خارجي يطابق «أماكن التصوير».
 * ⚠️ لا تمثّل نبيًا ولا صحابيًا ولا ملكًا: شخصيات عامة لعصرها.
 */
export type FigureId = "scholar" | "commander" | "merchant" | "ruler" | "woman" | "youth" | "elder" | "traveler";
export type FigureExpr = "neutral" | "happy" | "sad" | "angry" | "surprised" | "worried";
export type FigurePose = "stand" | "point" | "gesture" | "scroll" | "think" | "banner";

export const figureNamesAr: Record<FigureId, string> = {
  scholar: "عالم",
  commander: "قائد",
  merchant: "تاجر",
  ruler: "حاكم",
  woman: "امرأة",
  youth: "شاب",
  elder: "شيخ كبير",
  traveler: "رحّالة غريب",
};
export const exprNamesAr: Record<FigureExpr, string> = { neutral: "هادئ", happy: "سعيد", sad: "حزين", angry: "غاضب", surprised: "مندهش", worried: "قلق" };

type Look = {
  robe: string;
  trim: string;
  skin: string;
  head: "turban" | "helmet" | "cap" | "hijab" | "hair";
  headColor: string;
  jewel?: boolean;
  beard?: string;
  cloak?: string;
  armor?: boolean;
  sash: string;
};
const LOOKS: Record<FigureId, Look> = {
  scholar: { robe: "#2E6F73", trim: "#E8D6AE", skin: "#D9A47A", head: "turban", headColor: "#F4F0E6", beard: "#3A2E28", sash: "#C9A25A" },
  commander: { robe: "#8E2F23", trim: "#C9A25A", skin: "#C98E62", head: "helmet", headColor: "#9AA3A8", beard: "#1E1A18", cloak: "#2B2A33", armor: true, sash: "#3A2E28" },
  merchant: { robe: "#C98B3A", trim: "#7A4A22", skin: "#D9A47A", head: "turban", headColor: "#7A4A22", beard: "#4A3426", sash: "#2E5A4A" },
  ruler: { robe: "#2E5A3A", trim: "#E8B64C", skin: "#D4A07A", head: "turban", headColor: "#FBF7EE", jewel: true, beard: "#2A2420", cloak: "#5A1E2A", sash: "#E8B64C" },
  woman: { robe: "#6B3A5A", trim: "#E8C9A0", skin: "#E3B58E", head: "hijab", headColor: "#8E3A4A", sash: "#E8C9A0" },
  youth: { robe: "#3E6FA8", trim: "#F4F0E6", skin: "#E0AE84", head: "cap", headColor: "#F4F0E6", sash: "#C9A25A" },
  elder: { robe: "#8A8172", trim: "#F4F0E6", skin: "#D9A47A", head: "turban", headColor: "#E8E2D4", beard: "#EDEBE6", sash: "#5A4A3A" },
  traveler: { robe: "#3A5A7A", trim: "#D9C08C", skin: "#F0C9A8", head: "hair", headColor: "#C99A4A", cloak: "#7A2E2A", sash: "#D9C08C" },
};

const ink = "#2A2F3A";
const O = { stroke: ink, strokeWidth: 4, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

const ARMS: Record<FigurePose, { l: string; r: string; hl: [number, number]; hr: [number, number] }> = {
  stand: { l: "M66 182 Q52 240 60 292", r: "M134 182 Q148 240 140 292", hl: [60, 296], hr: [140, 296] },
  point: { l: "M66 182 Q52 240 60 292", r: "M134 182 Q170 172 194 150", hl: [60, 296], hr: [196, 148] },
  gesture: { l: "M66 182 Q40 222 30 252", r: "M134 182 Q160 222 170 252", hl: [28, 256], hr: [172, 256] },
  scroll: { l: "M66 182 Q58 238 88 250", r: "M134 182 Q142 238 112 250", hl: [90, 250], hr: [110, 250] },
  think: { l: "M66 182 Q66 240 118 238", r: "M134 182 Q156 214 116 154", hl: [120, 238], hr: [114, 150] },
  banner: { l: "M66 182 Q52 240 60 292", r: "M134 182 Q156 140 154 104", hl: [60, 296], hr: [154, 100] },
};

export const HistoricFigure: React.FC<{ figure: FigureId; expr?: FigureExpr; pose?: FigurePose; height: number; frame?: number; talking?: boolean; flagColor?: string }> = ({ figure, expr = "neutral", pose = "stand", height, frame = 0, talking = false, flagColor = "#C9A25A" }) => {
  const L = LOOKS[figure];
  const a = ARMS[pose];
  // رمش كل ~3 ثوانٍ، وفم يتحرك أثناء الكلام
  const blink = frame % 96 > 92;
  const open = talking ? Math.abs(Math.sin(frame * 0.55)) * (0.5 + 0.5 * Math.abs(Math.sin(frame * 0.17))) : 0;
  // الحاجبان: [ارتفاع، ميل الطرف الداخلي للأسفل]
  const [lift, tilt] = ({ neutral: [0, 0], happy: [2, -1], sad: [0, -5], angry: [-2, 6], surprised: [6, 0], worried: [2, -6] } as Record<FigureExpr, [number, number]>)[expr];
  const mouthBase = { neutral: "M90 133 Q100 137 110 133", happy: "M88 130 Q100 143 112 130", sad: "M90 137 Q100 129 110 137", angry: "M90 135 Q100 132 110 135", surprised: "", worried: "M89 135 Q94 131 100 135 Q106 139 111 134" }[expr];
  const female = figure === "woman";
  const arm = (d: string) => (
    <>
      <path d={d} stroke={ink} strokeWidth={30} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} stroke={L.robe} strokeWidth={22} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
  const hand = ([x, y]: [number, number]) => <circle {...O} cx={x} cy={y} r={11} fill={L.skin} />;
  return (
    <svg width={(height * 200) / 420} height={height} viewBox="0 0 200 420" style={{ overflow: "visible" }}>
      {/* العباءة والراية خلف الجسم */}
      {L.cloak ? <path {...O} fill={L.cloak} d="M62 168 Q30 262 26 408 H174 Q170 262 138 168 Z" /> : null}
      {pose === "banner" ? (
        <g>
          <line {...O} strokeWidth={6} x1={154} y1={18} x2={154} y2={330} />
          <path {...O} fill={flagColor} d={`M156 22 Q186 ${26 + Math.sin(frame / 6) * 6} 214 ${22 + Math.sin(frame / 6 + 1) * 8} V${74 + Math.sin(frame / 6 + 1) * 8} Q186 ${78 + Math.sin(frame / 6) * 6} 156 74 Z`} />
        </g>
      ) : null}
      {/* القدمان والثوب */}
      <ellipse {...O} cx={82} cy={410} rx={20} ry={9} fill="#3A2E28" />
      <ellipse {...O} cx={118} cy={410} rx={20} ry={9} fill="#3A2E28" />
      {pose !== "scroll" && pose !== "think" ? <g>{arm(a.l)}</g> : null}
      <path {...O} fill={L.robe} d={female ? "M70 166 Q100 156 130 166 L148 232 L166 406 Q100 418 34 406 L52 232 Z" : "M70 166 Q100 156 130 166 L150 232 L160 406 Q100 416 40 406 L50 232 Z"} />
      <path stroke={L.trim} strokeWidth={5} fill="none" d="M100 162 V408" opacity={0.85} />
      <path stroke={L.trim} strokeWidth={4} fill="none" d={female ? "M38 398 Q100 410 162 398" : "M44 398 Q100 408 156 398"} opacity={0.85} />
      {L.armor ? <path {...O} fill="#9AA3A8" d="M72 172 H128 L134 246 Q100 256 66 246 Z" /> : null}
      {L.armor ? <path stroke={ink} strokeWidth={2} fill="none" opacity={0.5} d="M72 196 H128 M70 220 H130 M100 172 V250" /> : null}
      <rect {...O} x={58} y={244} width={84} height={16} rx={5} fill={L.sash} />
      {/* الرقبة والرأس */}
      {L.head === "hijab" ? <path {...O} fill={L.headColor} d="M54 116 Q52 56 100 50 Q148 56 146 116 Q150 162 132 176 H68 Q50 162 54 116 Z" /> : null}
      <rect {...O} x={89} y={140} width={22} height={28} fill={L.skin} />
      {L.head !== "hijab" ? <><ellipse {...O} cx={64} cy={114} rx={7} ry={11} fill={L.skin} /><ellipse {...O} cx={136} cy={114} rx={7} ry={11} fill={L.skin} /></> : null}
      <ellipse {...O} cx={100} cy={110} rx={L.head === "hijab" ? 33 : 36} ry={L.head === "hijab" ? 39 : 42} fill={L.skin} />
      {L.beard ? <path {...O} fill={L.beard} d="M65 112 Q66 162 100 170 Q134 162 135 112 Q130 138 116 140 Q100 134 84 140 Q70 138 65 112 Z" /> : null}
      {L.beard ? <ellipse cx={100} cy={134} rx={12} ry={6.5} fill={L.skin} /> : null}
      {/* الملامح */}
      <g>
        {[86, 114].map((x, i) => (
          <g key={x}>
            <ellipse cx={x} cy={107} rx={4.6} ry={blink ? 0.8 : expr === "surprised" ? 7 : 5.6} fill={ink} />
            {!blink ? <circle cx={x + 1.5} cy={105} r={1.4} fill="#fff" /> : null}
            <path stroke={L.beard && L.beard !== "#EDEBE6" ? L.beard : "#3A2A20"} strokeWidth={3.4} strokeLinecap="round" fill="none" d={`M${i ? x + 8 : x - 8} ${95 - lift} L${i ? x - 8 : x + 8} ${95 - lift + tilt}`} />
          </g>
        ))}
        <path stroke={ink} strokeWidth={2.4} fill="none" strokeLinecap="round" d="M101 112 Q105 122 98 124" opacity={0.7} />
        {talking && open > 0.08 ? (
          <ellipse cx={100} cy={134} rx={8} ry={2 + open * 7} fill="#5A2A2A" stroke={ink} strokeWidth={2} />
        ) : expr === "surprised" ? (
          <ellipse cx={100} cy={135} rx={6} ry={8} fill="#5A2A2A" stroke={ink} strokeWidth={2} />
        ) : (
          <path stroke={ink} strokeWidth={3.2} strokeLinecap="round" fill="none" d={mouthBase} />
        )}
        {expr === "happy" ? <><circle cx={78} cy={122} r={6} fill="#E58F7A" opacity={0.35} /><circle cx={122} cy={122} r={6} fill="#E58F7A" opacity={0.35} /></> : null}
      </g>
      {/* غطاء الرأس */}
      {L.head === "turban" ? (
        <g>
          <path {...O} fill={L.headColor} d="M60 100 Q56 58 100 52 Q144 58 140 100 Q122 84 100 86 Q78 84 60 100 Z" />
          <path stroke={ink} strokeWidth={2} fill="none" opacity={0.45} d="M64 88 Q100 62 136 86 M68 78 Q100 58 132 76" />
          {L.jewel ? <g><circle {...O} cx={100} cy={74} r={7} fill="#2E7A7A" /><path stroke={ink} strokeWidth={2} fill="#E8B64C" d="M100 60 L104 66 L100 72 L96 66 Z" /></g> : null}
        </g>
      ) : L.head === "helmet" ? (
        <g>
          <path {...O} fill={L.headColor} d="M62 102 Q60 54 100 50 Q140 54 138 102 Z" />
          <path {...O} fill="#C9A25A" d="M60 96 H140 V106 H60 Z" />
          <path {...O} fill={L.headColor} d="M96 106 H104 V122 H96 Z" />
          <path {...O} fill="#C9A25A" d="M96 50 L100 30 L104 50 Z" />
        </g>
      ) : L.head === "cap" ? (
        <path {...O} fill={L.headColor} d="M66 90 Q68 64 100 62 Q132 64 134 90 Q100 82 66 90 Z" />
      ) : L.head === "hair" ? (
        <path {...O} fill={L.headColor} d="M62 104 Q58 60 100 60 Q142 60 138 104 Q132 80 112 78 Q96 86 80 80 Q66 86 62 104 Z" />
      ) : null}
      {/* الذراعان الأماميتان والأيدي */}
      {pose === "scroll" ? (
        <g>
          {arm(a.l)}
          {arm(a.r)}
          <rect {...O} x={76} y={232} width={48} height={34} rx={4} fill="#F1E3C4" />
          <rect {...O} x={70} y={228} width={10} height={42} rx={5} fill="#D9C08C" />
          <rect {...O} x={120} y={228} width={10} height={42} rx={5} fill="#D9C08C" />
          <path stroke={ink} strokeWidth={1.5} opacity={0.5} d="M84 242 H116 M84 250 H110" />
          {hand(a.hl)}
          {hand(a.hr)}
        </g>
      ) : pose === "think" ? (
        <g>
          {arm(a.l)}
          {hand(a.hl)}
          {arm(a.r)}
          {hand(a.hr)}
        </g>
      ) : (
        <g>
          {arm(a.r)}
          {hand(a.hl)}
          {hand(a.hr)}
        </g>
      )}
    </svg>
  );
};
