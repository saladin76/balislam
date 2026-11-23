import React from "react";
import { useCurrentFrame } from "remotion";
import type { Theme } from "../../../brand/themes";
import { fontFamilies } from "../../../brand/fonts";
import { activeWordIndex, type WordTiming } from "./timing";
import { useSize } from "../../../brand/identity/index";
import { useChannel } from "../../channel/context";
import { stripTashkeel } from "../../voice/tashkeel";

/** نص الكلمة على الشاشة: بلا تشكيل إن قررت القناة ذلك (script.captionTashkeel=false)، ونص النطق المشكول لا يتغير */
const useCaptionWord = () => {
  const plain = useChannel().script?.captionTashkeel === false;
  return (w: string) => (plain ? stripTashkeel(w) : w);
};


/**
 * الترجمة (قرار المالك ٢٢ نوفمبر، القنوات الثلاث): سطر هادئ بخط القناة، بلا قفز ولا تلوين — لا كلمة مميزة ولا صندوق
 * ملوّن (أسلوب تيك توك ممنوع). الكلمات تُقسم أسطرًا ثابتة تُقطع بعد علامة الوقف أو حين يبلغ السطر حده، والسطر لا
 * يتغير حتى تبدأ أول كلمة في التالي، ويظهر بتلاشٍ قصير. في الشورت يرتفع فوق منطقة أزرار المنصات.
 */
export const CaptionBar: React.FC<{ theme: Theme; timings: WordTiming[]; portrait: boolean; variant?: "pill" | "cinema" | "paper" | "dusk" | "adaptive" }> = ({ timings, portrait, variant = "pill" }) => {
  const frame = useCurrentFrame();
  const shown = useCaptionWord();
  const fontSize = useSize("caption", portrait ? "portrait" : "landscape");
  const first = timings[0];
  const last = timings[timings.length - 1];
  if (!first || !last || frame < first.start || frame > last.end + 6) return null;
  const idx = Math.max(0, activeWordIndex(timings, frame));
  const lines = captionLines(timings.map((t) => t.word), portrait ? CAPTION_MAX_WORDS.portrait : CAPTION_MAX_WORDS.landscape);
  const line = lines.find((l) => idx >= l[0]! && idx <= l[l.length - 1]!) ?? lines[0]!;
  const fade = Math.min(1, Math.max(0, (frame - timings[line[0]!]!.start + 1) / FADE_FRAMES));
  // قرار المالك ٢٢ نوفمبر: بلا مستطيل خلف الترجمة في القنوات الثلاث، نص بظل خفيف فقط. نص فاتح بظل داكن ناعم،
  // وعلى ورق «دفاتر الزمن» الفاتح حبر داكن بهالة فاتحة؛ والظل يُعدّ للقراءة لا للزينة (بلا توهج ولا ألوان)
  // adaptive: أبيض صافٍ بلا ظل؛ مزج «الفرق» على الطبقة الحاوية (SceneShell) يقلبه حبرًا داكنًا على الورق الفاتح
  const look = variant === "adaptive" ? { color: "#FFFFFF", textShadow: "none" } : variant === "paper"
    ? { color: "#4A2E1F", textShadow: CAPTION_SHADOW.light }
    : { color: variant === "dusk" ? "#F1E4CB" : variant === "cinema" ? "#F4EEE2" : "#FFFFFF", textShadow: CAPTION_SHADOW.dark };
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: portrait ? 470 : variant === "cinema" ? 38 : 64, display: "flex", justifyContent: "center", padding: "0 64px" }}>
      <div
        style={{
          ...look,
          opacity: fade,
          background: "transparent",
          padding: portrait ? "12px 26px" : "10px 28px",
          fontFamily: fontFamilies.body,
          fontWeight: 500,
          fontSize,
          lineHeight: 1.5,
          textAlign: "center",
          direction: "rtl",
          maxWidth: portrait ? 940 : 1500,
        }}
      >
        {line.map((i) => shown(timings[i]!.word)).join(" ")}
      </div>
    </div>
  );
};

/** ظل الترجمة الخفيف (بلا مستطيل): ظل قريب يحدد الحرف، وظل أوسع خافت يفصله عن الصورة */
export const CAPTION_SHADOW = {
  // حدّ داكن رفيع من ثمانية ظلال (١٫٥ بكسل) ثم ظل ناعم: يُقرأ النص الفاتح على ورق الدفتر الفاتح وعلى الليل معًا،
  // بلا مستطيل (D192) — ملاحظة الخطاف في «دفاتر الزمن 001»: الظل الخفيف وحده ضاع على الصفحة.
  dark: [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5], [1.1, 1.1], [-1.1, 1.1], [1.1, -1.1], [-1.1, -1.1]].map(([x, y]) => `${x}px ${y}px 0 rgba(0,0,0,0.8)`).join(", ") + ", 0 2px 6px rgba(0,0,0,0.55), 0 0 14px rgba(0,0,0,0.35)",
  light: "0 1px 2px rgba(255,255,255,0.7), 0 0 10px rgba(255,255,255,0.5)",
} as const;

/** حد كلمات السطر: يتسع للجملة القصيرة كلها، ويُقرأ في لمحة */
export const CAPTION_MAX_WORDS = { landscape: 10, portrait: 6 } as const;
const FADE_FRAMES = 4;
const STOP = /[،.؟?!:؛]$/;

/** أسطر الترجمة (فهارس الكلمات): تُقطع بعد علامة الوقف أو عند الحد، ولا يُترك آخر سطر في الجملة كلمة أو كلمتين وحدهما */
export const captionLines = (words: string[], max: number): number[][] => {
  const out: number[][] = [];
  let sentence: number[] = [];
  const flush = () => {
    if (!sentence.length) return;
    const n = Math.ceil(sentence.length / max);
    const per = Math.ceil(sentence.length / n); // أسطر متقاربة الطول بدل سطر طويل وآخر قصير
    for (let k = 0; k < sentence.length; k += per) out.push(sentence.slice(k, k + per));
    sentence = [];
  };
  words.forEach((w, i) => { sentence.push(i); if (STOP.test(w.trim())) flush(); });
  flush();
  return out;
};
