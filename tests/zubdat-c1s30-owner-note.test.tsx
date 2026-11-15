import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { INK_SHOTS } from "../src/remotion/zubdat/shots";
import { makeAt, makeEnd, type Z } from "../src/remotion/zubdat/inkKit";
import { estimateTimings, type WordTiming } from "../src/remotion/scenes/timing";
import { heavyTimeout } from "./helpers/heavyTimeout";

/**
 * ملاحظة المالك n1d668306b2 (١٥ نوفمبر، c1-s30 «باب القراءة»): «عند وإذا كانت الصلاة تبدأ بالتكبير لا يوجد حركة
 * على الشاشة». الآن: مصلٍّ قائم عند «الصلاة»، و«تبدأ بالتكبير» تُكتب، ويرفع يديه لحظة «بالتكبير»، ثم يخرج مع «الكلام».
 * ونص المؤلف على الشاشة يطابق ما يُنطق بعد تصحيح المالك في السكريبت («أبو شادي»، KI-070).
 */
vi.mock("remotion", async (orig) => {
  const actual = await orig<typeof import("remotion")>();
  return { ...actual, useCurrentFrame: () => 0, useVideoConfig: () => ({ fps: 30, width: 1920, height: 1080, durationInFrames: 900, id: "t", defaultProps: {}, props: {}, defaultCodec: null }) };
});

const z: Z = { ink: "#111111", paper: "#FFFFFF", hl: "#E8F542", alert: "#FF6B4A", faint: "#4A4A4A" };
const plan = JSON.parse(readFileSync("channels/zubdat-alkutub/episodes/001-awwal-marra-osalli/plan.json", "utf8"));
const scene = plan.chapters.flatMap((c: { scenes: unknown[] }) => c.scenes).find((s: { id: string }) => s.id === "c1-s30");
const narration: string = scene.narration;
const dur = 900;
const timings: WordTiming[] = estimateTimings(narration, 6, dur - 12);
const bare = (w: string) => w.replace(/[ً-ْ«»:،.؟؛]/g, "");
const start = (b: string) => timings.find((t) => bare(t.word) === b)!.start;
const world = (frame: number) =>
  renderToStaticMarkup(<svg>{INK_SHOTS["reading-door"]!.render({ frame, dur, z, at: makeAt(timings, dur), end: makeEnd(timings, dur), logo: () => null, reg: () => {} }).world}</svg>);
const opacityOf = (m: string, k: string) => Number(new RegExp(`data-k="${k}" opacity="([\\d.e-]+)"`).exec(m)?.[1] ?? NaN);
const HEAVY = heavyTimeout(30_000);

describe("c1-s30 (reading-door): الجملة الأولى فيها حركة (ملاحظة n1d668306b2)", () => {
  it("نص المشهد يطابق السكريبت (عقد: ما يُنطق هو ما في السكريبت)", () => {
    const script = readFileSync("channels/zubdat-alkutub/episodes/001-awwal-marra-osalli/script.md", "utf8");
    expect(script.replace(/\s+/g, " ")).toContain(narration.replace(/\s+/g, " ").trim());
  });

  it("مصلٍّ قائم عند «الصلاة»، ويرفع يديه عند «بالتكبير» لا قبلها، ويخرج مع «الكلام»", () => {
    expect(world(start("بالتكبير") - 4)).not.toContain('data-k="door-raise"');
    expect(opacityOf(world(start("بالتكبير") - 4), "door-stand")).toBeGreaterThan(0.99);
    expect(opacityOf(world(start("بالتكبير") + 8), "door-raise")).toBeGreaterThan(0.99);
    expect(opacityOf(world(start("الكلام") + 10), "door-takbir")).toBe(0);
  }, HEAVY);

  it("«تبدأ بالتكبير» لا تُكتب قبل «تبدأ»، وتُكتب بعدها", () => {
    // الكتابة تتقدم بين «تبدأ» و«بالتكبير»: الإطار قبل «تبدأ» لا يساوي الإطار بعد «بالتكبير»
    expect(world(start("تبدأ") - 4)).not.toBe(world(start("بالتكبير") + 10));
    expect(world(start("بالتكبير") + 10)).toContain("تبدأ بالتكبير");
  }, HEAVY);

  it("لا سكون فوق ثانيتين من أول المشهد إلى «فماذا»", () => {
    for (let f = 0; f + 60 <= start("فماذا"); f += 10) expect(world(f) === world(f + 60), `frame ${f}`).toBe(false);
  }, HEAVY);

  it("اسم المؤلف على الشاشة كما يُنطق (عقد على نص المشهد لا على الاسم)", () => {
    const m = world(dur - 20);
    const shown = /للدكتور [^<]+/.exec(m)?.[0];
    expect(shown).toBeTruthy();
    const spoken = narration.replace(/[ً-ْ]/g, "").replace(/\s+/g, " ");
    expect(spoken).toContain(shown!);
  }, HEAVY);
});
