/**
 * إلغاء قرار النبرات القوية (D70) بطلب صاحب القناة (١١ نوفمبر، مساءً): «رجّع النبرات زي ما كانت قبل».
 * - الإعدادات الحالية = ما قبل D70 حرفًا: أرقام النبرات وأسماؤها وأوامر أدائها، وطبقات القنوات، ولا نبرة افتراضية
 *   للقنوات ولا للقناة الجديدة ولا لقالب السلسلة، ولا مدى قوي ولا تعديل توقير.
 * - ما وُلّد قبل D70 حالي بلا إعادة توليد (البصمة نفسها)؛ وما وُلّد بالنبرة القوية (الإصدار ٢) صالح «بالنبرة القوية
 *   (المُلغاة)»، لا يُعاد بالقراءة ولا «جهّز» ولا «ولّد الصوت»، ويُعاد بالأمر الصريح «أعد توليد ما وُلّد بالنبرة القوية»
 *   بالإعدادات المستعادة (عميل ElevenLabs مزيّف: لا شبكة ولا رصيد). والمعرّف grave يبقى صالحًا.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { encodeWav } from "../src/remotion/dafatir/audio/compose";
import type { Plan } from "../src/plan/types";
import type { VoiceProfile } from "../src/channel/types";
import {
  allToneIds, isReverentV2, isSupersededVersion, isTone, legacyTunes, layersOf, strongVoiceSettingsV2, TONE_PRESET_VERSION, TONE_PRESETS_V1,
  toneIds, tones, voiceSettingsFor, type Tone,
} from "../src/voice/tones";

const CHANNELS = ["balislam", "dafatir-alzaman", "zubdat-alkutub"] as const;
const channelJson = (ch: string) => JSON.parse(readFileSync(path.join("channels", ch, "channel.json"), "utf8"));
const OLD_IDS: Tone[] = ["calm", "warm", "documentary", "dramatic", "energetic", "intimate"];

/** The tone presets and channel layers exactly as they were before D70 (git bf21ec72). */
const OLD_TONES: Record<string, { nameAr: string; useAr: string; stability: number; style: number; speed: number; direction: string }> = {
  calm: { nameAr: "هادئ تأملي", useAr: "الحلقات الإيمانية والتأمل", stability: 0.65, style: 0.05, speed: 0.95, direction: "calm, reflective" },
  warm: { nameAr: "حكّاء دافئ", useAr: "القصص والحياة اليومية", stability: 0.45, style: 0.25, speed: 1.0, direction: "warm storytelling" },
  documentary: { nameAr: "وثائقي رصين", useAr: "التاريخ والمعلومات", stability: 0.6, style: 0.15, speed: 0.98, direction: "measured documentary narration" },
  dramatic: { nameAr: "درامي", useAr: "لحظات الذروة والمعارك والقرارات", stability: 0.3, style: 0.5, speed: 0.96, direction: "dramatic, intense" },
  energetic: { nameAr: "حماسي", useAr: "الخطافات والشورتس والدعوة للاشتراك", stability: 0.35, style: 0.4, speed: 1.08, direction: "energetic, upbeat" },
  intimate: { nameAr: "قريب وهامس", useAr: "الأسئلة الشخصية والمواقف المؤثرة", stability: 0.55, style: 0.3, speed: 0.92, direction: "soft, intimate, close to the listener" },
};
const OLD_PROFILES: Record<string, VoiceProfile> = {
  balislam: { nameAr: "وقور هادئ", speed: 0.9, stability: 0.6, style: 0.08, direction: "calm, dignified, reflective narration" },
  "dafatir-alzaman": { nameAr: "راوٍ وثائقي", speed: 0.95, stability: 0.5, style: 0.22, direction: "documentary storyteller narrating history" },
  "zubdat-alkutub": { nameAr: "سريع واضح", speed: 1.02, stability: 0.45, style: 0.28, direction: "clear, lively explainer" },
};
/** The D70 (strong, cancelled) channel layers, kept for fingerprints only. */
const STRONG_PROFILES: Record<string, VoiceProfile> = {
  balislam: { nameAr: "وقور رزين", speed: 1, stability: 0.5, style: 0.04, direction: "grave, dignified and authoritative narration; firm, clear projection" },
  "dafatir-alzaman": { nameAr: "راوٍ وثائقي حازم", speed: 1, stability: 0.5, style: 0.06, direction: "commanding documentary storyteller narrating history; firm and grave" },
  "zubdat-alkutub": { nameAr: "واضح حازم", speed: 1, stability: 0.48, style: 0.08, direction: "clear, confident and authoritative explainer; firm, not rushed" },
};
/** The pre-D70 voiceSettingsFor, verbatim. */
const oldFormula = (profile: VoiceProfile, tone?: string) => {
  const r2 = (x: number) => Math.round(x * 100) / 100;
  const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
  const t = tone ? OLD_TONES[tone]! : null;
  const direction = t?.direction ?? profile.direction;
  return {
    stability: r2(clamp(profile.stability + (t ? t.stability - 0.5 : 0), 0, 1)),
    style: r2(clamp(profile.style + (t ? t.style : 0), 0, 1)),
    speed: r2(clamp(profile.speed * (t ? t.speed : 1), 0.7, 1.2)),
    ...(direction ? { direction } : {}),
  };
};

