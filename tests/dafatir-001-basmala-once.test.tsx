import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { HZ_SCENES } from "../src/remotion/dafatir/horizon/episode001";
import { HZ_META } from "../src/remotion/dafatir/horizon/meta";
import { buildTimeline } from "../src/remotion/dafatir/horizon/timeline";
import type { Plan } from "../src/plan/types";

// ملاحظة المالك (١٤ نوفمبر): «بسم الله الرحمن الرحيم مكررة في المشهد الأول والثاني» (D134)، ثم طلبه (١٥ نوفمبر، D143):
// «قم بحذف المقطع الاول من الفيديو والثاني اللي فيه بسم الله الرحمن الرحيم وخليه يبدأ من أول الكلام».
const EP = "channels/dafatir-alzaman/episodes/001-adam-beginning";
const plan = JSON.parse(readFileSync(`${EP}/plan.json`, "utf8")) as Plan;
const scenes = plan.chapters.flatMap((c) => c.scenes);
const BASMALA = "بسم الله الرحمن الرحيم";

describe("دفاتر الزمن 001 — البسملة", () => {
  it("الحلقة تبدأ من أول الكلام: لا مشهد غلاف ولا بسملة في الخطة ولا في السكريبت", () => {
    expect(scenes.some((s) => ["cover", "basmala"].includes(String(s.props.shot)))).toBe(false);
    expect(scenes.some((s) => s.narration.includes(BASMALA))).toBe(false);
    expect(readFileSync(`${EP}/script.md`, "utf8").includes(BASMALA)).toBe(false);
  });
  it("قالب الغلاف (للنسخ المحفوظة) لا يكتب البسملة إلا بـ page=basmala", () => {
    const tl = buildTimeline([], 0.3);
    const Cover = HZ_SCENES.cover!;
    const draw = (p: Record<string, string>) => renderToStaticMarkup(<Cover t={2} tl={tl} dur={2.6} exit={HZ_META.cover!.exit} p={p} />);
    expect(draw({ shot: "cover", page: "blank" }).includes(BASMALA)).toBe(false);
    expect(draw({ shot: "cover", page: "basmala" }).includes(BASMALA)).toBe(true);
  });
});
