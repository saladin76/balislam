/**
 * عزل بيئة Git للعمليات الفرعية (إصلاح P0، الأمر 018).
 *
 * حين يشغّل git خطّافًا (مثل pre-push) من worktree يضع في البيئة GIT_DIR=<المستودع>/.git/worktrees/<الاسم>.
 * أي عملية فرعية ترث هذه البيئة ثم تشغّل git في مجلد آخر (مستودع اختبار مؤقت مثلًا) تعمل على المستودع
 * الحقيقي لا على مجلدها: `git init` في مجلد مؤقت أعاد تهيئة المستودع الحقيقي وكتب core.bare = true.
 *
 * الحل من المصدر: كل عملية فرعية تُشغَّل ببيئة بلا المتغيرات التي تحدد المستودع أو شجرة العمل أو الفهرس
 * أو مخزن الكائنات، فيكتشف git مستودعه من مجلد العمل (cwd) وحده. إعدادات الشبكة والاعتماد (GIT_CONFIG_*،
 * GIT_SSL_CAINFO، GIT_TERMINAL_PROMPT، GIT_ASKPASS…) تبقى كما هي.
 */

/** متغيرات تحدد أي مستودع يعمل عليه git؛ لا تُورَّث لعملية فرعية أبدًا */
export const REPO_LOCATING_GIT_VARS = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_COMMON_DIR",
  "GIT_NAMESPACE",
  "GIT_PREFIX",
  "GIT_QUARANTINE_PATH",
  "GIT_CEILING_DIRECTORIES",
  "GIT_DISCOVERY_ACROSS_FILESYSTEM",
  "GIT_INTERNAL_SUPER_PREFIX",
];

/** نسخة من البيئة بلا متغيرات تحديد المستودع (لا تعدّل الأصل) */
export const cleanGitEnv = (env = process.env) => {
  const out = { ...env };
  for (const k of REPO_LOCATING_GIT_VARS) delete out[k];
  return out;
};

/** بيئة العملية الفرعية: نظيفة من متغيرات المستودع، مع إضافات صريحة */
export const childEnv = (extra = {}, env = process.env) => cleanGitEnv({ ...env, ...extra });

/** يزيل متغيرات المستودع من بيئة العملية الحالية نفسها (للاختبارات وما تشغّله) */
export const scrubProcessGitEnv = (env = process.env) => {
  const removed = REPO_LOCATING_GIT_VARS.filter((k) => k in env);
  for (const k of removed) delete env[k];
  return removed;
};
