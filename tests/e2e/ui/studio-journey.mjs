/**
 * The full journey in the Studio PAGE, clicking the real buttons through the four steps (stabilization brief, work ٤).
 * One channel («دفاتر الزمن» by default: its fixture has no verse, so every step is the owner's own click).
 *
 * Self-contained and free, like app/scripts/sentence-replay-qa.mjs: its own Studio (app/vite.config.ts) in this
 * process on a temporary channels folder under renders/ (deleted at the end), the test-only fake voice provider
 * (BAL_VOICE_PROVIDER=fake with BAL_E2E=1; refused beside a real key), tiny real renders (BAL_E2E_RENDER=tiny) and
 * a temporary Drive folder (BAL_DRIVE_PUBLISH_DIR). Every non-local request in this process is refused.
 * The fixture's script and research are put in place through the same routes the page uses; its vowelled copy is created and
 * saved in the page's «النص المشكول» tab (D132).
 *
 * Then the step ٢ dock and sentence-panel parity of the three channels (D150, docs/studio/channel-parity.md): episode 002 in
 * each channel, «اعتمد المشهد» on its first scene from the page, and the dock of a narration scene and of the verse scene
 * read from the page: the same controls, labels, order and ⏎ everywhere, and a verse's absent voice said by its rule.
 *
 *   npm run e2e:ui            (tsx tests/e2e/ui/studio-journey.mjs [--channel dafatir-alzaman] [--port 4451] [--shots <dir>]
 *                              [--dock-channels balislam,dafatir-alzaman,zubdat-alkutub | none] [--dock-only])
 *
 * Playwright is resolved from the project, PLAYWRIGHT_MODULE, or /opt/node-tools. Exit code 1 when anything fails.
 */
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : def; };
const CH = arg("channel", "dafatir-alzaman");
const port = Number(arg("port", "4451"));
const shots = arg("shots", "");
const EP = "001";
const DOCK_CHANNELS = arg("dock-channels", "balislam,dafatir-alzaman,zubdat-alkutub").split(",").filter((c) => c && c !== "none");
const EP2 = "002";
// --dock-only: only the D150 dock/sentence parity of the three channels (no main journey), for a quick local check
const DOCK_ONLY = process.argv.includes("--dock-only");
const SLUG = "e2e-ui-journey";
const repo = path.resolve(import.meta.dirname, "..", "..", "..");
const fixtures = path.join(repo, "tests", "fixtures", "e2e", CH);

const loadPlaywright = () => {
  const bases = [process.cwd() + "/", process.env.PLAYWRIGHT_MODULE ? process.env.PLAYWRIGHT_MODULE.replace(/\/?$/, "/") : "", "/opt/node-tools/", "/opt/npm-tools/"].filter(Boolean);
  for (const b of bases) { try { return createRequire(b)("playwright"); } catch { /* next */ } }
  throw Error("Playwright not found (set PLAYWRIGHT_MODULE).");
};
const { chromium } = loadPlaywright();

