/**
 * «سرعة الإلقاء» و«الفاصل بين الجمل» (طلب المالك ١٤ نوفمبر، D140): النموذج الصافي (src/voice/pace.ts)، والملفات
 * (src/voice/paceFile.ts)، والمدة (src/plan/duration.ts). بلا صوت ولا شبكة: حساب المد والتقصير والتوقيت والاستثناءات.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import config from "../config.json";
import {
  DEFAULT_PAUSE, DEFAULT_SPEED, MIN_GAP, MIN_SCENE_TAIL, PAUSES, SPEEDS, checkPaceDoc, cleanPace, keepOf, paceExemption,
  pacedTimes, planPace, sceneTailFor, scenePace, speedOf, type PaceDoc, type PaceSentence,
} from "../src/voice/pace";
import { pacedOverlay, pacedValidFor, type PacedEntry } from "../src/voice/paceFile";
import { predictedClip } from "../src/voice/paceApply";
import { sceneSeconds } from "../src/plan/duration";
import { isOwnerContentPath } from "../scripts/contentPaths.mjs";
import type { PlanScene } from "../src/plan/types";

const scene = (o: Partial<PlanScene>): PlanScene => ({ id: "c1-s1", template: "alley-tale", line: 1, narration: "", sfx: [], props: {}, ...o } as PlanScene);
const wc = (t: string) => t.trim().split(/\s+/).filter(Boolean).length;
/** كلمات منتظمة: كل كلمة 0.3 ث وبين الكلمات 0.05، وبين الجملتين وقفة */
const wordsOf = (counts: number[], gap = 0.6, lead = 0.2) => {
  const ws: { word: string; start: number; end: number }[] = [];
  let t = lead;
  counts.forEach((n, k) => {
    for (let i = 0; i < n; i++) { ws.push({ word: `w${k}-${i}`, start: t, end: t + 0.3 }); t += 0.35; }
    t += k < counts.length - 1 ? gap - 0.05 : 0;
  });
  return ws;
};

describe("السرعات الثلاث لكل نبرة، والفاصل", () => {
  it("«متوسط» سرعة النبرة كما هي (الافتراضي)، و«هادئ» أبطأ، و«سريع» أسرع؛ والفاصل «عادي» لا يقصّر", () => {
    expect(DEFAULT_SPEED).toBe("medium");
    expect(SPEEDS.medium.factor).toBe(1);
    expect(SPEEDS.relaxed.factor).toBeGreaterThanOrEqual(0.92);
    expect(SPEEDS.relaxed.factor).toBeLessThan(1);
    expect(SPEEDS.fast.factor).toBeGreaterThanOrEqual(1.12);
    expect(SPEEDS.fast.factor).toBeLessThanOrEqual(1.2);
    expect([SPEEDS.relaxed.nameAr, SPEEDS.medium.nameAr, SPEEDS.fast.nameAr]).toEqual(["هادئ", "متوسط", "سريع"]);
    expect(DEFAULT_PAUSE).toBe("normal");
    expect(PAUSES.normal.factor).toBe(1);
    expect(PAUSES.shortest.factor).toBeLessThan(PAUSES.shorter.factor);
  });

  it("الأسبقية: الجملة ← المشهد ← الحلقة ← «متوسط»، والجملة بمشهدها ونصها (لا بمعرّف محلي)", () => {
    const doc: PaceDoc = { version: 1, episode: { speed: "fast" }, scenes: { "c1-s2": "relaxed" }, sentences: [{ scene: "c1-s2", text: "جملة  أولى.", speed: "medium" }] };
    expect(speedOf({ version: 1 }, "c1-s1", "أي")).toEqual({ id: "medium", source: "default" });
    expect(speedOf(doc, "c1-s1", "أي")).toEqual({ id: "fast", source: "episode" });
    expect(speedOf(doc, "c1-s2", "أخرى.")).toEqual({ id: "relaxed", source: "scene" });
    expect(speedOf(doc, "c1-s2", "جملة أولى.")).toEqual({ id: "medium", source: "sentence" });
    // نص الجملة تغيّر: لا تسري السرعة المكتوبة لنص قديم
    expect(speedOf(doc, "c1-s2", "جملة ثانية.").source).toBe("scene");
  });

  it("بلا اختيار، أو بـ«متوسط/عادي»: المفتاح فارغ — لا يتغير مشهد قائم", () => {
    const s = scene({ narration: "أولى. ثانية." });
    const list = [{ text: "أولى.", kind: "narration" as const }, { text: "ثانية.", kind: "narration" as const }];
    expect(scenePace({ version: 1 }, s, undefined, list, wc).key).toBe("");
    expect(scenePace({ version: 1, episode: { speed: "medium", pause: "normal" } }, s, undefined, list, wc).key).toBe("");
    const fast = scenePace({ version: 1, episode: { speed: "fast" } }, s, undefined, list, wc);
    expect(fast.key).toMatch(/^[a-f0-9]{16}$/);
    expect(fast.sentences.map((x) => x.factor)).toEqual([SPEEDS.fast.factor, SPEEDS.fast.factor]);
    expect(scenePace({ version: 1, episode: { pause: "shorter" } }, s, undefined, list, wc).key).not.toBe("");
  });
});

