/**
 * «إلى Drive بعد إذن النشر» (قرار صاحب المشروع، ٩ نوفمبر، D53).
 *
 * النشر على يوتيوب وغيره يدوي بالكامل بيد المالك. حين يمنح «إذن النشر» للنسخة النهائية المعتمدة، ينسخ
 * الاستوديو كل ما يحتاجه إلى مجلد Google Drive for desktop على جهازه، بجودته الأصلية بايتًا ببايت:
 *   <My Drive>/balislam-publish/<القناة>/<مجلد الحلقة>/
 * وDrive for desktop يرفع المجلد وحده؛ لا يرفع الكود شيئًا عبر الشبكة ولا يستعمل أي واجهة لمنصة نشر.
 *
 * القواعد:
 * - لا يُنسخ شيء قبل الإذن: الحقائق من `publishHandoffFacts` (البوابة نفسها `requirePublishAllowed`)، والنسخة
 *   تُرفض إن خالفت بايتاتها بصمة Master المعتمدة في السجل (تُحسب أثناء النسخ ثم من النسخة نفسها).
 * - نسخ آمن: اسم مؤقت ثم إعادة تسمية، والتحقق من الحجم والبصمة بعد النسخ. ما يطابق يُتخطى، وما تغيّر يُستبدل،
 *   ولا يُحذف أي ملف آخر في المجلد.
 * - لا أثر للأدوات: نص النشر يمر على `assertNoTraces`، وكل فيديو تُفحص بياناته الوصفية (cleanMetadata)،
 *   وكل صورة نصوصها المضمّنة، وكل ترجمة نصها.
 */
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream, existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { findTraces, assertNoTraces } from "./traces";
import type { PublishHandoffFacts } from "../studio/sceneService";

const run = promisify(execFile);

/** اسم المجلد الأعلى داخل My Drive. */
export const DRIVE_PUBLISH_FOLDER = "balislam-publish";
/** ملف نص النشر (العنوان والوصف والوسوم والفصول والتعليق المثبّت ونصوص كل منصة). */
export const PUBLISH_TEXT_NAME = "نشر.txt";
export const MANIFEST_NAME = "manifest.json";

export const NO_DRIVE_MESSAGE =
  "لم يُعثر على مجلد Google Drive على هذا الجهاز. افتح Google Drive for desktop وسجّل الدخول، " +
  "أو اكتب مسار مجلد My Drive في ملف .env هكذا: BAL_DRIVE_PUBLISH_DIR=~/Library/CloudStorage/GoogleDrive-…/My Drive ثم أعد تشغيل الاستوديو.";

export type DriveRoot = { root: string | null; source: "env" | "detected" | null; message?: string };

const expandHome = (v: string, home: string) => path.resolve(v.replace(/^~(?=$|\/)/, home));
const isDir = (p: string) => { try { return statSync(p).isDirectory(); } catch { return false; } };

/**
 * مجلد My Drive المحلي: `BAL_DRIVE_PUBLISH_DIR` إن ضُبط (و`off` يوقف النسخ)، وإلا يُكتشف من
 * ~/Library/CloudStorage/GoogleDrive-<الحساب>/My Drive أو /Volumes/GoogleDrive/My Drive.
 * لا يُكتشف شيء تلقائيًا داخل الاختبارات (VITEST) حتى لا تصل ملفات اختبار إلى Drive حقيقي.
 */
