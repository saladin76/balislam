/**
 * The test-only voice provider (stabilization brief, work ٤). NEVER a real voice and never a network call:
 * a quiet tone of the length the sentence would take, with deterministic per-character timings, so the whole
 * sentence → scene → assembly → Master path runs in CI without a key or credit.
 *
 * It is only reachable through `elevenLabsFromEnv()` with BAL_VOICE_PROVIDER=fake, which refuses outside a test
 * run (VITEST or BAL_E2E=1) and beside a real key (provider.ts `assertFakeVoiceAllowed`). The Quran guard runs in
 * the client BEFORE any provider call (elevenlabs.ts `bodyFor`), so a verse never reaches this file either.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { assertFakeVoiceAllowed, type Alignment, type TtsBody, type VoiceProvider } from "./provider";

const run = promisify(execFile);
export const FAKE_VOICE_ID = "fake-test-voice";

/** Seconds per spoken word, and the quiet lead/tail around them (deterministic). */
const WORD_SEC = 0.42;
const LEAD = 0.12;
const TAIL = 0.18;
/** Performance tags such as «[calm]» are not spoken (models.ts withDirection): no time for them. */
const spokenText = (text: string) => text.replace(/\[[^\]]*\]\s*/g, "").trim();

/** How long the fake sentence lasts: its words at a steady pace, plus the lead and tail. */
export const fakeDurationFor = (text: string) => {
  const n = spokenText(text).split(/\s+/).filter(Boolean).length;
  return Math.round((LEAD + Math.max(1, n) * WORD_SEC + TAIL) * 1000) / 1000;
};

/**
 * Every character of the text a time; the words are spaced evenly between the lead and the tail. A performance tag «[…]»
 * takes no time (as with the real provider, where the tag is not spoken), so the first word starts at the lead.
 */
export const fakeAlignment = (text: string): Alignment => {
  const chars = [...text];
  const duration = fakeDurationFor(text);
  let depth = 0;
  const spoken = chars.map((ch) => { if (ch === "[") depth++; const on = depth === 0; if (ch === "]") depth = Math.max(0, depth - 1); return on; });
  // the space right after a tag is not spoken either
  for (let i = 0; i < chars.length && (!spoken[i] || /\s/.test(chars[i]!)); i++) spoken[i] = false;
  const n = spoken.filter(Boolean).length;
  const span = duration - LEAD - TAIL;
  const per = n ? span / n : 0;
  const r = (x: number) => Math.round(x * 1000) / 1000;
  const start: number[] = [], end: number[] = [];
  let k = 0;
  for (const on of spoken) {
    start.push(r(LEAD + k * per));
    if (on) k++;
    end.push(r(LEAD + k * per));
  }
  return { characters: chars, character_start_times_seconds: start, character_end_times_seconds: end };
};

/**
 * A tone like a real take (never silence: the audio checks expect a voice track) of `seconds`, as MP3 44.1 kHz: the tone sounds
 * only between the lead and the tail (where the words are), over a faint room tone (about −66 dBFS) for the whole file, as a
 * recording has before its first and after its last word. So the seam checks measure real silences, not a tone that never stops.
 */
export const fakeToneMp3 = async (seconds: number, freq = 220): Promise<Buffer> => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bal-fake-voice-"));
  const out = path.join(dir, "tone.mp3");
  const on = seconds > LEAD + TAIL ? `between(t,${LEAD},${Math.round((seconds - TAIL) * 1000) / 1000})` : "1";
  try {
    await run("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", `aevalsrc='0.25*sin(2*PI*${freq}*t)*${on}+0.0005*(2*random(0)-1)':s=44100:d=${seconds}`,
      "-ac", "1", "-c:a", "libmp3lame", "-b:a", "64k", "-map_metadata", "-1", out]);
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

/** body: the whole request as it would go to the provider (settings, seed, neighbours), for tests to read. */
export type FakeVoiceCall = { kind: "speak" | "plain" | "sfx"; voiceId?: string; text: string; body?: TtsBody };

/** The fake provider. `calls` records every request it received (tests read it). */
export const fakeVoiceProvider = (): VoiceProvider & { calls: FakeVoiceCall[] } => {
  assertFakeVoiceAllowed();
  const calls: FakeVoiceCall[] = (globalThis as { __balFakeVoiceCalls?: FakeVoiceCall[] }).__balFakeVoiceCalls ?? [];
  return {
    name: "fake",
    calls,
    speak: async (voiceId: string, body: TtsBody, model: string) => {
      calls.push({ kind: "speak", voiceId, text: body.text, body });
      const audio = await fakeToneMp3(fakeDurationFor(body.text));
      return { audio, alignment: fakeAlignment(body.text), model };
    },
    speakPlain: async (voiceId: string, body: TtsBody) => {
      calls.push({ kind: "plain", voiceId, text: body.text, body });
      return fakeToneMp3(fakeDurationFor(body.text));
    },
    soundEffect: async (body) => {
      calls.push({ kind: "sfx", text: body.text });
      return fakeToneMp3(body.duration_seconds ?? 1, 440);
    },
    get: async <T>(p: string): Promise<T> => {
      if (p.startsWith("/v1/voices/")) return { voice_id: FAKE_VOICE_ID, name: "صوت الاختبار", category: "cloned" } as T;
      if (p === "/v1/voices") return { voices: [{ voice_id: FAKE_VOICE_ID, name: "صوت الاختبار", category: "cloned" }] } as T;
      if (p === "/v1/models") return [] as T;
      if (p === "/v1/user/subscription") return { tier: "test", character_count: 0, character_limit: 0 } as T;
      throw new Error(`fake voice: no ${p}`);
    },
  };
};
