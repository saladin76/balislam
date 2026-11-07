import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
// The exporter is a standalone Node script, independent of the React/TS render engine.
// @ts-ignore intentionally importing the standalone .mjs tool
import { normalizeStoryboard, safeImageData, buildStoryboardHtml, exportStoryboard } from "../scripts/studio-storyboard-pdf.mjs";

const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAOwO+wAAAABJRU5ErkJggg==","base64");
const ownedPdfDirs: string[] = [];
afterEach(() => { for (const d of ownedPdfDirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
const setup=()=>{
  const dir=mkdtempSync(path.join(os.tmpdir(),"studio-pdf-"));
  ownedPdfDirs.push(dir);
  writeFileSync(path.join(dir,"landscape.png"),png);
  writeFileSync(path.join(dir,"portrait.png"),png);
  const file=path.join(dir,"manifest.json");
  const data={channel:"dafatir-alzaman",episode:"001",version:"preview-v2",status:"PENDING_REVIEW",scenes:[
    {id:"c1-s1",chapter:1,title:"الفتح",narration:"بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",notes:"مراجعة التشكيل",image:"landscape.png",portraitImage:"portrait.png"},
    {id:"c1-s2",chapter:1,title:"التالي",image:"landscape.png"},
    {id:"c2-s1",chapter:2,title:"الفصل الثاني",image:"landscape.png"},
  ]};
  writeFileSync(file,JSON.stringify(data));
  return {dir,file,data};
};
describe("Arabic-safe shared storyboard PDF exporter",()=>{
  it("retains Arabic diacritics and scene IDs with correct direction, compares both formats",()=>{
    const x=setup();
    const r=buildStoryboardHtml(normalizeStoryboard(x.data,x.file),{chapter:1});
    expect(r.scenes).toBe(2);
    expect(r.status).toBe("PENDING_REVIEW");
    expect(r.html).toContain("بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ");
    expect(r.html).toContain('<bdi dir="ltr">c1-s1</bdi>');
    expect(r.html).toContain("comparison");
    expect(r.html).toContain("عمودي 9:16");
    expect(r.html).toContain("single");
    expect(r.html).toContain("A4 landscape");
    expect(r.html).toContain("غير معتمد");
  });
  it("escapes untrusted input and never grants approval",()=>{
    const x=setup();
    x.data.scenes[0]!.title="<script>bad()</script>";
    x.data.status="APPROVED";
    const r=buildStoryboardHtml(normalizeStoryboard(x.data,x.file));
    expect(r.html).not.toContain("<script>");
    expect(r.html).toContain("&lt;script&gt;");
    expect(r.status).toBe("PENDING_REVIEW");
  });
  it("keeps long narration in printable annexes instead of silently clipping it",()=>{
    const x=setup();
    const txt="حُرُوفٌ وَعَلامَاتُ تَشْكِيلٍ ".repeat(35);
    x.data.scenes[0]!.narration=txt;
    const r=buildStoryboardHtml(normalizeStoryboard(x.data,x.file),{chapter:1});
    expect(r.html).toContain("النص كامل في الملحق");
    expect(r.html).toContain("النص الكامل للمراجعة");
    expect(r.html).toContain(txt.slice(0,40));
  });
  it("rejects paths outside the assets root and preserves the original files",()=>{
    const x=setup();
    expect(()=>safeImageData(x.dir,"../escape.png")).toThrow();
    expect(()=>safeImageData(x.dir,"/tmp/not-allowed.png")).toThrow();
    symlinkSync("/etc/passwd",path.join(x.dir,"linked.png"));
    expect(()=>safeImageData(x.dir,"linked.png")).toThrow();
    expect(existsSync(path.join(x.dir,"landscape.png"))).toBe(true);
  });
  it("creates only new review HTML when requested and refuses replacing versions",()=>{
    const x=setup();
    const before=readFileSync(x.file);
    const output=path.join(x.dir,"storyboard-new-v1.2.pdf");
    const r=exportStoryboard({manifestPath:x.file,pdfPath:output,chapter:1,htmlOnly:true});
    expect(r.status).toBe("PENDING_REVIEW");
    expect(existsSync(r.htmlPath)).toBe(true);
    expect(existsSync(output)).toBe(false);
    expect(readFileSync(x.file).equals(before)).toBe(true);
    expect(()=>exportStoryboard({manifestPath:x.file,pdfPath:output,htmlOnly:true})).toThrow(/overwrite/);
  });
  it("keeps Dafatir chapter one to nine review pages without losing scene c1-s5 narration",()=>{
    const root=path.join(import.meta.dirname,"..");
    const file=path.join(root,"channels/dafatir-alzaman/episodes/001-adam-beginning/tech-reviews/020/docs/storyboard-001-v1.1.json");
    const raw=JSON.parse(readFileSync(file,"utf8"));
    const board=normalizeStoryboard(raw,file);
    const {html,scenes}=buildStoryboardHtml(board,{chapter:1});
    expect(scenes).toBe(9);
    expect((html.match(/<article class="page">/g)??[]).length).toBe(9);
    const scene=raw.scenes.find((s:{id:string;narration:string})=>s.id==="c1-s5");
    expect(scene.narration.length).toBeGreaterThan(135);
    expect(scene.narration.length).toBeLessThanOrEqual(160);
    expect(html).toContain(scene.narration);
    expect(html).not.toContain("النص كامل في الملحق");
    expect(html).toContain("height:121mm");
    expect(html).toContain("height:130mm");
  });
  it("reads actual Dafatir V1.1 and Zubdat v021 without modifying episodes",()=>{
    const root=path.join(import.meta.dirname,"..");
    const p1=path.join(root,"channels/dafatir-alzaman/episodes/001-adam-beginning/tech-reviews/020/docs/storyboard-001-v1.1.json");
    const d=normalizeStoryboard(JSON.parse(readFileSync(p1,"utf8")),p1);
    expect(d.scenes.length).toBe(80);
    expect(d.scenes[0]!.id).toBe("c1-s0");
    expect(safeImageData(d.root,d.scenes[0]!.landscape).sha256).toMatch(/^[a-f0-9]{64}$/);
    const p2=path.join(root,"channels/zubdat-alkutub/episodes/001-awwal-marra-osalli/storyboard-visual/v021/manifest.json");
    const z=normalizeStoryboard(JSON.parse(readFileSync(p2,"utf8")),p2);
    expect(z.scenes.length).toBe(31);
    expect(z.scenes[0]!.id).toBe("c1-s1");
    expect(safeImageData(z.root,z.scenes[0]!.landscape).sha256).toMatch(/^[a-f0-9]{64}$/);
  });
});