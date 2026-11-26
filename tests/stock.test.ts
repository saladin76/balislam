import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import os from "node:os";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { productionRefusal, stockIssues, stockViews, awaitingOwner, type Stock } from "../src/studio/stock";
import { isOwnerContentPath } from "../scripts/contentPaths.mjs";

/** D213 بناء المخزون: ترتيب النشر (ترتيب لا مواعيد)، والمسودة لا تدخل الإنتاج، و«اعتمدت السكريبت» الموقّع، وقالب الحلقة. */
const seeds = ["balislam", "dafatir-alzaman", "zubdat-alkutub"].map((c) => [c, JSON.parse(readFileSync(`channels/${c}/stock.json`, "utf8")) as Stock] as const);

describe("ترتيب النشر وبذوره", () => {
  it("بذور القنوات الثلاث عقد لا تثبيت: الترتيب سليم، وكل خانة بأسبوع ودفعة، ولا حلقة مكررة", () => {
    for (const [c, s] of seeds) {
      expect(stockIssues(s), c).toEqual([]);
      expect(s.slots.length > 0, c).toBe(true);
    }
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
    expect(v.filter(awaitingOwner).map((x) => x.episode)).toEqual(["100"]); // owner-pin-ok: بيانات مصطنعة في الاختبار، لا محتوى المالك
  });
});

describe("«اعتمدت السكريبت» وقالب المخزون (ملفات مؤقتة)", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "stock-"));
  const prev = { dir: process.env.BAL_CHANNELS_DIR, key: process.env.BAL_WORKFLOW_HMAC_KEY };
  beforeAll(() => {
    process.env.BAL_CHANNELS_DIR = root;
    process.env.BAL_WORKFLOW_HMAC_KEY = "k".repeat(40);
    mkdirSync(path.join(root, "balislam", "episodes"), { recursive: true });
    // D215: سلسلة القالب معرّف مسجّل في القناة
    mkdirSync(path.join(root, "balislam", "series", "worship"), { recursive: true });
    writeFileSync(path.join(root, "balislam", "series", "worship", "series.json"), JSON.stringify({ version: 1, id: "worship", name: "العبادة الواعية", kind: "category" }));
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
    // D215: اسم العرض أو معرّف غير مسجّل لا يُكتب في ترويسة المسودة
    await expect(st.scaffoldStockEpisode({ channel: "balislam", number: "015", slug: "x-ep", title: "x", domain: "worship", series: "العبادة الواعية", templatesRoot: path.resolve("templates") })).rejects.toThrow(/worship/);
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

describe("D229: استثناء صوت الدقيقة الأولى من تجميد القناة", () => {
  const frozen = { decision: "D211", voiceOnly: [{ episode: "001", scenes: ["c1-s4", "c1-s5"], decision: "D229" }] };
  it("يسمح بصوت المشاهد المستثناة وحدها في حلقتها، ويبقى كل ما سواها مجمّدًا", () => {
    expect(productionRefusal({ frozen, episode: "001", voiceScenes: ["c1-s4"] })).toBeNull();
    expect(productionRefusal({ frozen, episode: "001", voiceScenes: ["c1-s4", "c1-s5"] })).toBeNull();
    expect(productionRefusal({ frozen, episode: "001", voiceScenes: ["c1-s4", "c1-s30"] })).toContain("مجمّد");
    expect(productionRefusal({ frozen, episode: "001", voiceScenes: null })).toContain("مجمّد"); // الصوت كله أو الرندر
    expect(productionRefusal({ frozen, episode: "001" })).toContain("مجمّد");
    expect(productionRefusal({ frozen, episode: "002", voiceScenes: ["c1-s4"] })).toContain("مجمّد");
    expect(productionRefusal({ status: "مسودة", frozen, episode: "001", voiceScenes: ["c1-s4"] })).toContain("مسودة");
  });
  it("الاستثناء في stock.json يُفحص: حلقة ومشاهد وقرار", () => {
    const base = { version: 1, phase: 1, slots: [] } as unknown as Stock;
    expect(stockIssues({ ...base, frozen: { decision: "D211", voiceOnly: [{ episode: "1", scenes: [], decision: "" }] } })).toContain("استثناء الصوت من التجميد: الحلقة (ثلاث خانات) والمشاهد والقرار مطلوبة.");
    expect(stockIssues({ ...base, frozen })).toEqual([]);
  });
  it("بالإسلام: تجميد كامل (D235)، ولا استثناء صوت بعد إلغاء D229", () => {
    const s = JSON.parse(readFileSync(path.join(__dirname, "..", "channels", "balislam", "stock.json"), "utf8")) as Stock;
    expect(s.frozen?.decision).toBe("D211"); // owner-pin-ok: قرار المالك D211 نفسه
    expect(s.frozen?.voiceOnly).toBeUndefined(); // owner-pin-ok: قرار المالك D235 (تجميد كامل)
  });
  it("الخادم يفحص مشهد كل توليد عند الاستثناء (الجملة وتصحيح الكلمة والمشهد وترقية النبرة)", () => {
    const api = readFileSync(path.join(__dirname, "..", "app", "server", "api.ts"), "utf8");
    expect(api).toContain("generateGate: (sceneId: string) => scopedVoiceBlock([sceneId])");
    expect(api.match(/await scopedVoiceBlock\(/g)?.length).toBe(2); // owner-pin-ok: عدد مواضع البوابة في الكود لا محتوى المالك
    const sv = readFileSync(path.join(__dirname, "..", "src", "voice", "sentenceVoice.ts"), "utf8");
    expect(sv.match(/opts\.generateGate \? await opts\.generateGate\(scene\.id\)/g)?.length).toBe(2); // owner-pin-ok: عدد مواضع البوابة في الكود لا محتوى المالك
  });
});
