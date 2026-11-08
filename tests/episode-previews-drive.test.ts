import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { listEpisodePreviews, locatePreview, putPreview } from "../src/render/episodePreviews";

const owned: string[] = [];
const tmp = async () => { const d = await mkdtemp(path.join(os.tmpdir(), "prevdrive-")); owned.push(d); return d; };
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
afterEach(async () => {
  delete process.env.BAL_DRIVE_PREVIEWS_DIR;
  for (const d of owned.splice(0)) await rm(d, { recursive: true, force: true });
});
const episode = async () => {
  const root = await tmp();
  const ep = path.join(root, "channels", "balislam", "episodes", "001-x");
  await mkdir(ep, { recursive: true });
  await writeFile(path.join(ep, "script.md"), "");
  return { root, ep, script: path.join(ep, "script.md") };
};

describe("المعاينات على Google Drive: الفهرس في Git والفيديو على Drive", () => {
  it("الرفع يسجّل البصمة والحجم وينسخ إلى مجلد Drive المتزامن بمسار القناة والحلقة", async () => {
    const { root, ep, script } = await episode();
    const drive = path.join(root, "drive");
    process.env.BAL_DRIVE_PREVIEWS_DIR = drive;
    const src = path.join(root, "a.mp4");
    await writeFile(src, "VIDEO-A");
    const r = await putPreview(script, "scene-1", src, { title: "المشهد ١" });
    const mirror = path.join(drive, "balislam", "001-x", "scene-1.mp4");
    expect(r.drive).toBe(mirror);
    expect(await readFile(mirror, "utf8")).toBe("VIDEO-A");
    const index = JSON.parse(await readFile(path.join(ep, "previews", "index.json"), "utf8"));
    expect(index["scene-1.mp4"]).toMatchObject({ sha256: sha("VIDEO-A"), size: 7 });
  });

  it("بلا مجلد Drive يبقى الرفع محليًا ولا يفشل", async () => {
    const { root, script } = await episode();
    const src = path.join(root, "a.mp4");
    await writeFile(src, "A");
    const r = await putPreview(script, "s", src, { title: "t" });
    expect(r.drive).toBeNull();
    expect(existsSync(r.file)).toBe(true);
  });

  it("يشغّل نسخة Drive المتزامنة فقط إن طابقت البصمة المسجلة، وإلا يعرض رابط Drive", async () => {
    const { root, ep } = await episode();
    const drive = path.join(root, "drive");
    process.env.BAL_DRIVE_PREVIEWS_DIR = drive;
    const entry = { title: "t", version: 1, updatedAt: new Date().toISOString(), sha256: sha("NEW"), size: 3,
      drive: { id: "abcdefghij123", url: "https://drive.google.com/file/d/abcdefghij123/view" } };
    const mirror = path.join(drive, "balislam", "001-x", "x.mp4");
    await mkdir(path.dirname(mirror), { recursive: true });
    await writeFile(mirror, "OLD");
    expect(await locatePreview(ep, "x.mp4", entry)).toEqual({ kind: "drive-link", url: entry.drive.url });
    await writeFile(mirror, "NEW");
    expect(await locatePreview(ep, "x.mp4", entry)).toEqual({ kind: "drive-mirror", file: mirror });
    await mkdir(path.join(ep, "previews"), { recursive: true });
    await writeFile(path.join(ep, "previews", "index.json"), JSON.stringify({ "x.mp4": entry }));
    const list = await listEpisodePreviews(ep);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ name: "x.mp4", source: "drive-mirror", driveUrl: entry.drive.url });
  });

  it("معاينة في الفهرس بلا ملف ولا رابط تظهر مفقودة ولا تُخفى", async () => {
    const { ep } = await episode();
    await mkdir(path.join(ep, "previews"), { recursive: true });
    await writeFile(path.join(ep, "previews", "index.json"), JSON.stringify({ "y.mp4": { title: "y", version: 1, updatedAt: "2026-11-08T00:00:00Z" } }));
    expect((await listEpisodePreviews(ep))[0]).toMatchObject({ name: "y.mp4", source: "missing" });
  });
});

describe("المساحة: نسخة سابقة واحدة فقط في history", () => {
  it("بعد ثلاث رفعات للخانة نفسها يبقى في history ملف واحد فقط", async () => {
    const { root, ep, script } = await episode();
    for (const v of ["V1", "V2", "V3"]) {
      const src = path.join(root, `${v}.mp4`);
      await writeFile(src, v);
      await putPreview(script, "s", src, { title: v });
      await new Promise((r) => setTimeout(r, 15));
    }
    const { readdir } = await import("node:fs/promises");
    const hist = (await readdir(path.join(ep, "previews", "history", "s"))).filter((n) => n.endsWith(".mp4"));
    expect(hist).toHaveLength(1);
    expect(await readFile(path.join(ep, "previews", "history", "s", hist[0]!), "utf8")).toBe("V2");
    expect(await readFile(path.join(ep, "previews", "s.mp4"), "utf8")).toBe("V3");
  });
});
