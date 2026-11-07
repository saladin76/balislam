#!/usr/bin/env node
/**
 * تزامن التوثيق (الأمر 016): أي تغيير في منظومة قناة لها دليل يجب أن يصاحبه تحديث سجل قراراتها في الدفع نفسه.
 *
 *   node scripts/docs-sync.mjs <من>..<إلى>   يفحص الملفات المتغيرة في مدى من الـcommits
 *
 * لا يفحص ملفات الحلقات (السكريبت، الخطة، المعاينات): لها production-log.md. الخروج 0 إن لم توجد مخالفة.
 */
import { spawnSync } from "node:child_process";
import { cleanGitEnv } from "./git-env.mjs";
import path from "node:path";

/** منظومة كل قناة لها دليل، وسجلها الذي يجب أن يتغير معها */
export const DOC_RULES = [
  {
    channel: "dafatir-alzaman",
    log: "docs/dafatir-alzaman/07-decisions.md",
    watch: [
      /^src\/remotion\/dafatir\//,
      /^src\/remotion\/scenes\/HorizonShot\.tsx$/,
      /^channels\/dafatir-alzaman\/(channel|identity|identity\.default)\.json$/,
      /^templates\/dafatir-alzaman\//,
    ],
  },
  {
    channel: "zubdat-alkutub",
    log: "docs/zubdat-alkutub/06-decisions.md",
    watch: [
      /^src\/remotion\/zubdat\//,
      /^src\/remotion\/scenes\/InkShot\.tsx$/,
      /^src\/studio\//,
      /^channels\/zubdat-alkutub\/(channel|identity|identity\.default)\.json$/,
      /^templates\/zubdat-alkutub\//,
    ],
  },
  {
    // المرجع الهندسي لـ«بالإسلام» (الأمر 012): ملفات منظومتها وحدها، لا الكود المشترك بين القنوات
    channel: "balislam",
    log: "docs/balislam/06-decisions.md",
    // تغيير لا يمس السلوك يُعفى بسطر «Docs-Unaffected: سبب» في كل commit يمس المنظومة
    waiver: "Docs-Unaffected",
    watch: [
      /^src\/plan\/(engine|transitions|lighting|director|illusDirect|sceneCues)\.ts$/,
      /^src\/remotion\/illus\//,
      /^src\/remotion\/scenes\/(AlleyTale|RoadJourney|LightStage|DuaBoard|MihrabIntro|transitions)\.tsx$/,
      /^src\/remotion\/lab\/(BalislamLab|LightLab|MotionLab007|TransitionLab|PermanentLab)\.tsx$/,
      /^src\/render\/pool\.ts$/,
      /^scripts\/(gate|docs-sync)\.mjs$/,
      /^\.githooks\//,
      /^channels\/balislam\/(channel|identity|identity\.default)\.json$/,
      /^templates\/balislam\//,
    ],
  },
];

/**
 * المخالفات لقائمة ملفات متغيرة: قناة تغيّرت منظومتها ولم يتغير سجلها.
 * commits (اختياري): [{ files, message }] لكل commit في المدى؛ يُقبل إعفاء القاعدة (waiver) إن كان سطرًا
 * «<waiver>: سبب» في رسالة كل commit يمس ملفات المنظومة.
 */
export const docsSyncProblems = (files, commits = []) =>
  DOC_RULES.flatMap((r) => {
    const touched = files.filter((f) => r.watch.some((re) => re.test(f)));
    if (!touched.length || files.includes(r.log)) return [];
    if (r.waiver) {
      const re = new RegExp(`^${r.waiver}:\\s*\\S`, "m");
      const relevant = commits.filter((c) => c.files.some((f) => r.watch.some((w) => w.test(f))));
      if (relevant.length && relevant.every((c) => re.test(c.message))) return [];
    }
    return [{ channel: r.channel, log: r.log, files: touched, waiver: r.waiver }];
  });

/** commits مدى بملفاتها ورسائلها (للإعفاء) */
const commitsIn = (range, cwd) => {
  const r = spawnSync("git", ["log", "--format=%H", range], { cwd, encoding: "utf8", env: cleanGitEnv() });
  if (r.status !== 0) return [];
  return r.stdout.split("\n").filter(Boolean).map((sha) => ({
    message: spawnSync("git", ["log", "-1", "--format=%B", sha], { cwd, encoding: "utf8", env: cleanGitEnv() }).stdout,
    files: spawnSync("git", ["diff-tree", "--no-commit-id", "--name-only", "-r", "--root", sha], { cwd, encoding: "utf8", env: cleanGitEnv() }).stdout.split("\n").filter(Boolean),
  }));
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);
if (isMain) {
  const range = process.argv[2];
  if (!range) {
    console.log("تزامن التوثيق: لا مدى للفحص؛ تُرك.");
    process.exit(0);
  }
  const cwd = path.resolve(import.meta.dirname, "..");
  const r = spawnSync("git", ["diff", "--name-only", range], { cwd, encoding: "utf8", env: cleanGitEnv() });
  if (r.status !== 0) {
    console.error(`تزامن التوثيق: تعذّر حساب الملفات المتغيرة (${range}): ${r.stderr}`);
    process.exit(2);
  }
  const problems = docsSyncProblems(r.stdout.split("\n").filter(Boolean), commitsIn(range, cwd));
  for (const p of problems) {
    console.error(`✗ منظومة «${p.channel}» تغيّرت دون تحديث ${p.log}:`);
    for (const f of p.files.slice(0, 12)) console.error(`   - ${f}`);
    console.error(`  حدّث الوثيقة المرتبطة وأضف إدخالًا في ${p.log} ثم أعد الدفع.`);
    if (p.waiver) console.error(`  وإن لم يمس التغيير السلوك ولا البنية ولا القواعد: أضف سطر «${p.waiver}: <السبب>» في رسالة كل commit يمسها.`);
  }
  process.exit(problems.length ? 1 : 0);
}
