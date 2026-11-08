import { describe, expect, it } from "vitest";
import {
  renderSceneV2, sceneV2OutputName, validateSceneV2Request,
  type SceneRenderRequestV2, type SceneSoundV2,
} from "../src/render/sceneV2";

const H = "a".repeat(64);
const audio = (kind: SceneSoundV2["kind"], startSec = 0): SceneSoundV2 => ({
  kind, startSec, durationSec: 1,
  volume: kind === "sfx" ? 0.2 : 1,
  file: "/trusted/episode/audio.wav", sha256: H,
  ...(kind === "narrator" ? { words: [{ word: "اختبار", start: 0, end: 0.8 }] } : {}),
});
const request = (mode: SceneRenderRequestV2["mode"], sounds: SceneSoundV2[]):
  SceneRenderRequestV2 => ({
    channelsRoot: "/trusted", channel: "balislam",
    episode: "001-test-render", sceneId: "c1-s0", planSha256: H,
    mode, orientation: "landscape", width: 640, height: 360,
    fps: 30, durationSec: 2, sounds, pictures: [],
    ...(sounds.some((s) => s.kind === "recitation") ? {
      recitationEvidence: { origin: "owner-upload" as const, sha256: H, recordId: "owner-record-1" },
    } : {}),
  });

describe("Studio V2 render boundary", () => {
  it("permits honest silence (zero audio files; no placeholder MP3)", () => {
    expect(() => validateSceneV2Request(request("silent", []))).not.toThrow();
  });
  it("supports pinned narration and timestamped voice", () => {
    expect(() => validateSceneV2Request(request("narrated", [audio("narrator")]))).not.toThrow();
  });
  it("requires owner-provided, pinned human recitation evidence", () => {
    const good = request("recitation", [audio("recitation")]);
    expect(() => validateSceneV2Request(good)).not.toThrow();
    expect(() => validateSceneV2Request({ ...good, recitationEvidence: undefined }))
      .toThrow(/owner-upload/);
  });
  it("allows a non-overlapping mixed performance", () => {
    expect(() => validateSceneV2Request(request("mixed",
      [audio("recitation"), audio("narrator", 1.2)]))).not.toThrow();
  });
  it("rejects overlapping recitation and narrator", () => {
    expect(() => validateSceneV2Request(request("mixed",
      [audio("narrator", 0), audio("recitation", 0.5)]))).toThrow(/overlap/);
  });
  it("rejects mismatched sound policy and arbitrary image paths", () => {
    expect(() => validateSceneV2Request(request("narrated", []))).toThrow(/mode/);
    expect(() => validateSceneV2Request({ ...request("silent", []),
      pictures: [{ file: "/tmp/malicious", ref: "../wrong", sha256: H }] }))
      .toThrow(/picture/);
  });
  it("reports cancellation without touching an episode or faking approval", async () => {
    const abort = new AbortController();
    abort.abort();
    const result = await renderSceneV2(request("silent", []), {
      ffprobeBinary: "/bin/ffprobe", signal: abort.signal,
      withProductionLease: async (_scene, work) => work(),
      withArtifactLock: async (work) => work(),
      assertCanRender: async () => { throw Error("MUST NOT BE CALLED"); },
    });
    expect(result.status).toBe("cancelled");
    expect(result).not.toHaveProperty("file");
  });
  it("returns typed failed state for invalid mode before any filesystem changes", async () => {
    const result = await renderSceneV2(request("narrated", []), {
      ffprobeBinary: "/bin/ffprobe",
      withProductionLease: async (_scene, work) => work(),
      withArtifactLock: async (work) => work(),
      assertCanRender: async () => { throw Error("MUST NOT BE CALLED"); },
    });
    expect(result.status).toBe("failed");
    expect(result).not.toHaveProperty("file");
  });
  it("fails closed under V2 enforcement without signed Backend publication callback", async () => {
    const saved = process.env.STUDIO_V2_ENFORCE;
    process.env.STUDIO_V2_ENFORCE = "1";
    try {
      const result = await renderSceneV2(request("silent", []), {
        ffprobeBinary: "/usr/bin/ffprobe",
        withProductionLease: async (_scene, work) => work(),
        withArtifactLock: async (work) => work(),
        assertCanRender: async () => { throw Error("SHOULD NOT REACH IO"); },
      });
      expect(result.status).toBe("failed");
      if (result.status === "failed")
        expect(result.reason).toMatch(/signed-manifest registration/);
    } finally {
      if (saved === undefined) delete process.env.STUDIO_V2_ENFORCE;
      else process.env.STUDIO_V2_ENFORCE = saved;
    }
  });
  it("uses immutable unique output names, never an approved fixed slot", () => {
    expect(sceneV2OutputName("c1-s0", H, "id-one"))
      .toBe("c1-s0-aaaaaaaaaaaa-id-one.mp4");
    expect(sceneV2OutputName("c1-s0", H, "id-one"))
      .not.toBe(sceneV2OutputName("c1-s0", H, "id-two"));
  });
});
