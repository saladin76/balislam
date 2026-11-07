import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { speechBounds, safeTrim, readWav, TRIM_DEFAULTS } from "../src/remotion/dafatir/audio/trim";
import { partJobs, layoutScene, segmentWindows, PART_GAP_SEC, type ToneMap, type PartClip, type CharAlignment } from "../src/remotion/dafatir/audio/parts";
import { buildAudioTimeline, silenceProblems, SILENCE_POLICY, type TimelineItem } from "../src/remotion/dafatir/audio/silence";
import { HZ_META } from "../src/remotion/dafatir/horizon/meta";
import { stripTashkeel } from "../src/voice/tashkeel";

/**
 * بنية الصوت المعزولة لـ«دفاتر الزمن» (الأمر 025). كل البيانات هنا صناعية: لا تسجيل حقيقي ولا توليد،
 * ولا تغيير في توقيت الحلقة الإنتاجي (plan.json والمحرك المشترك لا يستدعيان هذه الوحدات).
 */
const EP = "channels/dafatir-alzaman/episodes/001-adam-beginning";
const map = JSON.parse(readFileSync(path.join(EP, "tone-map.json"), "utf8")) as ToneMap & { segments: (ToneMap["segments"][number] & { wpm: number[] })[] };
const plan = JSON.parse(readFileSync(path.join(EP, "plan.json"), "utf8")) as { chapters: { scenes: { id: string; template: string; narration?: string; props?: { shot?: string } }[] }[] };
const scenes = plan.chapters.flatMap((c) => c.scenes);

// ——— إشارات صناعية ———
const SR = 16000;
const dbAmp = (d: number) => 10 ** (d / 20);
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
/** صمت بضجيج خفيف، ثم حرف مهموس ضعيف، ثم كلام مجهور، ثم تلاشٍ (نفَس)، ثم صمت */
const synthClip = (p: { lead: number; fric: number; voiced: number; decay: number; trail: number }) => {
  const parts: number[] = [];
  const push = (sec: number, f: (t: number) => number) => { for (let i = 0; i < Math.round(sec * SR); i++) parts.push(f(i / SR)); };
  push(p.lead, () => rnd() * dbAmp(-72));
  push(p.fric, () => rnd() * dbAmp(-36));
  push(p.voiced, (t) => Math.sin(2 * Math.PI * 140 * t) * dbAmp(-12) * Math.min(1, t / 0.02));
  push(p.decay, (t) => rnd() * dbAmp(-36) * Math.exp(-t / (p.decay / 2.5)));
  push(p.trail, () => rnd() * dbAmp(-72));
  return Float32Array.from(parts);
};
const wav16 = (s: Float32Array, rate: number) => {
  const b = new Uint8Array(44 + s.length * 2);
  const v = new DataView(b.buffer);
  const w = (o: number, t: string) => [...t].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  w(0, "RIFF"); v.setUint32(4, 36 + s.length * 2, true); w(8, "WAVE"); w(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, "data"); v.setUint32(40, s.length * 2, true);
  s.forEach((x, i) => v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, x)) * 32767), true));
  return b;
};

