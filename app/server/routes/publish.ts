import path from "node:path";
import { existsSync, statSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { safeName } from "../util.ts";
import { EP } from "../routeContext.ts";
import type { RouteCtx } from "../routeContext.ts";

const types: Record<string, string> = { ".png": "image/png", ".mp4": "video/mp4", ".srt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".mp3": "audio/mpeg" };

/** «٤ النشر»: حالة النشر بإذنه (requirePublishAllowed)، وحزمة الانتشار، وملفات التغليف للتنزيل بجودتها. */
export const handlePublishRoutes = async (ctx: RouteCtx): Promise<boolean> => {
  const { req, res, parts, ch, send, readBody, load } = ctx;

  // حالة النشر لكل حلقة (status.json)
  if (parts[0] === "episodes" && parts[1] && parts[2] === "status") {
    if (!EP.test(parts[1])) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
    const { resolveScriptPath } = await load("/src/script/episodes.ts");
    const file = path.join(path.dirname(await resolveScriptPath(parts[1])), "status.json");
    if (req.method === "PUT") {
      const { status } = await readBody(req);
      if (!status || typeof status !== "object" || Array.isArray(status)) return send(res, 400, { error: "حالة النشر غير صالحة؛ لم تُحفظ." }), true;
      const old = existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : {};
      // A legacy size/mtime marker never authorizes publishing. Check the exact
      // current Master hash before recording any NEW publication/approval.
      if ((status.published && JSON.stringify(status.published) !== JSON.stringify(old.published)) ||
          (status.approved && JSON.stringify(status.approved) !== JSON.stringify(old.approved))) {
        const { requirePublishAllowed } = await load("/src/studio/sceneService.ts");
        // A gate refusal is a 409 the Publish tab can show, not a server crash (500).
        try { await requirePublishAllowed(parts[1]); }
        catch (e) { return send(res, 409, { error: (e as Error).message }), true; }
      }
      await writeFile(file, JSON.stringify(status, null, 2) + "\n");
      send(res, 200, { ok: true });
    } else send(res, 200, existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : {});
    return true;
  }

  // حزمة الانتشار: عناوين وأوصاف وكابشن لكل منصة
  if (parts[0] === "episodes" && parts[1] && parts[2] === "kit") {
    if (!EP.test(parts[1])) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
    const ep = parts[1];
    const { resolveScriptPath } = await load("/src/script/episodes.ts");
    const io = await load("/src/plan/io.ts");
    const social = await load("/src/package/social.ts");
    const scriptPath: string = await resolveScriptPath(ep);
    const file = path.join(path.dirname(scriptPath), "publish.json");
    const plan = (await io.readPlanFile(scriptPath)) ?? (await io.regeneratePlan(ep));
    const build = async () => {
      const { collectMedia } = await load("/src/plan/collect.ts");
      const media = { ...(await collectMedia(ep, plan)), mode: "url", base: "" };
      const { loadChannel } = await load("/src/channel/index.ts");
      return social.generatePublishKit(plan, await readFile(scriptPath, "utf8"), media, loadChannel());
    };
    if (req.method === "PUT") {
      const { kit } = await readBody(req);
      if (!kit?.long || !Array.isArray(kit.shorts)) return send(res, 400, { error: "حزمة الانتشار غير مكتملة؛ لم تُحفظ." }), true;
      const saved = { ...kit, generatedBy: social.savedKitSource(kit.generatedBy), updatedAt: new Date().toISOString() };
      // القاعدة الأولى: لا يُكتب أثر لأدوات الإنتاج في publish.json (بوابة المحتوى ترفضه بعدها فيتوقف الحفظ الآلي كله)
      const traces: string[] = social.kitTraceHits(saved);
      if (traces.length) return send(res, 400, { error: `في نصوص النشر أثر لأدوات الإنتاج؛ لم تُحفظ: ${traces.join("، ")}` }), true;
      await writeFile(file, JSON.stringify(saved, null, 2) + "\n");
      return send(res, 200, { ok: true }), true;
    }
    if (req.method === "POST" && parts[3] === "regenerate") {
      const kit = await build();
      await writeFile(file, JSON.stringify(kit, null, 2) + "\n");
      return send(res, 200, { kit, keywords: social.kitKeywords(plan) }), true;
    }
    // القراءة لا تكتب شيئًا: إن لم تُحفظ الحزمة بعد تُعرض نسخة آلية، وتُحفظ فقط عند التعديل أو «أعد التوليد»
    const kit = existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : await build();
    const { collectMedia } = await load("/src/plan/collect.ts");
    const media = { ...(await collectMedia(ep, plan)), mode: "url", base: "" };
    const info = (await load("/src/channel/types.ts")).channelInfo((await load("/src/channel/index.ts")).loadChannel(ch));
    // Real timings (assembled cuts, Master length) when they exist; else the plan's — marked for the Studio only (D36).
    const real = await (await load("/src/package/realTimings.ts")).realEpisodeTimings(scriptPath, plan);
    const timeline = (await load("/src/package/chapterTimes.ts")).chapterTimeline(plan, media, info, real);
    // Where every scene starts in the published file (assembled cuts, else the plan): the chapters editor shows each
    // chapter's real time from it as the owner picks scenes (src/package/chapters.ts).
    const sceneStarts = (await load("/src/package/chapters.ts")).sceneStartsFor(plan, media, info, real);
    return send(res, 200, { kit, keywords: social.kitKeywords(plan), chapters: social.chaptersText(plan, media, info, real, kit.long?.chapters),
      chaptersEstimated: kit.long?.chapters?.length ? sceneStarts.estimated : timeline.estimated, chaptersSource: timeline.source, sceneStarts,
      // صيغة عنوان القناة تُفحص في «حزمة الانتشار» (src/package/titleFormula.ts)
      titleCtx: { channel: ch, book: ((await load("/src/script/parse.ts")).parseScript(await readFile(scriptPath, "utf8")).frontmatter ?? {}).book, series: plan.series?.name } }), true;
  }


  // ملفات التغليف
  if (parts[0] === "episodes" && parts[1] && parts[2] === "package") {
    if (!EP.test(parts[1])) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
    const { resolveScriptPath } = await load("/src/script/episodes.ts");
    const dir = path.join(path.dirname(await resolveScriptPath(parts[1])), "out", "package");
    if (parts[3]) {
      const file = path.join(dir, safeName(parts[3]));
      if (!existsSync(file)) return send(res, 404, { error: "الملف غير موجود" }), true;
      const ext = path.extname(file);
      if (new URL(req.url ?? "/", "http://x").searchParams.get("download")) res.setHeader("content-disposition", `attachment; filename="${path.basename(file)}"`);
      ctx.serveFile(req, res, file, types[ext] ?? "application/octet-stream");
      return true;
    }
    if (!existsSync(dir)) return send(res, 200, { files: [], youtube: "", checklist: "" }), true;
    const names = (await readdir(dir)).sort();
    send(res, 200, {
      files: names.map((n) => ({ name: n, size: statSync(path.join(dir, n)).size, mtime: statSync(path.join(dir, n)).mtimeMs })),
      youtube: existsSync(path.join(dir, "youtube.md")) ? await readFile(path.join(dir, "youtube.md"), "utf8") : "",
      checklist: existsSync(path.join(dir, "publish-checklist.md")) ? await readFile(path.join(dir, "publish-checklist.md"), "utf8") : "",
      render: existsSync(path.join(dir, "render.json")) ? JSON.parse(await readFile(path.join(dir, "render.json"), "utf8")) : null,
    });
    return true;
  }


  return false;
};
