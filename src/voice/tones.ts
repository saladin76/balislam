import config from "../../config.json";
import type { VoiceProfile } from "../channel/types";

/**
 * نبرات الصوت: الصوت المستنسخ نفسه بإعدادات مختلفة حسب روح الحلقة أو المشهد.
 * الصوت النهائي = طبقة القناة (profile في channel.json) + فرق النبرة عن الحياد.
 * (مدى ElevenLabs: stability وstyle من 0 إلى 1، والسرعة 0.7–1.2)
 *
 * قرار صاحب القناة (١١ نوفمبر ٢٠٢٦): «الأصوات والنبرات كلها قوية ورزينة، لا ناعمة ولا هادئة، وفيها قوة تشد المتابع».
 * فالإصدار ٢ من النبرات (TONE_PRESET_VERSION) يجعل كل نبرة حازمة واضحة الإسقاط متأنية الإيقاع بلا همس، ويبقي
 * فروقها (التأملي أبطأ وأعمق لكنه حازم، والدرامي أقواها). المعرّفات القديمة كما هي (calm، intimate…) فكل خطة
 * وخريطة نبرة قائمة تُحل إلى الإعدادات الجديدة؛ وأُضيفت «grave» (قوي رزين) افتراضيًا للقنوات.
 *
 * إصدار النبرات خارج إعادة التوليد الآلية: التسجيل المولَّد بإعدادات إصدار سابق يبقى صالحًا (بصمته تُطابق ذلك
 * الإصدار، legacyVoiceSettings) ويظهر عليه «وُلّدت بالنبرة السابقة»، ولا يُعاد إلا بأمر المالك الصريح
 * «أعد توليد الكل بالنبرة الجديدة» (src/voice/toneUpgrade.ts). لا يُصرف رصيد بصمت لأن النبرات تغيّرت.
 */
export type Tone = "grave" | "calm" | "warm" | "documentary" | "dramatic" | "energetic" | "intimate";
export type TonePreset = { nameAr: string; useAr: string; stability: number; style: number; speed: number; /** أمر الأداء للنماذج الحديثة (v3/v4) */ direction: string };

/** إصدار إعدادات النبرات الحالي. يُرفع عند تغيير أرقامها، ويُحفظ ما قبله في TONE_PRESETS_V1… */
export const TONE_PRESET_VERSION = 2;

/** الإصدار ١ (قبل ١١ نوفمبر) كما كان حرفًا: مرجع بصمة التسجيلات القديمة وحدها، ولا يُرسل به طلب جديد. */
export const TONE_PRESETS_V1: Record<Exclude<Tone, "grave">, TonePreset> = {
  calm: { nameAr: "هادئ تأملي", useAr: "الحلقات الإيمانية والتأمل", stability: 0.65, style: 0.05, speed: 0.95, direction: "calm, reflective" },
  warm: { nameAr: "حكّاء دافئ", useAr: "القصص والحياة اليومية", stability: 0.45, style: 0.25, speed: 1.0, direction: "warm storytelling" },
  documentary: { nameAr: "وثائقي رصين", useAr: "التاريخ والمعلومات", stability: 0.6, style: 0.15, speed: 0.98, direction: "measured documentary narration" },
  dramatic: { nameAr: "درامي", useAr: "لحظات الذروة والمعارك والقرارات", stability: 0.3, style: 0.5, speed: 0.96, direction: "dramatic, intense" },
  energetic: { nameAr: "حماسي", useAr: "الخطافات والشورتس والدعوة للاشتراك", stability: 0.35, style: 0.4, speed: 1.08, direction: "energetic, upbeat" },
  intimate: { nameAr: "قريب وهامس", useAr: "الأسئلة الشخصية والمواقف المؤثرة", stability: 0.55, style: 0.3, speed: 0.92, direction: "soft, intimate, close to the listener" },
};

