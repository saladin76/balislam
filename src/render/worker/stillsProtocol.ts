/**
 * D247: مهمة «stills» على جهاز الرندر — صور ستوري بورد D228 الثابتة (PNG) تُرندر على الويندوز، والماك لا يرندر (D232).
 *
 * - الإصدار 3 من المهمة، بغلاف الإصدار 2 نفسه (validateEnvelope)، فيأخذها العامل الجاري بلا إعادة تشغيل: يجلب commit
 *   المهمة ويشغّل `bal worker-render` بكوده، وهذا الكود يفحصها كاملة (validateStillsJob) ويرندرها (untrustedRender.ts).
 * - لا تكوين إلا من «مجموعة ستوري بورد» مسجَّلة في الكود (STORYBOARD_SETS) وبمعرّف يبدأ بـ«storyboard-»: لا يصل هذا
 *   الطريق إلى تكوين الحلقة ولا إلى أي قالب إنتاج، ولا يقرأ خطة ولا وسائط ولا صوتًا.
 * - الناتج في done/<id>/: الصور بأسمائها اللاتينية و`result.json` (بصمة كل صورة وأبعادها) و`job.json`.
 * - الاستلام على الماك يتحقق من كل صورة (البصمة، وتوقيع PNG، والأبعاد)، ويحذف أي نص مضمَّن فيها (tEXt/zTXt/iTXt/eXIf)،
 *   ثم يكتبها بأسمائها العربية في مجلد الستوري بورد مع storyboard.json الذي يقرؤه «بانتظارك». لا تُنشر ولا تعتمد شيئًا.
 */
import path from "node:path";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { DESK_BOARDS, boardFileName, boardVariantName } from "../../remotion/zubdat/desk/boards";
import { git, headCommit } from "./git";
import { ensureQueue, queuePaths, sha256File, tail, validateEnvelope, workerName, writeJsonAtomic, type WorkerChannel } from "./protocol";

export type StoryboardSet = {
  channel: WorkerChannel;
  episode: string;
  /** مجلد الستوري بورد تحت ~/Desktop/للمراجعة/ستوري-بورد/ */
  folder: string;
  width: number;
  height: number;
  boards: { composition: string; file: string; arabicFile: string; scene: number; variant: string; title: string; motion: string; why: string }[];
};

/** مجموعات الستوري بورد المسموح رندرها بهذا الطريق (القائمة المسموحة في كود commit المهمة نفسه) */
export const STORYBOARD_SETS: Record<string, StoryboardSet> = {
  "zubdat-desk": {
    channel: "zubdat-alkutub",
    episode: "001-awwal-marra-osalli",
    folder: "زبدة-مكتب-القارئ",
    width: 1920,
    height: 1080,
    boards: DESK_BOARDS.map((b) => ({
      composition: b.composition, file: `${b.composition.replace(/^storyboard-/, "")}.png`, arabicFile: boardFileName(b),
      scene: b.scene, variant: boardVariantName(b), title: b.title, motion: b.motion, why: b.why,
    })),
  },
};

export type StillsJob = {
  version: 3;
  id: string;
  channel: WorkerChannel;
  episode: string;
  kind: "stills";
  purpose: "storyboard";
  set: string;
  commit: string;
  stills: { composition: string; file: string }[];
  width: number;
  height: number;
  createdAt: string;
  claimedBy?: string;
  claimedAt?: string;
};
export type StillsResult = {
  id: string; commit: string; worker: string; startedAt: string; finishedAt: string; logTail: string;
  files: { file: string; composition: string; sha256: string; bytes: number; width: number; height: number }[];
};

class StillsJobError extends Error {}
const fail = (m: string): never => { throw new StillsJobError(`مهمة صور الستوري بورد غير صالحة: ${m}`); };
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const KNOWN = ["version", "id", "channel", "episode", "kind", "purpose", "set", "commit", "stills", "width", "height", "createdAt", "claimedBy", "claimedAt"];
const COMPOSITION = /^storyboard-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.png$/;
export const STILLS_MAX = 40;

