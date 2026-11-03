import React from "react";
import { clamp } from "./motion";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { fontFamilies } from "../../../brand/fonts";

/**
 * أدوات «المظهر السينمائي» المشتركة بين القوالب: ذرات الجو، حبيبات الفيلم، أشرطة السينما، التلوين والإضاءة،
 * وعنوان المكان والزمن. تستعملها «لوحة وثائقية» و«مشهد في مكان» بنمطه السينمائي.
 */
export const rand = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
export const GOLD = "#D4A24C";

/** ذرات الجو: غبار يطفو، دخان يتحرك، جمر يصعد، مطر */
export const Atmosphere: React.FC<{ kind: string; frame: number; w: number; h: number }> = ({ kind, frame, w, h }) => {
  if (kind === "smoke")
    return (
      <AbsoluteFill style={{ mixBlendMode: "screen" }}>
        {Array.from({ length: 6 }, (_, i) => {
          const x = (rand(i) * 1.4 - 0.2) * w + Math.sin((frame + i * 60) / 140) * 60 + frame * (0.25 + rand(i + 9) * 0.3);
          const y = h * (0.45 + rand(i + 3) * 0.5) - frame * 0.15;
          const r = h * (0.35 + rand(i + 5) * 0.3);
          return <div key={i} style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%", background: "radial-gradient(circle, rgba(220,210,195,0.16) 0%, rgba(220,210,195,0) 70%)", filter: "blur(30px)" }} />;
        })}
      </AbsoluteFill>
    );
  if (kind === "rain")
    return (
      <svg width={w} height={h} style={{ position: "absolute", inset: 0, opacity: 0.35 }}>
        {Array.from({ length: 140 }, (_, i) => {
          const speed = 38 + rand(i) * 20;
          const x = (rand(i + 1) * (w + 400) - 200 + frame * 6) % (w + 200);
          const y = ((rand(i + 2) * h + frame * speed) % (h + 120)) - 60;
          return <line key={i} x1={x} y1={y} x2={x - 10} y2={y + 46} stroke="#CFE0EE" strokeWidth={1.4} strokeOpacity={0.5 + rand(i + 3) * 0.5} />;
        })}
      </svg>
    );
  const embers = kind === "embers";
  const n = embers ? 46 : 70;
  return (
    <svg width={w} height={h} style={{ position: "absolute", inset: 0, mixBlendMode: "screen" }}>
      {Array.from({ length: n }, (_, i) => {
        const life = embers ? 220 + rand(i) * 160 : 600;
        const t = ((frame + rand(i + 7) * life) % life) / life;
        const x = rand(i + 1) * w + Math.sin((frame + i * 37) / (embers ? 30 : 90)) * (embers ? 24 : 40) + (embers ? t * 60 : frame * 0.2);
        const y = embers ? h * (1.05 - t * 1.1) : rand(i + 2) * h + Math.sin((frame + i * 11) / 120) * 30;
        const r = (embers ? 1.6 + rand(i + 4) * 2.4 : 0.8 + rand(i + 4) * 2.2) * (h / 1080);
        const a = embers ? Math.sin(t * Math.PI) * (0.6 + rand(i + 5) * 0.4) : 0.15 + 0.35 * (0.5 + 0.5 * Math.sin((frame + i * 23) / 40));
        return <circle key={i} cx={x % (w + 40)} cy={y} r={r} fill={embers ? "#FFB45A" : "#F4E6C8"} opacity={a} style={embers ? { filter: "blur(0.6px)" } : undefined} />;
      })}
    </svg>
  );
};

/** حبيبات فيلم: ضوضاء ثابتة تتحرك عشوائيًا كل إطار (أخف من توليد ضوضاء جديدة كل مرة) */
export const FilmGrain: React.FC<{ frame: number; w: number; h: number; amount: number }> = ({ frame, w, h, amount }) => {
  const dx = Math.floor(rand(frame) * 180);
  const dy = Math.floor(rand(frame + 1000) * 180);
  return (
    <svg width={w + 200} height={h + 200} style={{ position: "absolute", left: -dx, top: -dy, mixBlendMode: "overlay", opacity: amount, pointerEvents: "none" }}>
      <filter id="doc-grain">
        <feTurbulence type="fractalNoise" baseFrequency={0.9} numOctaves={2} stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width={w + 200} height={h + 200} filter="url(#doc-grain)" />
    </svg>
  );
};


/** أشرطة السينما: تنزل في أول المشهد */
export const Letterbox: React.FC<{ frame: number; h: number }> = ({ frame, h }) => {
  const bar = interpolate(frame, [0, 18], [0, h * 0.12], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: bar, background: "#000" }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: bar, background: "#000" }} />
    </>
  );
};
export const letterboxHeight = (frame: number, h: number) => interpolate(frame, [0, 18], [0, h * 0.12], { ...clamp, easing: Easing.out(Easing.cubic) });

