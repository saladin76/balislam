import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import balislam from "../channels/balislam/channel.json";
import dafatir from "../channels/dafatir-alzaman/channel.json";
import zubdat from "../channels/zubdat-alkutub/channel.json";
import { channelProductionIssues, channelProductionProfile, documentProvenanceCheck, sacredFigureCheck } from "../src/channel/productionRules";
import { planIssues } from "../src/plan/validate";
import type { Plan, PlanScene } from "../src/plan/types";

const configs = [balislam, dafatir, zubdat];
const scene = (props: Partial<PlanScene> = {}): PlanScene => ({
  id: "c1-s1", template: "kinetic-text", narration: "مثال قصير",
  line: 1, props: {}, sfx: [], ...props,
});
const plan = (content: PlanScene, id = "balislam"): Plan => ({
  version: 1, episode: "950", title: "اختبار القواعد",
  domain: "psychology", themeId: "paper", updatedAt: "2026-11-08T00:00:00Z",
  channel: id, chapters: [{ number: 1, title: "المقدمة", scenes: [content] }],
});

describe("Studio: distinct rules for its three existing channels", () => {
  it("keeps per-channel human review available but collapsible in the existing scene UI", () => {
    const panel = readFileSync(path.join(__dirname, "../app/src/workspace/SceneProductionPanel.tsx"), "utf8");
    expect(panel).toContain("channelProductionProfile({ id: channelId })");
    expect(panel).toContain("معايير مراجعة هذه القناة");
    expect(panel).toContain("<details");
  });

  it("never retains a default online Quran reciter in any current channel", () => {
    for (const c of configs) {
      expect("recitation" in c).toBe(false);
      expect(c.rules.quran).toBe(true); // May cite verses, not generate recitation.
    }
  });

  it("reads profiles from the requested channel without mutating identities or settings", () => {
    for (const c of configs) {
      const before = JSON.stringify(c);
      const result = channelProductionProfile(c);
      expect(result.channelId).toBe(c.id);
      expect(result.reviewFocus.length).toBeGreaterThanOrEqual(3);
      expect(result.sourceChecks.length).toBeGreaterThan(0);
      expect(JSON.stringify(c)).toBe(before);
    }
    expect(channelProductionProfile(balislam).visualDirection).toContain("بلا وجوه");
    expect(channelProductionProfile(dafatir).visualDirection).toContain("تاريخية");
    expect(channelProductionProfile(zubdat).sourceChecks).toContain("بطاقة الكتاب وصفحاته");
  });

  it("honors the actual permissions rather than silently copying restrictions to unrelated channels", () => {
    const withVerse = plan(scene({
      template: "verse-card", ayahKey: "53:39", props: { text: "نص اختباري", reference: "النجم 39" },
    }));
    expect(channelProductionIssues(withVerse, balislam)).toEqual([]);
    const noQuran = { id: "new-channel", rules: { quran: false, hadith: true, music: true } };
    expect(channelProductionIssues(withVerse, noQuran).map(x => x.code)).toEqual(["quran-forbidden"]);
    expect(channelProductionIssues(plan(scene({ template: "hadith-card" })), {
      id: "other", rules: { hadith: false },
    }).map(x => x.code)).toEqual(["hadith-forbidden"]);
    expect(channelProductionIssues(withVerse, undefined)).toEqual([]);
  });

  it("blocks an explicitly music-labeled sound track only in channels that forbid music", () => {
    const p = plan(scene({ sfx: [{ id: "background-music", at: 0 }] }));
    for (const c of configs) {
      expect(channelProductionIssues(p, c).map(x => x.code)).toContain("music-forbidden");
    }
    expect(channelProductionIssues(p, { id: "music-allowed", rules: { music: true } })).toEqual([]);
    expect(channelProductionIssues(p, { id: "incomplete", rules: {} })).toEqual([]);
    expect(channelProductionIssues(p, balislam).some(x => x.level === "error")).toBe(true);
  });

  it("flags missing historical documentary provenance as a human-review warning, not fabricated proof", () => {
    const p = plan(scene({ template: "doc-plate", props: { image: "archive.jpg" } }), dafatir.id);
    const flagged = channelProductionIssues(p, dafatir);
    expect(flagged).toEqual([expect.objectContaining({
      code: "document-provenance", level: "warning",
    })]);
    expect(channelProductionIssues(p, balislam)).toEqual([]);
    expect(channelProductionIssues(p, zubdat)).toEqual([]);
    expect(channelProductionIssues(plan(scene({
      template: "doc-plate", props: { image: "archive.jpg", credit: "مكتبة موثقة" },
    }), dafatir.id), dafatir)).toEqual([]);
  });

  it("refuses explicit sacred-figure rendering in the history channel but not a textual discussion", () => {
    const picture = plan(scene({
      template: "doc-plate", props: { figure: "الرسول ﷺ", credit: "مثال" },
    }), dafatir.id);
    expect(channelProductionIssues(picture, dafatir).map(x => x.code)).toContain("sacred-figure-visual");
    const voiceOnly = plan(scene({ narration: "قصة من سيرة الرسول", props: {} }), dafatir.id);
    expect(channelProductionIssues(voiceOnly, dafatir)).toEqual([]);
  });

  it("makes new channel policy errors visible to the existing render QA pipeline", () => {
    const p = plan(scene({ sfx: [{ id: "bgm-intro", at: 0 }] }), balislam.id);
    const issues = planIssues(p, {
      id: balislam.id,
      rules: {
        music: balislam.rules.music, faces: balislam.rules.faces,
        quran: balislam.rules.quran, hadith: balislam.rules.hadith,
      },
    });
    expect(issues.some(i => i.level === "error" && i.message.includes("الموسيقى"))).toBe(true);
    expect(channelProductionIssues(p, { id: "unknown" })).toEqual([]);
  });

  it("derives provenance and sacred-figure checks from channel.json policy, not the channel id", () => {
    // the three channels: provenance only where opted in; sacred figures wherever faces are allowed
    expect(configs.map(c => documentProvenanceCheck(c))).toEqual([false, true, false]);
    expect(configs.map(c => sacredFigureCheck(c))).toEqual([false, true, true]);
    const picture = (id: string) => plan(scene({ template: "doc-plate", props: { figure: "النبي", image: "a.jpg" } }), id);
    // a renamed or new channel that allows faces gets the sacred-figure error without being called dafatir
    const faces = { id: "history-tr", rules: { faces: true } };
    expect(channelProductionIssues(picture(faces.id), faces).map(x => x.code)).toEqual(["sacred-figure-visual"]);
    expect(channelProductionIssues(picture("x"), { id: "x" }).map(x => x.code)).toEqual(["sacred-figure-visual"]);
    expect(channelProductionIssues(picture("x"), { id: "x", rules: { faces: false } })).toEqual([]);
    expect(channelProductionIssues(picture("x"), { id: "x", rules: { faces: true, sacredFigures: false } })).toEqual([]);
    const opted = { id: "docs", rules: { faces: false, documentProvenance: true } };
    expect(channelProductionIssues(picture(opted.id), opted).map(x => x.code)).toEqual(["document-provenance"]);
    // the id alone grants nothing: dafatir without its policy fields behaves like any faces channel
    const bare = { id: "dafatir-alzaman", rules: { faces: true } };
    expect(channelProductionIssues(picture(bare.id), bare).map(x => x.code)).toEqual(["sacred-figure-visual"]);
  });
});
