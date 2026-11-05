import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { projectRoot } from "../config/paths";
import { assertZubdat, sheetMoments } from "./zubdat";

const run = promisify(execFile);

/**
 * لوحة الهاتف (معيار C1/C2/Q3): لقطة من الرندر بعد كل حدث مرسوم بقليل، معروضة بعرض هاتف 390
 * فوقها المنطقة الآمنة (هامش 10%) وحد الترجمة، لمراجعة القراءة والقص قبل عرض المشهد.
 * تُكتب في out/ (لا تُرفع): ملف واحد بصور مضمَّنة.
 */
export const writePhoneSheet = async (episode: string, video: string) => {
  assertZubdat();
  const moments = await sheetMoments(episode);
  const tmp = await mkdtemp(path.join(tmpdir(), "zsheet-"));
  const blocks: string[] = [];
  try {
    for (const m of moments) {
      const imgs: string[] = [];
      for (const [i, t] of m.times.entries()) {
        const f = path.join(tmp, `${m.id}-${i}.jpg`);
        await run("ffmpeg", ["-nostdin", "-v", "error", "-y", "-ss", t.toFixed(3), "-i", video, "-frames:v", "1", "-vf", "scale=780:-2", "-q:v", "5", f]);
        const b64 = (await readFile(f)).toString("base64");
        imgs.push(`<figure><div class="ph"><img src="data:image/jpeg;base64,${b64}" alt=""><span class="safe"></span><span class="cap"></span></div><figcaption>${t.toFixed(1)} ث</figcaption></figure>`);
      }
      blocks.push(`<section><h2>${m.id} <small>${m.shot}</small></h2><div class="row">${imgs.join("")}</div></section>`);
    }
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>لوحة الهاتف — ${episode}</title>
<style>body{margin:0;background:#eee;font:15px/1.7 system-ui,sans-serif;color:#111}.wrap{max-width:1300px;margin:0 auto;padding:16px}section{background:#fff;border-radius:12px;padding:8px 12px;margin:10px 0}h2{font-size:17px;margin:4px 0}small{color:#777;font-weight:400}.row{display:flex;flex-wrap:wrap;gap:10px}figure{margin:0}.ph{position:relative;width:390px;max-width:100%;aspect-ratio:16/9;border:6px solid #111;border-radius:14px;overflow:hidden}.ph img{width:100%;height:100%;display:block}.safe{position:absolute;inset:10% 10% calc(100% - 880/1080*100%) 10%;border:1px dashed rgba(194,65,45,.8)}.cap{position:absolute;left:0;right:0;top:calc(900/1080*100%);border-top:1px solid rgba(0,0,0,.35)}figcaption{font-size:12px;color:#666;text-align:center}</style></head><body><div class="wrap"><h1>لوحة الهاتف — الحلقة ${episode}</h1><p>كل لقطة بعرض 390px كما تظهر على هاتف؛ الإطار المتقطع هو المنطقة الآمنة، والخط أسفله حد الترجمة. المصدر: <code dir="ltr">${path.relative(projectRoot, video)}</code></p>${blocks.join("")}</div></body></html>`;
  const outDir = path.join(projectRoot, "out");
  await mkdir(outDir, { recursive: true });
  const file = path.join(outDir, `${episode}-phone-sheet.html`);
  await writeFile(file, html);
  return file;
};
