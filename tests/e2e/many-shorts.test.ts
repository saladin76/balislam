/**
 * D152 (طلب المالك ١٦ نوفمبر: «خلي عدد الشورتس او الريلز داخل الاستديو غير محدود»): ٢٥ شورتًا في حلقة واحدة،
 * عبر خادم الاستوديو الحقيقي كرحلة المالك (tests/e2e/journey.test.ts): صوت وهمي (BAL_VOICE_PROVIDER=fake)، ورندر
 * حقيقي صغير (BAL_E2E_RENDER=tiny)، وDrive في مجلد مؤقت. لا مفتاح ولا شبكة ولا بيانات مالك ولا اعتماد حقيقي.
 *
 * حلقة الرحلة الثابتة لكل قناة (tests/fixtures/e2e/<channel>/) ومعها خمسة مشاهد متكلَّمة أخرى، فتصير ثمانية مشاهد
 * تكفي لخمسة وعشرين مقطعًا مختلفًا (المكرر مرفوض كما كان). الترتيب كما هو: كل المشاهد ← التجميع ← Master ←
 * اعتماده ← اختيار ٢٥ مقطعًا ← «اصنع الشورتس والريلز».
 * D243 (٢٨ نوفمبر): الشورتس كلها قصّ من النسخة العمودية الكاملة على جهاز الرندر، فـ«اصنع الشورتس والريلز» يُرفض برسالة
 * D243 ولا يكتب شورتًا، وتبقى المقاطع الخمسة والعشرون محفوظة في الخطة للقص (القص ومهامه في tests/vertical-version-d243.test.ts).
 *
 * Run: `npm run e2e` (BAL_E2E_CHANNELS=all for the three channels).
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { browserPlanRevision } from "../../src/plan/revision";
import { checkPlanShort } from "../../src/package/shortIdeaPlan";
import { CASES, selectedChannels, type ChannelCase } from "./channels";
import { ffmpeg, fixturesDir, generateVoiceConfirmed, sha256File, startStudio, waitFor, type Studio, passEditor } from "./harness";

const EP = "001";
const COUNT = 25;

/** خمسة مشاهد أخرى لكل قناة، بتشكيل كامل، بلا ذكر لله ولا آية (لا أحداث فيها شرط). */
const EXTRA: Record<string, string[]> = {
  balislam: [
    "وَالصَّبْرُ عَلَى الطَّرِيقِ يُقَرِّبُ البَعِيدَ خُطْوَةً بَعْدَ خُطْوَةٍ.",
    "وَمَنْ كَتَبَ هَدَفَهُ عَلَى وَرَقَةٍ، رَآهُ أَمَامَهُ كُلَّ صَبَاحٍ.",
    "وَالوَقْتُ القَلِيلُ كُلَّ يَوْمٍ يَصِيرُ كَثِيرًا مَعَ الشُّهُورِ.",
    "فَلَا تَنْتَظِرْ يَوْمًا مِثَالِيًّا لِتَبْدَأَ.",
    "وَتَذَكَّرْ أَنَّ كُلَّ شَيْءٍ كَبِيرٍ كَانَ صَغِيرًا فِي أَوَّلِهِ.",
  ],
  "dafatir-alzaman": [
    "وَكَانَتِ الخِيَامُ تُنْصَبُ حَوْلَ البِئْرِ كُلَّ مَوْسِمٍ.",
    "وَحَمَلَتِ الجِمَالُ القُمَاشَ وَالمِلْحَ وَالتَّمْرَ.",
    "وَبَنَى النَّاسُ بُيُوتًا مِنَ الطِّينِ قُرْبَ السُّوقِ.",
    "ثُمَّ ظَهَرَ سُورٌ يَحْمِي البُيُوتَ وَالطَّرِيقَ.",
    "وَصَارَ لِلسُّوقِ اسْمٌ يَعْرِفُهُ المُسَافِرُونَ.",
  ],
  "zubdat-alkutub": [
    "وَالعَادَةُ الصَّغِيرَةُ سَهْلَةٌ، فَلَا تَحْتَاجُ إِلَى قُوَّةٍ كَبِيرَةٍ.",
    "وَكُلُّ مَرَّةٍ تُكَرِّرُهَا تَصِيرُ أَسْهَلَ مِنْ قَبْلُ.",
    "وَيَقُولُ الكِتَابُ إِنَّ المَكَانَ يُسَاعِدُ عَلَى البِدَايَةِ.",
    "فَضَعِ الكِتَابَ قُرْبَ سَرِيرِكَ لِتَقْرَأَ صَفْحَةً.",
    "وَبَعْدَ شَهْرٍ سَتَرَى الفَرْقَ بِنَفْسِكَ.",
  ],
};

