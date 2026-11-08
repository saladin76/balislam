import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SceneReviewWorkspace } from "./SceneReviewWorkspace";
import type { SceneSeed } from "./model";

const fixture: SceneSeed[] = [{
  id: "c1-s1", ordinal: 1, chapter: "الفصل الأول", title: "المقدمة",
  narration: "نص عربي", storyboard: "لوحة", artDirection: "هادئ",
  camera: "Static", transition: "Cut", timing: "صوت وصورة",
  durationSec: 8, elements: ["title"],
}];

describe("SceneReviewWorkspace SSR component smoke", () => {
  it("renders accessible RTL loading state without claiming an approval", () => {
    const html = renderToStaticMarkup(<SceneReviewWorkspace
      channelId="balislam" episodeId="001-qa" episodeTitle="حلقة اختبار"
      seeds={fixture} />);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("مراجعة المشهد بالصوت والصورة");
    expect(html).toContain("جارٍ تحميل المشاهد");
    expect(html).not.toContain('"approved":true');
    expect(html).not.toContain("تم اعتماد المشهد");
  });
  it("always labels the isolated QA mode as non-production", () => {
    const html = renderToStaticMarkup(<SceneReviewWorkspace
      channelId="balislam" episodeId="001-qa" episodeTitle="حلقة اختبار"
      seeds={fixture} initialMode="demo" />);
    expect(html).toContain("بيانات اختبارية — لا اعتماد حقيقي");
  });
});
