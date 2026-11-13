/**
 * أول نسخة من النبرات مُستعادة (أمر صاحب القناة ١٢ نوفمبر: «النبرات الموجودة بالكامل يجب حذفها تمامًا واسترجع أول نسخة»).
 * - النبرات = commit 2d8bee52 (٣١ أكتوبر) حرفًا: ست نبرات، وقيمة النبرة هي إعداد الصوت نفسه فوق config.voice،
 *   بلا طبقة قناة ولا أمر أداء ولا مدى قوي ولا توقير، والإصدار الحالي ٣.
 * - الإصداران السابقان (١ طبقة القناة، ٢ القوي) للبصمة وحدها: ما وُلّد بهما صالح «بنبرة سابقة»، لا يُعاد بالقراءة
 *   ولا «جهّز» ولا «ولّد الصوت»، ويُعاد بالأمر الصريح «أعد توليد ما وُلّد بنبرة سابقة» بإعدادات أول نسخة
 *   (عميل ElevenLabs مزيّف: لا شبكة ولا رصيد). المعرّف grave لم يعد نبرة، ويُعرف به التسجيل القديم وحده.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { encodeWav } from "../src/remotion/dafatir/audio/compose";
import type { Plan } from "../src/plan/types";
import type { VoiceProfile } from "../src/channel/types";
import {
  allToneIds, effectiveLegacyTone, isSupersededVersion, isTone, layeredVoiceSettingsV1, legacyTunes, layersOf, strongVoiceSettingsV2,
  TONE_PRESET_VERSION, TONE_PRESETS_FIRST, toneIds, tones, voiceSettingsFor, type Tone,
} from "../src/voice/tones";
import { panelSource } from "./helpers/panelSource";

const CHANNELS = ["balislam", "dafatir-alzaman", "zubdat-alkutub"] as const;
const channelJson = (ch: string) => JSON.parse(readFileSync(path.join("channels", ch, "channel.json"), "utf8"));
const FIRST_IDS: Tone[] = ["calm", "warm", "documentary", "dramatic", "energetic", "intimate"];

/** The very first tones in the studio (git 2d8bee52, 31 Oct 2026), verbatim. */
const FIRST: Record<string, { nameAr: string; useAr: string; stability: number; style: number; speed: number }> = {
  calm: { nameAr: "هادئ تأملي", useAr: "الحلقات الإيمانية والتأمل", stability: 0.65, style: 0.05, speed: 0.95 },
  warm: { nameAr: "حكّاء دافئ", useAr: "القصص والحياة اليومية", stability: 0.45, style: 0.25, speed: 1.0 },
  documentary: { nameAr: "وثائقي رصين", useAr: "التاريخ والمعلومات", stability: 0.6, style: 0.15, speed: 0.98 },
  dramatic: { nameAr: "درامي", useAr: "لحظات الذروة والمعارك والقرارات", stability: 0.3, style: 0.5, speed: 0.96 },
  energetic: { nameAr: "حماسي", useAr: "الخطافات والشورتس والدعوة للاشتراك", stability: 0.35, style: 0.4, speed: 1.08 },
  intimate: { nameAr: "قريب وهامس", useAr: "الأسئلة الشخصية والمواقف المؤثرة", stability: 0.55, style: 0.3, speed: 0.92 },
};
/** The channel layers of tones version 1 (3 Nov and D79), kept for fingerprints only. */
const V1_PROFILES: Record<string, VoiceProfile> = {
  balislam: { nameAr: "وقور هادئ", speed: 0.9, stability: 0.6, style: 0.08, direction: "calm, dignified, reflective narration" },
  "dafatir-alzaman": { nameAr: "راوٍ وثائقي", speed: 0.95, stability: 0.5, style: 0.22, direction: "documentary storyteller narrating history" },
  "zubdat-alkutub": { nameAr: "سريع واضح", speed: 1.02, stability: 0.45, style: 0.28, direction: "clear, lively explainer" },
};
const STRONG_PROFILES: Record<string, VoiceProfile> = {
  balislam: { nameAr: "وقور رزين", speed: 1, stability: 0.5, style: 0.04, direction: "grave, dignified and authoritative narration; firm, clear projection" },
  "dafatir-alzaman": { nameAr: "راوٍ وثائقي حازم", speed: 1, stability: 0.5, style: 0.06, direction: "commanding documentary storyteller narrating history; firm and grave" },
  "zubdat-alkutub": { nameAr: "واضح حازم", speed: 1, stability: 0.48, style: 0.08, direction: "clear, confident and authoritative explainer; firm, not rushed" },
};

