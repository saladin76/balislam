import config from "../../config.json";
import type { VoiceProfile } from "../channel/types";

/**
 * نبرات الصوت: الصوت المستنسخ نفسه بإعدادات مختلفة حسب روح الحلقة أو المشهد.
 * الصوت النهائي = طبقة القناة (profile في channel.json) + فرق النبرة عن الحياد.
 * (مدى ElevenLabs: stability وstyle من 0 إلى 1، والسرعة 0.7–1.2)
 *
 * أُلغي قرار النبرات القوية (D70) بطلب صاحب القناة (١١ نوفمبر، مساءً): «رجّع النبرات زي ما كانت قبل».
 * فالإعدادات الحالية هي الإصدار ١ حرفًا (TONE_PRESETS_V1، والطبقات كما كانت)، وبصمة التسجيل بها هي البصمة
 * قبل D70 نفسها؛ فكل ما وُلّد قبل D70 حالي بلا إعادة توليد. والإصدار ٢ (القوي) محفوظ حرفًا (TONE_PRESETS_V2،
 * المدى القوي، التوقير) للبصمة وحدها: ما وُلّد به صالح، ويظهر عليه «وُلّدت بالنبرة القوية (المُلغاة)»، ولا يُعاد
 * إلا بأمر المالك الصريح «أعد توليد ما وُلّد بالنبرة القوية» (src/voice/toneUpgrade.ts). لا يُرسل بالإصدار ٢ طلب أبدًا.
 */
export type Tone = "calm" | "warm" | "documentary" | "dramatic" | "energetic" | "intimate" | "grave";
/** النبرات التي تُختار في الواجهة (كما كانت قبل D70) */
export type SelectableTone = Exclude<Tone, "grave">;
export type TonePreset = { nameAr: string; useAr: string; stability: number; style: number; speed: number; /** أمر الأداء للنماذج الحديثة (v3/v4) */ direction: string };

/**
 * إصدار إعدادات النبرات الحالي: ١ (عاد بعد إلغاء D70). الإصدار ٢ (القوي) سابق مُلغى.
 * المقطع بلا presetVersion = الإصدار ١.
 */
export const TONE_PRESET_VERSION = 1;
/** إصدار النبرات القوية المُلغاة (D70) */
export const STRONG_PRESET_VERSION = 2;
/** تسجيل بإصدار غير الحالي (أي بالنبرة القوية المُلغاة) */
export const isSupersededVersion = (v?: number): boolean => (v ?? 1) !== TONE_PRESET_VERSION;

/** الإصدار ١ (قبل D70، والحالي بعد إلغائه) كما كان حرفًا. */
export const TONE_PRESETS_V1: Record<SelectableTone, TonePreset> = {
  calm: { nameAr: "هادئ تأملي", useAr: "الحلقات الإيمانية والتأمل", stability: 0.65, style: 0.05, speed: 0.95, direction: "calm, reflective" },
  warm: { nameAr: "حكّاء دافئ", useAr: "القصص والحياة اليومية", stability: 0.45, style: 0.25, speed: 1.0, direction: "warm storytelling" },
  documentary: { nameAr: "وثائقي رصين", useAr: "التاريخ والمعلومات", stability: 0.6, style: 0.15, speed: 0.98, direction: "measured documentary narration" },
  dramatic: { nameAr: "درامي", useAr: "لحظات الذروة والمعارك والقرارات", stability: 0.3, style: 0.5, speed: 0.96, direction: "dramatic, intense" },
  energetic: { nameAr: "حماسي", useAr: "الخطافات والشورتس والدعوة للاشتراك", stability: 0.35, style: 0.4, speed: 1.08, direction: "energetic, upbeat" },
  intimate: { nameAr: "قريب وهامس", useAr: "الأسئلة الشخصية والمواقف المؤثرة", stability: 0.55, style: 0.3, speed: 0.92, direction: "soft, intimate, close to the listener" },
};

/**
 * «grave» (قوي رزين) وُلد مع D70 ولا مقابل له قبله؛ فيبقى معرّفًا صالحًا للخطط والسلاسل التي حفظته، ويُحل إلى
 * أقرب ما كان قبل D70: نبرة القناة الافتراضية = طبقة القناة وحدها بلا فرق نبرة. لا يظهر في قوائم الاختيار.
 */
const GRAVE_ALIAS: TonePreset = { nameAr: "طبقة القناة وحدها", useAr: "المعرّف القديم «قوي رزين» (D70 المُلغى): صوت القناة بطبقتها بلا فرق نبرة",
  stability: 0.5, style: 0, speed: 1, direction: "" };

/** النبرات الحالية: الإصدار ١ حرفًا، ومعها المعرّف القديم grave */
export const tones: Record<Tone, TonePreset> = { ...TONE_PRESETS_V1, grave: GRAVE_ALIAS };
/** ما يُختار في الواجهة: النبرات الست كما كانت قبل D70 */
export const toneIds = Object.keys(TONE_PRESETS_V1) as SelectableTone[];
/** كل المعرّفات المقبولة في الخطط والسلاسل (ومنها grave القديم) */
export const allToneIds = Object.keys(tones) as Tone[];
export const isTone = (t: unknown): t is Tone => typeof t === "string" && t in tones;

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
 * إعدادات الصوت النهائية لمشهد (الإصدار ١، كما كانت قبل D70 حرفًا: الترتيب نفسه والتقريب نفسه، فالبصمة نفسها):
 * طبقة القناة ثم النبرة فوقها. النبرة تحرّك الثبات والتعبير بفرقها عن الحياد، وتضرب السرعة في نسبتها؛
 * فتبقى كل قناة على طبقتها والنبرة تلوّنها (الحماسي في زبدة الكتب أسرع من الحماسي في بالإسلام).
 * grave = بلا فرق نبرة (طبقة القناة وحدها). لا مدى قوي ولا تعديل توقير (لم يكونا قبل D70).
 */
