import React from "react";
import { AbsoluteFill } from "remotion";
import { AlleyTale, type AlleyTaleProps } from "../scenes/AlleyTale";
import { RoadJourney, roadJourneySample } from "../scenes/RoadJourney";
import { LAB_SCENE } from "./BalislamLab";

/**
 * مختبر الإضاءة والظلال والعمق (الأمر 008): نفس المشهد بنفس الكاميرا والتكوين والتوقيت،
 * يمين: المحرك القائم بلا الحقل، يسار: الحقل `lighting` وحده مضافًا. بلا صوت، ولا يُنشر.
 */
type Alley = Omit<AlleyTaleProps, "themeId" | "orientation">;
const EXTERIOR: Alley = { ...LAB_SCENE, cameraMode: "composed", gait: "walk" };
const INTERIOR: Alley = {
  narration: "يقف في البيت مساء. يفكر في كلامه. ثم يعرف الحقيقة.",
  place: "home",
  mood: "night",
  cast: "solo",
  poses: "stand,think,look-up",
  look: "hero",
  cues: "think | يفكر\ntruth | الحقيقة",
  cameraMode: "composed",
};

export const LIGHT_CASES: { id: string; title: string; sub: string; before: React.ReactNode; after: React.ReactNode }[] = [
  {
    id: "shadow",
    title: "١ · الظل: بلا ظل ومع ظل يتبع المشي",
    sub: "مصباح جداري قرب الباب: ظل تماس تحت القدمين، وظل ملقى يقصر كلما اقترب من المصباح، وتظليل من جهة الضوء",
    before: <AlleyTale {...EXTERIOR} themeId="night" orientation="landscape" />,
    after: <AlleyTale {...EXTERIOR} lighting="night-lamp" themeId="night" orientation="landscape" />,
  },
  {
    id: "direction",
    title: "٢ · تغير اتجاه الضوء",
    sub: "عند «الباب» ينتقل المصدر إلى الجهة الأخرى: الظل يدور تحت القدمين، والحافة المضيئة تنتقل إلى الجانب الآخر",
    before: <AlleyTale {...EXTERIOR} themeId="night" orientation="landscape" />,
    after: <AlleyTale {...EXTERIOR} lighting={"night-lamp\nkey lamp 1700 420\nmove 260 420 الباب 110"} themeId="night" orientation="landscape" />,
  },
  {
    id: "depth",
    title: "٣ · العمق: مقدمة ووسط وخلفية",
    sub: "الخلفية خارج التركيز مع ضباب جوي، وعمود مقدمة يمر أسرع من البطل، والمنظور أوضح مع حركة الكاميرا",
    before: <AlleyTale {...EXTERIOR} cameraPlan={"0 | wide\nالباب | medium door"} themeId="night" orientation="landscape" />,
    after: <AlleyTale {...EXTERIOR} cameraPlan={"0 | wide\nالباب | medium door"} lighting={"night-lamp\ndepth dof 0.55 fog 0.35 parallax 1.4 fg"} themeId="night" orientation="landscape" />,
  },
  {
    id: "interior",
    title: "٤ · مشهد داخلي",
    sub: "مصباح البيت دافئ وعتمة الغرفة حوله، وتزداد شدته تدريجيًا عند «الحقيقة»",
    before: <AlleyTale {...INTERIOR} themeId="night" orientation="landscape" />,
    after: <AlleyTale {...INTERIOR} lighting={"interior-lamp\nfade 0.45 1.1 الحقيقة 60"} themeId="night" orientation="landscape" />,
  },
  {
    id: "exterior",
    title: "٥ · مشهد خارجي: شمس الفجر",
    sub: "ضوء اتجاهي منخفض من الأفق: ظل طويل يتحرك مع الخطوات، ودفء الفجر، وحافة مضيئة تفصل المسافر عن الخلفية",
    before: <RoadJourney {...roadJourneySample} mood="dawn" motion="natural" themeId="night" orientation="landscape" />,
    after: <RoadJourney {...roadJourneySample} mood="dawn" motion="natural" lighting="dawn-sun" themeId="night" orientation="landscape" />,
  },
];

const T: React.CSSProperties = { fontFamily: "Tajawal, sans-serif", direction: "rtl", textAlign: "center" };

const Split: React.FC<{ c: (typeof LIGHT_CASES)[number] }> = ({ c }) => (
  <AbsoluteFill style={{ background: "#071512" }}>
    <div style={{ position: "absolute", top: 34, left: 0, right: 0, ...T, color: "#F4EEE2", fontSize: 40, fontWeight: 700 }}>{c.title}</div>
    <div style={{ position: "absolute", top: 96, left: 80, right: 80, ...T, color: "#C9A24A", fontSize: 23 }}>{c.sub}</div>
    <div style={{ position: "absolute", left: 960, top: 210, width: 1920, height: 1080, transform: "scale(0.5)", transformOrigin: "0 0", overflow: "hidden" }}>{c.before}</div>
    <div style={{ position: "absolute", left: 0, top: 210, width: 1920, height: 1080, transform: "scale(0.5)", transformOrigin: "0 0", overflow: "hidden" }}>{c.after}</div>
    <div style={{ position: "absolute", left: 960, top: 765, width: 960, ...T, color: "#A9C3B9", fontSize: 30, fontWeight: 700 }}>قبل: المحرك القائم</div>
    <div style={{ position: "absolute", left: 0, top: 765, width: 960, ...T, color: "#F2B35B", fontSize: 30, fontWeight: 700 }}>بعد: الإضاءة والظلال والعمق</div>
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 40, ...T, color: "#6F8F84", fontSize: 21 }}>مختبر المحرك · الأمر 008 · نفس المشهد والكاميرا والتوقيت · اختبار بصري بلا صوت · لا يُنشر</div>
  </AbsoluteFill>
);

export const lightLab = (id: string): React.FC => {
  const c = LIGHT_CASES.find((x) => x.id === id)!;
  const C: React.FC = () => <Split c={c} />;
  return C;
};

/** لقياس زمن الرندر: المشهد الخارجي كاملًا بالإطار، بلا الحقل ثم به */
export const LightTimingOff: React.FC = () => <AlleyTale {...EXTERIOR} themeId="night" orientation="landscape" />;
export const LightTimingOn: React.FC<{ lighting?: string }> = ({ lighting = "night-lamp\ndepth dof 0.55 fog 0.35 parallax 1.4 fg" }) => <AlleyTale {...EXTERIOR} lighting={lighting} themeId="night" orientation="landscape" />;
