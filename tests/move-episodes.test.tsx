import { browserPlanRevision } from "../src/plan/revision";
/**
 * Moving existing episodes into series and categories (owner request 11 Nov, D77): the row's visible action,
 * the selection dock, the dialog's tree (swatches, current marked, search), drag-and-drop logic, the bulk
 * endpoint (owner-only, a result per episode, atomic per episode) and «تراجع» — and never a change to
 * script.md or to anything but the episode's series file and its plan stamp.
 */
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { balApi } from "../app/server/api";
import { MoveEpisodesDialog, RowMoveButton, SelectionDock, movedLine, undoneLine } from "../app/src/tabs/MoveEpisodes";
import { SeriesGrid } from "../app/src/tabs/Series";
import { Band } from "../app/src/shell/Band";
import { STEPS } from "../app/src/shell/EpisodeSpine";
import {
  EPISODE_DRAG_TYPE, decodeDrag, dragEpisodes, dropVerdict, encodeDrag, moveTargetRows, searchKey, selectionLabel, sharedSeries,
} from "../app/src/tabs/seriesView";
import type { Overview, SeriesRead } from "../app/src/api";
import { GENERAL_SLUG, deriveSeriesIdentity, withGeneral, type SeriesConfig } from "../src/channel/series";

const noop = () => {};
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const cfg: SeriesConfig[] = withGeneral([
  { version: 1, id: "family", name: "الأسرة", kind: "category", order: 1 },
  { version: 1, id: "parents", name: "برّ الوالدين", kind: "series", parent: "family", order: 2 },
  { version: 1, id: "ramadan", name: "ليالي رمضان", kind: "series", order: 3, identity: { accent: { base: "#C2412D" } } },
  { version: 1, id: "old", name: "قديمة", kind: "series", order: 4, status: "archived" },
]);
const data: SeriesRead = { series: cfg.map((s) => ({ ...s, derived: deriveSeriesIdentity("balislam", s.identity ?? {}), episodes: 0 })), episodes: [], rules: null };
const ov = (id: string, series?: string, seriesNumber?: number): Overview => ({
  id, dir: `${id}-x`, title: `حلقة ${id}`, domain: "psychology", lang: "ar", check: { ok: true, errors: 0, warnings: 0, seconds: 60 }, scenes: 3, voice: { done: 0, total: 3 }, blocking: 0,
  package: { video: false, shorts: 0, thumbnails: 0, updatedAt: null }, planUpdatedAt: null, style: "", status: {}, series, seriesNumber,
  production: { script: true, storyboard: false, approvedScenes: 0, totalScenes: 3, canAssemble: false, assemblyApproved: false, masterApproved: false, publishAllowed: false },
});
const items = [ov("001"), ov("002"), ov("003", "parents", 1), ov("004", "ramadan", 1)];

describe("the move dialog: a tree with swatches, the current one marked, and a search", () => {
  it("rows in grid order with depth, the archived left out, the current marked", () => {
    const rows = moveTargetRows(data.series, "", "parents");
    expect(rows.map((r) => [r.id, r.depth])).toEqual([["family", 0], ["parents", 1], ["ramadan", 0], [GENERAL_SLUG, 0]]);
    expect(rows.find((r) => r.id === "parents")!.current).toBe(true);
    expect(rows.find((r) => r.id === "parents")!.path).toBe("الأسرة ← برّ الوالدين");
    expect(rows.find((r) => r.id === "ramadan")!.accent).toBe(data.series.find((s) => s.id === "ramadan")!.derived!.accent);
  });
  it("search ignores tashkeel and alef forms, and keeps a match's parents as context", () => {
    expect(searchKey("بِرّ الوالِدَين")).toBe(searchKey("بر الوالدين"));
    const rows = moveTargetRows(data.series, "بر");
    expect(rows.map((r) => [r.id, r.match])).toEqual([["family", false], ["parents", true]]);
    expect(moveTargetRows(data.series, "إلى لا شيء")).toEqual([]);
  });
  it("renders a radiogroup of series with swatches, «الحالية» on the current one, and a search field", () => {
    const html = renderToStaticMarkup(<MoveEpisodesDialog episodes={["003"]} current="parents" data={data} onClose={noop} onPick={noop} />);
    expect(html).toMatch(/role="radiogroup"[^>]*aria-label="السلاسل والتصنيفات"/);
    expect(html.match(/role="radio"/g)?.length).toBe(4);
    expect(html).toMatch(/aria-label="سلسلة الأسرة ← برّ الوالدين \(الحالية\)"/);
    expect(html).toContain('class="mv-cur">الحالية<');
    expect(html).toMatch(/type="search"[^>]*aria-label="ابحث عن سلسلة أو تصنيف"/);
    expect(html.match(/class="mv-sw" style="background:#[0-9a-fA-F]{6}"/g)?.length).toBe(4);
    expect(html).toMatch(/data-depth="1"[^>]*padding-inline-start:34px|padding-inline-start:34px[^>]*data-depth="1"/);
    expect(text(html)).toContain("انقل الحلقة ٣ إلى…");
    expect(text(html)).toContain("السكريبت ومشاهده واعتماداته لا تُلمس");
    expect(html).toMatch(/<button type="submit" class="btn primary" disabled=""/);
    expect(text(renderToStaticMarkup(<MoveEpisodesDialog episodes={["001", "002", "005"]} data={data} onClose={noop} onPick={noop} />))).toContain("انقل ٣ حلقات إلى…");
  });
});

