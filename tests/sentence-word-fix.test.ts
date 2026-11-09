/**
 * «أعد نطق الكلمة» (قرار صاحب المشروع، ٩ نوفمبر): إعادة تسجيل كلمة نُطقت خطأً في جملة مولَّدة بدل توليد الجملة كلها،
 * وقاموس النطق للقناة (pronunciations.json). لا مفاتيح ولا شبكة: عميل ElevenLabs مزيّف يصنع WAV صناعيًا (نغمة لكل حرف)
 * مع توقيت الحروف، ودوال الوصل تُختبر على PCM صناعي (نغمات وضجيج).
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encodeWav } from "../src/remotion/dafatir/audio/compose";
import type { ElevenLabsClient } from "../src/voice/elevenlabs";
import type { Plan } from "../src/plan/types";
import { applyLexicon, checkSay, quranMask } from "../src/voice/lexicon";
import { remapWords, rmsOf, snapBoundary, spliceWord } from "../src/voice/wordSplice";

const ENV = ["BAL_CHANNELS_DIR", "BAL_CHANNEL", "ELEVENLABS_MODEL_ID", "BAL_WORKFLOW_HMAC_KEY", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"] as const;
const saved: Record<string, string | undefined> = {};
let tmp = "";
const SR = 44100;

const S1A = "كَتَبَ الوَلَدُ الدَّرْسَ.";
const S1B = "ثُمَّ ذَهَبَ الوَلَدُ إِلَى البَيْتِ؟";
const S2 = "وَهَذَا مَشْهَدٌ ثَانٍ.";
const EP_DIR = () => path.join(tmp, "balislam", "episodes", "986-word-fix");
const LEX = () => path.join(tmp, "balislam", "pronunciations.json");

const plan = (): Plan => ({
  episode: "986", title: "اختبار", tone: "calm",
  chapters: [{ number: 1, title: "تجربة", scenes: [
    { id: "c1-s1", template: "alley-tale", line: 6, narration: `${S1A} ${S1B}`, sfx: [], props: {} },
    { id: "c1-s2", template: "alley-tale", line: 8, narration: S2, sfx: [], props: {} },
  ] }],
} as unknown as Plan);

const freshEpisode = () => {
  rmSync(EP_DIR(), { recursive: true, force: true });
  rmSync(LEX(), { force: true });
  mkdirSync(path.join(EP_DIR(), "voice"), { recursive: true });
  writeFileSync(path.join(EP_DIR(), "script.md"), `---\ntitle: "اختبار"\nepisode: "986"\n---\n## الفصل 1 · تجربة\n${S1A} ${S1B}\n\n${S2}\n`);
  writeFileSync(path.join(EP_DIR(), "plan.json"), JSON.stringify(plan(), null, 2) + "\n");
  writeFileSync(path.join(EP_DIR(), "tashkeel.md"), `${S1A} ${S1B}\n\n${S2}\n`);
};

/** WAV صناعي: صمت، ثم نغمة لكل حرف غير المسافة، ثم صمت؛ والتوقيت حرفًا حرفًا. amp لمحاكاة اختلاف العلوّ */
const tone = (text: string, amp = 0.3, freq = 160) => { // eslint-disable-line
  const chars = [...text];
  const lead = 0.25, step = 0.05, n = Math.round((lead + chars.length * step + 0.4) * SR);
  const s = new Float32Array(n);
  chars.forEach((c, i) => {
    if (/\s/.test(c)) return;
    for (let k = Math.round((lead + i * step) * SR); k < Math.round((lead + (i + 1) * step) * SR); k++) s[k] = Math.sin(2 * Math.PI * freq * k / SR) * amp;
  });
  for (let k = 0; k < n; k++) if (!s[k]) s[k] = 0.0002 * Math.sin(k);
  return { wav: Buffer.from(encodeWav(s, SR)), alignment: { characters: chars, character_start_times_seconds: chars.map((_, i) => lead + i * step), character_end_times_seconds: chars.map((_, i) => lead + (i + 1) * step) } };
};
type Sent = { text: string; previousText?: string; nextText?: string };
const fakeClient = (sent: Sent[], o: { noAlignment?: boolean } = {}) => ({
  modelId: "mock",
  tts: async (text: string, ctx: { previousText?: string; nextText?: string } = {}) => {
    sent.push({ text, previousText: ctx.previousText, nextText: ctx.nextText });
    const t = tone(text);
    return { audio: t.wav, alignment: o.noAlignment ? null : t.alignment, model: "mock" };
  },
  soundEffect: async () => Buffer.alloc(0), account: async () => ({}) as never, voices: async () => [],
}) as unknown as ElevenLabsClient;

