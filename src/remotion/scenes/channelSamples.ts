/**
 * نماذج معاينة القوالب لكل قناة بمحتواها هي، فلا يرى صاحب «دفاتر الزمن» في مكتبته نماذج قناة أخرى
 * (مثل «لماذا نؤجّل؟»). ما لا نموذج له هنا يبقى على النموذج العام في catalog.ts.
 * المعلومات في النماذج تاريخية مشهورة ومراجَعة، ولا تُنشر (للمعاينة في الاستوديو فقط)،
 * والعناصر المستعملة كلها من مكتبة القناة (يتحقق منها اختبار channel-samples).
 */
export const channelSamples: Record<string, Record<string, Record<string, unknown>>> = {
  "dafatir-alzaman": {
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
};
