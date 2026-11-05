/**
 * بيانات مشاهد المكتبة العامة لـ«دفاتر الزمن» (بلا React): مشاهد تُضبط من الخطة بحقولها، لا ترتبط بحلقة.
 * تُدمج في HZ_META فتظهر في قائمة «المشهد» بالاستوديو لكل حلقة من القناة. التوثيق: docs/dafatir-alzaman/03-tools.md
 */
import type { HzMeta } from "../horizon/meta";

export const LIB_META: Record<string, HzMeta> = {
  chapter: { nameAr: "عنوان الفصل (بلا كلام)", tail: 0, exit: "none", seconds: 3.2 },
  "verse-intro": { nameAr: "تمهيد آية (صفحة ساكنة)", tail: 1.0, exit: "none", still: "verse-intro" },
  "verse-tag": { nameAr: "تمهيد آية بختم سورتها", tail: 1.0, exit: "none" },
  pending: { nameAr: "قيد التصميم (مكان المشهد في الخطة)", tail: 1.0, exit: "none" },
  "lib-term": { nameAr: "مكتبة · مصطلح يُكتب بالحبر (مع مصدره)", tail: 1.2, exit: "fade" },
  "lib-gloss": { nameAr: "مكتبة · متن وحاشية وتعليق (فصل المصادر)", tail: 1.4, exit: "turn" },
  "lib-compare": { nameAr: "مكتبة · مقارنة قولين أو موقفين أو دليلين", tail: 1.3, exit: "fade" },
  "lib-timeline": { nameAr: "مكتبة · خط زمني بعلامات وفجوات", tail: 1.4, exit: "fade" },
  "lib-evidence": { nameAr: "مكتبة · شواهد أثرية وحدودها", tail: 1.4, exit: "fade" },
};

/** نسخة من SACRED_WORD في src/render/stillness.ts (يتحقق اختبار من تطابقهما) — لا يُستورد هناك حتى لا يدخل كود الرندر إلى المشاهد */
export const LIB_SACRED = /الله|لله|ربنا|ربه|ربك|سبحانه|تعالي|تعالى/;