/** الفحص الكامل (على العامل بكود commit المهمة، وعلى الماك قبل الكتابة وعند الاستلام) */
export const validateStillsJob = (raw: unknown): StillsJob => {
  validateEnvelope(raw);
  const r = raw as Record<string, unknown>;
  for (const k of Object.keys(r)) if (!KNOWN.includes(k)) fail(`حقل غير معروف: ${k}`);
  if (r.version !== 3 || r.kind !== "stills" || r.purpose !== "storyboard") fail("الإصدار 3 ونوع stills وغرض storyboard وحدها.");
  if (!String(r.id).startsWith("stills-")) fail("معرّف المهمة يبدأ بـstills-.");
  const set = typeof r.set === "string" ? STORYBOARD_SETS[r.set] : undefined;
  if (!set) return fail(`مجموعة ستوري بورد غير مسجَّلة: ${String(r.set)}`);
  if (r.channel !== set.channel || r.episode !== set.episode) fail("القناة أو الحلقة لا تطابق مجموعة الستوري بورد.");
  if (r.width !== set.width || r.height !== set.height) fail(`أبعاد المجموعة ${set.width}×${set.height}.`);
  if (!Array.isArray(r.stills) || !r.stills.length || r.stills.length > STILLS_MAX) fail(`الصور من ١ إلى ${STILLS_MAX}.`);
  const allowed = new Map(set.boards.map((b) => [b.composition, b.file]));
  const files = new Set<string>();
  for (const x of r.stills as unknown[]) {
    if (!isObj(x) || Object.keys(x).sort().join(",") !== "composition,file") fail("صورة: composition وfile وحدهما.");
    const s = x as { composition: unknown; file: unknown };
    if (typeof s.composition !== "string" || !COMPOSITION.test(s.composition)) fail(`تكوين غير صالح: ${String(s.composition)}`);
    if (allowed.get(s.composition as string) !== s.file) fail(`التكوين ${String(s.composition)} ليس من المجموعة أو اسم ملفه مختلف.`);
    if (typeof s.file !== "string" || !FILE.test(s.file) || files.has(s.file)) fail(`اسم ملف غير صالح أو مكرر: ${String(s.file)}`);
    files.add(s.file as string);
  }
  for (const k of ["claimedBy", "claimedAt"] as const) if (r[k] !== undefined && typeof r[k] !== "string") fail(`${k} غير صالح.`);
  return raw as StillsJob;
};
export const isStillsJob = (raw: unknown): boolean => isObj(raw) && raw.version === 3 && raw.kind === "stills";

/** المهمة لمجموعة كاملة بالـcommit المعطى (المعرّف من المجموعة والـcommit) */
export const buildStillsJob = (setId: string, commit: string, now = new Date()): StillsJob => {
  const set = STORYBOARD_SETS[setId];
  if (!set) throw new Error(`مجموعة ستوري بورد غير مسجَّلة: ${setId}. المسجَّل: ${Object.keys(STORYBOARD_SETS).join("، ")}`);
  const stills = set.boards.map((b) => ({ composition: b.composition, file: b.file }));
  const h = createHash("sha256").update(JSON.stringify(stills)).digest("hex").slice(0, 8);
  return validateStillsJob({
    version: 3, id: `stills-${setId}-${commit.slice(0, 8)}-${h}`, channel: set.channel, episode: set.episode, kind: "stills", purpose: "storyboard",
    set: setId, commit, stills, width: set.width, height: set.height, createdAt: now.toISOString(),
  });
};

/** يكتب المهمة في jobs/ (مرة واحدة: المرسلة أو الجارية أو المنتهية لا تُكتب ثانية؛ الفاشلة تُعاد) */
export const writeStillsJob = async (share: string, job: StillsJob) => {
  validateStillsJob(job);
  const p = await ensureQueue(share);
  for (const where of [path.join(p.jobs, `${job.id}.json`), path.join(p.running, `${job.id}.json`), path.join(p.done, job.id)])
    if (existsSync(where)) return { id: job.id, already: true };
  await rm(path.join(p.failed, job.id), { recursive: true, force: true });
  await writeJsonAtomic(path.join(p.jobs, `${job.id}.json`), job);
  return { id: job.id, already: false };
};

