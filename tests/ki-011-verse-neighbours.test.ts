/**
 * KI-011 (D113): تمهيد الآية «كَمَا جَاءَ فِي سُورَةِ طَهَ:» كان يُرسل للتوليد ونصه التالي (next_text) «وَكَمَا جَاءَ
 * فِي سُورَةِ الْمُؤْمِنُونَ:» — تمهيد الآية التالية بعد أن تخطى النص المجاور الآية نفسها (زبدة الكتب 001، المشهد ١٣)،
 * فقد يُقرأ التمهيد كأنه يقود إلى تمهيد آخر. الآية حدّ: لا يعبرها النص المجاور، لا مشهد آية ولا آية داخل الجملة.
 * عميل مزيّف بلا مفاتيح ولا شبكة.
 */
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encodeWav } from "../src/remotion/dafatir/audio/compose";
import type { ElevenLabsClient } from "../src/voice/elevenlabs";
import type { Plan } from "../src/plan/types";

const ENV = ["BAL_CHANNELS_DIR", "BAL_CHANNEL", "ELEVENLABS_MODEL_ID", "BAL_WORKFLOW_HMAC_KEY", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"] as const;
const saved: Record<string, string | undefined> = {};
let tmp = "";
const SR = 44100;

const A = "نَبْدَأُ الْحِكَايَةَ هُنَا.";
const TAHA = "كَمَا جَاءَ فِي سُورَةِ طَهَ:";
const MUMINUN = "وَكَمَا جَاءَ فِي سُورَةِ الْمُؤْمِنُونَ:";
const SAYS = "قَالَ تَعَالَى:";
const INLINE = "﴿قَدْ أَفْلَحَ الْمُؤْمِنُونَ﴾.";
const AFTER = "ثُمَّ نُكْمِلُ الْحَدِيثَ.";
const EP_DIR = () => path.join(tmp, "balislam", "episodes", "986-verse-neighbours");

const plan = (): Plan => ({
  episode: "986", title: "اختبار", tone: "calm",
  chapters: [{ number: 1, title: "تجربة", scenes: [
    { id: "c1-s1", template: "alley-tale", line: 6, narration: `${A} ${TAHA}`, sfx: [], props: {} },
    { id: "c1-s2", template: "verse-card", line: 8, narration: "", ayahKey: "20:14", sfx: [], props: { text: "", reference: "طه · ١٤" } },
    { id: "c1-s3", template: "alley-tale", line: 10, narration: MUMINUN, sfx: [], props: {} },
    { id: "c1-s4", template: "verse-card", line: 12, narration: "", ayahKey: "23:1", sfx: [], props: { text: "", reference: "المؤمنون · ١" } },
    { id: "c1-s5", template: "alley-tale", line: 14, narration: `${SAYS} ${INLINE} ${AFTER}`, sfx: [], props: {} },
  ] }],
} as unknown as Plan);

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
type Sent = { text: string; previousText?: string; nextText?: string };
const fakeClient = (sent: Sent[]) => ({
  modelId: "mock",
  tts: async (text: string, ctx: { previousText?: string; nextText?: string } = {}) => {
    sent.push({ text, previousText: ctx.previousText, nextText: ctx.nextText });
    const t = tone(text);
    return { audio: t.wav, alignment: t.alignment, model: "mock" };
  },
  soundEffect: async () => Buffer.alloc(0), account: async () => ({}) as never, voices: async () => [],
}) as unknown as ElevenLabsClient;

beforeAll(() => {
  for (const k of ENV) saved[k] = process.env[k];
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-verse-nb-"));
  cpSync(path.join("channels", "balislam"), path.join(tmp, "balislam"), { recursive: true, filter: (s) => !/[\\/]episodes([\\/]|$)/.test(s) });
  process.env.BAL_CHANNELS_DIR = tmp;
  process.env.BAL_CHANNEL = "balislam";
  process.env.ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
  process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__verse_neighbours_signing_key_2026";
  delete process.env.ELEVENLABS_API_KEY;
  mkdirSync(path.join(EP_DIR(), "voice"), { recursive: true });
  writeFileSync(path.join(EP_DIR(), "script.md"), `---\ntitle: "اختبار"\nepisode: "986"\n---\n## الفصل 1 · تجربة\n${A} ${TAHA}\n\n${MUMINUN}\n\n${SAYS} ${INLINE} ${AFTER}\n`);
  writeFileSync(path.join(EP_DIR(), "plan.json"), JSON.stringify(plan(), null, 2) + "\n");
  writeFileSync(path.join(EP_DIR(), "tashkeel.md"), `${A} ${TAHA}\n\n${MUMINUN}\n\n${SAYS} ${AFTER}\n`);
});
afterAll(() => {
  for (const k of ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

const generate = async (sceneId: string, text: string) => {
  const sv = await import("../src/voice/sentenceVoice");
  const init = await sv.sentenceAction("986", { action: "init", sceneId });
  const row = init.read.scenes.find((s) => s.id === sceneId)!.rows.find((r) => r.text === text)!;
  const sent: Sent[] = [];
  await sv.sentenceAction("986", { action: "generate", id: row.id }, { client: fakeClient(sent), testOnlySkipApprovalGates: true });
  expect(sent).toHaveLength(1);
  return sent[0]!;
};

describe("KI-011: النص المجاور لا يعبر الآية", () => {
  it("تمهيد آية قبل مشهد الآية: لا نص تالٍ (لا تمهيد الآية التالية)", async () => {
    const s = await generate("c1-s1", TAHA);
    expect(s.previousText).toBe(A);
    expect(s.nextText).toBeUndefined();
  });
  it("التمهيد بعد مشهد آية: لا نص سابق من قبل الآية", async () => {
    const s = await generate("c1-s3", MUMINUN);
    expect(s.previousText).toBeUndefined();
    expect(s.nextText).toBeUndefined();
  });
  it("آية داخل الجملة حدّ أيضًا: «قال تعالى:» بلا ما بعد الآية، وما بعدها بلا ما قبلها", async () => {
    const a = await generate("c1-s5", SAYS);
    expect(a.nextText).toBeUndefined();
    const b = await generate("c1-s5", AFTER);
    expect(b.previousText).toBeUndefined();
  });
  it("الجارة العادية بلا آية بينهما تبقى كما هي", async () => {
    const s = await generate("c1-s1", A);
    expect(s.nextText).toBe(TAHA);
  });
});