describe("قص طرفي التسجيل دون أكل الحروف", () => {
  const P = { lead: 0.4, fric: 0.07, voiced: 0.6, decay: 0.12, trail: 0.5 };
  const b = speechBounds(synthClip(P), SR);

  it("يحفظ الحرف المهموس في البداية والتلاشي في النهاية، ويترك هامشيهما", () => {
    expect(b.speechStart).toBeLessThanOrEqual(P.lead + 0.005);
    expect(b.start).toBeLessThanOrEqual(P.lead - TRIM_DEFAULTS.onsetPadSec + 0.011);
    const voicedEnd = P.lead + P.fric + P.voiced;
    expect(b.speechEnd).toBeGreaterThan(voicedEnd + 0.03);
    expect(b.end).toBeGreaterThanOrEqual(b.speechEnd + TRIM_DEFAULTS.releasePadSec - 1e-9);
  });

  it("يزيل الصمت الزائد: لا يبقى قبل الكلام أكثر من الهامش ولا بعده أكثر من التلاشي والهامش", () => {
    expect(b.speechStart - b.start).toBeLessThanOrEqual(TRIM_DEFAULTS.onsetPadSec + 1e-9);
    expect(b.end - b.speechEnd).toBeLessThanOrEqual(TRIM_DEFAULTS.releasePadSec + 1e-9);
    expect(b.start).toBeGreaterThan(0.25);
    expect(b.duration - b.end).toBeGreaterThan(0.3);
  });

  it("تسجيل يبدأ بالكلام مباشرة لا يُقص منه شيء، والتسجيل الصامت يُرفض", () => {
    const c = speechBounds(synthClip({ lead: 0, fric: 0.05, voiced: 0.5, decay: 0.1, trail: 0.3 }), SR);
    expect(c.start).toBe(0);
    expect(c.speechStart).toBe(0);
    expect(() => speechBounds(new Float32Array(SR), SR)).toThrow("لا كلام");
  });

  it("محاذاة الحروف توسّع القص ولا تضيّقه: أول حرف وآخر حرف داخل القص دائمًا", () => {
    const wide = safeTrim(b, { start: [b.speechStart - 0.05, 0.6], end: [0.5, b.speechEnd + 0.04] });
    expect(wide.start).toBeLessThanOrEqual(b.speechStart - 0.05 - TRIM_DEFAULTS.onsetPadSec + 1e-9);
    expect(wide.end).toBeGreaterThanOrEqual(b.speechEnd + 0.04);
    const inside = safeTrim(b, { start: [b.speechStart + 0.1], end: [b.speechEnd - 0.1] });
    expect(inside).toEqual(b);
  });

  it("قراءة WAV صناعي تعطي الحدود نفسها", () => {
    const s = synthClip(P);
    const w = readWav(wav16(s, SR));
    expect(w.sampleRate).toBe(SR);
    const c = speechBounds(w.samples, w.sampleRate);
    expect(Math.abs(c.speechStart - b.speechStart)).toBeLessThanOrEqual(0.011);
    expect(Math.abs(c.speechEnd - b.speechEnd)).toBeLessThanOrEqual(0.011);
  });
});

// ——— تسجيلات صناعية لكل جزء من خريطة النبرة ———
const jobs = partJobs(map);
const synthPartClip = (partId: string): PartClip => {
  const job = jobs.find((j) => j.partId === partId)!;
  const segs = job.segmentIds.map((id) => map.segments.find((s) => s.id === id)! as ToneMap["segments"][number] & { wpm: number[] });
  const speech = segs.reduce((n, s) => n + (stripTashkeel(s.text).split(/\s+/).length / ((s.wpm[0]! + s.wpm[1]!) / 2)) * 60, 0) + (segs.length - 1) * 0.4;
  // تسجيل مقصوص: هامش 0.06 قبل الكلام، و0.15 بعده (كما يتركهما trim.ts)
  return { partId, duration: speech + 0.6, start: 0.2, speechStart: 0.26, speechEnd: 0.26 + speech, end: 0.41 + speech };
};
const clips = Object.fromEntries(jobs.map((j) => [j.partId, synthPartClip(j.partId)]));

