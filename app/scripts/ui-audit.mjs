/**
 * UI audit (D74): drives a real browser over every Studio screen, at the owner's real viewports, in light and dark,
 * on the three channels, and flags what made the owner's dock unreadable on his MacBook (11 Nov):
 *   - narrow-wrap: an element whose text wraps to ≥ 6 lines with < 8 characters per line (a one-word column);
 *   - cover: a fixed/sticky layer painting more than 30% of the viewport (dialogs, menus and sheets the case opens
 *     on purpose are exempt);
 *   - dock-height: the floating dock bar (`.ms-dock-in`) taller than 25% of the viewport, or pushed off screen;
 *   - overlap: two controls/headings of the same layer overlapping;
 *   - hscroll: the page scrolls horizontally;
 *   - clipped: text cut by `overflow: hidden` without an ellipsis (an ellipsis is a deliberate one-line cut);
 *   - contrast: text under WCAG AA (4.5:1, 3:1 for large text) against its painted background;
 *   - console: console errors and uncaught page errors (HTTP failures are listed, not failed).
 *   - broken: a build error overlay, or no studio shell at all.
 * Not part of vitest. Read-only: every non-GET API call is aborted; ledger states are faked in the browser
 * (the GET answers are rewritten in the page), so run it against a Studio started on a COPY of channels/:
 *
 *   BAL_CHANNELS_DIR=/tmp/copy/channels npx vite --config app/vite.config.ts --port 4395 --strictPort &
 *   node app/scripts/ui-audit.mjs --origin http://127.0.0.1:4395 [--sizes 1288x705,1440x900,1280x800,1024x768,390x844]
 *     [--themes light,dark] [--channels balislam,dafatir-alzaman,zubdat-alkutub] [--cases s1-,s2-scene] [--episode 001]
 *     [--shots <dir>] [--json <file>] [--probe "<js expression printed per screen>"]
 *
 * Playwright is resolved from the project, PLAYWRIGHT_MODULE, or /opt/node-tools. Exit code 1 when anything fails.
 */
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : def; };
const origin = arg("origin", "http://127.0.0.1:4321");
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) throw Error("Local Studio origins only.");
const sizes = arg("sizes", "1288x705,1440x900,1280x800,1024x768,390x844").split(",").map((s) => s.split("x").map(Number));
const themes = arg("themes", "light,dark").split(",");
const channels = arg("channels", "balislam,dafatir-alzaman,zubdat-alkutub").split(",");
const only = arg("cases", "");
const EP = arg("episode", "001");
const shots = arg("shots", "");
const jsonOut = arg("json", "");
/** --probe "<js expression>": evaluated on each screen after the checks and printed (for investigating a finding). */
const probe = arg("probe", "");

const load = () => {
  const bases = [process.cwd() + "/", process.env.PLAYWRIGHT_MODULE ? process.env.PLAYWRIGHT_MODULE.replace(/\/?$/, "/") : "", "/opt/node-tools/", "/opt/npm-tools/"].filter(Boolean);
  for (const b of bases) { try { return createRequire(b)("playwright"); } catch { /* next */ } }
  throw Error("Playwright not found (set PLAYWRIGHT_MODULE).");
};
const { chromium } = load();

