import config from "../../config.json";
import { loadChannel } from "../channel/index";

/** صوت القناة الحالية: ما اختير في إعدادات القناة، وإلا ELEVENLABS_VOICE_ID العام. */
export const voiceIdFor = (): string | undefined => {
  try {
    return loadChannel().voice?.id || process.env.ELEVENLABS_VOICE_ID || undefined;
  } catch {
    return process.env.ELEVENLABS_VOICE_ID || undefined;
  }
};

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
  if (body.includes("voice_not_fine_tuned"))
    return "الصوت الاحترافي ما زال قيد التدريب في ElevenLabs (Fine-tuning in progress). انتظر حتى ينتهي التدريب ثم أعد التوليد.";
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
  const tts = async (text: string, ctx: { previousText?: string; nextText?: string; voiceId?: string; tune?: { stability: number; style: number; speed: number } } = {}): Promise<TtsResult> => {
    const res = await post(`/v1/text-to-speech/${ctx.voiceId || opts.voiceId}/with-timestamps?output_format=${s.outputFormat}`, {
      text,
      model_id: modelId,
      voice_settings: {
        stability: ctx.tune?.stability ?? s.stability,
        similarity_boost: s.similarityBoost,
        style: ctx.tune?.style ?? s.style,
        use_speaker_boost: s.speakerBoost,
        speed: ctx.tune?.speed ?? s.speed,
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

  const get = async <T>(path: string): Promise<T> => {
    const res = await f(`${BASE}${path}`, { headers: { "xi-api-key": opts.apiKey } });
    if (!res.ok) throw new ElevenLabsError(explain(res.status, await res.text().catch(() => "")), res.status);
    return (await res.json()) as T;
  };

  /** الاشتراك والرصيد (لاختبار المفتاح من الاستوديو). */
  const account = () =>
    get<{ tier: string; character_count: number; character_limit: number; next_character_count_reset_unix?: number }>("/v1/user/subscription");

  /** أصوات الحساب (لاختيار الصوت المستنسخ). */
  const voices = async () =>
    (await get<{ voices: { voice_id: string; name: string; category: string }[] }>("/v1/voices")).voices.map((v) => ({ id: v.voice_id, name: v.name, category: v.category }));

  /** النماذج التي تحوّل النص إلى كلام، ومعها هل تدعم العربية (لتجربة السماع في الاستوديو). */
  const models = async () =>
    (await get<{ model_id: string; name: string; can_do_text_to_speech?: boolean; languages?: { language_id: string }[] }[]>("/v1/models"))
      .filter((m) => m.can_do_text_to_speech !== false)
      .map((m) => ({ id: m.model_id, name: m.name, arabic: (m.languages ?? []).some((l) => l.language_id === "ar") }));

  /**
   * عيّنة سماع بلا توقيت (لضبط طبقة القناة والنبرة قبل توليد حلقة).
   * نموذج v3 يقبل للثبات ثلاث قيم فقط (0 / 0.5 / 1)، فتُقرَّب إليها.
   */
  const sample = async (text: string, ctx: { tune?: { stability: number; style: number; speed: number }; modelId?: string } = {}): Promise<Buffer> => {
    const model = ctx.modelId || modelId;
    const t = ctx.tune ?? { stability: s.stability, style: s.style, speed: s.speed };
    const stability = model === "eleven_v3" ? [0, 0.5, 1].reduce((a, b) => (Math.abs(b - t.stability) < Math.abs(a - t.stability) ? b : a)) : t.stability;
    const res = await post(`/v1/text-to-speech/${opts.voiceId}?output_format=${s.outputFormat}`, {
      text,
      model_id: model,
      voice_settings: { stability, similarity_boost: s.similarityBoost, style: t.style, use_speaker_boost: s.speakerBoost, speed: t.speed },
      seed: s.seed,
    });
    return Buffer.from(await res.arrayBuffer());
  };

  return { modelId, tts, soundEffect, account, voices, models, sample };
};

export type ElevenLabsClient = ReturnType<typeof createElevenLabs>;

export const elevenLabsFromEnv = (fetchImpl?: typeof fetch): ElevenLabsClient | null => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = voiceIdFor();
  if (!apiKey || !voiceId) return null;
  return createElevenLabs({ apiKey, voiceId, modelId: process.env.ELEVENLABS_MODEL_ID || undefined, fetchImpl });
};
