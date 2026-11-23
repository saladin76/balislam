/** أنواع سجل العلماء والكتب وثوابتهما، بلا وحدات Node (يقرؤها الاستوديو في المتصفح أيضًا)، D206. */
export const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const REVIEW_STATES = ["not-started", "in-review", "report-written", "owner-approved"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];
export const REVIEW_AR: Record<ReviewState, string> = {
  "not-started": "لم تبدأ", "in-review": "قيد المراجعة", "report-written": "كُتب تقرير المتخصص", "owner-approved": "اعتمده المالك",
};

export type Scholar = {
  id: string;
  name: string;
  /** سنة الوفاة هجريًا وميلاديًا (تقريبًا إن لم تثبت، ويُكتب ذلك في note) */
  died: { hijri: number; gregorian: number };
  place: string;
  field: string;
  review: {
    state: ReviewState;
    /** عليه خلاف عقدي: لا اعتماد إلا بتقرير متخصص مكتوب (المرجع «اختيار العلماء») */
    doctrinalDispute: boolean;
    /** مسار تقرير المتخصص (نسبةً إلى جذر المستودع) */
    report?: string;
    note?: string;
  };
  /** حلقة التعريف: تُنشر على «دفاتر الزمن» و«زبدة الكتب» شريك بخاصية التعاون */
  intro?: { channel: string; episode: string };
  /** سلسلة العالِم في «زبدة الكتب» (تصنيف تحت رفه) */
  series: string;
};

export type Book = {
  id: string;
  title: string;
  /** معرّف العالِم في السجل، أو بلا (مؤلف معاصر لا سلسلة له) */
  scholar?: string;
  author: string;
  edition: { publisher: string; year: string; editor: string; note?: string };
  /** عدد الأجزاء المخطط؛ null ما لم يُحدد بعد الدراسة */
  parts: number | null;
  /** سلسلة الكتاب في «زبدة الكتب» */
  series: string;
};

export type Scholars = { version: 1; scholars: Scholar[] };
export type Books = { version: 1; books: Book[] };

