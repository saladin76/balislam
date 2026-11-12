import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * KI-030 / العمل ١٠ (D113): لا اختبار يقرأ تاريخ Git للمستودع نفسه (`git show <sha>:…`، `git log`)، فيعمل في أي
 * نسخة ضحلة؛ ما يحتاج نسخة قديمة يقارن بنسخة مثبتة في tests/fixtures/. الاختبارات التي تبني مستودعًا مؤقتًا
 * وتقرأ تاريخه هي (cwd لمجلدها) خارج هذا الفحص. وفحص التكافؤ في CI لا يجلب التاريخ كاملًا بعدها.
 */
const root = path.join(__dirname, "..");
const files = (dir: string): string[] => readdirSync(path.join(root, dir)).flatMap((f) => {
  const p = path.join(dir, f);
  return statSync(path.join(root, p)).isDirectory() ? (f === "fixtures" ? [] : files(p)) : /\.test\.(ts|tsx|mjs)$/.test(f) ? [p] : [];
});

describe("KI-030: الاختبارات لا تحتاج تاريخ Git", () => {
  it("لا `git show <sha>:` ولا `git log` على المستودع نفسه في أي اختبار", () => {
    const offenders: string[] = [];
    for (const f of files("tests")) {
      const src = readFileSync(path.join(root, f), "utf8");
      // a hard-coded commit of this repository read from its history
      if (/\[\s*"show"\s*,\s*[`"'][0-9a-f]{7,40}:/.test(src) || /git show [0-9a-f]{7,40}:/.test(src.replace(/^\s*(\/\/|\*).*$/gm, ""))) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });
  it("أول نسخة من النبرات مثبتة في tests/fixtures بالبايت (بصمة blob في Git: c4edee8a)", async () => {
    const { createHash } = await import("node:crypto");
    const body = readFileSync(path.join(root, "tests/fixtures/tones-first-version/tones.2d8bee52.ts.txt"));
    const blob = createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${body.length}\0`), body])).digest("hex");
    expect(blob).toBe("c4edee8a1e8bcd33d286459c52e483ff1222143d");
  });
  it("فحص التكافؤ في CI يجلب النسخة الضحلة الافتراضية", () => {
    expect(readFileSync(path.join(root, ".github/workflows/studio-parity.yml"), "utf8")).not.toMatch(/fetch-depth/);
  });
});
