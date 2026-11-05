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

type Labels = { beforeLabel?: string; afterLabel?: string; footer?: string };
const Split: React.FC<{ c: { title: string; sub: string; before: React.ReactNode; after: React.ReactNode } & Labels }> = ({ c }) => (
  <AbsoluteFill style={{ background: "#071512" }}>
    <div style={{ position: "absolute", top: 34, left: 0, right: 0, ...T, color: "#F4EEE2", fontSize: 40, fontWeight: 700 }}>{c.title}</div>
    <div style={{ position: "absolute", top: 96, left: 80, right: 80, ...T, color: "#C9A24A", fontSize: 23 }}>{c.sub}</div>
    <div style={{ position: "absolute", left: 960, top: 210, width: 1920, height: 1080, transform: "scale(0.5)", transformOrigin: "0 0", overflow: "hidden" }}>{c.before}</div>
    <div style={{ position: "absolute", left: 0, top: 210, width: 1920, height: 1080, transform: "scale(0.5)", transformOrigin: "0 0", overflow: "hidden" }}>{c.after}</div>
    <div style={{ position: "absolute", left: 960, top: 765, width: 960, ...T, color: "#A9C3B9", fontSize: 30, fontWeight: 700 }}>{c.beforeLabel ?? "قبل: المحرك القائم"}</div>
    <div style={{ position: "absolute", left: 0, top: 765, width: 960, ...T, color: "#F2B35B", fontSize: 30, fontWeight: 700 }}>{c.afterLabel ?? "بعد: الإضاءة والظلال والعمق"}</div>
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 40, ...T, color: "#6F8F84", fontSize: 21 }}>{c.footer ?? "مختبر المحرك · الأمر 008 · نفس المشهد والكاميرا والتوقيت · اختبار بصري بلا صوت · لا يُنشر"}</div>
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


/**
 * الأمر 009: مقارنات الإضاءة الداخلية والعمق بعد الاستكمال. نفس الترتيب (يمين قبل، يسار بعد).
 */
const F9 = "مختبر المحرك · الأمر 009 · نفس المشهد والكاميرا والتوقيت · اختبار بصري بلا صوت · لا يُنشر";
type Case9 = { id: string; title: string; sub: string; before: React.ReactNode; after: React.ReactNode; portrait?: boolean } & Labels;
export const LIGHT_CASES_009: Case9[] = [
  {
    // إطار فقط: تُركَّب فيه لوحتا الأمر 008 (يمين) وهذا الأمر (يسار) من المشهد نفسه بنفس التوقيت
    id: "room-compare",
    title: "١ · الإضاءة الداخلية: الأمر 008 مقابل 009",
    sub: "مصباح البيت نفسه: غسلة على الجدار حوله، وعتمة تتزايد نحو السقف والأركان، وبركة دافئة على الأرض، دون توهج يبيّض الجدار",
    before: null,
    after: null,
    beforeLabel: "قبل: إضاءة الأمر 008",
    afterLabel: "بعد: ضوء الغرفة (الأمر 009)",
    footer: F9,
  },
  {
    // لوحة «بعد» لهذا الأمر بالترتيب نفسه لحالة الداخل في الأمر 008 (تُقص وتُركَّب في room-compare)
    id: "room-lamp",
    title: "",
    sub: "",
    before: null,
    after: <AlleyTale {...INTERIOR} lighting={"interior-lamp\nfade 0.45 1.1 الحقيقة 60"} themeId="night" orientation="landscape" />,
    footer: F9,
  },
  {
    id: "room-window",
    title: "٢ · ضوء النافذة في الداخل",
    sub: "المصدر النافذة: ضوء أبرد، وبقعة بشكل قوسها على الأرض تمتد نحو الداخل، والشخصية مضاءة من جهتها",
    before: <AlleyTale {...INTERIOR} themeId="night" orientation="landscape" />,
    after: <AlleyTale {...INTERIOR} lighting="interior-window" themeId="night" orientation="landscape" />,
    afterLabel: "بعد: interior-window",
    footer: F9,
  },
  {
    id: "road-depth",
    title: "٣ · العمق في «الطريق»",
    sub: "صار يُنفذ: التلال البعيدة خارج التركيز مع ضباب جوي، والمنظور أوضح (البعيد يمر أبطأ). المقدمة غير مدعومة في الطريق ويرفضها الفحص",
    before: <RoadJourney {...roadJourneySample} mood="dawn" motion="natural" lighting="dawn-sun" themeId="night" orientation="landscape" />,
    after: <RoadJourney {...roadJourneySample} mood="dawn" motion="natural" lighting={"dawn-sun\ndepth dof 0.6 fog 0.45 parallax 1.6"} themeId="night" orientation="landscape" />,
    beforeLabel: "قبل: dawn-sun بلا عمق",
    afterLabel: "بعد: dawn-sun مع depth",
    footer: F9,
  },
  {
    id: "portrait-depth",
    portrait: true,
    title: "٤ · العمق في العمودي (الحارة)",
    sub: "كانت طبقة المقدمة تُرسم خارج الشريحة العمودية فلا تظهر؛ صارت على طرف الإطار الظاهر وتتحرك مع الكاميرا",
    before: <AlleyTale {...EXTERIOR} lighting="night-lamp" themeId="night" orientation="portrait" />,
    after: <AlleyTale {...EXTERIOR} lighting={"night-lamp\ndepth dof 0.5 fog 0.3 fg"} themeId="night" orientation="portrait" />,
    beforeLabel: "قبل: بلا عمق",
    afterLabel: "بعد: depth مع المقدمة",
    footer: F9,
  },
];

const PortraitSplit: React.FC<{ c: Case9 }> = ({ c }) => (
  <AbsoluteFill style={{ background: "#071512" }}>
    <div style={{ position: "absolute", top: 30, left: 0, right: 0, ...T, color: "#F4EEE2", fontSize: 40, fontWeight: 700 }}>{c.title}</div>
    <div style={{ position: "absolute", top: 90, left: 80, right: 80, ...T, color: "#C9A24A", fontSize: 23 }}>{c.sub}</div>
    {/* لوحتان عموديتان 9:16 بارتفاع 720 */}
    <div style={{ position: "absolute", left: 1000, top: 160, width: 1080, height: 1920, transform: "scale(0.375)", transformOrigin: "0 0", overflow: "hidden" }}>{c.before}</div>
    <div style={{ position: "absolute", left: 515, top: 160, width: 1080, height: 1920, transform: "scale(0.375)", transformOrigin: "0 0", overflow: "hidden" }}>{c.after}</div>
    <div style={{ position: "absolute", left: 1000, top: 890, width: 405, ...T, color: "#A9C3B9", fontSize: 26, fontWeight: 700 }}>{c.beforeLabel}</div>
    <div style={{ position: "absolute", left: 515, top: 890, width: 405, ...T, color: "#F2B35B", fontSize: 26, fontWeight: 700 }}>{c.afterLabel}</div>
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 40, ...T, color: "#6F8F84", fontSize: 21 }}>{c.footer}</div>
  </AbsoluteFill>
);

export const lightLab009 = (id: string): React.FC => {
  const c = LIGHT_CASES_009.find((x) => x.id === id)!;
  const C: React.FC = () => (c.portrait ? <PortraitSplit c={c} /> : <Split c={c} />);
  return C;
};