/** الإصدار ٢ (١١ نوفمبر): كل النبرات قوية ورزينة. */
export const tones: Record<Tone, TonePreset> = {
  grave: { nameAr: "قوي رزين", useAr: "الافتراضي لكل القنوات: حضور قوي يشد المتابع", stability: 0.46, style: 0.3, speed: 0.98,
    direction: "strong, grave and authoritative narration; firm projection, deliberate pace, commands attention" },
  calm: { nameAr: "تأمّلي رزين", useAr: "الحلقات الإيمانية والتأمل: أبطأ وأعمق، وحازم", stability: 0.54, style: 0.18, speed: 0.95,
    direction: "grave and reflective, deep steady voice, firm and deliberate; no whisper, no breathiness" },
  warm: { nameAr: "حكّاء رزين", useAr: "القصص والحياة اليومية", stability: 0.48, style: 0.26, speed: 0.99,
    direction: "engaging storyteller, firm and grave, clear projection, confident" },
  documentary: { nameAr: "وثائقي حازم", useAr: "التاريخ والمعلومات", stability: 0.5, style: 0.24, speed: 0.99,
    direction: "authoritative documentary narration, firm, measured and clear" },
  dramatic: { nameAr: "درامي قوي", useAr: "لحظات الذروة والمعارك والقرارات (أقوى النبرات)", stability: 0.42, style: 0.4, speed: 0.97,
    direction: "powerful and intense, commanding, strong projection, deliberate weight on every phrase" },
  energetic: { nameAr: "حماسي حازم", useAr: "الخطافات والشورتس والدعوة للاشتراك", stability: 0.44, style: 0.34, speed: 1.02,
    direction: "energetic yet grave, confident and attention-grabbing, firm, not rushed" },
  intimate: { nameAr: "قريب رزين", useAr: "الأسئلة الشخصية والمواقف المؤثرة: مباشر للمتابع، بلا همس", stability: 0.5, style: 0.24, speed: 0.96,
    direction: "direct and close to the listener, firm and grave, clear full voice, no whisper" },
};
export const toneIds = Object.keys(tones) as Tone[];
export const isTone = (t: unknown): t is Tone => typeof t === "string" && t in tones;
/** النبرة الافتراضية للقنوات والحلقات الجديدة (channel.json ← voice.tone) */
export const DEFAULT_TONE: Tone = "grave";

/**
 * «المدى القوي» الذي تبقى فيه كل نبرة في الإصدار ٢ مهما كانت طبقة القناة: ثبات معتدل (متسق بلا رتابة)،
 * وتعبير واضح في حد آمن، وإيقاع متأنٍّ غير متعجل. (التشابه 0.8 وتعزيز المتحدث من config.voice، ثابتان.)
 */
export const STRONG_RANGE = { stability: [0.4, 0.55], style: [0.15, 0.5], speed: [0.94, 1.0] } as const;

/**
 * التوقير: جملة فيها ذكر الله أو دعاء تُؤدّى رزينة خاشعة حازمة، بلا صياح ولا تفخيم (لا تعبير عالٍ ولا سرعة).
 * الكشف بالكلمات نفسها التي يستثنيها السكون المقصود (src/render/stillness.ts ← SACRED_WORD) بعد حذف التشكيل.
 */
