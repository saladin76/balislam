/**
 * «سرعة الإلقاء» و«الفاصل بين الجمل» من أولها إلى Master (D140)، عبر خادم الاستوديو الحقيقي ومزوّد الصوت الوهمي
 * (BAL_VOICE_PROVIDER=fake) والرندر الصغير (BAL_E2E_RENDER=tiny)، كرحلة المالك (tests/e2e/journey.test.ts):
 *
 * التجهيز ← اعتماد المشهد الأول ← «سريع» و«الفاصل الأقصر» للحلقة: لا يتغير صوت ولا اعتماد، والمشاهد المتأثرة تُذكر
 * مع المدة التقديرية ← «أعد إنتاج المشاهد المتأثرة»: لا طلب صوت واحد، والتسجيلات الأصلية والتلاوة كما هي بايتًا ببايت،
 * والمشهد المعتمد يعود للمراجعة، والمسودات تُنتج من جديد وهي أقصر، والكلمات على صوتها ← كل المشهد معتمدة ← التجميع
 * ← Master الصغير يمر بفحص الحركة (≥ ٨٠٪، القاعدة الثانية) وهو أقصر من الحلقة قبل التغيير.
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { browserPlanRevision } from "../../src/plan/revision";
import { CASES, selectedChannels, type ChannelCase } from "./channels";
import { ffmpeg, fixturesDir, generateVoiceConfirmed, probe, sha256File, startStudio, tree, waitFor, type Studio, passEditor } from "./harness";

const EP = "001";
/**
 * Whether the fixed test episode gets shorter in seconds. «زبدة الكتب»: its first scene is a verse lead-in (ends with «:»,
 * intended stillness, never paced) and its last narrated scene is held by the time its words need on screen (textSeconds), so its
 * paced audio is shorter while the scene's seconds stay; the other two channels must be shorter in all.
 */
const SHORTER: Record<string, boolean> = { balislam: true, "dafatir-alzaman": true, "zubdat-alkutub": false };
const outgoing: string[] = [];
const fakeCalls: { kind: string; text: string }[] = [];
const realFetch = globalThis.fetch;
beforeAll(() => {
  (globalThis as any).__balFakeVoiceCalls = fakeCalls;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input?.url ?? input);
    if (!/^http:\/\/127\.0\.0\.1:/.test(url)) { outgoing.push(url); throw new Error(`[e2e] network call refused: ${url}`); }
    return realFetch(input, init);
  }) as typeof fetch;
});
afterAll(() => { globalThis.fetch = realFetch; });

