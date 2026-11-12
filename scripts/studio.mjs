#!/usr/bin/env node
/**
 * `npm run app` (D101): استوديو واحد على المنفذ 4321، يُعاد تشغيله آليًا حين يصل تحديث يغيّر كود الخادم.
 *
 *   ١. استوديو واحد فقط: إن كان المنفذ مشغولًا باستوديو من هذا المجلد نفسه (أي نسخة، قديمة أو جديدة)
 *      يُطلب منه الإغلاق بلطف (SIGTERM) ثم يُؤخذ المنفذ. وتُغلق كذلك نسخ هذا المجلد الباقية على 4322–4329.
 *      إن كان المنفذ لبرنامج آخر يُقال ذلك بالعربية ويتوقف التشغيل — لا انتقال صامت إلى 4322 أبدًا (strictPort).
 *   ٢. مشرف صغير: يشغّل vite، وإن خرج برمز 75 (طلب الحفظ الآلي إعادة التشغيل بعد تحديث) يشغّله من جديد.
 */
import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";
import { cwdOf, freePort, listeners, portFree } from "./studioInstance.mjs";

const root = realpathSync(path.resolve(import.meta.dirname, ".."));
// `npm run app -- --port 4323 --host 127.0.0.1` (فحوص التكامل) يعمل كما كان: المنفذ يُقرأ، وبقية الخيارات لـ vite
const argv = process.argv.slice(2);
const portArg = argv.indexOf("--port");
const PORT = Number(portArg >= 0 ? argv[portArg + 1] : process.env.BAL_STUDIO_PORT || 4321);
const passThrough = argv.filter((a, i) => !(i === portArg || i === portArg + 1 && portArg >= 0) && a !== "--strictPort");
const RESTART_CODE = 75;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!(await freePort(PORT, root, { strict: true }))) process.exit(1);
// بقايا نسخ هذا المجلد على المنافذ التالية (كانت تبدأ هناك حين يُشغل 4321)
for (let p = PORT + 1; p <= PORT + 8; p++) {
  if (!(await portFree(p)) && listeners(p).some((pid) => cwdOf(pid) === root)) await freePort(p, root, { strict: false });
}

const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
let child = null;
let stopping = false;
const startVite = () => {
  child = spawn(process.execPath, [viteBin, "--config", "app/vite.config.ts", ...passThrough, "--port", String(PORT), "--strictPort"], {
    cwd: root, stdio: "inherit",
    env: { ...process.env, BAL_STUDIO_SUPERVISED: "1" },
  });
  child.on("exit", async (code, signal) => {
    if (stopping) return process.exit(code ?? 0);
    if (code === RESTART_CODE) {
      console.log("\n[studio] وصل تحديث يغيّر الخادم؛ يُعاد تشغيل الاستوديو…\n");
      for (let i = 0; i < 40 && !(await portFree(PORT)); i++) await sleep(250);
      startVite();
      return;
    }
    process.exit(code ?? (signal ? 1 : 0));
  });
};
for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(sig, () => {
  stopping = true;
  if (child && child.exitCode === null) child.kill(sig);
  else process.exit(0);
});
startVite();
