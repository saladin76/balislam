import type { CheckResult } from "./check";

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code: number, s: string) => (useColor ? `\u001b[${code}m${s}\u001b[0m` : s);
const red = (s: string) => paint(31, s);
const yellow = (s: string) => paint(33, s);
const green = (s: string) => paint(32, s);
const dim = (s: string) => paint(2, s);

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

/** تقرير الفحص بالعربية للطرفية. */
export const formatReport = (file: string, result: CheckResult): string => {
  const out: string[] = [];
  const errors = result.issues.filter((i) => i.level === "error");
  const warnings = result.issues.filter((i) => i.level === "warning");

  out.push(`فحص ${file}`);
  if (result.frontmatter) out.push(dim(`«${result.frontmatter.title}» · ${result.frontmatter.domain} · الحلقة ${result.frontmatter.episode}`));
  out.push("");

  for (const issue of result.issues) {
    const tag = issue.level === "error" ? red("خطأ") : yellow("تنبيه");
    const where = issue.line ? dim(`سطر ${issue.line}`) : dim("عام");
    out.push(`${tag}  ${where}  ${issue.message}`);
  }
  if (result.issues.length) out.push("");

  if (result.stats.chapters.length) {
    out.push("المدة التقديرية (حسب سرعة الكلام في config.json):");
    for (const c of result.stats.chapters) out.push(`  الفصل ${c.number}: ${c.words} كلمة ≈ ${mmss(c.seconds)}`);
    out.push(`  الإجمالي: ${result.stats.totalWords} كلمة ≈ ${mmss(result.stats.totalSeconds)}`);
    out.push("");
  }

  out.push(
    result.ok
      ? green(`السكريبت صالح للمرحلة التالية${warnings.length ? ` (مع ${warnings.length} تنبيه)` : ""}.`)
      : red(`السكريبت غير صالح: ${errors.length} خطأ و${warnings.length} تنبيه.`),
  );
  return out.join("\n");
};
