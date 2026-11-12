/**
 * D107 (review of PR #97, finding 1): moving an episode to another series or saving its shorts writes plan.json
 * on the server. The page's next edit must still save (no 409), and a real 409 must never trap the owner.
 * Driven through the page's own path: the studio client (`app/src/api.ts`), the page's save queue and merge,
 * against the real studio server (Vite + balApi) on a temporary channels folder. No voice, no approval.
 */
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type ViteDevServer } from "vite";
import { balApi } from "../app/server/api";
import { api, isPlanConflict, setApiChannel } from "../app/src/api";
import { PlanSaveQueue } from "../app/src/planSaveQueue";
import { PlanSaveRecovery } from "../app/src/PlanSaveRecovery";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mergePlans, withServerFields } from "../app/src/planMerge";
import { notifyPlanServerFields, PLAN_SERVER_FIELDS_EVENT } from "../app/src/planServerFields";
import { browserPlanRevision, planRevisionSource } from "../src/plan/revision";
import type { Plan } from "../src/plan/types";

const repo = path.resolve(import.meta.dirname, "..");
const CH = "balislam";
const ENV_KEYS = ["BAL_CHANNELS_DIR", "BAL_ENV_FILE", "BAL_WORKFLOW_HMAC_KEY"];
const saved: Record<string, string | undefined> = {};
let root = "";
let eps = "";
let vite: ViteDevServer;
let server: http.Server;
let base = "";
const realFetch = globalThis.fetch;
const EPISODES = { "985": "985-owned-a", "986": "986-owned-b", "987": "987-owned-c" } as const;
type Ep = keyof typeof EPISODES;
const narration = ["الصَّبْرُ مِفْتَاحُ الفَرَجِ.", "وَالشُّكْرُ يَزِيدُ النِّعَمَ.", "وَالرِّضَا رَاحَةُ القَلْبِ."];

const planOnDisk = async (ep: Ep) => JSON.parse(await readFile(path.join(eps, EPISODES[ep], "plan.json"), "utf8")) as Plan;
/** One studio page: loads the episode, keeps its queue, edits and saves as App.tsx does. */
const openPage = async (ep: Ep) => {
  const d = await api.episode(ep, CH);
  const queue = new PlanSaveQueue<Plan>(async (item, rev) => (await api.savePlan(item.episode, item.value, item.channel, rev)).planRevision);
  queue.seed(CH, ep, browserPlanRevision(d.plan), d.plan);
  let plan = d.plan;
  return {
    queue,
    get plan() { return plan; },
    edit(scene: string, text: string) {
      plan = structuredClone(plan);
      plan.chapters[0]!.scenes.find((s) => s.id === scene)!.props.text = text;
      queue.enqueue(CH, ep, plan);
      return queue.flush();
    },
  };
};