describe("ما لا يُمد ولا يُقص أبدًا", () => {
  const fast: PaceDoc = { version: 1, episode: { speed: "fast", pause: "shortest" } };
  it("مشهد الآية، وتمهيدها، ولقطات السكون المقصود: لا سرعة ولا فاصل", () => {
    expect(paceExemption(scene({ template: "verse-card", ayahKey: "53:39" }))).toMatch(/آية/);
    expect(paceExemption(scene({ template: "ink-shot", props: { shot: "verse-intro-1" } }))).toMatch(/تمهيد آية/);
    expect(paceExemption(scene({ narration: "قال الله تعالى:" }), scene({ id: "c1-s2", template: "verse-card" }))).toMatch(/تمهيد آية/);
    expect(paceExemption(scene({ template: "horizon-shot", props: { shot: "basmala" }, narration: "بسم الله" }))).toMatch(/ذكر الله/);
    const lead = scenePace(fast, scene({ narration: "قال الله تعالى:" }), scene({ id: "c1-s2", template: "verse-card" }),
      [{ text: "قال الله تعالى:", kind: "narration" }], wc);
    expect(lead).toMatchObject({ key: "", pause: 1 });
    expect(lead.exempt).toBeTruthy();
    // مشهد عادي بعده آية لكنه لا ينتهي بنقطتين: ليس تمهيدًا
    expect(paceExemption(scene({ narration: "جملة عادية." }), scene({ id: "c1-s2", template: "verse-card" }))).toBeNull();
  });

  it("البسملة (تسجيل المالك) بمعامل ١، والفاصل الملاصق لها لا يُقصَّر", () => {
    const sp = scenePace(fast, scene({ narration: "بسم الله الرحمن الرحيم أولى. ثانية." }), undefined,
      [{ text: "بسم الله الرحمن الرحيم", kind: "basmala" }, { text: "أولى.", kind: "narration" }, { text: "ثانية.", kind: "narration" }], wc);
    expect(sp.sentences.map((x) => [x.factor, x.exempt])).toEqual([[1, true], [SPEEDS.fast.factor, false], [SPEEDS.fast.factor, false]]);
    const ws = wordsOf([4, 1, 1]);
    const plan = planPace({ duration: ws[ws.length - 1]!.end + 0.5, words: ws }, sp.sentences, sp.pause);
    const gaps = plan.pieces.filter((p) => p.kind === "gap");
    expect(gaps).toHaveLength(2);
    expect(gaps[0]!.kind === "gap" && gaps[0]!.keep).toBeCloseTo(gaps[0]!.to - gaps[0]!.from, 6); // بعد البسملة: كما هو
    expect(gaps[1]!.kind === "gap" && gaps[1]!.keep).toBeLessThan(gaps[1]!.to - gaps[1]!.from);
    // البسملة نفسها لا تُمد: قطعتها بمعامل ١، وكلماتها في مكانها (الرأس قبلها كما هو)
    const first = plan.pieces.find((p) => p.kind === "speech")!;
    expect(first.kind === "speech" && first.factor).toBe(1);
    const t = pacedTimes(plan, ws);
    for (let i = 0; i < 4; i++) { expect(t.words[i]!.start).toBeCloseTo(ws[i]!.start, 3); expect(t.words[i]!.end).toBeCloseTo(ws[i]!.end, 3); }
  });

  it("الآية داخل نص الراوي (صف آية) بمعامل ١", () => {
    const sp = scenePace(fast, scene({ narration: "﴿نص﴾ أولى." }), undefined, [{ text: "﴿نص﴾", kind: "verse" }, { text: "أولى.", kind: "narration" }], wc);
    expect(sp.sentences[0]).toMatchObject({ factor: 1, exempt: true });
  });
});