export const drivePublishRoot = (env: NodeJS.ProcessEnv = process.env, home = os.homedir()): DriveRoot => {
  const set = env.BAL_DRIVE_PUBLISH_DIR?.trim();
  if (set) {
    if (/^(off|none|0|false)$/i.test(set)) return { root: null, source: null, message: "النسخ إلى Drive موقوف (BAL_DRIVE_PUBLISH_DIR=off في .env)." };
    const dir = expandHome(set, home);
    if (!isDir(dir)) return { root: null, source: "env", message: `المجلد المكتوب في BAL_DRIVE_PUBLISH_DIR غير موجود: ${dir}. صحّح المسار في .env ثم أعد تشغيل الاستوديو.` };
    return { root: dir, source: "env" };
  }
  if (env.VITEST) return { root: null, source: null, message: NO_DRIVE_MESSAGE };
  const cloud = path.join(home, "Library", "CloudStorage");
  let found: string[] = [];
  try {
    found = readdirSync(cloud).filter((n) => n.startsWith("GoogleDrive-")).sort()
      .map((n) => path.join(cloud, n, "My Drive")).filter(isDir);
  } catch { /* no CloudStorage folder */ }
  if (found.length > 1) {
    // أكثر من حساب: الحساب نفسه الذي تُحفظ فيه المعاينات إن ضُبط، وإلا يُطلب التحديد.
    const previews = env.BAL_DRIVE_PREVIEWS_DIR?.trim() ? expandHome(env.BAL_DRIVE_PREVIEWS_DIR.trim(), home) : "";
    const same = found.filter((f) => previews.startsWith(path.dirname(f) + path.sep));
    if (same.length === 1) return { root: same[0]!, source: "detected" };
    return { root: null, source: null, message: `على الجهاز أكثر من حساب Google Drive (${found.map((f) => path.basename(path.dirname(f)).replace(/^GoogleDrive-/, "")).join("، ")}). اكتب مسار My Drive للحساب المطلوب في .env: BAL_DRIVE_PUBLISH_DIR=… ثم أعد تشغيل الاستوديو.` };
  }
  if (found.length === 1) return { root: found[0]!, source: "detected" };
  const legacy = "/Volumes/GoogleDrive/My Drive";
  if (isDir(legacy)) return { root: legacy, source: "detected" };
  return { root: null, source: null, message: NO_DRIVE_MESSAGE };
};

const safeSegment = (s: string) => {
  if (!/^[\p{L}\p{N}][\p{L}\p{N}._-]{0,120}$/u.test(s) || s.includes("..")) throw new Error(`اسم غير آمن لمجلد Drive: ${s}`);
  return s;
};
export const driveTargetDir = (root: string, channel: string, episodeDirName: string) =>
  path.join(root, DRIVE_PUBLISH_FOLDER, safeSegment(channel), safeSegment(episodeDirName));

export type HandoffKind = "master" | "short" | "thumbnail" | "subtitle" | "text" | "manifest";
export type HandoffFile = { name: string; kind: HandoffKind; size: number; sha256: string; action: "copied" | "replaced" | "skipped" };
export type HandoffResult = {
  status: "done"; at: string; root: string; folder: string; masterSha256: string; files: HandoffFile[];
};
export type HandoffProgress = { pct: number; current: string; done: number; total: number };

/** ما يُسلَّم من out/package: Master، والشورتس المصنوعة من هذا Master نفسه، والصور المصغّرة، والترجمات. */
export const collectHandoffSources = async (facts: Pick<PublishHandoffFacts, "masterFile">) => {
  const dir = path.dirname(facts.masterFile);
  const masterName = path.basename(facts.masterFile);
  const id = masterName.replace(/-episode\.mp4$/, "");
  const masterTime = (await stat(facts.masterFile)).mtimeMs;
  const names = (await readdir(dir)).sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const out: { name: string; kind: Exclude<HandoffKind, "text" | "manifest">; file: string }[] = [
    { name: masterName, kind: "master", file: facts.masterFile }];
  // شورت/ريل يُسلَّم فقط إن صُنع بعد هذا Master (الشورتس تُقص من Master المعتمد، وأي نسخة أساسية جديدة تحذفها)
  // وكان ملفًا منتظمًا في الحزمة نفسها (ما عُزل في qc-failed لا يُسلَّم).
  const shorts = names.filter((n) => new RegExp(`^${id}-short-\\d+\\.mp4$`).test(n))
    .filter((n) => { const st = statSync(path.join(dir, n)); return st.isFile() && st.mtimeMs >= masterTime; });
  for (const n of shorts) out.push({ name: n, kind: "short", file: path.join(dir, n) });
  for (const n of names.filter((n) => new RegExp(`^${id}-thumbnail-\\d+\\.png$`).test(n)))
    out.push({ name: n, kind: "thumbnail", file: path.join(dir, n) });
  const shortIds = new Set(shorts.map((n) => n.replace(/\.mp4$/, "")));
  for (const n of names.filter((n) => n.endsWith(".srt"))) {
    const base = n.replace(/\.[a-z]{2,3}\.srt$/, "");
    if (base === `${id}-episode` || shortIds.has(base)) out.push({ name: n, kind: "subtitle", file: path.join(dir, n) });
  }
  return out;
};

