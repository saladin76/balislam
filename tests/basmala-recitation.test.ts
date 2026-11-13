/**
 * The basmala (owner decision, 10 Nov 2026): «بسم الله الرحمن الرحيم» is treated like a verse in the three
 * channels. The owner records it himself; the cloned voice never says it — not alone, not inside a sentence,
 * not as context. A mixed sentence is split: the basmala is its own recitation item, the rest stays narration.
 * Until the recording is approved the scene is composed with a marked silent placeholder (D35 gates).
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encodeWav } from "../src/remotion/dafatir/audio/compose";
import type { ElevenLabsClient } from "../src/voice/elevenlabs";
import type { Plan } from "../src/plan/types";
import { basmalaSpans, hasBasmala, isBasmalaOnly, splitBasmala, withoutBasmala } from "../src/voice/basmala";
import { assertNoQuranForTts, isQuranFreeForTts, ttsContext } from "../src/voice/quranGuard";
import { sentencesFor, splitBasmalaInList, splitNarration } from "../src/voice/sentences";

const src = (f: string) => readFileSync(path.join(import.meta.dirname, "..", f), "utf8");

describe("detection and the TTS guard", () => {
  const forms = [
    "بسم الله الرحمن الرحيم",
    "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
    "بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ.",
    "بسم الله الرحمان الرحيم،",
    "«بسم الله الرحمن الرحيم»",
    "وبسمِ اللهِ الرحمنِ الرحيمِ",
  ];
  it.each(forms)("refuses «%s», alone or inside a sentence", (b) => {
    expect(hasBasmala(b)).toBe(true);
    expect(() => assertNoQuranForTts(b)).toThrow(/البسملة/);
    expect(isQuranFreeForTts(`قال الشيخ: ${b} ثم بدأ الدرس.`)).toBe(false);
  });
  it("leaves other uses of the words alone", () => {
    expect(hasBasmala("باسم الله نبدأ")).toBe(false);
    expect(hasBasmala("الله الرحمن الرحيم بعباده")).toBe(false);
    expect(isQuranFreeForTts("نبدأ على بركة الله.")).toBe(true);
  });
  it("is cut out of the neighbouring context", () => {
    expect(ttsContext("بسم الله الرحمن الرحيم. نبدأ الحكاية.")).toBe("نبدأ الحكاية.");
    expect(ttsContext("بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ")).toBeUndefined();
    expect(withoutBasmala("أ بسم الله الرحمن الرحيم ب")).toBe("أ ب");
  });
});

describe("a mixed sentence is split into its own recitation item", () => {
  it("keeps every word in order and marks the kinds", () => {
    const text = "قال المعلم بسم الله الرحمن الرحيم ثم بدأ الدرس. وبعدها جملة.";
    expect(splitBasmala("قال المعلم بسم الله الرحمن الرحيم ثم بدأ الدرس.")).toEqual(["قال المعلم", "بسم الله الرحمن الرحيم", "ثم بدأ الدرس."]);
    const s = sentencesFor("c1-s1", text);
    expect(s.map((x) => x.text).join(" ")).toBe(text);
    expect(s.map((x) => x.kind)).toEqual(["narration", "basmala", "narration", "narration"]);
    expect(splitNarration("بسم الله الرحمن الرحيم.")).toEqual(["بسم الله الرحمن الرحيم."]);
    expect(isBasmalaOnly("بسم الله الرحمن الرحيم.")).toBe(true);
    expect(basmalaSpans("أ بسم الله الرحمن الرحيم ب بسم الله الرحمن الرحيم")).toEqual([[1, 5], [6, 10]]);
  });
  it("an edited sentence that now holds the basmala is split, its old take kept", () => {
    const audio = { file: "a.wav", fingerprint: "f", context: "c", duration: 1, words: [], at: "", origin: "tts" as const };
    let k = 0;
    const out = splitBasmalaInList([{ id: "x", sceneId: "c1-s1", kind: "narration", text: "نبدأ: بسم الله الرحمن الرحيم", pauseAfterMs: 400, audio }], () => `n${k++}`);
    expect(out.map((s) => [s.id, s.kind, s.text])).toEqual([["x", "narration", "نبدأ:"], ["n0", "basmala", "بسم الله الرحمن الرحيم"]]);
    expect(out[0]!.audio).toBeUndefined();
    expect(out[0]!.takes?.[0]?.file).toBe("a.wav");
    expect(out[1]!.pauseAfterMs).toBe(400);
  });
});

// ── the sentence voice path, with a fake client (no keys, no network) ─────────────────────────────
const ENV = ["BAL_CHANNELS_DIR", "BAL_CHANNEL", "ELEVENLABS_MODEL_ID", "BAL_WORKFLOW_HMAC_KEY", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID"] as const;
const saved: Record<string, string | undefined> = {};
let tmp = "";
const SR = 44100;
const MIXED = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ وَنَبْدَأُ الحِكَايَةَ.";
const ONLY = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ.";
const EP = () => path.join(tmp, "balislam", "episodes", "986-basmala");
const plan = (): Plan => ({
  episode: "986", title: "بسملة", tone: "calm",
  chapters: [{ number: 1, title: "تجربة", scenes: [
    { id: "c1-s1", template: "alley-tale", line: 6, narration: ONLY, sfx: [], props: {} },
    { id: "c1-s2", template: "alley-tale", line: 8, narration: MIXED, sfx: [], props: {} },
  ] }],
} as unknown as Plan);
const sent: string[] = [];
const client = {
  modelId: "mock",
  tts: async (text: string) => {
    sent.push(text);
    const n = Math.round(1.2 * SR);
    const s = new Float32Array(n);
    for (let k = Math.round(0.2 * SR); k < Math.round(1.0 * SR); k++) s[k] = Math.sin(2 * Math.PI * 160 * k / SR) * 0.3;
    const chars = [...text];
    return { audio: Buffer.from(encodeWav(s, SR)), model: "mock", alignment: { characters: chars,
      character_start_times_seconds: chars.map((_, i) => 0.2 + (i * 0.8) / chars.length),
      character_end_times_seconds: chars.map((_, i) => 0.2 + ((i + 1) * 0.8) / chars.length) } };
  },
  soundEffect: async () => Buffer.alloc(0), account: async () => ({}) as never, voices: async () => [],
} as unknown as ElevenLabsClient;

beforeAll(() => {
  for (const k of ENV) saved[k] = process.env[k];
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-basmala-"));
  cpSync(path.join("channels", "balislam"), path.join(tmp, "balislam"), { recursive: true, filter: (s) => !/[\\/]episodes([\\/]|$)/.test(s) });
  process.env.BAL_CHANNELS_DIR = tmp;
  process.env.BAL_CHANNEL = "balislam";
  process.env.ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";
  process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__basmala_signing_key_2026";
  delete process.env.ELEVENLABS_API_KEY;
  mkdirSync(path.join(EP(), "voice"), { recursive: true });
  writeFileSync(path.join(EP(), "script.md"), `---\ntitle: "بسملة"\nepisode: "986"\n---\n## الفصل 1 · تجربة\n${ONLY}\n\n${MIXED}\n`);
  writeFileSync(path.join(EP(), "plan.json"), JSON.stringify(plan(), null, 2) + "\n");
  writeFileSync(path.join(EP(), "tashkeel.md"), `${ONLY}\n\n${MIXED}\n`);
});
afterAll(() => {
  for (const k of ENV) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

describe("the basmala in the sentence path", () => {
  it("scenes holding it are voiced sentence by sentence; the whole-scene path never takes them", async () => {
    const sv = await import("../src/voice/sentenceVoice");
    const managed = await sv.sentenceManagedScenes(path.join(EP(), "script.md"));
    expect([...managed].sort()).toEqual(["c1-s1", "c1-s2"]);
    const { scenesNeedingVoice } = await import("../src/studio/prepareAll");
    expect(await scenesNeedingVoice("986")).toEqual([]);
  });
  it("«ولّد» on the basmala row is refused; the narration around it is voiced without it", async () => {
    const sv = await import("../src/voice/sentenceVoice");
    const init = await sv.sentenceAction("986", { action: "init", sceneId: "c1-s2" });
    const rows = init.read.scenes.find((s) => s.id === "c1-s2")!.rows;
    expect(rows.map((r) => r.kind)).toEqual(["basmala", "narration"]);
    await expect(sv.sentenceAction("986", { action: "generate", id: rows[0]!.id }, { client, testOnlySkipApprovalGates: true }))
      .rejects.toThrow(/البسملة/);
    const r = await sv.sentenceAction("986", { action: "generate", id: rows[1]!.id }, { client, testOnlySkipApprovalGates: true });
    expect(sent).toHaveLength(1);
    expect(hasBasmala(sent[0]!)).toBe(false);
    // Composed at once with the marked placeholder (the owner's recording is not approved yet).
    expect(r.composed?.composed).toBe(true);
    const index = JSON.parse(readFileSync(path.join(EP(), "voice", "index.json"), "utf8"));
    expect(index["c1-s2"].text).toBe(MIXED);
    expect(index["c1-s2"].basmala).toEqual({ pending: true, sha256: null });
  });
  it("a scene that is only the basmala needs no voice at all: composed with its placeholder", async () => {
    const sv = await import("../src/voice/sentenceVoice");
    const done = await sv.recomposeBasmalaScenes("986");
    expect(done).toContain("c1-s1");
    const index = JSON.parse(readFileSync(path.join(EP(), "voice", "index.json"), "utf8"));
    expect(index["c1-s1"].basmala.pending).toBe(true);
    expect(index["c1-s1"].duration).toBeGreaterThan(3);
    expect(sent).toHaveLength(1);
  });
});

describe("the D35 gates and the Studio", () => {
  it("pending basmala: conditional approval only, a marked draft, no Master", () => {
    expect(src("src/studio/sceneInputs.ts")).toMatch(/basmala \? manual\[BASMALA_KEY\]/);
    expect(src("src/render/shotsPreview.ts")).toContain("media.voice[s.id]?.basmala?.pending === true");
    expect(src("src/render/episode.ts")).toContain("والبسملة بلا تسجيلك المعتمد");
    expect(src("src/remotion/scenes/Episode.tsx")).toContain("media.voice[scene.id]?.basmala?.pending");
  });
  it("its row says «ارفع التسجيل» through the recitation flow, one recording for every scene", () => {
    const panel = src("app/src/workspace/SentencesPanel.tsx");
    expect(panel).toContain('ayahKey="basmala"');
    expect(src("src/quran/manualAudio.ts")).toContain("if (key === BASMALA_KEY) return BASMALA_TEXT;");
    expect(src("app/server/api.ts")).toContain("recomposeBasmalaScenes(ep)");
  });
});
