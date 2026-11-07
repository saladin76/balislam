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
import { execFileSync, spawn } from "node:child_process";
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
  // Tee the exact gate output, retaining only a bounded tail for audit evidence.
  // Sample ONLY this audit invocation's private root, never a shared /tmp path.
  let outputTail = "";
  let peakOwnedBytes = 0;
  let samplingErrors = 0;
  let samplesTaken = 0;
  const sample = () => {
    try {
      peakOwnedBytes = Math.max(peakOwnedBytes, disk(root));
      samplesTaken++;
    } catch { samplingErrors++; }
  };
  sample();
  const child=spawn(process.execPath,[path.join(repo,"scripts/gate.mjs")],{
    cwd:repo,env,stdio:["ignore","pipe","pipe"]
  });
  const consume = (stream, chunk) => {
    stream.write(chunk);
    outputTail = (outputTail + chunk.toString("utf8")).slice(-8192);
  };
  child.stdout?.on("data", chunk => consume(process.stdout, chunk));
  child.stderr?.on("data", chunk => consume(process.stderr, chunk));
  const monitor = setInterval(sample, 1000);
  monitor.unref();
  children.add(child);
  let timer = null;
  if (mode === "cancel") timer = setTimeout(()=>child.kill("SIGTERM"), 1200);
  let finished = false;
  const finish = result => {
    if (finished) return;
    finished = true;
    children.delete(child);
    if (timer) clearTimeout(timer);
    clearInterval(monitor);
    sample();
    const allocations = [...outputTail.matchAll(/GATE_TEMP_ALLOCATED_BEFORE_CLEANUP_BYTES\s+(-?\d+)/g)];
    const cleanups = [...outputTail.matchAll(/GATE_TEMP_CLEANED\s+(true|false)/g)];
    const bytes = allocations.length ? Number(allocations.at(-1)[1]) : null;
    const cleaned = cleanups.length ? cleanups.at(-1)[1] === "true" : null;
    resolve({
      ...result, ownedRootBytesBeforeGate:0, ownedPeakBytes:peakOwnedBytes,
      ownedRootBytesAfterGate:disk(root),
      peakSamples:samplesTaken, samplingErrors,
      gateAllocatedBeforeCleanupBytes:bytes, gateReportedCleaned:cleaned,
    });
  };
  child.once("error", e=>finish({label,status:1,error:e.message}));
  child.once("close", (code,signal)=>finish({label,status:code,signal}));
});
let interrupted=false;
let interruptSignal=null;
const children=new Set();
let preflightChild = null;
const stopPreflight = (signal) => {
  const child = preflightChild;
  if (!child?.pid) return;
  try {
    if (process.platform !== "win32") process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch { /* already exited */ }
};
const clean=(signal)=>{
  if (interrupted) return;
  interrupted=true;
  interruptSignal=signal;
  for (const ch of children) if (ch && !ch.killed && ch !== preflightChild) ch.kill(signal);
  stopPreflight(signal);
  // Do not delete the owner sandbox until every tracked gate has closed.
};
process.once("SIGINT",()=>clean("SIGINT"));
process.once("SIGTERM",()=>clean("SIGTERM"));
process.once("SIGHUP",()=>clean("SIGHUP"));
let failures=[];
let baselineFree = null;
let baselineSwap = null;
try {
  writeFileSync(marker,"Audit sandbox owner; other temp directories are out of scope.\n",{flag:"wx",mode:0o600});
  const before=available();
  baselineFree = before;
  const swapBefore=swapUsage();
  baselineSwap = swapBefore;
  // Fail closed before launching two gates if the Mac's system volume is
  // already nearly full. Never try to reclaim another process's files.
  if (parallel && before < 6 * 1024 ** 3) {
    throw new Error("Parallel audit refused: fewer than 6 GiB of free disk space; no test gates started.");
  }
  if (parallel) {
    const preflightRoot = mkdtempSync(path.join(base, "preflight-"));
    dirs.push(preflightRoot);
    // Run a tiny real Vitest command with the exact audit-only worker flag
    // before starting TWO full gates. This catches CLI incompatibilities
    // early without changing suite coverage or touching production files.
    // Async, group-owned preflight: unlike spawnSync, SIGTERM/SIGINT can stop
    // the command and any child processes before the audit root is removed.
    const probe = await new Promise((resolve) => {
      const child = spawn("npx", ["vitest", "run", "--maxWorkers", "1", "tests/quran-compare.test.ts"], {
        cwd: repo,
        env: { ...process.env, CI: "1", TMPDIR: preflightRoot, TMP: preflightRoot, TEMP: preflightRoot },
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32",
      });
      preflightChild = child;
      children.add(child);
      let stdout = "";
      let stderr = "";
      let error = null;
      let timedOut = false;
      const collect = (previous, chunk) => (previous + chunk.toString("utf8")).slice(-2400);
      child.stdout?.on("data", (chunk) => { stdout = collect(stdout, chunk); });
      child.stderr?.on("data", (chunk) => { stderr = collect(stderr, chunk); });
      const timer = setTimeout(() => {
        timedOut = true;
        stopPreflight("SIGTERM");
        // Even a child ignoring TERM must not outlive the owned temp root.
        setTimeout(() => {
          if (preflightChild === child) stopPreflight("SIGKILL");
        }, 2000).unref();
      }, 30_000);
      child.once("error", (e) => { error = e.message; });
      child.once("close", (status, signal) => {
        clearTimeout(timer);
        children.delete(child);
        if (preflightChild === child) preflightChild = null;
        resolve({ status, signal, error, timedOut, stdout, stderr });
      });
    });
    if (interrupted || probe.status !== 0 || probe.timedOut || probe.error) {
      throw new Error("Parallel audit refused: Vitest worker-option preflight failed or interrupted " +
        "(no full gates started). " +
        (probe.error || probe.stderr || probe.stdout || probe.signal || "no output").slice(0, 900));
    }
    const preflightLeftovers = entries(preflightRoot);
    const preflightAllocated = disk(preflightRoot);
    console.log("VITEST_WORKER_PREFLIGHT " + JSON.stringify({
      status: "passed", tempBytesBeforeCleanup: preflightAllocated,
      leftoverPaths: preflightLeftovers
    }));
    if (preflightLeftovers.length) {
      throw new Error("Parallel audit refused: Vitest preflight left " +
        preflightLeftovers.length + " owned temporary entries (" + preflightAllocated +
        " allocated bytes); no full gates started.");
    }
  }
  const samples=[];
  if (exercise) {
    const root=mkdtempSync(path.join(base,exercise+"-"));
    dirs.push(root);
    const result=await run(root,exercise,exercise);
    const unexpected=entries(root);
    samples.push({run:1,...result,leftoverFiles:unexpected,diskBytes:disk(root)});
    if (result.status !== (exercise === "cancel" ? 143 : 1) || unexpected.length ||
        result.gateReportedCleaned !== true || result.gateAllocatedBeforeCleanupBytes === null ||
        result.samplingErrors) failures.push(exercise+"-unexpected-result");
  } else if (parallel) {
    const roots=[mkdtempSync(path.join(base,"parallel-A-")),mkdtempSync(path.join(base,"parallel-B-"))];
    dirs.push(...roots);
    // Both instances have distinct TMPDIR roots; neither can clean the other's root.
    const results=await Promise.all(roots.map((root,i)=>run(root,"parallel-"+(i+1))));
    for (let i=0;i<roots.length;i++) {
      const unexpected=entries(roots[i]);
      samples.push({run:i+1,...results[i],leftoverFiles:unexpected,diskBytes:disk(roots[i])});
      if (results[i].status!==0 || unexpected.length ||
          results[i].gateReportedCleaned !== true ||
          results[i].gateAllocatedBeforeCleanupBytes === null ||
          results[i].samplingErrors) failures.push("parallel-"+(i+1));
    }
  } else {
    const root=mkdtempSync(path.join(base,"serial-"));
    dirs.push(root);
    for(let i=1;i<=2;i++){
      const result=await run(root,"serial-"+i);
      const unexpected=entries(root);
      samples.push({run:i,...result,leftoverFiles:unexpected,diskBytes:disk(root)});
      if(result.status!==0 || unexpected.length ||
         result.gateReportedCleaned !== true ||
         result.gateAllocatedBeforeCleanupBytes === null ||
         result.samplingErrors){failures.push("serial-"+i);break;}
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
    // We never inspect every other process's /tmp; say what is demonstrated.
    onlyOwnedRootsCleaned:true,sharedTmpNotScanned:true,passed:failures.length===0
  }));
} catch (error) {
  failures.push("audit-preflight-or-runtime-error");
  const reason = error instanceof Error ? error.message : String(error);
  console.error("TEMP_LEAK_AUDIT_ERROR " + reason);
  let after = null;
  let remaining = null;
  try { after = available(); remaining = disk(base); } catch { /* keep diagnostic fail-closed */ }
  console.log("TEMP_LEAK_AUDIT " + JSON.stringify({
    mode: exercise || (parallel ? "parallel" : "serial"),
    passed:false, error:reason, freeBytesBefore:baselineFree,
    freeBytesAfter:after,
    freeBytesDelta:baselineFree === null || after === null ? null : after-baselineFree,
    swapBefore:baselineSwap, swapAfter:swapUsage(),
    ownedAuditBytesBeforeFinalCleanup:remaining,
    sharedTmpNotScanned:true
  }));
} finally {
  // Only this invocation's randomly named audit root; never rm /tmp or wildcard.
  // Child runs have completed before this normal exit path.
  for (const d of dirs) rmSync(d,{recursive:true,force:true});
  rmSync(base,{recursive:true,force:true});
}
if(failures.length){console.error("TEMP_LEAK_AUDIT_FAILED",failures.join(","));process.exitCode=1;}
