/**
 * Harness of the full-journey test (stabilization brief, work ٤): a REAL Studio server (the same `balApi()`
 * Vite plugin the owner runs) over a temporary channels folder, with the test-only fake voice provider
 * (BAL_VOICE_PROVIDER=fake) and the tiny real render (BAL_E2E_RENDER=tiny). Nothing is stubbed in the server:
 * every step goes over HTTP to the routes the page calls. No key, no network service, no owner data.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, rmdir, stat } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { balApi } from "../../app/server/api";
import { cleanGitEnv } from "../../scripts/git-env.mjs";

export const repo = path.resolve(import.meta.dirname, "..", "..");
export const fixturesDir = path.join(repo, "tests", "fixtures", "e2e");

export type Res = { status: number; body: any };
export const gitEnv = cleanGitEnv();
export const git = (cwd: string, args: string[], input?: string) =>
  execFileSync("git", args, { cwd, env: { ...gitEnv, GIT_AUTHOR_NAME: "e2e", GIT_AUTHOR_EMAIL: "e2e@example.invalid",
    GIT_COMMITTER_NAME: "e2e", GIT_COMMITTER_EMAIL: "e2e@example.invalid" }, encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"] }).trim();

export type Studio = {
  channel: string;
  /** A git clone laid out like the repository (channels/<channel>/…), whose origin is `remote` (bare). */
  root: string;
  remote: string;
  channelsDir: string; // root/channels (BAL_CHANNELS_DIR)
  driveDir: string; // BAL_DRIVE_PUBLISH_DIR
  base: string;
  call: (method: string, route: string, body?: unknown, headers?: Record<string, string>) => Promise<Res>;
  close: () => Promise<void>;
};

const ENV_KEYS = ["BAL_CHANNELS_DIR", "BAL_ENV_FILE", "BAL_WORKFLOW_HMAC_KEY", "BAL_DRIVE_PREVIEWS_DIR", "BAL_DRIVE_PUBLISH_DIR",
  "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "ELEVENLABS_MODEL_ID", "BAL_CHANNEL", "BAL_VOICE_PROVIDER", "BAL_E2E_RENDER", "BAL_E2E",
  "BAL_CONTENT_SYNC", "BAL_NOTES_SYNC", "BAL_UPDATE_BACKUP_DIR"];

export const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
export const sha256File = async (f: string) => sha256(await readFile(f));
export const ffmpeg = (args: string[]) => execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...args]);
export const probe = (file: string) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_entries",
  "format=duration:stream=codec_type,width,height", file]).toString()) as { format: { duration: string }; streams: { codec_type: string; width?: number; height?: number }[] };

