/**
 * تجربة الشكل لدفاتر الزمن (قرار المالك ٢٣ نوفمبر، البند ٣): العشرون ثانية نفسها بالصوت المسجَّل نفسه من الحلقة 001
 * (المشهدان c1-s3 وc1-s4)، بخمس طرق. لا تُنشر. الصوت يُنسخ محليًا إلى public/_looktest/ ولا يدخل Git.
 * - c1-s3: «ولكن رحلتنا هذه لا تبدأ من مدينة قديمة، ولا من مملكة نسي الناس اسمها. بل تبدأ من أبي البشر، آدم عليه السلام.»
 *   فيها اللحظة البصرية القوية: من أطلال المدن إلى أرض بكر عند «بل تبدأ».
 * - c1-s4: «أول إنسان خلقه الله سبحانه وتعالى، ومنه ومن زوجه بدأ نسل البشر الذي انتشر في الأرض.» جملة ذكر الله: سكون تام،
 *   فالصورة تتجمد قبلها بقليل (STILL_AT) ولا يتحرك فيها شيء حتى النهاية، والترجمة تظهر بلا تلاشٍ.
 * التوقير: لا تصوير لآدم عليه السلام ولا لأي نبي ولا ملَك، ولا موسيقى.
 */
import React from "react";
import { Audio, Sequence, staticFile } from "remotion";

export const LT_FPS = 30;
export const OFF3 = 0.3;
export const OFF4 = 12.4;
export const LT_END = 21.2;
export const LT_FRAMES = Math.round(LT_END * LT_FPS);
/** الصورة تتجمد هنا: قبل جملة الذكر بخُمس ثانية */
export const STILL_AT = OFF4 - 0.2;
export const vt = (t: number) => Math.min(t, STILL_AT);

const W3: [string, number][] = [["ولكن", 0], ["رحلتنا", 0.56], ["هذه", 1.32], ["لا", 2.01], ["تبدأ", 2.22], ["من", 2.64], ["مدينة", 2.81], ["قديمة", 3.52], ["ولا", 4.42], ["من", 4.69], ["مملكة", 4.86], ["نسي", 5.67], ["الناس", 6.04], ["اسمها", 6.42], ["بل", 7.46], ["تبدأ", 7.74], ["من", 8.21], ["أبي", 8.45], ["البشر", 8.68], ["آدم", 9.58], ["عليه", 10.07], ["السلام", 10.49]];
/** زمن الكلمة في التجربة (بالثواني من أول الفيديو)؛ n للتكرار */
export const at = (w: string, n = 1) => {
  let k = 0;
  for (const [x, s] of W3) if (x === w && ++k === n) return OFF3 + s;
  throw new Error(`لا كلمة «${w}»`);
};

const LINES: { a: number; b: number; text: string }[] = [
  { a: OFF3, b: OFF3 + 7.3, text: "ولكن رحلتنا هذه لا تبدأ من مدينة قديمة، ولا من مملكة نسي الناس اسمها." },
  { a: OFF3 + 7.36, b: OFF3 + 11.62, text: "بل تبدأ من أبي البشر، آدم عليه السلام." },
  { a: OFF4, b: LT_END, text: "أول إنسان خلقه الله سبحانه وتعالى، ومنه ومن زوجه بدأ نسل البشر الذي انتشر في الأرض." },
];

export const LtAudio: React.FC = () => (
  <>
    <Sequence from={Math.round(OFF3 * LT_FPS)}><Audio src={staticFile("_looktest/s3.wav")} /></Sequence>
    <Sequence from={Math.round(OFF4 * LT_FPS)}><Audio src={staticFile("_looktest/s4.wav")} /></Sequence>
  </>
);

/** الترجمة نفسها في الطرق كلها (للمقارنة العادلة): جملة كاملة، بلا تلاشٍ، ونبرتها حسب ما خلفها */
export const LtCaption: React.FC<{ t: number; tone: "ink" | "light" }> = ({ t, tone }) => {
  const line = LINES.find((l) => t >= l.a && t < l.b);
  if (!line) return null;
  const light = tone === "light";
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 40, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 1600, padding: "6px 26px 10px", direction: "rtl", textAlign: "center", fontFamily: "'IBM Plex Sans Arabic', sans-serif", fontWeight: 600, fontSize: 40, lineHeight: 1.45,
        color: light ? "#F8EEDB" : "#2B1E14", textShadow: light ? "0 0 3px rgba(13,10,20,0.95), 0 0 10px rgba(13,10,20,0.75)" : "0 0 3px rgba(248,238,219,0.95), 0 0 10px rgba(248,238,219,0.8)" }}>{line.text}</div>
    </div>
  );
};

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (x: number) => { const c = clamp01(x); return c * c * (3 - 2 * c); };
/** تقدّم ناعم من a خلال d ثانية */
export const pr = (t: number, a: number, d: number) => smooth((t - a) / d);

/** بطاقة رقم الطريقة قبل كل طريقة في فيديو المقارنة */
export const LtCard: React.FC<{ n?: string; label?: string }> = ({ n = "١", label = "" }) => (
  <div style={{ position: "absolute", inset: 0, background: "#0D0A14", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", direction: "rtl" }}>
    <div style={{ fontFamily: "'Amiri', serif", fontWeight: 700, fontSize: 340, lineHeight: 1, color: "#F1E4CB" }}>{n}</div>
    <div style={{ fontFamily: "'IBM Plex Sans Arabic', sans-serif", fontWeight: 600, fontSize: 64, color: "#C8A15A", marginTop: 30 }}>{label}</div>
  </div>
);
