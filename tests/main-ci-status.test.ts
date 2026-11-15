import { describe, expect, it } from "vitest";
import { formatMainCi, type MainRun } from "../src/studio/mainCiStatus";

const run = (sha: string, conclusion: string | null, title = "حفظ الاستوديو: دفاتر الزمن 001: الخطة"): MainRun =>
  ({ sha, conclusion, status: conclusion ? "completed" : "in_progress", title, url: `https://example.test/${sha}` });

describe("حالة main في CI أول «bal notes --open» (KI-068، D137)", () => {
  it("أخضر سطرًا واحدًا، وأحمر بأول commit فاشل منذ آخر أخضر وعدد الفاشلة", () => {
    expect(formatMainCi([run("aaaaaaaa11", "success")])).toContain("أخضر (aaaaaaaa)");
    const red = formatMainCi([run("cccccccc", null), run("bbbbbbbb", "failure"), run("dddddddd", "failure"), run("eeeeeeee", "success"), run("ffffffff", "failure")]);
    expect(red).toContain("main أحمر في CI منذ dddddddd");
    expect(red).toContain("(2 تشغيل فاشل)"); // owner-pin-ok: بيانات مصطنعة
    expect(red).toContain("https://example.test/bbbbbbbb");
    expect(formatMainCi([run("cccccccc", null)])).toContain("لا تشغيل مكتمل");
  });
});
