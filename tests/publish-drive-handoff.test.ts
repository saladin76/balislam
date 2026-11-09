/**
 * D53: after the publish permission the approved files go to the owner's Google Drive folder (a temp dir here).
 * Unit level: the copy itself (exact bytes, sha refusal, idempotence, tool traces, Drive detection).
 * The permission gate and the owner session over the real Studio server: tests/publish-drive-server.test.ts.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DRIVE_PUBLISH_FOLDER, MANIFEST_NAME, NO_DRIVE_MESSAGE, PUBLISH_TEXT_NAME, deliverToDrive, drivePublishRoot, pngTraces,
} from "../src/package/driveHandoff";
import { driveView, driveOwnsPrimary } from "../app/src/tabs/DriveHandoff";
import type { PublishHandoffFacts } from "../src/studio/sceneService";

const ffmpeg = (args: string[]) => execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...args]);
const rawClip = (out: string, freq = 440) => ffmpeg(["-f", "lavfi", "-i", "testsrc=size=160x90:rate=15:duration=2",
  "-f", "lavfi", "-i", `sine=frequency=${freq}:duration=2`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast",
  "-c:a", "aac", "-b:a", "48k", "-shortest", "-movflags", "+faststart", out]);
/** The same arguments as cleanMetadata (src/render/episode.ts). */
const cleanClip = (out: string, freq = 440) => {
  const raw = out + ".raw.mp4";
  rawClip(raw, freq);
  ffmpeg(["-i", raw, "-map", "0", "-c", "copy", "-map_metadata", "-1", "-map_metadata:s", "-1", "-bsf:v", "filter_units=remove_types=6",
    "-fflags", "+bitexact", "-flags:v", "+bitexact", "-flags:a", "+bitexact", "-metadata", "title=حلقة", "-metadata", "artist=بالإسلام", "-movflags", "+faststart", out]);
  return rm(raw);
};
/** Smallest valid PNG with an optional tEXt chunk. */
const png = (text?: string) => {
  const crc = (b: Buffer) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (~c) >>> 0; };
  const chunk = (type: string, data: Buffer) => { const t = Buffer.from(type, "latin1"); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr),
    ...(text ? [chunk("tEXt", Buffer.from(`Software\0${text}`, "latin1"))] : []),
    chunk("IDAT", Buffer.from([0x78, 0x9c, 0x63, 0xf8, 0x0f, 0x00, 0x01, 0x01, 0x01, 0x00])), chunk("IEND", Buffer.alloc(0))]);
};
const sha = async (f: string) => createHash("sha256").update(await readFile(f)).digest("hex");

let tmp = "", epDir = "", pkg = "", drive = "";
const TEXT = "# حزمة الانتشار · حلقة\n\n## يوتيوب: الحلقة\n\n### الوصف\n```\nوصف الحلقة\n```\n";
const facts = async (over: Partial<PublishHandoffFacts> = {}): Promise<PublishHandoffFacts> => ({
  channel: "balislam", episode: "321", episodeDir: epDir, scriptPath: path.join(epDir, "script.md"),
  masterFile: path.join(pkg, "321-episode.mp4"), masterSha256: await sha(path.join(pkg, "321-episode.mp4")), ledgerRevision: 9,
  master: { by: "owner", at: "2026-11-09T10:00:00.000Z", seq: 7 }, publish: { by: "owner", at: "2026-11-09T10:05:00.000Z", seq: 8 }, ...over,
});
const folder = () => path.join(drive, DRIVE_PUBLISH_FOLDER, "balislam", "321-test-episode");

beforeEach(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), "drive-handoff-"));
  epDir = path.join(tmp, "channels", "balislam", "episodes", "321-test-episode");
  pkg = path.join(epDir, "out", "package");
  drive = path.join(tmp, "My Drive");
  await mkdir(pkg, { recursive: true });
  await mkdir(drive);
  await cleanClip(path.join(pkg, "321-episode.mp4"), 500);
  const old = new Date(Date.now() - 60_000);
  await utimes(path.join(pkg, "321-episode.mp4"), old, old);
  await cleanClip(path.join(pkg, "321-short-1.mp4"), 600);
  await writeFile(path.join(pkg, "321-thumbnail-1.png"), png());
  await writeFile(path.join(pkg, "321-episode.ar.srt"), "1\n00:00:00,000 --> 00:00:02,000\nالصبر مفتاح الفرج\n");
  await writeFile(path.join(pkg, "321-short-1.ar.srt"), "1\n00:00:00,000 --> 00:00:02,000\nالصبر\n");
  await writeFile(path.join(pkg, "youtube.md"), "not delivered");
});
afterEach(async () => { await rm(tmp, { recursive: true, force: true }); });

