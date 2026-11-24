import { captureRouteError } from "../errors.ts";
import { ownerRefusal, EP } from "../routeContext.ts";
import type { RouteCtx } from "../routeContext.ts";

/**
 * بناء المخزون وترتيب النشر (D213؛ src/studio/stock.ts):
 * - GET /api/stock?all=1: صفحة «بانتظارك» (القنوات الثلاث: المسودات بدفعاتها وما ينتظر المالك).
 * - GET /api/stock: ترتيب النشر لقناة الطلب (D168؛ ترتيب لا مواعيد).
 * - PUT /api/stock {stock}: للمالك وحده، بعد الفحص (بلا تواريخ).
 * - GET /api/stock/<القناة>/<الحلقة>/file?name=script.md|research.md|scenes.md|publish.draft.json: للقراءة.
 * - POST /api/stock/<القناة>/<الحلقة>/approve-script: «اعتمدت السكريبت» (المالك وحده، موقّع؛ لا صوت ولا رندر).
 * - POST /api/stock/<القناة>/scaffold {number, slug, title, series?, domain}: حلقة مخزون جديدة من القالب (مسودة).
 */
export const handleStockRoutes = async (ctx: RouteCtx): Promise<boolean> => {
  const { req, res, parts, ch, send, readBody, load } = ctx;
  if (parts[0] !== "stock") return false;
  const store = await load("/src/studio/stockStore.ts");
  const channelMod = await load("/src/channel/index.ts");
  const channels = channelMod.listChannels() as string[];
  const fail = (e: unknown) => {
    const issues = (e as { issues?: string[] }).issues;
    return send(res, issues ? 400 : 500, { error: (e as Error).message, issues, ...(issues ? {} : { errorId: captureRouteError(ctx.root, req, e, ch).id }) }), true;
  };
  try {
    if (parts.length === 1 && req.method === "GET") {
      const all = new URL(req.url ?? "/", "http://x").searchParams.get("all") === "1";
      if (!all) return send(res, 200, await store.stockOverview(ch)), true;
      const list = [];
      for (const id of channels) list.push(await channelMod.runWithChannel(id, () => store.stockOverview(id)));
      return send(res, 200, { channels: list }), true;
    }
    if (parts.length === 1 && req.method === "PUT") {
      const refused = await ownerRefusal(ctx);
      if (refused) return send(res, 403, { error: refused }), true;
      const body = await readBody(req);
      if (!body?.stock) return send(res, 400, { error: "الطلب بلا ترتيب نشر." }), true;
      return send(res, 200, { ok: true, saved: await store.saveStock(ch, body.stock) }), true;
    }
    const target = parts[1] ?? "";
    if (!channels.includes(target)) return send(res, 404, { error: "قناة غير معروفة." }), true;
    if (parts[2] === "scaffold" && parts.length === 3 && req.method === "POST") {
      const refused = await ownerRefusal(ctx);
      if (refused) return send(res, 403, { error: refused }), true;
      const b = await readBody(req);
      const { templatesDir } = await load("/src/config/paths.ts");
      const dir = await channelMod.runWithChannel(target, () => store.scaffoldStockEpisode({
        channel: target, number: String(b?.number ?? ""), slug: String(b?.slug ?? ""), title: String(b?.title ?? ""),
        ...(b?.series ? { series: String(b.series) } : {}), domain: String(b?.domain ?? ""), templatesRoot: templatesDir,
      }));
      return send(res, 200, { ok: true, dir: String(dir).split("/").pop() }), true;
    }
    const num = parts[2] ?? "";
    if (!EP.test(num)) return send(res, 400, { error: "رقم الحلقة غير صالح." }), true;
    if (parts[3] === "file" && req.method === "GET") {
      const name = new URL(req.url ?? "/", "http://x").searchParams.get("name") ?? "";
      const text = await channelMod.runWithChannel(target, () => store.readStockFile(target, num, name));
      return send(res, 200, { name, text }), true;
    }
    if (parts[3] === "approve-script" && req.method === "POST") {
      const refused = await ownerRefusal(ctx);
      if (refused) return send(res, 403, { error: refused }), true;
      return send(res, 200, { ok: true, ...(await channelMod.runWithChannel(target, () => store.approveDraftScript(target, num))) }), true;
    }
    return send(res, 405, { error: "طلب غير مدعوم." }), true;
  } catch (e) { return fail(e); }
};
