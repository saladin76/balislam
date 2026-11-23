/** قرار المالك (٢٣ نوفمبر): لا تُشطب كلمات من القرآن ولو كانت على لسان إبليس («ملكين» و«من الخالدين»، الأعراف ٢٠). */
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";

describe("c1-s31 (الوسوسة): الوعدان بلا شطب", () => {
  it("لا خط شطب في مشهد الوسوسة، والقوس ينسب الكلمتين إلى «زعم»", async () => {
    const code = await readFile(path.join(import.meta.dirname, "..", "src/remotion/dafatir/horizon/episode001c.tsx"), "utf8");
    const a = code.indexOf("const Whisper"), b = code.indexOf("\n};", a);
    const body = code.slice(a, b);
    expect(body).toContain('"ملكين"');
    expect(body).not.toMatch(/<Strike\b/);
    expect(body).toContain("bracket");
  });
});
