/**
 * Scroll QA (D64): on every main Studio screen, the mouse wheel and the keyboard (PageDown, Space with the
 * focus on no control) must scroll the page, and the bottom of the page must be reachable. Not part of vitest:
 * it drives a real browser against a running Studio.
 *
 * Usage (against a Studio started on a COPY of channels/, never the live one):
 *   BAL_CHANNELS_DIR=/tmp/copy/channels npx vite --config app/vite.config.ts --port 4391 --strictPort &
 *   node app/scripts/scroll-qa.mjs --origin http://127.0.0.1:4391 [--sizes 1440x900,1280x800,1024x768]
 *     [--channels balislam,dafatir-alzaman,zubdat-alkutub] [--themes light,dark] [--shots <dir>] [--routes s1-board,…] [--unlock]
 *
 * Playwright is resolved from the project, or from PLAYWRIGHT_MODULE (a directory that has node_modules/playwright).
 * Exit code 1 when any screen fails. Read-only: it only navigates, scrolls and presses keys.
 */
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : def; };
const origin = arg("origin", "http://127.0.0.1:4321");
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) throw Error("Local Studio origins only.");
const sizes = arg("sizes", "1440x900,1280x800,1024x768").split(",").map((s) => s.split("x").map(Number));
const channels = arg("channels", "balislam,dafatir-alzaman,zubdat-alkutub").split(",");
const themes = arg("themes", "light").split(",");
const episode = arg("episode", "001");
const shots = arg("shots", "");
const only = arg("routes", "");
// --unlock: the browser sees step ١ as approved (a GET answer rewritten in the page, nothing written to the server),
// so steps ٢–٣ show their real screens on a copy whose episodes are still in preparation.
const unlock = process.argv.includes("--unlock");

const load = () => {
  const bases = [process.cwd() + "/", process.env.PLAYWRIGHT_MODULE ? process.env.PLAYWRIGHT_MODULE.replace(/\/?$/, "/") : "", "/opt/npm-tools/"].filter(Boolean);
  for (const b of bases) { try { return createRequire(b)("playwright"); } catch { /* next */ } }
  throw Error("Playwright not found (set PLAYWRIGHT_MODULE).");
};
const { chromium } = load();

/** Every main screen. `open` runs after load (a button to press for screens without their own link). */
const SCREENS = [
  { id: "episodes", hash: (c) => `#/${c}` },
  { id: "s1-board", hash: (c) => `#/${c}/${episode}/storyboard` },
  { id: "s1-script", hash: (c) => `#/${c}/${episode}/script` },
  { id: "s1-research", hash: (c) => `#/${c}/${episode}/research` },
  { id: "s2-scenes", hash: (c) => `#/${c}/${episode}/episode` },
  { id: "s2-tools", hash: (c) => `#/${c}/${episode}/episode`, open: async (p) => {
    await p.evaluate(() => { for (const d of document.querySelectorAll(".studio-main details")) if (/أدوات وتفاصيل/.test(d.querySelector("summary")?.textContent || "")) d.open = true; });
    await p.getByRole("button", { name: "اعرض جمل الحلقة كلها" }).click({ timeout: 3000 }).catch(() => {}); // the sentences of the whole episode
    await p.waitForTimeout(1500);
  } },
  { id: "s2-editor", hash: (c) => `#/${c}/${episode}/episode`, open: async (p) => {
    await p.locator(".s3-edit").first().click({ timeout: 3000 }).catch(() => {}); // «تحرير المشهد»
    await p.waitForTimeout(1200);
  } },
  { id: "s2-voice", hash: (c) => `#/${c}/${episode}/voice` },
  { id: "s3", hash: (c) => `#/${c}/${episode}/review` },
  { id: "s4", hash: (c) => `#/${c}/${episode}/publish` },
  ...["ops", "channels", "identity", "library", "channel", "settings", "guide", "labs", "treviews"].map((t) => ({ id: `admin-${t}`, hash: (c) => `#/${c}/${t}` })),
].filter((s) => !only || only.split(",").includes(s.id));

