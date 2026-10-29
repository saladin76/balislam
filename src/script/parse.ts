import { parse as parseYaml } from "yaml";
import { normalizeArabic, toLatinDigits } from "./quranMeta";
import type { Block, Chapter, Citation, Issue, ParsedScript } from "./types";

const CHAPTER_HEADING = /^الفصل\s+([0-9٠-٩]+)\s*(?:[·\-–:|]\s*(.*))?$/;
const DIRECTIVE = /^\[\s*([^\]:]+?)\s*:\s*(.+?)\s*\]$/;
const BRIDGE = /^bridge\s*:\s*(.*)$/i;

const DIRECTIVE_KINDS: Record<string, "scene" | "ayah" | "hadith" | "sfx"> = {
  مشهد: "scene",
  آية: "ayah",
  اية: "ayah",
  حديث: "hadith",
  صوت: "sfx",
};

type Section = { type: "preamble" } | { type: "chapter"; chapter: Chapter } | { type: "citations" } | { type: "step" } | { type: "unknown" };

/**
 * يقرأ ملف السكريبت ويحوّله إلى بنية. لا يحكم على المحتوى؛ الأحكام في check.ts.
 * أرقام الأسطر تبدأ من 1 لتطابق ما يظهر في المحرر.
 */
export const parseScript = (source: string, file = "script.md"): ParsedScript => {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const issues: Issue[] = [];
  const chapters: Chapter[] = [];
  const citations: Citation[] = [];
  let frontmatter: Record<string, unknown> | null = null;
  let frontmatterLine = 1;
  let hasCitationsSection = false;
  let step: { text: string; line: number } | null = null;

  let i = 0;
  while (i < lines.length && (lines[i] ?? "").trim() === "") i++;
  if ((lines[i] ?? "").trim() === "---") {
    frontmatterLine = i + 1;
    const start = i + 1;
    let end = start;
    while (end < lines.length && (lines[end] ?? "").trim() !== "---") end++;
    if (end >= lines.length) {
      issues.push({ level: "error", code: "frontmatter-unclosed", message: "ترويسة الحلقة (---) لم تُغلق بسطر --- ثانٍ.", line: frontmatterLine });
      i = lines.length;
    } else {
      try {
        const data = parseYaml(lines.slice(start, end).join("\n"));
        frontmatter = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
      } catch (err) {
        issues.push({
          level: "error",
          code: "frontmatter-yaml",
          message: `تعذّرت قراءة ترويسة الحلقة: ${(err as Error).message.split("\n")[0]}`,
          line: frontmatterLine,
        });
      }
      i = end + 1;
    }
  } else {
    issues.push({ level: "error", code: "frontmatter-missing", message: "السكريبت يجب أن يبدأ بترويسة الحلقة بين سطرين ---.", line: 1 });
  }

  let section: Section = { type: "preamble" };
  let paragraph: { text: string[]; line: number } | null = null;

  const flushParagraph = () => {
    if (!paragraph) return;
    const text = paragraph.text.join(" ").replace(/\s+/g, " ").trim();
    if (text) {
      if (section.type === "chapter") {
        section.chapter.blocks.push({ kind: "narration", text, line: paragraph.line });
      } else if (section.type === "step") {
        step = step ? { text: `${step.text} ${text}`, line: step.line } : { text, line: paragraph.line };
      } else if (section.type === "preamble") {
        issues.push({ level: "warning", code: "text-outside-chapters", message: "نص خارج الفصول لن يُقرأ ولن يظهر في الفيديو.", line: paragraph.line });
      }
    }
    paragraph = null;
  };

  for (; i < lines.length; i++) {
    const lineNo = i + 1;
    const raw = lines[i] ?? "";
    const line = raw.trim();

    if (line === "") {
      flushParagraph();
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      const level = heading[1]?.length ?? 0;
      const title = (heading[2] ?? "").trim();
      if (level !== 2) {
        issues.push({ level: "warning", code: "heading-level", message: `العنوان «${title}» يجب أن يبدأ بـ ## فقط؛ تم تجاهله.`, line: lineNo });
        section = { type: "unknown" };
        continue;
      }
      const ch = title.match(CHAPTER_HEADING);
      const norm = normalizeArabic(title);
      if (ch) {
        const chapter: Chapter = { number: Number(toLatinDigits(ch[1] ?? "0")), title: (ch[2] ?? "").trim(), line: lineNo, blocks: [] };
        chapters.push(chapter);
        section = { type: "chapter", chapter };
      } else if (norm === normalizeArabic("الاستشهادات")) {
        hasCitationsSection = true;
        section = { type: "citations" };
      } else if (norm === normalizeArabic("الخطوة العملية")) {
        section = { type: "step" };
      } else {
        issues.push({
          level: "error",
          code: "heading-unknown",
          message: `عنوان غير معروف «${title}». العناوين المسموحة: «الفصل N · العنوان»، «الاستشهادات»، «الخطوة العملية».`,
          line: lineNo,
        });
        section = { type: "unknown" };
      }
      continue;
    }

    if (section.type === "citations") {
      if (line.startsWith("-")) {
        const parts = line.replace(/^-\s*/, "").split("|").map((p) => p.trim());
        const type = normalizeArabic(parts[0] ?? "");
        const kind: Citation["kind"] = type === normalizeArabic("آية") ? "ayah" : type === normalizeArabic("حديث") ? "hadith" : "other";
        citations.push({ kind, fields: parts.slice(1), raw: line, line: lineNo });
      }
      continue;
    }

    if (section.type === "chapter") {
      const bridge = line.match(BRIDGE);
      if (bridge) {
        flushParagraph();
        section.chapter.blocks.push({ kind: "bridge", text: (bridge[1] ?? "").trim(), line: lineNo });
        continue;
      }
      if (line.startsWith("[")) {
        flushParagraph();
        const d = line.match(DIRECTIVE);
        const kind = d ? DIRECTIVE_KINDS[normalizeArabic(d[1] ?? "")] ?? DIRECTIVE_KINDS[(d[1] ?? "").trim()] : undefined;
        if (!d || !kind) {
          issues.push({
            level: "error",
            code: "directive-unknown",
            message: `علامة غير معروفة «${line}». العلامات المسموحة: [مشهد: …]، [آية: …]، [حديث: …]، [صوت: …].`,
            line: lineNo,
          });
          continue;
        }
        const value = (d[2] ?? "").trim();
        let block: Block;
        if (kind === "scene") {
          const [template = "", ...options] = value.split("|").map((s) => s.trim());
          block = { kind, template, options, line: lineNo };
        } else if (kind === "ayah") {
          block = { kind, ref: value, line: lineNo };
        } else if (kind === "hadith") {
          block = { kind, ref: value.split("|")[0]?.trim() ?? value, line: lineNo };
        } else {
          block = { kind, id: value, line: lineNo };
        }
        section.chapter.blocks.push(block);
        continue;
      }
    }

    if (!paragraph) paragraph = { text: [], line: lineNo };
    paragraph.text.push(line);
  }
  flushParagraph();

  return { file, frontmatter, frontmatterLine, chapters, citations, hasCitationsSection, practicalStep: step, parseIssues: issues };
};
