import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { figureSpan, fitFrame, unionSpan, type Span } from "../src/remotion/illus/framing";
import { autoCameraPlan, CAM_SHOTS, parseCameraPlan } from "../src/plan/director";
import { planIssues } from "../src/plan/validate";
import type { Plan } from "../src/plan/types";
import type { PoseName } from "../src/remotion/illus/Figure";

let F = 0;
let ORI: "landscape" | "portrait" = "landscape";
vi.mock("remotion", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return { ...m, useCurrentFrame: () => F, useVideoConfig: () => ({ fps: 30, width: ORI === "portrait" ? 1080 : 1920, height: ORI === "portrait" ? 1920 : 1080, durationInFrames: 240, id: "t", defaultProps: {}, props: {}, defaultCodec: null }) };
});
const { AlleyTale, fitFor, shotFrame, witnessPillAt, pillWidth } = await import("../src/remotion/scenes/AlleyTale");

/** ما يُرى من العالم بتأطير */
const view = (c: { x: number; z: number }, portrait: boolean) => ({ lo: c.x - (portrait ? 304 : 960) / c.z, hi: c.x + (portrait ? 304 : 960) / c.z });
const inside = (s: Span, v: Span) => s.lo >= v.lo - 0.5 && s.hi <= v.hi + 0.5;
const partial = (s: Span, v: Span) => s.hi > v.lo && s.lo < v.hi && !inside(s, v);

type Case = Parameters<typeof fitFor>[0];
const base = (o: Partial<Case>): Case => ({ heroX: 1060, propX: 1060, stage: "solo", portrait: true, sitting: false, walking: false, timeline: [{ pose: "stand" }], compTimeline: [{ pose: "stand" }], compX: 1060 - 330, hasDoor: false, hasBoard: false, ghosts: false, facingLeft: false, turnsAway: false, ...o });
const hero = (c: Case) => {
  const sp = figureSpan(c.heroX, c.timeline.map((x) => x.pose), c.stage === "companion" ? "left" : c.stage === "witnesses" ? "right" : c.sitting ? "right" : "both", 1.75);
  return c.sitting ? { lo: Math.min(sp.lo, c.heroX - 60), hi: Math.max(sp.hi, c.heroX + 180) } : sp;
};

describe("التأطير المحتوي — الحدود والاحتواء", () => {
  it("حدود الشخصية تتبع الوضعية والاتجاه وتكبر مع المقياس", () => {
    const r = figureSpan(1000, ["point"], "right", 1.75);
    expect(r.hi - 1000).toBeGreaterThan(200);
    expect(1000 - r.lo).toBeLessThan(70);
    const l = figureSpan(1000, ["point"], "left", 1.75);
    expect(1000 - l.lo).toBeGreaterThan(200);
    expect(figureSpan(1000, ["stand"], "both", 3.5).hi - 1000).toBeCloseTo(118, 0);
  });
  it("المطلوب كله داخل الإطار بهامش، والحجم لا يقل عن 1، ولا يُرى ما وراء العالم", () => {
    for (const portrait of [true, false])
      for (const z of [1, 1.28, 1.6]) {
        const req = [{ lo: 700, hi: 900 }, { lo: 1000, hi: 1250 }];
        const r = fitFrame({ x: 975, z, required: req, portrait, worldW: 1920 });
        const v = view(r, portrait);
        expect(r.fits).toBe(true);
        expect(r.z).toBeGreaterThanOrEqual(1);
        for (const s of req) expect(inside(s, v), `${portrait} ${z}`).toBe(true);
        expect(v.lo).toBeGreaterThanOrEqual(-0.5);
        expect(v.hi).toBeLessThanOrEqual(1920.5);
      }
  });
  it("الاختياري يظهر كاملًا أو يخرج كاملًا", () => {
    const r = fitFrame({ x: 800, z: 1.6, required: [{ lo: 760, hi: 840, name: "a" }], optional: [{ lo: 900, hi: 1000, name: "b" }], portrait: true, worldW: 1920 });
    expect(partial({ lo: 900, hi: 1000 }, view(r, true))).toBe(false);
  });
  it("ما يستحيل احتواؤه يُعلن (fits = false) ويُحتوى أهمه وحده", () => {
    const r = fitFrame({ x: 960, z: 1, required: [{ lo: 400, hi: 520, name: "a" }, { lo: 1300, hi: 1420, name: "b" }], portrait: true, worldW: 1920 });
    expect(r.fits).toBe(false);
    expect(inside({ lo: 400, hi: 520 }, view(r, true))).toBe(true);
  });
});

