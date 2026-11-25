/**
 * D225 (قرار المالك ٢٥ نوفمبر): نسبة الدعاء إلى النبي ﷺ على لوحة الدعاء (`dua-board`).
 * المنع هو الأصل: «النبي» أو «رسول» أو «ﷺ» في خانة المصدر مرفوض، إلا إذا كان المصدر حديثًا موثّقًا
 * في سجل التوثيق: استشهاد «حديث» في قسم «## الاستشهادات» في السكريبت يذكر المصدرُ مرجعَه نفسه
 * (مثل «صحيح مسلم 770»)، وحالته في review.json «موثّق».
 * - في CI لا يوجد review.json (يعيش في الاستوديو وحده)، فيُفحص وجود الاستشهاد فقط (`statusKnown: false`).
 * - في الاستوديو (بطاقة الجودة) تُشترط حالة «موثّق» أيضًا، وإلا ✗ يمنع النسخة النهائية.
 */
import { normalizeArabic } from "../script/quranMeta";

export const PROPHETIC_ATTRIBUTION = /النبي|رسول|ﷺ/;

export type HadithCitation = { ref: string; status?: "pending" | "changed" | "verified" | "rejected" };
type BoardLike = { id: string; template: string; props?: Record<string, unknown> };

const digits = (s: string) => s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
const norm = (s: string) => normalizeArabic(digits(s)).replace(/[·•،,:؛]/g, " ").replace(/\s+/g, " ").trim();

/** المرجع يُعدّ مذكورًا في المصدر إن ورد بكلماته نفسها، وفيه رقم (لا يكفي «صحيح مسلم» بلا رقم) */
const citesRef = (source: string, ref: string) => /\d/.test(digits(ref)) && norm(source).includes(norm(ref));

/**
 * مشاكل النسبة النبوية في لوحات الدعاء. `statusKnown` = هل سجل التوثيق متاح (الاستوديو)؛
 * إن لم يكن (CI) يكفي وجود الاستشهاد في السكريبت، ولا يُتجاوز المنع أبدًا بلا استشهاد مطابق.
 */
export const duaAttributionProblems = (scenes: BoardLike[], hadiths: HadithCitation[], statusKnown: boolean) =>
  scenes
    .filter((s) => s.template === "dua-board")
    .flatMap((s) => {
      const source = String(s.props?.source ?? "");
      if (!PROPHETIC_ATTRIBUTION.test(source)) return [];
      const match = hadiths.find((h) => citesRef(source, h.ref));
      if (!match) return [{ sceneId: s.id, reason: "نسبة إلى النبي ﷺ بلا حديث موثّق في سجل التوثيق يذكره المصدر." }];
      if (statusKnown && match.status !== "verified")
        return [{ sceneId: s.id, reason: `الحديث «${match.ref}» غير موثّق بعد في سجل التوثيق.` }];
      return [];
    });
