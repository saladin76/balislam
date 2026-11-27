/**
 * التنظيف بعد النشر (D240، قاعدة ثابتة، ٢٧ نوفمبر): بعد نشر الحلقة على يوتيوب تُحذف ملفات الإنتاج المؤقتة وحدها.
 *
 * يبقى: Master النهائي 4K، والشورتس النهائية (كل شورت منشور Master نفسه)، وكل ما في Git، وملفات صوت الراوي (`voice/`
 * كلها؛ ولا يُحذف تسجيل مدفوع أبدًا)، وملفات التوقيت الصغيرة (`result.json` و`job.json` في `done/`).
 * يُحذف: مقاطع المشاهد والتجميع ونسخ المراجعة 1080p وملفات الرندر المؤقتة والكاش، والنسخ القديمة والتجارب لهذه الحلقة،
 * على الماك وعلى المجلد المشترك، وعلى ويندوز بمهمة في الطابور ينفذها العامل (`worker/cleanupQueue.ts`).
 *
 * شروط الأمان قبل أي حذف، وإن نقص واحد لا يُحذف شيء ويُذكر السبب:
 *   ١. الحلقة «منشورة» (`status.json` ← `published.date`) ولها رابط يوتيوب (`published.url` أو `publish.json` ← `long.episodeUrl`).
 *   ٢. Master له سجل اعتماد موقَّع وإذن نشر للبايتات نفسها، والنسخة المحفوظة بصمتها sha256 تطابق السجل، وسليمة
 *      (h264 بـ3840×2160 وصوت AAC ومدة، وبيانات وصفية بلا أثر لأدوات الإنتاج: الفحص نفسه في worker-collect).
 *   ٣. Master في مكانه الدائم على ويندوز: `<المجلد المشترك>/masters/<القناة>/<الحلقة>/<NNN>-episode.mp4`
 *      (`F:\bal-share` على ويندوز = `/Volumes/bal-share` على الماك)، لا في `render-queue/` ولا مجلد مؤقت.
 *
 * الحذف داخل جذور معروفة للحلقة وحدها (`deletionRoots`)، ملفًا ملفًا: لا `..` ولا رابط رمزي (يُرفض ولا يُتبع)، ولا ملف
 * متتبَّع في Git، ولا `.env`، ولا السجل الموقَّع (`scene-production.v1.json`). الافتراضي عرض بلا حذف؛ الحذف بـ `--delete`.
 */
import path from "node:path";
import { existsSync } from "node:fs";
import { lstat, readdir, readFile, realpath, rm } from "node:fs/promises";
import { isEpisodeUrl } from "../package/shortsLink";
import { findTraces } from "../package/traces";
import type { VideoProbe } from "./worker/probe";
import { git } from "./worker/git";

export const MASTERS_DIR = "masters";
export const MASTER_SIZE = { width: 3840, height: 2160 } as const;
const VIDEO_EXT = new Set([".mp4", ".mov", ".webm", ".mkv", ".m4v"]);
const LEDGER_NAME = /^scene-production\.v1\.json/;

export type CleanupLocation = "mac" | "share" | "windows";
/** delete-all: كاش كامل. videos: الفيديو والملفات المؤقتة وحدها. out: مثل videos إلا Master والشورتس النهائية في out/package.
 * keep: لا حذف (شورت من العامل لم يُستلم على الماك: قد يكون النسخة الوحيدة). */
export type RootRule = "delete-all" | "videos" | "out" | "keep";
export type CleanupRoot = { location: CleanupLocation; dir: string; rule: RootRule; label: string };
export type FileEntry = { location: CleanupLocation; path: string; bytes: number; what: string };
export type Condition = { n: 1 | 2 | 3; ok: boolean; label: string; detail: string };
export type CleanupContext = {
  channel: string;
  /** مجلد الحلقة: 001-slug */
  episodeFolder: string;
  episodeDir: string;
  projectRoot: string;
  /** المجلد المشترك كما يُرى من هذا الجهاز (null = غير مركّب) */
  share: string | null;
};
export type ApprovedMaster = { fileSha256: string; publishSha256: string | null; at: string };
export type CleanupDeps = {
  /** سجل الاعتماد الموقَّع (قراءة فقط)؛ null إن لم يُعتمد Master */
  approvedMaster: () => Promise<ApprovedMaster | null>;
  sha256File: (file: string) => Promise<string>;
  probe: (file: string) => Promise<VideoProbe>;
  /** الملفات المتتبَّعة في Git تحت مجلد (مسارات مطلقة) */
  gitTracked: (repo: string, dir: string) => Promise<Set<string>>;
};
export type CleanupPlan = {
  ctx: CleanupContext;
  epNum: string;
  conditions: Condition[];
  ok: boolean;
  delete: FileEntry[];
  keep: FileEntry[];
  /** ما رُفض لمسه (رابط رمزي، خروج من الجذر، Git، .env، السجل) */
  refused: { path: string; why: string }[];
  permanentMaster: string | null;
  approvedSha256: string | null;
  /** الجذور التي فُحصت (الحذف يعيد الفحص داخلها وحدها) */
  roots: CleanupRoot[];
};

