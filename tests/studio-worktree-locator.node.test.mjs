import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {parseGitWorktrees,locateEpisodeAtRoot,locateInRegisteredWorktrees} from "../scripts/studio-worktree-locator.mjs";

const root=()=>mkdtempSync(path.join(tmpdir(),"studio-locator-"));
const put=(file,data="x")=>{mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,data)};

test("parses exact registered Git worktrees, including names with spaces, detach and prunable",()=>{
  const text=[
    "worktree /Users/sword/balislam",
    "HEAD abc",
    "branch refs/heads/review/balislam-directed",
    "",
    "worktree /Users/sword/a channel worktree",
    "HEAD def",
    "detached",
    "",
    "worktree /Users/sword/removed",
    "HEAD 123",
    "prunable gitdir file points to non-existent location",
    ""
  ].join("\n");
  assert.deepEqual(parseGitWorktrees(text),[
    {root:"/Users/sword/balislam",sha:"abc",branch:"review/balislam-directed"},
    {root:"/Users/sword/a channel worktree",sha:"def",branch:"(detached)"},
    {root:"/Users/sword/removed",sha:"123",prunable:true}
  ]);
});

test("only episode folders with an actual script are located, never plan-only labs",()=>{
  const r=root();
  put(path.join(r,"channels","balislam","episodes","001-real","script.md"));
  put(path.join(r,"channels","balislam","episodes","001-real","plan.json"),"{}");
  put(path.join(r,"channels","balislam","episodes","001-archive","plan.json"),"{}");
  put(path.join(r,"channels","balislam","episodes","900-lab","script.md"));
  const res=locateEpisodeAtRoot(r,"balislam","001");
  assert.equal(res.length,1);
  assert.equal(res[0].episodeDir,"001-real");
  assert.equal(res[0].plan,true);
  assert.equal(res[0].masterMedia,false);
});

test("worktree locator does not mutate, rank or silently choose between divergent candidates",()=>{
  const a=root(),b=root();
  for(const r of [a,b])put(path.join(r,"channels","zubdat-alkutub","episodes","001-real","script.md"),"unchanged");
  const worktrees=[{root:a,branch:"older",sha:"111"},{root:b,branch:"newer",sha:"222"}];
  const found=locateInRegisteredWorktrees(worktrees);
  assert.equal(found.length,2);
  assert.deepEqual(found.map(x=>x.root),[a,b]);
  assert.equal(readFileSync(path.join(a,"channels","zubdat-alkutub","episodes","001-real","script.md"),"utf8"),"unchanged");
  assert.equal(readFileSync(path.join(b,"channels","zubdat-alkutub","episodes","001-real","script.md"),"utf8"),"unchanged");
});

test("rejects invalid IDs instead of traversing unrelated paths",()=>{
  assert.throws(()=>locateEpisodeAtRoot(root(),"balislam","../"),/digits/);
  assert.throws(()=>locateEpisodeAtRoot(root(),"unknown","001"),/Unknown channel/);
});
