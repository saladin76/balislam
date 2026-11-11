/**
 * معاينات الجلسات السحابية إلى الاستوديو عبر Git، بلا فيديو في main أبدًا (D26، وD75 لهذا المسار).
 *
 * لماذا: الجلسة السحابية تدفع إلى GitHub، لكن رفع Drive فيها محدود بنحو ١٠ م.ب، وGitHub Releases مرفوضة لها.
 *
 * التخزين: لكل خانة فرع واحد `previews/<القناة>/<مجلد الحلقة>/<الخانة>` فيه commit يتيم واحد:
 *   manifest.json  (القناة والحلقة والخانة والعنوان والحالة والبصمة والحجم والأجزاء والجلسة)
 *   part-000 …     (الفيديو مقسومًا إلى أجزاء ≤ 45 م.ب، تحت حد GitHub للملف الواحد)
 * كل رفع جديد يستبدل الفرع بالقوة، فتصير كائنات النسخة القديمة غير مرجوعة (تُنظَّف على GitHub)، ولا يُدمج في main.
 *
 * أمان المستودع: الـcommit يُبنى بأوامر السباكة في فهرس مؤقت (GIT_INDEX_FILE في مجلد مؤقت)، فلا يُمس
 * الفرع الحالي ولا فهرسه ولا ملفات العمل. الدفع بمرجع صريح بلا --no-verify؛ خطاف pre-push يعفي
 * refs/heads/previews/* وحدها وبشرط أن الـcommit يتيم وشجرته manifest.json وأجزاء فقط.
 *
 * على جهاز المالك: `git pull` لا يجلب هذه الفروع (refspec سالب `^refs/heads/previews/*`، يُضاف عند تشغيل الاستوديو)،
 * والاستوديو يجلب فرع خانة واحدة عند «حمّل المعاينة» إلى مرجع مؤقت، ويجمع الأجزاء ويتحقق من البصمة، ثم يحذف المرجع.
 */
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { childEnv } from "../../scripts/git-env.mjs";
import {
  arabicMegabytes, installPreviewFile, linkGitPreview, type PreviewEntry, type PreviewGitPart, type PreviewGitSource, type PreviewIndex,
} from "./episodePreviews";

/** حجم الجزء: تحت حد GitHub (٥٠ م.ب تحذير، ١٠٠ رفض) بهامش. */
export const PREVIEW_PART_BYTES = 45 * 1024 * 1024;
export const PREVIEW_REF_PREFIX = "refs/heads/previews/";
/** مرجع التحميل المؤقت على جهاز المالك (ليس فرعًا، ويُحذف بعد التحميل). */
export const PREVIEW_CACHE_PREFIX = "refs/previews-cache/";
export const PREVIEW_FETCH_EXCLUDE = "^refs/heads/previews/*";
export const PREVIEW_STATUS = "جاهز للمراجعة";
/** مسار في شجرة فرع المعاينة: manifest.json أو part-NNN فقط (يطابقه خطاف pre-push). */
export const PREVIEW_TREE_NAME_RE = /^(manifest\.json|part-\d{3})$/;
const PREVIEW_REF_RE = /^refs\/heads\/previews\/([a-z0-9-]+)\/([A-Za-z0-9][A-Za-z0-9_-]{0,80})\/([a-z0-9][a-z0-9_-]{0,80})$/;

export type PreviewManifest = {
  schemaVersion: 1; channel: string; episode: string; slot: string; title: string; note?: string; status: string;
  sha256: string; size: number; partBytes: number; parts: PreviewGitPart[]; createdAt: string; source: { session: string };
};

