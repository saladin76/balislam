/**
 * D218 (طلب المالك ٢٤ نوفمبر، البند ٤): بندا بطاقة الجودة «لا سكوت أطول من ثانية» و«لا شاشة واقفة أطول من ٣ ثوانٍ،
 * إلا بطاقة آية تحتها تلاوة». الخطط والملفات هنا مصنوعة في الاختبار (KI-068).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { Plan, PlanScene } from "../src/plan/types";
import { audioItems, buildCard, pictureItems, type FileMeasurements } from "../src/studio/quality/card";
import {
  FREEZE_MAX_SEC, SILENCE_MAX_SEC, SILENCE_NOISE_DB, clockTenth, detectSilences, frozenReport, parseSilences, pauseText, pausesOver,
  recitedVerseSpans, scenesIn, silenceReport,
} from "../src/studio/quality/pauses";
import { remapSpans, planSceneStarts } from "../src/studio/quality/interactivity";
import {
  BLANK_INK_MIN, BLANK_MAX_SEC, INK_H, INK_W, blankIntervals, blankReport, contentInk, detectInkSamples, intersectIntervals, speechSpans,
} from "../src/studio/quality/blankFrame";

const scene = (id: string, template: string, extra: Partial<PlanScene> = {}): PlanScene =>
  ({ id, template, narration: "", line: 0, props: {}, sfx: [], durationSec: 6, ...extra });
const planOf = (...scenes: PlanScene[]): Plan => ({ version: 1, episode: "001", title: "t", domain: "faith" as Plan["domain"], themeId: "x" as Plan["themeId"],
  updatedAt: "", channel: "balislam", chapters: [{ number: 1, title: "", scenes }] });
const recitation = { file: "2-30.mp3", duration: 8, parts: [{ file: "2-30.mp3", duration: 8 }], source: "manual" as const };

describe("D218: الحدود والفترات", () => {
  it("الحدود: سكوت فوق ثانية واحدة، وشاشة واقفة فوق ٣ ث، والعتبة −45 dB كسكوت البداية", () => {
    expect([SILENCE_MAX_SEC, FREEZE_MAX_SEC, SILENCE_NOISE_DB]).toEqual([1, 3, -45]);
    // الحد نفسه يمر، وما زاد عليه يُذكر
    expect(silenceReport([{ from: 10, to: 11 }]).ok).toBe(true);
    expect(silenceReport([{ from: 10, to: 11.05 }]).spans).toEqual([{ from: 10, to: 11.05, scenes: [] }]);
    expect(frozenReport([{ from: 0, to: 3 }]).ok).toBe(true);
    expect(frozenReport([{ from: 0, to: 3.2 }]).ok).toBe(false);
  });

  it("silencedetect: الفترات، وسكوت بلا نهاية يمتد إلى آخر الملف، والمتلاصق يُدمج", () => {
    const err = "[silencedetect @ 0x1] silence_start: 50.3\n[silencedetect @ 0x1] silence_end: 53.1 | silence_duration: 2.8\n"
      + "silence_start: 53.1\nsilence_end: 54\nsilence_start: 118.5\n";
    expect(parseSilences(err, 120)).toEqual([{ from: 50.3, to: 54 }, { from: 118.5, to: 120 }]);
    const r = pausesOver(parseSilences(err, 120), SILENCE_MAX_SEC);
    expect(r.spans.map((x) => [x.from, x.to])).toEqual([[50.3, 54], [118.5, 120]]);
    expect(r.longest).toBe(3.7);
  });

  it("كل فترة تُسمّى بمشاهدها في زمن الملف، والنص بزمن الساعة", () => {
    const starts = [{ id: "c1-s1", start: 0 }, { id: "c1-s2", start: 48 }, { id: "c1-s3", start: 52 }];
    expect(scenesIn({ from: 50.3, to: 53.1 }, starts)).toEqual(["c1-s2", "c1-s3"]);
    expect(scenesIn({ from: 10, to: 12 }, starts)).toEqual(["c1-s1"]);
    // فترة تنتهي عند بداية مشهد لا تُنسب إليه
    expect(scenesIn({ from: 45, to: 48 }, starts)).toEqual(["c1-s1"]);
    expect([clockTenth(299.99), clockTenth(0), clockTenth(553)]).toEqual(["5:00.0", "0:00.0", "9:13.0"]);
    expect(pauseText({ from: 50.3, to: 53.1, scenes: ["c1-s2", "c1-s3"] })).toBe("0:50.3–0:53.1 (c1-s2، c1-s3)");
  });
});

describe("D218: الاستثناء الوحيد — آية تحتها تلاوة", () => {
  const plan = planOf(
    scene("a", "kinetic-text", { narration: "جملة قبل الآية تمهد لما بعدها" }),
    scene("v", "verse-card", { ayahKey: "2:30", props: { text: "نص" } }),
    scene("b", "kinetic-text", { narration: "جملة بعد الآية" }),
  );

  it("بطاقة آية تلاوتها معتمدة في الوسائط: نافذتها معفاة؛ وبلا تلاوة لا تُعفى", () => {
    const withRec = { voice: {}, recitations: { "2:30": recitation } };
    const spans = recitedVerseSpans(plan, withRec);
    expect(spans.map((x) => x.scene)).toEqual(["v"]);
    expect(spans[0]!.to - spans[0]!.from).toBeCloseTo(8, 3);
    expect(recitedVerseSpans(plan, { voice: {}, recitations: {} })).toEqual([]);
    // تلاوة آية أخرى لا تعفي هذه
    expect(recitedVerseSpans(plan, { voice: {}, recitations: { "2:31": recitation } })).toEqual([]);
  });

  it("الشاشة الواقفة على الآية المتلوّة تمر، وعلى الآية بلا تلاوة تُذكر، وخارج النافذة تُذكر", () => {
    const media = { voice: {}, recitations: { "2:30": recitation } };
    const v = recitedVerseSpans(plan, media)[0]!;
    const starts = planSceneStarts(plan, media);
    const frozenOnVerse = [{ from: v.from, to: v.to }];
    expect(frozenReport(frozenOnVerse, recitedVerseSpans(plan, media), starts).ok).toBe(true);
    const bare = frozenReport(frozenOnVerse, recitedVerseSpans(plan, { voice: {}, recitations: {} }), starts);
    expect(bare.ok).toBe(false);
    expect(bare.spans[0]!.scenes).toContain("v");
    // سكون يبدأ في المشهد السابق ويمتد ٤ ث قبل الآية: لا يعفيه أنه يتصل بها
    const before = frozenReport([{ from: v.from - 4, to: v.to }], recitedVerseSpans(plan, media), starts);
    expect(before.spans.map((x) => [x.from, x.to])).toEqual([[Math.round((v.from - 4) * 1000) / 1000, Math.round(v.from * 1000) / 1000]]);
  });

  it("نوافذ ذكر الله لا تُعفى: سكون ٣٫٥ ث على ذكر يُذكر كما هو", () => {
    const p = planOf(scene("d", "kinetic-text", { narration: "قال الله ذلك في كتابه الكريم" }));
    expect(recitedVerseSpans(p, { voice: {}, recitations: {} })).toEqual([]);
    expect(frozenReport([{ from: 0.5, to: 4 }], recitedVerseSpans(p, { voice: {}, recitations: {} })).ok).toBe(false);
  });

  it("النوافذ تُنقل إلى زمن الملف بسجل الوصلات كالسكون المقصود", () => {
    const media = { voice: {}, recitations: { "2:30": recitation } };
    const v = recitedVerseSpans(plan, media);
    const moved = remapSpans(v, planSceneStarts(plan, media), new Map([["a", 0], ["v", 5.2], ["b", 13.2]]));
    expect(moved[0]!.from).toBeCloseTo(5.2, 3);
    expect(moved[0]!.scene).toBe("v");
  });
});

describe("D218: البندان في البطاقة", () => {
  const good: FileMeasurements = { loudness: { integrated: -14, truePeak: -1.5 }, headSilence: 0.2,
    interactivity: { percent: 99, counted: 100, exempt: 0, still: [], ok: true }, video: { width: 3840, height: 2160 },
    mix: { lines: [], ambience: null, sfx: null, ok: true },
    silence: { spans: [], longest: 0.8, max: 1, ok: true }, frozen: { spans: [], longest: 2.1, max: 3, ok: true },
    blank: { spans: [], longest: 0, max: 1, ok: true } };
  const stamp = { file: { size: 1, mtimeMs: 1 }, at: "2026-11-24T00:00:00Z" };
  const p = planOf(scene("a", "kinetic-text", { narration: "لماذا؟" }));
  const item = (items: ReturnType<typeof audioItems>, id: string) => items.find((i) => i.id === id)!;

  it("يمران حين لا فترة فوق الحد، ويمنعان بزمن كل فترة ومشهدها", () => {
    expect(item(audioItems(good), "long-silence").status).toBe("pass");
    expect(item(pictureItems(good, "assembly", p), "frozen-screen").status).toBe("pass");
    const bad = { ...good, silence: { spans: [{ from: 50.3, to: 53.1, scenes: ["c1-s8"] }], longest: 2.8, max: 1, ok: false },
      frozen: { spans: [{ from: 120, to: 129, scenes: ["c1-s14"] }], longest: 9, max: 3, ok: false } };
    const s = item(audioItems(bad), "long-silence");
    expect(s.status).toBe("fail");
    expect(s.reason).toContain("0:50.3–0:53.1 (c1-s8)");
    const f = item(pictureItems(bad, "assembly", p), "frozen-screen");
    expect(f.status).toBe("fail");
    expect(f.reason).toContain("2:00.0–2:09.0 (c1-s14)");
    const card = buildCard({ target: "assembly", plan: p, measured: { ...bad, ...stamp } });
    expect(card.blocks).toBe(true);
    expect(card.blockers.filter((b) => /سكوت أطول|شاشة واقفة/.test(b))).toHaveLength(2);
  });

  it("قياس قديم بلا البندين = لم يُقس (يمنع)، وبلا قياس كذلك", () => {
    const { silence: _s, frozen: _f, blank: _b, ...old } = good;
    expect(item(audioItems(old), "long-silence").status).toBe("unmeasured");
    expect(item(pictureItems(old, "master", p), "frozen-screen").status).toBe("unmeasured");
    expect(item(audioItems(null), "long-silence").status).toBe("unmeasured");
    expect(item(pictureItems(old, "assembly", p), "blank-frame").status).toBe("unmeasured");
  });
});

describe("D218: silencedetect على ملف حقيقي", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "bal-pauses-"));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it("صوت ٨ ث فيه سكوت ٢ ث في وسطه ونصف ثانية في آخره: يُذكر الأول وحده", async () => {
    const f = path.join(tmp, "gap.m4a");
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=8",
      "-af", "volume=enable='between(t,3,5)+between(t,7.5,8)':volume=0", "-c:a", "aac", "-b:a", "128k", "-y", f]);
    const r = silenceReport(await detectSilences(f, 8));
    expect(r.spans).toHaveLength(1);
    expect(r.spans[0]!.from).toBeGreaterThan(2.9);
    expect(r.spans[0]!.to).toBeLessThan(5.1);
  }, 60_000);
});

describe("D218: الإطار شبه الفارغ أثناء الكلام", () => {
  const frame = () => new Uint8Array(INK_W * INK_H);
  const set = (f: Uint8Array, x: number, y: number) => { f[y * INK_W + x] = 255; };

  it("خطوط الدفتر الطويلة (حافة الصفحة والكعب وسطر الورق) ليست حبرًا؛ الكلمة والرسم حبر", () => {
    const f = frame();
    for (let y = 0; y < INK_H; y++) { set(f, 20, y); set(f, 160, y); set(f, 161, y); } // حافة وكعب
    for (let x = 0; x < INK_W; x++) set(f, x, 50); // سطر يعبر الصفحة
    expect(contentInk(f)).toBe(0);
    // «عنوان» صغير: مربع ١٠×١٠ من الحواف بعيدًا عن الخطوط
    for (let y = 10; y < 20; y++) for (let x = 200; x < 210; x++) set(f, x, y);
    expect(contentInk(f)).toBe(100);
    expect(100).toBeGreaterThan(BLANK_INK_MIN);
  });

  it("العينات المتتالية تحت الحد فترة واحدة رغم كسور الفاصلة العائمة، والحد نفسه ليس فارغًا", () => {
    const xs = Array.from({ length: 10 }, (_, i) => ({ t: 376 + i * 0.2, ink: 42 }));
    expect(blankIntervals(xs)).toHaveLength(1);
    expect(blankIntervals([{ t: 0, ink: BLANK_INK_MIN }])).toEqual([]);
  });

  it("التقاطع والكلام: الفجوة القصيرة بين كلمتين كلام متصل، والطويلة تقطعه؛ والزمن من بداية المشهد في الملف", () => {
    expect(intersectIntervals([{ from: 0, to: 5 }, { from: 8, to: 9 }], [{ from: 4, to: 8.5 }])).toEqual([{ from: 4, to: 5 }, { from: 8, to: 8.5 }]);
    const p = planOf(scene("a", "kinetic-text", { narration: "كلمة أخرى ثالثة" }), scene("b", "kinetic-text", { narration: "بلا صوت" }));
    const voice = { a: { file: "a.mp3", hash: "", text: "كلمة أخرى ثالثة", duration: 5, words: [
      { word: "كلمة", start: 0, end: 0.5 }, { word: "أخرى", start: 0.9, end: 1.4 }, { word: "ثالثة", start: 3, end: 3.5 }] } };
    const sp = speechSpans(p, { voice }, [{ id: "a", start: 10 }, { id: "b", start: 16 }]);
    expect(sp.map((x) => [x.from, x.to].map((v) => Math.round(v * 1000) / 1000))).toEqual([[10, 11.4], [13, 13.5]]);
    // مقطع لا يطابق نص مشهده لا يُحسب
    expect(speechSpans(p, { voice: { a: { ...voice.a, text: "نص قديم" } } }, [{ id: "a", start: 0 }])).toEqual([]);
  });

  it("يُذكر ما زاد على ثانية من الفارغ أثناء الكلام، بمشهده؛ والفارغ في السكوت لا يُذكر هنا", () => {
    const samples = Array.from({ length: 60 }, (_, i) => ({ t: i * 0.2, ink: i >= 10 && i < 30 ? 40 : 500 })); // فارغ 2–6 ث
    const starts = [{ id: "c1-s34", start: 0 }];
    expect(blankReport(samples, [{ from: 0, to: 12 }], starts).spans.map((x) => [x.from, Math.round(x.to * 10) / 10, x.scenes])).toEqual([[2, 6, ["c1-s34"]]]);
    expect(blankReport(samples, [{ from: 0, to: 2.9 }], starts).ok).toBe(true); // ٠٫٩ ث فقط مع الكلام
    expect(blankReport(samples, [], starts).ok).toBe(true);
    expect(BLANK_MAX_SEC).toBe(1);
  });

  it("ffmpeg على ملف حقيقي: لون واحد فارغ، وصورة الاختبار مليئة", async () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), "bal-blank-"));
    try {
      const f = path.join(tmp, "v.mp4");
      execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=0xF0E6D2:s=640x360:r=30:d=2", "-f", "lavfi", "-i", "testsrc2=s=640x360:r=30:d=2",
        "-filter_complex", "[0][1]concat=n=2:v=1:a=0[v]", "-map", "[v]", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-y", f]);
      const xs = await detectInkSamples(f);
      expect(xs.length).toBeGreaterThanOrEqual(19);
      const b = blankIntervals(xs);
      expect(b).toHaveLength(1);
      expect(b[0]!.from).toBe(0);
      expect(b[0]!.to).toBeGreaterThan(1.9);
      expect(b[0]!.to).toBeLessThan(2.3);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  }, 60_000);
});
