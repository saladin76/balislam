/**
 * قرار صاحب القناة (١١ نوفمبر ٢٠٢٦): «الأصوات والنبرات كلها قوية ورزينة، لا ناعمة ولا هادئة، وفيها قوة تشد المتابع».
 * - كل نبرة في المدى القوي في القنوات الثلاث، وفروقها باقية (التأملي أبطأ، والدرامي أقواها)، والمعرّفات القديمة تُحل.
 * - إصدار النبرات خارج إعادة التوليد الآلية: تسجيل بالإعدادات السابقة صالح «بالنبرة السابقة»، ولا يُعاد إلا بالأمر
 *   الصريح «أعد توليد الكل بالنبرة الجديدة»، الذي يرسل الإعدادات الجديدة (عميل ElevenLabs مزيّف: لا شبكة ولا رصيد).
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { encodeWav } from "../src/remotion/dafatir/audio/compose";
import type { Plan } from "../src/plan/types";
import type { VoiceProfile } from "../src/channel/types";
import {
  DEFAULT_TONE, isReverent, isTone, legacyVoiceSettings, STRONG_RANGE, TONE_PRESET_VERSION, toneIds, tones, voiceSettingsFor, type Tone,
} from "../src/voice/tones";

const CHANNELS = ["balislam", "dafatir-alzaman", "zubdat-alkutub"] as const;
const channelJson = (ch: string) => JSON.parse(readFileSync(path.join("channels", ch, "channel.json"), "utf8"));
const OLD_IDS: Tone[] = ["calm", "warm", "documentary", "dramatic", "energetic", "intimate"];

/** The tone presets and channel layers exactly as they were before 11 Nov (the regression reference). */
const OLD_TONES: Record<string, { stability: number; style: number; speed: number; direction: string }> = {
  calm: { stability: 0.65, style: 0.05, speed: 0.95, direction: "calm, reflective" },
  warm: { stability: 0.45, style: 0.25, speed: 1.0, direction: "warm storytelling" },
  documentary: { stability: 0.6, style: 0.15, speed: 0.98, direction: "measured documentary narration" },
  dramatic: { stability: 0.3, style: 0.5, speed: 0.96, direction: "dramatic, intense" },
  energetic: { stability: 0.35, style: 0.4, speed: 1.08, direction: "energetic, upbeat" },
  intimate: { stability: 0.55, style: 0.3, speed: 0.92, direction: "soft, intimate, close to the listener" },
};
const OLD_PROFILES: Record<string, VoiceProfile> = {
  balislam: { nameAr: "وقور هادئ", speed: 0.9, stability: 0.6, style: 0.08, direction: "calm, dignified, reflective narration" },
  "dafatir-alzaman": { nameAr: "راوٍ وثائقي", speed: 0.95, stability: 0.5, style: 0.22, direction: "documentary storyteller narrating history" },
  "zubdat-alkutub": { nameAr: "سريع واضح", speed: 1.02, stability: 0.45, style: 0.28, direction: "clear, lively explainer" },
};
/** The old voiceSettingsFor, verbatim. */
const oldFormula = (profile: VoiceProfile, tone: string) => {
  const r2 = (x: number) => Math.round(x * 100) / 100;
  const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
  const t = OLD_TONES[tone]!;
  return {
    stability: r2(clamp(profile.stability + (t.stability - 0.5), 0, 1)),
    style: r2(clamp(profile.style + t.style, 0, 1)),
    speed: r2(clamp(profile.speed * t.speed, 0.7, 1.2)),
    direction: t.direction,
  };
};

