import { templateDefs } from "../plan/templates";

/**
 * قوالب المشاهد المسموح بها في السكريبت: مصدرها الوحيد تعريفات القوالب في src/plan/templates.ts،
 * فأي قالب جديد يُقبل في الفحص تلقائيًا.
 */
export const SCENE_TEMPLATES: Record<string, string> = Object.fromEntries(templateDefs.map((t) => [t.id, t.nameAr]));

export type SceneTemplateId = string;

export const DEFAULT_SCENE: SceneTemplateId = "character-talk";

export const isSceneTemplate = (id: string): boolean => Object.hasOwn(SCENE_TEMPLATES, id);
