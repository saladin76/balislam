/** تقرير إخراج تفصيلي قابل للقراءة، دون ادعاء رؤية دلالية لمحتوى الفيديو. */
import type { Plan } from "../plan/types";
import type { StoryboardMotion } from "./storyboardMotion";

const safe = (s: string) => s.replace(/[\r\n|]/g, " ").trim();
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export const motionAuditSummary = (plan: Plan, report: StoryboardMotion) => {
  const scenes = plan.chapters.flatMap((ch) => ch.scenes);
  const analyzed = scenes.filter((s) => report.scenes[s.id]);
  const warnings = analyzed.filter((s) => report.scenes[s.id]!.logic?.status === "needs-review");
  const unknown = analyzed.filter((s) => !report.scenes[s.id]!.logic || report.scenes[s.id]!.logic?.status === "not-assessable");
  return { total: scenes.length, analyzed: analyzed.length, warnings: warnings.length, unassessable: unknown.length };
};

export const renderMotionAuditMarkdown = (plan: Plan, report: StoryboardMotion): string => {
  const summary = motionAuditSummary(plan, report);
  const out = [
    `# تقرير فحص الحركة ومواءمة السكريبت — ${safe(plan.title)}`,
    "",
    `- وقت القياس: ${report.at}`,
    `- اتجاه الصورة: ${report.orientation === "portrait" ? "عمودي" : "أفقي"}`,
    `- الحركة الإجمالية: ${report.percent}%`,
    `- المشاهد المقيسة: ${summary.analyzed} من ${summary.total}`,
    `- مشاهد تحتاج مراجعة: ${summary.warnings}`,
    `- مشاهد غير قابلة للتقييم الاستدلالي: ${summary.unassessable}`,
    "",
    "> هذا الفحص يقيس تغيّر البكسلات ويتحقق من كلمات تشغيل الأحداث وترتيبها في النص، ولا يشاهد المعنى أو يثبت التزامن الفعلي لحركة الشخصية والصوت. القرار الفني والشرعي يبقى للمراجع.",
    "",
    "## المشاهد التي تحتاج انتباهًا",
    "",
  ];
  const scenes = plan.chapters.flatMap((ch) => ch.scenes);
  const priority = scenes.filter((s) => {
    const m = report.scenes[s.id];
    return !m || m.logic?.status !== "no-obvious-issues";
  });
  if (!priority.length) out.push("لا تحذيرات استدلالية من البيانات المتاحة، مع ضرورة المراجعة البصرية.", "");
  for (const s of priority) {
    const m = report.scenes[s.id];
    const state = !m ? "لم يُقس" : m.logic?.status === "needs-review" ? "يحتاج مراجعة" : "غير قابل للتقييم الآلي";
    out.push(`### ${s.id} — ${state}`, `- التعليق: ${safe(s.narration) || "(بلا تعليق)"}`);
    if (m) out.push(`- بداية المشهد: ${clock(m.from)} | الحركة: ${m.pct}% | أطول سكون: ${m.still} ث`);
    for (const f of m?.logic?.findings ?? []) {
      if (f.level === "warning") out.push(`- **${f.kind === "timing" ? "ارتباط بالنص" : f.kind === "rhythm" ? "إيقاع" : "معنى"}:** ${safe(f.message)}`);
    }
    out.push("- الإجراء: افتح المشهد في الاستوديو، شاهد المعاينة، ثم صحّح الأحداث أو وثّق سبب قبول السكون.", "");
  }
  out.push("## فهرس كل المشاهد", "", "| المشهد | البداية | الحركة | السكون | المطابقة |", "|---|---:|---:|---:|---|");
  for (const s of scenes) {
    const m = report.scenes[s.id];
    const status = !m ? "لم يُقس" : m.logic?.status === "needs-review" ? "مراجعة" : m.logic?.status === "no-obvious-issues" ? "لا مخالفة بيانات ظاهرة" : "غير قابل للتقييم";
    out.push(`| ${s.id} | ${m ? clock(m.from) : "—"} | ${m ? m.pct + "%" : "—"} | ${m ? m.still + " ث" : "—"} | ${status} |`);
  }
  out.push("", "## قيود الفحص", "", "- لا يجري تحليلًا دلاليًا للفيديو نفسه.", "- لا يقارن تلقائيًا بين أول إطار حركة وتوقيت الكلمة المنطوقة.", "- لا يعتمد المشاهد تلقائيًا ولا يغيّر بوابات النشر.", "- إذا تغيّرت مدخلات الرندر بعد القياس، أعد القياس قبل الاعتماد.", "");
  return out.join("\n");
};
