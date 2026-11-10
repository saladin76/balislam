/**
 * «اضغط الكلمة» في مشهد صوته ملف واحد (D63): الضغط على كلمة جملة بلا تسجيل لا يكون ضغطًا ميتًا أبدًا.
 * - توقيت كلمات حقيقي: يُقص صوت المشهد إلى جمله «من صوت المشهد» بلا أي طلب مدفوع، ولا تتغير بصمة صوت المشهد في السجل؛
 *   ثم إعادة نطق كلمة تعيد تركيب ذلك المشهد وحده.
 * - توقيت مقدَّر أو غائب: «لا توجد أوقات دقيقة لكلمات هذا المشهد» و«ولّد هذه الجملة ثم صحّح الكلمة».
 * صوت المشهد صناعي من ffmpeg (نغمة لكل كلمة ووقفات)، وعميل ElevenLabs مزيّف يعدّ طلباته.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encodeWav } from "../src/remotion/dafatir/audio/compose";
import type { ElevenLabsClient } from "../src/voice/elevenlabs";
import type { Plan } from "../src/plan/types";
import { estimateWords } from "../src/voice/generate";
import { looksEstimated, NO_EXACT_TIMINGS, sceneAdoption } from "../src/voice/sentences";
import { reopenTarget, wordClick, WordWhyPopover } from "../app/src/workspace/SentencesPanel";

const ENV = ["BAL_CHANNELS_DIR", "BAL_CHANNEL", "ELEVENLABS_MODEL_ID", "BAL_WORKFLOW_HMAC_KEY", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"] as const;
const saved: Record<string, string | undefined> = {};
let tmp = "";
const SR = 44100;
const S1A = "كَتَبَ الوَلَدُ الدَّرْسَ.";
const S1B = "ثُمَّ ذَهَبَ الوَلَدُ إِلَى البَيْتِ؟";
const S2 = "وَهَذَا مَشْهَدٌ ثَانٍ.";
const EP = "985";
const EP_DIR = () => path.join(tmp, "balislam", "episodes", "985-word-click");
const VOICE = () => path.join(EP_DIR(), "voice");
const SCENE_FILE = "scenewhole000001.wav";

const plan = (): Plan => ({
  episode: EP, title: "اختبار", tone: "calm",
  chapters: [{ number: 1, title: "تجربة", scenes: [
    { id: "c1-s1", template: "alley-tale", line: 6, narration: `${S1A} ${S1B}`, sfx: [], props: {} },
    { id: "c1-s2", template: "alley-tale", line: 8, narration: S2, sfx: [], props: {} },
  ] }],
} as unknown as Plan);

const freshEpisode = () => {
  rmSync(EP_DIR(), { recursive: true, force: true });
  mkdirSync(VOICE(), { recursive: true });
  writeFileSync(path.join(EP_DIR(), "script.md"), `---\ntitle: "اختبار"\nepisode: "${EP}"\n---\n## الفصل 1 · تجربة\n${S1A} ${S1B}\n\n${S2}\n`);
  writeFileSync(path.join(EP_DIR(), "plan.json"), JSON.stringify(plan(), null, 2) + "\n");
  writeFileSync(path.join(EP_DIR(), "tashkeel.md"), `${S1A} ${S1B}\n\n${S2}\n`);
};

/** كلمات المشهد: ٠٫٣ ث لكل كلمة، ٤٠ م.ث بين كلمات الجملة، و٥٠٠ م.ث بين الجملتين */
const GAP = 0.5;
const sceneWords = () => {
  const ws = `${S1A} ${S1B}`.split(" ");
  const out: { word: string; start: number; end: number }[] = [];
  let t = 0.2;
  ws.forEach((w, i) => {
    out.push({ word: w, start: Math.round(t * 1000) / 1000, end: Math.round((t + 0.3) * 1000) / 1000 });
    t += 0.3 + (i === 2 ? GAP : 0.04);
  });
  return { words: out, duration: Math.round((t + 0.3) * 1000) / 1000 };
};
/** صوت المشهد بـ ffmpeg: نغمة ١٥٠ هرتز في زمن كل كلمة، وصمت (مع أرضية خافتة) بينها */
const writeSceneAudio = (o: { estimated?: boolean } = {}) => {
  const { words, duration } = sceneWords();
  const gate = words.map((w) => `between(t,${w.start},${w.end})`).join("+");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i",
    `aevalsrc='0.3*sin(2*PI*150*t)*(${gate})+0.0002*sin(2*PI*40*t)':s=${SR}:d=${duration}`, "-ac", "1", "-c:a", "pcm_s16le", path.join(VOICE(), SCENE_FILE)]);
  const clipWords = o.estimated ? estimateWords(`${S1A} ${S1B}`, duration) : words;
  const index = { "c1-s1": { file: SCENE_FILE, hash: "scenewhole000001", text: `${S1A} ${S1B}`, duration, words: clipWords } };
  writeFileSync(path.join(VOICE(), "index.json"), JSON.stringify(index, null, 2) + "\n");
  return { words, duration };
};

