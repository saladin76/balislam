import { useEffect, useRef } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A modal dialog that behaves like one (D52): Esc closes it, Tab stays inside it, the first field gets
 * focus, and focus returns to what opened it when it closes.
 */
export const useDialog = <T extends HTMLElement>(onClose: () => void, active = true) => {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!active) return;
    const opener = document.activeElement as HTMLElement | null;
    const box = ref.current;
    const items = () => (box ? [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((e) => e.offsetParent !== null || e === document.activeElement) : []);
    if (box && !box.contains(document.activeElement)) (items()[0] ?? box).focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); close.current(); return; }
      if (e.key !== "Tab" || !box) return;
      const list = items();
      if (!list.length) { e.preventDefault(); return; }
      const first = list[0]!, last = list[list.length - 1]!;
      if (e.shiftKey && (document.activeElement === first || !box.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !box.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("keydown", key, true);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [active]);
  return ref;
};
