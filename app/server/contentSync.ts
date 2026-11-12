import path from "node:path";
import os from "node:os";
import { existsSync, statSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { childEnv } from "../../scripts/git-env.mjs";
import { CONTENT_MAX_BYTES, isOwnerContentPath } from "../../scripts/contentPaths.mjs";
import { backupRoot, localChanges, readConflicts } from "./safeUpdate.ts";
import { applyUpdate } from "./update.ts";

/**
 * «كل الأماكن نسخة واحدة» (D101، طلب صاحب المشروع ١٢ نوفمبر): الاستوديو على جهاز المالك يحفظ عمله في main
 * ويستقبل كل تطوير آليًا، فلا يكتب المالك أمر Git أبدًا.
 *
 * الحفظ: كل بضع ثوانٍ يُفحص ما تغيّر. ملفات «محتوى المالك» وحدها (scripts/contentPaths.mjs) — بعد هدوء
 * الكتابة — تُبنى في commit فوق آخر main على GitHub مباشرة بأوامر السباكة في فهرس مؤقت (لا commit على
 * الفرع المحلي قبل نجاح الدفع، ولا لمس لملفات العمل ولا stash)، وتُدفع بمرجع صريح إلى main. خطاف pre-push
 * يشغّل البوابة: دفع محتوى فقط ⇒ «بوابة المحتوى» (scripts/contentGate.mts)، وأي ملف آخر ⇒ البوابة الكاملة.
 * بعد النجاح يتقدّم main المحلي إلى الـcommit نفسه (update-ref + reset للفهرس فقط). إن سبق دفعٌ آخر: يُستقبل
 * التحديث بأمان (D95) ثم يُعاد البناء. بلا اتصال أو رفض البوابة: يبقى «لم يُحفظ في المستودع بعد» ويُعاد آليًا.
 *
 * الاستقبال: عند التشغيل وكل بضع دقائق — وقبل كل حفظ — «حدّث الآن» نفسه (applyUpdate، D95: نسخة احتياطية،
 * fast-forward، إعادة تعديل المالك فوقه، «أبقِ نسختي / خذ الجديد» عند التعارض). إن تغيّر كود الخادم يُعاد
 * تشغيل الاستوديو آليًا تحت scripts/studio.mjs (رمز الخروج 75) ما لم تكن مهمة رندر جارية.
 *
 * لا يُرفع أبدًا: سجل الاعتماد الموقَّع، الصوت والفيديو، .env، صندوق الملاحظات (studio-notes وحده)، ولا حذف ملف
 * (الحذف المحلي يُذكر للمالك ولا يُرسل آليًا). مفعَّل على جهاز المالك (macOS/Windows) أو بـ BAL_CONTENT_SYNC=on،
 * ومطفأ في الاختبارات وجلسات السحابة (Linux) وأي نسخة ليست على فرع main.
 */

export type SyncState = {
  enabled: boolean;
  state: "off" | "synced" | "saving" | "pending" | "updating" | "conflict" | "error";
  message: string;
  /** ملفات محتوى تنتظر الحفظ في main */
  pending: string[];
  /** ما لا يُرسل آليًا (حذف ملف، ملف كبير جدًا) */
  skipped: string[];
  conflicts: number;
  lastSavedAt?: string;
  lastCommit?: string;
  /** آخر تحديث وصل من GitHub وطُبّق على هذا الجهاز (تعيد الصفحة تحميل بياناتها حين يتغير) */
  lastUpdateAt?: string;
  updateNote?: string;
  restartNeeded?: boolean;
  supervised: boolean;
};

type G = { ok: boolean; out: string; err: string };
/** Keep the failing assertion, not just the gate's final red cross. Bounded for the UI. */
export const gateFailureSummary = (text: string): string => {
  const plain = text.replace(/\x1b\[[0-9;]*m/g, "");
  const lines = plain.split("\n");
  const start = lines.findIndex((line) => /FAIL\s+tests\/|AssertionError|بوابة المحتوى رفضت/.test(line));
  const detail = start >= 0 ? lines.slice(start, start + 45).join("\n") : "";
  const summary = lines.filter((line) => /•|✗/.test(line)).slice(-8).join("\n");
  return [detail, summary].filter(Boolean).join("\n").slice(0, 7000) || "رفضت بوابة التسليم الحفظ.";
};
const run = (cwd: string, args: string[], opts: { env?: Record<string, string>; input?: string; timeout?: number } = {}) =>
  new Promise<G>((resolve) => {
    const child = execFile("git", args, {
      cwd, timeout: opts.timeout ?? 60_000, maxBuffer: 64 * 1024 * 1024,
      env: { ...childEnv({ GIT_TERMINAL_PROMPT: "0", GIT_OPTIONAL_LOCKS: "0" }), ...(opts.env ?? {}) },
    }, (error, stdout, stderr) => resolve({ ok: !error, out: String(stdout).trim(), err: String(stderr).trim() || (error?.message ?? "") }));
    if (opts.input !== undefined) child.stdin?.end(opts.input);
  });

export const contentSyncEnabled = (env = process.env, platform = process.platform) =>
  env.BAL_CONTENT_SYNC === "on" || (env.BAL_CONTENT_SYNC !== "off" && !env.VITEST && !env.CI && (platform === "darwin" || platform === "win32"));

const CHANNEL_NAMES: Record<string, string> = { "balislam": "بالإسلام", "dafatir-alzaman": "دفاتر الزمن", "zubdat-alkutub": "زبدة الكتب" };
const WHAT: [RegExp, string][] = [
  [/\/script\.md$/, "السكريبت"], [/\/plan\.json$/, "الخطة"], [/\/research\.md$/, "البحث"], [/\/publish\.json$/, "نصوص النشر"],
  [/\/series\.json$/, "السلسلة"], [/\/tashkeel\.md$/, "التشكيل"], [/\/tone-map\.json$/, "خريطة النبرة"], [/\/tone-map\.v[0-9.]+\.json$/, "نسخة خريطة النبرة السابقة"], [/\/review\.json$/, "سجل التوثيق"],
  [/\/previews\/index\.json$/, "فهرس المعاينات"], [/\/storyboards\/index\.json$/, "لوحات المختبر"], [/pronunciations?\.json$/, "النطق"],
  [/ideas\.json$/, "بنك الأفكار"], [/calendar\.json$/, "التقويم"], [/channel\.json$/, "إعدادات القناة"], [/identity\.json$/, "الهوية"],
  [/^config\.json$/, "إعدادات الاستوديو"],
];
/** رسالة commit عربية: القناة والحلقة وما تغيّر. */
export const commitMessage = (files: string[]) => {
  const groups = new Map<string, Set<string>>();
  for (const f of files) {
    const m = /^channels\/([^/]+)\/(?:episodes\/([^/]+)\/|series\/([^/]+)\/)?/.exec(f);
    const where = m ? `${CHANNEL_NAMES[m[1]!] ?? m[1]}${m[2] ? ` ${m[2].slice(0, 3)}` : m[3] ? ` (سلسلة ${m[3]})` : ""}` : "الاستوديو";
    const what = WHAT.find(([re]) => re.test(f))?.[1] ?? path.basename(f);
    if (!groups.has(where)) groups.set(where, new Set());
    groups.get(where)!.add(what);
  }
  const head = [...groups].map(([w, s]) => `${w}: ${[...s].join("، ")}`).join(" — ");
  return `حفظ الاستوديو: ${head}\n\nحفظ آلي من استوديو المالك (D101)؛ ملفات محتوى فقط.\n\n${files.join("\n")}\n`;
};

type Pending = { files: string[]; skipped: string[]; newestMtime: number; signature: string };
/** ملفات المحتوى المعدّلة أو الجديدة (لا المحذوفة)، وأحدث وقت كتابة بينها. */
export const pendingContent = async (root: string): Promise<Pending | null> => {
  const changes = await localChanges(root);
  if (!changes) return null;
  const conflicted = new Set((await readConflicts(root)).map((c) => c.file));
  const files: string[] = [], skipped: string[] = [];
  let newestMtime = 0;
  const sig: string[] = [];
  for (const c of changes) {
    if (!isOwnerContentPath(c.file)) continue;
    if (conflicted.has(c.file)) { skipped.push(`${c.file} (ينتظر قرارك: أبقِ نسختي / خذ الجديد)`); continue; }
    if (c.kind === "deleted") { skipped.push(`${c.file} (حُذف على هذا الجهاز؛ الحذف لا يُرسل آليًا)`); continue; }
    const abs = path.join(root, c.file);
    if (!existsSync(abs)) continue;
    const st = statSync(abs);
    if (!st.isFile()) continue;
    if (st.size > CONTENT_MAX_BYTES) { skipped.push(`${c.file} (أكبر من الحد)`); continue; }
    newestMtime = Math.max(newestMtime, st.mtimeMs);
    files.push(c.file);
    sig.push(`${c.file}:${st.size}:${st.mtimeMs}`);
  }
  return { files: files.sort(), skipped, newestMtime, signature: sig.sort().join("|") };
};

/**
 * package-lock.json الذي يعيد npm كتابته على الجهاز (npm install بنسخة npm أخرى) وpackage.json لم يتغير:
 * ضجيج لا محتوى. تُحفظ نسخته في ~/balislam-backup ثم يُرجع إلى نسخة main، فلا يظهر «معدّلًا» ولا يتعارض مع
 * التحديثات. الحزم المثبتة لا تتغير بذلك (npm ci عند تحديث الحزم يثبت ما في main).
 */
export const normalizeLockDrift = async (root: string): Promise<boolean> => {
  const changes = await localChanges(root);
  if (!changes?.some((c) => c.file === "package-lock.json" && c.kind === "modified")) return false;
  if (changes.some((c) => c.file === "package.json")) return false; // تغيير حقيقي في الحزم: لا يُلمس
  const dir = path.join(backupRoot(), "package-lock");
  await mkdir(dir, { recursive: true });
  await copyFile(path.join(root, "package-lock.json"), path.join(dir, `package-lock-${new Date().toISOString().replace(/[:.]/g, "-")}.json`));
  const r = await run(root, ["checkout", "HEAD", "--", "package-lock.json"]);
  return r.ok;
};

const identityEnv = async (root: string): Promise<Record<string, string>> => {
  const name = (await run(root, ["config", "user.name"])).out || "استوديو المالك";
  const email = (await run(root, ["config", "user.email"])).out || "studio@localhost";
  return { GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email };
};

export type SaveResult =
  | { ok: true; commit: string | null; files: string[] }
  | { ok: false; reason: "offline" | "rejected" | "gate" | "busy" | "error"; message: string; files: string[] };

/**
 * محاولة حفظ واحدة: commit فوق origin/main (المجلوب للتو) فيه ملفات المحتوى المعطاة كما هي على القرص، ثم دفع.
 * لا تلمس ملفات العمل؛ وعند النجاح فقط يتقدّم main المحلي ويُعاد ضبط الفهرس.
 */
export const pushContentOnce = async (root: string, files: string[], remote = "origin"): Promise<SaveResult> => {
  if (!files.length) return { ok: true, commit: null, files };
  const head = await run(root, ["rev-parse", "HEAD"]);
  const up = await run(root, ["rev-parse", `${remote}/main`]);
  if (!head.ok || !up.ok) return { ok: false, reason: "error", message: "تعذّر قراءة حالة Git.", files };
  // يجب أن يكون الجهاز على آخر main قبل البناء (يتكفل به الاستقبال الآمن قبل كل حفظ)
  if (head.out !== up.out) return { ok: false, reason: "rejected", message: "الجهاز ليس على آخر main بعد.", files };
  const tmp = await mkdtemp(path.join(os.tmpdir(), "bal-content-index-"));
  try {
    const idx = { GIT_INDEX_FILE: path.join(tmp, "index") };
    const where = await run(root, ["rev-parse", "--git-path", "index"], { env: idx });
    if (!where.ok || path.resolve(root, where.out) !== path.resolve(idx.GIT_INDEX_FILE))
      return { ok: false, reason: "error", message: "رُفض بناء الحفظ خارج فهرس مؤقت.", files };
    const read = await run(root, ["read-tree", up.out], { env: idx });
    if (!read.ok) return { ok: false, reason: "error", message: read.err, files };
    for (const f of files) {
      if (!isOwnerContentPath(f)) return { ok: false, reason: "error", message: `ليس ملف محتوى: ${f}`, files };
      const blob = await run(root, ["hash-object", "-w", "--", f]);
      if (!blob.ok) return { ok: false, reason: "error", message: blob.err, files };
      const add = await run(root, ["update-index", "--add", "--cacheinfo", `100644,${blob.out},${f}`], { env: idx });
      if (!add.ok) return { ok: false, reason: "error", message: add.err, files };
    }
    const tree = await run(root, ["write-tree"], { env: idx });
    if (!tree.ok) return { ok: false, reason: "error", message: tree.err, files };
    const baseTree = await run(root, ["rev-parse", `${up.out}^{tree}`]);
    if (tree.out === baseTree.out) {
      await run(root, ["reset", "-q", "--", ...files]);
      return { ok: true, commit: null, files };
    }
    // دفاع: الفرق بين الشجرتين ملفات محتوى فقط
    const diff = await run(root, ["diff-tree", "-r", "--name-only", "--no-renames", baseTree.out, tree.out]);
    if (!diff.ok || diff.out.split("\n").filter(Boolean).some((n) => !isOwnerContentPath(n)))
      return { ok: false, reason: "error", message: "الحفظ يحوي ملفًا ليس من المحتوى؛ أُوقف.", files };
    const made = await run(root, ["commit-tree", tree.out, "-p", up.out], { env: await identityEnv(root), input: commitMessage(files) });
    if (!made.ok) return { ok: false, reason: "error", message: made.err, files };
    const push = await run(root, ["push", "--porcelain", "--no-follow-tags", "--recurse-submodules=no", remote, `${made.out}:refs/heads/main`], { timeout: 45 * 60_000 });
    if (!push.ok) {
      const text = `${push.out}\n${push.err}`;
      if (/rejected|non-fast-forward|fetch first|stale info/i.test(text) && !/بوابة|hook declined|pre-push/i.test(text))
        return { ok: false, reason: "rejected", message: "سبقه تحديث آخر على GitHub.", files };
      if (/بوابة|hook declined|pre-push|failed to push some refs/i.test(text) && !/Could not resolve host|unable to access|Connection|timed out/i.test(text)) {
        return { ok: false, reason: "gate", message: gateFailureSummary(text), files };
      }
      return { ok: false, reason: "offline", message: "تعذّر الوصول إلى GitHub.", files };
    }
    // نجح: main المحلي يتقدم إلى الـcommit نفسه، والفهرس وحده يُعاد إليه (ملفات العمل لا تُلمس)
    const moved = await run(root, ["update-ref", "-m", "studio content save (D101)", "refs/heads/main", made.out, head.out]);
    if (moved.ok) {
      await run(root, ["update-ref", `refs/remotes/${remote}/main`, made.out]);
      await run(root, ["reset", "-q"]);
    }
    return { ok: true, commit: made.out, files };
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
};

const activeMain = async (root: string) => {
  const b = await run(root, ["symbolic-ref", "--quiet", "--short", "HEAD"]);
  return b.ok && b.out === "main";
};

/** الحلقة الخلفية: حالة واحدة لكل استوديو. */
export const createContentSync = (root: string, opts: {
  enabled?: boolean; remote?: string;
  quietMs?: number; tickMs?: number; receiveMs?: number;
  canRestart?: () => boolean; onRestart?: () => void;
  receive?: (root: string) => Promise<{ ok: boolean; message: string; restart?: boolean; conflicts?: unknown[] }>;
  status?: (root: string) => Promise<{ available: boolean; error?: string }>;
  log?: (m: string) => void;
} = {}) => {
  const enabled = opts.enabled ?? contentSyncEnabled();
  const quietMs = opts.quietMs ?? 6_000;
  const receiveMs = opts.receiveMs ?? 3 * 60_000;
  const log = opts.log ?? ((m: string) => console.log(`[studio] ${m}`));
  const supervised = process.env.BAL_STUDIO_SUPERVISED === "1";
  const state: SyncState = { enabled, state: enabled ? "synced" : "off", message: enabled ? "محفوظ في كل الأماكن" : "الحفظ الآلي مطفأ في هذه النسخة.", pending: [], skipped: [], conflicts: 0, supervised };
  let busy = false;
  let lastReceive = 0;
  let lastFailedSig = "";
  let retryAt = 0;

  const receive = async (): Promise<boolean> => {
    const status = opts.status ?? (async (r: string) => (await import("./update.ts")).updateStatus(r, true));
    const st = await status(root);
    lastReceive = Date.now();
    if (st.error || !st.available) return !st.error;
    state.state = "updating"; state.message = "تحديث جديد يصل…";
    const r = await (opts.receive ?? applyUpdate)(root);
    if (!r.ok) { log(`auto-update: ${r.message}`); return false; }
    state.lastUpdateAt = new Date().toISOString();
    state.updateNote = r.message;
    if (r.restart) {
      state.restartNeeded = true;
      if (supervised && (opts.canRestart?.() ?? true)) { log("auto-update changed server code: restarting"); setTimeout(() => opts.onRestart?.(), 1_500); }
    }
    return true;
  };

  const refreshCounts = async () => {
    state.conflicts = (await readConflicts(root)).length;
    const p = await pendingContent(root);
    if (p) { state.pending = p.files; state.skipped = p.skipped; }
    return p;
  };

  const settle = () => {
    if (state.conflicts) { state.state = "conflict"; state.message = state.conflicts === 1 ? "يحتاج قرارك (ملف واحد)" : `يحتاج قرارك (${state.conflicts} ملفات)`; return; }
    if (state.pending.length) return; // تبقى رسالة الحالة pending كما هي
    state.state = "synced"; state.message = "محفوظ في كل الأماكن";
  };

  const tick = async (force = false) => {
    if (!enabled || busy) return;
    busy = true;
    try {
      if (!await activeMain(root)) { state.state = "off"; state.message = "الحفظ الآلي يعمل على فرع main فقط."; return; }
      await normalizeLockDrift(root);
      const p = await refreshCounts();
      if (!p) { state.state = "error"; state.message = "تعذّر فحص الملفات بـ Git."; return; }
      const now = Date.now();
      const quiet = now - p.newestMtime >= quietMs;
      const wantSave = p.files.length > 0 && quiet && (force || p.signature !== lastFailedSig || now >= retryAt);
      const wantReceive = force || now - lastReceive >= receiveMs || wantSave;
      // لا تحديث تحت يد المالك وهو يكتب: الاستقبال بعد هدوء الكتابة أيضًا
      if (wantReceive && quiet) {
        await run(root, ["fetch", "--quiet", opts.remote ?? "origin", "main"], { timeout: 60_000 });
        await receive();
        await refreshCounts();
      }
      if (!wantSave) { settle(); return; }
      state.state = "saving"; state.message = "يحفظ…";
      let result: SaveResult = { ok: false, reason: "error", message: "", files: p.files };
      for (let attempt = 0; attempt < 3; attempt++) {
        const fresh = await pendingContent(root);
        if (!fresh?.files.length) { result = { ok: true, commit: null, files: [] }; break; }
        result = await pushContentOnce(root, fresh.files, opts.remote);
        if (result.ok || result.reason !== "rejected") break;
        await run(root, ["fetch", "--quiet", opts.remote ?? "origin", "main"], { timeout: 60_000 });
        await receive();
      }
      await refreshCounts();
      if (result.ok) {
        lastFailedSig = "";
        if (result.commit) { state.lastSavedAt = new Date().toISOString(); state.lastCommit = result.commit; log(`saved ${result.files.length} content file(s) to main: ${result.commit.slice(0, 8)}`); }
        settle();
      } else {
        lastFailedSig = p.signature;
        retryAt = Date.now() + (result.reason === "gate" ? 10 * 60_000 : 60_000);
        state.state = "pending";
        state.message = result.reason === "gate"
          ? `لم يُحفظ في المستودع: رفضت البوابة التعديل.\n${result.message}`
          : "لم يُحفظ في المستودع بعد — سيُعاد تلقائيًا";
        log(`content save failed (${result.reason}): ${result.message}`);
      }
    } catch (e) {
      state.state = "error"; state.message = `تعذّر الحفظ الآلي: ${(e as Error).message}`;
    } finally {
      busy = false;
    }
  };

  let timer: ReturnType<typeof setInterval> | null = null;
  return {
    state,
    tick,
    start() {
      if (!enabled || timer) return;
      lastReceive = 0;
      void tick(true);
      timer = setInterval(() => void tick(), opts.tickMs ?? 5_000);
      timer.unref?.();
    },
    stop() { if (timer) clearInterval(timer); timer = null; },
  };
};

let shared: ReturnType<typeof createContentSync> | null = null;
/** حلقة الاستوديو الواحدة (يضعها api.ts عند التشغيل، ويقرؤها مسار /api/sync في extra.ts). */
export const setSharedContentSync = (s: ReturnType<typeof createContentSync> | null) => { shared = s; };
export const getSharedContentSync = () => shared;
