import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import config from "../../../config.json";
import type { Plan, PlanScene } from "../../plan/types";
import { sceneFrames } from "../../plan/duration";
import { Episode, episodeFrames } from "../scenes/Episode";
import type { Orientation } from "../scenes/types";

/**
 * مختبر الانتقالات (الأمر 011): مشاهد محايدة (الحارة ← السوق ← البيت بالتناوب، بطل وحده، بلا ذكر ولا آية)
 * تمر بالمحرك الحقيقي للحلقة (Episode)، وبين كل مشهدين انتقال مختلف من حقل `transition`،
 * أولها بلا الحقل (السلوك القائم) للمقارنة. بلا صوت، ولا يُنشر.
 */
type Case = { transition?: string; title: string; sub: string };
export const TRANSITION_CASES: Case[] = [
  { title: "بلا حقل · السلوك القائم", sub: "تلاشٍ قصير للخروج إلى الخلفية ثم دخول (مرجع المقارنة)" },
  { transition: "cut", title: "قطع مباشر · cut", sub: "قطع نظيف بلا انطفاء: خيار إخراجي كامل" },
  { transition: "fade dur 20", title: "مزج · fade", sub: "مزج حقيقي بين المشهدين (لا انطفاء إلى الخلفية)" },
  { transition: "push left dur 22 ease inout", title: "حركة كاميرا · push", sub: "المشهدان ينزلقان معًا كأن الكاميرا تنعطف" },
  { transition: "mask arch 0.55 0.62 dur 26", title: "قناع · mask arch", sub: "المشهد الجديد يُكشف من قوس محراب يتسع" },
  { transition: "through 0.55 0.6 dur 30", title: "عنصر مشترك · through", sub: "الكاميرا تدخل في البطل في الأول وتخرج منه في الثاني" },
  { transition: "morph arch star dur 32", title: "تحول هندسي · morph", sub: "قناع يتحول من قوس إلى النجمة الثمانية وهو يتسع" },
  { transition: "light 0.5 0.32 dur 36", title: "بالضوء · light", sub: "يخبو الأول نحو نقطة ضوء، ومنها ينتشر الثاني" },
  { transition: "carry left", title: "استمرار الحركة · carry", sub: "يخرج ماشيًا من الأول ويدخل الثاني بالسرعة نفسها (قطع على الحركة)" },
];

const PLACES = ["alley", "market", "home"] as const;
const LINES: Record<(typeof PLACES)[number], string> = { alley: "الحارة في المساء.", market: "السوق في المساء.", home: "البيت في المساء." };

export const transitionLabPlan = (withTransitions = true, cases: Case[] = TRANSITION_CASES): Plan => {
  const scenes: PlanScene[] = [];
  for (let i = 0; i <= cases.length; i++) {
    const place = PLACES[i % PLACES.length]!;
    const into = i > 0 ? cases[i - 1]! : undefined;
    const carryOut = cases[i]?.transition?.startsWith("carry");
    const carryIn = into?.transition?.startsWith("carry");
    scenes.push({
      id: `t${String(i + 1).padStart(2, "0")}`,
      template: "alley-tale",
      narration: LINES[place],
      line: i + 1,
      props: { place, mood: "night", cast: "solo", poses: "stand", look: "hero", cameraMode: "composed", gait: "walk" },
      durationSec: carryOut ? 8 : carryIn ? 7 : 3.4,
      sfx: [],
      ...(withTransitions && into?.transition ? { transition: into.transition } : {}),
    } as PlanScene);
  }
  return { version: 1, title: "مختبر الانتقالات", channel: "balislam", themeId: "night", chapters: [{ number: 1, title: "الانتقالات", scenes }] } as unknown as Plan;
};

/** لوحة اسم الانتقال حول كل حد (ثانية قبله حتى ثانية بعد نهايته) */
const Captions: React.FC<{ plan: Plan; cases: Case[]; portrait: boolean }> = ({ plan, cases, portrait }) => {
  const frame = useCurrentFrame();
  const scenes = plan.chapters[0]!.scenes;
  let t = 0;
  let label: Case | null = null;
  for (let i = 0; i < scenes.length - 1; i++) {
    t += sceneFrames(scenes[i]!);
    if (frame >= t - config.video.fps && frame < t + 2 * config.video.fps) label = cases[i]!;
  }
  if (!label) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: portrait ? 210 : 46, pointerEvents: "none" }}>
      <div style={{ background: "rgba(11,31,28,0.82)", border: "1px solid rgba(201,162,74,0.55)", borderRadius: 14, padding: portrait ? "14px 22px" : "10px 26px", textAlign: "center", direction: "rtl", fontFamily: "Tajawal, sans-serif", color: "#F4EEE2", maxWidth: portrait ? 940 : 1400 }}>
        <div style={{ fontSize: portrait ? 44 : 38, fontWeight: 700, color: "#F2B35B" }}>{label.title}</div>
        <div style={{ fontSize: portrait ? 30 : 26, opacity: 0.85, marginTop: 4 }}>{label.sub}</div>
        <div style={{ fontSize: portrait ? 24 : 22, opacity: 0.6, marginTop: 4, direction: "ltr", fontFamily: "IBM Plex Mono, monospace" }}>{label.transition ? `transition: ${label.transition}` : "transition: —"}</div>
      </div>
    </AbsoluteFill>
  );
};

export const TransitionLab: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const plan = React.useMemo(() => transitionLabPlan(), []);
  return (
    <AbsoluteFill>
      <Episode plan={plan} orientation={orientation} />
      <Captions plan={plan} cases={TRANSITION_CASES} portrait={orientation === "portrait"} />
    </AbsoluteFill>
  );
};
export const transitionLabFrames = () => episodeFrames({ plan: transitionLabPlan() });

/** المرجع: الخطة نفسها بلا أي حقل انتقال (للمقارنة البكسلية بالسلوك القائم) */
export const TransitionLabBaseline: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const plan = React.useMemo(() => transitionLabPlan(false), []);
  return <Episode plan={plan} orientation={orientation} />;
};
