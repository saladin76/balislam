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
export const CaptionBar: React.FC<{ theme: Theme; timings: WordTiming[]; portrait: boolean; variant?: "pill" | "cinema" | "paper" | "dusk" }> = ({ theme, timings, portrait, variant = "pill" }) => {
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
  const c = theme.colors;
  const look = variant === "cinema"
    ? { background: "transparent", color: "#F4EEE2", textShadow: "0 2px 6px rgba(0,0,0,0.9)" }
    : variant === "paper" ? { background: "rgba(241,228,203,0.88)", color: "#4A2E1F" }
    : variant === "dusk" ? { background: "rgba(18,12,28,0.55)", color: "#F1E4CB" }
    : { background: c.captionBg, color: c.captionInk };
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: portrait ? 470 : variant === "cinema" ? 38 : 64, display: "flex", justifyContent: "center", padding: "0 64px" }}>
      <div
        style={{
          ...look,
          opacity: fade,
          borderRadius: 10,
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
