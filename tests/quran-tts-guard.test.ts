/**
 * C1 (security QA, 10 Nov): the cloned voice never recites Quran. One guard (src/voice/quranGuard.ts) sits
 * inside the ElevenLabs client, so EVERY TTS path goes through it; verse scenes never produce jobs; ﴿…﴾
 * spans and verse-card text are never sent, not even as previous_text / next_text; both pronunciation
 * lexicons are masked inside verses.
 */
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assertNoQuranForTts, isVerseScene, QuranTtsError, ttsContext, planVerseTexts, quranMask } from "../src/voice/quranGuard";
import { createElevenLabs, type ElevenLabsClient } from "../src/voice/elevenlabs";
import { applyDictionary } from "../src/voice/words";
import { applyLexicon } from "../src/voice/lexicon";

const repo = path.resolve(__dirname, "..");
const VERSE = "وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ";

describe("assertNoQuranForTts / ttsContext", () => {
  it("refuses verse scenes, ﴿ ﴾, [آية] markers and five words of a known verse; passes ordinary narration", () => {
    expect(() => assertNoQuranForTts("أي نص", { id: "c1-s2", template: "verse-card" })).toThrow(QuranTtsError);
    expect(() => assertNoQuranForTts("أي نص", { id: "x", template: "big-question", ayahKey: "53:39" })).toThrow(QuranTtsError);
    expect(() => assertNoQuranForTts("قال تعالى ﴿وأن ليس للإنسان﴾")).toThrow(QuranTtsError);
    expect(() => assertNoQuranForTts("قال تعالى ﴾")).toThrow(QuranTtsError);
    expect(() => assertNoQuranForTts("[آية: النجم 39]")).toThrow(QuranTtsError);
    // the verse written without brackets and without tashkeel is still the verse
    expect(() => assertNoQuranForTts("وأن ليس للانسان الا ما سعى فاعمل", null, { verses: [VERSE] })).toThrow(QuranTtsError);
    expect(() => assertNoQuranForTts("الصبر مفتاح الفرج، وليس للكسول إلا الندم.", null, { verses: [VERSE] })).not.toThrow();
    expect(() => assertNoQuranForTts("قال الله تعالى في كتابه الكريم:", { template: "verse-intro" })).not.toThrow();
    expect(isVerseScene({ template: "verse-card" })).toBe(true);
    expect(isVerseScene({ template: "verse-intro" })).toBe(false);
  });

  it("context never carries Quran: spans cut, verse scenes and verse-only context dropped", () => {
    expect(ttsContext("قبلها ﴿وأن ليس للإنسان إلا ما سعى﴾ وبعدها")).toBe("قبلها وبعدها");
    expect(ttsContext("[آية: النجم 39 | نص] ثم كلام")).toBe("ثم كلام");
    expect(ttsContext("﴿وأن ليس للإنسان إلا ما سعى﴾")).toBeUndefined();
    expect(ttsContext("نص المشهد", { template: "verse-card" })).toBeUndefined();
    expect(ttsContext(VERSE, null, [VERSE])).toBeUndefined();
    expect(ttsContext("كلام عادي", null, [VERSE])).toBe("كلام عادي");
    expect(planVerseTexts({ chapters: [{ scenes: [{ template: "verse-card", ayahKey: "53:39", props: { text: VERSE } }, { template: "big-question", props: { text: "x" } }] }] })).toEqual([VERSE]);
  });

  it("both lexicons are masked inside ﴿ ﴾ (legacy pronunciation.json and pronunciations.json)", () => {
    const text = "الصبر ﴿ ليس للإنسان ﴾ الصبر";
    const d = applyDictionary(text, { entries: [{ text: "ليس", say: "لَيْسَا" }, { text: "الصبر", say: "الصَّبْرُ" }] });
    expect(d.spoken.split(" ")).toEqual(["الصَّبْرُ", "﴿", "ليس", "للإنسان", "﴾", "الصَّبْرُ"]);
    const words = text.split(" ");
    expect(quranMask(words)).toEqual([false, true, true, true, true, false]);
    const l = applyLexicon(words, words, words.map((_, i) => i), [{ word: "للإنسان", say: "لِلْإِنْسَانِ", at: "" }]);
    expect(l.spoken).toEqual(words);
  });
});

