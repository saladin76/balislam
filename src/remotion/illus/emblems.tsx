import React from "react";
import { ID, darken, lighten, mix } from "./palette";

/**
 * شارات المعنى (مكتبة «بالإسلام»، ١١ نوفمبر): عناصر صُممت لكلمات لم يكن لها عنصر في المكتبة،
 * بقاعدة صاحب المشروع: «أي كلمات ليس لها عناصر في المكتبة يُصمَّم لها عناصر جديدة وتُضاف في المكتبة».
 *
 * تُرسم في فضاء الشاشة (لا تتحرك مع الكاميرا، فلا تُقص عند حافة الإطار)، تحت الكابشن،
 * بنحاس القناة ونجمتها الثمانية، وتظهر لحظة نطق كلمتها فقط. لا كتابة فيها إلا الأرقام (من القالب).
 *
 * - `PracticeCount`: «الأولى / الثانية / الثالثة» في سلسلة ممارسات: ثلاث نجمات ثمانية، المذكورة منها تضيء برقمها.
 * - `MeasureScale`: «المقياس» الذي يحكم به الإنسان على القيمة: ميزان نحاسي ترجح فيه صرّة المال على صورة إنسان.
 * - `VerifyLens`: «التثبت / التحقق» من خبر: ورقة الخبر وعدسة تمر على سطورها.
 */