/** السكريبت الثابت ومعه المشاهد الخمسة بعد آخر مشهد متكلَّم (قبل «الاستشهادات»)، ونسخة التشكيل معها. */
const withExtra = (channel: string, text: string, kind: "script" | "tashkeel") => {
  const extra = EXTRA[channel]!;
  const marker = channel === "dafatir-alzaman" && kind === "script" ? "[مشهد: big-question]\n" : "";
  const block = extra.map((x) => `${marker}${x}`).join("\n\n");
  if (kind === "tashkeel") return `${text.trimEnd()}\n\n${block}\n`;
  const at = text.indexOf("## الاستشهادات");
  expect(at, "the fixture has its citations").toBeGreaterThan(0);
  return `${text.slice(0, at).trimEnd()}\n\n${block}\n\n${text.slice(at)}`;
};

const outgoing: string[] = [];
const realFetch = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (async (input: any, init?: any) => {
    const url = String(input?.url ?? input);
    if (!/^http:\/\/127\.0\.0\.1:/.test(url)) {
      outgoing.push(url);
      throw new Error(`[e2e] network call refused: ${url}`);
    }
    return realFetch(input, init);
  }) as typeof fetch;
});
afterAll(() => { globalThis.fetch = realFetch; expect(outgoing).toEqual([]); });

