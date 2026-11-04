import React from "react";
import { interpolate, useVideoConfig } from "remotion";
import { useSize, useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { SceneShell } from "./SceneShell";
import { T } from "../../i18n/context";
import { useChannel } from "../../channel/context";
import { VERSE_PLACEHOLDER } from "../../plan/quranText";
import { enter, fade, useSceneFrame } from "./motion";
import type { VerseCardProps } from "./types";

/** نجمة ثمانية صغيرة للزخرفة (مربعان متراكبان). */
const Star8: React.FC<{ size: number; fill: string; stroke?: string; sw?: number }> = ({ size, fill, stroke = "none", sw = 0 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40">
    <rect x={8} y={8} width={24} height={24} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
    <rect x={8} y={8} width={24} height={24} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" transform="rotate(45 20 20)" />
  </svg>
);

/**
 * «بطاقة الآية»: لحظة سكون. البطاقة تنفتح، ثم يظهر النص كاملًا بهدوء (لا كلمة كلمة،
 * احترامًا لتلاوة الآية)، ثم المرجع. لا ترجمة سطرية تحت الآية؛ الشريط السفلي يختفي.
 * النص يُعرض كما ورد من المصدر بلا أي تعديل.
 */
/** علامات الوقف في الرسم العثماني: حدود طبيعية لمقاطع الكشف */
const WAQF = /[ۖ-ۜ]/;

/**
 * مقاطع الآية بترتيبها: عند علامات الوقف أولًا، ثم كل مقطع أطول من maxWords يُقسَم بالتساوي.
 * النص لا يتغيّر: ضمّ المقاطع بمسافة يعيد الآية كما وردت.
 */
export const verseChunks = (text: string, maxWords = 7): string[] => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const parts: string[][] = [[]];
  for (const w of words) {
    parts[parts.length - 1]!.push(w);
    if (WAQF.test(w)) parts.push([]);
  }
  return parts
    .filter((p) => p.length)
    .flatMap((p) => {
      const n = Math.ceil(p.length / maxWords);
      const size = Math.ceil(p.length / n);
      return Array.from({ length: n }, (_, i) => p.slice(i * size, (i + 1) * size).join(" ")).filter(Boolean);
    });
};

const HZ = { dusk: "#2A1E3F", duskDeep: "#140E20", parchment: "#F1E4CB", ink: "#4A2E1F", sand: "#C8A15A" } as const;

/**
 * «صفحة الآية» (دفاتر الزمن): صفحة رَقّ هادئة على الغسق، بلا نجمة ولا شريط ولا رمز بجوار كلام الله.
 * الآية تُكشف مقطعًا مقطعًا بترتيبها على مدى التلاوة، وكل الآية في مكانها النهائي من البداية فلا يتحرك سطر.
 */
const VersePage: React.FC<VerseCardProps & { reveal: boolean }> = (props) => {
  const { orientation, text, reference, reciter, reveal } = props;
  const frame = useSceneFrame();
  const { durationInFrames } = useVideoConfig();
  const baseVerse = useSize("verse", orientation);
  const refSize = useSize("reference", orientation);
  const portrait = orientation === "portrait";
  const letters = text.replace(/[ً-ٰٟۖ-ۭ\s]/g, "").length;
  const room = portrait ? 80 : 90;
  const verseFit = letters > room ? Math.max(0.42, Math.sqrt(room / letters)) : 1;
  const verseSize = Math.round(baseVerse * verseFit);

  const page = enter(frame, 0, 26, 100);
  // نص لم يُجلب بعد: سطور فارغة في مكان الآية، ولا يظهر نص مؤقت ولا اسم مصدر مكان كلام الله
  const pending = !text.trim() || text === VERSE_PLACEHOLDER;
  const chunks = reveal ? verseChunks(text) : [text];
  // الكشف يبدأ بعد انفتاح الصفحة وينتهي قبل آخر التلاوة بقليل، فتبقى الآية كاملة لحظة الختام
  const start = 18;
  const end = Math.max(start + 1, Math.round(durationInFrames * 0.78));
  const step = chunks.length > 1 ? (end - start) / chunks.length : 0;
  const refIn = fade(frame, reveal ? Math.max(30, end - 10) : 40, 16);

  return (
    <SceneShell {...props} themeId="night" motif={false} background={HZ.duskDeep} captions={false} durationInFrames={durationInFrames} eyebrowColors={{ text: HZ.parchment, border: HZ.sand }}>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 55%, ${HZ.dusk} 0%, ${HZ.duskDeep} 80%)` }} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: portrait ? "0 56px 280px" : "40px 220px 40px" }}>
        <div
          style={{
            position: "relative",
            background: HZ.parchment,
            borderRadius: 10,
            padding: portrait ? "104px 60px 76px" : "92px 120px 64px",
            width: "100%",
            maxWidth: portrait ? 960 : 1400,
            opacity: page,
            transform: `translateY(${(1 - page) * 24}px)`,
            boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: portrait ? 40 : 32,
          }}
        >
          <div style={{ position: "absolute", inset: 16, border: `2px solid ${HZ.sand}`, borderRadius: 6, opacity: 0.55 * page, pointerEvents: "none" }} />
          <div style={{ position: "absolute", inset: 24, border: `1px solid ${HZ.sand}`, borderRadius: 4, opacity: 0.35 * page, pointerEvents: "none" }} />
          {pending ? (
            <div style={{ display: "grid", gap: verseSize * 0.7, width: "78%", padding: `${verseSize * 0.4}px 0` }}>
              {[1, 0.86, 0.6].map((w, i) => (
                <div key={i} style={{ height: 3, width: `${w * 100 * fade(frame, start + i * 14, 24)}%`, marginInline: "auto", background: HZ.sand, opacity: 0.55 }} />
              ))}
            </div>
          ) : (
          <div style={{ direction: "rtl", fontFamily: fontFamilies.scripture, fontSize: verseSize, lineHeight: verseFit < 0.8 ? 1.75 : 1.95, textAlign: "center", color: HZ.ink, textWrap: "balance" }}>
            <span style={{ color: HZ.sand, opacity: fade(frame, 10, 14) }}>﴿</span>{" "}
            {chunks.map((c, i) => {
              const at = start + i * step;
              const o = fade(frame, at, 20);
              return (
                <span key={i} style={{ opacity: o, filter: `blur(${(1 - o) * 6}px)` }}>
                  {c}
                  {i < chunks.length - 1 ? " " : ""}
                </span>
              );
            })}{" "}
            <span style={{ color: HZ.sand, opacity: fade(frame, start + Math.max(0, chunks.length - 1) * step, 20) }}>﴾</span>
          </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: refIn, transform: `translateY(${(1 - refIn) * 8}px)` }}>
            <div style={{ width: 56, height: 2, background: HZ.sand, opacity: 0.6 }} />
            <div style={{ fontFamily: fontFamilies.heading, fontWeight: 600, fontSize: refSize, color: HZ.ink }}>{reference}</div>
            <div style={{ width: 56, height: 2, background: HZ.sand, opacity: 0.6 }} />
          </div>
          {reciter ? (
            <div style={{ fontSize: portrait ? 26 : 22, color: HZ.ink, opacity: refIn * 0.75, marginTop: -14 }}>
              <T k="recitedBy" /> {reciter}
            </div>
          ) : null}
        </div>
      </div>
    </SceneShell>
  );
};

export const VerseCard: React.FC<VerseCardProps> = (props) => {
  const v = useChannel().verse;
  if (v?.style === "page") return <VersePage {...props} reveal={v.reveal === "lines"} />;
  if (v?.style === "ink") return <VerseInk {...props} />;
  return <VerseCardClassic {...props} />;
};

const VerseCardClassic: React.FC<VerseCardProps> = (props) => {
  const { themeId, orientation, text, reference, reciter, meaning, meaningSource } = props;
  const frame = useSceneFrame();
  const baseVerse = useSize("verse", orientation);
  const refSize = useSize("reference", orientation);
  const { durationInFrames } = useVideoConfig();
  const t = useTheme(themeId);
  const c = t.colors;
  const portrait = orientation === "portrait";
  const line = t.character.style === "line";
  // الآيات الطويلة (مثل آية الكرسي) يصغر خطها حتى تبقى البطاقة داخل الإطار؛ القصيرة كما هي
  // نعدّ الحروف دون علامات التشكيل والوقف (الرسم العثماني كثير العلامات)
  const letters = text.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\s]/g, "").length;
  const room = (portrait ? 80 : 90) * (meaning ? 0.7 : 1);
  const verseFit = letters > room ? Math.max(0.42, Math.sqrt(room / letters)) : 1;
  const verseSize = Math.round(baseVerse * verseFit);

  const card = enter(frame, 0, 30, 90);
  const textIn = fade(frame, 14, 30);
  const blur = interpolate(textIn, [0, 1], [8, 0]);
  const refIn = fade(frame, 40, 16);
  const meaningIn = fade(frame, 34, 20);
  const meaningSize = Math.round(refSize * 1.25);
  const ornament = enter(frame, 8, 30, 120);

  return (
    <SceneShell {...props} captions={false} durationInFrames={durationInFrames}>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: verseFit < 1 ? (portrait ? "330px 60px 300px" : "140px 200px 20px") : portrait ? "0 60px 300px" : "0 200px 20px" }}>
        <div
          style={{
            position: "relative",
            background: c.surface,
            border: line ? `3px solid ${c.ink}` : "none",
            boxShadow: line ? `10px 10px 0 ${c.secondary}` : `0 24px 60px rgba(0,0,0,${themeId === "night" ? 0.35 : 0.1})`,
            borderRadius: 28,
            padding: portrait ? "110px 64px 80px" : "96px 120px 64px",
            width: "100%",
            maxWidth: portrait ? 960 : 1440,
            opacity: card,
            transform: `scale(${0.94 + 0.06 * card})`,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: portrait ? 44 : 36,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: portrait ? -38 : -34,
              left: "50%",
              transform: `translateX(-50%) scale(${ornament}) rotate(${(1 - ornament) * -45}deg)`,
              background: c.bg,
              borderRadius: 999,
              padding: 8,
            }}
          >
            <Star8 size={portrait ? 64 : 56} fill={line ? c.secondary : c.primary} stroke={line ? c.ink : "none"} sw={line ? 2.5 : 0} />
          </div>
          <div style={{ position: "absolute", inset: 18, border: `2px solid ${line ? c.ink : c.primary}`, borderRadius: 18, opacity: 0.18 * card, pointerEvents: "none" }} />
          <div
            style={{
              /** الآية عربية دائمًا: تبقى من اليمين لليسار حتى في الحلقات التركية والإنجليزية. */
              direction: "rtl",
              fontFamily: fontFamilies.scripture,
              fontSize: verseSize,
              lineHeight: verseFit < 0.8 ? 1.75 : 1.9,
              textAlign: "center",
              color: c.ink,
              opacity: textIn,
              filter: `blur(${blur}px)`,
              textWrap: "balance",
            }}
          >
            <span style={{ color: line ? c.primary : c.primary }}>﴿</span> {text} <span style={{ color: c.primary }}>﴾</span>
          </div>
          {meaning ? (
            <div style={{ fontFamily: fontFamilies.body, fontSize: meaningSize, lineHeight: 1.5, textAlign: "center", color: c.ink, opacity: meaningIn * 0.85, maxWidth: portrait ? 820 : 1180, marginTop: portrait ? -18 : -14, textWrap: "balance" }}>
              {meaning}
              {meaningSource ? <span style={{ display: "block", fontSize: Math.round(refSize * 0.75), color: c.inkSoft, marginTop: 8 }}>{meaningSource}</span> : null}
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 18, opacity: refIn, transform: `translateY(${(1 - refIn) * 10}px)` }}>
            <div style={{ width: 56, height: 2, background: c.inkSoft, opacity: 0.4 }} />
            <div style={{ fontFamily: fontFamilies.heading, fontWeight: 600, fontSize: refSize, color: c.inkSoft }}>{reference}</div>
            <div style={{ width: 56, height: 2, background: c.inkSoft, opacity: 0.4 }} />
          </div>
          {/* نسبة النص لـ Quran Foundation في وصف الفيديو لا على الشاشة؛ ويبقى هنا اسم القارئ فقط إن وُجدت تلاوة */}
          {reciter ? (
            <div style={{ fontSize: portrait ? 26 : 22, color: c.inkSoft, opacity: refIn * 0.8, marginTop: -16 }}>
              <T k="recitedBy" /> {reciter}
            </div>
          ) : null}
        </div>
      </div>
    </SceneShell>
  );
};

/** يحوّل الأرقام اللاتينية إلى العربية في المرجع (طه · 14 ← طه · ١٤) */
const arabicDigits = (s: string) => s.replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);

/**
 * بطاقة الآية بهوية «القلم المميِّز» (زبدة الكتب): ورق أبيض وحبر أسود، بلا زخرفة ولا تظليل ولا قلم.
 * تظهر كاملة في نصف ثانية قبل التلاوة ثم تسكن تمامًا؛ النص كما ورد من المصدر بلا تعديل.
 * فوقها اسم السورة ورقم الآية، وتحتها اسم القارئ إن وُجد.
 */
const VerseInk: React.FC<VerseCardProps> = (props) => {
  const { orientation, text, reference, reciter } = props;
  const frame = useSceneFrame();
  const baseVerse = useSize("verse", orientation);
  const refSize = useSize("reference", orientation);
  const { durationInFrames } = useVideoConfig();
  const t = useTheme("paper");
  const c = t.colors;
  const portrait = orientation === "portrait";
  const letters = text.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\s]/g, "").length;
  const room = portrait ? 80 : 95;
  const fit = letters > room ? Math.max(0.45, Math.sqrt(room / letters)) : 1;
  const size = Math.round(baseVerse * fit * (portrait ? 1 : 1.08));
  const inP = fade(frame, 0, 14);
  const ref = reference.replace(/\s*·\s*/, /[–-]/.test(reference) ? " · الآيتان " : " · الآية ");
  return (
    <SceneShell {...props} captions={false} motif={false} background={c.bg} durationInFrames={durationInFrames}>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: portrait ? 56 : 44, padding: portrait ? "0 80px 220px" : "0 220px 40px", opacity: inP }}>
        <div style={{ fontFamily: fontFamilies.heading, fontSize: Math.round(refSize * (portrait ? 2.1 : 2.2)), lineHeight: 1.2, color: c.ink, letterSpacing: 0.5 }}>سورة {arabicDigits(ref)}</div>
        <div style={{ width: portrait ? 420 : 560, height: 3, background: c.ink }} />
        <div style={{ fontFamily: fontFamilies.scripture, fontSize: size, lineHeight: 1.9, color: c.ink, textAlign: "center", direction: "rtl", textWrap: "balance", maxWidth: portrait ? 900 : 1400 }}>{text}</div>
        <div style={{ width: portrait ? 420 : 560, height: 3, background: c.ink }} />
        {reciter ? (
          <div style={{ fontFamily: fontFamilies.body, fontSize: refSize, color: c.inkSoft }}>
            <T k="recitedBy" /> {reciter}
          </div>
        ) : null}
      </div>
    </SceneShell>
  );
};
