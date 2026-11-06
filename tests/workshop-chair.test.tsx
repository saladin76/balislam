import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SHOP_CHAIR, Workshop, shopChairGap } from "../src/remotion/illus/shots/interior";
import { GROUND } from "../src/remotion/illus/world";

/**
 * التوجيه 019 (c1-s7): الكرسي على أرض الورشة لا على المنضدة ولا معلّقًا.
 * ثلاث أرجل على الأرض، والأمامية القريبة وحدها أقصر بفراغ مضاء تحتها (موضع الخلل)، والتأرجح يهبط بها حتى تلمس.
 */
describe("ورشة النجارة: الكرسي ذو الساق القصيرة", () => {
  const svg = renderToStaticMarkup(<svg><Workshop frame={0} /></svg>);
  const { x, depth, leg, back, seat, short } = SHOP_CHAIR;
  const fx = x - depth / 2;
  const rx = x + depth / 2;
  const bottom = (rx0: number, w: number) => {
    const m = svg.match(new RegExp(`<rect x="${rx0}" y="(-?\\d+(?:\\.\\d+)?)" width="${w}" height="(\\d+(?:\\.\\d+)?)"`));
    return m ? Number(m[1]) + Number(m[2]) : NaN;
  };
  it("الساق الخلفية القريبة والبعيدتان على الأرض", () => {
    expect(bottom(rx, leg)).toBe(GROUND);
    // البعيدتان أعلى بسبع وحدات (عمق) وأطول بوحدتين: قدماهما على خط الأرض البعيد
    expect(bottom(fx + 10, leg - 2)).toBe(GROUND - seat - 7 + seat + 2);
    expect(bottom(rx + 10, leg - 2)).toBe(GROUND - back - 7 + back + 2);
  });
  it("الأمامية القريبة وحدها أقصر، وتحتها فراغ مضاء؛ والتأرجح يغلقه", () => {
    expect(bottom(fx, leg)).toBe(GROUND - short);
    expect(svg).toContain(`<rect x="${fx - 3}" y="${GROUND - short}" width="${leg + 6}" height="${short}"`);
    expect(shopChairGap(0)).toBe(short);
    expect(shopChairGap(1)).toBe(0);
    expect(renderToStaticMarkup(<svg><Workshop frame={0} chairRock={1} /></svg>)).not.toContain(`width="${leg + 6}" height="`);
  });
  it("لا كرسي على المنضدة: لا شيء من الكرسي فوق سطحها", () => {
    // سطح المنضدة GROUND-210؛ أعلى نقطة في الكرسي قمة الظهر GROUND-222 وهي خلف المنضدة لا عليها (المقعد أدنى من السطح بكثير)
    expect(GROUND - seat).toBeGreaterThan(GROUND - 210);
  });
});
