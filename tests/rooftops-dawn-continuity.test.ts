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
