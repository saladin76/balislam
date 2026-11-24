/**
 * D220: فحص «بطاقة الآية تطابق المصدر» على الخادم وفي الأوامر (يقرأ نص Tanzil من الملف، فلا يدخل حزمة المتصفح).
 * planIssues (validate.ts) خالص ويعمل في المتصفح أيضًا، فيُضاف هذا إلى نتيجته حيث يمنع: «اصنع النسخة النهائية»
 * (render/episode.ts)، وإخراج الحزمة (package/make.ts)، وأخطاء الخطة في الاستوديو (GET الحلقة، والنظرة العامة)،
 * وبوابة المحتوى (scripts/contentGate.mts)، وبطاقة الجودة (quality/measure.ts).
 */
import type { Plan } from "../plan/types";
import type { PlanIssue } from "../plan/validate";
import type { ParsedScript } from "../script/types";
import { quranFromScript } from "./scriptText";
import { tanzilVerses } from "./tanzil";
import { planVerseMismatches, scriptVerseMismatches } from "./verseSource";

/** كل نص آية معروض في الخطة لا يطابق Tanzil حرفًا حرفًا: خطأ يمنع، ومعروف من الخطة نفسها (early) */
export const verseSourceIssues = (plan: Pick<Plan, "chapters">): PlanIssue[] =>
  planVerseMismatches(plan, tanzilVerses).map((m) => ({ level: "error", sceneId: m.sceneId, message: m.message, early: true }));

/** آيات السكريبت ([آية: مرجع | نص]) التي لا تطابق المصدر، بسطرها */
export const scriptVerseSourceIssues = (parsed: ParsedScript): { key: string; line: number; message: string }[] =>
  scriptVerseMismatches(quranFromScript(parsed).ayahs, tanzilVerses);
