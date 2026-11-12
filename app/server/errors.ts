import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { HttpError } from "./util.ts";
import {
  appendErrorRecord, errorsFileFor, lastLogLines, makeErrorRecord, readErrorRecords, routeContext, secretValues, writeErrorRecord,
  type ErrorInput,
} from "../../src/studio/errorLog.ts";

/**
 * التقاط الأخطاء آليًا في الخادم (العمل ٣ من مرحلة الاستقرار، D112; `src/studio/errorLog.ts`):
 *   - `captureRouteError`: كل استثناء غير متوقع في مسار يُكتب في `.studio/errors.jsonl` (الوقت، المسار، الرسالة،
 *     الـstack، القناة والحلقة والمشهد، وبصمة الـcommit)، منقَّحًا من أي سر، ويعود رقمه ليُرد مع 500 (`errorId`).
 *   - `POST /api/errors`: خطأ من الواجهة (حاجز الأخطاء، `window.onerror`، `unhandledrejection`) يُكتب في الملف نفسه.
 *   - `POST /api/errors/send`: «أرسل المشكلة» — ملاحظة من نوع `error` في صندوق الحلقة أو الصندوق العام للقناة،
 *     فيها الخطأ وآخر ٢٠ سطرًا من السجل، وتسلك مسار studio-notes نفسه (سياسة الإرسال D107: استوديو المالك وحده).
 * رفض معروف (HttpError تحت 500، قفل مشغول، تعارض خطة…) ليس خطأً غير متوقع ولا يُكتب.
 */

type Send = (res: ServerResponse, status: number, body: unknown) => void;
type Ctx = {
  req: IncomingMessage; res: ServerResponse; parts: string[]; ch: string; root: string;
  load: <T = any>(file: string) => Promise<T>; send: Send; readBody: (req: IncomingMessage, max?: number) => Promise<any>;
};

/** Errors the engine raises for a programming mistake (a refusal path that met one still logs it). */
export const isProgrammingError = (error: unknown) =>
  error instanceof TypeError || error instanceof ReferenceError || error instanceof RangeError || error instanceof SyntaxError;

/** Records one unexpected route error; the id is known at once, the line is on disk when `written` settles. */
export const captureRouteError = (root: string, req: IncomingMessage, error: unknown, channel?: string | null) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const ctx = routeContext(url.pathname);
  const e = error instanceof Error ? error : new Error(String(error));
  const input: ErrorInput = {
    source: "server", kind: "route", route: url.pathname, method: req.method ?? "GET",
    message: `${e.name && e.name !== "Error" ? `${e.name}: ` : ""}${e.message}`, stack: e.stack ?? "",
    channel: channel ?? url.searchParams.get("channel"), episode: ctx.episode, sceneId: ctx.sceneId,
  };
  const record = makeErrorRecord(root, input);
  // A route that fails the same way on every poll (every few seconds) is one line per 10 seconds, not hundreds.
  const key = `${record.method} ${record.route}|${record.message}`;
  const prev = recentRoute.get(key);
  if (prev && Date.now() - prev.at < 10_000) return { id: prev.id, written: prev.written };
  console.error("[studio] request failed:", url.pathname, `[${record.id}]`, record.message.split("\n")[0]);
  const written = writeErrorRecord(root, record);
  recentRoute.set(key, { id: record.id, at: Date.now(), written });
  if (recentRoute.size > 100) recentRoute.delete(recentRoute.keys().next().value!);
  return { id: record.id, written };
};
const recentRoute = new Map<string, { id: string; at: number; written: Promise<unknown> }>();

/**
 * A deliberate fault for the acceptance test only (Vitest): the route matching BAL_TEST_FAULT_ROUTE throws.
 * Never active outside Vitest.
 */
export const testFault = (pathname: string) => {
  if (!process.env.VITEST || !process.env.BAL_TEST_FAULT_ROUTE) return;
  if (new RegExp(process.env.BAL_TEST_FAULT_ROUTE).test(pathname)) throw new Error(process.env.BAL_TEST_FAULT_MESSAGE || "test fault");
};

