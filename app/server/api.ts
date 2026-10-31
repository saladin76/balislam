import path from "node:path";
import { createReadStream, existsSync, statSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";
import { busy, busyMessage, handleExtra, newJobId, trimJobs } from "./extra.ts";
import { HttpError, safeName } from "./util.ts";

/**
 * واجهة برمجية محلية للاستوديو: تقرأ وتكتب نفس ملفات المستودع التي تستخدمها أوامر bal.
 * تعمل داخل خادم Vite على جهازك فقط (localhost).
 */
const root = path.resolve(import.meta.dirname, "..", "..");
const configFile = path.join(root, "config.json");

type Job = { id: string; channel: string; episode: string; orientation: string; chapter?: number; status: "running" | "done" | "error"; pct: number; output?: string; error?: string; log: string[] };
const jobs = new Map<string, Job>();

const send = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

const readBody = async (req: IncomingMessage): Promise<any> => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "بيانات الطلب غير صالحة.");
  }
};



/** config.json مع رسالة واضحة إن تلف (مثلًا علامات تعارض من git pull أو stash pop) */
const readConfig = async () => {
  const raw = await readFile(configFile, "utf8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    const hint = /^(<<<<<<<|=======|>>>>>>>)/m.test(raw) ? "فيه علامات تعارض من git. أصلحه بالأمر: git checkout origin/main -- config.json" : (e as Error).message;
    throw new HttpError(500, `ملف config.json تالف: ${hint}`);
  }
};

const EP = /^\d{3}$/;

/** يخدم ملفًا مع دعم المقاطع (Range) حتى يستطيع المشغل التقديم والتأخير. */
const serveFile = (req: IncomingMessage, res: ServerResponse, file: string, type: string) => {
  const size = statSync(file).size;
  // مقطع واحد فقط: bytes=start-end أو bytes=start- أو bytes=-suffix
  const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  res.setHeader("content-type", type);
  res.setHeader("accept-ranges", "bytes");
  // الملفات تُعاد صناعتها بنفس الاسم؛ بلا ذاكرة مؤقتة حتى لا يعرض المتصفح نسخة قديمة
  res.setHeader("cache-control", "no-store");
  if (range && (range[1] || range[2])) {
    let start: number;
    let end: number;
    if (!range[1]) {
      start = Math.max(0, size - Number(range[2]));
      end = size - 1;
    } else {
      start = Number(range[1]);
      end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    }
    if (start >= size || start > end) {
      res.statusCode = 416;
      res.setHeader("content-range", `bytes */${size}`);
      res.end();
      return;
    }
    res.statusCode = 206;
    res.setHeader("content-range", `bytes ${start}-${end}/${size}`);
    res.setHeader("content-length", String(end - start + 1));
    createReadStream(file, { start, end }).pipe(res);
  } else {
    res.setHeader("content-length", String(size));
    createReadStream(file).pipe(res);
  }
};

