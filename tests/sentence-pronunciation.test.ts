/**
 * «النطق» مفتوح لكل جملة راوٍ في القنوات الثلاث (طلب صاحب المشروع ١٣ نوفمبر، D131): النص المرسل إلى الصوت بتشكيله
 * يُعدَّل للجملة كلها، ويُحفظ محتوى مالك (sentence-pronunciations.json بجوار السكريبت، D101)، ولا يغيّر نص الجملة ولا
 * نص المشهد ولا السكريبت ولا الترجمة. يجعل تسجيلها «تحتاج توليدًا» ولا يولّد شيئًا وحده. حارس القرآن والبسملة
 * وبوابة التشكيل ٩٨٪ كما هي، وصف الآية والبسملة بلا نطق يُعدَّل. لا مفاتيح ولا شبكة: عميل صوت مزيّف.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encodeWav } from "../src/remotion/dafatir/audio/compose";
import type { ElevenLabsClient } from "../src/voice/elevenlabs";
import type { Plan } from "../src/plan/types";
import { heavyTimeout } from "./helpers/heavyTimeout";
import { isOwnerContentPath } from "../scripts/contentPaths.mjs";

const ENV = ["BAL_CHANNELS_DIR", "BAL_CHANNEL", "ELEVENLABS_MODEL_ID", "BAL_WORKFLOW_HMAC_KEY", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"] as const;
const saved: Record<string, string | undefined> = {};
let tmp = "";
const SR = 44100;
const CHANNELS = ["balislam", "dafatir-alzaman", "zubdat-alkutub"] as const;

const S1A = "كَتَبَ الوَلَدُ الدَّرْسَ.";
const S1B = "ثُمَّ ذَهَبَ إِلَى البَيْتِ؟";
const BASMALA = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";
const S3 = "وَنَبْدَأُ الآنَ.";
const VERSE = "وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ";
const EPISODE = "985";
const epDir = (ch: string) => path.join(tmp, ch, "episodes", "985-say");
const SAY_FILE = (ch: string) => path.join(epDir(ch), "sentence-pronunciations.json");

const plan = (): Plan => ({
  episode: EPISODE, title: "اختبار", tone: "calm",
  chapters: [{ number: 1, title: "تجربة", scenes: [
    { id: "c1-s1", template: "alley-tale", line: 6, narration: `${S1A} ${S1B}`, sfx: [], props: {} },
    { id: "c1-s2", template: "verse-card", line: 8, narration: "", ayahKey: "53:39", sfx: [], props: { text: VERSE, reference: "النجم · ٣٩" } },
    { id: "c1-s3", template: "alley-tale", line: 10, narration: `${BASMALA} ${S3}`, sfx: [], props: {} },
  ] }],
} as unknown as Plan);

const freshEpisode = (ch: string) => {
  rmSync(epDir(ch), { recursive: true, force: true });
  mkdirSync(path.join(epDir(ch), "voice"), { recursive: true });
  writeFileSync(path.join(epDir(ch), "script.md"), `---\ntitle: "اختبار"\nepisode: "${EPISODE}"\n---\n## الفصل 1 · تجربة\n${S1A} ${S1B}\n\n${BASMALA} ${S3}\n`);
  writeFileSync(path.join(epDir(ch), "plan.json"), JSON.stringify(plan(), null, 2) + "\n");
  writeFileSync(path.join(epDir(ch), "tashkeel.md"), `${S1A} ${S1B}\n\n${S3}\n`);
};

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
const fakeClient = (sent: string[]) => ({
  modelId: "mock",
  tts: async (text: string) => {
    sent.push(text);
    const t = tone(text);
    return { audio: t.wav, alignment: t.alignment, model: "mock" };
  },
  soundEffect: async () => Buffer.alloc(0), account: async () => ({}) as never, voices: async () => [],
}) as unknown as ElevenLabsClient;
const OPTS = { testOnlySkipApprovalGates: true } as const;
const read = (f: string) => readFileSync(f, "utf8");

beforeAll(() => {
  for (const k of ENV) saved[k] = process.env[k];
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-say-"));
  for (const ch of CHANNELS)
    cpSync(path.join("channels", ch), path.join(tmp, ch), { recursive: true, filter: (s) => !/[\\/]episodes([\\/]|$)/.test(s) });
  process.env.BAL_CHANNELS_DIR = tmp;
  process.env.ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
  process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__sentence_say_signing_key_2026";
  delete process.env.ELEVENLABS_API_KEY;
});
afterAll(() => {
  for (const k of ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

describe("D131: فحص النطق المكتوب (دالة صافية)", () => {
  it("حارس القرآن نفسه: ﴿ ﴾ والبسملة وخمس كلمات من آية الحلقة بلا أقواس تُرفض، والتشكيل ≥ ٩٨٪", async () => {
    const { checkSentenceSay } = await import("../src/voice/sentencePronunciation");
    expect(checkSentenceSay("﴿وَأَنْ لَيْسَ لِلْإِنْسَانِ﴾")).toMatch(/آية/);
    expect(checkSentenceSay(`كَتَبَ ${BASMALA}`)).toMatch(/البسملة/);
    expect(checkSentenceSay(VERSE, [VERSE])).toMatch(/آية/);
    expect(checkSentenceSay("كتب الولد الدرس.")).toMatch(/التشكيل/);
    expect(checkSentenceSay("كَتَبَ الوَلَدُ دَرْسَهُ.", [VERSE])).toBeNull();
  });
});

describe("D131: ملف النطق محتوى مالك يُحفظ في main (D101)", () => {
  it("sentence-pronunciations.json بجوار السكريبت يُرفع، ولا شيء تحت voice/", () => {
    expect(isOwnerContentPath("channels/balislam/episodes/001-know-the-truth/sentence-pronunciations.json")).toBe(true);
    expect(isOwnerContentPath("channels/zubdat-alkutub/episodes/001-x/sentence-pronunciations.json")).toBe(true);
    expect(isOwnerContentPath("channels/balislam/episodes/001-x/voice/sentence-pronunciations.json")).toBe(false);
  });
});

for (const ch of CHANNELS) {
  describe(`D131 «النطق» مفتوح لكل جملة — ${ch}`, { timeout: heavyTimeout(8_000) }, () => {
    it("كل جملة راوٍ تعرض نطقها الآلي للتعديل، وصف البسملة والآية بلا نطق يُعدَّل", async () => {
      process.env.BAL_CHANNEL = ch;
      freshEpisode(ch);
      const sv = await import("../src/voice/sentenceVoice");
      const r = await sv.readSentences(EPISODE);
      const rows = r.scenes.flatMap((s) => s.rows);
      const narr = rows.filter((x) => x.kind === "narration");
      expect(narr.length).toBe(3);
      for (const x of narr) {
        expect(x.say).toEqual({ auto: x.spoken, custom: null });
        expect(x.spoken.length).toBeGreaterThan(0);
      }
      // the line is there even when the spoken text equals the written text (fully voweled script)
      expect(narr[0]!.spoken).toBe(S1A);
      const basmala = rows.find((x) => x.kind === "basmala")!;
      expect(basmala.say).toBeNull();
      expect(r.scenes.find((s) => s.id === "c1-s2")!.verse).not.toBeNull();
    });

    it("حفظ النطق: يُرسل كما كُتب، ولا يغيّر النص ولا الخطة ولا السكريبت ولا الترجمة، ويجعل التسجيل «تحتاج توليدًا» بلا توليد", async () => {
      process.env.BAL_CHANNEL = ch;
      freshEpisode(ch);
      const sv = await import("../src/voice/sentenceVoice");
      const sent: string[] = [];
      const client = fakeClient(sent);
      const r0 = await sv.readSentences(EPISODE);
      const first = r0.scenes[0]!.rows[0]!;
      // generate the automatic pronunciation first: a current take
      let r = await sv.sentenceAction(EPISODE, { action: "generate", id: first.id }, { client, ...OPTS });
      const id = r.read.scenes[0]!.rows[0]!.id;
      expect(r.read.scenes[0]!.rows[0]!.status).toBe("generated");
      expect(sent).toEqual([S1A]);
      const planBefore = read(path.join(epDir(ch), "plan.json"));
      const scriptBefore = read(path.join(epDir(ch), "script.md"));
      const say = "كَتَبَ الوَلَدُ الصَّغِيرُ دَرْسَهُ.";
      r = await sv.sentenceAction(EPISODE, { action: "say", id, pronunciation: say }, { client, ...OPTS });
      const row = r.read.scenes[0]!.rows[0]!;
      expect(row.text).toBe(S1A);
      expect(row.spoken).toBe(say);
      expect(row.say).toEqual({ auto: S1A, custom: say });
      expect(row.status).toBe("stale");
      expect(r.planChanged).toBe(false);
      expect(r.composed?.composed ?? false).toBe(false);
      expect(sent).toEqual([S1A]); // nothing was generated by saving
      expect(read(path.join(epDir(ch), "plan.json"))).toBe(planBefore);
      expect(read(path.join(epDir(ch), "script.md"))).toBe(scriptBefore);
      const file = JSON.parse(read(SAY_FILE(ch)));
      expect(file.entries).toEqual([expect.objectContaining({ scene: "c1-s1", text: S1A, say })]);
      // «ولّد الجملة» sends exactly that pronunciation; the captions keep the written words
      r = await sv.sentenceAction(EPISODE, { action: "generate", id }, { client, ...OPTS });
      expect(sent).toEqual([S1A, say]);
      const doc = JSON.parse(read(path.join(epDir(ch), "voice", "sentences.json")));
      const s = doc.scenes["c1-s1"].sentences.find((x: { id: string }) => x.id === id);
      expect(s.text).toBe(S1A);
      expect(s.audio.words.map((w: { word: string }) => w.word)).toEqual(S1A.split(" "));
      expect(s.takes.length).toBe(1); // the earlier paid take is kept
      expect(r.read.scenes[0]!.rows[0]!.status).toBe("generated");
      // back to the automatic pronunciation: the entry is removed; the take recorded with the custom text needs generating again
      r = await sv.sentenceAction(EPISODE, { action: "say", id, pronunciation: null }, { client, ...OPTS });
      expect(r.read.scenes[0]!.rows[0]!.say).toEqual({ auto: S1A, custom: null });
      expect(r.read.scenes[0]!.rows[0]!.status).toBe("stale");
      expect(JSON.parse(read(SAY_FILE(ch))).entries).toEqual([]);
      expect(sent.length).toBe(2);
    });

    it("الحراس: القرآن والبسملة وآية الحلقة والتشكيل ناقصًا تُرفض، وصف البسملة لا نطق له؛ ولا يُكتب شيء", async () => {
      process.env.BAL_CHANNEL = ch;
      freshEpisode(ch);
      const sv = await import("../src/voice/sentenceVoice");
      const r0 = await sv.readSentences(EPISODE);
      const first = r0.scenes[0]!.rows[0]!;
      const bad = [
        ["﴿وَأَنْ لَيْسَ لِلْإِنْسَانِ﴾", /آية|القرآن/],
        [`${BASMALA} كَتَبَ`, /البسملة/],
        ["كتب الولد الدرس.", /التشكيل/],
        ["", /اكتب/],
      ] as const;
      for (const [p, re] of bad)
        await expect(sv.sentenceAction(EPISODE, { action: "say", id: first.id, pronunciation: p })).rejects.toThrow(re);
      const basmala = r0.scenes.find((s) => s.id === "c1-s3")!.rows.find((x) => x.kind === "basmala")!;
      await expect(sv.sentenceAction(EPISODE, { action: "say", id: basmala.id, pronunciation: "كَتَبَ" })).rejects.toThrow(/البسملة/);
      expect(existsSync(SAY_FILE(ch))).toBe(false);
    });

    it("إعادة نطق كلمة لا تعمل على جملة نطقها مكتوب كاملًا: تقول أين يُعدَّل", async () => {
      process.env.BAL_CHANNEL = ch;
      freshEpisode(ch);
      const sv = await import("../src/voice/sentenceVoice");
      const sent: string[] = [];
      const client = fakeClient(sent);
      const first = (await sv.readSentences(EPISODE)).scenes[0]!.rows[0]!;
      let r = await sv.sentenceAction(EPISODE, { action: "say", id: first.id, pronunciation: "كَتَبَ الوَلَدُ دَرْسَهُ." });
      const id = r.read.scenes[0]!.rows[0]!.id;
      r = await sv.sentenceAction(EPISODE, { action: "generate", id }, { client, ...OPTS });
      const row = r.read.scenes[0]!.rows[0]!;
      expect(row.wordFix.ok).toBe(false);
      expect(row.wordFix.reason).toMatch(/«النطق»/);
      await expect(sv.sentenceAction(EPISODE, { action: "fixword", id, word: 0, say: "كَتَّبَ" }, { client, ...OPTS })).rejects.toThrow(/«النطق»/);
      expect(sent.length).toBe(1);
    });
  });
}
