import { existsSync } from "node:fs";
import { mkdtemp, readFile, writeFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { putPreview } from "../src/render/episodePreviews";

describe("معاينات الاستوديو: كل تعديل يحذف القديم ويضع الجديد", () => {
  it("الخانة نفسها تحتفظ بفيديو واحد فقط، والنسخ القديمة تُحذف", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "prev-"));
    const script = path.join(dir, "script.md");
    await writeFile(script, "");
    const a = path.join(dir, "a.mp4");
    const b = path.join(dir, "b.mp4");
    await writeFile(a, "A");
    await writeFile(b, "B");
    await putPreview(script, "six-shots", a, { title: "الأولى" });
    // اسم قديم بنمط النسخ يُحذف أيضًا
    await writeFile(path.join(dir, "previews", "six-shots-v3.mp4"), "old");
    const r = await putPreview(script, "six-shots", b, { title: "الثانية" });
    const files = (await readdir(path.join(dir, "previews"))).filter((n) => n.endsWith(".mp4"));
    expect(files).toEqual(["six-shots.mp4"]);
    expect(await readFile(path.join(dir, "previews", "six-shots.mp4"), "utf8")).toBe("B");
    expect(r.removed).toContain("six-shots-v3.mp4");
    const index = JSON.parse(await readFile(path.join(dir, "previews", "index.json"), "utf8"));
    expect(index["six-shots.mp4"].title).toBe("الثانية");
    expect(index["six-shots.mp4"].version).toBe(2);
    expect(existsSync(path.join(dir, "previews", "six-shots-v3.mp4"))).toBe(false);
  });
  it("الخانات المختلفة لا تمس بعضها", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "prev-"));
    const script = path.join(dir, "script.md");
    await writeFile(script, "");
    const a = path.join(dir, "a.mp4");
    await writeFile(a, "A");
    await putPreview(script, "chapter-1", a, { title: "الفصل 1" });
    await putPreview(script, "six-shots", a, { title: "اللقطات" });
    const files = (await readdir(path.join(dir, "previews"))).filter((n) => n.endsWith(".mp4")).sort();
    expect(files).toEqual(["chapter-1.mp4", "six-shots.mp4"]);
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
