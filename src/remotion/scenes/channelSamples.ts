/**
 * نماذج معاينة القوالب لكل قناة بمحتواها هي، فلا يرى صاحب «دفاتر الزمن» أو «زبدة الكتب» في مكتبته نماذج قناة أخرى
 * (مثل «لماذا نؤجّل؟» أو «بعين الإسلام»). النموذج العام في catalog.ts من محتوى «بالإسلام»، فكل قالب في مكتبة
 * قناة أخرى له نموذجه هنا (يتحقق منه اختبار channel-samples).
 * المعلومات في النماذج تاريخية مشهورة ومراجَعة، ولا تُنشر (للمعاينة في الاستوديو فقط)،
 * والعناصر المستعملة كلها من مكتبة القناة (يتحقق منها اختبار channel-samples).
 */
export const channelSamples: Record<string, Record<string, Record<string, unknown>>> = {
  "dafatir-alzaman": {
    // «مكتب الرحّالة» (D194): الطريق من الكوفة إلى بغداد على خريطة رقّ، بمحتوى القناة نفسها
    "rahhala-desk": {
      shot: "map",
      mapTitle: "صورة العراق",
      water: "دجلة",
      fromPlace: "الكوفة",
      fromWord: "الكوفة",
      toPlace: "بغداد",
      toWord: "ببغداد",
      narration: "خرج أبو جعفر المنصور من الكوفة يرتاد موضعًا لمدينته، فسار شمالًا على ضفاف دجلة، حتى نزل عند قرية صغيرة تُعرف ببغداد.",
    },
    "big-question": {
      eyebrow: "السؤال",
      question: "كيف صارت بغداد مقصد العلماء؟",
      highlight: "مقصد العلماء",
      element: "book-open",
      narration: "مدينة بُنيت على ضفاف دجلة، فكيف صارت مقصد العلماء؟",
    },
    comparison: {
      eyebrow: "المنهج",
      rightTitle: "الحقيقة الثابتة",
      rightItems: "لها مصدر معتبر\nتتفق عليها الروايات\nتشهد لها الآثار",
      rightElement: "scroll",
      leftTitle: "الرواية المختلف فيها",
      leftItems: "تتعدد رواياتها\nتحتاج إلى تمحيص\nلا شاهد لها من الآثار",
      leftElement: "magnifier-brass",
      tone: "neutral",
      narration: "نميز بين الحقائق الثابتة والروايات المختلف فيها.",
    },
    list: {
      eyebrow: "مدن العلم",
      title: "ثلاث مدن صارت عواصم للعلم",
      items: "بغداد\nقرطبة\nسمرقند",
      style: "icons",
      icons: "dome, arch-gate, minaret",
      narration: "بغداد وقرطبة وسمرقند: ثلاث مدن صارت عواصم للعلم.",
    },
    "big-number": {
      eyebrow: "القسطنطينية",
      number: "1453",
      caption: "سنة فتح القسطنطينية",
      source: "",
      element: "crown",
      narration: "في سنة ألف وأربعمئة وثلاث وخمسين، فُتحت القسطنطينية.",
    },
    chart: {
      eyebrow: "أعمار الدول",
      title: "كم عاشت هذه الدول؟",
      data: "الأموية: 89\nالعباسية: 508\nالعثمانية: 623",
      unit: "سنة",
      highlight: "العثمانية",
      source: "بحسب التواريخ المشهورة لقيامها وسقوطها",
      narration: "عاشت الدولة الأموية تسعًا وثمانين سنة، والعباسية خمسمئة وثماني سنوات، والعثمانية ستمئة وثلاثًا وعشرين.",
    },
    timeline: {
      eyebrow: "محطات",
      title: "محطات من التاريخ الإسلامي",
      events: "762م | تأسيس مدينة بغداد\n1258م | سقوط بغداد على يد المغول\n1453م | فتح القسطنطينية",
      element: "hourglass-ornate",
      narration: "تأسست بغداد سنة سبعمئة واثنتين وستين، وسقطت سنة ألف ومئتين وثمانٍ وخمسين، وفُتحت القسطنطينية سنة ألف وأربعمئة وثلاث وخمسين.",
    },
    symbolic: {
      eyebrow: "العلم",
      element: "scroll",
      secondElement: "books-stack",
      relation: "becomes",
      caption: "من مخطوطة واحدة… إلى مكتبة كاملة",
      effect: "grow",
      narration: "من مخطوطة واحدة تُنسخ، إلى مكتبة كاملة.",
    },
    summary: {
      eyebrow: "الخلاصة",
      text: "التاريخ سجل لحياة البشر، نرويه بأمانة ونفهمه بعمق.",
      element: "notebook",
      narration: "التاريخ سجل لحياة البشر، نرويه بأمانة ونفهمه بعمق.",
    },
    "end-screen": {
      step: "اختر مدينة من التاريخ الإسلامي، وابحث متى تأسست ومن أسسها.",
      prompt: "اكتب في التعليقات: أي مدينة تريد أن نروي قصتها؟",
      captions: false,
    },
    // الآية والحديث بنصهما المرجعي العام؛ العنوان الصغير بلغة القناة لا بشعار قناة أخرى
    "verse-card": { eyebrow: "الشاهد" },
    "hadith-card": { eyebrow: "من السنة" },
  },
  // زبدة الكتب: خلاصات الكتب وشرحها بأسلوبنا، والعناصر من مكتبتها وحدها
  "zubdat-alkutub": {
    // «آلات الجزري» (D201): الحضور قبل الشعور، بمحتوى القناة نفسها
    "jazari-machine": {
      shot: "machine",
      idea: "الحضور",
      parts: "الحوض|العوّامة|الكفّة|الدولاب",
      dripWord: "يصلّي",
      tipWord: "ينتظر",
      turnWord: "الشعور",
      riseWord: "الحضور",
      narration: "كثيرٌ منّا يصلّي ولا يشعر، لأنّه ينتظر الشعور قبل الحضور. واللهُ أقربُ إلينا ممّا نظن.",
    },
    // «دفتر القارئ» (D227، بنماذج المالك D228): المصطلح في دائرة حمراء، بمحتوى القناة نفسها
    "reader-notebook": {
      shot: "term-circle",
      label: "مفاتيح الصلاة",
      keyWord: "يستوقفنا",
      labelWord: "مفاتيح",
      term: "العجلة",
      termWord: "العجلة",
      circleWord: "نسابق",
      narration: "أول ما يستوقفنا في «مفاتيح الصلاة» هو العجلة. فقد ندخل الصلاة وكأننا نسابق الوقت لننتهي منها.",
    },
    "big-question": {
      eyebrow: "السؤال",
      question: "لماذا نقرأ كثيرًا ولا يبقى إلا القليل؟",
      highlight: "لا يبقى",
      element: "book-open",
      narration: "نقرأ كتابًا كاملًا، وبعد أسابيع لا نتذكر منه إلا القليل. فلماذا يحدث هذا؟",
    },
    "character-talk": {
      eyebrow: "الفكرة الأولى",
      line: "سأكمل الكتاب… حين أجد وقتًا.",
      element: "book-closed",
      narration: "نشتري الكتاب بحماس، ثم نقول لأنفسنا: سأكمله حين أجد وقتًا.",
    },
    "verse-card": { eyebrow: "استشهاد" },
    "hadith-card": { eyebrow: "استشهاد" },
    comparison: {
      eyebrow: "قراءتنا",
      rightTitle: "ما يقوله الكتاب",
      rightItems: "العادة تُبنى بخطوة صغيرة\nالتكرار أهم من الحماس\nالبيئة تصنع السلوك",
      rightElement: "book-open",
      leftTitle: "ما نضيفه",
      leftItems: "النية تعطي العادة معناها\nالصبر جزء من الطريق\nالخطوة تبدأ اليوم",
      leftElement: "head-idea",
      tone: "neutral",
      narration: "نميّز بين ما يقوله الكاتب، وما نضيفه نحن من شرح.",
    },
    list: {
      eyebrow: "ثلاث أفكار",
      title: "ثلاث أفكار من الكتاب",
      items: "ابدأ صغيرًا\nكرّر كل يوم\nغيّر ما حولك",
      style: "numbered",
      icons: "seed, refresh, house",
      narration: "ابدأ صغيرًا، وكرّر كل يوم، وغيّر ما حولك.",
    },
    "big-number": {
      eyebrow: "عدّاد الأفكار",
      number: "٣",
      caption: "أفكار نخرج بها من الكتاب",
      source: "",
      element: "lightbulb",
      narration: "ثلاث أفكار نخرج بها من هذا الكتاب.",
    },
    chart: {
      eyebrow: "مثال توضيحي",
      title: "ماذا يبقى مما نقرأ؟",
      data: "بعد يوم: 70\nبعد أسبوع: 40\nبعد شهر: 20",
      unit: "٪",
      highlight: "بعد شهر",
      source: "أرقام توضيحية للمعاينة",
      narration: "ما نقرؤه يتناقص في الذاكرة مع الأيام، إن لم نعد إليه.",
    },
    symbolic: {
      eyebrow: "الفكرة",
      element: "seed",
      secondElement: "tree",
      relation: "becomes",
      caption: "عادة صغيرة اليوم… أثر كبير غدًا",
      effect: "grow",
      narration: "العادة الصغيرة اليوم تصير أثرًا كبيرًا غدًا.",
    },
    "board-story": {
      eyebrow: "",
      narration: "قارئان يقرآن الكتاب نفسه. الأول يجمع الاقتباسات، والثاني يطبّق فكرة واحدة. فمن منهما خرج بأكثر؟",
      beats: "books-stack | الكتاب نفسه\nquote-open | الاقتباسات\nchecklist | فكرة واحدة",
    },
    "sketch-board": {
      eyebrow: "الخطوة العملية",
      title: "قاعدة الصفحات العشر",
      keyword: "العشر",
      element: "book-open",
      items: "اختر كتابًا واحدًا\nاقرأ عشر صفحات يوميًا\nاكتب بعدها فكرة واحدة",
      narration: "اقرأ عشر صفحات كل يوم، واكتب بعدها فكرة واحدة.",
    },
    summary: {
      eyebrow: "الخلاصة",
      text: "القراءة تُثمر حين تتحول الفكرة إلى عمل.",
      element: "lightbulb",
      narration: "القراءة تُثمر حين تتحول الفكرة إلى عمل.",
    },
    "end-screen": {
      step: "اختر فكرة واحدة من الكتاب، وطبّقها اليوم.",
      prompt: "اكتب في التعليقات: أي فكرة اخترت؟",
      captions: false,
    },
  },
};

/** نموذج القالب لقناة: نموذجها الخاص فوق النموذج العام. */
export const sampleForChannel = (channelId: string | undefined, templateId: string, base: Record<string, unknown>): Record<string, unknown> => {
  const own = channelId ? channelSamples[channelId]?.[templateId] : undefined;
  return own ? { ...base, ...own } : base;
};

/** نموذجا الخطوط في كتالوج عناصر القناة (العنوان والنص) */
export const catalogSamples: Record<string, { heading: string; body: string }> = {
  "dafatir-alzaman": { heading: "كيف صارت بغداد مقصد العلماء؟", body: "تاريخ نرويه بأمانة، ونفهمه بعمق." },
  "zubdat-alkutub": { heading: "لماذا نقرأ ولا يبقى إلا القليل؟", body: "خلاصة الكتاب بأسلوبنا، وفكرة واحدة نطبّقها." },
};