const readJson = (f: string) => JSON.parse(readFileSync(f, "utf8"));
const index = () => readJson(path.join(EP_DIR(), "voice", "index.json"));
const doc = () => readJson(path.join(EP_DIR(), "voice", "sentences.json"));
const OPTS = { testOnlySkipApprovalGates: true } as const;

beforeAll(() => {
  for (const k of ENV) saved[k] = process.env[k];
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-wordfix-"));
  cpSync(path.join("channels", "balislam"), path.join(tmp, "balislam"), { recursive: true, filter: (s) => !/[\\/]episodes([\\/]|$)/.test(s) });
  process.env.BAL_CHANNELS_DIR = tmp;
  process.env.BAL_CHANNEL = "balislam";
  process.env.ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
  process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__word_fix_signing_key_2026";
  delete process.env.ELEVENLABS_API_KEY;
});
afterAll(() => {
  for (const k of ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

// ── الوصل على PCM صناعي ───────────────────────────────────────────────────────
const sine = (pcm: Float32Array, a: number, b: number, f: number, amp: number) => {
  for (let k = Math.round(a * SR); k < Math.round(b * SR); k++) pcm[k] = Math.sin(2 * Math.PI * f * k / SR) * amp;
};
/** عدد عبور الصفر في الثانية (يميّز التردد) */
const zcr = (pcm: Float32Array, a: number, b: number) => {
  let n = 0;
  for (let k = Math.round(a * SR) + 1; k < Math.round(b * SR); k++) if ((pcm[k - 1]! < 0) !== (pcm[k]! < 0)) n++;
  return n / (b - a);
};
const noiseFloor = (pcm: Float32Array) => { let x = 12345; for (let k = 0; k < pcm.length; k++) { x = (x * 1103515245 + 12345) & 0x7fffffff; if (!pcm[k]) pcm[k] = ((x / 0x7fffffff) - 0.5) * 0.0004; } };
const baseClip = () => {
  const pcm = new Float32Array(Math.round(1.4 * SR));
  sine(pcm, 0.1, 0.4, 150, 0.3); sine(pcm, 0.5, 0.8, 300, 0.3); sine(pcm, 0.9, 1.2, 150, 0.3);
  noiseFloor(pcm);
  return pcm;
};
const fragClip = (len = 0.35, amp = 0.1) => {
  const pcm = new Float32Array(Math.round((0.75 + len + 0.3) * SR));
  sine(pcm, 0.0, 0.1, 150, amp); sine(pcm, 0.2, 0.2 + len, 500, amp); sine(pcm, 0.3 + len, 0.45 + len, 150, amp);
  noiseFloor(pcm);
  return pcm;
};

describe("الوصل (دوال صافية على PCM)", () => {
  it("يستبدل مقطع الكلمة وحده: ما قبلها وما بعدها كما هما، والمدة الكلية = الأصل + فرق الكلمة", () => {
    const base = baseClip(), frag = fragClip(0.35);
    const r = spliceWord({ base, frag, sr: SR, span: { start: 0.5, end: 0.8 }, fragSpan: { start: 0.2, end: 0.55 }, neighbours: [{ start: 0.1, end: 0.4 }, { start: 0.9, end: 1.2 }] });
    expect(r.check.ok).toBe(true);
    // ±40 م.ث حول الحد إلى أهدأ نقطة: الحدود في الصمت قرب توقيت الكلمة
    expect(Math.abs(r.a - 0.5)).toBeLessThanOrEqual(0.041);
    expect(Math.abs(r.b - 0.8)).toBeLessThanOrEqual(0.041);
    // ما قبل الكلمة (حتى نافذة التلاشي) نفسه بايتًا ببايت
    const pre = Math.round((r.a - 0.01) * SR);
    expect(Array.from(r.pcm.subarray(0, pre))).toEqual(Array.from(base.subarray(0, pre)));
    // ما بعدها مُزاح بفرق المدة فقط
    const post = Math.round((r.b + 0.01) * SR), shiftS = Math.round(r.shift * SR);
    for (const k of [post, post + 1000, base.length - 10]) expect(r.pcm[k + shiftS]).toBeCloseTo(base[k]!, 6);
    expect(Math.abs(r.pcm.length - (base.length + shiftS))).toBeLessThanOrEqual(1);
    expect(r.shift).toBeGreaterThan(0.03);
    expect(r.shift).toBeLessThan(0.07);
    // الكلمة الجديدة (٥٠٠ هرتز) مكان القديمة (٣٠٠ هرتز)، وجارتاها (١٥٠) كما هما
    expect(zcr(r.pcm, 0.52, 0.52 + 0.3)).toBeGreaterThan(900);
    expect(zcr(r.pcm, 0.15, 0.35)).toBeLessThan(400);
    expect(zcr(r.pcm, 0.95 + r.shift, 1.15 + r.shift)).toBeLessThan(400);
    // العلوّ يطابق الجارتين: المقطع أهدأ ٩٫٥ dB فرُفع
    const level = 20 * Math.log10(rmsOf(r.pcm, SR, 0.52, 0.82) / rmsOf(base, SR, 0.12, 0.38));
    expect(Math.abs(level)).toBeLessThan(1);
    expect(r.check.gainDb).toBeGreaterThan(8);
  });

  it("تلاشٍ متساوي القدرة عند الوصلتين: لا قفزة عينة حتى حين يقع الحد داخل الصوت", () => {
    const base = new Float32Array(Math.round(1.0 * SR)); sine(base, 0, 1.0, 300, 0.3);
    const frag = new Float32Array(Math.round(1.0 * SR)); sine(frag, 0, 1.0, 310, 0.3);
    const r = spliceWord({ base, frag, sr: SR, span: { start: 0.3, end: 0.6 }, fragSpan: { start: 0.33, end: 0.62 }, neighbours: [{ start: 0, end: 0.3 }], snap: false });
    let worst = 0;
    for (const t of [0.3, 0.3 + (0.62 - 0.33)]) {
      for (let k = Math.round((t - 0.02) * SR); k < Math.round((t + 0.02) * SR); k++) worst = Math.max(worst, Math.abs(r.pcm[k]! - r.pcm[k - 1]!));
    }
    // أقصى تغيّر طبيعي لنغمة ٣٠٠ هرتز بعلوّ ٠٫٣ ≈ ٠٫٠١٣ للعينة؛ القطع الحاد قد يقفز حتى ٠٫٦
    expect(worst).toBeLessThan(0.05);
  });

  it("فحص الجودة يرفض كلمة أطول من ١٫٦× أو أقصر من ٠٫٦× من القديمة، وقفزة علوّ فوق ٦ dB", () => {
    const base = baseClip();
    const long = spliceWord({ base, frag: fragClip(0.6), sr: SR, span: { start: 0.5, end: 0.8 }, fragSpan: { start: 0.2, end: 0.8 }, neighbours: [{ start: 0.1, end: 0.4 }] });
    expect(long.check.ok).toBe(false);
    expect(long.check.reasons.join(" ")).toMatch(/مدة الكلمة/);
    const short = spliceWord({ base, frag: fragClip(0.12), sr: SR, span: { start: 0.5, end: 0.8 }, fragSpan: { start: 0.2, end: 0.32 }, neighbours: [{ start: 0.1, end: 0.4 }] });
    expect(short.check.ok).toBe(false);
    // مقطع أهدأ بكثير مما يرفعه الحد (×٤): لا يطابق جارتيه، فيُرفض
    const quiet = spliceWord({ base, frag: fragClip(0.3, 0.003), sr: SR, span: { start: 0.5, end: 0.8 }, fragSpan: { start: 0.2, end: 0.5 }, neighbours: [{ start: 0.1, end: 0.4 }] });
    expect(quiet.check.ok).toBe(false);
    expect(quiet.check.reasons.join(" ")).toMatch(/dB/);
  });

  it("الإزاحة إلى أهدأ نقطة لا تتجاوز ±٤٠ م.ث، وتوقيت الكلمات بعد الوصل متصاعد", () => {
    const base = baseClip();
    expect(Math.abs(snapBoundary(base, SR, 0.47) - 0.47)).toBeLessThanOrEqual(0.0405);
    const ws = [{ word: "أ", start: 0.1, end: 0.4 }, { word: "ب", start: 0.5, end: 0.8 }, { word: "ج", start: 0.9, end: 1.2 }];
    const m = remapWords(ws, 1, { a: 0.48, b: 0.82, fa: 0.18, fb: 0.57, shift: 0.05 }, { start: 0.2, end: 0.55 });
    expect(m[0]).toEqual(ws[0]);
    expect(m[1]!.start).toBeCloseTo(0.5, 6);
    expect(m[1]!.end).toBeCloseTo(0.85, 6);
    expect(m[2]!.start).toBeCloseTo(0.95, 6);
  });
});

describe("قاموس النطق (دوال صافية)", () => {
  it("يطبّق على النص المرسل ويحفظ خريطة الترجمة بالكلمة الأصلية، ولا يمس ما بين ﴿ ﴾", () => {
    const original = ["قال", "مُوسَى:", "﴿مُوسَى", "عَصَاهُ﴾", "ومُوسَى"];
    const entries = [{ word: "مُوسَى", say: "مُوسَىٰ", at: "" }, { word: "قال", say: "قَالَ يَا", at: "" }];
    const r = applyLexicon(original, [...original], original.map((_, i) => i), entries);
    expect(r.spoken).toEqual(["قَالَ", "يَا", "مُوسَىٰ:", "﴿مُوسَى", "عَصَاهُ﴾", "ومُوسَى"]);
    expect(r.owner).toEqual([0, 0, 1, 2, 3, 4]);
    expect(r.applied.map((a) => a.index)).toEqual([0, 1]);
    expect(quranMask(original)).toEqual([false, false, true, true, false]);
    // مسار الأجزاء: النطق من كلمة واحدة فقط
    expect(applyLexicon(original, [...original], original.map((_, i) => i), entries, { singleToken: true }).spoken[0]).toBe("قال");
    // صف الآية لا يُطبَّق عليه شيء
    expect(applyLexicon(original, [...original], original.map((_, i) => i), entries, { verse: true }).applied).toEqual([]);
  });
  it("النطق المكتوب يلزمه التشكيل، ولا ﴿ ﴾ فيه", () => {
    expect(checkSay("الوَلَدُ")).toBeNull();
    expect(checkSay("الولد")).toMatch(/التشكيل/);
    expect(checkSay("﴿الوَلَدُ﴾")).toMatch(/رموز/);
  });
});

describe("على القرص: «أعد نطق الكلمة» والقاموس", () => {
  beforeEach(() => { process.env.BAL_CHANNEL = "balislam"; freshEpisode(); });

  const generated = async (sent: Sent[]) => {
    const sv = await import("../src/voice/sentenceVoice");
    const client = fakeClient(sent);
    const init = await sv.sentenceAction("986", { action: "init", sceneId: "c1-s1" });
    const [a, b] = init.read.scenes[0]!.rows;
    await sv.sentenceAction("986", { action: "generate", id: a!.id }, { client, ...OPTS });
    const r = await sv.sentenceAction("986", { action: "generate", id: b!.id }, { client, ...OPTS });
    return { sv, a: r.read.scenes[0]!.rows[0]!, b: r.read.scenes[0]!.rows[1]! };
  };

  it("كلمات الجملة المولَّدة شرائح بتوقيت تسجيلها ونطقها الحالي", async () => {
    const { a } = await generated([]);
    expect(a.wordFix).toEqual({ ok: true });
    expect(a.words.map((w) => w.word)).toEqual(S1A.split(" "));
    const take = doc().scenes["c1-s1"].sentences[0].audio;
    expect(take.timing).toBe("aligned");
    expect(a.words.map((w) => [w.start, w.end])).toEqual(take.words.map((w: { start: number; end: number }) => [w.start, w.end]));
    expect(a.words[1]!.say).toBe("الوَلَدُ");
  }, 60_000);

  it("بلا محاذاة من النموذج: الشرائح معطّلة بسبب واضح", async () => {
    const sv = await import("../src/voice/sentenceVoice");
    const init = await sv.sentenceAction("986", { action: "init", sceneId: "c1-s1" });
    const r = await sv.sentenceAction("986", { action: "generate", id: init.read.scenes[0]!.rows[0]!.id }, { client: fakeClient([], { noAlignment: true }), ...OPTS });
    const row = r.read.scenes[0]!.rows[0]!;
    expect(row.wordFix.ok).toBe(false);
    expect(row.wordFix.reason).toMatch(/تقديري/);
    expect(row.words.every((w) => w.start === null)).toBe(true);
    await expect(sv.sentenceAction("986", { action: "fixword", id: row.id, word: 1, say: "الْوَلَدُ" }, { client: fakeClient([]), ...OPTS })).rejects.toThrow(/تقديري/);
  }, 60_000);

  it("يعيد نطق كلمة واحدة بمقطع قصير وسياق الجملة، ويحفظ تسجيلًا جديدًا قابلًا للرجوع، ويعيد فتح ذلك المشهد وحده", async () => {
    const sent: Sent[] = [];
    const { sv, a } = await generated(sent);
    const { inspectSceneProduction } = await import("../src/studio/sceneService");
    const before = await inspectSceneProduction("986");
    const oldTake = doc().scenes["c1-s1"].sentences[0].audio;
    const indexBefore = index();
    sent.length = 0;
    const r = await sv.sentenceAction("986", { action: "fixword", id: a.id, word: 1, say: "الْوَلَدُ" }, { client: fakeClient(sent), ...OPTS });
    expect(r.fix).toMatchObject({ ok: true, index: 1, word: "الوَلَدُ", say: "الْوَلَدُ" });
    // طلب واحد: الكلمة المصحَّحة بين جارتيها، والنص المجاور بقية الجملة
    expect(sent).toHaveLength(1);
    expect(sent[0]!.text).toBe("كَتَبَ الْوَلَدُ الدَّرْسَ.");
    expect(sent[0]!.previousText ?? "").toBe("");
    expect(sent[0]!.nextText).toBe(S1B);
    const s = doc().scenes["c1-s1"].sentences[0];
    expect(s.audio.origin).toBe("fix");
    expect(s.audio.file).toMatch(/-fix-.*\.wav$/);
    expect(s.takes.at(-1)).toEqual(oldTake);
    expect(s.audio.fixes[0]).toMatchObject({ index: 1, word: "الوَلَدُ", say: "الْوَلَدُ", from: oldTake.file });
    expect(s.corrections).toEqual([{ index: 1, word: "الوَلَدُ", say: "الْوَلَدُ" }]);
    expect(s.audio.spokenFixes).toEqual([{ word: "الوَلَدُ", say: "الْوَلَدُ" }]);
    // الترجمة بالكتابة الأصلية، والمدة = الأصل + فرق الكلمة (حرف واحد أطول ≈ ٥٠ م.ث)
    expect(s.audio.words.map((w: { word: string }) => w.word)).toEqual(S1A.split(" "));
    const { decodeAudio } = await import("../src/voice/dafatirParts");
    const len = async (f: string) => (await decodeAudio(path.join(EP_DIR(), "voice", "sentences", f), SR)).length / SR;
    const oldLen = await len(oldTake.file), newLen = await len(s.audio.file);
    expect(newLen - oldLen).toBeGreaterThan(0.01);
    expect(newLen - oldLen).toBeLessThan(0.1);
    expect(Math.abs(s.audio.duration - newLen)).toBeLessThan(0.002);
    expect(s.audio.words[0]).toEqual(oldTake.words[0]);
    expect(s.audio.fingerprint).toBe(oldTake.fingerprint);
    const row = r.read.scenes[0]!.rows[0]!;
    expect(row.status).toBe("generated");
    expect(row.applied).toEqual([{ word: "الوَلَدُ", say: "الْوَلَدُ" }]);
    expect(row.appliedState).toBe("sent");
    // المقطع المدفوع محفوظ
    expect(existsSync(path.join(EP_DIR(), "voice", "sentences", s.fragments[0].file))).toBe(true);
    // صوت المشهد أعيد تركيبه، والمشهد الآخر كما هو
    expect(r.composed).toMatchObject({ sceneId: "c1-s1", composed: true });
    expect(index()["c1-s1"].file).not.toBe(indexBefore["c1-s1"].file);
    const after = await inspectSceneProduction("986");
    expect(after.scenes.filter((x, i) => x.sourceSha256 !== before.scenes[i]!.sourceSha256).map((x) => x.id)).toEqual(["c1-s1"]);
    // الرجوع إلى التسجيل السابق من القائمة نفسها
    const back = await sv.sentenceAction("986", { action: "restore", id: a.id });
    expect(doc().scenes["c1-s1"].sentences[0].audio).toEqual(oldTake);
    expect(back.read.scenes[0]!.rows[0]!.status).toBe("generated");
    expect(index()["c1-s1"].file).toBe(indexBefore["c1-s1"].file);
  }, 90_000);

  it("فحص الجودة الفاشل لا يغيّر التسجيل ولا صوت المشهد، ويبقى المقطع المدفوع، ثم «ولّد الجملة كاملة بهذا النطق»", async () => {
    const sent: Sent[] = [];
    const { sv, a } = await generated(sent);
    const takeBefore = doc().scenes["c1-s1"].sentences[0].audio;
    const indexBefore = index();
    // نطق أطول بكثير من الكلمة القديمة: المدة خارج ٠٫٦–١٫٦×
    const say = "الوَلَدُ الصَّغِيرُ جِدًّا";
    const r = await sv.sentenceAction("986", { action: "fixword", id: a.id, word: 1, say }, { client: fakeClient(sent), ...OPTS });
    expect(r.fix?.ok).toBe(false);
    expect(r.fix?.reasons.join(" ")).toMatch(/مدة الكلمة/);
    expect(r.message).toBe("لم يندمج بشكل طبيعي — جرّب نطقًا آخر أو ولّد الجملة");
    const s = doc().scenes["c1-s1"].sentences[0];
    expect(s.audio).toEqual(takeBefore);
    expect(s.takes ?? []).toHaveLength(0);
    expect(s.corrections).toBeUndefined();
    expect(s.fragments[0]).toMatchObject({ ok: false, say });
    expect(index()).toEqual(indexBefore);
    expect(r.composed).toBeUndefined();
    expect(existsSync(LEX())).toBe(false);
    // البديل بنقرة: توليد الجملة كاملة بالتصحيح نفسه (والترجمة بالكتابة الأصلية)
    sent.length = 0;
    const g = await sv.sentenceAction("986", { action: "generate", id: a.id, word: 1, say: "الْوَلَدُ", save: true }, { client: fakeClient(sent), ...OPTS });
    expect(sent[0]!.text).toBe("كَتَبَ الْوَلَدُ الدَّرْسَ.");
    const s2 = doc().scenes["c1-s1"].sentences[0];
    expect(s2.audio.origin).toBe("tts");
    expect(s2.audio.words.map((w: { word: string }) => w.word)).toEqual(S1A.split(" "));
    expect(s2.corrections).toEqual([{ index: 1, word: "الوَلَدُ", say: "الْوَلَدُ" }]);
    expect(g.message).toMatch(/قاموس النطق/);
    expect(readJson(LEX()).entries.map((e: { word: string; say: string }) => [e.word, e.say])).toEqual([["الوَلَدُ", "الْوَلَدُ"]]);
  }, 90_000);

  it("«احفظ هذا النطق للقناة»: يُطبَّق على التوليد القادم (الجمل والمشاهد) لا على النص ولا الترجمة، ولا يُبطل تسجيلًا قائمًا", async () => {
    const sent: Sent[] = [];
    const { sv, a, b } = await generated(sent);
    const bTake = doc().scenes["c1-s1"].sentences[1].audio;
    await sv.sentenceAction("986", { action: "fixword", id: a.id, word: 1, say: "الْوَلَدُ", save: true }, { client: fakeClient(sent), ...OPTS });
    expect(readJson(LEX()).entries[0]).toMatchObject({ word: "الوَلَدُ", say: "الْوَلَدُ" });
    // الجملة الأخرى فيها الكلمة نفسها: تسجيلها كما هو وحالته كما هي، و«ستُنطق» عند توليدها القادم
    const read = await sv.readSentences("986");
    const rb = read.scenes[0]!.rows[1]!;
    expect(rb.status).toBe("generated");
    expect(doc().scenes["c1-s1"].sentences[1].audio).toEqual(bTake);
    expect(read.lexicon.map((e) => e.word)).toEqual(["الوَلَدُ"]);
    sent.length = 0;
    const g = await sv.sentenceAction("986", { action: "generate", id: b.id }, { client: fakeClient(sent), ...OPTS });
    expect(sent[0]!.text).toBe("ثُمَّ ذَهَبَ الْوَلَدُ إِلَى البَيْتِ؟");
    expect(g.read.scenes[0]!.rows[1]!.text).toBe(S1B);
    expect(doc().scenes["c1-s1"].sentences[1].audio.words.map((w: { word: string }) => w.word)).toEqual(S1B.split(" "));
    expect(g.read.scenes[0]!.rows[1]!.applied).toEqual([{ word: "الوَلَدُ", say: "الْوَلَدُ" }]);
    // مسار المشهد العام: النص المرسل بالقاموس، والترجمة بالكتابة الأصلية، والبصمة كما هي
    writeFileSync(path.join(EP_DIR(), "plan.json"), JSON.stringify({ ...plan(), chapters: [{ ...plan().chapters[0]!, scenes: [...plan().chapters[0]!.scenes, { id: "c1-s4", template: "alley-tale", line: 12, narration: "جَاءَ الوَلَدُ.", sfx: [], props: {} }] }] }, null, 2));
    writeFileSync(path.join(EP_DIR(), "tashkeel.md"), `${S1A} ${S1B}\n\n${S2}\n\nجَاءَ الوَلَدُ.\n`);
    sent.length = 0;
    const { generateVoice } = await import("../src/voice/generate");
    await generateVoice("986", { client: fakeClient(sent), testOnlySkipGates: true, only: ["c1-s4"] });
    expect(sent.map((x) => x.text)).toEqual(["جَاءَ الْوَلَدُ."]);
    expect(index()["c1-s4"].words.map((w: { word: string }) => w.word)).toEqual(["جَاءَ", "الوَلَدُ."]);
    // تعديل الكلمة وحذفها من «قاموس النطق»
    const edited = await sv.lexiconAction("986", { op: "set", word: "الوَلَدُ", say: "الوَلَدْ" });
    expect(edited.lexicon[0]!.say).toBe("الوَلَدْ");
    await expect(sv.lexiconAction("986", { op: "set", word: "الوَلَدُ", say: "الولد" })).rejects.toThrow(/التشكيل/);
    const removed = await sv.lexiconAction("986", { op: "remove", word: "الوَلَدُ" });
    expect(removed.lexicon).toEqual([]);
    expect(readJson(LEX()).entries).toEqual([]);
  }, 120_000);

  it("القرآن مستثنى: لا إعادة نطق في صف آية ولا كلمة بين ﴿ ﴾ في القاموس، والتشكيل يلزم النطق المكتوب", async () => {
    const sent: Sent[] = [];
    const { sv, a } = await generated(sent);
    await expect(sv.sentenceAction("986", { action: "fixword", id: a.id, word: 1, say: "الولد" }, { client: fakeClient(sent), ...OPTS })).rejects.toThrow(/التشكيل/);
    await expect(sv.lexiconAction("986", { op: "set", word: "﴿الْحَمْدُ", say: "الْحَمْدُ" })).rejects.toThrow(/القرآني/);
    const add = await sv.sentenceAction("986", { action: "add", id: a.id, text: "﴿الْحَمْدُ لِلَّهِ﴾" });
    const verse = add.read.scenes[0]!.rows[1]!;
    expect(verse.kind).toBe("verse");
    expect(verse.words.every((w) => w.quran)).toBe(true);
    const n = sent.length;
    await expect(sv.sentenceAction("986", { action: "fixword", id: verse.id, word: 0, say: "الْحَمْدُ" }, { client: fakeClient(sent), ...OPTS })).rejects.toThrow(/القرآني|القرآن/);
    expect(sent).toHaveLength(n);
  }, 90_000);
});
