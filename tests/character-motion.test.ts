import { describe, expect, it } from "vitest";
import { legGeometry, POSES, walkPose, type PoseSpec } from "../src/remotion/illus/Figure";
import { GAIT_IDS, gaitSpeed, locomote, locoPose, poseAtNatural, transitionFrames, type GaitId, type Move } from "../src/remotion/illus/gait";

/**
 * حركة الشخصيات (بالإسلام، الأمر 006): مشيات متعددة، تسارع وتباطؤ، قدم ثابتة على الأرض،
 * استعداد واستقرار، التفاتة بالجسد، وانتقال وضعيات بحسب حجم التغيير.
 */
const FPS = 30;
const SCALE = 1.75;

/** انزلاق القدم الملامسة للأرض بين إطارين متتاليين (وحدات العالم) أثناء الحركة */
const slipOf = (xs: number[], poses: PoseSpec[], facing: number[]) => {
  const slips: number[] = [];
  let prevContact: "back" | "front" | null = null;
  let prevX = 0;
  for (let i = 0; i < poses.length; i++) {
    const g = legGeometry(poses[i]!);
    const contact = g.back.f[1] >= g.front.f[1] ? "back" : "front";
    const fx = xs[i]! + Math.sign(facing[i]!) * g[contact].f[0] * SCALE;
    if (contact === prevContact) slips.push(Math.abs(fx - prevX));
    prevContact = contact;
    prevX = fx;
  }
  return slips;
};
const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);

describe("المشيات", () => {
  it("أربع مشيات بسرعات متدرجة: متثاقل < متمهل < طبيعي < مسرع", () => {
    const v = GAIT_IDS.map((g) => gaitSpeed(g, SCALE, FPS));
    const [heavy, stroll, walk, brisk] = (["heavy", "stroll", "walk", "brisk"] as GaitId[]).map((g) => gaitSpeed(g, SCALE, FPS));
    expect(v).toHaveLength(4);
    expect(heavy).toBeLessThan(stroll!);
    expect(stroll).toBeLessThan(walk!);
    expect(walk).toBeLessThan(brisk!);
  });

  for (const gait of GAIT_IDS) {
    it(`القدم لا تنزلق على الأرض في مشية ${gait}`, () => {
      const moves: Move[] = [{ start: 10, dx: 900, gait }];
      const xs: number[] = [];
      const poses: PoseSpec[] = [];
      const facing: number[] = [];
      for (let f = 0; f < 200; f++) {
        const st = locomote(f, { x0: 0, moves, scale: SCALE, fps: FPS });
        if (!st.moving || st.amount < 0.9) continue;
        xs.push(st.x);
        poses.push(locoPose(POSES.stand, st));
        facing.push(st.facing);
      }
      const v = gaitSpeed(gait, SCALE, FPS);
      // متوسط الانزلاق أقل من 12% من سرعة الجسد
      expect(mean(slipOf(xs, poses, facing))).toBeLessThan(v * 0.12);
    });
  }

  it("دورة المشي القديمة تنزلق أكثر بكثير (مرجع المقارنة؛ لم تُغيَّر)", () => {
    const xs: number[] = [];
    const poses: PoseSpec[] = [];
    for (let f = 0; f < 120; f++) {
      xs.push(-f * 3.4);
      poses.push(walkPose(POSES.stand, (f / FPS) * Math.PI * 2 * 0.95));
    }
    const oldSlip = mean(slipOf(xs, poses, xs.map(() => -1)));
    expect(oldSlip).toBeGreaterThan(3.4 * 0.5);
  });
});