const measure = (p) => p.evaluate(() => {
  const se = document.scrollingElement;
  const scrollers = [];
  for (const el of document.querySelectorAll("body *")) {
    const s = getComputedStyle(el);
    if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 4 && el.clientHeight > 0) scrollers.push(el);
  }
  const top = () => se.scrollTop + scrollers.reduce((n, e) => n + e.scrollTop, 0);
  const html = getComputedStyle(document.documentElement), body = getComputedStyle(document.body);
  return { top: top(), docMax: se.scrollHeight - se.clientHeight, scrollers: scrollers.length,
    locked: document.documentElement.classList.contains("is-modal-open"),
    rootOverflow: `${html.overflowY}/${body.overflowY}` };
});

/** After scrolling the page and every inner scroller to its end: does any visible content stay below the fold? */
const hiddenBelow = (p) => p.evaluate(() => {
  const se = document.scrollingElement; se.scrollTop = se.scrollHeight;
  for (const el of document.querySelectorAll("body *")) if (/(auto|scroll)/.test(getComputedStyle(el).overflowY)) el.scrollTop = el.scrollHeight;
  const vh = innerHeight; let worst = 0, who = "";
  for (const el of document.querySelectorAll(".studio-main *")) {
    const r = el.getBoundingClientRect(); if (!r.height || !r.width) continue;
    const shut = el.closest("details:not([open])"); if (shut && !el.closest("summary")) continue; // folded away, not cut
    let bottom = r.bottom, a = el.parentElement, fixed = false;
    while (a && a !== document.body) {
      const s = getComputedStyle(a);
      if (s.position === "fixed" || s.position === "sticky") { fixed = true; break; }
      if (s.overflowY !== "visible") bottom = Math.min(bottom, a.getBoundingClientRect().bottom);
      a = a.parentElement;
    }
    if (fixed || getComputedStyle(el).position === "fixed") continue;
    if (bottom - vh > worst) { worst = bottom - vh; who = `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`; }
  }
  // A layout-sized box that hides overflowing content (overflow hidden/clip) cuts the screen: nothing can reach it.
  let cut = "";
  for (const el of document.querySelectorAll("body, .shell-v3, .shell-v3 *")) {
    const s = getComputedStyle(el);
    if (!/(hidden|clip)/.test(s.overflowY) || el.clientHeight < 200 || s.position === "fixed") continue;
    if (el.closest(".__remotion-player")) continue; // a video composition's own frame, not the page
    if (el.scrollHeight > el.clientHeight + 40) { cut = `${el.tagName.toLowerCase()}.${String(el.className).split(" ").join(".")} hides ${el.scrollHeight - el.clientHeight}px`; break; }
  }
  return { below: Math.round(worst), who, cut };
});

