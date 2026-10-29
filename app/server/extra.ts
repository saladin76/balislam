import path from "node:path";
import { createReadStream, existsSync, statSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import { safeName } from "./util.ts";

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
  kind: "make" | "package" | "sfx" | "render";
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
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const types: Record<string, string> = { ".png": "image/png", ".mp4": "video/mp4", ".srt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".mp3": "audio/mpeg" };

/** تقدير التقدم من سطور bal make: «٣/٥ …» ثم «الحلقة: 40%» … */
const progressFrom = (job: LongJob, line: string) => {
  const step = line.match(/^([٠-٩1-9])\/([٠-٩1-9])/);
  if (step) {
    const n = Number(step[1]!.replace(/[٠-٩]/, (d) => String(ARABIC_DIGITS.indexOf(d))));
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

export const handleExtra = async (ctx: ExtraCtx): Promise<boolean> => {
  const { req, res, parts, ch, send, readBody, load, episodesDir } = ctx;

  // نظرة عامة: مرحلة كل حلقة
  if (parts[0] === "overview") {
    const { parseScript } = await load("/src/script/parse.ts");
    const { checkForChannel } = await load("/src/script/checkChannel.ts");
    const { planIssues } = await load("/src/plan/validate.ts");
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
      const issues = plan ? planIssues(plan) : [];
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
        status,
      });
    }
    send(res, 200, out);
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
          send(res, 200, { ok: true, account: acc, voices, voiceFound: voices.some((v: any) => v.id === process.env.ELEVENLABS_VOICE_ID) });
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
      if (b.kind === "make" || b.kind === "package") {
        if (!EP.test(b.episode)) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
        if (busy.has(`${ch}/${b.episode}`)) return send(res, 409, { error: busyMessage }), true;
        const args = b.kind === "make" ? ["make", b.episode, ...(b.noVoice ? ["--no-voice"] : [])] : ["package", b.episode];
        const job = startJob(ctx, { kind: b.kind, channel: ch, episode: b.episode, title: b.kind === "make" ? `صناعة الحلقة ${b.episode}${b.noVoice ? " (معاينة بلا صوت)" : ""}` : `تغليف الحلقة ${b.episode}` }, args);
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