/** آثار الأدوات في البيانات الوصفية لفيديو (cleanMetadata يحذفها كلها ويضع العنوان واسم القناة فقط). */
const TOOL_BYTES = /remotion|made with|x264 - core|elevenlabs|anthropic|openai/i;
const TOOL_TAGS = /remotion|x264|lavf|lavc|handbrake|made with/i;
export const videoTraces = async (file: string): Promise<string[]> => {
  const { stdout } = await run("ffprobe", ["-v", "error", "-print_format", "json", "-show_entries", "format_tags:stream_tags", file],
    { timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });
  const report = JSON.parse(stdout) as { format?: { tags?: Record<string, string> }; streams?: { tags?: Record<string, string> }[] };
  const tags = [report.format?.tags ?? {}, ...(report.streams ?? []).map((s) => s.tags ?? {})];
  const hits = new Set<string>();
  for (const t of tags) for (const [k, v] of Object.entries(t)) {
    // handler_name «VideoHandler/SoundHandler» قياسي في MP4 ولا يدل على أداة.
    if (/^(handler_name|language|vendor_id)$/i.test(k)) continue;
    for (const h of findTraces(String(v))) hits.add(h);
    if (TOOL_TAGS.test(String(v))) hits.add(`${k}: ${String(v).slice(0, 40)}`);
  }
  // أول الملف وآخره (فهرس الملف وأول الإطارات حيث يكتب المُرمِّز توقيعه).
  const fd = await open(file, "r");
  try {
    const size = (await fd.stat()).size;
    const span = Math.min(size, 8 * 1024 * 1024);
    for (const at of size > span ? [0, size - span] : [0]) {
      const buf = Buffer.alloc(span);
      await fd.read(buf, 0, span, at);
      const m = buf.toString("latin1").match(TOOL_BYTES);
      if (m) hits.add(`توقيع داخل الملف: ${m[0]}`);
    }
  } finally { await fd.close(); }
  return [...hits];
};
/** نصوص PNG المضمّنة (tEXt/iTXt/zTXt) مثل «Software». */
export const pngTraces = async (file: string): Promise<string[]> => {
  const buf = await readFile(file);
  const hits = new Set<string>();
  for (let i = 8; i + 8 <= buf.length;) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString("latin1", i + 4, i + 8);
    if (type === "tEXt" || type === "iTXt" || type === "zTXt") {
      const text = buf.toString("utf8", i + 8, i + 8 + len);
      for (const h of findTraces(text)) hits.add(h);
      if (TOOL_TAGS.test(text) || TOOL_BYTES.test(text)) hits.add(`${type}: ${text.replace(/\0/g, " ").slice(0, 40)}`);
    }
    if (type === "IEND") break;
    i += 12 + len;
  }
  return [...hits];
};

const hashFile = (file: string, onBytes?: (n: number) => void) => new Promise<string>((resolve, reject) => {
  const h = createHash("sha256");
  createReadStream(file).on("data", (c) => { h.update(c); onBytes?.(c.length); }).on("error", reject).on("end", () => resolve(h.digest("hex")));
});

/**
 * ينسخ ملفًا إلى اسم مؤقت بجواره، ويحسب بصمة المصدر أثناء القراءة؛ يرفض إن خالفت `expectedSha256`،
 * ثم يتحقق من حجم النسخة وبصمتها قبل إعادة التسمية. لا يبقى ملف مؤقت في أي حال.
 */
export const copyVerified = async (src: string, dst: string, expectedSha256?: string, onBytes?: (n: number) => void): Promise<string> => {
  const tmp = path.join(path.dirname(dst), `.${path.basename(dst)}.${randomUUID()}.part`);
  try {
    const h = createHash("sha256");
    const tap = new Transform({ transform(chunk, _e, cb) { h.update(chunk); onBytes?.(chunk.length); cb(null, chunk); } });
    await pipeline(createReadStream(src), tap, createWriteStream(tmp, { flags: "wx", mode: 0o644 }));
    const srcSha = h.digest("hex");
    if (expectedSha256 && srcSha !== expectedSha256)
      throw new Error(`بايتات ${path.basename(src)} لا تطابق بصمة النسخة المعتمدة في السجل؛ لم يُنسخ شيء منها.`);
    const fd = await open(tmp, "r+");
    try { await fd.sync(); } finally { await fd.close(); }
    const [a, b] = [await stat(src), await stat(tmp)];
    if (a.size !== b.size || await hashFile(tmp) !== srcSha)
      throw new Error(`تعذّر التحقق من نسخة ${path.basename(src)} (الحجم أو البصمة)؛ أعد المحاولة.`);
    await rename(tmp, dst);
    return srcSha;
  } finally {
    await rm(tmp, { force: true });
  }
};

