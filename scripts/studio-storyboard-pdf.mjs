#!/usr/bin/env node
/**
 * Shared review-only PDF exporter. Reads *existing* storyboard frames; does not
 * render episodes, change approval records, publish, or upload to Drive.
 * All output paths are explicit and existing versions are never overwritten.
 */
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const ltr = value => '<bdi dir="ltr">' + esc(value) + "</bdi>";
const pending = "PENDING_REVIEW";
// Fonts are bundled with Studio: make PDF glyph shaping independent of the Mac's installed font list.
const fontRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "fonts");
const channelFonts = {
 "balislam": {accent:"#245b4c", heading:["ElMessiri.ttf","400 700"], body:["IBMPlexSansArabic-Medium.ttf","400"], bold:["IBMPlexSansArabic-Bold.ttf","700"]},
 "dafatir-alzaman": {accent:"#18475b", heading:["Amiri-Bold.ttf","700"], body:["Amiri-Regular.ttf","400"], bold:["Amiri-Bold.ttf","700"]},
 "zubdat-alkutub": {accent:"#85653a", heading:["Tajawal-arabic-700.woff2","700"], body:["Tajawal-arabic-400.woff2","400"], bold:["Tajawal-arabic-700.woff2","700"]},
};
export function pdfFontCss(channel) {
 const typography = channelFonts[channel] || channelFonts.balislam;
 const latin = channel === "zubdat-alkutub"
   ? [["Tajawal-latin-400.woff2","400"],["Tajawal-latin-700.woff2","700"]]
   : [["IBMPlexSans.ttf","400"],["IBMPlexSans.ttf","700"]];
 const faces = [["StudioHeading",typography.heading],["StudioBody",typography.body],["StudioBody",typography.bold],
   ["StudioLatin",latin[0]],["StudioLatin",latin[1]],["StudioMono",["IBMPlexMono-500.woff2","500"]]];
 const declarations = faces.map(([family,[filename,weight]])=>{
   const data=readFileSync(path.join(fontRoot,filename));
   const woff=filename.endsWith(".woff2");
   return `@font-face{font-family:"${family}";src:url(data:${woff?"font/woff2":"font/ttf"};base64,${data.toString("base64")}) format("${woff?"woff2":"truetype"}");font-style:normal;font-weight:${weight};font-display:block}`;
 });
 declarations.push(`:root{--studio-accent:${typography.accent};--studio-heading:"StudioHeading","StudioLatin";--studio-body:"StudioBody","StudioLatin"}`);
 return declarations.join("\n");
}

export function normalizeStoryboard(raw, filename) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw Error("Manifest must be an object");
  const origin = path.dirname(path.resolve(filename));
  const hasDafatirBoards = Array.isArray(raw.scenes) && raw.scenes.some(s => s?.board);
  const root = hasDafatirBoards ? path.resolve(origin, "..") : origin;
  let scenes;
  if (Array.isArray(raw.scenes)) {
    scenes = raw.scenes.map((s, index) => ({
      id: String(s.id ?? "scene-" + (index + 1)),
      chapter: s.chapter ?? null, chapterTitle: String(s.chapterTitle ?? ""),
      title: String(s.name ?? s.title ?? ""), narration: String(s.narration ?? ""),
      notes: String(s.notes ?? s.idea ?? ""), type: String(s.shot ?? s.template ?? ""),
      landscape: s.board ?? s.image ?? s.landscapeImage ?? null,
      portrait: s.portraitImage ?? s.portrait ?? null,
    }));
  } else if (Array.isArray(raw.files)) {
    scenes = raw.files.filter(f => typeof f?.path === "string" && /^scenes\/[^/]+\.(png|jpe?g|webp)$/i.test(f.path))
      .map(f => ({
        id: path.basename(f.path).replace(/^\d+-/, "").replace(/\.(png|jpe?g|webp)$/i, ""),
        chapter: null, chapterTitle: "", title: "", narration: "", notes: "", type: "",
        landscape: f.path, portrait: null,
      }));
  } else throw Error("Expected scenes[] or files[]");
  if (!scenes.length || new Set(scenes.map(s => s.id)).size !== scenes.length)
    throw Error("No scenes or duplicate scene IDs");
  return { root, scenes, channel: String(raw.channel ?? "unknown"), episode: String(raw.episode ?? "unknown"),
    version: String(raw.storyboardVersion ?? raw.version ?? "draft"), status: pending };
}