describe("أكثر من جزء صوتي في المشهد الواحد (D5)", () => {
  it("52 مهمة توليد: جزء لكل مشهد، وجزءان لـc7-s8، ونص كل مشهد = أجزاؤه موصولة", () => {
    expect(jobs).toHaveLength(52);
    expect(jobs.filter((j) => j.scene === "c7-s8").map((j) => [j.partId, j.tone, j.segmentIds, j.file])).toEqual([
      ["c7-s8.a", "warm", ["s086", "s087"], "c7-s8.a.mp3"],
      ["c7-s8.b", "calm", ["s088"], "c7-s8.b.mp3"],
    ]);
    expect(jobs.filter((j) => j.scene !== "c7-s8").every((j) => j.partId === j.scene && j.file === `${j.scene}.mp3`)).toBe(true);
    const norm = (s: string) => stripTashkeel(s).replace(/\s+/g, " ").trim();
    for (const sc of scenes.filter((s) => s.narration?.trim()))
      expect(norm(jobs.filter((j) => j.scene === sc.id).map((j) => j.text).join(" ")), sc.id).toBe(norm(sc.narration!));
  });

  it("يرفض الخريطة المعيبة بدل التخمين", () => {
    const bad = structuredClone(map);
    bad.audioParts.find((p) => p.id === "c7-s8.b")!.segments = [];
    expect(() => partJobs(bad)).toThrow("بلا مقاطع");
    const moved = structuredClone(map);
    moved.audioParts.find((p) => p.id === "c7-s8.a")!.segments = [86];
    expect(() => partJobs(moved)).toThrow("بلا جزء");
    expect(() => layoutScene("c7-s8", jobs, { ...clips, "c7-s8.b": undefined as never })).toThrow("لا تسجيل");
  });

  it("الجزء الثاني يبدأ كلامه بعد آخر كلام الأول بفاصل الأجزاء بالضبط، لا بفاصل + هوامش القص", () => {
    const l = layoutScene("c7-s8", jobs, clips);
    const [a, b] = l.parts;
    expect(a!.at).toBe(0);
    expect(b!.speechAt - a!.speechEndAt).toBeCloseTo(PART_GAP_SEC, 9);
    // هامشا القص (0.15 بعد الأول و0.06 قبل الثاني) داخل الفاصل لا فوقه: الفراغ بين الملفين 0.7 − 0.21
    expect(b!.at - (a!.at + (a!.trimEnd - a!.trimStart))).toBeCloseTo(PART_GAP_SEC - 0.21, 9);
    expect(l.speechEnd).toBe(b!.speechEndAt);
  });

  it("نوافذ الجمل من محاذاة الحروف: مرتبة، داخل الجزء، ومربوطة بمعرّفاتها", () => {
    const l = layoutScene("c7-s8", jobs, clips);
    for (const [k, job] of jobs.filter((j) => j.scene === "c7-s8").entries()) {
      const c = clips[job.partId]!;
      const chars = [...job.text];
      const step = (c.speechEnd - c.speechStart) / chars.length;
      const al: CharAlignment = { characters: chars, start: chars.map((_, i) => c.speechStart + i * step), end: chars.map((_, i) => c.speechStart + (i + 1) * step) };
      const w = segmentWindows(job, map, al, l.parts[k]!);
      expect(w.map((x) => x.id)).toEqual(job.segmentIds);
      expect(w[0]!.start).toBeCloseTo(l.parts[k]!.speechAt, 9);
      expect(w[w.length - 1]!.end).toBeCloseTo(l.parts[k]!.speechEndAt, 9);
      for (let i = 1; i < w.length; i++) expect(w[i]!.start).toBeGreaterThan(w[i - 1]!.end);
      expect(() => segmentWindows(job, map, { ...al, characters: [...chars.slice(1), "x"] }, l.parts[k]!)).toThrow("لا تطابق");
    }
  });
});

// ——— الجدول الزمني للحلقة من بيانات صناعية ———
const RECITATION_SEC = 6;
const items: TimelineItem[] = scenes.map((s) => {
  const shot = s.props?.shot ?? "";
  if (s.template === "verse-card") return { kind: "verse", id: s.id, recitation: RECITATION_SEC };
  if (!s.narration?.trim()) return { kind: "card", id: s.id, seconds: HZ_META[shot]!.seconds!, role: shot === "chapter" ? "chapter" : "cover" };
  const l = layoutScene(s.id, jobs, clips);
  return { kind: "narration", id: s.id, speechStart: l.speechStart, speechEnd: l.speechEnd, audioEnd: l.audioEnd, designTail: HZ_META[shot]!.tail, exit: HZ_META[shot]!.exit };
});
const tl = buildAudioTimeline(items);