export const balApi = (): Plugin => ({
  name: "bal-api",
  configureServer(server: ViteDevServer) {
    /** تحميل وحدات المشروع (TypeScript) من جذر المستودع. */
    // ‎/@fs/ يحتاج مسارًا بشرطات مائلة للأمام (ويندوز: /@fs/C:/...)
    const load = async <T = any>(file: string): Promise<T> => {
      const abs = path.join(root, file).replace(/\\/g, "/");
      return (await server.ssrLoadModule(`/@fs${abs.startsWith("/") ? "" : "/"}${abs}`)) as T;
    };

    const checkText = async (text: string, file = "script.md") => {
      const { parseScript } = await load("/src/script/parse.ts");
      const { checkForChannel } = await load("/src/script/checkChannel.ts");
      return checkForChannel(parseScript(text, file));
    };

    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (!url.pathname.startsWith("/api/")) return next();
      const parts = url.pathname.split("/").filter(Boolean).slice(1);
      try {
        // القناة المختارة في الاستوديو تُرسل مع كل طلب؛ وحدات المشروع تقرأها من BAL_CHANNEL
        const ch = url.searchParams.get("channel") || (await readConfig()).defaultChannel;
        if (!/^[a-z0-9-]+$/.test(ch)) return send(res, 400, { error: "اسم القناة غير صالح" });
        const channelMod = await load("/src/channel/index.ts");
        // كل ما يلي يعمل على قناة هذا الطلب فقط (حتى العمليات الطويلة بعد await)
        return await channelMod.runWithChannel(ch, async () => {
        const cp = channelMod.channelPaths(ch);
        const episodesDir: string = cp.episodes;
        const identityFile: string = cp.identity;
        const identityDefaultFile: string = cp.identityDefault;

        if (await handleExtra({ req, res, parts, ch, root, episodesDir, load, send, readBody, serveFile })) return;

        if (parts[0] === "channels") {
          const list = channelMod.listChannels().map((id: string) => {
            const c = channelMod.loadChannel(id);
            return { id: c.id, name: c.name, language: c.language, domains: c.domains, rules: c.rules };
          });
          return send(res, 200, list);
        }

        // الحلقات
        if (parts[0] === "episodes" && parts.length === 1) {
          if (req.method === "POST") {
            const b = await readBody(req);
            const { createEpisode } = await load("/src/script/episodes.ts");
            await createEpisode({ episode: b.episode, slug: b.slug, domain: b.domain, title: b.title });
            return send(res, 200, { ok: true });
          }
          const dirs = existsSync(episodesDir) ? (await readdir(episodesDir)).filter((d) => /^\d{3}-/.test(d)).sort() : [];
          const list = await Promise.all(
            dirs.map(async (d) => {
              const script = path.join(episodesDir, d, "script.md");
              let title = "";
              let domain = "";
              if (existsSync(script)) {
                const head = (await readFile(script, "utf8")).slice(0, 800);
                title = head.match(/^title:\s*"?(.*?)"?\s*$/m)?.[1] ?? "";
                domain = head.match(/^domain:\s*(\w+)/m)?.[1] ?? "";
              }
              return { id: d.slice(0, 3), dir: d, title, domain, hasPlan: existsSync(path.join(episodesDir, d, "plan.json")) };
            }),
          );
          return send(res, 200, list);
        }

        if (parts[0] === "episodes" && parts[1]) {
          const ep = parts[1];
          if (!EP.test(ep)) return send(res, 400, { error: "رقم الحلقة غير صالح" });
          const { resolveScriptPath } = await load("/src/script/episodes.ts");
          const io = await load("/src/plan/io.ts");
          const scriptPath: string = await resolveScriptPath(ep);

          const mediaFor = async (plan: unknown) => {
            const { collectMedia } = await load("/src/plan/collect.ts");
            return { ...(await collectMedia(ep, plan)), mode: "url", base: `/api/episodes/${ep}/media/`, query: `?channel=${ch}` };
          };
          if (parts.length === 2 && req.method === "GET") {
            const script = await readFile(scriptPath, "utf8");
            const plan = (await io.readPlanFile(scriptPath)) ?? (await io.regeneratePlan(ep));
            const { planIssues } = await load("/src/plan/validate.ts");
            const c = channelMod.loadChannel(ch);
            return send(res, 200, { script, plan, channel: { id: c.id, name: c.name, nameLatin: c.nameLatin, language: c.language, logo: c.logo, brand: c.brand, rules: { faces: c.rules.faces, music: c.rules.music } }, check: await checkText(script, scriptPath), media: await mediaFor(plan), issues: planIssues(plan), keys: { voice: Boolean(process.env.ELEVENLABS_API_KEY && (c.voice?.id || process.env.ELEVENLABS_VOICE_ID)), quran: Boolean(process.env.QF_CLIENT_ID && process.env.QF_CLIENT_SECRET) } });
          }
          if (parts[2] === "media" && parts[3] && parts[4]) {
            const kind = parts[3];
            const name = safeName(parts[4]);
            // التلاوات: من مجلد الحلقة (Quran Foundation) أو من assets/recitations (المرخّصة)
            const epRec = path.join(path.dirname(scriptPath), "recitations");
            const dir = kind === "voice" ? path.join(path.dirname(scriptPath), "voice") : kind === "sfx" ? path.join(root, "assets", "sfx") : kind === "recitations" ? (existsSync(path.join(epRec, name)) ? epRec : path.join(root, "assets", "recitations")) : null;
            const file = dir ? path.join(dir, name) : "";
            if (!dir || !existsSync(file)) return send(res, 404, { error: "الملف غير موجود" });
            serveFile(req, res, file, "audio/mpeg");
            return;
          }
          if (parts[2] === "voice" && req.method === "POST") {
            const b = await readBody(req);
            const { elevenLabsFromEnv } = await load("/src/voice/elevenlabs.ts");
            const { generateVoice } = await load("/src/voice/generate.ts");
            const client = elevenLabsFromEnv();
            const report = await generateVoice(ep, { client, dryRun: b.dryRun || !client, only: b.scenes, force: b.force });
            const plan = await io.readPlanFile(scriptPath);
            return send(res, 200, { report, generated: Boolean(client && !b.dryRun), media: await mediaFor(plan) });
          }
          if (parts[2] === "quran" && req.method === "POST") {
            const { quranClientFromEnv } = await load("/src/quran/client.ts");
            const { syncQuran } = await load("/src/quran/sync.ts");
            const client = quranClientFromEnv();
            if (!client) return send(res, 400, { error: "أضف مفاتيح Quran Foundation من تبويب «الإعدادات»." });
            const result = await syncQuran(ep, client);
            return send(res, 200, { result, plan: await io.regeneratePlan(ep) });
          }
          if (parts[2] === "script" && req.method === "PUT") {
            const { text } = await readBody(req);
            if (typeof text !== "string" || !text.trim()) return send(res, 400, { error: "نص السكريبت فارغ؛ لم يُحفظ." });
            await writeFile(scriptPath, text, "utf8");
            const check = await checkText(text, scriptPath);
            const plan = await io.regeneratePlan(ep);
            return send(res, 200, { check, plan });
          }
          if (parts[2] === "plan" && parts[3] === "regenerate" && req.method === "POST") {
            return send(res, 200, { plan: await io.regeneratePlan(ep) });
          }
          if (parts[2] === "plan" && req.method === "PUT") {
            const { plan } = await readBody(req);
            if (!plan || !Array.isArray(plan.chapters) || plan.chapters.some((c: any) => !Array.isArray(c?.scenes))) return send(res, 400, { error: "الخطة غير مكتملة؛ لم تُحفظ." });
            await io.writePlanFile(io.planPathFor(scriptPath), { ...plan, updatedAt: new Date().toISOString() });
            return send(res, 200, { ok: true });
          }
          if (parts[2] === "video" && parts[3]) {
            const file = path.join(path.dirname(scriptPath), "out", safeName(parts[3]));
            if (!existsSync(file)) return send(res, 404, { error: "الملف غير موجود" });
            serveFile(req, res, file, "video/mp4");
            return;
          }
        }

        // فحص نص دون حفظ (أثناء الكتابة)
        if (parts[0] === "check" && req.method === "POST") {
          const { text } = await readBody(req);
          return send(res, 200, await checkText(text));
        }

        // الهوية
        if (parts[0] === "identity") {
          if (req.method === "PUT") {
            const { identity } = await readBody(req);
            if (!identity?.themes || !identity?.palettes || !identity?.typography || !identity?.motion) return send(res, 400, { error: "ملف الهوية ناقص" });
            await writeFile(identityFile, JSON.stringify(identity, null, 2) + "\n", "utf8");
            return send(res, 200, { ok: true });
          }
          return send(res, 200, {
            identity: JSON.parse(await readFile(identityFile, "utf8")),
            defaults: JSON.parse(await readFile(identityDefaultFile, "utf8")),
          });
        }

        // الرندر
        if (parts[0] === "render") {
          if (req.method === "POST") {
            const b = await readBody(req);
            if (!EP.test(b.episode)) return send(res, 400, { error: "رقم الحلقة غير صالح" });
            const key = `${ch}/${b.episode}`;
            if (busy.has(key)) return send(res, 409, { error: busyMessage });
            busy.add(key);
            const id = newJobId();
            const job: Job = { id, channel: ch, episode: b.episode, orientation: b.orientation, chapter: b.chapter, status: "running", pct: 0, log: [] };
            jobs.set(id, job);
            trimJobs(jobs);
            const args = ["bin/bal.mjs", "--channel", ch, "render", b.episode];
            if (b.orientation === "portrait") args.push("--portrait");
            if (b.chapter) args.push("--chapter", String(b.chapter));
            const child = spawn(process.execPath, args, { cwd: root, env: process.env });
            const onData = (d: Buffer) => {
              for (const line of d.toString().split("\n")) {
                const p = line.match(/^PROGRESS (\d+)/);
                if (p) job.pct = Number(p[1]);
                const done = line.match(/^DONE (.+)$/);
                if (done) job.output = path.basename(done[1]!.trim());
                if (line.trim()) job.log.push(line.trim());
                if (job.log.length > 50) job.log.shift();
              }
            };
            child.stdout.on("data", onData);
            child.stderr.on("data", onData);
            child.on("error", (err) => {
              busy.delete(key);
              job.status = "error";
              job.error = `تعذّر تشغيل الرندر: ${err.message}`;
            });
            child.on("close", (code) => {
              busy.delete(key);
              job.status = code === 0 ? "done" : "error";
              if (code !== 0) job.error = job.log.filter((l) => /خطأ|Error/.test(l)).pop() ?? "فشل الرندر";
            });
            return send(res, 200, job);
          }
          return send(res, 200, [...jobs.values()].filter((j) => j.channel === ch).reverse());
        }

        return send(res, 404, { error: "مسار غير معروف" });
        });
      } catch (err) {
        if (err instanceof HttpError) return send(res, err.status, { error: err.message });
        return send(res, 500, { error: (err as Error).message });
      }
    });
  },
});
