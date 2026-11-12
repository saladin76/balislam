import config from "../../config.json";
import type { VoiceProfile } from "../channel/types";

/**
 * نبرات الصوت: الصوت المستنسخ نفسه بإعدادات مختلفة حسب روح الحلقة أو المشهد.
 *
 * **أول نسخة من النبرات كما وُضعت في الاستوديو** (commit 2d8bee52، ٣١ أكتوبر ٢٠٢٦)، أُعيدت حرفًا بأمر صاحب القناة
 * (١٢ نوفمبر): «النبرات الموجودة بالكامل يجب حذفها تمامًا واسترجع أول نسخة». ست نبرات، وقيمة النبرة هي إعداد الصوت
 * نفسه (الثبات والتعبير والسرعة) فوق إعدادات config.voice، بلا طبقة قناة تحتها ولا أمر أداء ولا مدى قوي ولا توقير.
 * بلا نبرة: إعدادات config.voice كما هي.
 *
 * الإصدارات السابقة محفوظة حرفًا للبصمة وحدها، لا يُرسل بها طلب أبدًا: الإصدار ١ (طبقة القناة + فرق النبرة + أمر الأداء،
 * من ٣ نوفمبر حتى D70 ثم بعد إلغائه في D79) والإصدار ٢ (القوي، D70). ما وُلّد بأيهما صالح، ويظهر عليه «وُلّدت بنبرة
 * سابقة»، ولا يُعاد إلا بأمر المالك «أعد توليد ما وُلّد بنبرة سابقة» (src/voice/toneUpgrade.ts).
 */
export type Tone = "calm" | "warm" | "documentary" | "dramatic" | "energetic" | "intimate";
/** النبرات التي تُختار في الواجهة: هي النبرات كلها (لا معرّف مخفي) */
export type SelectableTone = Tone;
/** معرّفات الإصدارات السابقة للبصمة وحدها (grave وُلد مع D70) */
type LegacyTone = Tone | "grave";
export type TonePreset = { nameAr: string; useAr: string; stability: number; style: number; speed: number };
type LegacyPreset = TonePreset & { direction: string };

/** إصدار النبرات الحالي: ٣ = أول نسخة مُستعادة. المقطع بلا presetVersion = الإصدار ١. */
export const TONE_PRESET_VERSION = 3;
/** إصدار طبقة القناة (٣ نوفمبر، وD79) */
export const LAYERED_PRESET_VERSION = 1;
/** إصدار النبرات القوية المُلغاة (D70) */
export const STRONG_PRESET_VERSION = 2;
/** تسجيل بإصدار غير الحالي (بنبرة سابقة) */
export const isSupersededVersion = (v?: number): boolean => (v ?? 1) !== TONE_PRESET_VERSION;

/** أول نسخة (2d8bee52) حرفًا */
export const TONE_PRESETS_FIRST: Record<Tone, TonePreset> = {
  calm: { nameAr: "هادئ تأملي", useAr: "الحلقات الإيمانية والتأمل", stability: 0.65, style: 0.05, speed: 0.95 },
  warm: { nameAr: "حكّاء دافئ", useAr: "القصص والحياة اليومية", stability: 0.45, style: 0.25, speed: 1.0 },
  documentary: { nameAr: "وثائقي رصين", useAr: "التاريخ والمعلومات", stability: 0.6, style: 0.15, speed: 0.98 },
  dramatic: { nameAr: "درامي", useAr: "لحظات الذروة والمعارك والقرارات", stability: 0.3, style: 0.5, speed: 0.96 },
  energetic: { nameAr: "حماسي", useAr: "الخطافات والشورتس والدعوة للاشتراك", stability: 0.35, style: 0.4, speed: 1.08 },
  intimate: { nameAr: "قريب وهامس", useAr: "الأسئلة الشخصية والمواقف المؤثرة", stability: 0.55, style: 0.3, speed: 0.92 },
};

export const tones: Record<Tone, TonePreset> = TONE_PRESETS_FIRST;
export const toneIds = Object.keys(tones) as Tone[];
/** كل المعرّفات المقبولة في الخطط والسلاسل: النبرات الست وحدها */
export const allToneIds = toneIds;
export const isTone = (t: unknown): t is Tone => typeof t === "string" && t in tones;

/**
 * النبرة الفعلية لمقطع: نبرة المشهد إن حُددت، وإلا نبرة الحلقة، وإلا نبرة القناة (كما في أول نسخة).
 * بلا أي منها: لا نبرة (يوقف التوليد، D36). دفاتر الزمن: أجزاؤها تأخذ نبرتها من خريطة النبرة (src/voice/dafatirParts.ts).
 */
export const effectiveTone = (sceneTone: unknown, episodeTone?: unknown, channelTone?: unknown): Tone | undefined =>
  [sceneTone, episodeTone, channelTone].find(isTone);

/** نص خيار «مثل الحلقة» في قوائم نبرة المشهد: يسمّي النبرة الموروثة، أو يقول إنها لم تُختر بعد. */
export const inheritedToneLabel = (episodeTone?: unknown, channelTone?: unknown): string =>
  isTone(episodeTone) ? `مثل الحلقة (${tones[episodeTone].nameAr})`
  : isTone(channelTone) ? `مثل القناة (${tones[channelTone].nameAr})`
  : "مثل الحلقة — لم تُختر نبرة الحلقة بعد";

/** الحياد (إعدادات config.voice) */
const NEUTRAL = { stability: config.voice.stability, style: config.voice.style, speed: config.voice.speed };
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const r2 = (x: number) => Math.round(x * 100) / 100;

export type ToneTune = { stability: number; style: number; speed: number; direction?: string };

