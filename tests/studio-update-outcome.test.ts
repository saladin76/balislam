import { describe, expect, it } from "vitest";
import { updateOutcome } from "../app/src/ui/updateOutcome";

describe("نتيجة تحديث الاستوديو", () => {
  it("يرفض عرض إعادة التحميل عندما يوقف الخادم التحديث لحماية الملفات", () => {
    expect(updateOutcome({ ok: false, message: "هناك تعارض Git" })).toBe("failure");
    expect(updateOutcome({ ok: false, message: "فشل تثبيت الاعتماديات", reinstalled: true })).toBe("failure");
  });
  it("يطلب إعادة تشغيل الاستوديو فقط عند تحديث اعتماديات ناجح", () => {
    expect(updateOutcome({ ok: true, message: "تم التحديث", reinstalled: true })).toBe("restart");
  });
  it("يعيد التحميل فقط بعد نجاح تحديث لا يحتاج تثبيتًا", () => {
    expect(updateOutcome({ ok: true, message: "تم تحديث الشيفرة" })).toBe("reload");
  });
});