describe("عادت النبرات كما كانت قبل D70", () => {
  it("النبرات الست بأرقامها وأسمائها وأوامر أدائها حرفًا، والإصدار الحالي ١", () => {
    expect(TONE_PRESET_VERSION).toBe(1);
    expect(toneIds).toEqual(OLD_IDS);
    for (const t of OLD_IDS) {
      expect(TONE_PRESETS_V1[t as Exclude<Tone, "grave">]).toEqual(OLD_TONES[t]);
      expect(tones[t]).toEqual(OLD_TONES[t]);
    }
    // the pre-D70 source, byte for byte, for the six presets
    const before = execFileSync("git", ["show", "bf21ec72:src/voice/tones.ts"], { encoding: "utf8" });
    const now = readFileSync("src/voice/tones.ts", "utf8");
    for (const line of before.split("\n").filter((l) => /^  (calm|warm|documentary|dramatic|energetic|intimate): \{/.test(l))) expect(now).toContain(line);
  });

  it("طبقات القنوات كما كانت، ولا نبرة افتراضية للقنوات ولا للقناة الجديدة", () => {
    for (const ch of CHANNELS) {
      const v = channelJson(ch).voice;
      expect(v.profile).toEqual(OLD_PROFILES[ch]);
      expect(Object.keys(v.profile)).toEqual(["nameAr", "speed", "stability", "style", "direction"]);
      expect("tone" in v).toBe(false);
      for (const t of [undefined, ...OLD_IDS]) expect(voiceSettingsFor(v.profile, t)).toEqual(oldFormula(OLD_PROFILES[ch]!, t));
      // D70 kept for fingerprints only
      expect(v.profileHistory).toEqual({ "2": STRONG_PROFILES[ch] });
      expect(v.toneHistory).toEqual({ "2": "grave" });
    }
    const create = readFileSync("src/channel/create.ts", "utf8");
    expect(create).not.toContain("DEFAULT_TONE");
    expect(create).not.toMatch(/voice: \{ tone/);
  });

  it("لا مدى قوي ولا تعديل توقير في الإعدادات الحالية", () => {
    const p = OLD_PROFILES.balislam!;
    expect(voiceSettingsFor.length).toBeLessThanOrEqual(2);
    // calm in balislam: 0.75 stability (out of the old strong range), and a sentence about God is unchanged
    expect(voiceSettingsFor(p, "calm")).toEqual({ stability: 0.75, style: 0.13, speed: 0.86, direction: "calm, reflective" });
    expect(isReverentV2("وَتَوَكَّلْ عَلَى اللَّهِ.")).toBe(true);
    expect(readFileSync("src/voice/generate.ts", "utf8")).not.toMatch(/voiceSettingsFor\([^)]*text/);
    expect(readFileSync("src/voice/sentenceVoice.ts", "utf8")).not.toMatch(/voiceSettingsFor\([^)]*text/);
  });

  it("المعرّف grave يبقى صالحًا ويُحل إلى طبقة القناة وحدها، ولا يظهر في قوائم الاختيار", () => {
    expect(isTone("grave")).toBe(true);
    expect(allToneIds).toContain("grave");
    expect(toneIds as string[]).not.toContain("grave");
    for (const ch of CHANNELS) expect(voiceSettingsFor(OLD_PROFILES[ch], "grave")).toEqual(voiceSettingsFor(OLD_PROFILES[ch]));
    expect(voiceSettingsFor(undefined, "grave")).toBeUndefined();
  });

  it("إعدادات D70 محفوظة حرفًا للبصمة وحدها (الإصدار ٢): الجدول، المدى القوي، التوقير، ونبرة القناة حينها", () => {
    const L = layersOf(channelJson("balislam").voice);
    const v2 = (t: Tone | undefined, text?: string) => legacyTunes(L, t, { text })[0]!;
    expect(v2("calm").version).toBe(2);
    expect(v2("grave").tune).toMatchObject({ stability: 0.46, style: 0.34, speed: 0.98 });
    expect(v2("calm").tune).toMatchObject({ stability: 0.54, style: 0.22, speed: 0.95 });
    // channel tone is gone now; the v2 fingerprint uses the v2 channel default (grave)
    expect(v2(undefined).tune).toEqual(v2("grave").tune);
    // reverence existed only in v2
    expect(v2("dramatic", "سبحانه وتعالى").tune).toMatchObject({ stability: 0.52, direction: expect.stringMatching(/reverent/) });
    expect(v2("dramatic", "سبحانه وتعالى").tune).toEqual(strongVoiceSettingsV2(STRONG_PROFILES.balislam, "dramatic", { text: "سبحانه وتعالى" }));
    expect(isSupersededVersion(undefined)).toBe(false);
    expect(isSupersededVersion(1)).toBe(false);
    expect(isSupersededVersion(2)).toBe(true);
  });
});

// ── ما وُلّد بالنبرة القوية صالح، ولا طلب مدفوع إلا بالأمر الصريح الذي يرسل الإعدادات المستعادة ─────────────

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
  // c1-s2 keeps the D70 id «grave» (as a series stamp of that day would): it must still resolve
  const plan = { episode: "986", title: "اختبار", tone: "calm", chapters: [{ number: 1, title: "تجربة", scenes: [
    { id: "c1-s1", template: "alley-tale", line: 6, narration: `${S1A} ${S1B}`, sfx: [], props: {} },
    { id: "c1-s2", template: "alley-tale", line: 8, narration: S2, tone: "grave", sfx: [], props: {} },
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
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-strong-revert-"));
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

describe("إلغاء النبرات القوية لا يعيد توليد شيء آليًا", { timeout: 60_000 }, () => {
  it("ما وُلّد بالنبرة القوية صالح بإشارته، والقراءة والتجهيز والتوليد لا تصرف شيئًا، والأمر الصريح يرسل الإعدادات المستعادة", async () => {
    const current = readFileSync(CH_FILE(), "utf8");
    // 1) The D70 day: the channel.json of that day (strong layer, tone grave) and the strong presets (version 2).
    const ch = JSON.parse(current);
    const { profileHistory: _h, toneHistory: _t, ...rest } = ch.voice;
    writeFileSync(CH_FILE(), JSON.stringify({ ...ch, voice: { ...rest, tone: "grave", profile: STRONG_PROFILES.balislam, profileHistory: { "1": OLD_PROFILES.balislam } } }, null, 2) + "\n");
    vi.resetModules();
    vi.doMock("../src/voice/tones", async (orig) => {
      const actual = await orig<typeof import("../src/voice/tones")>();
      return { ...actual, TONE_PRESET_VERSION: 2, legacyTunes: () => [], isSupersededVersion: (v?: number) => (v ?? 1) !== 2,
        voiceSettingsFor: (p: VoiceProfile | undefined, t?: Tone) => actual.strongVoiceSettingsV2(p, t) };
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
      for (const b of bodies) expect(b.voice_settings.stability).toBe(strongVoiceSettingsV2(STRONG_PROFILES.balislam, isS2(b.text) ? "grave" : "calm")!.stability);
    }
    // 2) Today: the restored settings and the restored channel.json. Nothing is regenerated by reading, preparing or «ولّد الصوت».
    writeFileSync(CH_FILE(), current);
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
    expect(dry.missingTones).toEqual([]);
    expect(dry.olderTone.scenes).toEqual(["c1-s2"]);
    await generateVoice("986", { client: c, testOnlySkipGates: true });
    await sv.prepareBasmalaScenes("986", { client: c });
    expect(bodies).toHaveLength(0);

    // 3) The explicit owner action: the count and credit first, then the restored (pre-D70) settings are sent.
    const plan = await tu.toneUpgradePlan("986");
    expect(bodies).toHaveLength(0);
    expect(plan.sentences.map((s) => s.sceneId)).toEqual(["c1-s1", "c1-s1"]);
    expect(plan.sceneJobs.ids).toEqual(["c1-s2"]);
    expect(plan.scenes).toEqual(["c1-s1", "c1-s2"]);
    expect(plan.credits).toBeGreaterThan(0);
    const before = JSON.parse(readFileSync(path.join(EP_DIR(), "voice", "sentences.json"), "utf8"));
    const res = await tu.upgradeTones("986", { client: c, testOnlySkipApprovalGates: true });
    expect(res.errors).toEqual([]);
    expect([res.sentences, res.sceneJobs]).toEqual([2, 1]);
    expect(bodies).toHaveLength(3);
    for (const b of bodies) {
      const want = oldFormula(OLD_PROFILES.balislam!, isS2(b.text) ? undefined : "calm");
      expect(T.voiceSettingsFor(OLD_PROFILES.balislam, isS2(b.text) ? "grave" : "calm")).toEqual(want);
      expect(b.voice_settings).toMatchObject({ stability: want.stability, style: want.style, speed: want.speed, use_speaker_boost: true, similarity_boost: 0.8 });
    }
    const after = await sv.readSentences("986");
    expect(after.scenes.flatMap((x) => [x.olderTone, ...x.rows.map((r) => r.olderTone)]).some(Boolean)).toBe(false);
    // the strong takes are kept, never deleted
    const doc = JSON.parse(readFileSync(path.join(EP_DIR(), "voice", "sentences.json"), "utf8"));
    for (const s of doc.scenes["c1-s1"].sentences) {
      expect(s.audio.presetVersion).toBe(1);
      expect(s.takes.at(-1).file).toBe(before.scenes["c1-s1"].sentences.find((x: { id: string }) => x.id === s.id).audio.file);
    }
    const idx = JSON.parse(readFileSync(path.join(EP_DIR(), "voice", "index.json"), "utf8"));
    expect(idx["c1-s2"].presetVersion).toBe(1);
    // nothing left to upgrade, and the restored takes are current
    expect((await tu.toneUpgradePlan("986")).scenes).toEqual([]);
    bodies.length = 0;
    await generateVoice("986", { client: c, testOnlySkipGates: true });
    expect(bodies).toHaveLength(0);
  });
});

describe("الاستوديو: الإشارة الهادئة والأمر الصريح وعيّنة كل نبرة", { timeout: 60_000 }, () => {
  const src = (f: string) => readFileSync(f, "utf8");
  it("«وُلّدت بالنبرة القوية (المُلغاة)» في الجمل، و«أعد توليد ما وُلّد بالنبرة القوية» بالعدد والرصيد ثم تأكيد", async () => {
    const panel = src("app/src/workspace/SentencesPanel.tsx");
    expect(panel).toContain('export const OLDER_TONE = "وُلّدت بالنبرة القوية (المُلغاة)"');
    expect(panel).toContain("r.olderTone ?");
    expect(panel).toContain("olderPlan.credits");
    expect(panel).toContain("${UPGRADE_ALL} (${ar(olderCount)})");
    expect(panel).toContain("window.confirm(toneUpgradeConfirm(p))");
    expect(panel).toMatch(/api\.toneUpgrade\(episodeId, channelId, true\)[\s\S]*window\.confirm[\s\S]*api\.toneUpgrade\(episodeId, channelId, false\)/);
    expect(panel).not.toContain("النبرة السابقة");
    expect(panel).not.toContain("قوية ورزينة");
    const { toneUpgradeConfirm, UPGRADE_ALL, OLDER_TONE } = await import("../app/src/workspace/SentencesPanel");
    expect(UPGRADE_ALL).toBe("أعد توليد ما وُلّد بالنبرة القوية");
    expect(OLDER_TONE).toBe("وُلّدت بالنبرة القوية (المُلغاة)");
    const text = toneUpgradeConfirm({ sentences: [1, 2, 3], sceneJobs: { ids: [1] }, scenes: [1, 2], chars: 120, credits: 120 });
    // QA 12 Nov: counts after a label, so the number never disagrees with its noun
    expect(text).toContain("الجمل: ٣");
    expect(text).toContain("مقاطع المشاهد: ١");
    expect(text).toContain("رصيد");
    // the server: dry run by default, the paid run only with dryRun: false from the owner
    const server = src("app/server/api.ts");
    expect(server).toMatch(/parts\[3\] === "upgrade-tone"[\s\S]{0,400}b\?\.dryRun !== false[\s\S]{0,200}assertSceneOwner\(\)/);
  });
  it("عيّنة الصوت: زر لكل نبرة بالإعدادات المستعادة، والطبقات الجاهزة كما كانت", () => {
    const brand = src("app/src/tabs/ChannelBrand.tsx");
    expect(brand).toContain("[undefined, ...toneIds].map");
    expect(brand).toContain("voiceSettingsFor(p, t)");
    expect(brand).toContain("(يصرف رصيدًا)");
    expect(brand).toContain('{ nameAr: "وقور هادئ", speed: 0.9, stability: 0.6, style: 0.08 }');
    expect(brand).toContain('{ nameAr: "حكّاء قريب", speed: 0.94, stability: 0.45, style: 0.3 }');
    expect(brand).not.toMatch(/STRONG_RANGE|nameAr: "وقور رزين"|nameAr: "واضح حازم"/);
    expect(src("app/server/extra.ts")).toContain('const { voiceSettingsFor, isTone } = await load("/src/voice/tones.ts")');
    expect(src("app/server/extra.ts")).toMatch(/voiceSettingsFor\(b\.profile \?\? undefined, isTone\(b\.tone\) \? b\.tone : undefined\)/);
  });
});
