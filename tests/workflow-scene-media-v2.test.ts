import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { chmod, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { WorkflowIdentity } from "../src/workflow/store";
import type { SceneFileManifestV2, SceneAudioModeV2 } from "../src/workflow/sceneArtifactsV2";
import { probeSceneAvLockedV2 } from "../src/workflow/sceneMediaV2";

const roots: string[] = [];
const valid = {
  format: { format_name: "mov,mp4,m4a,3gp,3g2,mj2", duration: "12.25" },
  streams: [
    { codec_type: "video", codec_name: "h264", width: 1920, height: 1080 },
    { codec_type: "audio", codec_name: "aac", channels: 2 },
  ],
};
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const fixture = async (mode: SceneAudioModeV2 = "narrated") => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-v2-media-"));
  roots.push(root);
  const scope: WorkflowIdentity = {
    channelsRoot: root, channel: "balislam", episode: "001-media-check",
  };
  const dir = path.join(root, "balislam", "episodes", "001-media-check");
  await mkdir(path.join(dir, "previews"), { recursive: true });
  const media = path.join(dir, "previews", "c1-s1.mp4");
  await writeFile(media, Buffer.from("MP4 bytes stub; tool subprocess mocked only"));
  const bin = path.join(root, "ffprobe-fixture");
  const manifest = {
    sceneId: "c1-s1",
    audioMode: mode,
    inputs: { video: { version: "v1", files: ["previews/c1-s1.mp4"] } },
  } as SceneFileManifestV2;
  const setBinary = async (script: string) => {
    await writeFile(bin, "#!/usr/bin/env node\n" + script + "\n", { mode: 0o700 });
    await chmod(bin, 0o700);
  };
  const ok = async (metadata: unknown = valid) => {
    await setBinary("process.stdout.write(" + JSON.stringify(JSON.stringify(metadata)) + ");");
  };
  await ok();
  const probe = () => probeSceneAvLockedV2(scope, manifest, { ffprobeBinary: bin, timeoutMs: 1000 });
  return { root, dir, media, bin, scope, manifest, probe, setBinary, ok };
};
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Studio V2 — actual MP4 stream probing (mocked subprocess)", () => {
  it("binds reported video and narrated audio streams to exact MP4 SHA and OS epoch", async () => {
    const x = await fixture();
    const r = await x.probe();
    expect(r).toMatchObject({
      videoCodec: "h264", durationSec: 12.25,
      width: 1920, height: 1080,
      hasAudio: true, audioCodec: "aac", audioChannels: 2,
    });
    expect(r.sha256).toBe(sha(await readFile(x.media)));
    expect(r.epoch).toMatch(/^[a-f0-9]{64}$/);
  });

  it("accepts genuine video-only metadata when scene policy is silent", async () => {
    const x = await fixture("silent");
    await x.ok({ ...valid, streams: [valid.streams[0]] });
    const r = await x.probe();
    expect(r.hasAudio).toBe(false);
    expect(r.audioCodec).toBeUndefined();
  });

  it("permits ambient audio on a non-narrated scene without claiming spoken narration", async () => {
    const x = await fixture("silent");
    const r = await x.probe();
    expect(r.hasAudio).toBe(true);
  });

  it("refuses an MP4 with no real video stream", async () => {
    const x = await fixture();
    await x.ok({ ...valid, streams: [valid.streams[1]] });
    await expect(x.probe()).rejects.toThrow(/video stream/);
  });

  it("refuses soundless MP4 for required narrator, human recitation or mixed speech", async () => {
    for (const mode of ["narrated", "recitation", "mixed"] as const) {
      const x = await fixture(mode);
      await x.ok({ ...valid, streams: [valid.streams[0]] });
      await expect(x.probe()).rejects.toThrow(/missing its audio track/);
    }
  });

  it("refuses a mislabeled Matroska container even if filename ends with .mp4", async () => {
    const x = await fixture();
    await x.ok({ ...valid, format: { format_name: "matroska,webm", duration: "12.25" } });
    await expect(x.probe()).rejects.toThrow(/actual MP4 container/);
  });

  it("rejects zero-length, nonfinite and implausibly long video durations", async () => {
    const x = await fixture();
    for (const duration of ["0", "NaN", "999999999"]) {
      await x.ok({ ...valid, format: { ...valid.format, duration } });
      await expect(x.probe()).rejects.toThrow(/valid positive duration/);
    }
  });

  it("rejects malformed dimensions, unknown video codec and missing stream metadata", async () => {
    const x = await fixture();
    await x.ok({ ...valid, streams: [
      { codec_type: "video", codec_name: "h264", width: 0, height: 1080 },
      valid.streams[1],
    ] });
    await expect(x.probe()).rejects.toThrow(/dimensions/);
    await x.ok({ ...valid, streams: [
      { codec_type: "video", codec_name: "unknown", width: 1920, height: 1080 },
      valid.streams[1],
    ] });
    await expect(x.probe()).rejects.toThrow(/video stream/);
    await x.ok({ format: valid.format, streams: [] });
    await expect(x.probe()).rejects.toThrow(/video stream/);
  });

  it("rejects invalid audio stream channels or unrecognized audio codec", async () => {
    const x = await fixture();
    await x.ok({ ...valid, streams: [valid.streams[0],
      { codec_type: "audio", codec_name: "aac", channels: 0 },
    ] });
    await expect(x.probe()).rejects.toThrow(/audio stream is invalid/);
    await x.ok({ ...valid, streams: [valid.streams[0],
      { codec_type: "audio", codec_name: "unknown", channels: 2 },
    ] });
    await expect(x.probe()).rejects.toThrow(/audio stream is invalid/);
  });

  it("detects actual file edits performed during an ffprobe subprocess", async () => {
    const x = await fixture();
    await x.setBinary(
      "require('node:fs').appendFileSync(process.argv.at(-1), 'changed while probing');\n" +
      "process.stdout.write(" + JSON.stringify(JSON.stringify(valid)) + ");");
    await expect(x.probe()).rejects.toThrow(/changed while checking/);
  });

  it("refuses a malformed probe response and a nonzero ffprobe exit", async () => {
    const x = await fixture();
    await x.setBinary("process.stdout.write('not json')");
    await expect(x.probe()).rejects.toThrow(/malformed/);
    await x.setBinary("process.stderr.write('failed to decode'); process.exit(2)");
    await expect(x.probe()).rejects.toThrow(/ffprobe failed/);
  });

  it("enforces a short timeout and kills a hung decoder instead of hanging approval", async () => {
    const x = await fixture();
    await x.setBinary("while(true) {}");
    await expect(x.probe()).rejects.toThrow(/timed out/);
  });

  it("refuses user-supplied program arguments, missing trusted binary or foreign files", async () => {
    const x = await fixture();
    await expect(probeSceneAvLockedV2(x.scope, x.manifest,
      { ffprobeBinary: "ffprobe -show_entries; touch /tmp/unsafe" })).rejects.toThrow(/absolute/);
    const bad: SceneFileManifestV2 = structuredClone(x.manifest);
    bad.inputs.video.files = ["../other-episode/video.mp4"];
    await expect(probeSceneAvLockedV2(x.scope, bad, { ffprobeBinary: x.bin }))
      .rejects.toThrow(/Unsafe artifact|path/);
    await expect(probeSceneAvLockedV2(x.scope, x.manifest,
      { ffprobeBinary: path.join(x.root, "missing-ffprobe") })).rejects.toThrow();
  });

  it("does not expose the workflow signing secret to the ffprobe subprocess", async () => {
    const x = await fixture();
    const previous = process.env.BAL_WORKFLOW_HMAC_KEY;
    try {
      process.env.BAL_WORKFLOW_HMAC_KEY = "DUMMY_PRIVATE_WORKFLOW_SECRET_FOR_THE_TEST";
      await x.setBinary(
        "if (process.env.BAL_WORKFLOW_HMAC_KEY) process.exit(44);\n" +
        "process.stdout.write(" + JSON.stringify(JSON.stringify(valid)) + ");");
      expect((await x.probe()).hasAudio).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.BAL_WORKFLOW_HMAC_KEY;
      else process.env.BAL_WORKFLOW_HMAC_KEY = previous;
    }
  });
});
