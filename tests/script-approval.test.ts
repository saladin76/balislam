import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseScript } from "../src/script/parse";
import { setReview, reviewItems } from "../src/script/review";
import { approveScript, assertScriptApproved, scriptSignoffStatus } from "../src/script/approval";

const fixture = readFileSync(path.join(__dirname, "fixtures", "valid.md"), "utf8");

describe("explicit script approval lifecycle", () => {
  it("requires reviewed citations and cannot survive script changes", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "studio-script-signoff-"));
    const file = path.join(dir, "script.md");
    try {
      await writeFile(file, fixture);
      await expect(approveScript(file, "المراجع", "راجعت السكريبت والآيات مع مصادرها ووافقـت على النسخة الحالية", true))
        .rejects.toThrow(/الاستشهادات/);
      const script = parseScript(fixture, file);
      const items = reviewItems(script, null);
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        await setReview(file, script, item.key, "verified", "مقارنة بشرية مع المصدر المعتمد", "المراجع", true);
      }
      await approveScript(file, "المراجع", "راجعت السكريبت والآيات مع مصادرها ووافقت على النسخة الحالية", true);
      expect((await scriptSignoffStatus(file)).approved).toBe(true);
      await expect(assertScriptApproved(file)).resolves.toBe(true);
      await writeFile(file, fixture.replace("وَأَنْ", "وَأَنِ"));
      expect((await scriptSignoffStatus(file)).changed).toBe(true);
      await expect(assertScriptApproved(file)).rejects.toThrow(/تغيّر/);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
