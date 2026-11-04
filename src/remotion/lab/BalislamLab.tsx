import React from "react";
import { AbsoluteFill } from "remotion";
import { AlleyTale, type AlleyTaleProps } from "../scenes/AlleyTale";

/**
 * مختبر استوديو «بالإسلام»: اختبارات بصرية قصيرة لقدرات المحرك (لا حلقة ولا قصة، بلا صوت).
 * تُرندر وتُرفع إلى «المعاينات» في مجلد 000-engine-lab للمراجعة، ولا تُنشر أبدًا.
 */
export const LAB_SCENE: Omit<AlleyTaleProps, "themeId" | "orientation" | "cameraMode"> = {
  narration: "يمشي في الحارة مساء. يقف أمام الباب ويفكر. ثم يعرف الحقيقة.",
  place: "alley",
  mood: "night",
  cast: "solo",
  poses: "walk,stand,look-up",
  look: "hero",
  cues: "door | الباب\nthink | ويفكر\ntruth | الحقيقة",
  camera: "push",
};

const Label: React.FC<{ text: string; sub: string; x: number }> = ({ text, sub, x }) => (
  <div style={{ position: "absolute", left: x, top: 720, width: 960, textAlign: "center", fontFamily: "Tajawal, sans-serif", direction: "rtl" }}>
    <div style={{ color: "#F4EEE2", fontSize: 34, fontWeight: 700 }}>{text}</div>
    <div style={{ color: "#A9C3B9", fontSize: 24, marginTop: 8 }}>{sub}</div>
  </div>
);

/** مقارنة متزامنة: نفس الكلمات والمشهد والتوقيت، والفرق في الكاميرا وحركة البطل فقط */
export const CameraAB: React.FC = () => (
  <AbsoluteFill style={{ background: "#071512" }}>
    <div style={{ position: "absolute", left: 960, top: 160, width: 1920, height: 1080, transform: "scale(0.5)", transformOrigin: "0 0", overflow: "hidden" }}>
      <AlleyTale {...LAB_SCENE} themeId="night" orientation="landscape" cameraMode="automatic" />
    </div>
    <div style={{ position: "absolute", left: 0, top: 160, width: 1920, height: 1080, transform: "scale(0.5)", transformOrigin: "0 0", overflow: "hidden" }}>
      <AlleyTale {...LAB_SCENE} themeId="night" orientation="landscape" cameraMode="composed" />
    </div>
    <Label x={960} text="قبل: التأطير الآلي" sub="قطع مع كل سطر، وخطوات وإيماءات حشو متكررة" />
    <Label x={0} text="بعد: الكاميرا المؤلَّفة" sub="حركتان على كلمتي المعنى، والبطل لا يتحرك بلا سبب" />
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 40, textAlign: "center", color: "#6F8F84", fontSize: 22, fontFamily: "Tajawal, sans-serif", direction: "rtl" }}>
      مختبر المحرك · اختبار بصري بلا صوت · لا يُنشر
    </div>
  </AbsoluteFill>
);

export const CameraComposedPortrait: React.FC = () => <AlleyTale {...LAB_SCENE} themeId="night" orientation="portrait" cameraMode="composed" />;
