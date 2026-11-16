/**
 * سرد واحد بلا توقف عند الوصلات (شكوى المالك ١٦ نوفمبر على دفاتر الزمن 001: «فصلات في الكلام لأنها من تجميع المشاهد»)،
 * عبر خادم الاستوديو الحقيقي ومزوّد الصوت الوهمي (BAL_VOICE_PROVIDER=fake) والرندر الصغير (BAL_E2E_RENDER=tiny):
 *
 * التجهيز ← «سريع» و«الأقصر» كما اختار المالك ← كل المشاهد معتمدة ← «دمج المشاهد للمراجعة» ← يُقاس الصوت في الملف نفسه:
 * أطول صمت عند وصلة متصلة ≤ الفاصل المختار + ٠٫١ ث، وتفاوت علوّ التعليق بين المشاهد ≤ ١ LU، والصوت والصورة بالطول نفسه
 * (لا انزياح)، وتقرير الوصلات في الخطوة ٣ بالأرقام نفسها، وكل طلب جملة أولى في مشهد يحمل آخر جملة من المشهد قبله نصًا مجاورًا،
 * ثم Master الصغير بالوصل نفسه ويمر بفحص الحركة (≥ ٨٠٪). في دفاتر الزمن تُجعل اللقطات «خط الأفق» بذيل تصميمها (كحلقة 001).
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { browserPlanRevision } from "../../src/plan/revision";
import { CASES, selectedChannels, type ChannelCase } from "./channels";
import { ffmpeg, fixturesDir, generateVoiceConfirmed, probe, startStudio, waitFor, type Studio } from "./harness";

const EP = "001";
const fakeCalls: { kind: string; text: string; body?: any }[] = [];
const outgoing: string[] = [];
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

/** Silences (below −45 dBFS, at least 40 ms) of a file's audio, in seconds */
const silenceRuns = (file: string): [number, number][] => {
  const err = spawnSync("ffmpeg", ["-nostdin", "-hide_banner", "-i", file, "-vn", "-af", "silencedetect=n=-45dB:d=0.04", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const starts = [...err.matchAll(/silence_start: (-?[\d.]+)/g)].map((m) => Number(m[1]));
  const ends = [...err.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
  return starts.map((x, i) => [Math.max(0, x), ends[i] ?? Infinity]);
};
/** EBU R128 integrated loudness of [from, to] of a file */
const lufs = (file: string, from: number, to: number): number => {
  const err = spawnSync("ffmpeg", ["-nostdin", "-hide_banner", "-ss", from.toFixed(3), "-t", (to - from).toFixed(3), "-i", file, "-vn", "-af", "ebur128", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  const m = [...err.matchAll(/I:\s+(-?[\d.]+) LUFS/g)].pop();
  return m ? Number(m[1]) : NaN;
};
const streams = (file: string) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,duration", "-of", "json", file]).toString()).streams as { codec_type: string; duration: string }[];

for (const channel of selectedChannels()) {
  const c: ChannelCase = CASES[channel]!;
  describe(`one continuous narration at the seams — ${channel}`, () => {
    let st: Studio;
    let epDir = "";
    const fx = (f: string) => readFile(path.join(fixturesDir, channel, f), "utf8");
    const ok = (label: string, r: { status: number; body: any }, status = 200) =>
      expect(r.status, `${label} → ${r.status}: ${JSON.stringify(r.body).slice(0, 900)}`).toBe(status);
    const state = async (label: string) => { const r = await st.call("GET", `episodes/${EP}/scene-production`); ok(label, r); return r.body; };
    const decide = (cmd: Record<string, unknown>) => st.call("POST", `episodes/${EP}/scene-production`, cmd);
    const produceAndApprove = async (id: string) => {
      let s = await state(`${id}: before`);
      let sc = s.scenes.find((x: any) => x.id === id);
      if (sc.draft !== "ready" || !s.candidates.scenes[id]) {
        ok(`${id}: render`, await st.call("POST", `episodes/${EP}/scene-av-render`, { sceneId: id, expectedSha256: sc.sourceSha256 }));
        s = await state(`${id}: rendered`);
        sc = s.scenes.find((x: any) => x.id === id);
      }
      ok(`${id}: submit`, await decide({ action: "submit-scene", sceneId: id, expectedSha256: sc.sourceSha256 }));
      ok(`${id}: approve`, await decide({ action: "approve-scene", sceneId: id, expectedSha256: s.candidates.scenes[id], confirmedWatched: true }));
    };

    beforeAll(async () => {
      st = await startStudio(channel);
      epDir = path.join(st.channelsDir, channel, "episodes", `${EP}-${c.slug}`);
    }, 300_000);
    afterAll(async () => { await st?.close(); });

    it("the assembled episode and the Master speak as one narration", async () => {
      ok("create", await st.call("POST", "episodes", { episode: EP, slug: c.slug, domain: c.domain, title: c.title }));
      ok("script", await st.call("PUT", `episodes/${EP}/script`, { text: await fx("script.md") }));
      ok("research", await st.call("PUT", `episodes/${EP}/research`, { text: await fx("research.md") }));
      await writeFile(path.join(epDir, "tashkeel.md"), await fx("tashkeel.md"));
      const plan = (await st.call("GET", `episodes/${EP}`)).body.plan;
      const bare = (w: string) => w.replace(/[\u064B-\u0652\u0670\u0640،,.:؛«»"()؟]/g, "");
      const shaped = { ...plan, tone: c.episodeTone, chapters: plan.chapters.map((ch: any) => ({ ...ch, scenes: ch.scenes.map((x: any) => {
        if (x.id === "c1-end") return { ...x, durationSec: 4, edited: true };
        // دفاتر الزمن: «خط الأفق» بخط زمني (ذيل تصميمه ١٫٤ ث وخروج بالخفوت)، كمشاهد الحلقة 001
        if (channel === "dafatir-alzaman" && x.narration?.trim()) {
          const w = x.narration.trim().split(/\s+/).map(bare).filter((y: string) => y.length > 2);
          // a mark on every other word, so the picture moves with the words (rule two) and only the seams are measured
          const marks = w.filter((_: string, k: number) => k % 2 === 0).slice(0, 7);
          return { ...x, template: "horizon-shot", props: { shot: "lib-timeline", items: marks.map((m: string) => `${m}=${m}`).join("|") }, edited: true };
        }
        return x;
      }) })) };
      ok("plan", await st.call("PUT", `episodes/${EP}/plan`, { plan: shaped, expectedRevision: await browserPlanRevision(plan) }));

      let s = await state("fresh");
      ok("approve preparation", await st.call("POST", `episodes/${EP}/approve-preparation`,
        { reviewed: true, scriptSha256: s.script.sha256, storyboardSha256: s.storyboard.sha256, note: "راجعته بنفسي" }));
      await waitFor("free drafts", () => st.call("GET", `episodes/${EP}/scene-prepare`), (x) => x.body.job && x.body.job.status !== "running", 1_200_000, 1000);
      // D151: the narration needs paid voice, generated only by the owner's confirmed «ولّد الصوت الآن» (fake provider).
      const { job } = await generateVoiceConfirmed(st, EP);
      expect(job.body.job, JSON.stringify(job.body).slice(0, 1200)).toMatchObject({ status: "done", failed: [] });
      if (c.verse?.mode === "recitation") {
        const wav = path.join(st.root, "owner-recitation-test-tone.wav");
        ffmpeg(["-f", "lavfi", "-i", "aevalsrc='0.001*(2*random(0)-1)+0.05*sin(2*PI*180*t)*between(t,0.5,3.5)':s=44100:d=4", wav]);
        ok("upload recitation", await st.call("POST", `episodes/${EP}/own-recitations`, { action: "upload", key: c.verse.key, name: "tone.wav", data: (await readFile(wav)).toString("base64") }));
        ok("approve recitation", await st.call("POST", `episodes/${EP}/own-recitations`, { action: "approve", key: c.verse.key, reciter: "صاحب القناة", rightsEvidence: "تسجيل اختبار مولَّد (نغمة)، لا تلاوة", note: "اختبار الرحلة", listened: true }));
      }

      // Prosody across the seam: each first request of a scene was sent with the end of the scene before as previous_text
      // (scene takes carry the whole neighbour scene, sentence takes the neighbour sentence; never across a verse, KI-011)
      const speaks = fakeCalls.filter((x) => x.kind === "speak" && x.body);
      const all = plan.chapters.flatMap((ch: any) => ch.scenes);
      const sentencesOf = (t: string) => t.trim().split(/(?<=[.؟!:])\s+/);
      let checked = 0, pairs = 0;
      for (let i = 1; i < all.length; i++) {
        const prev = all[i - 1], cur = all[i];
        if (!cur.narration?.trim() || !prev.narration?.trim() || prev.template === "verse-card" || cur.template === "verse-card") continue;
        pairs++;
        const first = sentencesOf(cur.narration)[0]!;
        const call = speaks.find((x) => String(x.text).includes(first));
        if (!call) continue;
        expect(String(call.body.previous_text ?? ""), `${cur.id}: the scene before is its previous_text`).toContain(sentencesOf(prev.narration).pop()!);
        checked++;
      }
      if (pairs) expect(checked, "at least one seam crossed by the neighbour text").toBeGreaterThan(0);

      // «سريع» و«الأقصر» (choice of the owner on 001), applied for free
      ok("set pace", await st.call("POST", `episodes/${EP}/pace`, { action: "episode", speed: "fast", pause: "shortest" }));
      ok("apply pace", await st.call("POST", `episodes/${EP}/scene-prepare`, { pace: "apply" }));
      const re = await waitFor("re-produce", () => st.call("GET", `episodes/${EP}/scene-prepare`), (x) => x.body.job && x.body.job.status !== "running", 1_200_000, 1000);
      expect(re.body.job, JSON.stringify(re.body).slice(0, 1200)).toMatchObject({ status: "done", failed: [] });
      const calls = fakeCalls.length;

      for (const id of [...c.scenes, "c1-end"]) if (!(await state(`${id}?`)).scenes.find((x: any) => x.id === id).approved) await produceAndApprove(id);
      s = await state("before assembly");
      expect(s.progress).toMatchObject({ currentScene: null, canAssemble: true });
      ok("assemble", await st.call("POST", `episodes/${EP}/scene-av-assemble`));
      s = await state("assembled");
      ok("record assembly", await decide({ action: "assemble", expectedSha256: s.candidates.assemblySha256 }));
      s = await state("assembly awaiting review");

      const file = path.join(epDir, "previews", "episode.mp4");
      const rec = JSON.parse(await readFile(path.join(epDir, "previews", "episode.seams.json"), "utf8"));
      // The seam report of step ٣ is the record of this very file
      expect(s.seamReport, "the seam report").toMatchObject({ source: "assembly", pause: { id: "shortest" } });
      expect(s.seamReport.rows.map((r: any) => r.seam)).toEqual(s.seams);
      for (const seam of s.seams) expect(s.seamTimes[seam], `${seam}: time`).toBeCloseTo(rec.seams.find((x: any) => `${x.from}>${x.to}` === seam).at, 2);

      // No drift: the audio is exactly as long as the picture
      const [v, a] = ["video", "audio"].map((k) => Number(streams(file).find((x) => x.codec_type === k)!.duration));
      expect(Math.abs(v! - a!), "audio and picture the same length").toBeLessThan(0.05);

      // The measured silence at every joined seam ≤ the chosen gap + 0.1 s
      const runs = silenceRuns(file);
      const joined = rec.seams.filter((x: any) => !x.kept);
      // Two narrated scenes side by side are joined; a seam that touches the verse or its lead-in (the «بالإسلام» and «زبدة الكتب»
      // test episodes have only those) or the closing card stays exactly as it was, a deliberate pause
      const all2 = plan.chapters.flatMap((ch: any) => ch.scenes);
      const pairs2 = rec.seams.filter((x: any) => { const a = all2.find((y: any) => y.id === x.from), b = all2.find((y: any) => y.id === x.to);
        return a?.narration?.trim() && b?.narration?.trim() && a.template !== "verse-card" && b.template !== "verse-card" && !/:\s*$/.test(a.narration.trim()); });
      expect(joined.length, "narrated seams are joined").toBe(pairs2.length);
      for (const x of rec.seams.filter((y: any) => y.kept)) expect(x.overlapFrames, `${x.from}>${x.to} kept: ${x.kept}`).toBe(0);
      if (c.verse) expect(rec.seams.filter((x: any) => x.from === c.verse!.sceneId || x.to === c.verse!.sceneId).every((x: any) => x.kept), "the verse seams are kept").toBe(true);
      let maxGap = 0;
      for (const x of joined) {
        expect(x.over, `${x.from}>${x.to}: ${x.over}`).toBeUndefined();
        // the silence (if any) that ends where the next scene starts speaking (its first word a little after its start)
        const run = runs.find(([p, q]) => p <= x.at + 0.11 && q >= x.at - 1.5 && q <= x.at + 0.36);
        const g = run ? Math.max(0, run[1] - run[0]) : 0;
        maxGap = Math.max(maxGap, g);
        expect(g, `${x.from}>${x.to}: measured silence`).toBeLessThanOrEqual(x.target + 0.1);
      }
      // Loudness: every narrated scene of the file within 1 LU of the others
      const starts = [0, ...rec.seams.map((x: any) => x.at)];
      const ids = Object.keys(rec.sceneSeconds);
      const loud = ids.map((id, i) => ({ id, l: lufs(file, starts[i]!, starts[i]! + rec.sceneSeconds[id]) }))
        .filter((x) => c.verse?.sceneId !== x.id && x.id !== "c1-end" && Number.isFinite(x.l));
      const spread = Math.max(...loud.map((x) => x.l)) - Math.min(...loud.map((x) => x.l));
      expect(spread, `loudness spread ${JSON.stringify(loud)}`).toBeLessThanOrEqual(1);
      console.log(`[e2e seams ${channel}] max measured seam silence ${maxGap.toFixed(3)} s, target ${joined[0]?.target ?? "—"}; stacked ${joined.map((x: any) => x.stacked).join(", ")}; loudness spread ${spread.toFixed(2)} LU`);

      // Approve the assembly (the owner's decisions, as in the journey) and render the tiny Master with the same joins
      for (const seam of s.seams) ok(`seam ${seam}`, await st.call("POST", `episodes/${EP}/seam-checks`, { seam, assemblySha256: s.candidates.assemblySha256, how: "confirmed" }));
      ok("approve assembly", await decide({ action: "approve-assembly", expectedSha256: s.candidates.assemblySha256, confirmedWatched: true, seamsChecked: s.seams }));
      const make = await st.call("POST", "jobs", { kind: "make", episode: EP });
      ok("make Master", make);
      const made = await waitFor("Master", () => st.call("GET", "jobs"), (x) => x.body.find((j: any) => j.id === make.body.id)?.status !== "running", 1_200_000, 2000);
      const mj = made.body.find((j: any) => j.id === make.body.id);
      expect(mj.status, `Master: ${JSON.stringify(mj.log ?? mj).slice(-3000)}`).toBe("done");
      const report = path.join(epDir, "out", "package", "motion-report.md");
      if (existsSync(report)) expect(await readFile(report, "utf8")).not.toMatch(/مرفوض/);
      const master = path.join(epDir, "out", "package", `${EP}-episode.mp4`);
      expect(Math.abs(Number(probe(master).format.duration) - Number(probe(file).format.duration)), "the Master has the assembly's timeline").toBeLessThan(0.15);
      const mruns = silenceRuns(master);
      for (const x of joined) {
        const run = mruns.find(([p, q]) => p <= x.at + 0.11 && q >= x.at - 1.5 && q <= x.at + 0.36);
        expect(run ? run[1] - run[0] : 0, `Master ${x.from}>${x.to}`).toBeLessThanOrEqual(x.target + 0.1);
      }
      expect(fakeCalls.length, "no voice request for the joins").toBe(calls);
      expect(outgoing).toEqual([]);
    });
  });
}
