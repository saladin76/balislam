import { describe, expect, it, vi } from "vitest";
import React from "react";
import fs from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * سكون الدعاء أثناء قراءته (القضايا 1 و2 و3 في developer-issues.md، ٨ نوفمبر):
 * - c4-s2: اللوح كما انتهى في c4-s1 (الدعاء كاملًا والمصدر في أعلاه)، ولا يتحرك فيه شيء طوال القراءة.
 * - c4-s1: يظهر الدعاء كاملًا دفعة واحدة ويصعد المصدر في الصمت بعد آخر كلمة.
 * - c5-s2 وc6-s23: نص الدعاء كاملًا ثابتًا بالخط نفسه، لا كلمة بعد كلمة.
 * - العمودي: ورقة قائمة بعرض الشاشة تحت الكابشن.
 */
let F = 0;
let ORI: "landscape" | "portrait" = "landscape";
const DUR = 240;
vi.mock("remotion", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return { ...m, useCurrentFrame: () => F, useVideoConfig: () => ({ fps: 30, width: ORI === "portrait" ? 1080 : 1920, height: ORI === "portrait" ? 1920 : 1080, durationInFrames: DUR, id: "t", defaultProps: {}, props: {}, defaultCodec: null }) };
});
const { DuaBoard, parseBoardCues, boardGeometry } = await import("../src/remotion/scenes/DuaBoard");
const { KineticText, stillFontSize } = await import("../src/remotion/scenes/KineticText");
const { estimateTimings } = await import("../src/remotion/scenes/timing");

const plan = JSON.parse(fs.readFileSync(path.join(__dirname, "../channels/balislam/episodes/001-know-the-truth/plan.json"), "utf8"));
const scene = (id: string) => plan.chapters.flatMap((c: { scenes: unknown[] }) => c.scenes).find((s: { id: string }) => s.id === id) as { id: string; template: string; narration: string; props: Record<string, string> };

const board = (id: string, frame: number, o: "landscape" | "portrait", extra: Record<string, unknown> = {}) => {
  F = frame;
  ORI = o;
  const s = scene(id);
  return renderToStaticMarkup(React.createElement(DuaBoard, { themeId: "night", orientation: o, narration: s.narration, ...s.props, ...extra } as never));
};
const kinetic = (id: string, frame: number, o: "landscape" | "portrait") => {
  F = frame;
  ORI = o;
  const s = scene(id);
  return renderToStaticMarkup(React.createElement(KineticText, { themeId: "night", orientation: o, narration: s.narration, ...s.props } as never));
};

describe("الخطة: مشاهد الدعاء الثلاثة في وضع السكون", () => {
  it("c4-s2 يبدأ بالدعاء والمصدر على اللوح، بلا إشارات، ساكن؛ وc4-s1 يُظهر الدعاء كاملًا في صمته الأخير", () => {
    const s2 = scene("c4-s2");
    expect(s2.template).toBe("dua-board");
    expect(s2.props.still).toBe("1");
    expect(s2.props.shown).toBe("source, dua");
    expect(s2.props.cues).toBe("");
    expect(scene("c4-s1").props.cues).toContain("dua-all | @end");
    for (const id of ["c5-s2", "c6-s23"]) {
      expect(scene(id).template).toBe("kinetic-text");
      expect(scene(id).props.still).toBe("1");
    }
  });
});

