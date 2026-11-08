/**
 * «النبرة غير مناسبة» في «دفاتر الزمن» (قرار صاحب المشروع، الخيار أ في D39، ٩ نوفمبر):
 * نبرة المالك لمشهد تعلو على خريطة النبرة لأجزاء ذلك المشهد وحده، وتُسجَّل إصدارًا جديدًا من الخريطة
 * (v1.2 ← v1.3) مع سطر changelog، ويبقى الإصدار السابق على القرص. بقية المشاهد بنبرتها، والقنوات بلا خريطة كما هي.
 * لا مفاتيح ولا شبكة: الصوت صناعي من عميل مزيّف.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runWithChannel } from "../src/channel";
import { approveStoryboard } from "../src/plan/storyboard";
import type { Plan } from "../src/plan/types";
import { encodeWav } from "../src/remotion/dafatir/audio/compose";
import { partJobs, type ToneMap } from "../src/remotion/dafatir/audio/parts";
import { decideSceneProduction, inspectSceneProduction, recordSceneRenderEvidence } from "../src/studio/sceneService";
import { applySceneOverrides, loadPartsContext, validatePartsContext } from "../src/voice/dafatirParts";
import type { ElevenLabsClient } from "../src/voice/elevenlabs";
import { nextToneMapVersion, overrideSceneTone, prepareSceneToneOverride, toneMapSummary, type ToneMapDoc } from "../src/voice/toneMapOverride";
import { voiceSettingsFor } from "../src/voice/tones";

const EP = "channels/dafatir-alzaman/episodes/001-adam-beginning";
const mapRaw = readFileSync(path.join(EP, "tone-map.json"), "utf8");
const map = JSON.parse(mapRaw) as ToneMapDoc;
const plan = JSON.parse(readFileSync(path.join(EP, "plan.json"), "utf8")) as Plan;
const tashkeel = readFileSync(path.join(EP, "tashkeel.md"), "utf8");
const AT = "2026-11-09T10:00:00.000Z";
const NOTE = "النبرة عند 0:04 — حكّاء دافئ أنسب للخاتمة";

const ENV = ["BAL_CHANNELS_DIR", "BAL_CHANNEL", "ELEVENLABS_MODEL_ID", "BAL_WORKFLOW_HMAC_KEY", "BAL_STUDIO_OWNER_PASSPHRASE_SHA256"] as const;
const saved: Record<string, string | undefined> = {};
let tmp = "";
const epDir = () => path.join(tmp, "dafatir-alzaman", "episodes", "001-adam-beginning");
const freshEpisode = () => {
  rmSync(epDir(), { recursive: true, force: true });
  mkdirSync(epDir(), { recursive: true });
  for (const f of ["script.md", "plan.json", "tone-map.json", "tashkeel.md"]) writeFileSync(path.join(epDir(), f), readFileSync(path.join(EP, f)));
};

beforeAll(() => {
  for (const k of ENV) saved[k] = process.env[k];
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-tone-override-"));
  for (const ch of ["dafatir-alzaman", "balislam"])
    cpSync(path.join("channels", ch), path.join(tmp, ch), { recursive: true, filter: (s) => !/[\\/]episodes([\\/]|$)/.test(s) });
  process.env.BAL_CHANNELS_DIR = tmp;
  process.env.ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
});
afterAll(() => {
  for (const k of ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

describe("الإصدار الجديد من الخريطة (دالة صافية)", () => {
  it("يغيّر أجزاء المشهد وحده، ويسجّل التغيير في changelog وprevious وsceneOverrides", () => {
    const r = overrideSceneTone(mapRaw, { scene: "c7-s8", tone: "documentary", note: NOTE, at: AT })!;
    expect(r.map.version).toBe("v1.3");
    expect(r.map.date).toBe("2026-11-09");
    expect(r.map.audioParts.filter((p) => p.scene === "c7-s8").map((p) => p.tone)).toEqual(["documentary", "documentary"]);
    expect(r.map.segments.filter((s) => s.scene === "c7-s8").every((s) => s.tone === "documentary")).toBe(true);
    // بقية المشاهد كما هي حرفًا
    expect(r.map.audioParts.filter((p) => p.scene !== "c7-s8")).toEqual(map.audioParts.filter((p) => p.scene !== "c7-s8"));
    expect(r.map.segments.filter((s) => s.scene !== "c7-s8")).toEqual(map.segments.filter((s) => s.scene !== "c7-s8"));
    expect(r.map.sceneTones!["c7-s8"]).toBe("documentary");
    // الإحصاء يبقى متسقًا مع المحتوى
    expect(Object.values(r.map.stats!.segmentTones!).reduce((a, b) => a + b, 0)).toBe(map.segments.length);
    expect(r.map.stats!.segmentTones!.documentary).toBe(map.stats!.segmentTones!.documentary! + 3);
    expect(r.map.previous!.at(-1)).toEqual({ version: "v1.2", path: "tone-map.v1.2.json" });
    const last = r.map.changelog!.at(-1);
    expect(last).toMatchObject({ from: "v1.2", to: "v1.3", date: "2026-11-09", by: "owner", scene: "c7-s8", after: "documentary", note: NOTE,
      before: [{ part: "c7-s8.a", tone: "warm" }, { part: "c7-s8.b", tone: "calm" }] });
    expect(r.map.changelog!.slice(0, -1)).toEqual(map.changelog);
    expect(r.map.sceneOverrides!["c7-s8"]).toMatchObject({ tone: "documentary", version: "v1.3", note: NOTE, by: "owner" });
    // ما زالت خريطة صالحة للتوليد: النص والتشكيل والمشاهد لم تتغير
    expect(validatePartsContext(r.map as unknown as ToneMap, plan, tashkeel)).toHaveLength(52);
  });

  it("لا إصدار جديد إن لم يتغير شيء: النبرة نفسها، أو مشهد بلا جزء صوتي (آية أو بطاقة)", () => {
    const tone = map.audioParts.find((p) => p.scene === "c1-s2")!.tone as "calm";
    expect(overrideSceneTone(mapRaw, { scene: "c1-s2", tone, note: "x", at: AT })).toBeNull();
    const verse = plan.chapters.flatMap((c) => c.scenes).find((s) => s.template === "verse-card")!;
    expect(overrideSceneTone(mapRaw, { scene: verse.id, tone: "warm", note: "x", at: AT })).toBeNull();
  });

  it("ترقيم الإصدارات واتباع القرار في التوليد", () => {
    expect(nextToneMapVersion("v1.2")).toBe("v1.3");
    expect(nextToneMapVersion("v1")).toBe("v1.1");
    expect(nextToneMapVersion("v2.9")).toBe("v2.10");
    // sceneOverrides يعلو حتى على جزء بقي بنبرته القديمة
    const m = { ...map, sceneOverrides: { "c7-s8": { tone: "intimate" } } } as unknown as ToneMap;
    const jobs = partJobs(applySceneOverrides(m));
    expect(jobs.filter((j) => j.scene === "c7-s8").map((j) => j.tone)).toEqual(["intimate", "intimate"]);
    expect(jobs.filter((j) => j.scene !== "c7-s8")).toEqual(partJobs(map as unknown as ToneMap).filter((j) => j.scene !== "c7-s8"));
  });
});

describe("الكتابة على القرص والتوليد بالإصدار الجديد", () => {
  beforeAll(() => { process.env.BAL_CHANNEL = "dafatir-alzaman"; freshEpisode(); });

  it("يحفظ v1.2 باسمه ويكتب v1.3، ثم v1.4 فوقه؛ ولا يكتب فوق نسخة محفوظة مختلفة", async () => {
    const script = path.join(epDir(), "script.md");
    const p = (await prepareSceneToneOverride(script, { scene: "c7-s8", tone: "documentary", note: NOTE, at: AT }))!;
    expect(p.version).toBe("v1.3");
    // لا كتابة قبل commit
    expect(existsSync(path.join(epDir(), "tone-map.v1.2.json"))).toBe(false);
    await p.commit();
    expect(readFileSync(path.join(epDir(), "tone-map.v1.2.json"), "utf8")).toBe(mapRaw);
    const v13 = JSON.parse(readFileSync(path.join(epDir(), "tone-map.json"), "utf8")) as ToneMapDoc;
    expect(v13.version).toBe("v1.3");
    const ctx = (await loadPartsContext(script, plan))!;
    const original = partJobs(map as unknown as ToneMap);
    expect(ctx.jobs.filter((j) => j.scene === "c7-s8").map((j) => j.tone)).toEqual(["documentary", "documentary"]);
    expect(ctx.jobs.filter((j) => j.scene !== "c7-s8")).toEqual(original.filter((j) => j.scene !== "c7-s8"));
    expect(await toneMapSummary(script)).toMatchObject({ version: "v1.3", tones: { "c7-s8": "documentary", "c1-s1": "calm" } });

    await (await prepareSceneToneOverride(script, { scene: "c1-s2", tone: "warm", note: "أدفأ", at: AT }))!.commit();
    const v14 = JSON.parse(readFileSync(path.join(epDir(), "tone-map.json"), "utf8")) as ToneMapDoc;
    expect(v14.version).toBe("v1.4");
    expect(v14.previous!.map((x) => x.version)).toEqual(["v1", "v1.1", "v1.2", "v1.3"]);
    expect(JSON.parse(readFileSync(path.join(epDir(), "tone-map.v1.3.json"), "utf8")).version).toBe("v1.3");
    expect(v14.audioParts.filter((p) => p.scene === "c7-s8").map((p) => p.tone)).toEqual(["documentary", "documentary"]);

    // نسخة v1.4 محفوظة بمحتوى آخر: يرفض بدل أن يكتب فوقها
    writeFileSync(path.join(epDir(), "tone-map.v1.4.json"), "{}");
    await expect(prepareSceneToneOverride(script, { scene: "c1-s3", tone: "calm", note: "x", at: AT })).rejects.toThrow(/لا يُكتب فوق/);
    await expect(prepareSceneToneOverride(script, { scene: "c1-s3", tone: "loud", note: "x", at: AT })).rejects.toThrow(/غير معروفة/);
  });

  it("التوليد يقرأ نبرة المالك لأجزاء المشهد، ولا يعيد توليد مشهد آخر", async () => {
    freshEpisode();
    const sent: { text: string; stability?: number; style?: number }[] = [];
    const SR = 44100;
    const fake = {
      modelId: "mock",
      tts: async (text: string, ctx: { tune?: { stability: number; style: number } } = {}) => {
        sent.push({ text, stability: ctx.tune?.stability, style: ctx.tune?.style });
        const chars = [...text];
        const lead = 0.3, speech = chars.length * 0.05, n = Math.round((lead + speech + 0.5) * SR);
        const s = new Float32Array(n);
        for (let i = 0; i < n; i++) { const t = i / SR; s[i] = t >= lead && t < lead + speech ? Math.sin(2 * Math.PI * 140 * t) * 0.25 : 0.0002 * Math.sin(i); }
        return { audio: Buffer.from(encodeWav(s, SR)), alignment: { characters: chars, character_start_times_seconds: chars.map((_, i) => lead + i * 0.05), character_end_times_seconds: chars.map((_, i) => lead + (i + 1) * 0.05) } };
      },
      soundEffect: async () => Buffer.alloc(0),
      account: async () => ({}) as never,
      voices: async () => [],
    } as unknown as ElevenLabsClient;
    const { generateVoice } = await import("../src/voice/generate");
    const { loadChannel } = await import("../src/channel/index");
    const profile = loadChannel().voice?.profile;
    await generateVoice("001", { client: fake, testOnlySkipGates: true, only: ["c1-s2", "c7-s8"] });
    const index1 = JSON.parse(readFileSync(path.join(epDir(), "voice", "index.json"), "utf8"));
    sent.length = 0;
    await (await prepareSceneToneOverride(path.join(epDir(), "script.md"), { scene: "c7-s8", tone: "documentary", note: NOTE, at: AT }))!.commit();
    // ما يفعله الاستوديو بعد التصحيح: إعادة توليد صوت هذا المشهد وحده
    await generateVoice("001", { client: fake, testOnlySkipGates: true, only: ["c7-s8"], force: true });
    const want = voiceSettingsFor(profile, "documentary")!;
    expect(sent).toHaveLength(2);
    for (const x of sent) expect([x.stability, x.style]).toEqual([want.stability, want.style]);
    // المشهد الآخر: لا طلب، والملف نفسه
    sent.length = 0;
    await generateVoice("001", { client: fake, testOnlySkipGates: true, only: ["c1-s2"] });
    expect(sent).toHaveLength(0);
    const index2 = JSON.parse(readFileSync(path.join(epDir(), "voice", "index.json"), "utf8"));
    expect(index2["c1-s2"].hash).toBe(index1["c1-s2"].hash);
    expect(index2["c7-s8"].hash).not.toBe(index1["c7-s8"].hash);
  }, 120_000);
});

describe("القنوات بلا خريطة نبرة لا تتغير", () => {
  it("بالإسلام: لا إصدار ولا ملخص خريطة، حتى مع نبرة صالحة", async () => {
    const dir = path.join(tmp, "balislam", "episodes", "001-x");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "script.md"), "---\ntitle: x\n---\n");
    expect(await prepareSceneToneOverride(path.join(dir, "script.md"), { scene: "c1-s1", tone: "warm", note: "x", at: AT })).toBeNull();
    expect(await toneMapSummary(path.join(dir, "script.md"))).toBeNull();
    // ولو وُضع ملف باسم الخريطة خطأً في حلقة لقناة أخرى، لا يُقرأ
    writeFileSync(path.join(dir, "tone-map.json"), mapRaw);
    expect(await prepareSceneToneOverride(path.join(dir, "script.md"), { scene: "c7-s8", tone: "warm", note: "x", at: AT })).toBeNull();
    expect(readFileSync(path.join(dir, "tone-map.json"), "utf8")).toBe(mapRaw);
  });
});

describe("التصحيح من سجل «إنتاج المشاهد»: كلمة المرور، والمشهد وحده", () => {
  it("correct-scene بنبرة يكتب v1.3 بعد تسجيل التصحيح، ويعيد فتح المشهد وحده", async () => {
    const passphrase = "owner-tone-override-2026";
    process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__tone_override_signing_key_2026";
    process.env.BAL_STUDIO_OWNER_PASSPHRASE_SHA256 = createHash("sha256").update(passphrase).digest("hex");
    delete process.env.BAL_CHANNEL;
    // حلقة صغيرة: مشهدان، الأول بجزأين في الخريطة
    const dir = path.join(tmp, "dafatir-alzaman", "episodes", "002-tone");
    mkdirSync(path.join(dir, "voice"), { recursive: true });
    const scriptPath = path.join(dir, "script.md");
    writeFileSync(scriptPath, `---\ntitle: "اختبار"\nepisode: "002"\n---\n## الفصل 1 · تجربة\nكان الدرس الأول. ثم جاء الثاني.\n\nوهذا مشهد ثان.\n`);
    const s1 = { id: "c1-s1", template: "hz-text", line: 6, narration: "كان الدرس الأول. ثم جاء الثاني.", sfx: [], props: {} };
    const s2 = { id: "c1-s2", template: "hz-text", line: 8, narration: "وهذا مشهد ثان.", sfx: [], props: {} };
    const tplan = { episode: "002", title: "اختبار", chapters: [{ number: 1, title: "تجربة", scenes: [s1, s2] }] } as unknown as Plan;
    writeFileSync(path.join(dir, "plan.json"), JSON.stringify(tplan));
    const seg = (n: number, scene: string, text: string, part: string, tone: string) => ({ n, id: `s00${n}`, key: `k${n}`, scene, text, tone, audioPart: part, indexInScene: n });
    const tmap = {
      version: "v1.2", changelog: [], previous: [{ version: "v1.1", path: "tone-map.v1.1.json" }],
      segments: [seg(1, "c1-s1", "كان الدرس الأول.", "c1-s1.a", "warm"), seg(2, "c1-s1", "ثم جاء الثاني.", "c1-s1.b", "calm"), seg(3, "c1-s2", "وهذا مشهد ثان.", "c1-s2", "documentary")],
      audioParts: [{ id: "c1-s1.a", scene: "c1-s1", segments: [1], tone: "warm" }, { id: "c1-s1.b", scene: "c1-s1", segments: [2], tone: "calm" }, { id: "c1-s2", scene: "c1-s2", segments: [3], tone: "documentary" }],
    };
    const tmapRaw = JSON.stringify(tmap, null, 1) + "\n";
    writeFileSync(path.join(dir, "tone-map.json"), tmapRaw);
    for (const s of [s1, s2]) writeFileSync(path.join(dir, "voice", `${s.id}.wav`), "x");
    writeFileSync(path.join(dir, "voice", "index.json"), JSON.stringify(Object.fromEntries([s1, s2].map((s) => [s.id, { file: `${s.id}.wav`, hash: `h-${s.id}`, text: s.narration, duration: 2, words: [] }]))));

    await runWithChannel("dafatir-alzaman", async () => {
      const st0 = await inspectSceneProduction("002");
      await decideSceneProduction("002", { action: "approve-script", expectedSha256: st0.script.sha256 }, passphrase);
      await approveStoryboard(scriptPath, tplan, { note: "راجعت لوحتي الاختبار" });
      const st1 = await inspectSceneProduction("002");
      await decideSceneProduction("002", { action: "approve-storyboard", expectedSha256: st1.storyboard.sha256 }, passphrase);
      const st2 = await inspectSceneProduction("002");
      const cur = st2.scenes[0]!;
      mkdirSync(path.join(dir, "previews"), { recursive: true });
      execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=160x90:rate=15:duration=2",
        "-f", "lavfi", "-i", "sine=frequency=330:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "-c:a", "aac", "-shortest",
        path.join(dir, "previews", "scene-c1-s1-av.mp4")]);
      await recordSceneRenderEvidence("002", "c1-s1", cur.sourceSha256, passphrase, "current");
      const sub = await decideSceneProduction("002", { action: "submit-scene", sceneId: "c1-s1", expectedSha256: cur.sourceSha256 }, passphrase);
      const preview = sub.scenes[0]!.previewSha256!;
      const otherBefore = sub.scenes[1];

      const fix = { action: "correct-scene" as const, sceneId: "c1-s1", expectedSha256: preview, note: NOTE, tone: "documentary" };
      // كلمة المرور شرط كما هي، ولا تُمس الخريطة دونها
      await expect(decideSceneProduction("002", fix, "wrong")).rejects.toThrow(/authentication/);
      await expect(decideSceneProduction("002", fix, undefined)).rejects.toThrow(/authentication/);
      // النبرة مع غير التصحيح، أو نبرة غير معروفة: مرفوضة بلا كتابة
      await expect(decideSceneProduction("002", { action: "approve-scene", sceneId: "c1-s1", expectedSha256: preview, confirmedWatched: true, tone: "warm" }, passphrase)).rejects.toThrow(/Malformed/);
      await expect(decideSceneProduction("002", { ...fix, tone: "loud" }, passphrase)).rejects.toThrow(/غير معروفة/);
      expect(readFileSync(path.join(dir, "tone-map.json"), "utf8")).toBe(tmapRaw);
      expect((await inspectSceneProduction("002")).scenes[0]!.status).toBe("in_review");

      const after = await decideSceneProduction("002", fix, passphrase);
      expect(after.scenes[0]!.status).toBe("needs_revision");
      expect(after.scenes[1]).toEqual(otherBefore);
      expect(after.recentHistory.at(-1)).toMatchObject({ action: "correct-scene", sceneId: "c1-s1", note: NOTE });
      expect(readFileSync(path.join(dir, "tone-map.v1.2.json"), "utf8")).toBe(tmapRaw);
      const v13 = JSON.parse(readFileSync(path.join(dir, "tone-map.json"), "utf8")) as ToneMapDoc;
      expect(v13.version).toBe("v1.3");
      expect(v13.audioParts.map((p) => p.tone)).toEqual(["documentary", "documentary", "documentary"]);
      expect(v13.changelog!.at(-1)).toMatchObject({ from: "v1.2", to: "v1.3", scene: "c1-s1", after: "documentary", note: NOTE,
        before: [{ part: "c1-s1.a", tone: "warm" }, { part: "c1-s1.b", tone: "calm" }] });
      const read = await inspectSceneProduction("002");
      expect(read.toneMap).toEqual({ version: "v1.3", tones: { "c1-s1": "documentary", "c1-s2": "documentary" } });
      expect(read.scenes[1]!.status).toBe(otherBefore!.status);
    });
  }, 60_000);
});
