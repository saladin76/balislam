/**
 * D53 over the real Studio server: after «إذن النشر» (never before) the approved files go to the owner's
 * Google Drive folder (a temp folder here, BAL_DRIVE_PUBLISH_DIR), in the background; «أعد الإرسال إلى Drive»
 * needs the owner session; no Drive folder is a clear message and nothing else breaks.
 * Harness copied from tests/studio-e2e-cycle.test.ts (one scene; the Remotion render stubbed with ffmpeg).
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, mkdtemp, mkdir, readdir, readFile, rm, rmdir, writeFile } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import { balApi } from "../app/server/api";
import { findTraces } from "../src/package/traces";
import { PREP_VALID_TAIL } from "./fixtures/prepValidScript";
import { passEditor } from "./fixtures/editorPass";
import { grantTestMacRenderPermit } from "./helpers/macRenderPermit";

const repo = path.resolve(import.meta.dirname, "..");
const CH = "balislam";
const EP = "986";
const EP_DIR = "986-drive-handoff";
/** No passphrase (owner decision 9 Nov): a page of another site is refused (403); the Studio page is the owner. */
const CROSS = { origin: "https://evil.example" };

const ffmpeg = (args: string[]) => execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...args]);
/** The same small, playable H.264 + AAC clip every stubbed scene render writes. */
const avClip = (out: string, seconds = 2, freq = 440) => ffmpeg([
  "-f", "lavfi", "-i", `testsrc=size=320x180:rate=30:duration=${seconds}`,
  "-f", "lavfi", "-i", `sine=frequency=${freq}:duration=${seconds}`,
  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast", "-c:a", "aac", "-b:a", "64k",
  "-shortest", "-movflags", "+faststart", out,
]);

/** Test-only: replace the Remotion render behind the scene AV route with an ffmpeg clip. */
const stubbedRenders: string[] = [];
const renderStub = (): Plugin => ({
  name: "e2e-stub-remotion-render",
  enforce: "pre",
  resolveId(source, importer) {
    if (source === "./episode" && importer?.replace(/\\/g, "/").includes("/src/render/shotsPreview.ts")) return "\0e2e-render-stub";
    return null;
  },
  load(id) {
    if (id !== "\0e2e-render-stub") return null;
    return `
      import { execFileSync } from "node:child_process";
      import { mkdirSync } from "node:fs";
      import path from "node:path";
      export const renderEpisode = async (o) => {
        mkdirSync(path.dirname(o.outFile), { recursive: true });
        execFileSync("ffmpeg", ["-nostdin","-hide_banner","-loglevel","error","-y",
          "-f","lavfi","-i","testsrc=size=320x180:rate=30:duration=2",
          "-f","lavfi","-i","sine=frequency=330:duration=2",
          "-c:v","libx264","-pix_fmt","yuv420p","-preset","ultrafast","-c:a","aac","-b:a","64k",
          "-shortest","-movflags","+faststart", o.outFile]);
        globalThis.__e2eStubRenders?.push(o.plan.chapters.flatMap((c) => c.scenes.map((s) => s.id)).join(","));
        return o.outFile;
      };`;
  },
});

let root = "";
let epDir = "";
let vite: ViteDevServer;
let server: http.Server;
let base = "";
const saved: Record<string, string | undefined> = {};
const ENV_KEYS = ["BAL_CHANNELS_DIR", "BAL_ENV_FILE", "BAL_WORKFLOW_HMAC_KEY", "BAL_DRIVE_PREVIEWS_DIR", "BAL_DRIVE_PUBLISH_DIR", "ELEVENLABS_API_KEY"];

