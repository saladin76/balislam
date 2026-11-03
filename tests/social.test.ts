import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseScript } from "../src/script/parse";
import { generatePlan } from "../src/plan/generate";
import { checkCaption, checkTitle, CHAPTERS_TOKEN, chaptersText, generatePublishKit, resolveDescription, RULES } from "../src/package/social";

const script = readFileSync(path.join(__dirname, "fixtures", "valid.md"), "utf8");

describe("حزمة الانتشار", () => {
  const plan = generatePlan(parseScript(script));
  const kit = generatePublishKit(plan, script, undefined);

  it("عنوان لكل زاوية، وشورت لكل فصل، والهاشتاجات داخل حدود المنصات", () => {
    expect(kit.long.titles[0]!.text).toBe(plan.title);
    expect(kit.shorts).toHaveLength(6);
    for (const s of kit.shorts) {
      expect(s.instagram.hashtags.length).toBeLessThanOrEqual(RULES.instagram.hashtagsMax);
      expect(s.facebook.hashtags.length).toBeLessThanOrEqual(RULES.facebook.hashtagsMax);
      expect(s.instagram.caption).toMatch(/[؟?]/);
    }
  });

  it("توقيت الفصول يُدرج مكان العلامة", () => {
    expect(kit.long.description).toContain(CHAPTERS_TOKEN);
    const d = resolveDescription(kit.long.description, chaptersText(plan));
    expect(d).toMatch(/\n0:00 /);
    expect(d).not.toContain(CHAPTERS_TOKEN);
  });

  it("الفحوص تكشف العنوان الطويل والهاشتاجات الزائدة", () => {
    expect(checkTitle("ا".repeat(90), "youtube", ["التأجيل"]).some((c) => !c.ok)).toBe(true);
    expect(checkCaption("سطر؟", ["#a", "#b", "#c", "#d", "#e", "#f"], "instagram", ["سطر"]).find((c) => c.label.startsWith("هاشتاجات"))!.ok).toBe(false);
  });
});

describe("قاعدة: لا أثر لأدوات الإنتاج", () => {
  it("يكشف الإشارات للذكاء الاصطناعي والأدوات، ويقبل النص العادي", async () => {
    const { findTraces, assertNoTraces } = await import("../src/package/traces");
    expect(findTraces("التعليق الصوتي مولَّد بالذكاء الاصطناعي")).toContain("ذكاء اصطناعي");
    expect(findTraces("Voice by ElevenLabs")).toContain("ElevenLabs");
    expect(findTraces("made with AI")).toContain("AI");
    expect(findTraces("صوت مستنسخ")).toContain("استنساخ الصوت");
    expect(findTraces("كيف تعرف أنك على حق؟ اللهم أرنا الحق حقًا #بالإسلام")).toEqual([]);
    expect(findTraces("SAID and MAIN")).toEqual([]);
    expect(() => assertNoTraces([{ name: "youtube.md", text: "Claude" }])).toThrow(/youtube.md/);
  });
});

describe("قاعدة: مقياس الحركة", () => {
  it("يصف النتيجة بالحد والهدف والمقاطع الساكنة", async () => {
    const { motionSummary } = await import("../src/render/motionMeter");
    const low = motionSummary({ percent: 70, seconds: 10, activeSeconds: 7, perSecond: [], still: [{ from: 3, to: 6 }] }, "الحلقة");
    expect(low).toContain("أقل من الحد");
    expect(low).toContain("0:03–0:06");
    expect(motionSummary({ percent: 92, seconds: 10, activeSeconds: 9, perSecond: [], still: [] }, "x")).toContain("ممتاز");
  });
});
