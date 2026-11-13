/**
 * The Studio's scroll model (D64): the document is the one scroller of every screen. The owner could not scroll
 * steps ١–٤ at all: `.app.episode-workspace-app { overflow: hidden }` (workspace.css, loaded after shell.css) clipped
 * `.studio-main`, the screen's only scroller, and the keyboard never scrolled anywhere because the scroller was an
 * inner box, not the page. These checks keep the model: nothing hides the overflow of html/body/#root/.app/
 * .shell-v3/.studio-main except `html.is-modal-open`, and that lock is counted and always released.
 * The browser check of every screen is app/scripts/scroll-qa.mjs (not part of vitest).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { MODAL_OPEN_CLASS, lockScroll, scrollLocks } from "../app/src/ui/scrollLock";
import { panelSource } from "./helpers/panelSource";

const root = path.join(__dirname, "..");
const src = (f: string) => panelSource(f);
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = path.join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : [p];
});
const cssFiles = walk(path.join(root, "app/src")).filter((f) => f.endsWith(".css"));
/** Innermost rules (inside @media too): [selector, declarations]. */
const rules = (css: string) => [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1]!.trim(), m[2]!] as const);
/** A selector whose subject is the page or the screen's main container. */
const PAGE = /(^|[\s>,])(html|body|#root|\.app|\.studio-shell|\.shell-v3|\.studio-main)((\.[\w-]+)|(:[\w-]+(\([^)]*\))?))*$/;

describe("one scroller per screen: the document", () => {
  it("no rule hides the overflow of html, body, #root, .app, .shell-v3 or .studio-main (only html.is-modal-open)", () => {
    const bad: string[] = [];
    for (const f of cssFiles) for (const [sel, decl] of rules(src(path.relative(root, f)))) {
      if (!/(^|;|\s)overflow(-y)?\s*:\s*(hidden|clip)/.test(decl)) continue;
      for (const one of sel.split(",").map((s) => s.trim())) {
        if (!PAGE.test(one)) continue;
        if (one.includes(`.${MODAL_OPEN_CLASS}`)) continue;
        bad.push(`${path.relative(root, f)}: ${one}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("the main container is not an inner scroller and is not one viewport tall; the band is sticky", () => {
    const shell = src("app/src/shell/shell.css");
    const main = rules(shell).find(([s]) => s === ".shell-v3 .studio-main")![1];
    expect(main).toMatch(/height: auto/);
    expect(main).toMatch(/min-height: 100dvh/);
    expect(main).toMatch(/overflow: visible/);
    expect(main).not.toMatch(/overflow-y:\s*(auto|scroll)/);
    const shellRule = rules(shell).find(([s]) => s === ".shell-v3")![1];
    expect(shellRule).toMatch(/min-height: 100dvh/);
    expect(shellRule).not.toMatch(/(^|\s)height: 100dvh/);
    expect(rules(shell).find(([s]) => s === ".ms-band")![1]).toMatch(/position: sticky; top: 0/);
    expect(shell).toContain("html.is-modal-open, html.is-modal-open body { overflow: hidden; }");
  });

  it("episode screens add no clip and no inner scroller of their own", () => {
    const ws = src("app/src/workspace/workspace.css");
    for (const [sel, decl] of rules(ws)) if (sel.includes(".episode-workspace-app")) expect(decl, sel).not.toMatch(/overflow|min-height:\s*0/);
  });

  it("no wheel or touch-move listener and no overscroll trap that could swallow the page's scroll", () => {
    const tsx = walk(path.join(root, "app/src")).filter((f) => /\.tsx?$/.test(f));
    for (const f of tsx) expect(src(path.relative(root, f)), f).not.toMatch(/onWheel|["']wheel["']|["']touchmove["']|onTouchMove/);
    for (const f of cssFiles) expect(src(path.relative(root, f)), f).not.toMatch(/overscroll-behavior(-y)?:\s*(contain|none)/);
  });

  it("the word popover keeps its word in view by scrolling the page, not an inner box", () => {
    const sp = src("app/src/workspace/SentencesPanel.tsx");
    expect(sp).not.toMatch(/closest<HTMLElement>\("\.studio-main"\)/);
    expect(sp).toContain("window.scrollBy(0, chip.getBoundingClientRect().top - 90);");
  });
});

describe("scroll lock: only while a modal is open, always released", () => {
  const g = globalThis as { document?: unknown };
  const had = "document" in g;
  const prev = g.document;
  const classes = new Set<string>();
  g.document = { documentElement: { classList: { toggle: (c: string, on: boolean) => { if (on) classes.add(c); else classes.delete(c); } } } };
  afterEach(() => { expect(scrollLocks()).toBe(0); });

  it("a lock adds is-modal-open; releasing it removes it; a second release does nothing", () => {
    const release = lockScroll();
    expect(classes.has(MODAL_OPEN_CLASS)).toBe(true);
    release();
    expect(classes.has(MODAL_OPEN_CLASS)).toBe(false);
    release();
    expect(scrollLocks()).toBe(0);
  });

  it("two modals: the page stays locked until the last one closes", () => {
    const a = lockScroll(), b = lockScroll();
    a();
    expect(classes.has(MODAL_OPEN_CLASS)).toBe(true);
    b();
    expect(classes.has(MODAL_OPEN_CLASS)).toBe(false);
    if (!had) delete g.document; else g.document = prev;
  });

  it("the hook releases on close and on unmount (the effect's cleanup is the release)", () => {
    const hook = src("app/src/ui/scrollLock.ts");
    expect(hook).toContain("useEffect(() => (active ? lockScroll() : undefined), [active]);");
  });

  it("every modal takes the lock: dialogs, pickers, the ops editors, the lightbox and the word popovers", () => {
    expect(src("app/src/ui/useDialog.ts")).toContain("useScrollLock(active);");
    expect(src("app/src/ui/Pickers.tsx")).toContain("useScrollLock();");
    expect(src("app/src/tabs/OpsRoom.tsx").match(/useScrollLock\(\);/g)).toHaveLength(2);
    expect(src("app/src/tabs/LabStoryboards.tsx")).toContain("useScrollLock();");
    expect(src("app/src/workspace/SentencesPanel.tsx").match(/useScrollLock\(\);/g)).toHaveLength(2);
    // every full-screen backdrop in the Studio belongs to one of them
    const backs = walk(path.join(root, "app/src")).filter((f) => f.endsWith(".tsx")).filter((f) => /className="(modal-back|sbi-lightbox|ms-scrim)"/.test(src(path.relative(root, f))));
    for (const f of backs) expect(src(path.relative(root, f)), f).toMatch(/useScrollLock|useDialog</);
  });
});
