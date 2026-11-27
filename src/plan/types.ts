import type { SeriesStamp } from "../channel/series";
import type { Domain, ThemeId } from "../../brand/themes";
import type { Overlays } from "../../brand/identity/index";

/** مؤثر صوتي داخل مشهد: at بالثواني من بداية المشهد. */
/** مؤثر في المشهد: موضعه بالثواني، وخفض اختياري بالديسيبل (٠ إلى −١٨) لمؤثر يقترب من صوت الراوي (بطاقة الجودة، الخلط) */
export type PlanSfx = { id: string; at: number; gainDb?: number };

export type PlanScene = {
  /** ثابت لا يتغير عند إعادة التوليد: c<الفصل>-s<الترتيب> */
  id: string;
  template: string;
  /** نص التعليق الصوتي (مصدره السكريبت؛ يُعدَّل هناك) */
  narration: string;
  /** سطر البداية في script.md */
  line: number;
  /** حقول القالب (السؤال، الشخصية، العنصر…) */
  props: Record<string, string>;
  /** مدة يدوية بالثواني؛ إن غابت تُحسب من طول التعليق */
  durationSec?: number;
  /** خلفية من المكتبة؛ إن غابت تُستخدم زخرفة الثيم */
  backdrop?: string;
  /** قديم: يعادل overlays.captions */
  captions?: boolean;
  /** إظهار/إخفاء عناصر الشاشة لهذا المشهد فقط (ما لم يُحدَّد يتبع الحلقة) */
  overlays?: Partial<Overlays>;
  sfx: PlanSfx[];
  /** للآيات: مفتاح مثل 53:39 */
  ayahKey?: string;
  /** عدّلها المستخدم يدويًا: تُحفظ عند إعادة التوليد */
  edited?: boolean;
  /** نبرة الصوت لهذا المشهد (تتجاوز نبرة الحلقة) */
  tone?: string;
  /** صوت آخر من ElevenLabs لهذا المشهد (حوار شخصية): معرّف الصوت */
  voice?: string;
  /**
   * إملاء الكلمة على الشاشة وحدها (ملاحظة العربي، قرار المالك ٢٣ نوفمبر): الكلمة كما في توقيت الصوت ← كما تُكتب في الترجمة،
   * مثل {"يصر": "يُصِرَّ"}. لا يمس الصوت ولا مطابقة العناصر، ولا يقبل إلا إضافة تشكيل (الحروف نفسها؛ `captionSpelled`).
   */
  captionSpell?: Record<string, string>;
  /** كيف يدخل هذا المشهد من الذي قبله (الأمر 011)؛ بلا الحقل يبقى التلاشي القائم. الصيغة في src/plan/transitions.ts */
  transition?: string;
};

export type PlanChapter = { number: number; title: string; scenes: PlanScene[] };

export type Plan = {
  version: 1;
  episode: string;
  title: string;
  domain: Domain;
  themeId: ThemeId;
  /** القناة صاحبة الحلقة */
  channel?: string;
  /** لغة الحلقة (رمز مثل ar أو tr أو en) */
  lang?: string;
  updatedAt: string;
  /** إظهار/إخفاء عناصر الشاشة للحلقة كلها (ما لم يُحدَّد يتبع القناة) */
  overlays?: Partial<Overlays>;
  /** نبرة الصوت للحلقة كلها (تتجاوز نبرة القناة) */
  tone?: string;
  /** افتتاحية القناة في أول الحلقة (افتراضيًا تظهر إن كانت للقناة افتتاحية) */
  intro?: boolean;
  /**
   * أدوات المحرك التي كانت معتمدة افتراضيًا للقناة لحظة إنشاء الخطة (src/plan/engine.ts).
   * تُختم مرة واحدة، فلا يغيّر اعتماد لاحق حلقة قائمة؛ وغيابها = السلوك القديم.
   */
  engineDefaults?: string[];
  /**
   * سلسلة الحلقة كما خُتمت لحظة إنشائها (src/channel/series.ts): هويتها المشتقة وقالبها.
   * تقرؤها الافتتاحية والصورة المصغّرة وحزمة النشر، ولا يغيّرها تعديل السلسلة لاحقًا. غيابها = «عام» بهوية القناة.
   */
  series?: SeriesStamp;
  /**
   * مقاطع الشورتس/الريلز يختارها المالك: كل مقطع من مشهد إلى مشهد (يعبر الأقسام إن لزم)، والعنوان للنشر وحده.
   * غيابها في خطة قديمة = شورت لكل قسم كما كان (إن كان فيها قسمان فأكثر). src/plan/shorts.ts
   */
  shorts?: PlanShort[];
  chapters: PlanChapter[];
};

/** جزء من شورت مجمَّع (D241): من مشهد إلى مشهد بترتيب الحلقة */
export type PlanShortPart = { from: string; to: string };
/**
 * شورت: من مشهد إلى مشهد (الصيغة القديمة)، أو أجزاء مرتبة من مشاهد غير متتالية من الحلقة نفسها (D241: `segments`؛
 * و`from`/`to` حينها أول الجزء الأول وآخر الجزء الأخير، للقراءة القديمة). لا جملة جديدة ولا صوت جديد: يوصل
 * القاطع مشاهد الأجزاء بتسجيلاتها كما هي.
 * `hook: "line"`: أول جملة خطاف وليست سؤالًا (علّمها المحرر أو المالك: حقيقة مدهشة أو رقم أو جملة لافتة)، و`hookKind`
 * نوعه إن ذُكر (للتنويع بين الشورتس، لا يغيّر الحكم). `closingQuestion: "comment"`: آخر جملة سؤال للتعليقات مقصود.
 * `state`: «منشور» (لا يُعاد قصه أبدًا) أو «ملغى» (لا يُنشر، كشورتس «دفاتر الزمن» 001 ٢ و٤ و٥ و٧ بـ D231)؛ لا يُعرض
 * على المحرر ولا يُعدّ مرفوضًا في `bal shorts-check`. src/package/shortIdea.ts
 */
export type PlanShort = {
  from: string; to: string; title?: string; segments?: PlanShortPart[];
  hook?: "line"; hookKind?: ShortHookKind; closingQuestion?: "comment"; state?: ShortState;
};
/** نوع الخطاف المعلَّم (D241): حقيقة مدهشة، أو رقم، أو جملة لافتة. السؤال خطاف بنفسه بلا علامة. */
export type ShortHookKind = "fact" | "number" | "striking";
/** شورت لا يدخل إعادة القص: منشور، أو ملغى بقرار */
export type ShortState = "published" | "cancelled";
