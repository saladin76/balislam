import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { HZ_SCENES } from "../src/remotion/dafatir/horizon/episode001";
import { HZ_LEAD, HZ_META, hzSentences } from "../src/remotion/dafatir/horizon/meta";
import { buildTimeline } from "../src/remotion/dafatir/horizon/timeline";
import { sceneSeconds } from "../src/plan/duration";
import type { Plan } from "../src/plan/types";

// ملاحظة المالك (١٤ نوفمبر): «بسم الله الرحمن الرحيم مكررة في المشهد الأول والثاني».
// القرار: صفحة الغلاف فارغة، والبسملة تُكتب مرة واحدة في مشهدها (c1-s1) مع تسجيل المالك.
const EP = "channels/dafatir-alzaman/episodes/001-adam-beginning";
const plan = JSON.parse(readFileSync(`${EP}/plan.json`, "utf8")) as Plan;
const scenes = plan.chapters.flatMap((c) => c.scenes);
const BASMALA = "بسم الله الرحمن الرحيم";

const frames = (id: string) => {
  const s = scenes.find((x) => x.id === id)!;
  const shot = String(s.props.shot);
  const tl = buildTimeline(hzSentences(s.narration), HZ_LEAD);
  const dur = sceneSeconds(s);
  const Comp = HZ_SCENES[shot]!;
  const out: { t: number; html: string }[] = [];
  for (let t = 0; t <= dur + 1e-9; t += 0.1)
    out.push({ t, html: renderToStaticMarkup(<Comp t={t} tl={tl} dur={dur} exit={HZ_META[shot]!.exit} p={s.props as Record<string, string>} />) });
  return out;
};

describe("دفاتر الزمن 001 — البسملة مرة واحدة", () => {
  it("الغلاف c1-s0 لا يكتب البسملة في أي لحظة", () => {
    for (const f of frames("c1-s0")) expect(f.html.includes(BASMALA), `c1-s0 @${f.t.toFixed(1)}`).toBe(false);
  });
  it("مشهد البسملة c1-s1 يكتبها، وهو المشهد الوحيد في الخطة الذي نصه البسملة", () => {
    const fs = frames("c1-s1");
    expect(fs.some((f) => f.html.includes(BASMALA))).toBe(true);
    expect(scenes.filter((s) => s.narration.includes(BASMALA)).map((s) => s.id)).toEqual(["c1-s1"]);
  });
});
