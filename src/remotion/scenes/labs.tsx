import React from "react";
import { Composition } from "remotion";
import { GlobeLab, GLOBE_LAB_FPS, globeLabFrames } from "../dafatir/geo/GlobeLab";
import { KitLab, KIT_LAB_FPS, KIT_LAB_SEC } from "../three/KitLab";
import { ArchiveLab, ARCHIVE_LAB_FPS, archiveLabFrames } from "../dafatir/archive/ArchiveLab";
import { RahhalaLab, RAHHALA_FPS, rahhalaFrames } from "../dafatir/directions/Rahhala";
import { AstrolabeLab, ASTRO_FPS, astroFrames } from "../dafatir/directions/Astrolabe";
import { DeskWorldLab, WORLD_FPS, worldFrames } from "../dafatir/world/DeskWorld";
import { ShadowTheaterLab } from "../balislam/directions/ShadowTheater";
import { LightGeometryLab } from "../balislam/directions/LightGeometry";
import { PrintedAlleyLab } from "../balislam/directions/PrintedAlley";
import { IdeaMachineLab } from "../zubdat/directions/IdeaMachine";
import { BulaqPressLab } from "../zubdat/directions/BulaqPress";
import { ReadingRoomLab } from "../zubdat/directions/ReadingRoom";
import { ZDIR_FPS, zFrames } from "../zubdat/directions/common";
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
    {/* دفاتر الزمن: قالب «اللوح – خزانة الأرشيف» (D185)، صامت لا يُنشر */}
    <Composition id="dafatir-lab-archive" component={ArchiveLab} durationInFrames={archiveLabFrames()} fps={ARCHIVE_LAB_FPS} width={1920} height={1080} />
    {/* دفاتر الزمن: اتجاهات المقارنة (مراجع المنسّق ٢١ نوفمبر)، لا قوالب قبل اختيار المالك */}
    <Composition id="dafatir-dir-rahhala" component={RahhalaLab} durationInFrames={rahhalaFrames()} fps={RAHHALA_FPS} width={1920} height={1080} />
    <Composition id="dafatir-dir-astrolabe" component={AstrolabeLab} durationInFrames={astroFrames()} fps={ASTRO_FPS} width={1920} height={1080} />
    {/* دفاتر الزمن: «مكتب الرحّالة»، الاتجاهات الثلاثة في عالم واحد (توصية المنسّق ٢٢ نوفمبر)، صامت لا يُنشر */}
    <Composition id="dafatir-world-desk" component={DeskWorldLab} durationInFrames={worldFrames()} fps={WORLD_FPS} width={1920} height={1080} />

    {/* بالإسلام: اتجاهات المقارنة الثلاثة بثري دي (لا قالب قبل اختيار المالك)، صامتة لا تُنشر */}
    <Composition id="balislam-dir-geometry" component={LightGeometryLab} durationInFrames={dirFrames()} fps={DIR_FPS} width={1920} height={1080} />
    <Composition id="balislam-dir-alley" component={PrintedAlleyLab} durationInFrames={dirFrames()} fps={DIR_FPS} width={1920} height={1080} />
    <Composition id="balislam-dir-shadow" component={ShadowTheaterLab} durationInFrames={dirFrames()} fps={DIR_FPS} width={1920} height={1080} />
    {/* زبدة الكتب: اتجاهات المقارنة الثلاثة بثري دي (لا قالب قبل اختيار المالك)، صامتة لا تُنشر */}
    <Composition id="zubdat-dir-bulaq" component={BulaqPressLab} durationInFrames={zFrames()} fps={ZDIR_FPS} width={1920} height={1080} />
    <Composition id="zubdat-dir-reading" component={ReadingRoomLab} durationInFrames={zFrames()} fps={ZDIR_FPS} width={1920} height={1080} />
    <Composition id="zubdat-dir-machine" component={IdeaMachineLab} durationInFrames={zFrames()} fps={ZDIR_FPS} width={1920} height={1080} />
  </>
);
