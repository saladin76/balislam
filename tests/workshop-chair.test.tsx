import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Workshop } from "../src/remotion/illus/shots/interior";
import { GROUND } from "../src/remotion/illus/world";

/** الأمر 018 (c1-s7): الكرسي على المنضدة لا يطفو؛ الساق الطويلة على سطحها والدوران حول قدمها، والقصيرة وحدها لا تبلغه */
describe("ورشة النجارة: الكرسي على المنضدة", () => {
  it("الساق الطويلة تنتهي على سطح المنضدة، والقصيرة فوقه، والدوران حول قدم الطويلة", () => {
    const svg = renderToStaticMarkup(<svg><Workshop frame={0} chairTilt={2.5} /></svg>);
    const top = GROUND - 210;
    const rect = (x: number) => {
      const m = svg.match(new RegExp(`<rect x="${x}" y="(\\d+(?:\\.\\d+)?)" width="10" height="(\\d+)"`));
      return m ? Number(m[1]) + Number(m[2]) : NaN;
    };
    expect(rect(1190)).toBe(top);
    expect(rect(1300)).toBeLessThan(top);
    expect(svg).toContain(`rotate(2.5 1195 ${top})`);
  });
});
