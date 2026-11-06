import React from "react";
import { AbsoluteFill, Easing, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import config from "../../../config.json";
import { AlleyTale, type AlleyTaleProps } from "../scenes/AlleyTale";
import { RoadJourney, roadJourneySample } from "../scenes/RoadJourney";
import { LightStage, lightStageSample } from "../scenes/LightStage";
import { useBrandFonts } from "../useBrandFonts";
import { APPROVED_IDENTITIES } from "../../../brand/identity/approved";

/**
 * نسخة المراجعة البصرية (الأمر 014): مشاهد المختبر المحايدة بملء الإطار، بلا تقسيم ولا لوحات تشخيص،
 * بأدوات المحرك حيث يدعمها القالب (الكاميرا المؤلَّفة، التأطير المحتوي، الحركة الطبيعية)، وبطاقة قصيرة
 * باسم الأسلوب بين الأجزاء. بلا صوت ولا إضاءة ولا انتقالات مضافة. لا تُنشر.
 */
const P = APPROVED_IDENTITIES.balislam!.palette.map((c) => c.hex);
/** ألوان «محراب النور» المعتمدة بترتيبها: ليل زمردي، نحاس، فجر، ورق، ختم */
const C = { night: P[0]!, copper: P[1]!, dawn: P[2]!, paper: P[3]! };
type Orientation = "landscape" | "portrait";
type Part =
  | { kind: "card"; title: string; sub: string; seconds: number }
  | { kind: "alley"; seconds: number; scene: Omit<AlleyTaleProps, "themeId" | "orientation"> }
  | { kind: "road"; seconds: number }
  | { kind: "stage"; seconds: number };

const alley = { place: "alley", mood: "night", look: "hero", cameraMode: "composed", framing: "fit", gait: "walk" } as const;

export const REVIEW_014: Part[] = [
  { kind: "card", title: "حكايات الحارة", sub: "مشي وتوقف عند الباب · موقف مع شخص آخر · شاهدان", seconds: 2.4 },
  { kind: "alley", seconds: 8, scene: { ...alley, narration: "يمشي في الحارة مساء. ثم يقف أمام الباب ويفكر.", cast: "solo", poses: "walk,stand", cues: "door | الباب\nthink | ويفكر" } },
  { kind: "alley", seconds: 8, scene: { ...alley, narration: "يقف أمام صديقه بعد الخلاف. يعتذر له بصدق، ثم يصغي إليه.", cast: "companion", poses: "stand,apologize,listen", cues: "apologize | يعتذر\nlisten | يصغي" } },
  { kind: "alley", seconds: 8.5, scene: { ...alley, place: "market", narration: "شاهدان رأيا الموقف نفسه. الأول يراه ظلمًا، والثاني يراه عدلًا.", cast: "witnesses", poses: "stand", cues: "witnesses | شاهدان\nwrong | ظلمًا\njust | عدلًا" } },
  { kind: "card", title: "الطريق", sub: "مشي طبيعي على طريق متحرك", seconds: 2.4 },
  { kind: "road", seconds: 14 },
  { kind: "card", title: "ظل ونور", sub: "انتقال الوضعيات وظهور كلمة المعنى", seconds: 2.4 },
  { kind: "stage", seconds: 12 },
];
const F = (s: number) => Math.round(s * config.video.fps);
export const review014Frames = () => REVIEW_014.reduce((n, p) => n + F(p.seconds), 0);

/** بطاقة الأسلوب: ليل زمردي، قوس نحاسي رفيع، العنوان بالرقعة والوصف بتجوال */
const StyleCard: React.FC<{ title: string; sub: string; portrait: boolean }> = ({ title, sub, portrait }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const ease = Easing.bezier(0.22, 1, 0.36, 1);
  const inT = interpolate(frame, [0, 16], [0, 1], { extrapolateRight: "clamp", easing: ease });
  const outT = interpolate(frame, [durationInFrames - 12, durationInFrames - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const arch = interpolate(frame, [4, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  // القوس يحيط بالعنوان والوصف معًا فلا يقطع خطُّه النص
  const w = portrait ? 900 : 1000;
  const h = portrait ? 760 : 600;
  const path = `M ${-w / 2} ${h / 2} L ${-w / 2} ${-h / 6} Q ${-w / 2} ${-h / 2} 0 ${-h / 2} Q ${w / 2} ${-h / 2} ${w / 2} ${-h / 6} L ${w / 2} ${h / 2}`;
  return (
    <AbsoluteFill style={{ background: C.night, opacity: outT }}>
      <svg viewBox={portrait ? "-540 -960 1080 1920" : "-960 -540 1920 1080"} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <path d={path} fill="none" stroke={C.copper} strokeWidth={3} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - arch} opacity={0.75} />
      </svg>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", direction: "rtl", textAlign: "center", opacity: inT, transform: `translateY(${(1 - inT) * 18}px)` }}>
        <div style={{ fontFamily: "'Aref Ruqaa', serif", fontWeight: 700, fontSize: portrait ? 124 : 112, color: C.paper, lineHeight: 1.3 }}>{title}</div>
        <div style={{ width: 90, height: 3, background: C.dawn, borderRadius: 2, margin: "18px 0 22px" }} />
        <div style={{ fontFamily: "Tajawal, sans-serif", fontSize: portrait ? 40 : 34, color: C.paper, opacity: 0.78, maxWidth: portrait ? 760 : 880, lineHeight: 1.5 }}>{sub}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const ReviewReel014: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  useBrandFonts();
  const portrait = orientation === "portrait";
  let from = 0;
  return (
    <AbsoluteFill style={{ background: C.night }}>
      {REVIEW_014.map((p, i) => {
        const at = from;
        from += F(p.seconds);
        const body =
          p.kind === "card" ? <StyleCard title={p.title} sub={p.sub} portrait={portrait} />
          : p.kind === "alley" ? <AlleyTale {...p.scene} themeId="night" orientation={orientation} />
          : p.kind === "road" ? <RoadJourney {...roadJourneySample} motion="natural" themeId="night" orientation={orientation} />
          : <LightStage {...lightStageSample} motion="natural" themeId="night" orientation={orientation} />;
        return (
          <Sequence key={i} from={at} durationInFrames={F(p.seconds)} name={`${i + 1} · ${p.kind}`}>
            {body}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
