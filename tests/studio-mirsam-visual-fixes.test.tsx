/**
 * Visual and keyboard fixes of «المِرسَم» after the three-channel QA pass (D61): the sentence menu opens upward
 * above the dock, separators beside Arabic digits are never «·» (it reads as «٠»), the screens listed by the QA
 * show no Latin digits, zubdat's raw file titles read cleanly, the delete confirmation accepts both digit systems,
 * the word popover keeps the focus, «ارفع التلاوة» is a real button, and «تحتاج إصلاحًا» shows notes as chips.
 * Presentation only: approvals and gates are tested where they live.
 */
import React from "react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { episodeTitle, latinDigits } from "../app/src/ui/format";
import { confirmsEpisode } from "../app/src/tabs/HomeTab";
import { NoteText, noteParts, problemNote } from "../app/src/workspace/SceneProductionPanel";
import { TopBar } from "../app/src/shell/TopBar";
import { panelSource } from "./helpers/panelSource";

const root = path.join(__dirname, "..");
const src = (f: string) => panelSource(f);
const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
const files = (dir: string): string[] => readdirSync(path.join(root, dir)).flatMap((f) => {
  const p = path.join(dir, f);
  return statSync(path.join(root, p)).isDirectory() ? files(p) : /\.(tsx?|css)$/.test(f) ? [p] : [];
});
/** Code lines only: comments may quote the old forms. */
const codeLines = (f: string) => src(f).split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));

describe("the sentence «⋯» menu opens upward, above the filmstrip and the dock", () => {
  it("both menus carry is-up, and is-up anchors the pop to the bottom with a z-index over the dock (30)", () => {
    const tsx = src("app/src/workspace/SentencesPanel.tsx");
    expect(tsx.match(/className="sv-menu-pop is-up"/g)).toHaveLength(2);
    expect(tsx).not.toMatch(/className="sv-menu-pop"/);
    const css = src("app/src/workspace/sentences.css");
    expect(css).toMatch(/\.sv-menu-pop\.is-up \{ top: auto; bottom: calc\(100% \+ 4px\); \}/);
    const z = Number(/\.sv-menu-pop \{[^}]*z-index: (\d+)/.exec(css)?.[1]);
    expect(z).toBeGreaterThan(30);
  });
});

