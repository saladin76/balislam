/**
 * «النص المشكول» (D132): نسخة الملف وفحص نصه، بلا أي اعتماد على القرص أو الصوت (تستعمله بوابة المحتوى أيضًا).
 */
import { createHash } from "node:crypto";

/** حد حجم النسخة المشكولة (نص؛ أقل من حد الحفظ الآلي CONTENT_MAX_BYTES). */
export const TASHKEEL_MAX_BYTES = 2 * 1024 * 1024;
/** نسخة الملف كما فُتح: بصمته، أو «none» إن لم يوجد */
export const tashkeelRevision = (text: string | null) => (text === null ? "none" : createHash("sha256").update(text).digest("hex"));

/** فحص نص الملف قبل حفظه وفي بوابة المحتوى: قائمة أخطاء بالعربية (فارغة إن صلح). */
export const checkTashkeelText = (text: string): string[] => {
  const out: string[] = [];
  if (!text.trim()) out.push("النسخة المشكولة فارغة؛ لم تُحفظ. اكتب النص المشكول أو أنشئه من السكريبت.");
  if (Buffer.byteLength(text, "utf8") > TASHKEEL_MAX_BYTES) out.push("النسخة المشكولة أكبر من الحد (٢ ميغابايت)؛ هذا ليس نص حلقة.");
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text)) out.push("في النسخة المشكولة رموز تحكم لا تُكتب في نص؛ ربما لُصق ملف غير نصي.");
  if (text.includes("\uFFFD")) out.push("في النسخة المشكولة حروف تالفة (�)؛ ربما حُفظ الملف بترميز غير UTF-8.");
  return out;
};