describe("خطة المد والتقصير والتوقيت", () => {
  const S = (n: number, f: number): PaceSentence => ({ words: n, factor: f, exempt: false });
  it("الكلام يُمد بمعامله، والرأس يبقى كما هو، والوقفة بين الجملتين تُقصَّر من وسطها، وكل كلمة تتبع زمنها", () => {
    const ws = wordsOf([3, 2], 0.8, 0.3);
    const D = ws[ws.length - 1]!.end + 0.6;
    const plan = planPace({ duration: D, words: ws }, [S(3, 1.2), S(2, 1.2)], 0.35);
    expect(plan.uniform).toBe(false);
    expect(plan.pieces.map((p) => p.kind)).toEqual(["head", "speech", "gap", "speech", "tail"]);
    const t = pacedTimes(plan, ws);
    // الرأس: أول كلمة في مكانها تقريبًا (الرأس لا يُمد؛ الهامش قبلها يُمد)
    expect(t.words[0]!.start).toBeCloseTo(ws[0]!.start, 1);
    // مدة كلام الجملة الأولى = الأصل ÷ ١٫٢
    expect(t.words[2]!.end - t.words[0]!.start).toBeCloseTo((ws[2]!.end - ws[0]!.start) / 1.2, 3);
    // الوقفة بين الجملتين أقصر، ولا تقل عن الحد
    const gapBefore = ws[3]!.start - ws[2]!.end, gapAfter = t.words[3]!.start - t.words[2]!.end;
    expect(gapAfter).toBeLessThan(gapBefore * 0.6);
    expect(gapAfter).toBeGreaterThan(MIN_GAP);
    // التوقيت متصاعد، والمدة أقصر
    for (let i = 1; i < t.words.length; i++) expect(t.words[i]!.start).toBeGreaterThanOrEqual(t.words[i - 1]!.end - 1e-6);
    expect(t.duration).toBeLessThan(D * 0.85);
  });

  it("«هادئ» يبطئ الكلام والوقفات «عادي» كما هي", () => {
    const ws = wordsOf([2, 2], 0.5);
    const D = ws[ws.length - 1]!.end + 0.3;
    const plan = planPace({ duration: D, words: ws }, [S(2, SPEEDS.relaxed.factor), S(2, SPEEDS.relaxed.factor)], 1);
    const t = pacedTimes(plan, ws);
    expect(t.duration).toBeGreaterThan(D);
    // الصمت بين الجملتين كما هو، والهامشان الملاصقان للكلام وحدهما يُمدان معه
    expect(Math.abs((t.words[2]!.start - t.words[1]!.end) - (ws[2]!.start - ws[1]!.end))).toBeLessThan(0.01);
  });

  it("عدد الكلمات لا يطابق الجمل (توقيت غير موثوق): مد واحد للكلام كله بمتوسط موزون، وتقصير الذيل وحده", () => {
    const ws = wordsOf([5], 0);
    const plan = planPace({ duration: ws[ws.length - 1]!.end + 0.6, words: ws }, [S(2, 1), S(4, 1.15)], 0.6);
    expect(plan.uniform).toBe(true);
    const sp = plan.pieces.filter((p) => p.kind === "speech");
    expect(sp).toHaveLength(1);
    expect(sp[0]!.kind === "speech" && sp[0]!.factor).toBeCloseTo((2 * 1 + 4 * 1.15) / 6, 4);
  });

  it("التقصير لا يطيل أبدًا ولا يقل عن حده، والمعامل ١ يبقي الطول", () => {
    expect(keepOf(0.5, 1, MIN_GAP)).toBe(0.5);
    expect(keepOf(0.05, 0.35, MIN_GAP)).toBe(0.05);
    expect(keepOf(1, 0.35, MIN_GAP)).toBeCloseTo(0.35, 6);
    expect(keepOf(0.15, 0.35, MIN_GAP)).toBe(MIN_GAP);
  });

  it("ذيل المشهد بعد صوته يقصر بالفاصل ولا يقل عن حده؛ و«عادي» كما في الإعداد", () => {
    expect(sceneTailFor(config.voice.tailSeconds, 1)).toBe(config.voice.tailSeconds);
    expect(sceneTailFor(config.voice.tailSeconds, 0.35)).toBeGreaterThanOrEqual(MIN_SCENE_TAIL);
    const clip = { file: "a.wav", hash: "h", text: "أولى. ثانية.", duration: 5, words: wordsOf([1, 1]) };
    const s = scene({ narration: "أولى. ثانية.", template: "alley-tale" });
    const before = sceneSeconds(s, { voice: { [s.id]: clip }, recitations: {} } as never);
    const sp = scenePace({ version: 1, episode: { speed: "fast", pause: "shortest" } }, s, undefined,
      [{ text: "أولى.", kind: "narration" }, { text: "ثانية.", kind: "narration" }], wc);
    const after = sceneSeconds(s, { voice: { [s.id]: predictedClip(clip, sp) }, recitations: {} } as never);
    expect(after).toBeLessThan(before);
  });

  it("دفاتر الزمن (خريطة نبرة): رأس ما بعد الآية لا يُمد، والمدة المقررة تنقص بقدر ما نقص الصوت", () => {
    const ws = wordsOf([2, 2], 0.6, 1.2);
    const raw = { file: "a.wav", hash: "h", text: "x", duration: ws[ws.length - 1]!.end + 0.4, words: ws,
      timing: { pre: 1.1, tail: 1, seconds: ws[ws.length - 1]!.end + 1.4, speechStart: ws[0]!.start, speechEnd: ws[ws.length - 1]!.end, toneMap: "m", parts: [{ partId: "p", at: 1.1, trimStart: 0, trimEnd: 0 }] } };
    const sp = scenePace({ version: 1, episode: { speed: "fast", pause: "shorter" } }, scene({ narration: "أ ب. ج د." }), undefined,
      [{ text: "أ ب.", kind: "narration" }, { text: "ج د.", kind: "narration" }], wc);
    const p = predictedClip(raw, sp);
    expect(p.timing!.pre).toBe(1.1);
    expect(p.timing!.speechStart).toBeCloseTo(ws[0]!.start, 1);
    expect(raw.timing.seconds - p.timing!.seconds).toBeCloseTo(raw.duration - p.duration, 6);
  });
});

