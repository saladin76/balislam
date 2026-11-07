import { existsSync } from "node:fs";
import { mkdtemp, readFile, writeFile, readdir, rm, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { putPreview } from "../src/render/episodePreviews";

const owned: string[] = [];
const previewTemp = async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "prev-"));
  owned.push(dir);
  return dir;
};
afterEach(async () => {
  for (const dir of owned.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe("معاينات الاستوديو: تحفظ النسخ القديمة وتعرض الحالية", () => {
  it("الخانة نفسها تحتفظ بفيديو واحد فقط، والنسخ القديمة تُحذف", async () => {
    const dir = await previewTemp();
    const script = path.join(dir, "script.md");
    await writeFile(script, "");
    const a = path.join(dir, "a.mp4");
    const b = path.join(dir, "b.mp4");
    await writeFile(a, "A");
    await writeFile(b, "B");
    await putPreview(script, "six-shots", a, { title: "الأولى" });
    // اسم قديم بنمط النسخ يُحذف أيضًا
    await writeFile(path.join(dir, "previews", "six-shots-v3.mp4"), "old");
    // خانة مختلفة تبدأ بالحروف نفسها، ولا يجوز حذفها مع الإصدارات القديمة
    await writeFile(path.join(dir, "previews", "six-shots-video.mp4"), "OTHER");
    const r = await putPreview(script, "six-shots", b, { title: "الثانية" });
    const files = (await readdir(path.join(dir, "previews"))).filter((n) => n.endsWith(".mp4"));
    expect(files).toEqual(["six-shots-video.mp4", "six-shots.mp4"]);
    expect(await readFile(path.join(dir, "previews", "six-shots.mp4"), "utf8")).toBe("B");
    expect(r.removed).toContain("six-shots-v3.mp4");
    expect(await readFile(path.join(dir, "previews", "six-shots-video.mp4"), "utf8")).toBe("OTHER");
    const index = JSON.parse(await readFile(path.join(dir, "previews", "index.json"), "utf8"));
    expect(index["six-shots.mp4"].title).toBe("الثانية");
    expect(index["six-shots.mp4"].version).toBe(2);
    expect(existsSync(path.join(dir, "previews", "six-shots-v3.mp4"))).toBe(false);
    const versions = await readdir(path.join(dir, "previews", "history", "six-shots"));
    expect(versions).toHaveLength(2);
    const archived = await Promise.all(versions.map((name) =>
      readFile(path.join(dir, "previews", "history", "six-shots", name), "utf8")));
    expect(archived.sort()).toEqual(["A", "old"].sort());
  });
  it("يرفض ملفًا بديلًا فارغًا ويحافظ على المعاينة والفهرس السابقين", async () => {
    const dir = await previewTemp();
    const script = path.join(dir, "script.md");
    const good = path.join(dir, "good.mp4");
    const empty = path.join(dir, "empty.mp4");
    await writeFile(script, "");
    await writeFile(good, "VALID");
    await writeFile(empty, "");
    await putPreview(script, "chapter-1", good, { title: "الصحيحة" });
    await expect(putPreview(script, "chapter-1", empty, { title: "غير صالحة" })).rejects.toThrow("فارغ");
    expect(await readFile(path.join(dir, "previews", "chapter-1.mp4"), "utf8")).toBe("VALID");
    const index = JSON.parse(await readFile(path.join(dir, "previews", "index.json"), "utf8"));
    expect(index["chapter-1.mp4"].title).toBe("الصحيحة");
    expect(index["chapter-1.mp4"].version).toBe(1);
    expect((await readdir(path.join(dir, "previews"))).every((name) => !name.endsWith(".pending"))).toBe(true);
  });

  it("الخانات المختلفة لا تمس بعضها", async () => {
    const dir = await previewTemp();
    const script = path.join(dir, "script.md");
    await writeFile(script, "");
    const a = path.join(dir, "a.mp4");
    await writeFile(a, "A");
    await putPreview(script, "chapter-1", a, { title: "الفصل 1" });
    await putPreview(script, "six-shots", a, { title: "اللقطات" });
    const files = (await readdir(path.join(dir, "previews"))).filter((n) => n.endsWith(".mp4")).sort();
    expect(files).toEqual(["chapter-1.mp4", "six-shots.mp4"]);
  });
  it("rejects an unsafe slot and never mutates a valid slot", async () => {
    const dir = await previewTemp();
    const script = path.join(dir, "script.md");
    await writeFile(script, "");
    const file = path.join(dir, "good.mp4");
    await writeFile(file, "ORIGINAL");
    await putPreview(script, "six-shots", file, { title: "safe" });
    await expect(putPreview(script, "../six-shots", file, { title: "unsafe" })).rejects.toThrow(/غير آمن/);
    expect(await readFile(path.join(dir, "previews", "six-shots.mp4"), "utf8")).toBe("ORIGINAL");
  });

  it("does not overwrite a preview when its index is corrupt or actively locked", async () => {
    const dir = await previewTemp();
    const script = path.join(dir, "script.md");
    await writeFile(script, "");
    const a = path.join(dir, "a.mp4"), b = path.join(dir, "b.mp4");
    await writeFile(a, "OLD");
    await writeFile(b, "NEW");
    await putPreview(script, "chapter-1", a, { title: "old" });
    const prevDir = path.join(dir, "previews");
    await mkdir(path.join(prevDir, ".preview-index.lock"));
    await expect(putPreview(script, "chapter-1", b, { title: "new" })).rejects.toThrow();
    expect(await readFile(path.join(prevDir, "chapter-1.mp4"), "utf8")).toBe("OLD");
    await rm(path.join(prevDir, ".preview-index.lock"), { recursive: true });
    await writeFile(path.join(prevDir, "index.json"), "{");
    await expect(putPreview(script, "chapter-1", b, { title: "new" })).rejects.toThrow(/فهرس المعاينات/);
    expect(await readFile(path.join(prevDir, "chapter-1.mp4"), "utf8")).toBe("OLD");
  });

});

import { shotGaps } from "../src/render/shotsPreview";

describe("المعاينة الصوتية لا تُصنع مع نقص", () => {
  const plan = {
    chapters: [{ number: 1, title: "", scenes: [
      { id: "a", template: "noor-text", narration: "جملة", props: {} },
      { id: "v", template: "verse-card", narration: "", ayahKey: "2:30", props: { text: "" } },
    ] }],
  } as never;
  it("تذكر كل نقص بمشهده", () => {
    const gaps = shotGaps(plan, { voice: {}, recitations: {} } as never, ["a", "v"], "/tmp/x/script.md", true);
    expect(gaps).toHaveLength(3);
    expect(gaps.some((g) => g.id === "a" && g.what.includes("صوت"))).toBe(true);
    expect(gaps.some((g) => g.id === "v" && g.what.includes("نص الآية"))).toBe(true);
    expect(gaps.some((g) => g.id === "v" && g.what.includes("تلاوة"))).toBe(true);
  });
});
