import path from "node:path";
import { existsSync } from "node:fs";
import { safeName } from "../util.ts";
import type { RouteCtx } from "../routeContext.ts";

/** المراجعات الفنية، وستوري بورد المختبرات ومختبرات الإنتاج (للقراءة، ولا تُنشر)، ودليل القناة. */
export const handleLabRoutes = async (ctx: RouteCtx): Promise<boolean> => {
  const { req, res, parts, ch, send, readBody, load, episodesDir } = ctx;

  // المراجعات الفنية (الأمر 018): تقارير المنفّذ بشرائطها ومقاطعها، بجوار الحلقة أو المختبر؛ للقراءة
  if (parts[0] === "tech-reviews" && req.method === "GET") {
    const rv = await load("/src/channel/techReviews.ts");
    if (!parts[1]) return send(res, 200, { reviews: await rv.listTechReviews(episodesDir) }), true;
    const rel = parts.slice(3).map((x) => decodeURIComponent(x)).join("/");
    const file: string | null = await rv.techReviewFilePath(episodesDir, parts[1], parts[2] ?? "", rel);
    if (!file) return send(res, 404, { error: "الملف غير موجود في المراجعة" }), true;
    const type = file.endsWith(".mp4") ? "video/mp4" : file.endsWith(".jpg") ? "image/jpeg" : file.endsWith(".pdf") ? "application/pdf" : file.endsWith(".json") ? "application/json; charset=utf-8" : "text/markdown; charset=utf-8";
    ctx.serveFile(req, res, file, type);
    return true;
  }

  // ستوري بورد المختبرات (ملحق الأمر 015): صور بكل نسخها في storyboards/؛ لبالإسلام وحدها
  if (parts[0] === "labs" && parts[1] && parts[2] === "storyboards") {
    const sb = await load("/src/channel/labStoryboards.ts");
    if (!sb.labStoryboardsEnabled(ch)) return send(res, 404, { error: "ستوري بورد المختبرات غير مفعّل لهذه القناة" }), true;
    const labs = await load("/src/channel/labs.ts");
    const dirs: string[] = await labs.listLabDirs(episodesDir);
    if (!dirs.includes(parts[1])) return send(res, 404, { error: "المختبر غير موجود" }), true;
    const labDir = path.join(episodesDir, parts[1]);
    if (req.method === "GET" && !parts[3]) return send(res, 200, { entries: await sb.listLabStoryboards(labDir) }), true;
    if (req.method === "GET" && parts[3] && !parts[4]) {
      const file: string | null = sb.labStoryboardFile(labDir, decodeURIComponent(parts[3]));
      if (!file) return send(res, 404, { error: "الصورة غير موجودة" }), true;
      ctx.serveFile(req, res, file, file.endsWith(".png") ? "image/png" : file.endsWith(".webp") ? "image/webp" : "image/jpeg");
      return true;
    }
    // قرار صاحب القناة من الاستوديو: زر صريح بنص مكتوب؛ لا يُسجَّل اعتماد بغيره
    if (req.method === "POST" && parts[3] && parts[4] && parts[5] === "decision") {
      const { status, note } = await readBody(req);
      try {
        const v = await sb.decideLabStoryboard(ch, labDir, decodeURIComponent(parts[3]), Number(parts[4]), { status, note, by: "صاحب القناة (من الاستوديو)" });
        return send(res, 200, { version: v }), true;
      } catch (e) {
        return send(res, 400, { error: (e as Error).message }), true;
      }
    }
    return send(res, 404, { error: "غير موجود" }), true;
  }

  // مختبرات الإنتاج (الأمر 017): مجلدات lab.json لهذه القناة وحدها، ومعايناتها؛ ليست حلقات ولا تُنشر
  if (parts[0] === "labs" && req.method === "GET") {
    const labs = await load("/src/channel/labs.ts");
    if (!parts[1]) return send(res, 200, { labs: await labs.listLabs(episodesDir) }), true;
    const dirs: string[] = await labs.listLabDirs(episodesDir);
    if (!dirs.includes(parts[1]) || parts[2] !== "previews" || !parts[3]) return send(res, 404, { error: "المختبر غير موجود" }), true;
    const file = path.join(episodesDir, parts[1], "previews", safeName(parts[3]));
    if (!existsSync(file) || !/\.mp4$/i.test(file)) return send(res, 404, { error: "الملف غير موجود" }), true;
    ctx.serveFile(req, res, file, "video/mp4");
    return true;
  }

  // دليل الاستوديو (docs/<القناة>/): مرجع القناة الدائم للقراءة فقط؛ الفهرس guide.json وصفحاته
  if (parts[0] === "guide" && req.method === "GET") {
    const g = await load("/src/channel/guide.ts");
    if (!parts[1]) return send(res, 200, { index: await g.readGuideIndex(ch) }), true;
    const text = await g.readGuidePage(ch, decodeURIComponent(parts[1]));
    if (text === null) return send(res, 404, { error: "الصفحة غير موجودة في دليل القناة" }), true;
    return send(res, 200, { text }), true;
  }


  return false;
};