describe("لوح الدعاء", () => {
  it("«@end» في الصمت بعد آخر كلمة منطوقة، لا في وسط الكلام", () => {
    const t = estimateTimings("من الأدعية المأثورة في كلام أهل العلم:", 6, 150);
    const [c] = parseBoardCues("dua-all | @end", t, 180);
    expect(c!.at).toBeGreaterThan(t[t.length - 1]!.end);
    expect(c!.at).toBeLessThanOrEqual(180 - 24);
  });

  for (const o of ["landscape", "portrait"] as const)
    it(`c4-s2 · ${o}: الرسم نفسه في كل إطار من أول المشهد إلى آخره (لا حبر ولا نور يتنفس ولا ترجمة)`, () => {
      const extra = { continues: true, fromBoard: true };
      const first = board("c4-s2", 0, o, extra);
      for (const f of [6, 40, 90, 150, 200, DUR - 1]) expect(board("c4-s2", f, o, extra), `${f}`).toBe(first);
      expect(first).toContain("اللهم");
      // العبارات الأربع مكتملة الحبر (لا باهتة تنتظر نطقها)
      expect(first.split("opacity:1;transform:translateY(0px)").length - 1).toBeGreaterThanOrEqual(5);
    });

  it("c4-s1: الدعاء غائب أثناء جملة المصدر، ثم كامل دفعة واحدة في صمته الأخير، كما يبدأ c4-s2", () => {
    const inked = (m: string) => m.split("opacity:1;transform:translateY(0px)").length - 1;
    const hidden = (m: string) => m.split("opacity:0;transform:translateY(6px)").length - 1;
    const early = board("c4-s1", 60, "landscape", { continues: true });
    const end = board("c4-s1", DUR - 1, "landscape", { continues: true });
    const s2 = board("c4-s2", 0, "landscape", { continues: true, fromBoard: true });
    expect(hidden(early)).toBeGreaterThanOrEqual(4); // العبارات الأربع (والمصدر قبل كلمته)
    expect(hidden(end)).toBe(0);
    expect(inked(end)).toBeGreaterThanOrEqual(inked(s2)); // الدعاء والمصدر كما يبدأ c4-s2 (ومعهما كلمات الكابشن)
  });

  it("العمودي: ورقة قائمة تملأ عرض الشاشة، والخانات داخلها لا تتقاطع", () => {
    const g = boardGeometry(true);
    expect(g.BH).toBeGreaterThan(g.BW);
    const cells = [1, 2, 3, 4].map(g.cell);
    for (const c of cells) {
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x + c.w).toBeLessThanOrEqual(g.BW);
      expect(c.y + c.h).toBeLessThanOrEqual(g.BH);
    }
    expect(cells[0]!.x).toBeGreaterThan(cells[1]!.x + cells[1]!.w);
    expect(cells[2]!.y).toBeGreaterThan(cells[0]!.y + cells[0]!.h);
    // على شاشة 390 بكسل: نص الخانة (54 × 0.92 بوحدات اللوح) لا يقل عن 16 بكسل
    const base = Math.min(1040 / g.BW, 1430 / g.BH);
    expect(54 * 0.92 * base * (390 / 1080)).toBeGreaterThanOrEqual(16);
    expect(boardGeometry(false).BW).toBe(1500);
  });

  it("الأفقي دون تغيير في هندسته", () => {
    const g = boardGeometry(false);
    expect([g.BW, g.BH]).toEqual([1500, 880]);
    expect(g.cell(1)).toEqual({ x: 830, y: 288, w: 560, h: 280 });
  });
});

describe("النص الحركي في وضع السكون", () => {
  for (const id of ["c5-s2", "c6-s23"])
    for (const o of ["landscape", "portrait"] as const)
      it(`${id} · ${o}: الكلام كله ظاهر قبل القراءة وثابت حتى آخرها`, () => {
        const first = kinetic(id, 8, o);
        for (const f of [30, 80, 140, 200]) expect(kinetic(id, f, o), `${f}`).toBe(first);
        const words = scene(id).narration.replace(/[«».،]/g, " ").split(/\s+/).filter(Boolean);
        for (const w of words) expect(first).toContain(w);
      });

  it("حجم الخط يصغر بطول النص ولا ينزل عن حد القراءة", () => {
    expect(stillFontSize(5, false)).toBe(150);
    expect(stillFontSize(12, true)).toBeGreaterThanOrEqual(84);
    expect(stillFontSize(12, false)).toBeLessThan(150);
  });
});