export function safeImageData(root, filename) {
  if (filename === null || filename === undefined || filename === "") return null;
  if (typeof filename !== "string" || path.isAbsolute(filename) || filename.includes("\0") ||
      filename.includes("\\") || !/\.(png|jpe?g|webp)$/i.test(filename))
    throw Error("Unsafe storyboard asset path");
  const basedir = realpathSync(root);
  const full = realpathSync(path.resolve(basedir, filename));
  const relative = path.relative(basedir, full);
  if (!relative || relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative))
    throw Error("Asset escapes storyboard directory");
  const bytes = readFileSync(full);
  if (bytes.length < 12 || bytes.length > 25 * 1024 * 1024) throw Error("Invalid storyboard image size");
  const ext = path.extname(full).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  if (mime === "image/png" && !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])))
    throw Error("Invalid PNG signature");
  if (mime === "image/jpeg" && (bytes[0] !== 255 || bytes[1] !== 216))
    throw Error("Invalid JPEG signature");
  if (mime === "image/webp" && bytes.toString("ascii", 0, 4) !== "RIFF")
    throw Error("Invalid WebP signature");
  return { src: "data:" + mime + ";base64," + bytes.toString("base64"), sha256: sha(bytes) };
}

const css = [
  "@page{size:A4 landscape;margin:9mm 10mm}*{box-sizing:border-box}",
  "html,body{margin:0;padding:0;background:#fff;color:#213344;font-family:var(--studio-body);font-synthesis:none;text-rendering:optimizeLegibility}",
  "body{direction:rtl;font-size:11pt;line-height:1.4;unicode-bidi:isolate}",
  "h1,h2,h3,small,strong{font-synthesis:none}bdi{unicode-bidi:isolate;direction:ltr;font-family:StudioMono,var(--studio-body)}",
  ".page{position:relative;width:277mm;height:186mm;max-height:186mm;overflow:hidden;break-inside:avoid;page-break-inside:avoid;break-after:page;page-break-after:always}",
  ".page:last-child{break-after:auto;page-break-after:auto}",
  ".head{position:absolute;top:0;right:0;left:0;height:19mm;border-bottom:2px solid var(--studio-accent)}",
  ".head .name{position:absolute;right:0;left:46mm;top:0;height:18mm;overflow:hidden}.eyebrow{font-size:9pt;color:#64748b}",
  ".head h2{display:flex;align-items:baseline;direction:rtl;gap:3mm;font-family:var(--studio-heading);font-size:17pt;line-height:1.35;margin:1mm 0;min-width:0;max-width:260mm}.head h2 bdi{flex:0 0 auto;max-width:52mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.head .arabic-title{direction:rtl;unicode-bidi:plaintext;font-family:var(--studio-heading);font-size:12pt;color:#506273;min-width:0;max-width:198mm;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
  ".status{position:absolute;left:0;top:2mm;float:none;font-size:9pt;color:#9a5a14;border:1px solid #ebc98b;background:#fff8e9;padding:2mm 4mm;border-radius:3mm;white-space:nowrap}",
  ".frames{position:absolute;top:20mm;right:0;left:0;height:130mm;overflow:hidden}",
  "figure{position:relative;display:block;margin:0;height:130mm;padding:2mm;overflow:hidden;background:#f3f6f7;border:1px solid #dce3e8;border-radius:2mm;text-align:center}",
  ".single figure{width:100%}.comparison figure:first-child{float:right;width:69%}.comparison figure:last-child{float:left;width:29%}",
  "figure img{width:100%;height:121mm;object-fit:contain;display:block}",
  "figcaption{font-size:8pt;line-height:1.4;color:#53616a;margin-top:1mm}",
  "figure.missing{padding-top:40mm;color:#777}figure.missing span{display:block;font-size:9pt}",
  ".info{position:absolute;top:151mm;left:0;right:0;height:27mm;overflow:hidden}",
  ".info section{float:right;width:49%;height:23mm;overflow:hidden}.info section:nth-child(2){float:left}",
  ".info h3{margin:0 0 0.5mm;font-family:var(--studio-heading);font-size:10pt;line-height:1.3;color:var(--studio-accent)}",
  ".info p{margin:0;overflow:hidden;overflow-wrap:anywhere;font-size:10.2pt;line-height:1.3;max-height:19mm;unicode-bidi:plaintext}",
  ".info .details{width:100%;height:4mm;clear:both;display:flex;align-items:start;justify-content:space-between;gap:2mm;white-space:nowrap;border-top:1px solid #d5dee5;color:#546471;font-size:8.5pt}",
  ".details span{margin:0;display:block;flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;unicode-bidi:isolate}",
  "footer{position:absolute;bottom:0;left:0;right:0;height:7mm;font-size:8pt;color:#65737d;border-top:1px solid #d9e2e7}",
  ".appendix{position:absolute;top:30mm;left:8mm;right:8mm;bottom:13mm;overflow:hidden}",
  ".appendix p{font-size:15pt;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere;unicode-bidi:plaintext;margin:1mm 0 0}",
  ".page.cover{display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;border:3mm solid var(--studio-accent);padding:14mm}",
  ".cover .label{font-family:var(--studio-body);font-size:15pt;direction:rtl}.cover h1{font-family:var(--studio-heading);font-size:32pt;line-height:1.65;direction:rtl;unicode-bidi:isolate;max-width:240mm;max-height:80mm;overflow:hidden;overflow-wrap:anywhere;margin:10mm 0}",
  ".cover p{direction:rtl;font-size:13pt}.cover .series{font-size:12pt;color:#53616a}",
  ".page-index{position:absolute;bottom:1mm;left:0;direction:rtl;font-family:var(--studio-body);font-size:8pt;color:#65737d;line-height:5mm;min-width:29mm;text-align:left;z-index:2}.page.cover .page-index{left:11mm;bottom:6mm}",
].join("\n");