const writeAtomic = async (dst: string, text: string) => {
  const tmp = path.join(path.dirname(dst), `.${path.basename(dst)}.${randomUUID()}.part`);
  try {
    await writeFile(tmp, text, { flag: "wx", mode: 0o644 });
    await rename(tmp, dst);
  } finally { await rm(tmp, { force: true }); }
};

type PrevManifest = { files?: { name: string; size: number; sha256: string; mtimeMs?: number }[] };

/**
 * التسليم نفسه (بلا بوابات: يستدعيه `runDriveHandoff` بعد التحقق من الإذن، والاختبارات مباشرة).
 * يفحص كل شيء أولًا (النص وآثار الأدوات وبصمة Master) ثم ينسخ، فلا يصل إلى Drive ملف مرفوض.
 */
export const deliverToDrive = async (opts: {
  facts: PublishHandoffFacts; root: string; publishText: string;
  onProgress?: (p: HandoffProgress) => void; now?: () => Date;
}): Promise<HandoffResult> => {
  const { facts, root } = opts;
  const now = opts.now ?? (() => new Date());
  assertNoTraces([{ name: PUBLISH_TEXT_NAME, text: opts.publishText }]);
  const sources = await collectHandoffSources(facts);
  // قاعدة القناة: لا أثر للأدوات في أي ملف يُسلَّم.
  const bad: string[] = [];
  for (const s of sources) {
    const hits = s.kind === "master" || s.kind === "short" ? await videoTraces(s.file)
      : s.kind === "thumbnail" ? await pngTraces(s.file)
      : findTraces(await readFile(s.file, "utf8"));
    if (hits.length) bad.push(`• ${s.name}: ${hits.join("، ")}`);
  }
  if (bad.length) throw new Error(`قاعدة القناة: ملف يكشف أدوات الإنتاج، فلم يُنسخ شيء إلى Drive.\n${bad.join("\n")}`);

  const folder = driveTargetDir(root, facts.channel, path.basename(facts.episodeDir));
  await mkdir(folder, { recursive: true });
  let prev: PrevManifest = {};
  try { prev = JSON.parse(await readFile(path.join(folder, MANIFEST_NAME), "utf8")) as PrevManifest; } catch { /* first delivery */ }
  const known = new Map((prev.files ?? []).map((f) => [f.name, f]));

  const sizes = await Promise.all(sources.map(async (s) => (await stat(s.file)).size));
  const total = sizes.reduce((a, b) => a + b, 0) || 1;
  let done = 0;
  const tick = (current: string) => (n: number) => {
    done += n;
    opts.onProgress?.({ pct: Math.min(99, Math.round((done / total) * 99)), current, done, total });
  };
  const files: (HandoffFile & { mtimeMs: number })[] = [];
  for (const [i, s] of sources.entries()) {
    const dst = path.join(folder, s.name);
    const size = sizes[i]!;
    opts.onProgress?.({ pct: Math.min(99, Math.round((done / total) * 99)), current: s.name, done, total });
    // بصمة المصدر: Master من السجل (ويُتحقق منها أثناء النسخ)، والباقي يُحسب الآن.
    const srcSha = s.kind === "master" ? facts.masterSha256 : await hashFile(s.file);
    let action: HandoffFile["action"] = "copied";
    if (existsSync(dst)) {
      const st = await stat(dst);
      const k = known.get(s.name);
      const same = st.size === size && (k && k.sha256 === srcSha && k.size === size && k.mtimeMs === st.mtimeMs
        ? true : await hashFile(dst) === srcSha);
      if (same) {
        tick(s.name)(size);
        files.push({ name: s.name, kind: s.kind, size, sha256: srcSha, action: "skipped", mtimeMs: st.mtimeMs });
        continue;
      }
      action = "replaced";
    }
    // Master: البايتات المقروءة يجب أن تطابق بصمة Master المعتمدة في السجل، وإلا لا يُكتب شيء.
    const sha = await copyVerified(s.file, dst, s.kind === "master" ? facts.masterSha256 : srcSha, tick(s.name));
    files.push({ name: s.name, kind: s.kind, size, sha256: sha, action, mtimeMs: (await stat(dst)).mtimeMs });
  }

  // نص النشر: يُكتب فقط إن تغيّر.
  const textDst = path.join(folder, PUBLISH_TEXT_NAME);
  const textBytes = Buffer.from(opts.publishText, "utf8");
  const textSha = createHash("sha256").update(textBytes).digest("hex");
  let textAction: HandoffFile["action"] = existsSync(textDst) ? "replaced" : "copied";
  if (existsSync(textDst) && createHash("sha256").update(await readFile(textDst)).digest("hex") === textSha) textAction = "skipped";
  else await writeAtomic(textDst, opts.publishText);
  files.push({ name: PUBLISH_TEXT_NAME, kind: "text", size: textBytes.length, sha256: textSha, action: textAction, mtimeMs: (await stat(textDst)).mtimeMs });

  const at = now().toISOString();
  const manifest = {
    version: 1,
    channel: facts.channel,
    episode: facts.episode,
    episodeDir: path.basename(facts.episodeDir),
    deliveredAt: at,
    note: "الملفات المعتمدة للنشر هي المذكورة هنا فقط، بجودتها الأصلية. النشر نفسه يدوي.",
    approvals: {
      master: { sha256: facts.masterSha256, approvedAt: facts.master.at, approvedBy: facts.master.by, ledgerSeq: facts.master.seq },
      publish: { grantedAt: facts.publish.at, grantedBy: facts.publish.by, ledgerSeq: facts.publish.seq },
      ledgerRevision: facts.ledgerRevision,
    },
    files: files.map(({ name, kind, size, sha256, mtimeMs }) => ({ name, kind, size, sha256, mtimeMs })),
  };
  const manifestText = JSON.stringify(manifest, null, 2) + "\n";
  assertNoTraces([{ name: MANIFEST_NAME, text: manifestText }]);
  await writeAtomic(path.join(folder, MANIFEST_NAME), manifestText);
  opts.onProgress?.({ pct: 100, current: "", done: total, total });
  return {
    status: "done", at, root, folder, masterSha256: facts.masterSha256,
    files: [...files.map(({ mtimeMs: _m, ...f }) => f),
      { name: MANIFEST_NAME, kind: "manifest", size: Buffer.byteLength(manifestText), sha256: createHash("sha256").update(manifestText).digest("hex"), action: "copied" }],
  };
};

