/**
 * KI-009 (قرار المالك ١٢ نوفمبر، ١٨:٤٦): رسالة الخادم غير المترجمة تظهر للمالك جملةً عربية بسيطة،
 * والنص التقني الأصلي مطويّ تحت «تفاصيل» لا يُفتح إلا بضغطه.
 * - ownerMessage يبقي الصيغة نفسها (العربية ثم «(التفاصيل: …)»)، فلا يضيع النص الأصلي لمن يرسله إلى Claude.
 * - splitOwnerDetails يفصلهما، وOwnerText يعرض العربية وحدها و<details> مطويًا (بلا open).
 * - كل موضع في الواجهة يعرض رسالة خطأ أو حالة يمر على OwnerText، فلا يظهر النص التقني مكشوفًا في أي شاشة.
 */
import React from "react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ownerMessage, splitOwnerDetails, UNTRANSLATED } from "../app/src/serverMessages";
import { OwnerText } from "../app/src/ui/OwnerText";

const repo = path.resolve(import.meta.dirname, "..");
const RAW = "ENOENT: no such file or directory, open '/Users/x/balislam/channels/a/plan.json' at Object.openSync (node:fs:573:3)";

describe("رسالة الخادم غير المترجمة", () => {
  it("العربية أولًا، والنص الأصلي كاملًا تفاصيلَ يمكن فصلها", () => {
    const m = ownerMessage(RAW);
    expect(m.startsWith(UNTRANSLATED)).toBe(true);
    expect(splitOwnerDetails(m)).toEqual({ lead: UNTRANSLATED, details: RAW });
  });

  it("تبقى مفصولة ولو سبقها نص من الشاشة نفسها", () => {
    expect(splitOwnerDetails(`تعذّر حفظ السكريبت: ${ownerMessage("Boom happened.")}`))
      .toEqual({ lead: `تعذّر حفظ السكريبت: ${UNTRANSLATED}`, details: "Boom happened." });
  });

  it("الرسالة المترجمة أو العربية لا تُمس ولا تُطوى", () => {
    expect(splitOwnerDetails(ownerMessage("Unknown scene."))).toEqual({ lead: "مشهد غير معروف.", details: null });
    expect(splitOwnerDetails("تعذّر النسخ (التفاصيل: شيء)")).toEqual({ lead: "تعذّر النسخ (التفاصيل: شيء)", details: null });
  });

  it("OwnerText: العربية ظاهرة، والنص التقني تحت «تفاصيل» مطويًا", () => {
    const html = renderToStaticMarkup(<p role="alert"><OwnerText text={ownerMessage(RAW)} /></p>);
    const shown = html.slice(0, html.indexOf("<details"));
    expect(shown).toContain(UNTRANSLATED);
    expect(shown).not.toContain("ENOENT");
    expect(html).toMatch(/<details[^>]*><summary[^>]*>تفاصيل<\/summary>/);
    expect(html).not.toMatch(/<details[^>]*\bopen\b/);
    expect(html).toContain("ENOENT: no such file");
    expect(renderToStaticMarkup(<OwnerText text="جاهز" />)).toBe("جاهز");
  });
});

describe("كل شاشة تعرض الرسائل عبر OwnerText", () => {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const f = path.join(d, n);
      if (statSync(f).isDirectory()) walk(f);
      else if (f.endsWith(".tsx")) files.push(f);
    }
  };
  walk(path.join(repo, "app/src"));

  it("لا موضع يعرض رسالة خطأ أو حالة نصًا خامًا", () => {
    const RAW_RENDER = /\{(?:error|err|note|msg|voiceMsg|p\.voiceMsg|toast\.msg|msg\.text|job\.error|vmsg|play\.msg)\}<|(?<!text=)\{(?:vmsg|play\.msg) ?(?:\|\||\?\?)|(?<!text=\{)j\.error \?\? "فشل"\}/;
    const bad: string[] = [];
    for (const f of files) {
      readFileSync(f, "utf8").split("\n").forEach((line, i) => {
        if (RAW_RENDER.test(line)) bad.push(`${path.relative(repo, f)}:${i + 1}`);
      });
    }
    expect(bad).toEqual([]);
  });
});
