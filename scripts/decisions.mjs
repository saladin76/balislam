#!/usr/bin/env node
/**
 * ترقيم القرارات D<رقم> عام لكل السجلات (المحرك مشترك بين القنوات الثلاث):
 *   - تعريف القرار: عنوان (## أو ###) في أحد سجلات القرارات docs/<القناة>/0[67]-decisions.md فيه D<رقم>.
 *   - إحالة إلى قرار معرَّف في سجل آخر: العنوان نفسه يذكر D<رقم> ومسار سجل التعريف
 *     (مثل «(D50، التعريف: docs/zubdat-alkutub/06-decisions.md)»)، فلا يُحسب تعريفًا ثانيًا.
 *   - الرقم الجديد: أكبر رقم في كل السجلات (التعريفات والإحالات والنص) وفي رسائل commits على main، زائد واحد.
 *
 *   node scripts/decisions.mjs check   يرفض رقمًا معرَّفًا مرتين خارج قائمة الأرقام القديمة المسموحة
 *   node scripts/decisions.mjs next    يطبع الرقم التالي (ويستعمله «npx bal decision new»)
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cleanGitEnv } from "./git-env.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const D = /\bD(\d{2,3})\b/g;
const LOG_NAME = /^0[67]-decisions\.md$/;
const LOG_PATH = /docs\/[a-z0-9-]+\/0[67]-decisions\.md/;

/**
 * أرقام عُرِّفت في أكثر من سجل قبل هذا الفحص (٩ نوفمبر ٢٠٢٦): القرار المشترك نفسه نُسخ عنوانه في سجل كل قناة
 * يسري عليها (D39 وD41 وD42 وD46). تبقى كما هي ولا يُعاد ترقيمها (روابط وcommits تشير إليها)؛ وأي رقم جديد
 * يُعرَّف مرة واحدة ويُحال إليه بمسار سجله. لا يُضاف رقم إلى هذه القائمة.
 * (أما D31 فاستُعمل في commit d12df19c لقرار آخر ثم أُعيد ترقيمه D32 في c71e1f32، وD47 في commitين للقرار نفسه،
 * وD48 في سجل دفاتر الزمن وحده؛ لذلك يقرأ المخصِّص كل السجلات وتاريخ main معًا، لا سجلًا واحدًا.)
 */
export const GRANDFATHERED_DUPLICATES = Object.freeze(["D39", "D41", "D42", "D46"]);

/** كل سجلات القرارات في docs/ (نسبية إلى جذر المستودع) */
export const decisionLogs = (root = repoRoot) => {
  const docs = path.join(root, "docs");
  if (!existsSync(docs)) return [];
  return readdirSync(docs, { withFileTypes: true }).filter((d) => d.isDirectory())
    .flatMap((d) => readdirSync(path.join(docs, d.name)).filter((f) => LOG_NAME.test(f)).map((f) => `docs/${d.name}/${f}`))
    .sort();
};

/** تعريفات القرارات في نص سجل: [{ id, line, heading }] (أول D<رقم> في كل عنوان ليس إحالة) */
export const definitionsIn = (text) => {
  const out = [];
  text.split("\n").forEach((line, i) => {
    if (!/^#{2,3}\s/.test(line) || LOG_PATH.test(line)) return;
    const m = line.match(/\bD(\d{2,3})\b/);
    if (m) out.push({ id: `D${Number(m[1])}`, line: i + 1, heading: line.trim() });
  });
  return out;
};

/** أرقام معرَّفة أكثر من مرة (في سجل واحد أو عدة سجلات) وليست في القائمة القديمة */
export const duplicateDefinitions = (logs, allow = GRANDFATHERED_DUPLICATES) => {
  const seen = new Map();
  for (const [file, text] of Object.entries(logs))
    for (const d of definitionsIn(text)) seen.set(d.id, [...(seen.get(d.id) ?? []), { file, ...d }]);
  return [...seen.entries()].filter(([id, at]) => at.length > 1 && !allow.includes(id)).map(([id, at]) => ({ id, at }));
};

/** أكبر رقم D في نصوص */
export const maxDecision = (...texts) => {
  let max = 0;
  for (const t of texts) for (const m of String(t).matchAll(D)) max = Math.max(max, Number(m[1]));
  return max;
};

const git = (args, cwd) => spawnSync("git", args, { cwd, encoding: "utf8", env: cleanGitEnv() });
/** رسائل commits على main (المحلي والبعيد إن وُجدا) وعلى الفرع الحالي */
const historyText = (root) => ["main", "origin/main", "HEAD"].map((ref) => {
  const r = git(["log", "--format=%s%n%b", ref, "--"], root);
  return r.status === 0 ? r.stdout : "";
}).join("\n");

export const readLogs = (root = repoRoot) =>
  Object.fromEntries(decisionLogs(root).map((f) => [f, readFileSync(path.join(root, f), "utf8")]));

/** الرقم التالي عالميًا: بعد كل ما في السجلات وتاريخ main */
export const nextDecisionId = (root = repoRoot, history = historyText(root)) =>
  `D${maxDecision(...Object.values(readLogs(root)), history) + 1}`;

const today = () => new Date().toISOString().slice(0, 10);
/**
 * يضيف عنوان القرار إلى سجل القناة الأول (تعريف) وإحالة في كل سجل بعده، بأسلوب كل سجل:
 * زبدة الكتب «### D50 — العنوان»، والباقي «## التاريخ — العنوان (D50)». يعيد ما كُتب.
 */
export const appendDecision = (root, id, title, logs) => {
  const written = [];
  const definition = logs[0];
  for (const [i, file] of logs.entries()) {
    const abs = path.join(root, file);
    if (!existsSync(abs)) throw new Error(`سجل القرارات غير موجود: ${file}`);
    const ref = i === 0 ? "" : `، التعريف: ${definition}`;
    const heading = /zubdat-alkutub/.test(file) && i === 0
      ? `### ${id} — ${title}`
      : `## ${today()} — ${title} (${id}${ref})`;
    const text = readFileSync(abs, "utf8");
    writeFileSync(abs, `${text.replace(/\n*$/, "\n")}\n${heading}\n\n- \n`);
    written.push({ file, heading });
  }
  return written;
};

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);
if (isMain) {
  const cmd = process.argv[2];
  // البوابة تشغّله داخل نسختها المؤقتة (cwd)؛ وإلا فالمستودع الذي فيه السكربت
  const here = existsSync(path.join(process.cwd(), "docs")) ? process.cwd() : repoRoot;
  if (cmd === "next") { console.log(nextDecisionId(here)); process.exit(0); }
  if (cmd === "check") {
    const dups = duplicateDefinitions(readLogs(here));
    for (const d of dups) {
      console.error(`✗ رقم القرار ${d.id} معرَّف أكثر من مرة:`);
      for (const a of d.at) console.error(`   - ${a.file}:${a.line}  ${a.heading}`);
    }
    if (dups.length) console.error("  خذ رقمًا جديدًا بـ «npx bal decision new \"العنوان\"»، وفي السجلات الأخرى اكتب إحالة بمسار سجل التعريف.");
    process.exit(dups.length ? 1 : 0);
  }
  console.error("الاستعمال: node scripts/decisions.mjs check | next");
  process.exit(2);
}
