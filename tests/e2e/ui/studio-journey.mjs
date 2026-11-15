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
 *   npm run e2e:ui            (tsx tests/e2e/ui/studio-journey.mjs [--channel dafatir-alzaman] [--port 4451] [--shots <dir>])
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
await mkdir(path.join(chDir, "episodes"), { recursive: true });
for (const f of await readdir(path.join(repo, "channels", CH))) if (f.endsWith(".json")) await cp(path.join(repo, "channels", CH, f), path.join(chDir, f));
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
const api = async (method, route, body) => {
  const r = await realFetch(`${origin}/api/${route}${route.includes("?") ? "&" : "?"}channel=${CH}`, { method, headers: { origin, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
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
  const drafts = await until("drafts", async () => { const s = await state(); return s.prepared.ready === s.prepared.total ? s : null; });
  ok(drafts.prepared.ready === total, `the scene drafts prepared on their own (${drafts.prepared.ready}/${total})`);

  // ── ٢ المشاهد: «اعتمد المشهد» → «شاهدته بالصوت كاملًا» → «اعتمد المشهد», scene after scene ──
  await go("episode");
  for (let i = 0; i < total; i++) {
    const before = await state();
    const id = before.progress.currentScene;
    // The scene by its own address (D102: #/<channel>/<episode>/episode/<scene>), as after a reload on it.
    await go(`episode/${id}`);
    if (i === 0) {
      // ── ٢ D136: a new tone for the sentence → «النبرة تغيّرت» (nothing sent) → «ولّد الجملة» sends its direction →
      // «قارن: القديم / الجديد»; «ولّد» again with nothing changed asks first; «استعمل هذا التسجيل» puts the old take back ──
      const n0 = voiceCalls.length;
      const toneSel = page.locator("select.sv-tone").first();
      await toneSel.waitFor({ state: "visible", timeout: 180_000 });
      await toneSel.selectOption("dramatic");
      await page.getByText("النبرة تغيّرت — اضغط ولّد لتسمع الجديد").first().waitFor({ timeout: 60_000 });
      ok(voiceCalls.length === n0, "٢ D136 a new sentence tone shows «النبرة تغيّرت — اضغط ولّد لتسمع الجديد» and sends nothing");
      await click("ولّد الجملة");
      await until("tone take", async () => voiceCalls.length > n0 || null, 60_000, 300);
      ok(/^\[dramatic, intense narration\] /.test(voiceCalls.at(-1).text), "٢ D136 «ولّد الجملة» sends the tone's performance direction on eleven_v4");
      const cmp = page.getByRole("group", { name: "قارن: القديم / الجديد" }).first();
      await cmp.waitFor({ state: "visible", timeout: 60_000 });
      ok(await cmp.getByText(/▶ القديم/).isVisible() && await cmp.getByText(/▶ الجديد \(«درامي»\)/).isVisible(), "٢ D136 «قارن: القديم / الجديد» after the new take");
      await snap("2-tone-compare");
      let asked = "";
      page.once("dialog", (d) => { asked = d.message(); void d.dismiss(); });
      await click("ولّد الجملة");
      await until("same-send asked", async () => asked || null, 30_000, 200);
      await page.waitForTimeout(800);
      ok(asked.includes("لم يتغير شيء يُرسل — سيخرج تسجيل مشابه") && voiceCalls.length === n0 + 1, "٢ D136 «ولّد» with nothing changed asks «لم يتغير شيء يُرسل» first, and sends nothing when refused");
      await cmp.getByRole("button", { name: "استعمل هذا التسجيل" }).first().click();
      await page.getByText("المستعمل الآن").first().waitFor({ timeout: 60_000 });
      ok(voiceCalls.length === n0 + 1, "٢ D136 «استعمل هذا التسجيل» puts the old take back as the one used, with no request");
      await until("draft back", async () => { const s = await state(); return s.scenes.find((x) => x.id === id)?.draft === "ready" || null; }, 600_000, 2000);
      await go(`episode/${id}`);
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
