import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { themes } from "../../../brand/themes";
import { fontFamilies } from "../../../brand/fonts";
import { Element } from "../../../brand/elements/Element";
import { SceneShell } from "./SceneShell";
import { boil, enter, fade, float } from "./motion";
import { splitWords } from "./timing";
import type { BigQuestionProps } from "./types";

/**
 * «السؤال الكبير»: افتتاح الفصل بسؤال واحد بخط كبير.
 * الرمز يظهر أولًا، ثم تُكتب الكلمات تباعًا، ثم يمر قلم التمييز على العبارة المهمة.
 */
export const BigQuestion: React.FC<BigQuestionProps> = (props) => {
  const { themeId, orientation, question, highlight, element = "question-mark" } = props;
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = themes[themeId];
  const portrait = orientation === "portrait";
  const line = t.character.style === "line";

  const words = splitWords(question);
  const hl = highlight ? splitWords(highlight) : [];
  const bare = (w: string | undefined) => (w ?? "").replace(/[؟?!.,،:؛…]/g, "");
  const hlStart = hl.length ? words.findIndex((_, i) => hl.every((h, j) => bare(words[i + j]) === bare(h))) : -1;
  const isHl = (i: number) => hlStart >= 0 && i >= hlStart && i < hlStart + hl.length;
  /** العبارة المميزة تُجمع في كتلة واحدة ليمر عليها قلم التمييز مرة واحدة. */
  const groups: { highlight: boolean; items: { w: string; i: number }[] }[] = [];
  words.forEach((w, i) => {
    const h = isHl(i);
    const last = groups[groups.length - 1];
    if (last && last.highlight && h) last.items.push({ w, i });
    else groups.push({ highlight: h, items: [{ w, i }] });
  });

  const iconIn = enter(frame, 0, 30, 140);
  const wordsFrom = 12;
  const perWord = 5;
  const wordsDone = wordsFrom + words.length * perWord;
  const marker = fade(frame, wordsDone + 4, 14);

  return (
    <SceneShell {...props} durationInFrames={durationInFrames}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: portrait ? 56 : 40,
          padding: portrait ? "0 80px 360px" : "0 160px 60px",
        }}
      >
        <div
          style={{
            transform: `translateY(${float(frame, 8) + (1 - iconIn) * 40}px) scale(${0.6 + 0.4 * iconIn}) ${line ? boil(frame, 1) : ""}`,
            opacity: iconIn,
          }}
        >
          <Element id={element} theme={t} size={portrait ? 280 : 250} />
        </div>
        <div
          style={{
            fontFamily: fontFamilies.heading,
            fontWeight: 700,
            fontSize: portrait ? 108 : 132,
            lineHeight: 1.35,
            textAlign: "center",
            maxWidth: portrait ? 920 : 1560,
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: portrait ? "0 26px" : "0 24px",
          }}
        >
          {groups.map((g, gi) => {
            const hlOn = g.highlight;
            const span = (
              <>
                {g.items.map(({ w, i }) => {
                  const a = enter(frame, wordsFrom + i * perWord, 30, 170);
                  return (
                    <span key={i} style={{ position: "relative", zIndex: 1, display: "inline-block", opacity: a, transform: `translateY(${(1 - a) * 26}px)`, color: hlOn && marker > 0.6 ? t.colors.onHighlight : t.colors.ink }}>
                      {w}
                    </span>
                  );
                })}
              </>
            );
            if (!hlOn) return <React.Fragment key={gi}>{span}</React.Fragment>;
            return (
              <span key={gi} style={{ position: "relative", display: "inline-flex", flexWrap: "wrap", justifyContent: "center", gap: "inherit" }}>
                <span
                  style={{
                    position: "absolute",
                    right: -18,
                    left: -18,
                    top: "6%",
                    bottom: "2%",
                    background: t.colors.highlight,
                    borderRadius: 18,
                    transformOrigin: "right center",
                    transform: `scaleX(${marker}) ${line ? boil(frame, 7, 0.3) : ""}`,
                  }}
                />
                {span}
              </span>
            );
          })}
        </div>
      </div>
    </SceneShell>
  );
};
