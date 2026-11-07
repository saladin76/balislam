/**
 * Browser-only Studio visual QA on a disposable CI checkout. No approvals,
 * episode writes, renders, production Mac usage or third-party deployments.
 * node tests/studio-ui-visual.mjs
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const output = path.resolve(process.env.STUDIO_UI_ARTIFACTS || path.join(root, "artifacts", "studio-ui"));
const binary = process.env.CHROME_BIN || ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]
  .find((name) => spawnSync("which", [name], { stdio: "ignore" }).status === 0);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(fn, label, limit = 30000) {
  const stop = Date.now() + limit;
  let last;
  while (Date.now() < stop) {
    try { const v = await fn(); if (v) return v; } catch (error) { last = error; }
    await delay(180);
  }
  throw new Error("Timeout waiting for " + label + (last ? ": " + last.message : ""));
}
function openSocket(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error("Chrome websocket connection failed"));
  });
}
function connection(ws) {
  let id = 0;
  const waiting = new Map();
  ws.onmessage = ({ data }) => {
    const packet = JSON.parse(data);
    const task = waiting.get(packet.id);
    if (!task) return;
    waiting.delete(packet.id);
    if (packet.error) task.reject(new Error(JSON.stringify(packet.error)));
    else task.resolve(packet.result);
  };
  return (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const n = ++id;
    const timeout = setTimeout(() => { waiting.delete(n); reject(new Error("CDP timeout " + method)); }, 20000);
    waiting.set(n, {
      resolve: (value) => { clearTimeout(timeout); resolve(value); },
      reject: (err) => { clearTimeout(timeout); reject(err); },
    });
    ws.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
let vite, chrome, ws, tmp;
const tests = [];
function assert(label, ok) { if (!ok) throw new Error("UI failed: " + label); tests.push(label); }
try {
  if (!binary) throw new Error("Real Chromium is required for visual evidence.");
  await mkdir(output, { recursive: true });
  tmp = await mkdtemp(path.join(os.tmpdir(), "studio-ui-ci-"));
  vite = spawn("npm", ["run", "app", "--", "--host", "127.0.0.1", "--port", "4321", "--strictPort"], {
    cwd: root, env: { ...process.env, BAL_ENV_FILE: path.join(tmp, "unused.env") }, stdio: "ignore",
  });
  const channels = await until(async () => {
    const r = await fetch("http://127.0.0.1:4321/api/channels");
    return r.ok ? r.json() : null;
  }, "local Studio API");
  for (const channel of ["balislam", "dafatir-alzaman", "zubdat-alkutub"])
    assert("channel " + channel, channels.some((item) => item.id === channel));
  chrome = spawn(binary, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--remote-allow-origins=*", "--remote-debugging-port=9223", "--user-data-dir=" + path.join(tmp, "chrome"),
    "--no-first-run", "about:blank",
  ], { stdio: "ignore" });
  const version = await until(async () => {
    const r = await fetch("http://127.0.0.1:9223/json/version");
    return r.ok ? r.json() : null;
  }, "Chrome DevTools");
  ws = await openSocket(version.webSocketDebuggerUrl);
  const send = connection(ws);
  const target = await send("Target.createTarget", { url: "about:blank" });
  const attach = await send("Target.attachToTarget", { targetId: target.targetId, flatten: true });
  const cmd = (method, params = {}) => send(method, params, attach.sessionId);
  await cmd("Page.enable");
  await cmd("Runtime.enable");
  const evaluate = async (expression) => {
    const response = await cmd("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error("Chrome JS error: " + response.exceptionDetails.text);
    return response.result.value;
  };
  const waitFor = (selector) => until(() => evaluate("Boolean(document.querySelector(" + JSON.stringify(selector) + "))"), selector);
  const click = (selector) => evaluate("(() => { const el=document.querySelector(" + JSON.stringify(selector) + "); if(!el)return false;el.click();return true; })()");
  const resize = async (width, height, mobile = false) => {
    await cmd("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
    await delay(200);
    const area = await evaluate("({width: innerWidth, scrollWidth: document.documentElement.scrollWidth})");
    assert("no horizontal viewport overflow " + width, area.scrollWidth <= area.width + 3);
  };
  const screenshot = async (name) => {
    await evaluate("document.fonts.ready.then(() => true)");
    await delay(300);
    const shot = await cmd("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(path.join(output, name), Buffer.from(shot.data, "base64"));
  };
  const navigate = async (name) => {
    if (await evaluate("innerWidth < 881") &&
        !await evaluate('document.querySelector(".studio-shell")?.classList.contains("is-nav-open")')) {
      assert("mobile menu control", await click(".studio-menu-toggle"));
      await delay(150);
    }
    const ok = await evaluate("(() => {const el=[...document.querySelectorAll('.studio-nav-item')].find(x=>x.textContent.includes(" +
      JSON.stringify(name) + "));if(!el)return false;el.click();return true;})()");
    assert("navigate " + name, ok);
  };
  const typeDraft = async (selector, marker) => evaluate("(() => {" +
    "const el=document.querySelector(" + JSON.stringify(selector) + ");if(!(el instanceof HTMLTextAreaElement))return false;" +
    "Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,el.value+" + JSON.stringify(marker) + ");" +
    "el.dispatchEvent(new Event('input',{bubbles:true}));return el.value.endsWith(" + JSON.stringify(marker) + ");})()");
  const key = async (name, code, value) => {
    await cmd("Input.dispatchKeyEvent", { type: "keyDown", key: name, code, windowsVirtualKeyCode: value });
    await cmd("Input.dispatchKeyEvent", { type: "keyUp", key: name, code, windowsVirtualKeyCode: value });
  };

  await resize(1440, 900);
  await cmd("Page.navigate", { url: "http://127.0.0.1:4321/" });
  await waitFor("#studio-navigation");
  await navigate("غرف العمليات");
  await waitFor(".ops-section-nav");
  await screenshot("01-ops-desktop-1440.png");
  assert("keyboard focus on pipeline selector", await evaluate("(() => {const b=document.querySelector('[aria-controls=\"ops-pipeline\"]');if(!b)return false;b.focus();return document.activeElement===b;})()"));
  await key("Enter", "Enter", 13);
  await until(() => evaluate("document.querySelector('[aria-controls=\"ops-pipeline\"]')?.getAttribute('aria-pressed')==='true'"), "keyboard pipeline selection");
  assert("hidden week section not displayed", await evaluate("(() => {const el=document.querySelector('#ops-week');return el?.hidden && getComputedStyle(el).display==='none';})()"));
  await screenshot("02-pipeline-desktop-1440.png");

  await navigate("إدارة القنوات");
  await waitFor(".studio-channel-grid");
  assert("all three channels rendered", await evaluate("document.querySelectorAll('.studio-channel-tile').length===3"));
  await screenshot("03-channels-desktop-1440.png");
  await resize(820, 1180);
  await screenshot("04-channels-tablet-820.png");
  await resize(1440, 900);
  await navigate("مساحة الحلقة المفتوحة");
  await waitFor(".ew-stages");
  assert("six episode steps", await evaluate("document.querySelectorAll('.ew-stages button').length===6"));
  await waitFor("#script-editor");
  const scriptMarker = " [UI-UNSAVED-SCRIPT]";
  assert("script editor changed locally", await typeDraft("#script-editor", scriptMarker));
  await delay(250);
  await navigate("إدارة القنوات");
  await waitFor(".studio-channel-grid");
  await navigate("مساحة الحلقة المفتوحة");
  await waitFor("#script-editor");
  assert("script draft survives navigation", await evaluate("document.querySelector('#script-editor')?.value.endsWith(" + JSON.stringify(scriptMarker) + ")"));
  await screenshot("05-episode-desktop-1440.png");

  assert("research shortcut available", await click(".ew-research-shortcut"));
  await waitFor("#research-editor");
  const researchMarker = " [UI-UNSAVED-RESEARCH]";
  assert("research editor changed locally", await typeDraft("#research-editor", researchMarker));
  await delay(250);
  await navigate("إدارة القنوات");
  await waitFor(".studio-channel-grid");
  await navigate("مساحة الحلقة المفتوحة");
  await waitFor("#script-editor");
  assert("research shortcut still available", await click(".ew-research-shortcut"));
  await waitFor("#research-editor");
  assert("research draft survives navigation", await evaluate("document.querySelector('#research-editor')?.value.endsWith(" + JSON.stringify(researchMarker) + ")"));
  await resize(390, 844, true);
  await screenshot("06-research-mobile-390.png");
  assert("mobile navigation can open", await click(".studio-menu-toggle"));
  await until(() => evaluate("document.querySelector('.studio-shell')?.classList.contains('is-nav-open')"), "mobile sidebar");
  await screenshot("07-navigation-mobile-390.png");
  await key("Escape", "Escape", 27);
  await until(() => evaluate("!document.querySelector('.studio-shell')?.classList.contains('is-nav-open')"), "mobile Escape");
  const openedReview = await evaluate("(() => {const b=[...document.querySelectorAll('.ew-stages button')].find(x=>x.textContent.includes('المراجعة المتكاملة'));if(!b)return false;b.click();return true;})()");
  assert("integrated AV stage opens", openedReview);
  await waitFor(".studio-review-workspace");
  await screenshot("08-av-mobile-390.png");
  await resize(820, 1180);
  await screenshot("09-av-tablet-820.png");
  await resize(1440, 900);
  await screenshot("10-av-desktop-1440.png");
  await writeFile(path.join(output, "result.json"), JSON.stringify({
    passed: true, testCount: tests.length, tests, date: new Date().toISOString(), chrome: version.Browser,
    origin: "isolated CI runner", wroteEpisodeFiles: false, renderStarted: false, approvalGranted: false,
  }, null, 2));
  console.log("STUDIO_UI_VISUAL_PASS", JSON.stringify({ checks: tests.length, screenshots: 10 }));
} catch (error) {
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "failure.txt"), String(error?.stack || error));
  console.error("STUDIO_UI_VISUAL_FAIL", error);
  process.exitCode = 1;
} finally {
  ws?.close();
  chrome?.kill("SIGTERM");
  vite?.kill("SIGTERM");
  if (tmp) await rm(tmp, { recursive: true, force: true }).catch(() => {});
}
