import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useSize, useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { useChannel } from "../../channel/context";
import { basmalaSpans } from "../../voice/basmala";
import { estimateTimings, splitWords, type WordTiming } from "./timing";
import type { Orientation } from "./types";
import type { ThemeId } from "../../../brand/themes";

/** علامات الجملة في آخر الكلمة (النقطة بعد البسملة) لا تُرسم مع البسملة؛ الكلمات نفسها كما كتبها المالك */
const TRAILING = /[.،,:؛;!؟?…»"]+$/u;

/**
 * نوافذ البسملة في المشهد بالإطارات: من بدء أول كلماتها إلى نهاية آخرها، بتوقيت كلمات المشهد
 * (صوت المشهد المركّب بتسجيل المالك أو التقدير قبله، كما يرسمه القالب نفسه). النص كلمات السكريبت حرفًا.
 */
export const basmalaWindows = (narration: string, timings: WordTiming[] | undefined, durationInFrames: number) => {
  const tokens = splitWords(narration);
  const spans = basmalaSpans(narration);
  if (!spans.length) return [];
  const words = timings && timings.length === tokens.length ? timings : estimateTimings(narration, 6, durationInFrames - 12);
  return spans.map(([a, b]) => ({
    text: tokens.slice(a, b).map((w, i) => (i === b - a - 1 ? w.replace(TRAILING, "") : w)).join(" "),
    from: words[a]!.start, to: words[b - 1]!.end,
  }));
};

/**
 * البسملة على الشاشة (طلب المالك ١٥ نوفمبر؛ البسملة تُعامل كالآية، ١٠ نوفمبر): حين تُنطق داخل مشهد راوٍ
 * تظهر وحدها في وسط الشاشة بخط المصحف وهوية القناة، فوق ستار هادئ يحجب عناصر القالب لحظتها
 * (لا رمز ولا عنصر بجوار ذكر الله). ظهور واحد هادئ وخفوت بعد آخر كلماتها؛ لا حركة غيره (سكون مقصود).
 * لا يُرسم في مشهد صُمم للبسملة نفسها (لقطة «basmala» في دفاتر الزمن) ولا في بطاقة الآية.
 */
export const BasmalaOnScreen: React.FC<{ narration: string; timings?: WordTiming[]; themeId: ThemeId; orientation: Orientation }> = ({ narration, timings, themeId, orientation }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const style = useChannel().verse?.style;
  const t = useTheme(style === "ink" ? "paper" : themeId);
  const size = useSize("verse", orientation);
  const windows = React.useMemo(() => basmalaWindows(narration, timings, durationInFrames), [narration, timings, durationInFrames]);
  const lead = Math.round(0.25 * fps);
  const hold = Math.round(0.4 * fps);
  return (
    <>
      {windows.map((w, i) => {
        const a = w.from - lead, z = w.to + hold;
        const o = interpolate(frame, [a - 8, a, z, z + 8], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        if (o <= 0) return null;
        const bg = style === "page" ? "#140E20" : t.colors.bg;
        const ink = style === "page" ? "#F1E4CB" : t.colors.ink;
        return (
          <AbsoluteFill key={i} data-basmala-on-screen style={{ opacity: o, background: bg, alignItems: "center", justifyContent: "center" }}>
            <div style={{ direction: "rtl", fontFamily: fontFamilies.scripture, fontSize: Math.round(size * 1.15), lineHeight: 1.9, color: ink, textAlign: "center", padding: orientation === "portrait" ? "0 80px" : "0 200px" }}>
              {w.text}
            </div>
          </AbsoluteFill>
        );
      })}
    </>
  );
};
