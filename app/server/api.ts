import path from "node:path";
import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";
import { busy, busyMessage, handleExtra, recoverStudioQueue, renderJobs, startRenderJob } from "./extra.ts";
import { HttpError, safeName } from "./util.ts";
import { readBody } from "./body.ts";
import { isTrustedLocalRequest } from "./security.ts";

/**
 * واجهة برمجية محلية للاستوديو: تقرأ وتكتب نفس ملفات المستودع التي تستخدمها أوامر bal.
 * تعمل داخل خادم Vite على جهازك فقط (localhost).
 */
const root = path.resolve(import.meta.dirname, "..", "..");
const configFile = path.join(root, "config.json");


const send = (res: ServerResponse, status: number, body: unknown) => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
};

/** config.json مع رسالة واضحة إن تلف (مثلًا علامات تعارض من git pull أو stash pop) */
const readConfig = async () => {
  const raw = await readFile(configFile, "utf8");
  try {
    return JSON.parse(raw);
  } catch (e) {
    const hint = /^(<<<<<<<|=======|>>>>>>>)/m.test(raw) ? "توجد علامات تعارض Git؛ احتفظ بنسخة من الملف وأصلح التعارض يدويًا دون استبدال تعديلاتك" : (e as Error).message;
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
    // استعادة طابور الرندر بعد إعادة تشغيل الاستوديو (الأمر 010)
    void recoverStudioQueue();
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
        if (!isTrustedLocalRequest(req))
          return send(res, 403, { error: "طلب من مصدر خارجي غير مسموح به في Studio المحلي." });
        // القناة المختارة في الاستوديو تُرسل مع كل طلب؛ وحدات المشروع تقرأها من BAL_CHANNEL
        const ch = url.searchParams.get("channel") || (await readConfig()).defaultChannel;
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(ch)) return send(res, 400, { error: "اسم القناة غير صالح" });
        const channelMod = await load("/src/channel/index.ts");
        // Reject unknown and symlinked channels before any write-capable route.
        if (!channelMod.listChannels().includes(ch) && !["channels", "ops"].includes(parts[0] ?? ""))
          return send(res, 404, { error: "القناة غير موجودة أو مسارها غير آمن." });
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
          // الجاهزة للتشغيل فقط (لها script.md)؛ مجلدات الخطة وحدها (000-trailer، المختبرات) لا تُفتح حلقاتٍ
          const dirs: string[] = await (await load("/src/script/episodes.ts")).listScriptEpisodeDirs(episodesDir);
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

        // مكتبة صور القناة: channels/<القناة>/images/<الخانة>.<الامتداد>
        if (parts[0] === "library-images") {
          const dir = path.join(cp.dir, "images");
          const { MEDIA_EXT } = await load("/src/plan/collect.ts");
          if (parts[1] === "file" && parts[2]) {
            const name = safeName(parts[2]);
            const file = path.join(dir, name);
            if (!MEDIA_EXT.test(name) || !existsSync(file)) return send(res, 404, { error: "الملف غير موجود" });
            const t = /\.png$/i.test(name) ? "image/png" : /\.webp$/i.test(name) ? "image/webp" : /\.mp4$/i.test(name) ? "video/mp4" : /\.webm$/i.test(name) ? "video/webm" : /\.mov$/i.test(name) ? "video/quicktime" : "image/jpeg";
            serveFile(req, res, file, t);
            return;
          }
          if (req.method === "POST") {
            const b = await readBody(req);
            const slot = String(b.slot ?? "").replace(/[^\w-]/g, "");
            const ext = (String(b.name ?? "").match(MEDIA_EXT)?.[0] ?? "").toLowerCase();
            if (!slot || !ext) return send(res, 400, { error: "الملف يجب أن يكون صورة (JPG/PNG/WEBP) أو فيديو (MP4/WEBM/MOV)." });
            const data = Buffer.from(String(b.data ?? "").replace(/^data:[^,]+,/, ""), "base64");
            if (!data.length || data.length > 120 * 1024 * 1024) return send(res, 400, { error: "حجم الملف غير مناسب (الحد 120 ميجابايت)." });
            await mkdir(dir, { recursive: true });
            // ملف واحد لكل خانة: نحذف أي امتداد آخر قديم
            for (const f of existsSync(dir) ? await readdir(dir) : []) if (f.replace(MEDIA_EXT, "") === slot) await rm(path.join(dir, f));
            const fileName = `${slot}${ext === ".jpeg" ? ".jpg" : ext}`;
            await writeFile(path.join(dir, fileName), data);
            return send(res, 200, { file: fileName });
          }
          const files = existsSync(dir) ? (await readdir(dir)).filter((f) => MEDIA_EXT.test(f)) : [];
          return send(res, 200, { files });
        }

        if (parts[0] === "episodes" && parts[1]) {
          const ep = parts[1];
          if (!EP.test(ep)) return send(res, 400, { error: "رقم الحلقة غير صالح" });
          const { resolveScriptPath } = await load("/src/script/episodes.ts");
          const io = await load("/src/plan/io.ts");
          const scriptPath: string = await resolveScriptPath(ep);

          if (parts[2] === "voice-review" && parts.length === 3) {
            const plan = await io.loadPlan(ep);
            if (!plan) throw new HttpError(404, "خطة الحلقة غير موجودة.");
            const { loadVoiceIndex } = await load("/src/voice/generate.ts");
            const { voiceReviewItems, approveVoiceScene, approveVoiceEpisode, episodeVoiceApproved } = await load("/src/voice/review.ts");
            const voice = await loadVoiceIndex(ep);
            if (req.method === "GET") {
              return send(res, 200, { items: await voiceReviewItems(scriptPath, plan, voice), episodeApproved: await episodeVoiceApproved(scriptPath, plan, voice) });
            }
            if (req.method === "PUT") {
              const body = await readBody(req);
              if (!body || typeof body !== "object" || Array.isArray(body) ||
                  (body.scope !== "episode" && typeof body.sceneId !== "string") || typeof body.reviewer !== "string" ||
                  typeof body.note !== "string")
                throw new HttpError(400, "اعتماد الصوت يتطلب المشهد واسم المراجع وملاحظة الاستماع.");
              if ((typeof body.sceneId === "string" && body.sceneId.length > 85) || body.reviewer.length > 120 || body.note.length > 2000)
                throw new HttpError(400, "حقول المراجعة طويلة جدًا.");
              if (body.scope === "episode") {
                await approveVoiceEpisode(scriptPath, plan, voice, body.reviewer, body.note);
              } else {
                await approveVoiceScene(scriptPath, plan, voice, body.sceneId, body.reviewer, body.note);
              }
              return send(res, 200, { items: await voiceReviewItems(scriptPath, plan, voice),
                episodeApproved: await episodeVoiceApproved(scriptPath, plan, voice) });
            }
            return send(res, 405, { error: "Method not allowed" });
          }

          if (parts[2] === "recitation" && parts.length === 3) {
            const { readEpisodeRecitation, saveEpisodeRecitation } = await load("/src/quran/provider.ts");
            if (req.method === "GET") {
              return send(res, 200, { recitation: await readEpisodeRecitation(scriptPath) });
            }
            if (req.method === "PUT") {
              const body = await readBody(req);
              if (!body || typeof body !== "object" || Array.isArray(body) ||
                  !Object.prototype.hasOwnProperty.call(body, "recitation"))
                throw new HttpError(400, "يجب تحديد recitation صراحةً؛ استخدم null فقط عند طلب العودة للقارئ الافتراضي.");
              if (body.recitation !== null && (
                  typeof body.recitation !== "object" || Array.isArray(body.recitation)))
                throw new HttpError(400, "بيانات القارئ المختار غير صالحة.");
              await saveEpisodeRecitation(scriptPath, body.recitation);
              return send(res, 200, { recitation: await readEpisodeRecitation(scriptPath) });
            }
          }

          const mediaFor = async (plan: unknown) => {
            const { collectMedia } = await load("/src/plan/collect.ts");
            return { ...(await collectMedia(ep, plan)), mode: "url", base: `/api/episodes/${ep}/media/`, query: `?channel=${ch}` };
          };
          if (parts.length === 2 && req.method === "GET") {
            const script = await readFile(scriptPath, "utf8");
            const plan = (await io.readPlanFile(scriptPath)) ?? (await io.regeneratePlan(ep));
            const { planIssues } = await load("/src/plan/validate.ts");
            const c = channelMod.loadChannel(ch);
            return send(res, 200, { script, plan, channel: { id: c.id, name: c.name, nameDisplay: c.nameDisplay, nameLatin: c.nameLatin, language: c.language, logo: c.logo, brand: c.brand, rules: { faces: c.rules.faces, music: c.rules.music, quran: c.rules.quran, hadith: c.rules.hadith }, library: c.library, script: c.script, verse: c.verse, pacing: c.pacing, frame: c.frame, cast: c.cast ?? [], tone: c.voice?.tone, voiceProfile: c.voice?.profile?.nameAr }, check: await checkText(script, scriptPath), media: await mediaFor(plan), issues: planIssues(plan, c), keys: { voice: Boolean(process.env.ELEVENLABS_API_KEY && (c.voice?.id || process.env.ELEVENLABS_VOICE_ID)), quran: Boolean(process.env.QF_CLIENT_ID && process.env.QF_CLIENT_SECRET) } });
          }
          if (parts[2] === "media" && parts[3] && parts[4]) {
            const kind = parts[3];
            const name = safeName(parts[4]);
            // التلاوات: من مجلد الحلقة (Quran Foundation) أو من assets/recitations (المرخّصة)
            const epRec = path.join(path.dirname(scriptPath), "recitations");
            const dir = kind === "voice" ? path.join(path.dirname(scriptPath), "voice") : kind === "sfx" ? path.join(root, "assets", "sfx") : kind === "recitations" ? (existsSync(path.join(epRec, name)) ? epRec : path.join(root, "assets", "recitations")) : kind === "images" ? (name.startsWith("lib__") ? path.join(path.dirname(scriptPath), "..", "..", "images") : path.join(path.dirname(scriptPath), "images")) : null;
            const file = dir ? path.join(dir, kind === "images" ? name.replace(/^lib__/, "") : name) : "";
            if (!dir || !existsSync(file)) return send(res, 404, { error: "الملف غير موجود" });
            const imgType = /\.png$/i.test(name) ? "image/png" : /\.webp$/i.test(name) ? "image/webp" : /\.mp4$/i.test(name) ? "video/mp4" : /\.webm$/i.test(name) ? "video/webm" : /\.mov$/i.test(name) ? "video/quicktime" : "image/jpeg";
            serveFile(req, res, file, kind === "images" ? imgType : "audio/mpeg");
            return;
          }
          // رفع صورة لوحة وثائقية: {name, data(base64)} ← تُحفظ في images/ باسم آمن وتُرجع اسمها
          if (parts[2] === "images" && req.method === "POST") {
            const b = await readBody(req);
            const { MEDIA_EXT, imagesDirFor } = await load("/src/plan/collect.ts");
            const ext = (String(b.name ?? "").match(MEDIA_EXT)?.[0] ?? "").toLowerCase();
            if (!ext) return send(res, 400, { error: "الملف يجب أن يكون صورة (JPG/PNG/WEBP) أو فيديو (MP4/WEBM/MOV)." });
            const data = Buffer.from(String(b.data ?? "").replace(/^data:[^,]+,/, ""), "base64");
            if (!data.length || data.length > 120 * 1024 * 1024) return send(res, 400, { error: "حجم الملف غير مناسب (الحد 120 ميجابايت)." });
            const base = String(b.scene ?? "img").replace(/[^\w-]/g, "") || "img";
            const fileName = `${base}-${Date.now().toString(36)}${ext === ".jpeg" ? ".jpg" : ext}`;
            const dir = imagesDirFor(scriptPath);
            await mkdir(dir, { recursive: true });
            await writeFile(path.join(dir, fileName), data);
            const plan = await io.readPlanFile(scriptPath);
            const media = await mediaFor(plan);
            return send(res, 200, { file: fileName, media: { ...media, images: [...new Set([...(media.images ?? []), fileName])] } });
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
            // Fetching Quran audio must never rewrite an existing hand-edited episode plan.
            return send(res, 200, { result, plan: (await io.readPlanFile(scriptPath)) ?? (await io.regeneratePlan(ep)) });
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
            if (!identity || typeof identity !== "object" || Array.isArray(identity) ||
                !["themes", "palettes", "typography", "motion"].every((k) =>
                  identity[k] && typeof identity[k] === "object" && !Array.isArray(identity[k])))
              return send(res, 400, { error: "ملف الهوية ناقص" });
            const storage = await load("/src/channel/storage.ts");
            const rev = await storage.writeJsonWithRevision(
              identityFile, identity,
              typeof req.headers["if-match"] === "string" ? req.headers["if-match"] : undefined,
            );
            res.setHeader("etag", rev);
            return send(res, 200, { ok: true });
          }
          const storage = await load("/src/channel/storage.ts");
          res.setHeader("cache-control", "no-store");
          res.setHeader("etag", await storage.jsonRevision(identityFile));
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
            if (busy.has(`${ch}/${b.episode}`)) return send(res, 409, { error: busyMessage });
            // عبر طابور الرندر المشترك: يبدأ إن سمحت الذاكرة، وإلا ينتظر دوره، ويُستعاد بعد إعادة التشغيل
            const job = startRenderJob(root, ch, b);
            return send(res, 200, job);
          }
          return send(res, 200, [...renderJobs.values()].filter((j) => j.channel === ch).reverse());
        }

        return send(res, 404, { error: "مسار غير معروف" });
        });
      } catch (err) {
        if (err instanceof HttpError) return send(res, err.status, { error: err.message });
        if (err && typeof err === "object" && "status" in err && err.status === 409)
          return send(res, 409, { error: (err as Error).message });
        return send(res, 500, { error: (err as Error).message });
      }
    });
  },
});