describe("النبرات كلها قوية ورزينة (الإصدار ٢)", () => {
  it("كل نبرة في كل قناة في المدى القوي، والتأملي أبطأها والدرامي أقواها", () => {
    expect(TONE_PRESET_VERSION).toBe(2);
    for (const ch of CHANNELS) {
      const profile = channelJson(ch).voice.profile as VoiceProfile;
      const all = toneIds.map((t) => [t, voiceSettingsFor(profile, t)!] as const);
      for (const [t, v] of all) {
        expect(v.stability, `${ch}/${t} stability`).toBeGreaterThanOrEqual(STRONG_RANGE.stability[0]);
        expect(v.stability, `${ch}/${t} stability`).toBeLessThanOrEqual(STRONG_RANGE.stability[1]);
        expect(v.style, `${ch}/${t} style`).toBeGreaterThanOrEqual(STRONG_RANGE.style[0]);
        expect(v.style, `${ch}/${t} style`).toBeLessThanOrEqual(STRONG_RANGE.style[1]);
        expect(v.speed, `${ch}/${t} speed`).toBeGreaterThanOrEqual(0.94);
        expect(v.speed, `${ch}/${t} speed`).toBeLessThanOrEqual(1.0);
        expect(v.direction, `${ch}/${t}`).toMatch(/firm|grave|authoritative|commanding|powerful/);
        expect(v.direction, `${ch}/${t}`).not.toMatch(/\bsoft\b|\bcalm\b|upbeat|lively|(?<!no )whisper/);
      }
      const by = Object.fromEntries(all);
      const styles = all.map(([, v]) => v.style), stabs = all.map(([, v]) => v.stability), speeds = all.map(([, v]) => v.speed);
      expect(by.dramatic!.style).toBe(Math.max(...styles));
      expect(by.dramatic!.stability).toBe(Math.min(...stabs));
      expect(by.calm!.speed).toBe(Math.min(...speeds));
      expect(by.calm!.stability).toBe(Math.max(...stabs));
    }
  });

  it("الأسماء حازمة لا ناعمة، والمعرّفات القديمة تُحل إلى الإعدادات الجديدة", () => {
    for (const t of toneIds) expect(tones[t].nameAr).not.toMatch(/هادئ|ناعم|هامس|دافئ/);
    expect(tones.calm.nameAr).toBe("تأمّلي رزين");
    expect(tones.grave.nameAr).toBe("قوي رزين");
    for (const t of OLD_IDS) {
      expect(isTone(t)).toBe(true);
      const now = voiceSettingsFor(OLD_PROFILES.balislam, t)!;
      expect(now).not.toEqual(oldFormula(OLD_PROFILES.balislam!, t));
    }
  });

  it("الإصدار ١ محفوظ حرفًا لبصمة التسجيلات القديمة (لا يُرسل به طلب)", () => {
    for (const ch of CHANNELS) {
      expect(channelJson(ch).voice.profileHistory["1"]).toEqual(OLD_PROFILES[ch]);
      for (const t of OLD_IDS) expect(legacyVoiceSettings(OLD_PROFILES[ch], t)).toEqual(oldFormula(OLD_PROFILES[ch]!, t));
    }
    expect(legacyVoiceSettings(OLD_PROFILES.balislam, "grave")).toBeUndefined();
  });

  it("الافتراضي «قوي رزين» للقنوات الثلاث وللقناة الجديدة، والطبقات بأسماء حازمة", () => {
    expect(DEFAULT_TONE).toBe("grave");
    for (const ch of CHANNELS) {
      const v = channelJson(ch).voice;
      expect(v.tone).toBe("grave");
      expect(v.profile.nameAr).not.toMatch(/هادئ|ناعم|سريع/);
    }
    expect(readFileSync("src/channel/create.ts", "utf8")).toContain("voice: { tone: DEFAULT_TONE }");
  });

  it("التوقير: جملة فيها ذكر الله أو دعاء رزينة خاشعة حازمة بلا صياح؛ والكلمة كاملة لا جزؤها", () => {
    const p = channelJson("balislam").voice.profile as VoiceProfile;
    for (const text of ["وَتَوَكَّلْ عَلَى اللَّهِ.", "«اللهم اغفر لنا»", "بالله عليك", "فلله الأمر", "سبحانه وتعالى"]) {
      expect(isReverent(text), text).toBe(true);
      const v = voiceSettingsFor(p, "dramatic", { text })!;
      expect(v.stability).toBeGreaterThanOrEqual(0.52);
      expect(v.stability).toBeLessThanOrEqual(STRONG_RANGE.stability[1]);
      expect(v.style).toBeLessThanOrEqual(0.22);
      expect(v.speed).toBeLessThanOrEqual(0.96);
      expect(v.direction).toMatch(/reverent/);
      expect(v.direction).toMatch(/never shouting/);
    }
    for (const text of ["اللهجة العربية", "اللهب في الموقد", "كتاب عربي"]) expect(isReverent(text), text).toBe(false);
    expect(voiceSettingsFor(p, "dramatic", { text: "اللهجة" })).toEqual(voiceSettingsFor(p, "dramatic"));
  });
});

