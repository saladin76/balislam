/**
 * جرد مسارات خادم الاستوديو (العمل ٨): قبل تقسيم ملفات الخادم وبعده، لا يختفي مسار ولا يتغير ردّه الأول.
 *
 * ١. كل مسار (الطريقة + المسار) في الجدول يُرسل إلى موزّع مسارات الاستوديو بسياق وهمي: `load` و`readBody`
 *    يرميان علامة «وصل» قبل أي عمل حقيقي، فلا يُقرأ ملف حقيقي ولا يُكتب، ولا تبدأ مهمة، ولا يُطلب صوت.
 *    النتيجة لكل مسار: «وصل» (بدأ المعالج عمله)، أو الحالة التي رد بها قبل ذلك، أو «يمر» (ليس من هذا الموزّع،
 *    فيكمله api.ts). أي مسار يختفي أو يتغير ردّه الأول يُسقط الاختبار.
 * ٢. جرد ثابت لكل شروط التوجيه في app/server/**: كل `if` يقرأ `parts[...]` أو `req.method` بصيغته الموحّدة،
 *    مرتبًا. نقل مسار بين الملفات لا يغيّره؛ حذفه أو تغيير شرطه يغيّره.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// التحديث من GitHub لا يُشغَّل في الاختبار: الردود ثابتة.
vi.mock("../app/server/update.ts", () => ({
  applyUpdate: async () => ({ ok: true }),
  resolveConflict: async () => ({ ok: true }),
  updateStatus: async () => ({ ok: true }),
}));

const { handleStudioRoutes } = await import("../app/server/routes/index.ts");

const repo = path.resolve(import.meta.dirname, "..");
const REACHED = Symbol("reached");
let tmp = "";
beforeAll(async () => { tmp = await mkdtemp(path.join(os.tmpdir(), "route-inventory-")); });
afterAll(async () => { if (tmp) await rm(tmp, { recursive: true, force: true }); });

/** يرسل طلبًا واحدًا إلى الموزّع ويعيد نتيجته المختصرة. */
const probe = async (method: string, route: string): Promise<string> => {
  const parts = route.split("/").filter(Boolean);
  const req = { method, url: `/api/${route}?channel=balislam`, headers: {}, socket: { remoteAddress: "127.0.0.1" } } as any;
  const res = { setHeader: () => undefined } as any;
  let outcome = "";
  const reached = () => { throw REACHED; };
  try {
    const handled = await handleStudioRoutes({
      req, res, parts, ch: "balislam", root: tmp, episodesDir: tmp,
      load: reached as any, readBody: reached as any,
      send: (_r, status) => { outcome ||= `send ${status}`; },
      serveFile: () => { outcome ||= "serve"; },
    });
    if (!handled) return outcome ? `pass after ${outcome}` : "pass";
    return outcome || "handled";
  } catch (e) {
    if (e === REACHED) return outcome ? `${outcome} then reached` : "reached";
    return `throws ${(e as Error).message}`;
  }
};

