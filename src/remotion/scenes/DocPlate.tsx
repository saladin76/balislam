import React from "react";
import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, useVideoConfig } from "remotion";
import { fontFamilies } from "../../../brand/fonts";
import { SceneShell } from "./SceneShell";
import { Atmosphere, FilmGrain } from "./cinema";
import { useLang } from "../../i18n/context";
import { useSceneFrame, clamp } from "./motion";
import { estimateTimings } from "./timing";
import type { SceneBase, StringFields } from "./types";

/**
 * «لوحة وثائقية»: صورة واقعية (مولّدة أو من الأرشيف) تتحول إلى لقطة سينمائية:
 * حركة كاميرا بطيئة (Ken Burns)، تلوين لوني بطابع الحلقة، حبيبات فيلم، غبار أو دخان أو جمر يتحرك في الهواء،
 * أشرطة سينما، وعنوان المكان والتاريخ. ونمط «أرشيف» يعرض مخطوطة أو خريطة قديمة كوثيقة على طاولة مع اسم مصدرها.
 * بلا صورة: لوحة «صورة مطلوبة» فيها وصف المشهد حتى يعرف صاحب القناة ما يولّده.
 */
export type DocPlateProps = SceneBase &
  StringFields<"image" | "prompt" | "image2" | "prompt2" | "image3" | "prompt3" | "look" | "camera" | "focus" | "grade" | "atmos" | "title" | "date" | "credit" | "letterbox"> & {
    /** رابط الصورة الجاهز (يحسبه الاستوديو من وسائط الحلقة) */
    src?: string;
    /** الملف مقطع فيديو قصير (Firefly Video…) لا صورة */
    video?: boolean;
    /** اللوحتان الثانية والثالثة في المشهد نفسه (اختياريتان) */
    src2?: string;
    video2?: boolean;
    src3?: string;
    video3?: boolean;
  };

/**
 * حدود اللوحات على الكلام: المشهد يُقسم على عدد اللوحات عند أقرب فاصلة أو نقطة من نقاط التقسيم المتساوي،
 * فتتبدل اللوحة مع بداية عبارة جديدة لا في منتصف كلمة.
 */
