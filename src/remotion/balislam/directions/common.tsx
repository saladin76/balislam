/**
 * «بالإسلام» — اتجاهات المقارنة الثلاثة بثري دي (مراجع المنسّق ٢١ نوفمبر، قرار المالك: ثلاثة اتجاهات قبل أي قالب).
 * نماذج صامتة لا تُنشر ولا تُستعمل في حلقة، على عدّة الثري دي المشتركة (D166). الجملة نفسها في الثلاثة، وفيها جملة
 * ذكر لله يسكن عندها كل شيء (السكون المقصود): لا مفتاح ولا ارتعاش ولا اهتزاز، ولا يُضاف شيء قبلها أو بعدها لتعويضها.
 * الألوان من هوية «باء التشغيل» المعتمدة وحدها (brand/identity/approved.ts). بلا وجوه.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import type { Window } from "../../three";

export const DIR_FPS = 30;
/** كلمات النموذج بتوقيت تقديري ثابت (لا صوت): جملتان عاديتان ثم جملة ذكر */
export const DIR_WORDS: { w: string; s: number; e: number }[] = (() => {
  const text = ["وقف رجلان في السوق،", "كلٌّ منهما يقول: الحقُّ معي.", "واللهُ يعلمُ ما في القلوب."];
  const out: { w: string; s: number; e: number }[] = [];
  // إيقاع راوٍ هادئ: نصف ثانية للكلمة، ووقفة قبل جملة التأمل
  let t = 0.8;
  text.forEach((sentence, i) => {
    for (const w of sentence.split(" ")) { out.push({ w, s: t, e: t + 0.42 }); t += 0.5; }
    t += i === 1 ? 1.4 : 0.6;
  });
  return out;
})();
export const wordAt = (w: string) => DIR_WORDS.find((x) => x.w.replace(/[،.:]/g, "") === w)!.s;
/** الجملة الثالثة كلها (ذكر الله) سكون مقصود، من قبلها بربع ثانية إلى ما بعدها */
export const DIR_STILL: Window[] = [[wordAt("واللهُ") - 0.25, DIR_WORDS[DIR_WORDS.length - 1]!.e + 0.25]];
export const DIR_SEC = Math.ceil(DIR_WORDS[DIR_WORDS.length - 1]!.e + 2.0);
export const dirFrames = () => DIR_SEC * DIR_FPS;

export const BAA = { copper: "#B4532F", emerald: "#1E6B5C", rose: "#C2566B", night: "#0E1A2B", gold: "#D9A441", paper: "#EFE4D3" } as const;

/** بداية كل جملة في DIR_WORDS */
const STARTS = [0, 4, 9];
/** الترجمة أسفل الكادر (الكلمة المقولة أوضح، بلا ظل جاهز)، ووسم «للمقارنة» */
export const DirFrame: React.FC<{ t: number; name: string; tone?: "light" | "dark" }> = ({ t, name, tone = "light" }) => {
  const [on, off] = tone === "light" ? [BAA.paper, "rgba(239,228,211,0.35)"] : [BAA.night, "rgba(14,26,43,0.3)"];
  const si = Math.max(0, STARTS.filter((x) => DIR_WORDS[x]!.s - 0.2 <= t).length - 1);
  const words = DIR_WORDS.slice(STARTS[si], STARTS[si + 1] ?? DIR_WORDS.length);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 22, right: 28, padding: "5px 14px 7px", borderRadius: 8, background: "rgba(14,26,43,0.6)", color: BAA.paper,
        fontFamily: "IBM Plex Sans Arabic", fontWeight: 500, fontSize: 20, direction: "rtl" }}>اتجاه للمقارنة · {name} · لا يُنشر</div>
      <div style={{ position: "absolute", bottom: 64, left: 0, right: 0, textAlign: "center", direction: "rtl", fontFamily: "IBM Plex Sans Arabic", fontWeight: 600, fontSize: 56 }}>
        {t >= DIR_WORDS[0]!.s - 0.2 && words.map((w, i) => (
          <span key={i} style={{ color: t >= w.s ? on : off, margin: "0 6px" }}>{w.w}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