/** الماك: الكود كما في آخر commit، والـcommit على GitHub (العامل يجلبه من هناك ويرندر به حرفيًا) */
export const assertStillsCommit = async (repo: string): Promise<string> => {
  const st = await git(repo, ["status", "--porcelain", "--untracked-files=no", "--", "src", "public", "bin", "brand", "config.json", "package.json", "package-lock.json", "tsconfig.json"]);
  if (st.code !== 0) throw new Error(`git status: ${st.err}`);
  if (st.out) throw new Error(`الكود يختلف عن آخر commit، والعامل يرندر الـcommit حرفيًا. احفظه أولًا:\n${st.out.slice(0, 600)}`);
  const head = await headCommit(repo);
  const remote = await git(repo, ["branch", "-r", "--contains", head]);
  if (remote.code !== 0 || !remote.out.trim()) throw new Error(`الـcommit ${head.slice(0, 8)} غير موجود على GitHub بعد؛ العامل يجلبه من هناك.`);
  return head;
};

/* ── PNG ── */

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** أبعاد PNG من رأسه (IHDR)، أو null إن لم يكن PNG */
export const pngSize = (buf: Buffer): { width: number; height: number } | null => {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIG) || buf.toString("latin1", 12, 16) !== "IHDR") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
};
/** يحذف كل قطعة نص أو بيانات وصفية (tEXt وzTXt وiTXt وeXIf وtIME) ويبقي الصورة كما هي بايتًا ببايت */
export const stripPngText = (buf: Buffer): Buffer => {
  if (!pngSize(buf)) throw new Error("ليست صورة PNG.");
  const out: Buffer[] = [PNG_SIG];
  for (let o = 8; o < buf.length; ) {
    if (o + 12 > buf.length) throw new Error("PNG مقطوع.");
    const len = buf.readUInt32BE(o);
    const type = buf.toString("latin1", o + 4, o + 8);
    const end = o + 12 + len;
    if (end > buf.length) throw new Error("PNG مقطوع.");
    if (!["tEXt", "zTXt", "iTXt", "eXIf", "tIME"].includes(type)) out.push(buf.subarray(o, end));
    o = end;
    if (type === "IEND") break;
  }
  return Buffer.concat(out);
};

/* ── العامل: النجاح ── */

/** done/.<id>.partial ثم نقل ذري إلى done/<id>/ (الماك لا يرى نتيجة ناقصة)؛ البصمة من النسخة في المجلد المشترك */
export const completeStillsJob = async (share: string, job: StillsJob, rendered: { file: string; composition: string; path: string }[], meta: Omit<StillsResult, "files" | "id">) => {
  const p = await ensureQueue(share);
  const partial = path.join(p.done, `.${job.id}.partial`);
  const dir = path.join(p.done, job.id);
  if (existsSync(dir)) throw new Error(`نتيجة سابقة موجودة: ${job.id}`);
  await rm(partial, { recursive: true, force: true });
  await mkdir(partial, { recursive: true });
  const files: StillsResult["files"] = [];
  for (const r of rendered) {
    if (!FILE.test(r.file)) throw new Error(`اسم ملف غير آمن: ${r.file}`);
    const target = path.join(partial, r.file);
    await copyFile(r.path, target);
    const buf = await readFile(target);
    const size = pngSize(buf);
    if (!size) throw new Error(`${r.file} ليست PNG.`);
    files.push({ file: r.file, composition: r.composition, sha256: await sha256File(target), bytes: buf.length, ...size });
  }
  const result: StillsResult = { id: job.id, ...meta, logTail: tail(meta.logTail), files };
  await writeFile(path.join(partial, "result.json"), JSON.stringify(result, null, 2) + "\n");
  await rename(path.join(p.running, `${job.id}.json`), path.join(partial, "job.json"));
  await rename(partial, dir);
  await rm(path.join(p.running, `${job.id}.progress.json`), { force: true });
  return { dir, result };
};
export const stillsWorker = () => workerName();

