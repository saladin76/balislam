/**
 * D242 (قرار المالك ٢٨ نوفمبر): الآيات والأحاديث في «دفاتر الزمن» كما في 001 — النص داخل لقطة «خط الأفق» المجاورة والراوي
 * مستمر، لا مشهد صامت؛ والبوابة ترفض مشهد آية/حديث صامتًا قبل الرندر؛ ونافذة الحديث ساكنة ومستثناة كنافذة الآية (D214).
 */
import { describe, expect, it } from "vitest";
import React from "react";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { attachQuoteCards, inlineQuotesInPlan, quoteFromWord } from "../src/plan/fromScenes";
import { silentQuoteScenes, assertNoSilentQuoteScenes } from "../src/plan/silentQuotes";
import { planIssues } from "../src/plan/validate";
import { hzQuote, verseReadSeconds, verseWindow, hzSentences, HZ_LEAD } from "../src/remotion/dafatir/horizon/meta";
import { buildTimeline } from "../src/remotion/dafatir/horizon/timeline";
import { HadithPageCard, hadithAttribution } from "../src/remotion/dafatir/horizon/kit";
import { intendedStillness } from "../src/render/stillnessSpans";
import { planVerseTexts } from "../src/voice/quranGuard";
import { shownVerses } from "../src/quran/verseSource";
import { parseScript } from "../src/script/parse";
import { quranFromScript } from "../src/quran/scriptText";
import type { Plan, PlanScene } from "../src/plan/types";

const shot = (id: string, narration: string, s = "bd02-tell", extra: Record<string, string> = {}): PlanScene =>
  ({ id, template: "horizon-shot", narration, line: 1, props: { shot: s, ...extra }, sfx: [] });
const verse = (id: string, key: string, text = "نص آية للاختبار هنا"): PlanScene =>
  ({ id, template: "verse-card", narration: "", line: 1, ayahKey: key, props: { text, reference: key, reciter: "" }, sfx: [] });
const hadith = (id: string): PlanScene =>
  ({ id, template: "hadith-card", narration: "", line: 1, props: { text: "نص حديث للاختبار", narrator: "أنس بن مالك", reference: "صحيح مسلم ١٦٢", grade: "صحيح" }, sfx: [] });
const planOf = (scenes: PlanScene[], channel = "dafatir-alzaman"): Plan =>
  ({ version: 1, episode: "999", title: "", domain: "islamic", themeId: "x", channel, lang: "ar", chapters: [{ number: 1, title: "", scenes }] }) as unknown as Plan;

describe("attachQuoteCards: كل بطاقة على لقطة متكلَّمة مجاورة", () => {
  it("الجارة الأطول كلامًا، وعند التساوي التالية؛ والبطاقة تُحذف ونص كل مشهد كما هو", () => {
    const r = attachQuoteCards([shot("a", "واحد اثنان ثلاثة أربعة"), verse("v", "5:27"), shot("b", "واحد اثنان")]);
    expect(r.scenes.map((s) => s.id)).toEqual(["a", "b"]);
    expect(r.attached).toEqual([{ card: "v", kind: "verse", ref: "5:27", to: "a", side: "prev", words: 4 }]);
    expect(r.scenes[0]!.props).toMatchObject({ verseKey: "5:27", verseText: "نص آية للاختبار هنا", verseFrom: "واحد" });
    const tie = attachQuoteCards([shot("a", "واحد اثنان"), verse("v", "5:27"), shot("b", "ثلاثة أربعة")]);
    expect(tie.attached[0]!.to).toBe("b");
  });

  it("لا لقطة pending إن وُجدت غيرها، والجزء يُعلَّم versePartial، والصفحة من HZ_META.quoteSide", () => {
    const part = { ...verse("v", "2:213"), props: { text: "… نص جزء …", reference: "البقرة · ٢١٣ (جزء)", reciter: "", partial: "1" } };
    const r = attachQuoteCards([shot("p", "كلام طويل جدا هنا فعلا الآن", "pending"), part, shot("b", "قصير", "bd02-two-loads")]);
    expect(r.attached[0]!.to).toBe("b");
    expect(r.scenes.find((s) => s.id === "b")!.props).toMatchObject({ versePartial: "1", verseSide: "l" });
  });

  it("بطاقتان تتنازعان لقطة: الحديث أولًا، والآية إلى جارتها الأخرى؛ ولا لقطة تحمل اقتباسين", () => {
    const r = attachQuoteCards([shot("tag", "كما جاء في سورة الأنبياء:", "verse-tag"), verse("v", "21:85"), shot("n", "وفي حديث المعراج الصحيح كلام طويل هنا", "bd03-hadith-note"), hadith("h"), shot("w", "قصير")]);
    expect(r.attached.map((a) => `${a.card}->${a.to}`)).toEqual(["v->tag", "h->n"]);
    const n = r.scenes.find((s) => s.id === "n")!;
    expect(n.props).toMatchObject({ hadithText: "نص حديث للاختبار", hadithRef: "صحيح مسلم ١٦٢", hadithNarrator: "أنس بن مالك", hadithFrom: "وفي", hadithSide: "l" });
    expect(n.props.verseText).toBeUndefined();
  });

  it("بلا جارة متكلَّمة أو بنص مؤقت: تبقى البطاقة وتُذكر", () => {
    expect(attachQuoteCards([verse("v", "5:27")]).unattached).toEqual([{ card: "v", reason: expect.any(String) }]);
    expect(attachQuoteCards([shot("a", "كلام"), verse("v", "5:27", "‹نص الآية مطلوب داخل السكريبت›")]).unattached.map((u) => u.card)).toEqual(["v"]);
  });

  it("كلمة الظهور أول كلمة ليست ذكرًا لله، بلا ترقيم", () => {
    expect(quoteFromWord("الله أعلم، وقال الناس")).toBe("أعلم");
    expect(quoteFromWord("«وأمر» الله نبيه")).toBe("وأمر");
  });
});

