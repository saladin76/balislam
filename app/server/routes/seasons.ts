import { captureRouteError } from "../errors.ts";
import { ownerRefusal } from "../routeContext.ts";
import type { RouteCtx } from "../routeContext.ts";

/**
 * مواسم السنة الهجرية (عمود «بالإسلام»، عاشرًا/٦): جدول كل قناة.
 * - GET /api/seasons?channel=…: المواسم بالعدّ التنازلي وموعد «جاهز قبل» وحلقاتها (لكل القنوات قراءةً).
 * - PUT /api/seasons/<id> {season}: للمالك وحده، بعد فحص الجدول كله (المواسم المتفق عليها وحدها، وتواريخ أم القرى).
 */
export const handleSeasonRoutes = async (ctx: RouteCtx): Promise<boolean> => {
  const { req, res, parts, ch, send, readBody, load } = ctx;
  if (parts[0] !== "seasons") return false;
  const store = await load("/src/studio/seasonsStore.ts");
  const model = await load("/src/studio/seasons.ts");
  if (parts.length === 1 && req.method === "GET") {
    const today = new Date().toISOString().slice(0, 10);
    const doc = store.readSeasons(ch);
    return send(res, 200, { today, seasons: model.seasonViews(doc, today), issues: model.seasonsIssues(doc) }), true;
  }
  if (parts[1] && !parts[2] && req.method === "PUT") {
    const refused = await ownerRefusal(ctx);
    if (refused) return send(res, 403, { error: refused }), true;
    try {
      const body = await readBody(req);
      const season = body?.season;
      if (!season || season.id !== parts[1]) return send(res, 400, { error: "المعرّف في الطلب لا يطابق المسار." }), true;
      const saved = await store.saveSeason(ch, season);
      return send(res, 200, { ok: true, saved }), true;
    } catch (e) {
      const issues = (e as { issues?: string[] }).issues;
      return send(res, issues ? 400 : 500, { error: (e as Error).message, issues, ...(issues ? {} : { errorId: captureRouteError(ctx.root, req, e, ch).id }) }), true;
    }
  }
  return send(res, 405, { error: "طلب غير مدعوم." }), true;
};