/* ── Fake ledger states (GET answers rewritten in the browser; nothing is written) ── */
const approveAll = (j) => { j.scenes.forEach((s) => { s.approved = true; s.status = "approved"; }); j.progress.currentScene = null; j.progress.approvedScenes = j.scenes.length; };
const ledger = (state) => (j) => {
  if (!j || !j.script || state === "prep") return j;
  const ids = j.scenes.map((s) => s.id);
  if (state === "changed") {
    // 11 Nov: boards edited after «اعتمد التجهيز» — carried forward by the ledger; three scenes re-open in step ٢ (no re-approval)
    j.script.approved = true; j.storyboard.approved = true; j.boards = { current: true, changed: [] };
    const re = [ids[12] ?? ids[0], ids[14] ?? ids[1], ids[25] ?? ids[2]].filter(Boolean);
    const at = new Date().toISOString();
    j.afterPreparation = { at, script: false, scenes: re.map((id) => ({ id, what: ["board", "text"] })) };
    j.scenes.forEach((s) => { if (re.includes(s.id)) { s.approved = false; s.status = "needs_revision"; s.afterPreparation = { at, what: ["board", "text"], script: false }; } });
    return j;
  }
  j.script.approved = true; j.storyboard.approved = true; j.boards = { current: true, changed: [] };
  if (state === "scenes") {
    j.progress.currentScene = ids[0]; j.progress.approvedScenes = 0;
    j.scenes.forEach((s, i) => { s.approved = false; s.status = i === 0 ? "in_review" : "queued"; s.readyForAv = true; s.draft = i < 6 ? "ready" : "none"; if (!i) s.previewSha256 = "d".repeat(64); });
    if (ids[3]) { j.scenes[3].status = "needs_revision"; j.scenes[3].correction = { note: "[الحركة @0:04] العنصر يدخل قبل كلمته", at: new Date().toISOString(), inbox: { id: "n1", sync: "sent", status: "open", answer: null } }; }
  }
  if (state === "prefinal") {
    approveAll(j); j.progress.canAssemble = false;
    const v = j.scenes.filter((s) => s.verse || /verse|ayah|aya/.test(s.template || "")).map((s) => s.id);
    j.progress.recitationPending = v.length ? v : ids.slice(2, 4);
  }
  if (state === "seams" || state === "master") {
    approveAll(j); j.progress.canAssemble = true; j.progress.recitationPending = [];
    j.assembly = { sha256: "e".repeat(64), approved: state === "master" }; j.progress.assemblyApproved = state === "master";
    j.seams = ids.slice(0, -1).map((id, i) => `${id}>${ids[i + 1]}`);
    let t = 0; j.seamTimes = {}; j.seams.forEach((s, i) => { t += 6 + ((i * 7) % 11); j.seamTimes[s] = t; });
  }
  if (state === "publish") {
    approveAll(j); j.progress.canAssemble = true; j.progress.assemblyApproved = true; j.progress.masterApproved = true;
    j.assembly = { sha256: "e".repeat(64), approved: true }; j.master = { sha256: "f".repeat(64), approved: true, publishAllowed: false };
  }
  return j;
};
const preparation = (state) => (j) => {
  if (!j || state !== "changed") return j;
  return { ...j, scriptErrors: 0, versesMissing: [], boardsRecorded: true };
};
const sentences = (state) => (j) => {
  if (!j || !j.scenes || state !== "scenes") return j;
  const s = j.scenes.find((x) => !x.verse && x.rows?.length);
  if (!s) return j;
  s.managed = true; s.waiting = null;
  s.rows.forEach((r, i) => {
    if (i > 2) return;
    r.audio = { file: "x.wav", duration: 3.4 + i, origin: "tts" }; r.status = i === 0 ? "heard" : "generated";
    let t = 0.2; r.words = r.text.split(/\s+/).filter(Boolean).map((w) => { const o = { word: w, say: w, start: t, end: t + 0.4, quran: false }; t += 0.5; return o; });
    r.wordFix = { ok: true };
  });
  return j;
};
/** Citations: 16 with 5 unverified (3 verses), as on the owner's screen. */
const review = (j) => {
  const items = Array.from({ length: 16 }, (_, i) => ({ key: `k${i}`, kind: i < 5 ? "ayah" : "other", label: `استشهاد ${i + 1}`, ref: "", detail: "", line: i + 1, hash: String(i),
    status: i < 3 || i === 7 || i === 9 ? "pending" : "verified" }));
  return { ...(j || {}), items, summary: { total: 16, verified: 11, pending: 5, changed: 0, rejected: 0, ok: false } };
};

