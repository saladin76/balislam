import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { partJobs, PART_GAP_SEC, type ToneMap } from "../src/remotion/dafatir/audio/parts";
import { boundaryProblems, composeScene, encodeWav, mixScene, renderBoundaries, type PartResult } from "../src/remotion/dafatir/audio/compose";
import { SILENCE_POLICY } from "../src/remotion/dafatir/audio/silence";
import { TRIM_DEFAULTS } from "../src/remotion/dafatir/audio/trim";
import { composeEpisode, isPartsChannel, measurePart, sequenceFor, validatePartsContext } from "../src/voice/dafatirParts";
import { sceneSeconds } from "../src/plan/duration";
import { HZ_META } from "../src/remotion/dafatir/horizon/meta";
import type { Plan } from "../src/plan/types";
import type { ElevenLabsClient } from "../src/voice/elevenlabs";

/**
 * وصل بنية الصوت المعزولة (الأمر 025) بالتوليد والرندر — دفاتر الزمن وحدها.
 * كل الصوت هنا صناعي: لا مفاتيح ولا شبكة ولا تسجيل حقيقي، ولا قرآن.
 */
const EP = "channels/dafatir-alzaman/episodes/001-adam-beginning";
/** نسخة المحتوى V7 محفوظة (V8 في ١١ نوفمبر حذف بطاقات الآيات والفصول): آليات الآيات والفصول تُختبر عليها. */
const V7: Record<string, string> = { "script.md": "versions/v7/script.md", "plan.json": "plan.v7.json", "tone-map.json": "tone-map.v1.2.json", "tashkeel.md": "versions/v7/tashkeel.md" };
const mapRaw = readFileSync(path.join(EP, V7["tone-map.json"]!), "utf8");
const map = JSON.parse(mapRaw) as ToneMap;
const plan = JSON.parse(readFileSync(path.join(EP, V7["plan.json"]!), "utf8")) as Plan;
const tashkeel = readFileSync(path.join(EP, V7["tashkeel.md"]!), "utf8");
const scenes = plan.chapters.flatMap((c) => c.scenes);

const SR = 16000;
let seed = 11;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1;
/** تسجيل صناعي لنص: صمت، كلام مجهور بطول الحروف، تلاشٍ، صمت؛ ومحاذاة حروفه داخل الكلام */
const synth = (text: string, lead = 0.35, trail = 0.45, rate = SR) => {
  const chars = [...text];
  const speech = chars.length * 0.05;
  const n = Math.round((lead + speech + 0.1 + trail) * rate);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    // الكلام حرفًا حرفًا: المسافة بين الكلمتين شبه صامتة كما في الكلام الحقيقي
    const ch = chars[Math.floor((t - lead) / 0.05)];
    s[i] = t < lead ? rnd() * 3e-4 : t < lead + speech ? (ch === " " ? rnd() * 3e-4 : Math.sin(2 * Math.PI * 140 * t) * 0.25) : t < lead + speech + 0.1 ? rnd() * 0.02 * Math.exp(-(t - lead - speech) / 0.04) : rnd() * 3e-4;
  }
  return { samples: s, alignment: { characters: chars, start: chars.map((_, i) => lead + i * 0.05), end: chars.map((_, i) => lead + (i + 1) * 0.05) } };
};
const wordsOf = (a: { characters: string[]; start: number[]; end: number[] }) => {
  const out: { word: string; start: number; end: number }[] = [];
  let cur: { word: string; start: number; end: number } | null = null;
  a.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) {
      if (cur) out.push(cur);
      cur = null;
    } else if (!cur) cur = { word: ch, start: a.start[i]!, end: a.end[i]! };
    else {
      cur.word += ch;
      cur.end = a.end[i]!;
    }
  });
  if (cur) out.push(cur);
  return out;
};