for (const channel of selectedChannels()) {
  const c: ChannelCase = CASES[channel]!;
  describe(`episode pace — ${channel}`, () => {
    let st: Studio;
    let epDir = "";
    const fx = (f: string) => readFile(path.join(fixturesDir, channel, f), "utf8");
    const ok = (label: string, r: { status: number; body: any }, status = 200) =>
      expect(r.status, `${label} → ${r.status}: ${JSON.stringify(r.body).slice(0, 900)}`).toBe(status);
    const state = async (label: string) => { const r = await st.call("GET", `episodes/${EP}/scene-production`); ok(label, r); return r.body; };
    const decide = (cmd: Record<string, unknown>) => st.call("POST", `episodes/${EP}/scene-production`, cmd);
    const order = () => [...c.scenes, "c1-end"];
    const produceAndApprove = async (id: string, conditional = false) => {
      let s = await state(`${id}: before`);
      expect(s.progress.currentScene, `${id} is the current scene`).toBe(id);
      let sc = s.scenes.find((x: any) => x.id === id);
      if (sc.draft !== "ready" || !s.candidates.scenes[id]) {
        ok(`${id}: render`, await st.call("POST", `episodes/${EP}/scene-av-render`, { sceneId: id, expectedSha256: sc.sourceSha256 }));
        s = await state(`${id}: rendered`);
        sc = s.scenes.find((x: any) => x.id === id);
      }
      const cut = s.candidates.scenes[id];
      ok(`${id}: submit`, await decide({ action: "submit-scene", sceneId: id, expectedSha256: sc.sourceSha256 }));
      const r = await decide({ action: "approve-scene", sceneId: id, expectedSha256: cut, confirmedWatched: true });
      ok(`${id}: approve`, r);
      expect(r.body.scenes.find((x: any) => x.id === id)).toMatchObject({ approved: true, conditional });
    };
    const draftSeconds = (id: string) => Number(probe(path.join(epDir, "previews", `scene-${id}-av.mp4`)).format.duration);

    beforeAll(async () => {
      // One process runs every channel: start each with an empty voice log, or the last channel's requests count here.
      fakeCalls.length = 0;
      st = await startStudio(channel);
      epDir = path.join(st.channelsDir, channel, "episodes", `${EP}-${c.slug}`);
    }, 300_000);
    afterAll(async () => { await st?.close(); });

    it("changes the pace for free, re-produces only what it touches, and the Master passes the motion check", async () => {
      // ── التجهيز (كما في الرحلة) ─────────────────────────────────────────────────────────────────────
      ok("create", await st.call("POST", "episodes", { episode: EP, slug: c.slug, domain: c.domain, title: c.title }));
      ok("script", await st.call("PUT", `episodes/${EP}/script`, { text: await fx("script.md") }));
      await passEditor(st, EP); // D234
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
        x.id === "c1-end" ? { ...x, durationSec: 4, edited: true } : plates[x.id] ? { ...x, props: { ...x.props, image: plates[x.id] }, edited: true } : x) })) };
      ok("plan", await st.call("PUT", `episodes/${EP}/plan`, { plan: shaped, expectedRevision: await browserPlanRevision(plan) }));

      // Before anything: the default is «متوسط» / «عادي» and nothing is affected.
      let pace = (await st.call("GET", `episodes/${EP}/pace`)).body;
      expect(pace.episode).toMatchObject({ speed: "medium", pause: "normal", speedSet: false, pauseSet: false });
      expect(pace.options.speeds.map((x: any) => x.nameAr)).toEqual(["هادئ", "متوسط", "سريع"]);

      let s = await state("fresh");
      ok("approve preparation", await st.call("POST", `episodes/${EP}/approve-preparation`,
        { reviewed: true, scriptSha256: s.script.sha256, storyboardSha256: s.storyboard.sha256, note: "راجعته بنفسي" }));
      await waitFor("free drafts", () => st.call("GET", `episodes/${EP}/scene-prepare`), (x) => x.body.job && x.body.job.status !== "running", 1_200_000, 1000);
      // Owner decision (15–16 Nov): the voice is generated only by his confirmed «ولّد الصوت الآن».
      const { job } = await generateVoiceConfirmed(st, EP);
      expect(job.body.job, JSON.stringify(job.body).slice(0, 1200)).toMatchObject({ status: "done", failed: [] });

      // The recitation first (بالإسلام), so its bytes are there to stay untouched.
      if (c.verse?.mode === "recitation") {
        const wav = path.join(st.root, "owner-recitation-test-tone.wav");
        ffmpeg(["-f", "lavfi", "-i", "aevalsrc='0.001*(2*random(0)-1)+0.05*sin(2*PI*180*t)*between(t,0.5,3.5)':s=44100:d=4", wav]);
        ok("upload recitation", await st.call("POST", `episodes/${EP}/own-recitations`, { action: "upload", key: c.verse.key, name: "tone.wav", data: (await readFile(wav)).toString("base64") }));
        ok("approve recitation", await st.call("POST", `episodes/${EP}/own-recitations`, { action: "approve", key: c.verse.key, reciter: "صاحب القناة", rightsEvidence: "تسجيل اختبار مولَّد (نغمة)، لا تلاوة", note: "اختبار الرحلة", listened: true }));
      }
      const first = c.scenes[0]!;
      await produceAndApprove(first);

      const narrated = c.scenes.filter((id) => id !== c.verse?.sceneId);
      const before = Object.fromEntries(narrated.map((id) => [id, draftSeconds(id)]));
      const voiceIndex = path.join(epDir, "voice", "index.json");
      const rawIndexSha = await sha256File(voiceIndex);
      const rawIndex = JSON.parse(await readFile(voiceIndex, "utf8"));
      const rawTakes = Object.fromEntries(await Promise.all(narrated.map(async (id) => [id, await sha256File(path.join(epDir, "voice", rawIndex[id].file))])));
      const recitations = await tree(path.join(epDir, "recitations"));
      const secondsBefore = (await st.call("GET", `episodes/${EP}/pace`)).body.seconds.now;

      // ── «سريع» و«الفاصل الأقصر» للحلقة: الإعداد وحده ──────────────────────────────────────────────────
      expect((await st.call("POST", `episodes/${EP}/pace`, { action: "episode", speed: "fast" }, { origin: "https://evil.example" })).status, "another site").toBe(403);
      expect((await st.call("POST", `episodes/${EP}/pace`, { action: "episode", speed: "turbo" })).status, "unknown speed").toBe(400);
      const set = await st.call("POST", `episodes/${EP}/pace`, { action: "episode", speed: "fast", pause: "shortest" });
      ok("set pace", set);
      pace = set.body;
      expect(pace.episode).toMatchObject({ speed: "fast", pause: "shortest" });
      // Every narrated scene is affected, except an intended stillness (a verse lead-in ending with «:»), named as such.
      const exempt = pace.scenes.filter((x: any) => x.exempt).map((x: any) => x.id);
      for (const id of exempt) expect(pace.scenes.find((x: any) => x.id === id).exempt, `${id}: why it keeps its pace`).toMatch(/آية|ذكر الله/);
      const touched = narrated.filter((id) => !exempt.includes(id));
      expect(touched.length, "at least one scene to pace").toBeGreaterThan(0);
      expect([...pace.affected].sort(), "the narrated scenes are affected").toEqual([...touched].sort());
      if (c.verse) expect(pace.affected, "the verse is never paced").not.toContain(c.verse.sceneId);
      expect(pace.reopens, "the approved scene would return to review").toEqual(touched.includes(first) ? [first] : []);
      expect(pace.seconds.next, "the estimate is never longer").toBeLessThanOrEqual(pace.seconds.now + 0.05);
      if (SHORTER[channel]) expect(pace.seconds.next, "the estimate is shorter").toBeLessThan(pace.seconds.now - 0.5);
      // Saving the setting changes no audio and no approval.
      expect(await sha256File(voiceIndex)).toBe(rawIndexSha);
      expect((await state("after setting")).scenes.find((x: any) => x.id === first).approved, "still approved until re-produced").toBe(true);
      // pace.json is owner content beside the script (D101); nothing under voice/ is.
      expect(JSON.parse(await readFile(path.join(epDir, "pace.json"), "utf8"))).toMatchObject({ version: 1, episode: { speed: "fast", pause: "shortest" } });

      // ── «أعد إنتاج المشاهد المتأثرة» ────────────────────────────────────────────────────────────────
      const calls = fakeCalls.length;
      const apply = await st.call("POST", `episodes/${EP}/scene-prepare`, { pace: "apply" });
      ok("apply pace", apply);
      expect([...apply.body.pace.applied].sort()).toEqual([...touched].sort());
      expect(apply.body.pace.failed).toEqual([]);
      const reproduced = await waitFor("re-produce", () => st.call("GET", `episodes/${EP}/scene-prepare`), (x) => x.body.job && x.body.job.status !== "running", 1_200_000, 1000);
      expect(reproduced.body.job, JSON.stringify(reproduced.body).slice(0, 1200)).toMatchObject({ status: "done", failed: [] });
      expect(reproduced.body.job.voice.status, "no voice step at all").toBe("none");
      expect(fakeCalls.length, "not one voice request").toBe(calls);
      expect(outgoing).toEqual([]);
      // The paid takes and the recitation are byte for byte as they were.
      expect(await sha256File(voiceIndex), "voice/index.json untouched").toBe(rawIndexSha);
      for (const id of narrated) expect(await sha256File(path.join(epDir, "voice", rawIndex[id].file)), `${id}: raw take untouched`).toBe(rawTakes[id]);
      expect(await tree(path.join(epDir, "recitations")), "recitations untouched").toEqual(recitations);
      const paced = JSON.parse(await readFile(path.join(epDir, "voice", "paced.json"), "utf8"));
      for (const id of exempt) expect(paced[id], `${id}: an intended stillness gets no paced copy`).toBeUndefined();
      for (const id of touched) {
        expect(paced[id].from.file).toBe(rawIndex[id].file);
        expect(existsSync(path.join(epDir, "voice", paced[id].clip.file))).toBe(true);
        expect(paced[id].clip.duration, `${id}: shorter`).toBeLessThan(rawIndex[id].duration);
        // Words stay in order inside the new file
        const ws = paced[id].clip.words;
        for (let i = 1; i < ws.length; i++) expect(ws[i].start).toBeGreaterThanOrEqual(ws[i - 1].end - 1e-6);
        expect(ws[ws.length - 1].end).toBeLessThanOrEqual(paced[id].clip.duration + 1e-6);
        // The draft is never longer; it is shorter unless the template's own minimum length holds the scene.
        expect(draftSeconds(id), `${id}: the new draft is not longer`).toBeLessThanOrEqual(before[id]! + 0.05);
      }
      s = await state("after apply");
      if (touched.includes(first)) {
        expect(s.scenes.find((x: any) => x.id === first), "the approved scene returned to review").toMatchObject({ approved: false });
        expect(s.progress).toMatchObject({ currentScene: first });
      } else expect(s.scenes.find((x: any) => x.id === first), "an untouched scene keeps its approval").toMatchObject({ approved: true });
      expect(s.progress).toMatchObject({ assemblyApproved: false, masterApproved: false, publishAllowed: false });
      if (SHORTER[channel]) expect(Object.values(before).reduce((a, b) => a + b, 0) - narrated.reduce((a, id) => a + draftSeconds(id), 0),
        "the drafts are shorter in all").toBeGreaterThan(0.3);
      pace = (await st.call("GET", `episodes/${EP}/pace`)).body;
      expect(pace.affected, "nothing left to re-produce").toEqual([]);
      expect(pace.seconds.now).toBeLessThanOrEqual(secondsBefore + 0.05);
      if (SHORTER[channel]) expect(pace.seconds.now).toBeLessThan(secondsBefore - 0.5);

      // ── all scenes approved, assembly, then the tiny Master with its motion check ──────────────────────
      for (const id of order()) if (!(await state(`${id}: approved?`)).scenes.find((x: any) => x.id === id).approved) await produceAndApprove(id);
      s = await state("before assembly");
      expect(s.progress).toMatchObject({ currentScene: null, canAssemble: true });
      ok("assemble", await st.call("POST", `episodes/${EP}/scene-av-assemble`));
      s = await state("assembled");
      const asm = s.candidates.assemblySha256;
      ok("record assembly", await decide({ action: "assemble", expectedSha256: asm }));
      for (const seam of s.seams) ok(`seam ${seam}`, await st.call("POST", `episodes/${EP}/seam-checks`, { seam, assemblySha256: asm, how: "confirmed" }));
      ok("approve assembly", await decide({ action: "approve-assembly", expectedSha256: asm, confirmedWatched: true, seamsChecked: s.seams }));
      const make = await st.call("POST", "jobs", { kind: "make", episode: EP });
      ok("make Master", make);
      const made = await waitFor("Master", () => st.call("GET", "jobs"), (x) => x.body.find((j: any) => j.id === make.body.id)?.status !== "running", 1_200_000, 2000);
      const mj = made.body.find((j: any) => j.id === make.body.id);
      // The package refuses a Master under 80% intended motion (rule two): «done» means the motion check passed.
      expect(mj.status, `Master: ${JSON.stringify(mj.log ?? mj).slice(-3000)}`).toBe("done");
      const report = path.join(epDir, "out", "package", "motion-report.md");
      if (existsSync(report)) expect(await readFile(report, "utf8")).not.toMatch(/مرفوض/);
      const master = Number(probe(path.join(epDir, "out", "package", `${EP}-episode.mp4`)).format.duration);
      // The Master = the scenes + the channel's opening; the scenes are now shorter than before the pace change.
      const overhead = master - pace.seconds.now;
      expect(overhead).toBeGreaterThanOrEqual(-0.5);
      if (SHORTER[channel]) expect(master, "the Master is shorter than the episode before the pace change").toBeLessThan(secondsBefore + overhead - 0.5);
      expect(fakeCalls.length, "still not one voice request").toBe(calls);
    });
  });
}
