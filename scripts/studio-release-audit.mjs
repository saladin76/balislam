#!/usr/bin/env node
/** Read-only local publication readiness inventory. Never renders, uploads, approves or deletes. */
import {createHash} from "node:crypto";
import {existsSync, readFileSync, readdirSync, statSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const NAMES = {balislam:"بالإسلام","dafatir-alzaman":"دفاتر الزمن","zubdat-alkutub":"زبدة الكتب"};
const stat = p => {try{return statSync(p)}catch{return null}};
const size = p => stat(p)?.isFile() ? stat(p).size : 0;
const json = p => {try{return JSON.parse(readFileSync(p,"utf8"))}catch{return null}};
export const sceneFingerprint = s => {
  const props=Object.fromEntries(Object.entries(s.props??{}).filter(([,v])=>v!==""&&v!=null).sort(([a],[b])=>a.localeCompare(b)));
  return createHash("sha1").update(JSON.stringify({v:2,t:s.template,p:props,n:(s.narration??"").trim(),tone:s.tone??"",voice:s.voice??"",bg:s.backdrop??"",duration:s.durationSec??null,sfx:s.sfx??[],overlays:s.overlays??{},captions:s.captions??null,ayahKey:s.ayahKey??"",...(s.transition?{transition:s.transition}:{})})).digest("hex").slice(0,12);
};
export const inspectEpisode = (root,channel,episode) => {
  const dir=path.join(root,"channels",channel,"episodes",episode),reasons=[],warnings=[];
  const required=(ok,msg)=>{if(!ok)reasons.push(msg)};
  required(size(path.join(dir,"script.md"))>0,"السكريبت غير موجود");
  const plan=json(path.join(dir,"plan.json"));
  const scenes=Array.isArray(plan?.chapters)?plan.chapters.flatMap(c=>Array.isArray(c.scenes)?c.scenes:[]):[];
  required(scenes.length>0,"خطة المشاهد غير موجودة أو فارغة");
  const board=json(path.join(dir,"storyboard.json"));
  const boardOk=scenes.filter(s=>board?.scenes?.[s.id]===sceneFingerprint(s)).length;
  required(scenes.length>0&&boardOk===scenes.length,"اعتماد Storyboard صحيح في "+boardOk+"/"+scenes.length+" مشهد");
  const ledger=json(path.join(dir,"scene-review.json"));
  const sceneOk=scenes.filter(s=>ledger?.scenes?.[s.id]?.status==="ok"&&ledger.scenes[s.id].hash===sceneFingerprint(s)).length;
  const sceneFix=scenes.filter(s=>ledger?.scenes?.[s.id]?.status==="fix"&&ledger.scenes[s.id].hash===sceneFingerprint(s)).length;
  required(scenes.length>0&&sceneOk===scenes.length,"المشاهد المعتمدة "+sceneOk+"/"+scenes.length+(sceneFix?"؛ "+sceneFix+" تحتاج إصلاحا":""));
  const voice=json(path.join(dir,"voice","index.json"))??{};
  const narrated=scenes.filter(s=>typeof s.narration==="string"&&s.narration.trim());
  const voiced=narrated.filter(s=>{
    const v=voice[s.id];
    return v&&v.text===s.narration.trim()&&typeof v.file==="string"&&/^[A-Za-z0-9_.-]+$/.test(v.file)&&!v.file.startsWith(".")&&size(path.join(dir,"voice",v.file))>0;
  }).length;
  required(narrated.length>0&&voiced===narrated.length,"الصوت المطابق "+voiced+"/"+narrated.length+" مشهد منطوق");
  const citation=json(path.join(dir,"review.json"));
  warnings.push(citation?"سجل التوثيق موجود؛ لا يمكن اعتبار بصماته معتمدة إلا بعد bal review":"سجل التوثيق غائب؛ يلزم bal review");
  const pkg=path.join(dir,"out","package");
  const id=typeof plan?.episode==="string"&&plan.episode?plan.episode:episode.slice(0,3);
  const movie=path.join(pkg,id+"-episode.mp4");
  const info=json(path.join(pkg,"render.json"));
  const masterAvailable=size(movie)>100_000;
  required(masterAvailable,"ملف master MP4 غير موجود أو حجمه صغير");
  required(info?.quality==="master"&&info?.voiced===true,"render.json لا يثبت master بصوت كامل");
  const status=json(path.join(dir,"status.json"));
  const movieStat=stat(movie);
  const approved=Boolean(status?.approved&&movieStat&&movieStat.isFile()&&movieStat.size===status.approved.size&&Math.abs(movieStat.mtimeMs-status.approved.mtime)<1);
  required(approved,"اعتماد المالك للنسخة الأساسية غير موجود أو لم يعد مطابقا لبصمة الفيديو");
  for(const name of ["youtube.md","social.md","publish-checklist.md"])required(size(path.join(pkg,name))>0,"ملف النشر مفقود: "+name);
  const names=stat(pkg)?.isDirectory()?readdirSync(pkg):[];
  required(names.some(n=>n.startsWith(id+"-episode.")&&n.endsWith(".srt")),"SRT غير موجود");
  required(names.some(n=>n.startsWith(id+"-thumbnail-")&&n.endsWith(".png")),"الصورة المصغرة غير موجودة");
  if(!size(path.join(dir,"publish.json")))warnings.push("تحقق من عنوان ووصف ومحتوى النشر؛ publish.json غير موجود");
  warnings.push("هذا جرد فقط؛ لا يغني عن bal check/review/storyboard/scenes-review، أو فحص الفيديو كاملا بسرعة طبيعية، أو حقوق المواد والاعتماد النهائي");
  return {channel,channelName:NAMES[channel],episode,sceneTotal:scenes.length,boardOk,sceneOk,sceneFix,narrated:narrated.length,voiced,masterAvailable,masterQuality:info?.quality??null,masterVoiced:info?.voiced===true,approved,state:reasons.length?"BLOCKED":"READY_FOR_FINAL_HUMAN_REVIEW",reasons,warnings};
};
export const inspect=(root,episode="001",channels=Object.keys(NAMES))=>channels.map(channel=>{
  const eps=path.join(root,"channels",channel,"episodes");
  const list=stat(eps)?.isDirectory()?readdirSync(eps).filter(n=>n.startsWith(episode+"-")&&size(path.join(eps,n,"script.md"))>0):[];
  if(list.length!==1)return {channel,channelName:NAMES[channel],episode,state:"BLOCKED",reasons:["عدد الحلقات "+episode+" ذات سكريبت: "+list.length+"؛ المطلوب واحدة"],warnings:[]};
  return inspectEpisode(root,channel,list[0]);
});
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2),flag=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1]};
  const root=path.resolve(flag("--root",process.cwd())),episode=flag("--episode","001"),selected=flag("--channel",null);
  if(!/^\d{3}$/.test(episode)||(selected!==null&&!Object.hasOwn(NAMES,selected))){console.error("Usage: node studio-release-audit.mjs --root /path/to/channel-worktree --episode 001 [--channel balislam|dafatir-alzaman|zubdat-alkutub] [--json]");process.exitCode=2;}
  else{
    const results=inspect(root,episode,selected?[selected]:Object.keys(NAMES));
    if(args.includes("--json"))console.log(JSON.stringify({root,episode,results},null,2));
    else{
      console.log("Studio LOCAL release audit — READ ONLY; no render, upload or publication. Root: "+root+"\nIf channels use different Git worktrees, run --channel separately with each exact worktree root.\n");
      for(const r of results){
        console.log((r.state==="BLOCKED"?"✗ ":"✓ ")+r.channelName+" / "+r.episode+" — "+r.state);
        if(r.sceneTotal!==undefined)console.log("  Storyboard "+r.boardOk+"/"+r.sceneTotal+"; scenes "+r.sceneOk+"/"+r.sceneTotal+"; voice "+r.voiced+"/"+r.narrated+"; master "+(r.masterAvailable?"exists":"missing")+"; owner approval "+(r.approved?"valid":"missing"));
        for(const item of r.reasons)console.log("  BLOCK: "+item);
        for(const item of r.warnings)console.log("  NOTE: "+item);
      }
    }
    if(results.some(r=>r.state==="BLOCKED"))process.exitCode=1;
  }
}
