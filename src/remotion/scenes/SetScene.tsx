import React from "react";
import { AbsoluteFill, Easing, interpolate, spring, useVideoConfig } from "remotion";
import { useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import type { Theme } from "../../../brand/themes";
import { Element } from "../../../brand/elements/Element";
import { hasElement } from "../../../brand/elements/registry";
import { SetBackdrop, setById } from "../../../brand/sets/index";
import { Character, type CharacterPose, type CharacterVariant } from "../../../characters/Character";
import { HistoricFigure, type FigureExpr, type FigureId, type FigurePose } from "../../../characters/HistoricFigure";
import { useChannel } from "../../channel/context";
import { SceneShell } from "./SceneShell";
import { Atmosphere, CinemaLight, FilmGrain, Letterbox, PlaceTitle, letterboxHeight } from "./cinema";
import { useLang } from "../../i18n/context";
import { useSceneFrame } from "./motion";
import type { SceneBase, StringFields } from "./types";

/**
 * «مشهد في مكان»: مكان مرسوم كامل من مكتبة أماكن التصوير، وشخصية أو اثنتان (بلا ملامح وجه)،
 * وكاميرا تتحرك (اقتراب، تحريك جانبي، أو ثابتة)، وفقاعة كلام أو فكرة قصيرة، وعنصر اختياري.
 */
export type SetSceneProps = SceneBase &
  StringFields<"set" | "variant" | "pose" | "variant2" | "pose2" | "camera" | "bubble" | "bubbleKind" | "bubbleWho" | "element" | "figure" | "figure2" | "expr" | "expr2" | "talk" | "look" | "atmos" | "title" | "date">;

/** وضعيات الشخصيات بلا ملامح ← وضعيات الشخصيات التاريخية */
const figPose = (p: string): FigurePose => (({ point: "point", think: "think", "open-arms": "gesture", hold: "scroll", "raise-hands": "banner", wave: "gesture" } as Record<string, FigurePose>)[p] ?? "stand");

const ink = "#2A2F3A";

/** إضاءة كل مكان في المظهر السينمائي: موضع مصدر الضوء (نسبة من الإطار)، وأشعة، والجو الافتراضي */
const CINEMA: Record<string, { light: { x: number; y: number }; rays?: boolean; atmos: string }> = {
  caravan: { light: { x: 0.22, y: 0.24 }, atmos: "dust" },
  "castle-walls": { light: { x: 0.78, y: 0.52 }, atmos: "dust" },
  "walls-night": { light: { x: 0.81, y: 0.17 }, atmos: "embers" },
  "wisdom-library": { light: { x: 0.5, y: 0.3 }, rays: true, atmos: "dust" },
  "palace-court": { light: { x: 0.35, y: 0.0 }, rays: true, atmos: "dust" },
  "desert-night": { light: { x: 0.19, y: 0.19 }, atmos: "dust" },
  market: { light: { x: 0.7, y: 0.1 }, rays: true, atmos: "dust" },
  "street-night": { light: { x: 0.5, y: 0.3 }, atmos: "none" },
};
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

export const SetScene: React.FC<SetSceneProps> = (props) => {
  const { orientation, set = "office", variant = "narrator-m", pose = "stand", variant2 = "", pose2 = "stand", camera = "push", bubble = "", bubbleKind = "say", bubbleWho = "1", element = "" } = props;
  const frame = useSceneFrame();
  const { fps, durationInFrames, width: W, height: H } = useVideoConfig();
  const lang = useLang();
  const portrait = orientation === "portrait";
  const def = setById(set);
  const floorY = def?.floorY ?? 940;
  const night = def?.mood === "night";
  const t = frame / fps;

  // شخصيات مسطحة بخط خارجي تناسب رسم الأماكن
  const base = useTheme("family");
  const castTheme: Theme = {
    ...base,
    character: { style: "flat", outline: ink, skin: ["#E3B58E", "#CF9C74"], garments: ["#4A78B8", "#B85C7A", "#E8B23A", "#5B7F3A", "#8C6A9A"], cap: "#F4F1EA" },
  };

  // الشخصيات التاريخية بملامح: فقط في القنوات التي تسمح بالوجوه
  const chInfo = useChannel();
  const facesOk = Boolean(chInfo.rules?.faces);
  const cinema = (props.look || chInfo.brand?.sceneLook) === "cinema";
  const cfg = CINEMA[set] ?? { light: { x: 0.3, y: 0.2 }, atmos: "dust" };
  const fig1 = facesOk && props.figure ? (props.figure as FigureId) : null;
  const fig2 = facesOk && props.figure2 ? (props.figure2 as FigureId) : null;
  const two = Boolean(variant2 || fig2);
  // خط خارجي للشخصية يطابق رسم الأماكن
  const outline = [[3, 0], [-3, 0], [0, 3], [0, -3]].map(([x, y]) => `drop-shadow(${x}px ${y}px 0 ${ink})`).join(" ");
  const h = 430;
  const w = h * (160 / 300);
  const xs = two ? (portrait ? [960 - 150, 960 + 150] : [960 - 230, 960 + 230]) : [960];

  // الكاميرا
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const zoom = camera === "push" ? 1 + p * (portrait ? 0.12 : 0.22) : camera === "pull" ? 1.22 - p * 0.22 : 1;
  const panX = camera === "pan" ? interpolate(p, [0, 1], portrait ? [30, -30] : [70, -70]) : 0;
  const focusY = floorY - h * 0.6;

  // دخول الشخصيات والفقاعة
  const enterA = spring({ frame: frame - 4, fps, config: { damping: 14 } });
  const enterB = spring({ frame: frame - 12, fps, config: { damping: 14 } });
  const bubbleIn = spring({ frame: frame - 16, fps, config: { damping: 11, stiffness: 120 } });
  const bob = (k: number) => Math.sin(t * 2 + k) * 3;

  // العمودي: شريحة بعرض 608 من وسط المكان بارتفاعه الكامل
  const viewBox = portrait ? "656 0 608 1080" : "0 0 1920 1080";
  const who = bubbleWho === "2" && two ? 1 : 0;
  const bx = xs[who]!;
  const by = floorY - h - 40;
  const bubbleW = Math.min(portrait ? 420 : 720, 140 + bubble.length * (portrait ? 20 : 26));
  const bubbleSide = portrait ? (two ? (who === 0 ? 1 : -1) : 1) : two ? (who === 0 ? -1 : 1) : 1;
  // الفقاعة تبقى داخل الإطار حتى مع اقتراب الكاميرا
  const half = (portrait ? 290 : 900) / Math.max(1, camera === "push" ? 1 + (portrait ? 0.12 : 0.22) : camera === "pull" ? 1.22 : 1);
  const rawX = portrait ? bx - bubbleSide * w * 0.1 : bx + bubbleSide * (w * 0.35);
  const bubbleX = bubbleSide > 0 ? Math.min(rawX, 960 + half - bubbleW - 30) : Math.max(rawX, 960 - half + bubbleW + 30);

  return (
    <SceneShell {...props} themeId={night ? "night" : "paper"} motif={false} background={night ? "#141B33" : "#F4F6EF"} durationInFrames={durationInFrames} captionVariant={cinema && !portrait ? "cinema" : "pill"}>
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        {cinema ? (
          <defs>
            <filter id="set-dof" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation={1.6} /></filter>
            <filter id="rim" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx={0} dy={0} stdDeviation={6} floodColor={night ? "#FFB45A" : "#FFE6B0"} floodOpacity={night ? 0.45 : 0.35} />
            </filter>
          </defs>
        ) : null}
        {/* المظهر السينمائي: الخلفية تتحرك نصف حركة الكاميرا (عمق) وتنعم قليلًا، والشخصيات حادة في المقدمة */}
        <g transform={cinema ? `translate(${panX * 0.45} 0) translate(960 ${focusY}) scale(${1 + (zoom - 1) * 0.45}) translate(-960 ${-focusY})` : `translate(${panX} 0) translate(960 ${focusY}) scale(${zoom}) translate(-960 ${-focusY})`} filter={cinema ? "url(#set-dof)" : undefined}>
          {/* المكان، ممتد قليلًا خارج الإطار ليغطي حركة الكاميرا والقص العمودي */}
          <g transform={`translate(960 ${floorY}) scale(1.08) translate(-960 ${-floorY})`}>
            <SetBackdrop id={set} t={t} />
          </g>
        </g>
        <g transform={`translate(${panX} 0) translate(960 ${focusY}) scale(${zoom}) translate(-960 ${-focusY})`} filter={cinema ? "url(#rim)" : undefined}>
          {/* ظل الأرض */}
          {xs.map((x, i) => <ellipse key={i} cx={x} cy={floorY + 4} rx={w * 0.55} ry={16} fill="#000" opacity={night ? 0.35 : 0.12} />)}
          {/* الشخصيات */}
          {[{ v: variant, p: pose, e: enterA, f: fig1, x: (props.expr || "neutral") as FigureExpr }, ...(two ? [{ v: variant2 || "narrator-m", p: pose2, e: enterB, f: fig2, x: (props.expr2 || "neutral") as FigureExpr }] : [])].map((c, i) =>
            c.f ? (
              // الشخصية التاريخية أطول قليلًا (بعمامتها) وتنظر نحو الأخرى
              <g key={i} transform={`translate(${xs[i]! - (h * 1.1 * 200) / 420 / 2} ${floorY - h * 1.1 + (1 - c.e) * 40 + bob(i) * 0.5}) ${two && i === 1 ? `translate(${(h * 1.1 * 200) / 420} 0) scale(-1 1)` : ""}`} opacity={c.e} style={night ? { filter: "brightness(0.85) saturate(0.9)" } : undefined}>
                <HistoricFigure figure={c.f} expr={c.x} pose={figPose(c.p)} height={h * 1.1} frame={frame + i * 37} talking={props.talk === String(i + 1)} />
              </g>
            ) : (
              <g key={i} transform={`translate(${xs[i]! - w / 2} ${floorY - h + (1 - c.e) * 40 + bob(i)}) ${two && i === 1 ? `translate(${w} 0) scale(-1 1)` : ""}`} opacity={c.e} style={{ filter: `${outline}${night ? " brightness(0.82) saturate(0.9)" : ""}` }}>
                <Character theme={castTheme} variant={c.v as CharacterVariant} pose={c.p as CharacterPose} height={h} />
              </g>
            ),
          )}
          {/* عنصر مساعد بجوار الشخصية */}
          {element && hasElement(element) ? (
            <g transform={`translate(${(two ? 960 : xs[0]! + w * 0.9) - 70} ${floorY - 150 - Math.abs(Math.sin(t * 2)) * 6}) scale(${spring({ frame: frame - 20, fps, config: { damping: 12 } })})`}>
              <foreignObject width={140} height={140}><Element id={element} theme={castTheme} size={140} /></foreignObject>
            </g>
          ) : null}
          {/* الفقاعة */}
          {bubble ? (
            <g transform={`translate(${bubbleX} ${by}) scale(${bubbleIn})`} opacity={Math.min(1, bubbleIn * 1.5)}>
              {bubbleKind === "think" ? (
                <>
                  <ellipse cx={bubbleSide * bubbleW * 0.5} cy={-90} rx={bubbleW / 2} ry={78} fill="#fff" stroke={ink} strokeWidth={5} />
                  <circle cx={bubbleSide * 30} cy={-6} r={14} fill="#fff" stroke={ink} strokeWidth={4} />
                  <circle cx={bubbleSide * 8} cy={20} r={8} fill="#fff" stroke={ink} strokeWidth={4} />
                </>
              ) : (
                <path
                  fill="#fff"
                  stroke={ink}
                  strokeWidth={5}
                  strokeLinejoin="round"
                  d={`M${bubbleSide > 0 ? 0 : -bubbleW} -160 h ${bubbleW} a 26 26 0 0 1 26 26 v 92 a 26 26 0 0 1 -26 26 H ${bubbleSide * 60} l ${-bubbleSide * 40} 34 l ${bubbleSide * 6} -34 H ${bubbleSide > 0 ? 0 : -bubbleW} a 26 26 0 0 1 -26 -26 v -92 a 26 26 0 0 1 26 -26 z`}
                />
              )}
              <foreignObject x={bubbleSide > 0 ? 0 : -bubbleW} y={-164} width={bubbleW} height={150}>
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", direction: lang.dir, fontFamily: fontFamilies.heading, fontWeight: 700, fontSize: portrait ? 32 : 44, lineHeight: 1.25, color: ink, padding: "0 18px" }}>{bubble}</div>
              </foreignObject>
            </g>
          ) : null}
        </g>
      </svg>
      {cinema ? (
        <>
          <CinemaLight mood={night ? "night" : "day"} frame={frame} rays={cfg.rays} light={cfg.light} w={W} h={H} />
          {(props.atmos || cfg.atmos) !== "none" ? <Atmosphere kind={props.atmos || cfg.atmos} frame={frame} w={W} h={H} /> : null}
          <FilmGrain frame={frame} w={W} h={H} amount={0.14} />
          {!portrait ? <Letterbox frame={frame} h={H} /> : null}
          <PlaceTitle title={props.title} date={props.date} frame={frame} duration={durationInFrames} top={portrait ? 330 : letterboxHeight(frame, H) + 40} inset={portrait ? 64 : 96} u={H / 1080 > 1.5 ? 1 : H / 1080} portrait={portrait} rtl={lang.dir === "rtl"} />
        </>
      ) : null}
    </SceneShell>
  );
};

export const setSceneSample: Omit<SetSceneProps, "themeId" | "orientation"> = {
  eyebrow: "",
  set: "kitchen",
  variant: "narrator-f",
  pose: "think",
  variant2: "child",
  pose2: "stand",
  camera: "push",
  bubble: "ليش دايمًا أنا؟",
  bubbleKind: "say",
  bubbleWho: "2",
  element: "",
  narration: "في المطبخ، يسأل الطفل أمه سؤالًا يبدو بسيطًا… لكنه يحمل شعورًا كبيرًا بالظلم.",
  captions: false,
};
export const setSceneSampleEn: Omit<SetSceneProps, "themeId" | "orientation"> = { ...setSceneSample, bubble: "Why always me?", narration: "In the kitchen, the child asks a simple question… carrying a big feeling of unfairness." };
export const setSceneSeconds = 6;
