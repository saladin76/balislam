import config from "../../config.json";
import type { VoiceProfile } from "../channel/types";

/**
 * نبرات الصوت: الصوت المستنسخ نفسه بإعدادات مختلفة حسب روح الحلقة أو المشهد.
 * الصوت النهائي = طبقة القناة (profile في channel.json) + فرق النبرة عن الحياد.
 * (مدى ElevenLabs: stability وstyle من 0 إلى 1، والسرعة 0.7–1.2)
 */
export type Tone = "calm" | "warm" | "documentary" | "dramatic" | "energetic" | "intimate";
export const tones: Record<Tone, { nameAr: string; useAr: string; stability: number; style: number; speed: number; /** أمر الأداء للنماذج الحديثة (v3/v4) */ direction: string }> = {
  calm: { nameAr: "هادئ تأملي", useAr: "الحلقات الإيمانية والتأمل", stability: 0.65, style: 0.05, speed: 0.95, direction: "calm, reflective" },
  warm: { nameAr: "حكّاء دافئ", useAr: "القصص والحياة اليومية", stability: 0.45, style: 0.25, speed: 1.0, direction: "warm storytelling" },
  documentary: { nameAr: "وثائقي رصين", useAr: "التاريخ والمعلومات", stability: 0.6, style: 0.15, speed: 0.98, direction: "measured documentary narration" },
  dramatic: { nameAr: "درامي", useAr: "لحظات الذروة والمعارك والقرارات", stability: 0.3, style: 0.5, speed: 0.96, direction: "dramatic, intense" },
  energetic: { nameAr: "حماسي", useAr: "الخطافات والشورتس والدعوة للاشتراك", stability: 0.35, style: 0.4, speed: 1.08, direction: "energetic, upbeat" },
  intimate: { nameAr: "قريب وهامس", useAr: "الأسئلة الشخصية والمواقف المؤثرة", stability: 0.55, style: 0.3, speed: 0.92, direction: "soft, intimate, close to the listener" },
};
export const toneIds = Object.keys(tones) as Tone[];
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

/**
 * إعدادات الصوت النهائية لمشهد: طبقة القناة ثم النبرة فوقها.
 * النبرة تحرّك الثبات والتعبير بفرقها عن الحياد، وتضرب السرعة في نسبتها؛ فتبقى كل قناة على طبقتها
 * والنبرة تلوّنها (الحماسي في زبدة الكتب أسرع من الحماسي في بالإسلام).
 */
export const voiceSettingsFor = (profile?: VoiceProfile, tone?: Tone): { stability: number; style: number; speed: number; direction?: string } | undefined => {
  if (!profile && !tone) return undefined;
  const base = profile ?? NEUTRAL;
  const t = tone ? tones[tone] : null;
  return {
    stability: r2(clamp(base.stability + (t ? t.stability - 0.5 : 0), 0, 1)),
    style: r2(clamp(base.style + (t ? t.style : 0), 0, 1)),
    speed: r2(clamp((profile ? profile.speed : NEUTRAL.speed) * (t ? t.speed : 1), 0.7, 1.2)),
    // أمر الأداء: نبرة الحلقة، وإلا طبقة القناة
    ...((t?.direction ?? profile?.direction) ? { direction: t?.direction ?? profile?.direction } : {}),
  };
};
