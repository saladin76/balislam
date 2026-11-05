#!/usr/bin/env node
/**
 * تزامن التوثيق (الأمر 016): أي تغيير في منظومة قناة لها دليل يجب أن يصاحبه تحديث سجل قراراتها في الدفع نفسه.
 *
 *   node scripts/docs-sync.mjs <من>..<إلى>   يفحص الملفات المتغيرة في مدى من الـcommits
 *
 * لا يفحص ملفات الحلقات (السكريبت، الخطة، المعاينات): لها production-log.md. الخروج 0 إن لم توجد مخالفة.
 */
import { spawnSync } from "node:child_process";
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
];

/** المخالفات لقائمة ملفات متغيرة: قناة تغيّرت منظومتها ولم يتغير سجلها */
export const docsSyncProblems = (files) =>
  DOC_RULES.flatMap((r) => {
    const touched = files.filter((f) => r.watch.some((re) => re.test(f)));
    return touched.length && !files.includes(r.log) ? [{ channel: r.channel, log: r.log, files: touched }] : [];
  });

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);
if (isMain) {
  const range = process.argv[2];
  if (!range) {
    console.log("تزامن التوثيق: لا مدى للفحص؛ تُرك.");
    process.exit(0);
  }
  const r = spawnSync("git", ["diff", "--name-only", range], { cwd: path.resolve(import.meta.dirname, ".."), encoding: "utf8" });
  if (r.status !== 0) {
    console.error(`تزامن التوثيق: تعذّر حساب الملفات المتغيرة (${range}): ${r.stderr}`);
    process.exit(2);
  }
  const problems = docsSyncProblems(r.stdout.split("\n").filter(Boolean));
  for (const p of problems) {
    console.error(`✗ منظومة «${p.channel}» تغيّرت دون تحديث ${p.log}:`);
    for (const f of p.files.slice(0, 12)) console.error(`   - ${f}`);
    console.error(`  حدّث الوثيقة المرتبطة وأضف إدخالًا في ${p.log} ثم أعد الدفع.`);
  }
  process.exit(problems.length ? 1 : 0);
}