type Res = { status: number; body: any };
const call = async (method: string, route: string, body?: unknown, headers: Record<string, string> = {}): Promise<Res> => {
  const r = await fetch(`${base}/api/${route}${route.includes("?") ? "&" : "?"}channel=${CH}`, {
    method,
    headers: { "sec-fetch-site": "same-origin", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let parsed: any = text;
  try { parsed = JSON.parse(text); } catch { /* binary */ }
  return { status: r.status, body: parsed };
};
const state = async () => {
  const r = await call("GET", `episodes/${EP}/scene-production`);
  expect(r.status).toBe(200);
  return r.body;
};
const decide = (cmd: Record<string, unknown>, headers: Record<string, string> = {}) => call("POST", `episodes/${EP}/scene-production`, cmd, headers);
const render = (sceneId: string, expectedSha256: string, headers: Record<string, string> = {}) =>
  call("POST", `episodes/${EP}/scene-av-render`, { sceneId, expectedSha256 }, headers);


const scenes = [{ id: "c1-s1", narration: "الصبر مفتاح الفرج." }];
const planOf = (s2text = "الشكر") => ({
  channel: CH, episode: EP, title: "مفتاح الفرج",
  chapters: [{ number: 1, title: "تجربة", scenes: scenes.map((s, i) => ({
    id: s.id, template: "big-question", line: 7 + i, narration: s.narration, sfx: [],
    props: { text: s.id === "c1-s2" ? s2text : s.narration.split(" ")[0] },
  })) }],
});

beforeAll(async () => {
  await grantTestMacRenderPermit();
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  // Inside the Studio root (git-ignored renders/), because media routes refuse files outside it.
  await mkdir(path.join(repo, "renders"), { recursive: true });
  root = await mkdtemp(path.join(repo, "renders", "drive-handoff-"));
  const chDir = path.join(root, CH);
  epDir = path.join(chDir, "episodes", EP_DIR);
  await mkdir(epDir, { recursive: true });
  for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json"])
    await copyFile(path.join(repo, "channels", CH, f), path.join(chDir, f));
  process.env.BAL_CHANNELS_DIR = root;
  process.env.BAL_ENV_FILE = path.join(root, ".env");
  delete process.env.BAL_WORKFLOW_HMAC_KEY; // generated into the temp .env by the server, as on the Mac
  delete process.env.BAL_DRIVE_PREVIEWS_DIR;
  delete process.env.BAL_DRIVE_PUBLISH_DIR;
  delete process.env.ELEVENLABS_API_KEY;
  (globalThis as any).__e2eStubRenders = stubbedRenders;

  await writeFile(path.join(epDir, "script.md"),
    `---\ntitle: "مفتاح الفرج"\ndomain: psychology\nepisode: "${EP}"\n---\n## الفصل 1 · تجربة\n${scenes.map((s) => s.narration).join("\n")}\n` + PREP_VALID_TAIL);
  await passEditor(path.join(epDir, "script.md"));
  await writeFile(path.join(epDir, "plan.json"), JSON.stringify(planOf(), null, 2));
  const voice = path.join(epDir, "voice");
  await mkdir(voice);
  const index: Record<string, unknown> = {};
  for (const [i, s] of scenes.entries()) {
    const file = `${s.id}.mp3`;
    ffmpeg(["-f", "lavfi", "-i", `sine=frequency=${300 + i * 50}:duration=1.5`, "-c:a", "libmp3lame", "-b:a", "64k", path.join(voice, file)]);
    index[s.id] = { file, hash: createHash("sha1").update(s.narration).digest("hex").slice(0, 12), text: s.narration, duration: 1.5, words: [] };
  }
  await writeFile(path.join(voice, "index.json"), JSON.stringify(index, null, 2));

  vite = await createServer({
    configFile: false, root: path.join(repo, "app"), logLevel: "error", appType: "custom",
    plugins: [renderStub(), balApi()],
    server: { middlewareMode: true, hmr: false, watch: null, fs: { allow: [repo, root] } },
  });
  server = http.createServer(vite.middlewares);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 120_000);

afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  await vite?.close();
  for (const k of ENV_KEYS) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  delete (globalThis as any).__e2eStubRenders;
  if (root) await rm(root, { recursive: true, force: true });
  // Staged render media for this fixture episode only (renders/ is git-ignored).
  await rm(path.join(repo, "renders", ".private-media", "_render", CH, EP_DIR), { recursive: true, force: true });
  for (const dir of [path.join(repo, "renders", ".private-media", "_render", CH), path.join(repo, "renders", ".private-media", "_render"), path.join(repo, "renders", ".private-media")])
    await rmdir(dir).catch(() => undefined); // only if now empty

});

const waitDrive = async () => {
  for (let i = 0; i < 200; i++) {
    const r = await call("GET", `episodes/${EP}/publish-drive`);
    expect(r.status).toBe(200);
    if (r.body.job?.status !== "running") return r.body;
    await new Promise((res) => setTimeout(res, 100));
  }
  throw new Error("drive handoff did not finish");
};
const cleanMaster = (out: string) => {
  const raw = out + ".raw.mp4";
  avClip(raw, 4, 550);
  ffmpeg(["-i", raw, "-map", "0", "-c", "copy", "-map_metadata", "-1", "-map_metadata:s", "-1", "-bsf:v", "filter_units=remove_types=6",
    "-fflags", "+bitexact", "-flags:v", "+bitexact", "-flags:a", "+bitexact", "-metadata", "title=مفتاح الفرج", "-metadata", "artist=بالإسلام", "-movflags", "+faststart", out]);
  return rm(raw);
};

describe("Drive handoff after the publish permission (real server, real ledger)", () => {
  it("nothing before permission; exact files after; owner-only retry; idempotent; no Drive is a message", async () => {
    const drive = await mkdtemp(path.join(os.tmpdir(), "my-drive-"));
    try {
      let s = await state();
      expect((await decide({ action: "approve-script", reviewed: true, expectedSha256: s.script.sha256 })).status).toBe(200);
      expect((await call("PUT", `episodes/${EP}/storyboard`, { action: "approve", auditNote: "راجعت اللوحة بصريًا: النص والتكوين والتوقيت مطابقة للسكريبت." })).status).toBe(200);
      s = await state();
      expect((await decide({ action: "approve-storyboard", reviewed: true, expectedSha256: s.storyboard.sha256 })).status).toBe(200);
      s = await state();
      expect((await render("c1-s1", s.scenes[0].sourceSha256)).status).toBe(200);
      expect((await decide({ action: "submit-scene", sceneId: "c1-s1", expectedSha256: s.scenes[0].sourceSha256 })).status).toBe(200);
      const cut = (await state()).candidates.scenes["c1-s1"];
      expect((await decide({ action: "approve-scene", sceneId: "c1-s1", expectedSha256: cut, confirmedWatched: true })).status).toBe(200);
      expect((await call("POST", `episodes/${EP}/scene-av-assemble`)).status).toBe(200);
      s = await state();
      expect((await decide({ action: "assemble", expectedSha256: s.candidates.assemblySha256 })).status).toBe(200);
      const asm = await decide({ action: "approve-assembly", expectedSha256: s.candidates.assemblySha256, confirmedWatched: true, seamsChecked: s.seams });
      expect(asm.status, JSON.stringify(asm.body)).toBe(200);
      const pkg = path.join(epDir, "out", "package");
      await mkdir(pkg, { recursive: true });
      const masterFile = path.join(pkg, `${EP}-episode.mp4`);
      await cleanMaster(masterFile);
      await writeFile(path.join(pkg, `${EP}-episode.ar.srt`), "1\n00:00:00,000 --> 00:00:02,000\nالصبر مفتاح الفرج\n");
      s = await state();
      const masterSha = s.candidates.masterSha256;
      expect((await decide({ action: "approve-master", expectedSha256: masterSha, confirmedWatched: true })).status).toBe(200);

      // Drive configured, Master approved, NO publish permission yet: nothing is copied.
      process.env.BAL_DRIVE_PUBLISH_DIR = drive;
      expect((await call("POST", `episodes/${EP}/publish-drive`, undefined, CROSS)).status).toBe(403); // owner only, from the Studio page
      const early = await call("POST", `episodes/${EP}/publish-drive`);
      expect(early.status, JSON.stringify(early.body)).toBe(202);
      const refused = await waitDrive();
      expect(refused.job.status).toBe("error");
      expect(refused.job.error).toMatch(/إذن النشر/);
      expect(await readdir(drive)).toEqual([]);

      // The permission itself starts the copy in the background (the request does not wait for it).
      const pub = await decide({ action: "grant-publish", expectedSha256: masterSha, confirmedWatched: true });
      expect(pub.status, JSON.stringify(pub.body)).toBe(200);
      const done = await waitDrive();
      expect(done.job.status, JSON.stringify(done.job)).toBe("done");
      expect(done.job.trigger).toBe("publish-permission");
      const folder = path.join(drive, "balislam-publish", CH, EP_DIR);
      expect(done.last).toMatchObject({ status: "done", folder, masterSha256: masterSha });
      expect((await readdir(folder)).sort()).toEqual([`${EP}-episode.ar.srt`, `${EP}-episode.mp4`, "manifest.json", "نشر.txt"].sort());
      expect(createHash("sha256").update(await readFile(path.join(folder, `${EP}-episode.mp4`))).digest("hex")).toBe(masterSha);
      const text = await readFile(path.join(folder, "نشر.txt"), "utf8");
      expect(text).toContain("مفتاح الفرج");
      expect(text).toContain("## الفصول");
      expect(text).toContain("تعليق مثبّت");
      expect(findTraces(text)).toEqual([]);
      const manifest = JSON.parse(await readFile(path.join(folder, "manifest.json"), "utf8"));
      expect(manifest.approvals.master.sha256).toBe(masterSha);
      expect(manifest.approvals.publish.ledgerSeq).toBeGreaterThan(manifest.approvals.master.ledgerSeq);

      // «أعد الإرسال إلى Drive»: owner session only, then every file is skipped (identical).
      expect((await call("POST", `episodes/${EP}/publish-drive`, undefined, CROSS)).status).toBe(403);
      expect((await call("POST", `episodes/${EP}/publish-drive/open`, undefined, CROSS)).status).toBe(403);
      expect((await call("POST", `episodes/${EP}/publish-drive`)).status).toBe(202);
      const again = await waitDrive();
      expect(again.job.status).toBe("done");
      expect(again.last.files.filter((f: any) => f.kind !== "manifest").every((f: any) => f.action === "skipped")).toBe(true);

      // No Drive folder: a clear message; the retry is refused with it; the publish state is untouched.
      process.env.BAL_DRIVE_PUBLISH_DIR = path.join(drive, "missing");
      const none = await call("GET", `episodes/${EP}/publish-drive`);
      expect(none.body.drive.found).toBe(false);
      expect(none.body.drive.message).toMatch(/BAL_DRIVE_PUBLISH_DIR/);
      const noRetry = await call("POST", `episodes/${EP}/publish-drive`);
      expect(noRetry.status).toBe(409);
      expect(noRetry.body.error).toMatch(/BAL_DRIVE_PUBLISH_DIR/);
      expect((await state()).progress.publishAllowed).toBe(true);
    } finally {
      delete process.env.BAL_DRIVE_PUBLISH_DIR;
      await rm(drive, { recursive: true, force: true });
    }
  }, 300_000);
});
