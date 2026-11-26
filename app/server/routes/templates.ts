import { captureRouteError } from "../errors.ts";
import { ownerRefusal } from "../routeContext.ts";
import type { RouteCtx } from "../routeContext.ts";

/**
 * D228 «التصميم بالفهم والاختيار، لا بالنسخ» (src/plan/templateApproval.ts، src/studio/storyboards.ts):
 * - GET /api/template-approvals: القوالب الجديدة بحالتها (مقترح / معتمد من المالك وسجله) والستوري بورد بنماذجه.
 * - GET /api/template-approvals/image?folder=…&file=…: صورة نموذج من ~/Desktop/للمراجعة/ستوري-بورد/ وحده.
 * - POST /api/template-approvals/approve {key, variant}: اعتماد المالك لنموذج (المالك وحده؛ يُسجَّل من ومتى وأي نموذج).
 */
export const handleTemplateApprovalRoutes = async (ctx: RouteCtx): Promise<boolean> => {
  const { req, res, parts, send, readBody, load, serveFile } = ctx;
  if (parts[0] !== "template-approvals") return false;
  try {
    const A = await load("/src/plan/templateApproval.ts");
    const S = await load("/src/studio/storyboards.ts");
    if (parts.length === 1 && req.method === "GET")
      return send(res, 200, { templates: A.loadApprovals().templates, storyboards: S.listStoryboards() }), true;
    if (parts[1] === "image" && req.method === "GET") {
      const q = new URL(req.url ?? "/", "http://x").searchParams;
      const file = S.storyboardImage(q.get("folder") ?? "", q.get("file") ?? "");
      if (!file) return send(res, 404, { error: "الصورة غير موجودة." }), true;
      return serveFile(req, res, file, /\.png$/i.test(file) ? "image/png" : /\.webp$/i.test(file) ? "image/webp" : "image/jpeg"), true;
    }
    if (parts[1] === "approve" && req.method === "POST") {
      const refused = await ownerRefusal(ctx);
      if (refused) return send(res, 403, { error: refused }), true;
      const b = await readBody(req);
      const rec = A.approveTemplate(String(b?.key ?? ""), String(b?.variant ?? ""), "المالك");
      return send(res, 200, { ok: true, record: rec }), true;
    }
    return send(res, 405, { error: "طلب غير مدعوم." }), true;
  } catch (e) {
    return send(res, 400, { error: (e as Error).message, errorId: captureRouteError(ctx.root, req, e, ctx.ch).id }), true;
  }
};