describe("التأطير المحتوي — حالات «الحارة» في العمودي والأفقي", () => {
  const cases: { name: string; c: Case; targets: { t: Parameters<ReturnType<typeof fitFor>>[0]; need: (c: Case) => Span[] }[] }[] = [
    { name: "وحده", c: base({ timeline: [{ pose: "stand" }, { pose: "think" }] }), targets: [{ t: "hero", need: (c) => [hero(c)] }] },
    { name: "جالس", c: base({ sitting: true, timeline: [{ pose: "sit" }, { pose: "head-down" }] }), targets: [{ t: "hero", need: (c) => [hero(c)] }] },
    { name: "الباب", c: base({ hasDoor: true }), targets: [{ t: "door", need: (c) => [hero(c), { lo: c.propX + 234, hi: c.propX + 456 }] }] },
    { name: "اللوحة", c: base({ hasBoard: true }), targets: [{ t: "board", need: (c) => [hero(c), { lo: c.propX - 430, hi: c.propX - 164 }] }] },
    {
      name: "شخص أمامه",
      c: base({ stage: "companion", heroX: 1160, compX: 1160 - 330, facingLeft: true, timeline: [{ pose: "stand" }, { pose: "apologize" }, { pose: "listen" }], compTimeline: [{ pose: "stand" }, { pose: "listen" }, { pose: "nod" }] }),
      targets: [{ t: "pair", need: (c) => [hero(c), figureSpan(c.compX, c.compTimeline.map((x) => x.pose), "right", 1.7)] }],
    },
    {
      name: "شاهدان",
      c: base({ stage: "witnesses", heroX: 640, verdicts: { wrong: "ظلمًا", just: "عدلًا" } }),
      targets: [
        { t: "center", need: () => [{ lo: figureSpan(920, ["point", "talk"], "right", 1.15).lo, hi: figureSpan(1010, ["hold", "flinch"], "left", 1.15).hi }] },
        { t: "hero", need: (c) => [hero(c)] },
        { t: "other", need: () => [figureSpan(1300, ["stand", "think"], "left", 1.75)] },
      ],
    },
  ];
  for (const portrait of [true, false])
    for (const k of cases)
      for (const tg of k.targets)
        for (const shot of CAM_SHOTS)
          it(`${portrait ? "عمودي" : "أفقي"} · ${k.name} · ${tg.t} · ${shot}: المطلوب كامل`, () => {
            const c = { ...k.c, portrait };
            const f = fitFor(c)(tg.t, shot);
            const v = view(f, portrait);
            for (const s of tg.need(c)) expect(inside(s, v), JSON.stringify({ s, v })).toBe(true);
          });

  it("العمودي: التأطير القائم كان يقص (سبب العيب)، والمحتوي لا يقص", () => {
    // شخص أمامه: القائم يضع الاثنين على 400 ويكبّر حتى 1.12 فيقص ظهر أحدهما؛ والمحتوي يحتويهما
    const c = base({ stage: "companion", heroX: 1160, compX: 1160 - 400, facingLeft: true, timeline: [{ pose: "cross" }], compTimeline: [{ pose: "flinch" }], portrait: true });
    const old = view(shotFrame("pair", "medium", 1160, "companion", true), true);
    const both = [hero(c), figureSpan(760, ["flinch"], "right", 1.7)];
    expect(both.every((s) => inside(s, old))).toBe(false);
    const fixed = { ...c, compX: 1160 - 330 };
    const v = view(fitFor(fixed)("pair", "medium"), true);
    expect([hero(fixed), figureSpan(830, ["flinch"], "right", 1.7)].every((s) => inside(s, v))).toBe(true);
  });
  it("العمودي: الشاهدان لا يُقصّان نصف قص في الافتتاح (يظهر الموقف، ويظهر كل شاهد كاملًا أو لا يظهر)", () => {
    const c = base({ stage: "witnesses", heroX: 640, portrait: true, verdicts: { wrong: "ظلمًا", just: "عدلًا" } });
    const v = view(fitFor(c)("center", "wide"), true);
    expect(partial(hero(c), v)).toBe(false);
    expect(partial(figureSpan(1300, ["stand", "think"], "left", 1.75), v)).toBe(false);
  });
});

