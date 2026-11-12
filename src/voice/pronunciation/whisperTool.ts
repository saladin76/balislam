import path from "node:path";
import os from "node:os";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, statfs } from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import { writeJsonAtomic } from "../../io/atomicJson";

/**
 * فحص النطق (العمل ٩): أداة محلية اختيارية على جهاز المالك.
 *   - مكانها خارج المستودع: `~/.balislam-tools/pronunciation-check/` (BAL_PRON_CHECK_DIR يغيّره): بيئة Python معزولة
 *     (venv) فيها faster-whisper بإصدار مثبّت، والنموذج المثبّت، وملف الحالة (مفعّل؟ وآخر قياس للإنذار الكاذب).
 *   - لا تُثبَّت آليًا أبدًا: زر «ثبّت فحص النطق» وحده يبدأ التثبيت، بعد عرض الحجم والمساحة الحرة.
 *   - التثبيت وحده يتصل بالشبكة (حزم Python والنموذج). التفريغ بلا شبكة (HF_HUB_OFFLINE)، والصوت لا يغادر الجهاز.
 *   - مطفأ افتراضيًا: لا يُفعَّل حتى يُقاس معدل الإنذار الكاذب ويقبله المالك.
 */

export const FASTER_WHISPER_VERSION = "1.1.1";
/** whisper «small»: multilingual, Arabic-capable, the smallest that hears Arabic well enough on a laptop CPU. */
export const MODEL = "small";
/** A Hugging Face revision (commit) of Systran/faster-whisper-small to pin; empty = the repository's main at install time (installed.json says which was asked for). */
export const MODEL_REVISION = "";
export const SIZES = { packagesMb: 260, modelMb: 484 };
export const REQUIRED_FREE_MB = Math.round((SIZES.packagesMb + SIZES.modelMb) * 1.5);

export const toolDir = (env: NodeJS.ProcessEnv = process.env) =>
  env.BAL_PRON_CHECK_DIR?.trim() || path.join(os.homedir(), ".balislam-tools", "pronunciation-check");
const venvPython = (dir: string) => process.platform === "win32" ? path.join(dir, "venv", "Scripts", "python.exe") : path.join(dir, "venv", "bin", "python");
const modelDir = (dir: string) => path.join(dir, "models", MODEL);
const markerFile = (dir: string) => path.join(dir, "installed.json");
const stateFile = (dir: string) => path.join(dir, "state.json");
export const workerScript = () => path.resolve(import.meta.dirname, "..", "..", "..", "tools", "pronunciation-check", "whisper_worker.py");

export type Measurement = {
  at: string; model: string;
  /** narration sentences transcribed */
  sentences: number;
  /** of them, flagged (at least one suspect word) */
  flagged: number;
  /** sentences the owner had marked «سمعتها» — presumed right, so a flag on one is a false alarm */
  heard: number; heardFlagged: number;
  /** the false-alarm rate shown to the owner: on «سمعتها» sentences when there are ≥10, else on all (an upper bound) */
  rate: number; basis: "heard" | "all";
  words: number; flaggedWords: number;
  channels: Record<string, { sentences: number; flagged: number; heard: number; heardFlagged: number }>;
  examples: { channel: string; episode: string; sentenceId: string; word: string; heard: string | null }[];
  failed: number;
};
export type ToolState = { enabled: boolean; enabledAt?: string; acceptedRate?: number; measurement?: Measurement };

export const readState = async (dir = toolDir()): Promise<ToolState> => {
  try { return { enabled: false, ...(JSON.parse(await readFile(stateFile(dir), "utf8")) as Partial<ToolState>) }; }
  catch { return { enabled: false }; }
};
export const writeState = async (s: ToolState, dir = toolDir()) => {
  await mkdir(dir, { recursive: true });
  await writeJsonAtomic(stateFile(dir), s);
};

export type Installed = { installed: true; python: string; model: string; version: string; at: string } | { installed: false };

export const detectInstalled = async (dir = toolDir()): Promise<Installed> => {
  try {
    const m = JSON.parse(await readFile(markerFile(dir), "utf8")) as { version: string; model: string; at: string };
    const py = venvPython(dir);
    if (!existsSync(py) || !existsSync(path.join(modelDir(dir), "model.bin"))) return { installed: false };
    return { installed: true, python: py, model: modelDir(dir), version: m.version, at: m.at };
  } catch { return { installed: false }; }
};

