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
 *   node scripts/decisions.mjs next --remote
 *        يضيف ما حجزته الفروع المتوازية (KI-068، D137): كل فرع origin/* المحلي (بلا جلب) وكل PR مفتوح عبر
 *        `gh api` (REST)، ويطبع معه رقم KI التالي. للقراءة فقط، وبلا شبكة أو gh يكتفي بما عنده.
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

const KI = /\bKI-(\d{3})\b/g;
/** أكبر رقم KI في نصوص */
export const maxKnownIssue = (...texts) => {
  let max = 0;
  for (const t of texts) for (const m of String(t).matchAll(KI)) max = Math.max(max, Number(m[1]));
  return max;
};

/**
 * نصوص ما أضافته الفروع المتوازية ولم يصل main: فرق كل origin/* (محليًا، بلا جلب) وملفات كل PR مفتوح
 * (gh api، REST). أفضل جهد: أي فشل (لا gh، لا شبكة) يُتجاوز ويُذكر في notes.
 */
export const parallelClaimsText = (root = repoRoot, run = (cmd, a) => spawnSync(cmd, a, { cwd: root, encoding: "utf8", env: cleanGitEnv(), timeout: 20_000, maxBuffer: 64 * 1024 * 1024 })) => {
  const texts = [];
  const notes = [];
  const cutoff = Date.now() / 1000 - 14 * 86_400;
  const refs = run("git", ["for-each-ref", "--format=%(committerdate:unix) %(refname:short)", "refs/remotes/origin"]);
  const recent = refs.status === 0 ? refs.stdout.split("\n").map((l) => l.split(" ")).filter(([t, r]) => r && Number(t) >= cutoff)
    .map(([, r]) => r).filter((r) => !/\/(HEAD|main)$|^origin\/previews\//.test(r) && r !== "origin") : [];
  for (const ref of recent) {
    const d = run("git", ["diff", "origin/main..." + ref, "--", "docs"]);
    if (d.status === 0) texts.push(d.stdout.split("\n").filter((l) => l.startsWith("+")).join("\n"));
    const l = run("git", ["log", "--format=%s%n%b", "origin/main.." + ref]);
    if (l.status === 0) texts.push(l.stdout);
  }
  const url = run("git", ["remote", "get-url", "origin"]);
  const repo = /github\.com[/:]([^/]+\/[^/.]+)/.exec((url.stdout ?? "").trim())?.[1]?.replace(/\.git$/, "");
  // PRs حُدّثت في آخر ١٤ يومًا فقط (الأقدم لا يحجز رقمًا جديدًا عمليًا)، وملفاتها بطلب واحد لكل PR
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const prs = repo ? run("gh", ["api", `repos/${repo}/pulls?state=open&per_page=100`, "--jq",
    `.[] | select(.updated_at >= "${since}") | .number`]) : { status: 1 };
  const meta = repo && prs.status === 0 ? run("gh", ["api", `repos/${repo}/pulls?state=open&per_page=100`, "--jq", '.[] | .title + "\\n" + (.body // "")']) : { status: 1 };
  if (prs.status !== 0) notes.push("لم تُقرأ الـPRs المفتوحة (gh أو الشبكة غير متاحين).");
  else {
    if (meta.status === 0) texts.push(meta.stdout);
    for (const n of prs.stdout.split("\n").filter(Boolean)) {
      const f = run("gh", ["api", `repos/${repo}/pulls/${n}/files?per_page=100`, "--jq", '.[] | .patch // ""']);
      if (f.status === 0) texts.push(f.stdout.split("\n").filter((x) => x.startsWith("+")).join("\n"));
    }
  }
  return { text: texts.join("\n"), notes };
};

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
  // check: سجلات المجلد الحالي (البوابة تشغّله داخل نسختها المؤقتة؛ نسخة بلا docs/ لا سجل فيها يُفحص).
  // next: المجلد الحالي إن كان فيه docs/، وإلا المستودع الذي فيه السكربت
  const here = existsSync(path.join(process.cwd(), "docs")) ? process.cwd() : repoRoot;
  if (cmd === "next" && process.argv.includes("--remote")) {
    const { text, notes } = parallelClaimsText(here);
    const ki = existsSync(path.join(here, "docs", "studio", "known-issues.md")) ? readFileSync(path.join(here, "docs", "studio", "known-issues.md"), "utf8") : "";
    console.log(nextDecisionId(here, historyText(here) + "\n" + text));
    console.log(`KI-${String(maxKnownIssue(ki, text) + 1).padStart(3, "0")}`);
    for (const n of notes) console.error(n);
    process.exit(0);
  }
  if (cmd === "next") { console.log(nextDecisionId(here)); process.exit(0); }
  if (cmd === "check") {
    const dups = duplicateDefinitions(readLogs(process.cwd()));
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