/**
 * إعدادات الصوت لمقطع (أول نسخة حرفًا): قيمة النبرة نفسها، وبلا نبرة لا شيء (فتُستعمل config.voice).
 * المعامل الأول (طبقة القناة) لم يعد يؤثر في الطلب؛ يبقى في التوقيع للتوافق ولا يُقرأ.
 */
export const voiceSettingsFor = (_profile?: VoiceProfile, tone?: Tone): ToneTune | undefined => {
  if (!isTone(tone)) return undefined;
  const t = TONE_PRESETS_FIRST[tone];
  return { stability: t.stability, style: t.style, speed: t.speed };
};

// ───────────── الإصدار ١ (طبقة القناة، ٣ نوفمبر وD79): للبصمة وحدها، لا يُرسل به طلب أبدًا ─────────────

/** الإصدار ١ كما كان حرفًا */
export const TONE_PRESETS_V1: Record<Tone, LegacyPreset> = {
  calm: { ...TONE_PRESETS_FIRST.calm, direction: "calm, reflective" },
  warm: { ...TONE_PRESETS_FIRST.warm, direction: "warm storytelling" },
  documentary: { ...TONE_PRESETS_FIRST.documentary, direction: "measured documentary narration" },
  dramatic: { ...TONE_PRESETS_FIRST.dramatic, direction: "dramatic, intense" },
  energetic: { ...TONE_PRESETS_FIRST.energetic, direction: "energetic, upbeat" },
  intimate: { ...TONE_PRESETS_FIRST.intimate, direction: "soft, intimate, close to the listener" },
};

/** إعدادات الإصدار ١ كما كانت تُحسب حرفًا: طبقة القناة ثم فرق النبرة (grave = الطبقة وحدها) */
export const layeredVoiceSettingsV1 = (profile?: VoiceProfile, tone?: LegacyTone): ToneTune | undefined => {
  const tn = tone === "grave" ? undefined : tone;
  if (!profile && !tn) return undefined;
  const base = profile ?? NEUTRAL;
  const t = tn ? TONE_PRESETS_V1[tn] : null;
  return {
    stability: r2(clamp(base.stability + (t ? t.stability - 0.5 : 0), 0, 1)),
    style: r2(clamp(base.style + (t ? t.style : 0), 0, 1)),
    speed: r2(clamp((profile ? profile.speed : NEUTRAL.speed) * (t ? t.speed : 1), 0.7, 1.2)),
    ...((t?.direction ?? profile?.direction) ? { direction: t?.direction ?? profile?.direction } : {}),
  };
};

// ───────────── الإصدار ٢ (النبرات القوية، D70، المُلغى): للبصمة وحدها، لا يُرسل به طلب أبدًا ─────────────

/** الإصدار ٢ كما كان حرفًا */
export const TONE_PRESETS_V2: Record<LegacyTone, LegacyPreset> = {
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
export const strongVoiceSettingsV2 = (profileV2?: VoiceProfile, tone?: LegacyTone, opts: { text?: string } = {}): ToneTune | undefined => {
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
 * طبقات القناة عبر إصدارات النبرات (للبصمة وحدها): طبقة الإصدار ١ (profileHistory["1"]، وإلا profile القديم)،
 * وطبقة الإصدار ٢ (profileHistory["2"]) ونبرة القناة حينها (toneHistory["2"] = grave).
 * الطبقة لم تعد تؤثر في أي طلب منذ استعادة أول نسخة.
 */
export type VoiceLayers = { profile?: VoiceProfile; profileHistory?: Record<string, VoiceProfile>; toneHistory?: Record<string, string> };
export const layersOf = (voice?: VoiceLayers | null): VoiceLayers =>
  ({ profile: voice?.profile, profileHistory: voice?.profileHistory, toneHistory: voice?.toneHistory });

const isLegacyTone = (t: unknown): t is LegacyTone => t === "grave" || isTone(t);
/**
 * النبرة كما كانت تُحل في الإصدارات السابقة (المشهد ← الحلقة ← القناة)، والمعرّف القديم grave صالح فيها:
 * لحساب بصمة تسجيل قديم من معرّف محفوظ لم يعد نبرة (فيبقى التسجيل صالحًا «بنبرة سابقة» لا «تحتاج توليدًا»).
 */
export const effectiveLegacyTone = (...cands: unknown[]): LegacyTone | undefined => cands.find(isLegacyTone);

/**
 * إعدادات الإصدارات السابقة لنبرة مقطع (لحساب بصمة التسجيلات بها): الإصدار ١ ثم ٢.
 * tone: النبرة الفعلية الآن (أو المعرّف القديم المحفوظ)؛ وللإصدار ٢ بلا نبرة: نبرة القناة حينها.
 * مقطع بصمته تطابق إحداها تسجيل صالح «بنبرة سابقة» لا يُعاد توليده آليًا.
 */
export const legacyTunes = (layers: VoiceLayers, tone?: LegacyTone | string, opts: { text?: string } = {}): { version: number; tune: ToneTune | undefined }[] => {
  const t = isLegacyTone(tone) ? tone : undefined;
  const out: { version: number; tune: ToneTune | undefined }[] = [];
  const v1 = layeredVoiceSettingsV1(layers.profileHistory?.["1"] ?? layers.profile, t);
  if (v1) out.push({ version: LAYERED_PRESET_VERSION, tune: v1 });
  const v2Tone = t ?? [layers.toneHistory?.["2"]].find(isLegacyTone);
  const v2 = strongVoiceSettingsV2(layers.profileHistory?.["2"] ?? layers.profileHistory?.["1"] ?? layers.profile, v2Tone, opts);
  if (v2) out.push({ version: STRONG_PRESET_VERSION, tune: v2 });
  return out;
};
