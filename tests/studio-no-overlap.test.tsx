import { readFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { dockRoom } from "../app/src/shell/useDockRoom";
import { LabelParts, WORK_SESSION_START_LABEL } from "../app/src/ui/WorkSessionControl";

// Owner review, 18 Nov (Claude in Chrome): nothing covers anything.
const css = (f: string) => readFileSync(path.join(import.meta.dirname, "..", f), "utf8");

describe("the header never runs over the views", () => {
  it("the side with the work session keeps its content's width; the views give way and the episode keeps a usable width", () => {
    expect(css("app/src/shell/shell.css")).toContain("grid-template-columns: minmax(150px, 1fr) minmax(0, auto) minmax(max-content, 1fr)");
  });
  it("the work-session line keeps its whole name, and only the part after « — » steps aside", () => {
    const html = renderToStaticMarkup(<button aria-label={WORK_SESSION_START_LABEL}><LabelParts text={WORK_SESSION_START_LABEL} /></button>);
    expect(html).toContain('<span>ابدأ جلسة عمل</span><span class="ms-work-more"> — عالج ملاحظاتي تلقائيًا</span>');
    expect(html).toContain(`aria-label="${WORK_SESSION_START_LABEL}"`);
    expect(renderToStaticMarkup(<LabelParts text="بلا شرطة" />)).toBe("بلا شرطة");
  });
});

describe("the page keeps room for the bars at its foot", () => {
  it("measures from the top of the highest bar to the bottom of the window, plus air", () => {
    expect(dockRoom([738], 820)).toBe(106);
    expect(dockRoom([738, 520], 820)).toBe(324); // the reel above the dock: the higher one counts
    expect(dockRoom([], 820)).toBe(0);
    expect(dockRoom([900], 820)).toBe(0); // below the window: not on screen
  });
  it("the end spacer is sized from the measure, never under the old 120 px, with the dock or the reel", () => {
    const s = css("app/src/shell/shell.css");
    expect(s).toContain(".shell-v3 .studio-main:has(.ms-dock)::after, .shell-v3 .studio-main:has(.s3-reel)::after");
    expect(s).toContain("height: max(120px, var(--dock-room, 120px))");
  });
});

describe("the boards of step ١ as a list or a grid", () => {
  it("the grid puts the boards side by side with their text, and the choice stays on the device", () => {
    const panel = css("app/src/tabs/StoryboardPanel.tsx");
    expect(panel).toContain('aria-label="عرض اللوحات"');
    expect(panel).toContain('localStorage.setItem("bal-sb-layout", layout)');
    expect(css("app/src/shell/screens-s12.css")).toContain(".shell-v3 .sb-grid.s12-grid.is-grid { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));");
  });
});
