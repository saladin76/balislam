import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { approveStoryboard, loadStoryboard, storyboardStatus, unapprovedScenes } from "../src/plan/storyboard";
import { shotElements, shotKind, shotText } from "../src/plan/storyboardView";
import { chapterEyebrow } from "../src/remotion/scenes/eyebrow";
import type { Plan } from "../src/plan/types";

const plan = (text = "بسم الله الرحمن الرحيم."): Plan =>
  ({
    version: 1,
    episode: "001",
    title: "t",
    domain: "x",
    themeId: "paper",
    chapters: [
      {
        number: 1,
        title: "البداية",
        scenes: [
          { id: "c1-s1", template: "noor-text", narration: text, props: { text: "", light: "off", subtitle: "" } },
          { id: "c1-s2", template: "list", narration: "أدوات وآثار.", props: { title: "شواهد", items: "أدوات\nآثار", style: "icons", icons: "stone-tools, ruins-columns" } },
        ],
      },
    ],
  }) as unknown as Plan;

describe("ستوري بورد الفيديو قبل تنفيذه", () => {
  it("لا اعتماد ← كل المشاهد غير معتمدة؛ والاعتماد يربط كل مشهد ببصمته", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sb-"));
    const script = path.join(dir, "script.md");
    await writeFile(script, "");
    const p = plan();
    expect(storyboardStatus(p, await loadStoryboard(script)).ok).toBe(false);
    await approveStoryboard(script, p);
    expect(storyboardStatus(p, await loadStoryboard(script)).ok).toBe(true);
    // تعديل مشهد بعد الاعتماد يعيده للاعتماد، وحده
    const changed = plan("نص آخر.");
    const st = storyboardStatus(changed, await loadStoryboard(script));
    expect(st.ok).toBe(false);
    expect(st.changed).toEqual(["c1-s1"]);
    expect(unapprovedScenes(st, ["c1-s2"])).toEqual([]);
    expect(unapprovedScenes(st, ["c1-s1"])).toEqual(["c1-s1"]);
  });

  it("يحفظ سبب اعتماد التحذيرات ويزيله عند سحب الاعتماد", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sb-audit-"));
    const script = path.join(dir, "script.md");
    await writeFile(script, "");
    await approveStoryboard(script, plan(), { note: "شوهدت حركة المشهد والسكوت مقصود", inputHash: "hash-1" });
    expect((await loadStoryboard(script)).audit?.note).toContain("شوهدت");
    expect(storyboardStatus(plan(), await loadStoryboard(script)).audit?.inputHash).toBe("hash-1");
  });

  it("وصف اللقطة: نوعها وما على الشاشة وعناصرها", () => {
    const [a, b] = plan().chapters[0]!.scenes;
    expect(shotKind(a!)).toBe("فراغ وكتابة");
    expect(shotText(b!)).toBe("شواهد: أدوات · آثار");
    expect(shotElements(b!)).toEqual(["stone-tools", "ruins-columns"]);
  });

  it("عنوان الفصل أعلى المشهد بلا رقم في القناة التي لا تُظهر رقمًا لا يُنطق", () => {
    const ch = { number: 3, title: "خلق آدم وتعليمه" };
    expect(chapterEyebrow({ script: { chapterNumbers: false } }, "الفصل", ch)).toBe("خلق آدم وتعليمه");
    expect(chapterEyebrow(undefined, "الفصل", ch)).toBe("الفصل 3 · خلق آدم وتعليمه");
  });
});
