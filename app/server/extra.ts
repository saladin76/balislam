import path from "node:path";
import { createReadStream, existsSync, statSync } from "node:fs";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { execFile, spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import { safeName } from "./util.ts";
import { applyUpdate, updateStatus } from "./update.ts";

/**
 * مسارات الاستوديو الإضافية: نظرة عامة على الحلقات، حالة النشر، ملفات التغليف،
 * إعدادات القناة، المفاتيح، المؤثرات، ومهام الصناعة الطويلة (make/package/sfx).
 */
export type ExtraCtx = {
  req: IncomingMessage;
  res: ServerResponse;
  parts: string[];
  ch: string;
  root: string;
  episodesDir: string;
  load: <T = any>(file: string) => Promise<T>;
  send: (res: ServerResponse, status: number, body: unknown) => void;
  readBody: (req: IncomingMessage) => Promise<any>;
  serveFile: (req: IncomingMessage, res: ServerResponse, file: string, type: string) => void;
};

export type LongJob = {
  id: string;
  kind: "make" | "package" | "shorts" | "sfx" | "render" | "storyboard-motion";
  channel: string;
  episode?: string;
  title: string;
  status: "running" | "done" | "error";
  pct: number;
  log: string[];
  output?: string;
  error?: string;
  startedAt: number;
};
export const longJobs = new Map<string, LongJob>();

/**
 * حلقة واحدة لا تُصنع مرتين في الوقت نفسه (رندر، صناعة، تغليف تكتب في نفس مجلد out).
 * المفتاح: قناة/حلقة، أو قناة/sfx.
 */
export const busy = new Set<string>();
let seq = 0;
export const newJobId = () => `${Date.now()}-${++seq}`;
/** يُبقي آخر 30 مهمة فقط. */
export const trimJobs = <T extends { status: string }>(m: Map<string, T>) => {
  while (m.size > 30) {
    const oldest = [...m.entries()].find(([, j]) => j.status !== "running");
    if (!oldest) break;
    m.delete(oldest[0]);
  }
};
export const busyMessage = "توجد مهمة جارية على هذه الحلقة (رندر أو صناعة). انتظر انتهاءها ثم أعد المحاولة.";

const EP = /^\d{3}$/;
const types: Record<string, string> = { ".png": "image/png", ".mp4": "video/mp4", ".srt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".mp3": "audio/mpeg" };

/** تقدير التقدم من سطور bal make: «٣/٥ …» ثم «الحلقة: 40%» … */
const progressFrom = (job: LongJob, line: string) => {
  const step = line.match(/^([٠-٩1-9])\/([٠-٩1-9])/);
  if (step) {
    const n = Number(step[1]!.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)));
    job.pct = Math.max(job.pct, (n - 1) * 15);
  }
  const pct = line.match(/(\d+)%/);
  if (pct && job.kind !== "sfx") {
    const p = Number(pct[1]);
    if (/الحلقة/.test(line)) job.pct = Math.max(job.pct, 60 + p * 0.2);
    const short = line.match(/الشورت (\d)/);
    if (short) job.pct = Math.max(job.pct, 80 + (Number(short[1]) - 1) * 3.3 + p * 0.033);
  }
  if (/^PROGRESS (\d+)/.test(line)) job.pct = Number(line.match(/^PROGRESS (\d+)/)![1]);
};

export const startJob = (ctx: Pick<ExtraCtx, "root">, job: Omit<LongJob, "id" | "status" | "pct" | "log" | "startedAt">, args: string[]) => {
  const j: LongJob = { ...job, id: newJobId(), status: "running", pct: 1, log: [], startedAt: Date.now() };
  const key = `${job.channel}/${job.episode ?? job.kind}`;
  busy.add(key);
  longJobs.set(j.id, j);
  trimJobs(longJobs);
  const child = spawn(process.execPath, ["bin/bal.mjs", "--channel", job.channel, ...args], { cwd: ctx.root, env: process.env });
  const onData = (d: Buffer) => {
    for (const raw of d.toString().split("\n")) {
      const line = raw.trim();
      if (!line || /emory|docker|Detected differing/.test(line)) continue;
      progressFrom(j, line);
      const done = line.match(/^DONE (.+)$/);
      if (done) j.output = path.basename(done[1]!.trim());
      j.log.push(line);
      if (j.log.length > 300) j.log.shift();
    }
  };
  child.stdout.on("data", onData);
  child.stderr.on("data", onData);
  child.on("error", (err) => {
    busy.delete(key);
    j.status = "error";
    j.error = `تعذّر تشغيل العملية: ${err.message}`;
  });
  child.on("close", (code) => {
    busy.delete(key);
    j.status = code === 0 ? "done" : "error";
    if (code === 0) j.pct = 100;
    else j.error = j.log.filter((l) => /خطأ|Error|لا يمكن/.test(l)).slice(-3).join(" ") || "توقفت العملية";
  });
  return j;
};

