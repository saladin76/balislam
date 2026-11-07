import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { studioMediaNamespace } from "../src/plan/collect";
import { stageRenderFiles, type RenderStageFile } from "../src/plan/renderStage";
import { mediaSrc, visualNarrationTimings } from "../src/remotion/scenes/Episode";
import type { EpisodeMedia } from "../src/plan/media";
import type { PlanScene } from "../src/plan/types";

const owned: string[] = [];
const scratch = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "studio-render-isolation-"));
  owned.push(root);
  return { root, publicRoot: path.join(root, "public") };
};
const namespace = (root: string, channel: string, episode = "001-demo") =>
  studioMediaNamespace(path.join(root, "channels", channel, "episodes", episode, "script.md")).render;
const imageFile = (source: string, name = "shot.png"): RenderStageFile => ({ kind: "images", name, source });
const staged = (pub: string, rel: string, kind = "images", name = "shot.png") => path.join(pub, rel, kind, name);
afterEach(async () => { for (const root of owned.splice(0)) await rm(root, { recursive: true, force: true }); });

describe("immutable Remotion assets across channels and episodes", () => {
  it("stages the same filename in three channels concurrently without touching other renders", async () => {
    const { root, publicRoot } = await scratch();
    const ids = ["balislam", "dafatir-alzaman", "zubdat-alkutub"];
    const protectedFile = path.join(publicRoot, "_render", "other-episode", "important.mp3");
    await mkdir(path.dirname(protectedFile), { recursive: true });
    await writeFile(protectedFile, "MUST STAY");
    const files = await Promise.all(ids.map(async (id) => {
      const source = path.join(root, id + ".png");
      await writeFile(source, id);
      return imageFile(source);
    }));
    const bases = await Promise.all(ids.map((id, i) => stageRenderFiles(namespace(root, id), [files[i]!], { publicRoot })));
    expect(new Set(bases).size).toBe(3);
    for (let i = 0; i < ids.length; i++) {
      expect(bases[i]).toMatch(new RegExp(`^_render/${ids[i]}/001-demo/[a-f0-9]{24}/$`));
      expect(await readFile(staged(publicRoot, bases[i]!), "utf8")).toBe(ids[i]);
    }
    expect(await readFile(protectedFile, "utf8")).toBe("MUST STAY");
  });

  it("preserves old media revisions after a new same-episode render", async () => {
    const { root, publicRoot } = await scratch();
    const source = path.join(root, "shot.png");
    const ns = namespace(root, "balislam");
    await writeFile(source, "V1");
    const first = await stageRenderFiles(ns, [imageFile(source)], { publicRoot });
    await writeFile(source, "V2");
    const second = await stageRenderFiles(ns, [imageFile(source)], { publicRoot });
    expect(second).not.toBe(first);
    expect(await readFile(staged(publicRoot, first), "utf8")).toBe("V1");
    expect(await readFile(staged(publicRoot, second), "utf8")).toBe("V2");
    // Even another episode with identical scene numbers has a different namespace.
    const third = await stageRenderFiles(namespace(root, "balislam", "002-demo"), [imageFile(source)], { publicRoot });
    expect(third).not.toBe(second);
    expect(await readFile(staged(publicRoot, first), "utf8")).toBe("V1");
  });

  it("deduplicates identical simultaneous snapshots atomically, without stale staging dirs", async () => {
    const { root, publicRoot } = await scratch();
    const source = path.join(root, "shot.png");
    await writeFile(source, "stable pixels");
    const ns = namespace(root, "balislam");
    const results = await Promise.all(Array.from({ length: 6 }, () =>
      stageRenderFiles(ns, [imageFile(source)], { publicRoot })));
    expect(new Set(results).size).toBe(1);
    expect(await readFile(staged(publicRoot, results[0]!), "utf8")).toBe("stable pixels");
    expect((await readdir(path.join(publicRoot, ns))).filter((x) => x.startsWith(".stage-"))).toEqual([]);
  });

  it("cancels only its own in-progress staging and retains a peer's snapshot", async () => {
    const { root, publicRoot } = await scratch();
    const source = path.join(root, "shot.png");
    await writeFile(source, "safe bytes");
    const ns = namespace(root, "balislam");
    const kept = await stageRenderFiles(ns, [imageFile(source)], { publicRoot });
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(stageRenderFiles(ns, [imageFile(source)], { publicRoot, signal: cancelled.signal })).rejects.toThrow(/أُلغيت/);
    // Simulate cancellation just after a copy, before committing a snapshot.
    let reads = 0;
    const inFlight = { get aborted() { return ++reads >= 3; } } as AbortSignal;
    await expect(stageRenderFiles(ns, [imageFile(source)], { publicRoot, signal: inFlight })).rejects.toThrow(/أُلغيت/);
    expect(await readFile(staged(publicRoot, kept), "utf8")).toBe("safe bytes");
    expect((await readdir(path.join(publicRoot, ns))).filter((x) => x.startsWith(".stage-"))).toEqual([]);
  });

  it("refuses traversal, symlink sources, and silently replacing altered old media", async () => {
    const { root, publicRoot } = await scratch();
    const source = path.join(root, "shot.png");
    await writeFile(source, "V1");
    const ns = namespace(root, "balislam");
    await expect(stageRenderFiles(ns, [imageFile(source, "../other.png")], { publicRoot })).rejects.toThrow(/غير آمن/);
    await expect(stageRenderFiles("../_render/wrong/", [imageFile(source)], { publicRoot })).rejects.toThrow(/غير آمن/);
    const link = path.join(root, "external.png");
    await symlink(source, link);
    await expect(stageRenderFiles(ns, [imageFile(link)], { publicRoot })).rejects.toThrow(/غير آمن/);
    const base = await stageRenderFiles(ns, [imageFile(source)], { publicRoot });
    await writeFile(staged(publicRoot, base), "TAMPERED");
    await expect(stageRenderFiles(ns, [imageFile(source)], { publicRoot })).rejects.toThrow(/تغيّر/);
    expect(await readFile(staged(publicRoot, base), "utf8")).toBe("TAMPERED");
  });

  it("Remotion staticFile resolves the owning snapshot in both landscape and mobile layouts", async () => {
    const { root, publicRoot } = await scratch();
    const source = path.join(root, "صورة.png");
    await writeFile(source, "bytes");
    const base = await stageRenderFiles(namespace(root, "zubdat-alkutub"), [imageFile(source, "صورة.png")], { publicRoot });
    const media: EpisodeMedia = { mode: "static", base, voice: {}, sfx: [], recitations: {}, images: ["صورة.png"] };
    const url = mediaSrc(media, "images/صورة.png");
    expect(decodeURIComponent(url)).toContain(base + "images/صورة.png");
    expect(media.mode).toBe("static");
    expect(await readFile(staged(publicRoot, base, "images", "صورة.png"), "utf8")).toBe("bytes");
  });

  it("uses estimated word motion until narration is explicitly approved; leaves recitations untouched", () => {
    const scene = { id: "c1-s1", narration: "هذا اختبار", template: "noor-text" } as PlanScene;
    const clip = { file: "c1-s1.mp3", hash: "hash", text: scene.narration, duration: 3,
      words: [{ word: "هذا", start: 0.25, end: 0.65 }, { word: "اختبار", start: 1.1, end: 1.8 }] };
    const media: EpisodeMedia = {
      mode: "static", base: "_render/balislam/001-demo/abc/", voice: { "c1-s1": clip }, sfx: [],
      recitations: { "2:255": { file: "2-255.mp3", duration: 10, source: "licensed" } },
    };
    expect(visualNarrationTimings(scene, media)).toBeUndefined();
    expect(visualNarrationTimings(scene, media, "estimated")).toBeUndefined();
    expect(visualNarrationTimings(scene, media, "approved")).toEqual([
      { word: "هذا", start: 8, end: 20 }, { word: "اختبار", start: 33, end: 54 },
    ]);
    expect(media.recitations["2:255"]?.duration).toBe(10);
    expect(visualNarrationTimings({ ...scene, narration: "نص مختلف" }, media, "approved")).toBeUndefined();
  });
});
