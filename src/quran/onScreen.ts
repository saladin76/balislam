/**
 * ما يتغير على الشاشة من عرض القرآن (طلب المالك ١٥ نوفمبر «لما يذكر ايه خليها تظهر على الشاشة»)،
 * بلا React: يستعمله الرندر لاختيار الطبقة، والسجل لإعادة فتح المشاهد التي تغيّر عرضها وحدها.
 */
import { hasBasmala } from "../voice/basmala";
import { pageLetterBudget, verseLetters, versePages } from "./versePages";

type SceneLike = { template: string; narration?: string; props?: Record<string, unknown> };

/** مشهد راوٍ فيه البسملة ولا يعرضها تصميمه بنفسه (بطاقة الآية، ولقطة «basmala» في دفاتر الزمن) */
export const showsBasmalaOverlay = (scene: SceneLike) =>
  scene.template !== "verse-card" && !(scene.template === "horizon-shot" && scene.props?.shot === "basmala") && hasBasmala(scene.narration);

/**
 * بصمة العرض الجديد للمشهد، أو null إن لم يتغير شيء على شاشته: البسملة فوق القالب، أو آية طويلة صارت صفحات.
 * تدخل بصمة مدخلات المشهد في السجل فقط حين لا تكون null، فلا يُعاد فتح مشهد لم يتغير عرضه (الآيات القصيرة كما هي).
 */
export const quranOnScreenSignature = (scene: SceneLike, verseStyle?: string): string | null => {
  const parts: string[] = [];
  if (showsBasmalaOverlay(scene)) parts.push("basmala-overlay-v1");
  const text = typeof scene.props?.text === "string" ? scene.props.text : "";
  // أصغر حد في قالب القناة (الرأسي 80، وبطاقة الحبر الأفقية 50): إن صارت الآية صفحات أو صغر خطها تغيّر عرضها
  if (scene.template === "verse-card" && text.trim()) {
    if (versePages(text, pageLetterBudget(verseStyle === "ink" ? 50 : 80)).length > 1) parts.push("verse-pages-v1");
    // بطاقة الحبر الأفقية: ما فوق ٥٠ حرفًا صار يصغر داخل مساحته بدل أن يتجاوزها
    else if (verseStyle === "ink" && verseLetters(text) > 50) parts.push("verse-fit-v1");
  }
  return parts.length ? parts.join("+") : null;
};
