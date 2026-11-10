/**
 * Direction D «المِرسَم» (owner-approved redesign, 10 Nov): the channel band with the four steps, the header with
 * the views of the current step and the light/dark toggle (no owner session, D54), the word-fix popover and its
 * neighbour option, and the bundled fonts. Presentation only: approvals and gates are tested where they live.
 */
import React from "react";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Band } from "../app/src/shell/Band";
import { TopBar } from "../app/src/shell/TopBar";
import { STEPS } from "../app/src/shell/EpisodeSpine";
import { SCHEME_KEY, readScheme, resolveScheme, writeScheme } from "../app/src/ui/colorScheme";
import { Num, TECHNICAL_TEXT, zeroParts } from "../app/src/ui/format";
import { WordFixLine, WordFixPopover, fixNeighbours, neighbourHint } from "../app/src/workspace/SentencesPanel";

const src = (f: string) => readFileSync(path.join(__dirname, "..", f), "utf8");
const noop = () => {};
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const CHANNELS = [
  { id: "balislam", name: "بالإسلام", language: "ar", domains: {} },
  { id: "dafatir-alzaman", name: "دفاتر الزمن", language: "ar", domains: {} },
  { id: "zubdat-alkutub", name: "زبدة الكتب", language: "ar", domains: {} },
];
const band = (over: Partial<React.ComponentProps<typeof Band>> = {}) => renderToStaticMarkup(
  <Band channels={CHANNELS} channelId="zubdat-alkutub" channelName="زبدة الكتب" onChannel={noop} onHome={noop}
    episode={{ id: "001", title: "أول مرة أصلي" }} steps={{ done: [true, false, false, false], here: 1, sub: "0 من 31" }}
    stepTitles={STEPS.map((s) => s.title)} onStep={noop} manage={[{ id: "settings", label: "الاتصالات والمفاتيح", note: "الصوت غير متصل" }]}
    active="episode" onManage={noop} {...over} />,
);

