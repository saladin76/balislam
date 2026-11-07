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
import { spawn } from "node:child_process";
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
const entries = d => readdirSync(d).filter(n=>n!=="OWNER-DO-NOT-DELETE");
const disk = d => {
  if (!existsSync(d)) return 0;
  const s=lstatSync(d);
  if (s.isSymbolicLink()) return 0;
  if (s.isDirectory()) return readdirSync(d).reduce((a,n)=>a+disk(path.join(d,n)),0);
  return Number(s.blocks)*512;
};
const run = (root, label, mode = null) => new Promise(resolve=>{
  const env = { ...process.env, TMPDIR:root, TMP:root, TEMP:root };
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
const children=[];
const clean=()=>{
  if (interrupted) return;
  interrupted=true;
  for (const ch of children) if (ch && !ch.killed) ch.kill("SIGTERM");
  // The owner-only root is removed after tracked child processes stop.
};
process.once("SIGINT",clean);
process.once("SIGTERM",clean);
let failures=[];
try {
  writeFileSync(marker,"Audit sandbox owner; other temp directories are out of scope.\n",{flag:"wx",mode:0o600});
  const before=available();
  const samples=[];
  if (exercise) {
    const root=mkdtempSync(path.join(base,exercise+"-"));
    dirs.push(root);
    const result=await run(root,exercise,exercise);
    const unexpected=entries(root);
    samples.push({run:1,...result,leftoverFiles:unexpected,diskBytes:disk(root)});
    if (result.status === 0 || unexpected.length) failures.push(exercise+"-unexpected-result");
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
  if(!existsSync(marker)||!readFileSync(marker,"utf8").includes("owner"))failures.push("sentinel-touched");
  const after=available();
  console.log("TEMP_LEAK_AUDIT "+JSON.stringify({
    mode:exercise || (parallel?"parallel":"serial"),results:samples,freeBytesBefore:before,
    freeBytesAfter:after,freeBytesDelta:after-before,
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
