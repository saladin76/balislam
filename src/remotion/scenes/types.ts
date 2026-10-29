import type { ThemeId } from "../../../brand/themes";
import type { CharacterPose, CharacterVariant } from "../../../characters/Character";
import type { WordTiming } from "./timing";

export type Orientation = "landscape" | "portrait";

/** ما تشترك فيه كل القوالب. */
export type SceneBase = {
  themeId: ThemeId;
  orientation: Orientation;
  /** نص التعليق الصوتي لهذا المشهد (للترجمة أسفل الشاشة) */
  narration?: string;
  /** توقيت كلمات التعليق إن وُجد صوت؛ وإلا يُقدَّر */
  narrationTimings?: WordTiming[];
  /** إظهار شريط الترجمة */
  captions?: boolean;
  /** عنوان الفصل الصغير أعلى المشهد */
  eyebrow?: string;
  /** خلفية من مكتبة العناصر بدل زخرفة الثيم */
  backdrop?: string;
};

export type BigQuestionProps = SceneBase & {
  question: string;
  /** كلمة أو عبارة داخل السؤال تُميَّز */
  highlight?: string;
  /** عنصر من المكتبة فوق السؤال */
  element?: string;
};

export type VerseCardProps = SceneBase & {
  /** نص الآية كما جاء من المصدر المعتمد، بلا أي تعديل */
  text: string;
  /** مثل: النجم · ٣٩ */
  reference: string;
  /** اسم القارئ إن صاحب الآيةَ تلاوةٌ مرخّصة */
  reciter?: string;
  /** ترجمة معنى الآية بلغة الحلقة (للقنوات غير العربية) */
  meaning?: string;
  /** اسم الترجمة، يظهر صغيرًا للنسبة */
  meaningSource?: string;
  /** سطر صغير للمعاينة مثل «نص تجريبي» */
  sourceNote?: string;
};

export type CharacterTalkProps = SceneBase & {
  variant: CharacterVariant;
  pose: CharacterPose;
  /** ما يظهر في فقاعة الكلام (عبارة قصيرة) */
  line: string;
  /** عنصر يظهر بجوار الشخصية */
  element?: string;
  /** جهة الشخصية في الشاشة الأفقية */
  side?: "right" | "left";
};

/** حقول نصية لقالب (قيم الخطة كلها نصوص؛ القائمة سطر لكل عنصر). */
export type StringFields<K extends string> = Partial<Record<K, string>>;
