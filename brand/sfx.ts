/**
 * سجل المؤثرات الصوتية والآهات. لا موسيقى ولا آلات إطلاقًا (قرار القناة).
 * كل مؤثر له معرّف يُستخدم في السكريبت: [صوت: page-turn]
 * prompt: وصف إنجليزي لتوليده عبر ElevenLabs Sound Effects، أو للبحث في مكتبة مرخصة.
 * الملفات النهائية تُحفظ في assets/sfx/<id>.mp3 بعد الاستماع والاعتماد.
 */
export type SfxCategory = "transition" | "ui" | "paper" | "home" | "nature" | "money" | "knowledge" | "body" | "vocal";

export type SfxDef = {
  id: string;
  nameAr: string;
  category: SfxCategory;
  /** متى يُستخدم */
  useAr: string;
  /** المدة التقريبية بالثواني */
  seconds: number;
  prompt: string;
  /** ضابط: لا إيقاع موسيقي ولا نغمات آلات */
  guard?: string;
};

export const sfxCategoryNamesAr: Record<SfxCategory, string> = {
  transition: "انتقالات",
  ui: "واجهة وتنبيهات",
  paper: "ورق وحبر",
  home: "البيت",
  nature: "الطبيعة",
  money: "المال",
  knowledge: "العلم والحضارة",
  body: "حركة الإنسان",
  vocal: "آهات بشرية",
};

const NO_MUSIC = "بدون أي نغمة موسيقية أو آلة أو إيقاع";