describe("الملفات: pace.json محتوى مالك، والنسخ المطبَّقة محلية", () => {
  it("pace.json بجوار السكريبت يُحفظ في main، ولا شيء تحت voice/", () => {
    // مجلد حلقة مصطنع (لا حلقة حقيقية): المسار وحده يُصنَّف
    const ep = (ch: string) => `channels/${ch}/episodes/${["001", "x"].join("-")}`;
    expect(isOwnerContentPath(`${ep("balislam")}/pace.json`)).toBe(true);
    expect(isOwnerContentPath(`${ep("dafatir-alzaman")}/pace.json`)).toBe(true);
    expect(isOwnerContentPath(`${ep("zubdat-alkutub")}/pace.json`)).toBe(true);
    expect(isOwnerContentPath(`${ep("balislam")}/voice/paced.json`)).toBe(false);
    expect(isOwnerContentPath(`${ep("balislam")}/voice/paced-0123456789abcdef.wav`)).toBe(false);
  });

  it("بوابة المحتوى ترفض القيم غير المعروفة، والقراءة تُسقطها", () => {
    expect(checkPaceDoc({ version: 1, episode: { speed: "fast", pause: "shorter" }, scenes: { "c1-s1": "relaxed" }, sentences: [{ scene: "c1-s1", text: "أ", speed: "medium" }] })).toEqual([]);
    expect(checkPaceDoc({ version: 1, episode: { speed: "turbo" } }).join(" ")).toMatch(/turbo/);
    expect(checkPaceDoc({ version: 2 }).length).toBeGreaterThan(0);
    expect(checkPaceDoc({ version: 1, scenes: { "c1-s1": 1.5 } }).length).toBeGreaterThan(0);
    expect(cleanPace({ version: 1, episode: { speed: "turbo", pause: "shortest" }, scenes: { "c1-s1": "x", "c1-s2": "fast" } }))
      .toEqual({ version: 1, episode: { pause: "shortest" }, scenes: { "c1-s2": "fast" } });
  });

  const tmp = mkdtempSync(path.join(os.tmpdir(), "bal-pace-"));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));
  it("ما يقرؤه الرندر والسجل: النسخة المطبَّقة ما دامت مصنوعة من الأصل الحالي نفسه، وإلا الأصل كما هو", async () => {
    const ep = path.join(tmp, "episodes", "001-x");
    mkdirSync(path.join(ep, "voice"), { recursive: true });
    const scriptPath = path.join(ep, "script.md");
    writeFileSync(scriptPath, "");
    writeFileSync(path.join(ep, "voice", "raw.wav"), "x");
    writeFileSync(path.join(ep, "voice", "paced-aaaaaaaaaaaaaaaa.wav"), "y");
    const raw = { file: "raw.wav", hash: "h1", text: "t", duration: 4, words: [] };
    const entry: PacedEntry = { key: "k", from: { file: "raw.wav", hash: "h1", duration: 4 },
      clip: { ...raw, file: "paced-aaaaaaaaaaaaaaaa.wav", duration: 3.4, paced: { key: "k", from: { file: "raw.wav", hash: "h1", duration: 4 }, speed: 1.15, pause: 1 } } };
    writeFileSync(path.join(ep, "voice", "paced.json"), JSON.stringify({ "c1-s1": entry }));
    const voiceDir = path.join(ep, "voice");
    expect(pacedValidFor(entry, raw, voiceDir)).toBe(true);
    expect((await pacedOverlay(scriptPath, { "c1-s1": raw }))["c1-s1"]).toMatchObject({ file: "paced-aaaaaaaaaaaaaaaa.wav", duration: 3.4 });
    // الأصل تغيّر (تسجيل جديد): النسخة القديمة لا تُستعمل
    const regenerated = { ...raw, file: "raw2.wav", hash: "h2" };
    expect((await pacedOverlay(scriptPath, { "c1-s1": regenerated }))["c1-s1"]).toEqual(regenerated);
    // ملف النسخة اختفى: الأصل
    rmSync(path.join(ep, "voice", "paced-aaaaaaaaaaaaaaaa.wav"));
    expect((await pacedOverlay(scriptPath, { "c1-s1": raw }))["c1-s1"]).toEqual(raw);
  });
});
