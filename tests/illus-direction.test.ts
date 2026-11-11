import { describe, expect, it } from "vitest";
import { cueFrames, cuesFor, isSacredSentence, parseCues, cuesToText } from "../src/plan/sceneCues";
import { chapterMood, posesFor } from "../src/plan/illusDirect";

describe("إشارات المشاهد المصوَّرة (القاعدة الثالثة)", () => {
  it("الحدث من معنى الكلمة المنطوقة نفسها", () => {
    const cues = cuesFor("قد تصدق خبرًا لأنه يؤكد رأيك. الأول يراه ظلمًا، والثاني يراه عدلًا.");
    expect(cues.map((c) => c.kind)).toEqual(["news", "wrong", "just"]);
    expect(cues.map((c) => c.word)).toEqual(["خبرًا", "ظلمًا", "عدلًا"]);
  });

  it("لا أحداث في جملة فيها ذكر الله أو دعاء أو آية (توقير)", () => {
    expect(isSacredSentence("يقول الله تعالى:")).toBe(true);
    expect(isSacredSentence("«اللهم أرنا الحق حقًا وارزقنا اتباعه»")).toBe(true);
    expect(isSacredSentence("فالله تعالى يقول:")).toBe(true);
    expect(cuesFor("أي نسأل الله أن يهدينا إلى معرفة الحقيقة.")).toEqual([]);
    expect(cuesFor("وأن نطلب الهداية من الله، وأن نرجع إلى الوحي.")).toEqual([]);
  });

  it("«في حقك» ليست الحق، و«صحيح» المنفي لا يضيء", () => {
    expect(cuesFor("أنت مقتنع أنه أخطأ في حقك.")).toEqual([]);
    expect(cuesFor("فليس كل ما نقتنع به صحيحًا.").map((c) => c.kind)).not.toContain("truth");
  });

  it("الحدث يقع لحظة نطق كلمته فقط، ولا يقع إن لم تُنطق", () => {
    const cues = parseCues(cuesToText([{ kind: "news", word: "خبرًا" }, { kind: "door", word: "الاعتراف" }]));
    const t = [{ word: "قد", start: 0 }, { word: "تصدق", start: 10 }, { word: "خبرًا", start: 22 }];
    expect(cueFrames(cues, t)).toEqual([{ kind: "news", word: "خبرًا", at: 22 }]);
  });
});

describe("إخراج الحلقة المصوَّرة", () => {
  it("المزاج يتبع قوس الحلقة وينتهي بالفجر", () => {
    expect(chapterMood(0, 6)).toBe("night");
    expect(chapterMood(5, 6)).toBe("dawn");
  });

  it("حركة البطل من معنى الجملة، والجملة المقدسة بلا حركة", () => {
    expect(posesFor("كيف تعرف أنك تسير في طريق الحق؟", 0)).toContain("walk");
    expect(posesFor("قد تصدق خبرًا لأنه يؤكد رأيك.", 0)).toBe("hold");
    expect(posesFor("يقول الله تعالى:", 0)).toBe("stand");
  });
});

describe("اللقطات المصمَّمة", () => {
  it("كل لقطة في خطة الحلقة 001 موجودة في المكتبة، ولها كاميرا ومشهد", async () => {
    const { SHOTS } = await import("../src/remotion/illus/shots");
    const { readFileSync } = await import("node:fs");
    const plan = JSON.parse(readFileSync("channels/balislam/episodes/001-know-the-truth/plan.json", "utf8"));
    const used = plan.chapters.flatMap((c: { scenes: { props: { shot?: string } }[] }) => c.scenes.map((s) => s.props.shot).filter(Boolean)) as string[];
    // 8 لقطات من المكتبة تطابق جمل السكريبت المعتمد (١١ نوفمبر)؛ لقطات قصته الجديدة (الميزان، الدفتر والقطة، الظرف، المقهى، الكرسي)
    // تُصمَّم بعد اعتماد الستوري بورد وتُضاف إلى المكتبة، فيرتفع هذا الحد معها
    expect(used.length).toBeGreaterThanOrEqual(8);
    for (const id of used) {
      const d = SHOTS[id];
      expect(d, id).toBeDefined();
      const shot = d!.render({ frame: 40, fps: 30, dur: 200, portrait: false, at: (_w, f) => Math.round(f * 200) });
      expect(shot.cam.length, id).toBeGreaterThan(1);
    }
  });
});
