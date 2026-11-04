#!/usr/bin/env node
/**
 * Local read-only studio integration smoke check for macOS/Linux.
 * Does not modify episodes, secrets, identities or channel libraries.
 * Usage: node scripts/verify-studio-integration.mjs
 */
import { spawn, spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const run = (cmd, args) => {
  console.log("Checking:", cmd, args.join(" "));
  const r = spawnSync(cmd, args, { stdio: "inherit", env: process.env });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`Failed: ${cmd} ${args.join(" ")} (exit ${r.status})`);
};

let child;
try {
  run("npm", ["run", "typecheck"]);
  run("npx", ["vitest", "run", "--testTimeout=20000"]);
  // Use a separate strict port: do not interrupt any running studio on :4321.
  child = spawn("npm", ["run", "app", "--", "--port", "4323", "--strictPort"], {
    stdio: "ignore", detached: true, env: process.env,
  });
  const root = "http://127.0.0.1:4323";
  let ready = false;
  for (let i = 0; i < 40; i++) {
    if (child.exitCode != null) break;
    try {
      const response = await fetch(root + "/api/channels", { signal: AbortSignal.timeout(3000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const channels = await response.json();
      for (const id of ["balislam", "dafatir-alzaman", "zubdat-alkutub"])
        if (!Array.isArray(channels) || !channels.some((c) => c.id === id))
          throw new Error(`Missing channel: ${id}`);
      console.log("PASS: one studio API serves all three channel identities");
      ready = true;
      break;
    } catch (e) {
      if (i === 39) throw e;
      await delay(350);
    }
  }
  if (!ready) throw new Error("Studio did not start on port 4323");
  const r = await fetch(root + "/api/mp3quran/suwar", { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`MP3Quran API unavailable (HTTP ${r.status})`);
  const catalogue = await r.json();
  if (!Array.isArray(catalogue.suwar) || !catalogue.suwar.some((s) => s.id === 1))
    throw new Error("MP3Quran surah catalogue malformed");
  console.log(`PASS: MP3Quran external catalogue (${catalogue.suwar.length} surahs)`);
  console.log("PASS: static checks + all regression tests + local studio API + MP3Quran");
} catch (error) {
  console.error("FAIL:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (child?.pid) {
    try { process.kill(-child.pid, "SIGTERM"); } catch {
      try { child.kill("SIGTERM"); } catch {}
    }
  }
}
