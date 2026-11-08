import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScriptFixList } from "../app/src/shell/ScriptFixList";

describe("ما يمنع اعتماد السكريبت يظهر كقائمة تصحيحات", () => {
  it("يجمع الآيات الناقصة كشارات بالسورة والسطر، ويعرض بقية الأخطاء بنصها", () => {
    const html = renderToStaticMarkup(
      <ScriptFixList onLine={() => {}} errors={[
        { level: "error", code: "quran-text", line: 39, message: "نص الآية 2:30 غير مكتوب داخل السكريبت؛ اكتب [آية: البقرة 30 | النص بالتشكيل]." },
        { level: "error", code: "heading-level", line: 5, message: "عنوان فصل بمستوى غير صحيح" },
      ]} />,
    );
    expect(html).toContain("آيات تنقصها نصوصها");
    expect(html).toContain("البقرة ٣٠");
    expect(html).toContain("سطر ٣٩");
    expect(html).toContain("عنوان فصل بمستوى غير صحيح");
  });
});
