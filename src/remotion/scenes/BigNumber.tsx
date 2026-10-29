import React from "react";
import { Easing, interpolate, useVideoConfig } from "remotion";
import { useMotionSettings, useSize, useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { Element } from "../../../brand/elements/Element";
import { hasElement } from "../../../brand/elements/registry";
import { SceneShell } from "./SceneShell";
import { Digits } from "../../i18n/context";

import { enter, fade, float, useBoil, useSceneFrame } from "./motion";
import type { SceneBase, StringFields } from "./types";

export type BigNumberProps = SceneBase & StringFields<"number" | "caption" | "source" | "element">;

const EAST = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";
const toWestern = (s: string) => s.replace(/[٠-٩۰-۹]/g, (d) => String(EAST.includes(d) ? EAST.indexOf(d) : PERSIAN.indexOf(d)));
const toEastern = (s: string) => s.replace(/[0-9]/g, (d) => EAST[Number(d)] ?? d);

type Parsed = { before: string; after: string; value: number; decimals: number; grouped: boolean } | null;

/** يستخرج أول جزء رقمي من النص (أرقام عربية أو لاتينية، بفواصل آلاف أو كسور). */
const parseNumber = (raw: string): Parsed => {
  const m = raw.match(/[0-9٠-٩۰-۹]+(?:[.,٫٬][0-9٠-٩۰-۹]+)*/);
  if (!m || m.index === undefined) return null;
  const token = toWestern(m[0]);
  const seps = token.match(/[.,٫٬]/g) ?? [];
  let decimals = 0;
  let grouped = false;
  let clean = token;
  if (seps.length) {
    const last = seps[seps.length - 1]!;
    const tail = token.slice(token.lastIndexOf(last) + 1);
    const decimalSep = (last === "." || last === "٫") && (seps.length === 1 || tail.length !== 3);
    if (decimalSep) {
      decimals = tail.length;
      clean = token.slice(0, token.lastIndexOf(last)).replace(/[.,٫٬]/g, "") + "." + tail;
      grouped = seps.length > 1;
    } else {
      clean = token.replace(/[.,٫٬]/g, "");
      grouped = true;
    }
  }
  const value = Number(clean);
  if (!Number.isFinite(value)) return null;
  return { before: raw.slice(0, m.index), after: raw.slice(m.index + m[0].length), value, decimals, grouped };
};

/** يكتب القيمة بأرقام عربية مشرقية (٫ للكسر و٬ للآلاف). */
const formatValue = (v: number, decimals: number, grouped: boolean) => {
  const [int = "0", frac] = v.toFixed(decimals).split(".");
  const intPart = grouped ? int.replace(/\B(?=(\d{3})+(?!\d))/g, "٬") : int;
  return toEastern(frac ? `${intPart}٫${frac}` : intPart);
};

/** بقية النص: الأرقام اللاتينية تصير عربية، و% تصير ٪. */
const easternText = (s: string) => toEastern(s).replace(/%/g, "٪");

/**
 * «الرقم الكبير»: رقم واحد يملأ المشهد. إن كان فيه جزء رقمي يعدّ تصاعديًا حتى قيمته
 * (ويبقى باقي النص كما هو)، ثم نبضة خفيفة عند الوصول، وخط تمييز تحته، ثم الوصف والمصدر.
 * الأرقام تُعرض دائمًا بالأرقام العربية (٠١٢٣).
 */
export const BigNumber: React.FC<BigNumberProps> = (props) => {
  const { themeId, orientation, number = "", caption = "", source = "", element } = props;
  const frame = useSceneFrame();
  const boil = useBoil();
  const motion = useMotionSettings();
  const questionSize = useSize("question", orientation);
  const bubbleSize = useSize("bubble", orientation);
  const refSize = useSize("reference", orientation);
  const { durationInFrames } = useVideoConfig();
  const t = useTheme(themeId);
  const c = t.colors;
  const portrait = orientation === "portrait";
  const ink = t.character.style === "line";
  const el = element && hasElement(element) ? element : null;

  const parsed = parseNumber(number.trim());

  // ـــ التوقيت ـــ
  const numIn = enter(frame, 4, 30, 130);
  const countFrom = 8;
  const countLen = Math.max(18, Math.min(44, Math.round(durationInFrames * 0.25)));
  const countEnd = countFrom + countLen;
  const p = interpolate(frame, [countFrom, countEnd], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const pop = interpolate(frame, [countEnd - 2, countEnd + 5, countEnd + 18], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const barIn = fade(frame, countEnd - 4, 16);
  const capIn = enter(frame, countEnd - 2, 30, 150);
  const srcIn = fade(frame, countEnd + 12, 14);
  const elIn = enter(frame, 0, 30, 120);

  // الجزء الرقمي (مع الرموز الملتصقة به مثل ٪) كبير، والكلمات المجاورة («ساعات»، «أكثر من») أصغر.
  const split = (() => {
    if (!parsed) return { wordsBefore: "", glueBefore: "", glueAfter: "", wordsAfter: "" };
    const b = parsed.before;
    const a = parsed.after;
    const bi = b.search(/\S*$/);
    const ai = a.search(/\s|$/);
    return { wordsBefore: b.slice(0, bi).trim(), glueBefore: b.slice(bi), glueAfter: a.slice(0, ai), wordsAfter: a.slice(ai).trim() };
  })();
  const finalBig = parsed ? easternText(split.glueBefore) + formatValue(parsed.value, parsed.decimals, parsed.grouped) + easternText(split.glueAfter) : easternText(number);
  const liveBig = parsed ? easternText(split.glueBefore) + formatValue(parsed.value * p, parsed.decimals, parsed.grouped) + easternText(split.glueAfter) : finalBig;
  const smallBefore = easternText(split.wordsBefore);
  const smallAfter = easternText(split.wordsAfter);

  // ـــ المقاسات ـــ
  const maxNumW = portrait ? 900 : el ? 1180 : 1500;
  const base = Math.round(questionSize * (portrait ? 3.0 : 2.8));
  const count = (x: string) => [...x].filter((ch) => !/[\u064B-\u0652]/.test(ch)).length;
  const smallRatio = 0.34;
  const units = count(finalBig) * 0.56 + (count(smallBefore) + count(smallAfter)) * 0.46 * smallRatio + (smallBefore ? 0.15 : 0) + (smallAfter ? 0.15 : 0);
  const numSize = Math.round(Math.max(questionSize * 0.9, Math.min(base, maxNumW / Math.max(1, units))));
  const smallSize = Math.round(Math.max(bubbleSize * 0.9, numSize * smallRatio));
  const capSize = Math.round(bubbleSize * (caption.length > 70 ? 0.85 : 1));
  const elSize = portrait ? 220 : 260;

  const smallStyle: React.CSSProperties = { fontSize: smallSize, color: c.ink, whiteSpace: "nowrap", lineHeight: 1.2 };
  const numberBlock = (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "center",
        gap: Math.round(numSize * 0.12),
        fontFamily: fontFamilies.heading,
        fontWeight: 700,
        opacity: numIn,
        transform: `translateY(${(1 - numIn) * 40}px) scale(${(0.9 + 0.1 * numIn) * (1 + 0.04 * pop)})`,
      }}
    >
      {smallBefore ? <span style={smallStyle}><Digits>{smallBefore}</Digits></span> : null}
      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "grid", position: "relative", zIndex: 1, fontSize: numSize, lineHeight: 1.1, color: c.primary, whiteSpace: "nowrap", textAlign: "center" }}>
          {/* النص النهائي مخفي ليحجز العرض فلا يهتز الرقم أثناء العدّ */}
          <span style={{ gridArea: "1 / 1", visibility: "hidden" }}><Digits>{finalBig}</Digits></span>
          <span style={{ gridArea: "1 / 1" }}><Digits>{liveBig}</Digits></span>
        </div>
        <div
          style={{
            height: Math.max(10, Math.round(numSize * 0.07)),
            width: "86%",
            minWidth: 120,
            marginTop: Math.round(numSize * -0.08),
            borderRadius: 999,
            background: c.highlight,
            border: ink ? `2.5px solid ${c.ink}` : "none",
            transformOrigin: "50% 50%",
            transform: `scaleX(${barIn}) ${ink ? boil(frame, 7, 0.3) : ""}`,
          }}
        />
      </div>
      {smallAfter ? <span style={smallStyle}><Digits>{smallAfter}</Digits></span> : null}
    </div>
  );

  const elementBlock = el ? (
    <div style={{ flexShrink: 0, opacity: elIn, transform: `translateY(${float(frame, 8 * motion.float) + (1 - elIn) * 30}px) scale(${0.6 + 0.4 * elIn}) ${ink ? boil(frame, 3) : ""}` }}>
      <Element id={el} theme={t} size={elSize} />
    </div>
  ) : null;

  const text = (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: portrait ? 30 : 22 }}>
      {caption ? (
        <div
          style={{
            fontFamily: fontFamilies.heading,
            fontWeight: 700,
            fontSize: capSize,
            lineHeight: 1.4,
            color: c.ink,
            textAlign: "center",
            maxWidth: portrait ? 920 : 1320,
            textWrap: "balance",
            opacity: capIn,
            transform: `translateY(${(1 - capIn) * 24}px)`,
          }}
        >
          <Digits>{easternText(caption)}</Digits>
        </div>
      ) : null}
      {source ? (
        <div style={{ display: "flex", alignItems: "center", gap: 14, opacity: srcIn, maxWidth: portrait ? 900 : 1200 }}>
          <div style={{ width: 36, height: 2, background: c.inkSoft, opacity: 0.45, flexShrink: 0 }} />
          <div style={{ fontFamily: fontFamilies.body, fontWeight: 500, fontSize: Math.round(refSize * 0.75), color: c.inkSoft, textAlign: "center" }}><Digits>{easternText(source)}</Digits></div>
          <div style={{ width: 36, height: 2, background: c.inkSoft, opacity: 0.45, flexShrink: 0 }} />
        </div>
      ) : null}
    </div>
  );

  return (
    <SceneShell {...props} durationInFrames={durationInFrames}>
      <div
        style={{
          position: "absolute",
          top: portrait ? 330 : 130,
          bottom: portrait ? 580 : 180,
          left: portrait ? 60 : 120,
          right: portrait ? 60 : 120,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: portrait ? 34 : 30,
        }}
      >
        {portrait ? (
          <>
            {elementBlock}
            {numberBlock}
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 56 }}>
            {elementBlock}
            {numberBlock}
          </div>
        )}
        {text}
      </div>
    </SceneShell>
  );
};

/** محتوى تجريبي لمعاينة القالب. */
export const bigNumberSample: Omit<BigNumberProps, "themeId" | "orientation"> = {
  eyebrow: "الفصل 2 · من أين يأتي التأجيل؟",
  number: "٢٠٪",
  caption: "من الناس يصفون أنفسهم بأنهم مؤجّلون مزمنون",
  source: "رقم توضيحي للمعاينة",
  element: "hourglass-patience",
  narration: "واحد من كل خمسة أشخاص يصف نفسه بأنه مؤجّل مزمن.",
};
/** English preview content (digits and % come out Western via <Digits>). */
export const bigNumberSampleEn: Omit<BigNumberProps, "themeId" | "orientation"> = {
  eyebrow: "Chapter 2 · Where does procrastination come from?",
  number: "20%",
  caption: "of people describe themselves as chronic procrastinators",
  source: "Illustrative figure for preview",
  element: "hourglass-patience",
  narration: "One in five people describes themselves as a chronic procrastinator.",
};
export const bigNumberSeconds = 6;