describe("دفاتر الزمن 002: الخطة المتتبَّعة بلا مشهد صامت", () => {
  const dir = path.join("channels/dafatir-alzaman/episodes", readdirSync("channels/dafatir-alzaman/episodes").find((d) => d.startsWith("002-"))!);
  const plan = JSON.parse(readFileSync(path.join(dir, "plan.json"), "utf8")) as Plan;
  const scenes = plan.chapters.flatMap((c) => c.scenes);
  const parsed = parseScript(readFileSync(path.join(dir, "script.md"), "utf8"));
  const quran = quranFromScript(parsed).texts;
  const HOSTS: Record<string, string> = {
    "c1-s8": "5:27", "c1-s21": "5:28", "c1-s23": "5:29", "c1-s28": "5:30", "c1-s31": "صحيح مسلم ١٦٧٧", "c1-s40": "5:31", "c1-s51": "5:32",
    "c2-s10": "4:1", "c2-s14": "2:213", "c2-s27": "19:56-57", "c2-s31": "21:85", "c2-s36": "صحيح مسلم ١٦٢",
  };

  it("صفر بطاقات، والاثنتا عشرة كل واحدة على لقطة واحدة، ونص الآية من السكريبت كما يأخذه المحرك", () => {
    expect(scenes.filter((s) => s.template === "verse-card" || s.template === "hadith-card")).toEqual([]);
    const hosts = Object.fromEntries(scenes.filter((s) => s.props.verseKey || s.props.hadithRef).map((s) => [s.id, s.props.verseKey ?? s.props.hadithRef]));
    expect(hosts).toEqual(HOSTS);
    for (const s of scenes) if (s.props.verseKey) expect(s.props.verseText, s.id).toBe(quran[s.props.verseKey]);
    expect(scenes.find((s) => s.id === "c2-s14")!.props.versePartial).toBe("1");
    expect(silentQuoteScenes(plan)).toEqual([]);
  });

  it("التحويل لا يمس نص أي مشهد ولا حقول المالك، وتطبيقه ثانية لا يغيّر شيئًا", () => {
    const again = inlineQuotesInPlan(plan, quran);
    expect(again.attached).toEqual([]);
    expect(again.plan).toEqual(plan);
    expect(scenes.filter((s) => s.tone === "calm").map((s) => s.id)).toEqual(["c1-s35", "c1-s37", "c1-s38", "c1-s40"]);
  });

  it("تحويل خطة ببطاقاتها: نص كل مشهد باقٍ كما كان، والنبرة وedited كما هي، وشورت يبدأ ببطاقة يُرفض", () => {
    const before = planOf([{ ...shot("a", "نص أول طويل هنا", "bd02-tell"), tone: "calm", edited: true }, verse("v", "5:27", ""), shot("b", "قصير")]);
    const r = inlineQuotesInPlan(before, { "5:27": "نص من السكريبت" });
    expect(r.removed).toEqual(["v"]);
    const a = r.plan.chapters[0]!.scenes[0]!;
    expect(a).toMatchObject({ tone: "calm", edited: true, narration: "نص أول طويل هنا" });
    expect(a.props.verseText).toBe("نص من السكريبت");
    expect(() => inlineQuotesInPlan({ ...before, shorts: [{ from: "v", to: "b" }] }, { "5:27": "نص" })).toThrow(/الشورت/);
  });
});