describe("the channel band: four steps, the channel, the admin menu", () => {
  it("four big numerals with their names; ✓ on the done ones, the accent square (aria-current) on the step on screen", () => {
    const html = band();
    const steps = [...html.matchAll(/<button type="button" class="ms-stp[^"]*"[^>]*>/g)].map((m) => m[0]);
    expect(steps).toHaveLength(4);
    expect(steps[0]).toContain("is-done");
    expect(steps[1]).toContain('aria-current="step"');
    expect(steps.filter((s) => s.includes("aria-current"))).toHaveLength(1);
    expect(html.match(/class="ck"/g)).toHaveLength(1);
    for (const [i, s] of STEPS.entries()) expect(html).toContain(`<span class="n" aria-hidden="true">${"١٢٣٤"[i]}</span><small aria-hidden="true">${s.title}</small>`);
    // The sub line under the step on screen, digits Arabic-Indic and the zero drawn a touch larger
    expect(html).toContain('<span class="z">٠</span> من ٣١');
  });

  it("the step that waits for the owner, when another is on screen, carries a dot and says so", () => {
    const html = band({ steps: { done: [true, false, false, false], here: 0 } });
    expect(html).toMatch(/aria-label="٢ المشاهد \(تنتظرك\)"/);
    expect(html.match(/class="wait"/g)).toHaveLength(1);
  });

  it("the switcher lists every channel by its own token scope (data-channel), the current one pressed", () => {
    const html = band();
    for (const c of CHANNELS) expect(html).toMatch(new RegExp(`class="ms-ch" data-channel="${c.id}" aria-pressed="${c.id === "zubdat-alkutub"}"`));
    expect(html).toContain('aria-label="إدارة الاستوديو"');
    expect(html).toContain('aria-haspopup="menu"');
  });

  it("on the channel's episodes: the count instead of the steps", () => {
    const html = band({ episode: null, steps: null, counter: { n: 3, label: "حلقات" } });
    expect(html).not.toContain("ms-stp");
    expect(html).toContain('class="ms-counter"');
  });

  it("no owner session anywhere (D54), no channel branch in the shell's logic, no technical text", () => {
    for (const f of ["app/src/shell/Band.tsx", "app/src/shell/TopBar.tsx", "app/src/App.tsx", "app/src/ui/colorScheme.ts"]) {
      const code = src(f);
      expect(code, f).not.toMatch(/الجلسة مفتوحة|جلسة المالك|passphrase|OwnerSession/);
      expect(code, f).not.toMatch(/["'`](balislam|dafatir-alzaman|zubdat-alkutub)["'`]/);
    }
    for (const re of TECHNICAL_TEXT) expect(text(band())).not.toMatch(re);
  });
});

describe("the header: the episode, the views of the step, light/dark", () => {
  const header = (scheme: "light" | "dark") => renderToStaticMarkup(
    <TopBar episodes={[{ id: "001", dir: "001-x", title: "أول مرة أصلي", domain: "", hasPlan: true }]} episodeId="001" onEpisode={noop}
      views={[{ id: "one", label: "مشهدًا مشهدًا", current: true, onSelect: noop }, { id: "voice", label: "متتابعة", sub: "7:39", current: false, onSelect: noop },
        { id: "fix", label: "تحتاج إصلاحًا", badge: 0, current: false, onSelect: noop }]}
      save={{ state: "saved", unsaved: false }} scheme={scheme} onToggleScheme={noop} />,
  );
  it("the pill marks the view on screen; the episode picker is labelled; the toggle says what it does", () => {
    const html = header("light");
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="page">مشهدًا مشهدًا/);
    expect(html).toContain('<span class="ms-vh">الحلقة</span>');
    expect(html).toContain('aria-label="الوضع الليلي"');
    expect(header("dark")).toContain('aria-label="الوضع النهاري"');
    expect(html).toContain("محفوظ");
    expect(html).not.toContain("الجلسة");
  });
});

describe("dark mode: the system decides until the owner chooses; the choice is remembered, safely", () => {
  const memory = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
  };
  it("no choice: prefers-color-scheme; a choice wins and persists", () => {
    const s = memory();
    expect(readScheme(s)).toBeNull();
    expect(resolveScheme(readScheme(s), true)).toBe("dark");
    expect(resolveScheme(readScheme(s), false)).toBe("light");
    writeScheme("light", s);
    expect(s.m.get(SCHEME_KEY)).toBe("light");
    expect(resolveScheme(readScheme(s), true)).toBe("light");
    writeScheme(null, s);
    expect(readScheme(s)).toBeNull();
    s.setItem(SCHEME_KEY, "sepia");
    expect(readScheme(s)).toBeNull();
  });
  it("a blocked storage never throws: the choice lasts the visit only", () => {
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(readScheme(blocked)).toBeNull();
    expect(() => writeScheme("dark", blocked)).not.toThrow();
    expect(readScheme(null)).toBeNull();
  });
  it("one attribute on <html>; every colour a token, redefined for dark", () => {
    expect(src("app/src/ui/colorScheme.ts")).toContain("document.documentElement.dataset.theme = scheme");
    const css = src("app/src/shell/shell.css");
    expect(css).toContain(':root[data-theme="dark"] :is(.shell-v3, [data-channel])');
    for (const ch of CHANNELS) expect(css).toMatch(new RegExp(`\\[data-channel="${ch.id}"\\] \\{\\s*--band:`));
    // A neutral fallback for a channel the Studio does not know
    expect(css).toMatch(/\.shell-v3, \[data-channel\] \{\s*--band:/);
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});

describe("the word popover", () => {
  const words = ["وَمَعَ", "السِّنِينَ", "نَحْفَظُ", "هَذِهِ", "الْأَفْعَالَ", "حَتَّى", "تَصِيرَ", "مَأْلُوفَةً", "لَنَا"].map((w, i) => ({ word: w, say: w, start: i * 0.4, end: i * 0.4 + 0.3, quran: false }));
  const pop = (over: Partial<React.ComponentProps<typeof WordFixPopover>> = {}) => renderToStaticMarkup(
    <WordFixPopover words={words} rowNo={3} draft={{ row: "r3", index: 1, say: "السِّنِين", save: true, wide: false }} busy={null} noKey={false} playing={false}
      pos={{ top: 10, left: 20, arrow: 200, sheet: false }} onDraft={noop} onClose={noop} onPlay={noop} onFix={noop} onWhole={noop} {...over} />,
  );
  it("the word big and where it is, ▶ الكلمة, the sentence with the word and its neighbours, the field, save, and the two actions", () => {
    const html = pop();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('class="ms-scrim"');
    expect(text(html)).toContain("الكلمة ٢ من ٩");
    expect(text(html)).toContain("في الجملة ٣");
    expect(text(html)).toContain("الكلمة");
    expect(html).toContain('<span class="me">السِّنِينَ</span>');
    expect(html.match(/class="nb"/g)).toHaveLength(2);
    expect(html).toContain("اكتبها كما يجب أن تُنطق");
    expect(html).toContain("احفظ هذا النطق للقناة");
    expect(text(html)).toContain("أعد نطق الكلمة");
    expect(text(html)).toContain("ولّد الجملة كاملة بهذا النطق");
    expect(html).toContain("--ax:200px");
    // Not a page button: one filled button per screen stays the dock's
    expect(html).not.toContain("btn primary");
  });
  it("«المزيد»: two neighbours on each side; the sentence shows them and the hint says so", () => {
    const html = pop({ draft: { row: "r3", index: 4, say: "الْأَفْعَالَ", save: false, wide: true } });
    expect(html.match(/class="nb"/g)).toHaveLength(4);
    expect(html).toContain("أعدها مع كلمتين من كل جانب");
    expect(html).toMatch(/<details class="ms-pop-more" open="">/);
  });
  it("neighbours are clipped to the sentence; default one each side", () => {
    expect(fixNeighbours(9, 1, false)).toEqual([0, 2]);
    expect(fixNeighbours(9, 1, true)).toEqual([0, 2, 3]);
    expect(fixNeighbours(9, 0, false)).toEqual([1]);
    expect(fixNeighbours(1, 0, true)).toEqual([]);
    expect(neighbourHint(words.map((w) => w.word), 1, false)).toBe("تُعاد هذه الكلمة مع جارتيها «وَمَعَ» و«نَحْفَظُ» حتى يبقى الوصل طبيعيًا، وبقية الجملة كما هي.");
    expect(neighbourHint(["كلمة"], 0, false)).toBe("تُعاد هذه الكلمة وحدها، وبقية الجملة كما هي.");
  });
  it("on a phone it is a bottom sheet (no arrow position); without a voice key it says why and does not act", () => {
    expect(pop({ pos: { top: 0, left: 0, arrow: 0, sheet: true } })).toContain('class="ms-pop sv-fix is-sheet"');
    const html = pop({ noKey: true });
    expect(html).toContain("إعادة النطق تحتاج مفتاح الصوت");
    expect(html).toMatch(/<button type="button" class="ms-pop-go" disabled=""/);
  });
  it("the neighbour option is the server's own parameter, sent only when chosen", () => {
    const panel = src("app/src/workspace/SentencesPanel.tsx");
    expect(panel).toContain('action: "fixword", word: f.index, say: f.say, save: f.save, ...(f.wide ? { neighbours: 2 as const } : {})');
    expect(src("src/voice/sentenceVoice.ts")).toContain("neighbours?: 1 | 2;");
  });
  it("after the fix: «مُصحَّحة» and «نُطقت: X ← Y» with listen and undo; after a failure: why, and what to try", () => {
    const base = { index: 1, word: "السِّنِينَ", before: "السَّنِين", say: "السِّنِين", save: true };
    const ok = renderToStaticMarkup(<WordFixLine fixed={{ ...base, result: { ok: true, index: 1, word: "x", say: "y", reasons: [] } }} busy={null} noKey={false} canListen canUndo
      onListen={noop} onUndo={noop} onRetry={noop} onWhole={noop} />);
    expect(text(ok)).toContain("مُصحَّحة");
    expect(text(ok)).toContain("نُطقت:");
    expect(ok).toContain("<s>السَّنِين</s>");
    expect(text(ok)).toContain("استمع للجملة");
    expect(text(ok)).toContain("تراجع");
    expect(text(ok)).toContain("حُفظ النطق للقناة");
    const bad = renderToStaticMarkup(<WordFixLine fixed={{ ...base, result: { ok: false, index: 1, word: "x", say: "y", reasons: ["مدة الكلمة الجديدة ١٫٨× من القديمة"] } }} busy={null} noKey={false} canListen canUndo
      onListen={noop} onUndo={noop} onRetry={noop} onWhole={noop} />);
    expect(bad).toContain('role="alert"');
    expect(text(bad)).toContain("لم يندمج بشكل طبيعي — جرّب نطقًا آخر أو ولّد الجملة");
    expect(text(bad)).toContain("مدة الكلمة الجديدة");
    expect(text(bad)).toContain("جرّب نطقًا آخر");
    expect(text(bad)).toContain("ولّد الجملة");
  });
});

describe("numbers and fonts", () => {
  it("the zero is drawn a touch larger by a span, never by rewriting the page", () => {
    expect(zeroParts("٠:١٥")).toEqual([{ text: "٠", zero: true }, { text: ":١٥", zero: false }]);
    expect(renderToStaticMarkup(<Num>{"0 من 31"}</Num>)).toBe('<span class="num"><span class="z">٠</span> من ٣١</span>');
    for (const f of ["app/src/App.tsx", "app/src/main.tsx", "app/src/ui/format.ts"]) expect(src(f), f).not.toMatch(/createTreeWalker|fixZeros/);
  });
  it("the interface fonts are bundled (OFL), nothing from the network at run time", () => {
    for (const f of ["plex-ar-400.woff2", "plex-ar-500.woff2", "plex-ar-600.woff2", "naskh-ar.woff2", "OFL.txt"])
      expect(existsSync(path.join(__dirname, "../app/src/ui/fonts", f)), f).toBe(true);
    for (const f of ["app/index.html", "app/src/shell/shell.css", "app/src/styles.css"]) expect(src(f), f).not.toMatch(/fonts\.googleapis|fonts\.gstatic/);
  });
});

describe("the dock holds the one next action", () => {
  it("step ١: «اعتمد التجهيز» with «راجعته بنفسي» and the board note in the dock; the spine no longer draws its own track", () => {
    const spine = src("app/src/shell/EpisodeSpine.tsx");
    expect(spine).toContain('className="ms-dock"');
    expect(spine).toContain("راجعته بنفسي");
    expect(spine).not.toContain("spine-track");
    const css = src("app/src/shell/shell.css");
    expect(css).not.toMatch(/\.spine-track|\.tb-ch\b|\.tb-menu/);
  });
  it("step ٢: keyboard ←/→ between scenes, Enter approves only when allowed, Esc closes", () => {
    const panel = src("app/src/workspace/SceneProductionPanel.tsx");
    expect(panel).toContain('if (e.key === "ArrowLeft") { e.preventDefault(); go(1); }');
    expect(panel).toContain('else if (e.key === "Enter" && !t?.closest?.("button, a, summary") && isCurrent && reviewReady && !problem) { e.preventDefault(); approveNow(); }');
    expect(panel).toContain('if (e.key === "Escape")');
    // Enter goes through the same approve path as the button (confirmation first)
    expect(panel).toMatch(/const approveNow = \(\) => \{\s*if \(!reviewReady \|\| pending\) return;\s*if \(!reviewed\) \{ setProblem\(null\); setConfirming\(true\); return; \}\s*void reviewCurrent\("approve-scene"\);/);
  });
});