describe("التسارع والتوقف", () => {
  it("يصل إلى المسافة المطلوبة بالضبط ويتوقف تمامًا", () => {
    const st = locomote(400, { x0: 1000, moves: [{ start: 20, dx: -600, gait: "walk" }], scale: SCALE, fps: FPS });
    expect(st.x).toBeCloseTo(400, 0);
    expect(st.moving).toBe(false);
    expect(st.amount).toBe(0);
  });

  it("السرعة تتزايد تدريجيًا ثم تتناقص: لا قفزة في السرعة بين إطارين", () => {
    let prev = 0;
    for (let f = 0; f < 200; f++) {
      const v = Math.abs(locomote(f, { x0: 0, moves: [{ start: 10, dx: 700, gait: "brisk" }], scale: SCALE, fps: FPS }).v);
      expect(Math.abs(v - prev)).toBeLessThan(gaitSpeed("brisk", SCALE, FPS) * 0.16);
      prev = v;
    }
  });

  it("مسافة قصيرة: خطوات قليلة دون بلوغ السرعة الكاملة", () => {
    let peak = 0;
    for (let f = 0; f < 80; f++) peak = Math.max(peak, locomote(f, { x0: 0, moves: [{ start: 5, dx: 60, gait: "walk" }], scale: SCALE, fps: FPS }).amount);
    expect(peak).toBeGreaterThan(0.05);
    expect(peak).toBeLessThan(0.6);
  });

  it("استعداد قبل الانطلاق: الركبتان تنثنيان والجذع يميل للخلف قبل الخطوة الأولى", () => {
    const st = locomote(15, { x0: 0, moves: [{ start: 20, dx: 500, gait: "walk" }], scale: SCALE, fps: FPS });
    expect(st.moving).toBe(false);
    expect(st.dip).toBeGreaterThan(0.5);
    expect(st.lean).toBeLessThan(0);
  });

  it("بعد التوقف: الجذع يندفع للأمام ثم يستقر، والثوب يتابع ثم يهدأ", () => {
    const o = { x0: 0, moves: [{ start: 10, dx: 600, gait: "walk" as const }], scale: SCALE, fps: FPS };
    let stop = 0;
    for (let f = 0; f < 300; f++) if (locomote(f, o).moving) stop = f;
    let pitch = 0;
    for (let f = stop - 20; f <= stop + 10; f++) pitch = Math.max(pitch, locomote(f, o).lean);
    const settled = locomote(stop + 120, o);
    expect(pitch).toBeGreaterThan(0.6);
    // التأرجح الراجع بعد الاندفاع أصغر من الاندفاع نفسه
    let back = 0;
    for (let f = stop; f <= stop + 60; f++) back = Math.min(back, locomote(f, o).lean);
    expect(Math.abs(back)).toBeLessThan(pitch);
    expect(Math.abs(settled.lean)).toBeLessThan(0.15);
    expect(Math.abs(settled.sway)).toBeLessThan(0.5);
  });

  it("المشي يتلاشى إلى الوقوف: الوضعية بعد التوقف هي وضعية الأساس", () => {
    const o = { x0: 0, moves: [{ start: 10, dx: 500, gait: "stroll" as const }], scale: SCALE, fps: FPS };
    const p = locoPose(POSES.stand, locomote(300, o));
    expect(p.legFront).toEqual(POSES.stand.legFront);
    expect(p.armBack).toEqual(POSES.stand.armBack);
  });
});

describe("الالتفاتة بالجسد", () => {
  it("دوران حقيقي بلا تضييق: الجسد يمر بثلاثة أرباع ثم يواجه الناظر ثم ينقلب، والزاوية متصلة", () => {
    const o = { x0: 0, facing0: 1 as const, moves: [], turns: [{ at: 20, to: -1 as const, dur: 16 }], scale: SCALE, fps: FPS };
    let prev = locomote(0, o);
    let peak = 0;
    for (let f = 1; f < 60; f++) {
      const st = locomote(f, o);
      // الاتجاه دائمًا كامل (±1): لا يُضيَّق عرض الشخصية أبدًا
      expect(Math.abs(st.facing)).toBe(1);
      expect(Math.abs(st.view - prev.view)).toBeLessThan(0.25);
      // الانقلاب يقع فقط والجسد مواجه للناظر تقريبًا (حيث الرسم متماثل)
      if (st.facing !== prev.facing) expect(Math.min(st.view, prev.view)).toBeGreaterThan(0.9);
      peak = Math.max(peak, st.view);
      prev = st;
    }
    expect(peak).toBeGreaterThan(0.95);
    expect(prev.facing).toBe(-1);
    expect(prev.view).toBe(0);
  });

  it("حركة بعكس الاتجاه الحالي تبدأ بالتفاتة تلقائية قبلها", () => {
    const o = { x0: 0, facing0: 1 as const, moves: [{ start: 40, dx: -400, gait: "walk" as const }], scale: SCALE, fps: FPS };
    expect(locomote(20, o).facing).toBe(1);
    expect(locomote(20, o).view).toBe(0);
    expect(locomote(33, o).view).toBeGreaterThan(0.3);
    expect(locomote(41, o).facing).toBe(-1);
  });
});

describe("جودة المشية (الأمر 007)", () => {
  it("تأرجح الذراع ناعم: لا انكسار في منحنى زاويتها", () => {
    const o = { x0: 0, moves: [{ start: 10, dx: 900, gait: "brisk" as const }], scale: SCALE, fps: FPS };
    const arm = Array.from({ length: 160 }, (_, f) => locoPose(POSES.stand, locomote(f, o)).armFront.s);
    // نعومة البندول: تغير السرعة الزاوية بين إطارين صغير (لا زوايا حادة في المنحنى كالمثلث القديم)
    let maxAcc = 0;
    for (let f = 40; f < 80; f++) maxAcc = Math.max(maxAcc, Math.abs(arm[f]! - 2 * arm[f - 1]! + arm[f - 2]!));
    // البندول الجيبي ≈ 1.16 درجة/إطار²، والصيغة المثلثية القديمة ≈ 3.6 (انكسار عند كل انعكاس)
    expect(maxAcc).toBeLessThan(1.3);
  });

  it("الثوب يرفرف مع الخطوات أثناء المشي ثم يهدأ بعد التوقف", () => {
    const o = { x0: 0, moves: [{ start: 10, dx: 900, gait: "walk" as const }], scale: SCALE, fps: FPS };
    const sw = Array.from({ length: 40 }, (_, i) => locomote(60 + i, o).sway);
    expect(Math.max(...sw) - Math.min(...sw)).toBeGreaterThan(0.3);
    expect(Math.abs(locomote(400, o).sway)).toBeLessThan(0.5);
  });

  it("المشية المتثاقلة أبطأ من المتمهلة لكنها لا تجر القدمين: خطوة لا تقل عن ثلثي المتمهلة", async () => {
    const { GAITS } = await import("../src/remotion/illus/gait");
    expect(GAITS.heavy.ax / GAITS.stroll.ax).toBeGreaterThan(0.66);
    expect(gaitSpeed("heavy", SCALE, FPS)).toBeLessThan(gaitSpeed("stroll", SCALE, FPS));
  });
});