describe("no «·» separator in the interface (beside Arabic digits it reads as «٠»)", () => {
  it("no code line under app/src draws «·», and the scene subtitle's separator is a thin bar", () => {
    const offenders = files("app/src").flatMap((f) => codeLines(f).filter((l) => l.includes("·")).map((l) => `${f}: ${l.trim().slice(0, 90)}`));
    expect(offenders).toEqual([]);
    expect(src("app/src/shell/screens-s3.css")).toMatch(/\.s3-sub::before \{ content: ""; display: inline-block; width: 1px;/);
  });

  it("the episode picker separates number and title with «—»", () => {
    const html = renderToStaticMarkup(<TopBar episodes={[{ id: "001", title: "01 | كتاب «أول مرة أصلي» || تهيئة القلب", dir: "001-x" } as never]} episodeId="001" onEpisode={() => {}}
      views={[]} scheme="light" onToggleScheme={() => {}} />);
    expect(text(html)).toContain("الحلقة ١ — كتاب «أول مرة أصلي» — تهيئة القلب");
    expect(html).not.toContain("·");
  });
});

describe("Arabic-Indic digits on the screens the QA listed", () => {
  it("OpsRoom KPIs and dates, LibraryTab counts, PublishTab counts and clock, ChannelBrand, the delete dialog go through format.ts", () => {
    const ops = src("app/src/tabs/OpsRoom.tsx");
    expect(ops).toContain("<b>{num(longThisWeek)} من {num(scheduledCount)}</b>");
    expect(ops).not.toMatch(/<span>\{d\.getDate\(\)\}\/\{d\.getMonth\(\) \+ 1\}<\/span>/);
    expect(ops).not.toMatch(/<b>\{(readyCount|all\.length|ideasCount)\}<\/b>/);
    expect(src("app/src/tabs/LibraryTab.tsx")).toContain("`العناصر (${num(lib.elements.length)})`");
    const pub = src("app/src/tabs/PublishTab.tsx");
    expect(pub).toContain("`قائمة النشر — ${num(doneCount)} من ${num(CHECKLIST.length)}`");
    expect(pub).toContain("const clock = (sec: number) => duration(sec);");
    const brand = src("app/src/tabs/ChannelBrand.tsx");
    expect(brand).toContain("const pct = (x: number) => `${num(Math.round(x * 100))}٪`;");
    expect(brand).not.toContain("toFixed(2)");
    const home = src("app/src/tabs/HomeTab.tsx");
    expect(home).toContain("اكتب رقم الحلقة (<Num>{del.id}</Num>) للتأكيد");
    expect(home).not.toMatch(/\(\{del\.id\}\)/);
  });

  it("the delete confirmation accepts the number in either digit system and shows the digits it asks for", () => {
    expect(latinDigits("٠٠١")).toBe("001");
    expect(latinDigits("۰۰۱")).toBe("001");
    expect(confirmsEpisode("٠٠١", "001")).toBe(true);
    expect(confirmsEpisode(" 001 ", "001")).toBe(true);
    expect(confirmsEpisode("٠٠٢", "001")).toBe(false);
    expect(confirmsEpisode("1", "001")).toBe(false);
  });

  it("the seams ruler: «١٩:٠٠» from the formatter, one isolated left-to-right run that never wraps", () => {
    const panel = src("app/src/workspace/SceneProductionPanel.tsx");
    expect(panel).toContain('<Num className="clk">{clock(m * 60)}</Num>');
    expect(panel).not.toContain("`${m}:00`");
    expect(src("app/src/shell/screens-s45.css")).toMatch(/\.ms-ruler > span \{[^}]*white-space: nowrap; direction: ltr; unicode-bidi: isolate;/);
    expect(src("app/src/shell/shell.css")).toMatch(/\.clk \{ direction: ltr; unicode-bidi: isolate; white-space: nowrap;/);
  });
});

describe("episode titles as the owner reads them (files untouched)", () => {
  it("drops a leading «NN |» and reads «||» as « — »", () => {
    expect(episodeTitle("01 | كتاب «أول مرة أصلي» || تهيئة القلب للصلاة")).toBe("كتاب «أول مرة أصلي» — تهيئة القلب للصلاة");
    expect(episodeTitle("كيف تعرف أنك على حق؟")).toBe("كيف تعرف أنك على حق؟");
    expect(episodeTitle("الحلقة 3")).toBe("الحلقة ٣");
    expect(episodeTitle("")).toBe("");
  });
});

describe("«تحتاج إصلاحًا»: the note's moment as a chip, not «[الحركة @0:04]»", () => {
  it("parses what problemNote stores, and renders «الحركة عند ٠:٠٤» before the text", () => {
    const raw = problemNote("motion", 4.2, "العنصر يدخل قبل كلمته");
    expect(noteParts(raw)).toEqual({ kind: "الحركة", at: "0:04", text: "العنصر يدخل قبل كلمته" });
    const html = renderToStaticMarkup(<NoteText raw={raw} />);
    expect(html).toContain('class="s3-chip"');
    expect(text(html)).toContain("الحركة عند ٠:٠٤");
    expect(html).not.toContain("[الحركة");
    expect(text(renderToStaticMarkup(<NoteText raw="عُدّل؛ يحتاج إنتاجًا جديدًا" />))).toBe("عُدّل؛ يحتاج إنتاجًا جديدًا");
  });

  it("the fix view has its own header and no dock; choosing a scene there opens it with its header, dock and focus", () => {
    const panel = src("app/src/workspace/SceneProductionPanel.tsx");
    // work ٨: the dock is its own component (sceneProduction/SceneStep.tsx), with no dock in the fix view
    expect(panel).toMatch(/export const SceneDock[^\n]*\n(?:[^\n]*\n){0,8}  if \(p\.view === "fix"\) return null;\n  if \(isCurrent && currentId && scene\) \{/);
    expect(panel).toContain('<button type="button" onClick={() => openScene(x.id)}>');
    expect(panel).toMatch(/const openScene = \(id: string\) => \{ setViewId\(id\);[^\n]*focusHead\.current = true; onView\?\.\("one"\);/);
    expect(panel).toContain('<h2 ref={headRef} tabIndex={-1}>');
    // «متتابعة» never cuts a sentence to one line
    expect(src("app/src/shell/screens-s3.css")).toMatch(/\.s3-clip-text \{[^}]*white-space: normal;/);
  });
});

describe("keyboard: focus goes where the owner's next key is", () => {
  it("the word popover focuses its field once placed, traps Tab, and the chip gets the focus back on close", () => {
    const tsx = src("app/src/workspace/SentencesPanel.tsx");
    expect(tsx).toContain("useEffect(() => { if (placed) field.current?.focus({ preventScroll: true }); }, [placed, f.row, f.index]);");
    expect(tsx).toContain('role="dialog" aria-modal="true" aria-labelledby={id} onKeyDown={trap}');
    expect(tsx).toMatch(/const close = \(\) => \{ const chip = chipRefs\.current\[`\$\{r\.id\}:\$\{f\.index\}`\]; setFixing\(null\); chip\?\.focus\(\); \};/);
  });

  it("«ارفع التلاوة» is a real button that opens the hidden file picker", () => {
    const tsx = src("app/src/workspace/RecitationItem.tsx");
    expect(tsx).toContain('<button type="button" className="btn ghost pf-upload" disabled={Boolean(busy)} aria-busy={busy === "up"} onClick={() => picker.current?.click()}>');
    expect(tsx).toContain('<input ref={picker} type="file"');
    expect(tsx).not.toContain('<label className="btn ghost pf-upload">');
  });
});

describe("layers, links and tokens", () => {
  it("the dock link colour is scoped to the dock itself; cards and the keys link use --acc-text", () => {
    const css = src("app/src/shell/shell.css");
    expect(css).toContain(".ms-dock-in .prep-link { color: var(--acc); }");
    expect(css).not.toMatch(/^\.ms-dock \.prep-link/m);
    expect(css).toContain(".ms-float .prep-link, .ms-float .ms-link, .ms-float a { color: var(--acc-text); }");
    expect(css).toContain(".keys-link, .keys-link:visited { color: var(--acc-text);");
  });

  it("the room under the content is only for a screen with a dock", () => {
    // KI-084: with the dock or the reel above it, sized from the measure (useDockRoom), never under 120 px
    expect(src("app/src/shell/shell.css")).toContain(".shell-v3 .studio-main:has(.ms-dock)::after, .shell-v3 .studio-main:has(.s3-reel)::after {");
  });

  it("muted text reaches 4.5:1 on paper and quiet surfaces; the danger button in dark uses dark ink", () => {
    const lum = (hex: string) => {
      const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const cr = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };
    const css = src("app/src/shell/shell.css");
    for (const ch of ["balislam", "dafatir-alzaman", "zubdat-alkutub"]) {
      const block = new RegExp(`\\[data-channel="${ch}"\\] \\{([^}]*)\\}`).exec(css)![1]!;
      const tok = (n: string) => new RegExp(`--${n}: #([0-9A-Fa-f]{6})`).exec(block)![1]!;
      for (const bg of ["paper", "quiet", "sf"]) expect(cr(tok("mute"), tok(bg)), `${ch} mute on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(css).toContain(".shell-v3 .btn.primary.danger { background: var(--err); border-color: var(--err); color: var(--err-ink); }");
    expect(cr("F08A7E", "111214")).toBeGreaterThanOrEqual(4.5);
  });

  it("studio-shell.css has no hard-coded light surfaces left outside the dark video stage", () => {
    const lines = src("app/src/studio-shell.css").split("\n").filter((l) => !/studio-review-(screen|no-video|caption)/.test(l));
    expect(lines.filter((l) => /#[0-9a-fA-F]{3,8}\b/.test(l))).toEqual([]);
  });

  it("the phone has a channel switcher in the admin menu; the sticky note is in the boards view only", () => {
    expect(src("app/src/shell/Band.tsx")).toContain('<div className="ms-menu-chs" role="group" aria-label="القناة">');
    expect(src("app/src/shell/shell.css")).toMatch(/@media \(max-width: 720px\) \{[\s\S]*\.ms-menu-chs \{ display: block; \}/);
    expect(src("app/src/shell/EpisodeSpine.tsx")).toContain('const showNote = Boolean(w && !done[0] && inStep1 && tab === "storyboard");');
  });

  it("the players speak Arabic: our own controls over Remotion's Player and the step ٣ videos", () => {
    const prev = src("app/src/ui/Preview.tsx");
    expect(prev).toContain("controls={false}");
    expect(prev).not.toMatch(/^\s+controls$/m);
    for (const l of ["أوقف", "شغّل", "اكتم الصوت", "ملء الشاشة", "موضع التشغيل"]) expect(prev).toContain(l);
    const panel = src("app/src/workspace/SceneProductionPanel.tsx");
    expect(panel).not.toMatch(/<video[^>]*\bcontrols\b/);
    expect(src("app/src/workspace/PreFinal.tsx")).not.toMatch(/<video[^>]*\bcontrols\b/);
  });
});