describe("the ElevenLabs client runs the guard before any request", () => {
  const fake = () => {
    const bodies: any[] = [];
    const fetchImpl = (async (_url: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ audio_base64: Buffer.from("x").toString("base64"), alignment: null }), { status: 200 });
    }) as unknown as typeof fetch;
    return { bodies, client: createElevenLabs({ apiKey: "test-only", voiceId: "v", modelId: "eleven_multilingual_v2", fetchImpl }) };
  };

  it("tts / sample / soundEffect refuse Quran and send nothing", async () => {
    const { bodies, client } = fake();
    await expect(client.tts("قال تعالى ﴿وأن ليس للإنسان إلا ما سعى﴾")).rejects.toBeInstanceOf(QuranTtsError);
    await expect(client.tts("نص", { scene: { id: "c1-s2", template: "verse-card" } })).rejects.toBeInstanceOf(QuranTtsError);
    await expect(client.tts("وأن ليس للإنسان إلا ما سعى", { verses: [VERSE] })).rejects.toBeInstanceOf(QuranTtsError);
    await expect(client.sample("﴿قل هو الله أحد﴾")).rejects.toBeInstanceOf(QuranTtsError);
    await expect(client.soundEffect("[آية: الإخلاص 1]")).rejects.toBeInstanceOf(QuranTtsError);
    expect(bodies).toHaveLength(0);
  });

  it("strips Quran from previous_text / next_text", async () => {
    const { bodies, client } = fake();
    await client.tts("الصبر مفتاح الفرج.", {
      previousText: "مقدمة ﴿وأن ليس للإنسان إلا ما سعى﴾", nextText: VERSE, verses: [VERSE],
    });
    expect(bodies).toHaveLength(1);
    expect(bodies[0].text).toBe("الصبر مفتاح الفرج.");
    expect(bodies[0].previous_text).toBe("مقدمة");
    expect(bodies[0].next_text).toBeUndefined();
    await client.tts("نص عادي", { previousText: "قبل", previousScene: { template: "verse-card" }, nextText: "بعد" });
    expect(bodies[1].previous_text).toBeUndefined();
    expect(bodies[1].next_text).toBe("بعد");
  });
});

describe("generateVoice: verse scenes never produce jobs; verse text never reaches the client", () => {
  let tmp = "";
  beforeAll(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "bal-quran-tts-"));
    cpSync(path.join(repo, "channels", "balislam"), path.join(tmp, "balislam"), { recursive: true, filter: (s) => !/[\\/](episodes|voice|out|recitations)([\\/]|$)/.test(s) });
    mkdirSync(path.join(tmp, "balislam", "episodes"), { recursive: true });
    cpSync(path.join(__dirname, "fixtures", "episodes", "000-demo"), path.join(tmp, "balislam", "episodes", "000-demo"), { recursive: true });
    process.env.BAL_CHANNELS_DIR = tmp;
    process.env.BAL_CHANNEL = "balislam";
    process.env.ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
  });
  afterAll(() => {
    delete process.env.BAL_CHANNELS_DIR; delete process.env.BAL_CHANNEL; delete process.env.ELEVENLABS_MODEL_ID;
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  it("skips the verse scene, refuses a narration carrying ﴿…﴾, and never sends verse text as context", async () => {
    const { regeneratePlan, readPlanFile, writePlanFile, planPathFor } = await import("../src/plan/io");
    const { resolveScriptPath } = await import("../src/script/episodes");
    const { generateVoice } = await import("../src/voice/generate");
    await regeneratePlan("000");
    const sp = await resolveScriptPath("000");
    const plan = (await readPlanFile(sp))!;
    const scenes = plan.chapters.flatMap((c) => c.scenes);
    const k = scenes.findIndex((s) => s.template === "verse-card");
    expect(k).toBeGreaterThan(0);
    const verseText = String(scenes[k]!.props.text);
    expect(verseText.length).toBeGreaterThan(5);
    // An edited verse scene with narration (the QA probe) — still never voiced.
    scenes[k]!.narration = verseText;
    await writePlanFile(planPathFor(sp), plan);

    const sent: { text: string; ctx: any }[] = [];
    const spy = {
      modelId: "mock",
      tts: async (text: string, ctx: any = {}) => {
        sent.push({ text, ctx });
        const chars = [...text];
        return { audio: Buffer.from("x"), alignment: { characters: chars, character_start_times_seconds: chars.map((_, i) => i * 0.05), character_end_times_seconds: chars.map((_, i) => (i + 1) * 0.05) } };
      },
    } as unknown as ElevenLabsClient;
    const dry = await generateVoice("000", { client: spy, dryRun: true });
    expect(dry.toGenerate.map((t) => t.id)).not.toContain(scenes[k]!.id);
    await generateVoice("000", { client: spy, testOnlySkipGates: true });
    expect(sent.length).toBeGreaterThan(0);
    const norm = (s: string) => s.replace(/[ً-ٰٟ]/g, "");
    for (const s of sent) {
      for (const t of [s.text, s.ctx.previousText ?? "", s.ctx.nextText ?? ""]) {
        expect(t).not.toMatch(/[﴿﴾]/);
        expect(norm(t)).not.toContain(norm(verseText).split(/\s+/).slice(0, 4).join(" "));
      }
    }

    // A narration carrying ﴿…﴾ is listed by the dry run and refused by a real run.
    const other = scenes.find((s) => s.narration.trim() && s.template !== "verse-card")!;
    other.narration = `${other.narration} ﴿وأن ليس للإنسان إلا ما سعى﴾`;
    scenes[k]!.narration = "";
    await writePlanFile(planPathFor(sp), plan);
    const dry2 = await generateVoice("000", { client: spy, dryRun: true });
    expect(dry2.quranRefused).toContain(other.id);
    await expect(generateVoice("000", { client: spy, testOnlySkipGates: true, only: [other.id] })).rejects.toBeInstanceOf(QuranTtsError);
  });
});

