/**
 * UX review, 9 Nov (D52): the board viewer stays in step ١, one LockedStep, one numeral system and no
 * technical text on the main screens, one episode length, the approve path acts directly (no passphrase since 9 Nov).
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { arDigits, duration, num, sceneName, TECHNICAL_TEXT, verseRef } from "../app/src/ui/format";
import { LOCK_COPY, LockedStep, lockedStep, nextAction } from "../app/src/shell/LockedStep";
import { BoardViewer, type BoardShot } from "../app/src/tabs/BoardViewer";
import { ChannelsWorkspace } from "../app/src/tabs/ChannelsWorkspace";
import { IntegratedReviewWorkspace } from "../app/src/workspace/IntegratedReviewWorkspace";
import { episodeLength } from "../src/plan/episodeLength";
import type { PlanScene } from "../src/plan/types";

const src = (f: string) => readFileSync(path.join(__dirname, "..", f), "utf8");
const noop = () => {};
/** Visible text only: tags (and their attributes such as title="c1-s3") removed. */
const text = (html: string) => html.replace(/<[^>]*>/g, " ");
const ledger = (prep: boolean, scenes = false, master = false) => ({
  script: { approved: prep, sha256: "" }, storyboard: { approved: prep, sha256: "" },
  progress: { canAssemble: scenes, masterApproved: master, publishAllowed: false },
}) as never;

describe("formatter: one numeral system", () => {
  it("formats numbers, clocks, scenes and verses the way the owner reads them", () => {
    expect(arDigits("12:05")).toBe("١٢:٠٥");
    expect(num(1200)).toBe("١٬٢٠٠");
    expect(num(4.5, 1)).toBe((4.5).toLocaleString("ar-EG", { minimumFractionDigits: 1 }));
    expect(duration(708)).toBe("١١:٤٨");
    expect(duration(3725)).toBe("١:٠٢:٠٥");
    expect(sceneName(["c1-s1", "c1-s2", "c1-s3"], "c1-s3")).toBe("المشهد ٣");
    expect(verseRef("2:42")).toBe("البقرة ٤٢");
    expect(verseRef("75:14-15")).toBe("القيامة ١٤–١٥");
    expect(verseRef("114:1")).toBe("الناس ١");
    expect(verseRef("النجم 39")).toBe("النجم ٣٩");
  });
});

describe("step ١: the board viewer", () => {
  const scene = (id: string, line: number, narration: string): PlanScene => ({ id, template: "big-question", narration, line, props: {}, sfx: [] });
  const shots: BoardShot[] = [
    { s: scene("c1-s1", 3, "الأول"), chapter: { number: 1, title: "البداية" }, from: 0, d: 120 },
    { s: { ...scene("c1-s2", 5, ""), template: "verse-card", ayahKey: "2:42" }, chapter: { number: 1, title: "البداية" }, from: 120, d: 150 },
  ];
  const viewer = (index: number) => renderToStaticMarkup(
    <BoardViewer shots={shots} index={index} order={shots.map((x) => x.s.id)} fps={30}
      citations={[{ key: "a", kind: "ayah", label: "آية", ref: "2:42", detail: "", line: 5, hash: "", status: "pending" }]}
      lineEnd={(i) => shots[i + 1]?.s.line ?? 1e9} onIndex={noop} onClose={noop} onEdit={noop}
      frame={() => <div className="frame" />} onScreen={() => ""} elements={() => []} />);

  it("shows the image, the text, the citation and prev/next, with «تحرير المشهد» secondary", () => {
    const html = viewer(1);
    expect(html).toContain('role="dialog"');
    expect(html).toContain("المشهد ٢");
    expect(html).toContain("البقرة ٤٢");
    expect(html).toContain("بانتظار التوثيق");
    expect(html).toContain("→ السابق");
    expect(html).toContain("التالي ←");
    expect(html).toMatch(/class="btn ghost"[^>]*>تحرير المشهد</);
    expect(html).not.toContain("btn primary");
    for (const re of TECHNICAL_TEXT) expect(text(html)).not.toMatch(re);
  });

  it("no navigation to step ٢ from the storyboard before the preparation is approved", () => {
    const board = src("app/src/tabs/StoryboardPanel.tsx");
    // 11 Nov: the only way to step ٢ is the «تغيّر بعد التجهيز» list, which exists only after «اعتمد التجهيز».
    expect(board.match(/onOpenScene/g)?.length).toBe(5);
    expect(board).toContain("(afterPreparation?.length || afterPreparationScriptOnly) && onOpenScene ? <AfterPreparationList");
    expect(board).toContain("setViewing(indexOf.get(s.id) ?? 0)");
    const app = src("app/src/App.tsx");
    const branch = app.slice(app.indexOf('tab === "storyboard" ? ('), app.indexOf('tab === "voice" ? ('));
    expect(branch).toContain("onEditScene=");
    expect(branch.match(/setTab\("episode"\)/g)?.length).toBe(1);
    expect(branch).toContain('onOpenScene={(id) => { setViewSceneId(id); setTab("episode"); }}');
    expect(branch).toContain('setTab("script")');
    // And step ٢ itself is a LockedStep until «اعتمد التجهيز».
    expect(lockedStep("episode", ledger(false))).toBe(1);
    expect(lockedStep("episode", ledger(true))).toBeNull();
  });
});