/**
 * إضاءة سينمائية فوق مشهد مرسوم: مصدر ضوء (شمس/سراج/قمر) بتوهج ناعم، وأشعة ضوء اختيارية،
 * وتلوين حسب الوقت (نهار ذهبي، ليل أزرق بجيوب دافئة)، وإطار مظلم.
 */
export const CinemaLight: React.FC<{ mood: "day" | "night"; frame: number; rays?: boolean; light?: { x: number; y: number }; w: number; h: number }> = ({ mood, frame, rays, light = { x: 0.25, y: 0.2 }, w, h }) => {
  const night = mood === "night";
  const flick = 1 + Math.sin(frame / 9) * 0.03 + Math.sin(frame / 23) * 0.02;
  const lx = light.x * 100;
  const ly = light.y * 100;
  return (
    <>
      {/* تلوين عام: ظلال باردة وإضاءات دافئة */}
      <AbsoluteFill style={{ background: night ? "linear-gradient(180deg, rgba(40,60,110,0.35) 0%, rgba(40,44,80,0.18) 60%, rgba(10,10,20,0.4) 100%)" : "linear-gradient(180deg, rgba(255,190,110,0.18) 0%, rgba(120,70,30,0.10) 60%, rgba(40,20,10,0.35) 100%)", mixBlendMode: night ? "multiply" : "soft-light" }} />
      {/* توهج مصدر الضوء */}
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${lx}% ${ly}%, ${night ? "rgba(255,190,110,0.35)" : "rgba(255,226,170,0.55)"} 0%, transparent ${night ? 32 : 45}%)`, mixBlendMode: "screen", opacity: flick }} />
      {rays ? (
        <svg width={w} height={h} style={{ position: "absolute", inset: 0, mixBlendMode: "screen", opacity: (night ? 0.22 : 0.3) * flick }}>
          <defs>
            <linearGradient id="ray-g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={night ? "#FFD9A0" : "#FFF1CF"} stopOpacity={0.9} />
              <stop offset="1" stopColor={night ? "#FFD9A0" : "#FFF1CF"} stopOpacity={0} />
            </linearGradient>
            <filter id="ray-blur"><feGaussianBlur stdDeviation={18} /></filter>
          </defs>
          <g filter="url(#ray-blur)">
            {[-0.09, -0.03, 0.04, 0.1].map((o, i) => {
              const sx = light.x * w + o * w;
              const sway = Math.sin(frame / 60 + i) * 18;
              return <polygon key={i} points={`${sx - 30},${light.y * h} ${sx + 30},${light.y * h} ${sx + w * 0.32 + sway + i * 40},${h} ${sx + w * 0.18 + sway + i * 30},${h}`} fill="url(#ray-g)" />;
            })}
          </g>
        </svg>
      ) : null}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 78% 72% at 50% 50%, transparent 52%, rgba(0,0,0,0.6) 100%)" }} />
    </>
  );
};

/** عنوان المكان والزمن (أعلى بداية الشاشة) بخط Amiri وخط ذهبي، فوق ظل يضمن وضوحه */
export const PlaceTitle: React.FC<{ title?: string; date?: string; frame: number; duration: number; top: number; inset: number; u: number; portrait: boolean; rtl: boolean }> = ({ title, date, frame, duration, top, inset, u, portrait, rtl }) => {
  if (!title && !date) return null;
  const inA = interpolate(frame, [12, 30], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const outA = interpolate(frame, [duration - 30, duration - 14], [1, 0], clamp);
  const a = Math.min(inA, outA);
  return (
    <>
      <AbsoluteFill style={{ opacity: a, background: `radial-gradient(ellipse 45% 40% at ${rtl ? "100%" : "0%"} ${portrait ? "22%" : "8%"}, rgba(0,0,0,0.55) 0%, transparent 100%)` }} />
      <div style={{ position: "absolute", top, insetInlineStart: inset, opacity: a, transform: `translateY(${(1 - inA) * 14}px)`, color: "#F1E3C6", textShadow: "0 2px 18px rgba(0,0,0,0.85)" }}>
        {title ? <div style={{ fontFamily: fontFamilies.scripture, fontWeight: 700, fontSize: (portrait ? 64 : 58) * u, lineHeight: 1.2 }}>{title}</div> : null}
        <div style={{ width: interpolate(inA, [0, 1], [0, (portrait ? 220 : 260) * u]), height: 2, background: GOLD, margin: `${10 * u}px 0` }} />
        {date ? <div style={{ fontFamily: fontFamilies.heading, fontSize: (portrait ? 34 : 30) * u, color: GOLD, letterSpacing: "0.04em" }}>{date}</div> : null}
      </div>
    </>
  );
};
