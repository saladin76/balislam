import config from "../config.json";
import { cpSync, mkdtempSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { generateVoice } from "../src/voice/generate";
import { regeneratePlan } from "../src/plan/io";
import { applyDictionary } from "../src/voice/words";
import { parseScript } from "../src/script/parse";
import type { ElevenLabsClient } from "../src/voice/elevenlabs";

let tmp = "";
let calls = 0;
const mock = {
  modelId: "mock",
  tts: async (text: string) => {
    calls++;
    const chars = [...text];
    return {
      audio: Buffer.from(`fake-${text}`),
      alignment: { characters: chars, character_start_times_seconds: chars.map((_, i) => i * 0.05), character_end_times_seconds: chars.map((_, i) => (i + 1) * 0.05) },
    };
  },
  soundEffect: async () => Buffer.alloc(0),
  account: async () => ({}) as never,
  voices: async () => [],
} as unknown as ElevenLabsClient;

beforeAll(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-voice-"));
  cpSync(path.join(__dirname, "..", "channels", "balislam"), path.join(tmp, "balislam"), { recursive: true, filter: (s) => !/[\\/](voice|out)([\\/]|$)/.test(s) });
  // الحلقة التجريبية للاختبارات (القنوات نفسها تبدأ بلا حلقات)
  cpSync(path.join(__dirname, "fixtures", "episodes", "000-demo"), path.join(tmp, "balislam", "episodes", "000-demo"), { recursive: true });
  process.env.BAL_CHANNELS_DIR = tmp;
  process.env.BAL_CHANNEL = "balislam";
});
afterAll(() => {
  delete process.env.BAL_CHANNELS_DIR;
  delete process.env.BAL_CHANNEL;
});

describe("ذاكرة الصوت", () => {
  it("إضافة فقرة لا تعيد توليد المشاهد التي انزاحت أرقامها", async () => {
    await regeneratePlan("000");
    const first = await generateVoice("000", { client: mock });
    expect(calls).toBe(first.toGenerate.length);
    const scriptFile = path.join(tmp, "balislam", "episodes", "000-demo", "script.md");
    const text = readFileSync(scriptFile, "utf8");
    const para = parseScript(text).chapters[1]!.blocks.find((b) => b.kind === "narration") as { text: string };
    writeFileSync(scriptFile, text.replace(para.text, `فقرة جديدة تمامًا هنا.\n\n${para.text}`));
    await regeneratePlan("000");
    const dry = await generateVoice("000", { client: mock, dryRun: true });
    expect(dry.toGenerate.length).toBe(1);
    await generateVoice("000", { client: mock });
    expect(calls).toBe(first.toGenerate.length + 1);
    // لا ملفات يتيمة: كل mp3 يشير إليه مشهد
    const dir = path.join(tmp, "balislam", "episodes", "000-demo", "voice");
    const index = JSON.parse(readFileSync(path.join(dir, "index.json"), "utf8")) as Record<string, { file: string }>;
    const used = new Set(Object.values(index).map((c) => c.file));
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".mp3"))) expect(used.has(f), f).toBe(true);
  });

  it("النبرة وصوت الشخصية يعيدان توليد مشهدهما فقط، ويصلان إلى ElevenLabs", async () => {
    const { readPlanFile, writePlanFile, planPathFor } = await import("../src/plan/io");
    const { resolveScriptPath } = await import("../src/script/episodes");
    const sp = await resolveScriptPath("000");
    const plan = (await readPlanFile(sp))!;
    const scene = plan.chapters[0]!.scenes.find((s) => s.narration)!;
    scene.tone = "dramatic";
    scene.voice = "voice-commander";
    await writePlanFile(planPathFor(sp), plan);
    const seen: { voiceId?: string; tune?: { speed: number } }[] = [];
    const spy = { ...mock, tts: async (t: string, ctx: { voiceId?: string; tune?: { speed: number } } = {}) => { seen.push(ctx); return mock.tts(t, ctx as never); } } as unknown as ElevenLabsClient;
    const dry = await generateVoice("000", { client: spy, dryRun: true });
    expect(dry.toGenerate.map((x) => x.id)).toEqual([scene.id]);
    await generateVoice("000", { client: spy });
    expect(seen).toHaveLength(1);
    expect(seen[0]!.voiceId).toBe("voice-commander");
    expect(seen[0]!.tune?.speed).toBe(Math.round(0.96 * config.voice.speed * 100) / 100);
    // تبقى بعد إعادة توليد الخطة من السكريبت
    const again = await regeneratePlan("000");
    const kept = again.chapters[0]!.scenes.find((s) => s.id === scene.id)!;
    expect([kept.tone, kept.voice]).toEqual(["dramatic", "voice-commander"]);
  });

  it("القاموس يعمل مع علامات الترقيم اللاتينية والعربية", () => {
    const dict = { entries: [{ text: "Allah", say: "Al-lah" }, { text: "الله", say: "اللّاه" }] };
    expect(applyDictionary("Allah, is great.", dict).spoken).toBe("Al-lah, is great.");
    expect(applyDictionary("قال الله؟", dict).spoken).toBe("قال اللّاه؟");
  });

  it("العنوان الفرعي ### لا يحذف النص بعده", () => {
    const s = readFileSync(path.join(__dirname, "fixtures", "valid.md"), "utf8");
    const before = parseScript(s).chapters[1]!.blocks.length;
    const after = parseScript(s.replace("التأجيل لا يبدأ من الكسل.", "### ملاحظة\n\nالتأجيل لا يبدأ من الكسل.")).chapters[1]!.blocks.length;
    expect(after).toBe(before);
  });
});

describe("التشكيل للنطق", () => {
  it("يشكّل كلمات التعليق من ملف التشكيل ويُبقي ترقيم السكريبت، ويتجاوز ما لا نظير له", async () => {
    const { buildTashkeelIndex, vowelize } = await import("../src/voice/tashkeel");
    const idx = buildTashkeelIndex("عنوان\n\nﭐلْفَصْلُ\n\nتَخَيَّلْ شَخْصَيْنِ يُشَاهِدَانِ الْمَوْقِفَ نَفْسَهُ.\n\n﴿آيَةٌ﴾\n\nمَعْرِفَةَ الْخَطَإِ وَحْدَهَا");
    const w = "تخيل شخصين يشاهدان الموقف نفسه، وكلمة جديدة".split(" ");
    expect(vowelize(w, idx)).toEqual(["تَخَيَّلْ", "شَخْصَيْنِ", "يُشَاهِدَانِ", "الْمَوْقِفَ", "نَفْسَهُ،", undefined, undefined]);
    // صور الهمزة المختلفة تتطابق
    expect(vowelize("معرفة الخطأ وحدها".split(" "), idx)).toEqual(["مَعْرِفَةَ", "الْخَطَإِ", "وَحْدَهَا"]);
    const { applyDictionary } = await import("../src/voice/words");
    const d = applyDictionary("الموقف نفسه", { entries: [{ text: "نفسه", say: "ذاته" }] }, ["الْمَوْقِفَ", "نَفْسَهُ"]);
    expect(d.spoken).toBe("الْمَوْقِفَ ذاته");
    expect(d.original).toEqual(["الموقف", "نفسه"]);
  });
});
