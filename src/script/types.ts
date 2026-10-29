import type { Domain } from "../../brand/themes";

export type Block =
  | { kind: "narration"; text: string; line: number }
  | { kind: "scene"; template: string; options: string[]; line: number }
  | { kind: "ayah"; ref: string; line: number }
  | { kind: "hadith"; ref: string; line: number }
  | { kind: "sfx"; id: string; line: number }
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