for (const channel of selectedChannels()) {
  const c: ChannelCase = CASES[channel]!;
  describe(`many shorts in one episode — ${channel}`, () => {
    let st: Studio;
    let epDir = "";
    const fx = (f: string) => readFile(path.join(fixturesDir, channel, f), "utf8");
    const state = async (label: string) => {
      const r = await st.call("GET", `episodes/${EP}/scene-production`);
      expect(r.status, `${label}: ${JSON.stringify(r.body).slice(0, 400)}`).toBe(200);
      return r.body;
    };
    const decide = (cmd: Record<string, unknown>) => st.call("POST", `episodes/${EP}/scene-production`, cmd);
    const ok = (label: string, r: { status: number; body: any }, status = 200) =>
      expect(r.status, `${label} → ${r.status}: ${JSON.stringify(r.body).slice(0, 900)}`).toBe(status);
    const produceAndApprove = async (id: string) => {
      let s = await state(`${id}: before`);
      expect(s.progress.currentScene, `${id} is the current scene`).toBe(id);
      let sc = s.scenes.find((x: any) => x.id === id);
      if (sc.draft !== "ready" || !s.candidates.scenes[id]) {
        ok(`${id}: render`, await st.call("POST", `episodes/${EP}/scene-av-render`, { sceneId: id, expectedSha256: sc.sourceSha256 }));
        s = await state(`${id}: rendered`);
        sc = s.scenes.find((x: any) => x.id === id);
      }
      ok(`${id}: submit`, await decide({ action: "submit-scene", sceneId: id, expectedSha256: sc.sourceSha256 }));
      const cut = (await state(`${id}: submitted`)).candidates.scenes[id];
      ok(`${id}: approve`, await decide({ action: "approve-scene", sceneId: id, expectedSha256: cut, confirmedWatched: true }));
    };
    const job = async (label: string, kind: "make" | "shorts") => {
      const start = await st.call("POST", "jobs", { kind, episode: EP });
      ok(label, start);
      const done = await waitFor(label, () => st.call("GET", "jobs"), (x) => x.body.find((j: any) => j.id === start.body.id)?.status !== "running", 1_500_000, 2000);
      const j = done.body.find((x: any) => x.id === start.body.id);
      expect(j.status, `${label}: ${JSON.stringify(j.log ?? j).slice(-3000)}`).toBe("done");
      return j;
    };

    beforeAll(async () => {
      st = await startStudio(channel);
      epDir = path.join(st.channelsDir, channel, "episodes", `${EP}-${c.slug}`);
    }, 300_000);
    afterAll(async () => { await st?.close(); });

    it(`${COUNT} shorts: saved, made in one job in order, listed, counted, and copied to Drive byte for byte`, async () => {
      // ── The episode: the fixed journey episode with five more spoken scenes ───────────────────────────────
      ok("create", await st.call("POST", "episodes", { episode: EP, slug: c.slug, domain: c.domain, title: c.title }));
      const script = await st.call("PUT", `episodes/${EP}/script`, { text: withExtra(channel, await fx("script.md"), "script") });
      ok("script", script);
      await passEditor(st, EP); // D234
      expect(script.body.check.issues.filter((i: any) => i.level === "error"), "script errors").toEqual([]);
      ok("research", await st.call("PUT", `episodes/${EP}/research`, { text: await fx("research.md") }));
      await writeFile(path.join(epDir, "tashkeel.md"), withExtra(channel, await fx("tashkeel.md"), "tashkeel"));
      let plan = (await st.call("GET", `episodes/${EP}`)).body.plan;
      const order: string[] = plan.chapters.flatMap((ch: any) => ch.scenes.map((s: any) => s.id));
      const spoken = order.filter((id) => id !== "c1-end");
      expect(spoken, "eight scenes to cut from").toHaveLength(8);
      // As in the journey: the closing card at 4 s, the episode tone, and a picture for each documentary plate.
      const plates: Record<string, string> = {};
      for (const x of plan.chapters.flatMap((ch: any) => ch.scenes).filter((x: any) => x.template === "doc-plate" && !x.props?.image)) {
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

      // The selection can be saved before the Master (D83/D102); making them waits for the approved Master.
      // A short made only of intended stillness (the verse, and in «زبدة الكتب» its lead-in «كما جاء في سورة …:»)
      // has no counted second and fails rule two (motion ≥ 80% per short) — the per-short rule stays; such a
      // passage is simply not chosen here.
      const still = new Set([c.verse?.sceneId, ...(channel === "zubdat-alkutub" ? ["c1-s1"] : [])].filter(Boolean));
      // D241 (٢٧ نوفمبر): كل شورت فكرة كاملة وحده — يبدأ بخطاف معلَّم وجمل كاملة، بلا إشارة إلى خارجه. تُختار المقاطع
      // من مشاهد الحلقة نفسها (أجزاء غير متتالية مسموحة) بالفحص النقي نفسه الذي تمر به البوابة، أصغرها أولًا.
      const pick: string[][][] = [];
      // أجزاء الشورت: كل مشاهد متتالية في الحلقة جزء واحد
      const partsOf = (c: number[]) => c.reduce<number[][]>((acc, v) => { const last = acc.at(-1); if (last && last.at(-1)! + 1 === v) last.push(v); else acc.push([v]); return acc; }, []).map((r) => r.map((i) => spoken[i]!));
      const idx = spoken.map((_, i) => i);
      const combos = (k: number, from = 0): number[][] => (k === 0 ? [[]] : idx.slice(from).flatMap((i) => combos(k - 1, i + 1).map((r) => [i, ...r])));
      // المقاطع المتصلة أولًا (كما كانت قبل D241، وكلها تعبر قاعدة الحركة ٨٠٪)، ثم الأجزاء غير المتصلة إن لم تكفِ.
      const runs = [0, 1, 2, 3, 4].flatMap((w) => idx.filter((a) => a + w < spoken.length).map((a) => idx.slice(a, a + w + 1)));
      const candidates = [...runs, ...[2, 3, 4, 5].flatMap((k) => combos(k)).filter((c) => c.some((v, j) => j > 0 && v !== c[j - 1]! + 1))];
      for (const c of candidates) {
        if (pick.length >= COUNT) break;
        const ids = c.map((i) => spoken[i]!);
        if (ids.every((id) => still.has(id))) continue;
        const parts = partsOf(c);
        if (checkPlanShort(plan, { sceneIds: ids, parts, hook: "line" }).ok) pick.push(parts);
      }
      expect(pick, "enough whole-idea shorts in the fixture (D241)").toHaveLength(COUNT);
      const shorts = pick.map((parts, k) => ({
        from: parts[0]![0]!, to: parts.at(-1)!.at(-1)!, ...(parts.length > 1 ? { segments: parts.map((r) => ({ from: r[0]!, to: r.at(-1)! })) } : {}),
        hook: "line" as const, hookKind: "striking" as const, title: `الشورت ${k + 1}: ${parts.flat().length} من المشاهد`,
      }));
      const saved = await st.call("PUT", `episodes/${EP}/shorts`, { shorts });
      ok(`save ${COUNT} shorts`, saved);
      expect(saved.body.saved, "all of them, in order").toEqual(shorts);
      expect(saved.body).not.toHaveProperty("max");
      plan = (await st.call("GET", `episodes/${EP}`)).body.plan;
      expect(plan.shorts).toHaveLength(COUNT);
      // Nothing is made before the approved Master (rule four).
      const early = await st.call("POST", "jobs", { kind: "shorts", episode: EP });
      ok("shorts job before the Master", early);
      const refused = await waitFor("early shorts", () => st.call("GET", "jobs"), (x) => x.body.find((j: any) => j.id === early.body.id)?.status !== "running", 300_000, 1000);
      expect(refused.body.find((j: any) => j.id === early.body.id).status, "shorts before the Master").toBe("error");

      // ── Preparation, every scene, the recitation (بالإسلام), the assembly, the tiny Master ────────────────
      let s = await state("fresh");
      ok("approve preparation", await st.call("POST", `episodes/${EP}/approve-preparation`, { reviewed: true, scriptSha256: s.script.sha256, storyboardSha256: s.storyboard.sha256, note: "راجعته بنفسي" }));
      await waitFor("free drafts", () => st.call("GET", `episodes/${EP}/scene-prepare`), (x) => x.body.job && x.body.job.status !== "running", 1_500_000, 1000);
      // D151: the narration needs paid voice, generated only by the owner's confirmed press (fake provider).
      const { job: prep } = await generateVoiceConfirmed(st, EP);
      expect(prep.body.job, `drafts: ${JSON.stringify(prep.body).slice(0, 1500)}`).toMatchObject({ status: "done", failed: [] });
      for (const id of order) await produceAndApprove(id);
      if (c.verse?.mode === "recitation") {
        const wav = path.join(st.root, "owner-recitation-test-tone.wav");
        ffmpeg(["-f", "lavfi", "-i", "aevalsrc='0.001*(2*random(0)-1)+0.05*sin(2*PI*180*t)*between(t,0.5,3.5)':s=44100:d=4", wav]);
        ok("upload recitation", await st.call("POST", `episodes/${EP}/own-recitations`, { action: "upload", key: c.verse.key, name: "tone.wav", data: (await readFile(wav)).toString("base64") }));
        ok("approve recitation", await st.call("POST", `episodes/${EP}/own-recitations`, { action: "approve", key: c.verse.key, reciter: "صاحب القناة", rightsEvidence: "تسجيل اختبار مولَّد (نغمة)، لا تلاوة", note: "اختبار الشورتس", listened: true }));
        await produceAndApprove(c.verse.sceneId);
      }
      ok("assemble", await st.call("POST", `episodes/${EP}/scene-av-assemble`));
      s = await state("assembled");
      const assemblySha = s.candidates.assemblySha256;
      ok("record assembly", await decide({ action: "assemble", expectedSha256: assemblySha }));
      for (const seam of s.seams) ok(`seam ${seam}`, await st.call("POST", `episodes/${EP}/seam-checks`, { seam, assemblySha256: assemblySha, how: "confirmed" }));
      ok("approve assembly", await decide({ action: "approve-assembly", expectedSha256: assemblySha, confirmedWatched: true, seamsChecked: s.seams }));
      await job("make Master", "make");
      const pkgDir = path.join(epDir, "out", "package");
      const masterFile = path.join(pkgDir, `${EP}-episode.mp4`);
      s = await state("Master made");
      const masterSha = s.candidates.masterSha256;
      expect(masterSha).toBe(await sha256File(masterFile));
      ok("approve Master", await decide({ action: "approve-master", expectedSha256: masterSha, confirmedWatched: true }));

      // ── D243 (٢٨ نوفمبر): الشورتس لا تُرندر في الاستوديو؛ كلها قصّ من النسخة العمودية الكاملة على جهاز الرندر ──────
      // «اصنع الشورتس والريلز» بعد Master المعتمد يُرفض برسالة D243 ولا يكتب شورتًا (القص وحده في tests/vertical-version-d243.test.ts).
      const start = await st.call("POST", "jobs", { kind: "shorts", episode: EP });
      ok("shorts job after the Master", start);
      const done = await waitFor("shorts refused", () => st.call("GET", "jobs"), (x) => x.body.find((j: any) => j.id === start.body.id)?.status !== "running", 600_000, 1000);
      const sj = done.body.find((x: any) => x.id === start.body.id);
      expect(sj.status, "shorts are cut from the vertical version, not rendered here (D243)").toBe("error");
      expect((sj.log ?? []).join("\n")).toContain("D243");
      expect((await readdir(pkgDir)).filter((n) => /-short-\d+\.mp4$/.test(n)), "no short rendered on its own").toEqual([]);
      // the 25 saved shorts stay the plan's selection for the cuts (D152: no limit)
      expect((await st.call("GET", `episodes/${EP}`)).body.plan.shorts).toHaveLength(COUNT);
    }, 3_600_000);
  });
}
