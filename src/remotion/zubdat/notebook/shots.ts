/**
 * لقطات قالب «دفتر القارئ» (reader-notebook) لـ«زبدة الكتب» (D227) وحقول كل لقطة (بلا React: يقرؤها مولّد الخطة والاستوديو).
 * بُنيت وفق D228 بعد اختيار المالك نماذجها من ستوري بورد «زبدة-الكتب-001» (~/Desktop/للمراجعة/ستوري-بورد/زبدة-الكتب-001/)،
 * كل لقطة نموذج واحد معتمد (variant) لا غير، وسجل اعتمادها في templates/approvals.json («reader-notebook/<اللقطة>»).
 *
 * كل خانة نصية تُملأ من السكريبت (لا نص حلقة ثابت في القالب)، ولكل خانة «كلمة …» تُكتب أو تُرسم لحظة نطقها
 * («كلمة#2» للورود الثاني). القوائم مفصولة بـ |. الخانة الفارغة لا تُرسم (الفراغ أفضل من عنصر خاطئ).
 */
export type NotebookShotId = "checklist-heart" | "margin-thoughts" | "shelf-book" | "twin-pans" | "term-circle" | "fold-threshold";

export type NotebookShot = {
  nameAr: string;
  /** النموذج المعتمد من الستوري بورد */
  variant: string;
  /** مفتاح قرار المالك في templates/approvals.json */
  storyboard: string;
  /** الورق: نقاط أو سطور الدفتر بهامش أحمر */
  paper: "dots" | "lines";
  /** الحقول التي تقرؤها اللقطة: نصوص الخانات ثم كلماتها */
  fields: string[];
};

const SB = "storyboard:زبدة-الكتب-001";
export const NOTEBOOK_SHOTS: Record<NotebookShotId, NotebookShot> = {
  "checklist-heart": {
    nameAr: "الأفعال تُعلَّم والقلب ينتظر", variant: "مشهد-1-نموذج-أ", storyboard: `${SB}/مشهد-1`, paper: "lines",
    fields: ["items", "itemWords", "boxesWord", "checkWord", "heart", "heartBoxWord", "heartWord", "groupWord", "question", "questionWords", "arrowWord"],
  },
  "margin-thoughts": {
    nameAr: "الأفكار تطير من الهامش", variant: "مشهد-2-نموذج-أ", storyboard: `${SB}/مشهد-2`, paper: "lines",
    fields: ["title", "titleWord", "habitWord", "steadyWord", "line", "lineWord", "mindWord", "notes", "noteWords", "seek", "seekWord", "mark", "markWord", "clearWord"],
  },
  "shelf-book": {
    nameAr: "الرف والكتاب المختار", variant: "مشهد-3-نموذج-أ", storyboard: `${SB}/مشهد-3`, paper: "dots",
    fields: ["title", "titleWord", "shelfWord", "book", "bookWords", "label", "labelWord", "author", "authorWord", "path", "pathWords", "skipWord", "startWord", "question", "questionWord"],
  },
  "twin-pans": {
    nameAr: "كفتان متوازيتان", variant: "مشهد-4-نموذج-ب", storyboard: `${SB}/مشهد-4`, paper: "dots",
    fields: ["standWord", "beamWord", "swayWords", "left", "leftWord", "right", "rightWord", "recallWords", "balanceWord", "mark", "markWord"],
  },
  "term-circle": {
    nameAr: "المصطلح في دائرة حمراء", variant: "مشهد-5-نموذج-أ", storyboard: `${SB}/مشهد-5`, paper: "dots",
    fields: ["label", "keyWord", "labelWord", "term", "termWord", "circleWord", "author", "authorWord", "contrast", "contrastWord", "neqWord", "againWord", "cross", "crossWord", "strikeWord", "keep", "keepWord", "markWord"],
  },
  "fold-threshold": {
    nameAr: "قائمة الشغل تنطوي", variant: "مشهد-6-نموذج-أ", storyboard: `${SB}/مشهد-6`, paper: "lines",
    fields: ["sheetWord", "work", "workWord", "nagWord", "foldWord", "doneWord", "title", "titleWord", "boxesWord", "steps", "stepWords", "markWord"],
  },
};