describe("الكاميرا: الشاهدان في العمودي، وخطط المخرج، والسكون", () => {
  it("العمودي مع fit: الكاميرا تنتقل إلى كل شاهد عند كلمة حكمه، والأفقي كما كان", () => {
    const cues = [{ kind: "witnesses", at: 10 }, { kind: "wrong", at: 90 }, { kind: "just", at: 140 }];
    const alt = autoCameraPlan({ cues, duration: 240, fps: 30, stage: "witnesses", sacred: false, alternate: true });
    expect(alt.map((b) => b.target)).toEqual(["center", "hero", "other"]);
    expect(autoCameraPlan({ cues, duration: 240, fps: 30, stage: "witnesses", sacred: false }).map((b) => b.target)).toEqual(["center"]);
    expect(autoCameraPlan({ cues, duration: 240, fps: 30, stage: "witnesses", sacred: true, alternate: true })).toHaveLength(1);
  });
  it("كلمة كل شاهد بجوار رأسه، ولا تُسحب إلى الإطار إن كان صاحبها خارجه", () => {
    // الكاميرا على الشاهد الأول كما يؤطّرها التأطير المحتوي (تحتوي كلمته بجواره)
    const c = fitFor(base({ stage: "witnesses", heroX: 640, portrait: true, verdicts: { wrong: "ظلمًا", just: "عدلًا" } }))("hero", "medium");
    const x = witnessPillAt(640, 1, "ظلمًا", c, true)!;
    expect(Math.abs(x - 640)).toBeGreaterThanOrEqual(45 + pillWidth("ظلمًا") / 2 - 1);
    expect(witnessPillAt(1300, -1, "عدلًا", c, true)).toBeNull();
  });
  it("الهدف other مقبول في خطة المخرج، ويُرفض بلا التأطير المحتوي", () => {
    expect(parseCameraPlan("الحكم | medium other")[0]?.target).toBe("other");
    const plan = (p: Record<string, string>) => ({ version: 1, episode: "x", title: "t", domain: "general", themeId: "night", channel: "balislam", updatedAt: "", chapters: [{ number: 1, title: "", scenes: [{ id: "a", template: "alley-tale", narration: "نص.", line: 1, props: p, sfx: [] }] }] }) as unknown as Plan;
    expect(planIssues(plan({ cameraMode: "composed", cameraPlan: "0 | medium other" })).some((i) => i.level === "error" && /other/.test(i.message))).toBe(true);
    expect(planIssues(plan({ cameraMode: "composed", framing: "fit", cameraPlan: "0 | medium other" })).filter((i) => i.level === "error")).toEqual([]);
    expect(planIssues(plan({ framing: "fit" })).some((i) => i.level === "error" && /composed/.test(i.message))).toBe(true);
    expect(planIssues(plan({ cameraMode: "composed", framing: "wide" })).some((i) => i.level === "error")).toBe(true);
  });
});

describe("التوافق: بلا الحقل الرسم القائم حرفيًا", () => {
  const scenes: Record<string, Record<string, string>> = {
    companion: { narration: "يقف أمام صديقه بعد الخلاف. يعتذر له بصدق، ثم يصغي إليه.", cast: "companion", poses: "stand,apologize,listen", cues: "apologize | يعتذر\nlisten | يصغي" },
    witnesses: { narration: "شاهدان رأيا الموقف نفسه. الأول يراه ظلمًا، والثاني يراه عدلًا.", place: "market", cast: "witnesses", cues: "witnesses | شاهدان\nwrong | ظلمًا\njust | عدلًا" },
    sitting: { narration: "يجلس وحده بعد يوم طويل. يتذكر ما قاله، ويشعر بالألم.", place: "home", poses: "sit,head-down", cues: "memory | يتذكر\npain | بالألم" },
  };
  const draw = (frame: number, o: "landscape" | "portrait", p: Record<string, string>) => {
    F = frame;
    ORI = o;
    return renderToStaticMarkup(React.createElement(AlleyTale, { themeId: "night", orientation: o, mood: "night", look: "hero", ...p } as never));
  };
  for (const [name, p] of Object.entries(scenes))
    for (const o of ["landscape", "portrait"] as const)
      it(`${name} · ${o}`, () => {
        for (const f of [0, 60, 120, 200]) {
          // الكاميرا القديمة والمؤلَّفة بلا framing: كما كانتا (framing لا أثر له خارج composed)
          expect(draw(f, o, { ...p, framing: "fit" })).toBe(draw(f, o, p));
          const comp = { ...p, cameraMode: "composed" };
          expect(draw(f, o, comp), `${f}`).toBe(draw(f, o, { ...comp, framing: "" }));
        }
        // وللحقل أثر فعلي مع composed
        expect([60, 120, 200].some((f) => draw(f, o, { ...p, cameraMode: "composed", framing: "fit" }) !== draw(f, o, { ...p, cameraMode: "composed" }))).toBe(true);
      });
});

void unionSpan;
void (null as unknown as PoseName);

describe("«ظل ونور» — الكلمة داخل اللقطة القريبة مع الحركة الطبيعية", () => {
  it("لا تُقص على حافة ما تراه الكاميرا، في الأفقي والعمودي", async () => {
    const { stagePillX } = await import("../src/remotion/scenes/LightStage");
    for (const portrait of [false, true])
      for (const zoom of [0.92, 1.05, 1.4, 1.6])
        for (const heroX of [700, 960, 1220])
          for (const dx of [-360, 360]) {
            const w = "ظلمًا".length * 46 * 0.58 + 64;
            const x = stagePillX(heroX + dx, heroX, zoom, "ظلمًا", portrait);
            const c = portrait ? Math.max(304, Math.min(1920 - 304, heroX)) : 960;
            const half = portrait ? 304 : 960;
            // موضع الكلمة على الشاشة بعد التكبير حول البطل
            const sx = (v: number) => heroX + (v - heroX) * zoom;
            expect(sx(x - w / 2), `${portrait} ${zoom} ${heroX} ${dx}`).toBeGreaterThanOrEqual(c - half - 0.5);
            expect(sx(x + w / 2), `${portrait} ${zoom} ${heroX} ${dx}`).toBeLessThanOrEqual(c + half + 0.5);
          }
  });
});