describe("one LockedStep", () => {
  it("locks ٢ and ٣ before the preparation, ٤ before the final file; one button to the real next action", () => {
    expect(lockedStep("review", ledger(false))).toBe(2);
    expect(lockedStep("review", ledger(true))).toBeNull();
    expect(lockedStep("publish", ledger(true, true))).toBe(3);
    expect(lockedStep("publish", ledger(true, true, true))).toBeNull();
    expect(lockedStep("storyboard", ledger(false))).toBeNull();
    expect(nextAction(ledger(false))).toEqual({ label: "إلى التجهيز", tab: "storyboard" });
    expect(nextAction(ledger(true, true))).toEqual({ label: "إلى النسخة النهائية", tab: "review" });
  });

  it("renders title, reason, what unlocks it, ONE button, «يمكنك الآن» only when given, and never a player", () => {
    for (const n of [1, 2, 3] as const) {
      const html = renderToStaticMarkup(<LockedStep step={n} {...LOCK_COPY[n]} action={{ label: "إلى التجهيز", onClick: noop }}
        now={n === 2 ? <p>التلاوات</p> : undefined} />);
      expect(html.match(/<button/g)).toHaveLength(1);
      expect(html).toContain(LOCK_COPY[n].reason);
      expect(html).toContain("يُفتح حين:");
      expect(html).not.toContain("<video");
      expect(html).not.toContain("disabled");
      expect(html.includes("يمكنك الآن")).toBe(n === 2);
    }
    // Things allowed early are listed explicitly: the recitations under step ٣ (D35).
    const app = src("app/src/App.tsx");
    expect(app).toContain("recitationsOnly");
  });
});

