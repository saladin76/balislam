import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadPreviews, publishPreview, previewsDirFor } from "../src/render/episodePreviews";

describe("رفع الفيديو إلى الاستوديو", () => {
  it("النسخة الجديدة تحذف القديمة من خانتها، والخانات الأخرى باقية", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "prev-"));
    const script = path.join(dir, "script.md");
    writeFileSync(script, "x");
    const v = path.join(dir, "v.mp4");
    writeFileSync(v, "video-1");
    const base = { title: "عينة", quality: "preview" as const, voiced: false, scenes: [] };
    await publishPreview(script, v, { ...base, slot: "عينة-أ" });
    await publishPreview(script, v, { ...base, slot: "عينة-ب" });
    writeFileSync(v, "video-2");
    const list = await publishPreview(script, v, { ...base, slot: "عينة-ب" });
    const files = readdirSync(previewsDirFor(script)).filter((f) => f.endsWith(".mp4")).sort();
    expect(files).toEqual(["عينة-أ-v1.mp4", "عينة-ب-v2.mp4"]);
    expect(list.map((e) => e.slot)).toEqual(["عينة-ب", "عينة-أ"]);
    expect((await loadPreviews(script)).find((e) => e.slot === "عينة-ب")!.version).toBe(2);
    expect(existsSync(path.join(previewsDirFor(script), "عينة-ب-v1.mp4"))).toBe(false);
  });
});
