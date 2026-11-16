/**
 * KI-066 (owner, 14 Nov, دفاتر الزمن 001 المشهد ٣): «أعدت توليد الجملة بشكل صحيح وبعدين ضغطت اعد انتاج المشهد ولكن لم
 * يطبق الصوت علي الفيديو في الاعلي». Over the REAL Studio server (same harness as the journey): after «اعتمد التجهيز»
 * the owner writes «النطق» for one sentence of the current scene, regenerates that sentence alone, and presses
 * «أنتج هذا المشهد». The served scene video must then carry the new take, and its URL must change.
 * Fake voice provider only (BAL_VOICE_PROVIDER=fake), a tiny real render, no key, no network.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { browserPlanRevision } from "../../src/plan/revision";
import { CASES, selectedChannels, type ChannelCase } from "./channels";
import { ffmpeg, fixturesDir, generateVoiceConfirmed, probe, sha256File, startStudio, waitFor, type Studio } from "./harness";

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
  describe(`KI-066 regenerate a sentence → «أنتج هذا المشهد» — ${channel}`, () => {
    let st: Studio;
    let epDir = "";
    const fx = (f: string) => readFile(path.join(fixturesDir, channel, f), "utf8");
    const ok = (label: string, r: { status: number; body: any }, status = 200) =>
      expect(r.status, `${label} → ${r.status}: ${JSON.stringify(r.body).slice(0, 900)}`).toBe(status);
    const state = async () => { const r = await st.call("GET", `episodes/${EP}/scene-production`); ok("state", r); return r.body; };
    const voiceIndex = async () => JSON.parse(await readFile(path.join(epDir, "voice", "index.json"), "utf8"));

    beforeAll(async () => {
      st = await startStudio(channel);
      epDir = path.join(st.channelsDir, channel, "episodes", `${EP}-${c.slug}`);
    }, 300_000);
    afterAll(async () => { await st?.close(); });

    it("plays the new take after the scene is produced again, at a new URL", async () => {
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
      await waitFor("free drafts", () => st.call("GET", `episodes/${EP}/scene-prepare`), (x) => x.body.job && x.body.job.status !== "running", 1_200_000, 1000);
      // Owner decision (15–16 Nov): the voice is generated only by his confirmed «ولّد الصوت الآن».
      const { job } = await generateVoiceConfirmed(st, EP);
      expect(job.body.job, JSON.stringify(job.body).slice(0, 900)).toMatchObject({ status: "done", failed: [] });

      // The current scene, ready for review with its draft (as in the owner's screenshot «جاهز للمراجعة»).
      s = await state();
      const id = s.progress.currentScene as string;
      expect(id).toBe(c.scenes[0]);
      expect(s.scenes.find((x: any) => x.id === id).draft).toBe("ready");
      const cutBefore = s.candidates.scenes[id] as string;
      const videoFile = path.join(epDir, "previews", `scene-${id}-av.mp4`);
      const durBefore = Number(probe(videoFile).format.duration);
      const clipBefore = (await voiceIndex())[id];

      // «الجمل»: the owner's pronunciation for sentence 1 (two more words: a longer take), then «ولّد الجملة» for it alone.
      const read = (await st.call("GET", `episodes/${EP}/sentences`)).body;
      const row = read.scenes.find((x: any) => x.id === id).rows.find((r: any) => r.kind === "narration");
      const say = `${row.say.auto} حَقًّا حَقًّا`;
      ok("say", await st.call("POST", `episodes/${EP}/sentences`, { action: "say", id: row.id, sceneId: id, index: 0, pronunciation: say }));
      const rowAfterSay = (await st.call("GET", `episodes/${EP}/sentences`)).body.scenes.find((x: any) => x.id === id).rows.find((r: any) => r.kind === "narration");
      const gen = await st.call("POST", `episodes/${EP}/sentences`, { action: "generate", id: rowAfterSay.id, sceneId: id, index: 0 });
      ok("generate sentence", gen);
      const rows = () => st.call("GET", `episodes/${EP}/sentences`).then((x) => x.body.scenes.find((y: any) => y.id === id).rows.filter((r: any) => r.kind === "narration"));
      const all = await rows();
      let sc: any;
      // A scene of one sentence (زبدة الكتب's fixture) composes at once; with more, the others wait for their takes.
      if (all.length > 1) {
        const unvoiced = all.map((r: any, k: number) => (r.status === "missing" || r.status === "stale" || r.status === "old" ? k + 1 : 0)).filter(Boolean);

        // The bug: the new take stays outside the scene's sound while another sentence has no current take. The page
        // says so beside the player, and «أنتج هذا المشهد» refuses in Arabic instead of rendering the old sound again.
        s = await state();
        sc = s.scenes.find((x: any) => x.id === id);
        expect(sc.newerTake, `${id}: ${JSON.stringify(sc).slice(0, 600)}`).toEqual({ state: "blocked", sentences: [1], missing: unvoiced });
        expect((await voiceIndex())[id].file, "the scene's sound is unchanged").toBe(clipBefore.file);
        const refused = await st.call("POST", `episodes/${EP}/scene-av-render`, { sceneId: id, expectedSha256: sc.sourceSha256 });
        expect(refused.status, JSON.stringify(refused.body)).toBe(409);
        expect(refused.body.error).toContain("لم يُنتج المشهد");
        expect(refused.body.error).toContain("الجملة ٢ بلا تسجيل حالي");
        expect(await sha256File(videoFile), "the video is untouched").toBe(cutBefore);

      }
      // «ولّد الجملة» for the others: the scene's sound is composed with the new take, and the page asks to produce.
      for (const r of all.slice(1)) ok(`generate ${r.id}`, await st.call("POST", `episodes/${EP}/sentences`, { action: "generate", id: r.id, sceneId: id }));
      expect((await voiceIndex())[id].file, "the scene's sound composed from its sentences").not.toBe(clipBefore.file);
      expect((await voiceIndex())[id].sentences.takes[all[0].id], "it holds the new take").toBe(all[0].audio.file);
      s = await state();
      sc = s.scenes.find((x: any) => x.id === id);
      expect(sc.newerTake, `${id}: ${JSON.stringify(sc).slice(0, 600)}`).toEqual({ state: "produce", sentences: [], missing: [] });

      // «أنتج هذا المشهد»
      const r = await st.call("POST", `episodes/${EP}/scene-av-render`, { sceneId: id, expectedSha256: sc.sourceSha256 });
      ok("render", r);
      s = await state();
      const cutAfter = s.candidates.scenes[id] as string;
      expect(cutAfter, "a new cut").not.toBe(cutBefore);
      expect(await sha256File(videoFile)).toBe(cutAfter);
      // The fake take of the longer pronunciation is ~0.84 s longer: the scene's sound grew (less than that: it is now
      // composed from its sentences and their pauses, not the old one-file take), and the cut is longer and holds it all.
      const clipAfter = (await voiceIndex())[id];
      expect(clipAfter.duration - clipBefore.duration, `sound ${clipBefore.duration} → ${clipAfter.duration}`).toBeGreaterThan(0.1);
      const durAfter = Number(probe(videoFile).format.duration);
      expect(durAfter, `video ${durBefore} → ${durAfter}`).toBeGreaterThan(durBefore + 0.1);
      expect(durAfter + 0.05, `video ${durAfter} holds the sound ${clipAfter.duration}`).toBeGreaterThanOrEqual(clipAfter.duration);
      expect(s.scenes.find((x: any) => x.id === id).newerTake ?? false, "nothing newer than the video now").toBe(false);
      // The player URL carries the cut (app/src/api.ts scenePreviewUrl), so a new cut under the same name is a new URL;
      // the server serves it whatever the query, with no cache.
      const url = (sha: string) => `episodes/${EP}/previews/scene-${id}-av.mp4?v=${sha.slice(0, 16)}`;
      expect(url(cutAfter)).not.toBe(url(cutBefore));
      const served = await fetch(`${st.base}/api/${url(cutAfter)}&channel=${channel}`, { headers: { "sec-fetch-site": "same-origin" } });
      expect(served.status).toBe(200);
      expect(served.headers.get("cache-control")).toBe("no-store");
      expect(createHash("sha256").update(Buffer.from(await served.arrayBuffer())).digest("hex"), "the served bytes are the new cut").toBe(cutAfter);
    });
  });
}
