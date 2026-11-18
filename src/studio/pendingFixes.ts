/**
 * ملاحظة مفتوحة وإصلاحها جاهز في فرع لم يُدمج (لـ «npx bal notes --open»).
 * حدث فعلًا: إصلاح ملاحظة المالك على «بالإسلام 001» c1-s3 كُتب يوم ١٥ نوفمبر في fix/balislam-001-c1s3-witness
 * ولم يُدمج (أخذ غيره رقم قراره)، فبقيت الملاحظة مفتوحة يومين بلا أن يعرف أحد أن حلها جاهز.
 * أفضل جهد وللقراءة فقط: بلا git أو بلا فروع لا يطبع شيئًا.
 */
import { spawnSync } from "node:child_process";

/** أسطر `git grep -l` على عدة refs: «<ref>:<path>». يعيد لكل معرّف ملاحظة الفروع التي تحسمها. */
export const parsePendingFixes = (grepOut: string, ids: string[], hits: (ref: string, path: string) => string[]): Map<string, string[]> => {
  const out = new Map<string, string[]>();
  for (const line of grepOut.split("\n")) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const ref = line.slice(0, i), file = line.slice(i + 1);
    for (const id of hits(ref, file)) {
      if (!ids.includes(id)) continue;
      const branch = ref.replace(/^origin\//, "");
      const list = out.get(id) ?? [];
      if (!list.includes(branch)) list.push(branch);
      out.set(id, list);
    }
  }
  return out;
};

/** سطر التنبيه تحت الملاحظة */
export const formatPendingFix = (branches: string[]): string =>
  `   ⚠ إصلاحها جاهز ولم يُدمج في main: ${branches.join("، ")} — ادمجه (أو أعده على main) بدل كتابته من جديد.`;

export const pendingFixes = (repoDir: string, ids: string[]): Map<string, string[]> => {
  if (!ids.length) return new Map();
  const git = (a: string[]) => spawnSync("git", a, { cwd: repoDir, encoding: "utf8", timeout: 20_000, maxBuffer: 16 << 20 });
  const refs = (git(["branch", "-r", "--no-merged", "origin/main", "--format=%(refname:short)"]).stdout ?? "")
    .split("\n").map((x) => x.trim()).filter((x) => x && !x.endsWith("/HEAD") && x !== "origin/studio-notes");
  if (!refs.length) return new Map();
  const args = ["grep", "-l", "-F"];
  for (const id of ids) args.push("-e", id);
  const r = git([...args, ...refs, "--", "channels/*/episodes/*/notes/resolved.json"]);
  if (r.status !== 0 && r.status !== 1) return new Map();
  // الملف يذكر المعرّف؛ نتأكد أنه مفتاح حسم فيه (لا ذكر عابر)
  return parsePendingFixes(r.stdout ?? "", ids, (ref, path) => {
    const show = git(["show", `${ref}:${path}`]);
    try {
      const j = JSON.parse(show.stdout ?? "{}") as { resolutions?: Record<string, { status?: string }> };
      return Object.entries(j.resolutions ?? {}).filter(([, v]) => v?.status !== "in-progress").map(([k]) => k);
    } catch { return []; }
  });
};