// ── a temporary channels folder (under renders/, so the media guard serves it like the owner's own files) ──
await mkdir(path.join(repo, "renders"), { recursive: true });
const root = await mkdtemp(path.join(repo, "renders", "e2e-ui-"));
const drive = await mkdtemp(path.join(os.tmpdir(), "bal-e2e-ui-drive-"));
const chDir = path.join(root, CH);
for (const ch of new Set([CH, ...DOCK_CHANNELS])) {
  await mkdir(path.join(root, ch, "episodes"), { recursive: true });
  for (const f of await readdir(path.join(repo, "channels", ch))) if (f.endsWith(".json") && f !== "stock.json") await cp(path.join(repo, "channels", ch, f), path.join(root, ch, f));
}
Object.assign(process.env, {
  BAL_CHANNELS_DIR: root, BAL_ENV_FILE: path.join(root, ".env"), BAL_CONTENT_SYNC: "off", BAL_DRIVE_PUBLISH_DIR: drive,
  BAL_VOICE_PROVIDER: "fake", BAL_E2E: "1", BAL_E2E_RENDER: "tiny",
});
for (const k of ["ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "BAL_WORKFLOW_HMAC_KEY", "BAL_DRIVE_PREVIEWS_DIR"]) delete process.env[k];

// D136: every request the fake voice provider receives (the Studio runs in this process), to check what a tone sends
const voiceCalls = (globalThis.__balFakeVoiceCalls = []);
const realFetch = globalThis.fetch;
const outgoing = [];
globalThis.fetch = async (input, init) => {
  const u = String(input?.url ?? input);
  if (/^http:\/\/127\.0\.0\.1:/.test(u)) return realFetch(input, init);
  outgoing.push(u);
  throw Error(`[e2e-ui] network call refused: ${u}`);
};

const { createServer } = await import("vite");
const vite = await createServer({ configFile: path.join(repo, "app", "vite.config.ts"), logLevel: "error", server: { port, strictPort: true, host: "127.0.0.1", hmr: false, watch: null } });
await vite.listen();
const origin = `http://127.0.0.1:${port}`;
const fails = [];
const ok = (cond, what) => { console.log(`${cond ? "ok  " : "FAIL"} ${what}`); if (!cond) fails.push(what); };
const api = async (method, route, body, ch = CH) => {
  const r = await realFetch(`${origin}/api/${route}${route.includes("?") ? "&" : "?"}channel=${ch}`, { method, headers: { origin, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw Error(`${method} ${route}: ${j?.error ?? r.status}`);
  return j;
};
const state = () => api("GET", `episodes/${EP}/scene-production`);
const until = async (label, fn, ms = 900_000, every = 1000) => {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() > end) throw Error(`${label}: timed out`);
    await new Promise((r) => setTimeout(r, every));
  }
};

let browser;
let failShot = async () => {};
try {
  // ── the episode and its script (the routes the «حلقة جديدة» dialog and the script editor use) ──
  const fx = (f) => readFile(path.join(fixtures, f), "utf8");
  const title = (await fx("script.md")).match(/^title: "(.*)"$/m)[1];
  const domain = (await fx("script.md")).match(/^domain: (\S+)$/m)[1];
  await api("POST", "episodes", { episode: EP, slug: SLUG, domain, title });
  await api("PUT", `episodes/${EP}/script`, { text: await fx("script.md") });
  await api("PUT", `episodes/${EP}/research`, { text: await fx("research.md") });

  browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  failShot = async () => { if (shots) { await mkdir(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, "failure.png") }).catch(() => {}); } };
  const snap = async (name) => { if (shots) { await mkdir(shots, { recursive: true }); await page.screenshot({ path: path.join(shots, `${name}.png`) }); } };
  const go = async (step) => { await page.goto(`${origin}/?link#/${CH}/${EP}/${step}`); await page.waitForLoadState("networkidle").catch(() => {}); };
  const click = async (name, opts = {}) => { const b = page.getByRole("button", { name, exact: opts.exact ?? false }).first(); await b.waitFor({ state: "visible", timeout: opts.timeout ?? 60_000 }); await b.click(); };
  const tick = async (label) => { const c = page.getByLabel(label).first(); await c.waitFor({ state: "visible", timeout: 60_000 }); await c.check(); };

  if (!DOCK_ONLY) {
  // ── ١ «النص المشكول» (D132): no file yet → «أنشئ النسخة المشكولة من السكريبت», then the fixture's vowelled copy typed and saved ──
  const tkFile = path.join(chDir, "episodes", `${EP}-${SLUG}`, "tashkeel.md");
  await go("tashkeel");
  await click("أنشئ النسخة المشكولة من السكريبت");
  const editor = page.locator("#tashkeel-editor");
  await editor.waitFor({ state: "visible", timeout: 60_000 });
  ok((await readFile(tkFile, "utf8")) === await fx("script.md"), "١ «أنشئ النسخة المشكولة من السكريبت» copies the script as a starting point");
  await editor.fill(await fx("tashkeel.md"));
  await click("حفظ", { exact: true });
  await until("tashkeel saved", async () => (await readFile(tkFile, "utf8")) === await fx("tashkeel.md"), 30_000, 300);
  await page.getByRole("status").filter({ hasText: "حُفظت النسخة المشكولة" }).first().waitFor({ timeout: 30_000 });
  ok(await page.getByText(/التشكيل [٠-٩]+٪/).first().isVisible(), "١ the «النص المشكول» tab shows its coverage badge after saving from the page");
  await snap("1-tashkeel");

  // ── ١ التجهيز: the episode tone (no default, D104), «راجعته بنفسي», «اعتمد التجهيز» ──
  const plan = (await api("GET", `episodes/${EP}`)).plan;
  const { browserPlanRevision } = await import("../../../src/plan/revision.ts");
  // The episode tone and the closing card's length (4 s, as in tests/e2e/journey.test.ts), as the scene editor saves them.
  const shaped = { ...plan, tone: "documentary", chapters: plan.chapters.map((ch) => ({ ...ch, scenes: ch.scenes.map((x) => x.id === "c1-end" ? { ...x, durationSec: 4, edited: true } : x) })) };
  await api("PUT", `episodes/${EP}/plan`, { plan: shaped, expectedRevision: await browserPlanRevision(plan) });
  await go("storyboard");
  await snap("1-preparation");
  await tick("راجعته بنفسي");
  await click("اعتمد التجهيز");
  const prepared = await until("preparation approved", async () => { const s = await state(); return s.script.approved && s.storyboard.approved ? s : null; }, 60_000);
  ok(Boolean(prepared), "١ «اعتمد التجهيز» from the page: script and storyboard approved");
  const total = prepared.scenes.length;
  // D151 (owner decision 15–16 Nov): the approval starts only the free drafts; not one voice request until the owner's
  // «ولّد الصوت الآن» and its confirmation, which say the count and the cost first.
  await until("free drafts", async () => (await api("GET", `episodes/${EP}/scene-prepare`)).job?.status === "done" || null, 600_000, 500);
  ok(voiceCalls.length === 0, "١ D151 «اعتمد التجهيز» sends no voice request (only the free drafts start)");
  await go("episode");
  await page.getByText(/جاهز لتوليد صوت .+ في .+ — نحو .+ من الرصيد/).first().waitFor({ timeout: 120_000 });
  await click("ولّد الصوت الآن");
  await page.getByText(/سيُصرف نحو .+ من رصيد الصوت/).first().waitFor({ timeout: 30_000 });
  ok(voiceCalls.length === 0, "٢ D151 the first press only asks for confirmation, naming the cost");
  await snap("2-voice-confirm");
  await click("نعم، ولّد الصوت");
  await until("voice generated", async () => voiceCalls.length > 0 || null, 120_000, 300);
  const drafts = await until("drafts", async () => { const s = await state(); return s.prepared.ready === s.prepared.total ? s : null; });
  ok(drafts.prepared.ready === total, `the scene drafts prepared after the confirmed voice (${drafts.prepared.ready}/${total})`);

  // ── ٢ المشاهد: «اعتمد المشهد» → «شاهدته بالصوت كاملًا» → «اعتمد المشهد», from the LAST scene back (D145: any order) ──
  await go("episode");
  const kiScene = plan.chapters.flatMap((c) => c.scenes).find((x) => x.narration.includes("المَصَادِرُ"))?.id;
  ok(Boolean(kiScene), "٢ KI the fixture has the scene the word-pronunciation block runs on");
  for (let i = 0; i < total; i++) {
    const before = await state();
    // The first one taken is the last NARRATED scene (scene 3, before 1 and 2: its sentences carry the tone step below).
    const open = before.progress.unapprovedScenes ?? [before.progress.currentScene];
    const id = i === 0 ? open.filter((x) => x !== "c1-end").at(-1) : open.at(-1);
    // The scene by its own address (D102: #/<channel>/<episode>/episode/<scene>), as after a reload on it.
    await go(`episode/${id}`);
    if (i === 0) {
      // ── ٢ D136: the sentence's tone on eleven_v4: «ولّد الجملة» sends the tone's direction; a new tone → «النبرة تغيّرت»
      // (nothing sent) → «ولّد الجملة» → «قارن: القديم / الجديد»; «ولّد» again with nothing changed asks first;
      // «استعمل هذا التسجيل» puts the old take back with no request; then «أنتج هذا المشهد» with the chosen take ──
      const n0 = voiceCalls.length;
      const toneSel = () => page.locator("select.sv-tone").first();
      await toneSel().waitFor({ state: "visible", timeout: 180_000 });
      await toneSel().selectOption("dramatic");
      await page.waitForTimeout(800);
      await click("ولّد الجملة");
      await until("first tone take", async () => voiceCalls.length > n0 || null, 60_000, 300);
      ok(/^\[dramatic, intense narration\] /.test(voiceCalls.at(-1).text), "٢ D136 «ولّد الجملة» sends the tone's performance direction on eleven_v4");
      await page.getByText(/التسجيل الحالي بنبرة «درامي»/).first().waitFor({ timeout: 60_000 });
      await toneSel().selectOption("calm");
      await page.getByText("النبرة تغيّرت — اضغط ولّد لتسمع الجديد").first().waitFor({ timeout: 60_000 });
      ok(voiceCalls.length === n0 + 1, "٢ D136 a new sentence tone shows «النبرة تغيّرت — اضغط ولّد لتسمع الجديد» and sends nothing");
      await click("ولّد الجملة");
      await until("second tone take", async () => voiceCalls.length > n0 + 1 || null, 60_000, 300);
      ok(/^\[calm, reflective narration\] /.test(voiceCalls.at(-1).text), "٢ D136 the new tone's direction is sent");
      const cmp = page.getByRole("group", { name: "قارن: القديم / الجديد" }).first();
      await cmp.waitFor({ state: "visible", timeout: 60_000 });
      ok(await cmp.getByText(/▶ القديم \(«درامي»\)/).isVisible() && await cmp.getByText(/▶ الجديد \(«هادئ تأملي»\)/).isVisible(), "٢ D136 «قارن: القديم / الجديد» after the new take");
      await snap("2-tone-compare");
      let asked = "";
      page.once("dialog", (d) => { asked = d.message(); void d.dismiss(); });
      await click("ولّد الجملة");
      await until("same-send asked", async () => asked || null, 30_000, 200);
      await page.waitForTimeout(800);
      ok(asked.includes("لم يتغير شيء يُرسل — سيخرج تسجيل مشابه") && voiceCalls.length === n0 + 2, "٢ D136 «ولّد» with nothing changed asks «لم يتغير شيء يُرسل» first, and sends nothing when refused");
      await cmp.getByRole("button", { name: "استعمل هذا التسجيل" }).first().click();
      await page.getByText("المستعمل الآن").first().waitFor({ timeout: 60_000 });
      ok(voiceCalls.length === n0 + 2, "٢ D136 «استعمل هذا التسجيل» puts the old take back as the one used, with no request");
      await go(`episode/${id}`);
      const produce = page.getByRole("button", { name: "أنتج هذا المشهد" }).first();
      if (await produce.isVisible().catch(() => false)) await produce.click();
    }
    // D145: scenes are approved from the last one back, so the block runs on the scene that says «المَصَادِرُ», wherever it falls
    if (kiScene && id === kiScene) {
      // ── ٢ KI (15 Nov, «بحاول اغير النطق ولكن يعيده الي القديم»): a word's new pronunciation typed in its popover stays
      // while an update arrives (the auto-sync never reloads over an edit in progress); «ولّد الجملة كاملة بهذا النطق»
      // sends it; after a reload the field opens on it; «ارجع للنطق الأصلي» removes it with no request ──
      let updateAt = "2026-11-15T00:00:00.000Z";
      await page.route("**/api/sync*", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({
        enabled: true, state: "synced", message: "", pending: [], skipped: [], conflicts: 0, lastUpdateAt: updateAt, supervised: false }) }));
      await page.reload();
      await page.waitForLoadState("networkidle").catch(() => {});
      const chip = () => page.locator("button.sv-word", { hasText: "المَصَادِرُ" }).first();
      await chip().waitFor({ state: "visible", timeout: 180_000 });
      await chip().click();
      const whyGo = page.getByRole("button", { name: "ولّد هذه الجملة ثم صحّح الكلمة" }).first();
      if (await whyGo.isVisible({ timeout: 5_000 }).catch(() => false)) await whyGo.click();
      const field = page.locator(".sv-fix-say input >> visible=true").first();
      await field.waitFor({ state: "visible", timeout: 120_000 });
      await field.fill("المَصَادِرِ");
      await page.evaluate(() => { window.__kiNoReload = 1; });
      // the owner looks away from the field (focus off any input), and an update arrives meanwhile
      await page.locator(".sv-fix .sv-fix-word").first().click();
      updateAt = "2026-11-15T00:05:00.000Z";
      await page.waitForTimeout(16_000);
      ok(await page.evaluate(() => window.__kiNoReload === 1) && (await field.inputValue()) === "المَصَادِرِ",
        "٢ KI an update arriving while a word's pronunciation is typed does not reload the page nor revert the field");
      const n1 = voiceCalls.length;
      await click("ولّد الجملة كاملة بهذا النطق");
      await until("word pronunciation generated", async () => voiceCalls.length > n1 || null, 60_000, 300);
      ok(voiceCalls.at(-1).text.includes("المَصَادِرِ"), "٢ KI «ولّد الجملة كاملة بهذا النطق» sends the new pronunciation");
      // the edit is over: the update that waited reloads the page now
      await until("reload after the edit", async () => (await page.evaluate(() => window.__kiNoReload !== 1)) || null, 30_000, 500);
      ok(true, "٢ KI the waiting update reloads the page once the edit is saved");
      await page.waitForLoadState("networkidle").catch(() => {});
      const rowNow = async () => (await api("GET", `episodes/${EP}/sentences`)).scenes.flatMap((x) => x.rows).find((x) => x.text.includes("المَصَادِرُ"));
      const saved = await rowNow();
      console.log(`[e2e-ui] KI row after reload: wordFix=${JSON.stringify(saved?.wordFix)} word=${JSON.stringify(saved?.words?.[1])}`);
      ok(saved?.words?.[1]?.correction === "المَصَادِرِ" && saved.spoken.includes("المَصَادِرِ"), "٢ KI after a reload the server still has the new pronunciation and sends it");
      await chip().waitFor({ state: "visible", timeout: 180_000 });
      await chip().click();
      const n2 = voiceCalls.length;
      const unfix = () => page.getByRole("button", { name: /ارجع للنطق الأصلي/ }).first();
      if (saved?.wordFix?.ok) {
        await page.locator(".sv-fix-say input").first().waitFor({ state: "attached", timeout: 60_000 });
        const pops = await page.locator(".sv-fix").evaluateAll((els) => els.map((e) => `${e.className} style=${e.getAttribute("style")}`));
        console.log(`[e2e-ui] KI popovers after reload: ${JSON.stringify(pops)}`);
        await field.waitFor({ state: "visible", timeout: 60_000 });
        ok((await field.inputValue()) === "المَصَادِرِ" && await page.getByText(/النطق المستعمل حتى الآن «المَصَادِرِ» — من: تصحيحك/).first().isVisible(),
          "٢ KI after a reload the field opens on the saved pronunciation, and says which source wins");
        await unfix().click();
        await until("correction removed", async () => (await field.inputValue().catch(() => "")) === "المَصَادِرُ" || null, 30_000, 300);
      } else {
        // the take cannot be cut now (the «why» popover): the correction is still named and removable there
        await unfix().waitFor({ state: "visible", timeout: 60_000 });
        ok(true, `٢ KI after a reload the «why» popover names the saved correction (${saved?.wordFix?.reason ?? ""})`);
        await unfix().click();
      }
      await until("correction gone", async () => (await rowNow())?.words?.[1]?.correction === null || null, 30_000, 300);
      ok(voiceCalls.length === n2 && !(await unfix().isVisible().catch(() => false)),
        "٢ KI «ارجع للنطق الأصلي» removes the correction with no request");
      await snap("2-word-pronunciation");
      await page.keyboard.press("Escape");
      await page.unroute("**/api/sync*");
      await go(`episode/${id}`);
      const produce = page.getByRole("button", { name: "أنتج هذا المشهد" }).first();
      if (await produce.isVisible().catch(() => false)) await produce.click();
    }
    await click("اعتمد المشهد", { timeout: 180_000 });
    const watched = page.getByLabel(/شاهدته (بالصوت )?كاملًا/).first();
    await watched.waitFor({ state: "visible", timeout: 60_000 });
    await watched.check();
    await click("اعتمد المشهد");
    const after = await until(`scene ${id} approved`, async () => { const s = await state(); return s.scenes.find((x) => x.id === id)?.approved ? s : null; }, 60_000);
    ok(Boolean(after), `٢ scene ${id} approved from the page`);
    await snap(`2-scene-${i + 1}`);
  }

  // ── ٣ النسخة النهائية: assemble, every seam, 1×, «اعتماد التجميع»; the Master; «اعتماد النسخة النهائية» ──
  await go("review");
  await snap("3-final");
  const assembleBtn = page.getByRole("button", { name: /دمج المشاهد/ }).first();
  await assembleBtn.waitFor({ state: "visible", timeout: 60_000 });
  await assembleBtn.click();
  const assembled = await until("assembled", async () => { const s = await state(); return s.assembly ? s : null; }, 300_000);
  ok(Boolean(assembled.assembly), "٣ the approved scenes assembled from the page");
  await page.reload();
  await page.waitForLoadState("networkidle").catch(() => {});
  await snap("3-seams");
  // One seam on screen at a time: «سمعتها» (kept on the server per assembly), then «الوصلة التالية».
  for (let k = 0; k < assembled.seams.length; k++) {
    await page.getByLabel("سمعتها").first().click();
    await until(`seam ${k + 1} heard`, async () => Object.keys((await api("GET", `episodes/${EP}/seam-checks`)).heard ?? {}).length >= k + 1 || null, 30_000, 500);
    if (k < assembled.seams.length - 1) await page.getByRole("button", { name: "الوصلة التالية" }).click();
  }
  ok(true, `٣ every seam heard from the page (${assembled.seams.length})`);
  await tick(/شاهدت الحلقة كاملة/);
  await click(/اعتمد الوصلات|اعتماد التجميع/);
  const asmOk = await until("assembly approved", async () => { const s = await state(); return s.progress.assemblyApproved ? s : null; }, 60_000);
  ok(Boolean(asmOk), "٣ «اعتماد التجميع» after 1× and every seam");
  await page.reload();
  await page.waitForLoadState("networkidle").catch(() => {});
  await click("اصنع النسخة النهائية");
  const made = await until("Master made", async () => { const s = await state(); return s.candidates.masterSha256 ? s : null; }, 1_200_000, 2000);
  ok(Boolean(made.candidates.masterSha256), "٣ the Master made from the page (tiny real render)");
  await page.reload();
  await page.waitForLoadState("networkidle").catch(() => {});
  await tick("شاهدتها كاملة 1×");
  await click("اعتماد النسخة النهائية");
  const masterOk = await until("Master approved", async () => { const s = await state(); return s.progress.masterApproved ? s : null; }, 60_000);
  ok(Boolean(masterOk), "٣ «اعتماد النسخة النهائية» for these exact bytes");

  // ── ٤ النشر: «أوافق على نشر هذا الملف», «إذن النشر», then the Drive copy ──
  await go("publish");
  await snap("4-publish");
  await tick("أوافق على نشر هذا الملف");
  await click("إذن النشر", { exact: true });
  const allowed = await until("publish allowed", async () => { const s = await state(); return s.progress.publishAllowed ? s : null; }, 60_000);
  ok(Boolean(allowed), "٤ «إذن النشر» from the page");
  const folder = path.join(drive, "balislam-publish", CH, `${EP}-${SLUG}`);
  const manifest = await until("Drive copy", async () => existsSync(path.join(folder, "manifest.json")) ? JSON.parse(await readFile(path.join(folder, "manifest.json"), "utf8")) : null, 300_000);
  ok(manifest.approvals.master.sha256 === masterOk.master.sha256, "٤ the approved Master on Drive with its manifest");
  await snap("4-drive");
  }

  // ── D150: the step ٢ dock and the sentence panel, the same in the three channels (episode 002 of each) ──
  const parity = await import("../../../src/studio/channelParity.ts");
  const { browserPlanRevision: planRevision } = await import("../../../src/plan/revision.ts");
  const dockOf = async () => {
    const bar = page.locator(".s3-actbar").first();
    await bar.waitFor({ state: "visible", timeout: 180_000 });
    return bar.evaluate((el) => ({
      buttons: [...el.querySelectorAll("button")].map((b) => (b.querySelector(".lbl")?.textContent ?? b.textContent ?? "").replace(/⏎/g, "").trim()),
      enter: Boolean(el.querySelector("button.s3-approve kbd")),
      absent: el.querySelector(".s3-absent")?.textContent?.trim() ?? null,
    }));
  };
  // The sentence controls every narration sentence has, whatever its take (pause depends on a next sentence; «ولّد» on the take).
  const sentenceControls = () => page.evaluate(() => {
    const p = document.querySelector(".sv-para");
    if (!p) return null;
    const has = (sel) => Boolean(p.querySelector(sel));
    const btn = (t) => [...p.querySelectorAll("button")].some((b) => b.textContent?.trim() === t);
    return { tone: has('select.sv-tone'), say: has('textarea[aria-label^="نطق الجملة"]'), more: has('summary[aria-label="المزيد"]'),
      edit: btn("عدّل النص"), play: has('button[aria-label^="شغّل الجملة"], button[title^="شغّل الجملة"]') };
  });
  const docks = {};
  for (const ch of DOCK_CHANNELS) {
    const fxd = (f) => readFile(path.join(repo, "tests", "fixtures", "e2e", ch, f), "utf8");
    const s2 = await fxd("script.md");
    await api("POST", "episodes", { episode: EP2, slug: "e2e-ui-dock", domain: s2.match(/^domain: (\S+)$/m)[1], title: s2.match(/^title: "(.*)"$/m)[1] }, ch);
    await api("PUT", `episodes/${EP2}/script`, { text: s2 }, ch);
    await api("PUT", `episodes/${EP2}/research`, { text: await fxd("research.md") }, ch);
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path.join(root, ch, "episodes", `${EP2}-e2e-ui-dock`, "tashkeel.md"), await fxd("tashkeel.md"));
    const p2 = (await api("GET", `episodes/${EP2}`, undefined, ch)).plan;
    const tone = { balislam: "calm", "dafatir-alzaman": "documentary", "zubdat-alkutub": "warm" }[ch] ?? "calm";
    await api("PUT", `episodes/${EP2}/plan`, { plan: { ...p2, tone, chapters: p2.chapters.map((c) => ({ ...c, scenes: c.scenes.map((x) => x.id === "c1-end" ? { ...x, durationSec: 4, edited: true } : x) })) },
      expectedRevision: await planRevision(p2) }, ch);
    const st2 = await api("GET", `episodes/${EP2}/scene-production`, undefined, ch);
    await api("POST", `episodes/${EP2}/approve-preparation`, { reviewed: true, scriptSha256: st2.script.sha256, storyboardSha256: st2.storyboard.sha256, note: "e2e dock parity" }, ch);
    // D151: the voice only on the owner's confirmed «ولّد الصوت الآن» (fake provider), after the free drafts.
    await until(`${ch} free drafts`, async () => (await api("GET", `episodes/${EP2}/scene-prepare`, undefined, ch)).job?.status === "done" || null, 600_000, 500);
    const vp = (await api("GET", `episodes/${EP2}/scene-prepare`, undefined, ch)).voicePlan;
    if (vp?.scenes?.length) await api("POST", `episodes/${EP2}/scene-prepare`, { voice: { confirm: true, fingerprint: vp.fingerprint } }, ch);
    await until(`${ch} drafts`, async () => { const s = await api("GET", `episodes/${EP2}/scene-production`, undefined, ch); return s.prepared.ready === s.prepared.total || null; });
    const cfg = JSON.parse(await readFile(path.join(repo, "channels", ch, "channel.json"), "utf8"));
    const planScenes = p2.chapters.flatMap((c) => c.scenes);
    await page.goto(`${origin}/?link#/${ch}/${EP2}/episode/c1-s1`); await page.waitForLoadState("networkidle").catch(() => {});
    const first = await dockOf();
    const sentences = await sentenceControls();
    await snap(`dock-${ch}-1`);
    await click("اعتمد المشهد", { timeout: 180_000 });
    const w = page.getByLabel(/شاهدته (بالصوت )?كاملًا/).first(); await w.waitFor({ state: "visible", timeout: 60_000 }); await w.check();
    await click("اعتمد المشهد");
    await until(`${ch} c1-s1 approved`, async () => (await api("GET", `episodes/${EP2}/scene-production`, undefined, ch)).scenes.find((x) => x.id === "c1-s1")?.approved || null, 60_000);
    await page.goto(`${origin}/?link#/${ch}/${EP2}/episode/c1-s2`); await page.waitForLoadState("networkidle").catch(() => {});
    const second = await dockOf();
    await snap(`dock-${ch}-2`);
    const s2scene = planScenes.find((x) => x.id === "c1-s2");
    docks[ch] = { first, second, sentences };
    const want = parity.DOCK_CONTROLS.filter((x) => x.id !== "render").map((x) => x.label);
    ok(JSON.stringify(first.buttons) === JSON.stringify(want) && first.enter, `D150 ${ch}: the dock of a narration scene is «${want.join(" | ")}» with ⏎ (${first.buttons.join(" | ")})`);
    const absent = parity.dockVoiceAbsent(cfg, s2scene);
    ok(absent ? second.absent === absent && second.buttons.length === 3 : JSON.stringify(second.buttons) === JSON.stringify(want),
      `D150 ${ch}: scene 2 (${s2scene.template}) dock ${absent ? `says «${absent}» in the voice slot` : "is the full dock"} (${second.buttons.join(" | ")}${second.absent ? ` / ${second.absent}` : ""})`);
  }
  if (DOCK_CHANNELS.length > 1) {
    const sig = (d) => JSON.stringify(d.first);
    ok(new Set(DOCK_CHANNELS.map((c) => sig(docks[c]))).size === 1, `D150: one dock in ${DOCK_CHANNELS.join(", ")}`);
    ok(new Set(DOCK_CHANNELS.map((c) => JSON.stringify(docks[c].sentences))).size === 1,
      `D150: the same sentence controls under scene 1 in ${DOCK_CHANNELS.join(", ")} (${DOCK_CHANNELS.map((c) => `${c}: ${JSON.stringify(docks[c].sentences)}`).join(" ; ")})`);
    ok(Object.values(docks[DOCK_CHANNELS[0]].sentences ?? {}).every(Boolean), `D150: tone, «النطق», «⋯», «عدّل النص» and play under the sentence (${JSON.stringify(docks[DOCK_CHANNELS[0]].sentences)})`);
  }

  ok(errors.length === 0, `no page error (${errors.join(" | ").slice(0, 300)})`);
  ok(outgoing.length === 0, `no request left this machine (${outgoing.join(", ")})`);
} catch (e) {
  await failShot();
  ok(false, `journey stopped: ${e.message}`);
} finally {
  await browser?.close().catch(() => {});
  await vite.close().catch(() => {});
  if (!process.env.BAL_E2E_KEEP) {
    await rm(root, { recursive: true, force: true });
    await rm(drive, { recursive: true, force: true });
  } else console.log(`kept ${root} ${drive}`);
}
console.log(fails.length ? `\n${fails.length} failed` : "\nall passed");
process.exit(fails.length ? 1 : 0);
