import { describe, expect, it } from "vitest";
import { roofSky } from "../src/remotion/illus/shots/outdoor";

/** c1-s12 (٩ نوفمبر): انتقال الأسطح من الفجر الباكر إلى الفجر بلا قفزة لون في منتصفه. */
const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const dist = (a: string, b: string) => Math.max(...rgb(a).map((v, i) => Math.abs(v - rgb(b)[i]!)));

describe("سماء الأسطح أثناء انتقال المزاج", () => {
  it("لا قفزة بين إطارين متتاليين في أي موضع من الانتقال", () => {
    for (let k = 0; k < 100; k++) {
      const a = roofSky("predawn", "dawn", k / 100);
      const b = roofSky("predawn", "dawn", (k + 1) / 100);
      for (let i = 0; i < 3; i++) expect(dist(a[i]!, b[i]!), `t=${k / 100} stop ${i}`).toBeLessThanOrEqual(4);
    }
  });
  it("الطرفان هما المزاجان نفساهما، وبلا مزاج ثانٍ لا تغيّر", () => {
    expect(roofSky("predawn", "dawn", 0)).toEqual(roofSky("predawn", undefined, 0.7));
    expect(roofSky("predawn", "dawn", 1)).toEqual(roofSky("dawn", undefined, 0));
  });
});

describe("انتقال المزاج في قوالب المكان", () => {
  it("حكايات الحارة والطريق لا تبدّلان المزاج دفعة واحدة عند منتصف الانتقال", async () => {
    const fs = await import("node:fs");
    for (const f of ["src/remotion/scenes/AlleyTale.tsx", "src/remotion/scenes/RoadJourney.tsx", "src/remotion/illus/shots/outdoor.tsx"]) {
      const src = fs.readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/skyT > 0\.5|t > 0\.5 && to/);
    }
    const alley = fs.readFileSync("src/remotion/scenes/AlleyTale.tsx", "utf8");
    expect(alley).toMatch(/<g opacity=\{skyT\}>\{draw\(moodTo\)\}<\/g>/);
  });
});

describe("الجالس على الدكة", () => {
  it("الدكة تبين أمام الجدار بلونها وحدّها، والمصباح إلى جانب الجالس لا فوق رأسه", async () => {
    const React = (await import("react")).default;
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { Bench } = await import("../src/remotion/illus/world");
    const { stoneFor } = await import("../src/remotion/illus/palette");
    const svg = renderToStaticMarkup(React.createElement("svg", null, React.createElement(Bench, { x: 0, mood: "dusk" })));
    expect(svg).toContain("stroke=");
    const wall = stoneFor("dusk", 0.05).toLowerCase();
    expect(svg.toLowerCase()).not.toContain(`fill="${wall}"`);
    const fs = await import("node:fs");
    expect(fs.readFileSync("src/remotion/scenes/AlleyTale.tsx", "utf8")).toMatch(/WallLamp x=\{heroX \+ 200\}/);
  });
});
