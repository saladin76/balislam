import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EpisodeWorkspaceBar } from "../app/src/workspace/EpisodeWorkspaceBar";
import type { Plan } from "../src/plan/types";
import type { EpisodeMedia } from "../src/plan/media";
import type { CheckResult } from "../app/src/api";

const plan = (narration = "") => ({
  title: "حلقة اختبار",
  chapters: [{ scenes: [{ id: "c1-s1", narration }] }],
}) as unknown as Plan;

const check = (error = false): CheckResult => ({
  ok: !error,
  issues: error ? [{ level: "error", code: "test", message: "خطأ في السكريبت", line: 7 }] : [],
  stats: { chapters: [], totalWords: 0, totalSeconds: 0 },
});

const render = (narration: string, error = false) => renderToStaticMarkup(
  <EpisodeWorkspaceBar
    episodeId="001"
    title="حلقة اختبار"
    stage="script"
    onStage={() => {}}
    check={check(error)}
    issues={[]}
    plan={plan(narration)}
    media={{ voice: {} } as EpisodeMedia}
    saveState="saved"
    scriptDirty={false}
  />,
);

describe("مساحة عمل الحلقة", () => {
  it("تعرض المراحل الست دون إنشاء حالة اعتماد موازية", () => {
    const html = render("");
    for (const label of ["البحث", "السكريبت", "الستوري بورد", "الصوت", "المشاهد", "النشر"])
      expect(html).toContain(label);
    expect(html).toContain("لا توجد ملاحظات");
  });

  it("تعرض أخطاء السكريبت ونقص الصوت بدل إخفائهما", () => {
    const html = render("مقطع يحتاج إلى صوت", true);
    expect(html).toContain("خطأ في السكريبت");
    expect(html).toContain("مشهدًا بلا صوت مطابق");
    expect(html).toContain("فتح");
  });
});