/** نص النشر: حزمة الانتشار نفسها التي يعرضها الاستوديو (publish.json أو نسختها الآلية) مع الفصول بالتوقيت الحقيقي. */
export const buildPublishText = async (facts: Pick<PublishHandoffFacts, "episode" | "scriptPath">): Promise<string> => {
  const { readPlanFile } = await import("../plan/io");
  const social = await import("./social");
  const { collectMedia } = await import("../plan/collect");
  const { loadChannel } = await import("../channel");
  const { channelInfo } = await import("../channel/types");
  const { realEpisodeTimings } = await import("./realTimings");
  const plan = await readPlanFile(facts.scriptPath);
  if (!plan) throw new Error("خطة الحلقة غير موجودة؛ لا يمكن كتابة نص النشر.");
  const media = { ...(await collectMedia(facts.episode, plan)), mode: "url" as const, base: "" };
  const kitFile = path.join(path.dirname(facts.scriptPath), "publish.json");
  const kit = existsSync(kitFile) ? JSON.parse(await readFile(kitFile, "utf8"))
    : social.generatePublishKit(plan, await readFile(facts.scriptPath, "utf8"), media, loadChannel());
  const chapters = social.chaptersText(plan, media, channelInfo(loadChannel()), await realEpisodeTimings(facts.scriptPath, plan));
  return `${social.kitToMarkdown(kit, plan.title, chapters).trimEnd()}\n\n## الفصول\n\n\`\`\`\n${chapters}\n\`\`\`\n`;
};

// ── الحالة والتشغيل في الخلفية ──────────────────────────────────────────────────────────────────────

export type HandoffJob = {
  status: "running" | "done" | "error"; startedAt: string; finishedAt?: string;
  trigger: "publish-permission" | "retry"; pct: number; current: string; error?: string;
};
export type HandoffRecord =
  | HandoffResult
  | { status: "error"; at: string; error: string; masterSha256?: string; folder?: string };

const jobs = new Map<string, HandoffJob>();
const recordFile = (episodeDir: string) => path.join(episodeDir, "out", "drive-handoff.json");
const readRecord = async (episodeDir: string): Promise<HandoffRecord | null> => {
  try { return JSON.parse(await readFile(recordFile(episodeDir), "utf8")) as HandoffRecord; } catch { return null; }
};
const saveRecord = async (episodeDir: string, rec: HandoffRecord) => {
  await mkdir(path.dirname(recordFile(episodeDir)), { recursive: true });
  await writeAtomic(recordFile(episodeDir), JSON.stringify(rec, null, 2) + "\n");
};

