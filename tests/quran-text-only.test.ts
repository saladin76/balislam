import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { inspectMissingQuranTexts, saveManualQuranText } from "../src/quran/fillMissingText";

let tmp = "";
const original = { directory: process.env.BAL_CHANNELS_DIR, channel: process.env.BAL_CHANNEL };
const verseText = "وَأَنْ لَيْسَ لِلْإِنْسَانِ إِلَّا مَا سَعَىٰ";
const file = () => path.join(tmp, "balislam", "episodes", "999-demo", "quran.json");
const script = () => path.join(tmp, "balislam", "episodes", "999-demo", "script.md");
const plan = () => path.join(tmp, "balislam", "episodes", "999-demo", "plan.json");
beforeAll(()=>{
  tmp=mkdtempSync(path.join(os.tmpdir(),"bal-manual-quran-"));
  const dir=path.join(tmp,"balislam");
  cpSync(path.join(import.meta.dirname,"..","channels","balislam"),dir,{
    recursive:true,filter:src=>!/[\\/](episodes|voice|out|recitations)([\\/]|$)/.test(src),
  });
  mkdirSync(path.join(dir,"episodes"),{recursive:true});
  cpSync(path.join(import.meta.dirname,"fixtures","episodes","000-demo"),path.join(dir,"episodes","999-demo"),{recursive:true});
  process.env.BAL_CHANNELS_DIR=tmp;
  process.env.BAL_CHANNEL="balislam";
});
beforeEach(async()=>{
  await rm(file(),{force:true});
  await rm(file()+".manual.lock",{force:true});
});
afterAll(async()=>{
  if(original.directory===undefined)delete process.env.BAL_CHANNELS_DIR;
  else process.env.BAL_CHANNELS_DIR=original.directory;
  if(original.channel===undefined)delete process.env.BAL_CHANNEL;
  else process.env.BAL_CHANNEL=original.channel;
  if(tmp)await rm(tmp,{recursive:true,force:true});
});
describe("Manual owner-supplied Quran verses: no Foundation or automatic writes",()=>{
  it("lists requested ayahs from the script with explicit labels and no file writes",async()=>{
    const r=await inspectMissingQuranTexts("999");
    expect(r.missing).toContain("53:39");
    expect(r.required.find(v=>v.key==="53:39")?.status).toBe("missing");
    expect(existsSync(file())).toBe(false);
  });
  it("persists exact supplied tashkeel and preserves the script and plan byte-for-byte",async()=>{
    const s=readFileSync(script()),p=existsSync(plan())?readFileSync(plan()):null;
    const result=await saveManualQuranText("999","53:39",verseText);
    expect(result.saved).toBe(true);
    const data=JSON.parse(readFileSync(file(),"utf8"));
    expect(data["53:39"]).toBe(verseText);
    expect(data["53:39#source"]).toBe("manual-owner");
    expect(data["53:39#at"]).toBeTruthy();
    expect(readFileSync(script()).equals(s)).toBe(true);
    expect(existsSync(plan())?readFileSync(plan()).equals(p!):p===null).toBe(true);
    expect(result.status.missing).not.toContain("53:39");
  });
  it("does not replace a different existing ayah, even if the caller demands it",async()=>{
    await saveManualQuranText("999","53:39",verseText);
    const previous=readFileSync(file());
    await expect(saveManualQuranText("999","53:39","نص مختلف")).rejects.toThrow(/لا يُستبدل/);
    expect(readFileSync(file()).equals(previous)).toBe(true);
  });
  it("does not rewrite the exact same text when submitted twice",async()=>{
    await saveManualQuranText("999","53:39",verseText);
    const previous=readFileSync(file());
    const same=await saveManualQuranText("999","53:39",verseText);
    expect(same.saved).toBe(false);
    expect(readFileSync(file()).equals(previous)).toBe(true);
  });
  it("rejects unrequested or malformed refs without producing an ayah cache",async()=>{
    await expect(saveManualQuranText("999","1:1",verseText)).rejects.toThrow(/غير مطلوبة/);
    await expect(saveManualQuranText("999","../../bad",verseText)).rejects.toThrow(/غير صالح/);
    expect(existsSync(file())).toBe(false);
  });
  it("rejects missing Arabic text and embedded markup",async()=>{
    await expect(saveManualQuranText("999","53:39","No Arabic")).rejects.toThrow(/غير صالح/);
    await expect(saveManualQuranText("999","53:39","<script>س</script>")).rejects.toThrow(/غير صالح/);
    expect(existsSync(file())).toBe(false);
  });
  it("rejects simultaneous writes under the same lock and preserves the existing file",async()=>{
    writeFileSync(file(),JSON.stringify({safe:"أصل محفوظ"}));
    const previous=readFileSync(file());
    writeFileSync(file()+".manual.lock","other owner");
    await expect(saveManualQuranText("999","53:39",verseText)).rejects.toThrow(/متزامن/);
    expect(readFileSync(file()).equals(previous)).toBe(true);
  });
});
