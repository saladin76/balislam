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
export type EmblemId = "mihrab" | "horizon-book" | "highlighter-z";
export const emblemNamesAr: Record<EmblemId, string> = {
  mihrab: "محراب النور (بالإسلام)",
  "horizon-book": "دفتر الأفق (دفاتر الزمن)",
  "highlighter-z": "القلم المميِّز (زبدة الكتب)",
};

const star = (cx: number, cy: number, r: number) => `M${cx} ${cy - r} Q${cx + r * 0.18} ${cy - r * 0.18} ${cx + r} ${cy} Q${cx + r * 0.18} ${cy + r * 0.18} ${cx} ${cy + r} Q${cx - r * 0.18} ${cy + r * 0.18} ${cx - r} ${cy} Q${cx - r * 0.18} ${cy - r * 0.18} ${cx} ${cy - r} Z`;

/**
 * الشعارات المعتمدة للهويات الثلاث (٣ نوفمبر ٢٠٢٦). ألوانها ثابتة من الهوية، إلا main (الخطوط) وaccent (الضوء) وink (الحبر).
 */
const BrandEmblem: React.FC<{ id: "mihrab" | "horizon-book" | "highlighter-z"; main: string; accent: string; ink: string }> = ({ id, main, accent, ink }) => {
  switch (id) {
    case "mihrab":
      // قوس محراب (210×250 مصغّرًا) يضيء بالفجر، نجمة ثمانية، باء بضربة فرشاة، نقطتها شمس، وختم أحمر
      return (
        <g transform="translate(19.5 9) scale(0.39)">
          <defs>
            <linearGradient id="emb-mihrab-dawn" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor={accent} stopOpacity={0.75} />
              <stop offset="0.75" stopColor={accent} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <path d="M32 240 V104 A73 73 0 0 1 178 104 V240 Z" fill="url(#emb-mihrab-dawn)" />
          <path d="M32 240 V104 A73 73 0 0 1 178 104 V240" fill="none" stroke={main} strokeWidth={9} strokeLinejoin="round" />
          <path d="M105 46 L118 59 L105 72 L92 59 Z M96 50 H114 V68 H96 Z" fill="none" stroke={main} strokeWidth={4} />
          <path d="M161 118 C163 158 139 190 105 190 C75 190 53 173 51 146 L64 147 C67 165 84 176 105 176 C132 176 148 155 148 118 Z" fill={ink} />
          <rect x={96} y={213} width={18} height={18} transform="rotate(45 105 222)" fill={accent} />
          <rect x={150} y={206} width={20} height={20} rx={3} fill="#C2412D" />
        </g>
      );
    case "horizon-book":
      // دفتر مفتوح، غروب على صفحتيه، كعبه ساعة رملية، وشريط التاريخ الأحمر
      return (
        <g transform="translate(8 17) scale(0.371)">
          <defs>
            <clipPath id="emb-horizon-pages">
              <path d="M140 34 C110 22 62 20 22 30 V172 C62 162 110 164 140 176 C170 164 218 162 258 172 V30 C218 20 170 22 140 34 Z" />
            </clipPath>
          </defs>
          <path d="M140 34 C110 22 62 20 22 30 V172 C62 162 110 164 140 176 C170 164 218 162 258 172 V30 C218 20 170 22 140 34 Z" fill={ink} />
          <g clipPath="url(#emb-horizon-pages)">
            <circle cx={140} cy={128} r={46} fill={accent} />
            <rect x={0} y={128} width={280} height={80} fill={ink} />
            <path d="M0 128 H280" stroke={main} strokeWidth={5} />
            <path d="M40 128 V140 M80 128 V136 M200 128 V136 M240 128 V140" stroke={main} strokeWidth={4} />
          </g>
          <path d="M140 34 C110 22 62 20 22 30 V172 C62 162 110 164 140 176 C170 164 218 162 258 172 V30 C218 20 170 22 140 34 Z" fill="none" stroke={main} strokeWidth={7} strokeLinejoin="round" />
          <path d="M128 40 H152 L142 104 L152 168 H128 L138 104 Z" fill="#C8A15A" stroke={main} strokeWidth={4} strokeLinejoin="round" />
          <path d="M206 18 V72 L214 64 L222 72 V18 Z" fill="#D7372B" />
        </g>
      );
    case "highlighter-z":
      // حرف الزاي فوق ضربة قلم فسفوري مائلة
      return (
        <g>
          <path d="M12 66 L106 52 L110 84 L16 98 Z" fill={accent} />
          <text x={60} y={84} textAnchor="middle" fontFamily="'Lalezar', sans-serif" fontSize={92} fill={main}>ز</text>
        </g>
      );
  }
};

/** شارات القنوات المعتمدة فقط (القديمة حُذفت) */
export const Emblem: React.FC<{ id: EmblemId; main: string; accent: string; ink?: string }> = ({ id, main, accent, ink = "#F4EEE2" }) => <BrandEmblem id={id} main={main} accent={accent} ink={ink} />;

type MarkProps = {
  mark?: LogoSpec;
  size: number;
  colors: { tile?: string; baa: string; play: string; ink?: string };
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
          <Emblem id={mark.emblem} main={colors.baa} accent={colors.play} ink={colors.ink} />
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
