import React from "react";
import { useVideoConfig } from "remotion";
import { AlleyTale } from "../scenes/AlleyTale";
import { estimateTimings } from "../scenes/timing";
import { useBrandFonts } from "../useBrandFonts";

/**
 * مختبر مشهد الشاهدين (الأمر 015): اللقطة المصمَّمة «ميزان البائع» وحدها، بملء الإطار، صامتة،
 * بنص اختبار محايد. النطق ينتهي قبل آخر المشهد بنحو ثانيتين ونصف لتُقرأ البطاقتان في اللقطة الرابطة.
 */
export const WITNESSES_015 = {
  narration: "يزن البائع البرتقال، ثم يعيد حبة إلى صندوقه. شاهدان رأيا الموقف نفسه. الأول يراه ظلمًا، والثاني يراه عدلًا.",
  cues: "wrong | ظلمًا\njust | عدلًا",
  seconds: 17,
};

export const WitnessesLab015: React.FC<{ orientation: "landscape" | "portrait" }> = ({ orientation }) => {
  useBrandFonts();
  const { durationInFrames: dur } = useVideoConfig();
  return (
    <AlleyTale
      narration={WITNESSES_015.narration}
      narrationTimings={estimateTimings(WITNESSES_015.narration, 6, dur - 75)}
      cues={WITNESSES_015.cues}
      shot="souq-scale-witnesses"
      place="market"
      mood="night"
      themeId="night"
      orientation={orientation}
    />
  );
};
