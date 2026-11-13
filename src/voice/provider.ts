/**
 * The voice provider seam (stabilization brief, work ٤): the ONE place a TTS request leaves the Studio.
 *
 * Everything above it is unchanged: the client in elevenlabs.ts builds the request body (and runs the single
 * Quran guard `assertNoQuranForTts` while building it), then hands the finished body to a provider. So a
 * provider can never see a verse, a ﴿…﴾ span or the basmala: the guard has already refused before it is called.
 *
 * Two providers:
 * - `elevenLabsHttpProvider`: the real HTTP calls, exactly as before (moved here from elevenlabs.ts, no change).
 * - `fakeVoiceProvider` (src/voice/fakeVoice.ts): tests only. Selected by BAL_VOICE_PROVIDER=fake, and refused
 *   anywhere else (`assertFakeVoiceAllowed`): it needs a test runner (VITEST) or the explicit e2e flag
 *   (BAL_E2E=1), AND no real voice key in the environment, so it can never stand in for paid voice on the
 *   owner's machine nor run next to a real key.
 */

/** Timing of each character, as ElevenLabs returns it. */
export type Alignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

/** alignment غائب إن لم يُرجع النموذج توقيتًا (يُقدَّر بعدها من مدة الملف) */
export type TtsResult = { audio: Buffer; alignment: Alignment | null; model: string };

/** A request body already built and already checked by the Quran guard. */
export type TtsBody = { text: string; model_id: string; voice_settings: Record<string, unknown>; seed?: number; previous_text?: string; next_text?: string };

export class ElevenLabsError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

export type VoiceProvider = {
  /** "elevenlabs" or "fake" (shown nowhere to the owner; for tests and logs). */
  readonly name: "elevenlabs" | "fake";
  /** Speech with per-character timing (alignment null when the model gives none). */
  speak(voiceId: string, body: TtsBody, model: string): Promise<TtsResult>;
  /** Speech without timing (voice samples). */
  speakPlain(voiceId: string, body: TtsBody): Promise<Buffer>;
  /** A sound effect from a text description. */
  soundEffect(body: { text: string; duration_seconds?: number; prompt_influence: number }): Promise<Buffer>;
  /** Read-only account calls (subscription, voices, models, one voice). */
  get<T>(path: string): Promise<T>;
};

const BASE = "https://api.elevenlabs.io";

const explain = (status: number, body: string) => {
  if (status === 401) return "مفتاح ElevenLabs غير صحيح أو منتهي (ELEVENLABS_API_KEY).";
  if (status === 404) return "الصوت غير موجود: تأكد من ELEVENLABS_VOICE_ID.";
  if (status === 429) return "تجاوزت حد الطلبات أو نفد الرصيد في ElevenLabs. انتظر قليلًا أو راجع رصيدك.";
  if (status === 422) return `ElevenLabs رفض الطلب: ${body.slice(0, 200)}`;
  if (body.includes("voice_not_fine_tuned"))
    return "الصوت الاحترافي ما زال قيد التدريب في ElevenLabs (Fine-tuning in progress). انتظر حتى ينتهي التدريب ثم أعد التوليد.";
  return `ElevenLabs أعاد خطأ ${status}: ${body.slice(0, 200)}`;
};

/** The real provider: the ElevenLabs HTTP API (unchanged behaviour, moved from elevenlabs.ts). */
export const elevenLabsHttpProvider = (opts: { apiKey: string; outputFormat: string; fetchImpl?: typeof fetch }): VoiceProvider => {
  const f = opts.fetchImpl ?? fetch;
  const post = async (path: string, body: unknown): Promise<Response> => {
    for (let attempt = 0; ; attempt++) {
      const res = await f(`${BASE}${path}`, {
        method: "POST",
        headers: { "xi-api-key": opts.apiKey, "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return res;
      const text = await res.text().catch(() => "");
      // إعادة المحاولة مرتين عند الضغط المؤقت فقط
      if ((res.status === 429 || res.status >= 500) && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw new ElevenLabsError(explain(res.status, text), res.status);
    }
  };
  return {
    name: "elevenlabs",
    /** طلب واحد بالتوقيت؛ وإن لم يدعم النموذج التوقيت: الصوت وحده، والتوقيت يُقدَّر من المدة */
    speak: async (voice, body, model) => {
      try {
        const res = await post(`/v1/text-to-speech/${voice}/with-timestamps?output_format=${opts.outputFormat}`, body);
        const data = (await res.json()) as { audio_base64: string; alignment?: Alignment | null; normalized_alignment?: Alignment | null };
        if (!data.audio_base64) throw new ElevenLabsError("رد ElevenLabs بلا صوت.");
        return { audio: Buffer.from(data.audio_base64, "base64"), alignment: data.alignment ?? data.normalized_alignment ?? null, model };
      } catch (e) {
        if (!(e instanceof ElevenLabsError) || (e.status !== 400 && e.status !== 422) || !/timestamp|alignment/i.test(e.message)) throw e;
        const res = await post(`/v1/text-to-speech/${voice}?output_format=${opts.outputFormat}`, body);
        return { audio: Buffer.from(await res.arrayBuffer()), alignment: null, model };
      }
    },
    speakPlain: async (voice, body) => {
      const res = await post(`/v1/text-to-speech/${voice}?output_format=${opts.outputFormat}`, body);
      return Buffer.from(await res.arrayBuffer());
    },
    soundEffect: async (body) => {
      const res = await post(`/v1/sound-generation?output_format=${opts.outputFormat}`, body);
      return Buffer.from(await res.arrayBuffer());
    },
    get: async <T>(path: string) => {
      const res = await f(`${BASE}${path}`, { headers: { "xi-api-key": opts.apiKey } });
      if (!res.ok) throw new ElevenLabsError(explain(res.status, await res.text().catch(() => "")), res.status);
      return (await res.json()) as T;
    },
  };
};

/** The provider BAL_VOICE_PROVIDER asks for ("" = the real one). */
export const requestedVoiceProvider = (env: NodeJS.ProcessEnv = process.env): "elevenlabs" | "fake" => {
  const v = (env.BAL_VOICE_PROVIDER ?? "").trim().toLowerCase();
  if (!v || v === "elevenlabs") return "elevenlabs";
  if (v === "fake") return "fake";
  throw new Error(`BAL_VOICE_PROVIDER غير معروف: «${v}».`);
};

/**
 * The fake provider exists for tests only. Refused unless a test runner (VITEST) or the explicit e2e flag
 * (BAL_E2E=1) is set, and refused whenever a real voice key is present, so it can never replace paid voice
 * silently on the owner's machine, nor run beside a real key.
 */
export const fakeVoiceRefusal = (env: NodeJS.ProcessEnv = process.env): string | null => {
  const testRun = Boolean(env.VITEST) || env.BAL_E2E === "1";
  if (!testRun) return "مزوّد الصوت الوهمي للاختبارات وحدها (BAL_VOICE_PROVIDER=fake يحتاج VITEST أو BAL_E2E=1).";
  if ((env.ELEVENLABS_API_KEY ?? "").trim()) return "مزوّد الصوت الوهمي لا يعمل ومفتاح صوت حقيقي موجود (ELEVENLABS_API_KEY).";
  return null;
};
export const assertFakeVoiceAllowed = (env: NodeJS.ProcessEnv = process.env) => {
  const refusal = fakeVoiceRefusal(env);
  if (refusal) throw Object.assign(new Error(refusal), { code: "FAKE_VOICE_REFUSED" });
};
