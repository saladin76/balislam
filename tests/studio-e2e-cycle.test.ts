/**
 * Readiness rehearsal (plan task 3): ONE full production cycle through the REAL Studio server API.
 *
 * A real Vite dev server is started in middleware mode with the same `balApi()` plugin the owner runs,
 * against a temporary channels folder and a temporary .env. Every request goes over HTTP to the same
 * routes the UI calls. The ONLY stub is the heavy Remotion render inside the scene AV route: in this
 * test the import of `./episode` from `src/render/shotsPreview.ts` is redirected to a tiny ffmpeg
 * encoder that writes a real playable MP4 with an audio track to the same `outFile`. Everything after
 * it (preview slot upload, render-to-source proof, ledger, assembly with ffmpeg concat, gates) is real.
 * No API keys, no network services, no real episodes.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, mkdtemp, mkdir, readdir, readFile, rm, rmdir, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Plugin, type ViteDevServer } from "vite";
import { balApi } from "../app/server/api";
import { publishCardState } from "../app/src/tabs/PublishTab";
import { runWithChannel } from "../src/channel";
import { assertWorkflowForEpisode } from "../src/workflow/server";

const repo = path.resolve(import.meta.dirname, "..");
const CH = "balislam";
const EP = "987";
const EP_DIR = "987-e2e-cycle";
const PASS = "owner-e2e-passphrase-2026";

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
const ENV_KEYS = ["BAL_CHANNELS_DIR", "BAL_ENV_FILE", "BAL_WORKFLOW_HMAC_KEY", "BAL_STUDIO_OWNER_PASSPHRASE_SHA256", "BAL_DRIVE_PREVIEWS_DIR", "ELEVENLABS_API_KEY"];

type Res = { status: number; body: any };
const call = async (method: string, route: string, body?: unknown, token?: string, headers: Record<string, string> = {}): Promise<Res> => {
  const r = await fetch(`${base}/api/${route}${route.includes("?") ? "&" : "?"}channel=${CH}`, {
    method,
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { "x-studio-owner-token": token } : {}), ...headers },
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
const decide = (cmd: Record<string, unknown>, token = PASS) => call("POST", `episodes/${EP}/scene-production`, cmd, token);
const render = (sceneId: string, expectedSha256: string, token = PASS) =>
  call("POST", `episodes/${EP}/scene-av-render`, { sceneId, expectedSha256 }, token);

/** Every file in the episode folder with its identity: any write by a GET shows up here. */
const snapshot = async (dir: string, acc: Record<string, string> = {}): Promise<Record<string, string>> => {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await snapshot(p, acc);
    else { const s = await stat(p); acc[path.relative(epDir, p)] = `${s.size}:${s.mtimeMs}:${s.ino}`; }
  }
  return acc;
};
const UI_READS = () => ["overview", `episodes`, `episodes/${EP}`, `episodes/${EP}/scene-production`, `episodes/${EP}/previews`,
  `episodes/${EP}/kit`, `episodes/${EP}/storyboard`, `episodes/${EP}/package`, `episodes/${EP}/status`,
  `episodes/${EP}/workflow`, `episodes/${EP}/script-signoff`, `episodes/${EP}/voice-review`, `episodes/${EP}/scene-review`, `owner-passphrase`];
const assertReadsDoNotWrite = async (label: string) => {
  const before = await snapshot(epDir);
  for (const route of UI_READS()) {
    const r = await call("GET", route);
    expect(r.status, `${label}: GET ${route} → ${JSON.stringify(r.body).slice(0, 300)}`).toBe(200);
  }
  expect(await snapshot(epDir), `${label}: a GET wrote into the episode folder`).toEqual(before);
};

const scenes = [
  { id: "c1-s1", narration: "الصبر مفتاح الفرج." },
  { id: "c1-s2", narration: "والشكر يحفظ النعمة." },
  { id: "c1-s3", narration: "والرضا راحة القلب." },
];
const planOf = (s2text = "الشكر") => ({
  channel: CH, episode: EP, title: "دورة إنتاج كاملة",
  chapters: [{ number: 1, title: "تجربة", scenes: scenes.map((s, i) => ({
    id: s.id, template: "big-question", line: 7 + i, narration: s.narration, sfx: [],
    props: { text: s.id === "c1-s2" ? s2text : s.narration.split(" ")[0] },
  })) }],
});

