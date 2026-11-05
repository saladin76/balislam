import React from "react";
import { Easing, interpolate, useVideoConfig } from "remotion";
import { fontFamilies } from "../../../brand/fonts";
import { SceneShell } from "./SceneShell";
import { useLang } from "../../i18n/context";
import { clamp, seeded, useSceneFrame } from "./motion";
import { estimateTimings, splitWords, type WordTiming } from "./timing";
import type { SceneBase, StringFields } from "./types";

/**
 * «نور وكتابة» (دفاتر الزمن وحدها): لما لا يُصوَّر أبدًا.
 * - light=on: نور فقط مع كتابة (آدم عليه السلام، والملائكة): ضوء ناعم بلا أي هيئة أو شكل، يشتد حين يُنطق الاسم،
 *   وأشعة تدور ببطء وذرات نور تصعد، والاسم يُكتب تحته بخط الأميري.
 * - light=off: فراغ مع كتابة (الجنة، والشجرة…): أفق الغسق والنجوم، والعبارة تُكتب بالحبر وقت نطقها.
 * - light=ink: حبر على صفحة الدفتر (لكل ما ليس غيبًا: الذكر، والانتقال، والخلاصة): رَقّ وخط أفق، والعبارة تُكتب بالحبر البني.
 * النور لغة محدودة: لآدم عليه السلام والملائكة وحدهم، فلا يصير الطابع الغالب على الحلقة.
 * لا رموز ولا رسوم ولا عناصر من المكتبة في هذا القالب أبدًا (توقير، وقاعدة «لا يُرسم ما لا يُصوَّر»).
 */
export type NoorTextProps = SceneBase & StringFields<"text" | "light" | "subtitle">;

/** ألوان «دفتر الأفق» ودرجاتها المشتقة */
const C = { dusk: "#2A1E3F", duskDeep: "#120C1C", sun: "#E07A3F", sand: "#C8A15A", parchment: "#F1E4CB", glow: "#FFE9C2", ink: "#4A2E1F", paperDeep: "#E6D3B0" } as const;

