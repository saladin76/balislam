/**
 * D83: صاحب القناة يحدد مقاطع الشورتس بنفسه من الاستوديو («٤ النشر ← الشورتس والريلز ← مقاطع الشورتس»).
 * - الفحص: من مشهد إلى مشهد ولو عبر الأقسام، حتى ستة، بلا شاشة النهاية ولا مقطع مقلوب أو مكرر، والعنوان المنشور بلا أثر أدوات.
 * - الحفظ يكتب plan.shorts وحدها (لا مشهد ولا ختم ولا updatedAt)، و«احذف الاختيار» يعيد السلوك السابق.
 * - الخادم: القراءة مفتوحة من الصفحة، والكتابة من موقع آخر 403 (studioRequestRefusal)، والخطأ 400 بأسماء المشاهد.
 * - الواجهة: الصفوف والمدة والنص، بلا زر مملوء، والاختيار مسموح قبل اعتماد النسخة الأساسية.
 */
import React from "react";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { balApi } from "../app/server/api";
import { checkShortsInput, segmentPlan, shortRange, shortSegments, shortsScenes, suggestedShorts, SHORTS_MAX } from "../src/plan/shorts";
import { findTraces } from "../src/package/traces";
import { ENGINE_FEATURES, channelEngineFeatures, engineEnabled } from "../src/plan/engine";
import { ShortsPicker, describeShort } from "../app/src/tabs/ShortsPicker";
import type { Plan, PlanScene } from "../src/plan/types";

const repo = path.resolve(import.meta.dirname, "..");
const scene = (id: string, narration: string, template = "alley-tale"): PlanScene => ({ id, template, line: 1, narration, sfx: [], props: {} } as PlanScene);
const plan = (): Plan => ({
  version: 1, episode: "986", title: "اختبار", domain: "general", themeId: "x", channel: "balislam", lang: "ar", updatedAt: "2026-11-11T00:00:00.000Z",
  chapters: [
    { number: 1, title: "أول", scenes: [scene("c1-s1", "جملة أولى قصيرة."), scene("c1-s2", "جملة ثانية.")] },
    { number: 2, title: "ثانٍ", scenes: [scene("c2-s1", "جملة ثالثة."), scene("c2-s2", ""), scene("c2-end", "", "end-screen")] },
  ],
} as unknown as Plan);

describe("فحص المقاطع (checkShortsInput)", () => {
  it("يقبل مقطعًا يعبر الأقسام وعنوانًا للنشر، ويطابق ما يرندره المحرك", () => {
    const p = plan();
    const c = checkShortsInput(p, [{ from: "c1-s2", to: "c2-s1", title: "  عنوان   قصير " }], findTraces);
    expect(c.errors).toEqual([]);
    expect(c.shorts).toEqual([{ from: "c1-s2", to: "c2-s1", title: "عنوان قصير" }]);
    const pick = shortSegments({ ...p, shorts: c.shorts });
    expect(pick.source).toBe("plan");
    expect(pick.segments[0]!.sceneIds).toEqual(["c1-s2", "c2-s1"]);
    expect(segmentPlan(p, pick.segments[0]!).plan.chapters).toHaveLength(1);
  });
  it("يرفض: ليس قائمة، أكثر من ستة، مشهد غير موجود أو شاشة النهاية، مقلوب، مكرر، عنوان بأثر أدوات أو بسطرين", () => {
    const p = plan();
    expect(checkShortsInput(p, "x").errors).toHaveLength(1);
    expect(checkShortsInput(p, Array.from({ length: SHORTS_MAX + 1 }, () => ({ from: "c1-s1", to: "c1-s1" }))).errors.join(" ")).toMatch(/أكثر عدد للشورتس 6/);
    expect(checkShortsInput(p, [{ from: "c9-s1", to: "c1-s1" }]).errors[0]).toMatch(/«c9-s1» غير موجود/);
    expect(checkShortsInput(p, [{ from: "c1-s1", to: "c2-end" }]).errors[0]).toMatch(/غير موجود/);
    expect(checkShortsInput(p, [{ from: "c2-s1", to: "c1-s1" }]).errors[0]).toMatch(/بعد مشهد النهاية/);
    expect(checkShortsInput(p, [{ from: "c1-s1", to: "c1-s2" }, { from: "c1-s1", to: "c1-s2" }]).errors[0]).toMatch(/مكرر/);
    expect(checkShortsInput(p, [{ from: "c1-s1", to: "c1-s2", title: "صُنع بـ ElevenLabs" }], findTraces).errors[0]).toMatch(/أدوات الإنتاج/);
    expect(checkShortsInput(p, [{ from: "c1-s1", to: "c1-s2", title: "سطر\nآخر" }]).errors[0]).toMatch(/سطر واحد/);
    expect(checkShortsInput(p, [{ from: "c1-s1", to: "c1-s2", title: "ا".repeat(101) }]).errors[0]).toMatch(/أطول من 100/);
    expect(checkShortsInput(p, [{ from: "c1-s1" }]).errors[0]).toMatch(/اختر مشهد البداية/);
  });
  it("القائمة الفارغة صالحة (لا شورتس صراحة)، والتداخل تنبيه لا خطأ", () => {
    const p = plan();
    expect(checkShortsInput(p, [])).toEqual({ shorts: [], errors: [], warnings: [] });
    const c = checkShortsInput(p, [{ from: "c1-s1", to: "c2-s1" }, { from: "c1-s2", to: "c2-s2" }]);
    expect(c.errors).toEqual([]);
    expect(c.warnings[0]).toMatch(/يتداخل/);
  });
  it("المقترح: المحفوظ كما هو، أو مقاطع الأقسام بلا عناوينها (بيانات إنتاج)، ولا شيء للنص المتصل؛ والمشاهد بلا شاشة النهاية مرقّمة كالاستوديو", () => {
    const p = plan();
    expect(suggestedShorts(p)).toEqual([{ from: "c1-s1", to: "c1-s2" }, { from: "c2-s1", to: "c2-s2" }]);
    expect(suggestedShorts({ ...p, shorts: [{ from: "c1-s2", to: "c1-s2" }] })).toEqual([{ from: "c1-s2", to: "c1-s2" }]);
    expect(suggestedShorts({ chapters: [{ ...p.chapters[0]!, number: 1, title: "" }] })).toEqual([]);
    const sc = shortsScenes(p, () => 4.04);
    expect(sc.map((s) => [s.id, s.n, s.division, s.seconds])).toEqual([["c1-s1", 1, 1, 4], ["c1-s2", 2, 1, 4], ["c2-s1", 3, 2, 4], ["c2-s2", 4, 2, 4]]);
    expect(sc[3]!.text).toBe("مشهد بلا تعليق");
    expect(shortRange(sc, "c2-s1", "c1-s1")).toEqual([]);
    const d = describeShort(sc, { from: "c1-s2", to: "c2-s1" });
    expect([d.seconds, d.divisions, d.text]).toEqual([8, [1, 2], "جملة ثانية. جملة ثالثة."]);
  });
});

