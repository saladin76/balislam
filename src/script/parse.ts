import { parse as parseYaml } from "yaml";
import { normalizeArabic, toLatinDigits } from "./quranMeta";
import type { Block, Chapter, Citation, Issue, ParsedScript } from "./types";

import { langPacks } from "../i18n/packs";

const packs = Object.values(langPacks);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** «الفصل 1 · …» أو ما يقابلها في أي لغة مفعّلة: «Bölüm 1 · …»، «Chapter 1 · …» */
const CHAPTER_HEADING = new RegExp(`^(?:${packs.map((p) => escape(p.syntax.chapter)).join("|")})\\s+([0-9٠-٩]+)\\s*(?:[·\\-–:|]\\s*(.*))?$`, "i");
const lower = (s: string) => normalizeArabic(s).toLocaleLowerCase("tr");
/** العنوان كما كتبه المالك قد يكون مشكولًا («الْفَصْلُ 1 · …»)؛ الكلمة المفتاحية تُطابَق بلا تشكيل، والعنوان يبقى بنصه. */
const bareTashkeel = (s: string) => s.normalize("NFC").replace(/[\u064B-\u0652\u0670\u0640]/g, "");
const CITATION_HEADINGS = new Set(packs.map((p) => lower(p.syntax.citations)));
const STEP_HEADINGS = new Set(packs.map((p) => lower(p.syntax.step)));
const DIRECTIVE = /^\[\s*([^\]:]+?)\s*:\s*(.+?)\s*\]$/;
const BRIDGE = /^bridge\s*:\s*(.*)$/i;

const DIRECTIVE_KINDS: Record<string, "scene" | "ayah" | "hadith" | "sfx" | "cite"> = {
  مشهد: "scene",
  آية: "ayah",
  اية: "ayah",
  حديث: "hadith",
  صوت: "sfx",
  // استشهاد بصري: نص الآية ومرجعها يظهران داخل المشهد والراوي مستمر، بلا تلاوة (قرار المالك ١١ نوفمبر)
  استشهاد: "cite",
  "استشهاد بصري": "cite",
  "استشهاد بصري صامت": "cite",
};
for (const p of packs) {
  DIRECTIVE_KINDS[lower(p.syntax.scene)] = "scene";
  DIRECTIVE_KINDS[lower(p.syntax.ayah)] = "ayah";
  DIRECTIVE_KINDS[lower(p.syntax.hadith)] = "hadith";
  DIRECTIVE_KINDS[lower(p.syntax.sfx)] = "sfx";
}

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

  // نص متصل بلا أقسام: إن لم يكتب المؤلف أي عنوان «الفصل N» فالنص بعد الترويسة قسم ضمني واحد (رقمه 1 وبلا عنوان)،
  // ولا يُفرض عليه عنوان. إن وُجد عنوان قسم واحد على الأقل بقي السلوك كما كان حرفيًا (النص قبل أول عنوان تنبيه).
  const isChapterHeading = (l: string) => {
    const h = l.trim().match(/^##\s+(.*)$/);
    if (!h) return false;
    const t = (h[1] ?? "").trim();
    return CHAPTER_HEADING.test(t) || CHAPTER_HEADING.test(bareTashkeel(t));
  };
  const implicit = !lines.slice(i).some(isChapterHeading);
  let section: Section = { type: "preamble" };
  if (implicit) {
    const chapter: Chapter = { number: 1, title: "", line: i + 1, blocks: [], implicit: true };
    chapters.push(chapter);
    section = { type: "chapter", chapter };
  }
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
        // عنوان فرعي (###) داخل فصل: يُتجاهل سطره فقط، والنص بعده يبقى في الفصل نفسه
        issues.push({ level: "warning", code: "heading-level", message: `العنوان «${title}» ليس عنوان فصل (##)؛ تم تجاهل سطر العنوان فقط، والنص بعده يبقى في القسم نفسه.`, line: lineNo });
        continue;
      }
      const direct = title.match(CHAPTER_HEADING);
      const bare = direct ? null : bareTashkeel(title).match(CHAPTER_HEADING);
      const ch = direct ?? bare;
      const norm = normalizeArabic(title);
      if (ch) {
        // من العنوان المشكول يُؤخذ ما بعد الفاصل بنصه وتشكيله
        const sep = bare ? title.search(/[·\-–:|]/) : -1;
        const chTitle = bare ? (sep === -1 ? "" : title.slice(sep + 1)) : (ch[2] ?? "");
        const chapter: Chapter = { number: Number(toLatinDigits(ch[1] ?? "0")), title: chTitle.trim(), line: lineNo, blocks: [] };
        chapters.push(chapter);
        section = { type: "chapter", chapter };
      } else if (CITATION_HEADINGS.has(lower(title))) {
        hasCitationsSection = true;
        section = { type: "citations" };
      } else if (STEP_HEADINGS.has(lower(title))) {
        section = { type: "step" };
      } else {
        issues.push({
          level: "error",
          code: "heading-unknown",
          message: `عنوان غير معروف «${title}». العناوين المسموحة: «الفصل N» أو «الفصل N · العنوان» (قسم إنتاجي اختياري)، «الاستشهادات»، «الخطوة العملية».`,
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
        const t = lower(parts[0] ?? "");
        const kind: Citation["kind"] = packs.some((p) => lower(p.syntax.ayah) === t) ? "ayah" : packs.some((p) => lower(p.syntax.hadith) === t) ? "hadith" : "other";
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
        const kind = d ? DIRECTIVE_KINDS[normalizeArabic(d[1] ?? "")] ?? DIRECTIVE_KINDS[(d[1] ?? "").trim()] ?? DIRECTIVE_KINDS[lower(d[1] ?? "")] : undefined;
        if (!d || !kind) {
          issues.push({
            level: "error",
            code: "directive-unknown",
            message: `علامة غير معروفة «${line}». العلامات المسموحة: [مشهد: …]، [آية: …]، [حديث: …]، [صوت: …]، [استشهاد بصري صامت: …].`,
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
          const sep = value.indexOf("|");
          block = { kind, ref: (sep === -1 ? value : value.slice(0, sep)).trim(),
            text: sep === -1 ? undefined : value.slice(sep + 1).trim(), line: lineNo };
        } else if (kind === "cite") {
          const [ref = value, ...rest] = value.split(/\s+[—–-]\s+/);
          block = { kind, ref: ref.trim(), note: rest.join(" — ").trim() || undefined, line: lineNo };
        } else if (kind === "hadith") {
          const [ref = value, text, narrator] = value.split("|").map((s) => s.trim());
          block = { kind, ref, text: text || undefined, narrator: narrator || undefined, line: lineNo };
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
  // القسم الضمني بلا أي محتوى (سكريبت فارغ) لا يُعد قسمًا
  if (implicit && chapters[0] && chapters[0].blocks.length === 0) chapters.length = 0;
  else if (implicit && chapters[0]) {
    const first = chapters[0].blocks[0];
    if (first) chapters[0].line = first.line;
  }

  return { file, frontmatter, frontmatterLine, chapters, citations, hasCitationsSection, practicalStep: step, parseIssues: issues };
};
