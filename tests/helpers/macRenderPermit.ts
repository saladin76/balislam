/**
 * D232: اختبارات الخادم الحقيقي التي «ترندر» (وصل ffmpeg لقطع صغيرة، أو رندر Remotion مُحاكى) تعمل على الماك كما على
 * لينكس: تمنح إذنًا في ملف الإذن المؤقت لعمليتها (tests/setup/git-env.ts)، لا في مستودع المالك. على غير الماك لا يُقرأ.
 */
import { grantMacRenderPermit } from "../../src/render/macRenderPermit";

export const grantTestMacRenderPermit = (uses = 50) =>
  grantMacRenderPermit({ ownerWords: "اختبار آلي: إذن رندر في مجلد مؤقت", uses, minutes: 120 });
