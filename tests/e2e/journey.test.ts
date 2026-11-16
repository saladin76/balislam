/**
 * The owner's whole journey, end to end, over the REAL Studio server API (stabilization brief, work ٤).
 *
 * One fixed test episode per channel (tests/fixtures/e2e/<channel>/), three scenes (+ the closing card).
 * Nothing in the server is stubbed: the sentence voice comes from the test-only fake provider
 * (BAL_VOICE_PROVIDER=fake: a quiet tone with even word timings, refused outside tests and beside a real key),
 * the scene drafts and the Master are REAL Remotion renders, only tiny (BAL_E2E_RENDER=tiny: 320×180), and the
 * Drive copy goes to a temporary folder (BAL_DRIVE_PUBLISH_DIR). The recitation is a generated tone, NEVER a real
 * recitation. No key, no network service, no owner data, no real approval.
 *
 * The steps: create the episode ← «اعتمد التجهيز» ← each scene produced and approved in ANY order (D145: the closing
 * card produced first, scene 3 approved before 1 and 2, the assembly naming what is left) ← on one scene
 * «النبرة غير مناسبة» + note → regenerate → approve ← a scene's text edited after the preparation re-opens only
 * that scene (D76) ← the recitation (بالإسلام) uploaded and approved ← assembly → its approval ← a tiny Master →
 * its approval ← publish permission → the Drive copy, verified file by file against manifest.json.
 * Along the way: every gate's state, the signed ledger's consistency, the trace check, and that a content save
 * (D101) never carries anything that must never leave the machine. The D101 conflict (brief §٦) closes it.
 *
 * Run: `npm run e2e` (BAL_E2E_CHANNELS=all for the three channels).
 */
import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { browserPlanRevision } from "../../src/plan/revision";
import { findTraces } from "../../src/package/traces";
import { isOwnerContentPath } from "../../scripts/contentPaths.mjs";
import { pushContentOnce, pendingContent } from "../../app/server/contentSync";
import { safeFastForward, readConflicts, resolveConflict } from "../../app/server/safeUpdate";
import { CASES, selectedChannels, type ChannelCase } from "./channels";
import { ffmpeg, fixturesDir, git, probe, sha256File, startStudio, tree, waitFor, type Studio } from "./harness";

const EP = "001";
const CROSS = { origin: "https://evil.example" };

/** Every outgoing request of this process: the fake provider must make none, and nobody else either. */
const outgoing: string[] = [];
/** Every request the fake voice provider received in this process (src/voice/fakeVoice.ts). */
const fakeCalls: { kind: string; text: string }[] = [];
const realFetch = globalThis.fetch;
beforeAll(() => {
  (globalThis as any).__balFakeVoiceCalls = fakeCalls;
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input?.url ?? input);
    if (!/^http:\/\/127\.0\.0\.1:/.test(url)) {
      outgoing.push(url);
      throw new Error(`[e2e] network call refused: ${url}`);
    }
    return realFetch(input, init);
  }) as typeof fetch;
});
afterAll(() => { globalThis.fetch = realFetch; });