// The UI may report in a loop (an effect that throws on every render): a cap per minute keeps the file small.
const UI_PER_MINUTE = 30;
let uiWindow = { start: 0, count: 0 };
const UI_KINDS = new Set(["render", "window", "rejection"]);
const str = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");

export const handleErrorRoutes = async (c: Ctx): Promise<boolean> => {
  const { req, res, parts, ch, root, load, send, readBody } = c;
  if (parts[0] !== "errors") return false;
  if (req.method !== "POST") return send(res, 405, { error: "طريقة غير مسموحة." }), true;

  if (parts.length === 1) {
    const b = (await readBody(req)) ?? {};
    const now = Date.now();
    if (now - uiWindow.start > 60_000) uiWindow = { start: now, count: 0 };
    if (++uiWindow.count > UI_PER_MINUTE) return send(res, 429, { error: "أخطاء كثيرة في دقيقة واحدة؛ سُجّل أولها." }), true;
    const kind = UI_KINDS.has(b.kind) ? b.kind : "window";
    const record = await appendErrorRecord(root, {
      source: "ui", kind, route: str(b.route, 500), message: str(b.message, 4_000) || "Error",
      stack: [str(b.stack, 8_000), str(b.componentStack, 4_000) ? `المكوّن:${str(b.componentStack, 4_000)}` : ""].filter(Boolean).join("\n"),
      channel: str(b.channel, 60) || ch, episode: str(b.episode, 3) || null, sceneId: str(b.sceneId, 40) || null,
      label: str(b.label, 120) || null,
    });
    if (!record) throw new HttpError(500, "تعذّر حفظ الخطأ في سجل الاستوديو.");
    return send(res, 200, { id: record.id, message: record.message }), true;
  }

  if (parts[1] === "send" && parts.length === 2) {
    const { assertSceneOwner, isOwnerAuthError } = await load("/src/studio/sceneService.ts");
    try { assertSceneOwner(); } catch (error) {
      if (isOwnerAuthError(error)) return send(res, 403, { error: "«أرسل المشكلة» من الاستوديو على جهاز المالك فقط." }), true;
      throw error;
    }
    const b = (await readBody(req)) ?? {};
    const id = str(b.id, 20);
    if (!/^e[0-9a-f]{10}$/.test(id)) throw new HttpError(400, "رقم الخطأ غير صالح.");
    const file = errorsFileFor(root);
    const records = await readErrorRecords(file);
    const at = records.findIndex((r) => r.id === id);
    if (at < 0) throw new HttpError(404, "لم يُعثر على هذا الخطأ في سجل الاستوديو.");
    const record = records[at]!;
    const channelMod = await load("/src/channel/index.ts");
    const channel = record.channel && channelMod.listChannels().includes(record.channel) ? record.channel : ch;
    // The episode's box when the error names one that exists here; else the channel's general box.
    let boxDir = path.join(channelMod.channelsDir(), channel);
    let episode = "";
    if (record.episode) {
      const { resolveEpisodeDir } = await load("/src/script/episodes.ts");
      const dir: string | null = await channelMod.runWithChannel(channel, () => resolveEpisodeDir(record.episode)).catch(() => null);
      if (dir) { boxDir = dir; episode = path.basename(dir); }
    }
    const opts = { values: secretValues(root), root };
    const { appendErrorNote } = await load("/src/studio/notesInbox.ts");
    const note = await appendErrorNote(boxDir, {
      channel, episode, sceneId: record.sceneId,
      error: {
        id: record.id, at: record.at, source: record.source, kind: record.kind, route: record.route,
        ...(record.method ? { method: record.method } : {}), message: record.message, stack: record.stack,
        label: record.label ?? null, episode: record.episode, commit: record.commit,
        log: lastLogLines(records, 20, opts),
      },
    });
    const sync = await load("/src/studio/notesSync.ts");
    void sync.scheduleStudioNotesSync(channelMod.channelsDir());
    return send(res, 200, { noteId: note.id, box: episode ? "episode" : "general", channel, episode }), true;
  }
  return send(res, 404, { error: "مسار غير معروف" }), true;
};
