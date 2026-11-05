import { describe, expect, it } from "vitest";
import { autoCameraPlan, cameraCuts, isComposed, isDirected, moveFrames, parseCameraPlan, parseCameraPlanLines } from "../src/plan/director";
import { composedCamera } from "../src/remotion/scenes/AlleyTale";
import { estimateTimings } from "../src/remotion/scenes/timing";
import { WW } from "../src/remotion/illus/world";

/**
 * الكاميرا المؤلَّفة (بالإسلام، الأمر 005): حركات قليلة لها سبب في الكلام بدل التأطير الآلي مع كل سطر.
 */
const FPS = 30;
const DUR = 10 * FPS;
const narration = "يمشي في الحارة مساء. يقف أمام الباب ويفكر. ثم يعرف الحقيقة.";
const timings = estimateTimings(narration, 6, DUR - 12);
const cueAt = (word: string) => timings.find((t) => t.word.replace(/[.،]/g, "") === word)!.start;

describe("الكاميرا المؤلَّفة", () => {
  it("وضع جديد لا يغيّر الوضعين القائمين", () => {
    expect(isComposed("composed")).toBe(true);
    expect(isDirected("composed")).toBe(true);
    expect(isDirected("directed")).toBe(true);
    expect(isDirected("automatic")).toBe(false);
    expect(isDirected()).toBe(false);
  });

  it("خطة الكاميرا: كلمة أو إطار، وحجم، وهدف؛ والسطر الخاطئ يُكشف", () => {
    expect(parseCameraPlan("0 | wide\nالحقيقة | close hero\nالباب | medium door")).toEqual([
      { at: { frame: 0 }, shot: "wide", target: "hero" },
      { at: { word: "الحقيقة" }, shot: "close", target: "hero" },
      { at: { word: "الباب" }, shot: "medium", target: "door" },
    ]);
    expect(parseCameraPlanLines("0 | wide\nالباب | zoomy\nكلمة | close sky")).toEqual([{ at: { frame: 0 }, shot: "wide", target: "hero" }, null, null]);
  });

  it("الخطة الآلية: حركتان على الأكثر، بينهما ثلاث ثوانٍ على الأقل", () => {
    const cues = [
      { kind: "think", at: 60 },
      { kind: "door", at: 75 },
      { kind: "truth", at: 200 },
      { kind: "pain", at: 230 },
    ];
    const plan = autoCameraPlan({ cues, duration: DUR, fps: FPS, stage: "solo", sacred: false });
    expect(plan[0]).toEqual({ frame: 0, shot: "wide", target: "hero" });
    const moves = plan.slice(1);
    expect(moves.length).toBeLessThanOrEqual(2);
    for (let i = 1; i < moves.length; i++) expect(moves[i]!.frame - moves[i - 1]!.frame).toBeGreaterThanOrEqual(3 * FPS);
  });

  it("مشهد فيه ذكر لله أو آية: الكاميرا ثابتة بلا حركات", () => {
    const plan = autoCameraPlan({ cues: [{ kind: "truth", at: 90 }], duration: DUR, fps: FPS, stage: "solo", sacred: true });
    expect(plan).toHaveLength(1);
  });

  it("بلا كلمات معنى: تبقى الكاميرا على تأطيرها الافتتاحي (لا اقتراب حشو بنمط ثابت)", () => {
    const plan = autoCameraPlan({ cues: [], duration: DUR, fps: FPS, stage: "solo", sacred: false });
    expect(plan).toHaveLength(1);
  });

  it("المشهد الثابت: «ثابت» تُبقي الكاميرا ساكنة تمامًا بلا تنفس", () => {
    expect(parseCameraPlan("ثابت")[0]?.still).toBe(true);
    const a = composedCamera({ frame: 0, dur: DUR, fps: FPS, heroX: 1060, stage: "solo", sacred: false, plan: "ثابت", cues: [{ kind: "truth", word: "الحقيقة", at: 200 }], timings });
    const b = composedCamera({ frame: DUR - 1, dur: DUR, fps: FPS, heroX: 1060, stage: "solo", sacred: false, plan: "ثابت", cues: [{ kind: "truth", word: "الحقيقة", at: 200 }], timings });
    expect(b).toEqual(a);
    expect(a.still).toBe(true);
  });

  it("حركة واحدة طويلة بمدة يحددها المخرج، وإزاحة لتصل الكاميرا مع الحدث لا مع الكلمة", () => {
    expect(parseCameraPlan("الباب+12 | medium door 150")[0]).toEqual({ at: { word: "الباب" }, shot: "medium", target: "door", offset: 12, dur: 150 });
    expect(parseCameraPlanLines("الباب | medium door 5")).toEqual([null]);
    const run = (f: number) => composedCamera({ frame: f, dur: DUR, fps: FPS, heroX: 1060, stage: "solo", sacred: true, plan: "0 | wide\nالحقيقة | close hero 150", cues: [], timings });
    const t = cueAt("الحقيقة");
    const start = t - 60;
    // الحركة الطويلة تبدأ قبل الكلمة بـ40% من مدتها، وفي منتصفها لم تكتمل بعد
    expect(run(start - 2).z).toBeCloseTo(1, 5);
    const mid = run(start + 75).z;
    expect(mid).toBeGreaterThan(1.05);
    expect(mid).toBeLessThan(1.55);
  });

  it("فحص الخطة: خطة العمودي والمشية تُفحصان، وتنبيه حين تُكتبان خارج وضع composed", async () => {
    const { planIssues } = await import("../src/plan/validate");
    const scene = (props: Record<string, string>) => ({
      version: 1 as const, episode: "000", title: "t", domain: "psychology" as const, themeId: "night" as const, channel: "balislam", updatedAt: "",
      chapters: [{ number: 1, title: "t", scenes: [{ id: "c1-s1", template: "alley-tale", narration: "يمشي في الحارة.", line: 0, props, sfx: [] }] }],
    });
    const msgs = (props: Record<string, string>) => planIssues(scene(props) as never).map((i) => i.message).join("\n");
    expect(msgs({ cameraMode: "composed", cameraPlanPortrait: "الباب | zoom" })).toContain("خطة الكاميرا غير صالحة");
    expect(msgs({ cameraMode: "composed", gait: "run" })).toContain("المشية غير معروفة");
    expect(msgs({ cameraMode: "automatic", gait: "stroll" })).toContain("لا تعمل إلا في وضع الكاميرا composed");
    expect(msgs({ cameraMode: "composed", gait: "stroll", cameraPlan: "ثابت", cameraPlanPortrait: "0 | medium hero" })).not.toMatch(/المشية|خطة الكاميرا/);
  });  it("أقل تغيّرًا للتأطير من الوضع الآلي القديم في المشهد نفسه", () => {
    const lineStarts = [0, 75, 150, 225];
    const legacyCuts = cameraCuts(lineStarts, DUR, false).length - 1;
    const c = composedCamera({ frame: 0, dur: DUR, fps: FPS, heroX: 1060, stage: "solo", sacred: false, cues: [{ kind: "door", word: "الباب", at: cueAt("الباب") }, { kind: "truth", word: "الحقيقة", at: cueAt("الحقيقة") }], timings });
    expect(legacyCuts).toBeGreaterThanOrEqual(3);
    expect(c.keys - 1).toBeLessThanOrEqual(2);
  });

  it("لا يظهر ما وراء حدود العالم في أي إطار، والحركة متصلة بلا قفز", () => {
    let prev: { x: number; z: number } | null = null;
    for (let f = 0; f < DUR; f++) {
      const c = composedCamera({ frame: f, dur: DUR, fps: FPS, heroX: 1500, stage: "solo", sacred: false, plan: "0 | wide\nالباب | medium door\nالحقيقة | close hero", cues: [], timings });
      const half = WW / 2 / c.z;
      expect(c.x - half).toBeGreaterThanOrEqual(-0.01);
      expect(c.x + half).toBeLessThanOrEqual(WW + 0.01);
      if (prev) {
        expect(Math.abs(c.x - prev.x)).toBeLessThan(40);
        expect(Math.abs(c.z - prev.z)).toBeLessThan(0.05);
      }
      prev = { x: c.x, z: c.z };
    }
  });

  it("الكلمة المكتوبة في الخطة تحرّك الكاميرا عند نطقها لا قبل ذلك بكثير", () => {
    const run = (f: number) => composedCamera({ frame: f, dur: DUR, fps: FPS, heroX: 1060, stage: "solo", sacred: true, plan: "0 | wide\nالحقيقة | close hero", cues: [], timings });
    const t = cueAt("الحقيقة");
    expect(run(t - 40).z).toBeCloseTo(1, 5);
    expect(run(t + 60).z).toBeGreaterThan(1.5);
  });

  it("مدة الحركة تتبع المسافة: من 24 إلى 60 إطارًا", () => {
    expect(moveFrames(0, 0)).toBe(24);
    expect(moveFrames(0.6, 600)).toBe(60);
    expect(moveFrames(0.28, 100)).toBeGreaterThan(moveFrames(0.05, 0));
  });
});

