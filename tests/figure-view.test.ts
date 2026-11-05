import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Figure, LOOKS, POSES, walkPose, type PoseSpec } from "../src/remotion/illus/Figure";

/**
 * زاوية النظر في الشخصية (الأمر 007): الالتفات بإسقاط حقيقي للجسد بدل تضييق عرضه.
 * view = 0 يجب أن يطابق الرسم الجانبي القديم حرفيًا، فلا يتغير أي مشهد قائم.
 */
const baseline = JSON.parse(readFileSync(new URL("./fixtures/figure-profile-baseline.json", import.meta.url), "utf8")) as Record<string, string>;
const poses: Record<string, PoseSpec> = {
  stand: POSES.stand,
  think: POSES.think,
  sit: POSES.sit,
  "head-down": POSES["head-down"],
  point: POSES.point,
  walk: walkPose(POSES.stand, 1.3),
};
const svg = (props: Record<string, unknown>) =>
  renderToStaticMarkup(React.createElement("svg", null, React.createElement(Figure, { x: 500, y: 900, scale: 1.75, frame: 37, rim: 0.6, sway: 0, ...props } as never)));
const hash = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

describe("زاوية النظر", () => {
  it("الرسم الجانبي (view = 0 أو بلا view) مطابق حرفيًا لما قبل التعديل في كل الأشكال والوضعيات", () => {
    let n = 0;
    for (const [look, L] of Object.entries(LOOKS)) {
      for (const [pn, pose] of Object.entries(poses)) {
        for (const flip of [false, true]) {
          for (const holding of ["none", "phone", "bundle"]) {
            const key = `${look}|${pn}|${flip}|${holding}`;
            const want = baseline[key];
            if (!want) continue;
            expect(hash(svg({ look: L, pose, flip, holding })), key).toBe(want);
            expect(hash(svg({ look: L, pose, flip, holding, view: 0 })), key).toBe(want);
            n++;
          }
        }
      }
    }
    expect(n).toBe(Object.keys(baseline).length);
  });

  /** عرض الجسد المرسوم: أقصى امتداد أفقي لنقاط الجذع والكتفين */
  const widthAt = (view: number) => {
    const m = svg({ look: LOOKS.hero, pose: POSES.stand, view, rim: 0 });
    const xs = [...m.matchAll(/[ML](-?\d+(?:\.\d+)?) /g)].map((r) => Number(r[1]));
    return Math.max(...xs) - Math.min(...xs);
  };

  it("أثناء الالتفات لا يصير الجسد شريحة: العرض في كل زاوية لا يقل عن العرض الجانبي", () => {
    const side = widthAt(0);
    for (const v of [0.15, 0.3, 0.5, 0.7, 0.85, 1]) expect(widthAt(v), `view ${v}`).toBeGreaterThanOrEqual(side * 0.95);
  });

  it("الأطوال لا تتغير بالزاوية: ارتفاع الشخصية واحد جانبيًا وأماميًا", () => {
    const ys = (view: number) => {
      const m = svg({ look: LOOKS.hero, pose: POSES.stand, view, rim: 0, shadow: false });
      const v = [...m.matchAll(/ (-?\d+(?:\.\d+)?)(?= [LQZ]| Z|")/g)].map((r) => Number(r[1]));
      return Math.max(...v) - Math.min(...v);
    };
    expect(Math.abs(ys(1) - ys(0)) / ys(0)).toBeLessThan(0.08);
  });

  it("الزاوية متصلة: تغير صغير في الزاوية يغير الرسم قليلًا (لا قفزة)", () => {
    const a = widthAt(0.49);
    const b = widthAt(0.51);
    expect(Math.abs(a - b)).toBeLessThan(4);
  });
});
