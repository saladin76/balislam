import path from "node:path";
import { existsSync, statSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import type { RouteCtx } from "../routeContext.ts";

const episodeDirs = async (episodesDir: string) => (existsSync(episodesDir) ? (await readdir(episodesDir)).filter((d) => /^\d{3}-/.test(d)).sort() : []);

/** حالة كل حلقة في مجلد حلقات قناة: السكريبت، والمشاهد، والصوت، والفيديو، والنشر، والأسلوب الغالب. */
const buildOverview = async (episodesDir: string, load: RouteCtx["load"]) => {
    const { parseScript } = await load("/src/script/parse.ts");
    const { checkForChannel } = await load("/src/script/checkChannel.ts");
    const { planIssues } = await load("/src/plan/validate.ts");
    const { loadChannel } = await load("/src/channel/index.ts");
    const { summarizeSceneProduction } = await load("/src/studio/sceneService.ts");
    const { episodeLength } = await load("/src/plan/episodeLength.ts");
    const { collectMedia } = await load("/src/plan/collect.ts");
    const { episodeSeriesOf: seriesOf } = await load("/src/channel/seriesStore.ts");
    const out = [];
    for (const d of await episodeDirs(episodesDir)) {
      const dir = path.join(episodesDir, d);
      const scriptFile = path.join(dir, "script.md");
      if (!existsSync(scriptFile)) continue;
      const script = await readFile(scriptFile, "utf8");
      const parsed = parseScript(script, scriptFile);
      const check = checkForChannel(parsed);
      const fm = (parsed.frontmatter ?? {}) as { title?: string; domain?: string; lang?: string };
      const plan = existsSync(path.join(dir, "plan.json")) ? JSON.parse(await readFile(path.join(dir, "plan.json"), "utf8")) : null;
      const scenes = plan ? plan.chapters.flatMap((c: any) => c.scenes) : [];
      const voiced = scenes.filter((s: any) => s.narration?.trim());
      const vIndex = existsSync(path.join(dir, "voice", "index.json")) ? JSON.parse(await readFile(path.join(dir, "voice", "index.json"), "utf8")) : {};
      const voiceOk = voiced.filter((s: any) => vIndex[s.id]?.text === s.narration.trim()).length;
      const issues = plan ? planIssues(plan, loadChannel(plan.channel)) : [];
      const pkgDir = path.join(dir, "out", "package");
      const pkgFiles = existsSync(pkgDir) ? await readdir(pkgDir) : [];
      const id = d.slice(0, 3);
      const video = pkgFiles.find((f) => f.endsWith("-episode.mp4"));
      const status = existsSync(path.join(dir, "status.json")) ? JSON.parse(await readFile(path.join(dir, "status.json"), "utf8")) : {};
      out.push({
        id,
        dir: d,
        title: fm.title ?? "",
        domain: fm.domain ?? "",
        lang: fm.lang ?? "",
        check: { ok: check.ok, errors: check.issues.filter((i: any) => i.level === "error").length, warnings: check.issues.filter((i: any) => i.level === "warning").length, seconds: check.stats.totalSeconds },
        scenes: scenes.length,
        voice: { done: voiceOk, total: voiced.length },
        blocking: issues.filter((i: any) => i.level === "error").length,
        package: { video: Boolean(video), shorts: pkgFiles.filter((f) => /-short-\d\.mp4$/.test(f)).length, thumbnails: pkgFiles.filter((f) => f.endsWith(".png")).length, updatedAt: video ? statSync(path.join(pkgDir, video)).mtimeMs : null },
        planUpdatedAt: plan?.updatedAt ? Date.parse(plan.updatedAt) : null,
        // One length everywhere (D52): the plan's own duration, measured once the voice exists.
        length: plan ? episodeLength(plan, await collectMedia(id, plan).catch(() => undefined)) : null,
        style: styleOf((fm as { style?: string }).style, scenes),
        // سلسلة الحلقة (ملف الانتماء بجوار السكريبت، وإلا «عام»)
        series: seriesOf(dir).series,
        seriesNumber: seriesOf(dir).stamp?.number ?? null,
        status,
        // حالة الحلقة في الخطوات الأربع من سجل الإنتاج نفسه (المصدر الوحيد للاعتماد)
        production: await summarizeSceneProduction(id).catch(() => null),
      });
    }
  return out;
};

/** الأسلوب البصري للحلقة: من style في السكريبت، وإلا القالب الأكثر استعمالًا في مشاهدها (لتنبيه التنوّع). */
const styleOf = (fmStyle: string | undefined, scenes: { template?: string }[]) => {
  if (fmStyle && fmStyle !== "templates") return fmStyle;
  const count = new Map<string, number>();
  for (const s of scenes) if (s.template && !["verse-card", "hadith-card", "end-screen", "summary"].includes(s.template)) count.set(s.template, (count.get(s.template) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fmStyle ?? "";
};

/** نظرة عامة على حلقات القناة، وغرفة العمليات لكل القنوات، والتقويم، وبنك الأفكار. */
export const handleOverviewRoutes = async (ctx: RouteCtx): Promise<boolean> => {
  const { req, res, parts, ch, send, readBody, load, episodesDir } = ctx;

  // نظرة عامة: مرحلة كل حلقة
  if (parts[0] === "overview") {
    send(res, 200, await buildOverview(episodesDir, load));
    return true;
  }

  // غرفة العمليات: كل القنوات مرة واحدة (الحلقات، والجدول، وبنك الأفكار)
  if (parts[0] === "ops" && req.method === "GET") {
    const channelMod = await load("/src/channel/index.ts");
    const out = [];
    for (const id of channelMod.listChannels() as string[]) {
      const c = channelMod.loadChannel(id);
      const cp = channelMod.channelPaths(id);
      const episodes = await channelMod.runWithChannel(id, () => buildOverview(cp.episodes, load));
      const ideasFile = path.join(cp.dir, "ideas.json");
      const ideas = existsSync(ideasFile) ? JSON.parse(await readFile(ideasFile, "utf8")) : [];
      const calFile = path.join(cp.dir, "calendar.json");
      const calendar = existsSync(calFile) ? JSON.parse(await readFile(calFile, "utf8")) : {};
      out.push({ channel: { id: c.id, name: c.name, language: c.language, schedule: c.schedule ?? null, domains: c.domains }, episodes, ideas, calendar });
    }
    send(res, 200, out);
    return true;
  }

  // تقويم القناة: شورتس كل يوم وملاحظاته وأيام الإجازة (channels/<id>/calendar.json)
  if (parts[0] === "calendar" && req.method === "PUT") {
    const channelMod = await load("/src/channel/index.ts");
    const { calendar } = await readBody(req);
    if (!calendar || typeof calendar !== "object" || Array.isArray(calendar) || Object.keys(calendar).some((k) => !/^\d{4}-\d{2}-\d{2}$/.test(k))) return send(res, 400, { error: "التقويم غير صالح." }), true;
    await writeFile(path.join(channelMod.channelPaths(ch).dir, "calendar.json"), JSON.stringify(calendar, null, 2) + "\n", "utf8");
    send(res, 200, { ok: true });
    return true;
  }

  // بنك الأفكار للقناة: channels/<id>/ideas.json
  if (parts[0] === "ideas") {
    const channelMod = await load("/src/channel/index.ts");
    const file = path.join(channelMod.channelPaths(ch).dir, "ideas.json");
    if (req.method === "PUT") {
      const { ideas } = await readBody(req);
      if (!Array.isArray(ideas) || ideas.some((i: any) => typeof i?.id !== "string" || typeof i?.title !== "string")) return send(res, 400, { error: "قائمة الأفكار غير صالحة." }), true;
      await writeFile(file, JSON.stringify(ideas, null, 2) + "\n", "utf8");
      send(res, 200, { ok: true });
    } else send(res, 200, existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : []);
    return true;
  }


  return false;
};