describe("deliverToDrive: exact approved bytes into <My Drive>/balislam-publish/<channel>/<episode>/", () => {
  it("copies master, shorts, thumbnails, subtitles, the publish text and a manifest, byte for byte", async () => {
    const f = await facts();
    const r = await deliverToDrive({ facts: f, root: drive, publishText: TEXT });
    expect(r.folder).toBe(folder());
    const names = (await readdir(folder())).sort();
    expect(names).toEqual([MANIFEST_NAME, "321-episode.ar.srt", "321-episode.mp4", "321-short-1.ar.srt", "321-short-1.mp4", "321-thumbnail-1.png", PUBLISH_TEXT_NAME].sort());
    for (const n of names.filter((n) => n.startsWith("321-"))) expect(await sha(path.join(folder(), n))).toBe(await sha(path.join(pkg, n)));
    expect(await readFile(path.join(folder(), PUBLISH_TEXT_NAME), "utf8")).toBe(TEXT);
    const m = JSON.parse(await readFile(path.join(folder(), MANIFEST_NAME), "utf8"));
    expect(m.approvals.master).toMatchObject({ sha256: f.masterSha256, approvedAt: f.master.at, ledgerSeq: 7 });
    expect(m.approvals.publish).toMatchObject({ grantedAt: f.publish.at, ledgerSeq: 8 });
    expect(m.files.find((x: any) => x.name === "321-episode.mp4")).toMatchObject({ kind: "master", sha256: f.masterSha256, size: (await stat(f.masterFile)).size });
    expect(names.some((n) => n.endsWith(".part"))).toBe(false);
  });

  it("refuses bytes that differ from the ledger's approved Master and writes nothing", async () => {
    await expect(deliverToDrive({ facts: await facts({ masterSha256: "a".repeat(64) }), root: drive, publishText: TEXT })).rejects.toThrow(/بصمة/);
    const left = await readdir(folder()).catch(() => []);
    expect(left.filter((n) => n.endsWith(".mp4") || n === MANIFEST_NAME || n.endsWith(".part"))).toEqual([]);
  });

  it("is idempotent: a rerun skips identical files, replaces a changed one, and never deletes other files", async () => {
    const f = await facts();
    await deliverToDrive({ facts: f, root: drive, publishText: TEXT });
    await writeFile(path.join(folder(), "ملاحظاتي.txt"), "ملف المالك");
    const before = (await stat(path.join(folder(), "321-episode.mp4"))).mtimeMs;
    const again = await deliverToDrive({ facts: f, root: drive, publishText: TEXT });
    expect(again.files.filter((x) => x.kind !== "manifest").every((x) => x.action === "skipped")).toBe(true);
    expect((await stat(path.join(folder(), "321-episode.mp4"))).mtimeMs).toBe(before);
    // A changed thumbnail is replaced; the owner's own file stays.
    await writeFile(path.join(pkg, "321-thumbnail-1.png"), png("بالإسلام"));
    const third = await deliverToDrive({ facts: f, root: drive, publishText: TEXT + "\nسطر" });
    expect(third.files.find((x) => x.name === "321-thumbnail-1.png")?.action).toBe("replaced");
    expect(third.files.find((x) => x.name === PUBLISH_TEXT_NAME)?.action).toBe("replaced");
    expect(await sha(path.join(folder(), "321-thumbnail-1.png"))).toBe(await sha(path.join(pkg, "321-thumbnail-1.png")));
    expect(await readFile(path.join(folder(), "ملاحظاتي.txt"), "utf8")).toBe("ملف المالك");
  });

  it("delivers only shorts cut after this Master", async () => {
    const old = new Date(Date.now() - 120_000);
    await utimes(path.join(pkg, "321-short-1.mp4"), old, old);
    const r = await deliverToDrive({ facts: await facts(), root: drive, publishText: TEXT });
    expect(r.files.map((x) => x.name)).not.toContain("321-short-1.mp4");
    expect(r.files.map((x) => x.name)).not.toContain("321-short-1.ar.srt");
  });

  it("the publish text, subtitles, images and videos must carry no tool traces; nothing is copied otherwise", async () => {
    await expect(deliverToDrive({ facts: await facts(), root: drive, publishText: TEXT + "\nصوت مولَّد بالذكاء الاصطناعي" })).rejects.toThrow(/قاعدة القناة/);
    await writeFile(path.join(pkg, "321-thumbnail-1.png"), png("Remotion"));
    expect(await pngTraces(path.join(pkg, "321-thumbnail-1.png"))).not.toEqual([]);
    await expect(deliverToDrive({ facts: await facts(), root: drive, publishText: TEXT })).rejects.toThrow(/321-thumbnail-1\.png/);
    await writeFile(path.join(pkg, "321-thumbnail-1.png"), png());
    rawClip(path.join(pkg, "321-short-1.mp4")); // metadata not cleaned: encoder tags and x264 signature
    await expect(deliverToDrive({ facts: await facts(), root: drive, publishText: TEXT })).rejects.toThrow(/321-short-1\.mp4/);
    expect(await readdir(folder()).catch(() => [])).toEqual([]);
  });
});

