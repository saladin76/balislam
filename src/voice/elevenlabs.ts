import config from "../../config.json";
import { loadChannel } from "../channel/index";
import { capsFor, stabilityFor, withDirection } from "./models";
import { assertNoQuranForTts, ttsContext, type TtsScene } from "./quranGuard";
import { assertFakeVoiceAllowed, ElevenLabsError, elevenLabsHttpProvider, requestedVoiceProvider, type TtsResult, type VoiceProvider } from "./provider";
import { FAKE_VOICE_ID, fakeVoiceProvider } from "./fakeVoice";

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
 * - TTS بالتوقيت، والمؤثرات الصوتية (المسارات نفسها في provider.ts)
 * المفاتيح من .env: ELEVENLABS_API_KEY وELEVENLABS_VOICE_ID (وELEVENLABS_MODEL_ID اختياريًا).
 * الطلب نفسه يخرج عبر مزوّد الصوت (src/voice/provider.ts) بعد بنائه وفحصه بحارس القرآن هنا.
 */
export type { Alignment, TtsResult } from "./provider";
export { ElevenLabsError };

export type Tune = { stability: number; style: number; speed: number; direction?: string };

export type VoiceSettings = typeof config.voice;

/** What the Quran guard needs to know about a TTS request (all optional; the text itself is always checked). */
export type TtsGuardContext = {
  previousText?: string; nextText?: string;
  scene?: TtsScene | null; previousScene?: TtsScene | null; nextScene?: TtsScene | null;
  verses?: readonly string[]; source?: string;
  /** D136: the seed of this take (a regeneration varies it; stored with the take). Default: config.voice.seed. */
  seed?: number;
};

export type ElevenLabsOptions = { apiKey: string; voiceId: string; modelId?: string; settings?: VoiceSettings; fetchImpl?: typeof fetch };

export const createElevenLabs = (opts: ElevenLabsOptions) => {
  const s = opts.settings ?? config.voice;
  return createVoiceClient(elevenLabsHttpProvider({ apiKey: opts.apiKey, outputFormat: s.outputFormat, fetchImpl: opts.fetchImpl }), opts);
};

/**
 * The client over any provider (work ٤): the body is built and checked by the Quran guard HERE, before the
 * provider is called, for the real ElevenLabs provider and the test-only fake one alike.
 */
export const createVoiceClient = (provider: VoiceProvider, opts: Omit<ElevenLabsOptions, "apiKey" | "fetchImpl">) => {
  const s = opts.settings ?? config.voice;
  const modelId = opts.modelId || s.modelId;

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
      seed: ctx.seed ?? s.seed,
      ...(caps.context ? { previous_text: previousText || undefined, next_text: nextText || undefined } : {}),
    };
  };

  /** طلب واحد بالتوقيت عبر المزوّد؛ وإن لم يدعم النموذج التوقيت: الصوت وحده، والتوقيت يُقدَّر من المدة */
  const ttsOnce = async (voice: string, body: ReturnType<typeof bodyFor>, model: string): Promise<TtsResult> => provider.speak(voice, body, model);
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
    return provider.soundEffect({
      text,
      duration_seconds: seconds ? Math.min(30, Math.max(0.5, seconds)) : undefined,
      prompt_influence: promptInfluence,
    });
  };

  const get = <T>(path: string): Promise<T> => provider.get<T>(path);
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
  const sample = async (text: string, ctx: { tune?: Tune; modelId?: string } = {}): Promise<Buffer> =>
    provider.speakPlain(opts.voiceId, bodyFor(text, ctx.modelId || modelId, ctx.tune, { source: "voice-sample" }));

  /** حالة تدريب الصوت الاحترافي على كل نموذج (fine_tuned = جاهز) */
  const voiceInfo = async (id = opts.voiceId) => {
    const v = await get<{ voice_id: string; name: string; category: string; fine_tuning?: { state?: Record<string, string> } }>(`/v1/voices/${id}`);
    return { id: v.voice_id, name: v.name, category: v.category, training: v.fine_tuning?.state ?? {} };
  };

  return { modelId, tts, soundEffect, account, voices, models, sample, voiceInfo };
};

export type ElevenLabsClient = ReturnType<typeof createElevenLabs>;

export const elevenLabsFromEnv = (fetchImpl?: typeof fetch): ElevenLabsClient | null => {
  // Tests only (work ٤): BAL_VOICE_PROVIDER=fake is refused outside a test run or beside a real key.
  if (requestedVoiceProvider() === "fake") {
    assertFakeVoiceAllowed();
    return createVoiceClient(fakeVoiceProvider(), { voiceId: FAKE_VOICE_ID, modelId: process.env.ELEVENLABS_MODEL_ID || undefined });
  }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = voiceIdFor();
  if (!apiKey || !voiceId) return null;
  return createElevenLabs({ apiKey, voiceId, modelId: process.env.ELEVENLABS_MODEL_ID || undefined, fetchImpl });
};
