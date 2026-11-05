import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import config from "../../../config.json";
import { AlleyTale, type AlleyTaleProps } from "../scenes/AlleyTale";
import { PortraitSplit, Split } from "./LightLab";

/**
 * مختبر التأطير (الأمر 013): «حكايات الحارة» بالكاميرا المؤلَّفة، الحالة نفسها بالتوقيت نفسه:
 * يمين: التأطير القائم (بلا الحقل)، يسار: التأطير المحتوي (framing = fit). بلا صوت، ولا يُنشر.
 * نصوص محايدة للاختبار البصري فقط.
 */
type Alley = Omit<AlleyTaleProps, "themeId" | "orientation">;
export type FramingCase = { id: string; title: string; sub: string; seconds: number; scene: Alley };
const base: Alley = { narration: "", place: "alley", mood: "night", look: "hero", cameraMode: "composed", gait: "walk" };

export const FRAMING_CASES: FramingCase[] = [
  {
    id: "solo-door",
    title: "١ · البطل وحده: يمشي ثم يقف عند الباب",
    sub: "بدء المشي والتسارع والتوقف، والالتفاتة نحو الباب، ولقطة «الباب» تحتوي البطل والباب معًا",
    seconds: 8,
    scene: { ...base, narration: "يمشي في الحارة مساء. ثم يقف أمام الباب ويفكر.", cast: "solo", poses: "walk,stand", cues: "door | الباب\nthink | ويفكر" },
  },
  {
    id: "sitting",
    title: "٢ · البطل جالسًا",
    sub: "اللقطة القريبة تحتوي الجالس ومقعده (ساقاه أمامه)، بدل أن تتوسط موضع جذعه فتقص ساقيه",
    seconds: 7,
    scene: { ...base, place: "home", narration: "يجلس وحده بعد يوم طويل. يتذكر ما قاله، ويشعر بالألم.", cast: "solo", poses: "sit,head-down", cues: "memory | يتذكر\npain | بالألم" },
  },
  {
    id: "companion",
    title: "٣ · شخص أمام البطل",
    sub: "الاثنان معًا في لقطة «الاثنين»؛ في العمودي يقترب من أمامه 330 بدل 400 ليتسعا (تغيير تكوين معلن)",
    seconds: 8,
    scene: { ...base, narration: "يقف أمام صديقه بعد الخلاف. يعتذر له بصدق، ثم يصغي إليه.", cast: "companion", poses: "stand,apologize,listen", cues: "apologize | يعتذر\nlisten | يصغي" },
  },
  {
    id: "witnesses",
    title: "٤ · شاهدان على موقف واحد",
    sub: "الأفقي يحتوي الثلاثة؛ العمودي لا يتسع لهم، فتبدأ الكاميرا على الموقف ثم تنتقل إلى كل شاهد عند كلمة حكمه",
    seconds: 8,
    scene: { ...base, place: "market", narration: "شاهدان رأيا الموقف نفسه. الأول يراه ظلمًا، والثاني يراه عدلًا.", cast: "witnesses", poses: "stand", cues: "witnesses | شاهدان\nwrong | ظلمًا\njust | عدلًا" },
  },
  {
    id: "board",
    title: "٥ · خبر على لوحة السوق",
    sub: "لقطة «اللوحة» تحتوي البطل واللوحة كاملة",
    seconds: 7,
    scene: { ...base, place: "market", narration: "يقرأ خبرًا معلقًا في السوق. ثم يتوقف ويفكر فيه.", cast: "solo", poses: "stand,think", cues: "news | خبرًا\nthink | ويفكر" },
  },
  {
    id: "stillness",
    title: "٦ · جملة فيها ذكر الله",
    sub: "السكون المقصود: لا حركة كاميرا ولا أحداث، في التأطيرين",
    seconds: 5,
    scene: { ...base, narration: "الحمد لله على كل حال.", cast: "solo", poses: "stand", cues: "" },
  },
];

const FOOT = "مختبر المحرك · الأمر 013 · الحالة نفسها بالتوقيت نفسه · بلا صوت · لا يُنشر";
export const framingLabFrames = () => FRAMING_CASES.reduce((n, c) => n + c.seconds * config.video.fps, 0);

const Pair: React.FC<{ c: FramingCase; orientation: "landscape" | "portrait" }> = ({ c, orientation }) => {
  const k = {
    id: c.id,
    title: c.title,
    sub: c.sub,
    before: <AlleyTale {...c.scene} themeId="night" orientation={orientation} />,
    after: <AlleyTale {...c.scene} framing="fit" themeId="night" orientation={orientation} />,
    beforeLabel: "التأطير القائم",
    afterLabel: "التأطير المحتوي (framing = fit)",
    footer: FOOT,
  };
  return orientation === "portrait" ? <PortraitSplit c={k} /> : <Split c={k} />;
};

export const FramingLab: React.FC<{ orientation: "landscape" | "portrait" }> = ({ orientation }) => {
  let from = 0;
  return (
    <AbsoluteFill>
      {FRAMING_CASES.map((c) => {
        const f = from;
        from += c.seconds * config.video.fps;
        return (
          <Sequence key={c.id} from={f} durationInFrames={c.seconds * config.video.fps} name={c.id}>
            <Pair c={c} orientation={orientation} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

/** لقياس الأداء (الأمر 013): الحالة نفسها كاملة الإطار، بلا الحقل ثم به */
export const FramingTiming: React.FC<{ fit: boolean; orientation: "landscape" | "portrait"; caseId: string }> = ({ fit, orientation, caseId }) => {
  const c = FRAMING_CASES.find((x) => x.id === caseId)!;
  return <AlleyTale {...c.scene} {...(fit ? { framing: "fit" } : {})} themeId="night" orientation={orientation} />;
};