/* ── Screens ── */
const click = (sel, wait = 900) => async (p) => { const l = p.locator(sel).first(); if (await l.count()) { await l.scrollIntoViewIfNeeded().catch(() => {}); await l.click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(wait); } };
const pill = (name) => async (p) => { await p.locator(".ms-pill button", { hasText: name }).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(1300); };
const tab = (name) => async (p) => { await p.getByRole("tab", { name }).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(1000); };
const firstSeries = async (p, c) => p.evaluate(async (ch) => { try { const r = await fetch(`/api/series?channel=${encodeURIComponent(ch)}`); const j = await r.json(); return (j.series || []).find((s) => s.id !== "general")?.id || "general"; } catch { return "general"; } }, c);
/** [id, hash(channel), state, action?, exempt?] — `exempt` names layers the action opens on purpose. */
const CASES = [
  ["home", (c) => `#/${c}`, "scenes"],
  ["home-new", (c) => `#/${c}`, "scenes", async (p) => { await p.getByRole("button", { name: /حلقة جديدة|ابدأ أول حلقة/ }).first().click({ timeout: 3000 }).catch(() => {}); await p.waitForTimeout(600); }, true],
  ["series-general", (c) => `#/${c}/series/general`, "scenes"],
  ["series-first", (c) => `#/${c}/series/@first`, "scenes"],
  ["series-identity", (c) => `#/${c}/series/@first`, "scenes", tab("هوية السلسلة")],
  ["series-template", (c) => `#/${c}/series/@first`, "scenes", tab("قالب السلسلة")],
  ["s1-boards", (c) => `#/${c}/${EP}/storyboard`, "prep"],
  ["s1-script", (c) => `#/${c}/${EP}/script`, "prep"],
  ["s1-research", (c) => `#/${c}/${EP}/research`, "prep"],
  ["s1-changed", (c) => `#/${c}/${EP}/storyboard`, "changed"],
  ["s1-changed-details", (c) => `#/${c}/${EP}/storyboard`, "changed", click(".ms-dock .ms-more", 500)],
  ["s1-changed-chip", (c) => `#/${c}/${EP}/storyboard`, "changed", click(".ms-dock .ms-chip", 500)],
  ["s1-changed-script", (c) => `#/${c}/${EP}/script`, "changed"],
  ["s2-locked", (c) => `#/${c}/${EP}/episode`, "prep"],
  ["s3-locked", (c) => `#/${c}/${EP}/review`, "prep"],
  ["s4-locked", (c) => `#/${c}/${EP}/publish`, "prep"],
  ["s2-changed", (c) => `#/${c}/${EP}/episode`, "changed"],
  ["s2-scene", (c) => `#/${c}/${EP}/episode`, "scenes"],
  ["s2-film", (c) => `#/${c}/${EP}/episode`, "scenes", async (p) => { const f = p.locator(".s3-fold"); if (await f.count() && await f.isVisible() && (await f.getAttribute("aria-expanded")) === "false") { await f.click(); await p.waitForTimeout(900); } }],
  ["s2-word", (c) => `#/${c}/${EP}/episode`, "scenes", click(".sv-word >> nth=1", 700), true],
  ["s2-fix", (c) => `#/${c}/${EP}/episode`, "scenes", click(".s3-actbar .btn.ghost", 600)],
  ["s2-editor", (c) => `#/${c}/${EP}/episode`, "scenes", click(".s3-edit", 2200), true],
  ["s2-voice", (c) => `#/${c}/${EP}/voice`, "scenes"],
  ["s3-prefinal", (c) => `#/${c}/${EP}/review`, "prefinal"],
  ["s3-recit", (c) => `#/${c}/${EP}/review`, "prefinal", pill("التلاوات")],
  ["s3-seams", (c) => `#/${c}/${EP}/review`, "seams", pill("الوصلات")],
  ["s3-master", (c) => `#/${c}/${EP}/review`, "master", pill("النسخة الأساسية")],
  ["s4-publish", (c) => `#/${c}/${EP}/publish`, "publish"],
  ["gear", (c) => `#/${c}`, "scenes", click(".ms-gear", 500), true],
  ...["ops", "channels", "channel", "settings", "identity", "library", "labs", "guide", "treviews"].map((t) => [`adm-${t}`, (c) => `#/${c}/${t}`, "scenes"]),
].filter(([id]) => !only || only.split(",").some((f) => id.startsWith(f)));

