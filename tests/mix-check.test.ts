/**
 * فحص الخلط سطرًا سطرًا (D158، بطاقة الجودة): الراوي أعلى من صوت المكان ≥ ١٥ dB ومن المؤثر على الجملة ≥ ٦ dB،
 * بالعلو الذي يخرج به الرندر (الخفض تحت الكلام، والسكون المقصود، وربح سرد المشهد). القياس على ملفات حقيقية يصنعها ffmpeg.
 */
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Plan, PlanScene } from "../src/plan/types";
import type { EpisodeMedia } from "../src/plan/media";
import { checkMix, gatedLoudness, measureFrames, parseFrames, sentenceSpans, type Frame } from "../src/studio/quality/mix";
import { mixItems } from "../src/studio/quality/card";

const words = (text: string, per = 0.5) => text.split(/\s+/).filter(Boolean).map((word, i) => ({ word, start: i * per, end: i * per + per * 0.9 }));
const scene = (id: string, narration: string, extra: Partial<PlanScene> = {}): PlanScene =>
  ({ id, template: "kinetic-text", narration, line: 0, props: {}, sfx: [], durationSec: 6, ...extra });
const planOf = (...scenes: PlanScene[]): Plan => ({ version: 1, episode: "001", title: "t", domain: "faith" as Plan["domain"], themeId: "x" as Plan["themeId"],
  updatedAt: "", channel: "dafatir-alzaman", chapters: [{ number: 1, title: "", scenes }] });
const mediaOf = (scenes: PlanScene[], sfx: string[]): Pick<EpisodeMedia, "voice" | "recitations" | "sfx"> => ({
  recitations: {}, sfx,
  voice: Object.fromEntries(scenes.map((s) => [s.id, { file: `${s.id}.mp3`, text: s.narration.trim(), words: words(s.narration) } as never])),
});
/** علو ثابت لكل ١٠٠ ms من 0.1 إلى d */
const flat = (m: number, d: number): Frame[] => Array.from({ length: Math.round(d * 10) }, (_, i) => ({ t: Math.round((i + 1) * 10) / 100, m }));
const vol = { narrationVolume: 1, sfxVolume: 1 };

describe("فحص الخلط: الحساب", () => {
  it("الجمل بمواضعها من كلمات الراوي", () => {
    const s = scene("a", "سار الرجل في الطريق. ثم توقف فجأة؟");
    expect(sentenceSpans(s, words(s.narration))).toEqual([
      { text: "سار الرجل في الطريق.", from: 0, to: 1.95 }, { text: "ثم توقف فجأة؟", from: 2, to: 3.45 }]);
  });

  it("العلو المتكامل من الإطارات: الصمت لا يُحسب، والثابت يبقى كما هو", () => {
    expect(gatedLoudness([...flat(-20, 1), { t: 2, m: -120 }, { t: 2.1, m: -Infinity }])).toBeCloseTo(-20, 5);
    expect(gatedLoudness([{ t: 1, m: -90 }])).toBeNull();
  });

  it("مؤثر عالٍ على الجملة يفشل ويسمّي الجملة والمؤثر؛ ومنخفض ينجح", () => {
    const s = scene("c1-s1", "دخل التاجر السوق مبكرًا. وكانت الشمس حارة.", { sfx: [{ id: "stamp", at: 0.5 }] });
    const media = mediaOf([s], ["stamp"]);
    const loud = checkMix(planOf(s), media, { voice: { "c1-s1": flat(-18, 4) }, sfx: { stamp: flat(-21, 0.6) } }, vol);
    expect(loud.lines).toHaveLength(1);
    expect(loud.lines[0]).toMatchObject({ scene: "c1-s1", sentence: "دخل التاجر السوق مبكرًا.", sfx: "stamp", kind: "sfx", margin: 3, need: 6, ok: false });
    expect(loud.ok).toBe(false);
    const soft = checkMix(planOf(s), media, { voice: { "c1-s1": flat(-18, 4) }, sfx: { stamp: flat(-21, 0.6) } }, { ...vol, sfxVolume: 0.5 });
    expect(soft.lines[0]!.margin).toBeCloseTo(9, 1);
    expect(soft.ok).toBe(true);
  });

  it("صوت المكان يُقاس بعد خفضه تحت الكلام (SFX_MIX.duck)، وحده ١٥ dB", () => {
    const s = scene("c1-s2", "هبت الريح على القافلة طويلًا.", { sfx: [{ id: "wind", at: 0 }] });
    const r = checkMix(planOf(s), mediaOf([s], ["wind"]), { voice: { "c1-s2": flat(-18, 3) }, sfx: { wind: flat(-26, 3) } }, vol);
    // −26 + 20·log10(0.35) ≈ −35.1 ← الفرق ≈ 17.1
    expect(r.lines[0]).toMatchObject({ kind: "ambience", need: 15, ok: true });
    expect(r.lines[0]!.margin).toBeCloseTo(17.1, 1);
    expect(r.ambience).toBe(r.lines[0]!.margin);
  });

  it("ربح سرد المشهد يدخل في علو الراوي؛ والمؤثر بعد آخر جملة لا يُحسب", () => {
    const s = scene("c1-s3", "قلب الكاتب الصفحة.", { sfx: [{ id: "stamp", at: 0.2 }, { id: "page-turn", at: 4 }] });
    const media = mediaOf([s], ["stamp", "page-turn"]);
    const lv = { voice: { "c1-s3": flat(-20, 2) }, sfx: { stamp: flat(-24, 0.5), "page-turn": flat(-10, 0.5) } };
    expect(checkMix(planOf(s), media, lv, vol).lines.map((l) => [l.sfx, l.margin])).toEqual([["stamp", 4]]);
    expect(checkMix(planOf(s), media, lv, { ...vol, narrationGain: { "c1-s3": 2 } }).lines[0]!.margin).toBeCloseTo(10, 1);
  });

  it("مؤثر بلا ملف، أو مشهد بلا صوت راوٍ مطابق: لا جملة تُفحص", () => {
    const s = scene("c1-s4", "كلام.", { sfx: [{ id: "aah-outro", at: 0 }] });
    expect(checkMix(planOf(s), mediaOf([s], []), { voice: { "c1-s4": flat(-20, 1) }, sfx: {} }, vol).lines).toEqual([]);
    const t = scene("c1-s5", "كلام جديد.", { sfx: [{ id: "stamp", at: 0 }] });
    const stale = { ...mediaOf([t], ["stamp"]), voice: { "c1-s5": { file: "x.mp3", text: "كلام قديم.", words: words("كلام قديم.") } as never } };
    expect(checkMix(planOf(t), stale, { voice: { "c1-s5": flat(-20, 1) }, sfx: { stamp: flat(-10, 1) } }, vol).lines).toEqual([]);
  });
});

