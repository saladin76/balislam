/**
 * «المراجعات الفنية» (الأمر 018) — غير «reviews/» (تقارير الاعتماد التحريري والشرعي بصيغة HTML): تقارير مراجعة موثقة بجوار الحلقة أو المختبر الذي تراجعه، تُعرض في الاستوديو.
 * المراجعة مجلد tech-reviews/<المعرّف>/ فيه review.json وreport.md وشرائط (strips/*.jpg) ومقاطع (clips/*.mp4).
 * المراجعة توصية من المنفّذ؛ لا تغيّر حالة اعتماد شيء. قرار المشرف حقل منفصل (supervisorDecision) يبقى فارغًا حتى يتخذه.
 * البيانات لكل قناة من مجلد حلقاتها وحده.
 */
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export type TechReviewTarget = { label: string; kind: "episode" | "lab"; dir: string; preview: string; duration?: string };
export type TechReviewMeta = {
  title: string;
  order?: string;
  date: string;
  author: string;
  /** توصية المنفّذ: ready = جاهز للاعتماد البصري · fixes = يحتاج إصلاحات محددة */
  recommendation: "ready" | "fixes";
  summary: string;
  targets: TechReviewTarget[];
  /** قرار المشرف: فارغ حتى يتخذه؛ لا يُكتب بالنيابة عنه */
  supervisorDecision: null | { at: string; decision: string };
};
export type TechReviewSummary = TechReviewMeta & { dir: string; id: string; strips: string[]; clips: string[]; hasReport: boolean };

const OK_FILE = /^(report\.md|strips\/[\w.-]+\.jpg|clips\/[\w.-]+\.mp4)$/;

/** يتحقق من بنية review.json */
export const techReviewProblems = (m: Partial<TechReviewMeta>): string[] => {
  const p: string[] = [];
  if (!m.title?.trim()) p.push("title فارغ");
  if (!m.date) p.push("date فارغ");
  if (!m.author?.trim()) p.push("author فارغ");
  if (m.recommendation !== "ready" && m.recommendation !== "fixes") p.push(`recommendation غير معروفة: ${m.recommendation}`);
  if (!Array.isArray(m.targets) || !m.targets.length) p.push("targets فارغة");
  if (m.supervisorDecision !== null && (typeof m.supervisorDecision !== "object" || !m.supervisorDecision?.decision)) p.push("supervisorDecision يجب أن يكون null أو قرارًا مسجلًا");
  return p;
};

/** مجلدات الحلقات والمختبرات (NNN-…) التي فيها مراجعات */
const reviewRoots = async (episodesDir: string) =>
  existsSync(episodesDir) ? (await readdir(episodesDir)).filter((d) => /^\d{3}-/.test(d) && existsSync(path.join(episodesDir, d, "tech-reviews"))).sort() : [];

export const listTechReviews = async (episodesDir: string): Promise<TechReviewSummary[]> => {
  const out: TechReviewSummary[] = [];
  for (const d of await reviewRoots(episodesDir)) {
    const rdir = path.join(episodesDir, d, "tech-reviews");
    for (const id of (await readdir(rdir)).filter((x) => /^[\w-]+$/.test(x)).sort()) {
      const f = path.join(rdir, id, "review.json");
      if (!existsSync(f)) continue;
      let meta: TechReviewMeta;
      try {
        meta = JSON.parse(await readFile(f, "utf8")) as TechReviewMeta;
      } catch {
        continue;
      }
      if (techReviewProblems(meta).length) continue;
      const ls = async (sub: string, re: RegExp) => (existsSync(path.join(rdir, id, sub)) ? (await readdir(path.join(rdir, id, sub))).filter((n) => re.test(n)).sort() : []);
      out.push({ ...meta, dir: d, id, strips: await ls("strips", /\.jpg$/i), clips: await ls("clips", /\.mp4$/i), hasReport: existsSync(path.join(rdir, id, "report.md")) });
    }
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
};

/** مسار ملف من مراجعة بعد التحقق: المجلد مراجعة قائمة، والملف من الأنواع المسموحة داخلها فقط */
export const techReviewFilePath = async (episodesDir: string, dir: string, id: string, rel: string): Promise<string | null> => {
  if (!/^\d{3}-[\w-]+$/.test(dir) || !/^[\w-]+$/.test(id) || !OK_FILE.test(rel)) return null;
  const f = path.join(episodesDir, dir, "tech-reviews", id, rel);
  if (!existsSync(path.join(episodesDir, dir, "tech-reviews", id, "review.json")) || !existsSync(f)) return null;
  return f;
};
