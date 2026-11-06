import { describe, expect, it, beforeEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  addLabStoryboard,
  decideLabStoryboard,
  labStoryboardFile,
  labStoryboardsEnabled,
  listLabStoryboards,
  resolveLabDir,
  shownStatus,
  storyboardProblems,
} from "../src/channel/labStoryboards";

/** ستوري بورد المختبرات (ملحق الأمر 015): نسخ محفوظة كلها، والاعتماد بقرار صريح وحده، ولبالإسلام وحدها */
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000050001", "hex");

let eps: string;
let lab: string;
let img1: string;
let img2: string;
beforeEach(() => {
  eps = mkdtempSync(path.join(tmpdir(), "sb-"));
  lab = path.join(eps, "900-engine-lab");
  mkdirSync(path.join(lab, "previews"), { recursive: true });
  writeFileSync(path.join(lab, "lab.json"), "{}");
  writeFileSync(path.join(lab, "previews", "index.json"), JSON.stringify({ "a.mp4": { title: "فيديو", version: 3 } }));
  img1 = path.join(eps, "storyboard-015.png");
  img2 = path.join(eps, "storyboard-015-v2.png");
  writeFileSync(img1, PNG);
  writeFileSync(img2, Buffer.concat([PNG, Buffer.from([0])]));
});

describe("ستوري بورد المختبرات", () => {
  it("مفعّل لبالإسلام وحدها، والرفع لقناة أخرى مرفوض", async () => {
    expect(labStoryboardsEnabled("balislam")).toBe(true);
    expect(labStoryboardsEnabled("dafatir-alzaman")).toBe(false);
    expect(labStoryboardsEnabled("zubdat-alkutub")).toBe(false);
    await expect(addLabStoryboard("dafatir-alzaman", lab, "s", img1, { title: "t" })).rejects.toThrow(/غير مفعّل/);
  });

  it("كل رفع نسخة جديدة برقمها وتاريخها «جاهز للمراجعة»، ولا تُحذف السابقة ولا تُمس معاينات الفيديو", async () => {
    const a = await addLabStoryboard("balislam", lab, "witnesses-015", img1, { title: "الأول", order: "015", topic: "مشهد الشاهدين", uploadedAt: "2026-11-06T05:27:57Z" });
    const b = await addLabStoryboard("balislam", lab, "witnesses-015", img2, { title: "المعدّل", order: "015", topic: "مشهد الشاهدين" });
    expect([a.version, b.version]).toEqual([1, 2]);
    expect(existsSync(path.join(lab, "storyboards", "witnesses-015-v1.png"))).toBe(true);
    expect(existsSync(path.join(lab, "storyboards", "witnesses-015-v2.png"))).toBe(true);
    const [e] = await listLabStoryboards(lab);
    expect(e!.title).toBe("مشهد الشاهدين");
    expect(e!.order).toBe("015");
    expect(e!.latest.version).toBe(2);
    expect(e!.versions.map((v) => v.version)).toEqual([2, 1]);
    expect(e!.versions.every((v) => v.status === "review")).toBe(true);
    expect(e!.versions[1]!.uploadedAt).toBe("2026-11-06T05:27:57Z");
    expect(e!.versions[1]!.source).toBe("storyboard-015.png");
    expect(e!.problems).toEqual([]);
    // معاينات الفيديو كما هي
    expect(JSON.parse(readFileSync(path.join(lab, "previews", "index.json"), "utf8"))["a.mp4"].version).toBe(3);
  });

  it("الفيديو لا يُرفع ستوري بورد، والصورة الفارغة مرفوضة", async () => {
    const mp4 = path.join(eps, "x.mp4");
    writeFileSync(mp4, "x");
    await expect(addLabStoryboard("balislam", lab, "s", mp4, { title: "t" })).rejects.toThrow(/صورة/);
    const empty = path.join(eps, "e.png");
    writeFileSync(empty, "");
    await expect(addLabStoryboard("balislam", lab, "s", empty, { title: "t" })).rejects.toThrow(/فارغة/);
  });

  it("الاعتماد وطلب التعديل لا يُسجَّلان إلا بصاحب ونص، ولا يُغيّر الرفعُ اللاحق قرار نسخة سابقة", async () => {
    await addLabStoryboard("balislam", lab, "w", img1, { title: "1" });
    await expect(decideLabStoryboard("balislam", lab, "w", 1, { status: "approved", by: "", note: "x" })).rejects.toThrow(/صاحب القرار/);
    await expect(decideLabStoryboard("balislam", lab, "w", 1, { status: "approved", by: "صاحب القناة", note: " " })).rejects.toThrow(/نص القرار/);
    await decideLabStoryboard("balislam", lab, "w", 1, { status: "changes", by: "صاحب القناة", note: "وضّح منطق الميزان", at: "2026-11-06T05:42:00Z" });
    await addLabStoryboard("balislam", lab, "w", img2, { title: "2" });
    const [e] = await listLabStoryboards(lab);
    expect(e!.versions.find((v) => v.version === 1)!.status).toBe("changes");
    expect(e!.versions.find((v) => v.version === 1)!.decision!.note).toBe("وضّح منطق الميزان");
    expect(e!.latest.status).toBe("review");
  });

  it("«معتمد» مكتوب يدويًا بلا قرار يُعرض «جاهز للمراجعة» ويُبلَّغ عنه", () => {
    const v = { version: 1, file: "w-v1.png", title: "t", uploadedAt: "2026-11-06T00:00:00Z", status: "approved" as const };
    expect(shownStatus(v)).toBe("review");
    expect(storyboardProblems("w", { title: "t", versions: [v] }).join()).toMatch(/بلا قرار/);
  });

  it("خدمة الصور داخل storyboards/ وحدها", async () => {
    await addLabStoryboard("balislam", lab, "w", img1, { title: "1" });
    expect(labStoryboardFile(lab, "w-v1.png")).toBeTruthy();
    expect(labStoryboardFile(lab, "../lab.json")).toBeNull();
    expect(labStoryboardFile(lab, "index.json")).toBeNull();
  });

  it("يجد المختبر برقمه، والمختبر الحقيقي في المستودع يحفظ صورتي الأمر 015 بقرار النسخة الأولى", async () => {
    expect(await resolveLabDir(eps, "900")).toBe(lab);
    const real = path.join(__dirname, "..", "channels", "balislam", "episodes", "900-engine-lab");
    const [e] = await listLabStoryboards(real);
    expect(e!.slot).toBe("witnesses-015");
    expect(e!.problems).toEqual([]);
    expect(e!.latest.version).toBe(2);
    expect(e!.latest.status).toBe("review");
    expect(e!.versions.map((v) => v.source)).toEqual(["storyboard-015-v2.png", "storyboard-015.png"]);
    expect(e!.versions.find((v) => v.version === 1)!.status).toBe("changes");
    // لا اعتماد فني لأي نسخة
    expect(e!.versions.some((v) => v.status === "approved")).toBe(false);
  });
});