describe("سجل أدوات المحرك", () => {
  it("مقاطع الشورتس بنية مشتركة مفعّلة للقنوات الثلاث، ولا تفتح لوحة أدوات لغير بالإسلام", () => {
    const f = ENGINE_FEATURES.find((x) => x.id === "shorts-picker")!;
    expect(f.kind).toBe("infra");
    expect(f.channels).toBeUndefined();
    expect(f.control).toMatch(/النشر ← الشورتس والريلز/);
    for (const ch of ["balislam", "dafatir-alzaman", "zubdat-alkutub"]) expect(engineEnabled("shorts-picker", ch)).toBe(true);
    expect(channelEngineFeatures("dafatir-alzaman")).toEqual([]);
  });
});

describe("الواجهة (ShortsPicker)", () => {
  const read = { saved: null, suggested: [{ from: "c1-s1", to: "c1-s2" }], divisions: 2, max: 6, titleMax: 100,
    scenes: shortsScenes(plan(), () => 30) };
  it("تعرض الصفوف ومدة كل مقطع ونصه، بلا زر مملوء، والاختيار مسموح قبل الاعتماد", () => {
    const html = renderToStaticMarkup(<ShortsPicker episodeId="986" approved={false} initial={read} />);
    expect(html).toContain("مقاطع الشورتس");
    expect(html).toContain("مقترحة من الأقسام");
    expect(html).toContain("الاختيار مسموح الآن، والصناعة بعد اعتماد النسخة الأساسية.");
    expect(html).toContain("≈ ١:٠٠");
    expect(html).toContain("أضف شورتًا");
    expect(html).toContain("احفظ المقاطع");
    expect(html).not.toMatch(/class="btn primary"/);
    expect(html).not.toContain("c1-s1<");
  });
  it("مكانها في «الشورتس والريلز» بصفحة النشر، وزر الصناعة يبقى بعد الاعتماد وحده", () => {
    const tab = readFileSync(path.join(repo, "app/src/tabs/PublishTab.tsx"), "utf8");
    const block = tab.slice(tab.indexOf("الشورتس والريلز${"), tab.indexOf("الصور المصغّرة${"));
    expect(block).toContain("<ShortsPicker episodeId={episodeId} approved={approved} />");
    const gate = block.indexOf("{approved ? (");
    expect(gate).toBeGreaterThan(block.indexOf("<ShortsPicker"));
    expect(block.indexOf('start("shorts")')).toBeGreaterThan(gate);
    expect(block.split('start("shorts")')).toHaveLength(2);
  });
  it("الأنماط على رموز المِرسَم، بلا طبقة ثابتة ولا متمرِّر داخلي (D64/D74)", () => {
    const css = readFileSync(path.join(repo, "app/src/tabs/shorts.css"), "utf8");
    expect(css).not.toMatch(/position:\s*(fixed|sticky)/);
    expect(css).not.toMatch(/overflow(-y)?:\s*(auto|scroll)/);
    // ألوان من الرموز وحدها؛ قائمة الخيارات الأصلية للنظام كما في شريط القناة (shell.css: .ms-ep-pick select option)
    expect(css.replace(/\.shp-pick select option \{[^}]*\}/, "")).not.toMatch(/#[0-9a-f]{3,6}\b/i);
  });
});

