/**
 * حزمة لغة: كل ما يتغير في الفيديو بتغيّر اللغة، غير السكريبت والصوت.
 * القوالب لا تكتب نصًا ثابتًا بنفسها؛ تأخذه من هنا.
 */
export type LangPack = {
  code: string;
  /** الاسم بالعربية (للاستوديو) */
  nameAr: string;
  nativeName: string;
  dir: "rtl" | "ltr";
  /**
   * جاهزة للإنتاج؟ العربية جاهزة. التركية والإنجليزية نصوصها جاهزة،
   * لكن تخطيط القوالب من اليسار لليمين والخطوط اللاتينية يُبنيان عند إطلاق القناة.
   */
  ready: boolean;
  /** أرقام الشاشة: arab = ٠١٢٣، latn = 0123 */
  digits: "arab" | "latn";
  speech: { wordsPerMinute: number };
  /** كلمات بنية السكريبت بهذه اللغة (العربية مقبولة دائمًا في كل اللغات) */
  syntax: {
    chapter: string;
    citations: string;
    step: string;
    scene: string;
    ayah: string;
    hadith: string;
    sfx: string;
  };
  strings: {
    chapter: string;
    summary: string;
    practicalStep: string;
    follow: string;
    recitedBy: string;
    commentPrompt: string;
    shareOpinion: string;
    templateWip: string;
    quranAttribution: string;
    /** أسماء درجات الحديث للعرض */
    grades: Record<string, string>;
  };
};