beforeAll(async () => {
  for (const k of ENV_KEYS) saved[k] = process.env[k];
  await mkdir(path.join(repo, "renders"), { recursive: true });
  root = await mkdtemp(path.join(repo, "renders", "plan-owned-fields-"));
  const chDir = path.join(root, CH);
  eps = path.join(chDir, "episodes");
  await mkdir(chDir, { recursive: true });
  for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json"]) await copyFile(path.join(repo, "channels", CH, f), path.join(chDir, f));
  for (const [n, d] of Object.entries(EPISODES)) {
    await mkdir(path.join(eps, d), { recursive: true });
    await writeFile(path.join(eps, d, "script.md"), `---\ntitle: "حقول الخادم ${n}"\nepisode: "${n}"\n---\n${narration.join("\n\n")}\n`);
    await writeFile(path.join(eps, d, "plan.json"), JSON.stringify({ episode: n, title: "حقول الخادم", tone: "calm", chapters: [{ number: 1, title: "", scenes: narration.map((t, i) => ({
      id: `c1-s${i + 1}`, template: "alley-tale", line: 5 + i * 2, narration: t, sfx: [], props: {},
    })) }] }, null, 2));
  }
  await mkdir(path.join(chDir, "series", "ramadan"), { recursive: true });
  await writeFile(path.join(chDir, "series", "ramadan", "series.json"), JSON.stringify({ version: 1, id: "ramadan", name: "ليالي رمضان", kind: "series", status: "active", identity: {}, template: {} }, null, 2));
  process.env.BAL_CHANNELS_DIR = root;
  process.env.BAL_ENV_FILE = path.join(root, ".env");
  process.env.BAL_WORKFLOW_HMAC_KEY = "LOCAL_TEST_ONLY__plan_owned_fields_signing_key_2026";
  await writeFile(process.env.BAL_ENV_FILE, `BAL_WORKFLOW_HMAC_KEY=${process.env.BAL_WORKFLOW_HMAC_KEY}\n`);
  vite = await createServer({
    configFile: false, root: path.join(repo, "app"), logLevel: "error", appType: "custom",
    plugins: [balApi()],
    server: { middlewareMode: true, hmr: false, watch: null, fs: { allow: [repo, root] } },
  });
  server = http.createServer(vite.middlewares);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  // The page's client calls relative URLs from the studio's own origin.
  globalThis.fetch = ((input: string, init?: RequestInit) => realFetch(base + input, {
    ...init, headers: { "sec-fetch-site": "same-origin", ...(init?.headers as Record<string, string> | undefined) },
  })) as typeof fetch;
  setApiChannel(CH);
  await api.episode("985", CH); // warm-up inside the setup timeout
}, 90_000);
afterAll(async () => {
  globalThis.fetch = realFetch;
  await new Promise<void>((resolve) => server?.close(() => resolve()));
  await vite?.close();
  for (const k of ENV_KEYS) if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
  if (root) await rm(root, { recursive: true, force: true });
});

