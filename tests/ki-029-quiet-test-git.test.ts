import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { cleanGitEnv } from "../scripts/git-env.mjs";

/**
 * KI-029 (D113): دفع الاختبارات إلى مستودع على القرص لا يكتب «push negotiation failed» ولو كان
 * `push.negotiate=true` في إعداد git العام، فلا يختفي الخطأ الحقيقي في مخرجات `npm run check`.
 */
describe("KI-029: دفع الاختبارات بلا ضجيج التفاوض", () => {
  it("كل git في الاختبارات يعمل بـ push.negotiate=false (يفوق إعداد الجهاز العام)", () => {
    expect(execFileSync("git", ["config", "--get", "push.negotiate"], { env: cleanGitEnv(), encoding: "utf8" }).trim()).toBe("false");
  });
});