describe("نافذة الحديث كنافذة الآية (D242، D214)", () => {
  const narration = "وفي حديث المعراج الصحيح أن النبي لقي إدريس في السماء الرابعة. وأما موضع إدريس فلا نعلمه على التعيين.";
  const props = { shot: "bd03-hadith-note", hadithText: "ثم عرج بنا إلى السماء الرابعة فإذا أنا بإدريس", hadithRef: "صحيح مسلم ١٦٢", hadithFrom: "وفي" };

  it("hzQuote يعرف الحديث، والنافذة بزمن قراءته داخل الكلام", () => {
    expect(hzQuote(props)).toEqual({ kind: "hadith", text: props.hadithText, from: "وفي" });
    const tl = buildTimeline(hzSentences(narration), HZ_LEAD);
    const w = verseWindow(props, tl)!;
    expect(w[1] - w[0]).toBeCloseTo(verseReadSeconds(props.hadithText), 5);
    expect(hzQuote({ hadithText: "نص" })).toBeNull();
  });

  it("السكون المقصود: نافذة «حديث» للقطة «خط الأفق»، وبطاقة الحديث القديمة كلها", () => {
    const spans = intendedStillness(planOf([shot("n", narration, "bd03-hadith-note", props)]), 0);
    expect(spans.some((s) => s.why === "حديث" && s.to - s.from > 4)).toBe(true);
    const card = intendedStillness(planOf([hadith("h")], "balislam"), 0);
    expect(card.map((s) => s.why)).toEqual(["حديث"]);
  });

  it("نص الحديث لا يدخل فحص المصحف ولا قائمة الآيات التي يُمنع الصوت من قراءتها خطأً", () => {
    const p = planOf([shot("n", narration, "bd03-hadith-note", props)]);
    expect(shownVerses(p)).toEqual({ shown: [], problems: [] });
    expect(planVerseTexts(p)).toEqual([]);
  });

  it("بطاقة الحديث على الصفحة: إطار الآية نفسه بخط الأميري لا خط المصحف، والراوي ثم المصدر", () => {
    const html = renderToStaticMarkup(<HadithPageCard show={1} text="نص الحديث" refText="صحيح مسلم ١٦٢" narrator="أنس بن مالك" side="l" />);
    expect(html).toContain("نص الحديث");
    expect(html).toContain("عن أنس بن مالك · صحيح مسلم ١٦٢");
    expect(html).not.toContain("Amiri Quran");
    expect(hadithAttribution("صحيح مسلم ١٦٧٧", "عن عبد الله")).toBe("عن عبد الله · صحيح مسلم ١٦٧٧");
  });
});

describe("بوابة D242: لا مشهد آية أو حديث صامت في «دفاتر الزمن»", () => {
  const bad = planOf([shot("a", "كلام"), verse("v", "5:27"), hadith("h")]);

  it("ترفضه فحص الخطة (خطأ مبكر) برسالة تسمي المشهد وتقول إن النص داخل اللقطة المجاورة", () => {
    const errs = planIssues(bad).filter((i) => i.level === "error" && i.message.startsWith("D242"));
    expect(errs.map((e) => e.sceneId)).toEqual(["v", "h"]);
    expect(errs[0]).toMatchObject({ early: true });
    expect(errs[0]!.message).toMatch(/داخل لقطة «خط الأفق» المجاورة.*كما في 001/);
    expect(() => assertNoSilentQuoteScenes(bad)).toThrow(/v: D242/);
  });

  it("القناتان الأخريان كما هما، والمشهد المتكلَّم لا يُعد صامتًا", () => {
    expect(silentQuoteScenes(planOf(bad.chapters[0]!.scenes, "balislam"))).toEqual([]);
    expect(silentQuoteScenes(planOf(bad.chapters[0]!.scenes, "zubdat-alkutub"))).toEqual([]);
    expect(silentQuoteScenes(planOf([{ ...hadith("h"), narration: "كلام" }]))).toEqual([]);
  });

  it("قبل كل رندر وكل مهمة لجهاز الرندر", () => {
    const src = (f: string) => readFileSync(f, "utf8");
    expect(src("src/render/episode.ts")).toMatch(/assertTemplatesApproved\(plan\);\n\s*\/\/ D242[^\n]*\n\s*assertNoSilentQuoteScenes\(plan\);/);
    expect(src("src/render/worker/macJobs.ts").match(/assertNoSilentQuoteScenes\(plan\);/g)).toHaveLength(2);
  });
});