const browser = await chromium.launch();
const failures = [];
let checked = 0;
for (const theme of themes) for (const [w, h] of sizes) for (const ch of channels) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await ctx.addInitScript((t) => { try { localStorage.setItem("bal-theme", t); } catch { /* */ } }, theme);
  const p = await ctx.newPage();
  if (unlock) await p.route(/\/api\/episodes\/[^/]+\/scene-production(\?|$)/, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch(); const body = await res.json().catch(() => null);
    if (body?.script && body?.storyboard) { body.script.approved = true; body.storyboard.approved = true; if (body.boards) body.boards = { ...body.boards, current: true, changed: [] }; }
    await route.fulfill({ response: res, json: body });
  });
  for (const s of SCREENS) {
    await p.goto(`${origin}/${s.hash(ch)}`); await p.waitForLoadState("networkidle").catch(() => {});
    await p.waitForTimeout(900);
    if (s.open) { await s.open(p); await p.waitForTimeout(300); }
    await p.evaluate(() => { window.scrollTo(0, 0); (document.activeElement)?.blur?.(); });
    const a = await measure(p);
    const canScroll = a.docMax > 4 || a.scrollers > 0;
    // The wheel over the middle of the work area (not over a field), the way a trackpad does it.
    await p.mouse.move(Math.round(w * 0.45), Math.round(h * 0.55));
    await p.mouse.wheel(0, 400); await p.waitForTimeout(350);
    const b = await measure(p);
    // The filmstrip (fixed, step ٢) must hand a vertical wheel to the page, never swallow it.
    const reel = await p.evaluate(() => { const r = document.querySelector(".s3-reel:not(.is-folded) .s3-strip")?.getBoundingClientRect(); return r && r.height ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; });
    let reelOk = true;
    if (reel && a.docMax > 4) {
      await p.evaluate(() => window.scrollTo(0, 0)); await p.mouse.move(reel.x, reel.y); await p.mouse.wheel(0, 300); await p.waitForTimeout(300);
      reelOk = (await p.evaluate(() => document.scrollingElement.scrollTop)) > 0;
    }
    await p.evaluate(() => { window.scrollTo(0, 0); (document.activeElement)?.blur?.(); });
    await p.keyboard.press("PageDown"); await p.waitForTimeout(350);
    const c = await measure(p);
    await p.evaluate(() => { window.scrollTo(0, 0); (document.activeElement)?.blur?.(); });
    await p.keyboard.press("Space"); await p.waitForTimeout(350);
    const d = await measure(p);
    if (shots) { await mkdir(shots, { recursive: true }); await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: path.join(shots, `${ch}-${s.id}-${w}-${theme}.jpg`), type: "jpeg", quality: 45 }); }
    const hb = await hiddenBelow(p);
    const row = { screen: s.id, ch, size: `${w}x${h}`, theme, docMax: a.docMax, scrollers: a.scrollers,
      wheel: b.top > a.top, pageDown: c.top > 0, space: d.top > 0, below: hb.below, who: hb.who, root: a.rootOverflow, locked: a.locked };
    const bad = [];
    if (a.locked) bad.push("scroll lock left on");
    if (!reelOk) bad.push("filmstrip swallows the vertical wheel");
    if (canScroll && !row.wheel) bad.push("wheel");
    if (a.docMax > 4 && !row.pageDown) bad.push("PageDown");
    if (a.docMax > 4 && !row.space) bad.push("Space");
    if (hb.below > 8) bad.push(`content below the fold ${hb.below}px (${hb.who})`);
    if (hb.cut) bad.push(`content cut: ${hb.cut}`);
    checked++;
    console.log(`${bad.length ? "FAIL" : "ok  "} ${row.size} ${theme} ${ch.padEnd(16)} ${s.id.padEnd(16)} doc=${a.docMax} inner=${a.scrollers} wheel=${row.wheel} pgdn=${row.pageDown} space=${row.space}${bad.length ? "  <- " + bad.join(", ") : ""}`);
    if (bad.length) failures.push({ ...row, bad });
  }
  // A modal locks the page while it is open and gives it back when it closes (Esc), every time.
  await p.goto(`${origin}/#/${ch}`); await p.waitForTimeout(900);
  const opener = p.getByRole("button", { name: /حلقة جديدة|ابدأ أول حلقة/ }).first();
  if (await opener.count()) {
    await opener.click(); await p.waitForTimeout(300);
    const on = await p.evaluate(() => document.documentElement.classList.contains("is-modal-open"));
    await p.keyboard.press("Escape"); await p.waitForTimeout(300);
    const off = await p.evaluate(() => !document.documentElement.classList.contains("is-modal-open"));
    checked++;
    const bad = [!on && "no lock while the dialog is open", !off && "lock left on after Esc"].filter(Boolean);
    console.log(`${bad.length ? "FAIL" : "ok  "} ${w}x${h} ${theme} ${ch.padEnd(16)} modal-lock       ${bad.join(", ")}`);
    if (bad.length) failures.push({ screen: "modal-lock", ch, bad });
  }
  await ctx.close();
}
await browser.close();
console.log(`\n${checked - failures.length}/${checked} screens scroll.`);
process.exit(failures.length ? 1 : 0);
