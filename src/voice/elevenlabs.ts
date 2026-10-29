import config from "../../config.json";

/**
 * عميل ElevenLabs: تحويل النص إلى صوت مع توقيت كل حرف، وتوليد المؤثرات الصوتية.
 * - TTS: POST /v1/text-to-speech/{voice_id}/with-timestamps
 * - المؤثرات: POST /v1/sound-generation
 * المفاتيح من .env: ELEVENLABS_API_KEY وELEVENLABS_VOICE_ID (وELEVENLABS_MODEL_ID اختياريًا).
 */
const BASE = "https://api.elevenlabs.io";

export type Alignment = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

export type TtsResult = { audio: Buffer; alignment: Alignment };

export type VoiceSettings = typeof config.voice;

export class ElevenLabsError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

const explain = (status: number, body: string) => {
  if (status === 401) return "مفتاح ElevenLabs غير صحيح أو منتهي (ELEVENLABS_API_KEY).";
  if (status === 404) return "الصوت غير موجود: تأكد من ELEVENLABS_VOICE_ID.";
  if (status === 429) return "تجاوزت حد الطلبات أو نفد الرصيد في ElevenLabs. انتظر قليلًا أو راجع رصيدك.";
  if (status === 422) return `ElevenLabs رفض الطلب: ${body.slice(0, 200)}`;
  return `ElevenLabs أعاد خطأ ${status}: ${body.slice(0, 200)}`;
};

export type ElevenLabsOptions = { apiKey: string; voiceId: string; modelId?: string; settings?: VoiceSettings; fetchImpl?: typeof fetch };

export const createElevenLabs = (opts: ElevenLabsOptions) => {
  const f = opts.fetchImpl ?? fetch;
  const s = opts.settings ?? config.voice;
  const modelId = opts.modelId || s.modelId;

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

  /** صوت جملة أو فقرة مع توقيت الحروف. previous/next يحسّنان اتصال النبرة بين المشاهد. */
  const tts = async (text: string, ctx: { previousText?: string; nextText?: string } = {}): Promise<TtsResult> => {
    const res = await post(`/v1/text-to-speech/${opts.voiceId}/with-timestamps?output_format=${s.outputFormat}`, {
      text,
      model_id: modelId,
      voice_settings: {
        stability: s.stability,
        similarity_boost: s.similarityBoost,
        style: s.style,
        use_speaker_boost: s.speakerBoost,
        speed: s.speed,
      },
      seed: s.seed,
      previous_text: ctx.previousText || undefined,
      next_text: ctx.nextText || undefined,
    });
    const data = (await res.json()) as { audio_base64: string; alignment?: Alignment | null; normalized_alignment?: Alignment | null };
    const alignment = data.alignment ?? data.normalized_alignment;
    if (!data.audio_base64 || !alignment) throw new ElevenLabsError("رد ElevenLabs بلا صوت أو بلا توقيت.");
    return { audio: Buffer.from(data.audio_base64, "base64"), alignment };
  };

  /** مؤثر صوتي من وصف نصي (0.5 إلى 30 ثانية). */
  const soundEffect = async (text: string, seconds?: number, promptInfluence = 0.5): Promise<Buffer> => {
    const res = await post(`/v1/sound-generation?output_format=${s.outputFormat}`, {
      text,
      duration_seconds: seconds ? Math.min(30, Math.max(0.5, seconds)) : undefined,
      prompt_influence: promptInfluence,
    });
    return Buffer.from(await res.arrayBuffer());
  };

  return { modelId, tts, soundEffect };
};

export type ElevenLabsClient = ReturnType<typeof createElevenLabs>;

export const elevenLabsFromEnv = (fetchImpl?: typeof fetch): ElevenLabsClient | null => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) return null;
  return createElevenLabs({ apiKey, voiceId, modelId: process.env.ELEVENLABS_MODEL_ID || undefined, fetchImpl });
};