describe("الخادم: GET/PUT /api/episodes/<ep>/shorts", () => {
  const CH = "balislam";
  const ENV_KEYS = ["BAL_CHANNELS_DIR", "BAL_ENV_FILE", "BAL_WORKFLOW_HMAC_KEY"];
  const saved: Record<string, string | undefined> = {};
  let root = "";
  let epDir = "";
  let vite: ViteDevServer;
  let server: http.Server;
  let base = "";
  const call = async (method: string, route: string, body?: unknown, headers: Record<string, string> = {}) => {
    const r = await fetch(`${base}/api/${route}?channel=${CH}`, {
      method,
      headers: { "sec-fetch-site": "same-origin", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json().catch(() => null) as any };
  };
  beforeAll(async () => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    await mkdir(path.join(repo, "renders"), { recursive: true });
    root = await mkdtemp(path.join(repo, "renders", "shorts-route-"));
    const chDir = path.join(root, CH);
    epDir = path.join(chDir, "episodes", "986-shorts");
    await mkdir(epDir, { recursive: true });
    for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json"])
      await copyFile(path.join(repo, "channels", CH, f), path.join(chDir, f));
    process.env.BAL_CHANNELS_DIR = root;
    process.env.BAL_ENV_FILE = path.join(root, ".env");
    process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__shorts_route_signing_key_2026";
    await writeFile(process.env.BAL_ENV_FILE, `BAL_WORKFLOW_HMAC_KEY=${process.env.BAL_WORKFLOW_HMAC_KEY}\n`);
    await writeFile(path.join(epDir, "script.md"), `---\ntitle: "اختبار"\nepisode: "986"\n---\n\nجملة أولى قصيرة.\n\nجملة ثانية.\n\nجملة ثالثة.\n`);
    await writeFile(path.join(epDir, "plan.json"), JSON.stringify(plan(), null, 2) + "\n");
    vite = await createServer({
      configFile: false, root: path.join(repo, "app"), logLevel: "error", appType: "custom",
      plugins: [balApi()],
      server: { middlewareMode: true, hmr: false, watch: null, fs: { allow: [repo, root] } },
    });
    server = http.createServer(vite.middlewares);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }, 60_000);
  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    await vite?.close();
    for (const k of ENV_KEYS) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    if (root) await rm(root, { recursive: true, force: true });
  });

  it("القراءة: لا اختيار محفوظ، والمقترح شورت لكل قسم، والمشاهد بأرقامها ومددها", async () => {
    const r = await call("GET", "episodes/986/shorts");
    expect(r.status).toBe(200);
    expect(r.body.saved).toBeNull();
    expect(r.body.suggested).toHaveLength(2);
    expect(r.body.scenes.map((s: { n: number }) => s.n)).toEqual([1, 2, 3, 4]);
    expect(r.body.scenes.every((s: { seconds: number }) => s.seconds > 0)).toBe(true);
    expect(r.body.max).toBe(6);
  });
  it("الكتابة من موقع آخر 403 ولا تمس الخطة؛ والخطأ 400 بأسماء المشاهد", async () => {
    const before = await readFile(path.join(epDir, "plan.json"), "utf8");
    expect((await call("PUT", "episodes/986/shorts", { shorts: [] }, { origin: "https://evil.example" })).status).toBe(403);
    expect((await call("PUT", "episodes/986/shorts", { shorts: [] }, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    const bad = await call("PUT", "episodes/986/shorts", { shorts: [{ from: "c2-s1", to: "c1-s1" }] });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toContain("«المشهد ٣» بعد مشهد النهاية «المشهد ١»");
    expect(await readFile(path.join(epDir, "plan.json"), "utf8")).toBe(before);
  });
  it("الحفظ يكتب plan.shorts وحدها، و«احذف الاختيار» يعيد الخطة كما كانت", async () => {
    const before = JSON.parse(await readFile(path.join(epDir, "plan.json"), "utf8"));
    const ok = await call("PUT", "episodes/986/shorts", { shorts: [{ from: "c1-s2", to: "c2-s2", title: "عبر القسمين" }, { from: "c1-s1", to: "c1-s2" }] });
    expect(ok.status).toBe(200);
    expect(ok.body.saved).toEqual([{ from: "c1-s2", to: "c2-s2", title: "عبر القسمين" }, { from: "c1-s1", to: "c1-s2" }]);
    expect(ok.body.warnings[0]).toMatch(/يتداخل/);
    const after = JSON.parse(await readFile(path.join(epDir, "plan.json"), "utf8"));
    const { shorts, ...rest } = after;
    expect(shorts).toEqual(ok.body.saved);
    expect(rest).toEqual(before);
    expect(Object.keys(after).indexOf("shorts")).toBe(Object.keys(after).indexOf("chapters") - 1);
    const reset = await call("PUT", "episodes/986/shorts", { reset: true });
    expect(reset.status).toBe(200);
    expect(reset.body.saved).toBeNull();
    expect(JSON.parse(await readFile(path.join(epDir, "plan.json"), "utf8"))).toEqual(before);
  });
});