// Divide printable annexes only between full Unicode grapheme clusters. A code-unit
// slice can separate Arabic tashkeel from its base letter or split an emoji surrogate.
export function splitAppendixText(value) {
  const parts = [];
  let part = "", rows = 1, columns = 0;
  const flush = () => { if (part) parts.push(part); part = ""; rows = 1; columns = 0; };
  for (const { segment } of new Intl.Segmenter("ar", { granularity: "grapheme" }).segment(String(value))) {
    const newline = segment === "\n" || segment === "\r" || segment === "\r\n";
    const nextRow = newline || columns >= 40;
    // Conservative line budget for the 15pt annex text on an A4 landscape page.
    // In particular, explicit newlines must not be hidden by an overflow box.
    if (part && (part.length + segment.length > 400 || (nextRow && rows >= 11))) flush();
    if (segment.length > 400) throw Error("Oversized Unicode grapheme in storyboard annex");
    part += segment;
    if (newline) { rows++; columns = 0; }
    else { if (columns >= 40) { rows++; columns = 0; } columns++; }
  }
  flush();
  return parts;
}

const needsTextAnnex = value => value.length > 160 ||
  (value.match(/\r\n|\n|\r/g) ?? []).length >= 3 || /[^\s]{80,}/u.test(value);
const metadataPreview = (value, limit = 36) => {
  const fragments = [...new Intl.Segmenter("ar", { granularity: "grapheme" }).segment(String(value))];
  return fragments.length > limit || /[\r\n]/.test(value)
    ? fragments.slice(0, limit).map(({ segment }) => segment).join("").trimEnd() + "…" : String(value);
};
const needsMetadataAnnex = (value, limit) => /[\r\n]/.test(String(value)) ||
  [...new Intl.Segmenter("ar", {granularity:"grapheme"}).segment(String(value))].length > limit;