describe("the channel home: a visible row action, a selection dock, the «عام» card", () => {
  it("each row's «انقل إلى…» is a labelled button with words, not an icon alone", () => {
    const html = renderToStaticMarkup(<RowMoveButton episode="007" onMove={noop} />);
    expect(html).toMatch(/class="ledger-move"[^>]*aria-label="انقل الحلقة ٧ إلى سلسلة أو تصنيف"/);
    expect(text(html)).toContain("انقل إلى…");
  });
  it("the dock while selecting: «انقل المحدّد (٣)» filled, «ألغِ التحديد» quiet", () => {
    expect(selectionLabel(3)).toBe("انقل المحدّد (٣)");
    const html = renderToStaticMarkup(<SelectionDock count={3} onMove={noop} onClear={noop} />);
    expect(html.match(/btn primary/g)?.length).toBe(1);
    expect(text(html)).toContain("انقل المحدّد (٣)");
    expect(text(html)).toContain("ألغِ التحديد");
  });
  it("the «عام» card offers «انقل حلقاتها إلى سلسلة» only when it has episodes", () => {
    const withGen = renderToStaticMarkup(<SeriesGrid data={data} items={items} onOpen={noop} onNew={noop} onMoveGeneral={noop} />);
    expect(withGen).toContain('class="sr-card-act"');
    expect(text(withGen)).toContain("انقل حلقاتها إلى سلسلة");
    const none = renderToStaticMarkup(<SeriesGrid data={data} items={items.filter((e) => e.series)} onOpen={noop} onNew={noop} onMoveGeneral={noop} />);
    expect(none).not.toContain("sr-card-act");
  });
  it("while dragging, the cards that can take the rows light up and the others dim", () => {
    const html = renderToStaticMarkup(<SeriesGrid data={data} items={items} onOpen={noop} onNew={noop} dragging={["001", "002"]} onDropEpisodes={noop} />);
    expect(html).toMatch(/class="sr-card[^"]*is-drop-ok"[^>]*data-series="ramadan"/);
    expect(html).toMatch(/class="sr-card[^"]*is-drop-no"[^>]*data-series="general"/);
    expect(html).toMatch(/class="sr-card[^"]*is-archived is-drop-no"[^>]*data-series="old"/);
    expect(text(html)).toContain("أفلِت حلقتين على سلسلة أو تصنيف لنقلها إليه");
  });
  it("the lines after a move and after «تراجع»", () => {
    const to = { id: "ramadan", name: "ليالي رمضان" };
    expect(movedLine({ to, results: [{ episode: "001", ok: true }, { episode: "002", ok: true }, { episode: "005", ok: true }] })).toBe("نُقلت ٣ حلقات إلى «ليالي رمضان».");
    expect(movedLine({ to, results: [{ episode: "001", ok: true }] })).toBe("نُقلت حلقة واحدة إلى «ليالي رمضان».");
    expect(movedLine({ to, results: [{ episode: "001", ok: true }, { episode: "009", ok: false, error: "غير موجودة" }] })).toBe("نُقلت حلقة واحدة إلى «ليالي رمضان». الحلقة ٩: غير موجودة");
    expect(undoneLine([{ episode: "001", ok: true }, { episode: "002", ok: true }])).toBe("أُعيدت حلقتان إلى سلاسلها السابقة.");
  });
});

