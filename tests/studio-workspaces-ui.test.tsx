import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChannelsWorkspace } from "../app/src/tabs/ChannelsWorkspace";
import { OpsSectionNav } from "../app/src/tabs/OpsRoom";
import { IntegratedReviewWorkspace } from "../app/src/workspace/IntegratedReviewWorkspace";
import type { ChannelSummary } from "../app/src/api";

const channels: ChannelSummary[] = [
  { id: "balislam", name: "بالإسلام", language: "ar", domains: {} },
  { id: "dafatir-alzaman", name: "دفاتر الزمن", language: "ar", domains: {} },
  { id: "zubdat-alkutub", name: "زبدة الكتب", language: "ar", domains: {} },
];

describe("Studio workspace separation", () => {
  it("provides independent channel cards with the original management destinations", () => {
    const html = renderToStaticMarkup(<ChannelsWorkspace channels={channels} activeId="balislam" onOpen={() => {}} />);
    for (const name of channels.map((channel) => channel.name)) expect(html).toContain(name);
    expect(html.match(/class="studio-channel-tile"/g)).toHaveLength(3);
    for (const label of ["حلقات القناة", "الإعدادات", "الهوية البصرية"]) expect(html).toContain(label);
    expect(html).toContain('aria-label="إدارة القنوات الثلاث"');
    expect(html).not.toContain("اعتماد تلقائي");
  });

  it("gives the operations calendar, pipeline and idea bank accessible, focused navigation", () => {
    const html = renderToStaticMarkup(<OpsSectionNav active="pipeline" onSelect={() => {}} />);
    expect(html).toContain('aria-label="أقسام غرفة العمليات"');
    for (const id of ["ops-week", "ops-pipeline", "ops-ideas"]) expect(html).toContain(`aria-controls="${id}"`);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-controls="ops-pipeline" aria-pressed="true"/);
  });

  it("keeps integrated AV review read-only and clearly distinct from Master approval", () => {
    const html = renderToStaticMarkup(<IntegratedReviewWorkspace episodeId="001" onOpen={() => {}} />);
    expect(html).toContain('aria-label="المراجعة المتكاملة للحلقة"');
    expect(html).toContain("بسرعة طبيعية 1×");
    expect(html).toContain("ثلاثة قرارات مستقلة في «إنتاج المشاهد»");
    expect(html).toContain("ملفات Master والتسليم");
    expect(html).not.toContain("اعتماد الحلقة الآن");
    // شاشة واحدة: لا زر مملوء هنا (القرار في لوحة «إنتاج المشاهد»)، والتفاصيل مطوية في «أدوات وتفاصيل»
    expect(html).not.toContain("btn primary");
    expect(html.match(/<details class="more"/g)).toHaveLength(1);
  });
});