export const epNumOf = (episodeFolder: string) => episodeFolder.slice(0, 3);
export const permanentMasterPath = (share: string, channel: string, episodeFolder: string) =>
  path.join(share, MASTERS_DIR, channel, episodeFolder, `${epNumOf(episodeFolder)}-episode.mp4`);
export const permanentMasterRel = (channel: string, episodeFolder: string) =>
  `${MASTERS_DIR}/${channel}/${episodeFolder}/${epNumOf(episodeFolder)}-episode.mp4`;

export const isTempName = (name: string) =>
  name.startsWith(".worker-") || /\.(tmp|partial)$/i.test(name) || /\.importing\.mp4$/i.test(name) || name.endsWith(".filter");
export const isVideoName = (name: string) => VIDEO_EXT.has(path.extname(name).toLowerCase());
/** ما لا يُحذف أبدًا بأي قاعدة */
export const neverDelete = (name: string): string | null =>
  /^\.env(\..*)?$/i.test(name) ? ".env لا يُحذف أبدًا" : LEDGER_NAME.test(name) ? "السجل الموقَّع لا يُحذف أبدًا" : null;

/** Master والشورتس النهائية في out/package (أعلى المجلد وحده) */
const finalOutFile = (rel: string[], epNum: string) =>
  rel.length === 2 && rel[0] === "package" && (rel[1] === `${epNum}-episode.mp4` || new RegExp(`^${epNum}-short-\\d+\\.mp4$`).test(rel[1]!));

/** الجذور الوحيدة التي يُحذف فيها لهذه الحلقة (الماك والمجلد المشترك). مجلدات done/ تُضاف بعد قراءة job.json. */
export const deletionRoots = (ctx: CleanupContext, location: "mac" | "windows" = "mac"): CleanupRoot[] => [
  { location, dir: path.join(ctx.episodeDir, "previews"), rule: "videos", label: "مقاطع المشاهد والتجميع (previews)" },
  { location, dir: path.join(ctx.episodeDir, "out"), rule: "out", label: "مخرجات الرندر المؤقتة والنسخ القديمة (out)" },
  { location, dir: path.join(ctx.projectRoot, "renders", ".private-media", "_render", ctx.channel, ctx.episodeFolder), rule: "delete-all", label: "كاش وسائط الرندر" },
];

/** يقبل الملف للحذف إن كان ملفًا عاديًا داخل جذره الحقيقي، لا رابطًا رمزيًا ولا خارجه. يعيد سبب الرفض أو null. */
export const pathEscape = async (root: string, file: string): Promise<string | null> => {
  const rel = path.relative(root, file);
  if (!rel || rel.split(/[\\/]/).includes("..") || path.isAbsolute(rel)) return `خارج الجذر المسموح: ${file}`;
  let realRoot: string;
  try {
    const rs = await lstat(root);
    if (rs.isSymbolicLink() || !rs.isDirectory()) return `الجذر ليس مجلدًا عاديًا: ${root}`;
    realRoot = await realpath(root);
  } catch { return `الجذر غير موجود: ${root}`; }
  // كل جزء في الطريق إلى الملف: لا رابط رمزي
  let cur = root;
  for (const part of rel.split(/[\\/]/)) {
    cur = path.join(cur, part);
    let st;
    try { st = await lstat(cur); } catch { return `غير موجود: ${cur}`; }
    if (st.isSymbolicLink()) return `رابط رمزي لا يُتبع ولا يُحذف: ${cur}`;
  }
  const st = await lstat(file);
  if (!st.isFile()) return `ليس ملفًا عاديًا: ${file}`;
  const realFile = await realpath(file);
  const realRel = path.relative(realRoot, realFile);
  if (!realRel || realRel.split(/[\\/]/).includes("..") || path.isAbsolute(realRel)) return `يخرج من الجذر بعد حل المسار: ${file}`;
  return null;
};

