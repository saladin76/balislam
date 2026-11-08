import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { VoiceWorkspaceTab } from "../app/src/workspace/VoiceWorkspaceTab";
import type { Plan } from "../src/plan/types";
import type { EpisodeMedia } from "../src/plan/media";

const plan = (narration = "") => ({
  title: "حلقة اختبار",
  chapters: [{ number: 1, scenes: [{ id: "c1-s1", narration }] }],
}) as unknown as Plan;

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
    expect(html).toContain("التلاوة البشرية المرفوعة");
    expect(html).not.toContain("استعراض القرّاء");
    expect(html).not.toContain("AlQuran Cloud");
    expect(html).toContain("مراجعة المشهد بصوته وصورته");
    expect(html).toContain("c1-s1");
    expect(html).toContain("بلا صوت");
  });
});