/** كل مسار يملكه موزّع الاستوديو، وما يرد به أولًا بسياق لا يحمّل شيئًا. */
const INVENTORY: Record<string, string> = {
  // صيانة الاستوديو: الملاحظات، والحفظ الآلي، والتحديث
  "GET notes/status": "reached",
  "GET sync": "send 200",
  "POST sync": "send 200",
  "POST sync/restart": "send 200",
  "GET update": "send 200",
  "POST update": "send 200",
  "POST update/resolve": "reached",
  // نظرة عامة وغرفة العمليات
  "GET overview": "reached",
  "GET ops": "reached",
  "PUT calendar": "reached",
  "GET ideas": "reached",
  "PUT ideas": "reached",
  // حذف حلقة إلى سلة محلية واسترجاعها
  "GET episodes/001/trash-preview": "reached",
  "GET episodes/abc/trash-preview": "send 400",
  "DELETE episodes/001": "reached",
  "DELETE episodes/abc": "send 400",
  "GET trash": "reached",
  "POST trash/restore": "reached",
  // البحث ونص القرآن والستوري بورد والتوثيق
  "GET episodes/001/research": "reached",
  "PUT episodes/001/research": "reached",
  "GET episodes/abc/research": "send 400",
  "GET episodes/001/quran-text-only": "reached",
  "POST episodes/001/quran-text-only": "reached",
  "GET episodes/001/storyboard": "reached",
  "PUT episodes/001/storyboard": "reached",
  "GET episodes/001/storyboard-report": "reached",
  "GET episodes/001/scene-review": "send 410",
  "PUT episodes/001/scene-review": "send 410",
  "GET episodes/001/review": "reached",
  "PUT episodes/001/review": "reached",
  // النشر: الحالة، وحزمة الانتشار، وملفات التغليف
  "GET episodes/001/status": "reached",
  "PUT episodes/001/status": "reached",
  "GET episodes/001/kit": "reached",
  "PUT episodes/001/kit": "reached",
  "POST episodes/001/kit/regenerate": "reached",
  "GET episodes/001/package": "reached",
  "GET episodes/001/package/a.mp4": "reached",
  // المراجعات الفنية والمختبرات ودليل القناة
  "GET tech-reviews": "reached",
  "GET tech-reviews/x/y/a.md": "reached",
  "GET labs/x/storyboards": "reached",
  "GET labs/x/storyboards/a.png": "reached",
  "POST labs/x/storyboards/a.png/1/decision": "reached",
  "GET labs": "reached",
  "GET labs/x/previews/a.mp4": "reached",
  "GET guide": "reached",
  "GET guide/page": "reached",
  // المعاينات وملفات المراجعة
  "GET episodes/001/previews": "reached",
  "GET episodes/001/previews/a.mp4": "reached",
  "GET episodes/001/previews/a.mp4/download": "reached",
  "POST episodes/001/previews/a.mp4/download": "reached",
  "GET cloud-previews/settings": "reached",
  "POST cloud-previews/settings": "reached",
  "GET episodes/001/reviews": "reached",
  "GET episodes/001/reviews/a.html": "reached",
  // السلاسل والتصنيفات
  "GET series": "reached",
  "PUT series/x": "reached",
  "DELETE series/x": "reached",
  "POST series/x/episodes": "reached",
  "POST series/move-episodes": "reached",
  "POST series/move-episodes/undo": "reached",
  // القناة
  "GET channel": "reached",
  "PUT channel": "reached",
  "POST channels": "reached",
  // الصوت: العيّنات، والمفاتيح، والمؤثرات
  "GET voice-sample/file/a.mp3": "send 404",
  "GET voice-sample/models": "reached",
  "POST voice-sample": "reached",
  "GET settings": "reached",
  "PUT settings": "reached",
  "POST settings/test": "reached",
  "GET sfx": "reached",
  "GET sfx/none.mp3": "send 404",
  // المهام الطويلة
  "GET jobs": "send 200",
  "POST jobs": "reached",
  "POST jobs/1/cancel": "send 404",
  // ليست من هذا الموزّع: يكملها api.ts بعده
  "GET episodes": "pass",
  "POST episodes": "pass",
  "GET episodes/001": "pass",
  "GET episodes/001/plan": "pass",
  "GET channels": "pass",
  "GET identity": "pass",
  "GET render": "pass",
  "POST check": "pass",
  "GET library-images": "pass",
  "GET no-such-route": "pass",
};

describe("server route inventory (work ٨)", () => {
  it("every Studio route answers as before", async () => {
    const got: Record<string, string> = {};
    for (const key of Object.keys(INVENTORY)) {
      const [method, route] = key.split(" ") as [string, string];
      got[key] = await probe(method, route);
    }
    expect(got).toEqual(INVENTORY);
  });

  it("the route conditions of app/server are the same set", () => {
    const files = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
      const p = path.join(dir, n);
      return statSync(p).isDirectory() ? files(p) : /\.ts$/.test(n) ? [p] : [];
    });
    const token = /parts\[\d\] (?:===|!==) "[^"]+"|!?parts\[\d\](?! ===| !==)|parts\.length (?:===|>|<|>=|<=) \d+|req\.method (?:===|!==) "[A-Z]+"/g;
    const conditions = files(path.join(repo, "app", "server"))
      .flatMap((f) => readFileSync(f, "utf8").split("\n"))
      .filter((line) => /\bif \(/.test(line) && /parts\[|req\.method/.test(line))
      .map((line) => (line.slice(line.indexOf("if (")).match(token) ?? []).join(" & "))
      .filter(Boolean)
      .sort();
    expect(conditions).toMatchSnapshot();
  });
});