/* ── الماك: الاستلام ── */

/** أحدث نتيجة منتهية لمجموعة (بالـcommit إن حُدد) */
export const findStillsDone = async (share: string, setId: string, commit?: string): Promise<string | null> => {
  const done = queuePaths(share).done;
  if (!existsSync(done)) return null;
  const prefix = `stills-${setId}-${commit ? commit.slice(0, 8) + "-" : ""}`;
  const rows: { id: string; at: string }[] = [];
  for (const id of await readdir(done)) {
    if (!id.startsWith(prefix)) continue;
    try { rows.push({ id, at: (JSON.parse(await readFile(path.join(done, id, "result.json"), "utf8")) as StillsResult).finishedAt }); } catch { /* ناقصة */ }
  }
  rows.sort((a, b) => b.at.localeCompare(a.at));
  return rows[0]?.id ?? null;
};

/**
 * يتحقق من نتيجة المهمة ويكتب الصور بأسمائها العربية في مجلد الستوري بورد مع storyboard.json.
 * المرفوض لا يُكتب منه شيء. اقرأني.md لا يُلمس (يكتبه المنفّذ).
 */
export const collectStills = async (share: string, id: string, outDir: string, o: { log?: (m: string) => void } = {}) => {
  const log = o.log ?? (() => {});
  const dir = path.join(queuePaths(share).done, id);
  if (!/^stills-[a-z0-9-]+$/.test(id) || !existsSync(dir)) throw new Error(`لا نتيجة في done/${id}.`);
  const job = validateStillsJob(JSON.parse(await readFile(path.join(dir, "job.json"), "utf8")));
  const set = STORYBOARD_SETS[job.set]!;
  const result = JSON.parse(await readFile(path.join(dir, "result.json"), "utf8")) as StillsResult;
  if (result.id !== job.id || result.commit !== job.commit) throw new Error("النتيجة لا تطابق المهمة (المعرّف أو الـcommit).");
  const byFile = new Map(result.files.map((f) => [f.file, f]));
  const ready: { arabic: string; data: Buffer }[] = [];
  for (const s of job.stills) {
    const meta = byFile.get(s.file);
    if (!meta) throw new Error(`صورة ناقصة في النتيجة: ${s.file}`);
    const buf = await readFile(path.join(dir, s.file));
    if (createHash("sha256").update(buf).digest("hex") !== meta.sha256) throw new Error(`بصمة ${s.file} لا تطابق النتيجة.`);
    const size = pngSize(buf);
    if (!size || size.width !== job.width || size.height !== job.height) throw new Error(`${s.file}: ليست PNG بأبعاد ${job.width}×${job.height}.`);
    const board = set.boards.find((b) => b.composition === s.composition)!;
    ready.push({ arabic: board.arabicFile, data: stripPngText(buf) });
  }
  await mkdir(outDir, { recursive: true });
  for (const r of ready) {
    const tmp = path.join(outDir, `.${r.arabic}.part`);
    await writeFile(tmp, r.data);
    await rename(tmp, path.join(outDir, r.arabic));
  }
  const manifest = set.boards.filter((b) => job.stills.some((s) => s.composition === b.composition))
    .map((b) => ({ scene: b.scene, variant: b.variant, file: b.arabicFile, title: b.title, motion: b.motion, why: b.why }));
  await writeFile(path.join(outDir, "storyboard.json"), JSON.stringify(manifest, null, 1) + "\n");
  log(`استُلمت ${ready.length} صورة من ${result.worker} (@ ${job.commit.slice(0, 8)}) إلى ${outDir}`);
  return { written: ready.length, outDir, commit: job.commit };
};
