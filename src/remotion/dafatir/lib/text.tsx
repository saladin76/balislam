/** أدوات النص العربي المتحرك (قواعد اللغة في docs/dafatir-alzaman/03-tools.md و04-technical.md) */

import React from "react";
import { C, Ink, easeOut, mix, prog, rng } from "../horizon/kit";
import { SText } from "../horizon/book";


export { SText, WriteIn } from "../horizon/book";

export const Word: React.FC<{ x: number; y: number; size: number; p: number; color?: string; font?: "amiri" | "tajawal"; weight?: number; anchor?: "middle" | "start" | "end"; children: React.ReactNode }> = ({ p, ...r }) => (
  <SText {...r} o={p} dy={(1 - p) * 12}>
    {r.children}
  </SText>
);

export const Strike: React.FC<{ x1: number; x2: number; y: number; p: number; w?: number }> = ({ x1, x2, y, p, w = 5 }) => <Ink d={`M${x1} ${y} L${x2} ${y - 6}`} w={w} p={p} c={C.ribbon} />;

/** عدد الحروف المرسومة (بلا حركات ولا تطويل) — لتقدير عرض الكلمة العربية */
export const letterCount = (s: string) => s.replace(/[\u064B-\u0652\u0670\u0640\s]/g, "").length;

/**
 * نص يُكتب كلمة كلمة لحظة نطق كل كلمة، ويلتف على سطور (للحواشي والمقارنات).
 * الوحدة هي الكلمة كاملة، فلا ينكسر اتصال الحروف ولا تنفصل الحركات عن حروفها.
 */
export const Flow: React.FC<{ items: { w: string; t: number }[]; now: number; style: React.CSSProperties; dur?: number }> = ({ items, now, style, dur = 0.35 }) => (
  <div style={{ position: "absolute", direction: "rtl", textAlign: "center", whiteSpace: "normal", ...style }}>
    {items.map((it, i) => {
      const p = prog(now, it.t - 0.05, it.t - 0.05 + dur, easeOut);
      return (
        <React.Fragment key={i}>
          <span style={{ display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * 8}px)` }}>{it.w}</span>
          {i < items.length - 1 ? " " : null}
        </React.Fragment>
      );
    })}
  </div>
);
