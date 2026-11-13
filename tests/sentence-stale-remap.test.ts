/**
 * D97 (QA زبدة الكتب D-1، D-3، D-4): جمل مشهد تغيّر نصه بعد تسجيله (remap-scene-ids --with-changed-text).
 * - معرّفات الجمل ثابتة بين قراءة وأخرى بلا كتابة، وكل فعل على جملة يجد معرّفها (لا 409).
 * - الجملة التي تغيّر نصها تبقى بمعرّفها وتسجيلها القديم «قديم — سُجّل على نص سابق»، يُسمع ولا يُركّب، و«ولّد» متاح.
 * - لا يُحذف تسجيل: كل تسجيل قبل المصالحة موجود بعدها (audio أو takes).
 * - نبرة الحلقة لا تُبطل تسجيلًا سُجّل بنبرة معروفة؛ وما يُبطله فعلًا يُعدّ قبل التطبيق (toneChangeImpact) بلا توليد.
 * لا مفاتيح ولا شبكة: عميل مزيّف يصنع WAV صناعيًا.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { encodeWav } from "../src/remotion/dafatir/audio/compose";
import type { ElevenLabsClient } from "../src/voice/elevenlabs";
import { heavyTimeout } from "./helpers/heavyTimeout";
import {
  reconcileScene, recordedOnOtherText, sentencesFor, sentenceStatus, stableSentenceId, type Sentence, type SentenceAudio,
} from "../src/voice/sentences";

const ENV = ["BAL_CHANNELS_DIR", "BAL_CHANNEL", "ELEVENLABS_MODEL_ID", "BAL_WORKFLOW_HMAC_KEY", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"] as const;
const saved: Record<string, string | undefined> = {};
let tmp = "";
const SR = 44100;
const CH = "zubdat-alkutub";

const take = (file: string, text: string, extra: Partial<SentenceAudio> = {}): SentenceAudio => ({
  file, fingerprint: `fp-${file}`, context: "c", duration: 1, at: "", origin: "tts",
  words: text.split(" ").map((w, i) => ({ word: w, start: i * 0.3, end: i * 0.3 + 0.25 })), ...extra,
});
const allTakes = (list: Sentence[]) => list.flatMap((s) => [...(s.takes ?? []), ...(s.audio ? [s.audio] : [])].map((a) => a.file)).sort();

describe("المصالحة بمعرّفات ثابتة (دالة صافية)", () => {
  const OLD = ["أولى كما هي.", "ثانية قديمة.", "ثالثة قديمة.", "رابعة كما هي."];
  const NEW = ["أولى كما هي.", "ثانية جديدة.", "ثالثة جديدة.", "جملة زائدة.", "رابعة كما هي."];
  const stored = (): Sentence[] => OLD.map((text, k) => ({
    id: `id${k}`, sceneId: "c1-s5", kind: "narration", text, pauseAfterMs: 300,
    audio: take(`a${k}.mp3`, text), ...(k === 1 ? { tone: "warm" as const, takes: [take("older1.mp3", text)] } : {}),
  }));

  it("القراءتان المتتاليتان تعطيان المعرّفات نفسها (لا عشوائية)", () => {
    const a = reconcileScene(stored(), "c1-s5", NEW.join(" "));
    const b = reconcileScene(stored(), "c1-s5", NEW.join(" "));
    expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id));
    expect(new Set(a.map((s) => s.id)).size).toBe(a.length);
  });
  it("الجملة المتغيّرة تبقى بمعرّفها ونبرتها وتسجيلها القديم «قديم»؛ الزائدة بمعرّف ثابت", () => {
    const r = reconcileScene(stored(), "c1-s5", NEW.join(" "));
    expect(r.map((s) => s.text)).toEqual(NEW);
    expect(r.map((s) => s.id).slice(0, 3)).toEqual(["id0", "id1", "id2"]);
    expect(r[4]!.id).toBe("id3");
    expect(r[3]!.id).toBe(stableSentenceId("c1-s5", 3, NEW[3]!, new Set(["id0", "id1", "id2", "id3"])));
    expect(r[1]!.tone).toBe("warm");
    expect(r[1]!.audio?.file).toBe("a1.mp3");
    expect(r[1]!.takes?.map((t) => t.file)).toEqual(["older1.mp3"]);
    expect(recordedOnOtherText(r[1]!)).toBe(true);
    expect(recordedOnOtherText(r[0]!)).toBe(false);
    expect(sentenceStatus(r[1]!, "current-fp")).toBe("old");
    expect(sentenceStatus(r[3]!, "current-fp")).toBe("missing");
    // a take on the sentence's own text with another setting stays «تحتاج توليدًا»
    expect(sentenceStatus(r[0]!, "current-fp")).toBe("stale");
  });
  it("لا يضيع تسجيل: كل تسجيل قبل المصالحة موجود بعدها، ولو قلّت الجمل", () => {
    const before = allTakes(stored());
    expect(allTakes(reconcileScene(stored(), "c1-s5", NEW.join(" ")))).toEqual(before);
    const fewer = reconcileScene(stored(), "c1-s5", "كل شيء تغيّر هنا.");
    expect(fewer).toHaveLength(1);
    expect(allTakes(fewer)).toEqual(before);
  });
  it("المصالحة مرة ثانية على الناتج لا تغيّر شيئًا", () => {
    const r = reconcileScene(stored(), "c1-s5", NEW.join(" "));
    expect(reconcileScene(r, "c1-s5", NEW.join(" "))).toBe(r);
  });
  it("تسجيل الراوي لا يصير التسجيل الحالي لصف آية", () => {
    const list = sentencesFor("c1-s1", "جملة عادية.").map((s) => ({ ...s, audio: take("n.mp3", s.text) }));
    const r = reconcileScene(list, "c1-s1", "﴿إِنَّ مَعَ الْعُسْرِ يُسْرًا﴾");
    expect(r[0]!.kind).toBe("verse");
    expect(r[0]!.audio).toBeUndefined();
    expect(r[0]!.takes?.map((t) => t.file)).toEqual(["n.mp3"]);
  });
});

// ── على القرص: الحلقة بعد نقل المعرّفات مع نص تغيّر، والأفعال عبر sentenceAction ──

const T1 = "كَتَبَ الوَلَدُ الدَّرْسَ.";
const T2_OLD = "ثُمَّ ذَهَبَ إِلَى البَيْتِ؟";
const T2_NEW = "ثُمَّ رَجَعَ إِلَى البَيْتِ؟";
const T3 = "وَنَامَ مُبَكِّرًا.";
const EP = () => path.join(tmp, CH, "episodes", "986-stale");
const planOf = (narration: string, tone?: string) => ({
  episode: "986", title: "اختبار", ...(tone ? { tone } : {}),
  chapters: [{ number: 1, title: "", scenes: [{ id: "c1-s1", template: "zubdat-shot", line: 6, narration, sfx: [], props: {} }] }],
});
const writePlan = (narration: string, tone?: string) =>
  writeFileSync(path.join(EP(), "plan.json"), JSON.stringify(planOf(narration, tone), null, 2) + "\n");
const wav = (sec: number) => Buffer.from(encodeWav(new Float32Array(Math.round(sec * SR)).map((_, k) => Math.sin(k / 9) * 0.2), SR));
const fakeClient = (sent: string[]) => ({
  modelId: "mock",
  tts: async (text: string) => {
    sent.push(text);
    const chars = [...text], step = 0.05;
    return { audio: wav(0.3 + chars.length * step), model: "mock",
      alignment: { characters: chars, character_start_times_seconds: chars.map((_, i) => 0.1 + i * step), character_end_times_seconds: chars.map((_, i) => 0.1 + (i + 1) * step) } };
  },
  soundEffect: async () => Buffer.alloc(0), account: async () => ({}) as never, voices: async () => [],
}) as unknown as ElevenLabsClient;
const doc = () => JSON.parse(readFileSync(path.join(EP(), "voice", "sentences.json"), "utf8"));
const filesOnDisk = (d: { scenes: Record<string, { sentences: Sentence[] }> }) =>
  Object.values(d.scenes).flatMap((sc) => allTakes(sc.sentences)).sort();

/** The owner's state: the scene recorded on the old text (an adopted take per sentence), then the text changed. */
const ownerState = async () => {
  rmSync(EP(), { recursive: true, force: true });
  mkdirSync(path.join(EP(), "voice", "sentences"), { recursive: true });
  const old = `${T1} ${T2_OLD} ${T3}`;
  writeFileSync(path.join(EP(), "script.md"), `---\ntitle: "اختبار"\nepisode: "986"\n---\n${old}\n`);
  writeFileSync(path.join(EP(), "tashkeel.md"), `${old}\n${T2_NEW}\n`);
  writePlan(old);
  const ws: { word: string; start: number; end: number }[] = [];
  let t = 0.3;
  for (const w of old.split(" ")) { ws.push({ word: w, start: t, end: t + 0.3 }); t += w.endsWith(".") || w.endsWith("؟") ? 0.9 : 0.34; }
  writeFileSync(path.join(EP(), "voice", "scenehash0000001.wav"), wav(t + 0.4));
  writeFileSync(path.join(EP(), "voice", "index.json"), JSON.stringify({ "c1-s1": { file: "scenehash0000001.wav", hash: "scenehash0000001", text: old, duration: t + 0.4, words: ws } }, null, 2));
  const sv = await import("../src/voice/sentenceVoice");
  await sv.sentenceAction("986", { action: "adopt", sceneId: "c1-s1", index: 0 });
  // the script was rewritten after recording (adf74b6f), and remap-scene-ids --with-changed-text moved the files along
  writePlan(`${T1} ${T2_NEW} ${T3}`);
  writeFileSync(path.join(EP(), "script.md"), `---\ntitle: "اختبار"\nepisode: "986"\n---\n${T1} ${T2_NEW} ${T3}\n`);
};

