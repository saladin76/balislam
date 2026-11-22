import React from "react";
import { Composition } from "remotion";
import { GlobeLab, GLOBE_LAB_FPS, globeLabFrames } from "../dafatir/geo/GlobeLab";
import { KitLab, KIT_LAB_FPS, KIT_LAB_SEC } from "../three/KitLab";
import { ShadowTheaterLab } from "../balislam/directions/ShadowTheater";
import { LightGeometryLab } from "../balislam/directions/LightGeometry";
import { PrintedAlleyLab } from "../balislam/directions/PrintedAlley";
import { DIR_FPS, dirFrames } from "../balislam/directions/common";

/**
 * تكوينات مختبرات القوالب (المرحلة ٣، تيرمينال C): نماذج يراها المالك قبل أي قالب كامل، ولا تُنشر.
 * Root.tsx يعرضها في سطر واحد، وكل نموذج جديد يُسجَّل هنا لا في Root.tsx.
 */
export const TemplateLabs: React.FC = () => (
  <>
    {/* دفاتر الزمن: نموذج أداة الخرائط ثلاثية الأبعاد (كرة + حد يتغير + مدينة)، صامت لا يُنشر */}
    <Composition id="dafatir-lab-globe" component={GlobeLab} durationInFrames={globeLabFrames()} fps={GLOBE_LAB_FPS} width={1920} height={1080} />
    {/* عدّة الثري دي المشتركة: أشكال رمادية محايدة لفحص الكاميرا والضوء والسكون المقصود، لا اتجاه بصري، صامت لا يُنشر */}
    <Composition id="kit-lab-3d" component={KitLab} durationInFrames={KIT_LAB_SEC * KIT_LAB_FPS} fps={KIT_LAB_FPS} width={1920} height={1080} />
    {/* بالإسلام: اتجاهات المقارنة الثلاثة بثري دي (لا قالب قبل اختيار المالك)، صامتة لا تُنشر */}
    <Composition id="balislam-dir-geometry" component={LightGeometryLab} durationInFrames={dirFrames()} fps={DIR_FPS} width={1920} height={1080} />
    <Composition id="balislam-dir-alley" component={PrintedAlleyLab} durationInFrames={dirFrames()} fps={DIR_FPS} width={1920} height={1080} />
    <Composition id="balislam-dir-shadow" component={ShadowTheaterLab} durationInFrames={dirFrames()} fps={DIR_FPS} width={1920} height={1080} />
  </>
);
