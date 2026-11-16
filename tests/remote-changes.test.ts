/**
 * D148 (KI-074): «تعديلات المحادثات تظهر في الاستوديو». An edit a channel conversation pushes to main reaches the owner's
 * studio by the automatic receive (D101); videos never do. The studio must say which scene changed, flag its old video,
 * and say plainly when updates did not arrive. A bare «GitHub», the owner's Mac clone and a «cloud» clone pushing.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanGitEnv } from "../scripts/git-env.mjs";
import { isOwnerContentPath } from "../scripts/contentPaths.mjs";
import { createContentSync } from "../app/server/contentSync";
import { parseSceneTrailers, readRemoteChanges, recordRemoteChanges, remoteChangeFor, remoteEngineTokens } from "../src/studio/remoteChanges";
import { remoteChangeLine, REMOTE_CHANGE_PRODUCE } from "../app/src/workspace/sceneProduction/remoteChange";
import { shouldReloadForUpdate } from "../app/src/ui/SyncBadge";

const gitEnv = cleanGitEnv();
const g = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.email=t@example.invalid", "-c", "user.name=T", ...args], { cwd, env: gitEnv }).toString().trim();
const dirs: string[] = [];
beforeEach(() => { const b = mkdtempSync(path.join(os.tmpdir(), "bal-remote-backup-")); dirs.push(b); process.env.BAL_UPDATE_BACKUP_DIR = b; });
afterEach(() => { delete process.env.BAL_UPDATE_BACKUP_DIR; for (const d of dirs.splice(0)) rmSync(d, { force: true, recursive: true }); });
const write = (root: string, rel: string, text: string) => { mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); writeFileSync(path.join(root, rel), text); };

// A synthetic episode in a temporary repository (never the owner's content): owner-pin-ok for every literal below.
const EP = ["channels", "zubdat-alkutub", "episodes", "001-awwal"].join("/");
const plan = (over: Record<string, unknown> = {}) => JSON.stringify({ chapters: [{ title: "ف", scenes: [
  { id: "c1-s1", narration: "أ", template: "ink", ...(over["c1-s1"] as object ?? {}) },
  { id: "c1-s2", narration: "ب", template: "ink", ...(over["c1-s2"] as object ?? {}) },
  { id: "c1-s3", narration: "ج", template: "ink", ...(over["c1-s3"] as object ?? {}) },
] }] }, null, 2) + "\n";

const setup = () => {
  const base = mkdtempSync(path.join(os.tmpdir(), "bal-remote-"));
  dirs.push(base);
  const remote = path.join(base, "remote.git");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", remote], { env: gitEnv });
  const cloud = path.join(base, "cloud");
  execFileSync("git", ["clone", "-q", remote, cloud], { env: gitEnv });
  g(cloud, "checkout", "-q", "-b", "main");
  write(cloud, ".gitignore", ".studio/\nchannels/*/episodes/*/notes/inbox.json\n");
  write(cloud, `${EP}/plan.json`, plan());
  write(cloud, `${EP}/script.md`, "نص\n");
  write(cloud, "src/remotion/zubdat/shots.tsx", "export const a = 1;\n");
  g(cloud, "add", "-A"); g(cloud, "commit", "-qm", "init"); g(cloud, "push", "-q", "origin", "main");
  const mac = path.join(base, "mac");
  execFileSync("git", ["clone", "-q", "-b", "main", remote, mac], { env: gitEnv });
  // The owner's notes box on his Mac (local, never in Git): his note n1 was about scene c1-s3.
  write(mac, `${EP}/notes/inbox.json`, JSON.stringify({ schemaVersion: 1, notes: [{ id: "n1", sceneId: "c1-s3" }] }));
  const push = (message: string, files: Record<string, string>) => {
    for (const [f, t] of Object.entries(files)) write(cloud, f, t);
    g(cloud, "add", "-A"); g(cloud, "commit", "-qm", message); g(cloud, "push", "-q", "origin", "main");
  };
  return { base, remote, cloud, mac, push };
};
const sync = (root: string, extra: Parameters<typeof createContentSync>[1] = {}) =>
  createContentSync(root, { enabled: true, quietMs: 0, log: () => {}, ...extra });

describe("D148: what a conversation changed reaches the scene it changed", { timeout: 120_000 }, () => {
  it("plan, renderer code named by `Studio-Scenes:`, and «أُصلحت» on the owner's note: each scene is named", async () => {
    const r = setup();
    const from = g(r.mac, "rev-parse", "HEAD");
    r.push("زبدة الكتب 001: حركة المشهد الثاني", { [`${EP}/plan.json`]: plan({ "c1-s2": { props: { motion: "new" } } }) });
    r.push("زبدة الكتب 001 c1-s1: الجملة الأولى برسماتها\n\nStudio-Scenes: zubdat-alkutub/001: c1-s1", { "src/remotion/zubdat/shots.tsx": "export const a = 2;\n" });
    r.push("رد على ملاحظة المالك", { [`${EP}/notes/resolved.json`]: JSON.stringify({ schemaVersion: 1, resolutions: { n1: { status: "fixed", answer: "أُصلح المشهد", fixedBy: "abc", at: "2026-11-14T18:00:00Z" } } }) });
    r.push("حفظ الاستوديو: زبدة الكتب 001: السكريبت", { [`${EP}/script.md`]: "نص المالك\n" });
    g(r.mac, "pull", "-q", "--ff-only");
    const to = g(r.mac, "rev-parse", "HEAD");
    const sum = await recordRemoteChanges(r.mac, from, to, "2026-11-14T20:00:00.000Z");
    const doc = await readRemoteChanges(path.join(r.mac, EP));
    expect(Object.keys(doc.scenes).sort()).toEqual(["c1-s1", "c1-s2", "c1-s3"]);
    expect(doc.scenes["c1-s2"]!.what).toEqual(["plan"]);
    expect(doc.scenes["c1-s1"]!.what).toEqual(["engine"]);
    expect(doc.scenes["c1-s3"]!).toMatchObject({ what: ["engine"], answer: "أُصلح المشهد" });
    // Only code changes that the scene's content cannot show carry a permanent engine marker.
    expect(Object.keys(await remoteEngineTokens(path.join(r.mac, EP))).sort()).toEqual(["c1-s1", "c1-s3"]);
    // The studio's own save is the owner's work, never «from the conversation».
    expect(sum.commits.some((s) => s.startsWith("حفظ الاستوديو"))).toBe(false);
    expect(doc.episode.some((e) => e.what.includes("script"))).toBe(false);
    const labels = sum.items.map((x) => x.label);
    expect(labels).toContain("زبدة الكتب 001: المشهد ١، المشهد ٢، المشهد ٣ — الخطة (الرسوم والحركة)، الرسوم");
    // The code commit named its scene, so it is not said again as «للقناة كلها».
    expect(labels).toHaveLength(1);
    // The record is local: never content, never in Git.
    expect(g(r.mac, "status", "--porcelain")).toBe("");
    // Recording the same arrival again keeps one marker per change (stable fingerprint).
    await recordRemoteChanges(r.mac, from, to, "2026-11-14T20:05:00.000Z");
    expect((await remoteEngineTokens(path.join(r.mac, EP)))["c1-s1"]).toHaveLength(1);
  });

  it("renderer code with no scene named is said once for the channel, and flags no scene", async () => {
    const r = setup();
    const from = g(r.mac, "rev-parse", "HEAD");
    r.push("تحسين حبر زبدة الكتب", { "src/remotion/zubdat/shots.tsx": "export const a = 3;\n" });
    g(r.mac, "pull", "-q", "--ff-only");
    const sum = await recordRemoteChanges(r.mac, from, g(r.mac, "rev-parse", "HEAD"));
    expect(sum.items.map((x) => x.label)).toEqual(["زبدة الكتب: الرسوم للقناة كلها (لم يُسمَّ مشهد)"]);
    expect(await remoteEngineTokens(path.join(r.mac, EP))).toEqual({});
  });

  it("the local record is never content and is ignored by Git in the repository", () => {
    const rel = ["channels", "zubdat-alkutub", "episodes", "001-x", ".studio", "remote-changes.json"].join("/"); // owner-pin-ok: a path, not content
    expect(isOwnerContentPath(rel)).toBe(false);
    const root = path.resolve(import.meta.dirname, "..");
    expect(spawnSync("git", ["check-ignore", "-q", "--no-index", rel], { cwd: root, env: gitEnv }).status).toBe(0);
  });

  it("the scene's line shows only while its video is older than the change, and says what to press", () => {
    const doc = { schemaVersion: 1 as const, episode: [], engine: {},
      scenes: { "c1-s1": { at: "2026-11-14T20:00:00.000Z", commit: "x", subjects: [], what: ["engine" as const] },
        "c1-s2": { at: "2026-11-14T20:00:00.000Z", commit: "x", subjects: [], what: ["voice" as const] } } };
    const at = Date.parse("2026-11-14T20:00:00.000Z");
    expect(remoteChangeFor(doc, "c1-s1", at - 1000)).toBeTruthy();
    expect(remoteChangeFor(doc, "c1-s1", at + 1000), "re-produced after it arrived").toBeNull();
    expect(remoteChangeFor(doc, "c1-s1", null), "no video: nothing old to flag").toBeNull();
    expect(remoteChangeFor(doc, "c1-s3", at - 1000)).toBeNull();
    expect(remoteChangeLine({ at: "", subjects: [], what: ["plan"] })).toBe("وصل تعديل من المحادثة على هذا المشهد (الرسوم والحركة) — اضغط «أنتج هذا المشهد» لترى الجديد");
    expect(REMOTE_CHANGE_PRODUCE).toContain("وصل تعديل من المحادثة على هذا المشهد");
    // A pronunciation change needs the owner's «ولّد» first (paid; never automatic).
    expect(remoteChangeLine({ at: "", subjects: [], what: ["voice"] })).toContain("ولّد الجملة من «الجمل» ثم اضغط «أنتج هذا المشهد»");
  });

  it("parses `Studio-Scenes:` lines (folder or number; Arabic or Latin commas)", () => {
    expect(parseSceneTrailers("x\n\nStudio-Scenes: zubdat-alkutub/001: c1-s1، c1-s2\nStudio-Scenes: balislam/002-x: c2-s4")).toEqual([
      { channel: "zubdat-alkutub", episode: "001", scenes: ["c1-s1", "c1-s2"] },
      { channel: "balislam", episode: "002-x", scenes: ["c2-s4"] },
    ]);
    expect(parseSceneTrailers("Studio-Scenes: nothing")).toEqual([]);
  });
});

describe("D148: the receive is visible in the studio", { timeout: 120_000 }, () => {
  it("a received conversation edit is listed with its episode and scene", async () => {
    const r = setup();
    r.push("زبدة الكتب 001: حركة المشهد الثاني", { [`${EP}/plan.json`]: plan({ "c1-s2": { props: { motion: "new" } } }) });
    const s = sync(r.mac);
    await s.tick(true);
    expect(s.state.state).toBe("synced");
    expect(s.state.lastUpdateAt).toBeTruthy();
    expect(s.state.receiveError).toBeUndefined();
    expect(s.state.lastReceived?.items.map((x) => x.label)).toEqual(["زبدة الكتب 001: المشهد ٢ — الخطة (الرسوم والحركة)"]);
    expect(readFileSync(path.join(r.mac, EP, "plan.json"), "utf8")).toContain("\"motion\": \"new\"");
  });

  it("offline: «لم تصل التحديثات» with the reason, never «محفوظ في كل الأماكن»; then it clears by itself", async () => {
    const r = setup();
    r.push("زبدة الكتب 001: حركة المشهد الثاني", { [`${EP}/plan.json`]: plan({ "c1-s2": { props: { motion: "new" } } }) });
    g(r.mac, "remote", "set-url", "origin", path.join(r.base, "missing.git"));
    const s = sync(r.mac);
    await s.tick(true);
    expect(s.state.state).toBe("behind");
    expect(s.state.receiveError).toContain("تعذّر الوصول إلى GitHub");
    expect(s.state.message).toContain("لم تصل التحديثات إلى هذا الجهاز");
    expect(s.state.lastCheckAt).toBeTruthy();
    g(r.mac, "remote", "set-url", "origin", r.remote);
    await s.tick(true);
    expect(s.state.state).toBe("synced");
    expect(s.state.receiveError).toBeUndefined();
  });

  it("a local commit on the Mac (diverged main) is said in Arabic, and nothing is written", async () => {
    const r = setup();
    r.push("تعديل", { [`${EP}/plan.json`]: plan({ "c1-s1": { props: { x: 1 } } }) });
    write(r.mac, "local.txt", "x\n");
    g(r.mac, "add", "local.txt"); g(r.mac, "commit", "-qm", "local");
    const head = g(r.mac, "rev-parse", "HEAD");
    const s = sync(r.mac);
    await s.tick(true);
    expect(s.state.state).toBe("behind");
    expect(s.state.receiveError).toContain("متباعد");
    expect(g(r.mac, "rev-parse", "HEAD")).toBe(head);
  });

  it("a server-code update that arrived during a render restarts once the studio is idle", async () => {
    const r = setup();
    r.push("كود الخادم", { "app/server/x.ts": "export {}\n" });
    let busy = true;
    let restarted = 0;
    const prev = process.env.BAL_STUDIO_SUPERVISED;
    process.env.BAL_STUDIO_SUPERVISED = "1";
    try {
      const s = sync(r.mac, { canRestart: () => !busy, onRestart: () => { restarted++; } });
      await s.tick(true);
      expect(s.state.restartNeeded).toBe(true);
      expect(s.state.restartPending).toBeFalsy();
      busy = false;
      await s.tick();
      expect(s.state.restartPending).toBe(true);
      await new Promise((res) => setTimeout(res, 1_700));
      expect(restarted).toBe(1);
    } finally {
      if (prev === undefined) delete process.env.BAL_STUDIO_SUPERVISED; else process.env.BAL_STUDIO_SUPERVISED = prev;
    }
  });

  it("the page reloads after an update unless a restart is coming (it used to stop reloading after a server update)", () => {
    expect(shouldReloadForUpdate("a", { lastUpdateAt: "b" })).toBe(true);
    expect(shouldReloadForUpdate("a", { lastUpdateAt: "b", restartPending: true })).toBe(false);
    expect(shouldReloadForUpdate("a", { lastUpdateAt: "a" })).toBe(false);
    expect(shouldReloadForUpdate(null, { lastUpdateAt: "b" })).toBe(false);
  });
});
