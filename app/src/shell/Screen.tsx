import React from "react";

/**
 * لغة الشاشات المشتركة (شاشة واحدة لكل خطوة):
 * - Stage: المسرح الواحد للخطوة، بعنوان قصير ومعلومة جانبية صغيرة.
 * - Hint: سطر إرشاد واحد قصير، لا فقرات.
 * - More: كل ما ليس قرار اللحظة (أدوات، فحوص فنية، إعدادات، شروح) مطوي هنا.
 */
export const Stage: React.FC<{ title?: React.ReactNode; meta?: React.ReactNode; className?: string; children: React.ReactNode }> = ({ title, meta, className, children }) => (
  <section className={`stage${className ? ` ${className}` : ""}`}>
    {title || meta ? (
      <header className="stage-head">
        {title ? <h2>{title}</h2> : <span />}
        {meta ? <span className="stage-meta">{meta}</span> : null}
      </header>
    ) : null}
    {children}
  </section>
);

export const Hint: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="hint">{children}</p>;

export const More: React.FC<{ label?: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ label = "أدوات وتفاصيل", children, defaultOpen }) => (
  <details className="more" open={defaultOpen}>
    <summary>{label}</summary>
    <div className="more-body">{children}</div>
  </details>
);
