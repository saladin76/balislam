/**
 * D217 (طلب المالك ٢٤ نوفمبر، البند ٤): بندا بطاقة الجودة «لا سكوت أطول من ثانية» و«لا شاشة واقفة أطول من ٣ ثوانٍ،
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

const scene = (id: string, template: string, extra: Partial<PlanScene> = {}): PlanScene =>
  ({ id, template, narration: "", line: 0, props: {}, sfx: [], durationSec: 6, ...extra });
const planOf = (...scenes: PlanScene[]): Plan => ({ version: 1, episode: "001", title: "t", domain: "faith" as Plan["domain"], themeId: "x" as Plan["themeId"],
  updatedAt: "", channel: "balislam", chapters: [{ number: 1, title: "", scenes }] });
const recitation = { file: "2-30.mp3", duration: 8, parts: [{ file: "2-30.mp3", duration: 8 }], source: "manual" as const };

describe("D217: الحدود والفترات", () => {
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

describe("D217: الاستثناء الوحيد — آية تحتها تلاوة", () => {
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

describe("D217: البندان في البطاقة", () => {
  const good: FileMeasurements = { loudness: { integrated: -14, truePeak: -1.5 }, headSilence: 0.2,
    interactivity: { percent: 99, counted: 100, exempt: 0, still: [], ok: true }, video: { width: 3840, height: 2160 },
    mix: { lines: [], ambience: null, sfx: null, ok: true },
    silence: { spans: [], longest: 0.8, max: 1, ok: true }, frozen: { spans: [], longest: 2.1, max: 3, ok: true } };
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
    const { silence: _s, frozen: _f, ...old } = good;
    expect(item(audioItems(old), "long-silence").status).toBe("unmeasured");
    expect(item(pictureItems(old, "master", p), "frozen-screen").status).toBe("unmeasured");
    expect(item(audioItems(null), "long-silence").status).toBe("unmeasured");
  });
});

describe("D217: silencedetect على ملف حقيقي", () => {
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
