import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EpisodeWorkspaceBar } from "../app/src/workspace/EpisodeWorkspaceBar";
import { VoiceWorkspaceTab } from "../app/src/workspace/VoiceWorkspaceTab";
import type { Plan } from "../src/plan/types";
import type { EpisodeMedia } from "../src/plan/media";
import type { CheckResult } from "../app/src/api";

const plan = (narration = "") => ({
  title: "حلقة اختبار",
  chapters: [{ number: 1, scenes: [{ id: "c1-s1", narration }] }],
}) as unknown as Plan;

const check = (error = false): CheckResult => ({
  ok: !error,
  issues: error ? [{ level: "error", code: "test", message: "خطأ في السكريبت", line: 7 }] : [],
  stats: { chapters: [], totalWords: 0, totalSeconds: 0 },
});

const render = (narration: string, error = false, researchDirty = false) => renderToStaticMarkup(
  <EpisodeWorkspaceBar
    episodeId="001"
    channelId="balislam"
    title="حلقة اختبار"
    stage="script"
    onStage={() => {}}
    check={check(error)}
    issues={[]}
    plan={plan(narration)}
    media={{ voice: {} } as EpisodeMedia}
    saveState="saved"
    scriptDirty={false}
    researchDirty={researchDirty}
  />,
);

describe("مرحلة الصوت", () => {
  it("تظهر حالة المقطع المفقود وتستخدم واجهة الصوت القائمة", () => {
    const html = renderToStaticMarkup(
      <VoiceWorkspaceTab
        channelId="balislam"
        episodeId="001"
        plan={plan("هذا تعليق لم يولّد بعد")}
        media={{ voice: {} } as EpisodeMedia}
        hasKeys={false}
        onMedia={() => {}}
        onOpenScene={() => {}}
      />,
    );
    expect(html).toContain("صوت الحلقة");
    expect(html).toContain("التعليق الصوتي");
    expect(html).toContain("تلاوة الآيات داخل الفيديو");
    expect(html).toContain("مكتبة القرّاء");
    // نموذج ترخيص الإنتاج يظهر فقط بعد اختيار فتح مكتبة القرّاء، وليس في الشاشة الأولية.
    expect(html).toContain("استعراض القرّاء لهذه الحلقة");
    expect(html).not.toContain("رابط HTTPS إلى وثيقة الإذن");
    expect(html).toContain("مساران مستقلان");
    expect(html).toContain("c1-s1");
    expect(html).toContain("بلا صوت");
  });
});

describe("مساحة عمل الحلقة", () => {
  it("تعرض المراحل الست دون إنشاء حالة اعتماد موازية", () => {
    const html = render("");
    for (const label of ["البحث", "السكريبت", "الستوري بورد", "الصوت", "المشاهد", "النشر"])
      expect(html).toContain(label);
    expect(html).not.toContain("ما الذي يحتاج انتباهك؟");
  });

  it("تحذر من التعديلات غير المحفوظة في ملف البحث", () => {
    const html = render("", false, true);
    expect(html).toContain("1 مهمة");
    expect(html).toContain("تعديلات غير محفوظة");
  });

  it("تعرض أخطاء السكريبت ونقص الصوت بدل إخفائهما", () => {
    const html = render("مقطع يحتاج إلى صوت", true);
    expect(html).toContain("2 ملاحظة");
    expect(html).toContain("ما الذي يحتاج انتباهك؟");
    expect(html).toContain('aria-expanded="false"');
  });
});
