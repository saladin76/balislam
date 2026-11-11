/**
 * الأقسام الإنتاجية (الفصول) بيانات إنتاج اختيارية، لا بنية مفروضة على النص (D82، اعتمده صاحب المشروع ١١ نوفمبر (D83)):
 * - السكريبت نص متصل؛ «## الفصل N» أو «## الفصل N · عنوان» تقسيم داخلي اختياري (0..N) للإنتاج والمراجعة.
 * - عنوان القسم لا يُنطق ولا يُترجم ولا يظهر على الشاشة ما لم تطلب القناة ذلك صراحة
 *   (channel.json → script.divisionTitlesOnScreen = true)، والقاعدة واحدة للقنوات كلها بلا استثناء باسم قناة.
 * - عدد الأقسام لا يُشترط إلا إن طلبته القناة صراحة (channel.json → script.fixedChapters = true).
 * - الشورتس لا تُشتق من عدد الأقسام: تُحدَّد مقاطعها في الخطة (plan.shorts، src/plan/shorts.ts).
 */
import type { ChannelInfo } from "../channel/types";

export type DivisionRules = {
  /** عدد الأقسام وطولها مفروضان (config.json → episode) — لا يكون إلا باختيار صريح */
  fixed: boolean;
  /** عنوان القسم يظهر شارةً أعلى المشهد — لا يكون إلا باختيار صريح */
  titlesOnScreen: boolean;
};

type ScriptRules = { fixedChapters?: boolean; divisionTitlesOnScreen?: boolean } | undefined;

export const divisionRules = (script: ScriptRules): DivisionRules => ({
  fixed: script?.fixedChapters === true,
  titlesOnScreen: script?.divisionTitlesOnScreen === true,
});

/**
 * الشارة أعلى المشهد من القسم: لا شيء افتراضيًا (العنوان بيانات إنتاج)، ولا شيء أبدًا لقسم بلا عنوان أو ضمني
 * (فلا يظهر «الفصل 1 · » فارغًا). إن طلبت القناة العناوين على الشاشة: «الفصل N · العنوان»، أو العنوان وحده
 * حين chapterNumbers = false.
 */
export const divisionEyebrow = (
  channel: Pick<ChannelInfo, "script"> | undefined,
  chapterWord: string,
  chapter: { number: number; title: string; implicit?: boolean },
): string | undefined => {
  const title = chapter.title.trim();
  if (!title || chapter.implicit || !divisionRules(channel?.script).titlesOnScreen) return undefined;
  return channel?.script?.chapterNumbers === false ? title : `${chapterWord} ${chapter.number} · ${title}`;
};

/**
 * هل يُذكر القسم في الاستوديو؟ (D87، طلب صاحب القناة «لا فصول، السرد واحد»): الخطة بقسم واحد بلا عنوان
 * سرد واحد متصل، فلا يظهر «الفصل ١» في أي مكان (رأس المشهد، الجمل، الوصلات، اللوحات، المعاينة). غير ذلك كما كان.
 */
export const showsDivision = (all: readonly { title: string }[], chapter: { title: string }): boolean =>
  all.length > 1 || Boolean(chapter.title.trim());

/** الخطة أو السكريبت سرد واحد متصل: قسم واحد (أو لا قسم) بلا عنوان */
export const isSingleNarration = (all: readonly { title: string }[]): boolean =>
  all.length <= 1 && !all.some((c) => c.title.trim());