/** WAV صناعي لكل طلب (نغمة لكل حرف) مع توقيت الحروف */
const tone = (text: string) => {
  const chars = [...text];
  const lead = 0.25, step = 0.05, n = Math.round((lead + chars.length * step + 0.4) * SR);
  const s = new Float32Array(n);
  chars.forEach((c, i) => {
    if (/\s/.test(c)) return;
    for (let k = Math.round((lead + i * step) * SR); k < Math.round((lead + (i + 1) * step) * SR); k++) s[k] = Math.sin(2 * Math.PI * 150 * k / SR) * 0.3;
  });
  for (let k = 0; k < n; k++) if (!s[k]) s[k] = 0.0002 * Math.sin(k);
  return { wav: Buffer.from(encodeWav(s, SR)), alignment: { characters: chars, character_start_times_seconds: chars.map((_, i) => lead + i * step), character_end_times_seconds: chars.map((_, i) => lead + (i + 1) * step) } };
};
type Sent = { text: string; previousText?: string; nextText?: string };
const fakeClient = (sent: Sent[]) => ({
  modelId: "mock",
  tts: async (text: string, ctx: { previousText?: string; nextText?: string } = {}) => {
    sent.push({ text, previousText: ctx.previousText, nextText: ctx.nextText });
    const t = tone(text);
    return { audio: t.wav, alignment: t.alignment, model: "mock" };
  },
  soundEffect: async () => { sent.push({ text: "<sfx>" }); return Buffer.alloc(0); }, account: async () => ({}) as never, voices: async () => [],
}) as unknown as ElevenLabsClient;

const readJson = (f: string) => JSON.parse(readFileSync(f, "utf8"));
const doc = () => readJson(path.join(VOICE(), "sentences.json"));
const OPTS = { testOnlySkipApprovalGates: true } as const;
const bytes = (f: string) => readFileSync(f).toString("base64");

