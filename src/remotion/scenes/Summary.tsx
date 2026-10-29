import React from "react";
import { interpolate, useVideoConfig } from "remotion";
import { useMotionSettings, useSize, useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { Element } from "../../../brand/elements/Element";
import { hasElement } from "../../../brand/elements/registry";
import { SceneShell } from "./SceneShell";
import { enter, fade, float, useBoil, useSceneFrame } from "./motion";
import { splitWords } from "./timing";
import type { SceneBase, StringFields } from "./types";

export type SummaryProps = SceneBase & StringFields<"text" | "element">;

/** حجم الخلاصة حسب عدد كلماتها (مشتق من مقاس السؤال الكبير). */
const sizeFactor = (words: number, portrait: boolean) => {
  if (words <= 6) return portrait ? 0.92 : 0.82;
  if (words <= 10) return portrait ? 0.8 : 0.68;
  if (words <= 16) return portrait ? 0.7 : 0.62;
  return portrait ? 0.6 : 0.54;
};

/** يقسم الكلمات على أقل عدد من السطور بأطوال متقاربة (بالحروف). */
const balanceLines = (words: string[], maxChars: number) => {
  const items = words.map((w, i) => ({ w, i }));
  const total = words.reduce((n, w) => n + w.length + 1, -1);
  const n = Math.max(1, Math.ceil(total / Math.max(8, maxChars)));
  const target = total / n;
  const out: { w: string; i: number }[][] = [[]];
  let len = 0;
  items.forEach((it) => {
    const cur = out[out.length - 1] ?? [];
    const next = len + (cur.length ? 1 : 0) + it.w.length;
    // يُكسر السطر إن كان الكسر أقرب إلى الطول المستهدف من الاستمرار
    if (cur.length && out.length < n && Math.abs(next - target) > Math.abs(len - target)) {
      out.push([it]);
      len = it.w.length;
    } else {
      cur.push(it);
      len = next;
    }
  });
  return out;
};

/**
 * «الخلاصة»: جملة الفصل الأخيرة. الرمز يظهر داخل حلقة تُرسم حوله، ثم شارة «الخلاصة»،
 * ثم تُكتب الكلمات تباعًا، ثم يمر قلم التمييز تحت السطور من اليمين إلى اليسار.
 */
export const Summary: React.FC<SummaryProps> = (props) => {
  const { themeId, orientation, text = "", element } = props;
  const frame = useSceneFrame();
  const boil = useBoil();
  const motion = useMotionSettings();
  const questionSize = useSize("question", orientation);
  const eyebrowSize = useSize("eyebrow", orientation);
  const { durationInFrames } = useVideoConfig();
  const t = useTheme(themeId);
  const c = t.colors;
  const portrait = orientation === "portrait";
  const line = t.character.style === "line";
  const icon = element && hasElement(element) ? element : "lightbulb";

  const words = splitWords(text);
  const fontSize = Math.round(questionSize * sizeFactor(words.length, portrait));

  const ringDraw = fade(frame, 0, 26);
  const iconIn = enter(frame, 6, 30, 140);
  const chipIn = enter(frame, 12, 30, 150);
  const wordsFrom = 18;
  const perWord = motion.wordInterval;
  const wordsDone = wordsFrom + words.length * perWord;
  /** قلم التمييز يمر على الكلمات واحدة بعد أخرى بعد اكتمال الكتابة. */
  const markFrom = wordsDone + 4;
  const markPer = Math.max(2, Math.min(5, Math.round(30 / Math.max(1, words.length))));

  const discSize = portrait ? 300 : 300;
  const iconSize = portrait ? 200 : 196;
  const r = discSize / 2 - 6;
  const circ = 2 * Math.PI * r;

  const iconBlock = (
    <div style={{ position: "relative", width: discSize, height: discSize, flexShrink: 0, transform: `translateY(${float(frame, 6 * motion.float, 100)}px)` }}>
      <div
        style={{
          position: "absolute",
          inset: 16,
          borderRadius: "50%",
          background: line ? "transparent" : c.surface,
          opacity: iconIn,
          transform: `scale(${0.8 + 0.2 * iconIn})`,
          boxShadow: line ? "none" : `0 18px 44px rgba(0,0,0,${themeId === "night" ? 0.3 : 0.07})`,
        }}
      />
      <svg width={discSize} height={discSize} style={{ position: "absolute", inset: 0, overflow: "visible", transform: `rotate(-90deg) ${line ? boil(frame, 4, 0.5) : ""}` }}>
        <circle
          cx={discSize / 2}
          cy={discSize / 2}
          r={r}
          fill="none"
          stroke={line ? c.ink : c.primary}
          strokeWidth={line ? 3.5 : 4}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - ringDraw)}
          opacity={line ? 1 : 0.85}
        />
        <circle cx={discSize / 2} cy={discSize / 2} r={r - 14} fill="none" stroke={line ? c.primary : c.primary} strokeWidth={2} strokeDasharray="2 12" strokeLinecap="round" opacity={0.5 * ringDraw} />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: iconIn,
          transform: `scale(${0.6 + 0.4 * iconIn}) ${line ? boil(frame, 2) : ""}`,
        }}
      >
        <Element id={icon} theme={t} size={iconSize} />
      </div>
    </div>
  );

  const chip = (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 14,
        alignSelf: portrait ? "center" : "flex-start",
        background: line ? c.surface : c.primary,
        border: line ? `3px solid ${c.ink}` : "none",
        color: line ? c.ink : c.bg,
        borderRadius: 999,
        padding: portrait ? "10px 34px 12px" : "8px 30px 10px",
        fontFamily: fontFamilies.heading,
        fontWeight: 700,
        fontSize: Math.round(eyebrowSize * 1.35),
        opacity: chipIn,
        transform: `translateY(${(1 - chipIn) * 16}px) ${line ? boil(frame, 6, 0.4) : ""}`,
      }}
    >
      <svg width={18} height={18} viewBox="0 0 20 20">
        <path d="M10 1 L19 10 L10 19 L1 10 Z" fill={line ? c.primary : c.bg} opacity={line ? 1 : 0.8} />
      </svg>
      الخلاصة
    </div>
  );

  /** تقسيم متوازن للسطور (تقدير عرض الحرف) حتى لا تبقى كلمة يتيمة في السطر الأخير. */
  const textWidth = portrait ? 940 : 1180;
  const lines = balanceLines(words, Math.floor(textWidth / (fontSize * 0.55)));
  const night = themeId === "night";

  const sentence = (
    <div
      style={{
        fontFamily: fontFamilies.heading,
        fontWeight: 700,
        fontSize,
        lineHeight: 1.5,
        display: "flex",
        flexDirection: "column",
        alignItems: portrait ? "center" : "flex-start",
        rowGap: portrait ? 6 : 4,
      }}
    >
      {lines.map((ln, li) => (
        <div key={li} style={{ display: "flex", flexWrap: "wrap", justifyContent: portrait ? "center" : "flex-start" }}>
          {ln.map(({ w, i }, k) => {
            const a = enter(frame, wordsFrom + i * perWord, 30, 170);
            const mk = interpolate(frame, [markFrom + i * markPer, markFrom + i * markPer + markPer + 3], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const first = k === 0;
            const last = k === ln.length - 1;
            const rad = night ? 6 : 10;
            return (
              <span key={i} style={{ position: "relative", display: "inline-block", padding: "0 11px" }}>
                <span
                  style={{
                    position: "absolute",
                    right: first ? 2 : 0,
                    left: last ? 2 : -1,
                    bottom: night ? "13%" : "14%",
                    height: night ? "8%" : "30%",
                    background: c.highlight,
                    opacity: line ? 0.9 : night ? 1 : 0.75,
                    borderRadius: `${last ? rad : 0}px ${first ? rad : 0}px ${first ? rad : 0}px ${last ? rad : 0}px`,
                    transformOrigin: "right center",
                    transform: `scaleX(${mk}) ${line ? boil(frame, 30 + i, 0.25) : ""}`,
                  }}
                />
                <span style={{ position: "relative", display: "inline-block", opacity: a, transform: `translateY(${(1 - a) * 24}px)` }}>{w}</span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <SceneShell {...props} durationInFrames={durationInFrames}>
      {portrait ? (
        <div
          style={{
            position: "absolute",
            top: 330,
            bottom: 600,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 44,
            padding: "0 70px",
          }}
        >
          {iconBlock}
          {chip}
          <div style={{ maxWidth: 940 }}>{sentence}</div>
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 80,
            padding: "120px 120px 200px",
          }}
        >
          {iconBlock}
          <div style={{ display: "flex", flexDirection: "column", gap: 30, maxWidth: 1180, flex: "0 1 auto" }}>
            {chip}
            {sentence}
          </div>
        </div>
      )}
    </SceneShell>
  );
};

/** محتوى تجريبي لمعاينة القالب. */
export const summarySample: Omit<SummaryProps, "themeId" | "orientation"> = {
  eyebrow: "الفصل 6 · الخلاصة",
  text: "التأجيل هروب من شعور، والعلاج خطوة صغيرة تبدأ الآن.",
  element: "lightbulb",
  narration: "التأجيل هروب من شعور، والعلاج خطوة صغيرة تبدأ الآن.",
};
export const summarySeconds = 6;
