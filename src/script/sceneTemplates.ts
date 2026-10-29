/** قوالب المشاهد الاثنا عشر (مكتبة المشاهد في دليل القناة). */
export const SCENE_TEMPLATES = {
  "big-question": "سؤال كبير",
  "character-talk": "شخصية تتكلم",
  "verse-card": "بطاقة آية",
  "hadith-card": "بطاقة حديث",
  comparison: "مقارنة",
  list: "قائمة",
  "big-number": "رقم كبير",
  chart: "رسم بياني",
  timeline: "خط زمني",
  symbolic: "مشهد رمزي",
  summary: "خلاصة",
  "end-screen": "شاشة النهاية",
} as const;

export type SceneTemplateId = keyof typeof SCENE_TEMPLATES;

export const DEFAULT_SCENE: SceneTemplateId = "character-talk";

export const isSceneTemplate = (id: string): id is SceneTemplateId => id in SCENE_TEMPLATES;