describe("الكاميرا المؤلَّفة: التكوين", () => {
  it("رأس البطل لا يدخل منطقة الترجمة العلوية في أي حجم لقطة", async () => {
    const { frameOn, screenY, HERO_HEAD_Y } = await import("../src/remotion/scenes/AlleyTale");
    for (const z of [1, 1.28, 1.6]) {
      const c = frameOn(1060, z);
      expect(screenY(c, HERO_HEAD_Y)).toBeGreaterThanOrEqual(229);
      // ولا يظهر ما فوق العالم أو تحته
      expect(screenY(c, 0)).toBeLessThanOrEqual(0.01);
      expect(screenY(c, 1080)).toBeGreaterThanOrEqual(1079.99);
    }
  });
});

describe("الكاميرا المؤلَّفة: العمودي", () => {
  it("لقطة الباب أو اللوحة أو من أمامه في العمودي تُبقي البطل والهدف داخل الإطار الضيق", async () => {
    const { shotFrame } = await import("../src/remotion/scenes/AlleyTale");
    const heroX = 1060;
    const inside = (c: { x: number; z: number }, wx: number) => Math.abs((wx - c.x) * c.z) <= 304 - 40;
    for (const [target, stage, other] of [["door", "solo", heroX + 250], ["board", "solo", heroX - 430], ["pair", "companion", heroX - 400]] as const) {
      for (const shot of ["medium", "close"] as const) {
        const c = shotFrame(target, shot, heroX, stage, true);
        expect(inside(c, heroX)).toBe(true);
        expect(inside(c, other)).toBe(true);
      }
    }
  });
  it("الأفقي لا يتغير: الهدف في المنتصف بحجم اللقطة كاملًا", async () => {
    const { shotFrame } = await import("../src/remotion/scenes/AlleyTale");
    expect(shotFrame("door", "medium", 1060, "solo", false).z).toBeCloseTo(1.28, 5);
  });
});
