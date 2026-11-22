import type { RouteCtx } from "../routeContext.ts";
import { buildWeeklyNow, runNightlyNow } from "../nightly.ts";

/**
 * الطابور الليلي والمراجعة الأسبوعية (D191):
 * - GET /api/nightly: الإعدادات وآخر ملخص (ملفات محلية في .studio/nightly).
 * - PUT /api/nightly/settings {enabled, hour}: للمالك وحده.
 * - POST /api/nightly/run: «شغّل الآن» للمالك وحده؛ لا يرندر إلا المعتمد، بلا صوت مدفوع ولا نشر (src/studio/nightly.ts).
 * - GET /api/weekly: آخر مراجعة؛ POST /api/weekly/build: تُبنى الآن من البيانات المستوردة (للمالك).
 */
export const handleNightlyRoutes = async (ctx: RouteCtx): Promise<boolean> => {
  const { req, res, parts, send, readBody, load, root } = ctx;
  if (parts[0] !== "nightly" && parts[0] !== "weekly") return false;
  const facts = await load("/src/studio/nightlyFacts.ts");
  const owner = async (what: string) => {
    const { assertSceneOwner } = await load("/src/studio/sceneService.ts");
    try { assertSceneOwner(); return true; } catch { send(res, 403, { error: `${what} مسموح من الاستوديو على جهاز المالك فقط.` }); return false; }
  };
  if (parts[0] === "nightly" && parts.length === 1 && req.method === "GET") {
    const N = await load("/src/studio/nightly.ts");
    return send(res, 200, { settings: await facts.readNightSettings(), running: N.nightlyRunning(), ...(await facts.readLatestNight()) }), true;
  }
  if (parts[0] === "nightly" && parts[1] === "settings" && req.method === "PUT") {
    if (!(await owner("ضبط الطابور الليلي"))) return true;
    const b = await readBody(req);
    return send(res, 200, { settings: await facts.saveNightSettings({ enabled: b?.enabled, hour: b?.hour }) }), true;
  }
  if (parts[0] === "nightly" && parts[1] === "run" && req.method === "POST") {
    if (!(await owner("تشغيل الطابور الليلي"))) return true;
    const N = await load("/src/studio/nightly.ts");
    if (N.nightlyRunning()) return send(res, 409, { error: "الطابور الليلي يعمل الآن." }), true;
    // يبدأ في الخلفية ويرد فورًا؛ الصفحة تقرأ GET /api/nightly حتى ينتهي
    void runNightlyNow(root, load).catch((e: Error) => console.error("[studio] nightly:", e.message));
    return send(res, 202, { started: true }), true;
  }
  if (parts[0] === "weekly" && parts.length === 1 && req.method === "GET") {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    const f = path.join(facts.weeklyDir(), "latest.md");
    const markdown = await readFile(f, "utf8").catch(() => null);
    return send(res, 200, { markdown }), true;
  }
  if (parts[0] === "weekly" && parts[1] === "build" && req.method === "POST") {
    if (!(await owner("بناء المراجعة الأسبوعية"))) return true;
    return send(res, 200, await buildWeeklyNow(load)), true;
  }
  return send(res, 405, { error: "طلب غير مدعوم." }), true;
};
