import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StudioSidebar, SECTION_TITLES } from "../app/src/ui/StudioSidebar";

const render = (options: Partial<React.ComponentProps<typeof StudioSidebar>> = {}) => renderToStaticMarkup(
  <StudioSidebar active="home" channelName="قناة اختبار" channelMark={<span>شعار القناة</span>}
    hasGuide={false} guideLabel="دليل القناة" hasLabs={false} hasTechReviews={false}
    identityDirty={false} voiceConnected={true} onHome={() => {}} onNavigate={() => {}} onClose={() => {}}
    {...options} />,
);

describe("تنقل الاستوديو", () => {
  it("keeps every unconditional destination visible and identifies the active page", () => {
    const html = render({ active: "settings" });
    for (const text of ["غرفة العمليات", "حلقات القناة", "إدارة القنوات", "مكتبة القناة", "الهوية البصرية", "إعدادات القناة", "الاتصالات والمفاتيح"]) expect(html).toContain(text);
    expect(html).toMatch(/aria-current="page"[^>]*>.*?الاتصالات والمفاتيح/s);
    expect(html).toContain('aria-label="الأقسام الرئيسية للاستوديو"');
    expect(html).not.toContain('type="submit"');
  });
  it("only exposes channel resources when their existing availability flags allow them", () => {
    const absent = render();
    for (const label of ["مختبرات الإنتاج", "المراجعات الفنية", "دليل القناة"]) expect(absent).not.toContain(label);
    const present = render({ hasGuide: true, hasLabs: true, hasTechReviews: true });
    for (const label of ["مختبرات الإنتاج", "المراجعات الفنية", "دليل القناة"]) expect(present).toContain(label);
  });
  it("shows current channel and episode context without inventing an approval state", () => {
    const html = render({ channelName: "دفاتر الزمن", episodeId: "001", episodeTitle: "بداية البشرية", identityDirty: true, voiceConnected: false });
    for (const label of ["دفاتر الزمن", "بداية البشرية", "تعديلات غير محفوظة", "تحتاج إعداد الاتصال"]) expect(html).toContain(label);
    expect(html).not.toContain("معتمد");
    expect(SECTION_TITLES.ops).toBe("غرفة العمليات");
    expect(SECTION_TITLES.channels).toBe("إدارة القنوات");
    expect(SECTION_TITLES.review).toBe("المراجعة المتكاملة");
    expect(SECTION_TITLES.research).toBeDefined();
    expect(SECTION_TITLES.publish).toBeDefined();
  });
});
