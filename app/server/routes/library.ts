import { captureRouteError } from "../errors.ts";
import { ownerRefusal } from "../routeContext.ts";
import type { RouteCtx } from "../routeContext.ts";

/**
 * المكتبة (D206): سجل العلماء وسجل الكتب، وموضع كل حلقة، وقوائم التشغيل التلقائية.
 * - GET /api/library?channel=…: السجلان، ومواضع حلقات القناة، وقوائم التشغيل (لـ«زبدة الكتب»؛ تُحسب ولا تُرفع، D53).
 * - PUT /api/library/scholars/<id> {scholar} و PUT /api/library/books/<id> {book}: للمالك وحده، بعد فحص السجل كله.
 */
export const handleLibraryRoutes = async (ctx: RouteCtx): Promise<boolean> => {
  const { req, res, parts, ch, send, readBody, load } = ctx;
  if (parts[0] !== "library") return false;
  const reg = await load("/src/library/registry.ts");
  if (parts.length === 1 && req.method === "GET") {
    const { readLibrary } = await load("/src/library/libraryData.ts");
    return send(res, 200, await readLibrary(ch)), true;
  }
  if ((parts[1] === "scholars" || parts[1] === "books") && parts[2] && !parts[3] && req.method === "PUT") {
    const refused = await ownerRefusal(ctx);
    if (refused) return send(res, 403, { error: refused }), true;
    const id = parts[2];
    if (!reg.ID_RE.test(id)) return send(res, 400, { error: "المعرّف غير صالح." }), true;
    try {
      const body = await readBody(req);
      const item = parts[1] === "scholars" ? body?.scholar : body?.book;
      if (!item || item.id !== id) return send(res, 400, { error: "المعرّف في الطلب لا يطابق المسار." }), true;
      const saved = parts[1] === "scholars" ? await reg.saveScholar(item) : await reg.saveBook(item);
      return send(res, 200, { ok: true, saved }), true;
    } catch (e) {
      const issues = (e as { issues?: string[] }).issues;
      return send(res, issues ? 400 : 500, { error: (e as Error).message, issues, ...(issues ? {} : { errorId: captureRouteError(ctx.root, req, e, ch).id }) }), true;
    }
  }
  return send(res, 405, { error: "طلب غير مدعوم." }), true;
};