const stem = (w: string) =>
  w
    .replace(/[ً-ْٰـ؟?!.,،:؛«»"()]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة$/, "ه")
    .replace(/^(وال|فال|بال|لل|ال|و|ف|ل|ب)(?=...)/, "");

/** لحظة نطق النص: أول كلمة منه تُنطق في التعليق (وإلا بعد بداية المشهد بقليل) */
export const spokenAt = (text: string, timings: WordTiming[], fallback: number) => {
  const keys = splitWords(text).map(stem).filter((k) => k.length >= 3);
  const hit = timings.find((w) => {
    const s = stem(w.word);
    return s.length >= 3 && keys.some((k) => k === s || (k.length >= 4 && s.length >= 4 && (k.startsWith(s) || s.startsWith(k))));
  });
  return hit ? hit.start : fallback;
};

export const NoorText: React.FC<NoorTextProps> = (props) => {
  const { orientation, light = "on", subtitle = "" } = props;
  // بلا كتابة محددة: تُكتب جملة التعليق نفسها كلمة كلمة وقت نطقها
  const writesNarration = !(props.text ?? "").trim();
  const text = (props.text ?? "").trim() || (props.narration ?? "").replace(/[.،,؛:!؟?«»]/g, "").trim();
  const frame = useSceneFrame();
  const { durationInFrames, width: W, height: H } = useVideoConfig();
  const portrait = orientation === "portrait";
  const rtl = useLang().dir === "rtl";
  const ink = light === "ink";
  const on = light !== "off" && !ink;
  const timings = props.narration ? (props.narrationTimings ?? estimateTimings(props.narration, 6, durationInFrames - 12)) : [];
  const at = Math.min(durationInFrames - 30, spokenAt(text, timings, 18));
  // كل كلمة من الكتابة تظهر وقت نطقها (ما لا يُنطق يظهر بعد سابقتها بقليل)
  const words = splitWords(text);
  const wordAt: number[] = [];
  {
    let cursor = 0;
    let prev = Math.max(6, at - 8);
    for (const w of words) {
      const k = stem(w);
      let hit: number | undefined;
      for (let i = cursor; i < timings.length; i++) {
        const sw = stem(timings[i]!.word);
        if (k.length >= 2 && (sw === k || (k.length >= 4 && sw.length >= 4 && (sw.startsWith(k) || k.startsWith(sw))))) {
          hit = timings[i]!.start;
          cursor = i + 1;
          break;
        }
      }
      prev = Math.max(prev + 4, hit ?? prev + 10);
      wordAt.push(Math.min(durationInFrames - 20, prev));
    }
  }
  const lastWord = wordAt[wordAt.length - 1] ?? at;
  const u = H / 1080;

  // الكتابة: تنكشف بالحبر من جانب البداية خلال ثانية تقريبًا وقت النطق
  const write = interpolate(frame, [at - 4, lastWord + 16], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const wIn = (i: number) => interpolate(frame, [(wordAt[i] ?? at) - 4, (wordAt[i] ?? at) + 10], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  // السطر الفرعي يظهر لحظة نطق كلماته إن نُطقت (وإلا بعد آخر كلمة من الكتابة)
  const subAt = Math.min(durationInFrames - 24, Math.max(lastWord + 18, subtitle ? spokenAt(subtitle, timings, lastWord + 18) - 4 : 0));
  const subIn = interpolate(frame, [subAt, subAt + 16], [0, 1], clamp);

  // النور: يتنفس ويشتد عند نطق الاسم ثم يهدأ قليلًا ويبقى، والكاميرا تقترب ببطء
  // النور يبزغ من العدم في أول المشهد، ويشتد عند نطق الاسم، ثم يبقى هادئًا
  const dawn = interpolate(frame, [0, 30], [0.15, 0.7], { ...clamp, easing: Easing.out(Easing.cubic) });
  const swell = dawn * interpolate(frame, [at - 10, at + 18, at + 60], [1, 1.6, 1.4], clamp);
  // النور يتجاوب مع الكلام: يتوهج قليلًا مع بداية كل كلمة منطوقة ثم يهدأ
  const speak = timings.reduce((acc, w) => acc + 0.22 * interpolate(frame - w.start, [0, 4, 16], [0, 1, 0], clamp), 0);
  const breathe = 1 + 0.04 * Math.sin(frame / 14) + Math.min(0.3, speak);
  const cam = interpolate(frame, [0, durationInFrames], [1, 1.08], { ...clamp, easing: Easing.inOut(Easing.sin) });
  const cx = W / 2;
  const cy = on ? H * (portrait ? 0.4 : 0.38) : H * 0.62;
  const R = (portrait ? 560 : 460) * u;

  // ذرات نور تصعد (في النور) أو نجوم تومض (في الفراغ)
  const motes = Array.from({ length: ink ? 0 : on ? 14 : 50 }, (_, i) => {
    const r1 = seeded(i * 3.1);
    const r2 = seeded(i * 7.7);
    const r3 = seeded(i * 1.9);
    if (on) {
      const life = 70 + r3 * 70;
      const t = ((frame + r1 * life) % life) / life;
      const ang = r2 * Math.PI * 2;
      const dist = (0.15 + r1 * 0.85) * R * 0.9;
      return { x: cx + Math.cos(ang) * dist, y: cy + Math.sin(ang) * dist * 0.7 - t * 240 * u, r: (2 + r3 * 4) * u, o: Math.sin(t * Math.PI) * 0.9 };
    }
    return { x: r1 * W, y: r2 * H * 0.6, r: (1 + r3 * 2.2) * u, o: 0.35 + 0.65 * Math.abs(Math.sin(frame / (9 + r3 * 14) + i)) };
  });

  const fontPx = Math.round((portrait ? 120 : on ? 112 : 128) * u * (text.length > 26 ? Math.max(0.72, Math.sqrt(26 / text.length)) : 1));
  const captionsShown = !writesNarration && props.captions !== false;
  // مع سطر فرعي وشريط الترجمة: ترتفع الكتابة حتى لا يغطي الشريطُ السطرَ الفرعي
  const textTop = on ? (subtitle && captionsShown ? Math.min(cy + R * 0.62, H * (portrait ? 0.66 : 0.74) - fontPx * 1.3 - 110 * u) : cy + R * 0.62) : ink ? H * (portrait ? 0.36 : 0.33) : H * (portrait ? 0.3 : 0.24);

  return (
    <SceneShell {...props} captions={writesNarration ? false : props.captions} themeId={ink ? "warm" : "night"} motif={false} background={ink ? C.parchment : C.duskDeep} durationInFrames={durationInFrames} eyebrowColors={ink ? { text: C.ink, border: C.sand } : { text: C.parchment, border: C.sand }}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${cam})`, transformOrigin: `50% ${on ? 40 : 55}%` }}>
        {/* سماء الغسق */}
        <div style={{ position: "absolute", inset: 0, background: ink ? `radial-gradient(ellipse at 50% 40%, ${C.parchment} 0%, ${C.paperDeep} 100%)` : `linear-gradient(180deg, ${C.duskDeep} 0%, ${C.dusk} 62%, ${on ? C.dusk : "#3A2440"} 100%)` }} />
        <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
          <defs>
            <radialGradient id="noor-core">
              <stop offset="0" stopColor={C.glow} stopOpacity={0.9} />
              <stop offset="0.12" stopColor={C.glow} stopOpacity={0.7} />
              <stop offset="0.3" stopColor={C.parchment} stopOpacity={0.4} />
              <stop offset="0.6" stopColor={C.sand} stopOpacity={0.18} />
              <stop offset="1" stopColor={C.sun} stopOpacity={0} />
            </radialGradient>
            <radialGradient id="noor-horizon">
              <stop offset="0" stopColor={C.sun} stopOpacity={0.45} />
              <stop offset="1" stopColor={C.sun} stopOpacity={0} />
            </radialGradient>
            <linearGradient id="noor-ray" x1="0" x2="1">
              <stop offset="0" stopColor={C.glow} stopOpacity={0.5} />
              <stop offset="1" stopColor={C.glow} stopOpacity={0} />
            </linearGradient>
          </defs>
          {ink ? (
            <>
              {/* صفحة الدفتر: خط الأفق بعلامات القرون، يمتد مع بداية الكتابة */}
              <line x1={rtl ? W * (1 - write) : 0} x2={rtl ? W : W * write} y1={H * 0.8} y2={H * 0.8} stroke={C.ink} strokeOpacity={0.16} strokeWidth={3 * u} />
              {Array.from({ length: 13 }, (_, i) => (
                <line key={i} x1={(i / 12) * W} x2={(i / 12) * W} y1={H * 0.8} y2={H * 0.8 + (i % 3 === 0 ? 22 : 12) * u} stroke={C.ink} strokeOpacity={0.16 * write} strokeWidth={3 * u} />
              ))}
            </>
          ) : on ? (
            <>
              {/* نور هادئ بلا أشعة ولا هيئة: وهج واحد يبزغ ويتنفس، ويشتد قليلًا عند نطق الاسم */}
              <circle cx={cx} cy={cy} r={R * 0.62 * swell * breathe} fill="url(#noor-core)" opacity={0.85} />
            </>
          ) : (
            <>
              {/* الأفق: خط رملي وغروب خافت تحته (بصمة «دفتر الأفق») */}
              <rect x={0} y={H * 0.68} width={W} height={H * 0.4} fill={C.duskDeep} opacity={0.5} />
              <line x1={0} x2={W} y1={H * 0.68} y2={H * 0.68} stroke={C.sand} strokeOpacity={0.55} strokeWidth={2 * u} />
              <ellipse cx={cx} cy={H * 0.68} rx={W * 0.45} ry={H * 0.16} fill="url(#noor-horizon)" opacity={0.55 + 0.1 * Math.sin(frame / 20) + Math.min(0.45, speak * 1.4)} />
            </>
          )}
          {motes.map((m, i) => (
            <circle key={i} cx={m.x} cy={m.y} r={m.r} fill={on ? C.glow : C.parchment} opacity={m.o} />
          ))}
        </svg>

        {/* الكتابة */}
        {text ? (
          <div style={{ position: "absolute", left: 0, right: 0, top: textTop, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 * u, padding: `0 ${portrait ? 70 : 160}px` }}>
            <div
              style={{
                fontFamily: fontFamilies.scripture,
                fontWeight: 700,
                fontSize: fontPx,
                lineHeight: 1.3,
                color: ink ? C.ink : C.parchment,
                textAlign: "center",
                textWrap: "balance",
                textShadow: on ? `0 0 ${14 * u}px rgba(255,233,194,0.35)` : "none",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                columnGap: "0.28em",
              }}
            >
              {words.map((w, i) => (
                <span key={i} style={{ position: "relative", display: "inline-block" }}>
                  {/* وهج يكتب الكلمة: يسطع خلفها لحظة ظهورها ثم يخفت */}
                  <span aria-hidden style={{ position: "absolute", left: "50%", top: "55%", width: fontPx * 3.2, height: fontPx * 2.2, marginLeft: -fontPx * 1.6, marginTop: -fontPx * 1.1, borderRadius: "50%", background: `radial-gradient(closest-side, ${on ? C.glow : C.sand} 0%, rgba(0,0,0,0) 100%)`, opacity: (ink ? 0.35 : 0.6) * interpolate(frame - (wordAt[i] ?? at), [-4, 4, 26], [0, 1, 0], clamp), pointerEvents: "none" }} />
                  <span style={{ position: "relative", display: "inline-block", opacity: wIn(i), transform: `translateY(${(1 - wIn(i)) * 24 * u}px)`, clipPath: rtl ? `inset(-30% 0 -30% ${(1 - wIn(i)) * 100}%)` : `inset(-30% ${(1 - wIn(i)) * 100}% -30% 0)` }}>{w}</span>
                </span>
              ))}
            </div>
            <div style={{ height: 3 * u, width: interpolate(write, [0.3, 1], [0, (portrait ? 360 : 420) * u], clamp), background: C.sand, opacity: 0.8 }} />
            {subtitle ? <div style={{ fontFamily: fontFamilies.clean, fontSize: (portrait ? 46 : 42) * u, color: ink ? C.ink : C.parchment, opacity: 0.88 * subIn }}>{subtitle}</div> : null}
          </div>
        ) : null}
      </div>
    </SceneShell>
  );
};

export const noorTextSample: Omit<NoorTextProps, "themeId" | "orientation"> = {
  eyebrow: "البداية",
  text: "آدم عليه السلام",
  light: "on",
  subtitle: "أبو البشر",
  narration: "إننا نبدأ من أبي البشر، آدم عليه السلام.",
};
export const noorTextSampleEn: Omit<NoorTextProps, "themeId" | "orientation"> = { ...noorTextSample, narration: "We begin with the father of mankind, Adam, peace be upon him." };
export const noorTextSeconds = 6;