/**
 * A system Python ≥ 3.9 to make the venv with — found without side effects: on macOS /usr/bin/python3 is a stub
 * that opens the «install developer tools» dialog when the tools are missing, so it is only run when they are present.
 */
export const findSystemPython = (env: NodeJS.ProcessEnv = process.env): { path: string; version: string } | null => {
  // BAL_PYTHON names the one interpreter to use (and nothing else is tried)
  const candidates = env.BAL_PYTHON?.trim() ? [env.BAL_PYTHON.trim()] : ["/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/usr/bin/python3", "python3", "python"];
  for (const c of [...new Set(candidates)]) {
    if (c.startsWith("/") && !existsSync(c)) continue;
    if (process.platform === "darwin" && c === "/usr/bin/python3") {
      try { execFileSync("/usr/bin/xcode-select", ["-p"], { stdio: "ignore", timeout: 5000 }); } catch { continue; }
    }
    try {
      const out = execFileSync(c, ["-c", "import sys;print('%d.%d.%d'%sys.version_info[:3])"], { encoding: "utf8", timeout: 10000, stdio: ["ignore", "pipe", "ignore"] }).trim();
      const [maj, min] = out.split(".").map(Number);
      if (maj === 3 && (min ?? 0) >= 9) return { path: c, version: out };
    } catch { /* next */ }
  }
  return null;
};

export const freeMb = async (dir = toolDir()): Promise<number | null> => {
  let p = dir;
  while (!existsSync(p) && path.dirname(p) !== p) p = path.dirname(p);
  try { const s = await statfs(p); return Math.floor((s.bavail * s.bsize) / 1024 / 1024); } catch { return null; }
};

const dirMb = async (d: string): Promise<number> => {
  let total = 0;
  const walk = async (p: string) => {
    for (const e of await readdir(p, { withFileTypes: true }).catch(() => [])) {
      const f = path.join(p, e.name);
      if (e.isDirectory()) await walk(f); else total += (await stat(f).catch(() => ({ size: 0 }))).size;
    }
  };
  await walk(d);
  return Math.round(total / 1024 / 1024);
};

// ── install (one job at a time, started only by the owner's button) ─────────────────────────────────────────────
export type InstallJob = {
  status: "running" | "done" | "error"; step: "venv" | "packages" | "model" | "done";
  pct: number; label: string; startedAt: string; finishedAt?: string; error?: string;
};
let installJob: InstallJob | null = null;
export const currentInstall = () => installJob;

