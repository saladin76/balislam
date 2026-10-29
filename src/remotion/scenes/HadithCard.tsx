import React from "react";
import { interpolate, useVideoConfig } from "remotion";
import { useSize, useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import type { Theme } from "../../../brand/themes";
import { SceneShell } from "./SceneShell";
import { useLang } from "../../i18n/context";
import { enter, fade, useBoil, useSceneFrame } from "./motion";
import type { SceneBase, StringFields } from "./types";

export type HadithCardProps = SceneBase & StringFields<"narrator" | "text" | "reference" | "grade">;

/** زاوية زخرفية صغيرة (قوس وخطان) توضع في أركان البطاقة. */
const Corner: React.FC<{ size: number; color: string; accent: string; style?: React.CSSProperties }> = ({ size, color, accent, style }) => (
  <svg width={size} height={size} viewBox="0 0 60 60" style={{ position: "absolute", overflow: "visible", ...style }}>
    <path d="M4 56 V22 Q4 4 22 4 H56" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
    <path d="M14 56 V26 Q14 14 26 14 H56" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" opacity={0.55} />
    <path d="M22 22 l6 -6 l6 6 l-6 6 Z" fill={accent} />
  </svg>
);

/** ختم الدرجة: دائرة بحلقتين ونقاط، والكلمة في وسطها. */
const GradeSeal: React.FC<{ t: Theme; size: number; grade: string; line: boolean }> = ({ t, size, grade, line }) => {
  const c = t.colors;
  const ring = c.bg;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 120 120" style={{ position: "absolute", inset: 0 }}>
        <circle cx={60} cy={60} r={56} fill={c.primary} stroke={line ? c.ink : "none"} strokeWidth={line ? 3 : 0} />
        <circle cx={60} cy={60} r={49} fill="none" stroke={ring} strokeWidth={1.8} opacity={0.85} />
        
        {Array.from({ length: 20 }, (_, i) => {
          const a = (i * 2 * Math.PI) / 20;
          return <circle key={i} cx={60 + 41 * Math.cos(a)} cy={60 + 41 * Math.sin(a)} r={1.9} fill={ring} opacity={0.85} />;
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: fontFamilies.heading,
          fontWeight: 700,
          fontSize: size * (grade.length > 4 ? 0.18 : 0.21),
          color: ring,
          paddingBottom: size * 0.03,
        }}
      >
        {grade}
      </div>
    </div>
  );
};

/** حجم نص الحديث حسب طوله، حتى يبقى في البطاقة دون أن يصغر بلا داعٍ. */
const textScale = (len: number, portrait: boolean) => {
  const steps = portrait ? [60, 110, 170, 240] : [64, 100, 150, 220];
  const scales = [0.95, 0.85, 0.74, 0.64, 0.56];
  const i = steps.findIndex((s) => len <= s);
  return scales[i === -1 ? scales.length - 1 : i] ?? 0.56;
};

/**
 * «بطاقة الحديث»: صفحة مخطوطة هادئة بشريط جانبي وأركان مزخرفة.
 * الراوي أولًا، ثم نص الحديث كاملًا بخط النسخ (بلا تعديل، وبلا أقواس القرآن)،
 * ثم المصدر، ثم يُختم بدرجة الحديث. شريط الترجمة يبقى ظاهرًا.
 */
export const HadithCard: React.FC<HadithCardProps> = (props) => {
  const { themeId, orientation, narrator, text = "", reference, grade: gradeRaw } = props;
  const lang = useLang();
  const grade = gradeRaw ? (lang.strings.grades[gradeRaw] ?? gradeRaw) : gradeRaw;
  const frame = useSceneFrame();
  const boil = useBoil();
  const verseSize = useSize("verse", orientation);
  const refSize = useSize("reference", orientation);
  const { durationInFrames } = useVideoConfig();
  const t = useTheme(themeId);
  const c = t.colors;
  const portrait = orientation === "portrait";
  const line = t.character.style === "line";
  const night = themeId === "night";
  const rtl = lang.dir === "rtl";

  const card = enter(frame, 0, 30, 90);
  const spine = fade(frame, 4, 26);
  const corners = enter(frame, 10, 30, 110);
  const narratorIn = fade(frame, 12, 16);
  const textIn = fade(frame, 22, 34);
  const blur = interpolate(textIn, [0, 1], [6, 0]);
  const refIn = fade(frame, 50, 16);
  const seal = enter(frame, 60, 30, 160);

  const hadithSize = Math.round(verseSize * textScale(text.length, portrait));
  const sealSize = portrait ? 172 : 156;
  const cornerSize = portrait ? 56 : 52;
  const spineW = portrait ? 18 : 16;
  const frameColor = line ? c.ink : c.primary;

  return (
    <SceneShell {...props} durationInFrames={durationInFrames}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: portrait ? "250px 64px 560px" : "120px 210px 210px",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: portrait ? 952 : 1440,
            background: c.surface,
            border: line ? `3px solid ${c.ink}` : "none",
            boxShadow: line ? "none" : `0 22px 56px rgba(0,0,0,${night ? 0.35 : 0.09})`,
            borderRadius: portrait ? 22 : 20,
            /** الحشوة الأعرض في جهة الشريط الجانبي (بداية السطر). */
            padding: portrait ? (rtl ? "84px 92px 120px 70px" : "84px 70px 120px 92px") : rtl ? "70px 124px 78px 110px" : "70px 110px 78px 124px",
            opacity: card,
            transform: `translateY(${(1 - card) * 24}px)`,
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            gap: portrait ? 34 : 28,
          }}
        >
          {/* الشريط الجانبي في بداية السطر: يمين في العربية، يسار في اللاتينية */}
          <div
            style={{
              position: "absolute",
              top: line ? -3 : 0,
              bottom: line ? -3 : 0,
              insetInlineStart: line ? -3 : 0,
              width: spineW,
              background: line ? c.secondary : c.primary,
              border: line ? `3px solid ${c.ink}` : "none",
              borderRadius: rtl ? (portrait ? "0 22px 22px 0" : "0 20px 20px 0") : portrait ? "22px 0 0 22px" : "20px 0 0 20px",
              transformOrigin: "50% 0%",
              transform: `scaleY(${spine})`,
            }}
          />
          {/* أركان مزخرفة */}
          {(
            [
              { top: 22, insetInlineStart: 22 + spineW, rot: rtl ? 90 : 0 },
              { top: 22, insetInlineEnd: 22, rot: rtl ? 0 : 90 },
              { bottom: 22, insetInlineEnd: 22, rot: rtl ? -90 : 180 },
              { bottom: 22, insetInlineStart: 22 + spineW, rot: rtl ? 180 : -90 },
            ] as const
          )
            .filter((_, i) => !(grade && !portrait && i === 2))
            .map(({ rot, ...pos }, i) => (
            <Corner
              key={i}
              size={cornerSize}
              color={frameColor}
              accent={line ? c.primary : c.secondary}
              style={{
                ...pos,
                opacity: corners * (line ? 0.85 : 0.7),
                transform: `rotate(${rot}deg) scale(${0.7 + 0.3 * corners}) ${line ? boil(frame, 11 + i, 0.6) : ""}`,
              }}
            />
          ))}

          {/* الراوي */}
          {narrator ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                justifyContent: "center",
                opacity: narratorIn,
                transform: `translateY(${(1 - narratorIn) * 10}px)`,
              }}
            >
              <svg width={18} height={18} viewBox="0 0 20 20">
                <path d="M10 1 L19 10 L10 19 L1 10 Z" fill={c.primary} />
              </svg>
              <div style={{ fontFamily: fontFamilies.heading, fontWeight: 600, fontSize: Math.round(refSize * 1.12), color: c.inkSoft }}>{narrator}</div>
              <svg width={18} height={18} viewBox="0 0 20 20">
                <path d="M10 1 L19 10 L10 19 L1 10 Z" fill={c.primary} />
              </svg>
            </div>
          ) : null}

          {/* نص الحديث */}
          <div
            style={{
              fontFamily: fontFamilies.scripture,
              fontSize: hadithSize,
              lineHeight: 1.85,
              textAlign: "center",
              color: c.ink,
              opacity: textIn,
              filter: `blur(${blur}px)`,
              transform: `translateY(${(1 - textIn) * 14}px)`,
              textWrap: "balance",
            }}
          >
            {rtl ? (
              <span style={{ fontFamily: fontFamilies.heading, color: c.primary, fontSize: "0.8em", marginInlineEnd: "0.12em" }}>«</span>
            ) : (
              <span style={{ color: c.primary, marginInlineEnd: "0.06em" }}>{"\u201C"}</span>
            )}
            {text}
            {rtl ? (
              <span style={{ fontFamily: fontFamilies.heading, color: c.primary, fontSize: "0.8em", marginInlineStart: "0.12em" }}>»</span>
            ) : (
              <span style={{ color: c.primary, marginInlineStart: "0.06em" }}>{"\u201D"}</span>
            )}
          </div>

          {/* المصدر */}
          {reference ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: portrait ? "center" : "flex-start",
                gap: 18,
                opacity: refIn,
                transform: `translateY(${(1 - refIn) * 10}px)`,
                paddingInlineEnd: portrait ? 0 : sealSize * 0.9,
              }}
            >
              <div style={{ width: 64, height: 3, borderRadius: 2, background: c.primary, opacity: 0.7 }} />
              <div style={{ fontFamily: fontFamilies.heading, fontWeight: 600, fontSize: refSize, color: c.inkSoft }}>{reference}</div>
            </div>
          ) : null}

          {/* ختم الدرجة: يُطبع على الحافة السفلية في نهاية السطر (يسار في العربية، يمين في اللاتينية) */}
          {grade ? (
            <div
              style={{
                position: "absolute",
                ...(portrait ? { left: "50%", marginLeft: -sealSize / 2 } : { insetInlineEnd: 56, marginLeft: 0 }),
                bottom: -sealSize * (portrait ? 0.52 : 0.42),
                opacity: Math.min(1, seal * 1.4),
                transform: `scale(${1.35 - 0.35 * seal}) rotate(${(rtl ? 1 : -1) * (-14 + 6 * seal)}deg) ${line ? boil(frame, 21, 0.5) : ""}`,
                filter: night ? "none" : `drop-shadow(0 6px 10px rgba(0,0,0,${0.12 * seal}))`,
              }}
            >
              <GradeSeal t={t} size={sealSize} grade={grade} line={line} />
            </div>
          ) : null}
        </div>
      </div>
    </SceneShell>
  );
};

/** محتوى تجريبي لمعاينة القالب. */
export const hadithCardSample: Omit<HadithCardProps, "themeId" | "orientation"> = {
  eyebrow: "الفصل 4 · بعين الإسلام",
  narrator: "عن أبي هريرة رضي الله عنه",
  text: "ليس الغنى عن كثرة العرض، ولكن الغنى غنى النفس",
  reference: "صحيح البخاري · ٦٤٤٦",
  grade: "صحيح",
  narration: "والغنى الحقيقي في النفس، كما قال رسول الله صلى الله عليه وسلم.",
};
export const hadithCardSeconds = 8;

/** محتوى تجريبي إنجليزي (للحلقات الإنجليزية). الدرجة تبقى بمفتاحها العربي وتُترجم من حزمة اللغة. */
export const hadithCardSampleEn: Omit<HadithCardProps, "themeId" | "orientation"> = {
  eyebrow: "Chapter 4 · Through the lens of Islam",
  narrator: "Narrated by Abu Hurayrah",
  text: "Richness is not having many possessions; true richness is the richness of the soul.",
  reference: "Sahih al-Bukhari · 6446",
  grade: "صحيح",
  narration: "True richness lives in the soul, as the Prophet, peace be upon him, said.",
};
