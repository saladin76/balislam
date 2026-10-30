import React from "react";
import { interpolate, useVideoConfig } from "remotion";
import { useMotionSettings, usePalette, useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { Element } from "../../../brand/elements/Element";
import { hasElement } from "../../../brand/elements/registry";
import type { ElementPalette } from "../../../brand/elements/types";
import type { Theme } from "../../../brand/themes";
import { Character, type CharacterPose, type CharacterVariant } from "../../../characters/Character";
import { SceneShell } from "./SceneShell";
import { useLang } from "../../i18n/context";
import { enter, fade, float, useSceneFrame } from "./motion";
import { splitWords } from "./timing";
import type { SceneBase, StringFields } from "./types";

/**
 * «القصة المضيئة»: مسرح ليلي، الأشياء مرسومة بخطوط فاتحة رفيعة، والشيء الذي يتمناه
 * صاحب المشهد يتوهج بالذهبي ويصله به خط منقّط. الجملة في الأعلى تُكتب حرفًا حرفًا.
 * يصلح لقصص الأمنيات والمقارنة والقناعة: كل مشهد «لقطة» من القصة.
 */
export type GlowStoryProps = SceneBase &
  StringFields<"quote" | "highlight" | "subjectElement" | "variant" | "pose" | "wish" | "sideElement" | "sideGlow" | "connector">;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** ألوان الإشارات الضوئية (دلالية: أحمر انتظار، أخضر انطلاق). */
const SIGNAL: Record<string, string> = { red: "#E5534B", green: "#4FC08D" };

/** لوحة «خطوط مضيئة»: كل الحدود والتفاصيل بلون واحد، والتعبئة بلون المسرح. */
const neonPalette = (base: ElementPalette, stage: string, color: string): ElementPalette => ({
  ...base,
  style: "line",
  stroke: color,
  sw: 2.6,
  line: color,
  lw: 2,
  edge: color,
  main: stage,
  second: stage,
  accent: color,
  light: stage,
  dark: stage,
  skin: stage,
  metal: stage,
  wood: stage,
  green: stage,
  water: stage,
  shadow: "transparent",
  bg: stage,
  surface: stage,
  ink: color,
});

/** شخصية بخطوط فاتحة على المسرح الداكن. */
const neonCharacterTheme = (t: Theme, stage: string, color: string): Theme => ({
  ...t,
  colors: { ...t.colors, surface: stage },
  character: { ...t.character, style: "line", outline: color, skin: [stage, stage], garments: [stage, stage, stage, stage, stage], cap: color },
});

export const GlowStory: React.FC<GlowStoryProps> = (props) => {
  const { orientation, quote = "", highlight = "", subjectElement, wish = "car", sideElement, sideGlow = "none", connector = "dotted" } = props;
  const frame = useSceneFrame();
  const motion = useMotionSettings();
  const { width: W, height: H, durationInFrames } = useVideoConfig();
  const lang = useLang();
  const rtl = lang.dir === "rtl";
  const portrait = orientation === "portrait";

  // المسرح دائمًا ليلي من ألوان ثيم «ليلٌ هادئ» في هوية القناة
  const night = useTheme("night");
  const nightPal = usePalette("night");
  const stage = night.colors.bg;
  const lineColor = night.colors.ink;
  const gold = night.colors.highlight;
  const whitePal = neonPalette(nightPal, stage, lineColor);
  const goldPal = neonPalette(nightPal, stage, gold);

  // المواضع (تنعكس في العربية: صاحب المشهد في بداية السطر)
  const X = (fraction: number) => (rtl ? W * (1 - fraction) : W * fraction);
  const floorY = portrait ? 1230 : 880;
  const subjectX = X(portrait ? 0.32 : 0.3);
  const sideX = X(portrait ? 0.82 : 0.8);
  const wishCx = X(portrait ? 0.6 : 0.6);
  const wishCy = portrait ? 650 : 385;
  const wishSize = portrait ? 360 : 280;
  const useChar = !subjectElement || !hasElement(subjectElement);
  const charH = portrait ? 540 : 440;
  const subjSize = portrait ? 440 : 380;
  const sideSize = portrait ? 400 : 360;
  const anchor = { x: subjectX, y: useChar ? floorY - charH * 0.86 : floorY - subjSize * 0.55 };
  const wishBottom = { x: wishCx, y: wishCy + wishSize * 0.3 };

  // التوقيت
  const charsPerFrame = 1 / 1.5;
  const chars = Array.from(quote);
  const typeFrom = 10;
  const typeEnd = typeFrom + chars.length / charsPerFrame;
  const subjectIn = enter(frame, 0, 30, 90);
  const sideIn = enter(frame, 6, 30, 110);
  const wishAt = Math.min(typeEnd + 4, 70);
  const wishIn = enter(frame, wishAt, 30, 110);
  const glow = fade(frame, wishAt, 24) * (0.85 + 0.15 * Math.sin(frame / 9));
  const lineT = interpolate(frame, [wishAt + 8, wishAt + 34], [0, 1], clamp);
  const drift = interpolate(frame, [0, durationInFrames], [0, 1], clamp);
  const stageIn = fade(frame, 0, 14);

  // الجملة: مقاطع عادية/مميزة، ثم قصّها حسب عدد الحروف المكتوبة
  const hlWords = splitWords(highlight);
  const words = splitWords(quote);
  const bare = (w?: string) => (w ?? "").replace(/[«»"“”'؟?!.,،:؛…]/g, "");
  const hlStart = hlWords.length ? words.findIndex((_, i) => hlWords.every((h, j) => bare(words[i + j]) === bare(h))) : -1;
  const typed = Math.max(0, Math.floor((frame - typeFrom) * charsPerFrame));
  let budget = typed;
  const segs = words.map((w, i) => {
    const text = (i ? " " : "") + w;
    const n = Array.from(text).length;
    const shown = Array.from(text).slice(0, Math.max(0, budget)).join("");
    budget -= n;
    return { shown, hl: hlStart >= 0 && i >= hlStart && i < hlStart + hlWords.length };
  });
  const typing = typed < chars.length;
  const cursorOn = (typing || frame < typeEnd + 24) && Math.floor(frame / 8) % 2 === 0;
  const latin = !rtl;
  const quoteSize = Math.round((portrait ? 62 : 58) * (chars.length > 46 ? Math.max(0.7, Math.sqrt(46 / chars.length)) : 1));

  const signal = SIGNAL[sideGlow] ?? (sideGlow === "gold" ? gold : null);
  /** موضع الوهج: المصباح العلوي/السفلي لإشارة المرور، وإلا أعلى العنصر. */
  const glowY = floorY - sideSize * 0.94 + sideSize * (sideElement === "traffic-light" ? (sideGlow === "green" ? 0.62 : 0.22) : 0.3);
  const glowFilter = (c: string, k: number) => `drop-shadow(0 0 ${6 * k}px ${c}) drop-shadow(0 0 ${18 * k}px ${c}) drop-shadow(0 0 ${36 * k}px ${c}88)`;

  /** صاحب المشهد والعنصر الجانبي (يُرسمان مرتين: الأصل والانعكاس على الأرض). */
  const ground = (reflection: boolean) => (
    <>
      {sideElement && hasElement(sideElement) ? (
        <div style={{ position: "absolute", left: sideX - sideSize / 2, top: floorY - sideSize * 0.94, opacity: sideIn, transform: `translateY(${(1 - sideIn) * 30}px)` }}>
          <Element id={sideElement} theme={night} size={sideSize} palette={whitePal} />
          {/* إشارة المرور: المصباح المضاء بلون الوهج */}
          {sideElement === "traffic-light" && signal && sideGlow !== "gold" ? (
            <svg width={sideSize} height={sideSize} viewBox="0 0 120 120" style={{ position: "absolute", inset: 0, overflow: "visible", filter: `drop-shadow(0 0 8px ${signal})` }}>
              <circle cx={60} cy={sideGlow === "green" ? 74 : 26} r={9.5} fill={signal} />
            </svg>
          ) : null}
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: subjectX - (useChar ? charH * 0.3 : subjSize / 2),
          top: useChar ? floorY - charH : floorY - subjSize * 0.88,
          opacity: subjectIn,
          transform: `translateX(${(1 - subjectIn) * (rtl ? 140 : -140)}px)`,
        }}
      >
        {useChar ? (
          <div style={{ transform: rtl ? undefined : "scaleX(-1)" }}>
            <Character theme={neonCharacterTheme(night, stage, lineColor)} variant={(props.variant || "narrator-m") as CharacterVariant} pose={(props.pose || "think") as CharacterPose} height={charH} />
          </div>
        ) : (
          <Element id={subjectElement!} theme={night} size={subjSize} palette={whitePal} />
        )}
      </div>
      {reflection ? null : null}
    </>
  );

  const tip = { x: anchor.x + (wishBottom.x - anchor.x) * lineT, y: anchor.y + (wishBottom.y - anchor.y) * lineT };

  return (
    <SceneShell {...props} themeId="night" motif={false} durationInFrames={durationInFrames}>
      <div style={{ position: "absolute", inset: 0, opacity: stageIn, transform: `scale(${1 + drift * 0.035})`, transformOrigin: `${rtl ? "60%" : "40%"} 60%` }}>
        {/* وهج الإشارة */}
        {signal && sideElement ? (
          <div
            style={{
              position: "absolute",
              left: sideX - 260,
              top: glowY - 260,
              width: 520,
              height: 520,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${signal}55 0%, ${signal}22 35%, transparent 70%)`,
              opacity: sideIn * (0.8 + 0.2 * Math.sin(frame / 11)),
            }}
          />
        ) : null}

        {/* الأرض والانعكاس */}
        <div style={{ position: "absolute", left: 0, right: 0, top: floorY, height: 2, background: lineColor, opacity: 0.18 }} />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: floorY,
            height: H - floorY,
            overflow: "hidden",
            opacity: 0.22,
            WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 55%)",
            maskImage: "linear-gradient(to bottom, black 0%, transparent 55%)",
          }}
        >
          <div style={{ position: "absolute", left: 0, top: -floorY, width: W, height: H, transform: "scaleY(-1)", transformOrigin: `50% ${floorY}px` }}>{ground(true)}</div>
        </div>
        {ground(false)}

        {/* خط الأمنية */}
        {connector !== "none" && lineT > 0 ? (
          <svg width={W} height={H} style={{ position: "absolute", inset: 0, filter: glowFilter(gold, 0.35) }}>
            <line
              x1={anchor.x}
              y1={anchor.y}
              x2={tip.x}
              y2={tip.y}
              stroke={gold}
              strokeWidth={connector === "beam" ? 6 : 4}
              strokeDasharray={connector === "beam" ? undefined : "2 16"}
              strokeLinecap="round"
              opacity={connector === "beam" ? 0.55 : 0.95}
            />
            <circle cx={anchor.x} cy={anchor.y} r={7} fill={gold} opacity={Math.min(1, lineT * 3)} />
            <circle cx={tip.x} cy={tip.y} r={6} fill={gold} />
          </svg>
        ) : null}

        {/* الأمنية المتوهجة */}
        {hasElement(wish) ? (
          <div
            style={{
              position: "absolute",
              left: wishCx - wishSize / 2,
              top: wishCy - wishSize / 2,
              opacity: wishIn,
              transform: `translateY(${float(frame, 8 * motion.float, 110) + (1 - wishIn) * 24}px) scale(${0.85 + 0.15 * wishIn})`,
              filter: glowFilter(gold, 0.4 + 0.6 * glow),
            }}
          >
            <Element id={wish} theme={night} size={wishSize} palette={goldPal} />
          </div>
        ) : null}
      </div>

      {/* الجملة */}
      {quote ? (
        <div
          style={{
            position: "absolute",
            top: portrait ? 330 : 128,
            left: portrait ? 70 : 160,
            right: portrait ? 70 : 160,
            textAlign: "center",
            direction: lang.dir,
            fontFamily: latin ? fontFamilies.wordmark : fontFamilies.heading,
            fontWeight: latin ? 500 : 600,
            fontSize: latin ? Math.round(quoteSize * 0.82) : quoteSize,
            letterSpacing: latin ? "0.28em" : undefined,
            textTransform: latin ? "uppercase" : undefined,
            wordSpacing: latin ? undefined : "0.12em",
            lineHeight: 1.5,
            color: lineColor,
          }}
        >
          <span style={{ opacity: 0.95 }}>{latin ? "“" : "«"}</span>
          {segs.map((s, i) => (
            <span key={i} style={s.hl ? { color: gold, textShadow: `0 0 18px ${gold}aa` } : undefined}>
              {s.shown}
            </span>
          ))}
          {!typing ? <span>{latin ? "”" : "»"}</span> : null}
          <span style={{ display: "inline-block", width: "0.08em", height: "1em", marginInlineStart: "0.1em", background: gold, verticalAlign: "-0.12em", opacity: cursorOn ? 1 : 0 }} />
        </div>
      ) : null}
    </SceneShell>
  );
};

export const glowStorySample: Omit<GlowStoryProps, "themeId" | "orientation"> = {
  eyebrow: "الفصل 3 · عند الإشارة الحمراء",
  quote: "ليتني أملك سيارة أكبر.",
  highlight: "سيارة أكبر",
  variant: "narrator-m",
  pose: "think",
  wish: "car",
  sideElement: "traffic-light",
  sideGlow: "red",
  connector: "dotted",
  narration: "عند الإشارة الحمراء، كان كل واحد ينظر إلى ما في يد غيره.",
};
export const glowStorySampleEn: Omit<GlowStoryProps, "themeId" | "orientation"> = {
  eyebrow: "Chapter 3 · At the red light",
  quote: "I wish I had a bigger car.",
  highlight: "bigger car",
  variant: "narrator-m",
  pose: "think",
  wish: "car",
  sideElement: "traffic-light",
  sideGlow: "red",
  connector: "dotted",
  narration: "At the red light, everyone was looking at what someone else had.",
};
export const glowStorySeconds = 6;
