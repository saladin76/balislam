import React from "react";

/** The Studio's few line icons (direction D). Decorative: always aria-hidden; the button carries the words. */
const P: Record<string, React.ReactNode> = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth={2.2} />,
  regen: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></>,
  motion: <><path d="M4 17c3 0 4-10 8-10s5 10 8 10" /><circle cx="12" cy="7" r="1.6" fill="currentColor" /></>,
  tone: <path d="M4 12h2M8 8v8M12 5v14M16 9v6M20 11v2" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" /></>,
  plus: <path d="M12 5v14M5 12h14" strokeWidth={2} />,
  chev: <path d="M15 6l-6 6 6 6" strokeWidth={2} />,
  chevR: <path d="M9 6l6 6-6 6" strokeWidth={2} />,
  down: <path d="M6 9l6 6 6-6" strokeWidth={2} />,
  up: <path d="M6 15l6-6 6 6" strokeWidth={2} />,
  film: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4" /></>,
  doc: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  warn: <><path d="M12 4l9 16H3z" /><path d="M12 10v4M12 17.2v.1" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8v.1" /></>,
  x: <path d="M6 6l12 12M18 6L6 18" strokeWidth={1.8} />,
  undo: <><path d="M9 14l-4-4 4-4" /><path d="M5 10h9a5 5 0 0 1 0 10h-3" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  more: <><circle cx="5.5" cy="12" r="1.7" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" /><circle cx="18.5" cy="12" r="1.7" fill="currentColor" stroke="none" /></>,
  drive: <><path d="M8.5 4h7l5.5 9.5-3.5 6h-11L3 13.5z" /><path d="M8.5 4L15 15.5M15.5 4L9 15.5M3 13.5h13" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>,
};
const FILLED: Record<string, React.ReactNode> = {
  play: <path fill="currentColor" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />,
  pause: <><rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" /><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" /></>,
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" />,
};
export type IconName = keyof typeof P | keyof typeof FILLED;

export const Icon: React.FC<{ name: IconName; className?: string }> = ({ name, className }) =>
  name in FILLED
    ? <svg className={className ?? "ms-ic"} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{FILLED[name]}</svg>
    : <svg className={className ?? "ms-ic"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{P[name]}</svg>;
