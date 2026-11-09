/**
 * Funnel v3 (D40), the owner's view: four steps — التجهيز، المشاهد، النسخة النهائية، النشر.
 * Step ١ is prepared by the system and approved with ONE button; step ٢ shows each scene ready and «اعتمد» comes first.
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { STEPS, stepOf, stepsDone } from "../app/src/shell/EpisodeSpine";
import { fourSteps, nextLine } from "../app/src/tabs/HomeTab";
import { parseStudioHash, studioHash } from "../app/src/shell/route";
import { SceneDecisionActions } from "../app/src/workspace/SceneProductionPanel";
import type { Overview } from "../app/src/api";

const src = (f: string) => readFileSync(path.join(__dirname, "..", f), "utf8");
const noop = () => {};

const overview = (production: Partial<NonNullable<Overview["production"]>>, published = false) => ({
  check: { ok: true, errors: 0, seconds: 300 },
  status: published ? { published: { date: "2026-11-09" } } : {},
  production: { script: false, storyboard: false, approvedScenes: 0, totalScenes: 114, canAssemble: false,
    assemblyApproved: false, masterApproved: false, publishAllowed: false, ...production },
}) as unknown as Overview;

describe("أربع خطوات", () => {
  it("the spine has four stations; step ١ owns storyboard, script and research; step ٢ the scenes", () => {
    expect(STEPS.map((s) => s.title)).toEqual(["التجهيز", "المشاهد", "النسخة النهائية", "النشر"]);
    expect(STEPS.map((s) => s.n)).toEqual(["١", "٢", "٣", "٤"]);
    expect(STEPS[0]!.tabs).toEqual(["storyboard", "script", "research"]);
    expect(stepOf("storyboard")).toBe(0);
    expect(stepOf("script")).toBe(0);
    expect(stepOf("episode")).toBe(1);
    expect(stepOf("voice")).toBe(1);
    expect(stepOf("review")).toBe(2);
    expect(stepOf("publish")).toBe(3);
  });

  it("step ١ is done only when BOTH ledger records exist", () => {
    const read = (script: boolean, storyboard: boolean) => ({ script: { approved: script, sha256: "" }, storyboard: { approved: storyboard, sha256: "" },
      progress: { canAssemble: false, masterApproved: false, publishAllowed: false } }) as never;
    expect(stepsDone(read(true, false))).toEqual([false, false, false, false]);
    expect(stepsDone(read(true, true))).toEqual([true, false, false, false]);
  });

  it("the episode list shows four dots and the next line in the same four steps", () => {
    expect(fourSteps(overview({})).map((s) => [s.title, s.done, s.tab])).toEqual([
      ["التجهيز", false, "storyboard"], ["المشاهد", false, "episode"], ["النسخة النهائية", false, "review"], ["النشر", false, "publish"]]);
    expect(fourSteps(overview({ script: true })).map((s) => s.done)).toEqual([false, false, false, false]);
    expect(fourSteps(overview({ script: true, storyboard: true, canAssemble: true, masterApproved: true, publishAllowed: true }, true)).every((s) => s.done)).toBe(true);
    expect(nextLine(overview({ script: true }))).toEqual({ text: "راجع التجهيز (الستوري بورد والسكريبت) واعتمده", tab: "storyboard" });
    expect(nextLine(overview({ script: true, storyboard: true, approvedScenes: 11 }))).toEqual({ text: "المشهد ١٢ من ١١٤ ينتظر قرارك", tab: "episode" });
  });

  it("links keep working: each old tab link lands in its new step", () => {
    for (const tab of ["script", "research", "storyboard", "episode", "voice", "review", "publish"] as const) {
      const r = parseStudioHash(`#/balislam/001/${tab}`);
      expect(r).toEqual({ channel: "balislam", episode: "001", tab });
      expect(stepOf(tab)).toBeGreaterThanOrEqual(0);
      expect(studioHash(r)).toBe(`#/balislam/001/${tab}`);
    }
  });

  it("no Arabic copy still speaks of five steps or step ٥", () => {
    for (const f of ["app/src/shell/EpisodeSpine.tsx", "app/src/tabs/HomeTab.tsx", "app/src/workspace/SceneProductionPanel.tsx",
      "app/src/workspace/PrepareAll.tsx", "app/src/workspace/PreFinal.tsx", "app/src/tabs/PublishTab.tsx", "app/src/api.ts", "src/studio/sceneService.ts"]) {
      const text = src(f);
      expect(text, f).not.toMatch(/الخطوات الخمس|خمس خطوات|خمس محطات|الخطوة ٥|الخطوتين ١ و٢/);
    }
  });
});

describe("الخطوة ١: زر واحد «اعتمد التجهيز»", () => {
  it("the spine sends ONE request with both fingerprints, «راجعته بنفسي» and the board note, then opens step ٢", () => {
    const spine = src("app/src/shell/EpisodeSpine.tsx");
    expect(spine).toContain("api.approvePreparation(episodeId, channelId, secret, {");
    expect(spine).toContain("scriptSha256: w.script.sha256, storyboardSha256: w.storyboard.sha256, reviewed,");
    // D52: never a disabled primary; the button asks for what is missing, then the passphrase next to itself.
    expect(spine).toContain("const secret = owner.open ? owner.secret : await owner.ensure(approveBtn.current);");
    expect(spine).not.toMatch(/disabled=\{!owner\.open/);
    expect(spine).toContain('onTab("episode")');
    expect(spine).not.toMatch(/approve-script"|approve-storyboard"/);
    // The server path keeps both ledger decisions, each through decideSceneProduction (no new bypass).
    const prep = src("src/studio/preparation.ts");
    expect(prep.indexOf('action: "approve-script"')).toBeLessThan(prep.indexOf("recordBoards(scriptPath"));
    expect(prep.indexOf("recordBoards(scriptPath")).toBeLessThan(prep.indexOf('action: "approve-storyboard"'));
    expect(prep).toContain("assertSceneOwner(sessionToken)");
    expect(prep).toContain('if (command.reviewed !== true)');
    expect(prep).toContain("checkVisualStoryboardSignoff(plan, command.note)");
  });
});

describe("الخطوة ٢: «اعتمد» أولًا", () => {
  it("approve first (right side in RTL), then the fixes; one filled button", () => {
    const html = renderToStaticMarkup(<SceneDecisionActions stage="review" voice="ok" voiceBusy={false} canVoice readyForAv ownerOpen pending={false}
      problem={null} problemText="" tone="" confirming={false} reviewed={false}
      onVoice={noop} onProblem={noop} onProblemText={noop} onTone={noop} onCancelProblem={noop} onSubmitProblem={noop} onConfirm={noop} onApprove={noop} onRender={noop} />);
    const labels = [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);
    expect(labels).toEqual(["اعتمد", "الحركة غير مناسبة", "النبرة غير مناسبة", "أعد توليد الصوت"]);
    expect(html.match(/btn primary/g)).toHaveLength(1);
  });

  it("the silent-preview tag sits under the frame, never over the burned-in captions", () => {
    const panel = src("app/src/workspace/SceneProductionPanel.tsx");
    expect(panel).toMatch(/<div className="s3-live">\{livePreview\(shownId\)\}<\/div>\s*<figcaption className="s3-tag">/);
    const css = src("app/src/shell/screens-s3.css");
    const tag = css.slice(css.indexOf(".shell-v3 .s3-tag"), css.indexOf("}", css.indexOf(".shell-v3 .s3-tag")));
    expect(tag).not.toMatch(/position:\s*absolute/);
  });
});
