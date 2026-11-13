import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * سياق مسار في خادم الاستوديو: الطلب والرد وأجزاء المسار وقناة الطلب، ووظائف api.ts المشتركة
 * (التحميل، والرد، وقراءة الجسم، وخدمة الملفات). كل ملف في routes/ يأخذه ويعيد true إن تولى الطلب.
 */
export type RouteCtx = {
  req: IncomingMessage;
  res: ServerResponse;
  parts: string[];
  ch: string;
  root: string;
  episodesDir: string;
  load: <T = any>(file: string) => Promise<T>;
  send: (res: ServerResponse, status: number, body: unknown) => void;
  readBody: (req: IncomingMessage) => Promise<any>;
  serveFile: (req: IncomingMessage, res: ServerResponse, file: string, type: string) => void;
};

export const EP = /^\d{3}$/;

/**
 * Policy-changing endpoints (channel rules/settings, identity, creating a channel) need the owner, by the
 * same single policy as every other owner action (assertSceneOwner: a loopback, same-origin Studio
 * request; no passphrase, owner decision 9 Nov). Returns the Arabic refusal, or null when allowed.
 */
export const ownerRefusal = async (ctx: Pick<RouteCtx, "load">): Promise<string | null> => {
  const { assertSceneOwner } = await ctx.load("/src/studio/sceneService.ts");
  try { assertSceneOwner(); return null; }
  catch { return "تعديل قواعد القناة أو هويتها أو إنشاء قناة مسموح من الاستوديو على جهاز المالك فقط."; }
};