const jobs = partJobs(map);
const results: Record<string, PartResult> = {};
const samples: Record<string, Float32Array> = {};
for (const j of jobs) {
  const x = synth(j.text);
  samples[j.partId] = x.samples;
  results[j.partId] = measurePart(j.partId, x.samples, SR, wordsOf(x.alignment));
}

describe("دفاتر الزمن: أجزاء خريطة النبرة v1.2 موصولة بالتوليد", () => {
  it("الخريطة الحالية مقبولة: 52 جزءًا لـ 88 مقطعًا، ولا جزء لآية ولا نص قرآني", () => {
    const v = validatePartsContext(map, plan, tashkeel);
    expect(v).toHaveLength(52);
    expect(v.flatMap((j) => j.segmentIds)).toEqual(map.segments.map((s) => s.id));
    const verse = new Set(scenes.filter((s) => s.template === "verse-card").map((s) => s.id));
    for (const j of v) {
      expect(verse.has(j.scene)).toBe(false);
      expect(j.text).not.toMatch(/﴿|﴾|\[آية/);
    }
    expect(v.filter((j) => j.scene === "c7-s8").map((j) => j.partId)).toEqual(["c7-s8.a", "c7-s8.b"]);
  });

  it("يرفض خريطة أقدم من v1.2، أو مبنية على تشكيل آخر، أو تنسب جزءًا إلى موضع آية", () => {
    expect(() => validatePartsContext({ ...map, version: "v1.1" }, plan, tashkeel)).toThrow(/v1\.2/);
    expect(() => validatePartsContext(map, plan, tashkeel + "\nتغيير")).toThrow(/تشكيل قديم/);
    const versePlan = structuredClone(plan);
    const v = versePlan.chapters[1]!.scenes.find((s) => s.template === "verse-card")!;
    const bad = structuredClone(map);
    bad.segments[0]!.scene = v.id;
    bad.audioParts[0]!.scene = v.id;
    bad.audioParts[0]!.id = v.id;
    bad.segments[0]!.audioPart = v.id;
    expect(() => validatePartsContext(bad, versePlan, tashkeel)).toThrow(/آية/);
  });

  it("المسار لدفاتر الزمن وحدها: مسارات بالإسلام وزبدة الكتب لا تمر منه", () => {
    expect(isPartsChannel(path.resolve(EP, "script.md"))).toBe(true);
    expect(isPartsChannel(path.resolve("channels/balislam/episodes/001-x/script.md"))).toBe(false);
    expect(isPartsChannel(path.resolve("channels/zubdat-alkutub/episodes/001-x/script.md"))).toBe(false);
  });

  it("القص لا يأكل حرفًا: يبدأ قبل أول حرف بهامشه، وينتهي بعد آخر حرف", () => {
    for (const j of jobs.slice(0, 6)) {
      const c = results[j.partId]!.clip;
      const w = results[j.partId]!.words;
      expect(c.start).toBeLessThanOrEqual(w[0]!.start - TRIM_DEFAULTS.onsetPadSec + 1e-6);
      expect(c.end).toBeGreaterThanOrEqual(w[w.length - 1]!.end);
      expect(c.speechStart - c.start).toBeLessThanOrEqual(TRIM_DEFAULTS.onsetPadSec + 1e-6);
    }
  });

  it("c7-s8 مشهد واحد بجزأين: الحمد يبدأ بعد آخر كلام الجزء الأول بـ 0.7 ث بالضبط، والكلمات بزمن المشهد", () => {
    const c = composeScene("c7-s8", jobs, results);
    expect(c.parts).toHaveLength(2);
    const [a, b] = c.parts;
    expect(b!.speechAt - a!.speechEndAt).toBeCloseTo(PART_GAP_SEC, 6);
    for (let i = 1; i < c.words.length; i++) expect(c.words[i]!.start).toBeGreaterThanOrEqual(c.words[i - 1]!.start);
    const mixed = mixScene(c, samples, SR);
    expect(mixed.length).toBe(Math.ceil(c.audioEnd * SR));
    // لا صوت في الفاصل بين الجزأين إلا هامشي القص
    const mid = Math.round(((a!.speechEndAt + b!.speechAt) / 2) * SR);
    expect(Math.abs(mixed[mid]!)).toBeLessThan(0.05);
  });

  it("صمت كل حد بمالك واحد على الحلقة كلها: قبل التلاوة 0.7، وبعدها 0.6، وبين المشاهد ذيل التصميم، ولا صمت فوق بطاقة الفصل", () => {
    const { composed, boundaries, gaps, problems } = composeEpisode(plan, jobs, results);
    expect(problems).toEqual([]);
    expect(Object.keys(composed)).toHaveLength(51);
    const seq = sequenceFor(plan);
    let lead = 0;
    let after = 0;
    for (const g of gaps) {
      if (g.owner === "verse-lead") {
        const it = seq.find((x) => x.id === g.from) as { exit: "turn" | "fade" | "none" };
        expect(g.value).toBeCloseTo(Math.max(SILENCE_POLICY.beforeVerse, SILENCE_POLICY.exitMin[it.exit], 0), 6);
        lead++;
      }
      if (g.owner === "verse-trail") {
        expect(g.value).toBeCloseTo(Math.max(SILENCE_POLICY.afterVerse, TRIM_DEFAULTS.onsetPadSec), 6);
        after++;
      }
    }
    expect(lead).toBeGreaterThan(10);
    expect(after).toBeGreaterThan(10);
    // المشهد قبل بطاقة الفصل: أقل خروج فقط (لا يُراكم صمت فوق 3.2 ث)
    const beforeCard = boundaries["c1-s8"]!;
    expect(beforeCard.tail).toBeCloseTo(Math.max(SILENCE_POLICY.exitMin.turn, composed["c1-s8"]!.audioEnd - composed["c1-s8"]!.speechEnd), 6);
    // مشهد إلى مشهد: الصمت = ذيل التصميم
    const tailGap = gaps.find((g) => g.from === "c1-s2")!;
    expect(tailGap.owner).toBe("scene-tail");
    expect(tailGap.value).toBeCloseTo(Math.max(HZ_META.nations!.tail, SILENCE_POLICY.exitMin.fade + TRIM_DEFAULTS.onsetPadSec), 2);
    // المدة = الرأس + آخر كلام + الذيل
    for (const [id, b] of Object.entries(boundaries)) expect(b.seconds).toBeCloseTo(b.pre + composed[id]!.speechEnd - b.pre + b.tail, 6);
    expect(boundaryProblems(gaps)).toEqual([]);
  });

  it("الذيل لا يتغير حين يُولَّد صوت المشهد التالي (المشهد المعتمد لا يُعاد فتحه)", () => {
    const only = Object.fromEntries(Object.entries(results).filter(([k]) => k === "c1-s2"));
    const alone = composeEpisode(plan, jobs, only).boundaries["c1-s2"]!;
    const all = composeEpisode(plan, jobs, results).boundaries["c1-s2"]!;
    expect(alone).toEqual(all);
  });

  it("مدة المشهد في الرندر من سياسة الصمت حين يوجد التسجيل المركّب، وإلا الحساب العام كما هو", () => {
    const s = scenes.find((x) => x.id === "c1-s2")!;
    const voice = { "c1-s2": { file: "x.wav", hash: "h", text: s.narration.trim(), duration: 5, words: [], timing: { pre: 0, tail: 0.9, seconds: 6.1, speechStart: 0.06, speechEnd: 5.2, toneMap: "x", parts: [] } } };
    expect(sceneSeconds(s, { voice, recitations: {} })).toBeCloseTo(6.1, 6);
    const plainVoice = { "c1-s2": { file: "x.mp3", hash: "h", text: s.narration.trim(), duration: 5, words: [] } };
    expect(sceneSeconds(s, { voice: plainVoice, recitations: {} })).toBeCloseTo(5 + HZ_META.nations!.tail, 6);
  });

  it("WAV المشهد صالح: 16 بت أحادي بالمعدل المطلوب", () => {
    const w = encodeWav(Float32Array.from([0, 0.5, -0.5]), 44100);
    expect(String.fromCharCode(...w.slice(0, 4))).toBe("RIFF");
    expect(new DataView(w.buffer).getUint32(24, true)).toBe(44100);
    expect(w.length).toBe(44 + 6);
  });
});

// ——— من التوليد إلى الفهرس على حلقة مؤقتة (عميل صناعي) ———
let tmp = "";
const sent: { text: string; stability?: number }[] = [];
const fake = {
  modelId: "mock",
  tts: async (text: string, ctx: { tune?: { stability: number } } = {}) => {
    sent.push({ text, stability: ctx.tune?.stability });
    const x = synth(text, 0.3, 0.4, 44100);
    const a = x.alignment;
    return { audio: Buffer.from(encodeWav(x.samples, 44100)), alignment: { characters: a.characters, character_start_times_seconds: a.start, character_end_times_seconds: a.end } };
  },
  soundEffect: async () => Buffer.alloc(0),
  account: async () => ({}) as never,
  voices: async () => [],
} as unknown as ElevenLabsClient;

describe("generateVoice لدفاتر الزمن يتبع أجزاء الخريطة ويكتب مشهدًا مركّبًا", () => {
  beforeAll(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "bal-dafatir-parts-"));
    const ch = path.join(tmp, "dafatir-alzaman");
    cpSync(path.join("channels", "dafatir-alzaman"), ch, { recursive: true, filter: (s) => !/[\\/]episodes([\\/]|$)/.test(s) });
    const ep = path.join(ch, "episodes", "001-adam-beginning");
    mkdirSync(ep, { recursive: true });
    for (const f of ["script.md", "plan.json", "tone-map.json", "tashkeel.md"]) writeFileSync(path.join(ep, f), readFileSync(path.join(EP, V7[f]!)));
    process.env.BAL_CHANNELS_DIR = tmp;
    process.env.BAL_CHANNEL = "dafatir-alzaman";
    process.env.ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
  });
  afterAll(() => {
    delete process.env.BAL_CHANNELS_DIR;
    delete process.env.BAL_CHANNEL;
    delete process.env.ELEVENLABS_MODEL_ID;
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  it("نص كل طلب = نص جزء الخريطة، ونبرته منها؛ والمشهد ملف واحد بمدته وكلماته وأجزائه", async () => {
    const { generateVoice } = await import("../src/voice/generate");
    const only = ["c1-s2", "c7-s1", "c7-s8"];
    const report = await generateVoice("001", { client: fake, testOnlySkipGates: true, only });
    expect(report.toGenerate.map((x) => x.id)).toEqual(["c1-s2", "c7-s1", "c7-s8.a", "c7-s8.b"]);
    const expected = jobs.filter((j) => only.includes(j.scene)).map((j) => j.text);
    expect(sent.map((x) => x.text)).toEqual(expected);
    for (const x of sent) expect(x.text).not.toMatch(/﴿|﴾|\[آية/);
    const dir = path.join(tmp, "dafatir-alzaman", "episodes", "001-adam-beginning", "voice");
    const index = JSON.parse(readFileSync(path.join(dir, "index.json"), "utf8")) as Record<string, { file: string; text: string; words: unknown[]; duration: number; timing: { parts: unknown[]; seconds: number; pre: number } }>;
    expect(Object.keys(index).sort()).toEqual(only.slice().sort());
    for (const id of only) {
      const s = scenes.find((x) => x.id === id)!;
      const c = index[id]!;
      expect(c.text).toBe(s.narration.trim());
      expect(c.file).toMatch(/\.wav$/);
      expect(existsSync(path.join(dir, c.file))).toBe(true);
      expect(c.words).toHaveLength(s.narration.trim().split(/\s+/).length);
      expect(c.timing.seconds).toBeGreaterThan(c.duration - 1e-6);
    }
    expect(index["c7-s8"]!.timing.parts).toHaveLength(2);
    // c7-s1 يسبق بطاقة النساء 1: الصمت قبل التلاوة 0.7 (أو أقل خروج إن زاد)، لا 1.8–2.7
    const s71 = index["c7-s1"]!;
    expect(s71.timing.seconds - (s71 as unknown as { timing: { speechEnd: number } }).timing.speechEnd).toBeCloseTo(Math.max(SILENCE_POLICY.beforeVerse, SILENCE_POLICY.exitMin.fade), 2);
    // التوليد الثاني بلا تغيير لا يطلب شيئًا
    const before = sent.length;
    await generateVoice("001", { client: fake, testOnlySkipGates: true, only });
    expect(sent.length).toBe(before);
  }, 120_000);
});

describe("دفاتر الزمن: نسخة المحتوى V8 (v1.4) محفوظة وصالحة للتوليد", () => {
  it("44 جزءًا لـ 74 مقطعًا في 43 مشهدًا منطوقًا، ولا آية ولا بطاقة فصل، والحدود بلا صمت آية", () => {
    const map8 = JSON.parse(readFileSync(path.join(EP, "tone-map.v1.4.json"), "utf8")) as ToneMap;
    const plan8 = JSON.parse(readFileSync(path.join(EP, "plan.v8.json"), "utf8")) as Plan;
    const v = validatePartsContext(map8, plan8, readFileSync(path.join(EP, "versions/v8/tashkeel.md"), "utf8"));
    expect(v).toHaveLength(44);
    expect(v.flatMap((j) => j.segmentIds)).toHaveLength(74);
    for (const j of v) expect(j.text).not.toMatch(/﴿|﴾|\[آية/);
    const jobs8 = partJobs(map8);
    const res: Record<string, PartResult> = {};
    for (const j of jobs8) {
      const x = synth(j.text);
      res[j.partId] = measurePart(j.partId, x.samples, SR, wordsOf(x.alignment));
    }
    const { composed, gaps, problems } = composeEpisode(plan8, jobs8, res);
    expect(problems).toEqual([]);
    expect(Object.keys(composed)).toHaveLength(43);
    expect(gaps.filter((g) => /verse|chapter/.test(g.owner))).toEqual([]);
  });
});

describe("دفاتر الزمن: نسخة المحتوى V9 الحالية (v1.5) صالحة للتوليد", () => {
  it("49 جزءًا لـ 84 مقطعًا في 48 مشهدًا منطوقًا (V9.2، الأمر 031)، ولا آية ولا بطاقة فصل", () => {
    const map9 = JSON.parse(readFileSync(path.join(EP, "tone-map.json"), "utf8")) as ToneMap;
    const plan9 = JSON.parse(readFileSync(path.join(EP, "plan.json"), "utf8")) as Plan;
    // التشكيل الذي بُنيت عليه الخريطة (V9.2) محفوظ باسمه: المالك يحرّر tashkeel.md الحي من الاستوديو (D132)
    const v = validatePartsContext(map9, plan9, readFileSync(path.join(EP, "versions/v9.2/tashkeel.md"), "utf8"));
    expect(v).toHaveLength(49);
    expect(v.flatMap((j) => j.segmentIds)).toHaveLength(84);
    for (const j of v) expect(j.text).not.toMatch(/﴿|﴾|\[آية|\[استشهاد/);
    const jobs9 = partJobs(map9);
    const res: Record<string, PartResult> = {};
    for (const j of jobs9) {
      const x = synth(j.text);
      res[j.partId] = measurePart(j.partId, x.samples, SR, wordsOf(x.alignment));
    }
    const { composed, gaps, problems } = composeEpisode(plan9, jobs9, res);
    expect(problems).toEqual([]);
    expect(Object.keys(composed)).toHaveLength(48);
    expect(gaps.filter((g) => /verse|chapter/.test(g.owner))).toEqual([]);
  });
});
