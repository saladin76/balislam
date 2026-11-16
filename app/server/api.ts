import path from "node:path";
import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";
import { busy, busyRefusal, longJobs, recoverStudioQueue, renderJobs, startRenderJob } from "./jobQueue.ts";
import { ownerRefusal } from "./routeContext.ts";
import { handleStudioRoutes } from "./routes/index.ts";
import { contentSyncEnabled, createContentSync, setSharedContentSync } from "./contentSync.ts";
import { restoreUntrackedPreviews } from "./untrackedPreviews.ts";
import { HttpError, safeName, assertSafeMediaFile, isMissingFileError, redactPaths } from "./util.ts";
import { MAX_BODY_BYTES, readBody } from "./body.ts";
import { writeFileAtomic, writeJsonAtomic } from "../../src/io/atomicJson.ts";
import { PREPARE_RUNNING_MESSAGE, prepareJob, startPrepareJob, stopPrepareJob } from "./prepare.ts";
import { applyStudioSecurityHeaders, isTrustedLocalRequest, studioRequestRefusal } from "./security.ts";
import { captureRouteError, handleErrorRoutes, isProgrammingError, testFault } from "./errors.ts";
import { handlePronunciationRoutes } from "./pronunciationCheck.ts";
import { redactSecrets, secretValues } from "../../src/studio/errorLog.ts";

/**
 * واجهة برمجية محلية للاستوديو: تقرأ وتكتب نفس ملفات المستودع التي تستخدمها أوامر bal.
 * تعمل داخل خادم Vite على جهازك فقط (localhost).
 */
const root = path.resolve(import.meta.dirname, "..", "..");
const configFile = path.join(root, "config.json");


const send = (res: ServerResponse, status: number, body: unknown) => {
  // No absolute path of the owner's machine in any error the browser sees (util.ts redactPaths).
  if (body && typeof body === "object" && !Array.isArray(body) && typeof (body as { error?: unknown }).error === "string")
    // …and no secret either (D112): no value from .env, no device key, no credential inside a git remote URL.
    body = { ...(body as object), error: redactSecrets(redactPaths((body as { error: string }).error, root), { values: secretValues(root) }) };
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
    const hint = /^(<<<<<<<|=======|>>>>>>>)/m.test(raw) ? "فيه علامات تعارض من git. أصلحه بالأمر: git checkout origin/main -- config.json" : (e as Error).message;
    throw new HttpError(500, `ملف config.json تالف: ${hint}`);
  }
};

const EP = /^\d{3}$/;