/** نجمة ثمانية (نقش القناة) نصف قطرها r حول (cx, cy) */
export const octagramPath = (cx: number, cy: number, r: number) => {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI / 8) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.72;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join("L")}Z`;
};

const AR_DIGITS = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
export const arabicDigit = (n: number) => String(n).split("").map((d) => AR_DIGITS[Number(d)] ?? d).join("");

/** «الأولى / الثانية / الثالثة» → 1 / 2 / 3 */
export const ordinalOf = (word: string): number | null => {
  const w = word.replace(/[ًٌٍَُِّْـ:،.؟!«»]/g, "").replace(/^[وف]?ال/, "");
  return ({ اولى: 1, أولى: 1, ثانية: 2, ثالثة: 3, رابعة: 4 } as Record<string, number>)[w] ?? null;
};

/** ثلاث (أو أكثر) نجمات؛ حتى `n` مضاءة، و`t` ظهور المذكورة الآن (0..1) */
export const PracticeCount: React.FC<{ n: number; total?: number; t: number; scale?: number; vertical?: boolean }> = ({ n, total = 3, t, scale = 1, vertical = false }) => {
  if (t <= 0.001) return null;
  const gap = 118;
  const w = gap * (total - 1);
  return (
    <g transform={`scale(${scale})`} opacity={Math.min(1, t * 1.4)}>
      {Array.from({ length: total }, (_, i) => {
        const k = i + 1;
        // من اليمين إلى اليسار (أو من أعلى إلى أسفل في العمودي): الأولى أولًا
        const cx = w / 2 - i * gap;
        const lit = k < n ? 1 : k === n ? t : 0;
        const pop = k === n ? 0.75 + 0.25 * t + 0.08 * Math.sin(Math.min(1, t) * Math.PI) : 1;
        return (
          <g key={k} transform={vertical ? `translate(0 ${i * gap - w / 2}) scale(${pop})` : `translate(${cx} 0) scale(${pop})`}>
            <path d={octagramPath(0, 0, 50)} fill={mix(darken(ID.night, 0.2), ID.copper, 0.25 + 0.75 * lit)} stroke={ID.copper} strokeWidth={4} />
            <path d={octagramPath(0, 0, 36)} fill="none" stroke={mix(ID.copper, lighten(ID.dawn, 0.2), lit)} strokeWidth={2} opacity={0.8} />
            <text x={0} y={15} textAnchor="middle" fontFamily="'El Messiri', serif" fontWeight={700} fontSize={44} fill={lit > 0.5 ? ID.night : mix(ID.paper, ID.copper, 0.4)} opacity={0.35 + 0.65 * Math.max(lit, k <= n ? 1 : 0.3)}>
              {arabicDigit(k)}
            </text>
          </g>
        );
      })}
    </g>
  );
};

/** ميزان نحاسي: كفة فيها صرّة مال ترجح (`tip` من 0 إلى 1)، وكفة فيها صورة إنسان بلا ملامح ترتفع */
export const MeasureScale: React.FC<{ t: number; tip: number; scale?: number }> = ({ t, tip, scale = 1 }) => {
  if (t <= 0.001) return null;
  const ang = 14 * tip; // الكفة اليمنى (المال) أثقل
  const rad = (ang * Math.PI) / 180;
  const arm = 120;
  const ry = Math.sin(rad) * arm;
  const pan = (x: number, y: number, child: React.ReactNode) => (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-34 0 L0 -70 L34 0" fill="none" stroke={ID.copper} strokeWidth={3} />
      <path d="M-44 0 Q0 26 44 0 Z" fill={ID.copper} stroke={darken(ID.copper, 0.35)} strokeWidth={3} />
      {child}
    </g>
  );
  return (
    <g transform={`scale(${scale}) translate(0 ${(1 - t) * 18})`} opacity={t}>
      <path d="M-46 150 L46 150 L30 132 L-30 132 Z" fill={darken(ID.copper, 0.3)} />
      <rect x={-6} y={-60} width={12} height={194} rx={5} fill={ID.copper} />
      <path d={octagramPath(0, -70, 18)} fill={ID.copper} stroke={darken(ID.copper, 0.35)} strokeWidth={2} />
      <g transform={`rotate(${ang} 0 -40)`}>
        <rect x={-arm - 6} y={-45} width={(arm + 6) * 2} height={10} rx={5} fill={ID.copper} />
      </g>
      {pan(arm * Math.cos(rad), -40 + ry + 70, (
        // صرّة المال
        <g transform="translate(0 -6)">
          <path d="M-20 0 Q-26 -30 -8 -38 L8 -38 Q26 -30 20 0 Z" fill={darken(ID.copper, 0.15)} stroke={darken(ID.copper, 0.45)} strokeWidth={3} />
          <path d="M-10 -38 L10 -38" stroke={ID.seal} strokeWidth={4} />
          <circle cx={30} cy={-4} r={9} fill={ID.dawn} stroke={darken(ID.copper, 0.3)} strokeWidth={2} />
        </g>
      ))}
      {pan(-arm * Math.cos(rad), -40 - ry + 70, (
        // إنسان بلا ملامح (صورة ظلية صغيرة)
        <g transform="translate(0 -4)" fill={mix(ID.paper, ID.night, 0.35)}>
          <circle cx={0} cy={-40} r={9} />
          <path d="M-12 -2 L-10 -28 Q0 -34 10 -28 L12 -2 Z" />
        </g>
      ))}
    </g>
  );
};

/** ورقة خبر وعدسة تمر على سطورها (`scan` من 0 إلى 1) */
export const VerifyLens: React.FC<{ t: number; scan: number; scale?: number }> = ({ t, scan, scale = 1 }) => {
  if (t <= 0.001) return null;
  const lines = [-44, -22, 0, 22, 44];
  const row = Math.min(lines.length - 1, Math.floor(scan * lines.length));
  const lx = 40 - 80 * ((scan * lines.length) % 1);
  const ly = lines[row]!;
  return (
    <g transform={`scale(${scale}) translate(0 ${(1 - t) * 18})`} opacity={t}>
      <rect x={-70} y={-78} width={140} height={156} rx={10} fill={ID.paper} stroke={darken(ID.copper, 0.2)} strokeWidth={4} />
      {lines.map((y, i) => (
        <rect key={y} x={-50} y={y - 4} width={i === 0 ? 70 : 100} height={7} rx={3} fill={i < row ? mix(ID.paper, ID.copper, 0.55) : mix(ID.paper, ID.night, 0.35)} />
      ))}
      <g transform={`translate(${lx} ${ly})`}>
        <circle r={30} fill={lighten(ID.dawn, 0.4)} opacity={0.35} />
        <circle r={30} fill="none" stroke={ID.copper} strokeWidth={7} />
        <rect x={20} y={20} width={12} height={46} rx={6} transform="rotate(-45 26 26)" fill={darken(ID.copper, 0.35)} />
      </g>
    </g>
  );
};
