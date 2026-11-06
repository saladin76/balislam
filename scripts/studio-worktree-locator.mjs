#!/usr/bin/env node
/**
 * Read-only locator for episode scripts across explicitly registered Git worktrees.
 * This is NOT the cloud preview scanner: no uploading, hashing, media reading,
 * sorting by "latest", writing, approvals, or automatic worktree selection.
 */
import {execFileSync} from "node:child_process";
import {existsSync, readdirSync, statSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const CHANNELS = [
  ["balislam", "بالإسلام"],
  ["dafatir-alzaman", "دفاتر الزمن"],
  ["zubdat-alkutub", "زبدة الكتب"],
];

const isDir = p => {try{return statSync(p).isDirectory()}catch{return false}};
const isFile = p => {try{return statSync(p).isFile()}catch{return false}};
const entries = p => {try{return readdirSync(p)}catch{return []}};

export const parseGitWorktrees = source => {
  const rows=[];
  for(const block of source.split(/\r?\n\r?\n/)){
    const obj={};
    for(const line of block.split(/\r?\n/)){
      if(line.startsWith("worktree "))obj.root=line.slice("worktree ".length);
      else if(line.startsWith("HEAD "))obj.sha=line.slice("HEAD ".length);
      else if(line.startsWith("branch "))obj.branch=line.slice("branch ".length).replace(/^refs\/heads\//,"");
      else if(line==="detached")obj.branch="(detached)";
      else if(line==="prunable"||line.startsWith("prunable "))obj.prunable=true;
      else if(line==="locked"||line.startsWith("locked "))obj.locked=true;
    }
    if(obj.root)rows.push(obj);
  }
  return rows;
};

export const locateEpisodeAtRoot = (root, channel, episode="001") => {
  if(!/^\d{3}$/.test(episode))throw new Error("Episode must be exactly three digits");
  if(!CHANNELS.some(([id])=>id===channel))throw new Error("Unknown channel");
  const base=path.join(root,"channels",channel,"episodes");
  const matching=entries(base).filter(name => name.startsWith(episode+"-") &&
    isDir(path.join(base,name)) && isFile(path.join(base,name,"script.md")));
  return matching.map(dir=>{
    const d=path.join(base,dir), pkg=path.join(d,"out","package");
    return {
      channel,episodeDir:dir,folder:d,
      script:true,plan:isFile(path.join(d,"plan.json")),
      storyboard:isFile(path.join(d,"storyboard.json")),
      sceneReview:isFile(path.join(d,"scene-review.json")),
      sourceReview:isFile(path.join(d,"review.json")),
      voiceIndex:isFile(path.join(d,"voice","index.json")),
      previewMedia:entries(path.join(d,"previews")).some(n=>n.endsWith(".mp4")),
      masterMedia:entries(pkg).some(n=>n.endsWith("-episode.mp4")),
      renderInfo:isFile(path.join(pkg,"render.json"))
    };
  });
};

export const locateInRegisteredWorktrees = (worktrees, episode="001") => {
  const result=[];
  for(const w of worktrees){
    // Only metadata of a known, non-prunable worktree. No recursive traversal.
    if(w.prunable || !isDir(w.root))continue;
    for(const [channel,name] of CHANNELS){
      for(const ep of locateEpisodeAtRoot(w.root,channel,episode)){
        result.push({root:w.root,branch:w.branch??"(unknown)",sha:w.sha??"",channel,name,...ep});
      }
    }
  }
  return result;
};

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  const get=(key,fallback)=>{const idx=args.indexOf(key);return idx>=0?args[idx+1]:fallback};
  const repo=path.resolve(get("--repo",process.cwd())), episode=get("--episode","001");
  if(!/^\d{3}$/.test(episode)){
    console.error("Usage: node studio-worktree-locator.mjs --repo /path/to/balislam --episode 001 [--json]");
    process.exitCode=2;
  }else{
    try{
      const porcelain=execFileSync("git",["-C",repo,"worktree","list","--porcelain"],{
        encoding:"utf8",timeout:10000,stdio:["ignore","pipe","pipe"]
      });
      const worktrees=parseGitWorktrees(porcelain);
      const results=locateInRegisteredWorktrees(worktrees,episode);
      if(args.includes("--json"))console.log(JSON.stringify({worktreeCount:worktrees.length,episode,results},null,2));
      else{
        console.log("Studio worktree LOCATOR — read-only paths, not approval or most-recent version.");
        console.log("Registered Git worktrees: "+worktrees.length+"; episode scripts found: "+results.length);
        for(const [channel,name] of CHANNELS){
          console.log("\n"+name+" — "+channel);
          const found=results.filter(x=>x.channel===channel);
          if(!found.length)console.log("  لا يوجد سكريبت مطابق للحلقة "+episode+" داخل Git worktrees المسجّلة.");
          for(const x of found){
            console.log("  "+x.root+" ["+x.branch+"]");
            console.log("    "+x.episodeDir+" | plan="+(x.plan?"yes":"no")+
              " | storyboard="+(x.storyboard?"yes":"no")+
              " | review="+(x.sceneReview?"yes":"no")+
              " | sources="+(x.sourceReview?"yes":"no")+
              " | voice-index="+(x.voiceIndex?"yes":"no")+
              " | preview="+(x.previewMedia?"yes":"no")+
              " | master="+(x.masterMedia?"yes":"no"));
          }
        }
        console.log("\nIMPORTANT: several worktrees may contain stale or divergent copies. These flags show file presence only.");
        console.log("Select each channel's authoritative worktree by its actual production history; DO NOT auto-pick a file by timestamp.");
        console.log('Then run: node "$HOME/Balislam-Preview-Sync/release-audit/scripts/studio-release-audit.mjs" --root "/ABSOLUTE/WORKTREE" --channel CHANNEL_ID --episode '+episode);
      }
    }catch(e){console.error("Locator could not read registered Git worktrees: "+(e?.message??e));process.exitCode=2}
  }
}