/** اسم كل حقل في محرر المشهد */
export const NOTEBOOK_FIELD_LABELS: Record<string, string> = {
  items: "الأفعال (مفصولة بـ |)",
  itemWords: "كلمة كل فعل (مفصولة بـ |)",
  boxesWord: "كلمة رسم المربعات",
  checkWord: "كلمة علامات ✓",
  heart: "خانة المربع الفارغ (مثل: القلب؟)",
  heartBoxWord: "كلمة رسم المربع الفارغ",
  heartWord: "كلمة كتابة خانة المربع الفارغ",
  groupWord: "كلمة القوس الجامع للأفعال",
  question: "سؤال الهامش (سطران مفصولان بـ |)",
  questionWords: "كلمة كل سطر من السؤال (|)",
  arrowWord: "كلمة السهم من السؤال إلى المربع",
  title: "العنوان",
  titleWord: "كلمة كتابة العنوان",
  habitWord: "كلمة سهم التكرار بجوار العنوان",
  steadyWord: "كلمة الخط تحت العنوان",
  line: "سطر القراءة",
  lineWord: "كلمة كتابة سطر القراءة",
  mindWord: "كلمة الورقة الأولى (الذهن في مكان آخر)",
  notes: "كلمات الأوراق اللاصقة (|)",
  noteWords: "كلمة كل ورقة (|)",
  seek: "سطر المطلوب",
  seekWord: "كلمة كتابة سطر المطلوب",
  mark: "العبارة تحت قلم التحديد",
  markWord: "كلمة امتداد قلم التحديد",
  clearWord: "كلمة انحسار الأوراق",
  shelfWord: "كلمة رسم الرف",
  book: "عنوان الكتاب على كعبه (سطران مفصولان بـ |)",
  bookWords: "كلمة كل سطر من عنوان الكتاب (|)",
  label: "العبارة الحمراء",
  labelWord: "كلمة العبارة الحمراء",
  author: "المؤلف",
  authorWord: "كلمة كتابة المؤلف",
  path: "محطات الرحلة (|)",
  pathWords: "كلمة كل محطة (|)",
  skipWord: "كلمة شطب المحطة الأخيرة",
  startWord: "كلمة دائرة المحطة الأولى",
  questionWord: "كلمة كتابة السؤال",
  standWord: "كلمة رسم القائم",
  beamWord: "كلمة رسم الذراع والكفتين",
  swayWords: "كلمات ميل الكفتين: يمين|يسار",
  left: "كفة اليسار",
  leftWord: "كلمة كفة اليسار",
  right: "كفة اليمين",
  rightWord: "كلمة كفة اليمين",
  recallWords: "كلمتا العودة إلى الكفتين: يمين|يسار",
  balanceWord: "كلمة توازن الكفتين",
  keyWord: "كلمة رسم المفتاح",
  term: "المصطلح",
  termWord: "كلمة كتابة المصطلح",
  circleWord: "كلمة الدائرة الحمراء",
  contrast: "ما لا يجتمع معه",
  contrastWord: "كلمة كتابته",
  neqWord: "كلمة علامة ≠",
  againWord: "كلمة الدورة الثانية للدائرة",
  cross: "العبارة المشطوبة",
  crossWord: "كلمة كتابتها",
  strikeWord: "كلمة الشطب",
  keep: "العبارة المحددة",
  keepWord: "كلمة كتابتها",
  sheetWord: "كلمة ظهور ورقة الشغل",
  work: "بنود الشغل (|)",
  workWord: "كلمة كتابة البنود",
  nagWord: "كلمة الخربشة تحت البنود (ما زال يشغلنا)",
  foldWord: "كلمة بدء طي الركن",
  doneWord: "كلمة اكتمال الطي",
  steps: "الخطوات (|)",
  stepWords: "كلمة كل خطوة (|)",
};
