/**
 * D142 (KI-072, owner, 14 Nov, زبدة الكتب): «هو قالي انه اعاد انتاج المشهد ولكن لا يظهر الجديد». A channel conversation
 * changes a scene in the cloud and pushes to main; the owner's studio receives it (D101) but videos never travel
 * through Git, so his old video stays on screen. Over the REAL Studio server and two clones of one bare «GitHub»:
 *   «cloud» pushes a plan change on scene 1 and a renderer-code change that names scene 2 (`Studio-Scenes:`) →
 *   the «Mac» receives (the studio's own sync loop) → both scenes flagged «وصل تعديل من المحادثة…», their drafts no
 *   longer «ready», the signed ledger re-opens exactly those two (D76) and scene 3 stays as it was →
 *   «أنتج هذا المشهد» → a new cut, the flag gone. And a receive that fails says so («لم تصل التحديثات»).
 * Fake voice provider only (BAL_VOICE_PROVIDER=fake), a tiny real render, no key, no network.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { browserPlanRevision } from "../../src/plan/revision";
import { createContentSync, pendingContent, pushContentOnce } from "../../app/server/contentSync";
import { remoteChangeLine } from "../../app/src/workspace/sceneProduction/remoteChange";
import { CASES, selectedChannels, type ChannelCase } from "./channels";
import { ffmpeg, fixturesDir, git, sha256File, startStudio, waitFor, type Studio } from "./harness";

const EP = "001";
const realFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input?.url ?? input);
    if (!/^http:\/\/127\.0\.0\.1:/.test(url)) throw new Error(`[e2e] network call refused: ${url}`);
    return realFetch(input, init);
  }) as typeof fetch;
});
afterAll(() => { globalThis.fetch = realFetch; });

for (const channel of selectedChannels()) {
  const c: ChannelCase = CASES[channel]!;
  describe(`D142 a conversation's edit reaches the studio — ${channel}`, () => {
    let st: Studio;
    let epDir = "";
    let cloud = "";
    const fx = (f: string) => readFile(path.join(fixturesDir, channel, f), "utf8");
    const ok = (label: string, r: { status: number; body: any }, status = 200) =>
      expect(r.status, `${label} → ${r.status}: ${JSON.stringify(r.body).slice(0, 900)}`).toBe(status);
    const state = async () => { const r = await st.call("GET", `episodes/${EP}/scene-production`); ok("state", r); return r.body; };

    beforeAll(async () => {
      st = await startStudio(channel);
      epDir = path.join(st.channelsDir, channel, "episodes", `${EP}-${c.slug}`);
      cloud = path.join(st.root, "..", `${path.basename(st.root)}-cloud`);
    }, 300_000);
    afterAll(async () => { await rm(cloud, { recursive: true, force: true }); await st?.close(); });

    it("flags exactly the changed scenes, re-produces one, and says when updates do not arrive", async () => {
      ok("create", await st.call("POST", "episodes", { episode: EP, slug: c.slug, domain: c.domain, title: c.title }));
      ok("script", await st.call("PUT", `episodes/${EP}/script`, { text: await fx("script.md") }));
      ok("research", await st.call("PUT", `episodes/${EP}/research`, { text: await fx("research.md") }));
      await writeFile(path.join(epDir, "tashkeel.md"), await fx("tashkeel.md"));
      const plan = (await st.call("GET", `episodes/${EP}`)).body.plan;
      const plates: Record<string, string> = {};
      for (const x of plan.chapters.flatMap((ch: any) => ch.scenes).filter((x: any) => x.template === "doc-plate" && !x.props?.image)) {
        const png = path.join(st.root, `${x.id}-plate.png`);
        ffmpeg(["-f", "lavfi", "-i", "mandelbrot=s=1280x720:end_pts=1", "-frames:v", "1", png]);
        const up = await st.call("POST", `episodes/${EP}/images`, { name: `${x.id}.png`, scene: x.id, data: (await readFile(png)).toString("base64") });
        ok(`${x.id}: plate`, up);
        plates[x.id] = up.body.file;
      }
      const shaped = { ...plan, tone: c.episodeTone, chapters: plan.chapters.map((ch: any) => ({ ...ch, scenes: ch.scenes.map((x: any) =>
        x.id === "c1-end" ? { ...x, durationSec: 4, edited: true }
        : plates[x.id] ? { ...x, props: { ...x.props, image: plates[x.id] }, edited: true } : x) })) };
      ok("plan", await st.call("PUT", `episodes/${EP}/plan`, { plan: shaped, expectedRevision: await browserPlanRevision(plan) }));
      let s = await state();
      ok("approve preparation", await st.call("POST", `episodes/${EP}/approve-preparation`,
        { reviewed: true, scriptSha256: s.script.sha256, storyboardSha256: s.storyboard.sha256, note: "راجعته بنفسي" }));
      const job = await waitFor("drafts", () => st.call("GET", `episodes/${EP}/scene-prepare`), (x) => x.body.job && x.body.job.status !== "running", 1_200_000, 1000);
      expect(job.body.job, JSON.stringify(job.body).slice(0, 900)).toMatchObject({ status: "done", failed: [] });
      const [one, two, three] = c.scenes as [string, string, string];
      s = await state();
      for (const id of [one, two, three]) expect(s.scenes.find((x: any) => x.id === id).draft, id).toBe("ready");
      const cutBefore = s.candidates.scenes[one] as string;

      // The Mac's content is on «GitHub» (D101 content save; the ledger, voice and videos stay here).
      const pending = await pendingContent(st.root);
      const saved = await pushContentOnce(st.root, pending!.files);
      expect(saved.ok, JSON.stringify(saved)).toBe(true);
      await new Promise((r) => setTimeout(r, 1_100)); // the drafts are older than what arrives next

      // «cloud»: a conversation's session pulls main, changes scene 1's plan and scene 2's drawing code, pushes.
      git(path.dirname(cloud), ["clone", "-q", st.remote, cloud]);
      const rel = path.relative(st.root, path.join(epDir, "plan.json")).split(path.sep).join("/");
      const cloudPlan = JSON.parse(await readFile(path.join(cloud, rel), "utf8"));
      for (const ch of cloudPlan.chapters) for (const x of ch.scenes) if (x.id === one) { x.durationSec = 9; x.edited = true; }
      await writeFile(path.join(cloud, rel), JSON.stringify(cloudPlan, null, 2) + "\n");
      git(cloud, ["commit", "-q", "-am", "المحادثة: مدة المشهد الأول"]);
      const code = path.join(cloud, "src", "remotion", "zubdat", "e2e-touch.ts");
      await mkdir(path.dirname(code), { recursive: true });
      await writeFile(code, "export const touched = true;\n");
      git(cloud, ["add", "-A"]);
      git(cloud, ["commit", "-q", "-m", `المحادثة: رسوم المشهد الثاني\n\nStudio-Scenes: ${channel}/${EP}: ${two}`]);
      git(cloud, ["push", "-q", "origin", "main"]);
      const pushed = git(cloud, ["rev-parse", "HEAD"]);

      // «Mac»: the studio's own sync loop receives it.
      const sync = createContentSync(st.root, { enabled: true, quietMs: 0, log: () => {} });
      await sync.tick(true);
      expect(sync.state.receiveError, sync.state.message).toBeUndefined();
      expect(git(st.root, ["rev-parse", "HEAD"]), "the Mac is on the pushed main").toBe(pushed);
      const labels = sync.state.lastReceived?.items.map((x) => x.label) ?? [];
      expect(labels.join("\n"), JSON.stringify(sync.state.lastReceived)).toContain("المشهد ١، المشهد ٢");

      s = await state();
      const sc = (id: string) => s.scenes.find((x: any) => x.id === id);
      expect(sc(one).remoteChange?.what, JSON.stringify(sc(one))).toEqual(["plan"]);
      expect(sc(two).remoteChange?.what, JSON.stringify(sc(two))).toEqual(["engine"]);
      expect(remoteChangeLine(sc(two).remoteChange)).toContain("اضغط «أنتج هذا المشهد» لترى الجديد");
      expect(sc(one).draft, "the old draft is not offered as ready").toBe("stale");
      expect(sc(two).draft).toBe("stale");
      expect(sc(three).remoteChange ?? null, "an unchanged scene is not flagged").toBeNull();
      expect(sc(three).draft, "and keeps its draft").toBe("ready");
      // The signed ledger re-opened those two alone, by a system event (no approval on the owner's behalf).
      const ev = [...s.recentHistory].reverse().find((h: any) => h.action === "update-after-preparation");
      expect(ev?.by).toBe("system");
      expect(ev.change.scenes.map((x: any) => x.id).sort()).toEqual([one, two].sort());

      // «أنتج هذا المشهد» on scene 1: a new cut, and the line is gone.
      const r = await st.call("POST", `episodes/${EP}/scene-av-render`, { sceneId: one, expectedSha256: sc(one).sourceSha256 });
      ok("render", r);
      s = await state();
      const cutAfter = s.candidates.scenes[one] as string;
      expect(cutAfter, "a new cut").not.toBe(cutBefore);
      expect(await sha256File(path.join(epDir, "previews", `scene-${one}-av.mp4`))).toBe(cutAfter);
      expect(sc(one).remoteChange ?? null, "nothing newer than the video now").toBeNull();
      expect(sc(two).remoteChange?.what, "scene 2 still waits for its own «أنتج»").toEqual(["engine"]);
      const served = await fetch(`${st.base}/api/episodes/${EP}/previews/scene-${one}-av.mp4?channel=${channel}`, { headers: { "sec-fetch-site": "same-origin" } });
      expect(served.status).toBe(200);
      expect(createHash("sha256").update(Buffer.from(await served.arrayBuffer())).digest("hex"), "the served bytes are the new cut").toBe(cutAfter);

      // A receive that cannot reach «GitHub» is said, never «محفوظ في كل الأماكن».
      git(st.root, ["remote", "set-url", "origin", path.join(st.root, "..", "missing.git")]);
      await sync.tick(true);
      // («pending» when the render's own content save also waits; both are said)
      expect(["behind", "pending"]).toContain(sync.state.state);
      expect(sync.state.receiveError).toContain("تعذّر الوصول إلى GitHub");
      expect(sync.state.message).toContain("لم تصل التحديثات إلى هذا الجهاز");
      git(st.root, ["remote", "set-url", "origin", st.remote]);
      await sync.tick(true);
      expect(sync.state.receiveError).toBeUndefined();
    });
  });
}
