import defaultChannelJson from "../../channels/balislam/channel.json";
import type { LogoSpec } from "../../brand/logo/Logo";

/**
 * ملف القناة (channels/<id>/channel.json): كل ما يميّز قناة عن أخرى غير الهوية البصرية.
 * المحرك واحد لكل القنوات؛ القناة بيانات فقط.
 */
export type ChannelDomain = {
  name: string;
  /** خانة الثيم في هوية القناة: paper (خطي بالحبر) | family | night | warm */
  theme: "paper" | "family" | "night" | "warm";
  tags: string[];
};

export type ChannelConfig = {
  id: string;
  name: string;
  nameLatin: string;
  /** لغة القناة الافتراضية (يمكن تجاوزها لكل حلقة بحقل lang) */
  language: string;
  description: string;
  masterTheme: "paper" | "family" | "night" | "warm";
  /** رمز القناة (افتراضيًا باء التشغيل) */
  logo?: LogoSpec;
  /** ترجمة معاني القرآن للقنوات غير العربية: معرّف المورد في Quran Foundation واسمه للنسبة. */
  quranTranslation?: { id: number; name: string };
  /** تلاوة الآيات من Quran Foundation (اختياري): معرّف التلاوة واسم القارئ. بدونها تُعرض الآية نصًّا فقط. */
  recitation?: { id: number; name: string };
  domains: Record<string, ChannelDomain>;
  /** جدول النشر: يوم الحلقة الطويلة (0 الأحد … 6 السبت) وعدد الشورتس اليومية */
  schedule?: { longDay: number; time?: string; shortsPerDay?: number };
  /** الأساليب البصرية التي تتناوب عليها حلقات القناة (للتنوّع) */
  styles?: string[];
  rules: {
    music: boolean;
    faces: boolean;
    /** القناة تستشهد بالقرآن (يفعّل جلب الآيات وبطاقاتها) */
    quran: boolean;
    hadith: boolean;
    hadithGrades: string[];
  };
  youtube: { tags: string[]; postingTime: string; voiceDisclosure: string };
};

/** ما تحتاجه المشاهد من القناة (يمر للرندر وللاستوديو). */
export type ChannelInfo = Pick<ChannelConfig, "id" | "name" | "nameLatin" | "language" | "logo">;

/** القناة الافتراضية مضمّنة للمتصفح ولـ Remotion عند غياب قناة صريحة. */
export const defaultChannel = defaultChannelJson as ChannelConfig;

export const channelInfo = (c: ChannelConfig): ChannelInfo => ({ id: c.id, name: c.name, nameLatin: c.nameLatin, language: c.language, logo: c.logo });

export const domainIds = (c: ChannelConfig) => Object.keys(c.domains);

export const themeIdForDomainIn = (c: ChannelConfig, domain: string) => c.domains[domain]?.theme ?? c.masterTheme;
