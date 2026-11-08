import { describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { channelSandbox } from "./helpers/channelSandbox";

/**
 * اختبارات ارتداد لسلامة الاختبارات (القضية 4 في developer-issues.md، ٨ نوفمبر):
 * 1. مهلة recitation/quran-text-only: نسخ مجلد القناة كاملًا (600 م.ب بلوحات الستوري بورد) في beforeAll.
 * 2. تسرب /tmp: نسخ بحجم القناة تبقى بعد كل تشغيل لأن afterAll لا يحذفها، أو لأن الملف فشل قبله.
 */
const sizeOf = (p: string): number => (statSync(p).isDirectory() ? readdirSync(p).reduce((n, f) => n + sizeOf(path.join(p, f)), 0) : statSync(p).size);

describe("سلامة الاختبارات", () => {
  it("كل ما يُكتب في المجلد المؤقت يقع داخل مجلد هذا التشغيل، ويُحذف في نهايته", () => {
    const run = process.env.BAL_TEST_RUN_TMP;
    expect(run, "globalSetup: tests/setup/runTmp.ts").toBeTruthy();
    expect(path.basename(run!)).toMatch(/^bal-test-run-/);
    expect(os.tmpdir()).toBe(run);
    const cfg = readFileSync(path.join(__dirname, "..", "vitest.config.ts"), "utf8");
    expect(cfg).toContain("tests/setup/runTmp.ts");
  });

  it("نسخة القناة للاختبار بلا حلقاتها الحقيقية: صغيرة وسريعة، وتُحذف", () => {
    const t0 = Date.now();
    const sb = channelSandbox("bal-hygiene-");
    const ms = Date.now() - t0;
    try {
      expect(readdirSync(path.join(sb.channelDir, "episodes"))).toEqual(["000-demo"]);
      expect(existsSync(path.join(sb.channelDir, "channel.json"))).toBe(true);
      expect(sizeOf(sb.root)).toBeLessThan(30 * 1024 * 1024);
      expect(ms).toBeLessThan(5000);
      expect(sb.root.startsWith(os.tmpdir())).toBe(true);
    } finally {
      sb.cleanup();
    }
    expect(existsSync(sb.root)).toBe(false);
  });

  it("لا ملف اختبار ينسخ مجلد قناة كاملًا بحلقاته، وكل نسخة قناة تُحذف في afterAll", () => {
    const dir = __dirname;
    const files = readdirSync(dir).filter((f) => /\.test\.tsx?$/.test(f));
    for (const f of files) {
      const src = readFileSync(path.join(dir, f), "utf8");
      const copies = src.match(/cpSync\(path\.join\(__dirname, "\.\.", "channels", "[a-z-]+"\)[^\n]*/g) ?? [];
      for (const line of copies) expect(line, `${f}: نسخ القناة يجب أن يستثني الحلقات (أو channelSandbox)`).toMatch(/episodes/);
      if (/channelSandbox\(/.test(src) && f !== "test-hygiene.test.ts") expect(src, `${f}: cleanup في afterAll`).toMatch(/afterAll\([\s\S]*?(cleanup\(\)|rm\(tempRoot)/);
    }
  });
});
