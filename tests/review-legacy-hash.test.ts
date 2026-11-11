import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseScript } from "../src/script/parse";
import { reviewItems } from "../src/script/review";

/** اعتمادات سجل التوثيق التي سُجّلت قبل ربط بصمة الآية بنصها تبقى صالحة لغير الآيات ما دام نصها لم يتغير. */
describe("سجل التوثيق: توافق البصمة القديمة", () => {
  it("حلقة زبدة الكتب 001: الاعتمادات القديمة لغير الآيات لا تظهر «تغيّر بعد الاعتماد»", () => {
    const dir = path.join("channels", "zubdat-alkutub", "episodes", "001-awwal-marra-osalli");
    // السكريبت الذي وُثّقت عليه الاعتمادات (قبل السكريبت المعتمد الجديد، ١١ نوفمبر): التوافق يُقاس عليه؛
    // ونصوص الاستشهاد التي غيّرها السكريبت الجديد تعود للمراجعة كما يجب (الاختبار التالي).
    const sp = path.join("tests", "fixtures", "zubdat-001-script-legacy-hash.md");
    const items = reviewItems(parseScript(readFileSync(sp, "utf8"), sp), JSON.parse(readFileSync(path.join(dir, "review.json"), "utf8")));
    const changedNonAyah = items.filter((i) => i.kind !== "ayah" && i.status === "changed");
    expect(changedNonAyah).toEqual([]);
    expect(items.some((i) => i.status === "verified")).toBe(true);
  });
  it("تغيير نص الاستشهاد بعد الاعتماد ما زال يلغيه", () => {
    const dir = path.join("channels", "zubdat-alkutub", "episodes", "001-awwal-marra-osalli");
    const sp = path.join(dir, "script.md");
    const ledger = JSON.parse(readFileSync(path.join(dir, "review.json"), "utf8"));
    const items = reviewItems(parseScript(readFileSync(sp, "utf8"), sp), ledger);
    const target = items.find((i) => i.kind !== "ayah" && i.status === "verified")!;
    ledger.items[target.key].hash = "000000000000";
    const after = reviewItems(parseScript(readFileSync(sp, "utf8"), sp), ledger);
    expect(after.find((i) => i.key === target.key)!.status).toBe("changed");
  });
});
