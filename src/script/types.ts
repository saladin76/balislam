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
  | { kind: "bridge"; text: string; line: number };

export type Chapter = {
  /** الرقم المكتوب في العنوان */
  number: number;
  title: string;
  line: number;
  blocks: Block[];
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
