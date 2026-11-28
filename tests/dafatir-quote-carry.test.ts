/**
 * D246 (قرار المالك ٢٨ نوفمبر): بطاقة الآية/الحديث تبقى زمن قراءتها كاملًا (ثانيتان + كلمتان في الثانية، ٥ ث على الأقل)، فإن
 * قصر كلام مشهدها استمرت البطاقة نفسها إلى التالي (وما بعده) والراوي يكمل، بلا سكوت يُضاف؛ والخطة تسجّل الاستمرار فيتفق عليه
 * الرسم والمدة والسكون المقصود وفحص الشاشة الواقفة.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { computeQuoteCarries, CARRY_KEYS } from "../src/plan/quoteCarry";
import { verseWindow, verseReadSeconds, hzSentences, HZ_LEAD, quoteHoldsScene } from "../src/remotion/dafatir/horizon/meta";
import { buildTimeline } from "../src/remotion/dafatir/horizon/timeline";
import { sceneSeconds } from "../src/plan/duration";
import { sceneAdvanceFrames } from "../src/plan/seams";
import { intendedStillness } from "../src/render/stillnessSpans";
import { shownVerses } from "../src/quran/verseSource";
import { planVerseTexts } from "../src/voice/quranGuard";
import { emptyMedia } from "../src/plan/media";
import type { Plan, PlanScene } from "../src/plan/types";

const LONG = Array.from({ length: 24 }, (_, i) => `كلمة${i}`).join(" "); // 24 كلمة ← 14 ث قراءة
const shot = (id: string, narration: string, extra: Record<string, string> = {}, s = "bd02-tell"): PlanScene =>
  ({ id, template: "horizon-shot", narration, line: 1, props: { shot: s, ...extra }, sfx: [] });
const host = (id: string, narration: string, text = LONG) => shot(id, narration, { verseKey: "5:27", verseText: text, verseFrom: narration.split(" ")[0]! });
const planOf = (scenes: PlanScene[]): Plan =>
  ({ version: 1, episode: "999", title: "", domain: "islamic", themeId: "x", channel: "dafatir-alzaman", lang: "ar", chapters: [{ number: 1, title: "", scenes }] }) as unknown as Plan;
const tl = (n: string) => buildTimeline(hzSentences(n), HZ_LEAD);

describe("زمن القراءة: ثانيتان + كلمتان في الثانية، ٥ ث على الأقل", () => {
  it("الصيغة", () => {
    expect(verseReadSeconds(LONG)).toBe(14);
    expect(verseReadSeconds("قصيرة جدا")).toBe(5);
    expect(verseReadSeconds("كلمة ۖ كلمة …")).toBe(5);
  });
});

describe("computeQuoteCarries", () => {
  // D246 «أ»: الاستمرار إلى مشهد معلَّم carryAllowed «1» وحده (الموضوع نفسه)
  const scenes = [host("a", "جملة قصيرة هنا."), shot("b", `ثم يكمل الراوي كلامه في المشهد التالي ${Array.from({ length: 30 }, (_, i) => `ب${i}`).join(" ")}.`, { carryAllowed: "1" }), shot("c", "وبعدها.")];
  const r = computeQuoteCarries(scenes);
  const adv = sceneAdvanceFrames(r.scenes, emptyMedia, { channelId: "dafatir-alzaman" }).map((f) => f / 30);

  it("الحامل يُعلَّم quoteCarried، والتالي يحمل البطاقة نفسها بثوانيها، ومجموع الظهور = زمن القراءة", () => {
    const [a, b] = r.scenes;
    expect(a!.props.quoteCarried).toBe("b");
    expect(b!.props).toMatchObject({ carryKind: "verse", carryText: LONG, carryRef: "5:27", carryFrom: "a" });
    const s = verseWindow(a!.props, tl(a!.narration), sceneSeconds(a!))![0];
    const shown = adv[0]! - s + Number(b!.props.carrySeconds);
    expect(shown).toBeCloseTo(14, 1);
    expect(r.carries).toEqual([expect.objectContaining({ host: "a", read: 14, shortfall: 0, carried: [{ id: "b", seconds: Number(b!.props.carrySeconds) }] })]);
    expect(r.scenes[2]!.props.carryText).toBeUndefined();
  });

  it("لا سكوت يُضاف: مدة الحامل والتالي كما هي بلا البطاقة", () => {
    const bare = (s: PlanScene) => ({ ...s, props: { shot: s.props.shot! } });
    expect(sceneSeconds(r.scenes[0]!)).toBe(sceneSeconds(bare(r.scenes[0]!)));
    expect(sceneSeconds(r.scenes[1]!)).toBe(sceneSeconds(bare(r.scenes[1]!)));
    expect(quoteHoldsScene(r.scenes[0]!.props)).toBe(false);
  });

  it("النوافذ: الحامل من ظهورها إلى آخره، والتالي من أول إطار إلى carrySeconds", () => {
    const [a, b] = r.scenes;
    const da = sceneSeconds(a!);
    expect(verseWindow(a!.props, tl(a!.narration), da)![1]).toBe(da);
    expect(verseWindow(b!.props, tl(b!.narration), sceneSeconds(b!))).toEqual([0, Number(b!.props.carrySeconds)]);
  });

  it("السكون المقصود يستمر في التالي، وفحص المصحف وحارس الصوت يريان النص المستمر", () => {
    const p = planOf(r.scenes);
    const spans = intendedStillness(p, 0).filter((x) => x.why === "آية");
    expect(spans.length).toBe(2);
    expect(spans[1]!.from).toBeCloseTo(adv[0]!, 2);
    expect(shownVerses(p).shown.map((v) => v.sceneId)).toEqual(["a", "b"]);
    expect(planVerseTexts(p)).toEqual([LONG, LONG]);
  });

  it("سلسلة عبر مشهدين، ولا استمرار إلى تمهيد آية أخرى أو مشهد يحمل اقتباسًا (النقص يُذكر)", () => {
    const chain = computeQuoteCarries([host("a", "قصيرة."), shot("b", "وجيزة جدا.", { carryAllowed: "1" }), shot("c", "ثم جملة أطول قليلا من سابقتها في هذا المشهد الأخير بكلمات كثيرة.", { carryAllowed: "1" })]);
    expect(chain.scenes[1]!.props.quoteCarried).toBe("c");
    expect(chain.carries[0]!.carried.map((x) => x.id)).toEqual(["b", "c"]);
    const stop = computeQuoteCarries([host("a", "قصيرة."), shot("t", "كما جاء في سورة البقرة:", { ref: "البقرة · ١" }, "verse-tag")]);
    expect(stop.carries[0]).toMatchObject({ carried: [], stop: expect.stringMatching(/تمهيد آية/) });
    expect(stop.carries[0]!.shortfall).toBeGreaterThan(5);
    expect(stop.scenes[0]!.props.quoteCarried).toBeUndefined();
    // D246 «أ»: بلا carryAllowed (موضوع آخر) لا استمرار، والبطاقة تبقى في ذيل حاملها
    const topic = computeQuoteCarries([host("a", "قصيرة."), shot("b", "وجيزة جدا.")]);
    expect(topic.carries[0]).toMatchObject({ carried: [], stop: expect.stringMatching(/موضوع آخر/) });
    expect(topic.scenes[0]!.props).toMatchObject({ quoteHold: "1" });
    expect(topic.scenes[1]!.props.carryText).toBeUndefined();
  });

  it("القراءة تتسع في ذيل الحامل قبل بداية التالي: quoteHold بلا استمرار", () => {
    const words = Array.from({ length: 16 }, (_, i) => `ك${i}`).join(" ") + ".";
    const r2 = computeQuoteCarries([host("a", words, "نص قصير من خمس كلمات هنا"), shot("b", "التالي.")]);
    const a = r2.scenes[0]!;
    if (a.props.quoteHold) {
      const w = verseWindow(a.props, tl(a.narration), sceneSeconds(a))!;
      expect(w[1] - w[0]).toBeCloseTo(verseReadSeconds("نص قصير من خمس كلمات هنا"), 5);
      expect(r2.scenes[1]!.props.carryText).toBeUndefined();
    } else expect(a.props.quoteCarried).toBeUndefined();
  });

  it("توقيت الصوت الحقيقي إن طابق نص المشهد، ويُعاد الحساب من الصفر كل مرة", () => {
    const narr = "جملة قصيرة هنا.";
    const media = { ...emptyMedia, voice: { a: { file: "a.mp3", text: narr, duration: 9, words: [{ word: "جملة", start: 0.2, end: 2 }, { word: "قصيرة", start: 2.2, end: 5 }, { word: "هنا.", start: 5.2, end: 8.5 }] } } } as never;
    const voiced = computeQuoteCarries(scenes, media);
    expect(Number(voiced.scenes[1]!.props.carrySeconds)).toBeLessThan(Number(r.scenes[1]!.props.carrySeconds));
    const again = computeQuoteCarries(r.scenes);
    expect(again.scenes).toEqual(r.scenes);
    expect(CARRY_KEYS).toContain("carrySeconds");
  });
});

describe("الرسم: البطاقة المستمرة في مساحة الشاشة في المشهدين", () => {
  it("HorizonShot يرسم بطاقة الاستمرار خارج كاميرا الدفتر برفع الإطار نفسه", () => {
    const src = readFileSync("src/remotion/scenes/HorizonShot.tsx", "utf8");
    expect(src).toMatch(/const screenCard = Boolean\(carriedOn \|\| quote\?\.carried\)/);
    expect(src).toMatch(/!portrait && vw && verseShow > 0 && screenCard \? <AbsoluteFill style=\{\{ transform: `translateY\(\$\{-lift\}px\)` \}\}>\{card\}<\/AbsoluteFill>/);
    expect(src).toMatch(/VersePageContext\.Provider value=\{vw && verseShow > 0 && !screenCard && !portrait \? card : null\}/);
  });
});

describe("خطط «دفاتر الزمن» المتتبَّعة: كل بطاقة تُقرأ كاملة إلا ما سُمّي", () => {
  const DIR = "channels/dafatir-alzaman/episodes";
  // نقص لا يحله الاستمرار ولا D222 (آية واحدة حتى ٣٠ كلمة أو نطاق لا يُجزَّأ)؛ ينتظر قرار المالك
  // D246 «أ» (قرار المالك ٢٨ نوفمبر): لا استمرار إلى موضوع آخر، فيبقى نقص حيث خرج الراوي عن الآية أو الحديث (القيم بالتقدير؛
  // بالصوت الحقيقي على جهاز الاستوديو تختلف قليلًا). 002 c2-s10 «النساء ١» قبله المالك كما هو (~١٣ ث، مثبَّت quotePinned).
  const KNOWN: Record<string, Record<string, number>> = {
    "002": { "c1-s23": 0.26, "c1-s38": 4.13, "c1-s51": 7.9, "c2-s10": 2.4, "c2-s27": 1.91, "c2-s36": 0.92 },
    "004": { "c1-s42": 4.21, "c2-s19": 9.86, "c2-s24": 2.4, "c2-s33": 14.49 },
    "006": { "c1-s11": 0.67, "c2-s18": 0.49, "c2-s40": 4.82 },
    "008": { "c1-s5": 1.12, "c2-s11": 2.22, "c2-s21": 0.81 },
  };
  for (const ep of ["002", "004", "006", "008"]) {
    it(ep, () => {
      const dir = path.join(DIR, readdirSync(DIR).find((d) => d.startsWith(`${ep}-`))!);
      const plan = JSON.parse(readFileSync(path.join(dir, "plan.json"), "utf8")) as Plan;
      const r = computeQuoteCarries(plan.chapters[0]!.scenes, emptyMedia, { channelId: plan.channel });
      // بنية الخطة كما يحسبها الأمر (قيم الاستمرار نفسها قد تُحدَّث بتوقيت الصوت الحقيقي على جهاز الاستوديو)
      const bare = (xs: PlanScene[]) => xs.map((x) => ({ ...x, props: Object.fromEntries(Object.entries(x.props).filter(([k]) => !(CARRY_KEYS as readonly string[]).includes(k))) }));
      expect(bare(r.scenes)).toEqual(bare(plan.chapters[0]!.scenes));
      // الخطة المحفوظة قد تحمل استمرارًا محسوبًا بالصوت الحقيقي (جهاز الاستوديو)، فيمتد إلى مشهد أبعد أو أقرب من التقدير:
      // يُفحص اتساقها هي: كل مشهد يحمل carryText يأخذه من بطاقة مضيف قبله في سلسلة متصلة، وكل مضيف استمرار له تالٍ يحمله
      const ss = plan.chapters[0]!.scenes;
      const quoteText = (x: PlanScene) => x.props.verseText || x.props.hadithText || "";
      ss.forEach((s, i) => {
        if (!s.props.carryText) return;
        let j = i - 1;
        while (j >= 0 && ss[j]!.props.carryText === s.props.carryText && !quoteText(ss[j]!)) j--;
        expect(j >= 0 && quoteText(ss[j]!) === s.props.carryText, `${ep} ${s.id}: استمرار بلا مضيف`).toBe(true);
      });
      for (const s of ss) if (s.props.quoteCarried) expect(ss.find((x) => x.id === s.props.quoteCarried)?.props.carryText, `${ep} ${s.id}`).toBe(quoteText(s) || s.props.carryText);
      // والنقص (بالتقدير هنا) لا يكون إلا فيما سُمّي ينتظر قرار المالك
      for (const c of r.carries.filter((x) => x.shortfall > 0)) {
        expect(Object.keys(KNOWN[ep] ?? {}), `${ep} ${c.host}`).toContain(c.host);
        expect(c.shortfall, `${ep} ${c.host}`).toBeLessThanOrEqual(KNOWN[ep]![c.host]! + 0.05);
      }
    });
  }
});

describe("مرجع البطاقة وموضعها (D246)", () => {
  it("كل مرجع آية في خطط «دفاتر الزمن» 001–008 باسم سورته (لا «سورة 5»)، والنطاق بشرطة، والجزء «(جزء)»", async () => {
    const { verseRef } = await import("../src/remotion/dafatir/horizon/kit");
    const DIR = "channels/dafatir-alzaman/episodes";
    const keys = new Set<string>();
    for (const d of readdirSync(DIR).filter((x) => /^00\d-/.test(x))) {
      let plan: Plan;
      try { plan = JSON.parse(readFileSync(path.join(DIR, d, "plan.json"), "utf8")) as Plan; } catch { continue; }
      for (const s of plan.chapters.flatMap((c) => c.scenes)) for (const k of [s.props.verseKey, s.props.carryKind !== "hadith" ? s.props.carryRef : undefined, s.ayahKey]) if (k) keys.add(k);
    }
    expect(keys.size).toBeGreaterThan(20);
    for (const k of keys) expect(verseRef(k), k).not.toMatch(/سورة|\d/);
    expect(verseRef("5:27")).toBe("المائدة: ٢٧");
    expect(verseRef("19:56-57")).toBe("مريم: ٥٦–٥٧");
    expect(verseRef("2:213", true)).toBe("البقرة: ٢١٣ (جزء)");
    expect(verseRef("2:30")).toBe("البقرة: ٣٠");
  });

  it("البطاقة داخل صفحتها بهامش (العرض يشمل الحشو والإطار)", async () => {
    const { PAGE_X, QUOTE_MARGIN, QUOTE_CARD_W, quoteCardLeft, VerseCard, HadithPageCard } = await import("../src/remotion/dafatir/horizon/kit");
    const React = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    for (const side of ["l", "r"] as const) {
      const [a, b] = PAGE_X[side];
      expect(quoteCardLeft(side)).toBeGreaterThanOrEqual(a + QUOTE_MARGIN);
      expect(quoteCardLeft(side) + QUOTE_CARD_W).toBeLessThanOrEqual(b - QUOTE_MARGIN);
    }
    for (const el of [React.createElement(VerseCard, { show: 1, text: "نص", refKey: "5:27", place: "page", side: "r" }), React.createElement(HadithPageCard, { show: 1, text: "نص", refText: "مسلم", side: "r" })]) {
      const html = renderToStaticMarkup(el);
      expect(html).toMatch(/box-sizing:border-box/);
      expect(html).toContain(`left:${quoteCardLeft("r")}px`);
      expect(html).toContain(`width:${QUOTE_CARD_W}px`);
    }
  });
});

describe("العمودي (D243 + D246): البطاقة المستمرة في المستطيل نفسه", () => {
  it("مستطيل PortraitQuoteCard من النص والمرجع وحدهما (الحامل والمستمر إليه)، ومرجعه باسم السورة، وHorizonShot يمرر carry*", async () => {
    const { portraitQuoteLayout, quoteRefLine } = await import("../src/remotion/dafatir/horizon/portraitQuote");
    const ref = quoteRefLine({ kind: "verse", text: LONG, refKey: "5:27" });
    expect(ref).toBe("المائدة: ٢٧");
    expect(portraitQuoteLayout(LONG, ref)).toEqual(portraitQuoteLayout(LONG, quoteRefLine({ kind: "verse", text: LONG, refKey: "5:27" })));
    const src = readFileSync("src/remotion/scenes/HorizonShot.tsx", "utf8");
    expect(src).toMatch(/refKey: String\(c \? pr\.carryRef : pr\.verseKey\)/);
    expect(src).toMatch(/PortraitQuoteCard progress=\{quoteProgress\}/);
    expect(src).toMatch(/!screenCard && !portrait \? card : null/);
  });
});