describe("drivePublishRoot: the owner's local My Drive folder", () => {
  it("override in .env, off, a missing folder, and no Drive are clear messages", () => {
    expect(drivePublishRoot({ BAL_DRIVE_PUBLISH_DIR: drive })).toEqual({ root: drive, source: "env" });
    expect(drivePublishRoot({ BAL_DRIVE_PUBLISH_DIR: "off" }).root).toBeNull();
    expect(drivePublishRoot({ BAL_DRIVE_PUBLISH_DIR: path.join(tmp, "nope") }).message).toMatch(/BAL_DRIVE_PUBLISH_DIR/);
    // Tests never auto-detect a real Drive.
    expect(drivePublishRoot({ VITEST: "true" }, tmp)).toMatchObject({ root: null, message: NO_DRIVE_MESSAGE });
    expect(drivePublishRoot({}, tmp)).toMatchObject({ root: null, message: NO_DRIVE_MESSAGE });
  });

  it("detects ~/Library/CloudStorage/GoogleDrive-*/My Drive, and asks when several accounts exist", async () => {
    const cloud = path.join(tmp, "Library", "CloudStorage");
    const a = path.join(cloud, "GoogleDrive-owner@gmail.com", "My Drive");
    await mkdir(a, { recursive: true });
    expect(drivePublishRoot({}, tmp)).toEqual({ root: a, source: "detected" });
    const b = path.join(cloud, "GoogleDrive-other@gmail.com", "My Drive");
    await mkdir(b, { recursive: true });
    expect(drivePublishRoot({}, tmp).root).toBeNull();
    expect(drivePublishRoot({}, tmp).message).toMatch(/أكثر من حساب/);
    expect(drivePublishRoot({ BAL_DRIVE_PREVIEWS_DIR: path.join(a, "balislam-previews") }, tmp).root).toBe(a);
  });
});

describe("DriveHandoff card view", () => {
  const status = (over: any = {}) => ({ drive: { found: true, source: "env", message: null, folder: "/d/balislam-publish/balislam/001-x" }, job: null, last: null, canOpen: true, ...over });
  it("follows the permission, the job and the exact Master", () => {
    expect(driveView(null, false, false, null).kind).toBe("hidden");
    expect(driveView(status(), true, false, "a").kind).toBe("waiting-permission");
    expect(driveView(status({ job: { status: "running", pct: 40, current: "x.mp4" } }), true, true, "a").kind).toBe("running");
    expect(driveView(status({ drive: { found: false, message: "لا Drive" } }), true, true, "a")).toEqual({ kind: "no-drive", message: "لا Drive" });
    const done = { status: "done", folder: "/d/f", masterSha256: "a", files: [{ name: "001-episode.mp4", size: 5 }] };
    expect(driveView(status({ last: done }), true, true, "a").kind).toBe("delivered");
    expect(driveView(status({ last: done }), true, true, "b").kind).toBe("failed"); // an older Master is not «sent»
    expect(driveView(status({ last: { status: "error", error: "قرص ممتلئ" } }), true, true, "a")).toEqual({ kind: "failed", reason: "قرص ممتلئ" });
    expect(driveOwnsPrimary({ kind: "running", pct: 1, current: "" })).toBe(false);
    expect(driveOwnsPrimary({ kind: "failed", reason: "" })).toBe(true);
  });
});
