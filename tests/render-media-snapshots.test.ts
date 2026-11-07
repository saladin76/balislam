import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { stageRemotionPublicDir } from "../src/render/bundle";
import { studioMediaNamespace, assertManualRecitationIntegration } from "../src/plan/collect";
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

  it("rejects symlinked source ancestors and public namespace ancestors", async () => {
    const { root, publicRoot } = await scratch();
    const images = path.join(root, "images");
    const foreign = path.join(root, "foreign");
    await mkdir(images);
    await mkdir(foreign);
    await writeFile(path.join(foreign, "secret.png"), "OUTSIDE");
    await symlink(foreign, path.join(images, "linked"));
    const ns = namespace(root, "balislam");
    await expect(stageRenderFiles(ns, [imageFile(path.join(images, "linked", "secret.png"))], { publicRoot })).rejects.toThrow(/غير آمن/);
    expect(await readFile(path.join(foreign, "secret.png"), "utf8")).toBe("OUTSIDE");
    const rootWithLink = path.join(root, "linked-public");
    await mkdir(rootWithLink);
    await symlink(foreign, path.join(rootWithLink, "_render"));
    const valid = path.join(foreign, "secret.png");
    await expect(stageRenderFiles(ns, [imageFile(valid)], { publicRoot: rootWithLink })).rejects.toThrow(/غير آمن/);
  });

  it("detects extra and missing files in an already-published snapshot", async () => {
    const { root, publicRoot } = await scratch();
    const source = path.join(root, "shot.png");
    await writeFile(source, "V1");
    const ns = namespace(root, "balislam");
    const base = await stageRenderFiles(ns, [imageFile(source)], { publicRoot });
    await writeFile(path.join(publicRoot, base, "images", "unlisted.png"), "INJECTED");
    await expect(stageRenderFiles(ns, [imageFile(source)], { publicRoot })).rejects.toThrow(/تغيّرت/);
    expect(await readFile(staged(publicRoot, base), "utf8")).toBe("V1");
  });

  it("fails closed when a shared public asset has a nested symlink", async () => {
    const { root, publicRoot } = await scratch();
    const shared = path.join(publicRoot, "fonts", "deep");
    await mkdir(shared, { recursive: true });
    const foreign = path.join(root, "private");
    await mkdir(foreign);
    await writeFile(path.join(foreign, "do-not-read.txt"), "SECRET");
    await symlink(foreign, path.join(shared, "linked"));
    await expect(stageRemotionPublicDir({ mode: "url", base: "", voice: {}, sfx: [], recitations: {} }, { publicRoot, tempRoot: root }))
      .rejects.toThrow(/غير آمن|رمزي/);
    expect((await readdir(root)).filter((name) => name.startsWith("studio-remotion-public-"))).toEqual([]);
    expect(await readFile(path.join(foreign, "do-not-read.txt"), "utf8")).toBe("SECRET");
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

  it("Remotion's bundled publicDir excludes other channels and keeps shared fonts", async () => {
    const { root, publicRoot } = await scratch();
    await mkdir(path.join(publicRoot, "fonts"), { recursive: true });
    await writeFile(path.join(publicRoot, "fonts", "common.woff2"), "SHARED");
    await writeFile(path.join(publicRoot, "accidental-private.mp3"), "NEVER BUNDLE");
    const one = path.join(root, "one.png");
    const two = path.join(root, "two.png");
    await writeFile(one, "EPISODE ONE");
    await writeFile(two, "EPISODE TWO");
    const own = await stageRenderFiles(namespace(root, "balislam"), [imageFile(one)], { publicRoot });
    const foreign = await stageRenderFiles(namespace(root, "dafatir-alzaman"), [imageFile(two)], { publicRoot });
    const media: EpisodeMedia = { mode: "static", base: own, voice: {}, sfx: [], recitations: {} };
    const scope = await stageRemotionPublicDir(media, { publicRoot, tempRoot: root });
    try {
      expect(await readFile(staged(scope.dir, own), "utf8")).toBe("EPISODE ONE");
      expect(await readFile(path.join(scope.dir, "fonts", "common.woff2"), "utf8")).toBe("SHARED");
      expect(existsSync(path.join(scope.dir, "accidental-private.mp3"))).toBe(false);
      expect(existsSync(path.join(scope.dir, foreign))).toBe(false);
      expect(existsSync(path.join(scope.dir, "_render", "dafatir-alzaman"))).toBe(false);
    } finally {
      await scope.cleanup();
    }
    expect(existsSync(scope.dir)).toBe(false);
    await expect(stageRemotionPublicDir({ ...media, base: "../other/" }, { publicRoot, tempRoot: root }))
      .rejects.toThrow(/غير معزول/);
    expect((await readdir(root)).filter((name) => name.startsWith("studio-remotion-public-"))).toEqual([]);
  });

  it("stages private media outside shared public and bundles only the selected channel", async () => {
    const { root, publicRoot } = await scratch();
    const mediaRoot = path.join(root, "private-media");
    await mkdir(path.join(publicRoot, "fonts"), { recursive: true });
    await writeFile(path.join(publicRoot, "fonts", "font.woff2"), "SHARED");
    const source = path.join(root, "narration.mp3");
    await writeFile(source, "PRIVATE VOICE BYTES");
    const base = await stageRenderFiles(namespace(root, "balislam"), [
      { kind: "voice", name: "c1-s1.mp3", source },
    ], { publicRoot: mediaRoot });
    expect(existsSync(path.join(publicRoot, base))).toBe(false);
    const media: EpisodeMedia = { mode: "static", base, voice: {}, sfx: [], recitations: {} };
    const scope = await stageRemotionPublicDir(media, { publicRoot, mediaRoot, tempRoot: root });
    try {
      expect(await readFile(path.join(scope.dir, base, "voice", "c1-s1.mp3"), "utf8"))
        .toBe("PRIVATE VOICE BYTES");
      expect(await readFile(path.join(scope.dir, "fonts", "font.woff2"), "utf8")).toBe("SHARED");
    } finally { await scope.cleanup(); }
    expect(existsSync(scope.dir)).toBe(false);
  });

  it("refuses any unmanifested file at the snapshot root before copying to Remotion", async () => {
    const { root, publicRoot } = await scratch();
    const src = path.join(root, "shot.png");
    await writeFile(src, "safe");
    const base = await stageRenderFiles(namespace(root, "zubdat-alkutub"), [imageFile(src)], { publicRoot });
    await writeFile(path.join(publicRoot, base, ".hidden-secret"), "UNDECLARED");
    const media: EpisodeMedia = { mode: "static", base, voice: {}, sfx: [], recitations: {} };
    await expect(stageRemotionPublicDir(media, { publicRoot, tempRoot: root }))
      .rejects.toThrow(/جذر لقطة الوسائط/);
    expect((await readdir(root)).filter((name) => name.startsWith("studio-remotion-public-"))).toEqual([]);
    expect(await readFile(path.join(publicRoot, base, ".hidden-secret"), "utf8")).toBe("UNDECLARED");
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
  it("fails closed on a manual Quran index even if an older licensed or QF pointer exists", () => {
    const plan = { chapters: [{ scenes: [
      { id: "c1-s1", template: "verse-card", ayahKey: "53:39" },
    ] }] } as never;
    expect(() => assertManualRecitationIntegration({
      "53:39": { provider: "manual" },
    }, plan)).toThrow(/PR #76/);
    expect(() => assertManualRecitationIntegration({
      "53:39": { provider: "quran-foundation" },
    }, plan)).not.toThrow();
    expect(() => assertManualRecitationIntegration({
      "2:255": { provider: "manual" },
    }, plan)).not.toThrow();
  });

});
