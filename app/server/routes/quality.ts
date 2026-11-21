import { EP } from "../routeContext.ts";
import type { RouteCtx } from "../routeContext.ts";

/**
 * بطاقة الجودة (المرحلة A): القراءة (البطاقة الحالية؛ ?target=assembly|master)، و«قِس الآن» (يبدأ القياس في الخلفية
 * ويرد فورًا؛ الصفحة تقرأ حتى ينتهي). القياس لا يغيّر ملفًا ولا يصرف شيئًا؛ والمنع نفسه في make وإذن النشر.
 */
export const handleQualityRoutes = async (ctx: RouteCtx): Promise<boolean> => {
  const { req, res, parts, send, readBody, load } = ctx;
  if (!(parts[0] === "episodes" && parts[1] && parts[2] === "quality-card")) return false;
  if (!EP.test(parts[1])) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
  const url = new URL(req.url ?? "/", "http://studio.local");
  const q = url.searchParams.get("target");
  if (parts.length === 3) {
    if (req.method !== "GET") return send(res, 405, { error: "طلب غير مدعوم." }), true;
    if (q && q !== "assembly" && q !== "master") return send(res, 400, { error: "نوع الملف غير معروف." }), true;
    const Q = await load<typeof import("../../../src/studio/quality/measure.ts")>("/src/studio/quality/measure.ts");
    try { return send(res, 200, await Q.qualityCard(parts[1], (q || undefined) as "assembly" | "master" | undefined)), true; }
    catch (error) { return send(res, 409, { error: (error as Error).message }), true; }
  }
  if (parts.length === 4 && parts[3] === "measure") {
    if (req.method !== "POST") return send(res, 405, { error: "طلب غير مدعوم." }), true;
    const body = await readBody(req);
    const target = body?.target;
    if (target !== "assembly" && target !== "master") return send(res, 400, { error: "نوع الملف غير معروف." }), true;
    const Q = await load<typeof import("../../../src/studio/quality/measure.ts")>("/src/studio/quality/measure.ts");
    // في الخلفية: قياس حلقة كاملة يأخذ دقائق؛ الخطأ يظهر في القراءة التالية (البطاقة تبقى «لم يُقس»)
    void Q.measureTarget(parts[1], target).catch((e: Error) => console.error("[studio] quality card:", e.message));
    return send(res, 202, { ok: true, measuring: true }), true;
  }
  return send(res, 404, { error: "Not found" }), true;
};
