import React, { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Icon } from "../ui/icons";

/**
 * D73 (the owner's MacBook, 11 Nov): the floating dock never grows into a wall of text. Its explanation is ONE line
 * (ellipsis) beside the controls; when the full text does not fit, «التفاصيل» opens it in a card above the dock
 * (a sheet on the phone). The line has a minimum width (CSS `.ms-dock-text`), and the controls wrap to a second row
 * instead of squeezing it into a one-word column.
 */
export const DockText: React.FC<{
  /** the one line in the dock */
  line: React.ReactNode;
  /** the full explanation (defaults to the line itself, shown when the line is cut) */
  details?: React.ReactNode;
  className?: string;
}> = ({ line, details, className }) => {
  const box = useRef<HTMLParagraphElement>(null);
  const [cut, setCut] = useState(false);
  const [open, setOpen] = useState(false);
  const id = useId();
  const extra = details != null && details !== line;
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const check = () => setCut(el.scrollWidth > el.clientWidth + 1);
    check();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [line]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("keydown", key, true);
    return () => document.removeEventListener("keydown", key, true);
  }, [open]);
  const more = extra || cut;
  return (
    <>
      <p ref={box} className={`ms-dock-text${className ? ` ${className}` : ""}`} title={typeof line === "string" && cut ? line : undefined}>{line}</p>
      {more ? (
        <button type="button" className="btn ms-more" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
          التفاصيل<Icon name={open ? "down" : "up"} />
        </button>
      ) : null}
      {more && open ? (
        <div id={id} className="ms-float ms-dock-pop" role="note">
          <div className="ms-dock-pop-body">{details ?? line}</div>
          <button type="button" className="ms-nv ms-dock-pop-x" aria-label="أغلق التفاصيل" onClick={() => setOpen(false)}><Icon name="x" /></button>
        </div>
      ) : null}
    </>
  );
};

/**
 * D73: the unverified citations are a small chip in the dock (count + tooltip), never a sentence beside the button.
 * A click (or tap) opens the full notice in the same card as «التفاصيل».
 */
export const DockChip: React.FC<{ label: string; text: string; children?: React.ReactNode }> = ({ label, text, children }) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button type="button" className="ms-chip" title={text} aria-label={`${label}: ${text}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <Icon name="warn" /><span>{label}</span>
      </button>
      {open ? (
        <div id={id} className="ms-float ms-dock-pop" role="note">
          <div className="ms-dock-pop-body"><p>{text}</p>{children}</div>
          <button type="button" className="ms-nv ms-dock-pop-x" aria-label="أغلق" onClick={() => setOpen(false)}><Icon name="x" /></button>
        </div>
      ) : null}
    </>
  );
};
