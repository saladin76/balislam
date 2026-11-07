import path from "node:path";

/** خطأ برسالة عربية ورمز HTTP محدد (بدل 500 برسالة إنجليزية). */
export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Accept one filename only; never silently turn a traversal URL into a different file. */
export const safeName = (s: string) => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(s);
  } catch {
    throw new HttpError(400, "اسم الملف غير صالح.");
  }
  if (!decoded || decoded === "." || decoded === ".." ||
      decoded !== path.basename(decoded) || /[\\\\/\0]/.test(decoded))
    throw new HttpError(400, "اسم الملف غير صالح.");
  return decoded;
};