export const voiceSettingsFor = (profile?: VoiceProfile, tone?: Tone): ToneTune | undefined => {
  const tn = tone === "grave" ? undefined : tone;
  if (!profile && !tn) return undefined;
  const base = profile ?? NEUTRAL;
  const t = tn ? TONE_PRESETS_V1[tn] : null;
  return {
    stability: r2(clamp(base.stability + (t ? t.stability - 0.5 : 0), 0, 1)),
    style: r2(clamp(base.style + (t ? t.style : 0), 0, 1)),
    speed: r2(clamp((profile ? profile.speed : NEUTRAL.speed) * (t ? t.speed : 1), 0.7, 1.2)),
    // أمر الأداء: نبرة الحلقة، وإلا طبقة القناة
    ...((t?.direction ?? profile?.direction) ? { direction: t?.direction ?? profile?.direction } : {}),
  };
};

// ───────────── الإصدار ٢ (النبرات القوية، D70، المُلغى): للبصمة وحدها، لا يُرسل به طلب أبدًا ─────────────

/** الإصدار ٢ كما كان حرفًا */
export const TONE_PRESETS_V2: Record<Tone, TonePreset> = {
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
/** «المدى القوي» للإصدار ٢ (للبصمة وحدها) */
export const STRONG_RANGE_V2 = { stability: [0.4, 0.55], style: [0.15, 0.5], speed: [0.94, 1.0] } as const;
const SACRED = new Set(["الله", "لله", "اللهم", "ربنا", "ربه", "ربك", "ربي", "ربهم", "سبحانه", "سبحان", "تعالى"]);
/** كشف ذكر الله أو الدعاء كما كان في الإصدار ٢ (للبصمة وحدها) */
export const isReverentV2 = (text?: string): boolean =>
  Boolean(text && text.replace(/[ً-ٰٟـ]/g, "").replace(/[إأآٱ]/g, "ا").split(/[\s«»"“”'()؟?!.,،:؛…\-]+/)
    .some((w) => SACRED.has(w) || (/^[وفبكل]/.test(w) && SACRED.has(w.slice(1)))));
const REVERENT_V2 = { stabilityMin: 0.52, styleMax: 0.22, speedMax: 0.96,
  direction: "grave, reverent and firm; dignified and measured, steady full voice, never shouting" } as const;

/** إعدادات الإصدار ٢ كما كانت تُحسب حرفًا: profileV2 طبقة القناة حينها (channel.json ← voice.profileHistory["2"]) */
export const strongVoiceSettingsV2 = (profileV2?: VoiceProfile, tone?: Tone, opts: { text?: string } = {}): ToneTune | undefined => {
  if (!profileV2 && !tone) return undefined;
  const base = profileV2 ?? NEUTRAL;
  const t = tone ? TONE_PRESETS_V2[tone] : null;
  const R = STRONG_RANGE_V2;
  let stability = clamp(base.stability + (t ? t.stability - 0.5 : 0), R.stability[0], R.stability[1]);
  let style = clamp(base.style + (t ? t.style : 0), R.style[0], R.style[1]);
  let speed = clamp((profileV2 ? profileV2.speed : NEUTRAL.speed) * (t ? t.speed : 1), R.speed[0], R.speed[1]);
  let direction: string | undefined = t?.direction ?? profileV2?.direction;
  if (isReverentV2(opts.text)) {
    stability = Math.max(stability, REVERENT_V2.stabilityMin);
    style = Math.min(style, REVERENT_V2.styleMax);
    speed = Math.min(speed, REVERENT_V2.speedMax);
    direction = REVERENT_V2.direction;
  }
  return { stability: r2(stability), style: r2(style), speed: r2(speed), ...(direction ? { direction } : {}) };
};

/**
 * طبقات القناة عبر إصدارات النبرات: الحالية، وما كانت عليه في الإصدار ٢ (profileHistory["2"])، ونبرة القناة
 * الافتراضية حينها (toneHistory["2"] = grave) لأن D70 جعلها نبرة كل قناة.
 */
export type VoiceLayers = { profile?: VoiceProfile; profileHistory?: Record<string, VoiceProfile>; toneHistory?: Record<string, string> };
export const layersOf = (voice?: VoiceLayers | null): VoiceLayers =>
  ({ profile: voice?.profile, profileHistory: voice?.profileHistory, toneHistory: voice?.toneHistory });

/**
 * إعدادات الإصدارات الأخرى لنبرة مقطع (لحساب بصمة التسجيلات بها): الإصدار ٢ وحده.
 * tone: النبرة الفعلية الآن؛ وإن غابت (لأن نبرة القناة رجعت كما كانت: بلا نبرة) فنبرة القناة حينها.
 * مقطع بصمته تطابقها تسجيل صالح «بالنبرة القوية (المُلغاة)» لا يُعاد توليده آليًا.
 */
export const legacyTunes = (layers: VoiceLayers, tone?: Tone, opts: { text?: string } = {}): { version: number; tune: ToneTune | undefined }[] => {
  const v2Tone = tone ?? [layers.toneHistory?.["2"]].find(isTone);
  const v2 = strongVoiceSettingsV2(layers.profileHistory?.["2"] ?? layers.profile, v2Tone, opts);
  return v2 ? [{ version: STRONG_PRESET_VERSION, tune: v2 }] : [];
};
