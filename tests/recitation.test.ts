import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prepareOwnRecitation, approveOwnRecitation, ownAudioStatus } from "../src/quran/manualAudio";
import { saveManualQuranText } from "../src/quran/fillMissingText";
import { collectMedia } from "../src/plan/collect";
import { regeneratePlan } from "../src/plan/io";

const old = { root:process.env.BAL_CHANNELS_DIR, channel:process.env.BAL_CHANNEL };
let tmp="";
let sample:Buffer;
const episode = () => path.join(tmp,"balislam","episodes","000-demo");
const audioDir = () => path.join(episode(),"recitations");
const verse="وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ";
beforeAll(()=>{
  tmp=mkdtempSync(path.join(os.tmpdir(),"bal-own-recitation-"));
  const channel=path.join(tmp,"balislam");
  cpSync(path.join(import.meta.dirname,"..","channels","balislam"),channel,{
    recursive:true,filter:s=>!/[\\/](episodes|voice|out|recitations)([\\/]|$)/.test(s),
  });
  mkdirSync(path.join(channel,"episodes"),{recursive:true});
  cpSync(path.join(import.meta.dirname,"fixtures","episodes","000-demo"),episode(),{recursive:true});
  process.env.BAL_CHANNELS_DIR=tmp;
  process.env.BAL_CHANNEL="balislam";
  const f=path.join(tmp,"source.mp3");
  execFileSync("ffmpeg",["-nostdin","-hide_banner","-loglevel","error","-y","-f","lavfi",
    "-i","sine=frequency=220:duration=1.4","-c:a","libmp3lame",f]);
  sample=readFileSync(f);
});
beforeEach(async()=>{
  await rm(audioDir(),{recursive:true,force:true});
  await rm(path.join(episode(),"quran.json"),{force:true});
  await rm(path.join(episode(),"quran.json.manual.lock"),{force:true});
});
afterAll(async()=>{
  if(old.root===undefined) delete process.env.BAL_CHANNELS_DIR;
  else process.env.BAL_CHANNELS_DIR=old.root;
  if(old.channel===undefined) delete process.env.BAL_CHANNEL;
  else process.env.BAL_CHANNEL=old.channel;
  if(tmp)await rm(tmp,{recursive:true,force:true});
});
describe("Owner Quran recording: no remote reciters or unreviewed render",()=>{
  it("rejects unexpected verses, unsafe file types and oversized data before writing",async()=>{
    await expect(prepareOwnRecitation("000","1:1","recitation.mp3",sample)).rejects.toThrow(/غير موجود/);
    await expect(prepareOwnRecitation("000","53:39","recording.exe",sample)).rejects.toThrow(/يجب أن يكون/);
    await expect(prepareOwnRecitation("000","53:39","audio.mp3",Buffer.alloc(25*1024*1024+1))).rejects.toThrow(/ميجابايت/);
    expect(existsSync(audioDir())).toBe(false);
  });
  it("prepares a clean audio candidate but does not allow it into render before signoff",async()=>{
    const r=await prepareOwnRecitation("000","53:39","my-voice.mp3",sample);
    expect(r.duration).toBeGreaterThan(1);
    expect(r.file).toMatch(/^manual-53-39-[a-f0-9]{12}\.mp3$/);
    expect(r.originalSha256).toMatch(/^[a-f0-9]{64}$/);
    const state=await ownAudioStatus("000");
    expect(state.pending["53:39"]?.file).toBe(r.file);
    expect(state.approved["53:39"]).toBeUndefined();
    const plan=await regeneratePlan("000");
    const media=await collectMedia("000",plan);
    expect(media.recitations["53:39"]).toBeUndefined();
    expect(existsSync(path.join(audioDir(),r.file))).toBe(true);
  },30000);
  it("requires text, actual listening and reviewer note before approval",async()=>{
    await prepareOwnRecitation("000","53:39","my-voice.mp3",sample);
    await expect(approveOwnRecitation("000","53:39","reviewer","سمعت النص كاملًا",true,"قارئ الاختبار")).rejects.toThrow(/نص الآية/);
    await saveManualQuranText("000","53:39",verse);
    await expect(approveOwnRecitation("000","53:39","reviewer","سمعت النص كاملًا",false,"قارئ الاختبار")).rejects.toThrow(/استمع/);
    await expect(approveOwnRecitation("000","53:39","reviewer","short",true,"قارئ الاختبار")).rejects.toThrow(/ملاحظة/);
    // الأمر 024: لا يُفترض أن صاحب القناة هو القارئ
    await expect(approveOwnRecitation("000","53:39","مراجع","استمعت إلى الملف كاملًا وتأكدت من تلاوة الآية",true)).rejects.toThrow(/القارئ/);
    const ready=await approveOwnRecitation("000","53:39","مراجع","استمعت إلى الملف كاملًا وتأكدت من تلاوة الآية",true,"قارئ الاختبار");
    expect(ready.reciter).toBe("قارئ الاختبار");
    expect(ready.provider).toBe("manual");
    expect(ready.approvedAt).toBeTruthy();
    expect((await ownAudioStatus("000")).pending["53:39"]).toBeUndefined();
    const plan=await regeneratePlan("000");
    const media=await collectMedia("000",plan);
    expect(media.recitations["53:39"]?.source).toBe("manual");
    expect(media.recitations["53:39"]?.duration).toBeGreaterThan(1);
  },30000);
  it("refuses a second pending recording instead of overwriting the first",async()=>{
    const first=await prepareOwnRecitation("000","53:39","my-voice.mp3",sample);
    await expect(prepareOwnRecitation("000","53:39","my-voice.mp3",sample)).rejects.toThrow(/ينتظر المراجعة/);
    expect((await ownAudioStatus("000")).pending["53:39"]?.file).toBe(first.file);
  },30000);
  it("ignores historical external index files without deleting their bytes",async()=>{
    mkdirSync(audioDir(),{recursive:true});
    const index=path.join(audioDir(),"index.json");
    const oldEntry={ "53:39":{parts:[{file:"old.mp3",duration:2}],reciter:"legacy",
      provider:"quran-foundation",recitationId:6,fetchedAt:new Date().toISOString()} };
    writeFileSync(path.join(audioDir(),"old.mp3"),sample);
    writeFileSync(index,JSON.stringify(oldEntry));
    const original=readFileSync(index);
    const plan=await regeneratePlan("000");
    const media=await collectMedia("000",plan);
    expect(media.recitations["53:39"]).toBeUndefined();
    expect(readFileSync(index).equals(original)).toBe(true);
    expect(existsSync(path.join(audioDir(),"old.mp3"))).toBe(true);
  });
});