describe("الطبقة المشتركة characterAt", () => {
  it("بالحركات: نفس النتيجة التي يعطيها locomote", async () => {
    const { characterAt } = await import("../src/remotion/illus/gait");
    const o = { x0: 300, moves: [{ start: 5, dx: 500, gait: "walk" as const }], scale: SCALE, fps: FPS };
    const c = characterAt(70, POSES.stand, o);
    const st = locomote(70, o);
    expect(c.x).toBe(st.x);
    expect(c.pose).toEqual(locoPose(POSES.stand, st));
  });

  for (const gait of GAIT_IDS) {
    it(`بسرعة يفرضها القالب (الطريق): القدم ثابتة على الأرض المتحركة في مشية ${gait}`, async () => {
      const { characterAt } = await import("../src/remotion/illus/gait");
      // الطريق: 5.2 وحدة لكل إطار، مقياس 1.95
      const S = 1.95;
      const vel = () => -5.2;
      const xs: number[] = [];
      const poses: PoseSpec[] = [];
      for (let f = 30; f < 150; f++) {
        const c = characterAt(f, POSES.stand, { x0: 0, facing0: -1, moves: [], scale: S, fps: FPS, velocity: vel, gait });
        xs.push(c.x);
        poses.push(c.pose);
      }
      const slips: number[] = [];
      let prevC: string | null = null;
      let prevX = 0;
      for (let i = 0; i < poses.length; i++) {
        const g = legGeometry(poses[i]!);
        const contact = g.back.f[1] >= g.front.f[1] ? "back" : "front";
        const fx = xs[i]! - g[contact].f[0] * S;
        if (contact === prevC) slips.push(Math.abs(fx - prevX));
        prevC = contact;
        prevX = fx;
      }
      expect(mean(slips)).toBeLessThan(5.2 * 0.12);
    });
  }

  it("فحص الخطة: حركة الطريق ومشيته تُفحصان، والافتراضي القديم لا يحتاج شيئًا", async () => {
    const { planIssues } = await import("../src/plan/validate");
    const scene = (props: Record<string, string>) => ({
      version: 1 as const, episode: "000", title: "t", domain: "psychology" as const, themeId: "night" as const, channel: "balislam", updatedAt: "",
      chapters: [{ number: 1, title: "t", scenes: [{ id: "c1-s1", template: "road-journey", narration: "يمشي في الطريق.", line: 0, props, sfx: [] }] }],
    });
    const msgs = (props: Record<string, string>) => planIssues(scene(props) as never).map((i) => i.message).join("\n");
    expect(msgs({ motion: "fly" })).toContain("حركة المسافر غير معروفة");
    expect(msgs({ motion: "natural", gait: "run" })).toContain("المشية غير معروفة");
    expect(msgs({ gait: "stroll" })).toContain("إلا مع motion = natural");
    expect(msgs({})).not.toMatch(/المسافر|المشية/);
    expect(msgs({ motion: "natural", gait: "heavy" })).not.toMatch(/المسافر|المشية/);
  });
});

describe("انتقال الوضعيات", () => {
  it("المدة تتبع حجم التغيير: إيماءة صغيرة أسرع من انحناءة كبيرة", () => {
    expect(transitionFrames(POSES.stand, POSES.nod)).toBeLessThan(transitionFrames(POSES.stand, POSES["head-down"]));
    expect(transitionFrames(POSES.stand, POSES.stand)).toBe(10);
    expect(transitionFrames(POSES.stand, POSES["head-down"])).toBeLessThanOrEqual(28);
  });

  it("الرأس يتأخر عن الجذع (تداخل الحركة)، والانتقال يكتمل", () => {
    const tl = [
      { at: 0, pose: "stand" as const },
      { at: 10, pose: "head-down" as const },
    ];
    const mid = poseAtNatural(16, tl);
    const tBody = (mid.lean - POSES.stand.lean) / (POSES["head-down"].lean - POSES.stand.lean);
    const tHead = (mid.head - POSES.stand.head) / (POSES["head-down"].head - POSES.stand.head);
    expect(tHead).toBeLessThan(tBody);
    expect(poseAtNatural(80, tl)).toEqual(POSES["head-down"]);
  });

  it("حتمية: نفس الإطار يعطي نفس الحالة", () => {
    const o = { x0: 100, moves: [{ start: 5, dx: 300, gait: "heavy" as const }], scale: SCALE, fps: FPS };
    expect(locomote(77, o)).toEqual(locomote(77, o));
  });
});
