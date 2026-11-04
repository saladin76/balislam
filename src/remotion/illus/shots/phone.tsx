import React from "react";
import { CLOTH, ID, SKIN, darken, mix } from "../palette";
import { useSvgId } from "../world";

/**
 * لقطة «بعين البطل»: هاتفه في يده يملأ نصف الإطار، وعليه رسالة مُعاد توجيهها جذابة الشكل.
 * لا نص مقروء في الرسالة (خبر افتراضي لا يُنسب لأحد)، بل كتلة صورة وأسطر وزر إعادة إرسال.
 * تُرسم بإحداثيات الشاشة (1920×1080) فوق المشهد.
 * show: صعود الهاتف إلى الإطار، buzz: اهتزاز وصول الرسالة، shine: لمعة تعبر البطاقة،
 * tempt: توهج البطاقة (إغراء)، thumb: اقتراب الإبهام من زر الإرسال، tap: الضغط وانطلاق النسخ.
 */
const INK = darken(ID.night, 0.4);
export const PhonePOV: React.FC<{ frame: number; show: number; buzz?: number; shine?: number; tempt?: number; thumb?: number; tap?: number; near?: number }> = ({ frame, show, buzz = 0, shine = 0, tempt = 0, thumb = 0, tap = 0, near = 0 }) => {
  const clip = useSvgId("card");
  const glowId = useSvgId("cardglow");
  if (show <= 0.001) return null;
  const shake = buzz > 0 && buzz < 1 ? Math.sin(frame * 2.1) * 7 * (1 - buzz) : 0;
  const lift = (1 - show) * 760;
  // الهاتف (إحداثيات محلية: الشاشة 0..440 × 0..880)
  const W = 440;
  const H = 880;
  const card = { x: 34, y: 230, w: W - 68, h: 380 };
  const pulse = tempt * (0.5 + 0.5 * Math.sin(frame / 5));
  const btn = { x: card.x + 70, y: card.y + card.h - 46 };
  const tx = 470 + (btn.x - 470) * thumb;
  const ty = 1010 + (btn.y + 14 - 1010) * thumb;
  return (
    <g>
      <rect x={0} y={0} width={1920} height={1080} fill="#000" opacity={0.35 * show} />
      <g transform={`translate(${1010 + shake - 60 * near} ${112 + lift - 40 * near}) scale(${1 + 0.16 * near}) rotate(${-5 + 3 * near} ${W / 2} ${H})`}>
        {/* الكم واليد */}
        <path d={`M${W - 40} ${H + 40} C ${W + 120} ${H - 40}, ${W + 260} ${H + 120}, ${W + 330} ${H + 360} L ${W - 120} ${H + 420} Z`} fill={CLOTH.emerald} stroke={INK} strokeWidth={4} />
        <path d={`M${W - 70} ${H - 160} C ${W + 30} ${H - 150}, ${W + 70} ${H - 20}, ${W + 10} ${H + 70} L ${W - 140} ${H + 90} Z`} fill={SKIN[1]} stroke={INK} strokeWidth={4} />
        {/* جسم الهاتف */}
        <rect x={-16} y={-16} width={W + 32} height={H + 32} rx={56} fill={darken(ID.night, 0.55)} stroke={INK} strokeWidth={5} />
        <rect x={0} y={0} width={W} height={H} rx={42} fill={mix(ID.night, ID.paper, 0.08)} />
        {/* شريط علوي ورأس محادثة مجرد */}
        <rect x={W / 2 - 60} y={14} width={120} height={22} rx={11} fill={darken(ID.night, 0.6)} />
        <rect x={0} y={60} width={W} height={110} fill={mix(ID.night, ID.paper, 0.14)} />
        <circle cx={W - 64} cy={115} r={30} fill={mix(ID.copper, ID.night, 0.3)} />
        <rect x={W - 250} y={98} width={150} height={16} rx={8} fill={mix(ID.paper, ID.night, 0.45)} />
        <rect x={W - 210} y={124} width={110} height={12} rx={6} fill={mix(ID.paper, ID.night, 0.7)} />
        {/* الرسالة المعاد توجيهها: جميلة الشكل */}
        <defs>
          <clipPath id={clip}>
            <rect x={card.x} y={card.y} width={card.w} height={card.h} rx={26} />
          </clipPath>
          <linearGradient id={glowId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={ID.dawn} />
            <stop offset="1" stopColor={mix(ID.seal, ID.dawn, 0.35)} />
          </linearGradient>
        </defs>
        <rect x={card.x - 14} y={card.y - 14} width={card.w + 28} height={card.h + 28} rx={36} fill={ID.dawn} opacity={0.18 + 0.4 * pulse} />
        <g transform={`translate(${card.x + card.w / 2} ${card.y + card.h / 2}) scale(${1 + 0.035 * tempt}) translate(${-(card.x + card.w / 2)} ${-(card.y + card.h / 2)})`}>
          <rect x={card.x} y={card.y} width={card.w} height={card.h} rx={26} fill={ID.paper} />
          <g clipPath={`url(#${clip})`}>
            <rect x={card.x} y={card.y} width={card.w} height={190} fill={`url(#${glowId})`} />
            {[0, 1, 2].map((i) => (
              <circle key={i} cx={card.x + 80 + i * 110} cy={card.y + 120 - (i % 2) * 40} r={46 - i * 8} fill={ID.paper} opacity={0.22} />
            ))}
            <rect x={card.x + 24} y={card.y + 214} width={card.w - 48} height={20} rx={10} fill={darken(ID.night, 0.1)} opacity={0.8} />
            <rect x={card.x + 70} y={card.y + 248} width={card.w - 94} height={16} rx={8} fill={mix(ID.night, ID.paper, 0.5)} />
            <rect x={card.x + 120} y={card.y + 276} width={card.w - 144} height={16} rx={8} fill={mix(ID.night, ID.paper, 0.5)} />
            {/* لمعة تعبر البطاقة */}
            {shine > 0 && shine < 1 ? <rect x={card.x - 200 + shine * (card.w + 400)} y={card.y - 40} width={90} height={card.h + 80} fill={ID.paper} opacity={0.55} transform={`rotate(18 ${card.x + card.w / 2} ${card.y + card.h / 2})`} /> : null}
          </g>
          {/* زر إعادة الإرسال */}
          <circle cx={btn.x} cy={btn.y} r={30 + 6 * thumb} fill={thumb > 0.6 ? ID.dawn : mix(ID.copper, ID.paper, 0.4)} stroke={INK} strokeWidth={3} />
          <path d={`M${btn.x - 12} ${btn.y + 8} q2 -18 22 -18 l0 -8 l14 14 l-14 14 l0 -8 q-14 0 -22 6 z`} fill={INK} />
        </g>
        {/* نسخ تنطلق بعد الضغط */}
        {tap > 0
          ? [0, 1, 2, 3].map((i) => {
              const t = Math.max(0, Math.min(1, tap * 1.3 - i * 0.12));
              if (t <= 0) return null;
              return <rect key={i} x={card.x + 60 + i * 40 + t * (i - 1.5) * 160} y={card.y - t * 520} width={card.w * 0.4} height={card.h * 0.28} rx={14} fill={ID.dawn} opacity={0.9 * (1 - t)} />;
            })
          : null}
        {tap > 0 ? <circle cx={btn.x} cy={btn.y} r={30 + 80 * tap} fill="none" stroke={ID.dawn} strokeWidth={6} opacity={1 - tap} /> : null}
        {/* الإبهام */}
        {thumb > 0 ? <path d={`M${tx + 160} ${ty + 260} C ${tx + 90} ${ty + 140}, ${tx - 20} ${ty + 70}, ${tx - 18} ${ty + 18} C ${tx - 16} ${ty - 14}, ${tx + 26} ${ty - 16}, ${tx + 34} ${ty + 12} C ${tx + 60} ${ty + 80}, ${tx + 140} ${ty + 120}, ${tx + 230} ${ty + 210} Z`} fill={SKIN[1]} stroke={INK} strokeWidth={4} /> : null}
        {/* اهتزاز الوصول */}
        {buzz > 0 && buzz < 1
          ? [0, 1].map((i) => (
              <g key={i} fill="none" stroke={ID.dawn} strokeWidth={6} strokeLinecap="round" opacity={1 - buzz}>
                <path d={`M${-50 - i * 26} ${300} q-16 40 0 80`} />
                <path d={`M${W + 50 + i * 26} ${300} q16 40 0 80`} />
              </g>
            ))
          : null}
      </g>
    </g>
  );
};

/** اهتزاز هاتف صغير في يد شخص بالمشهد (موجات حوله) */
export const BuzzArcs: React.FC<{ x: number; y: number; p: number; color?: string }> = ({ x, y, p, color = ID.dawn }) =>
  p > 0 && p < 1 ? (
    <g fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" opacity={1 - p}>
      {[0, 1].map((i) => (
        <g key={i}>
          <path d={`M${x - 26 - i * 14 - p * 20} ${y - 14} q-8 14 0 28`} />
          <path d={`M${x + 26 + i * 14 + p * 20} ${y - 14} q8 14 0 28`} />
        </g>
      ))}
    </g>
  ) : null;
