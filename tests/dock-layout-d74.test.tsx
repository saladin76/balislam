/**
 * D74 (the owner's MacBook at 1288×705, 11 Nov): the floating dock of «اعتمد اللوحات المتغيّرة» covered the screen,
 * its explanation squeezed into a one-word column beside a one-row citations sentence. The dock is now a bar: under
 * a quarter of the viewport, one line of text with a minimum width and «التفاصيل» for the rest, the citations a
 * small chip with a tooltip, and the controls wrapping to a second row. Presentation only; the real-browser check is
 * `app/scripts/ui-audit.mjs`.
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DockChip, DockText } from "../app/src/shell/DockText";
import { citationChip, citationNotice } from "../app/src/shell/citationNotice";

const root = path.join(__dirname, "..");
const src = (f: string) => readFileSync(path.join(root, f), "utf8");
/** The declarations of one exact selector (the last rule wins, so all of them are joined). */
const rule = (css: string, selector: string) => {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...css.matchAll(new RegExp(`(?:^|\\n)\\s*${esc}\\s*\\{([^}]*)\\}`, "g"))].map((m) => m[1]).join(";");
};
const css = src("app/src/shell/shell.css");

describe("the dock is a bar, never a wall", () => {
  it("stays under a quarter of the viewport and wraps its controls", () => {
    expect(rule(css, ".ms-dock-in")).toMatch(/max-height:\s*25dvh/);
    // not on the column: a card floating above the bar (the fix note) must never push the bar off the screen
    expect(rule(css, ".ms-dock")).not.toMatch(/max-height/);
    expect(rule(css, ".ms-dock-in")).toMatch(/flex-wrap:\s*wrap/);
    expect(rule(css, ".ms-dock-ctl")).toMatch(/flex-wrap:\s*wrap/);
  });
  it("its text is one line with a minimum width and a flex basis (no one-word column)", () => {
    const t = rule(css, ".ms-dock .ms-dock-text");
    expect(t).toMatch(/flex:\s*1 1 2\d\dpx/);
    expect(t).toMatch(/min-width:\s*min\(2\d\dpx, 100%\)/);
    expect(t).toMatch(/white-space:\s*nowrap/);
    expect(t).toMatch(/text-overflow:\s*ellipsis/);
    expect(rule(css, ".ms-dock-text")).toMatch(/min-width:\s*min\(\d{3}px, 100%\)/);
    // the other dock texts: the locked scene's reason and the series line keep a minimum width too
    expect(src("app/src/shell/screens-s3.css")).toMatch(/\.ms-dock-in \.s3-why \{[^}]*min-width:\s*min\(\d{3}px, 100%\)/);
    expect(src("app/src/tabs/series.css")).toMatch(/\.ms-dock-line \{[^}]*min-width:\s*min\(\d{3}px, 100%\)/);
  });
  it("«التفاصيل» opens the full explanation in a card above the dock", () => {
    expect(rule(css, ".ms-dock-pop")).toMatch(/position:\s*absolute;\s*bottom:\s*100%/);
    expect(rule(css, ".ms-dock-pop")).toMatch(/pointer-events:\s*auto/);
    const html = renderToStaticMarkup(<DockText line="سطر" details="الشرح كله" />);
    expect(html).toContain('class="ms-dock-text"');
    expect(html).toContain("التفاصيل");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("الشرح كله"); // closed until asked
  });
  it("11 Nov: no changed-boards line or re-approval in the dock (a change after «اعتمد التجهيز» is carried forward)", () => {
    const spine = src("app/src/shell/EpisodeSpine.tsx");
    expect(spine).not.toContain("spine-changed");
    expect(spine).not.toContain("اعتمد اللوحات المتغيّرة");
  });
});

describe("the unverified citations are a chip, not a sentence", () => {
  const items = [...Array(11)].map(() => ({ kind: "other", status: "verified" }))
    .concat([...Array(3)].map(() => ({ kind: "ayah", status: "pending" })), [...Array(2)].map(() => ({ kind: "other", status: "pending" })));
  it("the chip says the count; the full notice is its tooltip", () => {
    expect(citationChip(items)).toBe("غير موثّق: ٥ من ١٦");
    expect(citationChip(items.slice(0, 11))).toBe("");
    const html = renderToStaticMarkup(<DockChip label={citationChip(items)} text={citationNotice(items)} />);
    expect(html).toContain('class="ms-chip"');
    expect(html).toContain(`title="${citationNotice(items)}"`);
    expect(html).toContain("غير موثّق: ٥ من ١٦");
  });
  it("the dock uses the chip and no longer the long warning line", () => {
    const spine = src("app/src/shell/EpisodeSpine.tsx");
    expect(spine).toContain("<DockChip label={citeChip} text={citations}>");
    expect(spine).not.toMatch(/className="ms-wn" title=\{citations\}/);
    expect(rule(css, ".ms-chip")).toMatch(/white-space:\s*nowrap/);
    expect(rule(css, ".ms-chip")).toMatch(/height:\s*32px/);
  });
});

describe("the UI audit is a script outside vitest", () => {
  it("checks one-word columns, covering layers and the dock height", () => {
    const s = src("app/scripts/ui-audit.mjs");
    for (const k of ["narrowWrap", "cover", "dockHeight", "overlap", "hscroll", "clipped", "contrast", "console"]) expect(s).toContain(k);
    expect(s).toContain("lines >= 6 && cpl < 8");
    expect(s).toContain("a > 0.3");
    expect(s).toContain("1288x705");
  });
});