const safeExcerpt = (value, limit, annexNeeded) => {
  if (!annexNeeded) return value;
  // Keep the already-reviewed <=160-character Dafatir text fully on its scene page.
  const max = value.length > limit ? limit : Math.min(96, limit);
  let excerpt = "";
  for (const { segment } of new Intl.Segmenter("ar", { granularity: "grapheme" }).segment(value)) {
    if (excerpt.length + segment.length > max) break;
    excerpt += segment;
  }
  return excerpt.trimEnd() + "… (النص كامل في الملحق)";
};

export function buildStoryboardHtml(storyboard, { chapter = null, chapterCover = false } = {}) {
  const chosen = storyboard.scenes.filter(s => chapter === null || String(s.chapter) === String(chapter));
  if (!chosen.length || chosen.length > 250) throw Error("Empty or oversized storyboard selection");
  const appendix = (id, label, text) => splitAppendixText(text).map((piece, i, a) =>
    '<article class="page"><header class="head"><div class="name"><span class="eyebrow">ملحق ' + ltr(metadataPreview(id, 18)) +
    " · " + esc(label) + " · " + ltr((i+1)+"/"+a.length) +
    '</span><h2>النص الكامل للمراجعة</h2></div><div class="status">غير معتمد</div></header>' +
    '<section class="appendix"><h3>' + esc(label) + '</h3><p>' + esc(piece) + '</p></section>' +
    '<footer>ملحق Storyboard: النص الأصلي دون تعديل أو حذف</footer></article>').join("\n");
  if (chapterCover && (new Set(chosen.map(scene => String(scene.chapter))).size !== 1 || chosen[0]?.chapter == null))
    throw Error("Chapter cover requires exactly one named chapter");
  const title = chosen[0]?.chapterTitle?.trim();
  const coverTitleAnnex = !!title && (title.length > 80 || /[\r\n]/.test(title));
  const coverTitle = coverTitleAnnex ? [...new Intl.Segmenter("ar", { granularity: "grapheme" }).segment(title)]
    .slice(0, 38).map(({ segment }) => segment).join("") + "…" : title;
  const cover = chapterCover
    ? '<article class="page cover" lang="ar" dir="rtl"><div class="label">لوحات المراجعة البصرية · ' +
        esc(metadataPreview(storyboard.channel, 22)) + '</div><h1>الفصل ' + ltr(chosen[0].chapter) +
        (title ? ' — <span dir="rtl">' + esc(coverTitle) + '</span>' : '') +
        '</h1><p>عدد المشاهد: ' + ltr(chosen.length) +
        ' · الإصدار ' + ltr(metadataPreview(storyboard.version, 22)) +
        '</p><p class="series">Storyboard · غير معتمد للنشر</p></article>' +
        (coverTitleAnnex ? appendix("الفصل " + chosen[0].chapter, "عنوان الفصل", title) : "") : "";
  const pages = chosen.map((scene, index) => {
    const land = safeImageData(storyboard.root, scene.landscape);
    const port = safeImageData(storyboard.root, scene.portrait);
    const panel = (img, label) => img
      ? '<figure><img src="' + img.src + '" alt="' + esc(label) + '"/><figcaption>' +
        esc(label) + " · SHA256 " + ltr(img.sha256.slice(0, 12)) + '</figcaption></figure>'
      : '<figure class="missing"><strong>' + esc(label) +
        '</strong><span>لم تُرفق صورة لهذا المقاس؛ لا نُنشئ معاينة تخمينية.</span></figure>';
    const notes = scene.notes || "لا توجد ملاحظات فنية مسجلة";
    const narration = scene.narration || "بلا نص مسجل في ملف Storyboard";
    const notesAnnex = needsTextAnnex(notes);
    const narrationAnnex = needsTextAnnex(narration);
    const titleAnnex = scene.title.length > 48 || /[\r\n]/.test(scene.title);
    const chapterMeta = String(scene.chapterTitle || scene.chapter || "غير محدد");
    const typeMeta = String(scene.type || "غير محدد");
    const chapterMetaAnnex = needsMetadataAnnex(chapterMeta, 36);
    const typeMetaAnnex = needsMetadataAnnex(typeMeta, 36);
    const idAnnex = needsMetadataAnnex(scene.id, 18);
    const titleExcerpt = titleAnnex ? [...new Intl.Segmenter("ar", { granularity: "grapheme" }).segment(scene.title)]
      .slice(0, 40).map(({ segment }) => segment).join("") + "…" : scene.title;
    const header = '<header class="head"><div class="name"><span class="eyebrow">اللوحة ' +
      ltr(index+1) + " من " + ltr(chosen.length) + ' · ' + esc(metadataPreview(storyboard.channel, 22)) +
      '</span><h2>' + ltr(scene.id) + '<span class="arabic-title" lang="ar" dir="rtl" data-annex="' + (titleAnnex ? 'true':'false') + '">' + esc(titleExcerpt) +
      '</span></h2></div><div class="status">مراجعة بصرية · غير معتمد</div></header>';
    const frames = '<div class="frames ' + (port ? "comparison" : "single") + '">' +
      panel(land, "أفقي 16:9") + (port ? panel(port, "عمودي 9:16") : "") + "</div>";
    const info = '<div class="info"><section><h3>الوصف والملاحظات</h3><p lang="ar" dir="rtl">' + esc(safeExcerpt(notes, 160, notesAnnex)) +
      '</p></section><section><h3>نص المقطع</h3><p lang="ar" dir="rtl">' + esc(safeExcerpt(narration, 160, narrationAnnex)) +
      '</p></section><section class="details"><span data-annex="' + (chapterMetaAnnex || (chapterCover && chapterMeta === title) ? 'true':'false') + '">الفصل: ' + esc(metadataPreview(chapterMeta)) +
      '</span><span data-annex="' + (typeMetaAnnex ? 'true':'false') + '">النوع: ' + esc(metadataPreview(typeMeta)) +
      '</span><span data-annex="' + (needsMetadataAnnex(storyboard.version, 22) ? 'true':'false') + '">الإصدار: ' + ltr(metadataPreview(storyboard.version, 22)) + '</span></section></div>';
    return '<article class="page">' + header + frames + info +
      '<footer>Storyboard للمراجعة فقط · ' + ltr(metadataPreview(storyboard.episode, 22)) + '</footer></article>' +
      (titleAnnex ? appendix(scene.id, "عنوان المشهد", scene.title) : "") +
      (notesAnnex ? appendix(scene.id,"الوصف والملاحظات",notes) : "") +
      (narrationAnnex ? appendix(scene.id,"النص والتعليق",narration) : "") +
      (chapterMetaAnnex && !(chapterCover && coverTitleAnnex && chapterMeta === title) ? appendix(scene.id, "عنوان الفصل الكامل", chapterMeta) : "") +
      (typeMetaAnnex ? appendix(scene.id, "نوع المشهد الكامل", typeMeta) : "") +
      (idAnnex ? appendix(scene.id, "معرّف المشهد الكامل", scene.id) : "");
  });
  // Page numbering includes chapter covers and all full-text annex pages.
  const metadataAnnexes = [["القناة الكاملة", storyboard.channel],["معرّف الحلقة الكامل", storyboard.episode],
    ["إصدار المحتوى الكامل", storyboard.version]]
    .filter(([,value]) => needsMetadataAnnex(value, 22))
    .map(([label,value]) => appendix("Storyboard", label, value)).join("\n");
  const documentPages = cover + metadataAnnexes + pages.join("\n");
  const pageCount = (documentPages.match(/<\/article>/g) ?? []).length;
  let pageIndex = 0;
  const numberedPages = documentPages.replace(/<\/article>/g, () =>
    '<div class="page-index" aria-label="رقم الصفحة">صفحة ' + (++pageIndex) + " من " + pageCount + "</div></article>");
  return {html:'<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>' +
    '<title>Storyboard · ' + esc(storyboard.episode) + ' · ' + esc(storyboard.version) +
    '</title><style>' + pdfFontCss(storyboard.channel) + css + '</style></head><body>' + numberedPages + '</body></html>',
    status:pending,scenes:chosen.length};
}

