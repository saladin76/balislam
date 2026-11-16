import { EP } from "../routeContext.ts";
import type { RouteCtx } from "../routeContext.ts";

/**
 * «سرعة الإلقاء» و«الفاصل بين الجمل» (src/voice/paceApply.ts): القراءة (الإعداد، والمشاهد المتأثرة، والمدة الآن وبعد
 * إعادة الإنتاج)، والحفظ (المالك؛ pace.json وحده، لا صوت ولا مشهد يتغير). «أعد إنتاج المشاهد المتأثرة» في scene-prepare.
 */
export const handlePaceRoutes = async (ctx: RouteCtx): Promise<boolean> => {
  const { req, res, parts, send, readBody, load } = ctx;
  if (!(parts[0] === "episodes" && parts[1] && parts[2] === "pace" && parts.length === 3)) return false;
  if (!EP.test(parts[1])) return send(res, 400, { error: "رقم الحلقة غير صالح" }), true;
  const P = await load<typeof import("../../../src/voice/paceApply.ts")>("/src/voice/paceApply.ts");
  if (req.method === "GET") return send(res, 200, await P.paceStatus(parts[1])), true;
  if (req.method !== "POST") return send(res, 405, { error: "طلب غير مدعوم." }), true;
  try { return send(res, 200, await P.setPace(parts[1], await readBody(req))), true; }
  catch (error) {
    if (error instanceof P.PaceInputError) return send(res, 400, { error: error.message }), true;
    const { isOwnerAuthError } = await load("/src/studio/sceneService.ts");
    if (isOwnerAuthError(error)) return send(res, 403, { error: "تغيير السرعة من الاستوديو على جهاز المالك فقط." }), true;
    throw error;
  }
};
