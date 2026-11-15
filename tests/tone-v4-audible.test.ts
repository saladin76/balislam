/**
 * D136 — بلاغ المالك ١٤ نوفمبر (زبدة الكتب 001): «الصوت مسجل بنبرة مش حلوة وعاوز اغيرها ولما بعمل توليد مش بيغير الصوت».
 * والمالك ١٥ نوفمبر: «نبقى على eleven_v4».
 *
 * السبب: على eleven_v4 لا يصل من نبرات أول نسخة (D104، صُمّمت لـ multilingual v2) إلا الثبات: التعبير لا يُرسل (v4 بلا
 * Style ولا Speed في توثيق ElevenLabs)، والسرعة بعد التوليد، ولا أمر أداء، والبذرة ثابتة (٧)؛ وتغيير نبرة المشهد أو
 * الحلقة يُبقي التسجيل «حاليًا» بنبرته (D97) بلا أي إشارة. فيخرج التسجيل الجديد شبه نسخة من القديم.
 *
 * يثبت هذا الملف بمزوّد الصوت الوهمي (BAL_VOICE_PROVIDER=fake، لا مفتاح ولا شبكة) ما يُرسل لكل نبرة، وأن تغيير النبرة
 * يعطي طلبًا جديدًا وتسجيلًا جديدًا هو الذي يُسمع ويدخل صوت المشهد، وأن أمر الأداء لا يُنطق في الترجمة ولا يمر على القرآن.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Plan } from "../src/plan/types";
import type { FakeVoiceCall } from "../src/voice/fakeVoice";
import { heavyTimeout } from "./helpers/heavyTimeout";

const ENV = ["BAL_CHANNELS_DIR", "BAL_CHANNEL", "ELEVENLABS_MODEL_ID", "BAL_WORKFLOW_HMAC_KEY", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "BAL_VOICE_PROVIDER"] as const;
const saved: Record<string, string | undefined> = {};
let tmp = "";
const CHANNELS = ["zubdat-alkutub", "balislam", "dafatir-alzaman"] as const;
const S1 = "كَتَبَ الوَلَدُ الدَّرْسَ.";
const S2 = "ثُمَّ ذَهَبَ إِلَى البَيْتِ.";
const S3 = "وَهَذَا مَشْهَدٌ ثَانٍ.";
const EPISODE = "983";
const epDir = (ch: string) => path.join(tmp, ch, "episodes", "983-tone");
const calls: FakeVoiceCall[] = [];
const OPTS = { testOnlySkipApprovalGates: true } as const;
const speaks = () => calls.filter((c) => c.kind === "speak");
const docOf = (ch: string) => JSON.parse(readFileSync(path.join(epDir(ch), "voice", "sentences.json"), "utf8"));
const indexOf = (ch: string) => JSON.parse(readFileSync(path.join(epDir(ch), "voice", "index.json"), "utf8"));

const freshEpisode = (ch: string, tone = "calm") => {
  rmSync(epDir(ch), { recursive: true, force: true });
  mkdirSync(path.join(epDir(ch), "voice"), { recursive: true });
  writeFileSync(path.join(epDir(ch), "script.md"), `---\ntitle: "اختبار"\nepisode: "${EPISODE}"\n---\n## الفصل 1 · تجربة\n${S1} ${S2}\n\n${S3}\n`);
  const plan = { episode: EPISODE, title: "اختبار", tone, chapters: [{ number: 1, title: "تجربة", scenes: [
    { id: "c1-s1", template: "alley-tale", line: 6, narration: `${S1} ${S2}`, sfx: [], props: {} },
    { id: "c1-s2", template: "alley-tale", line: 8, narration: S3, sfx: [], props: {} },
  ] }] } as unknown as Plan;
  writeFileSync(path.join(epDir(ch), "plan.json"), JSON.stringify(plan, null, 2) + "\n");
  writeFileSync(path.join(epDir(ch), "tashkeel.md"), `${S1} ${S2}\n\n${S3}\n`);
};
const client = async () => (await import("../src/voice/elevenlabs")).elevenLabsFromEnv()!;

beforeAll(() => {
  for (const k of ENV) saved[k] = process.env[k];
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-tone-v4-"));
  for (const ch of CHANNELS)
    cpSync(path.join("channels", ch), path.join(tmp, ch), { recursive: true, filter: (s) => !/[\\/]episodes([\\/]|$)/.test(s) });
  process.env.BAL_CHANNELS_DIR = tmp;
  process.env.ELEVENLABS_MODEL_ID = "eleven_v4";
  process.env.BAL_VOICE_PROVIDER = "fake";
  process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__tone_v4_signing_key_2026";
  delete process.env.ELEVENLABS_API_KEY;
  delete process.env.ELEVENLABS_VOICE_ID;
  (globalThis as { __balFakeVoiceCalls?: FakeVoiceCall[] }).__balFakeVoiceCalls = calls;
});
afterAll(() => {
  vi.doUnmock("../src/voice/tones");
  delete (globalThis as { __balFakeVoiceCalls?: FakeVoiceCall[] }).__balFakeVoiceCalls;
  for (const k of ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});
beforeEach(() => { calls.length = 0; });

describe("D136: ما يدعمه eleven_v4 فعلًا لكل نبرة (دالة صافية)", () => {
  it("كل نبرة على v4: أمر أداء إنجليزي وثبات مختلف، بلا تعبير ولا سرعة في الطلب؛ وmultilingual v2 كما كان حرفًا", async () => {
    const { TONE_DELIVERY_V4, TONE_PRESETS_FIRST, toneIds, voiceSettingsFor, directsTones } = await import("../src/voice/tones");
    expect(directsTones("eleven_v4")).toBe(true);
    expect(directsTones("eleven_multilingual_v2")).toBe(false);
    const v4 = toneIds.map((t) => voiceSettingsFor(undefined, t, "eleven_v4")!);
    // six distinct deliveries: no two tones send the same direction, and the stabilities span a wide range
    expect(new Set(v4.map((v) => v.direction)).size).toBe(6);
    expect(Math.max(...v4.map((v) => v.stability)) - Math.min(...v4.map((v) => v.stability))).toBeGreaterThanOrEqual(0.3);
    for (const t of toneIds) {
      expect(TONE_DELIVERY_V4[t].direction).toMatch(/^[a-z ,]+$/);
      expect(TONE_DELIVERY_V4[t].stability).toBeLessThanOrEqual(0.55);
      expect(voiceSettingsFor(undefined, t, "eleven_multilingual_v2")).toEqual({ stability: TONE_PRESETS_FIRST[t].stability, style: TONE_PRESETS_FIRST[t].style, speed: TONE_PRESETS_FIRST[t].speed });
    }
  });

  it("أمر الأداء لا يطابق أي نمط من أنماط آثار الأدوات", async () => {
    const { findTraces } = await import("../src/package/traces");
    const { TONE_DELIVERY_V4 } = await import("../src/voice/tones");
    for (const d of Object.values(TONE_DELIVERY_V4)) expect(findTraces(d.direction)).toEqual([]);
  });
});

for (const ch of CHANNELS) {
  describe(`D136 على مزوّد الصوت الوهمي — ${ch}`, { timeout: heavyTimeout(20_000) }, () => {
    it("كل نبرة تُرسل أمرها وثباتها؛ الأمر أول النص بعد حارس القرآن، ولا يظهر في كلمات التسجيل ولا الترجمة", async () => {
      process.env.BAL_CHANNEL = ch;
      freshEpisode(ch);
      const sv = await import("../src/voice/sentenceVoice");
      const { TONE_DELIVERY_V4, toneIds } = await import("../src/voice/tones");
      const c = await client();
      const id = (await sv.sentenceAction(EPISODE, { action: "init", sceneId: "c1-s2" })).read.scenes[1]!.rows[0]!.id;
      for (const t of toneIds) {
        await sv.sentenceAction(EPISODE, { action: "tone", id, tone: t });
        await sv.sentenceAction(EPISODE, { action: "generate", id }, { client: c, ...OPTS });
      }
      const bodies = speaks().map((x) => x.body!);
      expect(bodies).toHaveLength(6);
      toneIds.forEach((t, i) => {
        expect(bodies[i]!.text).toBe(`[${TONE_DELIVERY_V4[t].direction}] ${S3}`);
        expect(bodies[i]!.voice_settings.stability).toBe(TONE_DELIVERY_V4[t].stability);
        expect(bodies[i]!.voice_settings.style).toBeUndefined();
        expect(bodies[i]!.voice_settings.speed).toBeUndefined();
        expect(bodies[i]!.model_id).toBe("eleven_v4");
      });
      const s = docOf(ch).scenes["c1-s2"].sentences[0];
      expect(s.audio.words.map((w: { word: string }) => w.word)).toEqual(S3.split(" "));
      expect(s.takes).toHaveLength(5);
      // the scene's audio (what the render reads) carries the sentence's words only
      const clip = indexOf(ch)["c1-s2"];
      expect(clip.words.map((w: { word: string }) => w.word).join(" ")).toBe(S3);
      for (const w of clip.words as { word: string }[]) expect(w.word).not.toMatch(/narration|\[|\]/);
    });

    it("تغيير النبرة: «النبرة تغيّرت — اضغط ولّد» قبل التوليد ولا طلب؛ ثم طلب جديد وتسجيل جديد يُسمع ويدخل صوت المشهد، و«قارن» بالقديم", async () => {
      process.env.BAL_CHANNEL = ch;
      freshEpisode(ch);
      const sv = await import("../src/voice/sentenceVoice");
      const c = await client();
      const id = (await sv.sentenceAction(EPISODE, { action: "init", sceneId: "c1-s2" })).read.scenes[1]!.rows[0]!.id;
      let r = await sv.sentenceAction(EPISODE, { action: "generate", id }, { client: c, ...OPTS });
      const first = r.read.scenes[1]!.rows[0]!;
      expect(first).toMatchObject({ status: "generated", takeTone: "calm", nextTone: "calm", toneChanged: false, wouldRepeat: true, previous: null });
      const sceneFile1 = indexOf(ch)["c1-s2"].file;
      // a new tone for the sentence: nothing is sent, the row says it
      r = await sv.sentenceAction(EPISODE, { action: "tone", id, tone: "dramatic" });
      expect(speaks()).toHaveLength(1);
      expect(r.read.scenes[1]!.rows[0]!).toMatchObject({ takeTone: "calm", nextTone: "dramatic", toneChanged: true, wouldRepeat: false });
      r = await sv.sentenceAction(EPISODE, { action: "generate", id }, { client: c, ...OPTS });
      expect(speaks()).toHaveLength(2);
      expect(speaks()[1]!.body!.text).toMatch(/^\[dramatic, intense narration\] /);
      const row = r.read.scenes[1]!.rows[0]!;
      expect(row).toMatchObject({ status: "generated", takeTone: "dramatic", toneChanged: false });
      expect(row.audio!.file).not.toBe(first.audio!.file);
      expect(row.previous).toMatchObject({ file: first.audio!.file, tone: "calm" });
      expect(r.composed?.composed).toBe(true);
      const sceneFile2 = indexOf(ch)["c1-s2"].file;
      expect(sceneFile2).not.toBe(sceneFile1);
      // «استعمل هذا التسجيل» on the old one: it is the take again (chosen), current, and the scene audio is made of it
      r = await sv.sentenceAction(EPISODE, { action: "use-take", id, file: first.audio!.file }, { client: c, ...OPTS });
      expect(r.read.scenes[1]!.rows[0]!).toMatchObject({ status: "generated", chosen: true, takeTone: "calm", nextTone: "dramatic" });
      expect(r.read.scenes[1]!.rows[0]!.audio!.file).toBe(first.audio!.file);
      expect(indexOf(ch)["c1-s2"].file).toBe(sceneFile1);
      expect(speaks()).toHaveLength(2);
      // nothing deleted: both takes on disk
      for (const f of [first.audio!.file, row.audio!.file]) expect(existsSync(path.join(epDir(ch), "voice", "sentences", f))).toBe(true);
      // a new tone choice clears the owner's pick: the sentence needs generating again
      r = await sv.sentenceAction(EPISODE, { action: "tone", id, tone: "warm" });
      expect(r.read.scenes[1]!.rows[0]!).toMatchObject({ status: "stale", chosen: false });
    });

    it("«ولّد» بلا تغيير: «لم يتغير شيء يُرسل — سيخرج تسجيل مشابه» ولا طلب؛ والتأكيد يولّد ببذرة أخرى محفوظة مع التسجيل", async () => {
      process.env.BAL_CHANNEL = ch;
      freshEpisode(ch);
      const sv = await import("../src/voice/sentenceVoice");
      const config = (await import("../config.json")).default;
      const c = await client();
      const id = (await sv.sentenceAction(EPISODE, { action: "init", sceneId: "c1-s2" })).read.scenes[1]!.rows[0]!.id;
      await sv.sentenceAction(EPISODE, { action: "generate", id }, { client: c, ...OPTS });
      expect(speaks()[0]!.body!.seed).toBe(config.voice.seed);
      expect(docOf(ch).scenes["c1-s2"].sentences[0].audio.seed).toBe(config.voice.seed);
      const ask = await sv.sentenceAction(EPISODE, { action: "generate", id }, { client: c, ...OPTS });
      expect(ask.confirm).toMatchObject({ kind: "same-send" });
      expect(ask.confirm!.message).toContain("لم يتغير شيء يُرسل — سيخرج تسجيل مشابه");
      expect(speaks()).toHaveLength(1);
      expect(docOf(ch).scenes["c1-s2"].sentences[0].takes ?? []).toHaveLength(0);
      await sv.sentenceAction(EPISODE, { action: "generate", id, confirmSame: true }, { client: c, ...OPTS });
      expect(speaks()).toHaveLength(2);
      const seed2 = speaks()[1]!.body!.seed!;
      expect(seed2).not.toBe(config.voice.seed);
      const doc = docOf(ch).scenes["c1-s2"].sentences[0];
      expect(doc.audio.seed).toBe(seed2);
      expect(doc.takes[0].seed).toBe(config.voice.seed);
      // the same request otherwise: the fingerprint and the sent text did not change, only the seed
      expect(speaks()[1]!.body!.text).toBe(speaks()[0]!.body!.text);
      expect(speaks()[1]!.body!.voice_settings).toEqual(speaks()[0]!.body!.voice_settings);
      // the scene-level «أعد توليد الصوت» asks too, and generates nothing before the confirmation
      const sc = await sv.regenerateSceneSentences(EPISODE, "c1-s2", { client: c, ...OPTS });
      expect(sc.confirm?.message).toContain("لم يتغير شيء يُرسل");
      expect(speaks()).toHaveLength(2);
      const ok = await sv.regenerateSceneSentences(EPISODE, "c1-s2", { client: c, confirmSame: true, ...OPTS });
      expect(ok.generated).toBe(1);
      expect(speaks()).toHaveLength(3);
    });
  });
}

describe("D136: نبرة المشهد كله أو الحلقة كلها بالعدد والرصيد قبل أي توليد", { timeout: heavyTimeout(20_000) }, () => {
  it("الأثر قبل التطبيق، ثم النبرة في الخطة وحدها، والجمل «النبرة تغيّرت» بلا طلب", async () => {
    const ch = "zubdat-alkutub";
    process.env.BAL_CHANNEL = ch;
    freshEpisode(ch);
    const sv = await import("../src/voice/sentenceVoice");
    const c = await client();
    const rows = (await sv.sentenceAction(EPISODE, { action: "init", sceneId: "c1-s1" })).read.scenes[0]!.rows;
    for (const r of rows) await sv.sentenceAction(EPISODE, { action: "generate", id: r.id }, { client: c, ...OPTS });
    await sv.sentenceAction(EPISODE, { action: "init", sceneId: "c1-s2" });
    calls.length = 0;
    const planBefore = readFileSync(path.join(epDir(ch), "plan.json"), "utf8");
    const imp = await sv.toneChangeImpact(EPISODE, "warm", { sceneId: "c1-s1" });
    expect(imp.regenerate).toMatchObject({ missing: 0 });
    expect(imp.regenerate!.ids.map((x) => x.sceneId)).toEqual(["c1-s1", "c1-s1"]);
    expect(imp.regenerate!.chars).toBe(rows.reduce((n, r) => n + r.chars, 0));
    expect(imp.regenerate!.credits).toBe(imp.regenerate!.chars);
    const all = await sv.toneChangeImpact(EPISODE, "warm");
    expect(all.regenerate).toMatchObject({ missing: 1 });
    expect(readFileSync(path.join(epDir(ch), "plan.json"), "utf8")).toBe(planBefore);
    const set = await sv.setToneScope(EPISODE, { sceneId: "c1-s1", tone: "warm" });
    expect(set.planChanged).toBe(true);
    const plan = JSON.parse(readFileSync(path.join(epDir(ch), "plan.json"), "utf8"));
    expect(plan.tone).toBe("calm");
    expect(plan.chapters[0].scenes[0].tone).toBe("warm");
    const changed = set.read.scenes[0]!.rows;
    expect(changed.map((r) => [r.status, r.takeTone, r.nextTone, r.toneChanged])).toEqual([["generated", "calm", "warm", true], ["generated", "calm", "warm", true]]);
    expect(speaks()).toHaveLength(0);
    // the episode tone the same way
    const ep = await sv.setToneScope(EPISODE, { sceneId: null, tone: "documentary" });
    expect(ep.planChanged).toBe(true);
    expect(JSON.parse(readFileSync(path.join(epDir(ch), "plan.json"), "utf8")).tone).toBe("documentary");
    expect(speaks()).toHaveLength(0);
    await expect(sv.setToneScope(EPISODE, { sceneId: "c1-s1", tone: "grave" })).rejects.toThrow(/غير معروفة/);
  });
});

describe("D136: ما وُلّد على v4 قبل أداء النبرات صالح «بنبرة سابقة»، ولا يُعاد شيء آليًا", { timeout: heavyTimeout(20_000) }, () => {
  it("تسجيل بأول نسخة بلا أمر (الإصدار ٣) حالي بإشارته، والأمر الصريح وحده يرسل الأداء", async () => {
    const ch = "zubdat-alkutub";
    process.env.BAL_CHANNEL = ch;
    freshEpisode(ch);
    vi.resetModules();
    vi.doMock("../src/voice/tones", async (orig) => {
      const actual = await orig<typeof import("../src/voice/tones")>();
      return { ...actual, TONE_PRESET_VERSION: 3, voiceSettingsFor: (_p: unknown, t?: import("../src/voice/tones").Tone) => actual.firstPlainSettings(t) };
    });
    {
      const sv = await import("../src/voice/sentenceVoice");
      const c = await client();
      const id = (await sv.sentenceAction(EPISODE, { action: "init", sceneId: "c1-s2" })).read.scenes[1]!.rows[0]!.id;
      await sv.sentenceAction(EPISODE, { action: "generate", id }, { client: c, ...OPTS });
      expect(speaks()[0]!.body!.text).toBe(S3);
    }
    vi.doUnmock("../src/voice/tones");
    vi.resetModules();
    calls.length = 0;
    const sv = await import("../src/voice/sentenceVoice");
    const tu = await import("../src/voice/toneUpgrade");
    const row = (await sv.readSentences(EPISODE)).scenes[1]!.rows[0]!;
    expect(row).toMatchObject({ status: "generated", olderTone: true });
    const plan = await tu.toneUpgradePlan(EPISODE);
    expect(plan.sentences.map((x) => x.id)).toEqual([row.id]);
    expect(speaks()).toHaveLength(0);
    await tu.upgradeTones(EPISODE, { client: await client(), testOnlySkipApprovalGates: true });
    expect(speaks()).toHaveLength(1);
    expect(speaks()[0]!.body!.text).toBe(`[calm, reflective narration] ${S3}`);
    expect((await sv.readSentences(EPISODE)).scenes[1]!.rows[0]!).toMatchObject({ olderTone: false, previous: { tone: "calm" } });
  });
});

describe("D136: خريطة النبرة وحارس القرآن كما هما", { timeout: heavyTimeout(20_000) }, () => {
  it("نبرة المشهد كله مرفوضة في حلقة بخريطة نبرة (تُغيَّر جملةً جملة في الخريطة)", async () => {
    const ch = "dafatir-alzaman";
    process.env.BAL_CHANNEL = ch;
    freshEpisode(ch);
    writeFileSync(path.join(epDir(ch), "tone-map.json"), JSON.stringify({ version: "v1.0", audioParts: [], segments: [] }));
    const sv = await import("../src/voice/sentenceVoice");
    await expect(sv.setToneScope(EPISODE, { sceneId: "c1-s1", tone: "warm" })).rejects.toThrow(/خريطة النبرة/);
  });
  it("نص قرآني لا يصل إلى المزوّد ولو مع أمر أداء", async () => {
    const { createVoiceClient } = await import("../src/voice/elevenlabs");
    const { fakeVoiceProvider } = await import("../src/voice/fakeVoice");
    const { voiceSettingsFor } = await import("../src/voice/tones");
    const el = createVoiceClient(fakeVoiceProvider(), { voiceId: "fake-test-voice", modelId: "eleven_v4" });
    await expect(el.tts("قال تعالى ﴿وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ﴾", { tune: voiceSettingsFor(undefined, "calm", "eleven_v4") })).rejects.toThrow();
    expect(speaks()).toHaveLength(0);
  });
});