function chromeExecutable(given) {
  const candidates = given ? [given] : [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ];
  return candidates.find(f => f && existsSync(f));
}
export function exportStoryboard({manifestPath,pdfPath,chapter=null,chapterCover=false,chrome=null,htmlOnly=false}) {
  if (!path.isAbsolute(manifestPath) || !path.isAbsolute(pdfPath) || !/\.pdf$/i.test(pdfPath))
    throw Error("Use absolute manifest path and new .pdf output path");
  const htmlPath = pdfPath.replace(/\.pdf$/i, ".html");
  if (existsSync(pdfPath) || existsSync(htmlPath)) throw Error("Refusing to overwrite existing storyboard versions");
  const source = readFileSync(manifestPath);
  const data = normalizeStoryboard(JSON.parse(source.toString("utf8")), manifestPath);
  const { html, scenes } = buildStoryboardHtml(data, {chapter,chapterCover});
  writeFileSync(htmlPath, html, {flag:"wx",mode:0o600});
  const result = {status:pending,scenes,htmlPath,manifestSha256:sha(source)};
  if (htmlOnly) return result;
  const executable = chromeExecutable(chrome);
  if (!executable) throw Error("Chrome unavailable; printable HTML saved at " + htmlPath);
  const profile = mkdtempSync(path.join(os.tmpdir(), "studio-storyboard-pdf-"));
  try {
    const args = [
      "--headless", "--disable-gpu", "--disable-extensions", "--disable-background-networking",
      "--no-first-run", "--no-pdf-header-footer",
      "--user-data-dir=" + profile, "--print-to-pdf=" + pdfPath,
      "--virtual-time-budget=4000", pathToFileURL(htmlPath).href,
    ];
    const printed = spawnSync(executable,args,{encoding:"utf8",timeout:240000,maxBuffer:256*1024});
    if (printed.status !== 0 || printed.error || !existsSync(pdfPath) ||
        readFileSync(pdfPath).subarray(0,5).toString("ascii") !== "%PDF-")
      throw Error("PDF export failed: " + (printed.error?.message || printed.stderr?.slice(-250) || printed.status));
  } finally { rmSync(profile,{recursive:true,force:true}); }
  return {...result,pdfPath,pdfSha256:sha(readFileSync(pdfPath))};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);
  const flag=k=>{const i=args.indexOf(k);return i>=0 ? args[i+1] : null;};
  if (!flag("--manifest") || !flag("--output")) {
    console.error("Usage: node scripts/studio-storyboard-pdf.mjs --manifest /abs/manifest.json --output /abs/NEW-VERSION.pdf [--chapter 1] [--chrome /abs/chrome] [--html-only]");
    process.exitCode=2;
  } else {
    try { console.log(JSON.stringify({result:"PREVIEW_ONLY_NOT_APPROVED",...exportStoryboard({
      manifestPath:flag("--manifest"),pdfPath:flag("--output"),chapter:flag("--chapter"),chapterCover:args.includes("--chapter-cover"),
      chrome:flag("--chrome"),htmlOnly:args.includes("--html-only"),
    })})); }
    catch(e){console.error("STORYBOARD_EXPORT_ERROR",e.message);process.exitCode=1;}
  }
}
