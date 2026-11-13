import { api, type ApiError } from "./api";
import { emitStudioError, onStudioError, type StudioErrorEvent } from "./errorEvents";
import { parseStudioHash } from "./shell/route";

/**
 * التقاط أخطاء الصفحة آليًا (العمل ٣ من مرحلة الاستقرار، D112): حاجز الأخطاء في كل شاشة (`StudioErrorBoundary`)،
 * و`window.onerror` و`unhandledrejection`، كلها تُرسل إلى الخادم فتُكتب في `.studio/errors.jsonl` على جهاز المالك،
 * مع القناة والحلقة والمشهد من عنوان الصفحة. ثم يعرض `ErrorNotice` (أو بطاقة الحاجز) «أرسل المشكلة».
 * لا يُعدّ خطأً: رفضٌ ردّه الخادم (له رسالته في شاشته، والخادم سجّل ما كان غير متوقع منه)، وإلغاء طلب، وتحذير
 * ResizeObserver المعروف، وخطأ سكربت من موقع آخر بلا تفاصيل.
 */
export { onStudioError, type StudioErrorEvent };

type Kind = "render" | "window" | "rejection";
const hashNow = () => (typeof window === "undefined" ? "" : window.location.hash);

/** «TypeError: x is undefined» from anything thrown. */
export const errorText = (e: unknown): { message: string; stack: string } => {
  if (e instanceof Error) return { message: `${e.name || "Error"}: ${e.message}`, stack: e.stack ?? "" };
  if (e && typeof e === "object" && "message" in e) return { message: String((e as { message: unknown }).message), stack: "" };
  return { message: String(e), stack: "" };
};

const IGNORED = /^(?:Script error\.?|ResizeObserver loop (?:limit exceeded|completed with undelivered notifications)\.?)$/;
/** Is this worth a record? A server refusal, an abort or a known browser warning is not. */
export const isCrash = (e: unknown, message = ""): boolean => {
  if (IGNORED.test(message.trim())) return false;
  const x = e as (ApiError & { name?: string }) | null | undefined;
  if (x && typeof x === "object" && typeof x.status === "number") return false;
  if (x && typeof x === "object" && x.name === "AbortError") return false;
  if (!e && !message) return false;
  return true;
};

/** The record's number and its message as the server stored it (redacted: no secret reaches the screen either). */
export type Reported = { id: string; message: string };
const recent = new Map<string, { at: number; id: Promise<Reported | null> }>();
/**
 * Writes one page error on this device; resolves to its number (null when the Studio does not answer). The same error
 * within five seconds (a render loop) is written once.
 */
export const reportUiError = (p: { kind: Kind; error?: unknown; message?: string; componentStack?: string; label?: string },
  hash: string = hashNow()): Promise<Reported | null> => {
  const t = p.error !== undefined ? errorText(p.error) : { message: p.message ?? "Error", stack: "" };
  const key = `${p.kind}|${t.message}`;
  const now = Date.now();
  const seen = recent.get(key);
  if (seen && now - seen.at < 5_000) return seen.id;
  const r = parseStudioHash(hash);
  const id = api.reportError({
    kind: p.kind, message: t.message, stack: t.stack, ...(p.componentStack ? { componentStack: p.componentStack } : {}),
    ...(p.label ? { label: p.label } : {}), route: hash,
    ...(r.channel ? { channel: r.channel } : {}), ...(r.episode ? { episode: r.episode } : {}), ...(r.scene ? { sceneId: r.scene } : {}),
  }).then((x) => ({ id: x.id, message: x.message })).catch(() => null);
  recent.set(key, { at: now, id });
  if (recent.size > 50) recent.delete(recent.keys().next().value!);
  return id;
};

/** «أرسل المشكلة»: the owner-facing result line. Never throws. */
export const sendProblem = async (id: string | null, retry?: () => Promise<string | null>): Promise<{ ok: boolean; text: string }> => {
  try {
    const known = id ?? (await retry?.()) ?? null;
    if (!known) return { ok: false, text: "تعذّر الإرسال: الاستوديو لا يرد الآن. انتظر لحظات ثم اضغط «أرسل المشكلة» مرة أخرى." };
    await api.sendError(known);
    return { ok: true, text: "أُرسلت المشكلة إلى Claude مع تفاصيلها، ولم يُمسح شيء. إن لم تصل بعد ظهر «ملاحظات لم تُرسل» أعلى الشاشة." };
  } catch {
    return { ok: false, text: "تعذّر الإرسال الآن. انتظر لحظات ثم اضغط «أرسل المشكلة» مرة أخرى." };
  }
};

type ErrorLike = Event & { error?: unknown; message?: string; reason?: unknown };
/**
 * `window.onerror` and `unhandledrejection` (main.tsx). Returns the function that removes both.
 * `target` and `hash` are parameters for the test (no DOM in Vitest).
 */
export const installErrorCapture = (target: EventTarget = window, hash: () => string = hashNow): (() => void) => {
  const handle = (kind: Kind, e: unknown, message?: string) => {
    if (!isCrash(e, message ?? (e instanceof Error ? e.message : ""))) return;
    const id = reportUiError(e !== undefined && e !== null ? { kind, error: e } : { kind, message }, hash());
    void id.then((x) => { if (x) emitStudioError({ id: x.id, source: "ui", kind, message: x.message }); });
  };
  const onError = (ev: Event) => { const x = ev as ErrorLike; handle("window", x.error, x.message); };
  const onRejection = (ev: Event) => { const x = ev as ErrorLike; handle("rejection", x.reason); };
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  return () => {
    target.removeEventListener("error", onError);
    target.removeEventListener("unhandledrejection", onRejection);
  };
};