for (const channel of selectedChannels()) {
  const c: ChannelCase = CASES[channel]!;
  describe(`the owner's journey — ${channel}`, () => {
    let st: Studio;
    let epDir = "";
    const fx = (f: string) => readFile(path.join(fixturesDir, channel, f), "utf8");
    const state = async (label: string) => {
      const r = await st.call("GET", `episodes/${EP}/scene-production`);
      expect(r.status, `${label}: ${JSON.stringify(r.body).slice(0, 400)}`).toBe(200);
      return r.body;
    };
    const decide = (cmd: Record<string, unknown>, headers: Record<string, string> = {}) => st.call("POST", `episodes/${EP}/scene-production`, cmd, headers);
    const ok = (label: string, r: { status: number; body: any }, status = 200) =>
      expect(r.status, `${label} → ${r.status}: ${JSON.stringify(r.body).slice(0, 900)}`).toBe(status);
    /** The four steps' gates, as the page reads them (progress of the signed ledger). */
    const gates = async (label: string, want: Record<string, unknown>) => {
      const s = await state(label);
      expect(s.progress, `${label}: gates`).toMatchObject(want);
      await ledgerConsistent(label);
      return s;
    };
    /** The signed ledger is readable (its signature verified by the server on every read) and its history is whole. */
    const ledgerConsistent = async (label: string) => {
      const file = path.join(epDir, "scene-production.v1.json");
      if (!existsSync(file)) return;
      const doc = JSON.parse(await readFile(file, "utf8"));
      expect(doc.mac, `${label}: ledger mac`).toMatch(/^[a-f0-9]{64}$/);
      expect(doc.history.map((h: any) => h.seq), `${label}: ledger seq`).toEqual(doc.history.map((_: unknown, i: number) => i + 1));
      expect(doc.revision, `${label}: ledger revision`).toBeGreaterThanOrEqual(doc.history.length);
      for (const h of doc.history) expect(["owner", "system"], `${label}: who decided ${h.action}`).toContain(h.by);
    };
    /** A content save, exactly as the Studio's D101 sync does it; nothing it commits may be a never-uploaded file. */
    const contentSave = async (label: string) => {
      git(st.root, ["fetch", "-q", "origin"]);
      const pending = await pendingContent(st.root);
      expect(pending, `${label}: content to save`).not.toBeNull();
      const all = git(st.root, ["status", "--porcelain=v1", "--untracked-files=all", "--ignored"]).split("\n").filter(Boolean);
      const r = await pushContentOnce(st.root, pending!.files);
      expect(r.ok, `${label}: content save ${JSON.stringify(r)}`).toBe(true);
      const files = git(st.remote, ["ls-tree", "-r", "--name-only", "main"]).split("\n").filter(Boolean);
      const never = files.filter((f) => !isOwnerContentPath(f) && !/^channels\/[^/]+\/[^/]+\.json$/.test(f) && f !== ".gitignore");
      expect(never, `${label}: something that must never leave the machine reached the repository`).toEqual([]);
      for (const f of files) expect(f, label).not.toMatch(/scene-production|storyboard\.json$|\/voice\/|\.mp[34]$|\.wav$|\.env|notes\/inbox|recitations\/|out\//);
      return { files, local: all };
    };
    /** Produce the scene's cut if its draft is not ready, then submit and approve it (any scene, any order: D145). */
    const produceAndApprove = async (id: string, opts: { conditional?: boolean } = {}) => {
      let s = await state(`${id}: before`);
      expect(s.scenes.find((x: any) => x.id === id)?.approved, `${id} is open`).toBe(false);
      let sc = s.scenes.find((x: any) => x.id === id);
      if (sc.draft !== "ready" || !s.candidates.scenes[id]) {
        const r = await st.call("POST", `episodes/${EP}/scene-av-render`, { sceneId: id, expectedSha256: sc.sourceSha256 });
        ok(`${id}: render`, r);
        s = await state(`${id}: rendered`);
        sc = s.scenes.find((x: any) => x.id === id);
      }
      const cut = s.candidates.scenes[id];
      expect(cut, `${id}: candidate`).toMatch(/^[a-f0-9]{64}$/);
      const file = path.join(epDir, "previews", `scene-${id}-av.mp4`);
      expect(await sha256File(file), `${id}: the cut on disk is the candidate`).toBe(cut);
      const v = probe(file);
      expect(v.streams.map((x) => x.codec_type).sort(), `${id}: sound and picture`).toEqual(["audio", "video"]);
      expect(v.streams.find((x) => x.codec_type === "video"), `${id}: tiny render`).toMatchObject({ width: 320, height: 180 });
      // Never approved before it is submitted, never without watching it with sound.
      expect((await decide({ action: "approve-scene", sceneId: id, expectedSha256: cut, confirmedWatched: true })).status, `${id}: approve before submit`).toBe(409);
      ok(`${id}: submit`, await decide({ action: "submit-scene", sceneId: id, expectedSha256: sc.sourceSha256 }));
      expect((await decide({ action: "approve-scene", sceneId: id, expectedSha256: cut })).status, `${id}: approve unwatched`).toBe(409);
      expect((await decide({ action: "approve-scene", sceneId: id, expectedSha256: cut, confirmedWatched: true }, CROSS)).status, `${id}: another site`).toBe(403);
      const r = await decide({ action: "approve-scene", sceneId: id, expectedSha256: cut, confirmedWatched: true });
      ok(`${id}: approve`, r);
      expect(r.body.scenes.find((x: any) => x.id === id), `${id}: approved`).toMatchObject({ approved: true, conditional: Boolean(opts.conditional) });
    };
    const order = () => [...c.scenes, "c1-end"];

    beforeAll(async () => {
      st = await startStudio(channel);
      epDir = path.join(st.channelsDir, channel, "episodes", `${EP}-${c.slug}`);
    }, 300_000);
    afterAll(async () => { await st?.close(); });

    it("goes from a new episode to the approved files on Drive, with every gate checked", async () => {
      // ── 1. Create the episode, then the script, research and pronunciation copy (step ١ «التجهيز») ─────────
      ok("create", await st.call("POST", "episodes", { episode: EP, slug: c.slug, domain: c.domain, title: c.title }));
      expect((await st.call("POST", "episodes", { episode: EP, slug: "again", domain: c.domain, title: c.title })).status, "duplicate number").toBe(409);
      const script = await st.call("PUT", `episodes/${EP}/script`, { text: await fx("script.md") });
      ok("script", script);
      expect(script.body.check.ok, `script check: ${JSON.stringify(script.body.check.issues)}`).toBe(true);
      expect(script.body.check.issues.filter((i: any) => i.level === "error")).toEqual([]);
      ok("research", await st.call("PUT", `episodes/${EP}/research`, { text: await fx("research.md") }));
      // The vowelled copy is a file the owner places in the episode folder (no route writes it); it is content (D101).
      await writeFile(path.join(epDir, "tashkeel.md"), await fx("tashkeel.md"));
      let plan = (await st.call("GET", `episodes/${EP}`)).body.plan;
      expect(plan.chapters.flatMap((ch: any) => ch.scenes.map((s: any) => s.id)), "the plan's scenes").toEqual(order());
      if (c.verse) expect(plan.chapters[0].scenes.find((s: any) => s.id === c.verse!.sceneId), "verse scene").toMatchObject({ template: "verse-card", ayahKey: c.verse.key });
      // The episode tone (no default since D104): chosen in step ١ like the owner does.
      // The closing card's length set in the scene editor (4 s): the test episode is ~25 s, and a static end card
      // longer than that would fail rule two (motion ≥ 80%) on its own (see KI-049).
      // «دفاتر الزمن»: a new episode's scenes are documentary plates; the owner uploads each plate's picture from the
      // scene settings (here a generated pattern, never a real or generated photograph).
      const plates: Record<string, string> = {};
      const bare = plan.chapters.flatMap((ch: any) => ch.scenes).filter((x: any) => x.template === "doc-plate" && !x.props?.image);
      // KI-054: a plate with no picture is said in step ١ «قبل أن تعتمد», per scene, not first at the final file.
      const platesEarly = await st.call("GET", `episodes/${EP}/approve-preparation`);
      ok("blockers before the plate pictures", platesEarly);
      expect(platesEarly.body.planErrors.map((e: any) => e.scene), "plates without a picture, named early").toEqual(bare.map((x: any) => x.id));
      for (const x of bare) {
        const png = path.join(st.root, `${x.id}-plate.png`);
        ffmpeg(["-f", "lavfi", "-i", "mandelbrot=s=1280x720:end_pts=1", "-frames:v", "1", png]);
        const up = await st.call("POST", `episodes/${EP}/images`, { name: `${x.id}.png`, scene: x.id, data: (await readFile(png)).toString("base64") });
        ok(`${x.id}: plate picture`, up);
        plates[x.id] = up.body.file;
      }
      const shaped = { ...plan, tone: c.episodeTone, chapters: plan.chapters.map((ch: any) => ({ ...ch, scenes: ch.scenes.map((x: any) =>
        x.id === "c1-end" ? { ...x, durationSec: 4, edited: true }
        : plates[x.id] ? { ...x, props: { ...x.props, image: plates[x.id] }, edited: true } : x) })) };
      ok("episode tone + end card", await st.call("PUT", `episodes/${EP}/plan`, { plan: shaped, expectedRevision: await browserPlanRevision(plan) }));

      let s = await gates("fresh", { approvedScenes: 0, canAssemble: false, assemblyApproved: false, masterApproved: false, publishAllowed: false });
      expect(s.script.approved).toBe(false);
      expect(s.storyboard.approved).toBe(false);
      // Nothing renders, and step ٢ refuses, before «اعتمد التجهيز».
      expect((await st.call("POST", `episodes/${EP}/scene-av-render`, { sceneId: "c1-s1", expectedSha256: s.scenes[0].sourceSha256 })).status, "render before preparation").toBe(409);
      expect((await st.call("POST", `episodes/${EP}/scene-av-assemble`)).status, "assemble before preparation").toBe(409);
      const blockers = await st.call("GET", `episodes/${EP}/approve-preparation`);
      ok("blockers", blockers);
      expect(blockers.body, "nothing blocks the preparation").toMatchObject({ scriptErrors: 0, versesMissing: [], toneMissing: [], textDiverged: { scenes: [], unplaced: [] }, planErrors: [] });
      await contentSave("after step ١ edits");

      // ── 2. «اعتمد التجهيز»: once, from this page only, then the drafts prepare on their own ─────────────
      const prep = { reviewed: true, scriptSha256: s.script.sha256, storyboardSha256: s.storyboard.sha256, note: "راجعته بنفسي" };
      expect((await st.call("POST", `episodes/${EP}/approve-preparation`, prep, CROSS)).status, "another site").toBe(403);
      expect((await st.call("POST", `episodes/${EP}/approve-preparation`, { ...prep, reviewed: false })).status, "not reviewed").toBe(409);
      const approved = await st.call("POST", `episodes/${EP}/approve-preparation`, prep);
      ok("approve preparation", approved);
      expect(approved.body.prepare.error, "preparation started").toBeUndefined();
      s = await gates("prepared", { currentScene: "c1-s1", approvedScenes: 0, canAssemble: false });
      expect(s.script.approved && s.storyboard.approved && s.boards.current).toBe(true);
      const job = await waitFor("scene drafts", () => st.call("GET", `episodes/${EP}/scene-prepare`), (x) => x.body.job && x.body.job.status !== "running", 1_200_000, 1000);
      expect(job.body.job, `drafts: ${JSON.stringify(job.body).slice(0, 1500)}`).toMatchObject({ status: "done", failed: [] });
      expect(job.body.job.rendered.sort()).toEqual(order().sort());
      expect(job.body.job.voice).toMatchObject({ status: "done" });
      // The voice came from the fake provider only; no verse ever went to it (the guard runs before any provider).
      expect(fakeCalls.length, "fake voice requests").toBeGreaterThanOrEqual(c.scenes.length - (c.verse ? 1 : 0));
      const verseText = c.verse ? (await fx("script.md")).match(/\[آية: [^|]+\| ([^\]]+)\]/)![1]!.trim() : null;
      if (verseText) for (const call of fakeCalls) expect(call.text, "a verse reached the voice provider").not.toContain(verseText.split(" ").slice(0, 3).join(" "));
      const sentences = (await st.call("GET", `episodes/${EP}/sentences`)).body;
      for (const id of c.scenes.filter((x) => x !== c.verse?.sceneId)) {
        const sc = sentences.scenes.find((x: any) => x.id === id);
        // «جهّز كل المشاهد» voices a scene in one request; «الجمل» splits it for sentence-by-sentence work (D50).
        expect(["scene", "sentences"], `${id}: the scene has its voice`).toContain(sc?.audio?.state);
        expect(sc.rows.filter((r: any) => r.kind === "narration").length, `${id}: sentences`).toBeGreaterThan(0);
      }
      s = await state("drafts ready");
      expect(s.prepared, "every draft ready").toEqual({ ready: order().length, total: order().length });
      // A second «اعتمد التجهيز» changes nothing (D76: once per episode).
      const rev = JSON.parse(await readFile(path.join(epDir, "scene-production.v1.json"), "utf8")).revision;
      const again = await st.call("POST", `episodes/${EP}/approve-preparation`, { ...prep, scriptSha256: s.script.sha256, storyboardSha256: s.storyboard.sha256 });
      ok("approve preparation again", again);
      expect(JSON.parse(await readFile(path.join(epDir, "scene-production.v1.json"), "utf8")).revision, "no second approval").toBe(rev);
      // KI-058: …and no second «جهّز كل المشاهد» in the background (it used to chase the scenes re-opened below and
      // still hold the episode when «اصنع النسخة النهائية» came: 409). The queue that ran is the one that finished.
      const firstJob = job.body.job.startedAt;
      expect(again.body.prepare.job, "the finished queue, not a new one").toMatchObject({ status: "done", startedAt: firstJob });

      // ── 3+4. The scenes in ANY order (D145); on one, «النبرة غير مناسبة» → note → regenerate → approve ────
      // The closing card is produced first («أنتج هذا المشهد» on the last scene while none is approved).
      {
        const last = order()[order().length - 1]!;
        const cur = await state("produce the last scene first");
        expect(cur.progress.approvedScenes).toBe(0);
        const r = await st.call("POST", `episodes/${EP}/scene-av-render`, { sceneId: last, expectedSha256: cur.scenes.find((x: any) => x.id === last).sourceSha256 });
        ok(`${last}: produced first`, r);
      }
      // Scene 3 is approved before scenes 1 and 2, then the closing card, then 1 and 2.
      const reviewOrder = [c.scenes[2]!, "c1-end", c.scenes[0]!, c.scenes[1]!];
      expect([...reviewOrder].sort()).toEqual([...order()].sort());
      const approvedSoFar: string[] = [];
      for (const id of reviewOrder) {
        if (id === c.toneScene) {
          s = await state(`${id}: tone`);
          const sc = s.scenes.find((x: any) => x.id === id);
          ok(`${id}: submit (tone)`, await decide({ action: "submit-scene", sceneId: id, expectedSha256: sc.sourceSha256 }));
          const cut = (await state(`${id}: submitted`)).candidates.scenes[id];
          const voiceIndex = async () => JSON.parse(await readFile(path.join(epDir, "voice", "index.json"), "utf8"));
          const takeBefore = (await voiceIndex())[id].file as string;
          expect((await decide({ action: "correct-scene", sceneId: id, expectedSha256: cut })).status, `${id}: a reason is required`).toBe(409);
          const note = "[النبرة @0:01] أهدأ قليلًا — الجملة الأولى سريعة";
          const fix = await decide({ action: "correct-scene", sceneId: id, expectedSha256: cut, note });
          ok(`${id}: النبرة غير مناسبة`, fix);
          expect(fix.body.scenes.find((x: any) => x.id === id)).toMatchObject({ status: "needs_revision", approved: false });
          // The note waits for Claude in the episode's notes box (sending is off outside the owner's Studio, D107).
          const inbox = JSON.parse(await readFile(path.join(epDir, "notes", "inbox.json"), "utf8"));
          expect(JSON.stringify(inbox), `${id}: note in the notes box`).toContain("الجملة الأولى سريعة");
          // The owner's tone for this scene, then «أعد توليد الصوت» for this scene only.
          plan = (await st.call("GET", `episodes/${EP}`)).body.plan;
          const toned = { ...plan, chapters: plan.chapters.map((ch: any) => ({ ...ch, scenes: ch.scenes.map((x: any) => x.id === id ? { ...x, tone: "intimate", edited: true } : x) })) };
          ok(`${id}: tone saved`, await st.call("PUT", `episodes/${EP}/plan`, { plan: toned, expectedRevision: await browserPlanRevision(plan) }));
          const regen = await st.call("POST", `episodes/${EP}/voice`, { scenes: [id], force: true });
          ok(`${id}: regenerate`, regen);
          const after = (await voiceIndex())[id];
          expect(after.file, `${id}: a new take`).not.toBe(takeBefore);
          // The paid take before it is never deleted: it is moved to voice/superseded/.
          const superseded = existsSync(path.join(epDir, "voice", "superseded")) ? await readdir(path.join(epDir, "voice", "superseded")) : [];
          expect(superseded.some((f) => f.endsWith(takeBefore)), `${id}: old take kept in voice/superseded (${superseded.join(", ")})`).toBe(true);
          // Only this scene re-opened.
          s = await state(`${id}: after regenerate`);
          for (const x of s.scenes) if (approvedSoFar.includes(x.id)) expect(x.approved, `${x.id} stays approved`).toBe(true);
        }
        const conditional = c.verse?.mode === "recitation" && id === c.verse.sceneId;
        await produceAndApprove(id, { conditional });
        approvedSoFar.push(id);
        const g = await state(`${id}: approved`);
        if (conditional) expect(g.progress.recitationPending, "verse waits for its recitation").toEqual([id]);
        const left = order().filter((x) => !approvedSoFar.includes(x));
        expect(g.progress.unapprovedScenes, `${id}: what is left`).toEqual(left);
        if (left.length) {
          // The assembly waits for every scene and names the ones left (the Studio numbers them «المشهد ١»).
          const refused = await st.call("POST", `episodes/${EP}/scene-av-assemble`);
          expect(refused.status, `${id}: assemble with scenes left`).toBe(409);
          expect(refused.body.error, `${id}: assembly names what is left`).toMatch(/not approved yet: /);
          expect(refused.body.error.split("not approved yet: ")[1].split(", ").length, `${id}: every scene left is named`).toBe(left.length);
          expect(g.progress.currentScene, `${id}: step ٢ opens at the first scene left`).toBe(left[0]);
        }
      }
      if (c.verse?.mode === "recitation") {
        // D35: no assembly while a verse waits for its recitation.
        s = await gates("all scenes, recitation pending", { currentScene: null, approvedScenes: order().length, canAssemble: false, recitationPending: [c.verse.sceneId] });
        const refused = await st.call("POST", `episodes/${EP}/scene-av-assemble`);
        expect(refused.status, "assemble with a pending recitation").toBe(409);
      } else {
        s = await gates("all scenes", { currentScene: null, approvedScenes: order().length, canAssemble: true, recitationPending: [] });
        if (c.verse?.mode === "citation") {
          // D68: the citation is silent text; no recitation is asked or accepted.
          const own = await st.call("GET", `episodes/${EP}/own-recitations`);
          expect(own.body.verses, "no recitation asked").toEqual([]);
          const wav = path.join(st.root, "tone.wav");
          ffmpeg(["-f", "lavfi", "-i", "sine=frequency=200:duration=2", wav]);
          const up = await st.call("POST", `episodes/${EP}/own-recitations`, { action: "upload", key: c.verse.key, name: "tone.wav", data: (await readFile(wav)).toString("base64") });
          expect(up.status, "no recitation accepted for a citation").toBe(409);
        }
      }
      await contentSave("after the scenes");

      // ── 5. A scene's text edited after «اعتمد التجهيز»: only that scene re-opens (D76) ───────────────────
      const scriptText = await readFile(path.join(epDir, "script.md"), "utf8");
      expect(scriptText).toContain(c.edit.from);
      const beforeEdit = await state("before edit");
      ok("edit script", await st.call("PUT", `episodes/${EP}/script`, { text: scriptText.replace(c.edit.from, c.edit.to) }));
      s = await state("after edit");
      for (const x of s.scenes) {
        const was = beforeEdit.scenes.find((y: any) => y.id === x.id);
        if (x.id === c.edit.sceneId) expect(x, "the edited scene re-opens").toMatchObject({ approved: false });
        else expect([x.id, x.approved, x.sourceSha256], `${x.id} untouched by the edit`).toEqual([x.id, was.approved, was.sourceSha256]);
      }
      expect(s.script.approved && s.storyboard.approved, "no second preparation approval").toBe(true);
      expect(s.progress).toMatchObject({ currentScene: c.edit.sceneId, canAssemble: false, assemblyApproved: false, masterApproved: false, publishAllowed: false });
      expect(s.recentHistory.some((h: any) => h.action === "update-after-preparation" && h.by === "system"), "signed «تحديث بعد التجهيز»").toBe(true);
      expect(s.scenes.find((x: any) => x.id === c.edit.sceneId).afterPreparation, "«تغيّر بعد التجهيز — راجعه»").toBeTruthy();
      // Its changed sentence is voiced again (fake provider), then the scene is produced and approved again.
      ok("voice the edited scene", await st.call("POST", `episodes/${EP}/voice`, { scenes: [c.edit.sceneId] }));
      await produceAndApprove(c.edit.sceneId);

      // ── 6. The owner's recitation (بالإسلام): a generated tone, NEVER a real recitation ──────────────────
      if (c.verse?.mode === "recitation") {
        const wav = path.join(st.root, "owner-recitation-test-tone.wav");
        ffmpeg(["-f", "lavfi", "-i", "aevalsrc='0.001*(2*random(0)-1)+0.05*sin(2*PI*180*t)*between(t,0.5,3.5)':s=44100:d=4", wav]);
        const data = (await readFile(wav)).toString("base64");
        expect((await st.call("POST", `episodes/${EP}/own-recitations`, { action: "upload", key: c.verse.key, name: "tone.wav", data }, CROSS)).status).toBe(403);
        const up = await st.call("POST", `episodes/${EP}/own-recitations`, { action: "upload", key: c.verse.key, name: "tone.wav", data });
        ok("upload recitation", up);
        expect(up.body.candidate.variant).toBe("processed");
        const appr = { action: "approve", key: c.verse.key, reciter: "صاحب القناة", rightsEvidence: "تسجيل اختبار مولَّد (نغمة)، لا تلاوة", note: "اختبار الرحلة", listened: true };
        expect((await st.call("POST", `episodes/${EP}/own-recitations`, { ...appr, listened: false })).status, "not listened").toBe(409);
        ok("approve recitation", await st.call("POST", `episodes/${EP}/own-recitations`, appr));
        s = await gates("recitation approved", { currentScene: c.verse.sceneId, recitationPending: [], canAssemble: false });
        for (const x of s.scenes) expect([x.id, x.approved], "only the verse scene re-opens").toEqual([x.id, x.id !== c.verse.sceneId]);
        await produceAndApprove(c.verse.sceneId, { conditional: false });
      }

      // ── 7. Assembly, watched 1× with every seam heard, then approved ─────────────────────────────────────
      s = await gates("before assembly", { currentScene: null, approvedScenes: order().length, canAssemble: true, recitationPending: [] });
      expect((await st.call("POST", `episodes/${EP}/scene-av-assemble`, undefined, CROSS)).status).toBe(403);
      const asm = await st.call("POST", `episodes/${EP}/scene-av-assemble`);
      ok("assemble", asm);
      s = await state("assembled");
      const assemblySha = s.candidates.assemblySha256;
      expect(assemblySha).toMatch(/^[a-f0-9]{64}$/);
      ok("record assembly", await decide({ action: "assemble", expectedSha256: assemblySha }));
      // No Master job before the assembly's own approval.
      const early = await st.call("POST", "jobs", { kind: "make", episode: EP });
      if (early.status === 200) {
        const done = await waitFor("early master", () => st.call("GET", "jobs"), (x) => x.body.find((j: any) => j.id === early.body.id)?.status !== "running", 300_000, 1000);
        expect(done.body.find((j: any) => j.id === early.body.id).status, "Master before the assembly approval").toBe("error");
      } else expect(early.status).toBe(409);
      expect(existsSync(path.join(epDir, "out", "package", `${EP}-episode.mp4`)), "no Master file yet").toBe(false);
      for (const seam of s.seams) ok(`seam ${seam}`, await st.call("POST", `episodes/${EP}/seam-checks`, { seam, assemblySha256: assemblySha, how: "confirmed" }));
      expect((await decide({ action: "approve-assembly", expectedSha256: assemblySha, seamsChecked: s.seams })).status, "not watched").toBe(409);
      expect((await decide({ action: "approve-assembly", expectedSha256: assemblySha, confirmedWatched: true, seamsChecked: s.seams.slice(1) })).status, "a seam unchecked").toBe(409);
      ok("approve assembly", await decide({ action: "approve-assembly", expectedSha256: assemblySha, confirmedWatched: true, seamsChecked: s.seams }));
      await gates("assembly approved", { assemblyApproved: true, masterApproved: false, publishAllowed: false });

      // ── 8. A tiny REAL Master through the Studio's own job («اصنع النسخة النهائية»), then its approval ─────
      // KI-058: the real queue state, read from the API: nothing has run «جهّز كل المشاهد» since its one finished run
      // (the Master is refused while it runs, by design; the journey never starts it again).
      const queue = (await st.call("GET", `episodes/${EP}/scene-prepare`)).body.job;
      expect([queue.status, queue.startedAt], "no preparation running before the Master").toEqual(["done", firstJob]);
      const make = await st.call("POST", "jobs", { kind: "make", episode: EP });
      ok("make Master", make);
      const made = await waitFor("Master job", () => st.call("GET", "jobs"), (x) => x.body.find((j: any) => j.id === make.body.id)?.status !== "running", 1_200_000, 2000);
      const mj = made.body.find((j: any) => j.id === make.body.id);
      expect(mj.status, `Master job: ${JSON.stringify(mj.log ?? mj).slice(-3000)}`).toBe("done");
      const masterFile = path.join(epDir, "out", "package", `${EP}-episode.mp4`);
      const mv = probe(masterFile);
      expect(mv.streams.find((x) => x.codec_type === "video"), "tiny Master").toMatchObject({ width: 320, height: 180 });
      expect(mv.streams.some((x) => x.codec_type === "audio"), "Master has sound").toBe(true);
      s = await state("Master made");
      const masterSha = s.candidates.masterSha256;
      expect(masterSha).toBe(await sha256File(masterFile));
      expect((await decide({ action: "grant-publish", expectedSha256: masterSha, confirmedWatched: true })).status, "publish before Master approval").toBe(409);
      expect((await decide({ action: "approve-master", expectedSha256: masterSha })).status, "Master unwatched").toBe(409);
      expect((await decide({ action: "approve-master", expectedSha256: "b".repeat(64), confirmedWatched: true })).status, "other bytes").toBe(409);
      ok("approve Master", await decide({ action: "approve-master", expectedSha256: masterSha, confirmedWatched: true }));
      await gates("Master approved", { masterApproved: true, publishAllowed: false });
      // Nothing reached Drive before the permission.
      expect(await tree(st.driveDir), "Drive before the permission").toEqual({});

      // ── 9. Publish permission → the Drive copy (temp folder), verified file by file ─────────────────────
      expect((await decide({ action: "grant-publish", expectedSha256: masterSha, confirmedWatched: true }, CROSS)).status).toBe(403);
      ok("grant publish", await decide({ action: "grant-publish", expectedSha256: masterSha, confirmedWatched: true }));
      await gates("publish allowed", { masterApproved: true, publishAllowed: true });
      const handoff = await waitFor("Drive copy", () => st.call("GET", `episodes/${EP}/publish-drive`), (x) => x.body.job?.status && x.body.job.status !== "running", 300_000, 500);
      expect(handoff.body.job.status, `Drive: ${JSON.stringify(handoff.body).slice(0, 1500)}`).toBe("done");
      const folder = path.join(st.driveDir, "balislam-publish", channel, `${EP}-${c.slug}`);
      expect(handoff.body.drive.folder).toBe(folder);
      const manifest = JSON.parse(await readFile(path.join(folder, "manifest.json"), "utf8"));
      expect(manifest).toMatchObject({ version: 1, channel, episodeDir: `${EP}-${c.slug}`, approvals: { master: { sha256: masterSha, approvedBy: "owner" }, publish: { grantedBy: "owner" } } });
      const copied = await tree(folder);
      expect(Object.keys(copied).sort(), "exactly the manifest's files").toEqual([...manifest.files.map((f: any) => f.name), "manifest.json"].sort());
      for (const f of manifest.files) {
        expect(copied[f.name], `${f.name}: hash in manifest`).toBe(f.sha256);
        expect((await readFile(path.join(folder, f.name))).byteLength, `${f.name}: size`).toBe(f.size);
      }
      const master = manifest.files.find((f: any) => f.kind === "master");
      expect(master.sha256, "the Master on Drive is the approved bytes").toBe(masterSha);
      expect(copied[master.name], "byte for byte").toBe(await sha256File(masterFile));
      // Rule one: no trace of the production tools in anything published.
      for (const name of Object.keys(copied).filter((n) => /\.(txt|json|srt)$/.test(n)))
        expect(findTraces(await readFile(path.join(folder, name), "utf8")), `${name}: traces`).toEqual([]);
      expect(findTraces("صُنع بأداة ElevenLabs"), "the trace check itself is live").not.toEqual([]);
      const { videoTraces, pngTraces } = await import("../../src/package/driveHandoff");
      expect(await videoTraces(path.join(folder, master.name)), "Master metadata").toEqual([]);
      for (const name of Object.keys(copied).filter((n) => n.endsWith(".png"))) expect(await pngTraces(path.join(folder, name)), name).toEqual([]);

      // ── Ledger: the whole story, signed; a changed byte is refused ─────────────────────────────────────
      const ledgerFile = path.join(epDir, "scene-production.v1.json");
      const ledger = JSON.parse(await readFile(ledgerFile, "utf8"));
      const actions = ledger.history.map((h: any) => h.action);
      expect(actions.slice(0, 2)).toEqual(["approve-script", "approve-storyboard"]);
      expect(actions.slice(-4)).toEqual(["assemble", "approve-assembly", "approve-master", "grant-publish"]);
      expect(actions.filter((a: string) => a === "correct-scene")).toHaveLength(1);
      expect(ledger.history.filter((h: any) => h.by === "system").map((h: any) => h.action)).toContain("update-after-preparation");
      const raw = await readFile(ledgerFile, "utf8");
      await writeFile(ledgerFile, raw.replace(/"by": "owner"/, `"by": "someone"`));
      const tampered = await st.call("GET", `episodes/${EP}/scene-production`);
      expect(tampered.status, "a tampered ledger is refused").not.toBe(200);
      expect(JSON.stringify(tampered.body)).toMatch(/signature changed|approvals are blocked|invalid/);
      await writeFile(ledgerFile, raw);
      await gates("ledger restored", { publishAllowed: true });

      // ── Content save after the journey: owner content only; the D101 conflict (brief §٦) ─────────────────
      const saved = await contentSave("after the journey");
      expect(saved.files).toContain(`channels/${channel}/episodes/${EP}-${c.slug}/script.md`);
      expect(saved.files).toContain(`channels/${channel}/episodes/${EP}-${c.slug}/tashkeel.md`);
      expect(saved.local.join("\n"), "the ledger exists locally").toContain("scene-production.v1.json");
      await conflictCase(st, channel, `${EP}-${c.slug}`, state);
      expect(outgoing, "no request left this machine").toEqual([]);
    }, 3_000_000);
  });
}

