#!/usr/bin/env node
/**
 * P0 repeat-run temp leak audit. Creates an isolated TMPDIR and refuses growth.
 * It NEVER deletes/scans folders outside the one it creates and owns.
 *
 * node scripts/verify-studio-temp-leaks.mjs             # full gate twice, serial
 * node scripts/verify-studio-temp-leaks.mjs --parallel  # two simultaneous gates
 * node scripts/verify-studio-temp-leaks.mjs --failure   # induced gate failure
 * node scripts/verify-studio-temp-leaks.mjs --cancel    # terminate child gate
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync, statfsSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = mkdtempSync(path.join(os.tmpdir(), "bal-test-leak-audit-"));
const marker = path.join(base, "OWNER-DO-NOT-DELETE");
const parallel = process.argv.includes("--parallel");
const exercise = process.argv.includes("--cancel") ? "cancel" : process.argv.includes("--failure") ? "failure" : null;
const dirs = [];
const available = () => {
  const s=statfsSync(base);
  return Number(s.bavail)*Number(s.bsize);
};
// Read-only host pressure probe. On macOS an increase in APFS-allocated VM
// swap files can resemble a leaked 1 GiB folder, although the audit's own
// TMPDIR is empty. Report values; do not attribute or delete anything.
const swapUsage = () => {
  if (process.platform !== "darwin") return null;
  try {
    const raw = execFileSync("/usr/sbin/sysctl", ["vm.swapusage"], {
      encoding: "utf8", timeout: 3000, stdio: ["ignore", "pipe", "ignore"],
    });
    const bytes = (key) => {
      const m = raw.match(new RegExp("\\b" + key + "\\s*=\\s*([0-9.]+)\\s*([KMGTP])", "i"));
      if (!m) return null;
      const power = { K: 1, M: 2, G: 3, T: 4, P: 5 }[m[2].toUpperCase()];
      return Math.round(Number(m[1]) * 1024 ** power);
    };
    return { totalBytes: bytes("total"), usedBytes: bytes("used"), freeBytes: bytes("free") };
  } catch {
    return { unavailable: true };
  }
};
const entries = d => readdirSync(d).filter(n=>n!=="OWNER-DO-NOT-DELETE");
const disk = d => {
  if (!existsSync(d)) return 0;
  const s=lstatSync(d);
  if (s.isSymbolicLink()) return 0;
  if (s.isDirectory()) return readdirSync(d).reduce((a,n)=>a+disk(path.join(d,n)),0);
  return Number(s.blocks)*512;
};
const run = (root, label, mode = null) => new Promise(resolve=>{
  if (interrupted) { resolve({ label, status: null, error: "audit cancelled before launch" }); return; }
  const env = { ...process.env, TMPDIR:root, TMP:root, TEMP:root };
  // Stress two independent gates concurrently, but allow only one Vitest
  // worker per gate on RAM-constrained Macs. All 638 tests still execute.
  // The production gate and serial/failure/cancel audits remain unchanged.
  if (parallel) env.BAL_STUDIO_AUDIT_VITEST_WORKERS = "1";
  else delete env.BAL_STUDIO_AUDIT_VITEST_WORKERS;
  // This deliberately fails only the npx command within the test child.
  if (mode === "failure") env.PATH = path.join(root, "missing-bin-directory");
  const child=spawn(process.execPath,[path.join(repo,"scripts/gate.mjs")],{cwd:repo,env,stdio:"inherit"});
  children.push(child);
  let timer = null;
  if (mode === "cancel") timer = setTimeout(()=>child.kill("SIGTERM"), 1200);
  let finished = false;
  const finish = result => {
    if (finished) return;
    finished = true;
    if (timer) clearTimeout(timer);
    resolve(result);
  };
  child.once("error", e=>finish({label,status:1,error:e.message}));
  child.once("close", (code,signal)=>finish({label,status:code,signal}));
});
let interrupted=false;
let interruptSignal=null;
const children=[];
const clean=(signal)=>{
  if (interrupted) return;
  interrupted=true;
  interruptSignal=signal;
  for (const ch of children) if (ch && !ch.killed) ch.kill(signal);
  // Do not delete the owner sandbox until every tracked gate has closed.
};
process.once("SIGINT",()=>clean("SIGINT"));
process.once("SIGTERM",()=>clean("SIGTERM"));
let failures=[];
try {
  writeFileSync(marker,"Audit sandbox owner; other temp directories are out of scope.\n",{flag:"wx",mode:0o600});
  const before=available();
  const swapBefore=swapUsage();
  // Fail closed before launching two gates if the Mac's system volume is
  // already nearly full. Never try to reclaim another process's files.
  if (parallel && before < 6 * 1024 ** 3) {
    throw new Error("Parallel audit refused: fewer than 6 GiB of free disk space; no test gates started.");
  }
  if (parallel) {
    // Run a tiny real Vitest command with the exact audit-only worker flag
    // before starting TWO full gates. This catches CLI incompatibilities
    // early without changing suite coverage or touching production files.
    const probe = spawnSync("npx", ["vitest", "run", "--maxWorkers", "1", "tests/quran-compare.test.ts"], {
      cwd: repo,
      env: { ...process.env, CI: "1", TMPDIR: base, TMP: base, TEMP: base },
      encoding: "utf8",
      timeout: 30_000,
    });
    if (probe.status !== 0) {
      throw new Error("Parallel audit refused: Vitest worker-option smoke test failed (no full gates started). " +
        (probe.stderr || probe.stdout || probe.error?.message || "").slice(0, 900));
    }
    console.log("VITEST_WORKER_PREFLIGHT passed");
  }
  const samples=[];
  if (exercise) {
    const root=mkdtempSync(path.join(base,exercise+"-"));
    dirs.push(root);
    const result=await run(root,exercise,exercise);
    const unexpected=entries(root);
    samples.push({run:1,...result,leftoverFiles:unexpected,diskBytes:disk(root)});
    if (result.status !== (exercise === "cancel" ? 143 : 1) || unexpected.length) failures.push(exercise+"-unexpected-result");
  } else if (parallel) {
    const roots=[mkdtempSync(path.join(base,"parallel-A-")),mkdtempSync(path.join(base,"parallel-B-"))];
    dirs.push(...roots);
    // Both instances have distinct TMPDIR roots; neither can clean the other's root.
    const results=await Promise.all(roots.map((root,i)=>run(root,"parallel-"+(i+1))));
    for (let i=0;i<roots.length;i++) {
      const unexpected=entries(roots[i]);
      samples.push({run:i+1,...results[i],leftoverFiles:unexpected,diskBytes:disk(roots[i])});
      if (results[i].status!==0 || unexpected.length) failures.push("parallel-"+(i+1));
    }
  } else {
    const root=mkdtempSync(path.join(base,"serial-"));
    dirs.push(root);
    for(let i=1;i<=2;i++){
      const result=await run(root,"serial-"+i);
      const unexpected=entries(root);
      samples.push({run:i,...result,leftoverFiles:unexpected,diskBytes:disk(root)});
      if(result.status!==0 || unexpected.length){failures.push("serial-"+i);break;}
    }
  }
  if (interrupted) failures.push("audit-interrupted-"+interruptSignal);
  if(!existsSync(marker)||!readFileSync(marker,"utf8").includes("owner"))failures.push("sentinel-touched");
  const after=available();
  const swapAfter=swapUsage();
  console.log("TEMP_LEAK_AUDIT "+JSON.stringify({
    mode:exercise || (parallel?"parallel":"serial"),
    maxVitestWorkersPerGate:parallel?1:null,results:samples,freeBytesBefore:before,
    freeBytesAfter:after,freeBytesDelta:after-before,
    swapBefore,swapAfter,
    swapTotalDeltaBytes: swapBefore?.totalBytes != null && swapAfter?.totalBytes != null
      ? swapAfter.totalBytes - swapBefore.totalBytes : null,
    swapUsedDeltaBytes: swapBefore?.usedBytes != null && swapAfter?.usedBytes != null
      ? swapAfter.usedBytes - swapBefore.usedBytes : null,
    privateTempBytesAfter:dirs.reduce((n,d)=>n+disk(d),0),
    otherSystemTmpFilesUntouched:true,passed:failures.length===0
  }));
} finally {
  // Only this invocation's randomly named audit root; never rm /tmp or wildcard.
  // Child runs have completed before this normal exit path.
  for (const d of dirs) rmSync(d,{recursive:true,force:true});
  rmSync(base,{recursive:true,force:true});
}
if(failures.length){console.error("TEMP_LEAK_AUDIT_FAILED",failures.join(","));process.exitCode=1;}
