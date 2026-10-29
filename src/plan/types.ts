import type { Domain, ThemeId } from "../../brand/themes";

/** مؤثر صوتي داخل مشهد: at بالثواني من بداية المشهد. */
export type PlanSfx = { id: string; at: number };

export type PlanScene = {
  /** ثابت لا يتغير عند إعادة التوليد: c<الفصل>-s<الترتيب> */
  id: string;
  template: string;
  /** نص التعليق الصوتي (مصدره السكريبت؛ يُعدَّل هناك) */
  narration: string;
  /** سطر البداية في script.md */
  line: number;
  /** حقول القالب (السؤال، الشخصية، العنصر…) */
  props: Record<string, string>;
  /** مدة يدوية بالثواني؛ إن غابت تُحسب من طول التعليق */
  durationSec?: number;
  /** خلفية من المكتبة؛ إن غابت تُستخدم زخرفة الثيم */
  backdrop?: string;
  captions?: boolean;
  sfx: PlanSfx[];
  /** للآيات: مفتاح مثل 53:39 */
  ayahKey?: string;
  /** عدّلها المستخدم يدويًا: تُحفظ عند إعادة التوليد */
  edited?: boolean;
};

export type PlanChapter = { number: number; title: string; scenes: PlanScene[] };

export type Plan = {
  version: 1;
  episode: string;
  title: string;
  domain: Domain;
  themeId: ThemeId;
  updatedAt: string;
  chapters: PlanChapter[];
};