const episodeDirs = async (episodesDir: string) => (existsSync(episodesDir) ? (await readdir(episodesDir)).filter((d) => /^\d{3}-/.test(d)).sort() : []);

/** حالة كل حلقة في مجلد حلقات قناة: السكريبت، والمشاهد، والصوت، والفيديو، والنشر، والأسلوب الغالب. */
const buildOverview = async (episodesDir: string, load: ExtraCtx["load"]) => {
    const { parseScript } = await load("/src/script/parse.ts");
    const { checkForChannel } = await load("/src/script/checkChannel.ts");
    const { planIssues } = await load("/src/plan/validate.ts");
    const { loadChannel } = await load("/src/channel/index.ts");
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
        style: styleOf((fm as { style?: string }).style, scenes),
        status,
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

export const handleExtra = async (ctx: ExtraCtx): Promise<boolean> => {
  const { req, res, parts, ch, send, readBody, load, episodesDir } = ctx;

  // مكتبة تلاوات خارجية للمعاينة فقط؛ لا تُنشئ ملفات ولا تغيّر اختيار مصدر التلاوة.
  if (parts[0] === "mp3quran") {
    if (req.method !== "GET") return send(res, 405, { error: "طلبات القراءة فقط." }), true;
    const { createMp3QuranClient } = await load("/src/quran/mp3quran.ts");
    const client = createMp3QuranClient();
    const resource = parts[1];
    if (resource === "reciters") return send(res, 200, { reciters: await client.reciters() }), true;
    if (resource === "suwar") return send(res, 200, { suwar: await client.suwar() }), true;
    if (resource === "preview") {
      const query = new URL(req.url ?? "/", "http://localhost").searchParams;
      const reciterId = Number(query.get("reciter"));
      const moshafId = Number(query.get("moshaf"));
      const surah = Number(query.get("surah"));
      if (![reciterId, moshafId, surah].every(Number.isSafeInteger) ||
          reciterId < 1 || moshafId < 1 || surah < 1 || surah > 114)
        return send(res, 400, { error: "معرّف القارئ أو الرواية أو السورة غير صالح." }), true;
      const reciter = (await client.reciters()).find((r: any) => r.id === reciterId);
      const moshaf = reciter?.moshaf.find((m: any) => m.id === moshafId);
      if (!moshaf) return send(res, 404, { error: "الرواية المختارة غير موجودة." }), true;
      return send(res, 200, {
        url: client.preview(moshaf, surah),
        reciter: reciter.name,
        moshaf: moshaf.name,
        surah,
        rightsVerified: false,
        publicationAllowed: false,
      }), true;
    }
    return send(res, 404, { error: "مسار MP3Quran غير موجود." }), true;
  }

  // التحديث من GitHub
  if (parts[0] === "update") {
    if (req.method === "POST") {
      const r = await applyUpdate(ctx.root);
      send(res, r.ok ? 200 : 409, r.ok ? r : { error: r.message });
    } else send(res, 200, await updateStatus(ctx.root, new URL(req.url ?? "/", "http://x").searchParams.has("force")));
    return true;
  }

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

  // حذف حلقة نهائيًا: من الجهاز (السكريبت والخطة والصوت والفيديو والصور)، ومن أرشيف البداية النظيفة، ومن GitHub
  if (parts[0] === "episodes" && parts[1] && !parts[2] && req.method === "DELETE") {
    if (!EP.test(parts[1])) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
    if (busy.has(`${ch}/${parts[1]}`)) return send(res, 409, { error: busyMessage }), true;
    const { confirm } = await readBody(req);
    if (confirm !== parts[1]) return send(res, 400, { error: "اكتب رقم الحلقة للتأكيد." }), true;
    const { resolveScriptPath } = await load("/src/script/episodes.ts");
    const dir = path.dirname(await resolveScriptPath(parts[1]));
    const rel = path.relative(ctx.root, dir);
    if (!/^channels\/[^/]+\/episodes\/\d{3}-[^/]+$/.test(rel.split(path.sep).join("/"))) return send(res, 400, { error: "مسار الحلقة غير متوقع؛ لم يُحذف شيء." }), true;
    const git = (args: string[]) => new Promise<{ ok: boolean; out: string }>((resolve) => execFile("git", args, { cwd: ctx.root, timeout: 120_000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } }, (err, so, se) => resolve({ ok: !err, out: `${so}${se}`.trim() })));
    // ١) من Git (إن كانت مرفوعة) ثم من القرص كله، بما فيه الصوت والفيديو غير المرفوعين
    const tracked = (await git(["ls-files", "--", rel])).out.length > 0;
    if (tracked) await git(["rm", "-r", "-q", "--cached", "--", rel]);
    await rm(dir, { recursive: true, force: true });
    // ٢) من أرشيف «البداية النظيفة» (~/balislam-archive/*/<المسار نفسه>)
    const archive = path.join(os.homedir(), "balislam-archive");
    let archived = 0;
    if (existsSync(archive))
      for (const d of await readdir(archive)) {
        const a = path.join(archive, d, rel);
        if (existsSync(a)) {
          await rm(a, { recursive: true, force: true });
          archived++;
        }
      }
    // ٣) من GitHub: حفظ الحذف ورفعه (حتى لا تعيده محادثات القنوات)
    let pushed = false;
    let note = "";
    if (tracked) {
      const c = await git(["-c", "user.name=Balislam Studio", "-c", "user.email=studio@localhost", "commit", "-q", "-m", `حذف الحلقة ${path.basename(dir)} من قناة ${ch}`, "--", rel]);
      if (c.ok) {
        const pl = await git(["pull", "--rebase", "-q"]);
        const p = pl.ok ? await git(["push", "-q"]) : pl;
        pushed = p.ok;
        if (!p.ok) note = "حُذفت من جهازك، وتعذّر رفع الحذف إلى GitHub الآن؛ يُرفع مع أول تحديث ناجح أو شغّل: git push";
      } else note = `تعذّر حفظ الحذف في Git: ${c.out.slice(0, 160)}`;
    }
    send(res, 200, { ok: true, dir: rel, archived, pushed, note });
    return true;
  }

  // ملف البحث (دراسة الكتاب في زبدة الكتب): research.md بجوار السكريبت، بقالب القناة إن لم يوجد
  if (parts[0] === "episodes" && parts[1] && parts[2] === "research") {
    if (!EP.test(parts[1])) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
    const { resolveScriptPath, templateFor, RESEARCH_FILE } = await load("/src/script/episodes.ts");
    const file = path.join(path.dirname(await resolveScriptPath(parts[1])), RESEARCH_FILE);
    const label = ch === "zubdat-alkutub" ? "دراسة الكتاب" : "ملف البحث";
    if (req.method === "PUT") {
      const { text } = await readBody(req);
      if (typeof text !== "string") return send(res, 400, { error: "نص غير صالح." }), true;
      await writeFile(file, text.endsWith("\n") ? text : `${text}\n`, "utf8");
      return send(res, 200, { ok: true }), true;
    }
    if (existsSync(file)) return send(res, 200, { text: await readFile(file, "utf8"), exists: true, label }), true;
    const tpl = templateFor(ch, RESEARCH_FILE, false);
    send(res, 200, { text: tpl ? (await readFile(tpl, "utf8")).replaceAll("{{TITLE}}", "") : "", exists: false, label });
    return true;
  }

  // ستوري بورد الفيديو قبل تنفيذه (storyboard.json): الحالة، والاعتماد، وحركة كل مشهد إن قيست
  if (parts[0] === "episodes" && parts[1] && parts[2] === "storyboard") {
    if (!EP.test(parts[1])) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
    const { resolveScriptPath } = await load("/src/script/episodes.ts");
    const { loadPlan, regeneratePlan } = await load("/src/plan/io.ts");
    const S = await load("/src/plan/storyboard.ts");
    const { loadStoryboardMotion } = await load("/src/render/storyboardMotion.ts");
    const file = await resolveScriptPath(parts[1]);
    const plan = (await loadPlan(parts[1])) ?? (await regeneratePlan(parts[1]));
    if (req.method === "PUT") {
      const { action, auditNote } = await readBody(req);
      if (action === "approve") {
        const measured = await loadStoryboardMotion(parts[1]);
        const note = typeof auditNote === "string" ? auditNote.trim() : "";
        if (measured) {
          const { currentMotionFingerprint } = await load("/src/render/motionFingerprint.ts");
          const currentHash = await currentMotionFingerprint(parts[1], plan, measured.orientation);
          const { staleMotionScenes } = await load("/src/render/motionValidity.ts");
          if (staleMotionScenes(plan, measured, currentHash).length)
            return send(res, 409, { error: "القياس قديم أو غير مكتمل؛ أعد الفحص قبل اعتماد الستوري بورد." }), true;
          const warnings = Object.values(measured.scenes).filter((s: any) => s.logic?.status === "needs-review").length;
          if (warnings && note.length < 10)
            return send(res, 400, { error: `هناك ${warnings} مشهدًا بها تحذيرات. شاهدها واكتب سبب الاعتماد أو الاستثناء (10 أحرف على الأقل).` }), true;
          await S.approveStoryboard(file, plan, note ? { note, inputHash: measured.inputHash } : undefined);
        } else {
          // الاعتماد اليدوي التقليدي متاح دون تقرير آلي؛ لا يُعرض باعتباره اجتيازًا للفحص.
          await S.approveStoryboard(file, plan);
        }
      } else if (action === "revoke") await S.revokeStoryboard(file);
      else return send(res, 400, { error: "إجراء غير صالح." }), true;
    }
    const status = S.storyboardStatus(plan, await S.loadStoryboard(file));
    const motion = await loadStoryboardMotion(parts[1]);
    // أي اختلاف في مدخلات الرندر يجعل القياس السابق غير صالح، لا مجرد تعديل القالب.
    let motionStale: string[] = [];
    if (motion) {
      const { currentMotionFingerprint } = await load("/src/render/motionFingerprint.ts");
      const { staleMotionScenes } = await load("/src/render/motionValidity.ts");
      const hash = await currentMotionFingerprint(parts[1], plan, motion.orientation);
      motionStale = staleMotionScenes(plan, motion, hash);
    }
    const { auditNeedsJustification } = await load("/src/render/motionValidity.ts");
    const auditNeedsReview = Boolean(motion && !motionStale.length && auditNeedsJustification(motion, status.audit));
    send(res, 200, { status, motion, motionStale, auditNeedsReview });
    return true;
  }

  // تنزيل التقرير النصي المفصل دون المساس بسجلات الاعتماد.
  if (parts[0] === "episodes" && parts[1] && parts[2] === "storyboard-report" && req.method === "GET") {
    if (!EP.test(parts[1])) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
    const { loadStoryboardMotion } = await load("/src/render/storyboardMotion.ts");
    const { loadPlan, regeneratePlan } = await load("/src/plan/io.ts");
    const { renderMotionAuditMarkdown } = await load("/src/render/motionAudit.ts");
    const report = await loadStoryboardMotion(parts[1]);
    if (!report) return send(res, 404, { error: "لا يوجد تقرير. ابدأ فحص الحركة والمنطق أولًا." }), true;
    const plan = (await loadPlan(parts[1])) ?? (await regeneratePlan(parts[1]));
    const { currentMotionFingerprint } = await load("/src/render/motionFingerprint.ts");
    const hash = await currentMotionFingerprint(parts[1], plan, report.orientation);
    const { staleMotionScenes } = await load("/src/render/motionValidity.ts");
    if (staleMotionScenes(plan, report, hash).length)
      return send(res, 409, { error: "تقرير الحركة قديم أو ناقص المشاهد؛ أعد فحص الحركة والمنطق لتنزيل تقرير صالح." }), true;
    send(res, 200, { markdown: renderMotionAuditMarkdown(plan, report) });
    return true;
  }

  // مراجعة كل مشهد بعد تنفيذه (scene-review.json)
  if (parts[0] === "episodes" && parts[1] && parts[2] === "scene-review") {
    if (!EP.test(parts[1])) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
    const { resolveScriptPath } = await load("/src/script/episodes.ts");
    const { loadPlan, regeneratePlan } = await load("/src/plan/io.ts");
    const R = await load("/src/plan/sceneReview.ts");
    const file = await resolveScriptPath(parts[1]);
    const plan = (await loadPlan(parts[1])) ?? (await regeneratePlan(parts[1]));
    let items;
    if (req.method === "PUT") {
      const { id, status, note } = await readBody(req);
      if (typeof id !== "string" || !["ok", "fix", "pending"].includes(status)) return send(res, 400, { error: "قرار غير صالح." }), true;
      try {
        items = await R.setSceneReview(file, plan, id, status, typeof note === "string" ? note : "");
      } catch (e) {
        return send(res, 400, { error: (e as Error).message }), true;
      }
    } else items = R.sceneReviewItems(plan, await R.loadSceneLedger(file));
    send(res, 200, { items, summary: R.sceneReviewSummary(items), criteria: R.SCENE_CRITERIA });
    return true;
  }

  // سجل التوثيق والاعتماد لكل استشهاد (review.json)
  if (parts[0] === "episodes" && parts[1] && parts[2] === "review") {
    if (!EP.test(parts[1])) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
    const { resolveScriptPath } = await load("/src/script/episodes.ts");
    const { parseScript } = await load("/src/script/parse.ts");
    const R = await load("/src/script/review.ts");
    const file = await resolveScriptPath(parts[1]);
    const script = parseScript(await readFile(file, "utf8"), file);
    let items;
    if (req.method === "PUT") {
      const { key, status, note } = await readBody(req);
      if (typeof key !== "string" || !["verified", "rejected", "pending"].includes(status)) return send(res, 400, { error: "قرار غير صالح." }), true;
      try {
        items = await R.setReview(file, script, key, status, typeof note === "string" ? note : "");
      } catch (e) {
        return send(res, 400, { error: (e as Error).message }), true;
      }
    } else items = R.reviewItems(script, await R.loadLedger(file));
    send(res, 200, { items, summary: R.reviewSummary(items) });
    return true;
  }

  // حالة النشر لكل حلقة (status.json)
  if (parts[0] === "episodes" && parts[1] && parts[2] === "status") {
    if (!EP.test(parts[1])) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
    const { resolveScriptPath } = await load("/src/script/episodes.ts");
    const file = path.join(path.dirname(await resolveScriptPath(parts[1])), "status.json");
    if (req.method === "PUT") {
      const { status } = await readBody(req);
      if (!status || typeof status !== "object" || Array.isArray(status)) return send(res, 400, { error: "حالة النشر غير صالحة؛ لم تُحفظ." }), true;
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
      await writeFile(file, JSON.stringify({ ...kit, generatedBy: kit.generatedBy === "auto" ? "edited" : kit.generatedBy, updatedAt: new Date().toISOString() }, null, 2) + "\n");
      return send(res, 200, { ok: true }), true;
    }
    if (req.method === "POST" && parts[3] === "regenerate") {
      const kit = await build();
      await writeFile(file, JSON.stringify(kit, null, 2) + "\n");
      return send(res, 200, { kit, keywords: social.kitKeywords(plan) }), true;
    }
    let kit = existsSync(file) ? JSON.parse(await readFile(file, "utf8")) : null;
    if (!kit) {
      kit = await build();
      await writeFile(file, JSON.stringify(kit, null, 2) + "\n");
    }
    const { collectMedia } = await load("/src/plan/collect.ts");
    const media = { ...(await collectMedia(ep, plan)), mode: "url", base: "" };
    return send(res, 200, { kit, keywords: social.kitKeywords(plan), chapters: social.chaptersText(plan, media, (await load("/src/channel/types.ts")).channelInfo((await load("/src/channel/index.ts")).loadChannel(ch))) }), true;
  }

  // معاينات الحلقة (previews/ بجوار السكريبت): فيديوهات صامتة خفيفة للمراجعة، تُرفع مع المستودع ولا تُنشر أبدًا
  if (parts[0] === "episodes" && parts[1] && parts[2] === "previews") {
    if (!EP.test(parts[1])) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
    const { resolveScriptPath } = await load("/src/script/episodes.ts");
    const dir = path.join(path.dirname(await resolveScriptPath(parts[1])), "previews");
    if (parts[3]) {
      const file = path.join(dir, safeName(parts[3]));
      if (!existsSync(file) || !/\.mp4$/i.test(file)) return send(res, 404, { error: "الملف غير موجود" }), true;
      ctx.serveFile(req, res, file, "video/mp4");
      return true;
    }
    if (!existsSync(dir)) return send(res, 200, { files: [] }), true;
    const names = (await readdir(dir)).filter((n) => /\.mp4$/i.test(n));
    const notes = existsSync(path.join(dir, "index.json")) ? JSON.parse(await readFile(path.join(dir, "index.json"), "utf8")) : {};
    const files = names.map((n) => ({ name: n, size: statSync(path.join(dir, n)).size, mtime: statSync(path.join(dir, n)).mtimeMs, title: notes[n]?.title ?? n, note: notes[n]?.note ?? "", version: notes[n]?.version ?? 1, updatedAt: notes[n]?.updatedAt ?? null })).sort((x, y) => y.mtime - x.mtime);
    return send(res, 200, { files }), true;
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

  // ملف القناة
  if (parts[0] === "channel") {
    const ch_ = await load("/src/channel/index.ts");
    if (req.method === "PUT") {
      const { channel } = await readBody(req);
      const { langPacks } = await load("/src/i18n/packs.ts");
      const slots = ["paper", "family", "night", "warm"];
      if (!channel || channel.id !== ch) return send(res, 400, { error: "معرّف القناة لا يُغيَّر." }), true;
      if (!channel.name?.trim()) return send(res, 400, { error: "اسم القناة مطلوب." }), true;
      if (!langPacks[channel.language]) return send(res, 400, { error: "لغة غير معروفة." }), true;
      const ids = Object.keys(channel.domains ?? {});
      if (!ids.length) return send(res, 400, { error: "القناة تحتاج مجالًا واحدًا على الأقل." }), true;
      for (const id of ids) {
        if (!/^[a-z0-9-]+$/.test(id)) return send(res, 400, { error: `معرّف المجال «${id}» بالإنجليزية الصغيرة والشرطات فقط.` }), true;
        if (!slots.includes(channel.domains[id].theme)) return send(res, 400, { error: `ثيم المجال «${id}» غير صالح.` }), true;
      }
      await writeFile(ch_.channelPaths(ch).channelFile, JSON.stringify(channel, null, 2) + "\n");
      send(res, 200, { ok: true });
    } else send(res, 200, ch_.loadChannel(ch));
    return true;
  }
  if (parts[0] === "channels" && req.method === "POST") {
    const b = await readBody(req);
    const { createChannel } = await load("/src/channel/create.ts");
    await createChannel({ id: b.id, name: b.name, language: b.language, nameLatin: b.nameLatin, quran: b.quran });
    send(res, 200, { ok: true });
    return true;
  }

  // تجربة سماع طبقة القناة والنبرات: عيّنات قصيرة تُحفظ في renders/voice-samples/<القناة> فلا يُصرف رصيد مرتين للعيّنة نفسها
  if (parts[0] === "voice-sample") {
    const dir = path.join(ctx.root, "renders", "voice-samples", ch);
    if (parts[1] === "file" && parts[2] && req.method === "GET") {
      const f = path.join(dir, safeName(parts[2]));
      if (!existsSync(f)) return send(res, 404, { error: "العيّنة غير موجودة." }), true;
      ctx.serveFile(req, res, f, "audio/mpeg");
      return true;
    }
    const { elevenLabsFromEnv } = await load("/src/voice/elevenlabs.ts");
    const { runWithChannel } = await load("/src/channel/index.ts");
    const el = runWithChannel(ch, () => elevenLabsFromEnv());
    if (!el) return send(res, 400, { error: "أضف مفتاح ElevenLabs واختر صوتك من تبويب «الإعدادات»." }), true;
    if (parts[1] === "models" && req.method === "GET") {
      send(res, 200, { models: await el.models(), current: el.modelId });
      return true;
    }
    if (!parts[1] && req.method === "POST") {
      const b = await readBody(req);
      const text = String(b.text ?? "").trim();
      if (!text) return send(res, 400, { error: "اكتب نص العيّنة." }), true;
      if (text.length > 400) return send(res, 400, { error: "العيّنة أطول من 400 حرف؛ يكفي سطران لضبط الصوت." }), true;
      const { voiceSettingsFor, isTone } = await load("/src/voice/tones.ts");
      const tune = voiceSettingsFor(b.profile ?? undefined, isTone(b.tone) ? b.tone : undefined);
      const model = String(b.model || el.modelId);
      const { createHash } = await import("node:crypto");
      const name = `${createHash("sha1").update(JSON.stringify({ text, tune, model, v: process.env.ELEVENLABS_VOICE_ID })).digest("hex").slice(0, 16)}.mp3`;
      const file = path.join(dir, name);
      const cached = existsSync(file);
      if (!cached) {
        const { capsFor } = await load("/src/voice/models.ts");
        const { applyTempo } = await load("/src/voice/tempo.ts");
        const cfg = (await load("/config.json")).default;
        const speed = capsFor(model).speed === "post" ? (tune?.speed ?? cfg.voice.speed) : 1;
        const audio = await applyTempo(await el.sample(text, { tune, modelId: model }), speed);
        const { mkdir } = await import("node:fs/promises");
        await mkdir(dir, { recursive: true });
        await writeFile(file, audio);
      }
      send(res, 200, { file: name, cached, chars: cached ? 0 : text.length, tune, model });
      return true;
    }
  }

  // المفاتيح: الحالة، الحفظ في .env، اختبار الاتصال
  if (parts[0] === "settings") {
    const env = await load("/src/settings/env.ts");
    if (parts[1] === "test" && req.method === "POST") {
      const { service } = await readBody(req);
      try {
        if (service === "elevenlabs") {
          const key = process.env.ELEVENLABS_API_KEY;
          if (!key) return send(res, 200, { ok: false, message: "لم يُضف مفتاح ElevenLabs بعد." }), true;
          const { createElevenLabs } = await load("/src/voice/elevenlabs.ts");
          const el = createElevenLabs({ apiKey: key, voiceId: process.env.ELEVENLABS_VOICE_ID ?? "" });
          const acc = await el.account();
          const voices = await el.voices();
          const voiceFound = voices.some((v: any) => v.id === process.env.ELEVENLABS_VOICE_ID);
          // النماذج المتاحة ودعمها للعربية، وحالة تدريب صوتك الاحترافي على كل نموذج
          const models = await el.models().catch(() => []);
          const info = voiceFound ? await el.voiceInfo().catch(() => null) : null;
          const cfg = (await load("/config.json")).default;
          send(res, 200, { ok: true, account: acc, voices, voiceFound, models, training: info?.training ?? {}, voiceCategory: info?.category, model: process.env.ELEVENLABS_MODEL_ID || cfg.voice.modelId });
        } else if (service === "quran") {
          const { quranClientFromEnv } = await load("/src/quran/client.ts");
          const qf = quranClientFromEnv();
          if (!qf) return send(res, 200, { ok: false, message: "لم تُضف مفاتيح Quran Foundation بعد." }), true;
          const v = await qf.verse("1:1");
          send(res, 200, { ok: true, sample: v.text, env: qf.env });
        } else send(res, 400, { error: "خدمة غير معروفة" });
      } catch (e) {
        send(res, 200, { ok: false, message: (e as Error).message });
      }
      return true;
    }
    if (req.method === "PUT") {
      const { updates } = await readBody(req);
      await env.writeKeys(updates ?? {});
      send(res, 200, { keys: env.keyStatus() });
      return true;
    }
    send(res, 200, { keys: env.keyStatus() });
    return true;
  }

  // القرّاء المتاحون (تلاوة آية بآية)
  if (parts[0] === "quran" && parts[1] === "recitations") {
    const { quranClientFromEnv } = await load("/src/quran/client.ts");
    const qf = quranClientFromEnv();
    if (!qf) return send(res, 200, { ok: false, message: "أضف مفاتيح Quran Foundation في «الإعدادات» أولًا.", list: [] }), true;
    try {
      send(res, 200, { ok: true, list: await qf.recitations() });
    } catch (e) {
      send(res, 200, { ok: false, message: (e as Error).message, list: [] });
    }
    return true;
  }

  // ترجمات معاني القرآن المتاحة (لقنوات غير عربية)
  if (parts[0] === "quran" && parts[1] === "translations") {
    const { quranClientFromEnv } = await load("/src/quran/client.ts");
    const qf = quranClientFromEnv();
    if (!qf) return send(res, 200, { ok: false, message: "أضف مفاتيح Quran Foundation في «الإعدادات» أولًا.", list: [] }), true;
    try {
      const names: Record<string, string> = { en: "english", tr: "turkish", ar: "arabic" };
      const lang = new URL(req.url ?? "/", "http://x").searchParams.get("lang") ?? "";
      const all = await qf.translations();
      const want = names[lang] ?? lang;
      const list = all.filter((t: { language: string }) => !want || t.language.toLowerCase() === want);
      send(res, 200, { ok: true, list });
    } catch (e) {
      send(res, 200, { ok: false, message: (e as Error).message, list: [] });
    }
    return true;
  }

  // المؤثرات الصوتية
  if (parts[0] === "sfx") {
    if (parts[1]) {
      const file = path.join(ctx.root, "assets", "sfx", safeName(parts[1]));
      if (!existsSync(file)) return send(res, 404, { error: "غير موجود" }), true;
      ctx.serveFile(req, res, file, "audio/mpeg");
      return true;
    }
    const { sfxLibrary, sfxCategoryNamesAr } = await load("/brand/sfx.ts");
    send(res, 200, sfxLibrary.map((s: any) => ({ ...s, categoryAr: sfxCategoryNamesAr[s.category], available: existsSync(path.join(ctx.root, "assets", "sfx", `${s.id}.mp3`)) })));
    return true;
  }

  // المهام الطويلة
  if (parts[0] === "jobs") {
    if (req.method === "POST") {
      const b = await readBody(req);
      if (b.kind === "make" || b.kind === "package" || b.kind === "shorts") {
        if (!EP.test(b.episode)) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
        if (busy.has(`${ch}/${b.episode}`)) return send(res, 409, { error: busyMessage }), true;
        const args = b.kind === "make" ? ["make", b.episode, ...(b.noVoice ? ["--no-voice"] : [])] : b.kind === "shorts" ? ["package", b.episode, "--shorts"] : ["package", b.episode];
        const title = b.kind === "make" ? `صناعة الحلقة ${b.episode}${b.noVoice ? " (معاينة بلا صوت)" : " (أعلى جودة)"}` : b.kind === "shorts" ? `الشورتس والريلز للحلقة ${b.episode} (أعلى جودة)` : `تغليف الحلقة ${b.episode}`;
        const job = startJob(ctx, { kind: b.kind, channel: ch, episode: b.episode, title }, args);
        return send(res, 200, job), true;
      }
      if (b.kind === "storyboard-motion") {
        if (!EP.test(b.episode)) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
        if (busy.has(`${ch}/${b.episode}`)) return send(res, 409, { error: busyMessage }), true;
        const job = startJob(ctx, { kind: "storyboard-motion", channel: ch, episode: b.episode, title: `قياس حركة مشاهد الحلقة ${b.episode} (معاينة صامتة خفيفة)` }, ["storyboard", b.episode, "--motion"]);
        return send(res, 200, job), true;
      }
      if (b.kind === "sfx") {
        if (busy.has(`${ch}/sfx`)) return send(res, 409, { error: "توليد المؤثرات جارٍ بالفعل." }), true;
        const job = startJob(ctx, { kind: "sfx", channel: ch, title: "توليد المؤثرات الناقصة" }, ["sfx", "--missing"]);
        return send(res, 200, job), true;
      }
      return send(res, 400, { error: "نوع مهمة غير معروف" }), true;
    }
    send(res, 200, [...longJobs.values()].filter((j) => j.channel === ch).sort((a, b) => b.startedAt - a.startedAt));
    return true;
  }

  return false;
};
