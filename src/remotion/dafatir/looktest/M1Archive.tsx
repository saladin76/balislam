/**
 * الطريقة ١ — أرشيفي 2.5D: صور فوتوغرافية من القرن التاسع عشر في الملك العام (المتروبوليتان، Open Access CC0، عبر ويكيميديا كومنز)،
 * كل صورة طبقتان (الأرض القريبة تتحرك أسرع من البعيدة) على ورق بحبيبات ثابتة، وحبر يكتب على الصورة عند كلمته.
 * الكرنك (ماكسيم دو كان، ١٨٤٩) عند «مدينة قديمة»، وبعلبك (دو كان، ١٨٥٠) عند «مملكة»، والنيل أمام تلال طيبة (جون بيزلي غرين، ١٨٥٤)
 * أرضًا بكرًا عند «بل تبدأ». لا تصوير لأحد.
 */
import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { useBrandFonts } from "../../useBrandFonts";
import { LtAudio, LtCaption, LT_FPS, at, pr, vt } from "./common";

const IMG = (n: string) => staticFile(`three/dafatir-alzaman/looktest/lt-${n}.jpg`);

/** صورة بطبقتين: البعيد يتحرك ببطء والقريب (النصف الأسفل) أسرع، فيظهر العمق */
const Plate: React.FC<{ src: string; p: number; o: number; dir?: 1 | -1; push?: number }> = ({ src, p, o, dir = 1, push = 0.06 }) => {
  if (o <= 0) return null;
  const far = { transform: `scale(${1.1 + push * p}) translateX(${dir * (-12 + 24 * p)}px)` };
  const near = { transform: `scale(${1.18 + push * 1.6 * p}) translateX(${dir * (-38 + 76 * p)}px) translateY(${10 - 14 * p}px)`,
    WebkitMaskImage: "linear-gradient(180deg, transparent 0%, transparent 52%, #000 70%)", maskImage: "linear-gradient(180deg, transparent 0%, transparent 52%, #000 70%)" };
  const base: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transformOrigin: "50% 60%" };
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <Img src={src} style={{ ...base, ...far, filter: "sepia(0.25) contrast(1.05)" }} />
      <Img src={src} style={{ ...base, ...near, filter: "sepia(0.3) contrast(1.12) brightness(0.96)" }} />
    </AbsoluteFill>
  );
};

/** كتابة بالحبر من اليمين إلى اليسار */
const InkLabel: React.FC<{ text: string; p: number; x: number; y: number; size?: number; fade?: number }> = ({ text, p, x, y, size = 64, fade = 1 }) =>
  p <= 0 ? null : (
    <div style={{ position: "absolute", left: x, top: y, direction: "rtl", whiteSpace: "nowrap", fontFamily: "'Aref Ruqaa', serif", fontWeight: 700, fontSize: size, color: "#2B1E14",
      opacity: fade, textShadow: "0 0 6px rgba(241,228,203,0.9), 0 0 18px rgba(241,228,203,0.6)", clipPath: `inset(-40% 0 -40% ${(1 - p) * 100}%)` }}>{text}</div>
  );

/** bare: بلا ترجمة ولا صوت (طبقة داخل «المزيج») */
export const M1Archive: React.FC<{ bare?: boolean }> = ({ bare }) => {
  useBrandFonts();
  const t = useCurrentFrame() / LT_FPS;
  const v = vt(t);
  const tBaal = at("مملكة") - 0.2, tNile = at("بل") - 0.15;
  const oKar = 1 - pr(v, tBaal, 0.7);
  const oBaal = pr(v, tBaal, 0.7) * (1 - pr(v, tNile, 1.0));
  const oNile = pr(v, tNile, 1.0);
  // الطبقات تتحرك على مدى ظهور كل صورة
  const pKar = (v - 0) / (tBaal + 0.7), pBaal = (v - tBaal) / (tNile + 1 - tBaal), pNile = (v - tNile) / (12.2 - tNile);
  // الحبر: «مدينة قديمة» ثم «مملكة»، ويبهت اسمها عند «نسي الناس اسمها» (نُسي)
  const cityP = pr(v, at("مدينة") - 0.05, 0.9);
  const kingP = pr(v, at("مملكة") - 0.05, 0.7);
  const forget = 1 - 0.75 * pr(v, at("نسي"), 1.0);
  // الأرض البكر: خط حبر يتتبع خط الماء عند «البشر»، و«البداية» عند «تبدأ» الثانية
  const lineP = pr(v, at("البشر") - 0.1, 1.4);
  const beginP = pr(v, at("تبدأ", 2), 0.8);
  return (
    <AbsoluteFill style={{ background: "#1C140E" }}>
      <Plate src={IMG("karnak")} p={Math.min(1, Math.max(0, pKar))} o={oKar} dir={1} />
      <Plate src={IMG("baalbek")} p={Math.min(1, Math.max(0, pBaal))} o={oBaal} dir={-1} />
      <Plate src={IMG("nile")} p={Math.min(1, Math.max(0, pNile))} o={oNile} dir={1} push={0.1} />
      {oKar > 0 && <InkLabel text="مدينة قديمة" p={cityP} x={1210} y={170} size={72} />}
      {oBaal > 0 && <InkLabel text="مملكة… نُسي اسمها" p={kingP} x={190} y={170} size={66} fade={forget} />}
      {oNile > 0 && (
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          <path d="M60 808 C 420 802 820 806 1180 800 S 1700 796 1880 798" fill="none" stroke="#2B1E14" strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - lineP} opacity={0.85} />
        </svg>
      )}
      {oNile > 0 && <InkLabel text="البداية" p={beginP} x={1360} y={690} size={76} />}
      {/* ورق: حبيبات ثابتة وإطار داكن (لا حبيبات متحركة: لا حركة في السكون) */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, mixBlendMode: "multiply", opacity: 0.35 }}>
        <filter id="m1g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={4} /><feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0.6 0" /></filter>
        <rect width={1920} height={1080} filter="url(#m1g)" />
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 48%, rgba(0,0,0,0) 55%, rgba(20,12,6,0.55) 100%)" }} />
      {!bare && <LtCaption t={t} tone="light" />}
      {!bare && <LtAudio />}
    </AbsoluteFill>
  );
};