/** يخدم ملفًا مع دعم المقاطع (Range) حتى يستطيع المشغل التقديم والتأخير. */
const serveFile = (req: IncomingMessage, res: ServerResponse, file: string, type: string) => {
  assertSafeMediaFile(file, root);
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

/**
 * A rejected promise nobody awaited (e.g. a render-browser download failing deep inside the renderer
 * while offline) must not take the whole Studio down mid-queue (funnel audit 8 Nov, D36). It is logged;
 * the request that started the work still reports its own error to the owner.
 */
let crashGuardInstalled = false;
export const installStudioCrashGuard = (proc: Pick<NodeJS.Process, "on"> = process) => {
  if (crashGuardInstalled && proc === process) return;
  if (proc === process) crashGuardInstalled = true;
  proc.on("unhandledRejection", (reason: unknown) => {
    console.error("[studio] background error (server kept alive):", reason instanceof Error ? reason.message : reason);
  });
};

/**
 * X-Frame-Options: DENY and CSP frame-ancestors 'none' on EVERY Studio response (HTML, scripts, media,
 * API): no other page can frame the Studio and click its buttons (H1, clickjacking). Runs first.
 */
export const studioSecurityHeaders = (): Plugin => ({
  name: "studio-security-headers",
  enforce: "pre",
  configureServer(server: ViteDevServer) {
    server.middlewares.use((_req, res, next) => { applyStudioSecurityHeaders(res); next(); });
  },
  configurePreviewServer(server) {
    server.middlewares.use((_req, res, next) => { applyStudioSecurityHeaders(res); next(); });
  },
});

export const balApi = (): Plugin => ({
  name: "bal-api",
  configureServer(server: ViteDevServer) {
    // استعادة طابور الرندر بعد إعادة تشغيل الاستوديو (الأمر 010)
    // Never replay legacy render/packaging jobs while V2's guarded API is enforced.
    // A saved job payload is not a trusted V2 approval token.
    void recoverStudioQueue();
    installStudioCrashGuard();
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

    // أسرار الاعتماد المحلية تُولَّد مرة واحدة في .env، فيعمل الاعتماد بلا إعداد يدوي
    const secretsReady = load("/src/settings/env.ts").then((m) => m.ensureLocalSecrets()).catch((e) => console.error("[studio] local secrets:", (e as Error).message));
    // صندوق ملاحظات المالك: ما بقي «بانتظار الإرسال» (بلا اتصال) يُعاد عند كل تشغيل، في الخلفية (docs/studio/notes-inbox.md)
    void Promise.all([load("/src/studio/notesSync.ts"), load("/src/channel/index.ts")])
      .then(([sync, ch]) => sync.scheduleStudioNotesSync(ch.channelsDir()))
      .catch((e) => console.error("[studio] owner notes retry:", (e as Error).message));
    // معاينات الجلسات السحابية (D75): git pull لا يجلب فروع previews/* الثقيلة (refspec سالب، محلي، مرة واحدة)
    void load("/src/render/cloudPreviews.ts")
      .then((cp) => cp.ensurePreviewFetchExclusion(root, (m: string) => console.log(m)))
      .catch((e) => console.error("[studio] cloud previews fetch config:", (e as Error).message));
    // «أصلح الكلمة» انقطع بعد شراء المقطع وقبل تسجيله: يُنقل إلى voice/superseded/sentences (لا يُحذف)
    void Promise.all([load("/src/voice/fragmentSweep.ts"), load("/src/channel/index.ts")])
      .then(([sweep, ch]) => sweep.sweepAllOrphanWordFixFragments(ch.channelsDir()))
      .then((n) => { if (n) console.log(`[studio] ${n} orphaned word-fix fragment(s) moved to voice/superseded/sentences.`); })
      .catch((e) => console.error("[studio] word-fix fragments:", (e as Error).message));
    // D109: فيديوهات المعاينة القديمة التي أُزيلت من Git تبقى على جهاز المالك؛ إن حذفها تحديثٌ طبّقه كود أقدم
    // تعود من كائنات Git المحلية مرة واحدة (app/server/untrackedPreviews.ts). جهاز المالك وحده، كالحفظ الآلي.
    if (contentSyncEnabled()) void restoreUntrackedPreviews(root)
      .then((r) => { if (r.restored.length) console.log(`[studio] ${r.restored.length} old preview video(s) kept on this device after they left Git.`); })
      .catch((e) => console.error("[studio] old previews:", (e as Error).message));
    // D120 (العمل ٧): السجلات القديمة التي لا يقرؤها شيء تُنقل مرة مع كل تشغيل إلى أرشيف محلي في .studio/ بعد نسخة في
    // ~/balislam-backup (src/studio/legacyMigration.ts). لا شيء ⇒ لا كتابة. لا يُعتمد بها شيء ولا يُلغى. لا يعمل داخل الاختبارات.
    if (!process.env.VITEST) void Promise.all([load("/src/studio/legacyMigration.ts"), load("/src/channel/index.ts")])
      .then(([m, ch]) => m.migrateLegacyRecords({ channelsDir: ch.channelsDir() }))
      .then((r) => { if (r.moved.length || r.skipped.length) console.log(`[studio] ${r.moved.length ? "legacy records archived" : "legacy records left in place"}: ${r.moved.length} moved, ${r.skipped.length} left.`); })
      .catch((e) => console.error("[studio] legacy migration:", (e as Error).message));
    // «كل الأماكن نسخة واحدة» (D101): حفظ محتوى المالك في main واستقبال التحديثات آليًا، على جهاز المالك وحده
    const contentSync = createContentSync(root, {
      canRestart: () => busy.size === 0 && ![...renderJobs.values(), ...longJobs.values()].some((j) => j.status === "running"),
      onRestart: () => process.exit(75),
    });
    setSharedContentSync(contentSync);
    contentSync.start();
    server.middlewares.use(async (req, res, next) => {
      // Anti-framing on API responses too (H1); the HTML/assets get it from studioSecurityHeaders().
      applyStudioSecurityHeaders(res);
      const url = new URL(req.url ?? "/", "http://localhost");
      if (!url.pathname.startsWith("/api/")) return next();
      await secretsReady;
      const parts = url.pathname.split("/").filter(Boolean).slice(1);
      try {
        // One rule for every route (H2): loopback Host always; every write also needs the loopback socket and
        // a same-origin Origin or Sec-Fetch-Site (security.ts). No route handler runs before this.
        const refusal = studioRequestRefusal(req);
        if (refusal) return send(res, 403, { error: refusal, code: "NOT_OWNER_REQUEST" });
        // القناة المختارة في الاستوديو تُرسل مع كل طلب؛ وحدات المشروع تقرأها من BAL_CHANNEL
        const ch = url.searchParams.get("channel") || (await readConfig()).defaultChannel;
        if (!/^[a-z0-9-]+$/.test(ch)) return send(res, 400, { error: "اسم القناة غير صالح" });
        const channelMod = await load("/src/channel/index.ts");
        // قناة غير موجودة: 404 برسالة واضحة، لا 500 من أول قراءة لملفاتها
        if (!channelMod.listChannels().includes(ch)) return send(res, 404, { error: `القناة «${ch}» غير موجودة.` });
        // كل ما يلي يعمل على قناة هذا الطلب فقط (حتى العمليات الطويلة بعد await)
        // المالك بلا كلمة مرور (قرار ٩ نوفمبر): طلب وصل من عنوان الجهاز نفسه (loopback، من المقبس لا من أي
        // ترويسة) واجتاز فحص الصفحة نفسها هو المالك؛ وغيره يُرفض 403 في assertSceneOwner.
        const ownerContext = await load("/src/studio/ownerContext.ts");
        return await ownerContext.runOwnerRequest({
          remoteAddress: req.socket?.remoteAddress, sameOrigin: isTrustedLocalRequest(req), host: req.headers.host,
        }, () => channelMod.runWithChannel(ch, async () => {
        const cp = channelMod.channelPaths(ch);
        const episodesDir: string = cp.episodes;
        const identityFile: string = cp.identity;
        const identityDefaultFile: string = cp.identityDefault;

        // Unified engine (2026-11-08): the scene-first ledger (src/studio/sceneService.ts) is the only
        // approval authority. The isolated V2 review API is no longer mounted, so it cannot act as a
        // second authority; its modules were removed (D120).
        if (parts[0] === "studio-v2")
          return send(res, 410, { ok: false, code: "V2_SUPERSEDED", error: "استُبدلت مراجعة V2 المعزولة بالخطوات الأربع في الاستوديو: «١ التجهيز» ثم «٢ المشاهد» ثم «٣ النسخة النهائية» ثم «٤ النشر»." });

        // D112: «أرسل المشكلة» وأخطاء الواجهة (app/server/errors.ts)
        if (await handleErrorRoutes({ req, res, parts, ch, root, load, send, readBody })) return;
        testFault(url.pathname);
        // العمل ٩: فحص النطق المحلي الاختياري (app/server/pronunciationCheck.ts)
        if (await handlePronunciationRoutes({ req, res, parts, ch, load, send, readBody })) return;
        if (await handleStudioRoutes({ req, res, parts, ch, root, episodesDir, load, send, readBody, serveFile })) return;

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
            const { createEpisode, EpisodeInputError } = await load("/src/script/episodes.ts");
            try {
              await createEpisode({ episode: b.episode, slug: b.slug, domain: b.domain, title: b.title, ...(typeof b.series === "string" && b.series ? { series: b.series } : {}) });
            } catch (error) {
              // QA 12 Nov: a duplicate number or a bad field is the owner's input, answered 409 in Arabic (never a 500 with a path).
              if (error instanceof EpisodeInputError) return send(res, 409, { error: (error as Error).message, field: (error as { field?: string }).field });
              throw error;
            }
            return send(res, 200, { ok: true });
          }
          // الجاهزة للتشغيل فقط (لها script.md)؛ مجلدات الخطة وحدها (000-trailer، المختبرات) لا تُفتح حلقاتٍ
          const dirs: string[] = await (await load("/src/script/episodes.ts")).listScriptEpisodeDirs(episodesDir);
          const { episodeSeriesOf: seriesOf } = await load("/src/channel/seriesStore.ts");
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
              return { id: d.slice(0, 3), dir: d, title, domain, hasPlan: existsSync(path.join(episodesDir, d, "plan.json")), series: seriesOf(path.join(episodesDir, d)).series };
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
            const b = await readBody(req, MAX_BODY_BYTES);
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

          // Single-owner vNext: one authenticated approval for each complete
          // audiovisual scene. Hashes, actor and paths are server-derived.
          // A refused owner action answers 403 (identity) or 409 (gate/order/stale hash), never 500.
          // سرعة الإلقاء (src/voice/paceApply.ts): بعد صوت جديد، المشاهد التي تغيّر تسجيلها الأصلي (والمذكورة) تُطبَّق عليها
          // السرعة المختارة من تسجيلها الجديد. مجاني، ولا يمس مشهدًا لم يتغير صوته. فشله لا يُفشل الطلب: يبقى المشهد «متأثرًا».
          const paceAfterVoice = async (scenes: string[]) => {
            try { await (await load("/src/voice/paceApply.ts")).refreshPace(ep, { scenes }); }
            catch (error) { console.warn(`[pace] ${(error as Error).message}`); }
          };
          const refuse = async (error: unknown) => {
            if (error instanceof HttpError) throw error;
            const { isOwnerAuthError } = await load("/src/studio/sceneService.ts");
            // Minors (funnel QA, 10 Nov): scenes named as the Studio numbers them, numbers in Arabic digits.
            let message = (error as Error).message;
            try {
              const { ownerText, planOrder } = await load("/src/i18n/sceneNames.ts");
              message = ownerText(message, planOrder(await io.loadPlan(ep).catch(() => null)));
            } catch { /* the message as it is */ }
            // A programming error that met a refusal path is still unexpected (D112): logged, and its number returned.
            if (isProgrammingError(error)) {
              const captured = captureRouteError(root, req, error, ch);
              await captured.written;
              return send(res, isOwnerAuthError(error) ? 403 : 409, { error: message, errorId: captured.id });
            }
            return send(res, isOwnerAuthError(error) ? 403 : 409, { error: message });
          };
          if (parts[2] === "scene-production" && parts.length === 3) {
            const { inspectSceneProduction, decideSceneProduction } =
              await load("/src/studio/sceneService.ts");
            // Audit item 11: while the assembly awaits review, where each seam falls (to jump the player).
            const withSeamTimes = async <T extends { assembly: { approved: boolean } | null; seams: string[] }>(read: T) => {
              if (!read.assembly || read.assembly.approved) return read;
              try {
                const plan = await io.loadPlan(ep);
                if (!plan) return read;
                const { assemblySeamTimes, assemblySeamReport } = await load("/src/studio/seamTimes.ts");
                // Owner, 16 Nov: the silence at every seam, before he watches (a warning above the chosen «الفاصل»)
                const seamReport = await assemblySeamReport(ep, scriptPath, plan, read.seams).catch(() => undefined);
                return { ...read, seamTimes: await assemblySeamTimes(scriptPath, plan, read.seams), ...(seamReport ? { seamReport } : {}) };
              } catch { return read; }
            };
            if (req.method === "GET") {
              // QA 12 Nov (all channels): a new episode is opened before its first plan exists; the plan is made here
              // as GET /episodes/:id does (from the script), instead of a 500 «Prepare and save a storyboard plan first.».
              if (!(await io.readPlanFile(scriptPath))) await io.regeneratePlan(ep).catch(() => null);
              return send(res, 200, await withSeamTimes(await inspectSceneProduction(ep)));
            }
            if (req.method === "POST") {
              const body = await readBody(req);
              // H6: the direct script/storyboard approvals carry the same checks as «اعتمد التجهيز».
              const { directPreparationRefusal } = await load("/src/studio/preparation.ts");
              const prepRefusal = await directPreparationRefusal(ep, body);
              if (prepRefusal) return send(res, 409, { ok: false, code: "PREPARATION_CHECKS", error: prepRefusal });
              try {
                await decideSceneProduction(ep, body);
                // D53: right after the publish permission (never before), the approved files go to the owner's
                // Google Drive folder in the background; the request does not wait for large copies.
                if (body?.action === "grant-publish") {
                  const { startDriveHandoff } = await load("/src/package/driveHandoff.ts");
                  await startDriveHandoff(ep, "publish-permission").catch((e: Error) => console.error("[studio] drive handoff:", e.message));
                }
                // The full read model (candidates, drafts, prepared), the same shape as GET:
                // the UI replaces its state with this response.
                return send(res, 200, await withSeamTimes(await inspectSceneProduction(ep)));
              } catch (error) {
                return refuse(error);
              }
            }
            return send(res, 405, { error: "Method not allowed" });
          }

          // D53: the approved files on Google Drive (status; «أعد الإرسال إلى Drive»; «افتح المجلد»). Owner-only actions.
          if (parts[2] === "publish-drive" && parts.length <= 4) {
            const handoff = await load("/src/package/driveHandoff.ts");
            if (req.method === "GET" && parts.length === 3) return send(res, 200, await handoff.driveHandoffStatus(ep));
            if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
            const { assertSceneOwner } = await load("/src/studio/sceneService.ts");
            try { assertSceneOwner(); }
            catch (error) { return refuse(error); }
            if (parts[3] === "open") {
              try { return send(res, 200, { folder: await handoff.openDriveFolder(ep) }); }
              catch (error) { return send(res, 409, { error: (error as Error).message }); }
            }
            if (parts.length !== 3) return send(res, 404, { error: "Not found" });
            const job = await handoff.startDriveHandoff(ep, "retry");
            const status = await handoff.driveHandoffStatus(ep);
            if (!job) return send(res, 409, { error: status.drive.message, ...status });
            return send(res, 202, status);
          }

          if (parts[2] === "scene-av-assemble" && parts.length === 3) {
            if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
            const { assembleApprovedSceneAv } = await load("/src/studio/assembleScenes.ts");
            let output;
            try { output = await assembleApprovedSceneAv(ep); }
            catch (error) { return refuse(error); }
            return send(res, 200, { ok: true, version: output.version, scenes: output.scenes });
          }

          // «معاينة قبل النهائية»: every current scene cut in order (approved or draft, verse scenes silent
          // until their recitation is attached) in its own preview slot. Never an approval or a Master.
          if (parts[2] === "scene-prefinal" && parts.length === 3) {
            const { assemblePreFinalPreview, PRE_FINAL_SLOT } = await load("/src/studio/assembleScenes.ts");
            if (req.method === "GET") {
              const { listEpisodePreviews } = await load("/src/render/episodePreviews.ts");
              const list = await listEpisodePreviews(path.dirname(scriptPath));
              const entry = (list as { name: string; title: string; version: number; updatedAt: string | null }[])
                .find((x) => x.name === `${PRE_FINAL_SLOT}.mp4`);
              return send(res, 200, { preview: entry ? `${PRE_FINAL_SLOT}.mp4` : null, entry: entry ?? null });
            }
            if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
            let output;
            try { output = await assemblePreFinalPreview(ep); }
            catch (error) { return refuse(error); }
            return send(res, 200, { ok: true, preview: `${PRE_FINAL_SLOT}.mp4`, version: output.version,
              scenes: output.scenes, recitationPending: output.recitationPending });
          }

          if (parts[2] === "scene-av-render" && parts.length === 3) {
            if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
            const body = await readBody(req);
            const sceneId = body?.sceneId;
            const expectedSha256 = body?.expectedSha256;
            const { assertCurrentSceneRenderAllowed, assertSceneNotAwaitingChange, recordSceneRenderEvidence } =
              await load("/src/studio/sceneService.ts");
            try { await assertCurrentSceneRenderAllowed(ep, sceneId, expectedSha256); await assertSceneNotAwaitingChange(ep, sceneId); }
            catch (error) { return refuse(error); }
            // KI-066: «أنتج هذا المشهد» renders the scene's sound; a sentence take outside it is composed in first, or the
            // owner is told why it cannot be yet (never the old sound again without a word). No voice request here.
            let renderSha256 = expectedSha256;
            try {
              const takes = await load("/src/voice/sceneTakes.ts");
              const n = (await takes.sceneTakeNotices(ep))[sceneId];
              if (n?.outside.length) {
                if (n.missing.length) throw new Error(takes.newerTakeBlockedMessage(n));
                if (await takes.composeSceneForRender(ep, sceneId)) {
                  // The scene's inputs changed with its sound: render against its new fingerprint (the ledger
                  // records the change on this read, as after any voice change).
                  const { inspectSceneProduction } = await load("/src/studio/sceneService.ts");
                  renderSha256 = (await inspectSceneProduction(ep)).scenes.find((x: { id: string }) => x.id === sceneId)?.sourceSha256 ?? expectedSha256;
                  await assertCurrentSceneRenderAllowed(ep, sceneId, renderSha256);
                }
              }
            } catch (error) { return refuse(error); }
            const { renderShotsPreview } = await load("/src/render/shotsPreview.ts");
            const output = await renderShotsPreview(ep, [sceneId], {
              slot: `scene-${sceneId}-av`,
              title: `المشهد ${sceneId} — صوت وصورة للمراجعة`,
              note: "نسخة مرشحة غير معتمدة حتى مشاهدة المشهد واتخاذ قرار المالك.",
              verifyBeforePublish: () => assertCurrentSceneRenderAllowed(
                ep, sceneId, renderSha256,
              ),
              // Recitations come last (owner decision, 8 Nov): a verse scene without one renders as a
              // marked draft with silence; its approval can only be conditional (sceneProduction.ts).
              allowPendingRecitation: true,
            });
            await recordSceneRenderEvidence(ep, sceneId, renderSha256);
            return send(res, 200, { ok: true, version: output.version,
              preview: `scene-${sceneId}-av.mp4` });
          }

          // «جهّز كل المشاهد»: AV drafts in the background, and the voice ONLY on the owner's confirmed «ولّد الصوت الآن».
          // Drafts are never submissions or approvals (see prepareAll.ts / sceneService.ts).
          // Starts the queue for an owner already checked and an episode already ready (callers check).
          // Owner decision (15–16 Nov): nothing paid starts without his press in that moment. Every start is free
          // (`renderOnly`: no voice client at all) unless `voiceScenes` carries the scenes he confirmed.
          const startPrepare = async (opts: { retryFailed?: boolean; voiceScenes?: string[] } = {}) => {
            const key = `${ch}/${ep}`;
            const { prepareAllScenes } = await load("/src/studio/prepareAll.ts");
            if (prepareJob(key)?.status === "running") return prepareJob(key)!;
            const paid = Boolean(opts.voiceScenes);
            const { elevenLabsFromEnv } = await load("/src/voice/elevenlabs.ts");
            const voiceClient = paid ? channelMod.runWithChannel(ch, () => elevenLabsFromEnv()) : null;
            // Audit item 5: an automatic start does not re-render a scene whose same inputs just failed.
            // M3: the owner's own «استأنف التجهيز» retries them (the failure expires on that press).
            const previousFailures = opts.retryFailed ? [] : prepareJob(key)?.failed ?? [];
            return startPrepareJob(key, (onProgress, shouldStop) => channelMod.runWithChannel(ch, () =>
              prepareAllScenes(ep, { voiceClient, renderOnly: !paid, voiceScenes: opts.voiceScenes, onProgress, shouldStop, previousFailures })), busy);
          };
          // What «ولّد الصوت الآن» would pay for (read only; never fails the read it rides on).
          const voicePlanRead = async () => {
            try {
              const { voiceGenerationPlan } = await load("/src/studio/prepareAll.ts");
              return await channelMod.runWithChannel(ch, () => voiceGenerationPlan(ep));
            } catch { return null; }
          };

          // Step ١ «التجهيز» (funnel v3): ONE owner action writes the script approval, then the board record when
          // needed, then the storyboard approval, each with its own check (src/studio/preparation.ts). Right after
          // it the scenes start preparing on their own (drafts only; nothing is submitted or approved).
          if (parts[2] === "approve-preparation" && parts.length === 3) {
            const { approvePreparation, preparationBlockers, isPreparationApproved } = await load("/src/studio/preparation.ts");
            if (req.method === "GET") {
              try { return send(res, 200, await preparationBlockers(ep)); } catch (error) { return refuse(error); }
            }
            if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
            const body = await readBody(req);
            const { requireSceneProductionReady, inspectSceneProduction } = await load("/src/studio/sceneService.ts");
            // KI-058: a repeated press (stale page, second tab, double click) writes nothing (D76) and STARTS nothing.
            // Before, it started a second «جهّز كل المشاهد» that chased every scene the owner re-opened afterwards
            // and then held the episode when «اصنع النسخة النهائية» came. The queue starts only with the approval itself;
            // later the owner's own «جهّز كل المشاهد» / «استأنف التجهيز» starts it.
            let already = false;
            try { already = isPreparationApproved(await inspectSceneProduction(ep)); } catch { /* approvePreparation says why */ }
            let read;
            try { read = await approvePreparation(ep, body); } catch (error) { return refuse(error); }
            if (already) return send(res, 200, { ...read, prepare: { job: prepareJob(`${ch}/${ep}`), voicePlan: await voicePlanRead() } });
            let job = null;
            let prepareError: string | undefined;
            // Owner decision (15–16 Nov): only the free drafts start here (scenes whose voice exists). The voice waits
            // for «ولّد الصوت الآن»: the response carries its count and cost (`voicePlan`), nothing paid is called.
            try { await requireSceneProductionReady(ep); job = await startPrepare(); }
            catch (error) { prepareError = (error as Error).message; }
            return send(res, 200, { ...read, prepare: { job, voicePlan: await voicePlanRead(), ...(prepareError ? { error: prepareError } : {}) } });
          }

          // M6: the seams the owner heard, per assembly fingerprint, kept on the server (src/studio/seamChecks.ts).
          if (parts[2] === "seam-checks" && parts.length === 3) {
            const sc = await load("/src/studio/seamChecks.ts");
            if (req.method === "GET") return send(res, 200, await sc.readSeamChecks(ep));
            if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
            const body = await readBody(req);
            try { return send(res, 200, await sc.recordSeamCheck(ep, body ?? {})); } catch (error) { return refuse(error); }
          }

          // 11 Nov: re-approving a changed board / an edited scene is gone (D60/D65/D66 superseded): a change after
          // «اعتمد التجهيز» is carried forward by the ledger itself and only its scenes re-open in step ٢.
          if (parts[2] === "approve-scene-board" && parts.length === 3)
            return send(res, 410, { error: "لا اعتماد ثانٍ للوحات بعد التجهيز: التعديل يُسجَّل وحده ويُراجَع مشهده في «٢ المشاهد»." });

          if (parts[2] === "scene-prepare" && parts.length === 3) {
            const key = `${ch}/${ep}`;
            const voiceKey = Boolean(process.env.ELEVENLABS_API_KEY && (channelMod.loadChannel(ch).voice?.id || process.env.ELEVENLABS_VOICE_ID));
            const { scenesNeedingVoice } = await load("/src/studio/prepareAll.ts");
            // M3: the job as the owner reads it against the ledger now (stale failures dropped, scenes named);
            // M1: which scenes have no tone, so the stopped line can offer the episode tone right there.
            const viewOf = async (job: ReturnType<typeof prepareJob>) => {
              if (!job) return job;
              try {
                const { inspectSceneProduction } = await load("/src/studio/sceneService.ts");
                const { currentPrepareView } = await load("/src/studio/prepareAll.ts");
                return currentPrepareView(job, (await inspectSceneProduction(ep)).scenes);
              } catch { return job; }
            };
            const toneMissing = async () => {
              try {
                const { scenesWithoutTone, toneMapScenesFor } = await load("/src/studio/preparation.ts");
                const plan = await io.loadPlan(ep);
                // QA dafatir M1: a tone-map episode has its tones (and the basmala needs none).
                return plan ? scenesWithoutTone(plan, channelMod.loadChannel(ch).voice?.tone, await toneMapScenesFor(scriptPath)) : [];
              } catch { return []; }
            };
            if (req.method === "GET")
              return send(res, 200, { job: await viewOf(prepareJob(key)), voiceKey, needVoice: (await scenesNeedingVoice(ep)).length, toneMissing: await toneMissing(), voicePlan: await voicePlanRead() });
            if (req.method === "DELETE") {
              // «أوقف»: owner-only; the step in progress finishes and is kept, nothing new starts.
              const { assertSceneOwner } = await load("/src/studio/sceneService.ts");
              try { assertSceneOwner(); } catch (error) { return refuse(error); }
              return send(res, 200, { job: stopPrepareJob(key), voiceKey });
            }
            if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
            const { assertSceneOwner, requireSceneProductionReady } = await load("/src/studio/sceneService.ts");
            const pb = await readBody(req).catch(() => ({}));
            try { assertSceneOwner(); await requireSceneProductionReady(ep); }
            catch (error) { return refuse(error); }
            // «أعد إنتاج المشاهد المتأثرة» (سرعة الإلقاء): النسخ المطبَّقة من التسجيلات القائمة (مجانًا)، ثم المسودات وحدها:
            // لا طلب صوت في هذه الدفعة أبدًا (renderOnly). كل مشهد تغيّر صوته يعود للمراجعة بقاعدة السجل القائمة.
            if (pb?.pace === "apply") {
              if (prepareJob(key)?.status === "running") return send(res, 409, { error: PREPARE_RUNNING_MESSAGE });
              const { refreshPace } = await load("/src/voice/paceApply.ts");
              let pace;
              try { pace = await refreshPace(ep, { all: true }); } catch (error) { return refuse(error); }
              const job = await startPrepare({ retryFailed: true });
              return send(res, 200, { job, voiceKey, pace, needVoice: (await scenesNeedingVoice(ep)).length, toneMissing: await toneMissing(), voicePlan: await voicePlanRead() });
            }
            // «ولّد الصوت الآن» (owner decision 15–16 Nov): the ONLY start that may pay. It carries the owner's explicit
            // confirmation of the plan he read; a plan that changed since is refused with the new numbers (nothing paid).
            if (pb?.voice !== undefined) {
              if (pb.voice?.confirm !== true || typeof pb.voice?.fingerprint !== "string")
                return send(res, 400, { error: "توليد الصوت يحتاج تأكيدك: اضغط «ولّد الصوت الآن» ثم أكّد." });
              if (prepareJob(key)?.status === "running") return send(res, 409, { error: PREPARE_RUNNING_MESSAGE });
              const { voiceGenerationPlan, VOICE_PLAN_CHANGED } = await load("/src/studio/prepareAll.ts");
              let plan;
              try { plan = await channelMod.runWithChannel(ch, () => voiceGenerationPlan(ep)); } catch (error) { return refuse(error); }
              if (plan.fingerprint !== pb.voice.fingerprint)
                return send(res, 409, { error: VOICE_PLAN_CHANGED, code: "VOICE_PLAN_CHANGED", voicePlan: plan });
              const job = await startPrepare({ retryFailed: true, voiceScenes: plan.scenes });
              return send(res, 200, { job, voiceKey, needVoice: (await scenesNeedingVoice(ep)).length, toneMissing: await toneMissing(), voicePlan: plan });
            }
            // «أنتج كل المشاهد الجاهزة» / «استأنف التجهيز»: free drafts only, whatever key is configured (D145; 15–16 Nov).
            const job = await startPrepare({ retryFailed: true });
            return send(res, 200, { job, voiceKey, needVoice: (await scenesNeedingVoice(ep)).length, toneMissing: await toneMissing(), voicePlan: await voicePlanRead() });
          }

          // D120: the old approval records (six-stage ledger, old script signoff, separate voice approval) are gone;
          // their data was archived by `bal migrate legacy`. Every method answers 410 and nothing is read.
          if (["workflow", "script-signoff", "voice-review"].includes(parts[2] ?? "") && parts.length === 3)
            return send(res, 410, { error: "استُبدل هذا الاعتماد بالخطوات الأربع: اعتمد من «١ التجهيز» (السكريبت والستوري بورد)، ثم «٢ المشاهد» (كل مشهد بالصوت والصورة)، ثم «٣ النسخة النهائية» (التجميع والنسخة النهائية)، ثم «٤ النشر»." });

          if (parts[2] === "quran-audit" && parts.length === 3) {
            if (req.method !== "GET") return send(res, 405, { error: "التدقيق للقراءة فقط." });
            const { auditEpisodeQuran } = await load("/src/quran/audit.ts");
            const result = await auditEpisodeQuran(ep, { frames: false });
            return send(res, 200, {
              environment: "local-script-evidence-only",
              message: "هذا فحص أدلة السكريبت، وليس اعتمادًا آليًا لمطابقة المصحف.",
              audits: result.audits.map((item: any) => ({
                key: item.key, status: item.status, reason: item.reason,
                ops: item.ops, categories: item.categories,
                numbers: item.numbers, reference: item.reference,
              })),
            });
          }
          // The owner's OWN recitations (recitations come last, owner decision 8 Nov): upload → a processed
          // copy (edge silence, gentle denoise, loudness matched to narration) beside the untouched original;
          // switch between them; approve after listening. Owner-only; nothing is fetched or generated.
          if (parts[2] === "own-recitations" && parts.length === 3) {
            const manual = await load("/src/quran/manualAudio.ts");
            if (req.method === "GET") {
              const status = await manual.ownAudioStatus(ep);
              const plan = await io.loadPlan(ep);
              // D68: a channel whose verses are written citations asks for no recitation (only the basmala, if any).
              const { versesAreCitations } = await load("/src/quran/citation.ts");
              const { loadChannel } = await load("/src/channel/index.ts");
              const cited = versesAreCitations(loadChannel());
              const verses = (plan?.chapters ?? []).flatMap((c: any) => c.scenes)
                .filter((s: any) => !cited && s.template === "verse-card" && s.ayahKey)
                .map((s: any) => ({ key: s.ayahKey as string, sceneId: s.id as string, reference: s.props?.reference ?? "" }));
              // The basmala (owner decision 10 Nov): one recording by the owner for every scene that holds it.
              const { basmalaScenes } = await load("/src/voice/sentenceVoice.ts");
              const bScenes: string[] = await basmalaScenes(scriptPath);
              if (bScenes.length) verses.push({ key: "basmala", sceneId: bScenes[0]!, reference: "البسملة", scenes: bScenes } as any);
              const approved = Object.fromEntries(Object.entries(status.approved as Record<string, any>).map(([k, r]) => [k, {
                reciter: r.reciter, approvedAt: r.approvedAt, file: r.parts?.[0]?.file, duration: r.parts?.[0]?.duration,
                variant: r.candidate?.variant ?? null, variants: r.candidate?.variants ?? null, polish: r.candidate?.polish ?? null,
              }]));
              return send(res, 200, { verses, pending: status.pending, approved });
            }
            if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
            const body = await readBody(req, MAX_BODY_BYTES);
            const { assertSceneOwner } = await load("/src/studio/sceneService.ts");
            try {
              assertSceneOwner();
              const key = String(body?.key ?? "");
              // D68: a written-citation channel takes no verse recitation (the card is silent text); the basmala stays.
              if (key !== "basmala") {
                const { versesAreCitations } = await load("/src/quran/citation.ts");
                const { loadChannel } = await load("/src/channel/index.ts");
                if (versesAreCitations(loadChannel())) return send(res, 409, { error: "الآية في هذه القناة استشهاد مكتوب صامت بلا تلاوة؛ لا يُرفع لها تسجيل." });
              }
              if (body?.action === "upload") {
                const data = Buffer.from(String(body.data ?? "").replace(/^data:[^,]+,/, ""), "base64");
                const candidate = await manual.prepareOwnRecitation(ep, key, String(body.name ?? ""), data);
                return send(res, 200, { candidate });
              }
              if (body?.action === "select")
              {
                const candidate = await manual.selectOwnRecitationVariant(ep, key, body.variant);
                // Switching an approved basmala withdraws it: its scenes go back to the marked placeholder.
                if (key === "basmala") await (await load("/src/voice/sentenceVoice.ts")).recomposeBasmalaScenes(ep);
                return send(res, 200, { candidate });
              }
              if (body?.action === "approve") {
                const entry = await manual.approveOwnRecitation(ep, key, "owner", String(body.note ?? ""), body.listened === true, {
                  reciter: String(body.reciter ?? ""), rightsEvidence: String(body.rightsEvidence ?? ""),
                });
                // Every scene holding the basmala is composed again with the approved recording (re-opens them).
                const recomposed = key === "basmala" ? await (await load("/src/voice/sentenceVoice.ts")).recomposeBasmalaScenes(ep) : [];
                return send(res, 200, { approved: { key, sha256: entry.sha256 }, ...(recomposed.length ? { recomposed } : {}) });
              }
              return send(res, 400, { error: "فعل غير معروف." });
            } catch (error) { return refuse(error); }
          }

          if (parts[2] === "recitation" && parts.length === 3) {
            if (req.method === "GET") return send(res, 200, { recitation: null, method: "owner-supplied" });
            return send(res, 410, { error: "أُلغِي اختيار قرّاء الخدمات الخارجية؛ أرفق التسجيل البشري بالحَلقة." });
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
            return send(res, 200, { script, plan, channel: { id: c.id, name: c.name, nameDisplay: c.nameDisplay, nameLatin: c.nameLatin, language: c.language, logo: c.logo, brand: c.brand, rules: { faces: c.rules.faces, music: c.rules.music, quran: c.rules.quran, hadith: c.rules.hadith, sacredFigures: c.rules.sacredFigures, documentProvenance: c.rules.documentProvenance }, library: c.library, script: c.script, verse: c.verse, pacing: c.pacing, frame: c.frame, cast: c.cast ?? [], tone: c.voice?.tone, voiceProfile: c.voice?.profile?.nameAr }, check: await checkText(script, scriptPath), media: await mediaFor(plan), issues: planIssues(plan, c), keys: { voice: Boolean(process.env.ELEVENLABS_API_KEY && (c.voice?.id || process.env.ELEVENLABS_VOICE_ID)) || (await load("/src/voice/provider.ts")).fakeVoiceActive(), quran: false } });
          }
          if (parts[2] === "media" && parts[3] && parts[4]) {
            const kind = parts[3];
            const name = safeName(parts[4]);
            // تُعرض تسجيلات الحلقة المحلية فقط، دون مصدر خارجي أو مكتبة مشتركة
            const epRec = path.join(path.dirname(scriptPath), "recitations");
            const dir = kind === "voice" ? path.join(path.dirname(scriptPath), "voice") : kind === "sentences" ? path.join(path.dirname(scriptPath), "voice", "sentences") : kind === "sfx" ? path.join(root, "assets", "sfx") : kind === "recitations" ? epRec : kind === "images" ? (name.startsWith("lib__") ? path.join(path.dirname(scriptPath), "..", "..", "images") : path.join(path.dirname(scriptPath), "images")) : null;
            const file = dir ? path.join(dir, kind === "images" ? name.replace(/^lib__/, "") : name) : "";
            if (!dir || !existsSync(file)) return send(res, 404, { error: "الملف غير موجود" });
            const imgType = /\.png$/i.test(name) ? "image/png" : /\.webp$/i.test(name) ? "image/webp" : /\.mp4$/i.test(name) ? "video/mp4" : /\.webm$/i.test(name) ? "video/webm" : /\.mov$/i.test(name) ? "video/quicktime" : "image/jpeg";
            serveFile(req, res, file, kind === "images" ? imgType : /\.wav$/i.test(name) ? "audio/wav" : "audio/mpeg");
            return;
          }
          // رفع صورة لوحة وثائقية: {name, data(base64)} ← تُحفظ في images/ باسم آمن وتُرجع اسمها
          if (parts[2] === "images" && req.method === "POST") {
            const b = await readBody(req, MAX_BODY_BYTES);
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
          // الصوت جملةً جملة (D50): القراءة والأفعال (تعديل/تقسيم/نبرة/وقفة/توليد) من الاستوديو على جهاز المالك (assertSceneOwner).
          // التوليد لجملة واحدة فقط؛ الآيات لا تُولَّد أبدًا (ترفع من own-recitations).
          // D97: what choosing the episode tone would invalidate, read before it is applied (nothing is generated).
          if (parts[2] === "sentences" && parts[3] === "tone-impact" && parts.length === 4 && req.method === "GET") {
            const sv = await load("/src/voice/sentenceVoice.ts");
            try { return send(res, 200, await sv.toneChangeImpact(ep, url.searchParams.get("tone") || null, { sceneId: url.searchParams.get("scene") || null })); }
            catch (error) { return refuse(error); }
          }
          // D136: the tone of a whole scene (or of the episode) set from «الجمل», after its count and cost were shown.
          // Writes the plan's tone only; nothing is generated.
          if (parts[2] === "sentences" && parts[3] === "tone-scope" && parts.length === 4) {
            if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
            const sv = await load("/src/voice/sentenceVoice.ts");
            let result;
            try { result = await sv.setToneScope(ep, await readBody(req)); }
            catch (error) { return refuse(error); }
            const plan = await io.readPlanFile(scriptPath);
            return send(res, 200, { ...result, ...(result.planChanged ? { plan } : {}), media: await mediaFor(plan) });
          }
          if (parts[2] === "sentences" && parts.length === 3) {
            const sv = await load("/src/voice/sentenceVoice.ts");
            if (req.method === "GET") return send(res, 200, await sv.readSentences(ep));
            if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
            const body = await readBody(req);
            const { elevenLabsFromEnv } = await load("/src/voice/elevenlabs.ts");
            let result;
            try { result = await sv.sentenceAction(ep, body, { client: elevenLabsFromEnv() }); }
            catch (error) { return refuse(error); }
            // سرعة الإلقاء: صوت المشهد الذي تغيّر يتبع السرعة المختارة (مجانًا، من التسجيل الجديد نفسه)
            await paceAfterVoice(result.composed?.composed ? [result.composed.sceneId] : []);
            const plan = await io.readPlanFile(scriptPath);
            return send(res, 200, { ...result, ...(result.planChanged ? { plan } : {}), media: await mediaFor(plan) });
          }
          // قاموس النطق للقناة (pronunciations.json): تعديل كلمة أو حذفها من «أدوات وتفاصيل» (assertSceneOwner)
          if (parts[2] === "pronunciations" && parts.length === 3) {
            if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
            const sv = await load("/src/voice/sentenceVoice.ts");
            try { return send(res, 200, { read: await sv.lexiconAction(ep, await readBody(req)) }); }
            catch (error) { return refuse(error); }
          }
          // M5 (funnel QA, 10 Nov): a refusal (tone, tashkeel, approvals, Quran, a busy voice lock…) is a 4xx with
          // its Arabic sentence, never a 500; a scene voiced sentence by sentence is regenerated sentence by sentence.
          // «أعد توليد ما وُلّد بالنبرة القوية» (بعد إلغاء D70، ١١ نوفمبر): dryRun يعرض العدد والحروف؛ التوليد بضغطة المالك وحده.
          // تغيير إعدادات النبرات لا يعيد أي تسجيل آليًا (src/voice/toneUpgrade.ts).
          if (parts[2] === "voice" && parts[3] === "upgrade-tone" && req.method === "POST") {
            const b = await readBody(req);
            const tu = await load("/src/voice/toneUpgrade.ts");
            try {
              if (b?.dryRun !== false) return send(res, 200, { plan: await tu.toneUpgradePlan(ep) });
              const { assertSceneOwner } = await load("/src/studio/sceneService.ts");
              assertSceneOwner();
              const { elevenLabsFromEnv } = await load("/src/voice/elevenlabs.ts");
              const result = await tu.upgradeTones(ep, { client: elevenLabsFromEnv() });
              const plan = await io.readPlanFile(scriptPath);
              return send(res, 200, { result, media: await mediaFor(plan) });
            } catch (error) {
              if ((error as { code?: string })?.code === "QURAN_TTS") return send(res, 422, { error: (error as Error).message });
              return refuse(error);
            }
          }
          if (parts[2] === "voice" && req.method === "POST") {
            const b = await readBody(req);
            const { elevenLabsFromEnv } = await load("/src/voice/elevenlabs.ts");
            const { generateVoice } = await load("/src/voice/generate.ts");
            const client = elevenLabsFromEnv();
            const dryRun = Boolean(b?.dryRun) || !client;
            if (b?.scenes !== undefined && (!Array.isArray(b.scenes) || b.scenes.some((x: unknown) => typeof x !== "string" || !/^[a-z0-9][a-z0-9-]{0,70}$/.test(x))))
              return send(res, 400, { error: "طلب الصوت غير صالح؛ حدّث الصفحة." });
            try {
              if (!dryRun) {
                const { assertSceneOwner } = await load("/src/studio/sceneService.ts");
                assertSceneOwner();
                const sv = await load("/src/voice/sentenceVoice.ts");
                const managed: Set<string> = await sv.sentenceManagedScenes(scriptPath);
                if (b.scenes?.length === 1 && managed.has(b.scenes[0])) {
                  const r = await sv.regenerateSceneSentences(ep, b.scenes[0], { client, confirmSame: b.confirmSame === true });
                  await paceAfterVoice(b.scenes);
                  const plan = await io.readPlanFile(scriptPath);
                  // D136: nothing sent would change: nothing was generated, the owner confirms first
                  if (r.confirm) return send(res, 200, { report: null, generated: false, confirm: r.confirm, media: await mediaFor(plan) });
                  return send(res, 200, { report: null, generated: true, sentences: { generated: r.generated, composed: r.composed ?? null }, media: await mediaFor(plan) });
                }
              }
              const report = await generateVoice(ep, { client, dryRun, only: b.scenes, force: b.force });
              if (!dryRun) await paceAfterVoice(Array.isArray(b.scenes) ? b.scenes : []);
              const plan = await io.readPlanFile(scriptPath);
              // QA balislam 3: a dry run because there is no key is said as such (the studio never shows success for it).
              return send(res, 200, { report, generated: !dryRun, ...(client ? {} : { noKey: true }), media: await mediaFor(plan) });
            } catch (error) {
              if ((error as { code?: string })?.code === "QURAN_TTS") return send(res, 422, { error: (error as Error).message });
              return refuse(error);
            }
          }
          // مقاطع الشورتس (D83): المالك يختار من مشهد إلى مشهد، وتُكتب في plan.shorts وحدها. الاختيار مسموح في أي وقت،
          // والصناعة نفسها لا تبدأ إلا بعد اعتماد النسخة الأساسية (stage "shorts" في src/package/package.ts).
          if (parts[2] === "shorts" && parts.length === 3) {
            const sh = await load("/src/plan/shorts.ts");
            const { sceneSeconds } = await load("/src/plan/duration.ts");
            const { ownerText, planOrder } = await load("/src/i18n/sceneNames.ts");
            const overview = async () => {
              const plan = await io.readPlanFile(scriptPath);
              if (!plan) return null;
              const media = await mediaFor(plan);
              return {
                saved: Array.isArray(plan.shorts) ? plan.shorts : null,
                suggested: sh.suggestedShorts(plan),
                scenes: sh.shortsScenes(plan, (s: unknown) => sceneSeconds(s, media)),
                divisions: plan.chapters.length,
                max: sh.SHORTS_MAX,
                titleMax: sh.SHORT_TITLE_MAX,
              };
            };
            if (req.method === "GET") {
              const r = await overview();
              return r ? send(res, 200, r) : send(res, 404, { error: "لا خطة لهذه الحلقة بعد." });
            }
            if (req.method === "PUT") {
              const { assertSceneOwner } = await load("/src/studio/sceneService.ts");
              try { assertSceneOwner(); } catch { return send(res, 403, { error: "اختيار مقاطع الشورتس مسموح من الاستوديو على جهاز المالك فقط." }); }
              if (busy.has(`${ch}/${ep}`)) return send(res, 409, { error: busyRefusal(`${ch}/${ep}`) });
              const b = await readBody(req);
              const plan = await io.readPlanFile(scriptPath);
              if (!plan) return send(res, 404, { error: "لا خطة لهذه الحلقة بعد." });
              if (b?.reset === true) {
                await io.saveShortsSelection(ep, null);
                return send(res, 200, { ...(await overview()), warnings: [] });
              }
              const { findTraces } = await load("/src/package/traces.ts");
              const c = sh.checkShortsInput(plan, b?.shorts, findTraces);
              const order = planOrder(plan);
              if (c.errors.length) return send(res, 400, { error: c.errors.map((e: string) => ownerText(e, order)).join(" "), errors: c.errors.map((e: string) => ownerText(e, order)) });
              await io.saveShortsSelection(ep, c.shorts);
              return send(res, 200, { ...(await overview()), warnings: c.warnings.map((w: string) => ownerText(w, order)) });
            }
            return send(res, 405, { error: "طلب غير مدعوم." });
          }
          if (parts[2] === "quran" && req.method === "POST") {
            return send(res, 410, { error: "أُلغِي الجلب الخارجي. نص الآيات من السكريبت والتلاوة من الملف الذي يرفعه المالك." });
          }
          if (parts[2] === "script" && req.method === "PUT") {
            const { text } = await readBody(req);
            if (typeof text !== "string" || !text.trim()) return send(res, 400, { error: "نص السكريبت فارغ؛ لم يُحفظ." });
            await writeFileAtomic(scriptPath, text);
            const check = await checkText(text, scriptPath);
            // الخطة المصمَّمة لا تُعاد كتابتها من السكريبت أبدًا (حادثة دفاتر الزمن 001)؛ تُرجع قائمة الاختلاف فقط
            const after = await io.planAfterScriptSave(ep);
            if (!after.designed) return send(res, 200, { check, plan: after.plan });
            return send(res, 200, { check, plan: after.plan, planUnchanged: true, designedScenes: after.designedCount, divergence: after.divergence });
          }
          if (parts[2] === "plan" && parts[3] === "regenerate" && req.method === "POST") {
            // خطة مصمَّمة: تُرفض إلا بتأكيد صريح (رقم الحلقة مكتوبًا)، وتُحفظ نسخة احتياطية قبل الكتابة
            const b = await readBody(req);
            const force = b?.overwriteDesigned === true && String(b?.confirmEpisode ?? "").trim() === ep;
            let backup = "";
            try {
              const plan = await io.regeneratePlan(ep, { forceOverwriteDesigned: force, onBackup: (f: string) => { backup = path.basename(f); } });
              return send(res, 200, { plan, ...(backup ? { backup } : {}) });
            } catch (error) {
              if ((error as { code?: string })?.code === "designed-plan") {
                return send(res, 409, { error: (error as Error).message, designed: true, designedScenes: (error as { designedCount?: number }).designedCount ?? 0 });
              }
              throw error;
            }
          }
          if (parts[2] === "plan" && req.method === "PUT") {
            const { plan, overwriteDesigned, confirmEpisode, expectedRevision } = await readBody(req);
            if (!plan || !Array.isArray(plan.chapters) || plan.chapters.some((c: any) => !Array.isArray(c?.scenes))) return send(res, 400, { error: "الخطة غير مكتملة؛ لم تُحفظ." });
            if (typeof expectedRevision !== "string" || !/^[a-f0-9]{64}$/.test(expectedRevision))
              return send(res, 409, { error: "نسخة الصفحة قديمة أو لم تُحمّل الخطة كاملة؛ احتفظ بتعديلك ثم أعد تحميل الصفحة قبل الحفظ.", code: "PLAN_REVISION_REQUIRED" });
            // M4: designed-plan guard (D46) and a backup before the overwrite (src/plan/io.ts savePlanFromStudio)
            try {
              const r = await io.savePlanFromStudio(ep, plan, { overwriteDesigned, confirmEpisode, expectedRevision });
              return send(res, 200, { ok: true, ...r });
            } catch (error) {
              if ((error as { code?: string })?.code === "designed-plan-replace")
                return send(res, 409, { error: (error as Error).message, designed: true, lost: (error as { lost?: string[] }).lost ?? [] });
              throw error;
            }
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
          if (typeof text !== "string") return send(res, 400, { error: "النص المطلوب فحصه يجب أن يكون نصًا." });
          return send(res, 200, await checkText(text));
        }

        // الهوية
        if (parts[0] === "identity") {
          if (req.method === "PUT") {
            const refused = await ownerRefusal({ load });
            if (refused) return send(res, 403, { error: refused });
            const { identity } = await readBody(req);
            if (!identity?.themes || !identity?.palettes || !identity?.typography || !identity?.motion) return send(res, 400, { error: "ملف الهوية ناقص" });
            await writeJsonAtomic(identityFile, identity);
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
            if (busy.has(`${ch}/${b.episode}`)) return send(res, 409, { error: busyRefusal(`${ch}/${b.episode}`) });
            // عبر طابور الرندر المشترك: يبدأ إن سمحت الذاكرة، وإلا ينتظر دوره، ويُستعاد بعد إعادة التشغيل
            // Final animation may not start before separate storyboard and full-audio approval.
            // Silent storyboard-motion audit has its own route and is intentionally not blocked.
            const { resolveScriptPath } = await load("/src/script/episodes.ts");
            const { readPlanFile } = await load("/src/plan/io.ts");
            const { loadVoiceIndex } = await load("/src/voice/generate.ts");
            const { assertMotionStartAuthorized } = await load("/src/voice/motionGate.ts");
            const scriptPath = await resolveScriptPath(b.episode);
            const plan = await readPlanFile(scriptPath);
            if (!plan) throw new HttpError(409, "اعتمد السكريبت والـStoryboard والصوت قبل بدء الحركة النهائية.");
            await assertMotionStartAuthorized(b.episode, scriptPath, plan, await loadVoiceIndex(b.episode));
            const job = startRenderJob(root, ch, b);
            return send(res, 200, job);
          }
          return send(res, 200, [...renderJobs.values()].filter((j) => j.channel === ch).reverse());
        }

        return send(res, 404, { error: "مسار غير معروف" });
        }));
      } catch (err) {
        if (err instanceof HttpError && err.status < 500) return send(res, err.status, { error: err.message });
        // Known, owner-facing refusals (QA H4/M3): a busy lock or episode, or a state file being written / damaged.
        if (["LOCK_BUSY", "BAD_JSON_FILE", "EPISODE_BUSY", "PLAN_CONFLICT"].includes(String((err as { code?: unknown })?.code)))
          return send(res, 409, { error: (err as Error).message, code: String((err as { code?: unknown }).code) });
        if (isMissingFileError(err)) return send(res, 404, { error: /^ENOENT\b/.test((err as Error).message) ? "الملف المطلوب غير موجود." : (err as Error).message });
        // D112: every unexpected exception is written to .studio/errors.jsonl (redacted), and its number answered
        // with the 500 so the page can offer «أرسل المشكلة».
        const captured = captureRouteError(root, req, err);
        await captured.written;
        return send(res, err instanceof HttpError ? err.status : 500, { error: (err as Error).message, errorId: captured.id });
      }
    });
  },
});