// ── لا إعادة توليد آلية بعد تغيير النبرات، والأمر الصريح يرسل الإعدادات الجديدة ─────────────────────────────

const ENV = ["BAL_CHANNELS_DIR", "BAL_CHANNEL", "ELEVENLABS_MODEL_ID", "BAL_WORKFLOW_HMAC_KEY", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"] as const;
const saved: Record<string, string | undefined> = {};
let tmp = "";
const SR = 44100;
const S1A = "كَتَبَ الوَلَدُ الدَّرْسَ.";
const S1B = "ثُمَّ ذَهَبَ إِلَى البَيْتِ؟";
const S2 = "وَهَذَا مَشْهَدٌ ثَانٍ.";
const EP_DIR = () => path.join(tmp, "balislam", "episodes", "986-strong");

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
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-strong-voice-"));
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

describe("تغيير النبرات لا يعيد توليد شيء آليًا", () => {
  it("تسجيلات «قبل ١١ نوفمبر» صالحة بالنبرة السابقة، والتوليد العادي لا يصرف شيئًا، والأمر الصريح يرسل الإعدادات الجديدة", async () => {
    const v1Profile = OLD_PROFILES.balislam!;
    // 1) The past: the studio as it was (preset version 1 — the old numbers, the old channel layer).
    vi.resetModules();
    vi.doMock("../src/voice/tones", async (orig) => {
      const actual = await orig<typeof import("../src/voice/tones")>();
      return { ...actual, TONE_PRESET_VERSION: 1, legacyTunes: () => [],
        voiceSettingsFor: (_p: VoiceProfile | undefined, t?: Tone) => actual.legacyVoiceSettings(v1Profile, t) };
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
      for (const b of bodies) expect(b.voice_settings.stability).toBe(legacyVoiceSettings(v1Profile, "calm")!.stability);
    }
    // 2) Today: the strong presets. Nothing is regenerated by reading, preparing or «ولّد الصوت».
    vi.doUnmock("../src/voice/tones");
    vi.resetModules();
    bodies.length = 0;
    const sv = await import("../src/voice/sentenceVoice");
    const { generateVoice } = await import("../src/voice/generate");
    const tu = await import("../src/voice/toneUpgrade");
    const T = await import("../src/voice/tones");
    const c = await client();
    const read = await sv.readSentences("986");
    const s1 = read.scenes.find((x) => x.id === "c1-s1")!;
    expect(s1.rows.map((r) => [r.status, r.olderTone])).toEqual([["generated", true], ["generated", true]]);
    expect(s1.waiting).toBeNull();
    expect(read.scenes.find((x) => x.id === "c1-s2")!.olderTone).toBe(true);
    const dry = await generateVoice("986", { dryRun: true });
    expect(dry.toGenerate).toEqual([]);
    expect(dry.olderTone.scenes).toEqual(["c1-s2"]);
    await generateVoice("986", { client: c, testOnlySkipGates: true });
    await sv.prepareBasmalaScenes("986", { client: c });
    expect(bodies).toHaveLength(0);

    // 3) The explicit owner action: the count first, then the new settings are sent.
    const plan = await tu.toneUpgradePlan("986");
    expect(plan.sentences.map((s) => s.sceneId)).toEqual(["c1-s1", "c1-s1"]);
    expect(plan.sceneJobs.ids).toEqual(["c1-s2"]);
    expect(plan.scenes).toEqual(["c1-s1", "c1-s2"]);
    expect(plan.credits).toBeGreaterThan(0);
    const before = JSON.parse(readFileSync(path.join(EP_DIR(), "voice", "sentences.json"), "utf8"));
    const res = await tu.upgradeTones("986", { client: c, testOnlySkipApprovalGates: true });
    expect(res.errors).toEqual([]);
    expect([res.sentences, res.sceneJobs]).toEqual([2, 1]);
    expect(bodies).toHaveLength(3);
    const profile = JSON.parse(readFileSync(path.join(tmp, "balislam", "channel.json"), "utf8")).voice.profile as VoiceProfile;
    for (const b of bodies) {
      const want = T.voiceSettingsFor(profile, "calm", { text: b.text })!;
      expect(b.voice_settings).toMatchObject({ stability: want.stability, style: want.style, speed: want.speed, use_speaker_boost: true, similarity_boost: 0.8 });
      expect(want.stability).not.toBe(legacyVoiceSettings(v1Profile, "calm")!.stability);
    }
    const after = await sv.readSentences("986");
    expect(after.scenes.flatMap((x) => [x.olderTone, ...x.rows.map((r) => r.olderTone)]).some(Boolean)).toBe(false);
    // the old takes are kept, never deleted
    const doc = JSON.parse(readFileSync(path.join(EP_DIR(), "voice", "sentences.json"), "utf8"));
    for (const s of doc.scenes["c1-s1"].sentences) {
      expect(s.audio.presetVersion).toBe(2);
      expect(s.takes.at(-1).file).toBe(before.scenes["c1-s1"].sentences.find((x: { id: string }) => x.id === s.id).audio.file);
    }
    const idx = JSON.parse(readFileSync(path.join(EP_DIR(), "voice", "index.json"), "utf8"));
    expect(idx["c1-s2"].presetVersion).toBe(2);
    // nothing left to upgrade
    expect((await tu.toneUpgradePlan("986")).scenes).toEqual([]);
  });
});

describe("الاستوديو: الإشارة الهادئة والأمر الصريح وعيّنة كل نبرة", () => {
  const src = (f: string) => readFileSync(f, "utf8");
  it("«وُلّدت بالنبرة السابقة» في الجمل، و«أعد توليد الكل بالنبرة الجديدة» بتأكيد يذكر العدد والرصيد", async () => {
    const panel = src("app/src/workspace/SentencesPanel.tsx");
    expect(panel).toContain('export const OLDER_TONE = "وُلّدت بالنبرة السابقة"');
    expect(panel).toContain("r.olderTone ?");
    expect(panel).toContain("window.confirm(toneUpgradeConfirm(p))");
    expect(panel).toMatch(/api\.toneUpgrade\(episodeId, channelId, true\)[\s\S]*window\.confirm[\s\S]*api\.toneUpgrade\(episodeId, channelId, false\)/);
    const { toneUpgradeConfirm, UPGRADE_ALL } = await import("../app/src/workspace/SentencesPanel");
    expect(UPGRADE_ALL).toBe("أعد توليد الكل بالنبرة الجديدة");
    const text = toneUpgradeConfirm({ sentences: [1, 2, 3], sceneJobs: { ids: [1] }, scenes: [1, 2], chars: 120, credits: 120 });
    expect(text).toContain("٣ جملة");
    expect(text).toContain("١ مقطع مشهد");
    expect(text).toContain("رصيد");
    // the server: dry run by default, the paid run only with dryRun: false from the owner
    const server = src("app/server/api.ts");
    expect(server).toMatch(/parts\[3\] === "upgrade-tone"[\s\S]{0,400}b\?\.dryRun !== false[\s\S]{0,200}assertSceneOwner\(\)/);
  });
  it("عيّنة الصوت: زر لكل نبرة بالإعدادات الجديدة، مكتوب عليه أنه يصرف رصيدًا", () => {
    const brand = src("app/src/tabs/ChannelBrand.tsx");
    expect(brand).toContain("[undefined, ...toneIds].map");
    expect(brand).toContain("voiceSettingsFor(p, t)");
    expect(brand).toContain("(يصرف رصيدًا)");
    expect(brand).not.toMatch(/nameAr: "وقور هادئ"|nameAr: "سريع واضح"/);
    expect(src("app/server/extra.ts")).toContain('const { voiceSettingsFor, isTone } = await load("/src/voice/tones.ts")');
  });
});