/** Starts the Studio server for one channel over a fresh temporary channels folder. */
export const startStudio = async (channel: string): Promise<Studio> => {
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  // Inside the Studio root (git-ignored renders/), because the media routes refuse files outside it.
  await mkdir(path.join(repo, "renders"), { recursive: true });
  const root = await mkdtemp(path.join(repo, "renders", `e2e-${channel}-`));
  const driveDir = await mkdtemp(path.join(os.tmpdir(), `bal-e2e-drive-${channel}-`));
  const remote = await mkdtemp(path.join(os.tmpdir(), `bal-e2e-remote-${channel}-`));
  // The content-sync side (D101) runs on a temporary git repository, never on this one: a bare "GitHub"
  // and the owner's clone, laid out like the repository so the real content rules apply (scripts/contentPaths.mjs).
  git(remote, ["init", "-q", "--bare", "-b", "main"]);
  git(root, ["init", "-q", "-b", "main"]);
  const src = path.join(repo, "channels", channel);
  const chDir = path.join(root, "channels", channel);
  await mkdir(path.join(chDir, "episodes"), { recursive: true });
  // The channel's own settings, identity and lexicons; never its episodes or series (owner content).
  for (const e of await readdir(src, { withFileTypes: true }))
    if (e.isFile() && /\.json$/.test(e.name) && e.name !== "stock.json") await cp(path.join(src, e.name), path.join(chDir, e.name));
  await cp(path.join(repo, ".gitignore"), path.join(root, ".gitignore"));
  git(root, ["add", "-A"]);
  git(root, ["commit", "-q", "-m", "channel settings (e2e)"]);
  git(root, ["remote", "add", "origin", remote]);
  git(root, ["push", "-q", "origin", "main"]);
  git(root, ["fetch", "-q", "origin"]);
  git(root, ["branch", "-q", "--set-upstream-to=origin/main", "main"]);
  const channelsDir = path.join(root, "channels");
  // «حدّث الآن» keeps the owner's copies in ~/balislam-backup; here in a folder of this run.
  const backupDir = await mkdtemp(path.join(os.tmpdir(), `bal-e2e-backup-${channel}-`));
  process.env.BAL_UPDATE_BACKUP_DIR = backupDir;
  process.env.BAL_CHANNELS_DIR = channelsDir;
  process.env.BAL_ENV_FILE = path.join(root, ".env");
  process.env.BAL_CHANNEL = channel;
  process.env.BAL_DRIVE_PUBLISH_DIR = driveDir;
  process.env.BAL_VOICE_PROVIDER = "fake";
  process.env.BAL_E2E_RENDER = "tiny";
  process.env.BAL_E2E = "1";
  for (const k of ["BAL_WORKFLOW_HMAC_KEY", "BAL_DRIVE_PREVIEWS_DIR", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "ELEVENLABS_MODEL_ID", "BAL_CONTENT_SYNC", "BAL_NOTES_SYNC"])
    delete process.env[k];

  const vite: ViteDevServer = await createServer({
    configFile: false, root: path.join(repo, "app"), logLevel: "error", appType: "custom",
    plugins: [balApi()],
    server: { middlewareMode: true, hmr: false, watch: null, fs: { allow: [repo, root] } },
  });
  const server = http.createServer(vite.middlewares);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const call = async (method: string, route: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> => {
    const r = await fetch(`${base}/api/${route}${route.includes("?") ? "&" : "?"}channel=${channel}`, {
      method,
      headers: { "sec-fetch-site": "same-origin", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let parsed: any = text;
    try { parsed = JSON.parse(text); } catch { /* binary */ }
    return { status: r.status, body: parsed };
  };

  const close = async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await vite.close();
    for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
    if (process.env.BAL_E2E_KEEP) { console.log(`[e2e] kept ${root}, ${remote} and ${driveDir}`); return; }
    await rm(root, { recursive: true, force: true });
    await rm(driveDir, { recursive: true, force: true });
    await rm(remote, { recursive: true, force: true });
    await rm(backupDir, { recursive: true, force: true });
    // Staged render media of this run only (renders/ is git-ignored).
    const staged = path.join(repo, "renders", ".private-media", "_render", channel);
    if (existsSync(staged)) for (const d of await readdir(staged)) if (d.startsWith("001-e2e-")) await rm(path.join(staged, d), { recursive: true, force: true });
    for (const dir of [staged, path.join(repo, "renders", ".private-media", "_render"), path.join(repo, "renders", ".private-media")])
      await rmdir(dir).catch(() => undefined);
  };
  return { channel, root, remote, channelsDir, driveDir, base, call, close };
};

/** Every file under `dir` with its sha256 (relative paths). */
export const tree = async (dir: string, acc: Record<string, string> = {}, at = dir): Promise<Record<string, string>> => {
  if (!existsSync(dir)) return acc;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await tree(p, acc, at);
    else if ((await stat(p)).isFile()) acc[path.relative(at, p).split(path.sep).join("/")] = await sha256File(p);
  }
  return acc;
};

export const waitFor = async <T>(label: string, read: () => Promise<T>, done: (v: T) => boolean, timeoutMs = 600_000, everyMs = 250): Promise<T> => {
  const until = Date.now() + timeoutMs;
  let last: T;
  for (;;) {
    last = await read();
    if (done(last)) return last;
    if (Date.now() > until) throw new Error(`[e2e] ${label}: timed out; last state: ${JSON.stringify(last).slice(0, 1500)}`);
    await new Promise((r) => setTimeout(r, everyMs));
  }
};

/**
 * Owner decision (15–16 Nov): after «اعتمد التجهيز» nothing paid starts on its own. This is the owner's own press:
 * read the plan the panel shows («جاهز لتوليد صوت N جملة في M مشهد — نحو X حرف من الرصيد»), press «ولّد الصوت
 * الآن», confirm («نعم، ولّد الصوت»), and wait for the queue (voice, then the drafts it unblocked).
 */
export const generateVoiceConfirmed = async (st: Pick<Studio, "call">, ep: string) => {
  const read = await st.call("GET", `episodes/${ep}/scene-prepare`);
  if (read.status !== 200) throw new Error(`[e2e] scene-prepare read: ${read.status} ${JSON.stringify(read.body).slice(0, 600)}`);
  const plan = read.body.voicePlan;
  const start = await st.call("POST", `episodes/${ep}/scene-prepare`, { voice: { confirm: true, fingerprint: plan?.fingerprint } });
  if (start.status !== 200) throw new Error(`[e2e] «ولّد الصوت الآن»: ${start.status} ${JSON.stringify(start.body).slice(0, 600)}`);
  const job = await waitFor("voice + drafts", () => st.call("GET", `episodes/${ep}/scene-prepare`), (x) => x.body.job && x.body.job.status !== "running", 1_200_000, 1000);
  return { plan, job };
};

/**
 * D234: the coordinator records the content editor's pass on the script as it is now (`bal editor-pass`), so the
 * journey can go on to voice and render; the editor gate itself is tested in tests/script-pipeline-gate.test.ts.
 */
export const passEditor = async (st: Pick<Studio, "channelsDir" | "channel">, ep: string) => {
  const { readdir } = await import("node:fs/promises");
  const eps = path.join(st.channelsDir, st.channel, "episodes");
  const dir = (await readdir(eps)).find((d) => d.startsWith(`${ep}-`));
  if (!dir) throw Error(`episode ${ep} not found for the editor pass`);
  const { recordEditorPass } = await import("../../src/studio/scriptPipelineStore");
  return recordEditorPass(path.join(eps, dir, "script.md"), { by: "محرر الاختبار", recordedBy: "e2e" });
};
