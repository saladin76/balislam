import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * فحص النطق (العمل ٩؛ `src/voice/pronunciation/`): مسارات الاستوديو.
 *   GET  /api/pronunciation-check                  حالة الأداة: مثبّتة؟ مفعّلة؟ آخر قياس، والتثبيت أو القياس الجاري
 *   POST /api/pronunciation-check {action}          install | measure | enable | disable | uninstall — بضغطة المالك وحدها
 *   GET  /api/episodes/:ep/pronunciation-check      تنبيهات جمل الحلقة (مطفأ أو غير مثبّت: لا شيء، بلا خطأ)
 * لا مسار هنا يكتب في السجل الموقَّع أو يمنع اعتمادًا، ولا يرسل صوتًا إلى أي خدمة.
 */

type Send = (res: ServerResponse, status: number, body: unknown) => void;
type Ctx = {
  req: IncomingMessage; res: ServerResponse; parts: string[]; ch: string;
  load: <T = any>(file: string) => Promise<T>; send: Send; readBody: (req: IncomingMessage, max?: number) => Promise<any>;
};
const MOD = "/src/voice/pronunciation/service.ts";

export const handlePronunciationRoutes = async ({ req, res, parts, ch, load, send, readBody }: Ctx): Promise<boolean> => {
  if (parts[0] === "pronunciation-check" && parts.length === 1) {
    const svc = await load(MOD);
    if (req.method === "GET") { send(res, 200, await svc.toolStatus()); return true; }
    if (req.method !== "POST") { send(res, 405, { error: "طريقة غير مدعومة" }); return true; }
    const b = (await readBody(req)) ?? {};
    const tool = await load("/src/voice/pronunciation/whisperTool.ts");
    try {
      switch (b.action) {
        case "install": await tool.startInstall(); break;
        case "uninstall": await svc.setEnabled(false); await tool.uninstall(); break;
        case "measure": svc.startMeasure({ perChannel: Number.isFinite(b.perChannel) ? Math.max(5, Math.min(500, Number(b.perChannel))) : undefined }); break;
        case "enable": await svc.setEnabled(true); break;
        case "disable": await svc.setEnabled(false); break;
        default: send(res, 400, { error: "إجراء غير معروف" }); return true;
      }
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code) { send(res, 409, { error: (e as Error).message, code }); return true; }
      throw e;
    }
    send(res, 200, await svc.toolStatus());
    return true;
  }
  if (parts[0] === "episodes" && parts[2] === "pronunciation-check" && parts.length === 3 && req.method === "GET") {
    if (!/^\d{3}$/.test(parts[1] ?? "")) { send(res, 400, { error: "رقم الحلقة غير صالح" }); return true; }
    const svc = await load(MOD);
    send(res, 200, await svc.episodeView(ch, parts[1]));
    return true;
  }
  return false;
};