beforeAll(() => {
  for (const k of ENV) saved[k] = process.env[k];
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-stale-remap-"));
  cpSync(path.join("channels", CH), path.join(tmp, CH), { recursive: true, filter: (s) => !/[\\/]episodes([\\/]|$)/.test(s) });
  process.env.BAL_CHANNELS_DIR = tmp;
  process.env.BAL_CHANNEL = CH;
  process.env.ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
  process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__stale_remap_signing_key_2026";
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.ELEVENLABS_VOICE_ID;
});
afterAll(() => {
  for (const k of ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

// KI-059: the first request / action loads the Studio modules cold; under load the 5 s default was exceeded. Same checks.
describe("مشهد «قديم» بعد نقل المعرّفات: كل فعل على جملة يعمل (D-1، D-3)", { timeout: heavyTimeout(5_000) }, () => {
  beforeEach(ownerState);

  it("القراءة تعرض «قديم» بتسجيله القديم، بمعرّفات ثابتة بين قراءتين، ولا تكتب شيئًا", async () => {
    const sv = await import("../src/voice/sentenceVoice");
    const before = readFileSync(path.join(EP(), "voice", "sentences.json"), "utf8");
    const a = await sv.readSentences("986"), b = await sv.readSentences("986");
    expect(readFileSync(path.join(EP(), "voice", "sentences.json"), "utf8")).toBe(before);
    const rows = a.scenes[0]!.rows;
    expect(rows.map((r) => r.id)).toEqual(b.scenes[0]!.rows.map((r) => r.id));
    expect(rows.map((r) => r.status)).toEqual(["generated", "old", "generated"]);
    expect(rows[1]!.audio?.origin).toBe("scene");
    expect(rows[1]!.recordedOn).toBe(T2_OLD);
    expect(rows[1]!.wordFix.ok).toBe(false);
    expect(rows[1]!.wordFix.reason).toMatch(/قديم/);
    // the old take is not composed into the scene voice
    expect(a.scenes[0]!.waiting).toMatch(/جمل بلا صوت حالي: ١/);
  });

  it("النبرة والوقفة والتعديل والتقسيم والدمج و«سمعتها» والإضافة والحذف تجد الجملة (لا «المشهد غير موجود»)", async () => {
    const sv = await import("../src/voice/sentenceVoice");
    const keep = filesOnDisk(doc());
    let rows = (await sv.readSentences("986")).scenes[0]!.rows;
    const id = rows[1]!.id;
    let r = await sv.sentenceAction("986", { action: "tone", id, tone: "warm" });
    expect(r.read.scenes[0]!.rows[1]).toMatchObject({ id, tone: "warm", status: "old" });
    r = await sv.sentenceAction("986", { action: "pause", id, ms: 600 });
    expect(r.read.scenes[0]!.rows[1]!.pauseAfterMs).toBe(600);
    // the reconciled list is saved once, with the same ids the page showed
    expect(doc().scenes["c1-s1"].sentences.map((s: Sentence) => s.id)).toEqual(rows.map((x) => x.id));
    r = await sv.sentenceAction("986", { action: "edit", id, text: T2_NEW.replace("رَجَعَ", "عَادَ") });
    expect(r.planChanged).toBe(true);
    r = await sv.sentenceAction("986", { action: "split", id, at: 2 });
    rows = r.read.scenes[0]!.rows;
    expect(rows).toHaveLength(4);
    r = await sv.sentenceAction("986", { action: "merge", id });
    expect(r.read.scenes[0]!.rows).toHaveLength(3);
    const added = await sv.sentenceAction("986", { action: "add", id, text: "جُمْلَةٌ مُضَافَةٌ." });
    const extra = added.read.scenes[0]!.rows[2]!;
    await sv.sentenceAction("986", { action: "delete", id: extra.id });
    await expect(sv.sentenceAction("986", { action: "heard", id, value: true })).resolves.toBeTruthy();
    // no paid take was dropped along the way
    const after = filesOnDisk(doc());
    for (const f of keep) expect(after).toContain(f);
  });

  it("«ولّد» على الجملة القديمة يعمل (عميل مزيّف)، والتسجيل القديم يبقى في takes", async () => {
    const sv = await import("../src/voice/sentenceVoice");
    const rows = (await sv.readSentences("986")).scenes[0]!.rows;
    // the sentence's own tone (the other two keep their channel-layer takes, so the scene composes)
    await sv.sentenceAction("986", { action: "tone", id: rows[1]!.id, tone: "warm" });
    const sent: string[] = [];
    const r = await sv.sentenceAction("986", { action: "generate", id: rows[1]!.id }, { client: fakeClient(sent), testOnlySkipApprovalGates: true });
    expect(sent).toHaveLength(1);
    const row = r.read.scenes[0]!.rows[1]!;
    expect(row.status).toBe("generated");
    expect(row.takes).toBe(1);
    expect(doc().scenes["c1-s1"].sentences[1].takes[0].file).toBe(rows[1]!.audio!.file);
    expect(r.composed).toMatchObject({ composed: true });
  });

  it("«ولّد» بلا مفتاح يُرفض برسالة المفتاح، لا «المشهد غير موجود»", async () => {
    const sv = await import("../src/voice/sentenceVoice");
    const rows = (await sv.readSentences("986")).scenes[0]!.rows;
    await expect(sv.sentenceAction("986", { action: "generate", id: rows[1]!.id }, { client: null, testOnlySkipApprovalGates: true }))
      .rejects.toThrow(/ElevenLabs|نبرة/);
    await expect(sv.sentenceAction("986", { action: "generate", id: rows[1]!.id }, { client: null, testOnlySkipApprovalGates: true }))
      .rejects.not.toThrow(/المشهد غير موجود/);
  });

  it("الإصلاح لمرة واحدة: تجربة لا تكتب، و--apply يحفظ المصالحة بنسخة احتياطية ويعيد التسجيل المركون إلى جملته", async () => {
    const sv = await import("../src/voice/sentenceVoice");
    // the earlier reconcile parked the old take on the first sentence and left the changed one without audio
    const d = doc();
    const list: Sentence[] = d.scenes["c1-s1"].sentences;
    const parked = list[1]!.audio!;
    d.scenes["c1-s1"].sentences = [
      { ...list[0]!, takes: [...(list[0]!.takes ?? []), parked] },
      { id: "trandom0001", sceneId: "c1-s1", kind: "narration", text: T2_NEW, pauseAfterMs: 500 },
      list[2]!,
    ];
    writeFileSync(path.join(EP(), "voice", "sentences.json"), JSON.stringify(d, null, 2));
    const raw = readFileSync(path.join(EP(), "voice", "sentences.json"), "utf8");
    const dry = await sv.repairSentences("986");
    expect(dry.restored).toEqual([{ sceneId: "c1-s1", sentenceId: "trandom0001", file: parked.file }]);
    expect(dry.written).toBe(false);
    expect(readFileSync(path.join(EP(), "voice", "sentences.json"), "utf8")).toBe(raw);
    const done = await sv.repairSentences("986", { apply: true });
    expect(done.written).toBe(true);
    expect(readFileSync(done.backup!, "utf8")).toBe(raw);
    const rows = (await sv.readSentences("986")).scenes[0]!.rows;
    expect(rows.map((r) => r.status)).toEqual(["generated", "old", "generated"]);
    expect(filesOnDisk(doc())).toEqual(filesOnDisk(JSON.parse(raw)));
    expect((await sv.repairSentences("986")).restored).toEqual([]);
  });
});

describe("نبرة الحلقة لا تُبطل التسجيلات بصمت (D-4)", { timeout: heavyTimeout(5_000) }, () => {
  beforeEach(async () => {
    await ownerState();
    writePlan(`${T1} ${T2_OLD} ${T3}`);
  });

  it("تسجيل بنبرة معروفة يبقى صالحًا حين تتغير نبرة الحلقة، ويُذكر «سُجّلت بنبرة …»", async () => {
    const sv = await import("../src/voice/sentenceVoice");
    writePlan(`${T1} ${T2_OLD} ${T3}`, "warm");
    const rows = (await sv.readSentences("986")).scenes[0]!.rows;
    await sv.sentenceAction("986", { action: "generate", id: rows[0]!.id }, { client: fakeClient([]), testOnlySkipApprovalGates: true });
    writePlan(`${T1} ${T2_OLD} ${T3}`, "calm");
    const after = (await sv.readSentences("986")).scenes[0]!.rows;
    expect(after[0]).toMatchObject({ status: "generated", recordedTone: "warm", inheritedTone: "calm" });
    // an explicit tone of the sentence itself that differs still needs generating
    const r = await sv.sentenceAction("986", { action: "tone", id: after[0]!.id, tone: "dramatic" });
    expect(r.read.scenes[0]!.rows[0]!.status).toBe("stale");
  });

  it("تسجيل بطبقة القناة: النبرة المكافئة لا تبطله، وغيرها يُعدّ قبل التطبيق بلا توليد ولا كتابة", async () => {
    const sv = await import("../src/voice/sentenceVoice");
    const before = readFileSync(path.join(EP(), "voice", "sentences.json"), "utf8");
    const planBefore = readFileSync(path.join(EP(), "plan.json"), "utf8");
    expect((await sv.readSentences("986")).scenes[0]!.rows.map((r) => r.status)).toEqual(["generated", "generated", "generated"]);
    // no tone: the same sound, nothing to regenerate; grave is no tone any more (first tones restored)
    expect((await sv.toneChangeImpact("986", null)).sentences).toEqual([]);
    await expect(sv.toneChangeImpact("986", "grave")).rejects.toThrow(/غير معروفة/);
    const calm = await sv.toneChangeImpact("986", "calm");
    expect(calm.sentences).toHaveLength(3);
    expect(calm.scenes).toEqual([]);
    expect(readFileSync(path.join(EP(), "voice", "sentences.json"), "utf8")).toBe(before);
    expect(readFileSync(path.join(EP(), "plan.json"), "utf8")).toBe(planBefore);
    await expect(sv.toneChangeImpact("986", "loud")).rejects.toThrow(/غير معروفة/);
  });
});
