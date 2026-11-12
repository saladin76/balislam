import config from "../../config.json";
import { loadChannel } from "../channel/index";
import { capsFor, stabilityFor, withDirection } from "./models";
import { assertNoQuranForTts, ttsContext, type TtsScene } from "./quranGuard";

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

/** alignment غائب إن لم يُرجع النموذج توقيتًا (يُقدَّر بعدها من مدة الملف) */
export type TtsResult = { audio: Buffer; alignment: Alignment | null; model: string };

export type Tune = { stability: number; style: number; speed: number; direction?: string };

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

/** What the Quran guard needs to know about a TTS request (all optional; the text itself is always checked). */
export type TtsGuardContext = {
  previousText?: string; nextText?: string;
  scene?: TtsScene | null; previousScene?: TtsScene | null; nextScene?: TtsScene | null;
  verses?: readonly string[]; source?: string;
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

  /**
   * جسم الطلب بحسب قدرات النموذج: السرعة والتعبير والنص المجاور لمن يقبلها، والثبات بصيغته،
   * وأمر الأداء أول النص للنماذج الحديثة. السرعة في النماذج التي لا تقبلها تُطبَّق بعد التوليد (tempo.ts).
   */
  const bodyFor = (text: string, model: string, t: Tune | undefined, ctx: TtsGuardContext = {}) => {
    // The single Quran guard (src/voice/quranGuard.ts): no request body is ever built for a verse scene, a
    // ﴿…﴾ span or a known verse; and the neighbour context is sent without any Quran span.
    assertNoQuranForTts(text, ctx.scene, { verses: ctx.verses, source: ctx.source });
    const previousText = ttsContext(ctx.previousText, ctx.previousScene, ctx.verses);
    const nextText = ttsContext(ctx.nextText, ctx.nextScene, ctx.verses);
    const caps = capsFor(model);
    const tune = t ?? { stability: s.stability, style: s.style, speed: s.speed };
    return {
      text: withDirection(caps, text, tune.direction),
      model_id: model,
      voice_settings: {
        stability: stabilityFor(caps, tune.stability),
        similarity_boost: s.similarityBoost,
        ...(caps.style ? { style: tune.style } : {}),
        use_speaker_boost: s.speakerBoost,
        ...(caps.speed === "native" ? { speed: tune.speed } : {}),
      },
      seed: s.seed,
      ...(caps.context ? { previous_text: previousText || undefined, next_text: nextText || undefined } : {}),
    };
  };

  /** طلب واحد بالتوقيت؛ وإن لم يدعم النموذج التوقيت: الصوت وحده، والتوقيت يُقدَّر من المدة */
  const ttsOnce = async (voice: string, body: ReturnType<typeof bodyFor>, model: string): Promise<TtsResult> => {
    try {
      const res = await post(`/v1/text-to-speech/${voice}/with-timestamps?output_format=${s.outputFormat}`, body);
      const data = (await res.json()) as { audio_base64: string; alignment?: Alignment | null; normalized_alignment?: Alignment | null };
      if (!data.audio_base64) throw new ElevenLabsError("رد ElevenLabs بلا صوت.");
      return { audio: Buffer.from(data.audio_base64, "base64"), alignment: data.alignment ?? data.normalized_alignment ?? null, model };
    } catch (e) {
      if (!(e instanceof ElevenLabsError) || (e.status !== 400 && e.status !== 422) || !/timestamp|alignment/i.test(e.message)) throw e;
      const res = await post(`/v1/text-to-speech/${voice}?output_format=${s.outputFormat}`, body);
      return { audio: Buffer.from(await res.arrayBuffer()), alignment: null, model };
    }
  };
  /** رفض 400/422 سببه النص المجاور نفسه (حقل غير مقبول لهذا النموذج) */
  const isContextRefusal = (e: unknown, body: ReturnType<typeof bodyFor>): boolean =>
    e instanceof ElevenLabsError && (e.status === 400 || e.status === 422) && /previous_text|next_text/i.test(e.message)
    && Boolean((body as { previous_text?: string }).previous_text || (body as { next_text?: string }).next_text);

  /**
   * صوت مشهد أو جملة مع توقيت الحروف، وبالنص المجاور للنماذج التي تقبله (لاتصال الإيقاع بين الجمل، D94).
   * إن رفض النموذج النص المجاور يُعاد الطلب نفسه مرة واحدة بلا نص مجاور.
   */
  const tts = async (text: string, ctx: TtsGuardContext & { voiceId?: string; tune?: Tune; modelId?: string } = {}): Promise<TtsResult> => {
    const model = ctx.modelId || modelId;
    const body = bodyFor(text, model, ctx.tune, ctx);
    const voice = ctx.voiceId || opts.voiceId;
    try {
      return await ttsOnce(voice, body, model);
    } catch (e) {
      if (!isContextRefusal(e, body)) throw e;
      return await ttsOnce(voice, bodyFor(text, model, ctx.tune, { ...ctx, previousText: undefined, nextText: undefined, previousScene: null, nextScene: null }), model);
    }
  };

  /** مؤثر صوتي من وصف نصي (0.5 إلى 30 ثانية). */
  const soundEffect = async (text: string, seconds?: number, promptInfluence = 0.5): Promise<Buffer> => {
    assertNoQuranForTts(text, null, { source: "sound-effect" });
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

  /** عيّنة سماع بلا توقيت (لضبط طبقة القناة والنبرة قبل توليد حلقة). */
  const sample = async (text: string, ctx: { tune?: Tune; modelId?: string } = {}): Promise<Buffer> => {
    const res = await post(`/v1/text-to-speech/${opts.voiceId}?output_format=${s.outputFormat}`, bodyFor(text, ctx.modelId || modelId, ctx.tune, { source: "voice-sample" }));
    return Buffer.from(await res.arrayBuffer());
  };

  /** حالة تدريب الصوت الاحترافي على كل نموذج (fine_tuned = جاهز) */
  const voiceInfo = async (id = opts.voiceId) => {
    const v = await get<{ voice_id: string; name: string; category: string; fine_tuning?: { state?: Record<string, string> } }>(`/v1/voices/${id}`);
    return { id: v.voice_id, name: v.name, category: v.category, training: v.fine_tuning?.state ?? {} };
  };

  return { modelId, tts, soundEffect, account, voices, models, sample, voiceInfo };
};

export type ElevenLabsClient = ReturnType<typeof createElevenLabs>;

export const elevenLabsFromEnv = (fetchImpl?: typeof fetch): ElevenLabsClient | null => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = voiceIdFor();
  if (!apiKey || !voiceId) return null;
  return createElevenLabs({ apiKey, voiceId, modelId: process.env.ELEVENLABS_MODEL_ID || undefined, fetchImpl });
};