describe("inside an episode: the band names its series with «غيّر السلسلة»", () => {
  it("the change button sits under the series name and names the episode", () => {
    const html = renderToStaticMarkup(<Band channels={[]} channelId="balislam" channelName="بالإسلام" onChannel={noop} onHome={noop}
      episode={{ id: "002", title: "ع" }} steps={{ done: [false, false, false, false], here: 0 }} stepTitles={STEPS.map((s) => s.title)} onStep={noop}
      series={{ id: GENERAL_SLUG, name: "عام", kind: "تصنيف" }} onChangeSeries={noop} manage={[]} active="storyboard" onManage={noop} />);
    expect(html).toMatch(/class="ms-band-series"[^>]*aria-label="تصنيف عام"/);
    expect(html).toMatch(/class="ms-band-reseries"[^>]*aria-label="غيّر سلسلة الحلقة ٢"[^>]*>غيّر السلسلة</);
  });
});

describe("drag and drop logic", () => {
  it("a selected row drags the whole selection, an unselected row drags itself", () => {
    const sel = new Set(["004", "001"]);
    expect(dragEpisodes("001", sel)).toEqual(["001", "004"]);
    expect(dragEpisodes("002", sel)).toEqual(["002"]);
  });
  it("only a Studio row payload is accepted", () => {
    expect(EPISODE_DRAG_TYPE).toBe("application/x-bal-episodes");
    expect(decodeDrag(encodeDrag(["001", "002", "001"]))).toEqual(["001", "002"]);
    for (const bad of ["", "nope", JSON.stringify({ episodes: [] }), JSON.stringify({ episodes: ["../x"] }), JSON.stringify(["001"])]) expect(decodeDrag(bad)).toBeNull();
  });
  it("no drop on an archived card, nor where every dragged episode already is", () => {
    const s = (id: string) => cfg.find((x) => x.id === id);
    expect(dropVerdict(s("ramadan"), ["001", "004"], items).ok).toBe(true);
    expect(dropVerdict(s("ramadan"), ["004"], items)).toEqual({ ok: false, reason: "هي فيها" });
    expect(dropVerdict(s("old"), ["001"], items)).toEqual({ ok: false, reason: "مؤرشفة" });
    expect(dropVerdict(s("family"), ["003"], items).ok).toBe(true); // up from a series into its category
    expect(dropVerdict(undefined, ["001"], items).ok).toBe(false);
    expect(sharedSeries(["001", "002"], items)).toBe(GENERAL_SLUG);
    expect(sharedSeries(["001", "004"], items)).toBeUndefined();
  });
});

// ———————— The bulk endpoint and «تراجع» on the real Studio server (a temp channel) ————————

const repo = path.resolve(import.meta.dirname, "..");
const CH = "balislam";
const ENV_KEYS = ["BAL_CHANNELS_DIR", "BAL_ENV_FILE", "BAL_WORKFLOW_HMAC_KEY"];
const saved: Record<string, string | undefined> = {};
let root = "";
let eps = "";
let vite: ViteDevServer;
let server: http.Server;
let base = "";
const call = async (method: string, route: string, body?: unknown, headers: Record<string, string> = {}) => {
  const r = await fetch(`${base}/api/${route}?channel=${CH}`, {
    method,
    headers: { "sec-fetch-site": "same-origin", ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: (await r.json().catch(() => null)) as any };
};
/** Every file of an episode folder with its hash, except the two a move may write. */
const fingerprint = async (dir: string) => {
  const out: Record<string, string> = {};
  const walk = async (d: string) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) await walk(f);
      else if (!["series.json", "plan.json"].includes(path.relative(dir, f))) out[path.relative(dir, f)] = createHash("sha256").update(await readFile(f)).digest("hex");
    }
  };
  await walk(dir);
  return out;
};
const linkOf = (d: string) => (existsSync(path.join(eps, d, "series.json")) ? JSON.parse(readFileSync(path.join(eps, d, "series.json"), "utf8")) : null);
const planOf = (d: string) => JSON.parse(readFileSync(path.join(eps, d, "plan.json"), "utf8"));
const DIRS = ["981-move-a", "982-move-b", "983-move-c"];

