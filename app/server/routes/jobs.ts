import { busy, busyRefusal, longJobs, renderJobs, studioPool, startJob } from "../jobQueue.ts";
import { EP } from "../routeContext.ts";
import type { RouteCtx } from "../routeContext.ts";

/** المهام الطويلة: البدء (make/package/shorts/thumbnails/storyboard-motion/sfx) والإلغاء والقائمة، عبر طابور الرندر الواحد. */
export const handleJobRoutes = async (ctx: RouteCtx): Promise<boolean> => {
  const { req, res, parts, ch, send, readBody } = ctx;

  // المهام الطويلة
  if (parts[0] === "jobs") {
    // إلغاء مهمة (منتظرة أو جارية) بطلب المستخدم: تُصنف «ألغاها المستخدم» ولا يُمس ناتج سابق
    if (req.method === "POST" && parts[1] && parts[2] === "cancel") {
      const job = longJobs.get(parts[1]) ?? renderJobs.get(parts[1]);
      if (!job || job.channel !== ch) return send(res, 404, { error: "لا توجد مهمة بهذا المعرّف" }), true;
      if (job.status !== "running") return send(res, 409, { error: "المهمة انتهت بالفعل" }), true;
      studioPool.cancel(parts[1]);
      return send(res, 200, { ok: true }), true;
    }
    if (req.method === "POST") {
      const b = await readBody(req);
      if (b.kind === "make" || b.kind === "package" || b.kind === "shorts") {
        if (!EP.test(b.episode)) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
        if (busy.has(`${ch}/${b.episode}`)) return send(res, 409, { error: busyRefusal(`${ch}/${b.episode}`) }), true;
        const args = b.kind === "make" ? ["make", b.episode, ...(b.noVoice ? ["--no-voice"] : [])] : b.kind === "shorts" ? ["package", b.episode, "--shorts"] : ["package", b.episode];
        const title = b.kind === "make" ? `صناعة الحلقة ${b.episode}${b.noVoice ? " (معاينة بلا صوت)" : " (أعلى جودة)"}` : b.kind === "shorts" ? `الشورتس والريلز للحلقة ${b.episode} (أعلى جودة)` : `تغليف الحلقة ${b.episode}`;
        const job = startJob(ctx, { kind: b.kind, channel: ch, episode: b.episode, title }, args);
        return send(res, 200, job), true;
      }
      // «اصنع الأغلفة» (الخطوة ٤): صور ثابتة فقط، بلا صوت ولا فيديو، بضغطة المالك
      if (b.kind === "thumbnails") {
        if (!EP.test(b.episode)) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
        if (busy.has(`${ch}/${b.episode}`)) return send(res, 409, { error: busyRefusal(`${ch}/${b.episode}`) }), true;
        const job = startJob(ctx, { kind: "thumbnails", channel: ch, episode: b.episode, title: `الأغلفة الثلاثة للحلقة ${b.episode}` }, ["thumbnails", b.episode]);
        return send(res, 200, job), true;
      }
      if (b.kind === "storyboard-motion") {
        if (!EP.test(b.episode)) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
        if (busy.has(`${ch}/${b.episode}`)) return send(res, 409, { error: busyRefusal(`${ch}/${b.episode}`) }), true;
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
