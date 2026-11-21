import React from "react";
import { Composition } from "remotion";
import { GlobeLab, GLOBE_LAB_FPS, globeLabFrames } from "../dafatir/geo/GlobeLab";

/**
 * تكوينات مختبرات القوالب (المرحلة ٣، تيرمينال C): نماذج يراها المالك قبل أي قالب كامل، ولا تُنشر.
 * Root.tsx يعرضها في سطر واحد، وكل نموذج جديد يُسجَّل هنا لا في Root.tsx.
 */
export const TemplateLabs: React.FC = () => (
  <>
    {/* دفاتر الزمن: نموذج أداة الخرائط ثلاثية الأبعاد (كرة + حد يتغير + مدينة)، صامت لا يُنشر */}
    <Composition id="dafatir-lab-globe" component={GlobeLab} durationInFrames={globeLabFrames()} fps={GLOBE_LAB_FPS} width={1920} height={1080} />
  </>
);