beforeAll(async () => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  await mkdir(path.join(repo, "renders"), { recursive: true });
  root = await mkdtemp(path.join(repo, "renders", "move-episodes-"));
  const chDir = path.join(root, CH);
  eps = path.join(chDir, "episodes");
  for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json"]) {
    await mkdir(chDir, { recursive: true });
    await copyFile(path.join(repo, "channels", CH, f), path.join(chDir, f));
  }
  for (const d of DIRS) {
    const n = d.slice(0, 3);
    await mkdir(path.join(eps, d, "workflow"), { recursive: true });
    await writeFile(path.join(eps, d, "script.md"), `---\ntitle: "نقل ${n}"\nepisode: "${n}"\n---\n## الفصل 1 · تجربة\nالصَّبْرُ مِفْتَاحُ الفَرَجِ.\n`);
    await writeFile(path.join(eps, d, "plan.json"), JSON.stringify({ episode: n, title: "نقل", tone: "calm", chapters: [{ number: 1, title: "تجربة", scenes: [{ id: "c1-s1", template: "alley-tale", line: 6, narration: "الصَّبْرُ مِفْتَاحُ الفَرَجِ.", sfx: [], props: {} }] }] }, null, 2));
    await writeFile(path.join(eps, d, "workflow", "scene-production.json"), JSON.stringify({ approvals: [{ kind: "script", hash: "abc" }] }));
  }
  for (const [id, name] of [["ramadan", "ليالي رمضان"], ["hajj", "رحلة الحج"]] as const) {
    await mkdir(path.join(chDir, "series", id), { recursive: true });
    await writeFile(path.join(chDir, "series", id, "series.json"), JSON.stringify({ version: 1, id, name, kind: "series", status: "active", identity: {}, template: {} }, null, 2));
  }
  process.env.BAL_CHANNELS_DIR = root;
  const envFile = path.join(root, ".env");
  process.env.BAL_ENV_FILE = envFile;
  process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__move_episodes_signing_key_2026";
  await writeFile(envFile, `BAL_WORKFLOW_HMAC_KEY=${process.env.BAL_WORKFLOW_HMAC_KEY}\n`);
  vite = await createServer({
    configFile: false, root: path.join(repo, "app"), logLevel: "error", appType: "custom",
    plugins: [balApi()],
    server: { middlewareMode: true, hmr: false, watch: null, fs: { allow: [repo, root] } },
  });
  server = http.createServer(vite.middlewares);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  // الإحماء داخل مهلة التجهيز (60 ث): أول طلب لمسارات السلاسل يحوّل وحداتها بـ ssrLoadModule، وهذا تجاوز 5 ث على
  // خادم CI المزدحم. قراءة القائمة لا تكتب شيئًا، فيبقى اختبار «المالك وحده» يقيس الرفض لا كلفة التحويل الأول (033).
  expect((await call("GET", "series")).status).toBe(200);
}, 60_000);
afterAll(async () => {
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  await vite?.close();
  for (const k of ENV_KEYS) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (root) await rm(root, { recursive: true, force: true });
});

