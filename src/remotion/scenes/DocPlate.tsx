import React from "react";
import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, useVideoConfig } from "remotion";
import { fontFamilies } from "../../../brand/fonts";
import { SceneShell } from "./SceneShell";
import { Atmosphere, FilmGrain } from "./cinema";
import { useLang } from "../../i18n/context";
import { useSceneFrame, clamp } from "./motion";
import type { SceneBase, StringFields } from "./types";

/**
 * «لوحة وثائقية»: صورة واقعية (مولّدة أو من الأرشيف) تتحول إلى لقطة سينمائية:
 * حركة كاميرا بطيئة (Ken Burns)، تلوين لوني بطابع الحلقة، حبيبات فيلم، غبار أو دخان أو جمر يتحرك في الهواء،
 * أشرطة سينما، وعنوان المكان والتاريخ. ونمط «أرشيف» يعرض مخطوطة أو خريطة قديمة كوثيقة على طاولة مع اسم مصدرها.
 * بلا صورة: لوحة «صورة مطلوبة» فيها وصف المشهد حتى يعرف صاحب القناة ما يولّده.
 */
export type DocPlateProps = SceneBase &
  StringFields<"image" | "prompt" | "look" | "camera" | "focus" | "grade" | "atmos" | "title" | "date" | "credit" | "letterbox"> & {
    /** رابط الصورة الجاهز (يحسبه الاستوديو من وسائط الحلقة) */
    src?: string;
    /** الملف مقطع فيديو قصير (Firefly Video…) لا صورة */
    video?: boolean;
  };

/** ألوان «دفتر الأفق» (brand/identity/approved.ts) ودرجاتها المشتقة؛ القالب خاص بدفاتر الزمن */
const HZ = { dusk: "#2A1E3F", duskDeep: "#140E20", sun: "#E07A3F", parchment: "#F1E4CB", ink: "#4A2E1F", inkDeep: "#1E130C", tape: "#D7372B", sand: "#C8A15A" } as const;
const GOLD = HZ.sand;
const rand = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** التلوين: مرشحات CSS للصورة + طبقة لون بمزج ناعم */
const GRADES: Record<string, { filter: string; tint: string; blend: React.CSSProperties["mixBlendMode"]; tintOpacity: number }> = {
  warm: { filter: "saturate(0.82) contrast(1.1) brightness(0.94)", tint: HZ.sun, blend: "soft-light", tintOpacity: 0.2 },
  cold: { filter: "saturate(0.75) contrast(1.1) brightness(0.95)", tint: HZ.dusk, blend: "soft-light", tintOpacity: 0.5 },
  night: { filter: "saturate(0.6) contrast(1.15) brightness(0.72)", tint: HZ.dusk, blend: "multiply", tintOpacity: 0.5 },
  sepia: { filter: "sepia(0.55) saturate(0.8) contrast(1.05)", tint: HZ.ink, blend: "soft-light", tintOpacity: 0.4 },
  natural: { filter: "contrast(1.04)", tint: "#000000", blend: "normal", tintOpacity: 0 },
};

const FOCUS: Record<string, { x: number; y: number }> = {
  center: { x: 50, y: 50 },
  left: { x: 25, y: 50 },
  right: { x: 75, y: 50 },
  top: { x: 50, y: 30 },
  bottom: { x: 50, y: 70 },
};

