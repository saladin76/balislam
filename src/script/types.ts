import type { Domain } from "../../brand/themes";

export type Block =
  | { kind: "narration"; text: string; line: number }
  | { kind: "scene"; template: string; options: string[]; line: number }
  | { kind: "ayah"; ref: string; text?: string; line: number }
  /** [حديث: المصدر | النص | الراوي] — النص والراوي اختياريان */
  | { kind: "hadith"; ref: string; text?: string; narrator?: string; line: number }
  | { kind: "sfx"; id: string; line: number }
  /** [استشهاد بصري صامت: المرجع — وصف]: الآية تُعرض نصًا ومرجعًا داخل المشهد والراوي مستمر؛ لا تلاوة ولا مشهد مستقل (قرار المالك ١١ نوفمبر) */
  | { kind: "cite"; ref: string; note?: string; line: number }
  | { kind: "bridge"; text: string; line: number }
  /**
   * قول شخصية (D249/D250): `[قول: <مفتاح الصوت> | <النص> | مصدر: <المرجع> | اسم: <الاسم>]`، سطرًا واحدًا. ليس سردًا: لا يُرسل
   * إلى صوت الراوي المستنسخ أبدًا، بل إلى صوت المكتبة المعتمد لمفتاحه في `channels/<القناة>/character-voices.json`.
   * `source` (المصدر الثابت، يظهر على الشاشة) إلزامي لشخصية مسمّاة (`name`)، وفي «بالإسلام» لا اسم أصلًا. البوابة src/script/characterLines.ts
   */
  | { kind: "speech"; voice: string; text: string; source?: string; name?: string; line: number };

/**
 * قسم إنتاجي داخلي («الفصل N · …» في السكريبت). الأقسام اختيارية: سكريبت بلا أي عنوان قسم نصٌّ متصل
 * يُقرأ قسمًا ضمنيًا واحدًا (رقمه 1 وبلا عنوان، implicit) فتبقى معرّفات المشاهد c1-sN.
 * عنوان القسم بيانات إنتاج: لا يُنطق ولا يُترجم ولا يظهر على الشاشة (src/script/divisions.ts).
 */
export type Chapter = {
  /** الرقم المكتوب في العنوان (1 للقسم الضمني) */
  number: number;
  /** العنوان بعد «·» إن كُتب؛ فارغ للقسم بلا عنوان وللقسم الضمني */
  title: string;
  line: number;
  blocks: Block[];
  /** true: لم يكتب المؤلف أي عنوان قسم، والنص كله قسم واحد ضمني */
  implicit?: boolean;
};

export type Citation = {
  kind: "ayah" | "hadith" | "other";
  /** الحقول المفصولة بـ | بعد النوع */
  fields: string[];
  raw: string;
  line: number;
};

export type Frontmatter = {
  title: string;
  domain: Domain;
  episode: string;
  alt_titles?: string[];
  /** لغة الحلقة إن خالفت لغة القناة */
  lang?: string;
};

export type ParsedScript = {
  file: string;
  frontmatter: Record<string, unknown> | null;
  frontmatterLine: number;
  chapters: Chapter[];
  citations: Citation[];
  hasCitationsSection: boolean;
  practicalStep: { text: string; line: number } | null;
  /** مشاكل في البنية نفسها اكتُشفت أثناء القراءة */
  parseIssues: Issue[];
};

export type IssueLevel = "error" | "warning";

export type Issue = {
  level: IssueLevel;
  code: string;
  message: string;
  line?: number;
};