export const plateCuts = (count: number, timings: { word: string; start: number }[], duration: number): number[] => {
  if (count <= 1 || timings.length < count) return Array.from({ length: Math.max(1, count) }, (_, i) => Math.round((duration * i) / Math.max(1, count)));
  const cuts = [0];
  for (let k = 1; k < count; k++) {
    const ideal = Math.round((timings.length * k) / count);
    let best = ideal;
    for (let d = 0; d <= Math.ceil(timings.length / (count * 2)); d++) {
      for (const j of [ideal - d, ideal + d]) if (j > 0 && j < timings.length && /[،,.؛:!؟?]$/.test(timings[j - 1]!.word)) { best = j; d = 1e9; break; }
    }
    cuts.push(Math.max(cuts[k - 1]! + 20, timings[best]!.start - 4));
  }
  return cuts;
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
    const g = GRADES[grade] ?? GRADES.warm!;
  const f = FOCUS[focus] ?? FOCUS.center!;

  // اللوحات: الأولى والثانية والثالثة (بصورها أو بأوصافها قبل التوليد)، وتتبدل مع عبارات الكلام
  const plates = [
    { src, video: props.video, prompt },
    { src: props.src2, video: props.video2, prompt: props.prompt2 ?? "" },
    { src: props.src3, video: props.video3, prompt: props.prompt3 ?? "" },
  ].filter((x, i) => i === 0 || x.src || x.prompt.trim());
  const timings = props.narration ? (props.narrationTimings ?? estimateTimings(props.narration, 6, durationInFrames - 12)) : [];
  const cuts = archive ? [0] : plateCuts(plates.length, timings, durationInFrames);
  const plateIdx = cuts.reduce((acc, c, i) => (frame >= c ? i : acc), 0);
  const segFrom = cuts[plateIdx] ?? 0;
  const segTo = cuts[plateIdx + 1] ?? durationInFrames;
  const p = interpolate(frame, [segFrom, segTo], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });

  // حركة الكاميرا لكل لوحة: حركة الكاميرا المختارة للأولى، ثم عكسها، ثم اقتراب؛ وسرعتها محسوبة لمدة اللوحة
  // (حركة واضحة يراها المشاهد كحركة كاميرا الأفلام الوثائقية، لا انجراف لا يُلحظ)
  const segSec = Math.max(1, (segTo - segFrom) / 30);
  const span = Math.min(0.18, 0.05 * segSec + 0.03);
  const pan = Math.min(6, 1.6 * segSec + 1);
  const move: Record<string, { s: [number, number]; x: [number, number]; y: [number, number] }> = {
    push: { s: [1.04, 1.04 + span], x: [0, 0], y: [0, 0] },
    pull: { s: [1.04 + span, 1.04], x: [0, 0], y: [0, 0] },
    "pan-right": { s: [1.18, 1.18], x: [-pan, pan], y: [0, 0] },
    "pan-left": { s: [1.18, 1.18], x: [pan, -pan], y: [0, 0] },
    rise: { s: [1.18, 1.18], x: [0, 0], y: [pan, -pan] },
    drift: { s: [1.06, 1.06 + span * 0.7], x: [-pan * 0.5, pan * 0.5], y: [pan * 0.3, -pan * 0.3] },
  };
  const opposite: Record<string, string> = { push: "pull", pull: "push", "pan-right": "pan-left", "pan-left": "pan-right", rise: "push", drift: "pan-left" };
  const camFor = (i: number) => (i === 0 ? camera : i === 1 ? (opposite[camera] ?? "pull") : "push");
  const m = move[camFor(plateIdx)] ?? move.push!;
  const scale = interpolate(p, [0, 1], m.s);
  const tx = interpolate(p, [0, 1], m.x);
  const ty = interpolate(p, [0, 1], m.y);
  // انتقال بين اللوحتين: ذوبان قصير
  const plateIn = plateIdx === 0 ? 1 : interpolate(frame, [segFrom, segFrom + 10], [0, 1], clamp);
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
  /**
   * في 9:16 تُقص صورة 16:9 من وسطها فيختفي ثلثاها، فالكاميرا تنزلق أفقيًا عبر الصورة كلها (انزلاق وثائقي)
   * بدل التكبير وحده، باتجاه معاكس في كل لوحة تالية.
   */
  const slideX = (i: number, prog: number) => {
    if (!portrait) return f.x;
    const half = Math.min(32, 2.4 * segSec + 6);
    const dir = i % 2 === 0 ? 1 : -1;
    return Math.max(0, Math.min(100, f.x + dir * interpolate(prog, [0, 1], [-half, half])));
  };
  const mediaStyleFor = (i: number, prog: number): React.CSSProperties => ({ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: `${slideX(i, prog)}% ${f.y}%`, filter: g.filter });
  // مقاطع Firefly نحو 5 ثوانٍ: تُبطَّأ لتغطي المشهد (حتى 40% من سرعتها) فتبدو حركة بطيئة سينمائية
  const rate = Math.min(1, Math.max(0.4, 5 / Math.max(1, durationInFrames / fps)));
  const mediaOf = (pl: { src?: string; video?: boolean }, i: number, prog: number) => (pl.src ? (pl.video ? <OffthreadVideo src={pl.src} muted playbackRate={rate} style={mediaStyleFor(i, prog)} /> : <Img src={pl.src} style={mediaStyleFor(i, prog)} />) : null);
  const cur = plates[plateIdx] ?? plates[0]!;
  const prev = plateIdx > 0 ? plates[plateIdx - 1] : undefined;

  const placeholderFor = (prompt: string) => (
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
                {src ? (props.video ? <OffthreadVideo src={src} muted playbackRate={rate} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Img src={src} style={{ width: "100%", height: "100%", objectFit: "contain", filter: `${g.filter} sepia(0.15)` }} />) : <div style={{ width: "100%", height: "100%", position: "relative" }}>{placeholderFor(prompt)}</div>}
              </div>
            </AbsoluteFill>
            {/* ضوء يعبر الوثيقة */}
            <AbsoluteFill style={{ background: `linear-gradient(105deg, transparent ${interpolate(p, [0, 1], [-30, 70])}%, rgba(224,122,63,0.14) ${interpolate(p, [0, 1], [-10, 90])}%, transparent ${interpolate(p, [0, 1], [10, 110])}%)`, mixBlendMode: "screen" }} />
          </AbsoluteFill>
        ) : (
          <>
            {prev ? (
              <AbsoluteFill style={{ transform: `translate(${(move[camFor(plateIdx - 1)] ?? move.push!).x[1]}%, ${(move[camFor(plateIdx - 1)] ?? move.push!).y[1]}%) scale(${(move[camFor(plateIdx - 1)] ?? move.push!).s[1]})`, transformOrigin: `${f.x}% ${f.y}%`, filter: `brightness(${breathe})` }}>
                {mediaOf(prev, plateIdx - 1, 1) ?? placeholderFor(prev.prompt)}
              </AbsoluteFill>
            ) : null}
            <AbsoluteFill style={{ opacity: plateIn, transform: `translate(${tx}%, ${ty}%) scale(${scale})`, transformOrigin: `${f.x}% ${f.y}%`, filter: `brightness(${breathe})` }}>
              {mediaOf(cur, plateIdx, p) ?? placeholderFor(cur.prompt)}
            </AbsoluteFill>
            {cur.src && g.tintOpacity ? <AbsoluteFill style={{ background: g.tint, mixBlendMode: g.blend, opacity: g.tintOpacity }} /> : null}
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