describe("no technical text on the main screens", () => {
  it("rendered screens carry no scene ids, «Master» or absolute paths", () => {
    const chans = [{ id: "balislam", name: "بالإسلام", language: "ar", domains: {} }, { id: "zubdat-alkutub", name: "زبدة الكتب", language: "ar", domains: {} }];
    const screens = [
      renderToStaticMarkup(<ChannelsWorkspace channels={chans} activeId="balislam" onOpen={noop} />),
      renderToStaticMarkup(<IntegratedReviewWorkspace episodeId="001" onOpen={noop} />),
      ...([1, 2, 3] as const).map((n) => renderToStaticMarkup(<LockedStep step={n} {...LOCK_COPY[n]} action={{ label: "x", onClick: noop }} />)),
    ];
    for (const html of screens) {
      for (const re of TECHNICAL_TEXT) expect(text(html)).not.toMatch(re);
      expect(text(html)).not.toMatch(/\bar\b ·/);
    }
    // Each channel card wears its own channel.
    expect(screens[0]).toContain('data-channel="zubdat-alkutub"');
  });

  it("the main screens' visible copy never says «Master» nor shows a scene id or an absolute path", () => {
    const files = ["app/src/shell/EpisodeSpine.tsx", "app/src/shell/LockedStep.tsx", "app/src/tabs/HomeTab.tsx", "app/src/tabs/StoryboardPanel.tsx",
      "app/src/tabs/BoardViewer.tsx", "app/src/workspace/PreFinal.tsx", "app/src/workspace/RecitationItem.tsx", "app/src/workspace/MakeMaster.tsx",
      "app/src/workspace/IntegratedReviewWorkspace.tsx", "app/src/tabs/PublishTab.tsx", "app/src/tabs/OpsRoom.tsx", "app/src/tabs/ChannelsWorkspace.tsx"];
    for (const f of files) {
      const code = src(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
      // Arabic copy: string literals and JSX text that contain Arabic letters.
      const copy = [...code.matchAll(/["'`>]([^"'`<>{}]*[؀-ۿ][^"'`<>{}]*)["'`<{]/g)].map((m) => m[1]!);
      for (const c of copy) for (const re of TECHNICAL_TEXT) expect(c, `${f}: ${c}`).not.toMatch(re);
    }
  });
});

describe("one episode length", () => {
  it("is the plan's own duration, «voice» only when every narrated scene has its current clip", () => {
    const plan = { chapters: [{ number: 1, title: "", scenes: [
      { id: "c1-s1", template: "big-question", narration: "سؤال قصير", line: 1, props: { question: "سؤال قصير" }, sfx: [] },
    ] }] } as never;
    const before = episodeLength(plan, { voice: {}, recitations: {} });
    expect(before.source).toBe("plan");
    expect(before.seconds).toBeGreaterThan(0);
    const after = episodeLength(plan, { voice: { "c1-s1": { file: "a.mp3", text: "سؤال قصير", duration: 9 } as never }, recitations: {} });
    expect(after.source).toBe("voice");
    expect(after.seconds).toBeGreaterThanOrEqual(9);
    // The home list and the storyboard both read it; the words estimate stays in the script panel.
    expect(src("app/server/extra.ts")).toContain("length: plan ? episodeLength(plan,");
    expect(src("app/src/tabs/HomeTab.tsx")).not.toContain("check.seconds");
    expect(src("app/src/tabs/StoryboardPanel.tsx")).toContain("episodeLength(plan, media, fps)");
  });
});

describe("approve path and dialogs", () => {
  it("owner buttons act directly: no passphrase popover, no session, no «افتح جلسة المالك» (owner decision 9 Nov)", () => {
    expect(() => src("app/src/shell/ownerSession.tsx")).toThrow();
    for (const f of ["app/src/shell/EpisodeSpine.tsx", "app/src/shell/TopBar.tsx", "app/src/App.tsx", "app/src/tabs/DriveHandoff.tsx",
      "app/src/workspace/PreFinal.tsx", "app/src/workspace/RecitationItem.tsx", "app/src/workspace/PrepareAll.tsx",
      "app/src/workspace/SentencesPanel.tsx", "app/src/workspace/SceneProductionPanel.tsx"]) {
      const code = src(f);
      expect(code, f).not.toMatch(/useOwnerSession|OwnerSession|owner\.ensure\(|type="password"/);
      expect(code, f).not.toMatch(/افتح جلسة المالك|افتح الجلسة|جلسة المالك|كلمة مرور المالك/);
    }
  });

  it("«حلقة جديدة» and the delete confirmation are real dialogs; delete lives in «⋯»", () => {
    expect(src("app/src/App.tsx")).toContain('<Dialog as="form" labelledBy="new-episode-title"');
    const dialog = src("app/src/ui/useDialog.ts");
    expect(dialog).toContain('e.key === "Escape"');
    expect(dialog).toContain('e.key !== "Tab"');
    const home = src("app/src/tabs/HomeTab.tsx");
    expect(home).toContain('aria-haspopup="menu"');
    expect(home).toContain("حذف الحلقة…");
    expect(home).not.toContain('className="ledger-del"');
  });

  it("the keys page has one heading and every pointer to it uses its real name", () => {
    expect(src("app/src/tabs/SettingsTab.tsx")).not.toContain("<h2>الإعدادات والمفاتيح</h2>");
    for (const f of ["app/src/tabs/EpisodeTab.tsx", "app/src/tabs/PublishTab.tsx", "app/src/workspace/MakeMaster.tsx", "app/src/tabs/ChannelBrand.tsx"])
      expect(src(f), f).not.toMatch(/«الإعدادات»|تبويب الإعدادات/);
  });

  it("type scale: tokens exist and the studio CSS declares nothing under 12px", () => {
    const shell = src("app/src/shell/shell.css");
    expect(shell).toContain("--t-12: 12px; --t-14: 14px; --t-16: 16px; --t-20: 20px; --t-24: 24px; --t-32: 32px;");
    expect(shell).toContain('--f-num: "IBM Plex Sans Arabic"');
    for (const f of ["app/src/styles.css", "app/src/studio-shell.css", "app/src/shell/shell.css", "app/src/shell/screens-s12.css", "app/src/shell/screens-s3.css", "app/src/workspace/workspace.css"])
      expect(src(f), f).not.toMatch(/font-size:\s?(?:[0-9]|1[01])(?:\.[0-9]+)?px/);
  });
});
