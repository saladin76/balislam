#!/usr/bin/env node
/**
 * بوابة التسليم (الأمر 010): الفحوص الإلزامية قبل أي دفع إلى المستودع.
 *
 *   node scripts/gate.mjs              يفحص المجلد الحالي كما هو
 *   node scripts/gate.mjs --commit SHA يفحص commit بعينه في نسخة مؤقتة منفصلة
 *                                      (ما سيُدفع فعلًا، لا ملفات العمل غير المحفوظة)
 *   --range A..B                       يضيف فحص تزامن التوثيق للـcommits المدفوعة (الأمر 016)
 *
 * كل فحص يُشغَّل وحده ويُحفظ رمز خروجه الحقيقي؛ لا أنابيب ولا تصفية تخفي الفشل.
 * الخروج 0 فقط إذا نجحت كل الفحوص. لا يُستثنى اختبار ولا يُعطَّل.
 */
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { childEnv } from "./git-env.mjs";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const commit = args.includes("--commit") ? args[args.indexOf("--commit") + 1] : null;
const range = args.includes("--range") ? args[args.indexOf("--range") + 1] : null;

// Per-invocation sandbox: Remotion, webpack, Vitest, ffmpeg and child processes
// inherit a PRIVATE temp root. Never scan or delete the system's shared /tmp.
const runTemp = mkdtempSync(path.join(os.tmpdir(), "bal-gate-run-"));
const tempDiskBytes = (root) => {
  if (!existsSync(root)) return 0;
  const walk = (entry) => {
    const s = lstatSync(entry);
    if (s.isSymbolicLink()) return 0; // Never traverse another owner's files.
    if (s.isDirectory()) return readdirSync(entry).reduce((n, name) => n + walk(path.join(entry, name)), 0);
    return s.blocks * 512; // allocated bytes, not just file apparent size
  };
  return walk(root);
};
let cleanedTemp = false;
const cleanRunTemp = () => {
  if (cleanedTemp) return;
  cleanedTemp = true;
  rmSync(runTemp, { recursive: true, force: true });
};

/** الفحوص الإلزامية: الأنواع ثم الاختبارات كلها */
const CHECKS = [
  { name: "فحص TypeScript", cmd: "npx", args: ["tsc", "--noEmit", "-p", "."] },
  { name: "اختبارات المشروع", cmd: "npx", args: ["vitest", "run"] },
  // تغيير منظومة قناة لها دليل يصاحبه تحديث سجل قراراتها (scripts/docs-sync.mjs)
  ...(range ? [{ name: "تزامن التوثيق", cmd: "node", args: [path.join(root, "scripts", "docs-sync.mjs"), range] }] : []),
];

// لا تُورَّث متغيرات تحديد المستودع (GIT_DIR وأخواته) التي يضعها git للخطّاف: الفحوص واختباراتها
// تعمل على مستودعات مؤقتة، ولو ورثتها لعملت على المستودع الحقيقي (scripts/git-env.mjs، الأمر 018)
const sh = (cmd, a, cwd, inherit = true) => spawnSync(cmd, a, { cwd, stdio: inherit ? "inherit" : "pipe", encoding: "utf8", env: childEnv({ CI: process.env.CI ?? "1", TMPDIR: runTemp, TMP: runTemp, TEMP: runTemp }) });

let dir = root;
let cleanup = cleanRunTemp;
/** خروج مع تنظيف مضمون: لا تبقى نسخة مؤقتة معلقة أيًا كان سبب الخروج */
const fail = (msg, code = 1) => {
  cleanup();
  console.error(msg);
  process.exit(code);
};
process.on("uncaughtException", (e) => fail(`بوابة التسليم: خطأ داخلي (${e.message}); رُفض الدفع احتياطًا.`, 2));
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => fail(`بوابة التسليم: أُوقفت (${sig})؛ رُفض الدفع.`, 130));
if (commit) {
  // نسخة عمل مؤقتة على الـ commit المطلوب بالضبط
  const tmp = mkdtempSync(path.join(os.tmpdir(), "bal-gate-"));
  const add = sh("git", ["worktree", "add", "--detach", "--quiet", tmp, commit], root, false);
  if (add.status !== 0) {
    fail(`بوابة التسليم: تعذّر تجهيز نسخة للـ commit ${commit}: ${add.stderr}`, 2);
  }
  cleanup = () => {
    sh("git", ["worktree", "remove", "--force", tmp], root, false);
    rmSync(tmp, { recursive: true, force: true });
    cleanRunTemp();
  };
  dir = tmp;
  // الاعتماديات: نفس node_modules إن لم يتغير package-lock، وإلا تثبيت نظيف داخل النسخة المؤقتة
  const lock = (d) => (existsSync(path.join(d, "package-lock.json")) ? readFileSync(path.join(d, "package-lock.json"), "utf8") : "");
  const nm = path.join(tmp, "node_modules");
  if (existsSync(nm)) fail("بوابة التسليم: الـ commit يحتوي node_modules؛ لا يُدفع مجلد الاعتماديات. احذفه من الـ commit.");
  if (lock(tmp) === lock(root) && existsSync(path.join(root, "node_modules"))) symlinkSync(path.join(root, "node_modules"), nm, "dir");
  else {
    console.log("بوابة التسليم: package-lock تغيّر في هذا الـ commit؛ تثبيت نظيف للاعتماديات…");
    const ci = sh("npm", ["ci", "--no-audit", "--no-fund"], tmp);
    if (ci.status !== 0) fail("بوابة التسليم: فشل تثبيت الاعتماديات؛ رُفض الدفع.");
  }
}

const results = [];
try {
  for (const c of CHECKS) {
    console.log(`\n▶ ${c.name}${commit ? ` (commit ${commit.slice(0, 7)})` : ""}`);
    const t0 = Date.now();
    const r = sh(c.cmd, c.args, dir);
    // status null = أُوقف بإشارة: فشل لا نجاح
    const ok = r.status === 0;
    results.push({ name: c.name, ok, code: r.status, signal: r.signal, seconds: (Date.now() - t0) / 1000 });
  }
 } finally {
  // Test leftovers may exist even if a worker exits abruptly. Only OUR root is removed.
  const allocated = tempDiskBytes(runTemp);
  cleanup();
  console.log("GATE_TEMP_ALLOCATED_BEFORE_CLEANUP_BYTES " + allocated);
  console.log("GATE_TEMP_CLEANED " + (!existsSync(runTemp)));
}

console.log("\nبوابة التسليم:");
for (const r of results) console.log(`  ${r.ok ? "✓" : "✗"} ${r.name} (${r.seconds.toFixed(0)} ث${r.ok ? "" : `، رمز الخروج ${r.code ?? r.signal}`})`);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`\n✗ رُفض: فشل ${failed.map((r) => r.name).join(" و")}. أصلح الفشل ثم أعد المحاولة؛ لا تُعطَّل الاختبارات لتمرير التسليم.`);
  process.exit(1);
}
console.log("\n✓ كل الفحوص الإلزامية نجحت.");