type Walked = { file: string; rel: string[]; bytes: number } | { refused: string; why: string };
/** يمشي في الجذر بلا اتباع روابط رمزية (يرفضها). */
const walk = async (root: string): Promise<Walked[]> => {
  const out: Walked[] = [];
  const st = await lstat(root).catch(() => null);
  if (!st) return out;
  if (st.isSymbolicLink() || !st.isDirectory()) return [{ refused: root, why: "الجذر رابط رمزي أو ليس مجلدًا؛ لا يُمسّ" }];
  const go = async (dir: string, rel: string[]) => {
    for (const name of (await readdir(dir)).sort()) {
      const full = path.join(dir, name);
      const s = await lstat(full);
      if (s.isSymbolicLink()) out.push({ refused: full, why: "رابط رمزي لا يُتبع ولا يُحذف" });
      else if (s.isDirectory()) await go(full, [...rel, name]);
      else if (s.isFile()) out.push({ file: full, rel: [...rel, name], bytes: s.size });
    }
  };
  await go(root, []);
  return out;
};

const describe = (rule: RootRule, rel: string[]): string | null => {
  const name = rel[rel.length - 1]!;
  if (rule === "delete-all") return "كاش";
  if (isTempName(name)) return "ملف رندر مؤقت";
  if (!isVideoName(name)) return null;
  if (rel.includes("superseded")) return "نسخة قديمة";
  if (/review1080/i.test(name)) return "نسخة مراجعة 1080p";
  if (rule === "videos" && rel.length === 1 && /^[a-z0-9-]+\.mp4$/.test(name) && !/^(scene-|episode\.)/.test(name)) return "فيديو";
  if (name === "episode.mp4") return "التجميع";
  if (/^scene-.*\.mp4$/.test(name)) return "مقطع مشهد";
  return "فيديو مؤقت";
};

/** يصنّف ملفات جذر واحد إلى حذف وإبقاء ورفض. */
export const scanRoot = async (root: CleanupRoot, epNum: string, tracked: Set<string>, protectedFiles: Set<string>) => {
  const del: FileEntry[] = [], keep: FileEntry[] = [], refused: { path: string; why: string }[] = [];
  for (const w of await walk(root.dir)) {
    if ("refused" in w) { refused.push({ path: w.refused, why: w.why }); continue; }
    const name = w.rel[w.rel.length - 1]!;
    const entry = { location: root.location, path: w.file, bytes: w.bytes };
    if (root.rule === "out" && finalOutFile(w.rel, epNum)) { keep.push({ ...entry, what: name.includes("-short-") ? "شورت نهائي" : "Master" }); continue; }
    if (root.rule === "keep") { if (isVideoName(name)) keep.push({ ...entry, what: root.label }); continue; }
    const what = describe(root.rule, w.rel);
    if (!what) continue;
    const never = neverDelete(name) ?? (tracked.has(path.resolve(w.file)) ? "متتبَّع في Git" : null) ?? (protectedFiles.has(path.resolve(w.file)) ? "Master المحفوظ" : null);
    if (never) { refused.push({ path: w.file, why: never }); continue; }
    del.push({ ...entry, what: `${what} — ${root.label}` });
  }
  return { del, keep, refused };
};

const readJson = async <T>(file: string): Promise<T | null> => {
  try { return JSON.parse(await readFile(file, "utf8")) as T; } catch { return null; }
};