/* ── The checks, in the page ── */
const audit = (exempt) => {
  const vw = innerWidth, vh = innerHeight;
  const cv = document.createElement("canvas"); cv.width = cv.height = 1; const cx = cv.getContext("2d", { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (t, b) => { const a = t[3]; return [t[0] * a + b[0] * (1 - a), t[1] * a + b[1] * (1 - a), t[2] * a + b[2] * (1 - a), 1]; };
  const bgOf = (el) => { const st = []; let img = false; for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage !== "none" && e !== document.body && e !== document.documentElement) img = true; const c = rgba(cs.backgroundColor); if (c[3] > 0) { st.push(c); if (c[3] >= 0.99) break; } } let o = [255, 255, 255, 1]; for (let i = st.length - 1; i >= 0; i--) o = blend(st[i], o); return { c: o, img }; };
  const vis = (e) => { const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false; if (e.checkVisibility && !e.checkVisibility({ contentVisibilityAuto: true })) return false; const cs = getComputedStyle(e); return cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.05; };
  const inView = (r) => r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
  const name = (e) => (e.tagName.toLowerCase() + (typeof e.className === "string" && e.className.trim() ? "." + e.className.trim().split(/\s+/).slice(0, 2).join(".") : "") + (e.getAttribute("aria-label") ? `[${e.getAttribute("aria-label").slice(0, 18)}]` : "") + (e.parentElement && typeof e.parentElement.className === "string" && e.parentElement.className ? "<" + e.parentElement.className.split(" ")[0] : "")).slice(0, 90);
  const skip = (e) => e.closest(".__remotion-player,video,svg,canvas,.ms-thumb,[aria-hidden='true'],.sr-only,.ms-vh");
  const out = { narrowWrap: [], cover: [], dockHeight: [], overlap: [], clipped: [], contrast: [] };
  const all = [...document.querySelectorAll("body *")];
  const seen = new Set();
  for (const e of all) {
    if (!vis(e) || skip(e)) continue;
    const texts = [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
    if (!texts.length) continue;
    const own = texts.map((n) => n.textContent.trim()).join(" ");
    const r = e.getBoundingClientRect();
    if (!inView(r)) continue;
    const cs = getComputedStyle(e);
    // narrow-wrap: count the rendered lines of its own text
    if (own.length >= 12) {
      const tops = new Set();
      for (const n of texts) { const rg = document.createRange(); rg.selectNodeContents(n); for (const q of rg.getClientRects()) if (q.width > 0) tops.add(Math.round(q.top / 3)); }
      const lines = tops.size, cpl = own.replace(/\s+/g, " ").length / Math.max(1, lines);
      if (lines >= 6 && cpl < 8) out.narrowWrap.push(`${name(e)} ${lines} lines × ${cpl.toFixed(1)} chars, ${Math.round(r.width)}px wide «${own.slice(0, 30)}»`);
    }
    // clipped without an ellipsis
    if (/(hidden|clip)/.test(cs.overflowX + cs.overflowY) && cs.textOverflow !== "ellipsis" && !cs.webkitLineClamp?.match(/\d/)) {
      if (e.scrollWidth > e.clientWidth + 2 && cs.whiteSpace !== "normal" && e.clientWidth > 2) out.clipped.push(`${name(e)} w ${e.scrollWidth}>${e.clientWidth} «${own.slice(0, 24)}»`);
      else if (e.scrollHeight > e.clientHeight + 3 && e.clientHeight > 2 && /(hidden|clip)/.test(cs.overflowY)) out.clipped.push(`${name(e)} h ${e.scrollHeight}>${e.clientHeight} «${own.slice(0, 24)}»`);
    }
    // contrast
    const fs = parseFloat(cs.fontSize);
    if (!e.closest("[disabled],[aria-disabled='true'],input,textarea,select")) {
      const fg = rgba(cs.color); const { c: bg, img } = bgOf(e);
      const op = [...function* () { for (let a = e; a; a = a.parentElement) yield +getComputedStyle(a).opacity; }()].reduce((x, y) => x * y, 1);
      const f2 = blend([fg[0], fg[1], fg[2], fg[3] * op], bg);
      const L1 = lum(f2), L2 = lum(bg), cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const large = fs >= 24 || (fs >= 18.66 && +cs.fontWeight >= 700);
      const k = `${name(e)}|${cr.toFixed(1)}`;
      if (cr < (large ? 3 : 4.5) && !img && !seen.has(k)) { seen.add(k); out.contrast.push(`${cr.toFixed(2)} ${name(e)} fg=${cs.color} bg=rgb(${bg.slice(0, 3).map(Math.round)}) «${own.slice(0, 24)}»`); }
    }
  }
  // fixed/sticky layers: the area they paint (a transparent wrapper counts its painted children)
  const painted = (e, depth = 0) => {
    const cs = getComputedStyle(e), r = e.getBoundingClientRect();
    const paints = rgba(cs.backgroundColor)[3] > 0.05 || cs.backgroundImage !== "none" || (cs.boxShadow !== "none" && depth > 0);
    if (paints || depth >= 3) return [r];
    return [...e.children].filter(vis).flatMap((c) => painted(c, depth + 1));
  };
  const area = (rs) => { // union area on a coarse grid
    const G = 8, cols = Math.ceil(vw / G), rows = Math.ceil(vh / G), g = new Uint8Array(cols * rows); let n = 0;
    for (const r of rs) for (let y = Math.max(0, Math.floor(r.top / G)); y < Math.min(rows, Math.ceil(r.bottom / G)); y++) for (let x = Math.max(0, Math.floor(r.left / G)); x < Math.min(cols, Math.ceil(r.right / G)); x++) if (!g[y * cols + x]) { g[y * cols + x] = 1; n++; }
    return n / (cols * rows);
  };
  const OPENED = ".modal-back,[role=dialog],.ms-scrim,.ms-pop,.ms-menu,.sbi-lightbox,.ms-dock-pop";
  for (const e of all) {
    if (!vis(e) || !/fixed|sticky/.test(getComputedStyle(e).position)) continue;
    if (e.parentElement?.closest("*") && [...all].some((a) => a !== e && a.contains(e) && /fixed|sticky/.test(getComputedStyle(a).position))) continue;
    if (exempt && e.matches(OPENED)) continue;
    const rs = painted(e).filter((r) => !(exempt && false));
    const rsNoOpened = exempt ? [...e.querySelectorAll(OPENED)].reduce((acc, o) => acc.filter((r) => { const q = o.getBoundingClientRect(); return !(r.left >= q.left - 1 && r.right <= q.right + 1 && r.top >= q.top - 1 && r.bottom <= q.bottom + 1); }), rs) : rs;
    const a = area(rsNoOpened.length ? rsNoOpened : rs);
    // the band beside the page is the studio's frame, not a cover (it never sits over the content)
    if (e.matches(".ms-band") && e.getBoundingClientRect().width < vw * 0.2) continue;
    if (a > 0.3) out.cover.push(`${name(e)} paints ${(a * 100).toFixed(0)}% of the viewport`);
  }
  for (const d of document.querySelectorAll(".ms-dock-in")) { if (!vis(d)) continue; const q = d.getBoundingClientRect(), h = q.height; if (h > vh * 0.25) out.dockHeight.push(`${name(d)} ${Math.round(h)}px = ${(h / vh * 100).toFixed(0)}% of ${vh}px`);
    // the bar must stay on screen: a card floating above it must never push it below the fold
    if (q.bottom > vh + 1 || q.top < 0) out.dockHeight.push(`${name(d)} off screen (${Math.round(q.top)}..${Math.round(q.bottom)} of ${vh}px)`); }
  // overlaps of controls and headings within the same layer
  const layer = (e) => e.closest(".ms-dock,.s3-reel,.ms-float,.ms-hdr,.modal,[role=dialog],.ms-band,.ms-pop,.ms-menu,.ms-note");
  const ints = [...document.querySelectorAll("button,a,input,select,textarea,summary,h1,h2,h3,label,.btn")].filter(vis).filter((e) => !skip(e) && inView(e.getBoundingClientRect()));
  for (let i = 0; i < ints.length; i++) for (let j = i + 1; j < ints.length; j++) {
    const a = ints[i], b = ints[j]; if (a.contains(b) || b.contains(a) || layer(a) !== layer(b)) continue;
    const A = a.getBoundingClientRect(), B = b.getBoundingClientRect();
    const w = Math.min(A.right, B.right) - Math.max(A.left, B.left), h = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
    if (w > 4 && h > 4 && out.overlap.length < 12) out.overlap.push(`${name(a)}«${(a.innerText || "").slice(0, 14)}» × ${name(b)}«${(b.innerText || "").slice(0, 14)}» ${Math.round(w)}x${Math.round(h)}`);
  }
  out.hscroll = Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth);
  // a build error overlay or an empty shell is a failed screen, not a clean one
  out.broken = [document.querySelector("vite-error-overlay") ? "vite error overlay" : "", document.querySelector(".shell-v3, .studio-shell") ? "" : "no studio shell rendered"].filter(Boolean);
  for (const k of Object.keys(out)) if (Array.isArray(out[k])) out[k] = [...new Set(out[k])].slice(0, 12);
  return out;
};

