import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// D226: the worker's gate-free render path (renderComposition) must be unreachable from every normal path,
// and a normal Master (renderEpisode) must still require the scene-first ledger before any bundling.
const bundleCalls = vi.hoisted(() => ({ n: 0 }));
vi.mock("../src/render/bundle", async (orig) => ({
  ...(await orig<typeof import("../src/render/bundle")>()),
  createIsolatedRenderBundle: async () => { bundleCalls.n++; throw new Error("bundle must not be reached"); },
}));
import { renderEpisode } from "../src/render/episode";
import { regeneratePlan } from "../src/plan/io";

const root = path.join(__dirname, "..");
const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = path.join(dir, f);
  if (f === "node_modules" || f.startsWith(".")) return [];
  return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|mts|mjs)$/.test(f) ? [p] : [];
});
const rel = (p: string) => path.relative(root, p).split(path.sep).join("/");
const sources = [...walk(path.join(root, "src")), ...walk(path.join(root, "app")), ...walk(path.join(root, "scripts"))];

describe("D226: the worker-only render is unreachable from normal paths", () => {
  it("only renderEpisode and the worker's untrusted render call renderComposition", () => {
    const users = sources.filter((f) => /\brenderComposition\b/.test(readFileSync(f, "utf8"))).map(rel).sort();
    expect(users).toEqual(["src/render/episode.ts", "src/render/worker/untrustedRender.ts"]);
  });
  it("only the hidden worker-render CLI command imports the untrusted render, and it needs the worker env", () => {
    const users = sources.filter((f) => /(?:from\s+|import\()["'][^"']*worker\/untrustedRender["']/.test(readFileSync(f, "utf8"))).map(rel).sort();
    expect(users).toEqual(["src/cli/index.ts"]);
    const cli = readFileSync(path.join(root, "src/cli/index.ts"), "utf8");
    const block = cli.slice(cli.indexOf('.command("worker-render", { hidden: true })'), cli.indexOf('.command("retention")'));
    expect(block).toContain('process.env.BAL_RENDER_WORKER !== "1"');
    expect(block).toContain("renderWorkerJob");
  });
  it("renderEpisode keeps every Master gate before renderComposition", () => {
    const src = readFileSync(path.join(root, "src/render/episode.ts"), "utf8");
    const body = src.slice(src.indexOf("export const renderEpisode"), src.indexOf("export type RenderCompositionOptions"));
    for (const gate of ["requireScenesReadyForMaster", "requireApprovedQuran", "assertRenderedRecitationsMatchApprovals", "assertMotionStartAuthorized", "assertMasterReady", "assertEpisodeOutputConfined"])
      expect(body, gate).toContain(gate);
    expect(body.indexOf("assertMasterReady(")).toBeLessThan(body.indexOf("renderComposition("));
    // and the core has no way to skip a gate it does not have: no ledger/approval import in it
    const core = src.slice(src.indexOf("export const renderComposition"));
    expect(core.slice(0, core.indexOf("export const cleanMetadata"))).not.toMatch(/sceneService|requireScenes|allowUnreviewed/);
  });
});

let tmp = "";
beforeAll(() => {
  tmp = mkdtempSync(path.join(os.tmpdir(), "bal-worker-gate-"));
  cpSync(path.join(root, "channels", "balislam"), path.join(tmp, "balislam"), { recursive: true, filter: (s) => !/[\\/](episodes|voice|out|recitations|images)([\\/]|$)/.test(s) });
  mkdirSync(path.join(tmp, "balislam", "episodes"), { recursive: true });
  cpSync(path.join(root, "tests", "fixtures", "episodes", "000-demo"), path.join(tmp, "balislam", "episodes", "000-demo"), { recursive: true });
  process.env.BAL_CHANNELS_DIR = tmp;
  process.env.BAL_CHANNEL = "balislam";
});
afterAll(() => {
  delete process.env.BAL_CHANNELS_DIR;
  delete process.env.BAL_CHANNEL;
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

describe("D226: a normal Master short still requires the ledger", () => {
  it("renderEpisode portrait master (the package --shorts call) is refused before any bundle", async () => {
    process.env.BAL_WORKFLOW_HMAC_KEY ??= "LOCAL_TEST_ONLY__worker_gate_key_2026";
    const plan = await regeneratePlan("000");
    const ids = plan.chapters.flatMap((c) => c.scenes).map((s) => s.id).slice(0, 2);
    await expect(renderEpisode({
      episode: "000", orientation: "portrait", quality: "master", plan, segment: { sceneIds: ids }, shortTitle: "سؤال",
      media: { mode: "static", base: "_render/balislam/000-demo/0123456789abcdef01234567/", voice: {}, sfx: [], recitations: {} },
    })).rejects.toThrow(/must be approved|Approve and assemble|owner session|السكريبت|اعتماد|المصادر|ledger|Malformed|signing/i);
    expect(bundleCalls.n).toBe(0);
  }, 30000);
});