/** مجلدات done/ لهذه الحلقة (الشورتس والتجارب): job.json يذكر القناة ومجلد الحلقة نفسيهما. */
export const doneRootsFor = async (share: string, channel: string, episodeFolder: string, collected: Set<string> = new Set()): Promise<CleanupRoot[]> => {
  const done = path.join(share, "render-queue", "done");
  if (!existsSync(done)) return [];
  const out: CleanupRoot[] = [];
  for (const d of (await readdir(done)).sort()) {
    if (d.startsWith(".") || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(d)) continue;
    const job = await readJson<{ channel?: unknown; episode?: unknown; kind?: unknown; trial?: unknown }>(path.join(done, d, "job.json"));
    if (!job || job.channel !== channel || job.episode !== episodeFolder) continue;
    const kind = typeof job.kind === "string" ? job.kind : "?";
    // شورت حقيقي من العامل لم يُستلم في حزمة الماك (worker-collected.json) قد يكون نسخته الوحيدة: يبقى
    if (!job.trial && kind === "short" && !collected.has(d)) { out.push({ location: "share", dir: path.join(done, d), rule: "keep", label: "شورت من العامل لم يُستلم على الماك" }); continue; }
    out.push({ location: "share", dir: path.join(done, d), rule: "videos", label: `${job.trial ? "تجربة" : "ناتج العامل"} ${kind} (render-queue/done)` });
  }
  return out;
};

/** الشرط ١: «منشورة» ولها رابط يوتيوب. */
export const publishedCondition = async (episodeDir: string): Promise<Condition> => {
  const label = "الحلقة «منشورة» ولها رابط يوتيوب";
  const status = await readJson<{ published?: { date?: unknown; url?: unknown } }>(path.join(episodeDir, "status.json"));
  const kit = await readJson<{ long?: { episodeUrl?: unknown } }>(path.join(episodeDir, "publish.json"));
  const date = typeof status?.published?.date === "string" && status.published.date.trim() ? status.published.date : null;
  const urls = [status?.published?.url, kit?.long?.episodeUrl].filter((u): u is string => typeof u === "string");
  const url = urls.find((u) => isEpisodeUrl(u)) ?? null;
  if (!date) return { n: 1, ok: false, label, detail: `لا علامة «منشورة» في status.json على هذا الجهاز${url ? ` (الرابط موجود في publish.json: ${url})` : ""}.` };
  if (!url) return { n: 1, ok: false, label, detail: `منشورة في ${date} لكن بلا رابط يوتيوب صالح (published.url أو long.episodeUrl).` };
  return { n: 1, ok: true, label, detail: `منشورة في ${date}: ${url}` };
};

/** السلامة: الفحص نفسه في worker-collect (الترميز والأبعاد والصوت والمدة والأثر) بأبعاد Master. */
export const masterSoundness = (probe: VideoProbe): string[] => {
  const out: string[] = [];
  if (probe.videoCodec !== "h264") out.push(`ترميز الصورة ${probe.videoCodec ?? "مفقود"} لا h264.`);
  if (probe.width !== MASTER_SIZE.width || probe.height !== MASTER_SIZE.height) out.push(`الأبعاد ${probe.width}×${probe.height} لا ${MASTER_SIZE.width}×${MASTER_SIZE.height}.`);
  if (probe.audioCodec !== "aac") out.push(`الصوت ${probe.audioCodec ?? "مفقود"} لا AAC.`);
  if (!(probe.durationSec > 0)) out.push("مدة الفيديو صفر أو غير مقروءة.");
  const traces = probe.tags.flatMap((t) => findTraces(t).map((x) => `${x} (${t})`));
  if (traces.length) out.push(`أثر لأدوات الإنتاج في البيانات الوصفية: ${traces.join("، ")}`);
  return out;
};