const FAIL_KEYS = ["broken", "narrowWrap", "cover", "dockHeight", "overlap", "clipped", "contrast", "console"];
(async () => {
  if (shots) await mkdir(shots, { recursive: true });
  const browser = await chromium.launch();
  const report = {}; let failed = 0;
  for (const ch of channels) for (const [w, h] of sizes) for (const theme of themes) {
    const mobile = w < 721;
    const cur = { state: "scenes" };
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: "ar", isMobile: mobile, hasTouch: mobile, colorScheme: theme, deviceScaleFactor: 1 });
    await ctx.addInitScript((th) => { try { localStorage.setItem("bal-theme", th); } catch { /* private */ } }, theme);
    const rewrite = (re, fn) => ctx.route(re, async (route) => {
      try {
        if (route.request().method() !== "GET") return route.abort();
        const r = await route.fetch(); const j = await r.json().catch(() => null);
        await route.fulfill({ response: r, json: fn(j) });
      } catch { /* page navigated away */ }
    });
    let lastIds = [];
    await rewrite(/\/api\/episodes\/[^/]+\/scene-production(\?.*)?$/, (j) => { const o = ledger(cur.state)(j); if (o?.boards?.changed) lastIds = o.boards.changed; return o; });
    await rewrite(/\/api\/episodes\/[^/]+\/approve-preparation(\?.*)?$/, (j) => preparation(cur.state)(j ? { ...j, __ids: lastIds } : j));
    await rewrite(/\/api\/episodes\/[^/]+\/sentences(\?.*)?$/, (j) => sentences(cur.state)(j));
    await rewrite(/\/api\/episodes\/[^/]+\/review(\?.*)?$/, review);
    await ctx.route(/\/api\/.*/, (route) => (route.request().method() === "GET" ? route.fallback() : route.abort()).catch(() => {}));
    const page = await ctx.newPage();
    let errs = [], http = [];
    page.on("pageerror", (e) => errs.push("pageerror " + e.message.slice(0, 160)));
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); });
    page.on("response", (r) => { if (r.status() >= 400) http.push(`${r.status()} ${r.url().replace(origin, "").slice(0, 90)}`); });
    let n = 0, seriesId = "";
    // warm-up: the first load of a context compiles and fills caches; it is not measured
    await page.goto(`${origin}/?link#/${ch}/${EP}/storyboard`).catch(() => {}); await page.waitForTimeout(3500);
    for (const [id, hash, state, act, exempt] of CASES) {
      const tag = `${ch}-${id}-${w}x${h}-${theme}`;
      cur.state = state; errs = []; http = [];
      try {
        let hh = hash(ch);
        if (hh.includes("@first")) { if (!seriesId) { await page.goto(`${origin}/?link#/${ch}`); await page.waitForTimeout(800); seriesId = await firstSeries(page, ch); } hh = hh.replace("@first", seriesId); }
        await page.goto(`${origin}/?link&n=${n++}${hh}`);
        await page.waitForTimeout(id.startsWith("adm") || id.startsWith("home") || id.startsWith("series") ? 1600 : 2600);
        if (act) await act(page);
        const a = await page.evaluate(audit, Boolean(exempt));
        if (probe) console.log("probe", tag, JSON.stringify(await page.evaluate(probe).catch((e) => e.message)));
        a.console = [...new Set(errs)].slice(0, 8); a.http = [...new Set(http)].slice(0, 8);
        const bad = FAIL_KEYS.filter((k) => a[k]?.length) .concat(a.hscroll > 1 ? ["hscroll"] : []);
        report[tag] = { ...a, bad };
        if (bad.length) { failed++; console.log("FAIL", tag, bad.map((k) => `${k}:${k === "hscroll" ? a.hscroll : a[k].length}`).join(" ")); }
        else console.log("ok  ", tag);
        if (shots) await page.screenshot({ path: path.join(shots, `${tag}.jpg`), type: "jpeg", quality: 62 });
      } catch (e) { failed++; report[tag] = { error: e.message }; console.log("ERR ", tag, e.message.slice(0, 120)); }
      await page.keyboard.press("Escape").catch(() => {});
    }
    await ctx.close();
  }
  await browser.close();
  if (jsonOut) await writeFile(jsonOut, JSON.stringify(report, null, 1));
  console.log(`\n${Object.keys(report).length} screens, ${failed} with findings.`);
  process.exit(failed ? 1 : 0);
})();
