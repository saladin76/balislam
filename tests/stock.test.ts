import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { productionRefusal, stockIssues, stockViews, awaitingOwner, type Stock } from "../src/studio/stock";
import { isOwnerContentPath } from "../scripts/contentPaths.mjs";

/** D213 بناء المخزون: ترتيب النشر (ترتيب لا مواعيد)، والمسودة لا تدخل الإنتاج، و«اعتمدت السكريبت» الموقّع، وقالب الحلقة. */
const seeds = ["balislam", "dafatir-alzaman", "zubdat-alkutub"].map((c) => [c, JSON.parse(readFileSync(`channels/${c}/stock.json`, "utf8")) as Stock] as const);

describe("ترتيب النشر وبذوره", () => {
  it("بذور القنوات الثلاث سليمة: ١٣ أسبوعًا، وتجميد بالإسلام وزبدة الكتب (D211) لا دفاتر الزمن", () => {
    for (const [c, s] of seeds) {
      expect(stockIssues(s), c).toEqual([]);
      expect(new Set(s.slots.map((x) => x.week)).size, c).toBe(13);
    }
    expect(Object.fromEntries(seeds.map(([c, s]) => [c, Boolean(s.frozen)]))).toEqual({ balislam: true, "dafatir-alzaman": false, "zubdat-alkutub": true });
    const bal = seeds[0]![1];
    expect(bal.slots.filter((x) => x.batch === 1).map((x) => x.episode)).toEqual(["010", "011", "012", "013"]);
  });
  it("لا تواريخ في الترتيب، ولا حلقة مكررة، ولا أسبوع غير صالح", () => {
    const base: Stock = { version: 1, phase: 1, slots: [{ week: 1, title: "أ", batch: 2, episode: "001" }] };
    expect(stockIssues(base)).toEqual([]);
    expect(stockIssues({ ...base, slots: [{ ...base.slots[0]!, publishOn: "2026-12-05" } as never] }).join()).toContain("لا تواريخ");
    expect(stockIssues({ ...base, slots: [...base.slots, { week: 2, title: "ب", batch: 2, episode: "001" }] }).join()).toContain("مكررة");
    expect(stockIssues({ ...base, slots: [{ week: 0, title: "أ", batch: 2 }] }).join()).toContain("الأسبوع");
  });
  it("الملفات الجديدة محتوى مالك، والاعتماد المحلي لا يُرفع", () => {
    expect(isOwnerContentPath("channels/balislam/stock.json")).toBe(true);
    expect(isOwnerContentPath("channels/balislam/episodes/010-x/scenes.md")).toBe(true);
    expect(isOwnerContentPath("channels/balislam/episodes/010-x/publish.draft.json")).toBe(true);
    expect(isOwnerContentPath("channels/balislam/episodes/010-x/script-approval.local.json")).toBe(false);
  });
});

describe("المسودة والتجميد يمنعان الإنتاج", () => {
  it("المسودة أولًا، ثم تجميد القناة، وإلا لا مانع", () => {
    expect(productionRefusal({ status: "مسودة" })).toContain("مسودة");
    expect(productionRefusal({ status: "مسودة", frozen: { decision: "D211" } })).toContain("مسودة");
    expect(productionRefusal({ frozen: { decision: "D211" } })).toContain("مجمّد");
    expect(productionRefusal({ status: undefined })).toBeNull();
  });
  it("المسودة خارج الترتيب تظهر ولا تختفي، والخانة بلا مجلد «مخططة»", () => {
    const v = stockViews("balislam", { version: 1, phase: 1, slots: [{ week: 3, title: "مخططة", batch: 3, episode: "003" }] }, [
      { number: "100", dir: "100-x", title: "مسودة", status: "مسودة", files: { script: true, research: true, scenes: false, publish: false }, approval: { approved: false } },
    ]);
    expect(v.map((x) => [x.episode, x.exists, x.week, x.day])).toEqual([["003", false, 3, "السبت"], ["100", true, null, "السبت"]]);
    expect(v.filter(awaitingOwner).map((x) => x.episode)).toEqual(["100"]);
  });
});

describe("«اعتمدت السكريبت» وقالب المخزون (ملفات مؤقتة)", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "stock-"));
  const prev = { dir: process.env.BAL_CHANNELS_DIR, key: process.env.BAL_WORKFLOW_HMAC_KEY };
  beforeAll(() => {
    process.env.BAL_CHANNELS_DIR = root;
    process.env.BAL_WORKFLOW_HMAC_KEY = "k".repeat(40);
    mkdirSync(path.join(root, "balislam", "episodes"), { recursive: true });
  });
  afterAll(() => {
    if (prev.dir === undefined) delete process.env.BAL_CHANNELS_DIR; else process.env.BAL_CHANNELS_DIR = prev.dir;
    if (prev.key === undefined) delete process.env.BAL_WORKFLOW_HMAC_KEY; else process.env.BAL_WORKFLOW_HMAC_KEY = prev.key;
    rmSync(root, { recursive: true, force: true });
  });
  it("القالب ينشئ مسودة بملفاتها الأربعة، ولا يكتب فوق حلقة موجودة، ويمنع إنتاجها", async () => {
    const st = await import("../src/studio/stockStore");
    const dir = await st.scaffoldStockEpisode({ channel: "balislam", number: "014", slug: "test-ep", title: "عنوان", domain: "worship", series: "worship", templatesRoot: path.resolve("templates") });
    for (const f of ["script.md", "research.md", "scenes.md", "publish.draft.json"]) expect(existsSync(path.join(dir, f)), f).toBe(true);
    expect(st.scriptFrontmatter(readFileSync(path.join(dir, "script.md"), "utf8"))).toMatchObject({ status: "مسودة", episode: "014", title: "عنوان" });
    await expect(st.scaffoldStockEpisode({ channel: "balislam", number: "014", slug: "other", title: "x", domain: "worship", templatesRoot: path.resolve("templates") })).rejects.toThrow(/موجودة/);
    expect(await st.productionBlockFor("balislam", path.join(dir, "script.md"))).toContain("مسودة");
  });
  it("الاعتماد موقّع ويُظهر «تغيّر بعد اعتمادك» عند تعديل السكريبت، والتوقيع المزوّر لا يُقبل", async () => {
    const st = await import("../src/studio/stockStore");
    await st.approveDraftScript("balislam", "014");
    let v = (await st.stockOverview("balislam")).views.find((x) => x.episode === "014")!;
    expect(v.approval).toMatchObject({ approved: true });
    expect(v.approval.stale).toBeUndefined();
    const script = path.join(root, "balislam", "episodes", "014-test-ep", "script.md");
    writeFileSync(script, readFileSync(script, "utf8") + "\nسطر جديد\n");
    v = (await st.stockOverview("balislam")).views.find((x) => x.episode === "014")!;
    expect(v.approval).toMatchObject({ approved: true, stale: true });
    const f = path.join(root, "balislam", "episodes", "014-test-ep", st.SCRIPT_APPROVAL_FILE);
    writeFileSync(f, JSON.stringify({ ...JSON.parse(readFileSync(f, "utf8")), mac: "0".repeat(64) }));
    v = (await st.stockOverview("balislam")).views.find((x) => x.episode === "014")!;
    expect(v.approval.approved).toBe(false);
  });
});
