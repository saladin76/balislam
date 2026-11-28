/**
 * D246 «أ» (قرار المالك ٢٨ نوفمبر): بطاقة الآية/الحديث في «خط الأفق» تنزل بعد أول فكرة مرسومة في مشهدها الحامل، على الصفحة
 * المقابلة للرسم، والرسم باقٍ ساكنًا بجوارها؛ ولا تستمر إلى المشهد التالي إلا في الموضوع نفسه (carryAllowed)؛ وما لا يتسع من آية
 * واحدة فوق ٣٠ كلمة جزء متصل حتى علامة وقف (D222)؛ والقيم بالتقدير هنا، وبالصوت الحقيقي على جهاز الاستوديو.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { autoPartial, continuesQuote, firstDrawnIdea, fromAfterIdea, placeQuotes } from "../src/plan/quotePlacement";
import { sceneTimeline } from "../src/plan/quoteCarry";
import { inlineQuotesInPlan } from "../src/plan/fromScenes";
import { quoteStart, verseReadSeconds, verseWindow } from "../src/remotion/dafatir/horizon/meta";
import { sceneSeconds } from "../src/plan/duration";
import { emptyMedia } from "../src/plan/media";
import { parseScript } from "../src/script/parse";
import { quranFromScript } from "../src/quran/scriptText";
import { planVerseMismatches } from "../src/quran/verseSource";
import { tanzilVerses } from "../src/quran/tanzil";
import type { Plan, PlanScene } from "../src/plan/types";

const DIR = "channels/dafatir-alzaman/episodes";
const dirOf = (e: string) => path.join(DIR, readdirSync(DIR).find((d) => d.startsWith(`${e}-`))!);
const load = (e: string) => JSON.parse(readFileSync(path.join(dirOf(e), "plan.json"), "utf8")) as Plan;
const quranOf = (e: string) => quranFromScript(parseScript(readFileSync(path.join(dirOf(e), "script.md"), "utf8"))).texts;
const shot = (id: string, narration: string, s: string, extra: Record<string, string> = {}): PlanScene =>
  ({ id, template: "horizon-shot", narration, line: 1, props: { shot: s, ...extra }, sfx: [] });
const Q31 = quranOf("002")["5:31"]!;

describe("«أ»: أول فكرة مرسومة ثم البطاقة على الصفحة المقابلة", () => {
  // الغراب ينبش: «يحفر» ← خطوط الخدش على الصفحة اليسرى (رسم اللقطة نفسها، cueKit)
  const host = shot("h", "يحفر في التراب، ليريه كيف يستر جسد أخيه.", "bd02-crow", { verseKey: "5:31", verseText: Q31, verseFrom: "يحفر" });

  it("أول فكرة من مراسي اللقطة، وكلمة الظهور بعد اكتمال رسمها", () => {
    const tl = sceneTimeline(host, emptyMedia);
    const idea = firstDrawnIdea(host, tl)!;
    expect(idea.word).toBe("يحفر");
    const j = fromAfterIdea(tl, idea);
    expect(tl.words[j]!.s).toBeGreaterThanOrEqual(idea.done - 0.05);
    expect(tl.words[j]!.w).toBe("ليريه");
  });

  it("placeQuotes: verseFrom بعد الفكرة، والصفحة اليمنى مقابل الرسم على اليسرى، وquoteFirm لا تتقدم البطاقة عن كلمتها", () => {
    const r = placeQuotes([host, shot("n", "وبعده كلام في موضوع آخر تمامًا.", "bd02-feather")]);
    const p = r.scenes[0]!.props;
    expect(p).toMatchObject({ verseFrom: "ليريه", verseSide: "r", quoteFirm: "1" });
    expect(r.placements[0]).toMatchObject({ idea: "يحفر", side: "r", sideWhy: expect.stringMatching(/اليسرى/) });
    const tl = sceneTimeline(r.scenes[0]!, emptyMedia);
    const w = verseWindow(p, tl, sceneSeconds(r.scenes[0]!))!;
    expect(w[0]).toBeCloseTo(tl.words.find((x) => x.w === "ليريه")!.s, 5);
    // بلا firm تتقدم البطاقة لتتسع داخل الكلام (السلوك القديم، ومنه 001)
    expect(quoteStart("ليريه", Q31, tl)).toBeLessThan(quoteStart("ليريه", Q31, tl, true));
  });

  it("الرسم على اليمنى ← البطاقة على اليسرى (002 c1-s51: نقطة «النفس» على اليمنى)، و«كلمة#n» للورود الثاني", () => {
    const s = load("002").chapters[0]!.scenes.find((x) => x.id === "c1-s51")!;
    expect(s.props).toMatchObject({ verseSide: "l", quoteFirm: "1" });
    const tl = sceneTimeline(s, emptyMedia);
    expect(quoteStart(s.props.verseFrom!, s.props.verseText!, tl, true)).toBeGreaterThan(firstDrawnIdea(s, tl)!.done - 0.06);
    const t2 = sceneTimeline(shot("x", "من بعيد جاء من القرية.", "pending"), emptyMedia);
    expect(quoteStart("من#2", "نص", t2, true)).toBeCloseTo(t2.words[3]!.s, 5);
  });

  it("لا تنزل البطاقة داخل الصلاة على النبي أو «عليه السلام» (002 c1-s8: من «أن» بعد «صلى الله عليه وسلم»)", () => {
    const s = load("002").chapters[0]!.scenes.find((x) => x.id === "c1-s8")!;
    expect(s.props.verseFrom).toBe("أن");
  });

  it("كل حامل في خطط 002–008: كلمته بعد أول فكرة مرسومة (أو مثبَّت بقرار المالك) وصفحته معلنة", () => {
    for (const ep of ["002", "004", "006", "008"]) {
      for (const s of load(ep).chapters[0]!.scenes) {
        const kind = s.props.verseText ? "verse" : s.props.hadithText ? "hadith" : null;
        if (!kind || s.template !== "horizon-shot") continue;
        if (s.props.quotePinned === "1") continue;
        expect(s.props.quoteFirm, `${ep} ${s.id}`).toBe("1");
        expect(kind === "verse" ? s.props.verseSide : s.props.hadithSide, `${ep} ${s.id}`).toMatch(/^[lr]$/);
        const tl = sceneTimeline(s, emptyMedia);
        const idea = firstDrawnIdea(s, tl);
        const from = (kind === "verse" ? s.props.verseFrom : s.props.hadithFrom)!;
        // (إن لم تبقَ كلمة بعد اكتمال الفكرة — المصطلح آخر الجملة — فعلى كلمة الفكرة نفسها، لا قبلها)
        if (idea) expect(quoteStart(from, "نص", tl, true), `${ep} ${s.id}`).toBeGreaterThanOrEqual(idea.s);
      }
    }
    // قرار المالك: «النساء ١» في 002 c2-s10 كما هي (~١٣ ث)
    const c2s10 = load("002").chapters[0]!.scenes.find((x) => x.id === "c2-s10")!;
    expect(c2s10.props).toMatchObject({ quotePinned: "1", verseKey: "4:1" });
  });
});

describe("الاستمرار في الموضوع نفسه وحده (carryAllowed)", () => {
  const plan = load("002");
  const ss = plan.chapters[0]!.scenes;
  const by = (id: string) => ss.find((x) => x.id === id)!;

  it("002: «المائدة ٣١» لا تستمر إلى c1-s44 (شعر منسوب إلى آدم: موضوع آخر)، وتستمر من c1-s38 إلى c1-s40 (الغراب والعجز والندم)", () => {
    expect(continuesQuote(by("c1-s44").narration, Q31).allow).toBe(false);
    expect(continuesQuote(by("c1-s40").narration, Q31).allow).toBe(true);
    expect(by("c1-s44").props.carryText).toBeUndefined();
    expect(by("c1-s44").props.carryAllowed).toBeUndefined();
    expect(by("c1-s38").props).toMatchObject({ verseKey: "5:31", quoteCarried: "c1-s40" });
    expect(by("c1-s40").props).toMatchObject({ carryRef: "5:31", carryFrom: "c1-s38", carryAllowed: "1" });
    expect(by("c1-s40").props.quoteCarried).toBeUndefined();
    // «المائدة ٣٢» لا تستمر إلى «الدرس الصامت من الغراب»
    expect(by("c1-s52").props.carryText).toBeUndefined();
  });

  it("قرارات المحرر في الخطة تبقى: c1-s22 «1» (يشرح علّة الآية نفسها)، وc2-s28 «0» («وذكره الله مع الصابرين» للأنبياء ٨٥ لا لمريم ٥٦–٥٧)", () => {
    expect(by("c1-s22").props).toMatchObject({ carryAllowed: "1", carryRef: "5:28" });
    expect(by("c1-s22").props.carryAuto).toBeUndefined();
    expect(by("c2-s28").props.carryAllowed).toBe("0");
    expect(by("c2-s28").props.carryText).toBeUndefined();
  });

  it("الاستدلال: إشارة صريحة، وشرح كلمة، و«ومعناه»، وكلمتان منه؛ وعند الشك لا", () => {
    expect(continuesQuote("وفي هذه الآية درس عظيم.", "نص لا علاقة له").allow).toBe(true);
    expect(continuesQuote("والكِفل نصيب.", "كان عليه كفل من دمها").allow).toBe(true);
    expect(continuesQuote("ومعناه: أن البشر بدؤوا على التوحيد.", "نص").allow).toBe(true);
    expect(continuesQuote("وفي الآية التي بعدها يحذّر أخاه.", "نص آخر").allow).toBe(false);
    expect(continuesQuote("ومضت الأيام بعد ذلك.", Q31).allow).toBe(false);
  });

  it("الإذن الآلي يُعلَّم carryAuto ويُعاد حسابه؛ ولا يبقى حيث لم تصل البطاقة", () => {
    for (const ep of ["002", "004", "006", "008"])
      for (const s of load(ep).chapters[0]!.scenes) {
        if (s.props.carryAuto === "1") expect(s.props.carryText, `${ep} ${s.id}`).toBeTruthy();
        if (s.props.carryText) expect(s.props.carryAllowed, `${ep} ${s.id}`).toBe("1");
      }
  });
});

describe("الجزء (D222) لما لا يتسع", () => {
  const Q32 = quranOf("002")["5:32"]!;

  it("آية واحدة فوق ٣٠ كلمة: مقطع من أولها حتى علامة وقف يتسع لزمنه، معلَّم «…»؛ وما دونها أو النطاق: لا جزء", () => {
    const seg = autoPartial(Q32, "5:32", 15.6)!;
    expect(seg.endsWith(" ۚ …")).toBe(true);
    expect(Q32.startsWith(seg.slice(0, -2))).toBe(true);
    expect(verseReadSeconds(seg)).toBeLessThanOrEqual(15.6);
    expect(autoPartial(Q31, "5:31", 3)).toBeNull();
    expect(autoPartial(Q32, "5:32-33", 3)).toBeNull();
    // لا مقطع يتسع: أقصر مقطع (أقل نقص)
    expect(autoPartial(Q32, "5:32", 1)).toBe(seg.split(" ۚ")[0] + " ۚ …");
  });

  it("002 c1-s51: «المائدة ٣٢» كاملة بأمر المالك (حكم الدفعة ١٣ البند ٣٢١)، مثبّتة فلا يقصّها الجزء الآلي، ونصها يطابق Tanzil", () => {
    const plan = load("002");
    const s = plan.chapters[0]!.scenes.find((x) => x.id === "c1-s51")!;
    expect(s.props.quotePinned).toBe("1");
    expect(s.props.versePartial).toBeUndefined();
    expect(planVerseMismatches(plan, tanzilVerses).filter((m) => m.sceneId === "c1-s51")).toEqual([]);
  });

  it("إعادة التطبيق نقطة ثابتة، والمثبّتة لا تُقص", () => {
    const plan = load("002");
    const md = readFileSync(path.join(dirOf("002"), "scenes.md"), "utf8");
    const again = inlineQuotesInPlan(plan, quranOf("002"), undefined, md);
    expect(again.plan).toEqual(plan);
    // c1-s51 مثبّتة كاملة (لا جزء آلي عليها)
    expect(again.placements.find((p) => p.host === "c1-s51")?.partial).toBeUndefined();
  });
});

describe("التوقيت الحقيقي (جهاز الاستوديو): الكلمة والصفحة بالكلمات لا بالثواني، والاستمرار يتسع ويضيق", () => {
  it("صوت أبطأ: الكلمة بعد اكتمال الفكرة بتوقيته هو، والصفحة نفسها، والبطاقة لا تقصر عن قراءتها إلا بنقص يُذكر", () => {
    const narr = "يحفر في التراب، ليريه كيف يستر جسد أخيه.";
    const host = shot("h", narr, "bd02-crow", { verseKey: "5:31", verseText: Q31 });
    const next = shot("n", "فتساءل كيف عجز أن يفعل مثل ما فعل الغراب، وغلبه الندم.", "bd02-crow");
    const words = narr.split(/\s+/).map((w, i) => ({ word: w, start: 0.3 + i * 0.9, end: 0.3 + i * 0.9 + 0.8 }));
    const media = { ...emptyMedia, voice: { h: { file: "h.mp3", text: narr, duration: 8, words } } } as never;
    const est = placeQuotes([host, next]);
    const real = placeQuotes([host, next], media);
    expect(est.scenes[0]!.props.verseFrom).toBe("ليريه");
    // بالصوت الأبطأ تكتمل خطوط «يحفر» بعد بداية «في»، فتنزل البطاقة من «التراب»
    expect(real.scenes[0]!.props.verseFrom).toBe("التراب");
    const tl = sceneTimeline(real.scenes[0]!, media);
    expect(quoteStart("التراب", Q31, tl, true)).toBeGreaterThanOrEqual(firstDrawnIdea(real.scenes[0]!, tl)!.done - 0.05);
    expect(real.scenes[0]!.props.verseSide).toBe(est.scenes[0]!.props.verseSide);
    for (const r of [est, real]) {
      const p = r.placements[0]!;
      expect(p.shown + p.shortfall).toBeCloseTo(p.read, 1);
      expect(r.scenes[1]!.props.carryAllowed).toBe("1");
    }
    expect(real.carries[0]!.inHost).not.toBe(est.carries[0]!.inHost);
  });
});
