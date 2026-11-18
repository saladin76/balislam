#!/usr/bin/env node
/**
 * Read-only production storyboard input -> review-only PDFs in an explicit,
 * fresh OUTSIDE-the-repository directory. Never edits an episode, its manifest,
 * media, approval ledger or a pre-existing PDF.
 *
 * node scripts/verify-studio-pdf-visual.mjs --out /abs/new/review-dir
 *
 * Requires Chrome, FFmpeg and Poppler (pdfinfo, pdffonts, pdftotext, pdftoppm).
 * CI uploads the real PDF files, page previews and machine-readable audit.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { exportStoryboard, normalizeStoryboard, splitAppendixText } from "./studio-storyboard-pdf.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const out = args[args.indexOf("--out") + 1];
if (!args.includes("--out") || !path.isAbsolute(out ?? "") ||
    out === repo || out.startsWith(repo + path.sep) || existsSync(out)) {
  console.error("Specify an absolute NEW --out directory outside the repository");
  process.exit(2);
}
const hash = data => createHash("sha256").update(data).digest("hex");
// HTML-escaped source text must be present, complete and ordered. The full
// Unicode-grapheme pieces may live on separate appendix pages.
const htmlEscape = value => String(value).replaceAll("&","&amp;").replaceAll("<","&lt;")
  .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const sourceTextPresent = (html, value) => {
  if(!value)return true;
  const full=htmlEscape(value);
  return html.includes(full) ||
    splitAppendixText(value).every(piece => html.includes(htmlEscape(piece)));
};
const tool = (bin, args, opts = {}) => {
  const r = spawnSync(bin, args, { encoding: "utf8", timeout: 180000, maxBuffer: 8 * 1024 * 1024, ...opts });
  if (r.error || r.status !== 0) throw Error(bin + " " + args.join(" ") + ": " +
    (r.error?.message || r.stderr?.slice(-1200) || "exit " + r.status));
  return r.stdout;
};
const chrome = [process.env.STUDIO_PDF_CHROME, "/usr/bin/google-chrome", "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(p => p && existsSync(p));
if (!chrome) throw Error("Chrome unavailable: no visual/pdf assertions can be made");
mkdirSync(out, { recursive: false, mode: 0o700 });
const cases = [];
const firstDafatir = path.join(repo,"channels/dafatir-alzaman/episodes/001-adam-beginning/tech-reviews/020/docs/storyboard-001-v1.1.json");
const realZubdat = path.join(repo,"channels/zubdat-alkutub/episodes/001-awwal-marra-osalli/storyboard-visual/v021/manifest.json");
const realBalislamPlan = path.join(repo,"channels/balislam/episodes/001-know-the-truth/plan.json");
const sourceHashes = new Map([firstDafatir,realZubdat,realBalislamPlan]
  .map(file => [file,hash(readFileSync(file))]));

// Synthetic balislam: generated 16:9/9:16 test-pattern images and deliberately
// difficult mixed Arabic/Latin/numerals/newlines/emoji. Clearly not production assets.
const fixture = path.join(out, "synthetic-balislam");
mkdirSync(fixture);
tool("ffmpeg",["-nostdin","-v","error","-f","lavfi","-i","testsrc2=size=1280x720:rate=1","-frames:v","1","-y",path.join(fixture,"landscape.png")]);
tool("ffmpeg",["-nostdin","-v","error","-f","lavfi","-i","testsrc2=size=720x1280:rate=1","-frames:v","1","-y",path.join(fixture,"portrait.png")]);
const longMixed = ("تَشْكِيلٌ وَحُرُوفٌ مُتَّصِلَةٌ · English API v2.1 · رقم ١٢٣ · 2026 👩🏽‍💻\n").repeat(38);
const manifest = path.join(fixture,"manifest.json");
writeFileSync(manifest,JSON.stringify({
  channel:"balislam",episode:"synthetic-review-only",version:"P1-visual-audit",
  status:"PENDING_REVIEW",scenes:[
    {id:"c1-s1",chapter:1,chapterTitle:"مُقَارَنَةُ إطَارَيْ 16:9 و9:16",title:"العَرَبِيَّةُ · Mixed English 2026",
      narration:longMixed,notes:("ملاحظة صعبة 16:9 / 9:16 ① بَابٌ 🎬\n").repeat(21),
      image:"landscape.png",portraitImage:"portrait.png",shot:"visual comparison"},
    {id:"c1-s2",chapter:1,chapterTitle:"مُقَارَنَةُ إطَارَيْ 16:9 و9:16",
      title:("اختبار عنوان عَرَبِيٍّ وعناصر English & Unicode ").repeat(10),
      narration:"نهاية الاختبار دون اعتماد.",notes:"المحتوى الكامل محفوظ دون قص.",
      image:"landscape.png",portraitImage:"portrait.png",shot:"motion graphics"},
  ]
},null,2));

// The Balislam episode stores its actual data as a production plan rather
// than a board-image manifest. Adapt the first six *real* scene texts into an
// ephemeral, strictly read-only review manifest. Missing images remain marked
// missing, and are NEVER replaced with synthetic "real" storyboard frames.
const realPlan=JSON.parse(readFileSync(realBalislamPlan,"utf8"));
if(realPlan.channel!=="balislam" || !Array.isArray(realPlan.chapters?.[0]?.scenes) ||
   realPlan.chapters[0].scenes.length<6)throw Error("Real Balislam episode plan is incompatible");
const realChapter=realPlan.chapters[0];
const realBalislamReview=path.join(out,"balislam-real-plan-review-manifest.json");
writeFileSync(realBalislamReview,JSON.stringify({
  channel:realPlan.channel,episode:String(realPlan.episode),version:String(realPlan.version),
  scenes:realChapter.scenes.slice(0,6).map(scene=>({
    id:scene.id,chapter:realChapter.number??1,chapterTitle:realChapter.title,
    title:scene.props?.shot||scene.template||"",narration:scene.narration||"",
    notes:scene.props?.cues||"",shot:scene.template||"",image:null,portraitImage:null
  }))
},null,2));

const inputs = [
  {name:"dafatir-chapter-1",source:firstDafatir,chapter:1,cover:true,expectedScenes:9},
  {name:"dafatir-chapter-2",source:firstDafatir,chapter:2,cover:true,expectedScenes:7},
  {name:"zubdat-real-v021",source:realZubdat,chapter:null,cover:false,expectedScenes:31},
  {name:"balislam-real-plan",source:realBalislamReview,chapter:1,cover:true,expectedScenes:6},
  {name:"balislam-synthetic-stress",source:manifest,chapter:1,cover:true,expectedScenes:2},
];

const errors=[];
for (const spec of inputs) {
  const target=path.join(out,spec.name+".pdf");
  const result=exportStoryboard({manifestPath:spec.source,pdfPath:target,chapter:spec.chapter,
    chapterCover:spec.cover,chrome});
  const html=readFileSync(result.htmlPath,"utf8");
  const physical=(html.match(/<article class="page(?: cover)?"/g)??[]).length;
  const pages=Number(pdfinfo(target).match(/^Pages:\s*(\d+)/m)?.[1]);
  const fonts=tool("pdffonts",[target]).split("\n").slice(2).filter(Boolean);
  const unembedded=fonts.filter(row => !/\s+yes\s+(?:yes|no)\s+(?:yes|no)\s+\d+\s+\d+\s*$/.test(row));
  const expectedFont=spec.name.startsWith("dafatir-") ? /Amiri/i :
    spec.name.startsWith("zubdat-") ? /(?:Lalezar|Tajawal)/i : /(?:ElMessiri|IBMPlexSansArabic)/i; // بالإسلام: «باء التشغيل» (D154)
  const expectedFontFound=fonts.some(row => expectedFont.test(row));
  const extracted=tool("pdftotext",["-layout",target,"-"]);
  const board=normalizeStoryboard(JSON.parse(readFileSync(spec.source,"utf8")),spec.source);
  const chosen=board.scenes.filter(scene=>spec.chapter===null||String(scene.chapter)===String(spec.chapter));
  const missingIds=chosen.map(s=>s.id).filter(id=>!extracted.includes(id));
  const sourceFields=[...chosen.flatMap(s=>[
    ["id",s.id],["title",s.title],["narration",s.narration],["notes",s.notes],
    ["shot",s.type],["chapterTitle",s.chapterTitle]
  ].map(([name,value])=>({scene:s.id,name,value}))),
  ...[["channel",board.channel],["episode",board.episode],["version",board.version]]
    .map(([name,value])=>({scene:"storyboard",name,value}))];
  const missingSourceText=sourceFields.filter(({value})=>!sourceTextPresent(html,value))
    .map(({scene,name})=>({scene,name}));
  const numbers=[...html.matchAll(/class="page-index" aria-label="رقم الصفحة">صفحة (\d+) من (\d+)/g)];
  if(pages!==physical||result.scenes!==spec.expectedScenes||numbers.length!==pages||missingIds.length||
     unembedded.length||!fonts.length||!expectedFontFound||missingSourceText.length) {
    errors.push({case:spec.name,pages,physical,scenes:result.scenes,expected:spec.expectedScenes,
      labels:numbers.length,missingIds,unembedded,expectedFontFound,missingSourceText});
  }
  // Every physical page is rasterized, including chapter covers and appendices,
  // to make full-page human visual review possible, not merely spot sampling.
  const previewBase=path.join(out,spec.name+"-preview");
  tool("pdftoppm",["-f","1","-l",String(pages),"-r","115","-png",target,previewBase]);
  const pngs=readdirSync(out).filter(x=>x.startsWith(spec.name+"-preview") && x.endsWith(".png"));
  if(pngs.length!==pages)errors.push({case:spec.name,issue:"missing page rasters",rasterCount:pngs.length,pages});
  cases.push({name:spec.name,channel:board.channel,status:result.status,sceneCount:result.scenes,
    physicalPages:pages,htmlPages:physical,pdfSha256:result.pdfSha256,
    manifestSha256:result.manifestSha256,fontRecords:fonts.length,unembeddedFonts:unembedded.length,
    missingSceneIdsInExtract:missingIds,missingSourceText,expectedFontFound,previews:pngs});
}
for (const [file,original] of sourceHashes)
  if (hash(readFileSync(file))!==original) errors.push({type:"source-changed",file});

// Chrome DOM geometry audit on exact generated HTML. Compare actual text and
// container rectangles *after fonts load*. A separate print-to-PDF/Poppler
// check above verifies actual PDF output and page counts.
const domErrors=[];
for (const spec of inputs) {
  const htmlPath=path.join(out,spec.name+".html");
  const original=readFileSync(htmlPath,"utf8");
  const auditCode=`<div id="studio-layout-result"></div><script>
    document.fonts.ready.then(()=>{
      const faults=[];
      for(const [index,page] of [...document.querySelectorAll("article.page")].entries()){
        const bounds=page.getBoundingClientRect();
        for(const sel of [".appendix",".cover h1",".head h2"]){
          for(const el of page.querySelectorAll(sel)){
            const box=el.getBoundingClientRect();
            if(box.top < bounds.top - 2 || box.bottom > bounds.bottom + 2)
              faults.push({index,sel,kind:"outside-page",bottom:box.bottom,limit:bounds.bottom});
          }
        }
        for(const header of page.querySelectorAll(".head")){
          const status=header.querySelector(".status");
          if(status){
            const statusBox=status.getBoundingClientRect();
            const headerBox=header.getBoundingClientRect();
            if(statusBox.bottom > headerBox.bottom - 1)
              faults.push({index,sel:".status",kind:"status-overlap",bottom:statusBox.bottom,limit:headerBox.bottom});
          }
        }
        // A visually ellipsized preview is acceptable only if its complete
        // original text is available on a cover or dedicated annex page.
        for(const el of page.querySelectorAll(".head .arabic-title,.info .details span")){
          if(el.scrollWidth>el.clientWidth+2 && el.getAttribute("data-annex")!=="true")
            faults.push({index,sel:el.className||"metadata",kind:"unbacked-ellipsis",
              scroll:el.scrollWidth,client:el.clientWidth});
        }
        for(const p of page.querySelectorAll(".appendix p")){
          const holder=p.closest(".appendix").getBoundingClientRect();
          const text=p.getBoundingClientRect();
          if(text.bottom > holder.bottom - 1)
            faults.push({index,sel:".appendix p",kind:"text-clipped",bottom:text.bottom,limit:holder.bottom});
        }
        for(const p of page.querySelectorAll(".info p")){
          if(p.scrollHeight > p.clientHeight+2)
            faults.push({index,sel:".info p",kind:"text-clipped",scroll:p.scrollHeight,client:p.clientHeight});
          // The text itself may fit its max-height but still protrude into
          // a fixed-height, overflow:hidden section and lose its last line.
          const section=p.closest(".info section");
          if(section){
            const textRect=p.getBoundingClientRect();
            const sectionRect=section.getBoundingClientRect();
            if(textRect.bottom > sectionRect.bottom-1)
              faults.push({index,sel:".info section",kind:"section-clipped",bottom:textRect.bottom,limit:sectionRect.bottom});
          }
        }
      }
      document.getElementById("studio-layout-result").textContent=JSON.stringify({faults,pageCount:document.querySelectorAll("article.page").length});
    });
  <\/script>`;
  const auditPath=path.join(out,spec.name+"-layout-audit.html");
  // Audit the actual CSS/text but substitute image payloads: Chrome --dump-dom
  // must not emit multi-megabyte base64 assets into the child stdout buffer.
  const smallPng="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAOwO+wAAAABJRU5ErkJggg==";
  const audited=original.replace(/src="data:image\/(?:png|jpeg|webp);base64,[^"]+"/g,
    'src="data:image/png;base64,'+smallPng+'"');
  writeFileSync(auditPath,audited.replace("</body>",auditCode+"</body>"));
  const dom=tool(chrome,["--headless","--disable-gpu","--no-first-run","--no-sandbox",
    "--disable-background-networking","--virtual-time-budget=9000","--window-size=1650,1200",
    "--dump-dom",pathToFileURL(auditPath).href]);
  const reportText=dom.match(/id="studio-layout-result">([^<]+)/)?.[1];
  if(!reportText) {domErrors.push({case:spec.name,issue:"layout audit result missing"});continue;}
  try {
    const report=JSON.parse(reportText.replaceAll("&quot;",'"').replaceAll("&amp;","&"));
    if(report.faults?.length)domErrors.push({case:spec.name,faults:report.faults});
  }catch{domErrors.push({case:spec.name,issue:"invalid audit JSON",preview:reportText.slice(0,500)});}
}
const report={head:process.env.GITHUB_SHA??null,status:"PENDING_REVIEW",chrome,createdAt:new Date().toISOString(),
  inputs:{dafatir:"actual storyboard frames",zubdat:"actual storyboard frames",
    balislamReal:"actual plan narration, no storyboard frame files",
    balislamStress:"synthetic 16:9/9:16 media and difficult mixed Arabic"},
  cases,errors,domErrors,realEpisodeInputsUntouched:true,pass:!errors.length&&!domErrors.length};
writeFileSync(path.join(out,"audit.json"),JSON.stringify(report,null,2));
console.log("STUDIO_PDF_VISUAL_AUDIT "+JSON.stringify(report));
if(!report.pass)process.exitCode=1;
function pdfinfo(file){return tool("pdfinfo",[file]);}