/** يبني الخطة كاملة (الشروط وما يُحذف وما يبقى) ولا يحذف شيئًا. */
export const planCleanup = async (ctx: CleanupContext, deps: CleanupDeps): Promise<CleanupPlan> => {
  const epNum = epNumOf(ctx.episodeFolder);
  const shaCache = new Map<string, Promise<string>>();
  const sha = (f: string) => { if (!shaCache.has(f)) shaCache.set(f, deps.sha256File(f)); return shaCache.get(f)!; };

  const c1 = await publishedCondition(ctx.episodeDir);

  // الشرط ٢: سجل الاعتماد وإذن النشر
  let approved: ApprovedMaster | null = null;
  let recordProblem: string | null = null;
  try { approved = await deps.approvedMaster(); }
  catch (e) { recordProblem = `تعذّرت قراءة سجل الاعتماد الموقَّع: ${(e as Error).message}`; }
  if (!recordProblem && !approved) recordProblem = "لا سجل اعتماد لـ Master في سجل «إنتاج المشاهد» على هذا الجهاز.";
  if (approved && !/^[a-f0-9]{64}$/.test(approved.fileSha256)) recordProblem = "بصمة Master في السجل غير صالحة.";
  if (approved && !recordProblem && approved.publishSha256 !== approved.fileSha256) recordProblem = "لا إذن نشر لبايتات Master المعتمدة نفسها في السجل.";

  // الشرط ٣: المكان الدائم
  const perm = ctx.share ? permanentMasterPath(ctx.share, ctx.channel, ctx.episodeFolder) : null;
  let c3: Condition;
  const label3 = "Master في مكانه الدائم على ويندوز (masters/ في المجلد المشترك)";
  let permSha: string | null = null;
  if (!ctx.share || !existsSync(ctx.share)) c3 = { n: 3, ok: false, label: label3, detail: `المجلد المشترك غير مركّب${ctx.share ? `: ${ctx.share}` : ""}.` };
  else if (!existsSync(perm!)) c3 = { n: 3, ok: false, label: label3, detail: `لا Master في المكان الدائم: ${perm}` };
  else {
    const escape = await pathEscape(path.join(ctx.share, MASTERS_DIR), perm!);
    if (escape) c3 = { n: 3, ok: false, label: label3, detail: escape };
    else {
      permSha = await sha(perm!);
      c3 = approved && permSha === approved.fileSha256
        ? { n: 3, ok: true, label: label3, detail: `${perm} (sha256 ${permSha.slice(0, 12)}…)` }
        : { n: 3, ok: false, label: label3, detail: `الملف في المكان الدائم بصمته ${permSha.slice(0, 12)}…${approved ? ` لا تطابق المعتمدة ${approved.fileSha256.slice(0, 12)}…` : " ولا سجل اعتماد يُقارن به"}.` };
    }
  }

  const label2 = "بصمة Master تطابق سجل الاعتماد، والملف سليم";
  let c2: Condition;
  if (recordProblem) c2 = { n: 2, ok: false, label: label2, detail: recordProblem };
  else if (!permSha) c2 = { n: 2, ok: false, label: label2, detail: `السجل يعتمد ${approved!.fileSha256.slice(0, 12)}… لكن لا نسخة دائمة يُتحقق منها (الشرط ٣).` };
  else if (permSha !== approved!.fileSha256) c2 = { n: 2, ok: false, label: label2, detail: `بصمة النسخة الدائمة ${permSha.slice(0, 12)}… لا تطابق السجل ${approved!.fileSha256.slice(0, 12)}….` };
  else {
    let problems: string[];
    try { problems = masterSoundness(await deps.probe(perm!)); }
    catch (e) { problems = [`تعذّر فحص الملف: ${(e as Error).message}`]; }
    c2 = problems.length ? { n: 2, ok: false, label: label2, detail: problems.join(" ") }
      : { n: 2, ok: true, label: label2, detail: `sha256 ${permSha.slice(0, 12)}… = السجل (اعتماد ${approved!.at})، h264 3840×2160 وAAC بلا أثر.` };
  }

  // الملفات
  const protectedFiles = new Set<string>([path.resolve(path.join(ctx.episodeDir, "out", "package", `${epNum}-episode.mp4`))]);
  if (perm) protectedFiles.add(path.resolve(perm));
  const tracked = await deps.gitTracked(ctx.projectRoot, ctx.episodeDir).catch(() => null);
  const roots: CleanupRoot[] = [...deletionRoots(ctx)];
  if (ctx.share && existsSync(ctx.share)) {
    const rec = await readJson<Record<string, { file?: string }>>(path.join(ctx.episodeDir, "out", "package", "worker-collected.json")) ?? {};
    const collected = new Set(Object.entries(rec).filter(([, r]) => typeof r?.file === "string" && existsSync(r.file)).map(([id]) => id));
    roots.push(...await doneRootsFor(ctx.share, ctx.channel, ctx.episodeFolder, collected));
    roots.push({ location: "share", dir: path.join(ctx.share, "render-queue", "media", ctx.channel, ctx.episodeFolder), rule: "delete-all", label: "كاش لقطات الوسائط (render-queue/media)" });
  }
  const del: FileEntry[] = [], keep: FileEntry[] = [], refused: { path: string; why: string }[] = [];
  if (!tracked) refused.push({ path: ctx.episodeDir, why: "تعذّر سؤال Git عن الملفات المتتبَّعة؛ لا حذف على الماك." });
  for (const root of roots) {
    if (root.location === "mac" && !tracked) continue;
    const r = await scanRoot(root, epNum, tracked ?? new Set(), protectedFiles);
    del.push(...r.del); keep.push(...r.keep); refused.push(...r.refused);
  }
  // ما يبقى أيضًا: المكان الدائم كله، والصوت، وملفات التوقيت
  if (ctx.share) {
    const dir = path.join(ctx.share, MASTERS_DIR, ctx.channel, ctx.episodeFolder);
    for (const w of await walk(dir)) if (!("refused" in w)) keep.push({ location: "share", path: w.file, bytes: w.bytes, what: w.rel.at(-1) === `${epNum}-episode.mp4` ? "Master الدائم" : "نسخة دائمة" });
  }
  for (const w of await walk(path.join(ctx.episodeDir, "voice"))) if (!("refused" in w)) keep.push({ location: "mac", path: w.file, bytes: w.bytes, what: "صوت الراوي" });

  const conditions = [c1, c2, c3];
  return { ctx, epNum, conditions, ok: conditions.every((c) => c.ok), delete: del, keep, refused, permanentMaster: perm, approvedSha256: approved?.fileSha256 ?? null, roots };
};

