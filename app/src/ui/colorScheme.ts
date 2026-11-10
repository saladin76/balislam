import { useCallback, useEffect, useState } from "react";

/**
 * Light or dark Studio (direction D). With no choice of the owner's own, the system setting decides
 * (prefers-color-scheme, followed live). A choice from the toggle is remembered in this browser only
 * (localStorage, guarded: a blocked or private storage simply forgets it). The theme is one attribute on
 * <html>: data-theme="light" | "dark"; every colour is a token in shell/shell.css.
 */
export type Scheme = "light" | "dark";
export const SCHEME_KEY = "bal-theme";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const storage = (): StorageLike | null => {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
};

/** The owner's remembered choice, or null (none, or storage unavailable). */
export const readScheme = (s: StorageLike | null = storage()): Scheme | null => {
  try {
    const v = s?.getItem(SCHEME_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch { return null; }
};
/** Remember (or forget, with null) the choice; never throws. */
export const writeScheme = (v: Scheme | null, s: StorageLike | null = storage()): void => {
  try {
    if (!s) return;
    if (v) s.setItem(SCHEME_KEY, v); else s.removeItem(SCHEME_KEY);
  } catch { /* storage blocked: the choice lasts this visit only */ }
};
/** The theme in force: the owner's choice, else the system's. */
export const resolveScheme = (stored: Scheme | null, prefersDark: boolean): Scheme => stored ?? (prefersDark ? "dark" : "light");

const media = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null);

export const useColorScheme = (): { scheme: Scheme; toggle: () => void } => {
  const [stored, setStored] = useState<Scheme | null>(() => readScheme());
  const [prefersDark, setPrefersDark] = useState(() => Boolean(media()?.matches));
  useEffect(() => {
    const m = media();
    if (!m) return;
    const on = (e: MediaQueryListEvent) => setPrefersDark(e.matches);
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  const scheme = resolveScheme(stored, prefersDark);
  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.dataset.theme = scheme;
  }, [scheme]);
  const toggle = useCallback(() => {
    const next: Scheme = scheme === "dark" ? "light" : "dark";
    writeScheme(next);
    setStored(next);
  }, [scheme]);
  return { scheme, toggle };
};
