import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
// The exporter is a standalone Node script, independent of the React/TS render engine.
// @ts-ignore intentionally importing the standalone .mjs tool
import { normalizeStoryboard, safeImageData, buildStoryboardHtml, exportStoryboard, pdfFontCss, splitAppendixText } from "../scripts/studio-storyboard-pdf.mjs";

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
  it("embeds channel-specific Arabic fonts, isolates bidi and keeps full diacritics without OS fallback",()=>{
    const x=setup();
    for(const channel of ["balislam","dafatir-alzaman","zubdat-alkutub"]){
      x.data.channel=channel;
      const r=buildStoryboardHtml(normalizeStoryboard(x.data,x.file),{chapter:1});
      expect(r.html).toContain("@font-face");
      expect(r.html).toContain("data:font/");
      expect(r.html).toContain("font-synthesis:none");
      expect(r.html).toContain('lang="ar" dir="rtl"');
      expect(r.html).toContain('<bdi dir="ltr">c1-s1</bdi>');
      expect(r.html).toContain("بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ");
      expect(r.html).not.toContain("'Noto Naskh Arabic'");
      expect(r.html).not.toContain("Tahoma,Arial");
    }
  });
  it("uses the exact local Arabic font files and distinct accents for all three channels",()=>{
    const root=path.join(import.meta.dirname,"..","public","fonts");
    const mappings=[
      {channel:"balislam",font:"ElMessiri.ttf",body:"IBMPlexSansArabic-Medium.ttf",accent:"#245b4c"},
      {channel:"dafatir-alzaman",font:"Amiri-Bold.ttf",body:"Amiri-Regular.ttf",accent:"#18475b"},
      {channel:"zubdat-alkutub",font:"Tajawal-arabic-700.woff2",body:"Tajawal-arabic-400.woff2",accent:"#85653a"},
    ];
    const faces=new Set<string>();
    for(const {channel,font,body,accent} of mappings){
      const css=pdfFontCss(channel);
      expect(css).toContain("--studio-accent:"+accent);
      const headingBase64=readFileSync(path.join(root,font)).toString("base64");
      const bodyBase64=readFileSync(path.join(root,body)).toString("base64");
      expect(css).toContain(headingBase64);
      expect(css).toContain(bodyBase64);
      faces.add(headingBase64);
    }
    expect(faces.size).toBe(3);
  });
  it("keeps Arabic graphemes, emoji and hard line breaks intact across annex pages",()=>{
    const source="بِّ".repeat(210)+"🙂"+"\\n".repeat(27)+"وَصْفٌ".repeat(36);
    const chunks=splitAppendixText(source);
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.join("")).toBe(source);
    for(const chunk of chunks){
      expect(chunk.length).toBeLessThanOrEqual(400);
      expect(chunk).not.toMatch(/^[\\u064B-\\u065F]/u);
      expect(chunk).not.toMatch(/[\\uD800-\\uDBFF]$/u);
      expect(chunk).not.toMatch(/^[\\uDC00-\\uDFFF]/u);
    }
    const x=setup();
    x.data.scenes[0]!.narration=source;
    const result=buildStoryboardHtml(normalizeStoryboard(x.data,x.file),{chapter:1});
    expect((result.html.match(/<section class="appendix">/g)??[]).length).toBe(chunks.length);
    for(const chunk of chunks) expect(result.html).toContain(chunk);
    expect(result.html).toContain("النص كامل في الملحق");
  });
  it("preserves multiline and long Arabic titles on dedicated annex pages without changing approved chapters",()=>{
    const x=setup();
    const longTitle="الْعُنْوَانُ الْكَامِلُ ".repeat(12);
    const longChapter="فَصْلٌ مُفَصَّلٌ ".repeat(55);
    x.data.scenes[0]!.title=longTitle;
    x.data.scenes[0]!.chapterTitle=longChapter;
    x.data.scenes[1]!.chapterTitle=longChapter;
    x.data.scenes[0]!.notes="السطر الأول\\nالسطر الثاني\\nالسطر الثالث\\nالسطر الرابع";
    const r=buildStoryboardHtml(normalizeStoryboard(x.data,x.file),{chapter:1,chapterCover:true});
    expect(r.scenes).toBe(2);
    expect((r.html.match(/class="page cover"/g)??[]).length).toBe(1);
    expect(r.html).toContain("عنوان الفصل");
    expect(r.html).toContain("عنوان المشهد");
    expect(r.html).toContain("الوصف والملاحظات");
    expect(r.html).toContain("السطر الرابع");
    for(const part of splitAppendixText(longTitle)) expect(r.html).toContain(part);
    for(const part of splitAppendixText(longChapter)) expect(r.html).toContain(part);
  });
  it("prints isolated balislam and Zubdat synthetic chapters without mixed fonts or approvals",()=>{
    const x=setup();
    for(const channel of ["balislam","zubdat-alkutub"]){
      x.data.channel=channel;
      x.data.scenes[0]!.chapterTitle="بِدَايَةُ الْحِكَايَةِ";
      x.data.scenes[1]!.chapterTitle="بِدَايَةُ الْحِكَايَةِ";
      const r=buildStoryboardHtml(normalizeStoryboard(x.data,x.file),{chapter:1,chapterCover:true});
      expect(r.status).toBe("PENDING_REVIEW");
      expect(r.scenes).toBe(2);
      expect((r.html.match(/<article class="page(?: cover)?"/g)??[]).length).toBe(3);
      expect(r.html).toContain("بِدَايَةُ الْحِكَايَةِ");
      expect(r.html).toContain('<bdi dir="ltr">c1-s1</bdi>');
      expect(r.html).toContain("comparison");
      expect(r.html).toContain("single");
      expect(r.html).toContain("--studio-accent:");
      expect(r.html).toContain("غير معتمد");
    }
  });
  it("prints optional independent covers for the first two real Dafatir chapters with correct names/counts",()=>{
    const root=path.join(import.meta.dirname,"..");
    const file=path.join(root,"channels/dafatir-alzaman/episodes/001-adam-beginning/tech-reviews/020/docs/storyboard-001-v1.1.json");
    const board=normalizeStoryboard(JSON.parse(readFileSync(file,"utf8")),file);
    const first=buildStoryboardHtml(board,{chapter:1,chapterCover:true});
    const second=buildStoryboardHtml(board,{chapter:2,chapterCover:true});
    expect(first.scenes).toBe(9);
    expect(second.scenes).toBe(7);
    expect(first.html).toContain("بداية القصة");
    expect(second.html).toContain("إني جاعل في الأرض خليفة");
    expect((first.html.match(/class="page cover"/g)??[]).length).toBe(1);
    expect((second.html.match(/class="page cover"/g)??[]).length).toBe(1);
    const pageCount = (html: string) => (html.match(/<article class="page(?: cover)?"/g)??[]).length;
    const annexCount = (html: string) => (html.match(/<section class="appendix">/g)??[]).length;
    // Appendix pages preserve long original notes rather than being silently cut.
    expect(pageCount(first.html) - annexCount(first.html)).toBe(10);
    expect(pageCount(second.html) - annexCount(second.html)).toBe(8);
    expect(second.html).toContain('<bdi dir="ltr">c2-s0</bdi>');
    const withoutCover=buildStoryboardHtml(board,{chapter:2});
    expect(pageCount(withoutCover.html) - annexCount(withoutCover.html)).toBe(7);
    expect(withoutCover.html).not.toContain('class="page cover"');
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
    const preview=buildStoryboardHtml({...z,scenes:z.scenes.slice(0,2)});
    expect(preview.scenes).toBe(2);
    expect((preview.html.match(/<article class="page">/g)??[]).length).toBe(2);
    expect(preview.html).not.toContain('class="page cover"');
    expect(preview.html).toContain('<bdi dir="ltr">c1-s1</bdi>');
    expect(preview.html).toContain("--studio-accent:#85653a");
    expect(preview.html).toContain("غير معتمد");
  });
});