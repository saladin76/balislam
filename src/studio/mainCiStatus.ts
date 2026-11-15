/**
 * حالة main في CI لأول سطر في «npx bal notes --open» (KI-068، D137): حفظ الاستوديو لا يشغّل الاختبارات (D101)،
 * فمطوّر أو وكيل يبدأ جلسته يرى فورًا إن كان main أحمر وبأي commit، قبل أن ترفض البوابة دفعه.
 * أفضل جهد وللقراءة فقط: بلا gh أو شبكة لا يطبع شيئًا يوقف العمل.
 */
import { spawnSync } from "node:child_process";

export type MainRun = { conclusion: string | null; status: string; sha: string; title: string; url: string };

/** سطر الحالة بالعربية من آخر تشغيلات CI على main (الأحدث أولًا) */
export const formatMainCi = (runs: MainRun[]): string => {
  const done = runs.find((r) => r.status === "completed" && r.conclusion !== "cancelled");
  if (!done) return "حالة main في CI: لا تشغيل مكتمل بعد.";
  if (done.conclusion === "success") return `حالة main في CI: أخضر (${done.sha.slice(0, 8)}).`;
  const firstGreen = runs.findIndex((r) => r.conclusion === "success");
  const red = (firstGreen < 0 ? runs : runs.slice(0, firstGreen)).filter((r) => r.conclusion === "failure");
  const oldest = red[red.length - 1] ?? done;
  return [
    `✗ main أحمر في CI منذ ${oldest.sha.slice(0, 8)} «${oldest.title.split("\n")[0]}» (${red.length} تشغيل فاشل).`,
    `  آخرها: ${done.url}`,
    "  أصلحه أولًا (KI-068، D137): لا يُغيَّر محتوى المالك، والاختبار الذي يثبّت محتواه يُكتب عقدًا. قضية «main أحمر (CI)» على GitHub.",
  ].join("\n");
};

export const mainCiStatus = (repoDir: string): string | null => {
  const run = (cmd: string, a: string[]) => spawnSync(cmd, a, { cwd: repoDir, encoding: "utf8", timeout: 10_000 });
  const url = run("git", ["remote", "get-url", "origin"]);
  const repo = /github\.com[/:]([^/]+\/[^/\s]+?)(?:\.git)?$/.exec((url.stdout ?? "").trim())?.[1];
  if (!repo) return null;
  const r = run("gh", ["api", `repos/${repo}/actions/runs?branch=main&event=push&per_page=30`, "--jq",
    "[.workflow_runs[] | select(.name == \"CI\") | {conclusion, status, sha: .head_sha, title: .display_title, url: .html_url}]"]);
  if (r.status !== 0) return null;
  try { return formatMainCi(JSON.parse(r.stdout) as MainRun[]); } catch { return null; }
};