/**
 * D101 (brief §٦): the owner edits the script while a code update changes the same file's shape.
 * The update must never write over the owner's edit nor leave conflict markers; the episode keeps opening;
 * the content save never sends a file that waits for the owner's decision; «أبقِ نسختي» brings his edit back.
 */
const conflictCase = async (st: Studio, channel: string, epName: string, state: (l: string) => Promise<any>) => {
  const rel = `channels/${channel}/episodes/${epName}/script.md`;
  const dev = path.join(st.root, "..", `${path.basename(st.root)}-dev`);
  git(path.dirname(dev), ["clone", "-q", st.remote, dev]);
  try {
    // The code update: a new frontmatter field and the citations block re-written (same words, new shape).
    const upstream = await readFile(path.join(dev, rel), "utf8");
    const reshaped = upstream.replace(/^---\n/, "---\nformat: 2\n").replace(/^## الاستشهادات$/m, "## الاستشهادات والمصادر");
    expect(reshaped).not.toBe(upstream);
    await writeFile(path.join(dev, rel), reshaped);
    git(dev, ["commit", "-q", "-am", "code update reshapes script.md"]);
    git(dev, ["push", "-q", "origin", "main"]);

    // (a) The owner edits ANOTHER part of the same file (its first narration line): both changes are kept (3-way), no card.
    const lines = upstream.split("\n");
    const body = lines.indexOf("---", 1) + 2;
    lines[body] = `${lines[body]} (تعديل المالك)`;
    const mineA = lines.join("\n");
    await writeFile(path.join(st.root, rel), mineA);
    git(st.root, ["fetch", "-q", "origin"]);
    const a = await safeFastForward(st.root, { runInstall: async () => true });
    expect(a.ok, `update (a): ${a.message}`).toBe(true);
    const nowA = await readFile(path.join(st.root, rel), "utf8");
    expect(nowA, "owner's edit kept").toContain("(تعديل المالك)");
    expect(nowA, "update's shape kept").toContain("format: 2");
    expect(nowA, "no conflict markers").not.toMatch(/^(<<<<<<<|=======|>>>>>>>)/m);
    expect(await readConflicts(st.root)).toEqual([]);
    expect((await state("after update (a)")).script, "the episode still opens").toBeTruthy();
    const pushA = await pushContentOnce(st.root, (await pendingContent(st.root))!.files);
    expect(pushA.ok, JSON.stringify(pushA)).toBe(true);

    // (b) The owner edits the SAME line the update reshapes: a card, the new file in place, his copy kept.
    git(dev, ["pull", "-q", "--ff-only"]);
    const theirs = (await readFile(path.join(dev, rel), "utf8")).replace("## الاستشهادات والمصادر", "## المصادر");
    await writeFile(path.join(dev, rel), theirs);
    git(dev, ["commit", "-q", "-am", "code update reshapes the citations heading again"]);
    git(dev, ["push", "-q", "origin", "main"]);
    const mineB = (await readFile(path.join(st.root, rel), "utf8")).replace("## الاستشهادات والمصادر", "## الاستشهادات (راجعها المالك)");
    await writeFile(path.join(st.root, rel), mineB);
    git(st.root, ["fetch", "-q", "origin"]);
    const b = await safeFastForward(st.root, { runInstall: async () => true });
    expect(b.ok, `update (b): ${b.message}`).toBe(true);
    expect(b.conflicts?.map((x) => x.file), "one card for the owner").toEqual([rel]);
    const nowB = await readFile(path.join(st.root, rel), "utf8");
    expect(nowB, "the new file in place").toBe(theirs);
    expect(nowB).not.toMatch(/^(<<<<<<<|=======|>>>>>>>)/m);
    expect(await readFile(path.join(b.backup!, "files", rel), "utf8"), "the owner's copy is kept").toBe(mineB);
    expect((await state("after update (b)")).script, "the episode still opens").toBeTruthy();
    // While the card waits, a content save never sends that file.
    const waiting = await pendingContent(st.root);
    expect(waiting?.files ?? [], "the waiting file is not saved").not.toContain(rel);
    // «أبقِ نسختي»: his edit comes back, and the next save sends it.
    const kept = await resolveConflict(st.root, rel, "mine");
    expect(kept.ok, kept.message).toBe(true);
    expect(await readFile(path.join(st.root, rel), "utf8")).toBe(mineB);
    const pushB = await pushContentOnce(st.root, (await pendingContent(st.root))!.files);
    expect(pushB.ok, JSON.stringify(pushB)).toBe(true);
    expect(git(st.remote, ["show", `main:${rel}`]) + "\n").toBe(mineB.endsWith("\n") ? mineB : mineB + "\n");
    expect((await state("after «أبقِ نسختي»")).script).toBeTruthy();
  } finally {
    const { rm } = await import("node:fs/promises");
    await rm(dev, { recursive: true, force: true });
  }
};