const SACRED = new Set(["الله", "لله", "اللهم", "ربنا", "ربه", "ربك", "ربي", "ربهم", "سبحانه", "سبحان", "تعالى"]);
/** بالكلمة كاملة (لا «اللهجة» ولا «العربي»)، مع سابقة واحدة من و ف ب ك ل («والله»، «بالله»، «فلله») */
export const isReverent = (text?: string): boolean =>
  Boolean(text && text.replace(/[ً-ٰٟـ]/g, "").replace(/[إأآٱ]/g, "ا").split(/[\s«»"“”'()؟?!.,،:؛…\-]+/)
    .some((w) => SACRED.has(w) || (/^[وفبكل]/.test(w) && SACRED.has(w.slice(1)))));
export const REVERENT = { stabilityMin: 0.52, styleMax: 0.22, speedMax: 0.96,
  direction: "grave, reverent and firm; dignified and measured, steady full voice, never shouting" } as const;

/**
 * النبرة الفعلية لمقطع: نبرة المشهد إن حُددت، وإلا نبرة الحلقة، وإلا نبرة القناة.
 * «مثل الحلقة» قرار صريح صالح (تجربة الفانل ٨ نوفمبر، D36): نبرة الحلقة يختارها المالك مرة في محرر الحلقة
 * فتسري على كل مشهد بلا نبرة خاصة، ويبقى تخصيص أي مشهد وحده ممكنًا. بلا أي منها: لا نبرة (يوقف التوليد).
 * دفاتر الزمن لا تمر من هنا: أجزاؤها تأخذ نبرتها من خريطة النبرة (src/voice/dafatirParts.ts).
 */
export const effectiveTone = (sceneTone: unknown, episodeTone?: unknown, channelTone?: unknown): Tone | undefined =>
  [sceneTone, episodeTone, channelTone].find(isTone);

/** نص خيار «مثل الحلقة» في قوائم نبرة المشهد: يسمّي النبرة الموروثة، أو يقول إنها لم تُختر بعد. */
export const inheritedToneLabel = (episodeTone?: unknown, channelTone?: unknown): string =>
  isTone(episodeTone) ? `مثل الحلقة (${tones[episodeTone].nameAr})`
  : isTone(channelTone) ? `مثل القناة (${tones[channelTone].nameAr})`
  : "مثل الحلقة — لم تُختر نبرة الحلقة بعد";

/** الحياد الذي تُقاس منه فروق النبرات (إعدادات config.voice) */
const NEUTRAL = { stability: config.voice.stability, style: config.voice.style, speed: config.voice.speed };
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const r2 = (x: number) => Math.round(x * 100) / 100;

export type ToneTune = { stability: number; style: number; speed: number; direction?: string };

/**
 * إعدادات الصوت النهائية لمشهد (الإصدار الحالي): طبقة القناة ثم النبرة فوقها، ثم المدى القوي، ثم التوقير
 * إن كان في النص ذكر لله أو دعاء. النبرة تحرّك الثبات والتعبير بفرقها عن الحياد، وتضرب السرعة في نسبتها.
 * بلا نبرة ولا طبقة: لا إعدادات (الطلب بإعدادات config.voice كما كان).
 */
export const voiceSettingsFor = (profile?: VoiceProfile, tone?: Tone, opts: { text?: string } = {}): ToneTune | undefined => {
  if (!profile && !tone) return undefined;
  const base = profile ?? NEUTRAL;
  const t = tone ? tones[tone] : null;
  let stability = clamp(base.stability + (t ? t.stability - 0.5 : 0), STRONG_RANGE.stability[0], STRONG_RANGE.stability[1]);
  let style = clamp(base.style + (t ? t.style : 0), STRONG_RANGE.style[0], STRONG_RANGE.style[1]);
  let speed = clamp((profile ? profile.speed : NEUTRAL.speed) * (t ? t.speed : 1), STRONG_RANGE.speed[0], STRONG_RANGE.speed[1]);
  let direction = t?.direction ?? profile?.direction;
  if (isReverent(opts.text)) {
    stability = Math.max(stability, REVERENT.stabilityMin);
    style = Math.min(style, REVERENT.styleMax);
    speed = Math.min(speed, REVERENT.speedMax);
    direction = REVERENT.direction;
  }
  return { stability: r2(stability), style: r2(style), speed: r2(speed), ...(direction ? { direction } : {}) };
};

/**
 * إعدادات الإصدار ١ كما كانت تُحسب حرفًا (الترتيب نفسه والتقريب نفسه): لا يُرسل بها طلب أبدًا، وإنما تُحسب
 * بها بصمة التسجيل القديم ليبقى صالحًا. profileV1: طبقة القناة كما كانت حينها (channel.json ← voice.profileHistory["1"]).
 */
export const legacyVoiceSettings = (profileV1?: VoiceProfile, tone?: Tone): ToneTune | undefined => {
  if (!profileV1 && !tone) return undefined;
  const base = profileV1 ?? NEUTRAL;
  // «grave» جديدة في الإصدار ٢: لا تسجيل قديم بها
  if (tone === "grave") return undefined;
  const t = tone ? TONE_PRESETS_V1[tone] : null;
  return {
    stability: r2(clamp(base.stability + (t ? t.stability - 0.5 : 0), 0, 1)),
    style: r2(clamp(base.style + (t ? t.style : 0), 0, 1)),
    speed: r2(clamp((profileV1 ? profileV1.speed : NEUTRAL.speed) * (t ? t.speed : 1), 0.7, 1.2)),
    ...((t?.direction ?? profileV1?.direction) ? { direction: t?.direction ?? profileV1?.direction } : {}),
  };
};

/** طبقات القناة عبر إصدارات النبرات: الحالية، وما كانت عليه في الإصدار ١ (إن تغيرت) */
export type VoiceLayers = { profile?: VoiceProfile; profileHistory?: Record<string, VoiceProfile> };
export const layersOf = (voice?: { profile?: VoiceProfile; profileHistory?: Record<string, VoiceProfile> } | null): VoiceLayers =>
  ({ profile: voice?.profile, profileHistory: voice?.profileHistory });

/**
 * إعدادات الإصدارات السابقة لنبرة: لكل إصدار قديم إعداداته (لحساب بصمة التسجيلات القديمة).
 * مقطع بصمته تطابق إحداها تسجيل صالح «بالنبرة السابقة» لا يُعاد توليده آليًا.
 */
export const legacyTunes = (layers: VoiceLayers, tone?: Tone): { version: number; tune: ToneTune | undefined }[] => {
  const v1 = legacyVoiceSettings(layers.profileHistory?.["1"] ?? layers.profile, tone);
  return v1 ? [{ version: 1, tune: v1 }] : [];
};