/** يحذف ما في الخطة وحدها، بعد إعادة فحص كل ملف (الجذر والرابط الرمزي والخروج). لا شيء إن نقص شرط. */
export const executeCleanup = async (plan: CleanupPlan, roots: CleanupRoot[] = plan.roots): Promise<{ freed: number; deleted: string[]; skipped: { path: string; why: string }[] }> => {
  if (!plan.ok) throw new Error(`لا حذف: ${plan.conditions.filter((c) => !c.ok).map((c) => `الشرط ${c.n} (${c.label}): ${c.detail}`).join(" | ")}`);
  let freed = 0;
  const deleted: string[] = [], skipped: { path: string; why: string }[] = [];
  for (const f of plan.delete) {
    const root = roots.find((r) => { const rel = path.relative(r.dir, f.path); return rel && !rel.startsWith("..") && !path.isAbsolute(rel); });
    const why = !root ? "ليس داخل جذر مسموح" : neverDelete(path.basename(f.path)) ?? await pathEscape(root.dir, f.path);
    if (why) { skipped.push({ path: f.path, why }); continue; }
    const st = await lstat(f.path);
    await rm(f.path, { force: false });
    freed += st.size;
    deleted.push(f.path);
  }
  return { freed, deleted, skipped };
};

export const formatBytes = (n: number) =>
  n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2)} GB` : n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} MB` : n >= 1024 ? `${(n / 1024).toFixed(0)} KB` : `${n} B`;

/** السطر الواحد بعد التنظيف: الحلقة، والمساحة المحررة، وما بقي. */
export const summaryLine = (plan: CleanupPlan, freed: number, windowsQueued: boolean, skipped = 0) => {
  const shorts = new Set(plan.keep.filter((k) => /-short-\d+\.mp4$/.test(k.path)).map((k) => path.basename(k.path))).size;
  const voice = plan.keep.filter((k) => k.what === "صوت الراوي").length;
  return `${plan.ctx.channel} ${plan.ctx.episodeFolder}: حُرّر ${formatBytes(freed)}؛ بقي Master (${plan.approvedSha256?.slice(0, 12)}…) في ${plan.permanentMaster}، و${shorts} شورت نهائي، وصوت الراوي (${voice} ملف)، وكل ما في Git${windowsQueued ? "، وتنظيف ويندوز في الطابور" : ""}${skipped ? `، ولم يُحذف ${skipped} ملف تغيّر بعد الفحص` : ""}.`;
};

/* ── على الماك: السياق والاعتماديات الحقيقية ── */