const run = (cmd: string, args: string[], env: NodeJS.ProcessEnv, onLine?: (l: string) => void) =>
  new Promise<void>((resolve, reject) => {
    const p = spawn(cmd, args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let tail = "";
    const eat = (b: Buffer) => { const t = b.toString(); tail = (tail + t).slice(-2000); t.split("\n").forEach((l) => l.trim() && onLine?.(l.trim())); };
    p.stdout.on("data", eat); p.stderr.on("data", eat);
    p.on("error", reject);
    p.on("close", (code) => code === 0 ? resolve() : reject(new Error(tail.trim().split("\n").slice(-3).join(" ") || `exit ${code}`)));
  });

export class InstallRefusal extends Error { constructor(message: string, readonly code: string) { super(message); } }

/** Starts the install in the background and returns at once; refusals (no Python, no space) throw before it starts. */
export const startInstall = async (o: { dir?: string; env?: NodeJS.ProcessEnv } = {}): Promise<InstallJob> => {
  const dir = o.dir ?? toolDir(o.env);
  if (installJob?.status === "running") return installJob;
  if ((await detectInstalled(dir)).installed) throw new InstallRefusal("فحص النطق مثبّت على هذا الجهاز.", "ALREADY_INSTALLED");
  const py = findSystemPython(o.env ?? process.env);
  if (!py) throw new InstallRefusal("لا يوجد Python 3.9 أو أحدث على هذا الجهاز، وفحص النطق يحتاجه. على ماك يأتي مع «أدوات المطوّر» (Command Line Tools) التي يحتاجها الاستوديو أصلًا.", "NO_PYTHON");
  const free = await freeMb(dir);
  if (free !== null && free < REQUIRED_FREE_MB)
    throw new InstallRefusal(`المساحة الحرة ${free.toLocaleString("ar-EG")} م.ب، وفحص النطق يحتاج نحو ${REQUIRED_FREE_MB.toLocaleString("ar-EG")} م.ب.`, "NO_SPACE");
  const job: InstallJob = { status: "running", step: "venv", pct: 2, label: "تجهيز بيئة معزولة…", startedAt: new Date().toISOString() };
  installJob = job;
  const env = { ...(o.env ?? process.env), PIP_DISABLE_PIP_VERSION_CHECK: "1", PYTHONNOUSERSITE: "1" };
  void (async () => {
    try {
      await mkdir(dir, { recursive: true });
      await rm(path.join(dir, "venv"), { recursive: true, force: true });
      await run(py.path, ["-m", "venv", path.join(dir, "venv")], env);
      Object.assign(job, { step: "packages", pct: 10, label: `تنزيل برنامج التفريغ (نحو ${SIZES.packagesMb.toLocaleString("ar-EG")} م.ب)…` });
      let seen = 0;
      await run(venvPython(dir), ["-m", "pip", "install", "--no-input", `faster-whisper==${FASTER_WHISPER_VERSION}`], env, (l) => {
        if (/^(Collecting|Downloading|Installing)/.test(l)) job.pct = Math.min(45, 10 + ++seen);
      });
      Object.assign(job, { step: "model", pct: 46, label: `تنزيل النموذج (نحو ${SIZES.modelMb.toLocaleString("ar-EG")} م.ب)…` });
      const timer = setInterval(() => void dirMb(path.join(dir, "models")).then((mb) => { job.pct = Math.min(98, 46 + Math.round((mb / SIZES.modelMb) * 52)); }), 2000);
      try { await run(venvPython(dir), [workerScript(), "--download", path.join(dir, "models"), MODEL, MODEL_REVISION], env); }
      finally { clearInterval(timer); }
      if (!existsSync(path.join(modelDir(dir), "model.bin"))) throw new Error("لم يكتمل تنزيل النموذج.");
      await writeJsonAtomic(markerFile(dir), { version: FASTER_WHISPER_VERSION, model: MODEL, revision: MODEL_REVISION || null, python: py.version, at: new Date().toISOString() });
      Object.assign(job, { status: "done", step: "done", pct: 100, label: "ثُبّت فحص النطق.", finishedAt: new Date().toISOString() });
    } catch (e) {
      Object.assign(job, { status: "error", label: "تعذّر التثبيت.", error: (e as Error).message.slice(0, 400), finishedAt: new Date().toISOString() });
    }
  })();
  return job;
};

/** Removes the tool (venv, model, marker) — the state file with the measurement stays. */
export const uninstall = async (dir = toolDir()) => {
  if (installJob?.status === "running") throw new InstallRefusal("التثبيت جارٍ.", "BUSY");
  await rm(path.join(dir, "venv"), { recursive: true, force: true });
  await rm(path.join(dir, "models"), { recursive: true, force: true });
  await rm(markerFile(dir), { force: true });
  installJob = null;
};

// ── transcription (local, offline) ─────────────────────────────────────────────────────────────────────────────
export type Transcriber = (items: { id: string; wav: string }[]) => Promise<Map<string, { text?: string; error?: string }>>;

/** One worker process per batch: the model loads once, then every wav is transcribed in turn. */
export const localTranscriber = (inst: Extract<Installed, { installed: true }>): Transcriber => async (items) => {
  const out = new Map<string, { text?: string; error?: string }>();
  if (!items.length) return out;
  await new Promise<void>((resolve, reject) => {
    const p = spawn(inst.python, [workerScript(), "--transcribe", inst.model], {
      env: { ...process.env, HF_HUB_OFFLINE: "1", TRANSFORMERS_OFFLINE: "1", PYTHONNOUSERSITE: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let buf = "", err = "";
    p.stdout.on("data", (b: Buffer) => {
      buf += b.toString();
      let k: number;
      while ((k = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, k).trim(); buf = buf.slice(k + 1);
        if (!line) continue;
        try { const r = JSON.parse(line) as { id?: string; text?: string; error?: string }; if (r.id) out.set(r.id, { text: r.text, error: r.error }); } catch { /* not ours */ }
      }
    });
    p.stderr.on("data", (b: Buffer) => { err = (err + b.toString()).slice(-1500); });
    p.on("error", reject);
    p.on("close", (code) => code === 0 ? resolve() : reject(new Error(err.trim().split("\n").slice(-2).join(" ") || `exit ${code}`)));
    for (const it of items) p.stdin.write(JSON.stringify(it) + "\n");
    p.stdin.end();
  });
  return out;
};