describe("server-owned plan fields never make the page's next edit stale", { timeout: 60_000 }, () => {
  it("the revision leaves out the series stamp and the shorts, and nothing else", () => {
    const p = { episode: "1", title: "t", chapters: [] } as unknown as Plan;
    const moved = { ...p, series: { id: "x", number: 3 }, shorts: [{ from: "a", to: "b" }] } as unknown as Plan;
    expect(planRevisionSource(moved)).toBe(planRevisionSource(p));
    expect(planRevisionSource({ ...p, title: "other" })).not.toBe(planRevisionSource(p));
  });

  it("move to a series, then save the shorts, then edit a scene: saved, and the stamp and shorts are kept", async () => {
    const page = await openPage("985");
    const moved = await api.moveEpisodes("ramadan", ["985"]);
    expect(moved.results[0]).toMatchObject({ ok: true, to: "ramadan", number: 1 });
    const shorts = await api.saveShorts("985", [{ from: "c1-s1", to: "c1-s2", title: "الصبر والشكر" }]);
    expect(shorts.saved).toEqual([{ from: "c1-s1", to: "c1-s2", title: "الصبر والشكر" }]);
    // The page still holds the plan it loaded before both: no stamp, no shorts.
    expect(page.plan.series).toBeUndefined();
    expect(page.plan.shorts).toBeUndefined();
    await page.edit("c1-s1", "الصبر");
    expect(page.queue.hasPending).toBe(false);
    await page.edit("c1-s2", "الشكر"); // and the one after, against the acknowledged revision
    const disk = await planOnDisk("985");
    expect(disk.series).toMatchObject({ id: "ramadan", number: 1 });
    expect(disk.shorts).toEqual([{ from: "c1-s1", to: "c1-s2", title: "الصبر والشكر" }]);
    expect(disk.chapters[0]!.scenes.map((s) => s.props.text)).toEqual(["الصبر", "الشكر", undefined]);
    // Undo of the move is server-owned too: still no 409 for the page.
    await api.undoMoveEpisodes(moved.undo!);
    expect((await planOnDisk("985")).series).toBeUndefined();
    await page.edit("c1-s3", "الرضا");
    expect((await planOnDisk("985")).shorts).toHaveLength(1);
  });

  it("the page takes the refreshed fields without touching its own edit", () => {
    const mine = { episode: "1", title: "mine", chapters: [] } as unknown as Plan;
    const server = { episode: "1", title: "server", series: { id: "ramadan", number: 2 }, shorts: [{ from: "a", to: "b" }], chapters: [] } as unknown as Plan;
    expect(withServerFields(mine, server)).toEqual({ ...mine, series: server.series, shorts: server.shorts });
    expect(withServerFields(server, mine)).toEqual({ episode: "1", title: "server", chapters: [] });
  });

  it("the move and the shorts picker announce the change to the page", () => {
    const target = new EventTarget();
    const g = globalThis as unknown as { window?: EventTarget };
    const had = g.window;
    g.window = target;
    const seen: unknown[] = [];
    target.addEventListener(PLAN_SERVER_FIELDS_EVENT, (e) => seen.push((e as CustomEvent).detail));
    try { notifyPlanServerFields(["985"]); } finally { if (had === undefined) delete g.window; else g.window = had; }
    expect(seen).toEqual([{ episodes: ["985"] }]);
    for (const [file, calls] of [["app/src/tabs/MoveEpisodes.tsx", 2], ["app/src/tabs/ShortsPicker.tsx", 2]] as const)
      expect((readFileSync(path.join(repo, file), "utf8").match(/notifyPlanServerFields\(/g) ?? []).length, file).toBe(calls);
  });
});

describe("a real 409 never traps the owner", { timeout: 60_000 }, () => {
  it("«حمّل النسخة الأحدث وأعد تطبيق تعديلي»: another window's edit and mine both land", async () => {
    const a = await openPage("986");
    const b = await openPage("986");
    await b.edit("c1-s2", "من نافذة أخرى");
    const refused = await a.edit("c1-s1", "تعديلي").then(() => null, (e) => e);
    expect(isPlanConflict(refused)).toBe(true);
    expect(a.queue.hasPending).toBe(true);
    const item = a.queue.snapshot!;
    const theirs = (await api.episode("986", CH)).plan;
    const merged = mergePlans(a.queue.baseOf(CH, "986")!, item.value, theirs);
    expect(merged.ok).toBe(true);
    if (!merged.ok) return;
    a.queue.rebase(CH, "986", browserPlanRevision(theirs), theirs, merged.plan);
    await a.queue.flush();
    expect(a.queue.hasPending).toBe(false);
    expect((await planOnDisk("986")).chapters[0]!.scenes.map((s) => s.props.text)).toEqual(["تعديلي", "من نافذة أخرى", undefined]);
  });

  it("the same field changed in both: nothing is applied, the places are named, and leaving frees the page", async () => {
    const a = await openPage("987");
    const b = await openPage("987");
    await b.edit("c1-s1", "نسختهم");
    const refused = await a.edit("c1-s1", "نسختي").then(() => null, (e) => e);
    expect(isPlanConflict(refused)).toBe(true);
    const theirs = (await api.episode("987", CH)).plan;
    const merged = mergePlans(a.queue.baseOf(CH, "987")!, a.queue.snapshot!.value, theirs);
    expect(merged).toEqual({ ok: false, conflicts: ["chapters › 1 › scenes › c1-s1 › props › text"] });
    expect((await planOnDisk("987")).chapters[0]!.scenes[0]!.props.text).toBe("نسختهم");
    // The escape: the edit is handed back (for its backup), the queue is free, and the page reopens the saved plan.
    expect(a.queue.discard()?.value.chapters[0]!.scenes[0]!.props.text).toBe("نسختي");
    expect(a.queue.hasPending).toBe(false);
    const again = await openPage("987");
    await again.edit("c1-s2", "بعد الفتح");
    expect((await planOnDisk("987")).chapters[0]!.scenes.map((s) => s.props.text)).toEqual(["نسختهم", "بعد الفتح", undefined]);
  });
});

describe("the recovery bar", () => {
  const props = (conflict: boolean) => {
    const queue = new PlanSaveQueue<Plan>(async () => "r");
    queue.enqueue("balislam", "001", { episode: "001", chapters: [] } as unknown as Plan);
    return { queue, conflict, retry: async () => {}, latest: async () => ({}) as Plan, revisionOf: async () => "r", onPlan: () => {}, onLeft: () => {} };
  };
  it("409: offers the merge, the download and the way out; never a dead end", () => {
    const html = renderToStaticMarkup(React.createElement(PlanSaveRecovery, props(true)));
    for (const t of ["حمّل النسخة الأحدث وأعد تطبيق تعديلي", "نزّل نسخة تعديلك", "افتح النسخة المحفوظة (بعد نسخة من تعديلي)"]) expect(html).toContain(t);
    expect(html).not.toContain("أعد محاولة الحفظ");
  });
  it("offline: offers the retry and the same way out", () => {
    const html = renderToStaticMarkup(React.createElement(PlanSaveRecovery, props(false)));
    for (const t of ["أعد محاولة الحفظ", "افتح النسخة المحفوظة (بعد نسخة من تعديلي)"]) expect(html).toContain(t);
  });
});

describe("mergePlans", () => {
  const plan = (scenes: { id: string; t?: string }[], extra: Record<string, unknown> = {}) => ({
    episode: "1", title: "t", updatedAt: "base", ...extra,
    chapters: [{ number: 1, title: "", scenes: scenes.map((s) => ({ id: s.id, template: "x", narration: "", sfx: [], props: s.t ? { text: s.t } : {} })) }],
  }) as unknown as Plan;
  const texts = (p: Plan) => p.chapters[0]!.scenes.map((s) => `${s.id}:${s.props.text ?? ""}`);
  it("keeps a scene added on one side and deleted on the other where the other side did not edit it", () => {
    const b = plan([{ id: "s1" }, { id: "s2" }, { id: "s3" }]);
    const mine = plan([{ id: "s1", t: "m" }, { id: "s2" }, { id: "s3" }, { id: "s4", t: "new" }]);
    const theirs = plan([{ id: "s1" }, { id: "s3" }], { updatedAt: "server", series: { id: "r" } });
    const r = mergePlans(b, mine, theirs);
    expect(r.ok && texts(r.plan)).toEqual(["s1:m", "s3:", "s4:new"]);
    expect(r.ok && [r.plan.updatedAt, (r.plan as unknown as { series: unknown }).series]).toEqual(["server", { id: "r" }]);
  });
  it("a reorder on one side wins; two different reorders conflict; editing a scene the other deleted conflicts", () => {
    const b = plan([{ id: "s1" }, { id: "s2" }, { id: "s3" }]);
    const r = mergePlans(b, plan([{ id: "s3" }, { id: "s1" }, { id: "s2" }]), plan([{ id: "s1" }, { id: "s2", t: "x" }, { id: "s3" }]));
    expect(r.ok && texts(r.plan)).toEqual(["s3:", "s1:", "s2:x"]);
    expect(mergePlans(b, plan([{ id: "s3" }, { id: "s1" }, { id: "s2" }]), plan([{ id: "s2" }, { id: "s3" }, { id: "s1" }])).ok).toBe(false);
    expect(mergePlans(b, plan([{ id: "s1" }, { id: "s2", t: "m" }, { id: "s3" }]), plan([{ id: "s1" }, { id: "s3" }]))).toEqual({ ok: false, conflicts: ["chapters › 1 › scenes › s2"] });
  });
  it("the same change on both sides is not a conflict", () => {
    const b = plan([{ id: "s1" }]);
    const r = mergePlans(b, plan([{ id: "s1", t: "same" }]), plan([{ id: "s1", t: "same" }]));
    expect(r.ok && texts(r.plan)).toEqual(["s1:same"]);
  });
});
