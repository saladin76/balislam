import path from "node:path";

/** خطأ برسالة عربية ورمز HTTP محدد (بدل 500 برسالة إنجليزية). */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** فك ترميز اسم ملف من الرابط دون انهيار عند ترميز خاطئ. */
export const safeName = (s: string) => {
  try {
    return path.basename(decodeURIComponent(s));
  } catch {
    throw new HttpError(400, "اسم الملف غير صالح.");
  }
};