describe("every TTS call site goes through the guard", () => {
  const SOURCE_DIRS = ["src", "app", "bin", "scripts", "tools"];
  const files = (dir: string): string[] => {
    const abs = path.join(repo, dir);
    let out: string[] = [];
    try { statSync(abs); } catch { return out; }
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) out = out.concat(files(rel));
      else if (/\.(ts|tsx|mts|mjs|js|cjs)$/.test(e.name)) out.push(rel);
    }
    return out;
  };
  const all = SOURCE_DIRS.flatMap(files).map((f) => ({ f, src: readFileSync(path.join(repo, f), "utf8") }));

  it("only the client talks to the voice service", () => {
    const talk = all.filter(({ src }) => /api\.elevenlabs\.io|\/v1\/text-to-speech|\/v1\/sound-generation/.test(src)).map(({ f }) => f);
    expect(talk).toEqual([path.join("src", "voice", "elevenlabs.ts")]);
  });

  it("inside the client every TTS / sound request body is built after the guard", () => {
    const src = readFileSync(path.join(repo, "src", "voice", "elevenlabs.ts"), "utf8");
    // every text-to-speech post builds its body with bodyFor
    const posts = [...src.matchAll(/post\(`\/v1\/text-to-speech[^;]*;/g)].map((m) => m[0]);
    expect(posts.length).toBeGreaterThanOrEqual(3);
    for (const p of posts) expect(p, p).toMatch(/,\s*(body|bodyFor\()/);
    expect(src).toMatch(/const body = bodyFor\(/);
    // bodyFor starts with the guard and builds the context with ttsContext
    const bodyFor = src.slice(src.indexOf("const bodyFor = "), src.indexOf("const caps = capsFor(model);", src.indexOf("const bodyFor = ")));
    expect(bodyFor).toMatch(/assertNoQuranForTts\(text/);
    expect(bodyFor).toMatch(/ttsContext\(ctx\.previousText/);
    expect(bodyFor).toMatch(/ttsContext\(ctx\.nextText/);
    const at = src.indexOf("const soundEffect = ");
    const sfx = src.slice(at, src.indexOf("/v1/sound-generation", at));
    expect(sfx).toMatch(/assertNoQuranForTts\(/);
  });

  it("the call sites are known (a new one must be added here after review)", () => {
    const calls = all.filter(({ f, src }) => f !== path.join("src", "voice", "elevenlabs.ts") && /\.(tts|sample|soundEffect)\(/.test(src)).map(({ f }) => f).sort();
    expect(calls).toEqual([
      path.join("app", "server", "extra.ts"), // voice sample (also checked before the client)
      path.join("src", "voice", "generate.ts"), // scenes, dafatir parts, preview lines (synthesizeLines)
      path.join("src", "voice", "sentenceVoice.ts"), // one sentence, word fix
      path.join("src", "voice", "sfx.ts"), // sound effects
    ].sort());
    // and each of them only receives a client created by createElevenLabs (elevenLabsFromEnv or tests' fakes)
    const created = all.filter(({ src }) => /createElevenLabs\(/.test(src)).map(({ f }) => f).sort();
    expect(created).toEqual([path.join("app", "server", "extra.ts"), path.join("src", "voice", "elevenlabs.ts")].sort());
  });
});
