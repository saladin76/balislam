/**
 * الصوت جملةً جملة (D50): التقسيم الآلي، وأفعال المالك على الجمل، والتوليد لجملة واحدة، والتركيب الذي يقرؤه الرندر.
 * لا مفاتيح ولا شبكة: عميل ElevenLabs مزيّف يصنع WAV صناعيًا مع توقيت الحروف.
 */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encodeWav } from "../src/remotion/dafatir/audio/compose";
import type { ElevenLabsClient } from "../src/voice/elevenlabs";
import type { Plan } from "../src/plan/types";
import {
  addSentenceAfter, cutPoints, deleteSentence, mergeWithNext, reconcileScene, sceneNarration, sentencesFor, splitNarration, splitSentence,
} from "../src/voice/sentences";

const PASS = "sentence-voice-owner-2026";
const ENV = ["BAL_CHANNELS_DIR", "BAL_CHANNEL", "ELEVENLABS_MODEL_ID", "BAL_WORKFLOW_HMAC_KEY", "BAL_STUDIO_OWNER_PASSPHRASE_SHA256", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"] as const;
const saved: Record<string, string | undefined> = {};
let tmp = "";
const SR = 44100;

const S1A = "كَتَبَ الوَلَدُ الدَّرْسَ.";
const S1B = "ثُمَّ ذَهَبَ إِلَى البَيْتِ؟";
const S2 = "وَهَذَا مَشْهَدٌ ثَانٍ.";
const EP_DIR = () => path.join(tmp, "balislam", "episodes", "987-sentences");

const plan = (): Plan => ({
  episode: "987", title: "اختبار", tone: "calm",
  chapters: [{ number: 1, title: "تجربة", scenes: [
    { id: "c1-s1", template: "alley-tale", line: 6, narration: `${S1A} ${S1B}`, sfx: [], props: {} },
    { id: "c1-s2", template: "alley-tale", line: 8, narration: S2, sfx: [], props: { shot: "designed-shot" } },
    { id: "c1-s3", template: "verse-card", line: 10, narration: "", ayahKey: "1:1", sfx: [], props: { text: "", reference: "الفاتحة · ١" } },
  ] }],
} as unknown as Plan);

const freshEpisode = () => {
  rmSync(EP_DIR(), { recursive: true, force: true });
  mkdirSync(path.join(EP_DIR(), "voice"), { recursive: true });
  writeFileSync(path.join(EP_DIR(), "script.md"), `---\ntitle: "اختبار"\nepisode: "987"\n---\n## الفصل 1 · تجربة\n${S1A} ${S1B}\n\n${S2}\n`);
  writeFileSync(path.join(EP_DIR(), "plan.json"), JSON.stringify(plan(), null, 2) + "\n");
  writeFileSync(path.join(EP_DIR(), "tashkeel.md"), `${S1A} ${S1B}\n\n${S2}\n`);
};

/** WAV صناعي: صمت، ثم نغمة لكل حرف غير المسافة، ثم صمت؛ والتوقيت حرفًا حرفًا */
const tone = (text: string) => {
  const chars = [...text];
  const lead = 0.25, step = 0.05, n = Math.round((lead + chars.length * step + 0.4) * SR);
  const s = new Float32Array(n);
  chars.forEach((c, i) => {
    if (/\s/.test(c)) return;
    for (let k = Math.round((lead + i * step) * SR); k < Math.round((lead + (i + 1) * step) * SR); k++) s[k] = Math.sin(2 * Math.PI * 160 * k / SR) * 0.3;
  });
  for (let k = 0; k < n; k++) if (!s[k]) s[k] = 0.0002 * Math.sin(k);
  return { wav: Buffer.from(encodeWav(s, SR)), alignment: { characters: chars, character_start_times_seconds: chars.map((_, i) => lead + i * step), character_end_times_seconds: chars.map((_, i) => lead + (i + 1) * step) } };
};
type Sent = { text: string; previousText?: string; nextText?: string; stability?: number };
const fakeClient = (sent: Sent[]) => ({
  modelId: "mock",
  tts: async (text: string, ctx: { previousText?: string; nextText?: string; tune?: { stability: number } } = {}) => {
    sent.push({ text, previousText: ctx.previousText, nextText: ctx.nextText, stability: ctx.tune?.stability });
    const t = tone(text);
    return { audio: t.wav, alignment: t.alignment, model: "mock" };
  },
  soundEffect: async () => Buffer.alloc(0), account: async () => ({}) as never, voices: async () => [],
}) as unknown as ElevenLabsClient;

/** صوت مشهد «قديم» (مولَّد قبل الجمل) بوقفة حقيقية بين جملتيه، وتوقيت كلماته */
const writeOldSceneAudio = (gap: number) => {
  const ws = `${S1A} ${S1B}`.split(" ");
  const words: { word: string; start: number; end: number }[] = [];
  let t = 0.2;
  ws.forEach((w, i) => {
    words.push({ word: w, start: t, end: t + 0.3 });
    t += 0.3 + (i === 2 ? gap : 0.04);
  });
  const n = Math.round((t + 0.3) * SR);
  const s = new Float32Array(n);
  for (const w of words) for (let k = Math.round(w.start * SR); k < Math.round(w.end * SR); k++) s[k] = Math.sin(2 * Math.PI * 150 * k / SR) * 0.3;
  writeFileSync(path.join(EP_DIR(), "voice", "oldscenehash00001.wav"), encodeWav(s, SR));
  const index = { "c1-s1": { file: "oldscenehash00001.wav", hash: "oldscenehash00001", text: `${S1A} ${S1B}`, duration: n / SR, words } };
  writeFileSync(path.join(EP_DIR(), "voice", "index.json"), JSON.stringify(index, null, 2));
};
const readJson = (f: string) => JSON.parse(readFileSync(f, "utf8"));
const index = () => readJson(path.join(EP_DIR(), "voice", "index.json"));
const sentencesDoc = () => readJson(path.join(EP_DIR(), "voice", "sentences.json"));

beforeAll(() => {
  for (const k of ENV) saved[k] = process.env[k];
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-sentences-"));
  for (const ch of ["balislam", "dafatir-alzaman"])
    cpSync(path.join("channels", ch), path.join(tmp, ch), { recursive: true, filter: (s) => !/[\\/]episodes([\\/]|$)/.test(s) });
  process.env.BAL_CHANNELS_DIR = tmp;
  process.env.BAL_CHANNEL = "balislam";
  process.env.ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
  process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__sentence_voice_signing_key_2026";
  process.env.BAL_STUDIO_OWNER_PASSPHRASE_SHA256 = createHash("sha256").update(PASS).digest("hex");
  delete process.env.ELEVENLABS_API_KEY;
});
afterAll(() => {
  for (const k of ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

describe("التقسيم الآلي (دالة صافية)", () => {
  it("يقسم عند علامات الجملة العربية ويحفظ الكلمات كما هي", () => {
    const text = "قد يشاهد شخصان الموقف نفسه. ثم يخرجان بحكمين؟ نعم! وهنا السؤال: من المحق؛ ومن المخطئ… لا ندري";
    const parts = splitNarration(text);
    expect(parts).toEqual(["قد يشاهد شخصان الموقف نفسه.", "ثم يخرجان بحكمين؟", "نعم!", "وهنا السؤال:", "من المحق؛", "ومن المخطئ…", "لا ندري"]);
    expect(parts.join(" ")).toBe(text);
  });
  it("لا يقطع آية مقتبسة بين ﴿ ﴾ ويعلّمها نصًا قرآنيًا", () => {
    const text = "قال تعالى: ﴿وَلَا تَلْبِسُوا الْحَقَّ بِالْبَاطِلِ. وَتَكْتُمُوا الْحَقَّ﴾ ثم نكمل. وبعدها جملة.";
    const s = sentencesFor("c1-s1", text);
    expect(s.map((x) => x.text)).toEqual(["قال تعالى:", "﴿وَلَا تَلْبِسُوا الْحَقَّ بِالْبَاطِلِ. وَتَكْتُمُوا الْحَقَّ﴾ ثم نكمل.", "وبعدها جملة."]);
    expect(s.map((x) => x.kind)).toEqual(["narration", "verse", "narration"]);
    expect(sceneNarration(s)).toBe(text);
  });
  it("الجملة الطويلة جدًا تُقسم عند الفاصلة الأقرب لوسطها، والقصيرة تبقى", () => {
    const half = Array.from({ length: 18 }, (_, i) => `كلمة${i}`).join(" ");
    const long = `${half}، ${half}.`;
    expect(splitNarration(long)).toEqual([`${half}،`, `${half}.`]);
    expect(splitNarration("قصيرة، وتبقى.")).toEqual(["قصيرة، وتبقى."]);
  });
  it("كل جملة داخل مشهدها: جمل مشهدين لا تختلط", () => {
    const a = sentencesFor("c1-s1", "أ. ب.");
    const b = sentencesFor("c1-s2", "ج.");
    expect(new Set(a.map((x) => x.sceneId))).toEqual(new Set(["c1-s1"]));
    expect(() => mergeWithNext([...a, ...b], a[1]!.id)).toThrow(/في هذا المشهد/);
  });
});

describe("أفعال الجمل تحفظ المعرّفات والترتيب (دالة صافية)", () => {
  const base = () => sentencesFor("c1-s1", "واحد اثنان ثلاثة. أربعة خمسة. ستة.", (() => { let k = 0; return () => `id${k++}`; })());
  it("التقسيم يبقي معرّف الأولى، والدمج يبقي معرّف الأولى ويحفظ التسجيلين", () => {
    const list = base();
    const audio = (f: string) => ({ file: f, fingerprint: "x", context: "y", duration: 1, words: [], at: "", origin: "tts" as const });
    list[0]!.audio = audio("a.mp3");
    list[1]!.audio = audio("b.mp3");
    const sp = splitSentence(list, "id0", 1, "new1");
    expect(sp.list.map((s) => s.id)).toEqual(["id0", "new1", "id1", "id2"]);
    expect(sp.list.map((s) => s.text)).toEqual(["واحد", "اثنان ثلاثة.", "أربعة خمسة.", "ستة."]);
    expect(sp.first.takes?.map((t) => t.file)).toEqual(["a.mp3"]);
    const m = mergeWithNext(list, "id0");
    expect(m.map((s) => s.id)).toEqual(["id0", "id2"]);
    expect(m[0]!.text).toBe("واحد اثنان ثلاثة. أربعة خمسة.");
    expect(m[0]!.audio).toBeUndefined();
    expect(m[0]!.takes?.map((t) => t.file)).toEqual(["a.mp3", "b.mp3"]);
    expect(() => splitSentence(list, "id0", 0)).toThrow();
  });
  it("الحذف والإضافة لا يغيّران غيرهما، ولا تُحذف الجملة الوحيدة في المشهد", () => {
    const list = base();
    expect(deleteSentence(list, "id1").map((s) => s.id)).toEqual(["id0", "id2"]);
    const add = addSentenceAfter(list, "id0", "جديدة.", "n");
    expect(add.list.map((s) => s.id)).toEqual(["id0", "n", "id1", "id2"]);
    const only = sentencesFor("x", "وحيدة.");
    expect(() => deleteSentence(only, only[0]!.id)).toThrow(/الوحيدة/);
  });
  it("المصالحة مع نص غيّره محرر المشهد تحفظ الجمل التي لم تتغير", () => {
    const list = base();
    list[2]!.audio = { file: "c.mp3", fingerprint: "x", context: "y", duration: 1, words: [], at: "", origin: "tts" };
    const r = reconcileScene(list, "c1-s1", "واحد اثنان ثلاثة. شيء آخر. ستة.");
    expect(r[0]!.id).toBe("id0");
    expect(r[2]!.id).toBe("id2");
    expect(r[2]!.audio?.file).toBe("c.mp3");
    expect(r[1]!.id).not.toBe("id1");
  });
  it("القص بتوقيت الكلمات لا يُعتمد بلا وقفة حقيقية بين الجملتين", () => {
    const w = (s: number) => ({ word: "x", start: s, end: s + 0.3 });
    expect(cutPoints([w(0), w(0.34), w(1.2)], [2, 1])).toEqual({ ok: true, cuts: [(0.64 + 1.2) / 2] });
    expect(cutPoints([w(0), w(0.34), w(0.68)], [2, 1]).ok).toBe(false);
    expect(cutPoints([w(0), w(0.34)], [2, 1]).ok).toBe(false);
  });
});

describe("على القرص: جلسة المالك، القص، التوليد، التركيب", () => {
  beforeEach(() => { process.env.BAL_CHANNEL = "balislam"; freshEpisode(); });

  it("كل فعل يحتاج جلسة المالك، والقراءة لا", async () => {
    const sv = await import("../src/voice/sentenceVoice");
    const read = await sv.readSentences("987");
    expect(read.scenes.map((s) => s.id)).toEqual(["c1-s1", "c1-s2", "c1-s3"]);
    expect(read.scenes[0]!.rows.map((r) => r.text)).toEqual([S1A, S1B]);
    expect(read.scenes[0]!.rows.every((r) => r.virtual)).toBe(true);
    await expect(sv.sentenceAction("987", { action: "init", sceneId: "c1-s1" }, "wrong")).rejects.toMatchObject({ code: "OWNER_AUTH" });
    await expect(sv.sentenceAction("987", { action: "init", sceneId: "c1-s1" }, undefined)).rejects.toMatchObject({ code: "OWNER_AUTH" });
    expect(existsSync(path.join(EP_DIR(), "voice", "sentences.json"))).toBe(false);
  });

  it("صوت المشهد القديم يُقص إلى جمله إن كانت الوقفة واضحة، والملف الأصلي كما هو", async () => {
    writeOldSceneAudio(0.5);
    const before = readFileSync(path.join(EP_DIR(), "voice", "oldscenehash00001.wav"));
    const sv = await import("../src/voice/sentenceVoice");
    const r = await sv.sentenceAction("987", { action: "init", sceneId: "c1-s1" }, PASS);
    const scene = r.read.scenes[0]!;
    expect(scene.import?.state).toBe("imported");
    expect(scene.rows.map((x) => x.status)).toEqual(["generated", "generated"]);
    expect(scene.rows.map((x) => x.audio?.origin)).toEqual(["scene", "scene"]);
    // init لا يغيّر صوت المشهد ولا ملفه
    expect(index()["c1-s1"].file).toBe("oldscenehash00001.wav");
    expect(readFileSync(path.join(EP_DIR(), "voice", "oldscenehash00001.wav"))).toEqual(before);
  });

  it("بلا وقفة واضحة لا يُقص شيء: الجمل تبدأ بلا صوت، وصوت المشهد يبقى", async () => {
    writeOldSceneAudio(0.04);
    const sv = await import("../src/voice/sentenceVoice");
    const r = await sv.sentenceAction("987", { action: "init", sceneId: "c1-s1" }, PASS);
    expect(r.read.scenes[0]!.import?.state).toBe("unreliable");
    expect(r.read.scenes[0]!.rows.map((x) => x.status)).toEqual(["missing", "missing"]);
    expect(index()["c1-s1"].file).toBe("oldscenehash00001.wav");
  });

  it("توليد جملة واحدة: طلب واحد بنص الجارتين، والأخرى بملفها وبصمتها، ثم يُركّب صوت المشهد للرندر", async () => {
    writeOldSceneAudio(0.5);
    const sv = await import("../src/voice/sentenceVoice");
    const sent: Sent[] = [];
    const client = fakeClient(sent);
    const init = await sv.sentenceAction("987", { action: "init", sceneId: "c1-s1" }, PASS);
    const [a, b] = init.read.scenes[0]!.rows;
    const docBefore = sentencesDoc();
    const r = await sv.sentenceAction("987", { action: "generate", id: b!.id }, PASS, { client, testOnlySkipApprovalGates: true });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.previousText).toBe(S1A);
    expect(sent[0]!.nextText).toBe(S2);
    const doc = sentencesDoc();
    const [da, db] = doc.scenes["c1-s1"].sentences;
    // الجملة الأخرى: الملف والبصمة كما هما
    expect(da.audio).toEqual(docBefore.scenes["c1-s1"].sentences[0].audio);
    expect(db.audio.origin).toBe("tts");
    expect(db.takes.map((t: { origin: string }) => t.origin)).toEqual(["scene"]);
    expect(r.composed).toMatchObject({ sceneId: "c1-s1", composed: true });
    const clip = index()["c1-s1"];
    expect(clip.text).toBe(`${S1A} ${S1B}`);
    expect(clip.sentences.ids).toEqual([a!.id, b!.id]);
    expect(clip.words.map((w: { word: string }) => w.word)).toEqual(`${S1A} ${S1B}`.split(" "));
    for (let i = 1; i < clip.words.length; i++) expect(clip.words[i].start).toBeGreaterThanOrEqual(clip.words[i - 1].start);
    expect(clip.words.at(-1).end).toBeLessThanOrEqual(clip.duration);
    // الوقفة بين الجملتين = وقفة الجملة الأولى (٤٥٠ م.ث لنقطة) تقريبًا، لا صمت التسجيلين مجموعًا
    const gap = clip.words[3].start - clip.words[2].end;
    expect(gap).toBeGreaterThan(0.3);
    expect(gap).toBeLessThan(0.75);
    expect(path.basename(clip.file)).toBe(clip.file);
    expect(existsSync(path.join(EP_DIR(), "voice", clip.file))).toBe(true);
    // صوت المشهد المدفوع القديم لم يُحذف: نُقل إلى superseded
    expect(existsSync(path.join(EP_DIR(), "voice", "superseded", "oldscenehash00001.wav"))).toBe(true);
    expect(doc.scenes["c1-s1"].replaced[0]).toMatchObject({ file: "oldscenehash00001.wav", movedTo: "superseded/oldscenehash00001.wav" });
    // الرندر يقرأ المقطع كما يقرأ أي مقطع: المدة من الملف المركّب + ذيل القالب
    const { sceneSeconds } = await import("../src/plan/duration");
    const { loadVoiceIndex } = await import("../src/voice/generate");
    const { readPlanFile } = await import("../src/plan/io");
    const p = (await readPlanFile(path.join(EP_DIR(), "script.md")))!;
    const voice = await loadVoiceIndex("987");
    const sec = sceneSeconds(p.chapters[0]!.scenes[0]!, { voice, recitations: {} } as never);
    expect(sec).toBeGreaterThanOrEqual(clip.duration);
    // إعادة توليد الجملة نفسها لا تمس الأخرى
    const again = await sv.sentenceAction("987", { action: "generate", id: b!.id }, PASS, { client, testOnlySkipApprovalGates: true });
    expect(sent).toHaveLength(2);
    expect(sentencesDoc().scenes["c1-s1"].sentences[0].audio).toEqual(da.audio);
    expect(again.read.scenes[0]!.rows[1]!.takes).toBe(2);
  }, 60_000);

  it("التشكيل تحت الحد يوقف توليد الجملة برسالة واضحة، ولا طلب", async () => {
    const sv = await import("../src/voice/sentenceVoice");
    const sent: Sent[] = [];
    await sv.sentenceAction("987", { action: "init", sceneId: "c1-s1" }, PASS);
    const r = await sv.sentenceAction("987", { action: "add", sceneId: "c1-s1", index: 1, text: "ذهب محمد الى السوق مسرعا." }, PASS);
    const added = r.read.scenes[0]!.rows[2]!;
    expect(added.tashkeel.ok).toBe(false);
    await expect(sv.sentenceAction("987", { action: "generate", id: added.id }, PASS, { client: fakeClient(sent), testOnlySkipApprovalGates: true }))
      .rejects.toThrow(/تشكيل هذه الجملة .*٩٨/);
    expect(sent).toHaveLength(0);
  });

  it("النص القرآني لا يُولَّد أبدًا، ومشهد الآية لا تُكتب له جمل", async () => {
    const sv = await import("../src/voice/sentenceVoice");
    const sent: Sent[] = [];
    await sv.sentenceAction("987", { action: "init", sceneId: "c1-s2" }, PASS);
    const r = await sv.sentenceAction("987", { action: "add", sceneId: "c1-s2", index: 0, text: "﴿الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ﴾" }, PASS);
    const v = r.read.scenes[1]!.rows[1]!;
    expect(v.kind).toBe("verse");
    await expect(sv.sentenceAction("987", { action: "generate", id: v.id }, PASS, { client: fakeClient(sent), testOnlySkipApprovalGates: true }))
      .rejects.toThrow(/لا يتلو القرآن/);
    expect(sent).toHaveLength(0);
    expect(r.read.scenes[1]!.waiting).toMatch(/نص قرآني/);
    await expect(sv.sentenceAction("987", { action: "init", sceneId: "c1-s3" }, PASS)).rejects.toThrow(/بلا تعليق/);
    expect(r.read.scenes[2]!.verse).toMatchObject({ kind: "verse-card", ayahKey: "1:1", status: "missing" });
  });

  it("تعديل نص جملة يكتب نص مشهدها وحده في الخطة المصمَّمة دون إعادة توليدها، والسجل يعيد فتح ذلك المشهد وحده", async () => {
    const { inspectSceneProduction } = await import("../src/studio/sceneService");
    const { isDesignedPlan } = await import("../src/plan/designed");
    const before = await inspectSceneProduction("987");
    const planBefore = readJson(path.join(EP_DIR(), "plan.json"));
    const sv = await import("../src/voice/sentenceVoice");
    const r = await sv.sentenceAction("987", { action: "edit", sceneId: "c1-s2", index: 0, text: "وَهَذَا مَشْهَدٌ ثَانٍ جَدِيدٌ." }, PASS);
    expect(r.planChanged).toBe(true);
    const planAfter = readJson(path.join(EP_DIR(), "plan.json"));
    expect(isDesignedPlan(planAfter)).toBe(true);
    expect(planAfter.chapters[0].scenes[1].narration).toBe("وَهَذَا مَشْهَدٌ ثَانٍ جَدِيدٌ.");
    expect(planAfter.chapters[0].scenes[1].props).toEqual({ shot: "designed-shot" });
    expect(planAfter.chapters[0].scenes[0]).toEqual(planBefore.chapters[0].scenes[0]);
    expect(planAfter.chapters[0].scenes[2]).toEqual(planBefore.chapters[0].scenes[2]);
    const after = await inspectSceneProduction("987");
    const changed = after.scenes.filter((s, i) => s.sourceSha256 !== before.scenes[i]!.sourceSha256).map((s) => s.id);
    expect(changed).toEqual(["c1-s2"]);
  });

  it("generateVoice لا يولّد مشهدًا صوته جملةً جملة ولا يحذف مقطعه", async () => {
    writeOldSceneAudio(0.5);
    const sv = await import("../src/voice/sentenceVoice");
    const sent: Sent[] = [];
    const client = fakeClient(sent);
    const init = await sv.sentenceAction("987", { action: "init", sceneId: "c1-s1" }, PASS);
    await sv.sentenceAction("987", { action: "generate", id: init.read.scenes[0]!.rows[0]!.id }, PASS, { client, testOnlySkipApprovalGates: true });
    const composed = index()["c1-s1"];
    sent.length = 0;
    const { generateVoice } = await import("../src/voice/generate");
    await generateVoice("987", { client, testOnlySkipGates: true });
    // مشهد واحد فقط وُلّد كاملًا (c1-s2)، والمشهد بالجمل لم يُطلب ولم يُمس مقطعه
    expect(sent.map((x) => x.text)).toEqual([S2]);
    expect(index()["c1-s1"]).toEqual(composed);
    expect(existsSync(path.join(EP_DIR(), "voice", composed.file))).toBe(true);
    // «أعد توليد الصوت» للمشهد كله لا يعيده بصمت: يقول أين يولَّد
    await expect(generateVoice("987", { client, testOnlySkipGates: true, only: ["c1-s1"], force: true })).rejects.toThrow(/جملةً جملة/);
    expect(sent.map((x) => x.text)).toEqual([S2]);
    const { scenesNeedingVoice } = await import("../src/studio/prepareAll");
    expect(await scenesNeedingVoice("987")).not.toContain("c1-s1");
  }, 60_000);

  it("النبرة والوقفة لجملة في قناة بلا خريطة نبرة تُحفظ مع الجملة وتجعلها تحتاج توليدًا", async () => {
    writeOldSceneAudio(0.5);
    const sv = await import("../src/voice/sentenceVoice");
    const init = await sv.sentenceAction("987", { action: "init", sceneId: "c1-s1" }, PASS);
    const id = init.read.scenes[0]!.rows[0]!.id;
    const r = await sv.sentenceAction("987", { action: "tone", id, tone: "warm" }, PASS);
    expect(r.read.scenes[0]!.rows[0]).toMatchObject({ tone: "warm", inheritedTone: "calm", status: "stale" });
    expect(r.read.scenes[0]!.rows[1]!.status).toBe("generated");
    const p = await sv.sentenceAction("987", { action: "pause", id, ms: 900 }, PASS);
    expect(p.read.scenes[0]!.rows[0]!.pauseAfterMs).toBe(900);
    await expect(sv.sentenceAction("987", { action: "tone", id, tone: "loud" }, PASS)).rejects.toThrow(/غير معروفة/);
  });
});

describe("دفاتر الزمن: نبرة الجملة تكتب إصدارًا جديدًا من خريطة النبرة", () => {
  it("v1.2 ← v1.3 بـ sentenceOverrides والإصدار السابق محفوظ، والأجزاء كما هي", async () => {
    process.env.BAL_CHANNEL = "dafatir-alzaman";
    const src = "channels/dafatir-alzaman/episodes/001-adam-beginning";
    const dir = path.join(tmp, "dafatir-alzaman", "episodes", "001-adam-beginning");
    mkdirSync(dir, { recursive: true });
    for (const f of ["script.md", "plan.json", "tone-map.json", "tashkeel.md"]) writeFileSync(path.join(dir, f), readFileSync(path.join(src, f)));
    const raw = readFileSync(path.join(dir, "tone-map.json"), "utf8");
    const sv = await import("../src/voice/sentenceVoice");
    const read = await sv.readSentences("001");
    expect(read.toneMap?.version).toBe("v1.2");
    const scene = read.scenes.find((s) => s.rows.length)!;
    expect(scene.rows[0]!.toneSource).toBe("map");
    const inherited = scene.rows[0]!.inheritedTone;
    expect(inherited).toBeTruthy();
    const other = inherited === "dramatic" ? "warm" : "dramatic";
    const r = await sv.sentenceAction("001", { action: "tone", id: scene.rows[0]!.id, tone: other, note: "أقوى هنا" }, PASS);
    expect(r.message).toMatch(/v1\.3/);
    const map = readJson(path.join(dir, "tone-map.json"));
    expect(map.version).toBe("v1.3");
    expect(readFileSync(path.join(dir, "tone-map.v1.2.json"), "utf8")).toBe(raw);
    expect(map.audioParts).toEqual(JSON.parse(raw).audioParts);
    const id = JSON.parse(readFileSync(path.join(dir, "voice", "sentences.json"), "utf8")).scenes[scene.id].sentences[0].id;
    expect(map.sentenceOverrides[id]).toMatchObject({ tone: other, scene: scene.id, version: "v1.3", by: "owner" });
    expect(map.changelog.at(-1)).toMatchObject({ from: "v1.2", to: "v1.3", source: "sentence-tone", sentence: id, after: other });
    const after = await sv.readSentences("001");
    expect(after.scenes.find((s) => s.id === scene.id)!.rows[0]).toMatchObject({ tone: other, inheritedTone: inherited });
    // ما زالت خريطة صالحة لمسار الأجزاء
    const { loadPartsContext } = await import("../src/voice/dafatirParts");
    const { readPlanFile } = await import("../src/plan/io");
    const plan = (await readPlanFile(path.join(dir, "script.md")))!;
    expect((await loadPartsContext(path.join(dir, "script.md"), plan))!.jobs.length).toBe(52);
    expect(readdirSync(dir).filter((f) => f.startsWith("tone-map"))).toEqual(expect.arrayContaining(["tone-map.json", "tone-map.v1.2.json"]));
  });
});
