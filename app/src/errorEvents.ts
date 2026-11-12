/**
 * One channel for «a problem happened» in the page (D112): the server answered with an `errorId` (an unexpected
 * error it logged), or the page caught one (`errorCapture.ts`). `ErrorNotice` listens and offers «أرسل المشكلة».
 * No React, no API: `api.ts` and `errorCapture.ts` both import it without a cycle.
 */
export type StudioErrorEvent = {
  /** The record in `.studio/errors.jsonl` (`e` + 10 hex). */
  id: string;
  source: "server" | "ui";
  kind: "route" | "render" | "window" | "rejection";
  /** The technical text, shown under «تفاصيل» only. */
  message: string;
};
type Listener = (e: StudioErrorEvent) => void;
const listeners = new Set<Listener>();
export const onStudioError = (fn: Listener): (() => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};
export const emitStudioError = (e: StudioErrorEvent) => {
  for (const fn of [...listeners]) { try { fn(e); } catch { /* a listener never breaks the page */ } }
};
