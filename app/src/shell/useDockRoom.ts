import { useEffect } from "react";

/** The fixed bars at the foot of the page (the dock and, in step ٢, «الحلقة كاملة» above it). */
export const DOCK_SELECTORS = [".ms-dock", ".s3-reel"];

/**
 * How much of the window the fixed bars at its foot cover, in pixels (0 when none is on screen):
 * from the top of the highest of them to the bottom of the window, plus a little air.
 */
export const dockRoom = (tops: number[], viewportHeight: number, air = 24) => {
  const visible = tops.filter((t) => Number.isFinite(t) && t < viewportHeight);
  return visible.length ? Math.max(0, Math.round(viewportHeight - Math.min(...visible) + air)) : 0;
};

/**
 * The page keeps room under its last line for the fixed bars at its foot (owner review, 18 Nov: the room was a fixed
 * 120 px, the dock grows with its panels and the reel sits above it, so «اعرض جمل الحلقة كلها» and the shorts note
 * stayed under them). Writes `--dock-room` on <html>; shell.css sizes the page's end spacer from it.
 */
export const useDockRoom = () => {
  useEffect(() => {
    if (typeof window === "undefined" || typeof ResizeObserver === "undefined") return;
    const root = document.documentElement;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const tops: number[] = [];
        for (const el of document.querySelectorAll<HTMLElement>(DOCK_SELECTORS.join(","))) {
          // the dock spans the width but holds its content in children: measure what is drawn, not the empty band
          const parts = el.classList.contains("ms-dock") ? [...el.children] as HTMLElement[] : [el];
          for (const part of parts) { const r = part.getBoundingClientRect(); if (r.height > 0) tops.push(r.top); }
        }
        root.style.setProperty("--dock-room", `${dockRoom(tops, window.innerHeight)}px`);
      });
    };
    const sizes = new ResizeObserver(measure);
    const watch = () => { sizes.disconnect(); for (const el of document.querySelectorAll(DOCK_SELECTORS.join(","))) { sizes.observe(el); for (const c of el.children) sizes.observe(c); } measure(); };
    const tree = new MutationObserver(watch);
    tree.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", measure);
    watch();
    return () => { cancelAnimationFrame(frame); sizes.disconnect(); tree.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
};
