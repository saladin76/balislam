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

/** طبقة صوت القناة: السرعة (0.7–1.2) والثبات والتعبير (0–1) */
export type VoiceProfile = { nameAr?: string; speed: number; stability: number; style: number; /** أمر أداء للنماذج الحديثة يصف طبقة القناة (بالإنجليزية) */ direction?: string };

export type ChannelConfig = {
  id: string;
  name: string;
  nameLatin: string;
  /** الاسم كما يُرسم على الصور (بالتشكيل إن لزم)، والاسم العادي يبقى للبحث والنصوص */
  nameDisplay?: string;
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
  /** بصمة القناة الثابتة: الافتتاحية وأسلوب الصورة المصغّرة */
  brand?: { intro?: "mihrab" | "horizon" | "highlighter" | "none"; thumbnail?: "mihrab" | "horizon" | "highlighter" | "circle"; /** مظهر المشاهد المرسومة: سينمائي أو مسطح */ sceneLook?: "cinema" | "flat" };
  /** صوت القناة في ElevenLabs (إن غاب: ELEVENLABS_VOICE_ID من الإعدادات) */
  voice?: {
    id?: string;
    name?: string;
    /** النبرة الافتراضية للقناة (تتغير لكل حلقة أو مشهد) */
    tone?: string;
    /** «طبقة» القناة: صوت صاحب القناة نفسه بإعدادات أساس خاصة بها، والنبرات تتحرك حولها */
    profile?: VoiceProfile;
  };
  /** أصوات إضافية للشخصيات (الحوار في الحلقات التاريخية مثلًا): من أصوات حساب ElevenLabs */
  cast?: { id: string; name: string; role?: string }[];
  rules: {
    music: boolean;
    faces: boolean;
    /** القناة تستشهد بالقرآن (يفعّل جلب الآيات وبطاقاتها) */
    quran: boolean;
    hadith: boolean;
    hadithGrades: string[];
  };
  /**
   * مكتبة القناة: ما يستبعده صاحب القناة منها لأنه لا يناسب هويتها (أداة حديثة في قناة تاريخ، مكان برسومات قديمة…).
   * خاص بهذه القناة وحدها؛ والملفات تبقى في المحرك المشترك لبقية القنوات.
   */
  /** قواعد السكريبت الخاصة بالقناة: fixedChapters=false عدد الفصول وطولها حر، practicalStep=false بلا «الخطوة العملية» */
  script?: { fixedChapters?: boolean; practicalStep?: boolean };
  library?: {
    exclude?: { elements?: string[]; categories?: string[]; sets?: string[]; templates?: string[] };
    /** قائمة سماح: إن وُجدت فلا يدخل مكتبة القناة من العناصر إلا ما فيها (أو في فئاتها)، فلا يتسرب إليها ما يُرسم لقنوات أخرى لاحقًا */
    include?: { elements?: string[]; categories?: string[] };
    /** figures: الشخصيات التاريخية وحدها في الاستوديو (بلا الرواة العامّين) */
    characters?: "all" | "figures";
    /** «illus»: شخصيات القناة وأماكنها المصوَّرة الجديدة (src/remotion/illus) بدل القديمة في الاستوديو */ cast?: "illus" };
  /** footer: سطر ثابت في آخر كل وصف (توقيع القناة)، ولا يذكر أدوات الإنتاج أبدًا */
  youtube: { tags: string[]; postingTime: string; footer: string };
};

/** ما تحتاجه المشاهد من القناة (يمر للرندر وللاستوديو). */
export type ChannelInfo = Pick<ChannelConfig, "id" | "name" | "nameDisplay" | "nameLatin" | "language" | "logo" | "brand"> & { rules?: Pick<ChannelConfig["rules"], "faces" | "music"> & Partial<Pick<ChannelConfig["rules"], "quran" | "hadith">>; library?: ChannelConfig["library"]; cast?: ChannelConfig["cast"]; tone?: string; voiceProfile?: string };

/** القناة الافتراضية مضمّنة للمتصفح ولـ Remotion عند غياب قناة صريحة. */
export const defaultChannel = defaultChannelJson as ChannelConfig;

export const channelInfo = (c: ChannelConfig): ChannelInfo => ({ id: c.id, name: c.name, nameDisplay: c.nameDisplay, nameLatin: c.nameLatin, language: c.language, logo: c.logo, brand: c.brand, rules: { faces: c.rules.faces, music: c.rules.music, quran: c.rules.quran, hadith: c.rules.hadith }, library: c.library });

export const domainIds = (c: ChannelConfig) => Object.keys(c.domains);

export const themeIdForDomainIn = (c: ChannelConfig, domain: string) => c.domains[domain]?.theme ?? c.masterTheme;
