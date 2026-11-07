import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseScript } from "../src/script/parse";
import { loadLedger, reviewItems, reviewSummary, setReview } from "../src/script/review";

const base = readFileSync("tests/fixtures/valid.md", "utf8");

describe("سجل التوثيق", () => {
  it("كل استشهاد يبدأ بانتظار المراجعة، والتوثيق يكمل السجل", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "review-"));
    const file = path.join(dir, "script.md");
    writeFileSync(file, base);
    const script = parseScript(base, file);
    let items = reviewItems(script, await loadLedger(file));
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.status === "pending")).toBe(true);
    expect(reviewSummary(items).ok).toBe(false);
    for (const i of items) items = await setReview(file, script, i.key, "verified", "راجعت المصدر المعتمد يدويًا", "مراجع الاستشهاد", true);
    expect(reviewSummary(items).ok).toBe(true);
  });

  it("تعديل الاستشهاد بعد اعتماده يعيده للمراجعة", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "review-"));
    const file = path.join(dir, "script.md");
    writeFileSync(file, base);
    const script = parseScript(base, file);
    const items = reviewItems(script, null);
    for (const i of items) await setReview(file, script, i.key, "verified", "تحققت من الاستشهاد والمصدر", "المراجع", true);
    const first = items[0]!;
    const edited = base.replace(readFileSync("tests/fixtures/valid.md", "utf8").split("\n")[first.line - 1]!, `${readFileSync("tests/fixtures/valid.md", "utf8").split("\n")[first.line - 1]!} | مراجعة جديدة`);
    const after = reviewItems(parseScript(edited, file), await loadLedger(file));
    expect(after.find((i) => i.key === first.key)?.status).toBe("changed");
    expect(reviewSummary(after).ok).toBe(false);
  });

  it("الرفض يحتاج سببًا", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "review-"));
    const file = path.join(dir, "script.md");
    writeFileSync(file, base);
    const script = parseScript(base, file);
    const k = reviewItems(script, null)[0]!.key;
    await expect(setReview(file, script, k, "rejected", "", "المراجع", true)).rejects.toThrow("سبب");
    const items = await setReview(file, script, k, "rejected", "الدرجة غير صحيحة", "المراجع", true);
    expect(items.find((i) => i.key === k)?.status).toBe("rejected");
  });
});