describe("أول نسخة من النبرات (2d8bee52) حرفًا", () => {
  it("النبرات الست بأسمائها وقيمها، بلا أمر أداء، والإصدار الحالي ٣", () => {
    expect(TONE_PRESET_VERSION).toBe(3);
    expect(toneIds).toEqual(FIRST_IDS);
    expect(allToneIds).toEqual(FIRST_IDS);
    for (const t of FIRST_IDS) {
      expect(tones[t]).toEqual(FIRST[t]);
      expect(TONE_PRESETS_FIRST[t]).toEqual(FIRST[t]);
      expect(voiceSettingsFor(undefined, t)).toEqual({ stability: FIRST[t]!.stability, style: FIRST[t]!.style, speed: FIRST[t]!.speed });
    }
    // the first source, byte for byte, for the six presets: the file as it was at 2d8bee52, pinned in tests/fixtures
    // (its Git blob id is checked in tests/ki-030-no-git-history.test.ts), so a shallow clone runs this too (KI-030)
    const first = readFileSync("tests/fixtures/tones-first-version/tones.2d8bee52.ts.txt", "utf8");
    const now = readFileSync("src/voice/tones.ts", "utf8");
    for (const line of first.split("\n").filter((l) => /^  (calm|warm|documentary|dramatic|energetic|intimate): \{/.test(l))) expect(now).toContain(line);
  });

  it("لا طبقة قناة تحت النبرة ولا نبرة افتراضية للقنوات؛ الطبقات القديمة للبصمة وحدها", () => {
    for (const ch of CHANNELS) {
      const v = channelJson(ch).voice;
      expect(v.profile).toBeUndefined();
      expect("tone" in v).toBe(false);
      expect(v.profileHistory).toEqual({ "1": V1_PROFILES[ch], "2": STRONG_PROFILES[ch] });
      expect(v.toneHistory).toEqual({ "2": "grave" });
      for (const t of [undefined, ...FIRST_IDS]) expect(voiceSettingsFor(V1_PROFILES[ch], t)).toEqual(voiceSettingsFor(undefined, t));
    }
    expect(voiceSettingsFor()).toBeUndefined();
  });

  it("grave لم يعد نبرة، ويُعرف به التسجيل القديم وحده", () => {
    expect(isTone("grave")).toBe(false);
    expect(allToneIds as string[]).not.toContain("grave");
    expect(voiceSettingsFor(undefined, "grave" as Tone)).toBeUndefined();
    expect(effectiveLegacyTone("grave", "calm")).toBe("grave");
    expect(effectiveLegacyTone(undefined, "loud", "warm")).toBe("warm");
  });

  it("الإصداران السابقان محفوظان حرفًا للبصمة وحدها", () => {
    const L = layersOf(channelJson("balislam").voice);
    const [v1, v2] = legacyTunes(L, "calm");
    expect(v1).toEqual({ version: 1, tune: { stability: 0.75, style: 0.13, speed: 0.86, direction: "calm, reflective" } });
    expect(v1!.tune).toEqual(layeredVoiceSettingsV1(V1_PROFILES.balislam, "calm"));
    expect(v2!.version).toBe(2);
    expect(v2!.tune).toEqual(strongVoiceSettingsV2(STRONG_PROFILES.balislam, "calm"));
    // grave in v1 = the channel layer alone
    expect(legacyTunes(L, "grave")[0]!.tune).toEqual(layeredVoiceSettingsV1(V1_PROFILES.balislam));
    expect(isSupersededVersion(undefined)).toBe(true);
    expect(isSupersededVersion(1)).toBe(true);
    expect(isSupersededVersion(2)).toBe(true);
    expect(isSupersededVersion(3)).toBe(false);
  });
});

// ── ما وُلّد بنبرة سابقة صالح، ولا طلب مدفوع إلا بالأمر الصريح الذي يرسل إعدادات أول نسخة ─────────────

const ENV = ["BAL_CHANNELS_DIR", "BAL_CHANNEL", "ELEVENLABS_MODEL_ID", "BAL_WORKFLOW_HMAC_KEY", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"] as const;
const saved: Record<string, string | undefined> = {};
let tmp = "";
const SR = 44100;
const S1A = "كَتَبَ الوَلَدُ الدَّرْسَ.";
const S1B = "ثُمَّ ذَهَبَ إِلَى البَيْتِ؟";
const S2 = "وَهَذَا مَشْهَدٌ ثَانٍ.";
const EP_DIR = () => path.join(tmp, "balislam", "episodes", "986-strong");
/** the second scene's text (sent with its tashkeel) */
const isS2 = (t: string) => t.replace(/[\u064B-\u0652]/g, "").includes("مشهد");
const CH_FILE = () => path.join(tmp, "balislam", "channel.json");

const writeEpisode = () => {
  rmSync(EP_DIR(), { recursive: true, force: true });
  mkdirSync(path.join(EP_DIR(), "voice"), { recursive: true });
  writeFileSync(path.join(EP_DIR(), "script.md"), `---\ntitle: "اختبار"\nepisode: "986"\n---\n## الفصل 1 · تجربة\n${S1A} ${S1B}\n\n${S2}\n`);
  const plan = { episode: "986", title: "اختبار", tone: "calm", chapters: [{ number: 1, title: "تجربة", scenes: [
    { id: "c1-s1", template: "alley-tale", line: 6, narration: `${S1A} ${S1B}`, sfx: [], props: {} },
    { id: "c1-s2", template: "alley-tale", line: 8, narration: S2, sfx: [], props: {} },
  ] }] } as unknown as Plan;
  writeFileSync(path.join(EP_DIR(), "plan.json"), JSON.stringify(plan, null, 2) + "\n");
  writeFileSync(path.join(EP_DIR(), "tashkeel.md"), `${S1A} ${S1B}\n\n${S2}\n`);
};

/** A fake ElevenLabs HTTP endpoint: records every request body (voice_settings) and answers WAV + timings. */
type Body = { text: string; model_id: string; voice_settings: { stability: number; style?: number; speed?: number; similarity_boost: number; use_speaker_boost: boolean } };
const bodies: Body[] = [];
const fakeFetch = (async (_url: string, init: { body: string }) => {
  const body = JSON.parse(init.body) as Body;
  bodies.push(body);
  const chars = [...body.text];
  const lead = 0.25, step = 0.05, n = Math.round((lead + chars.length * step + 0.4) * SR);
  const s = new Float32Array(n);
  chars.forEach((c, i) => {
    if (/\s/.test(c)) return;
    for (let k = Math.round((lead + i * step) * SR); k < Math.round((lead + (i + 1) * step) * SR); k++) s[k] = Math.sin(2 * Math.PI * 160 * k / SR) * 0.3;
  });
  for (let k = 0; k < n; k++) if (!s[k]) s[k] = 0.0002 * Math.sin(k);
  const alignment = { characters: chars, character_start_times_seconds: chars.map((_, i) => lead + i * step), character_end_times_seconds: chars.map((_, i) => lead + (i + 1) * step) };
  return new Response(JSON.stringify({ audio_base64: Buffer.from(encodeWav(s, SR)).toString("base64"), alignment }), { status: 200, headers: { "content-type": "application/json" } });
}) as unknown as typeof fetch;

const client = async () => {
  const { createElevenLabs } = await import("../src/voice/elevenlabs");
  return createElevenLabs({ apiKey: "test-key", voiceId: "voice-test", modelId: "eleven_multilingual_v2", fetchImpl: fakeFetch });
};

beforeAll(() => {
  for (const k of ENV) saved[k] = process.env[k];
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-tones-first-"));
  cpSync(path.join("channels", "balislam"), path.join(tmp, "balislam"), { recursive: true, filter: (s) => !/[\\/]episodes([\\/]|$)/.test(s) });
  process.env.BAL_CHANNELS_DIR = tmp;
  process.env.BAL_CHANNEL = "balislam";
  process.env.ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
  process.env.ELEVENLABS_VOICE_ID = "voice-test";
  process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__strong_voice_signing_key_2026";
  delete process.env.ELEVENLABS_API_KEY;
  writeEpisode();
});
afterAll(() => {
  vi.doUnmock("../src/voice/tones");
  for (const k of ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

describe("استعادة أول نسخة لا تعيد توليد شيء آليًا", { timeout: 60_000 }, () => {
  it("ما وُلّد بطبقة القناة (الإصدار ١) صالح بإشارته، ولا صرف بالقراءة أو التوليد، والأمر الصريح يرسل أول نسخة", async () => {
    const current = readFileSync(CH_FILE(), "utf8");
    // 1) Yesterday (D79): the layered channel.json and the layered presets (version 1).
    const ch = JSON.parse(current);
    const { profileHistory: h, ...rest } = ch.voice;
    writeFileSync(CH_FILE(), JSON.stringify({ ...ch, voice: { ...rest, profile: h["1"], profileHistory: { "2": h["2"] } } }, null, 2) + "\n");
    vi.resetModules();
    vi.doMock("../src/voice/tones", async (orig) => {
      const actual = await orig<typeof import("../src/voice/tones")>();
      return { ...actual, TONE_PRESET_VERSION: 1, legacyTunes: () => [], isSupersededVersion: (v?: number) => (v ?? 1) !== 1,
        voiceSettingsFor: (p: VoiceProfile | undefined, t?: Tone) => actual.layeredVoiceSettingsV1(p, t) };
    });
    {
      const sv = await import("../src/voice/sentenceVoice");
      const { generateVoice } = await import("../src/voice/generate");
      const c = await client();
      const init = await sv.sentenceAction("986", { action: "init", sceneId: "c1-s1" });
      for (const row of init.read.scenes.find((x) => x.id === "c1-s1")!.rows)
        await sv.sentenceAction("986", { action: "generate", id: row.id }, { client: c, testOnlySkipApprovalGates: true });
      await generateVoice("986", { client: c, testOnlySkipGates: true });
      expect(bodies).toHaveLength(3);
      for (const b of bodies) expect(b.voice_settings.stability).toBe(layeredVoiceSettingsV1(V1_PROFILES.balislam, "calm")!.stability);
    }
    // 2) Today: the first tones and the migrated channel.json. Nothing is regenerated by reading, preparing or «ولّد الصوت».
    writeFileSync(CH_FILE(), current);
    vi.doUnmock("../src/voice/tones");
    vi.resetModules();
    bodies.length = 0;
    const sv = await import("../src/voice/sentenceVoice");
    const { generateVoice } = await import("../src/voice/generate");
    const tu = await import("../src/voice/toneUpgrade");
    const c = await client();
    const read = await sv.readSentences("986");
    const s1 = read.scenes.find((x) => x.id === "c1-s1")!;
    expect(s1.rows.map((r) => [r.status, r.olderTone])).toEqual([["generated", true], ["generated", true]]);
    expect(read.scenes.find((x) => x.id === "c1-s2")!.olderTone).toBe(true);
    const dry = await generateVoice("986", { dryRun: true });
    expect(dry.toGenerate).toEqual([]);
    expect(dry.olderTone.scenes).toEqual(["c1-s2"]);
    await generateVoice("986", { client: c, testOnlySkipGates: true });
    await sv.prepareBasmalaScenes("986", { client: c });
    expect(bodies).toHaveLength(0);

    // 3) The explicit owner action: count and credit first, then the first-version settings are sent, without a direction.
    const plan = await tu.toneUpgradePlan("986");
    expect(bodies).toHaveLength(0);
    expect(plan.scenes).toEqual(["c1-s1", "c1-s2"]);
    expect(plan.credits).toBeGreaterThan(0);
    const before = JSON.parse(readFileSync(path.join(EP_DIR(), "voice", "sentences.json"), "utf8"));
    const res = await tu.upgradeTones("986", { client: c, testOnlySkipApprovalGates: true });
    expect(res.errors).toEqual([]);
    expect([res.sentences, res.sceneJobs]).toEqual([2, 1]);
    expect(bodies).toHaveLength(3);
    for (const b of bodies) {
      expect(b.voice_settings).toMatchObject({ stability: 0.65, style: 0.05, speed: 0.95, use_speaker_boost: true, similarity_boost: 0.8 });
      expect(b.text.startsWith("[")).toBe(false);
    }
    const after = await sv.readSentences("986");
    expect(after.scenes.flatMap((x) => [x.olderTone, ...x.rows.map((r) => r.olderTone)]).some(Boolean)).toBe(false);
    // the older takes are kept, never deleted
    const doc = JSON.parse(readFileSync(path.join(EP_DIR(), "voice", "sentences.json"), "utf8"));
    for (const s of doc.scenes["c1-s1"].sentences) {
      expect(s.audio.presetVersion).toBe(3);
      expect(s.takes.at(-1).file).toBe(before.scenes["c1-s1"].sentences.find((x: { id: string }) => x.id === s.id).audio.file);
    }
    expect(JSON.parse(readFileSync(path.join(EP_DIR(), "voice", "index.json"), "utf8"))["c1-s2"].presetVersion).toBe(3);
    expect((await tu.toneUpgradePlan("986")).scenes).toEqual([]);
    bodies.length = 0;
    await generateVoice("986", { client: c, testOnlySkipGates: true });
    expect(bodies).toHaveLength(0);
  });
});

describe("الاستوديو: الإشارة الهادئة والأمر الصريح وجدول النبرات", { timeout: 60_000 }, () => {
  const src = (f: string) => panelSource(f);
  it("«وُلّدت بنبرة سابقة» في الجمل، و«أعد توليد ما وُلّد بنبرة سابقة» بالعدد والرصيد ثم تأكيد", async () => {
    const panel = src("app/src/workspace/SentencesPanel.tsx");
    expect(panel).toContain("r.olderTone ?");
    expect(panel).toContain("olderPlan.credits");
    expect(panel).toContain("window.confirm(toneUpgradeConfirm(p))");
    expect(panel).not.toContain("النبرة القوية");
    const { UPGRADE_ALL, OLDER_TONE } = await import("../app/src/workspace/SentencesPanel");
    expect(UPGRADE_ALL).toBe("أعد توليد ما وُلّد بنبرة سابقة");
    expect(OLDER_TONE).toBe("وُلّدت بنبرة سابقة");
    expect(src("app/server/api.ts")).toMatch(/parts\[3\] === "upgrade-tone"[\s\S]{0,400}b\?\.dryRun !== false[\s\S]{0,200}assertSceneOwner\(\)/);
  });
  it("تبويب القناة: نبرة افتراضية وجدول النبرات الست، بلا طبقة ولا منزلقات", () => {
    const brand = src("app/src/tabs/ChannelBrand.tsx");
    expect(brand).toContain('id="ch-tone"');
    expect(brand).toContain("[undefined, ...toneIds].map");
    expect(brand).toContain("voiceSettingsFor(undefined, t)");
    expect(brand).not.toMatch(/REGISTERS|طبقة صوت القناة|type="range" min=\{min\}/);
    expect(src("app/server/routes/voice.ts")).toContain("voiceSettingsFor(undefined, isTone(b.tone) ? b.tone : undefined)");
  });
});
