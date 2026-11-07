import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { approveStoryboard, loadStoryboard, storyboardStatus, unapprovedScenes, storyboardVisualHash } from "../src/plan/storyboard";
import { sceneHash } from "../src/plan/sceneReview";
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

  it("تغير المدة أو التراكبات يعيد الاعتماد بدل الاحتفاظ ببصمة مشهد قديمة", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sb-hash-"));
    const script = path.join(dir, "script.md");
    await writeFile(script, "");
    const p = plan();
    await approveStoryboard(script, p);
    const changed = plan();
    changed.chapters[0]!.scenes[0]!.durationSec = 15;
    expect(storyboardStatus(changed, await loadStoryboard(script)).changed).toContain("c1-s1");
    const changedOverlay = plan();
    changedOverlay.chapters[0]!.scenes[0]!.overlays = { captions: false };
    expect(storyboardStatus(changedOverlay, await loadStoryboard(script)).changed).toContain("c1-s1");
  });

  it("تحديد نبرة الراوي أو اختيار صوت آخر لا يُلغي اعتماد اللوحات المصورة", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "sb-voice-first-"));
    const script = path.join(dir, "script.md");
    await writeFile(script, "");
    const p = plan();
    await approveStoryboard(script, p);
    const changed = plan();
    changed.chapters[0]!.scenes[0]!.tone = "documentary";
    changed.chapters[0]!.scenes[0]!.voice = "narrator-2";
    const status = storyboardStatus(changed, await loadStoryboard(script));
    expect(status.ok).toBe(true);
    expect(storyboardVisualHash(p.chapters[0]!.scenes[0]!)).toBe(storyboardVisualHash(changed.chapters[0]!.scenes[0]!));
    expect(sceneHash(p.chapters[0]!.scenes[0]!)).not.toBe(sceneHash(changed.chapters[0]!.scenes[0]!));
  });

  it("الاعتماد القديم ببصمة sceneHash لا يفقد صلاحيته دون تعديل", () => {
    const p = plan();
    const legacy = { version: 1 as const, scenes: Object.fromEntries(p.chapters[0]!.scenes.map((s) => [s.id, sceneHash(s)])) };
    expect(storyboardStatus(p, legacy).ok).toBe(true);
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

import { verseChunks } from "../src/remotion/scenes/VerseCard";
import { spreadOverSpeech } from "../src/remotion/scenes/timing";

describe("صفحة الآية وتوزيع الأحداث على الكلام", () => {
  it("مقاطع الآية تعيد نصها كما هو وتُقسم عند علامات الوقف", () => {
    const text = "وَإِذْ قَالَ رَبُّكَ لِلْمَلَٰٓئِكَةِ إِنِّى جَاعِلٌ فِى ٱلْأَرْضِ خَلِيفَةً ۖ قَالُوٓا۟ أَتَجْعَلُ فِيهَا مَن يُفْسِدُ فِيهَا";
    const parts = verseChunks(text);
    expect(parts.join(" ")).toBe(text);
    // علامة الوقف تُغلق مقطعها ولا تبدأ مقطعًا جديدًا
    expect(parts.some((p) => p.endsWith("ۖ"))).toBe(true);
    expect(parts.some((p) => /^[\u06D6-\u06DC]/.test(p))).toBe(false);
    expect(parts.every((p) => p.split(" ").length <= 7)).toBe(true);
  });
  it("الأحداث تتوزع من أول كلمة منطوقة إلى آخرها بترتيبها", () => {
    const t = [{ word: "أ", start: 20, end: 30 }, { word: "ب", start: 50, end: 60 }, { word: "ج", start: 120, end: 130 }];
    const s = spreadOverSpeech(5, t as never, 4, 200);
    expect(s[0]).toBe(20);
    expect(s[4]).toBe(120);
    expect([...s].sort((a, b) => a - b)).toEqual(s);
  });
});
