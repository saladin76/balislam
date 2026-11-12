/**
 * KI-038 وKI-039 (بلاغات المالك ١٢ نوفمبر): لا تُعطى للمالك أوامر git/stash/pull/npm install (D101)،
 * وكل أمر `npx bal` يُعطى له يبدأ بـ `cd ~/balislam` — خارج المجلد يبحث npx عن حزمة `bal` في السجل العام
 * فيفشل بـ ENOVERSIONS قبل أن تعمل الأداة، فلا تستطيع الأداة نفسها منعه. الحماية في رسائل التكليف والخريطة.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repo = path.resolve(import.meta.dirname, "..");
const read = (rel: string) => readFileSync(path.join(repo, rel), "utf8");
const CHANNELS = ["balislam", "dafatir-alzaman", "zubdat-alkutub"];

describe("أوامر المالك في رسائل التكليف والخريطة", () => {
  it.each(CHANNELS)("%s: رسالة التكليف تمنع أوامر git وتبدأ أوامر npx bal بـ cd ~/balislam", (ch) => {
    const text = read(`docs/${ch}/briefing.md`);
    expect(text).toMatch(/لا تعطِني أوامر `git` أو `stash` أو `pull` أو `npm install` أبدًا/);
    expect(text).toContain("وأوامر `npx bal` التي أشغّلها تبدأ بـ `cd ~/balislam`");
    // الحفظ والاستقبال الآليان هما D101 (لا رقم قرار آخر)
    expect(text).toMatch(/يستقبل كل تحديث آليًا \(D101\)/);
    // لا سطر يطلب من المالك git stash أو git pull
    for (const line of text.split("\n")) {
      if (/لا تعطِني/.test(line)) continue;
      expect(line, line).not.toMatch(/git (stash|pull)\b/);
    }
  });

  it("الخريطة: تقرير المالك بلا أوامر git، وأمر npx bal يبدأ بـ cd ~/balislam (ENOVERSIONS)", () => {
    const map = read("docs/studio/studio-map.md");
    const report = map.slice(map.indexOf("**التقرير للمالك:**"), map.indexOf("## ز."));
    expect(report).toContain("لا أوامر git");
    expect(report).toContain("`npx bal` يُعطى له يبدأ بـ `cd ~/balislam &&`");
    expect(report).toContain("ENOVERSIONS");
  });
});
