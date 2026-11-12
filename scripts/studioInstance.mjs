/** استوديو واحد على المنفذ (D101): أدوات scripts/studio.mjs، منفصلة لتُختبر. */
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import net from "node:net";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const portFree = (port) => new Promise((resolve) => {
  const s = net.createServer();
  s.once("error", () => resolve(false));
  s.once("listening", () => s.close(() => resolve(true)));
  s.listen(port, "127.0.0.1");
});

/** pids التي تستمع على المنفذ (lsof على الماك ولينكس). */
export const listeners = (port) => {
  try {
    return execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n").map((x) => Number(x.trim())).filter((n) => n > 0 && n !== process.pid);
  } catch { return []; }
};
/** مجلد عمل العملية (lsof -d cwd). */
export const cwdOf = (pid) => {
  try {
    const out = execFileSync("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const line = out.split("\n").find((l) => l.startsWith("n"));
    return line ? realpathSync(line.slice(1)) : null;
  } catch { return null; }
};
export const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

/** يغلق استوديوهات هذا المجلد على المنفذ؛ يعيد false إن كان المنفذ لبرنامج آخر. */
export const freePort = async (port, root, { strict = true, log = console.log, error = console.error } = {}) => {
  if (await portFree(port)) return true;
  const pids = listeners(port);
  const ours = pids.filter((p) => cwdOf(p) === root);
  if (!pids.length || ours.length < pids.length) {
    if (strict) {
      error(`\n✗ المنفذ ${port} مشغول ببرنامج آخر غير الاستوديو${pids.length ? ` (رقم العملية ${pids.join("، ")})` : ""}.`);
      error("  أغلق ذلك البرنامج ثم شغّل npm run app من جديد. لا يعمل الاستوديو على منفذ آخر حتى لا تعمل نسختان معًا.");
    }
    return false;
  }
  log(`[studio] استوديو أقدم من هذا المجلد يعمل على المنفذ ${port}؛ يُغلق الآن…`);
  for (const p of ours) { try { process.kill(p, "SIGTERM"); } catch { /* انتهى */ } }
  for (let i = 0; i < 40 && !(await portFree(port)); i++) await sleep(250);
  if (!(await portFree(port))) {
    for (const p of ours.filter(alive)) { try { process.kill(p, "SIGKILL"); } catch { /* انتهى */ } }
    for (let i = 0; i < 20 && !(await portFree(port)); i++) await sleep(250);
  }
  return portFree(port);
};

