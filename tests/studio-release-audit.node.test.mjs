import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,statSync} from "node:fs";
import path from "node:path";
import {tmpdir} from "node:os";
import {inspect,inspectEpisode,sceneFingerprint} from "../scripts/studio-release-audit.mjs";
const root = () => mkdtempSync(path.join(tmpdir(),"studio-audit-"));
const put = (p,body) => {mkdirSync(path.dirname(p),{recursive:true});writeFileSync(p,body);};
const js = (p,v) => put(p,JSON.stringify(v));
test("missing approvals and media block release without touching sources",()=>{
  const base=root(),d=path.join(base,"channels","balislam","episodes","001-test");
  put(path.join(d,"script.md"),"test");
  js(path.join(d,"plan.json"),{episode:"001",chapters:[{scenes:[{id:"s1",template:"title",narration:"hello",props:{}}]}]});
  const snapshot=readFileSync(path.join(d,"plan.json"),"utf8");
  const r=inspectEpisode(base,"balislam","001-test");
  assert.equal(r.state,"BLOCKED");
  assert.equal(r.sceneOk,0);assert.equal(r.boardOk,0);assert.equal(r.voiced,0);
  assert.equal(readFileSync(path.join(d,"plan.json"),"utf8"),snapshot);
});
test("correct fingerprints and master still only permit final human review",()=>{
  const base=root(),d=path.join(base,"channels","balislam","episodes","001-test");
  const scene={id:"s1",template:"title",narration:"hello",props:{a:"b"}};
  put(path.join(d,"script.md"),"test");
  js(path.join(d,"plan.json"),{episode:"001",chapters:[{scenes:[scene]}]});
  const hash=sceneFingerprint(scene);
  js(path.join(d,"storyboard.json"),{scenes:{s1:hash}});
  js(path.join(d,"scene-review.json"),{scenes:{s1:{status:"ok",hash}}});
  js(path.join(d,"voice","index.json"),{s1:{text:"hello",file:"a.mp3"}});
  put(path.join(d,"voice","a.mp3"),"audio");
  const pkg=path.join(d,"out","package"),movie=path.join(pkg,"001-episode.mp4");
  put(movie,Buffer.alloc(100001));const s=statSync(movie);
  js(path.join(d,"status.json"),{approved:{size:s.size,mtime:s.mtimeMs,at:"2026-11-06T00:00:00Z"}});
  js(path.join(pkg,"render.json"),{quality:"master",voiced:true});
  for(const f of ["youtube.md","social.md","publish-checklist.md","001-episode.ar.srt","001-thumbnail-1.png"])put(path.join(pkg,f),"x");
  const r=inspectEpisode(base,"balislam","001-test");
  assert.equal(r.state,"READY_FOR_FINAL_HUMAN_REVIEW");
  assert.equal(r.boardOk,1);assert.equal(r.sceneOk,1);assert.equal(r.voiced,1);
  assert.ok(r.warnings.some(x=>x.includes("فحص الفيديو")));
});
test("changed scene hashes invalidate approvals",()=>{
  const base=root(),d=path.join(base,"channels","balislam","episodes","001-test");
  put(path.join(d,"script.md"),"test");
  js(path.join(d,"plan.json"),{chapters:[{scenes:[{id:"s1",template:"title",narration:"hello",props:{}}]}]});
  js(path.join(d,"storyboard.json"),{scenes:{s1:"stale"}});
  js(path.join(d,"scene-review.json"),{scenes:{s1:{status:"ok",hash:"stale"}}});
  const r=inspectEpisode(base,"balislam","001-test");
  assert.equal(r.boardOk,0);assert.equal(r.sceneOk,0);assert.equal(r.state,"BLOCKED");
});
test("inspects all 3 channels independently and excludes lab-only dirs",()=>{
  const base=root();
  for(const ch of ["balislam","dafatir-alzaman","zubdat-alkutub"]){
    js(path.join(base,"channels",ch,"episodes","900-lab","plan.json"),{});
    put(path.join(base,"channels",ch,"episodes","001-valid","script.md"),"test");
  }
  const r=inspect(base);
  assert.deepEqual(r.map(x=>x.episode),["001-valid","001-valid","001-valid"]);
  assert.ok(r.every(x=>x.state==="BLOCKED"));
});

test("explicit --channel root scan does not mix different worktrees",()=>{
  const base=root();
  put(path.join(base,"channels","zubdat-alkutub","episodes","001-only","script.md"),"test");
  const r=inspect(base,"001",["zubdat-alkutub"]);
  assert.equal(r.length,1);assert.equal(r[0].channel,"zubdat-alkutub");
  assert.equal(r[0].episode,"001-only");
});