export type HandoffDeps = {
  facts?: (episode: string) => Promise<PublishHandoffFacts>;
  text?: (facts: PublishHandoffFacts) => Promise<string>;
};

/** Gate message in the owner's language; the ledger's own reason follows. */
const gateMessage = (e: unknown) =>
  `لا يُرسل شيء إلى Drive قبل «إذن النشر» لهذه النسخة النهائية بعينها (الخطوة ٤)، أو تغيّر الملف بعد الإذن. (${(e as Error).message})`;

/**
 * يبدأ التسليم في الخلفية ويعود فورًا. لا يكتب شيئًا ولا يقرأ السجل إن لم يوجد مجلد Drive.
 * يرجع null حين لا يوجد Drive (الحالة تُعرض حية من `driveHandoffStatus`).
 */
export const startDriveHandoff = async (episode: string, trigger: HandoffJob["trigger"], deps: HandoffDeps = {}): Promise<HandoffJob | null> => {
  const { currentChannelId, runWithChannel } = await import("../channel");
  const channel = currentChannelId();
  const key = `${channel}/${episode}`;
  const running = jobs.get(key);
  if (running?.status === "running") return running;
  const drive = drivePublishRoot();
  if (!drive.root) return null;
  const { resolveScriptPath } = await import("../script/episodes");
  const episodeDir = path.dirname(await resolveScriptPath(episode));
  const job: HandoffJob = { status: "running", startedAt: new Date().toISOString(), trigger, pct: 0, current: "" };
  jobs.set(key, job);
  const work = async () => {
    let facts: PublishHandoffFacts;
    try {
      facts = await (deps.facts ?? (async (ep) => (await import("../studio/sceneService")).publishHandoffFacts(ep)))(episode);
    } catch (e) { throw new Error(gateMessage(e)); }
    const text = await (deps.text ?? buildPublishText)(facts);
    return deliverToDrive({ facts, root: drive.root!, publishText: text,
      onProgress: (p) => { job.pct = p.pct; job.current = p.current; } });
  };
  void runWithChannel(channel, async () => {
    try {
      const result = await work();
      await saveRecord(episodeDir, result);
      Object.assign(job, { status: "done", pct: 100, current: "", finishedAt: new Date().toISOString() });
    } catch (e) {
      const error = (e as Error).message || "تعذّر الإرسال إلى Drive.";
      Object.assign(job, { status: "error", error, current: "", finishedAt: new Date().toISOString() });
      await saveRecord(episodeDir, { status: "error", at: new Date().toISOString(), error }).catch(() => undefined);
    }
  });
  return job;
};

/** حالة القراءة (لا تكتب شيئًا): Drive الحالي، والمهمة الجارية، وآخر تسليم. */
export const driveHandoffStatus = async (episode: string) => {
  const { currentChannelId } = await import("../channel");
  const { resolveScriptPath } = await import("../script/episodes");
  const episodeDir = path.dirname(await resolveScriptPath(episode));
  const channel = path.basename(path.dirname(path.dirname(episodeDir)));
  const drive = drivePublishRoot();
  return {
    drive: { found: Boolean(drive.root), source: drive.source, message: drive.message ?? null,
      folder: drive.root ? driveTargetDir(drive.root, channel, path.basename(episodeDir)) : null },
    job: jobs.get(`${currentChannelId()}/${episode}`) ?? null,
    last: await readRecord(episodeDir),
    canOpen: process.platform === "darwin",
  };
};

/** «افتح المجلد»: Finder على Mac. */
export const openDriveFolder = async (episode: string): Promise<string> => {
  const s = await driveHandoffStatus(episode);
  const folder = s.last?.status === "done" ? s.last.folder : s.drive.folder;
  if (!folder || !isDir(folder)) throw new Error("مجلد الحلقة على Drive غير موجود بعد؛ أرسل الملفات أولًا.");
  if (process.platform !== "darwin") throw new Error(`فتح المجلد متاح على Mac فقط. المسار: ${folder}`);
  await run("open", [folder], { timeout: 10_000 });
  return folder;
};

/** للاختبارات فقط. */
export const __resetDriveHandoffJobs = () => jobs.clear();