beforeAll(async () => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  // Inside the Studio root (git-ignored renders/), because media routes refuse files outside it.
  await mkdir(path.join(repo, "renders"), { recursive: true });
  root = await mkdtemp(path.join(repo, "renders", "e2e-cycle-"));
  const chDir = path.join(root, CH);
  epDir = path.join(chDir, "episodes", EP_DIR);
  await mkdir(epDir, { recursive: true });
  for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json"])
    await copyFile(path.join(repo, "channels", CH, f), path.join(chDir, f));
  process.env.BAL_CHANNELS_DIR = root;
  process.env.BAL_ENV_FILE = path.join(root, ".env");
  delete process.env.BAL_WORKFLOW_HMAC_KEY; // generated into the temp .env by the server, as on the Mac
  delete process.env.BAL_STUDIO_OWNER_PASSPHRASE_SHA256;
  delete process.env.BAL_DRIVE_PREVIEWS_DIR;
  delete process.env.ELEVENLABS_API_KEY;
  (globalThis as any).__e2eStubRenders = stubbedRenders;

  await writeFile(path.join(epDir, "script.md"),
    `---\ntitle: "دورة إنتاج كاملة"\ndomain: psychology\nepisode: "${EP}"\n---\n## الفصل 1 · تجربة\n${scenes.map((s) => s.narration).join("\n")}\n`);
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

describe("Studio E2E: one full production cycle over the real server API", () => {
  it("passphrase → script → storyboard → scenes in order → assembly → Master → publish, with every negative", async () => {
    const gate = (action: "master_render" | "publish") => runWithChannel(CH, () => assertWorkflowForEpisode(EP, action));

    // ── 0. Security envelope ───────────────────────────────────────────────────────────────────
    expect((await call("POST", "owner-passphrase/check", { passphrase: PASS }, undefined, { origin: "https://evil.example" })).status).toBe(403);
    expect((await call("GET", "owner-passphrase")).body).toEqual({ set: false });
    const fresh = await state();
    // No passphrase yet: approvals are disabled.
    const noPass = await decide({ action: "approve-script", expectedSha256: fresh.script.sha256 });
    expect(noPass.status).toBe(403);
    expect((await call("POST", "owner-passphrase", { passphrase: "short" })).status).toBe(400);
    expect((await call("POST", "owner-passphrase", { passphrase: PASS })).body).toEqual({ set: true });
    const envText = await readFile(path.join(root, ".env"), "utf8");
    expect(envText).not.toContain(PASS); // only its digest
    expect(envText).toMatch(/^BAL_STUDIO_OWNER_PASSPHRASE_SHA256=[a-f0-9]{64}$/m);
    expect(envText).toMatch(/^BAL_WORKFLOW_HMAC_KEY=[a-f0-9]{64}$/m);
    // Changing it needs the current one.
    expect((await call("POST", "owner-passphrase", { passphrase: "another-passphrase" })).status).toBe(400);
    expect((await call("POST", "owner-passphrase/check", { passphrase: "wrong-passphrase" })).body).toEqual({ ok: false });
    expect((await call("POST", "owner-passphrase/check", { passphrase: PASS })).body).toEqual({ ok: true });

    await assertReadsDoNotWrite("fresh episode");

    // ── 1. Script ──────────────────────────────────────────────────────────────────────────────
    let s = await state();
    expect(s.script.approved).toBe(false);
    expect((await decide({ action: "approve-script", expectedSha256: s.script.sha256 }, "wrong-passphrase")).status).toBe(403);
    expect((await decide({ action: "approve-storyboard", expectedSha256: s.storyboard.sha256 })).status).toBe(409); // out of order
    expect((await render("c1-s1", s.scenes[0].sourceSha256)).status).toBe(409); // nothing renders before approvals
    expect((await decide({ action: "approve-script", expectedSha256: "0".repeat(64) })).status).toBe(409); // stale hash
    const scriptOk = await decide({ action: "approve-script", expectedSha256: s.script.sha256 });
    expect(scriptOk.status, JSON.stringify(scriptOk.body)).toBe(200);
    expect(scriptOk.body.script.approved).toBe(true);

    // ── 2. Storyboard (visual sign-off record, then the owner's ledger decision) ───────────────
    s = await state();
    expect((await decide({ action: "approve-storyboard", expectedSha256: s.storyboard.sha256 })).status).toBe(409); // boards not reviewed
    expect((await call("PUT", `episodes/${EP}/storyboard`, { action: "approve", auditNote: "قصير" })).status).toBe(400);
    const board = await call("PUT", `episodes/${EP}/storyboard`, { action: "approve", auditNote: "راجعت اللوحات الثلاث بصريًا: النص والتكوين والتوقيت مطابقة للسكريبت." });
    expect(board.status, JSON.stringify(board.body)).toBe(200);
    expect(board.body.status.ok).toBe(true);
    s = await state();
    expect(s.storyboard.approved).toBe(false); // the visual record alone is not an approval
    const boardOk = await decide({ action: "approve-storyboard", expectedSha256: s.storyboard.sha256 });
    expect(boardOk.status, JSON.stringify(boardOk.body)).toBe(200);
    expect(boardOk.body.storyboard.approved).toBe(true);

    await assertReadsDoNotWrite("script + storyboard approved");

    // ── 3. Scenes, strictly in order, each with sound and picture ──────────────────────────────
    s = await state();
    expect(s.progress.currentScene).toBe("c1-s1");
    expect(s.scenes.every((x: any) => x.readyForAv)).toBe(true);
    // Out of order: the second scene cannot be produced or approved first.
    expect((await render("c1-s2", s.scenes[1].sourceSha256)).status).toBe(409);
    expect((await render("c1-s1", s.scenes[0].sourceSha256, "wrong-passphrase")).status).toBe(403);
    expect((await decide({ action: "approve-scene", sceneId: "c1-s2", expectedSha256: "a".repeat(64), confirmedWatched: true })).status).toBe(409);

    const produceAndApprove = async (id: string) => {
      let cur = await state();
      expect(cur.progress.currentScene).toBe(id);
      const sc = cur.scenes.find((x: any) => x.id === id);
      const r = await render(id, sc.sourceSha256);
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body.preview).toBe(`scene-${id}-av.mp4`);
      cur = await state();
      const candidate = cur.candidates.scenes[id];
      expect(candidate).toMatch(/^[a-f0-9]{64}$/);
      // The UI plays it from the previews route.
      const media = await fetch(`${base}/api/episodes/${EP}/previews/scene-${id}-av.mp4?channel=${CH}`);
      expect(media.status, `${await media.clone().text()} ${JSON.stringify(await readdir(path.join(epDir, "previews")))}`).toBe(200);
      expect(createHash("sha256").update(Buffer.from(await media.arrayBuffer())).digest("hex")).toBe(candidate);
      // Approving before submitting is refused.
      expect((await decide({ action: "approve-scene", sceneId: id, expectedSha256: candidate, confirmedWatched: true })).status).toBe(409);
      const sub = await decide({ action: "submit-scene", sceneId: id, expectedSha256: sc.sourceSha256 });
      expect(sub.status, JSON.stringify(sub.body)).toBe(200);
      // A decision answers with the full read model (the UI renders it directly).
      expect(sub.body.candidates.scenes[id]).toBe(candidate);
      expect(sub.body.prepared.total).toBe(3);
      // Watching with sound is mandatory.
      expect((await decide({ action: "approve-scene", sceneId: id, expectedSha256: candidate })).status).toBe(409);
      const ok = await decide({ action: "approve-scene", sceneId: id, expectedSha256: candidate, confirmedWatched: true });
      expect(ok.status, JSON.stringify(ok.body)).toBe(200);
      expect(ok.body.scenes.find((x: any) => x.id === id).approved).toBe(true);
    };
    await produceAndApprove("c1-s1");
    // Correction path on scene 2: submit, ask for a fix, re-render, then approve.
    {
      const cur = await state();
      const sc = cur.scenes[1];
      expect((await render("c1-s2", sc.sourceSha256)).status).toBe(200);
      const candidate = (await state()).candidates.scenes["c1-s2"];
      expect((await decide({ action: "submit-scene", sceneId: "c1-s2", expectedSha256: sc.sourceSha256 })).status).toBe(200);
      expect((await decide({ action: "correct-scene", sceneId: "c1-s2", expectedSha256: candidate })).status).toBe(409); // a reason is required
      const fix = await decide({ action: "correct-scene", sceneId: "c1-s2", expectedSha256: candidate, note: "الثانية 1: الانتقال سريع" });
      expect(fix.status).toBe(200);
      expect(fix.body.scenes[1].status).toBe("needs_revision");
      // The note stays visible, and the cut sent back is never offered again as a ready draft.
      expect(fix.body.scenes[1].correction.note).toBe("الثانية 1: الانتقال سريع");
      expect(fix.body.scenes[1].draft).toBe("stale");
      expect((await decide({ action: "approve-scene", sceneId: "c1-s2", expectedSha256: candidate, confirmedWatched: true })).status).toBe(409);
    }
    await produceAndApprove("c1-s2");
    // Not assemblable before the last scene.
    expect((await call("POST", `episodes/${EP}/scene-av-assemble`, undefined, PASS)).status).toBe(409);
    await produceAndApprove("c1-s3");
    expect(stubbedRenders).toEqual(["c1-s1", "c1-s2", "c1-s2", "c1-s3"]);

    // ── 4. Assembly: built from the approved cuts, watched 1×, every seam checked ──────────────
    s = await state();
    expect(s.progress.canAssemble).toBe(true);
    expect(s.seams).toEqual(["c1-s1>c1-s2", "c1-s2>c1-s3"]);
    expect((await call("POST", `episodes/${EP}/scene-av-assemble`, undefined, "wrong-passphrase")).status).toBe(403);
    const asm = await call("POST", `episodes/${EP}/scene-av-assemble`, undefined, PASS);
    expect(asm.status, JSON.stringify(asm.body)).toBe(200);
    expect(asm.body.scenes).toBe(3);
    s = await state();
    const assemblySha = s.candidates.assemblySha256;
    expect(assemblySha).toMatch(/^[a-f0-9]{64}$/);
    expect((await decide({ action: "approve-assembly", expectedSha256: assemblySha, confirmedWatched: true, seamsChecked: s.seams })).status).toBe(409); // not recorded yet
    expect((await decide({ action: "assemble", expectedSha256: assemblySha })).status).toBe(200);
    // Audit item 11: each seam's place in the assembled file, from the real 2 s cuts (to jump the player).
    const withTimes = await state();
    expect(Object.keys(withTimes.seamTimes ?? {})).toEqual(s.seams);
    expect(withTimes.seamTimes["c1-s1>c1-s2"]).toBeGreaterThan(1.5);
    expect(withTimes.seamTimes["c1-s2>c1-s3"]).toBeGreaterThan(withTimes.seamTimes["c1-s1>c1-s2"] + 1.5);
    await expect(gate("master_render")).rejects.toThrow(/1×|assembl/i);
    expect((await decide({ action: "approve-assembly", expectedSha256: assemblySha, seamsChecked: s.seams })).status).toBe(409); // not watched
    expect((await decide({ action: "approve-assembly", expectedSha256: assemblySha, confirmedWatched: true, seamsChecked: [s.seams[0]] })).status).toBe(409); // a seam unchecked
    const asmOk = await decide({ action: "approve-assembly", expectedSha256: assemblySha, confirmedWatched: true, seamsChecked: s.seams });
    expect(asmOk.status, JSON.stringify(asmOk.body)).toBe(200);
    expect(asmOk.body.progress.assemblyApproved).toBe(true);
    await expect(gate("master_render")).resolves.toBeUndefined();

    // ── 5. Master (stub file at the real Master path) → exact-bytes approval ───────────────────
    const masterFile = path.join(epDir, "out", "package", `${EP}-episode.mp4`);
    await mkdir(path.dirname(masterFile), { recursive: true });
    avClip(masterFile, 4, 550);
    s = await state();
    const masterSha = s.candidates.masterSha256;
    expect(masterSha).toMatch(/^[a-f0-9]{64}$/);
    expect((await decide({ action: "grant-publish", expectedSha256: masterSha, confirmedWatched: true })).status).toBe(409); // before Master approval
    expect((await decide({ action: "approve-master", expectedSha256: masterSha })).status).toBe(409); // not watched
    expect((await decide({ action: "approve-master", expectedSha256: "b".repeat(64), confirmedWatched: true })).status).toBe(409); // not these bytes
    const masterOk = await decide({ action: "approve-master", expectedSha256: masterSha, confirmedWatched: true });
    expect(masterOk.status, JSON.stringify(masterOk.body)).toBe(200);
    expect(masterOk.body.master).toMatchObject({ sha256: masterSha, publishAllowed: false });
    // The publish card follows the ledger (D36): this stub has no 4K render.json, yet it is the approved file.
    const cardApproved = publishCardState(await state(), false);
    expect(cardApproved).toMatchObject({ approved: true, publishAllowed: false, pill: "معتمدة", primary: null });
    expect(cardApproved.permission).toContain("بانتظار إذنك");
    expect(cardApproved.rerenderWarning).toContain("سيلغي اعتماد النسخة النهائية");

    // ── 6. Publish: blocked until an explicit permission for these exact bytes ─────────────────
    await expect(gate("publish")).rejects.toThrow(/publish/i);
    const early = await call("PUT", `episodes/${EP}/status`, { status: { published: { youtube: "https://youtu.be/x" } } });
    expect(early.status, JSON.stringify(early.body)).toBe(409);
    expect((await decide({ action: "grant-publish", expectedSha256: masterSha, confirmedWatched: true }, "wrong-passphrase")).status).toBe(403);
    const pub = await decide({ action: "grant-publish", expectedSha256: masterSha, confirmedWatched: true });
    expect(pub.status, JSON.stringify(pub.body)).toBe(200);
    expect(pub.body.progress.publishAllowed).toBe(true);
    const cardAllowed = publishCardState(await state(), false);
    expect(cardAllowed).toMatchObject({ approved: true, publishAllowed: true, pill: "مأذون بالنشر", permission: "ممنوح لهذا الملف", primary: "download" });
    expect(cardAllowed.rerenderWarning).toContain("إذن النشر");
    await expect(gate("publish")).resolves.toBeUndefined();

    await assertReadsDoNotWrite("published-ready episode");
    expect((await state()).progress.publishAllowed).toBe(true); // reads changed nothing

    const published = await call("PUT", `episodes/${EP}/status`, { status: { published: { youtube: "https://youtu.be/x" } } });
    expect(published.status, JSON.stringify(published.body)).toBe(200);

    // ── 7. Legacy approval endpoints are gone (410) ────────────────────────────────────────────
    expect((await call("POST", `episodes/${EP}/workflow`, { stage: "script", action: "approve" }, PASS)).status).toBe(410);
    expect((await call("PUT", `episodes/${EP}/script-signoff`, { reviewer: "x", note: "x", confirm: true })).status).toBe(410);
    expect((await call("PUT", `episodes/${EP}/voice-review`, { approve: true })).status).toBe(410);
    expect((await call("PUT", `episodes/${EP}/scene-review`, { id: "c1-s1", status: "ok" })).status).toBe(410);
    expect((await call("POST", "studio-v2/decide", {}, PASS)).status).toBe(410);
    expect((await call("POST", `episodes/${EP}/recitation`, { id: 1 })).status).toBe(410);
    expect((await call("POST", `episodes/${EP}/quran`, {})).status).toBe(410);

    // ── 8. Editing ONE scene re-opens only it and invalidates assembly, Master and publish ─────
    const before = await state();
    const edit = await call("PUT", `episodes/${EP}/plan`, { plan: planOf("الشكر قيد النعم") });
    expect(edit.status).toBe(200);
    const after = await state();
    expect(after.scenes.map((x: any) => [x.id, x.status])).toEqual([["c1-s1", "approved"], ["c1-s2", "needs_revision"], ["c1-s3", "approved"]]);
    expect(after.scenes[0].sourceSha256).toBe(before.scenes[0].sourceSha256);
    expect(after.scenes[2].sourceSha256).toBe(before.scenes[2].sourceSha256);
    expect(after.script.approved).toBe(true);
    expect(after.assembly).toBeNull();
    expect(after.master).toBeNull();
    expect(after.progress).toMatchObject({ currentScene: "c1-s2", canAssemble: false, assemblyApproved: false, masterApproved: false, publishAllowed: false });
    await expect(gate("publish")).rejects.toThrow();
    await expect(gate("master_render")).rejects.toThrow();
    expect((await call("PUT", `episodes/${EP}/status`, { status: { published: { youtube: "https://youtu.be/y" } } })).status).toBe(409);
    // The old Master bytes can never be re-approved against the new inputs.
    expect((await decide({ action: "approve-master", expectedSha256: masterSha, confirmedWatched: true })).status).toBe(409);
    // The changed board must be re-reviewed, then only the edited scene is produced again.
    expect((await render("c1-s2", after.scenes[1].sourceSha256)).status).toBe(409);
    expect((await call("PUT", `episodes/${EP}/storyboard`, { action: "approve", auditNote: "راجعت لوحة المشهد الثاني بعد تعديل نصه وبقية اللوحات كما هي." })).status).toBe(200);
    const reboard = await state();
    expect(reboard.storyboard.approved).toBe(false);
    expect(reboard.scenes.map((x: any) => x.status)).toEqual(["approved", "needs_revision", "approved"]);
    expect((await decide({ action: "approve-storyboard", expectedSha256: reboard.storyboard.sha256 })).status).toBe(200);
    await produceAndApprove("c1-s2");
    const healed = await state();
    expect(healed.progress).toMatchObject({ approvedScenes: 3, canAssemble: true, assemblyApproved: false, publishAllowed: false });
    await assertReadsDoNotWrite("after scene edit");
  }, 300_000);
});
