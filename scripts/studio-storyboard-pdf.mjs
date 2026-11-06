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
  "html,body{margin:0;padding:0;background:#fff;color:#213344;font-family:'Noto Naskh Arabic','Noto Sans Arabic','Amiri',Tahoma,Arial,sans-serif}",
  "body{direction:rtl;font-size:11pt;line-height:1.4}",
  ".page{position:relative;width:277mm;height:186mm;max-height:186mm;overflow:hidden;break-inside:avoid;page-break-inside:avoid;break-after:page;page-break-after:always}",
  ".page:last-child{break-after:auto;page-break-after:auto}",
  ".head{position:absolute;top:0;right:0;left:0;height:19mm;border-bottom:2px solid #18475b}",
  ".head .name{float:right}.eyebrow{font-size:9pt;color:#64748b}",
  ".head h2{font-size:17pt;line-height:1.2;margin:1mm 0}.head small{font-size:11pt;font-weight:400;color:#506273}",
  ".status{float:left;font-size:9pt;color:#9a5a14;border:1px solid #ebc98b;background:#fff8e9;padding:2mm 4mm;border-radius:3mm}",
  ".frames{position:absolute;top:20mm;right:0;left:0;height:130mm;overflow:hidden}",
  "figure{position:relative;display:block;margin:0;height:130mm;padding:2mm;overflow:hidden;background:#f3f6f7;border:1px solid #dce3e8;border-radius:2mm;text-align:center}",
  ".single figure{width:100%}.comparison figure:first-child{float:right;width:69%}.comparison figure:last-child{float:left;width:29%}",
  "figure img{width:100%;height:121mm;object-fit:contain;display:block}",
  "figcaption{font-size:8pt;line-height:1.4;color:#53616a;margin-top:1mm}",
  "figure.missing{padding-top:40mm;color:#777}figure.missing span{display:block;font-size:9pt}",
  ".info{position:absolute;top:151mm;left:0;right:0;height:27mm;overflow:hidden}",
  ".info section{float:right;width:49%;height:23mm;overflow:hidden}.info section:nth-child(2){float:left}",
  ".info h3{margin:0 0 0.5mm;font-size:10pt;line-height:1.15;color:#18475b}",
  ".info p{margin:0;overflow:hidden;overflow-wrap:anywhere;font-size:10.2pt;line-height:1.3;max-height:19mm}",
  ".info .details{width:100%;height:4mm;clear:both;border-top:1px solid #d5dee5;color:#546471;font-size:8.5pt}",
  ".details span{margin-left:7mm}",
  "footer{position:absolute;bottom:0;left:0;right:0;height:7mm;font-size:8pt;color:#65737d;border-top:1px solid #d9e2e7}",
  ".appendix{position:absolute;top:30mm;left:8mm;right:8mm;bottom:13mm;overflow:hidden}",
  ".appendix p{font-size:15pt;line-height:1.8;white-space:pre-wrap;overflow-wrap:anywhere}",
].join("\n");

export function buildStoryboardHtml(storyboard, { chapter = null } = {}) {
  const chosen = storyboard.scenes.filter(s => chapter === null || String(s.chapter) === String(chapter));
  if (!chosen.length || chosen.length > 250) throw Error("Empty or oversized storyboard selection");
  const chunks = text => String(text).match(/[\s\S]{1,560}/gu) ?? [];
  const appendix = (id, label, text) => chunks(text).map((piece, i, a) =>
    '<article class="page"><header class="head"><div class="name"><span class="eyebrow">ملحق ' + ltr(id) +
    " · " + esc(label) + " · " + ltr((i+1)+"/"+a.length) +
    '</span><h2>النص الكامل للمراجعة</h2></div><div class="status">غير معتمد</div></header>' +
    '<section class="appendix"><h3>' + esc(label) + '</h3><p>' + esc(piece) + '</p></section>' +
    '<footer>ملحق Storyboard: النص الأصلي دون تعديل أو حذف</footer></article>').join("\n");
  const excerpt = (value, max) => value.length > max ?
    value.slice(0, max).trim() + "… (النص كامل في الملحق)" : value;
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
    const header = '<header class="head"><div class="name"><span class="eyebrow">اللوحة ' +
      ltr(index+1) + " من " + ltr(chosen.length) + ' · ' + esc(storyboard.channel) +
      '</span><h2>' + ltr(scene.id) + ' <small>' + esc(scene.title) +
      '</small></h2></div><div class="status">مراجعة بصرية · غير معتمد</div></header>';
    const frames = '<div class="frames ' + (port ? "comparison" : "single") + '">' +
      panel(land, "أفقي 16:9") + (port ? panel(port, "عمودي 9:16") : "") + "</div>";
    const info = '<div class="info"><section><h3>الوصف والملاحظات</h3><p>' + esc(excerpt(notes, 160)) +
      '</p></section><section><h3>نص المقطع</h3><p>' + esc(excerpt(narration, 160)) +
      '</p></section><section class="details"><span>الفصل: ' + esc(scene.chapterTitle || scene.chapter || "غير محدد") +
      '</span><span>النوع: ' + esc(scene.type || "غير محدد") +
      '</span><span>الإصدار: ' + ltr(storyboard.version) + '</span></section></div>';
    return '<article class="page">' + header + frames + info +
      '<footer>Storyboard للمراجعة فقط · ' + ltr(storyboard.episode) + '</footer></article>' +
      (notes.length > 160 ? appendix(scene.id,"الوصف والملاحظات",notes) : "") +
      (narration.length > 160 ? appendix(scene.id,"النص والتعليق",narration) : "");
  });
  return {html:'<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>' +
    '<title>Storyboard · ' + esc(storyboard.episode) + ' · ' + esc(storyboard.version) +
    '</title><style>' + css + '</style></head><body>' + pages.join("\n") + '</body></html>',
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
export function exportStoryboard({manifestPath,pdfPath,chapter=null,chrome=null,htmlOnly=false}) {
  if (!path.isAbsolute(manifestPath) || !path.isAbsolute(pdfPath) || !/\.pdf$/i.test(pdfPath))
    throw Error("Use absolute manifest path and new .pdf output path");
  const htmlPath = pdfPath.replace(/\.pdf$/i, ".html");
  if (existsSync(pdfPath) || existsSync(htmlPath)) throw Error("Refusing to overwrite existing storyboard versions");
  const source = readFileSync(manifestPath);
  const data = normalizeStoryboard(JSON.parse(source.toString("utf8")), manifestPath);
  const { html, scenes } = buildStoryboardHtml(data, {chapter});
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
      manifestPath:flag("--manifest"),pdfPath:flag("--output"),chapter:flag("--chapter"),
      chrome:flag("--chrome"),htmlOnly:args.includes("--html-only"),
    })})); }
    catch(e){console.error("STORYBOARD_EXPORT_ERROR",e.message);process.exitCode=1;}
  }
}