export const DocPlate: React.FC<DocPlateProps> = (props) => {
  const { orientation, src, prompt = "", look = "scene", camera = "push", focus = "center", grade = "warm", atmos = "dust", title = "", date = "", credit = "", letterbox = "on" } = props;
  const frame = useSceneFrame();
  const { durationInFrames, width: W, height: H } = useVideoConfig();
  const portrait = orientation === "portrait";
  const archive = look === "archive";
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const g = GRADES[grade] ?? GRADES.warm!;
  const f = FOCUS[focus] ?? FOCUS.center!;

  // حركة الكاميرا: تكبير/تصغير بطيء أو تحريك أفقي/رأسي، دائمًا مع تكبير بسيط حتى لا تظهر الحواف
  const span = portrait ? 0.1 : 0.14;
  const move: Record<string, { s: [number, number]; x: [number, number]; y: [number, number] }> = {
    push: { s: [1.04, 1.04 + span], x: [0, 0], y: [0, 0] },
    pull: { s: [1.04 + span, 1.04], x: [0, 0], y: [0, 0] },
    "pan-right": { s: [1.16, 1.16], x: [-4, 4], y: [0, 0] },
    "pan-left": { s: [1.16, 1.16], x: [4, -4], y: [0, 0] },
    rise: { s: [1.16, 1.16], x: [0, 0], y: [4, -4] },
    drift: { s: [1.06, 1.12], x: [-1.5, 1.5], y: [1, -1] },
  };
  const m = move[camera] ?? move.push!;
  const scale = interpolate(p, [0, 1], m.s);
  const tx = interpolate(p, [0, 1], m.x);
  const ty = interpolate(p, [0, 1], m.y);
  // تنفّس الضوء: خفقان بسيط كضوء شمعة أو سحاب
  const breathe = 1 + Math.sin(frame / 37) * 0.012 + Math.sin(frame / 13) * 0.006;
  const appear = interpolate(frame, [0, 14], [0, 1], clamp);

  const bar = letterbox === "on" && !portrait ? interpolate(frame, [0, 18], [0, H * 0.12], { ...clamp, easing: Easing.out(Easing.cubic) }) : 0;
  const lowerIn = interpolate(frame, [12, 30], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const lowerOut = interpolate(frame, [durationInFrames - 30, durationInFrames - 14], [1, 0], clamp);
  const lowerA = Math.min(lowerIn, lowerOut);
  const u = H / 1080;
  const rtl = useLang().dir === "rtl";

  const { fps } = useVideoConfig();
  const mediaStyle: React.CSSProperties = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: `${f.x}% ${f.y}%`, filter: g.filter };
  // مقاطع Firefly نحو 5 ثوانٍ: تُبطَّأ لتغطي المشهد (حتى 40% من سرعتها) فتبدو حركة بطيئة سينمائية
  const rate = Math.min(1, Math.max(0.4, 5 / Math.max(1, durationInFrames / fps)));
  const image = src ? (props.video ? <OffthreadVideo src={src} muted playbackRate={rate} style={mediaStyle} /> : <Img src={src} style={mediaStyle} />) : null;

  const placeholder = (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 45%, ${HZ.dusk} 0%, ${HZ.duskDeep} 75%)`, alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: portrait ? "84%" : "62%", border: `2px dashed ${GOLD}66`, borderRadius: 18 * u, padding: `${40 * u}px ${48 * u}px`, textAlign: "center", color: HZ.parchment }}>
        <svg width={90 * u} height={70 * u} viewBox="0 0 90 70" style={{ marginBottom: 18 * u }}>
          <rect x="3" y="3" width="84" height="64" rx="8" fill="none" stroke={GOLD} strokeWidth="3" />
          <circle cx="28" cy="24" r="7" fill={GOLD} />
          <path d="M8 60 L34 36 L50 50 L62 40 L84 60 Z" fill={GOLD} opacity="0.7" />
        </svg>
        <div style={{ fontFamily: fontFamilies.heading, fontWeight: 700, fontSize: (portrait ? 52 : 46) * u, color: GOLD }}>{archive ? "وثيقة مطلوبة" : "صورة مطلوبة"}</div>
        {prompt ? <div style={{ marginTop: 14 * u, fontSize: (portrait ? 26 : 24) * u, lineHeight: 1.45, direction: "ltr", fontFamily: "'IBM Plex Sans', sans-serif", opacity: 0.85 }}>{prompt.length > 220 ? `${prompt.slice(0, 220)}…` : prompt}</div> : null}
      </div>
    </AbsoluteFill>
  );

  return (
    <SceneShell {...props} themeId="night" motif={false} background={HZ.duskDeep} durationInFrames={durationInFrames} eyebrowColors={{ text: HZ.parchment, border: GOLD }} captionVariant={letterbox === "on" && !portrait ? "cinema" : "pill"}>
      <AbsoluteFill style={{ opacity: appear, overflow: "hidden" }}>
        {archive ? (
          // الوثيقة على طاولة داكنة: ورقة بهامش وظل، والكاميرا تنزلق فوقها، وضوء يمرّ عليها
          <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, ${HZ.ink} 0%, ${HZ.inkDeep} 80%)` }}>
            <AbsoluteFill style={{ transform: `translate(${tx * 0.6}%, ${ty * 0.6}%) scale(${0.92 + (scale - 1) * 0.8}) rotate(${interpolate(p, [0, 1], [-1.2, 0.6])}deg)`, alignItems: "center", justifyContent: "center" }}>
              <div style={{ position: "relative", width: portrait ? "88%" : "74%", height: portrait ? "66%" : "84%", background: HZ.parchment, padding: 18 * u, boxShadow: `0 ${30 * u}px ${80 * u}px rgba(0,0,0,0.65)`, borderRadius: 4 }}>
                {src ? (props.video ? <OffthreadVideo src={src} muted playbackRate={rate} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Img src={src} style={{ width: "100%", height: "100%", objectFit: "contain", filter: `${g.filter} sepia(0.15)` }} />) : <div style={{ width: "100%", height: "100%", position: "relative" }}>{placeholder}</div>}
              </div>
            </AbsoluteFill>
            {/* ضوء يعبر الوثيقة */}
            <AbsoluteFill style={{ background: `linear-gradient(105deg, transparent ${interpolate(p, [0, 1], [-30, 70])}%, rgba(224,122,63,0.14) ${interpolate(p, [0, 1], [-10, 90])}%, transparent ${interpolate(p, [0, 1], [10, 110])}%)`, mixBlendMode: "screen" }} />
          </AbsoluteFill>
        ) : (
          <>
            <AbsoluteFill style={{ transform: `translate(${tx}%, ${ty}%) scale(${scale})`, transformOrigin: `${f.x}% ${f.y}%`, filter: `brightness(${breathe})` }}>
              {image ?? placeholder}
            </AbsoluteFill>
            {src && g.tintOpacity ? <AbsoluteFill style={{ background: g.tint, mixBlendMode: g.blend, opacity: g.tintOpacity }} /> : null}
          </>
        )}
        {atmos !== "none" ? <Atmosphere kind={atmos} frame={frame} w={W} h={H} /> : null}
        {/* إطار مظلم حول الصورة يشدّ العين للوسط */}
        <AbsoluteFill style={{ background: "radial-gradient(ellipse 75% 70% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
        <FilmGrain frame={frame} w={W} h={H} amount={0.16} />
      </AbsoluteFill>

      {/* أشرطة السينما */}
      {bar > 0 ? (
        <>
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: bar, background: "#000" }} />
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: bar, background: "#000" }} />
        </>
      ) : null}

      {/* المكان والتاريخ: أعلى بداية الشاشة، بخط الأميري وخط رملي وشريط تاريخ أحمر، فوق ظل خفيف يضمن وضوحه على أي صورة */}
      {title || date ? <AbsoluteFill style={{ opacity: lowerA, background: `radial-gradient(ellipse 45% 40% at ${rtl ? "100%" : "0%"} ${portrait ? "22%" : "8%"}, rgba(0,0,0,0.55) 0%, transparent 100%)` }} /> : null}
      {title || date ? (
        <div style={{ position: "absolute", top: portrait ? 330 * u : bar + 40 * u, insetInlineStart: portrait ? 64 * u : 96 * u, opacity: lowerA, transform: `translateY(${(1 - lowerIn) * 14}px)`, color: HZ.parchment, textShadow: "0 2px 18px rgba(0,0,0,0.85)" }}>
          {title ? <div style={{ fontFamily: fontFamilies.scripture, fontWeight: 700, fontSize: (portrait ? 64 : 58) * u, lineHeight: 1.2 }}>{title}</div> : null}
          <div style={{ width: interpolate(lowerIn, [0, 1], [0, (portrait ? 220 : 260) * u]), height: 2, background: GOLD, margin: `${10 * u}px 0` }} />
          {/* الزمن على «شريط التاريخ» الأحمر بخط السنوات IBM Plex Mono (بصمة دفتر الأفق) */}
          {date ? <div style={{ display: "inline-block", fontFamily: `${fontFamilies.mono.replace(", monospace", "")}, ${fontFamilies.clean}`, fontWeight: 500, fontSize: (portrait ? 32 : 28) * u, color: HZ.parchment, background: HZ.tape, padding: `${4 * u}px ${16 * u}px`, borderRadius: 3 * u, letterSpacing: "0.03em", textShadow: "none", clipPath: `inset(0 ${(1 - lowerIn) * 100}% 0 0)` }}>{date}</div> : null}
        </div>
      ) : null}

      {/* اسم المصدر (للوثائق والصور الأرشيفية) */}
      {credit ? (
        <div style={{ position: "absolute", bottom: (portrait ? 420 : bar + 22) * u, insetInlineEnd: (portrait ? 64 : 96) * u, fontSize: (portrait ? 22 : 20) * u, color: HZ.parchment, opacity: 0.75 * lowerA, fontFamily: fontFamilies.body }}>
          المصدر: {credit}
        </div>
      ) : null}
    </SceneShell>
  );
};

export const docPlateSample: Omit<DocPlateProps, "themeId" | "orientation"> = {
  eyebrow: "",
  prompt: "Wide establishing shot of the round city of Baghdad at golden hour in the 9th century, the Tigris river with wooden boats, domes and minarets, busy markets",
  look: "scene",
  camera: "push",
  focus: "center",
  grade: "warm",
  atmos: "dust",
  title: "بغداد",
  date: "القرن التاسع الميلادي",
  credit: "",
  letterbox: "on",
  narration: "بغداد، في القرن التاسع الميلادي. مدينة مستديرة على ضفاف دجلة، صارت عاصمة الدنيا.",
  captions: false,
};
export const docPlateSampleEn: Omit<DocPlateProps, "themeId" | "orientation"> = { ...docPlateSample, title: "Baghdad", date: "9th century", narration: "Baghdad, in the ninth century. A round city on the Tigris that became the capital of the world." };
export const docPlateSeconds = 7;
