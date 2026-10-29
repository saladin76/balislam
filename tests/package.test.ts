import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseScript } from "../src/script/parse";
import { generatePlan } from "../src/plan/generate";
import { planIssues } from "../src/plan/validate";
import { sceneSeconds } from "../src/plan/duration";
import { emptyMedia, type EpisodeMedia } from "../src/plan/media";
import { buildSrt } from "../src/package/captions";
import { buildYoutubeText } from "../src/package/youtube";
import { scenesOf, chapterStarts } from "../src/remotion/scenes/Episode";

const src = readFileSync(path.join(__dirname, "fixtures", "valid.md"), "utf8");
const parsed = parseScript(src);
const quran = { "53:39": "وَأَن لَّيْسَ لِلْإِنسَٰنِ إِلَّا مَا سَعَىٰ" };

describe("الخطة: الحديث والربط وشاشة النهاية", () => {
  const plan = generatePlan(parsed, null, quran);
  const scenes = plan.chapters.flatMap((c) => c.scenes);

  it("بطاقة الحديث تأخذ النص والراوي من العلامة والدرجة من الاستشهادات", () => {
    const h = scenes.find((s) => s.template === "hadith-card")!;
    expect(h.props).toMatchObject({ text: "ليس الغنى عن كثرة العرض، ولكن الغنى غنى النفس", narrator: "عن أبي هريرة رضي الله عنه", grade: "صحيح" });
    expect(h.props.reference).toContain("٦٤٤٦");
  });

  it("جملة الربط بعد بطاقة حديث تأخذ مشهدًا خاصًا لا تُقرأ فوق البطاقة", () => {
    const ch4 = plan.chapters.find((c) => c.number === 4)!;
    const last = ch4.scenes[ch4.scenes.length - 1]!;
    expect(last.template).toBe("character-talk");
    expect(last.narration).toBe("فكيف نحوّل هذا الفهم إلى عمل؟");
    expect(ch4.scenes.find((s) => s.template === "hadith-card")!.narration).toBe("");
  });

  it("شاشة النهاية تُضاف آخر الحلقة من الخطوة العملية، وتُستبعد من الشورت", () => {
    const end = scenes[scenes.length - 1]!;
    expect(end.template).toBe("end-screen");
    expect(end.props.prompt).toContain("ما المهمة التي اخترتها؟");
    expect(scenesOf({ plan, chapter: 6 }).some((x) => x.scene.template === "end-screen")).toBe(false);
    expect(scenesOf({ plan }).some((x) => x.scene.template === "end-screen")).toBe(true);
  });

  it("الخطة السليمة بلا موانع، والآية بنص مؤقت تمنع النسخة النهائية", () => {
    expect(planIssues(plan).filter((i) => i.level === "error")).toEqual([]);
    const noQuran = generatePlan(parsed, null, {});
    expect(planIssues(noQuran).some((i) => i.level === "error" && i.message.includes("bal quran"))).toBe(true);
  });
});

describe("المزامنة والتغليف", () => {
  const plan = generatePlan(parsed, null, quran);
  const first = plan.chapters[0]!.scenes[0]!;
  const media: EpisodeMedia = {
    ...emptyMedia,
    voice: {
      [first.id]: {
        file: "x.mp3",
        hash: "h",
        text: first.narration,
        duration: 3,
        words: first.narration.split(" ").map((w, i) => ({ word: w, start: i * 0.5, end: i * 0.5 + 0.4 })),
      },
    },
    recitations: { "53:39": { file: "53-39.mp3", duration: 9 } },
  };

  it("مدة المشهد من الصوت الحقيقي، وبطاقة الآية بطول التلاوة", () => {
    expect(sceneSeconds(first, media)).toBeCloseTo(3.5); // أقل مدة للسؤال الكبير
    const verse = plan.chapters.flatMap((c) => c.scenes).find((s) => s.template === "verse-card")!;
    expect(sceneSeconds(verse, media)).toBeCloseTo(10.6);
  });

  it("الصوت القديم (نص تغيّر) لا يُستخدم", () => {
    const longer = { ...first, narration: `${first.narration} ${"كلمة ".repeat(20)}`.trim() };
    expect(sceneSeconds(longer, media)).toBeGreaterThan(8);
  });

  it("ملف الترجمة SRT مرتب بلا تداخل", () => {
    const srt = buildSrt(plan, scenesOf({ plan }).map((x) => x.scene), media);
    const times = [...srt.matchAll(/(\d\d):(\d\d):(\d\d),(\d{3}) --> (\d\d):(\d\d):(\d\d),(\d{3})/g)].map((m) => {
      const t = (i: number) => Number(m[i]) * 3600 + Number(m[i + 1]) * 60 + Number(m[i + 2]) + Number(m[i + 3]) / 1000;
      return [t(1), t(5)] as const;
    });
    expect(times.length).toBeGreaterThan(5);
    for (let i = 1; i < times.length; i++) expect(times[i]![0]).toBeGreaterThanOrEqual(times[i - 1]![1]);
    expect(srt.split("\n")[2]).toBe(first.narration.split(" ").slice(0, 6).join(" "));
  });

  it("وصف يوتيوب فيه الفصول من 0:00 والمصادر والإفصاح عن الصوت", () => {
    const text = buildYoutubeText(plan, src, media, 6);
    expect(text).toContain("0:00 السؤال");
    expect(text).toContain("Quran.Foundation");
    expect(text).toContain("صحيح البخاري 6446");
    expect(text).toContain("مولَّد بالذكاء الاصطناعي");
    expect(chapterStarts(plan, media)).toHaveLength(6);
  });
});