export const sfxLibrary: SfxDef[] = [
  // انتقالات
  { id: "whoosh-soft", nameAr: "هبّة ناعمة", category: "transition", useAr: "دخول عنصر أو انتقال بين مشهدين", seconds: 0.6, prompt: "soft short airy whoosh, clean, no music", guard: NO_MUSIC },
  { id: "whoosh-fast", nameAr: "هبّة سريعة", category: "transition", useAr: "انتقال حاد بين فصلين", seconds: 0.4, prompt: "fast swish whoosh, crisp, no tonal content", guard: NO_MUSIC },
  { id: "swipe-paper", nameAr: "سحب ورقة", category: "transition", useAr: "تبديل بطاقة أو قائمة", seconds: 0.5, prompt: "paper sliding swipe across a desk, close mic" },
  { id: "pop", nameAr: "فرقعة ظهور", category: "transition", useAr: "ظهور رمز أو رقم", seconds: 0.2, prompt: "small soft pop, mouth-like, short, no pitch melody", guard: NO_MUSIC },
  { id: "drop-soft", nameAr: "سقوط ناعم", category: "transition", useAr: "استقرار عنصر في مكانه", seconds: 0.3, prompt: "soft thud of a light object landing on felt" },
  { id: "rise", nameAr: "صعود هواء", category: "transition", useAr: "تمهيد قبل كشف فكرة", seconds: 1.2, prompt: "rising airy noise swell, wind-like, no tones, no music", guard: NO_MUSIC },
  { id: "silence-room", nameAr: "سكون غرفة", category: "transition", useAr: "لحظة صمت مقصودة قبل الآية أو الخلاصة", seconds: 2, prompt: "quiet room tone, very subtle air, no hum" },
  // واجهة
  { id: "click", nameAr: "نقرة", category: "ui", useAr: "اختيار عنصر في قائمة", seconds: 0.1, prompt: "single soft mechanical click" },
  { id: "tick", nameAr: "علامة صح", category: "ui", useAr: "ظهور علامة صح", seconds: 0.25, prompt: "pen tick mark on paper, quick" },
  { id: "cross-scribble", nameAr: "شطب", category: "ui", useAr: "ظهور علامة خطأ أو شطب فكرة", seconds: 0.5, prompt: "marker scribble crossing out on paper" },
  { id: "notification", nameAr: "إشعار هاتف", category: "ui", useAr: "مشاهد الهاتف والتشتت", seconds: 0.6, prompt: "phone vibration buzz on a wooden table, no ringtone melody", guard: "اهتزاز فقط، بلا نغمة رنين" },
  { id: "typing", nameAr: "كتابة على لوحة مفاتيح", category: "ui", useAr: "مشاهد العمل والحاسوب", seconds: 1.5, prompt: "laptop keyboard typing, light, steady" },
  { id: "phone-scroll", nameAr: "تمرير شاشة", category: "ui", useAr: "تصفح بلا نهاية", seconds: 1, prompt: "finger swiping on glass phone screen, repeated soft" },
  { id: "camera-shutter", nameAr: "التقاط صورة", category: "ui", useAr: "تجميد لحظة", seconds: 0.3, prompt: "camera shutter click" },
  { id: "counter-tick", nameAr: "عدّاد أرقام", category: "ui", useAr: "قالب الرقم الكبير وهو يعدّ", seconds: 1, prompt: "fast mechanical counter ticking, rolling numbers" },
  // ورق وحبر
  { id: "page-turn", nameAr: "قلب صفحة", category: "paper", useAr: "انتقال داخل ثيم حبر وورق", seconds: 0.7, prompt: "single book page turn, crisp paper" },
  { id: "pen-write", nameAr: "كتابة بقلم", category: "paper", useAr: "ظهور نص يُكتب", seconds: 1.5, prompt: "pen writing on paper, steady scratching" },
  { id: "pencil-sketch", nameAr: "رسم بقلم رصاص", category: "paper", useAr: "رسم خطوط المشهد", seconds: 1.5, prompt: "pencil sketching lines on paper" },
  { id: "paper-crumple", nameAr: "تجعيد ورقة", category: "paper", useAr: "التخلي عن فكرة أو عادة", seconds: 1, prompt: "paper crumpling into a ball" },
  { id: "paper-tear", nameAr: "تمزيق ورقة", category: "paper", useAr: "قطع ونهاية", seconds: 0.8, prompt: "paper tearing, single rip" },
  { id: "stamp", nameAr: "ختم", category: "paper", useAr: "تأكيد حكم أو خلاصة", seconds: 0.4, prompt: "rubber stamp pressed on paper, firm" },
  { id: "book-close", nameAr: "إغلاق كتاب", category: "paper", useAr: "نهاية فصل", seconds: 0.5, prompt: "hardcover book closing, soft thump" },
  // البيت
  { id: "door-open", nameAr: "فتح باب", category: "home", useAr: "دخول البيت أو فرصة جديدة", seconds: 1.2, prompt: "wooden door opening, gentle creak" },
  { id: "door-close", nameAr: "إغلاق باب", category: "home", useAr: "قطيعة أو نهاية", seconds: 0.8, prompt: "wooden door closing, soft latch" },
  { id: "knock", nameAr: "طرق باب", category: "home", useAr: "زيارة، صلة رحم", seconds: 1, prompt: "three knocks on a wooden door" },
  { id: "cups-tea", nameAr: "أكواب شاي", category: "home", useAr: "جلسة عائلية", seconds: 1.5, prompt: "tea poured into glass cups, light clinks" },
  { id: "kids-laugh-far", nameAr: "ضحك أطفال بعيد", category: "home", useAr: "دفء البيت", seconds: 2, prompt: "distant children laughing softly indoors, no music" },
  { id: "clock-tick", nameAr: "دقات ساعة", category: "home", useAr: "مرور الوقت والتأجيل", seconds: 3, prompt: "wall clock ticking, steady" },
  { id: "keys-jingle", nameAr: "رنين مفاتيح", category: "home", useAr: "الخروج أو العودة", seconds: 0.8, prompt: "house keys jingling" },
  { id: "dishes", nameAr: "أطباق", category: "home", useAr: "مطبخ، خدمة الأهل", seconds: 1.5, prompt: "plates and cutlery being set on a table" },
  // الطبيعة
  { id: "wind", nameAr: "رياح", category: "nature", useAr: "صحراء، فراغ، تأمل", seconds: 4, prompt: "gentle desert wind, no tones" },
  { id: "rain", nameAr: "مطر", category: "nature", useAr: "رحمة، حزن هادئ", seconds: 5, prompt: "steady light rain on a window" },
  { id: "thunder-far", nameAr: "رعد بعيد", category: "nature", useAr: "تحذير، اضطراب", seconds: 3, prompt: "distant rolling thunder" },
  { id: "birds-morning", nameAr: "عصافير الصباح", category: "nature", useAr: "بداية جديدة، صباح", seconds: 4, prompt: "morning sparrows chirping outdoors" },
  { id: "night-crickets", nameAr: "صراصير الليل", category: "nature", useAr: "ثيم ليلٌ هادئ", seconds: 5, prompt: "night crickets, calm, sparse" },
  { id: "water-stream", nameAr: "جدول ماء", category: "nature", useAr: "سكينة، طهارة", seconds: 5, prompt: "small water stream flowing over stones" },
  { id: "water-drop", nameAr: "قطرة ماء", category: "nature", useAr: "أثر صغير متراكم", seconds: 0.4, prompt: "single water drop into still water" },
  { id: "waves", nameAr: "أمواج", category: "nature", useAr: "سعة، بحر", seconds: 5, prompt: "calm sea waves on sand" },
  { id: "fire-crackle", nameAr: "طقطقة نار", category: "nature", useAr: "دفء، أو غضب", seconds: 4, prompt: "campfire crackling" },
  { id: "leaves-rustle", nameAr: "حفيف أوراق", category: "nature", useAr: "نمو، شجرة", seconds: 3, prompt: "tree leaves rustling in breeze" },
  { id: "seed-grow", nameAr: "نمو نبتة", category: "nature", useAr: "تحول تدريجي", seconds: 1.5, prompt: "soft organic creak and rustle, plant growing, stylized" },
  // المال
  { id: "coin-drop", nameAr: "سقوط عملة", category: "money", useAr: "صدقة، ادخار", seconds: 0.6, prompt: "single coin dropping into a jar" },
  { id: "coins-pile", nameAr: "كومة عملات", category: "money", useAr: "ثروة، تراكم", seconds: 1.2, prompt: "pile of coins sliding and clinking" },
  { id: "cash-count", nameAr: "عدّ أوراق نقدية", category: "money", useAr: "إنفاق، حساب", seconds: 1.5, prompt: "counting paper banknotes, flicking" },
  { id: "register", nameAr: "درج نقود", category: "money", useAr: "بيع وشراء", seconds: 0.8, prompt: "cash drawer opening, mechanical, no bell melody", guard: NO_MUSIC },
  { id: "card-swipe", nameAr: "دفع بالبطاقة", category: "money", useAr: "استهلاك، دين", seconds: 0.6, prompt: "card tap on payment terminal, short beep", guard: "صفارة قصيرة واحدة فقط" },
  { id: "scale-balance", nameAr: "ميزان", category: "money", useAr: "عدل، موازنة", seconds: 1, prompt: "metal balance scale pans swinging and settling" },
  { id: "market-crowd", nameAr: "سوق", category: "money", useAr: "تجارة، زحام", seconds: 4, prompt: "busy traditional market ambience, voices murmuring, no music", guard: "تأكد من خلوّه من موسيقى خلفية" },
  // العلم والحضارة
  { id: "quill-write", nameAr: "ريشة تكتب", category: "knowledge", useAr: "تاريخ، مخطوطات", seconds: 1.5, prompt: "quill pen scratching on parchment" },
  { id: "scroll-unroll", nameAr: "فتح مخطوطة", category: "knowledge", useAr: "كشف وثيقة", seconds: 1, prompt: "old parchment scroll unrolling" },
  { id: "gears", nameAr: "تروس", category: "knowledge", useAr: "آلية، سبب ونتيجة", seconds: 2, prompt: "mechanical gears turning, clockwork" },
  { id: "chalk", nameAr: "طباشير", category: "knowledge", useAr: "شرح، تعليم", seconds: 1.5, prompt: "chalk writing on a blackboard" },
  { id: "stone-steps", nameAr: "خطوات على حجر", category: "knowledge", useAr: "أروقة، مسجد قديم", seconds: 2, prompt: "footsteps echoing in a stone hall" },
  { id: "hall-echo", nameAr: "صدى قاعة", category: "knowledge", useAr: "مكتبة كبيرة، تاريخ", seconds: 3, prompt: "large stone hall ambience, light reverb, no music" },
  // حركة الإنسان
  { id: "footsteps", nameAr: "خطوات", category: "body", useAr: "سعي، طريق", seconds: 2, prompt: "footsteps walking on pavement" },
  { id: "run", nameAr: "جري", category: "body", useAr: "عجلة، مطاردة الدنيا", seconds: 2, prompt: "running footsteps, fast" },
  { id: "heartbeat", nameAr: "نبض قلب", category: "body", useAr: "قلق، خوف، توتر", seconds: 2, prompt: "slow heartbeat, deep" },
  { id: "breath-in", nameAr: "شهيق", category: "body", useAr: "تهدئة، بداية", seconds: 1.5, prompt: "calm deep breath in" },
  { id: "breath-out", nameAr: "زفير", category: "body", useAr: "ارتياح", seconds: 1.5, prompt: "long relieved exhale" },
  { id: "sigh", nameAr: "تنهيدة", category: "body", useAr: "تعب، حسرة", seconds: 1.2, prompt: "tired sigh, adult" },
  { id: "crowd-murmur", nameAr: "همهمة ناس", category: "body", useAr: "مجتمع، ضغط الناس", seconds: 4, prompt: "crowd murmuring indoors, no music" },
  // آهات بشرية (أصوات بشرية بلا آلات)
  { id: "aah-soft", nameAr: "آهة هادئة", category: "vocal", useAr: "لحظات التأمل والخلاصة", seconds: 4, prompt: "human male humming a soft sustained 'aah', solo voice, no instruments", guard: "صوت بشري فقط بإذن المنشد" },
  { id: "aah-rise", nameAr: "آهة صاعدة", category: "vocal", useAr: "قبل كشف الفكرة الكبرى", seconds: 4, prompt: "solo human voice 'aah' slowly rising, no instruments", guard: "صوت بشري فقط بإذن المنشد" },
  { id: "aah-intro", nameAr: "آهة الافتتاح", category: "vocal", useAr: "هوية القناة في أول 3 ثوانٍ", seconds: 3, prompt: "short warm human 'aah' signature, solo voice", guard: "تُسجَّل خصيصًا للقناة" },
  { id: "aah-outro", nameAr: "آهة الختام", category: "vocal", useAr: "شاشة النهاية", seconds: 4, prompt: "gentle descending human 'aah', solo voice, fade out", guard: "تُسجَّل خصيصًا للقناة" },
  { id: "hum-low", nameAr: "همهمة منخفضة", category: "vocal", useAr: "خلفية خفيفة جدًا لمشاهد الليل", seconds: 6, prompt: "low human humming drone, very soft, no instruments", guard: "صوت بشري فقط" },
];