describe("POST /api/series/move-episodes", () => {
  it("owner only: another site is refused and nothing moves", async () => {
    const r = await call("POST", "series/move-episodes", { to: "ramadan", episodes: ["981"] }, { origin: "https://evil.example" });
    expect(r.status).toBe(403);
    expect(linkOf("981-move-a")).toBeNull();
    expect((await call("POST", "series/move-episodes", { to: "ramadan", episodes: ["../x"] })).status).toBe(400);
    expect((await call("POST", "series/move-episodes", { to: "ramadan", episodes: [] })).status).toBe(400);
  });
  it("moves many at once, numbered in episode order, a result per episode; script.md and approvals untouched", async () => {
    const before = Object.fromEntries(await Promise.all(DIRS.map(async (d) => [d, await fingerprint(path.join(eps, d))])));
    const r = await call("POST", "series/move-episodes", { to: "ramadan", episodes: ["982", "981", "999"] });
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(false);
    expect(r.body.to).toMatchObject({ id: "ramadan", name: "ليالي رمضان" });
    const by = Object.fromEntries(r.body.results.map((x: any) => [x.episode, x]));
    expect(by["981"]).toMatchObject({ ok: true, from: GENERAL_SLUG, to: "ramadan", number: 1 });
    expect(by["982"]).toMatchObject({ ok: true, number: 2 });
    expect(by["999"].ok).toBe(false);
    expect(typeof r.body.undo).toBe("string");
    expect(linkOf("981-move-a").stamp.number).toBe(1);
    expect(planOf("982-move-b").series.number).toBe(2);
    for (const d of DIRS) expect(await fingerprint(path.join(eps, d))).toEqual(before[d]);
    // The series page and the home read the new membership
    const list = await call("GET", "series");
    expect(list.body.episodes.filter((e: any) => e.series === "ramadan").map((e: any) => e.id).sort()).toEqual(["981", "982"]);
  });
  it("a stale plan saved from the page keeps the new series stamp (the stamp belongs to the move)", async () => {
    const stale = planOf("983-move-c");
    await call("POST", "series/move-episodes", { to: "hajj", episodes: ["983"] });
    expect(planOf("983-move-c").series.number).toBe(1);
    const put = await call("PUT", "episodes/983/plan", { plan: stale, expectedRevision: await browserPlanRevision((await call("GET", "episodes/983")).body.plan) });
    expect(put.status).toBe(200);
    expect(planOf("983-move-c").series).toMatchObject({ number: 1 });
    expect(linkOf("983-move-c").series).toBe("hajj");
  });
  it("«تراجع» restores each episode's exact link and stamp (its old number too); the token works once", async () => {
    const m1 = await call("POST", "series/move-episodes", { to: "hajj", episodes: ["981", "982"] });
    expect(m1.body.results.map((x: any) => x.number)).toEqual([2, 3]);
    const scriptBefore = readFileSync(path.join(eps, "981-move-a", "script.md"), "utf8");
    const u = await call("POST", "series/move-episodes/undo", { token: m1.body.undo });
    expect(u.status).toBe(200);
    expect(u.body.ok).toBe(true);
    expect(linkOf("981-move-a")).toMatchObject({ series: "ramadan", stamp: { number: 1 } });
    expect(linkOf("982-move-b")).toMatchObject({ series: "ramadan", stamp: { number: 2 } });
    expect(planOf("982-move-b").series.number).toBe(2);
    expect(readFileSync(path.join(eps, "981-move-a", "script.md"), "utf8")).toBe(scriptBefore);
    expect((await call("POST", "series/move-episodes/undo", { token: m1.body.undo })).status).toBe(410);
  });
  it("undo back to «عام» removes the link file; moving where it already is changes nothing and gives no undo", async () => {
    const m = await call("POST", "series/move-episodes", { to: GENERAL_SLUG, episodes: ["981"] });
    expect(linkOf("981-move-a")).toBeNull();
    expect(planOf("981-move-a").series).toBeUndefined();
    const same = await call("POST", "series/move-episodes", { to: GENERAL_SLUG, episodes: ["981"] });
    expect(same.body.results[0]).toMatchObject({ ok: true, unchanged: true });
    expect(same.body.undo).toBeNull();
    await call("POST", "series/move-episodes/undo", { token: m.body.undo });
    expect(linkOf("981-move-a")).toMatchObject({ series: "ramadan", stamp: { number: 1 } });
  });
  it("undo never writes a duplicate number: when another episode took it, the episode takes the next one", async () => {
    const m = await call("POST", "series/move-episodes", { to: "hajj", episodes: ["981"] });
    await call("POST", "series/move-episodes", { to: "ramadan", episodes: ["983"] });
    // The clash: 983 holds ramadan #1 (981's old number) by hand, as if it had been numbered there meanwhile
    const link = linkOf("983-move-c");
    link.stamp.number = 1;
    await writeFile(path.join(eps, "983-move-c", "series.json"), JSON.stringify(link, null, 2));
    const u = await call("POST", "series/move-episodes/undo", { token: m.body.undo });
    expect(u.body.results[0]).toMatchObject({ ok: true, to: "ramadan" });
    expect(u.body.results[0].note).toContain("الرقم التالي");
    expect(linkOf("981-move-a").stamp.number).not.toBe(1);
  });
  it("an archived target is refused whole", async () => {
    const f = path.join(root, CH, "series", "hajj", "series.json");
    const s = JSON.parse(readFileSync(f, "utf8"));
    await writeFile(f, JSON.stringify({ ...s, status: "archived" }));
    const r = await call("POST", "series/move-episodes", { to: "hajj", episodes: ["982"] });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain("مؤرشفة");
  });
});