beforeAll(() => {
  for (const k of ENV) saved[k] = process.env[k];
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-wordclick-"));
  cpSync(path.join("channels", "balislam"), path.join(tmp, "balislam"), { recursive: true, filter: (s) => !/[\\/]episodes([\\/]|$)/.test(s) });
  process.env.BAL_CHANNELS_DIR = tmp;
  process.env.BAL_CHANNEL = "balislam";
  process.env.ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
  process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__word_click_signing_key_2026";
  delete process.env.ELEVENLABS_API_KEY;
});
afterAll(() => {
  for (const k of ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

describe("توقيت كلمات صوت المشهد (دوال صافية)", () => {
  it("يميّز التوقيت المقدَّر بطول الحروف من المحاذاة الحقيقية", () => {
    expect(looksEstimated(estimateWords(`${S1A} ${S1B}`, 4.2))).toBe(true);
    expect(looksEstimated(sceneWords().words)).toBe(false);
  });
  it("يصلح القص بتوقيت حقيقي ووقفة واضحة؛ والمقدَّر أو الناقص «لا توجد أوقات دقيقة…»؛ وبلا وقفة سببها", () => {
    const { words, duration } = sceneWords();
    const texts = [S1A, S1B];
    expect(sceneAdoption({ words, duration }, texts)).toEqual({ ok: true });
    expect(sceneAdoption({ words: estimateWords(texts.join(" "), duration), duration }, texts)).toMatchObject({ ok: false, reason: NO_EXACT_TIMINGS, timings: false });
    expect(sceneAdoption({ words: words.slice(1), duration }, texts)).toMatchObject({ ok: false, reason: NO_EXACT_TIMINGS });
    expect(sceneAdoption({ words: [], duration }, texts)).toMatchObject({ ok: false, reason: NO_EXACT_TIMINGS });
    const tight = words.map((w, i) => (i >= 3 ? { ...w, start: w.start - GAP + 0.03, end: w.end - GAP + 0.03 } : w));
    expect(sceneAdoption({ words: tight, duration }, texts)).toMatchObject({ ok: false, timings: true, reason: expect.stringMatching(/وقفة/) });
  });
});

describe("الضغط على كلمة في مشهد صوته ملف واحد (على القرص)", () => {
  beforeEach(() => { freshEpisode(); });

  it("توقيت حقيقي: الصف يعرض الكلمات قابلة للضغط («adopt») بزمن ملف المشهد", async () => {
    const { words } = writeSceneAudio();
    const sv = await import("../src/voice/sentenceVoice");
    const r = await sv.readSentences(EP);
    const [a, b] = r.scenes[0]!.rows;
    expect(r.scenes[0]!.managed).toBe(false);
    expect(a!.wordFix).toMatchObject({ ok: false, adopt: true, source: "scene" });
    expect(a!.words.map((w) => w.start)).toEqual(words.slice(0, 3).map((w) => w.start));
    expect(b!.words.map((w) => w.end)).toEqual(words.slice(3).map((w) => w.end));
    expect(wordClick(a!, 1)).toBe("adopt");
  });

  it("«adopt»: يقص صوت المشهد إلى جمله «من صوت المشهد» بلا أي طلب مدفوع، ولا يغيّر بصمة صوت المشهد في السجل", async () => {
    const { words, duration } = writeSceneAudio();
    const sv = await import("../src/voice/sentenceVoice");
    const { inspectSceneProduction } = await import("../src/studio/sceneService");
    const before = await inspectSceneProduction(EP);
    const snap = { index: bytes(path.join(VOICE(), "index.json")), scene: bytes(path.join(VOICE(), SCENE_FILE)), plan: bytes(path.join(EP_DIR(), "plan.json")) };
    const r0 = await sv.readSentences(EP);
    const virtual = r0.scenes[0]!.rows[1]!;
    const sent: Sent[] = [];
    const res = await sv.sentenceAction(EP, { action: "adopt", id: virtual.id }, { client: fakeClient(sent), ...OPTS });
    expect(sent).toHaveLength(0); // لا طلب مدفوع
    expect(res.composed).toBeUndefined(); // لا تركيب للمشهد
    const s = doc().scenes["c1-s1"];
    expect(s.import.state).toBe("imported");
    expect(s.sentences.map((x: { audio: { origin: string } }) => x.audio.origin)).toEqual(["scene", "scene"]);
    // الحد داخل الوقفة بين الجملتين، والكلمات بزمن كل ملف
    const [ta, tb] = s.sentences.map((x: { audio: { duration: number; words: { start: number; end: number }[]; timing: string } }) => x.audio);
    expect(ta.timing).toBe("aligned");
    expect(ta.duration).toBeGreaterThan(words[2]!.end - 0.001);
    expect(ta.duration).toBeLessThan(words[3]!.start + 0.001);
    expect(ta.words.map((w: { start: number }) => w.start)).toEqual(words.slice(0, 3).map((w) => w.start));
    for (const [i, w] of tb.words.entries()) expect(w.start).toBeCloseTo(words[3 + i]!.start - ta.duration, 3);
    expect(ta.duration + tb.duration).toBeCloseTo(duration, 2);
    // الوقفة كما في التسجيل (فيبقى الإيقاع إن رُكّب المشهد من جمله)
    expect(s.sentences[0].pauseAfterMs).toBe(Math.round(GAP * 1000));
    for (const t of [ta, tb]) expect(existsSync(path.join(VOICE(), "sentences", (t as unknown as { file: string }).file))).toBe(true);
    // صوت المشهد والخطة كما هما بايتًا ببايت، والسجل لم يُعد فتح أي مشهد
    expect(bytes(path.join(VOICE(), "index.json"))).toBe(snap.index);
    expect(bytes(path.join(VOICE(), SCENE_FILE))).toBe(snap.scene);
    expect(bytes(path.join(EP_DIR(), "plan.json"))).toBe(snap.plan);
    const after = await inspectSceneProduction(EP);
    expect(after.scenes.map((x) => x.sourceSha256)).toEqual(before.scenes.map((x) => x.sourceSha256));
    // الصف نفسه (بموضعه) صار قابلًا للتصحيح فورًا: النافذة تُفتح على الكلمة نفسها
    const row = res.read.scenes[0]!.rows[1]!;
    expect(row.wordFix).toEqual({ ok: true });
    expect(row.audio?.origin).toBe("scene");
    expect(reopenTarget(res.read, "c1-s1", 1, 2)).toMatchObject({ kind: "fix", draft: { row: row.id, index: 2, say: row.words[2]!.say } });
  }, 60_000);

  it("إعادة نطق كلمة في جملة «من صوت المشهد»: مقطع بسياق الجملة، وصل في تسجيلها، وتركيب يعيد فتح ذلك المشهد وحده", async () => {
    writeSceneAudio();
    const sv = await import("../src/voice/sentenceVoice");
    const { inspectSceneProduction } = await import("../src/studio/sceneService");
    const before = await inspectSceneProduction(EP);
    const adopted = await sv.sentenceAction(EP, { action: "adopt", sceneId: "c1-s1", index: 1 });
    const b = adopted.read.scenes[0]!.rows[1]!;
    const take = doc().scenes["c1-s1"].sentences[1].audio;
    const sent: Sent[] = [];
    const r = await sv.sentenceAction(EP, { action: "fixword", id: b.id, word: 2, say: "الْوَلَدُ" }, { client: fakeClient(sent), ...OPTS });
    expect(r.fix).toMatchObject({ ok: true, index: 2 });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.text).toBe("ذَهَبَ الْوَلَدُ إِلَى");
    expect(sent[0]!.previousText).toBe(`${S1A} ثُمَّ`);
    expect(sent[0]!.nextText).toBe(`البَيْتِ؟ ${S2}`);
    const s = doc().scenes["c1-s1"].sentences[1];
    expect(s.audio.origin).toBe("fix");
    expect(s.takes.at(-1)).toEqual(take);
    // صوت المشهد رُكّب من جمله؛ الملف الأصلي نُقل إلى superseded ولم يُحذف؛ والسجل أعاد فتح المشهد وحده
    expect(r.composed).toMatchObject({ sceneId: "c1-s1", composed: true });
    expect(readJson(path.join(VOICE(), "index.json"))["c1-s1"].sentences).toBeTruthy();
    expect(readdirSync(path.join(VOICE(), "superseded"))).toContain(SCENE_FILE);
    const after = await inspectSceneProduction(EP);
    expect(after.scenes.filter((x, i) => x.sourceSha256 !== before.scenes[i]!.sourceSha256).map((x) => x.id)).toEqual(["c1-s1"]);
  }, 90_000);

  it("توقيت مقدَّر: «لا توجد أوقات دقيقة لكلمات هذا المشهد»، ولا قص؛ ثم «ولّد هذه الجملة» فتُفتح النافذة على الكلمة نفسها", async () => {
    writeSceneAudio({ estimated: true });
    const sv = await import("../src/voice/sentenceVoice");
    const r0 = await sv.readSentences(EP);
    const a = r0.scenes[0]!.rows[0]!;
    expect(a.wordFix).toEqual({ ok: false, reason: NO_EXACT_TIMINGS });
    expect(a.words.every((w) => w.start === null)).toBe(true);
    expect(wordClick(a, 1)).toBe("why");
    expect(reopenTarget(r0, "c1-s1", 0, 1)).toEqual({ kind: "why", row: a.id, index: 1 });
    await expect(sv.sentenceAction(EP, { action: "adopt", id: a.id })).rejects.toThrow(NO_EXACT_TIMINGS);
    // «ولّد هذه الجملة ثم صحّح الكلمة»: طلب واحد للجملة، ثم الصف بموضعه قابل للتصحيح
    const sent: Sent[] = [];
    const g = await sv.sentenceAction(EP, { action: "generate", sceneId: "c1-s1", index: 0 }, { client: fakeClient(sent), ...OPTS });
    expect(sent).toHaveLength(1);
    expect(reopenTarget(g.read, "c1-s1", 0, 1)).toMatchObject({ kind: "fix", draft: { index: 1 } });
  }, 60_000);

  it("بلا صوت للمشهد أصلًا: الكلمة تفتح «لماذا» بسببها، لا ضغطًا ميتًا", async () => {
    const sv = await import("../src/voice/sentenceVoice");
    const a = (await sv.readSentences(EP)).scenes[0]!.rows[0]!;
    expect(a.wordFix.ok).toBe(false);
    expect(a.wordFix.reason).toMatch(/ولّد الجملة/);
    expect(wordClick(a, 0)).toBe("why");
    expect(wordClick({ ...a, words: a.words.map((w) => ({ ...w, quran: true })) }, 0)).toBeNull();
  });
});

describe("نافذة «لماذا» (عرض)", () => {
  const html = (blocked: string | null) => renderToStaticMarkup(React.createElement(WordWhyPopover, {
    word: "الوَلَدُ", index: 1, count: 3, rowNo: 1, reason: NO_EXACT_TIMINGS, blocked, busy: null,
    pos: { top: 0, left: 0, arrow: 20, sheet: false }, onClose: () => {}, onGenerate: () => {},
  }));
  it("سطر السبب، والفعل الأساسي «ولّد هذه الجملة ثم صحّح الكلمة»، و«إلغاء»", () => {
    const h = html(null);
    expect(h).toContain(NO_EXACT_TIMINGS);
    expect(h).toContain("ولّد هذه الجملة ثم صحّح الكلمة");
    expect(h).toContain("إلغاء");
    expect(h).toMatch(/role="dialog"/);
    expect(h).not.toMatch(/ms-pop-go"[^>]*disabled/);
  });
  it("بلا مفتاح: الفعل الأساسي معطّل بسببه، و«إلغاء» متاح", () => {
    const h = html("التوليد يحتاج مفتاح الصوت");
    expect(h).toMatch(/<button[^>]*class="ms-pop-go"[^>]*disabled/);
    expect(h).toContain("التوليد يحتاج مفتاح الصوت");
  });
});
