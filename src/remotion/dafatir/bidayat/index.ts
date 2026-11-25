/** لقطات «البدايات» الجديدة (دفاتر الزمن 002–009): الرسم. البيانات في ./meta.ts */
import type React from "react";
import type { BdProps } from "./kit";
import { BD02_SCENES, BD02_STILLS } from "./ep02";
import { BD03_SCENES, BD03_STILLS } from "./ep03";
import { BD04_SCENES, BD04_STILLS } from "./ep04";
import { BD05_SCENES, BD05_STILLS } from "./ep05";
import { BD06_SCENES, BD06_STILLS } from "./ep06";
import { BD07_SCENES, BD07_STILLS } from "./ep07";
import { BD08_SCENES, BD08_STILLS } from "./ep08";
import { BD09_SCENES, BD09_STILLS } from "./ep09";

export const BD_SCENES: Record<string, React.FC<BdProps>> = {
  ...BD02_SCENES,
  ...BD03_SCENES,
  ...BD04_SCENES,
  ...BD05_SCENES,
  ...BD06_SCENES,
  ...BD07_SCENES,
  ...BD08_SCENES,
  ...BD09_SCENES,
};

/** مشهد الصورة الثابتة لكل لقطة (أداة الصور للمراجعة) */
export const BD_STILLS: Record<string, string> = {
  ...BD02_STILLS,
  ...BD03_STILLS,
  ...BD04_STILLS,
  ...BD05_STILLS,
  ...BD06_STILLS,
  ...BD07_STILLS,
  ...BD08_STILLS,
  ...BD09_STILLS,
};
