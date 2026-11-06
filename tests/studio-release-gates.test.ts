import { describe, expect, it } from "vitest";
import { assessReleaseEvidence, type ReleaseEvidenceInput } from "../app/server/releaseEvidence";
import { statusTransitionError } from "../app/server/releaseStatusTransition";
import { stagesOf } from "../app/src/tabs/HomeTab";
import { stageOf } from "../app/src/tabs/OpsRoom";
import type { Overview } from "../app/src/api";

const valid = (): ReleaseEvidenceInput => ({
  scriptOk: true,
  planSceneCount: 2,
  planErrors: 0,
  storyboard: { done: 2, total: 2 },
  sceneReview: { done: 2, total: 2 },
  sources: { done: 3, total: 3 },
  voice: { done: 2, total: 2 },
  missingVerseText: 0,
  master: { exists: true, quality: "master", voiced: true },
  planStale: false,
  ownerApprovalMatches: true,
  packageFiles: { youtube: true, social: true, checklist: true, srt: true, thumbnail: true },
  humanChecks: { watched: true, review: true, pronunciation: true },
});
const overview = (input: ReleaseEvidenceInput): Overview => ({
  id: "001", dir: "001-test", title: "اختبار", domain: "history", lang: "ar",
  check: { ok: input.scriptOk, errors: input.scriptOk ? 0 : 1, warnings: 0, seconds: 90 },
  scenes: input.planSceneCount,
  voice: input.voice,
  blocking: input.planErrors,
  package: { video: input.master.exists, shorts: 0, thumbnails: 1, updatedAt: 10 },
  planUpdatedAt: 9,
  style: "documentary", status: {},
  release: assessReleaseEvidence(input),
});

describe("Studio publication evidence must fail closed", () => {
  it("requires every gate and owner checklist; cannot declare readiness from video alone", () => {
    const result = assessReleaseEvidence(valid());
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(stageOf(overview(valid()))).toBe("ready");
  });
  it("rejects a silent preview even when a physical MP4 exists", () => {
    const i = valid();
    i.master.quality = "preview";
    i.master.voiced = false;
    expect(assessReleaseEvidence(i).ready).toBe(false);
    expect(stageOf(overview(i))).toBe("video");
    expect(stagesOf(overview(i))[3]?.state).toBe("warn");
  });
  it("rejects unreviewed storyboard and one scene marked stale", () => {
    const i = valid();
    i.storyboard.done = 0;
    i.sceneReview.done = 1;
    expect(stageOf(overview(i))).toBe("scenes");
    expect(assessReleaseEvidence(i).blockers).toEqual(expect.arrayContaining([
      expect.stringContaining("الستوري بورد"), expect.stringContaining("مراجعة المشاهد"),
    ]));
  });
  it("does not accept a source reviewed under an obsolete fingerprint", () => {
    const i = valid();
    i.sources.done = 2;
    expect(assessReleaseEvidence(i).ready).toBe(false);
    expect(stageOf(overview(i))).toBe("review");
  });
  it("blocks missing voice, verse text, invalidated owner approval and stale plan", () => {
    const i = valid();
    i.voice.done = 1;
    i.missingVerseText = 1;
    i.ownerApprovalMatches = false;
    i.planStale = true;
    const r = assessReleaseEvidence(i);
    expect(r.ready).toBe(false);
    expect(r.blockers.join(" ")).toContain("بطاقات آيات");
    expect(r.blockers.join(" ")).toContain("الصوت المطابق");
    expect(r.blockers.join(" ")).toContain("اعتماد المالك");
    expect(r.blockers.join(" ")).toContain("أقدم");
  });
  it("a Master cannot bypass missing metadata, SRT, thumbnails or human playback review", () => {
    const i = valid();
    i.packageFiles.youtube = false;
    i.packageFiles.srt = false;
    i.packageFiles.thumbnail = false;
    i.humanChecks.watched = false;
    i.humanChecks.pronunciation = false;
    const r = assessReleaseEvidence(i);
    expect(r.ready).toBe(false);
    expect(r.blockers.join(" ")).toContain("حزمة النشر");
    expect(r.blockers.join(" ")).toContain("مشاهدة");
    expect(r.blockers.join(" ")).toContain("النطق");
  });
  it("zero scenes never means all storyboard checks passed", () => {
    const i = valid();
    i.planSceneCount = 0;
    i.storyboard = { done: 0, total: 0 };
    i.sceneReview = { done: 0, total: 0 };
    expect(assessReleaseEvidence(i).ready).toBe(false);
  });
  it("legacy overview without evidence never becomes ready", () => {
    const e = overview(valid());
    delete e.release;
    expect(stageOf(e)).not.toBe("ready");
    expect(stagesOf(e)[3]?.state).toBe("warn");
  });
  it("previously published status stays published without falsely reapproving newer files", () => {
    const i = valid();
    i.ownerApprovalMatches = false;
    const e = overview(i);
    e.status.published = { date: "2026-11-05" };
    expect(stageOf(e)).toBe("published");
    expect(e.release?.ready).toBe(false);
  });
});

describe("Studio localhost status transitions cannot bypass release gates", () => {
  const video = { size: 100_000_000, mtime: 1720000000000 };
  const approval = { at: "2026-11-06T00:00:00.000Z", ...video };
  it("only accepts new owner approval after all non-owner gates and exact file stats match", () => {
    const current = valid();
    current.ownerApprovalMatches = false;
    const evidence = assessReleaseEvidence(current);
    expect(statusTransitionError({}, { approved: approval }, evidence, video)).toBe(null);
    expect(statusTransitionError({}, { approved: { ...approval, size: 2 } }, evidence, video)).toContain("لا يطابق");
    current.storyboard.done = 0;
    expect(statusTransitionError({}, { approved: approval }, assessReleaseEvidence(current), video)).toContain("موانع");
  });
  it("requires prior complete release evidence to record a published URL", () => {
    const next = { published: { date: "2026-11-08", url: "https://example.org/watch" } };
    const noApproval = valid();
    noApproval.ownerApprovalMatches = false;
    expect(statusTransitionError({}, next, assessReleaseEvidence(noApproval), video)).toContain("لا يمكن تسجيل النشر");
    expect(statusTransitionError({}, next, assessReleaseEvidence(valid()), video)).toBe(null);
    expect(statusTransitionError({}, { published: { date: "wrong" } }, assessReleaseEvidence(valid()), video)).toContain("تاريخ");
    expect(statusTransitionError({}, { published: { date: "2026-11-08", url: "http://example.org" } }, assessReleaseEvidence(valid()), video)).toContain("https");
  });
  it("still allows removal of old approval and publication markers without edits to source media", () => {
    const previous = { approved: approval, published: { date: "2026-11-05" } };
    expect(statusTransitionError(previous, {}, null, null)).toBe(null);
    expect(statusTransitionError(previous, previous, null, null)).toBe(null);
  });
});
