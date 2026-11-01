import React from "react";
import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, useVideoConfig } from "remotion";
import { fontFamilies } from "../../../brand/fonts";
import { SceneShell } from "./SceneShell";
import { useLang } from "../../i18n/context";
import { useSceneFrame } from "./motion";
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

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const GOLD = "#D4A24C";
const rand = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** التلوين: مرشحات CSS للصورة + طبقة لون بمزج ناعم */
const GRADES: Record<string, { filter: string; tint: string; blend: React.CSSProperties["mixBlendMode"]; tintOpacity: number }> = {
  warm: { filter: "saturate(0.82) contrast(1.1) brightness(0.94)", tint: "#B86E2E", blend: "soft-light", tintOpacity: 0.22 },
  cold: { filter: "saturate(0.75) contrast(1.1) brightness(0.95)", tint: "#2C5A7A", blend: "soft-light", tintOpacity: 0.5 },
  night: { filter: "saturate(0.6) contrast(1.15) brightness(0.72)", tint: "#14284A", blend: "multiply", tintOpacity: 0.45 },
  sepia: { filter: "sepia(0.55) saturate(0.8) contrast(1.05)", tint: "#8A5A2B", blend: "soft-light", tintOpacity: 0.35 },
  natural: { filter: "contrast(1.04)", tint: "#000000", blend: "normal", tintOpacity: 0 },
};

const FOCUS: Record<string, { x: number; y: number }> = {
  center: { x: 50, y: 50 },
  left: { x: 25, y: 50 },
  right: { x: 75, y: 50 },
  top: { x: 50, y: 30 },
  bottom: { x: 50, y: 70 },
};

/** ذرات الجو: غبار يطفو، دخان يتحرك، جمر يصعد، مطر */
const Atmosphere: React.FC<{ kind: string; frame: number; w: number; h: number }> = ({ kind, frame, w, h }) => {
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
const FilmGrain: React.FC<{ frame: number; w: number; h: number; amount: number }> = ({ frame, w, h, amount }) => {
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
    <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 45%, #2A1D12 0%, #0B0806 75%)", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: portrait ? "84%" : "62%", border: `2px dashed ${GOLD}66`, borderRadius: 18 * u, padding: `${40 * u}px ${48 * u}px`, textAlign: "center", color: "#E9D9B8" }}>
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
    <SceneShell {...props} themeId="night" motif={false} background="#050403" durationInFrames={durationInFrames} eyebrowColors={{ text: "#E9D9B8", border: GOLD }} captionVariant={letterbox === "on" && !portrait ? "cinema" : "pill"}>
      <AbsoluteFill style={{ opacity: appear, overflow: "hidden" }}>
        {archive ? (
          // الوثيقة على طاولة داكنة: ورقة بهامش وظل، والكاميرا تنزلق فوقها، وضوء يمرّ عليها
          <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 40%, #3A2818 0%, #120B06 80%)" }}>
            <AbsoluteFill style={{ transform: `translate(${tx * 0.6}%, ${ty * 0.6}%) scale(${0.92 + (scale - 1) * 0.8}) rotate(${interpolate(p, [0, 1], [-1.2, 0.6])}deg)`, alignItems: "center", justifyContent: "center" }}>
              <div style={{ position: "relative", width: portrait ? "88%" : "74%", height: portrait ? "66%" : "84%", background: "#E8D9B6", padding: 18 * u, boxShadow: `0 ${30 * u}px ${80 * u}px rgba(0,0,0,0.65)`, borderRadius: 4 }}>
                {src ? (props.video ? <OffthreadVideo src={src} muted playbackRate={rate} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Img src={src} style={{ width: "100%", height: "100%", objectFit: "contain", filter: `${g.filter} sepia(0.15)` }} />) : <div style={{ width: "100%", height: "100%", position: "relative" }}>{placeholder}</div>}
              </div>
            </AbsoluteFill>
            {/* ضوء يعبر الوثيقة */}
            <AbsoluteFill style={{ background: `linear-gradient(105deg, transparent ${interpolate(p, [0, 1], [-30, 70])}%, rgba(255,230,180,0.14) ${interpolate(p, [0, 1], [-10, 90])}%, transparent ${interpolate(p, [0, 1], [10, 110])}%)`, mixBlendMode: "screen" }} />
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

      {/* المكان والتاريخ: أعلى بداية الشاشة، بخط Amiri وخط ذهبي، فوق ظل خفيف يضمن وضوحه على أي صورة */}
      {title || date ? <AbsoluteFill style={{ opacity: lowerA, background: `radial-gradient(ellipse 45% 40% at ${rtl ? "100%" : "0%"} ${portrait ? "22%" : "8%"}, rgba(0,0,0,0.55) 0%, transparent 100%)` }} /> : null}
      {title || date ? (
        <div style={{ position: "absolute", top: portrait ? 330 * u : bar + 40 * u, insetInlineStart: portrait ? 64 * u : 96 * u, opacity: lowerA, transform: `translateY(${(1 - lowerIn) * 14}px)`, color: "#F1E3C6", textShadow: "0 2px 18px rgba(0,0,0,0.85)" }}>
          {title ? <div style={{ fontFamily: fontFamilies.scripture, fontWeight: 700, fontSize: (portrait ? 64 : 58) * u, lineHeight: 1.2 }}>{title}</div> : null}
          <div style={{ width: interpolate(lowerIn, [0, 1], [0, (portrait ? 220 : 260) * u]), height: 2, background: GOLD, margin: `${10 * u}px 0` }} />
          {date ? <div style={{ fontFamily: fontFamilies.heading, fontSize: (portrait ? 34 : 30) * u, color: GOLD, letterSpacing: "0.04em" }}>{date}</div> : null}
        </div>
      ) : null}

      {/* اسم المصدر (للوثائق والصور الأرشيفية) */}
      {credit ? (
        <div style={{ position: "absolute", bottom: (portrait ? 420 : bar + 22) * u, insetInlineEnd: (portrait ? 64 : 96) * u, fontSize: (portrait ? 22 : 20) * u, color: "#E9D9B8", opacity: 0.75 * lowerA, fontFamily: fontFamilies.body }}>
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
