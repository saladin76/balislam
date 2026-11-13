import path from "node:path";
import { existsSync, statSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { safeName } from "../util.ts";
import { EP } from "../routeContext.ts";
import type { RouteCtx } from "../routeContext.ts";

/** معاينات الحلقة (محلية أو Drive أو فرع previews/*، D75) وإعدادها، وصفحات المراجعة الداخلية. لا تُنشر أبدًا. */
export const handlePreviewRoutes = async (ctx: RouteCtx): Promise<boolean> => {
  const { req, res, parts, send, readBody, load } = ctx;

  // معاينات الحلقة: الفهرس في previews/index.json (Git)، والفيديو محليًا أو في مجلد Google Drive المتزامن. لا تُنشر أبدًا
  if (parts[0] === "episodes" && parts[1] && parts[2] === "previews") {
    if (!EP.test(parts[1])) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
    const { resolveEpisodeDir } = await load("/src/script/episodes.ts");
    const pv = await load("/src/render/episodePreviews.ts");
    const epDir = await resolveEpisodeDir(parts[1]);
    // «حمّل المعاينة»: معاينة سحابية من فرعها previews/* (D75)؛ POST يبدأ التحميل، GET حالته
    if (parts[3] && parts[4] === "download" && parts.length === 5) {
      const cp = await load("/src/render/cloudPreviews.ts");
      const name = safeName(parts[3]);
      if (req.method === "POST") {
        try { cp.startCloudPreviewDownload(epDir, name, { log: (m: string) => console.warn(m) }); }
        catch (e) { return send(res, 400, { error: (e as Error).message }), true; }
      } else if (req.method !== "GET") return send(res, 405, { error: "Method not allowed" }), true;
      return send(res, 200, { job: cp.cloudPreviewJob(epDir, name) }), true;
    }
    if (parts[3]) {
      const name = safeName(parts[3]);
      if (!/\.mp4$/i.test(name)) return send(res, 404, { error: "الملف غير موجود" }), true;
      const indexFile = path.join(epDir, "previews", "index.json");
      const index = existsSync(indexFile) ? JSON.parse(await readFile(indexFile, "utf8")) : {};
      const where = await pv.locatePreview(epDir, name, index[name]);
      if (where.kind === "local" || where.kind === "drive-mirror") { ctx.serveFile(req, res, where.file, "video/mp4"); return true; }
      return send(res, 404, { error: where.kind === "drive-link" ? "الفيديو على Google Drive ولم يتزامن مع هذا الجهاز بعد."
        : where.kind === "git-branch" ? "المعاينة على GitHub ولم تُحمَّل إلى هذا الجهاز بعد؛ اضغط «حمّل المعاينة»." : "الملف غير موجود",
        driveUrl: where.kind === "drive-link" ? where.url : null }), true;
    }
    const files = await pv.listEpisodePreviews(epDir);
    const cloud = files.filter((f: { cloud: unknown }) => f.cloud);
    let autoDownload = false;
    if (cloud.length) {
      const cp = await load("/src/render/cloudPreviews.ts");
      autoDownload = (await cp.readCloudPreviewSettings(ctx.root)).autoDownload;
      // «حمّل المعاينات الجديدة تلقائيًا» (مطفأ افتراضيًا): يبدأ التحميل في الخلفية عند عرض القائمة
      if (autoDownload) for (const f of cloud) if (f.source === "git-branch" && cp.cloudPreviewJob(epDir, f.name)?.state !== "error")
        cp.startCloudPreviewDownload(epDir, f.name, { log: (m: string) => console.warn(m) });
    }
    return send(res, 200, { files, autoDownload }), true;
  }

  // إعداد «حمّل المعاينات الجديدة تلقائيًا» (محلي في .studio/، مطفأ افتراضيًا)
  if (parts[0] === "cloud-previews" && parts[1] === "settings" && parts.length === 2) {
    const cp = await load("/src/render/cloudPreviews.ts");
    if (req.method === "POST") {
      const { autoDownload } = await readBody(req);
      return send(res, 200, await cp.writeCloudPreviewSettings(ctx.root, { autoDownload: autoDownload === true })), true;
    }
    return send(res, 200, await cp.readCloudPreviewSettings(ctx.root)), true;
  }

  // ملفات المراجعة (reviews/ بجوار السكريبت): تقارير الاعتماد التحريري والشرعي للحلقة، صفحات HTML مكتفية بذاتها، داخلية لا تُنشر
  if (parts[0] === "episodes" && parts[1] && parts[2] === "reviews") {
    if (!EP.test(parts[1])) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
    const { resolveScriptPath } = await load("/src/script/episodes.ts");
    const dir = path.join(path.dirname(await resolveScriptPath(parts[1])), "reviews");
    if (parts[3]) {
      const file = path.join(dir, safeName(parts[3]));
      if (!existsSync(file) || !/\.html$/i.test(file)) return send(res, 404, { error: "الملف غير موجود" }), true;
      ctx.serveFile(req, res, file, "text/html; charset=utf-8");
      return true;
    }
    if (!existsSync(dir)) return send(res, 200, { files: [] }), true;
    const names = (await readdir(dir)).filter((n) => /\.html$/i.test(n));
    const files = await Promise.all(
      names.map(async (n) => {
        const html = await readFile(path.join(dir, n), "utf8");
        const title = /<title>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() || n;
        const note = /<meta name="description" content="([^"]*)"/i.exec(html)?.[1] ?? "";
        return { name: n, title, note, mtime: statSync(path.join(dir, n)).mtimeMs };
      }),
    );
    return send(res, 200, { files: files.sort((x, y) => y.mtime - x.mtime) }), true;
  }


  return false;
};