// ———————————————————————————— git ————————————————————————————
type GitResult = { ok: boolean; out: string; err: string; code: number | null };
type GitOpts = { env?: Record<string, string>; input?: string; timeout?: number; onStderr?: (chunk: string) => void };
export const git = (cwd: string, args: string[], opts: GitOpts = {}) => new Promise<GitResult>((resolve) => {
  // childEnv drops repo-locating variables (GIT_DIR, GIT_INDEX_FILE…) inherited from a hook; our own temporary
  // GIT_INDEX_FILE is added after that cleaning.
  const child = spawn("git", args, { cwd, env: { ...childEnv({ GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" }), ...(opts.env ?? {}) } });
  let out = "", err = "";
  const timer = setTimeout(() => child.kill("SIGTERM"), opts.timeout ?? 60_000);
  child.stdout.on("data", (c) => { out += c; });
  child.stderr.on("data", (c) => { err += c; opts.onStderr?.(String(c)); });
  child.on("error", (e) => { err += e.message; });
  child.on("close", (code) => { clearTimeout(timer); resolve({ ok: code === 0, out: out.trim(), err: err.trim(), code }); });
  if (opts.input !== undefined) child.stdin.end(opts.input); else child.stdin.end();
});
const must = (r: GitResult, what: string) => {
  if (!r.ok) throw new Error(`${what}: ${(r.err || r.out).split("\n").slice(-3).join(" ")}`);
  return r.out;
};

/** يكتب جزءًا من الملف كائنًا في Git بالتدفق (بلا ملف مؤقت)، ويحسب بصمته أثناء القراءة. */
const hashPart = (cwd: string, file: string, start: number, end: number) => new Promise<{ blob: string; sha256: string; size: number }>((resolve, reject) => {
  const child = spawn("git", ["hash-object", "-w", "--stdin"], { cwd, env: childEnv({ GIT_TERMINAL_PROMPT: "0" }) });
  const h = createHash("sha256");
  let size = 0, out = "", err = "";
  child.stdout.on("data", (c) => { out += c; });
  child.stderr.on("data", (c) => { err += c; });
  child.on("error", reject);
  child.on("close", (code) => code === 0 ? resolve({ blob: out.trim(), sha256: h.digest("hex"), size }) : reject(new Error(`git hash-object: ${err.trim()}`)));
  const rs = createReadStream(file, { start, end: end - 1 });
  rs.on("data", (c) => { h.update(c); size += c.length; });
  rs.on("error", (e) => { child.kill(); reject(e); });
  rs.pipe(child.stdin);
});

const repoTop = async (dir: string) => {
  const r = await git(dir, ["rev-parse", "--show-toplevel"]);
  if (!r.ok || !r.out) throw new Error("مجلد الحلقة ليس داخل مستودع Git.");
  return realpath(r.out);
};
const identityEnv = async (top: string): Promise<Record<string, string>> => {
  const name = (await git(top, ["config", "user.name"])).out || "Studio previews";
  const email = (await git(top, ["config", "user.email"])).out || "studio-previews@localhost";
  return { GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email };
};

// ———————————————————————————— المراجع ————————————————————————————
const slotOf = (slot: string) => {
  const s = slot.replace(/\.mp4$/i, "").toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{0,80}$/.test(s)) throw new Error("اسم خانة المعاينة غير آمن؛ استخدم أحرفًا لاتينية وأرقامًا وشرطات فقط.");
  return s;
};
/** episodeDir = …/channels/<القناة>/episodes/<مجلد الحلقة> */
export const episodeKey = (episodeDir: string) => {
  const episode = path.basename(episodeDir);
  const channel = path.basename(path.dirname(path.dirname(episodeDir)));
  if (path.basename(path.dirname(episodeDir)) !== "episodes" || !/^[a-z0-9-]+$/.test(channel) || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/.test(episode))
    throw new Error(`مجلد الحلقة غير متوقع: ${episodeDir}`);
  return { channel, episode };
};
export const previewBranchRef = (channel: string, episode: string, slot: string) => {
  const ref = `${PREVIEW_REF_PREFIX}${channel}/${episode}/${slotOf(slot)}`;
  if (!PREVIEW_REF_RE.test(ref)) throw new Error(`مرجع فرع معاينة غير صالح: ${ref}`);
  return ref;
};
export const parsePreviewRef = (ref: string) => {
  const m = PREVIEW_REF_RE.exec(ref);
  return m ? { channel: m[1]!, episode: m[2]!, slot: m[3]! } : null;
};
const cacheRefFor = (ref: string) => PREVIEW_CACHE_PREFIX + ref.slice(PREVIEW_REF_PREFIX.length);

/** يتحقق أن commit فرع المعاينة يتيم وشجرته manifest.json وأجزاء (ملفات عادية) فقط، ويعيد مدخلاتها. */
export const inspectPreviewCommit = async (top: string, commit: string) => {
  const raw = must(await git(top, ["cat-file", "commit", commit]), "قراءة commit المعاينة");
  if (/^parent /m.test(raw.split("\n\n")[0] ?? "")) throw new Error("commit المعاينة ليس يتيمًا.");
  const lines = must(await git(top, ["ls-tree", "-l", commit]), "قراءة شجرة المعاينة").split("\n").filter(Boolean);
  const entries = lines.map((l) => {
    const m = /^100644 blob ([0-9a-f]{40,64})\s+(\d+)\t(.+)$/.exec(l);
    if (!m || !PREVIEW_TREE_NAME_RE.test(m[3]!)) throw new Error(`مسار غير متوقع في فرع المعاينة: ${l.split("\t")[1] ?? l}`);
    return { blob: m[1]!, size: Number(m[2]), name: m[3]! };
  });
  if (!entries.some((e) => e.name === "manifest.json")) throw new Error("فرع المعاينة بلا manifest.json.");
  return entries;
};

// ———————————————————————————— الدفع (الجلسة السحابية) ————————————————————————————
export type PushResult = {
  ref: string; commit: string; sha256: string; size: number; parts: PreviewGitPart[]; entry: PreviewEntry;
  indexFile: string; indexCommitted: string | null; pushed: boolean;
};

/**
 * يبني commit المعاينة اليتيم في فهرس مؤقت ويدفعه بالقوة إلى فرعها، ثم يسجّل الخانة في previews/index.json
 * (ملف العمل؛ يُحفظ في commit على الفرع الحالي فقط مع commitIndex). لا يمس الفرع ولا الفهرس ولا ملفات العمل غير ذلك.
 */
export const pushCloudPreview = async (opts: {
  episodeDir: string; slot: string; file: string; title: string; note?: string;
  remote?: string; session?: string; partBytes?: number; commitIndex?: boolean;
}): Promise<PushResult> => {
  const remote = opts.remote ?? "origin";
  const partBytes = opts.partBytes ?? PREVIEW_PART_BYTES;
  const slot = slotOf(opts.slot);
  const { channel, episode } = episodeKey(opts.episodeDir);
  const ref = previewBranchRef(channel, episode, slot);
  if (!opts.title?.trim()) throw new Error("--title مطلوب.");
  if (!/\.mp4$/i.test(opts.file) || !existsSync(opts.file)) throw new Error(`الفيديو غير موجود أو ليس mp4: ${opts.file}`);
  const size = (await stat(opts.file)).size;
  if (!size) throw new Error("ملف المعاينة فارغ.");
  const nParts = Math.ceil(size / partBytes);
  if (nParts > 999) throw new Error("الفيديو أكبر من أن يُقسم إلى ٩٩٩ جزءًا.");
  const top = await repoTop(opts.episodeDir);
  must(await git(top, ["remote", "get-url", remote]), `لا remote باسم ${remote}`);

  // الأجزاء كائنات في Git مباشرة، وبصمة الملف كله تُحسب بقراءة واحدة منفصلة
  const whole = createHash("sha256");
  await new Promise<void>((res, rej) => createReadStream(opts.file).on("data", (c) => whole.update(c)).on("error", rej).on("end", () => res()));
  const sha256 = whole.digest("hex");
  const blobs: { name: string; blob: string }[] = [];
  const parts: PreviewGitPart[] = [];
  for (let i = 0; i < nParts; i++) {
    const name = `part-${String(i).padStart(3, "0")}`;
    const p = await hashPart(top, opts.file, i * partBytes, Math.min(size, (i + 1) * partBytes));
    blobs.push({ name, blob: p.blob });
    parts.push({ name, size: p.size, sha256: p.sha256 });
  }
  if (parts.reduce((n, p) => n + p.size, 0) !== size) throw new Error("تقسيم الفيديو غير مكتمل.");
  const manifest: PreviewManifest = {
    schemaVersion: 1, channel, episode, slot, title: opts.title.trim(), ...(opts.note ? { note: opts.note } : {}), status: PREVIEW_STATUS,
    sha256, size, partBytes, parts, createdAt: new Date().toISOString(),
    source: { session: opts.session ?? process.env.BAL_SESSION ?? process.env.CLAUDE_CODE_SESSION_ID ?? process.env.CLAUDE_SESSION_ID ?? os.hostname() },
  };
  const manifestBlob = must(await git(top, ["hash-object", "-w", "--stdin"], { input: JSON.stringify(manifest, null, 2) + "\n" }), "manifest");

  const tmp = await mkdtemp(path.join(os.tmpdir(), "bal-preview-index-"));
  let commit = "";
  try {
    const idx = { GIT_INDEX_FILE: path.join(tmp, "index") };
    // Defense in depth: prove the temporary index is the one git uses before writing to it.
    const where = await git(top, ["rev-parse", "--git-path", "index"], { env: idx });
    if (!where.ok || path.resolve(top, where.out) !== path.resolve(idx.GIT_INDEX_FILE)) throw new Error("رُفض بناء commit المعاينة خارج فهرس مؤقت.");
    must(await git(top, ["read-tree", "--empty"], { env: idx }), "read-tree");
    for (const b of [{ name: "manifest.json", blob: manifestBlob }, ...blobs])
      must(await git(top, ["update-index", "--add", "--cacheinfo", `100644,${b.blob},${b.name}`], { env: idx }), "update-index");
    const tree = must(await git(top, ["write-tree"], { env: idx }), "write-tree");
    commit = must(await git(top, ["commit-tree", tree, "-m", `preview: ${channel}/${episode}/${slot} — ${manifest.title}\n\n${PREVIEW_STATUS}\nsha256 ${sha256}\nsize ${size} (${parts.length} part(s))`],
      { env: await identityEnv(top) }), "commit-tree");
    await inspectPreviewCommit(top, commit); // the hook checks the same
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
  const push = await git(top, ["push", "--force", "--porcelain", "--no-follow-tags", "--recurse-submodules=no", remote, `${commit}:${ref}`], { timeout: 30 * 60_000 });
  if (!push.ok) throw new Error(`تعذّر دفع فرع المعاينة ${ref}: ${`${push.out}\n${push.err}`.trim().split("\n").slice(-4).join(" ")}`);

  const source: PreviewGitSource = { type: "git-branch", ref, commit, sha256, size, parts };
  const entry = await linkGitPreview(opts.episodeDir, slot, { title: manifest.title, note: opts.note, source });
  const indexFile = path.join(opts.episodeDir, "previews", "index.json");
  let indexCommitted: string | null = null;
  if (opts.commitIndex) {
    const rel = path.relative(top, await realpath(indexFile));
    must(await git(top, ["add", "--", rel]), "git add");
    must(await git(top, ["commit", "--only", "-m", `معاينة سحابية: ${channel}/${episode}/${slot} — ${manifest.title} (${PREVIEW_STATUS})`, "--", rel], { timeout: 120_000 }), "git commit");
    indexCommitted = must(await git(top, ["rev-parse", "HEAD"]), "rev-parse");
  }
  return { ref, commit, sha256, size, parts, entry, indexFile, indexCommitted, pushed: true };
};

// ———————————————————————————— جهاز المالك: git pull لا يجلب فروع المعاينات ————————————————————————————
const gitVersion = async (cwd: string) => {
  const m = /(\d+)\.(\d+)/.exec((await git(cwd, ["--version"])).out);
  return m ? [Number(m[1]), Number(m[2])] as const : null;
};

/**
 * يضيف إلى إعداد المستودع المحلي refspec سالبًا `^refs/heads/previews/*` (git ≥ 2.29) فلا يجلب `git pull`/`git fetch`
 * فروع المعاينات الثقيلة، ويحذف ما جُلب منها سابقًا تحت refs/remotes. مرة واحدة (يتحقق قبل الإضافة)، محلي فقط.
 * Git أقدم: يُستبدل refspec الجلب العام بـ main وstudio-notes صراحة، ويُقال ذلك في السجل.
 */
export const ensurePreviewFetchExclusion = async (repoDir: string, log: (m: string) => void = console.log, remote = "origin",
  opts: { gitVersion?: readonly [number, number] } = {}) => {
  const top = await repoTop(repoDir).catch(() => null);
  if (!top) return { changed: false, mode: "no-repo" as const };
  const key = `remote.${remote}.fetch`;
  const current = (await git(top, ["config", "--get-all", key])).out.split("\n").filter(Boolean);
  if (!current.length) return { changed: false, mode: "no-remote" as const };
  const v = opts.gitVersion ?? await gitVersion(top);
  const negative = !!v && (v[0] > 2 || (v[0] === 2 && v[1] >= 29));
  let changed = false;
  let mode: "negative" | "explicit";
  if (negative) {
    mode = "negative";
    if (!current.includes(PREVIEW_FETCH_EXCLUDE)) {
      must(await git(top, ["config", "--add", key, PREVIEW_FETCH_EXCLUDE]), "git config");
      log(`[studio] git: ${key} += ${PREVIEW_FETCH_EXCLUDE} (git pull no longer downloads cloud preview branches).`);
      changed = true;
    }
  } else {
    mode = "explicit";
    const wide = `+refs/heads/*:refs/remotes/${remote}/*`;
    if (current.includes(wide)) {
      must(await git(top, ["config", "--unset-all", key]), "git config");
      for (const b of ["main", "studio-notes"]) must(await git(top, ["config", "--add", key, `+refs/heads/${b}:refs/remotes/${remote}/${b}`]), "git config");
      log(`[studio] git ${v ? v.join(".") : "?"} is older than 2.29 (no negative refspecs): ${key} now fetches main and studio-notes only.`);
      changed = true;
    }
  }
  // ما جُلب سابقًا من فروع المعاينات (قبل الإعداد) لا يبقى يحجز المساحة
  const stale = (await git(top, ["for-each-ref", "--format=%(refname)", `refs/remotes/${remote}/previews/`])).out.split("\n").filter(Boolean);
  for (const r of stale) await git(top, ["update-ref", "-d", r]);
  if (stale.length) log(`[studio] git: removed ${stale.length} local tracking ref(s) of cloud preview branches.`);
  return { changed, mode, removed: stale.length };
};

// ———————————————————————————— جهاز المالك: «حمّل المعاينة» ————————————————————————————
export type DownloadProgress = { phase: "fetch" | "assemble" | "install"; pct: number; received?: number; total?: number };
const readIndexFile = async (episodeDir: string): Promise<PreviewIndex> => {
  const f = path.join(episodeDir, "previews", "index.json");
  return existsSync(f) ? JSON.parse(await readFile(f, "utf8")) as PreviewIndex : {};
};
const ar = (m: string) => new Error(m);

/** يكتب blob إلى تدفق مفتوح (مع احترام الضغط الخلفي) ويمرر كل قطعة إلى onData. */
const catBlob = (top: string, blob: string, out: NodeJS.WritableStream, onData: (c: Buffer) => void) => new Promise<void>((resolve, reject) => {
  const child = spawn("git", ["cat-file", "blob", blob], { cwd: top, env: childEnv({ GIT_TERMINAL_PROMPT: "0" }) });
  let err = "";
  child.stdout.on("data", (c: Buffer) => {
    onData(c);
    if (!out.write(c)) { child.stdout.pause(); out.once("drain", () => child.stdout.resume()); }
  });
  child.stderr.on("data", (c) => { err += c; });
  child.on("error", reject);
  child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`git cat-file: ${err.trim()}`)));
});

/**
 * يجلب فرع خانة واحدة إلى مرجع مؤقت، ويتحقق من manifest والأجزاء وبصمة الملف كله، ويضع الفيديو في previews/<الخانة>.mp4
 * دفعة واحدة (مع نسخة سابقة واحدة)، ثم يحذف المرجع المؤقت. أي خلل: رسالة عربية ولا يُستبدل شيء.
 * الجلب بلا --depth: الـcommit يتيم فلا تاريخ يُختصر، و--depth كان سيحوّل مستودع المالك إلى shallow.
 */
export const downloadCloudPreview = async (opts: { episodeDir: string; name: string; remote?: string; onProgress?: (p: DownloadProgress) => void }) => {
  const remote = opts.remote ?? "origin";
  const name = `${slotOf(opts.name)}.mp4`;
  const entry = (await readIndexFile(opts.episodeDir))[name];
  const src = entry?.source;
  if (src?.type !== "git-branch") throw ar("هذه المعاينة ليست على فرع معاينات في GitHub.");
  const key = episodeKey(opts.episodeDir);
  if (src.ref !== previewBranchRef(key.channel, key.episode, name)) throw ar("مرجع فرع المعاينة في الفهرس لا يطابق الحلقة والخانة.");
  const top = await repoTop(opts.episodeDir);
  const cache = cacheRefFor(src.ref);
  const dir = path.join(opts.episodeDir, "previews");
  await mkdir(dir, { recursive: true });
  const pending = path.join(dir, `.${slotOf(name)}.${randomUUID()}.download`);
  const progress = (p: DownloadProgress) => opts.onProgress?.(p);
  try {
    progress({ phase: "fetch", pct: 0, total: src.size });
    const fetched = await git(top, ["fetch", "--no-tags", "--no-write-fetch-head", "--no-recurse-submodules", "--progress", remote, `+${src.ref}:${cache}`], {
      timeout: 60 * 60_000,
      onStderr: (c) => {
        const all = [...c.matchAll(/Receiving objects:\s+(\d+)%/g)];
        if (all.length) progress({ phase: "fetch", pct: Number(all[all.length - 1]![1]), total: src.size });
      },
    });
    if (!fetched.ok) {
      if (/couldn't find remote ref|no such ref|not our ref/i.test(fetched.err)) throw ar("المعاينة غير موجودة على GitHub (ربما استُبدلت بنسخة أحدث)؛ حدّث الاستوديو ثم أعد المحاولة.");
      throw ar(`تعذّر تحميل المعاينة من GitHub؛ تحقق من الاتصال ثم أعد المحاولة. (${fetched.err.split("\n").slice(-1)[0] ?? ""})`);
    }
    const commit = must(await git(top, ["rev-parse", `${cache}^{commit}`]), "rev-parse");
    const entries = await inspectPreviewCommit(top, commit).catch((e: Error) => { throw ar(`فرع المعاينة على GitHub غير سليم: ${e.message}`); });
    const manifest = JSON.parse(must(await git(top, ["cat-file", "blob", entries.find((e) => e.name === "manifest.json")!.blob]), "manifest")) as PreviewManifest;
    if (manifest.sha256 !== src.sha256 || manifest.size !== src.size)
      throw ar("النسخة على GitHub ليست المسجلة في الفهرس (رُفعت نسخة أحدث)؛ حدّث الاستوديو ثم أعد المحاولة.");
    const byName = new Map(entries.map((e) => [e.name, e]));
    const whole = createHash("sha256");
    const out = createWriteStream(pending, { flags: "wx", mode: 0o644 });
    const outDone = new Promise<void>((res, rej) => { out.on("finish", () => res()); out.on("error", rej); });
    let received = 0;
    try {
      for (const part of manifest.parts) {
        const t = byName.get(part.name);
        if (!t || t.size !== part.size) throw ar(`جزء ناقص أو بحجم مختلف في فرع المعاينة: ${part.name}`);
        const h = createHash("sha256");
        await catBlob(top, t.blob, out, (c) => {
          h.update(c); whole.update(c); received += c.length;
          progress({ phase: "assemble", pct: Math.round((received / manifest.size) * 100), received, total: manifest.size });
        });
        if (h.digest("hex") !== part.sha256) throw ar(`بصمة الجزء ${part.name} لا تطابق؛ لم يُستبدل شيء.`);
      }
    } finally {
      out.end();
      await outDone.catch(() => undefined);
    }
    if (received !== manifest.size || whole.digest("hex") !== src.sha256) throw ar("بصمة الفيديو المحمَّل لا تطابق الفهرس؛ لم يُستبدل شيء.");
    progress({ phase: "install", pct: 100, received, total: manifest.size });
    const file = await installPreviewFile(opts.episodeDir, name, pending, src.sha256);
    return { file, sha256: src.sha256, size: src.size, commit };
  } finally {
    await rm(pending, { force: true });
    await git(top, ["update-ref", "-d", cache]);
  }
};

// ———————————————————————————— مهام التحميل في الاستوديو ————————————————————————————
export type DownloadJob = {
  state: "running" | "done" | "error"; phase: DownloadProgress["phase"]; pct: number;
  received: number; total: number; sizeLabel: string; error?: string; startedAt: number;
};
const jobs = new Map<string, DownloadJob>();
const jobKey = (episodeDir: string, name: string) => `${path.resolve(episodeDir)}\0${slotOf(name)}`;
export const cloudPreviewJob = (episodeDir: string, name: string) => jobs.get(jobKey(episodeDir, name)) ?? null;
/** يبدأ تحميلًا واحدًا لكل خانة (طلب ثانٍ أثناء التحميل يعيد المهمة نفسها). */
export const startCloudPreviewDownload = (episodeDir: string, name: string, opts: { remote?: string; log?: (m: string) => void } = {}) => {
  const k = jobKey(episodeDir, name);
  const running = jobs.get(k);
  if (running?.state === "running") return { job: running, done: Promise.resolve() };
  const job: DownloadJob = { state: "running", phase: "fetch", pct: 0, received: 0, total: 0, sizeLabel: "", startedAt: Date.now() };
  jobs.set(k, job);
  const done = downloadCloudPreview({ episodeDir, name, remote: opts.remote, onProgress: (p) => {
    job.phase = p.phase; job.pct = p.pct;
    if (p.total) { job.total = p.total; job.sizeLabel = arabicMegabytes(p.total); }
    if (p.received !== undefined) job.received = p.received;
  } }).then(() => { job.state = "done"; job.pct = 100; },
    (e: Error) => { job.state = "error"; job.error = e.message; opts.log?.(`[studio] cloud preview download failed: ${e.message}`); });
  return { job, done };
};

/** إعداد «حمّل المعاينات الجديدة تلقائيًا» (مطفأ افتراضيًا)، محلي في .studio/ (لا يُرفع). */
const settingsFile = (root: string) => path.join(root, ".studio", "cloud-previews.json");
export const readCloudPreviewSettings = async (root: string): Promise<{ autoDownload: boolean }> => {
  try { return { autoDownload: JSON.parse(await readFile(settingsFile(root), "utf8")).autoDownload === true }; }
  catch { return { autoDownload: false }; }
};
export const writeCloudPreviewSettings = async (root: string, s: { autoDownload: boolean }) => {
  await mkdir(path.dirname(settingsFile(root)), { recursive: true });
  const tmp = `${settingsFile(root)}.${randomUUID()}.tmp`;
  await writeFile(tmp, JSON.stringify({ autoDownload: s.autoDownload === true }, null, 2) + "\n");
  const { rename } = await import("node:fs/promises");
  await rename(tmp, settingsFile(root));
  return readCloudPreviewSettings(root);
};

// ———————————————————————————— التنظيف ————————————————————————————
/**
 * فروع المعاينات على GitHub التي لم تعد خانتها في previews/index.json تشير إليها (حُذفت الخانة أو صارت محلية أو Drive).
 * الفهرس من ملفات العمل، أو من مرجع (`against`، مثل origin/main). تجربة افتراضيًا؛ الحذف مع apply فقط.
 */
export const pruneCloudPreviews = async (opts: { repoDir: string; remote?: string; apply?: boolean; against?: string }) => {
  const remote = opts.remote ?? "origin";
  const top = await repoTop(opts.repoDir);
  const ls = await git(top, ["ls-remote", "--refs", remote, `${PREVIEW_REF_PREFIX}*`], { timeout: 60_000 });
  if (!ls.ok) throw new Error(`تعذّر الوصول إلى ${remote}: ${ls.err}`);
  const branches = ls.out.split("\n").filter(Boolean).map((l) => { const [sha, ref] = l.split(/\s+/); return { sha: sha!, ref: ref! }; });
  const indexCache = new Map<string, PreviewIndex>();
  const indexFor = async (channel: string, episode: string): Promise<PreviewIndex> => {
    const rel = `channels/${channel}/episodes/${episode}/previews/index.json`;
    if (indexCache.has(rel)) return indexCache.get(rel)!;
    let text: string | null = null;
    if (opts.against) { const r = await git(top, ["show", `${opts.against}:${rel}`]); text = r.ok ? r.out : null; }
    else if (existsSync(path.join(top, rel))) text = await readFile(path.join(top, rel), "utf8");
    let idx: PreviewIndex = {};
    try { idx = text ? JSON.parse(text) as PreviewIndex : {}; } catch { idx = {}; }
    indexCache.set(rel, idx);
    return idx;
  };
  const keep: string[] = [], remove: string[] = [];
  for (const b of branches) {
    const p = parsePreviewRef(b.ref);
    if (!p) { keep.push(b.ref); continue; } // not ours to judge
    const e = (await indexFor(p.channel, p.episode))[`${p.slot}.mp4`];
    if (e?.source?.type === "git-branch" && e.source.ref === b.ref) keep.push(b.ref); else remove.push(b.ref);
  }
  const deleted: string[] = [];
  if (opts.apply && remove.length) {
    const r = await git(top, ["push", "--porcelain", remote, ...remove.map((ref) => `:${ref}`)], { timeout: 120_000 });
    if (!r.ok) throw new Error(`تعذّر حذف فروع المعاينات: ${r.err}`);
    deleted.push(...remove);
  }
  return { keep, remove, deleted, dryRun: !opts.apply };
};