describe("فحص الخلط: البطاقة", () => {
  it("✗ يسمّي أسوأ الجمل؛ ولا مؤثر على الكلام ✓؛ وبلا قياس «لم يُقس»", () => {
    const line = (margin: number, kind: "ambience" | "sfx" = "sfx") =>
      ({ scene: "c1-s1", sentence: "دخل التاجر السوق.", sfx: kind === "sfx" ? "stamp" : "wind", kind, narrator: -18, peak: -18 - margin, margin, need: kind === "sfx" ? 6 : 15, ok: margin >= (kind === "sfx" ? 6 : 15) });
    const [amb, sfx] = mixItems({ lines: [line(20, "ambience"), line(3), line(8)], ambience: 20, sfx: 3, ok: false });
    expect(amb).toMatchObject({ status: "pass" });
    expect(sfx).toMatchObject({ status: "fail", reason: expect.stringContaining("c1-s1 «دخل التاجر السوق.» ← stamp") });
    expect(mixItems({ lines: [], ambience: null, sfx: null, ok: true }).map((i) => i.status)).toEqual(["pass", "pass"]);
    expect(mixItems(undefined).map((i) => i.status)).toEqual(["unmeasured", "unmeasured"]);
  });
});

describe("فحص الخلط: القياس على ملفات حقيقية", () => {
  let dir = "";
  beforeAll(async () => { dir = await mkdtemp(path.join(os.tmpdir(), "mix-")); });
  afterAll(async () => { await rm(dir, { recursive: true, force: true }); });

  it("إطارات ebur128 اللحظية، ومؤثر أقصر من النافذة يُقاس بعد إلحاق صمت", async () => {
    const tone = path.join(dir, "tone.wav"), blip = path.join(dir, "blip.wav");
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=1000:duration=2", "-af", "volume=-20dB", "-y", tone]);
    execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "sine=frequency=1000:duration=0.2", "-af", "volume=-20dB", "-y", blip]);
    const f = await measureFrames(tone);
    expect(f.length).toBeGreaterThanOrEqual(19);
    // sine بسعة ⅛ (−18 dBFS) ثم −20 dB ← نحو −41 LUFS
    expect(gatedLoudness(f)!).toBeGreaterThan(-44);
    expect(gatedLoudness(f)!).toBeLessThan(-38);
    const short = await measureFrames(blip, 0.5);
    expect(Math.max(...short.map((x) => x.m))).toBeGreaterThan(-60);
    expect(parseFrames("[x] t: 0.4  TARGET:-23 LUFS    M: -24.3 S:-120.7  I: -70.0 LUFS")).toEqual([{ t: 0.4, m: -24.3 }]);
  });
});