describe("الصمت عند الحدود غير تراكمي (D8)", () => {
  it("لا مخالفة: كل حد = max(المقرر، الحد البصري)، بلا تداخل أصوات ولا فجوة بصرية", () => {
    expect(silenceProblems(tl)).toEqual([]);
  });

  it("قبل التلاوة 0.7 ث وبعدها 0.6 ث بالضبط، وبين البطاقتين المتجاورتين 0.25", () => {
    const before = tl.gaps.filter((g) => g.owner === "verse-lead");
    const after = tl.gaps.filter((g) => g.owner === "verse-trail");
    expect(before).toHaveLength(20);
    expect(after).toHaveLength(20);
    for (const g of before) expect(g.value, g.from).toBeCloseTo(SILENCE_POLICY.beforeVerse, 9);
    for (const g of after) expect(g.value, g.from).toBeCloseTo(SILENCE_POLICY.afterVerse, 9);
    expect(tl.gaps.filter((g) => g.owner === "verses-gap").map((g) => [g.from, g.to, +g.value.toFixed(3)])).toEqual([["c4-v4", "c4-v5", 0.25], ["c6-v2", "c6-v3", 0.25]]);
  });

  it("المحرك الحالي كان يجمع ذيل المشهد إلى صمت البطاقة؛ السياسة تأخذ واحدًا", () => {
    for (const g of tl.gaps.filter((x) => x.owner === "verse-lead")) {
      const shot = scenes.find((s) => s.id === g.from)!.props!.shot!;
      const old = HZ_META[shot]!.tail + 0.8;
      expect(g.value).toBeLessThan(old);
      expect(g.value).not.toBeCloseTo(HZ_META[shot]!.tail + SILENCE_POLICY.beforeVerse, 3);
    }
  });

  it("بطاقة الفصل 3.2 ث كما هي، ووقفة بصرية مستقلة: لا صمت يُضاف قبلها ولا بعدها", () => {
    const ch = tl.scenes.filter((s) => s.kind === "card" && s.id !== "c1-s0");
    expect(ch).toHaveLength(6);
    for (const c of ch) expect(+(c.end - c.start).toFixed(6)).toBe(3.2);
    const g = tl.gaps.filter((x) => x.owner === "chapter-card");
    expect(g).toHaveLength(6);
    for (const x of g) {
      const shot = scenes.find((s) => s.id === x.from)!.props!.shot!;
      const exit = SILENCE_POLICY.exitMin[HZ_META[shot]!.exit];
      // الخروج أو هامش التلاشي (أطولهما) + البطاقة + هامش بداية التسجيل التالي، ولا شيء غيرها
      expect(x.value, x.from).toBeCloseTo(Math.max(exit, 0.15) + 3.2 + 0.06, 9);
      expect(x.visualBeat).toBe(3.2);
    }
  });

  it("حد المشهد إلى المشهد = ذيل التصميم وحده (هامشا القص داخله)", () => {
    for (const g of tl.gaps.filter((x) => x.owner === "scene-tail")) expect(g.value, g.from).toBeCloseTo(g.target, 9);
  });

  it("كل حد له مالك واحد، وعدد الحدود بين الأصوات = عدد الأصوات − 1", () => {
    expect(tl.gaps).toHaveLength(tl.audio.length - 1);
    const pairs = tl.gaps.map((g) => `${g.from}>${g.to}`);
    expect(new Set(pairs).size).toBe(pairs.length);
    expect(tl.audio.filter((a) => a.kind === "recitation")).toHaveLength(22);
    expect(tl.audio.filter((a) => a.kind === "speech")).toHaveLength(51);
  });
});

describe("استقرار معرّفات الجمل عبر الإصدارات وتصحيح التشكيل", () => {
  it("s001–s088 والمشهد والمفتاح ثابتة في v1 وv1.1 وv1.2، والمفتاح لا يتأثر بالتصحيح", () => {
    const v11 = JSON.parse(readFileSync(path.join(EP, "tone-map.v1.1.json"), "utf8")) as ToneMap;
    const v1 = JSON.parse(readFileSync(path.join(EP, "tone-map.v1.json"), "utf8")) as { segments: { n: number; scene: string; text: string }[] };
    expect(map.segments.map((s) => [s.id, s.scene, s.key])).toEqual(v11.segments.map((s) => [s.id, s.scene, s.key]));
    expect(map.segments.map((s) => [s.n, s.scene])).toEqual(v1.segments.map((s) => [s.n, s.scene]));
    const changed = map.segments.filter((s, i) => s.text !== v11.segments[i]!.text).map((s) => s.id);
    expect(changed).toEqual(["s016", "s029", "s032"]);
    for (const id of changed) {
      const a = map.segments.find((s) => s.id === id)!;
      const b = v11.segments.find((s) => s.id === id)!;
      expect(stripTashkeel(a.text)).toBe(stripTashkeel(b.text));
      expect(a.key).toBe(b.key);
    }
  });
});
