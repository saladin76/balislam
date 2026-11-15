import { applyUpdate, resolveConflict, updateStatus } from "../update.ts";
import { getSharedContentSync } from "../contentSync.ts";
import { ownerRefusal } from "../routeContext.ts";
import { longJobs, renderJobs } from "../jobQueue.ts";
import type { RouteCtx } from "../routeContext.ts";

/** صيانة الاستوديو: «ملاحظات لم تُرسل» (D107)، والحفظ الآلي وإعادة التشغيل (D101)، والتحديث من GitHub (D95). */
export const handleMaintenanceRoutes = async (ctx: RouteCtx): Promise<boolean> => {
  const { req, res, parts, send, readBody, load } = ctx;

  // «ملاحظات لم تُرسل: N» (D107): ما بقي من ملاحظات المالك على هذا الجهاز وسبب آخر محاولة، للقراءة فقط
  if (parts[0] === "notes" && parts[1] === "status" && parts.length === 2 && req.method === "GET") {
    const [sync, chMod] = await Promise.all([load("/src/studio/notesSync.ts"), load("/src/channel/index.ts")]);
    return send(res, 200, await sync.studioNotesStatus(chMod.channelsDir())), true;
  }
  // «جلسة عمل» (D141): علم notes/work-session.json على studio-notes تقرؤه المهمة المجدولة؛ يكتبه استوديو المالك وحده
  if (parts[0] === "notes" && parts[1] === "work-session" && parts.length === 2) {
    if (req.method === "GET") {
      const [ws, chMod] = await Promise.all([load("/src/studio/workSession.ts"), load("/src/channel/index.ts")]);
      return send(res, 200, await ws.workSessionStatus({ channelsDir: chMod.channelsDir() })), true;
    }
    if (req.method === "POST") {
      const refusal = await ownerRefusal(ctx);
      if (refusal) return send(res, 403, { error: "جلسة العمل تُشغَّل من الاستوديو على جهاز المالك فقط.", code: "NOT_OWNER_REQUEST" }), true;
      const { action, hours, channel } = await readBody(req);
      const [ws, chMod] = await Promise.all([load("/src/studio/workSession.ts"), load("/src/channel/index.ts")]);
      if (action === "start") {
        if (!ws.WORK_SESSION_HOURS.includes(hours ?? ws.DEFAULT_WORK_SESSION_HOURS))
          return send(res, 400, { error: "اختر مدة الجلسة: ساعة أو ساعتان أو ٣ ساعات." }), true;
        if (channel != null && (typeof channel !== "string" || !chMod.listChannels().includes(channel)))
          return send(res, 400, { error: "القناة غير موجودة." }), true;
        await ws.startWorkSession({ channelsDir: chMod.channelsDir(), hours: hours ?? ws.DEFAULT_WORK_SESSION_HOURS, channel: channel ?? null });
      } else if (action === "stop") {
        await ws.stopWorkSession({ channelsDir: chMod.channelsDir() });
      } else return send(res, 400, { error: "طلب غير صالح." }), true;
      return send(res, 200, await ws.workSessionStatus({ channelsDir: chMod.channelsDir() })), true;
    }
  }
  // «كل الأماكن نسخة واحدة» (D101): حالة الحفظ الآلي، و«احفظ الآن»، وإعادة التشغيل بعد تحديث كود الخادم
  if (parts[0] === "sync") {
    const sync = getSharedContentSync();
    if (!sync) return send(res, 200, { enabled: false, state: "off", message: "الحفظ الآلي غير مفعَّل.", pending: [], skipped: [], conflicts: 0, supervised: false }), true;
    if (req.method === "POST") {
      const refusal = await ownerRefusal(ctx);
      if (refusal) return send(res, 403, { error: refusal }), true;
      if (parts[1] === "restart") {
        if (!sync.state.supervised) return send(res, 409, { error: "أعد تشغيل الاستوديو بنفسك: أغلق نافذة Terminal (Ctrl + C) ثم شغّل npm run app." }), true;
        if ([...renderJobs.values(), ...longJobs.values()].some((j) => j.status === "running")) return send(res, 409, { error: "مهمة رندر أو إنتاج جارية؛ انتظر انتهاءها ثم أعد التشغيل." }), true;
        send(res, 200, { ok: true, message: "يُعاد تشغيل الاستوديو…" });
        setTimeout(() => process.exit(75), 500);
        return true;
      }
      await sync.tick(true);
    }
    return send(res, 200, sync.state), true;
  }

  // التحديث من GitHub
  if (parts[0] === "update") {
    // «أبقِ نسختي» / «خذ الجديد» لملف واحد تعارض فيه تعديل المالك مع التحديث (D95)
    if (parts[1] === "resolve" && req.method === "POST") {
      const refusal = await ownerRefusal(ctx);
      if (refusal) return send(res, 403, { error: refusal }), true;
      const { file, choice } = await readBody(req);
      if (typeof file !== "string" || (choice !== "mine" && choice !== "new")) return send(res, 400, { error: "طلب غير صالح." }), true;
      const r = await resolveConflict(ctx.root, file, choice);
      return send(res, r.ok ? 200 : 409, r.ok ? r : { error: r.message }), true;
    }
    if (req.method === "POST") {
      const r = await applyUpdate(ctx.root);
      send(res, r.ok ? 200 : 409, r.ok ? r : { error: r.message });
    } else send(res, 200, await updateStatus(ctx.root, new URL(req.url ?? "/", "http://x").searchParams.has("force")));
    return true;
  }


  return false;
};