/** السجل الموقَّع قراءةً فقط (readLedger يتحقق من التوقيع ولا يحفظ؛ لا withState لأنه قد يكتب المصالحة). */
const ledgerApprovedMaster = async (ep: string): Promise<ApprovedMaster | null> => {
  const { resolveScriptPath } = await import("../script/episodes");
  const { readLedger, stateFileFor } = await import("../studio/sceneLedgerStore");
  const file = stateFileFor(await resolveScriptPath(ep));
  if (!existsSync(file)) return null;
  const { sourceNow } = await import("../studio/sceneInputs");
  const doc = await readLedger(file, await sourceNow(ep));
  const m = doc.state.master;
  return m ? { fileSha256: m.fileSha256, publishSha256: m.publish?.fileSha256 ?? null, at: m.at } : null;
};

export const macCleanupContext = async (ep: string, share: string | null): Promise<CleanupContext> => {
  const { resolveScriptPath } = await import("../script/episodes");
  const { currentChannelId } = await import("../channel");
  const { projectRoot } = await import("../config/paths");
  const episodeDir = path.dirname(await resolveScriptPath(ep));
  return { channel: currentChannelId(), episodeFolder: path.basename(episodeDir), episodeDir, projectRoot, share };
};

/** ثابت الاستيراد: العامل يستدعيه من دورته بعد checkout (لا import متأخر في loop.ts). */
export const gitTrackedUnder = async (repo: string, dir: string): Promise<Set<string>> => {
  const r = await git(repo, ["ls-files", "-z", "--full-name", "--", path.relative(repo, dir) || "."]);
  if (r.code !== 0) throw new Error(`git ls-files: ${r.err}`);
  return new Set(r.out.split("\0").filter(Boolean).map((f) => path.resolve(repo, f)));
};

export const macCleanupDeps = async (ep: string): Promise<CleanupDeps> => {
  const { sha256File } = await import("./worker/protocol");
  const { probeVideo } = await import("./worker/probe");
  return { approvedMaster: () => ledgerApprovedMaster(ep), sha256File, probe: probeVideo, gitTracked: gitTrackedUnder };
};

/** تقرير العرض (بلا حذف): الشروط، ثم ما يُحذف وما يبقى بالأحجام لكل مكان. */
export const formatPlan = (plan: CleanupPlan): string => {
  const lines: string[] = [`التنظيف بعد النشر (D240) — ${plan.ctx.channel} ${plan.ctx.episodeFolder}`, ""];
  for (const c of plan.conditions) lines.push(`${c.ok ? "✓" : "✗"} الشرط ${c.n}: ${c.label} — ${c.detail}`);
  lines.push("", plan.ok ? "الشروط كلها متحققة." : "لا حذف: شرط ناقص على الأقل.");
  const sum = (xs: FileEntry[]) => xs.reduce((a, x) => a + x.bytes, 0);
  const grouped = (xs: FileEntry[]) => {
    const g = new Map<string, FileEntry[]>();
    for (const x of xs) g.set(x.what, [...(g.get(x.what) ?? []), x]);
    return [...g];
  };
  for (const loc of ["mac", "share"] as const) {
    const d = plan.delete.filter((x) => x.location === loc), k = plan.keep.filter((x) => x.location === loc);
    lines.push("", `── ${loc === "mac" ? "الماك" : "المجلد المشترك"}: يُحذف ${d.length} ملف (${formatBytes(sum(d))})، ويبقى ${k.length} (${formatBytes(sum(k))})`);
    for (const [what, xs] of grouped(d)) lines.push(`  - ${what}: ${xs.length} ملف، ${formatBytes(sum(xs))}`);
    for (const [what, xs] of grouped(k)) lines.push(`  + يبقى ${what}: ${xs.length} ملف، ${formatBytes(sum(xs))}${xs.length <= 3 ? ` (${xs.map((x) => path.basename(x.path)).join("، ")})` : ""}`);
  }
  lines.push("", "── ويندوز (نسخة العامل المحلية): مهمة في render-queue/cleanup/ بعد الحذف على الماك؛ يتحقق العامل فيها من Master الدائم بنفسه.",
    "يبقى دائمًا أيضًا: كل ما في Git، وملفات التوقيت (result.json وjob.json في done/)، وكل ملفات json الصغيرة.");
  if (plan.refused.length) {
    lines.push("", `لا يُمسّ (${plan.refused.length}):`);
    for (const r of plan.refused.slice(0, 20)) lines.push(`  ! ${r.path}: ${r.why}`);
  }
  return lines.join("\n");
};
