import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import config from "../../../config.json";
import type { Plan } from "../../plan/types";
import { Episode, episodeFrames } from "../scenes/Episode";
import { LightStage, lightStageSample } from "../scenes/LightStage";
import { RoadJourney, roadJourneySample } from "../scenes/RoadJourney";
import { PortraitSplit, Split } from "./LightLab";
import data from "./data/permanent-001-ch2.json";

/**
 * مختبر التوجيه الدائم: هل تستفيد الحلقات الجديدة من أدوات المحرك دون تعديل برمجي؟
 * - الفصل الثاني من الحلقة 001 بخطتها المعتمدة (يمين) وبالخطة نفسها لو أُنشئت جديدة بعد اعتماد الأساس (يسار):
 *   الفرق الوحيد ما يختمه الاعتماد في المشاهد (cameraMode = composed)، والمحرك نفسه في المسار الحقيقي (Episode).
 * - «الطريق» و«ظل ونور»: الحركة القديمة والطبيعية بالمشهد نفسه.
 * بلا صوت، ولا يُنشر، ولا يغيّر الحلقة 001 (بيانات منسوخة في data/).
 */
const legacy = data.legacy as unknown as Plan;
const defaults = data.defaults as unknown as Plan;
const FOOT = "التوجيه الدائم · مسار الإنتاج الحقيقي (Episode) · اختبار بصري بلا صوت · لا يُنشر";

export const permanentCh2Frames = () => Math.max(episodeFrames({ plan: legacy, chapter: 2 }), episodeFrames({ plan: defaults, chapter: 2 }));

export const PermanentCh2: React.FC<{ orientation: "landscape" | "portrait" }> = ({ orientation }) => {
  const c = {
    id: `permanent-ch2-${orientation}`,
    title: "حلقة جديدة بأدوات المحرك المعتمدة · الفصل ٢ من «اعرف الحق»",
    sub: "يمين: الخطة المعتمدة للحلقة 001 كما هي (لا تتغير). يسار: الخطة نفسها لو أُنشئت جديدة بعد اعتماد الكاميرا المؤلَّفة والمشي الطبيعي افتراضيًا",
    before: <Episode plan={legacy} orientation={orientation} chapter={2} />,
    after: <Episode plan={defaults} orientation={orientation} chapter={2} />,
    beforeLabel: "الحلقة 001 كما اعتُمدت",
    afterLabel: "حلقة جديدة بالافتراضي المقترح",
    footer: FOOT,
  };
  return orientation === "portrait" ? <PortraitSplit c={c} /> : <Split c={c} />;
};

const ROAD_S = 14;
const STAGE_S = 12;
export const permanentStylesFrames = () => (ROAD_S + STAGE_S) * config.video.fps;
/** «الطريق» ثم «ظل ونور»: يمين الحركة القديمة، يسار الطبيعية */
export const PermanentStyles: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={ROAD_S * config.video.fps} name="الطريق">
      <Split
        c={{
          title: "«الطريق»: طريقة المشي",
          sub: "قدم ثابتة على الطريق المتحرك، وتباطؤ عند المحطة واندفاع بعدها، ومتابعة الثوب (motion = natural)",
          before: <RoadJourney {...roadJourneySample} themeId="night" orientation="landscape" />,
          after: <RoadJourney {...roadJourneySample} motion="natural" themeId="night" orientation="landscape" />,
          beforeLabel: "القديمة",
          afterLabel: "الطبيعية",
          footer: FOOT,
        }}
      />
    </Sequence>
    <Sequence from={ROAD_S * config.video.fps} durationInFrames={STAGE_S * config.video.fps} name="ظل ونور">
      <Split
        c={{
          title: "«ظل ونور»: الانتقال بين العلامات",
          sub: "خطوات حقيقية إلى علامة كل سطر والتفاتة بالجسد، بدل الانزلاق السريع في 26 إطارًا (motion = natural)",
          before: <LightStage {...lightStageSample} themeId="night" orientation="landscape" />,
          after: <LightStage {...lightStageSample} motion="natural" themeId="night" orientation="landscape" />,
          beforeLabel: "القديمة",
          afterLabel: "الطبيعية",
          footer: FOOT,
        }}
      />
    </Sequence>
  </AbsoluteFill>
);
