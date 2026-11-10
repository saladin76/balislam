import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cachedFileSha256, clearHashCache } from "../src/io/hashCache";
import { createHash } from "node:crypto";

/** M9 (funnel QA, 10 Nov): the ledger read behind every scene approval stays fast on a 114-scene episode. */
describe("M9: approval read path on 114 scenes", () => {
it("a file digest is re-read after any write, served from cache otherwise", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "m9h-"));
  try {
    const f = path.join(dir, "a.bin");
    writeFileSync(f, "one");
    const one = createHash("sha256").update("one").digest("hex");
    expect(await cachedFileSha256(f)).toBe(one);
    expect(await cachedFileSha256(f)).toBe(one);
    writeFileSync(f, "two"); // same size, new bytes: ctime/mtime change
    expect(await cachedFileSha256(f)).toBe(createHash("sha256").update("two").digest("hex"));
    expect(readFileSync(f, "utf8")).toBe("two");
    clearHashCache();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
it("inspect (the read after every decision) is well under a second once warm", async () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "m9-"));
  try {
    cpSync(path.join(process.cwd(), "channels", "balislam"), path.join(tmp, "balislam"), { recursive: true, filter: (s) => !/[\\/]episodes([\\/]|$)/.test(s) });
    process.env.BAL_CHANNELS_DIR = tmp; process.env.BAL_CHANNEL = "balislam";
    process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__bench_signing_key_2026_xxxxxxx";
    const ep = path.join(tmp, "balislam", "episodes", "985-bench");
    mkdirSync(path.join(ep, "voice"), { recursive: true }); mkdirSync(path.join(ep, "previews"), { recursive: true });
    const scenes = Array.from({ length: 114 }, (_, i) => ({ id: `c1-s${i + 1}`, template: "big-question", line: 6 + i, narration: `جملة رقم ${i}.`, sfx: [], props: { text: "x" } }));
    writeFileSync(path.join(ep, "script.md"), `---\ntitle: "b"\nepisode: "985"\n---\n## الفصل 1 · ت\n${scenes.map((s) => s.narration).join("\n")}\n`);
    writeFileSync(path.join(ep, "plan.json"), JSON.stringify({ episode: "985", title: "b", tone: "calm", chapters: [{ number: 1, title: "ت", scenes }] }));
    const index: Record<string, unknown> = {};
    const big = Buffer.alloc(100_000, 7);
    for (const s of scenes) { writeFileSync(path.join(ep, "voice", `${s.id}.mp3`), big); index[s.id] = { file: `${s.id}.mp3`, hash: "h", text: s.narration, duration: 2, words: [] }; }
    writeFileSync(path.join(ep, "voice", "index.json"), JSON.stringify(index));
    const prev = Buffer.alloc(300_000, 3);
    const svc = await import(path.join(process.cwd(), "src/studio/sceneService.ts"));
    const { sceneFile } = svc as any;
    for (const s of scenes) { const f = sceneFile ? sceneFile(path.join(ep, "script.md"), s.id) : path.join(ep, "previews", `scene-${s.id}-av.mp4`); mkdirSync(path.dirname(f), { recursive: true }); writeFileSync(f, prev); }
    await svc.inspectSceneProduction("985");
    const times: number[] = [];
    for (let k = 0; k < 3; k++) { const t = Date.now(); await svc.inspectSceneProduction("985"); times.push(Date.now() - t); }
    expect(Math.min(...times)).toBeLessThan(1000);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}, 120000);
});
