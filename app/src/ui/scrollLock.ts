import { useEffect } from "react";

/**
 * The page's only scroll lock (D64). The document is the one scroller of every Studio screen; while a modal
 * (dialog, word popover, lightbox) is open the page behind it must not move, so <html> gets `is-modal-open`
 * (shell.css: `html.is-modal-open { overflow: hidden }`). Locks are counted, so two modals on top of each other
 * release only when the last one closes; every lock is released on close, on unmount and on a route change
 * (a screen that unmounts takes its modal, and so its lock, with it). Nothing else may hide the page's overflow.
 */
export const MODAL_OPEN_CLASS = "is-modal-open";
let held = 0;

const root = (): HTMLElement | null => (typeof document === "undefined" ? null : document.documentElement);
const apply = () => { root()?.classList.toggle(MODAL_OPEN_CLASS, held > 0); };

/** Take a lock; the returned function releases it (once — calling it again does nothing). */
export const lockScroll = (): (() => void) => {
  held++;
  apply();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    held = Math.max(0, held - 1);
    apply();
  };
};

/** How many locks are held (tests and the scroll QA). */
export const scrollLocks = () => held;

/** Lock the page while `active` (a modal is open); released when it turns false or the component unmounts. */
export const useScrollLock = (active = true) => {
  useEffect(() => (active ? lockScroll() : undefined), [active]);
};
