import React from "react";
import { interpolate, useVideoConfig } from "remotion";
import { usePalette, useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { Element } from "../../../brand/elements/Element";
import { hasElement } from "../../../brand/elements/registry";
import type { Theme } from "../../../brand/themes";
import { Character, type CharacterPose, type CharacterVariant } from "../../../characters/Character";
import { SceneShell } from "./SceneShell";
import { useLang } from "../../i18n/context";
import { enter, fade, useSceneFrame } from "./motion";
import type { SceneBase, StringFields } from "./types";

/**
 * «المحاكاة»: مسرح مظلم تحت بقعة ضوء، شخصية بيضاء في الوسط داخل بيئة (رفوف، حظيرة، ورشة…)،
 * ولوحة تحكم كأنها لعبة: المكان، ومؤشر يمتلئ (ريحة العطر 0% → 100%)، وعدّاد وقت.
 * يصلح للأمثال والتجارب الذهنية: «لو جلست ساعتين في…».
 */
export type SimStageProps = SceneBase &
  StringFields<"kicker" | "title" | "location" | "meter" | "meterTo" | "timer" | "timerLabel" | "env" | "envLayout" | "badge" | "tone" | "aura" | "pose" | "variant">;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** «02:00» → ثوانٍ */
const toSeconds = (t: string) => {
  const [m = "0", s = "0"] = t.split(":");
  return Number(m) * 60 + Number(s) || 0;
};
const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

export const SimStage: React.FC<SimStageProps> = (props) => {
  const { orientation, kicker = "", title = "", location = "", meter = "", meterTo = "100", timer = "", timerLabel = "", env = "", envLayout = "row", badge = "", tone = "gold", aura = "on" } = props;
  const frame = useSceneFrame();
  const { width: W, height: H, durationInFrames } = useVideoConfig();
  const lang = useLang();
  const rtl = lang.dir === "rtl";
  const portrait = orientation === "portrait";

  const night = useTheme("night");
  const nightPal = usePalette("night");
  const c = night.colors;
  const accent = tone === "green" ? c.secondary : tone === "red" ? "#E5534B" : c.highlight;
  const stage = "#0B0C10";
  const clay = c.ink;
  // شخصية «صلصال» بيضاء بلا خطوط: كل الأجزاء بلون واحد
  const clayTheme: Theme = { ...night, colors: { ...night.colors, surface: clay }, character: { ...night.character, style: "flat", outline: clay, skin: [clay, clay], garments: [clay, clay, clay, clay, clay], cap: clay } };

  // التوقيت
  const titleIn = fade(frame, 0, 14);
  const hudIn = enter(frame, 10, 30, 110);
  const envIn = fade(frame, 4, 18);
  const figIn = enter(frame, 6, 30, 100);
  const runFrom = 26;
  const runTo = Math.max(runFrom + 30, durationInFrames - 24);
  const run = interpolate(frame, [runFrom, runTo], [0, 1], { ...clamp, easing: (t) => 1 - Math.pow(1 - t, 2) });
  const pct = Math.round(run * Math.max(0, Math.min(100, Number(meterTo) || 0)));
  const timerSec = toSeconds(timer);
  const shownTime = mmss(run * timerSec);

  // المواضع
  const floorY = portrait ? 1330 : 900;
  const figH = portrait ? 400 : 380;
  // عموديًا: اللوحة تحت العنوان. أفقيًا: اللوحة في الجانب والشخصية في الوسط تحت البقعة
  const hud = portrait ? { x: 70, y: 620, w: W - 140, h: 310 } : { x: rtl ? 110 : W - 110 - 640, y: 330, w: 640, h: 330 };
  const titleSize = Math.round((portrait ? 92 : 84) * (title.length > 26 ? Math.max(0.7, Math.sqrt(26 / title.length)) : 1));

  /** البيئة حول الشخصية */
  const environment = () => {
    if (!env || !hasElement(env)) return null;
    if (envLayout === "shelves") {
      const s = portrait ? 340 : 300;
      const cols = Math.ceil(W / s) + 1;
      const rows = [floorY - 2 * s * 0.92, floorY - s * 0.92];
      return rows.flatMap((y, r) =>
        Array.from({ length: cols }, (_, i) => (
          <div key={`${r}-${i}`} style={{ position: "absolute", left: i * s - s * 0.2, top: y, opacity: 0.55 }}>
            <Element id={env} theme={night} size={s} />
          </div>
        )),
      );
    }
    if (envLayout === "pen") {
      const fence = hasElement("fence-wood") ? Array.from({ length: Math.ceil(W / 200) + 1 }, (_, i) => (
        <div key={`f${i}`} style={{ position: "absolute", left: i * 200 - 20, top: floorY - 250, opacity: 0.55 }}>
          <Element id="fence-wood" theme={night} size={200} />
        </div>
      )) : [];
      const spots = portrait
        ? [[0.16, -20], [0.34, 30], [0.68, 25], [0.86, -15], [0.24, -120], [0.78, -130]]
        : [[0.25, -10], [0.36, 40], [0.64, 35], [0.75, -5], [0.3, -110], [0.7, -120]];
      const s = portrait ? 200 : 180;
      return [
        ...fence,
        ...spots.map(([fx, dy], i) => (
          <div key={`s${i}`} style={{ position: "absolute", left: W * fx! - s / 2, top: floorY - s * 0.85 + dy!, transform: `scaleX(${i % 2 ? -1 : 1})` }}>
            <Element id={env} theme={night} size={s} palette={{ ...nightPal, shadow: "transparent" }} />
          </div>
        )),
      ];
    }
    const s = portrait ? 220 : 200;
    const n = Math.ceil(W / s);
    return Array.from({ length: n }, (_, i) => (
      <div key={i} style={{ position: "absolute", left: i * s + (W - n * s) / 2, top: floorY - s * 0.92, opacity: 0.85 }}>
        <Element id={env} theme={night} size={s} />
      </div>
    ));
  };

  /** خيوط الرائحة/الدخان تتصاعد حول الشخصية حين يمتلئ المؤشر */
  const wisps = aura !== "off" && run > 0.05
    ? Array.from({ length: 6 }, (_, i) => {
        const x = W / 2 + (i - 2.5) * (portrait ? 46 : 40);
        const t = ((frame + i * 17) % 70) / 70;
        const y = floorY - figH * (0.3 + 0.9 * t);
        return <path key={i} d={`M${x} ${y + 60} q 14 -20 0 -40 q -14 -20 0 -40`} fill="none" stroke={tone === "green" ? "#9C8F7A" : accent} strokeWidth={4} strokeLinecap="round" opacity={(1 - t) * 0.55 * Math.min(1, run * 3)} />;
      })
    : null;

  return (
    <SceneShell {...props} themeId="night" motif={false} background={stage} durationInFrames={durationInFrames}>
      {/* إضاءة: بقعة من الأعلى وظلال جانبية دافئة */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% ${portrait ? 78 : 82}%, ${clay}1f 0%, transparent 38%)` }} />
      <div style={{ position: "absolute", left: W / 2 - (portrait ? 230 : 300), width: portrait ? 460 : 600, top: 0, height: floorY, background: `linear-gradient(to bottom, ${clay}26, ${clay}05)`, clipPath: "polygon(30% 0, 70% 0, 100% 100%, 0 100%)", opacity: 0.8 * envIn }} />
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at ${rtl ? "92%" : "8%"} 45%, ${accent}22, transparent 40%)` }} />

      {/* البيئة والأرض */}
      <div style={{ position: "absolute", inset: 0, opacity: envIn }}>{environment()}</div>
      {/* عتمة حول البقعة حتى تبرز الشخصية */}
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse ${portrait ? "60% 40%" : "35% 60%"} at 50% ${Math.round(((floorY - figH / 2) / H) * 100)}%, transparent 30%, ${stage}b3 100%)` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: floorY, height: H - floorY, background: `linear-gradient(to bottom, ${clay}10, transparent)` }} />
      <div style={{ position: "absolute", left: W / 2 - 150, width: 300, top: floorY - 14, height: 28, borderRadius: "50%", background: `radial-gradient(${clay}55, transparent 70%)` }} />

      {/* الشخصية */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>{wisps}</svg>
      <div style={{ position: "absolute", left: W / 2 - figH * 0.3, top: floorY - figH, opacity: figIn, transform: `translateY(${(1 - figIn) * 30}px)`, filter: `drop-shadow(0 0 18px ${clay}55)` }}>
        <Character theme={clayTheme} variant={(props.variant || "narrator-m") as CharacterVariant} pose={(props.pose || "stand") as CharacterPose} height={figH} />
      </div>

      {/* لوحة التحكم */}
      {location || meter || timer ? (
        <div
          style={{
            position: "absolute",
            left: hud.x,
            top: hud.y,
            width: hud.w,
            height: hud.h,
            borderRadius: 26,
            background: "rgba(255,255,255,0.05)",
            border: "1.5px solid rgba(255,255,255,0.16)",
            boxShadow: "0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12)",
            backdropFilter: "blur(8px)",
            opacity: hudIn,
            transform: `translateY(${(1 - hudIn) * 30}px) scale(${0.97 + 0.03 * hudIn})`,
            direction: lang.dir,
            color: clay,
            fontFamily: fontFamilies.heading,
            padding: portrait ? "26px 34px" : "22px 34px",
            display: "flex",
            flexDirection: "column",
            gap: portrait ? 22 : 16,
          }}
        >
          {location ? (
            <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: portrait ? 34 : 30, fontWeight: 700, opacity: 0.85 }}>
              <span style={{ width: 5, height: "1.1em", background: accent, borderRadius: 3 }} />
              <span style={{ flex: 1 }}>{location}</span>
              {badge ? (
                <span style={{ padding: "4px 26px", border: `2.5px solid ${accent}`, borderRadius: 12, color: accent, fontSize: portrait ? 32 : 28, background: "rgba(0,0,0,0.35)", boxShadow: `0 0 22px ${accent}55`, opacity: 1 }}>{badge}</span>
              ) : null}
            </div>
          ) : null}
          <div style={{ display: "flex", alignItems: "center", gap: 30, flex: 1, flexDirection: portrait ? "row" : "row" }}>
            {meter ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: portrait ? 34 : 30, fontWeight: 700 }}>
                  <span>{meter}</span>
                  <span style={{ fontFamily: fontFamilies.wordmark, direction: "ltr", color: pct > 0 ? accent : clay }}>{pct}%</span>
                </div>
                <div style={{ height: 14, borderRadius: 999, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(${rtl ? "to left" : "to right"}, ${accent}aa, ${accent})`, marginInlineStart: 0, borderRadius: 999, boxShadow: `0 0 18px ${accent}` }} />
                </div>
              </div>
            ) : null}
            {timer ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <svg width={portrait ? 150 : 130} height={portrait ? 150 : 130} viewBox="0 0 100 100">
                  <circle cx={50} cy={50} r={42} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={6} />
                  <circle cx={50} cy={50} r={42} fill="none" stroke={clay} strokeWidth={6} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - Math.max(0.02, run)} transform="rotate(-90 50 50)" />
                  <text x={50} y={57} textAnchor="middle" fill={clay} fontSize={20} fontWeight={700} fontFamily={fontFamilies.wordmark}>{shownTime}</text>
                </svg>
                {timerLabel ? <span style={{ fontSize: portrait ? 28 : 24, opacity: 0.8 }}>{timerLabel}</span> : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* العنوان */}
      {title ? (
        <div style={{ position: "absolute", top: portrait ? 370 : 70, left: 60, right: 60, textAlign: "center", opacity: titleIn, transform: `translateY(${(1 - titleIn) * -16}px)`, direction: lang.dir }}>
          {kicker ? <div style={{ fontFamily: fontFamilies.heading, fontWeight: 700, fontSize: Math.round(titleSize * 0.45), color: clay, opacity: 0.55, marginBottom: 6 }}>{kicker}</div> : null}
          <div style={{ fontFamily: fontFamilies.heading, fontWeight: 800, fontSize: titleSize, lineHeight: 1.25, color: clay, textShadow: "0 6px 30px rgba(0,0,0,0.6)", textWrap: "balance" }}>{title}</div>
        </div>
      ) : null}
    </SceneShell>
  );
};

export const simStageSample: Omit<SimStageProps, "themeId" | "orientation"> = {
  eyebrow: "الفصل 2 · الجليس",
  kicker: "ركّز معي",
  title: "لو مررت على محل عطور،",
  location: "زيارة محل العطور",
  meter: "ريحة العطر",
  meterTo: "100",
  timer: "00:40",
  timerLabel: "دقائق",
  env: "perfume-shelf",
  envLayout: "shelves",
  badge: "عطور",
  tone: "gold",
  aura: "on",
  narration: "طيب لو مررت على محل عطور، ستخرج منه بريح طيبة حتى لو لم تشترِ شيئًا.",
};
export const simStageSampleEn: Omit<SimStageProps, "themeId" | "orientation"> = {
  eyebrow: "Chapter 2 · Company",
  kicker: "Picture this",
  title: "If you sat two hours in a sheep pen,",
  location: "Inside the pen",
  meter: "Sheep smell",
  meterTo: "100",
  timer: "02:00",
  timerLabel: "hours",
  env: "sheep",
  envLayout: "pen",
  badge: "",
  tone: "green",
  aura: "on",
  narration: "If you sat two hours in a sheep pen, you would leave smelling of it.",
};
export const simStageSeconds = 7;
