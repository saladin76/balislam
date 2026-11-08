import path from "node:path";
import { createReadStream, existsSync, statSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";
import { busy, busyMessage, handleExtra, recoverStudioQueue, renderJobs, startRenderJob } from "./extra.ts";
import { HttpError, safeName, assertSafeMediaFile } from "./util.ts";
import { readBody } from "./body.ts";
import { prepareJob, startPrepareJob, stopPrepareJob } from "./prepare.ts";
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
    server.middlewares.use(async (req, res, next) => {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (!url.pathname.startsWith("/api/")) return next();
      await secretsReady;
      const parts = url.pathname.split("/").filter(Boolean).slice(1);
      try {
        if (!isTrustedLocalRequest(req))
          return send(res, 403, { error: "طلب من موقع خارجي غير مسموح به في Studio المحلي." });
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

        // Unified engine (2026-11-08): the scene-first ledger (src/studio/sceneService.ts) is the only
        // approval authority. The isolated V2 review API is no longer mounted, so it cannot act as a
        // second authority; its modules stay in src/workflow/*V2* until the owner accepts the release.
        if (parts[0] === "studio-v2")
          return send(res, 410, { ok: false, code: "V2_SUPERSEDED", error: "استُبدلت مراجعة V2 المعزولة بمحرك المشاهد الموحّد في «إنتاج المشاهد»." });

        if (await handleExtra({ req, res, parts, ch, root, episodesDir, load, send, readBody, serveFile })) return;

        // كلمة مرور المالك: هل ضُبطت؟ وضبطها أول مرة أو تغييرها بالكلمة الحالية
        // فتح جلسة المالك في الواجهة: تحقق من كلمة المرور دون حفظ شيء
        if (parts[0] === "owner-passphrase" && parts[1] === "check" && parts.length === 2 && req.method === "POST") {
          const b = await readBody(req);
          const { assertSceneOwner } = await load("/src/studio/sceneService.ts");
          try { assertSceneOwner(b?.passphrase); return send(res, 200, { ok: true }); }
          catch { await new Promise((r) => setTimeout(r, 400)); return send(res, 200, { ok: false }); }
        }
        if (parts[0] === "owner-passphrase" && parts.length === 1) {
          const env = await load("/src/settings/env.ts");
          if (req.method === "GET") return send(res, 200, { set: Boolean(process.env[env.OWNER_PASSPHRASE_KEY]) });
          if (req.method === "POST") {
            const b = await readBody(req);
            try { await env.setOwnerPassphrase(b?.passphrase, b?.current); }
            catch (e) { return send(res, 400, { error: (e as Error).message }); }
            return send(res, 200, { set: true });
          }
          return send(res, 405, { error: "Method not allowed" });
        }

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

          // Single-owner vNext: one authenticated approval for each complete
          // audiovisual scene. Hashes, actor and paths are server-derived.
          // A refused owner action answers 403 (identity) or 409 (gate/order/stale hash), never 500.
          const refuse = async (error: unknown) => {
            if (error instanceof HttpError) throw error;
            const { isOwnerAuthError } = await load("/src/studio/sceneService.ts");
            return send(res, isOwnerAuthError(error) ? 403 : 409, { error: (error as Error).message });
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
                const { assemblySeamTimes } = await load("/src/studio/seamTimes.ts");
                return { ...read, seamTimes: await assemblySeamTimes(scriptPath, plan, read.seams) };
              } catch { return read; }
            };
            if (req.method === "GET") return send(res, 200, await withSeamTimes(await inspectSceneProduction(ep)));
            if (req.method === "POST") {
              const body = await readBody(req);
              try {
                await decideSceneProduction(ep, body, req.headers["x-studio-owner-token"]);
                // The full read model (candidates, drafts, prepared), the same shape as GET:
                // the UI replaces its state with this response.
                return send(res, 200, await withSeamTimes(await inspectSceneProduction(ep)));
              } catch (error) {
                return refuse(error);
              }
            }
            return send(res, 405, { error: "Method not allowed" });
          }

          if (parts[2] === "scene-av-assemble" && parts.length === 3) {
            if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
            const { assembleApprovedSceneAv } = await load("/src/studio/assembleScenes.ts");
            let output;
            try { output = await assembleApprovedSceneAv(ep, req.headers["x-studio-owner-token"]); }
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
            try { output = await assemblePreFinalPreview(ep, req.headers["x-studio-owner-token"]); }
            catch (error) { return refuse(error); }
            return send(res, 200, { ok: true, preview: `${PRE_FINAL_SLOT}.mp4`, version: output.version,
              scenes: output.scenes, recitationPending: output.recitationPending });
          }

          if (parts[2] === "scene-av-render" && parts.length === 3) {
            if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
            const body = await readBody(req);
            const sceneId = body?.sceneId;
            const expectedSha256 = body?.expectedSha256;
            const token = req.headers["x-studio-owner-token"];
            const { assertCurrentSceneRenderAllowed, recordSceneRenderEvidence } =
              await load("/src/studio/sceneService.ts");
            try { await assertCurrentSceneRenderAllowed(ep, sceneId, expectedSha256, token); }
            catch (error) { return refuse(error); }
            const { renderShotsPreview } = await load("/src/render/shotsPreview.ts");
            const output = await renderShotsPreview(ep, [sceneId], {
              slot: `scene-${sceneId}-av`,
              title: `المشهد ${sceneId} — صوت وصورة للمراجعة`,
              note: "نسخة مرشحة غير معتمدة حتى مشاهدة المشهد واتخاذ قرار المالك.",
              verifyBeforePublish: () => assertCurrentSceneRenderAllowed(
                ep, sceneId, expectedSha256, token,
              ),
              // Recitations come last (owner decision, 8 Nov): a verse scene without one renders as a
              // marked draft with silence; its approval can only be conditional (sceneProduction.ts).
              allowPendingRecitation: true,
            });
            await recordSceneRenderEvidence(ep, sceneId, expectedSha256, token);
            return send(res, 200, { ok: true, version: output.version,
              preview: `scene-${sceneId}-av.mp4` });
          }

          // «جهّز كل المشاهد»: voice for scenes lacking it, then AV drafts in order in the background.
          // Drafts are never submissions or approvals (see prepareAll.ts / sceneService.ts).
          // Starts the queue for an owner already authenticated and an episode already ready (callers check).
          const startPrepare = async (token: unknown) => {
            const key = `${ch}/${ep}`;
            const { prepareAllScenes } = await load("/src/studio/prepareAll.ts");
            if (prepareJob(key)?.status === "running") return prepareJob(key)!;
            const { elevenLabsFromEnv } = await load("/src/voice/elevenlabs.ts");
            const voiceClient = elevenLabsFromEnv();
            // Audit item 5: the queue does not re-render a scene whose same inputs just failed.
            const previousFailures = prepareJob(key)?.failed ?? [];
            return startPrepareJob(key, (onProgress, shouldStop) => channelMod.runWithChannel(ch, () =>
              prepareAllScenes(ep, { token: String(token), voiceClient, onProgress, shouldStop, previousFailures })));
          };

          // Step ١ «التجهيز» (funnel v3): ONE owner action writes the script approval, then the board record when
          // needed, then the storyboard approval, each with its own check (src/studio/preparation.ts). Right after
          // it the scenes start preparing on their own (drafts only; nothing is submitted or approved).
          if (parts[2] === "approve-preparation" && parts.length === 3) {
            const { approvePreparation, preparationBlockers } = await load("/src/studio/preparation.ts");
            if (req.method === "GET") {
              try { return send(res, 200, await preparationBlockers(ep)); } catch (error) { return refuse(error); }
            }
            if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
            const body = await readBody(req);
            const token = req.headers["x-studio-owner-token"];
            let read;
            try { read = await approvePreparation(ep, body, token); } catch (error) { return refuse(error); }
            const { requireSceneProductionReady } = await load("/src/studio/sceneService.ts");
            let job = null;
            let prepareError: string | undefined;
            try { await requireSceneProductionReady(ep); job = await startPrepare(token); }
            catch (error) { prepareError = (error as Error).message; }
            return send(res, 200, { ...read, prepare: { job, ...(prepareError ? { error: prepareError } : {}) } });
          }

          if (parts[2] === "scene-prepare" && parts.length === 3) {
            const key = `${ch}/${ep}`;
            const voiceKey = Boolean(process.env.ELEVENLABS_API_KEY && (channelMod.loadChannel(ch).voice?.id || process.env.ELEVENLABS_VOICE_ID));
            const { scenesNeedingVoice } = await load("/src/studio/prepareAll.ts");
            if (req.method === "GET")
              return send(res, 200, { job: prepareJob(key), voiceKey, needVoice: (await scenesNeedingVoice(ep)).length });
            if (req.method === "DELETE") {
              // «أوقف»: owner-only; the step in progress finishes and is kept, nothing new starts.
              const { assertSceneOwner } = await load("/src/studio/sceneService.ts");
              try { assertSceneOwner(req.headers["x-studio-owner-token"]); } catch (error) { return refuse(error); }
              return send(res, 200, { job: stopPrepareJob(key), voiceKey });
            }
            if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
            const token = req.headers["x-studio-owner-token"];
            const { assertSceneOwner, requireSceneProductionReady } = await load("/src/studio/sceneService.ts");
            try { assertSceneOwner(token); await requireSceneProductionReady(ep); }
            catch (error) { return refuse(error); }
            const job = await startPrepare(token);
            return send(res, 200, { job, voiceKey, needVoice: (await scenesNeedingVoice(ep)).length });
          }

          if (parts[2] === "workflow" && parts.length === 3) {
            const { workflowReadForEpisode } = await load("/src/workflow/server.ts");
            if (req.method === "GET") return send(res, 200, await workflowReadForEpisode(ep));
            // Unified engine: the six-stage ledger is read-only (migration); it takes no new decisions.
            if (req.method === "POST") return send(res, 410, { error: "استُبدل هذا الاعتماد بمحرك المشاهد الموحّد: اعتمد من «إنتاج المشاهد» (السكريبت، الستوري بورد، كل مشهد بالصوت والصورة، التجميع، Master، إذن النشر)." });
            return send(res, 405, { error: "Method not allowed" });
          }

          if (parts[2] === "script-signoff" && parts.length === 3) {
            const { scriptSignoffStatus } = await load("/src/script/approval.ts");
            if (req.method === "GET") return send(res, 200, await scriptSignoffStatus(scriptPath));
            if (req.method === "PUT") return send(res, 410, { error: "استُبدل هذا الاعتماد بمحرك المشاهد الموحّد: اعتمد من «إنتاج المشاهد» (السكريبت، الستوري بورد، كل مشهد بالصوت والصورة، التجميع، Master، إذن النشر)." });
            return send(res, 405, { error: "Method not allowed" });
          }
          if (parts[2] === "voice-review" && parts.length === 3) {
            const plan = await io.loadPlan(ep);
            if (!plan) throw new HttpError(404, "خطة الحلقة غير موجودة.");
            const { loadVoiceIndex } = await load("/src/voice/generate.ts");
            const { voiceReviewItems, episodeVoiceApproved } = await load("/src/voice/review.ts");
            const voice = await loadVoiceIndex(ep);
            if (req.method === "GET") {
              return send(res, 200, { items: await voiceReviewItems(scriptPath, plan, voice), episodeApproved: await episodeVoiceApproved(scriptPath, plan, voice) });
            }
            // The voice is reviewed inside each scene's AV approval; no separate voice approval.
            if (req.method === "PUT") return send(res, 410, { error: "استُبدل هذا الاعتماد بمحرك المشاهد الموحّد: اعتمد من «إنتاج المشاهد» (السكريبت، الستوري بورد، كل مشهد بالصوت والصورة، التجميع، Master، إذن النشر)." });
            return send(res, 405, { error: "Method not allowed" });
          }

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
          // switch between them; approve after listening. Owner session required; nothing is fetched or generated.
          if (parts[2] === "own-recitations" && parts.length === 3) {
            const manual = await load("/src/quran/manualAudio.ts");
            if (req.method === "GET") {
              const status = await manual.ownAudioStatus(ep);
              const plan = await io.loadPlan(ep);
              const verses = (plan?.chapters ?? []).flatMap((c: any) => c.scenes)
                .filter((s: any) => s.template === "verse-card" && s.ayahKey)
                .map((s: any) => ({ key: s.ayahKey as string, sceneId: s.id as string, reference: s.props?.reference ?? "" }));
              const approved = Object.fromEntries(Object.entries(status.approved as Record<string, any>).map(([k, r]) => [k, {
                reciter: r.reciter, approvedAt: r.approvedAt, file: r.parts?.[0]?.file, duration: r.parts?.[0]?.duration,
                variant: r.candidate?.variant ?? null, variants: r.candidate?.variants ?? null, polish: r.candidate?.polish ?? null,
              }]));
              return send(res, 200, { verses, pending: status.pending, approved });
            }
            if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });
            const body = await readBody(req);
            const { assertSceneOwner } = await load("/src/studio/sceneService.ts");
            try {
              assertSceneOwner(req.headers["x-studio-owner-token"]);
              const key = String(body?.key ?? "");
              if (body?.action === "upload") {
                const data = Buffer.from(String(body.data ?? "").replace(/^data:[^,]+,/, ""), "base64");
                const candidate = await manual.prepareOwnRecitation(ep, key, String(body.name ?? ""), data);
                return send(res, 200, { candidate });
              }
              if (body?.action === "select")
                return send(res, 200, { candidate: await manual.selectOwnRecitationVariant(ep, key, body.variant) });
              if (body?.action === "approve") {
                const entry = await manual.approveOwnRecitation(ep, key, "owner", String(body.note ?? ""), body.listened === true, {
                  reciter: String(body.reciter ?? ""), rightsEvidence: String(body.rightsEvidence ?? ""),
                });
                return send(res, 200, { approved: { key, sha256: entry.sha256 } });
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
            return send(res, 200, { script, plan, channel: { id: c.id, name: c.name, nameDisplay: c.nameDisplay, nameLatin: c.nameLatin, language: c.language, logo: c.logo, brand: c.brand, rules: { faces: c.rules.faces, music: c.rules.music, quran: c.rules.quran, hadith: c.rules.hadith }, library: c.library, script: c.script, verse: c.verse, pacing: c.pacing, frame: c.frame, cast: c.cast ?? [], tone: c.voice?.tone, voiceProfile: c.voice?.profile?.nameAr }, check: await checkText(script, scriptPath), media: await mediaFor(plan), issues: planIssues(plan, c), keys: { voice: Boolean(process.env.ELEVENLABS_API_KEY && (c.voice?.id || process.env.ELEVENLABS_VOICE_ID)), quran: false } });
          }
          if (parts[2] === "media" && parts[3] && parts[4]) {
            const kind = parts[3];
            const name = safeName(parts[4]);
            // تُعرض تسجيلات الحلقة المحلية فقط، دون مصدر خارجي أو مكتبة مشتركة
            const epRec = path.join(path.dirname(scriptPath), "recitations");
            const dir = kind === "voice" ? path.join(path.dirname(scriptPath), "voice") : kind === "sfx" ? path.join(root, "assets", "sfx") : kind === "recitations" ? epRec : kind === "images" ? (name.startsWith("lib__") ? path.join(path.dirname(scriptPath), "..", "..", "images") : path.join(path.dirname(scriptPath), "images")) : null;
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
            return send(res, 410, { error: "أُلغِي الجلب الخارجي. نص الآيات من السكريبت والتلاوة من الملف الذي يرفعه المالك." });
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
            if (busy.has(`${ch}/${b.episode}`)) return send(res, 409, { error: busyMessage });
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
        });
      } catch (err) {
        if (err instanceof HttpError) return send(res, err.status, { error: err.message });
        return send(res, 500, { error: (err as Error).message });
      }
    });
  },
});
