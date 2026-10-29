import React from "react";
import { useVideoConfig } from "remotion";
import { useMotionSettings, useSize, useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { Element } from "../../../brand/elements/Element";
import { SceneShell } from "./SceneShell";
import { useLang } from "../../i18n/context";
import { enter, fade, float, useBoil, useSceneFrame } from "./motion";
import { splitWords } from "./timing";
import type { BigQuestionProps } from "./types";

/**
 * «السؤال الكبير»: افتتاح الفصل بسؤال واحد بخط كبير.
 * الرمز يظهر أولًا، ثم تُكتب الكلمات تباعًا، ثم يمر قلم التمييز على العبارة المهمة.
 */
export const BigQuestion: React.FC<BigQuestionProps> = (props) => {
  const { themeId, orientation, question, highlight, element = "question-mark" } = props;
  const frame = useSceneFrame();
  const boil = useBoil();
  const motion = useMotionSettings();
  const questionSize = useSize("question", orientation);
  const { durationInFrames } = useVideoConfig();
  const t = useTheme(themeId);
  const portrait = orientation === "portrait";
  const line = t.character.style === "line";
  const rtl = useLang().dir === "rtl";

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
    // كتلة التمييز لا تزيد على 3 كلمات حتى لا تتحول إلى لوح كبير عند التفاف السطر
    if (last && last.highlight && h && last.items.length < 3) last.items.push({ w, i });
    else groups.push({ highlight: h, items: [{ w, i }] });
  });

  // السؤال الطويل يصغر خطه تدريجيًا (فوق 8 كلمات) حتى لا يصطدم بعنوان الفصل والترجمة
  const fit = words.length > 8 ? Math.max(0.6, Math.sqrt(8 / words.length)) : 1;
  const fontPx = Math.round(questionSize * fit);
  const iconPx = Math.round((portrait ? 280 : 250) * (fit < 1 ? Math.max(0.6, fit) : 1));
  const iconIn = enter(frame, 0, 30, 140);
  const wordsFrom = 12;
  const perWord = motion.wordInterval;
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
            transform: `translateY(${float(frame, 8 * motion.float) + (1 - iconIn) * 40}px) scale(${0.6 + 0.4 * iconIn}) ${line ? boil(frame, 1) : ""}`,
            opacity: iconIn,
          }}
        >
          <Element id={element} theme={t} size={iconPx} />
        </div>
        <div
          style={{
            fontFamily: fontFamilies.heading,
            fontWeight: 700,
            fontSize: fontPx,
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
              <span key={gi} style={{ position: "relative", display: "inline-flex", flexWrap: "nowrap", justifyContent: "center", gap: "inherit" }}>
                <span
                  style={{
                    position: "absolute",
                    right: -18,
                    left: -18,
                    top: "6%",
                    bottom: "2%",
                    background: t.colors.highlight,
                    borderRadius: 18,
                    /** قلم التمييز يبدأ من بداية السطر: يمين في العربية، يسار في اللاتينية. */
                    transformOrigin: rtl ? "right center" : "left center",
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
