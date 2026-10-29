import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { themes } from "../../../brand/themes";
import { fontFamilies } from "../../../brand/fonts";
import { Character } from "../../../characters/Character";
import { Element } from "../../../brand/elements/Element";
import { SceneShell } from "./SceneShell";
import { boil, enter, float } from "./motion";
import { splitWords } from "./timing";
import type { CharacterTalkProps } from "./types";

/**
 * «حوار الشخصية»: شخصية بلا ملامح تتكلم، وفقاعة كلام تُكتب كلماتها تباعًا،
 * وعنصر رمزي يظهر بجوارها. الشخصية تتنفس (حركة خفيفة) طوال المشهد.
 */
export const CharacterTalk: React.FC<CharacterTalkProps> = (props) => {
  const { themeId, orientation, variant, pose, line: said, element, side = "right" } = props;
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = themes[themeId];
  const c = t.colors;
  const portrait = orientation === "portrait";
  const ink = t.character.style === "line";

  const charIn = enter(frame, 0, 30, 110);
  const bubbleIn = enter(frame, 10, 30, 150);
  const propIn = enter(frame, 22, 30, 160);
  const breathe = 1 + Math.sin(frame / 14) * 0.006;
  const words = splitWords(said);

  const charH = portrait ? 800 : 820;
  const fromSide = side === "right" ? 1 : -1;

  const bubble = (
    <div
      style={{
        position: "relative",
        background: c.surface,
        border: ink ? `3px solid ${c.ink}` : "none",
        boxShadow: ink ? "none" : `0 16px 40px rgba(0,0,0,${themeId === "night" ? 0.3 : 0.08})`,
        borderRadius: 36,
        padding: portrait ? "40px 52px" : "40px 56px",
        maxWidth: portrait ? 900 : 860,
        opacity: bubbleIn,
        transform: `scale(${0.85 + 0.15 * bubbleIn})`,
        transformOrigin: portrait ? "50% 100%" : side === "right" ? "100% 80%" : "0% 80%",
        fontFamily: fontFamilies.heading,
        fontWeight: 700,
        fontSize: portrait ? 68 : 64,
        lineHeight: 1.45,
        display: "flex",
        flexWrap: "wrap",
        gap: "0 18px",
      }}
    >
      {words.map((w, i) => {
        const a = enter(frame, 16 + i * 4, 30, 180);
        return (
          <span key={i} style={{ opacity: a, transform: `translateY(${(1 - a) * 14}px)`, display: "inline-block" }}>
            {w}
          </span>
        );
      })}
      <svg
        width={60}
        height={50}
        viewBox="0 0 60 50"
        style={{
          position: "absolute",
          ...(portrait
            ? { bottom: -46, left: "50%", transform: "translateX(-50%)" }
            : side === "right"
              ? { right: -44, bottom: 60, transform: "rotate(-90deg)" }
              : { left: -44, bottom: 60, transform: "rotate(90deg)" }),
        }}
      >
        <path d="M4 0 L30 46 L56 0" fill={c.surface} stroke={ink ? c.ink : "none"} strokeWidth={3} strokeLinejoin="round" />
        <rect x={0} y={-6} width={60} height={9} fill={c.surface} />
      </svg>
    </div>
  );

  const figure = (
    <div
      style={{
        transform: `translateX(${(1 - charIn) * 160 * fromSide}px) scale(${breathe}) ${ink ? boil(frame, 3, 0.4) : ""}`,
        transformOrigin: "50% 100%",
        opacity: charIn,
      }}
    >
      <Character theme={t} variant={variant} pose={pose} height={charH} />
    </div>
  );

  const prop = element ? (
    <div style={{ opacity: propIn, transform: `translateY(${float(frame, 7, 80) + (1 - propIn) * 30}px) scale(${propIn}) ${ink ? boil(frame, 5) : ""}` }}>
      <Element id={element} theme={t} size={portrait ? 200 : 180} />
    </div>
  ) : null;

  if (portrait) {
    return (
      <SceneShell {...props} durationInFrames={durationInFrames}>
        <div style={{ position: "absolute", top: 360, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
          {bubble}
        </div>
        <div style={{ position: "absolute", bottom: 590, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 10 }}>
          <div style={{ marginBottom: 420 }}>{prop}</div>
          {figure}
        </div>
      </SceneShell>
    );
  }

  const sideKey = side === "right" ? "right" : "left";
  return (
    <SceneShell {...props} durationInFrames={durationInFrames}>
      <div style={{ position: "absolute", bottom: 0, [sideKey]: 100 }}>{figure}</div>
      <div
        style={{
          position: "absolute",
          top: 210,
          [sideKey]: 100 + (charH * 160) / 300 + 60,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 40,
        }}
      >
        {bubble}
        <div style={{ alignSelf: side === "right" ? "flex-end" : "flex-start" }}>{prop}</div>
      </div>
    </SceneShell>
  );
};
