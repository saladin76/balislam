import React from "react";
import { useDialog } from "./useDialog";

/** The Studio's modal: Esc closes, focus stays inside, a click on the backdrop closes (D52). */
export const Dialog: React.FC<{ labelledBy: string; onClose: () => void; children: React.ReactNode; width?: number; as?: "div" | "form"; onSubmit?: (e: React.FormEvent) => void;
  /** The form checks its own fields and says why in Arabic (the browser's tooltip is in the browser's language). */
  noValidate?: boolean }> = ({ labelledBy, onClose, children, width, as = "div", onSubmit, noValidate }) => {
  const ref = useDialog<HTMLElement>(onClose);
  const props = { ref: ref as React.Ref<never>, className: "modal", role: "dialog", "aria-modal": true, "aria-labelledby": labelledBy, tabIndex: -1, style: width ? { width } : undefined };
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      {as === "form" ? <form {...props} onSubmit={onSubmit} noValidate={noValidate}>{children}</form> : <div {...props}>{children}</div>}
    </div>
  );
};
