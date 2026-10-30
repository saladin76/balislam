import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { Element } from "../../../brand/elements/Element";
import { hasElement } from "../../../brand/elements/registry";
import { SceneShell } from "./SceneShell";
import { useLang } from "../../i18n/context";
import { estimateTimings, splitWords, type WordTiming } from "./timing";
import type { SceneBase, StringFields } from "./types";

/**
 * «النص الحركي»: الكلام نفسه هو الصورة. كلمات التعليق تظهر كبيرة في منتصف الشاشة
 * على إيقاع الصوت (دفعات من كلمتين أو ثلاث)، والكلمات المهمة أكبر وبلون التمييز.
 * لا شريط ترجمة في هذا القالب لأنه هو الترجمة.
 */
export type KineticTextProps = SceneBase & StringFields<"emphasis" | "element" | "stage">;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const bare = (w: string) => w.replace(/[«»"“”'؟?!.,،:؛…]/g, "");

/** يقسم الكلمات إلى دفعات: تنتهي الدفعة عند علامة ترقيم أو بعد 3 كلمات. */
const chunksOf = (timings: WordTiming[]) => {
  const out: WordTiming[][] = [];
  let cur: WordTiming[] = [];
  for (const w of timings) {
    cur.push(w);
    if (cur.length >= 3 || /[.،,؟?!؛:…]$/.test(w.word)) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
};

export const KineticText: React.FC<KineticTextProps> = (props) => {
  const { orientation, narration = "", narrationTimings, emphasis = "", element, stage = "theme" } = props;
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const lang = useLang();
  const portrait = orientation === "portrait";
  const dark = stage === "dark";
  const t = useTheme(dark ? "night" : props.themeId);
  const c = t.colors;

  const timings = narration ? (narrationTimings ?? estimateTimings(narration, 6, durationInFrames - 12)) : [];
  const chunks = chunksOf(timings);
  const strong = new Set(splitWords(emphasis.replace(/[،,]/g, " ")).map(bare).filter(Boolean));
  const active = chunks.findIndex((ch, i) => frame >= (ch[0]?.start ?? 0) && frame < (chunks[i + 1]?.[0]?.start ?? Infinity));
  const chunk = chunks[Math.max(0, active)] ?? [];

  const base = portrait ? 150 : 150;
  const icon = element && hasElement(element);
  const iconIn = spring({ frame: frame - 2, fps, config: { damping: 16, stiffness: 120 } });

  return (
    <SceneShell {...props} themeId={dark ? "night" : props.themeId} captions={false} durationInFrames={durationInFrames}>
      {icon ? (
        <div style={{ position: "absolute", left: "50%", top: portrait ? 470 : 150, transform: `translateX(-50%) scale(${0.7 + 0.3 * iconIn})`, opacity: iconIn * 0.95 }}>
          <Element id={element!} theme={t} size={portrait ? 260 : 210} />
        </div>
      ) : null}
      <div
        style={{
          position: "absolute",
          left: portrait ? 60 : 140,
          right: portrait ? 60 : 140,
          top: portrait ? (icon ? 760 : 560) : icon ? 380 : 220,
          bottom: portrait ? 560 : 160,
          display: "flex",
          flexWrap: "wrap",
          alignContent: "center",
          justifyContent: "center",
          gap: portrait ? "6px 30px" : "4px 36px",
          direction: lang.dir,
        }}
      >
        {chunk.map((w, i) => {
          const s = spring({ frame: frame - w.start + 2, fps, config: { damping: 14, stiffness: 190, mass: 0.7 } });
          const isStrong = strong.has(bare(w.word));
          const said = frame >= w.start;
          const size = Math.round(base * (isStrong ? 1.22 : 1) * (chunk.length === 3 && portrait ? 0.86 : 1));
          return (
            <span
              key={`${active}-${i}`}
              style={{
                display: "inline-block",
                position: "relative",
                fontFamily: fontFamilies.heading,
                fontWeight: 700,
                fontSize: size,
                lineHeight: 1.25,
                color: isStrong ? (dark ? c.highlight : c.primary) : c.ink,
                opacity: said ? interpolate(s, [0, 0.4], [0, 1], clamp) : 0.12,
                transform: `translateY(${(1 - s) * 50}px) scale(${0.8 + 0.2 * s})`,
                textShadow: isStrong && dark ? `0 0 26px ${c.highlight}66` : undefined,
              }}
            >
              {w.word}
              {isStrong ? (
                <span
                  style={{
                    position: "absolute",
                    insetInlineStart: 0,
                    bottom: "0.02em",
                    height: "0.14em",
                    width: `${interpolate(frame - w.start, [2, 12], [0, 100], clamp)}%`,
                    background: dark ? c.highlight : c.highlight,
                    borderRadius: 999,
                    zIndex: -1,
                    opacity: 0.85,
                  }}
                />
              ) : null}
            </span>
          );
        })}
      </div>
    </SceneShell>
  );
};

export const kineticTextSample: Omit<KineticTextProps, "themeId" | "orientation"> = {
  eyebrow: "الفصل 3 · السبب الأعمق",
  narration: "حين نؤجّل، نشتري راحة قصيرة بثمن طويل. والقلق لا يختفي، بل يكبر كل يوم.",
  emphasis: "راحة، طويل، يكبر",
  element: "",
  stage: "theme",
};
export const kineticTextSampleEn: Omit<KineticTextProps, "themeId" | "orientation"> = {
  eyebrow: "Chapter 3 · The deeper cause",
  narration: "When we delay, we buy short comfort at a long price. The worry doesn't vanish; it grows every day.",
  emphasis: "comfort, long, grows",
  element: "",
  stage: "dark",
};
export const kineticTextSeconds = 8;
