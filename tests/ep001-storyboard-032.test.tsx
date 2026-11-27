import React from "react";
import fs from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EP001_SCENE_SHOTS, EP001_SHOTS, OCCLUDER, SCALE_TILT, WEIGHT_PAN_BOX } from "../src/remotion/illus/shots/ep001";
import { CHAIR_SHORT, PHONE_IMAGE, StoryNotebook, StoryPhone, TEAR, TornLeaf, chairFeet, phoneCrop } from "../src/remotion/illus/storyProps";
import { isSacredSentence } from "../src/plan/sceneCues";
import { ctxFor, framingIssues, planScenes, shotScenes, type PlanScene, STORY_SHOTS } from "./helpers/ep001Shots";

/**
 * الأمر 032: تنفيذ تصورات الحلقة 001 المعتمدة تصميمًا (القرار 031). المعايير من حزمة التسليم
 * (`handoff-031/README.md` البند ٧ بتصحيحات 032)، وتُقرأ من الرسم نفسه (سمات data-*) لا من وصفه.
 */
// الفحوص ترسم كل لقطة عند إطارات كثيرة بالاتجاهين
vi.setConfig({ testTimeout: 180_000 });

const byId = new Map(planScenes().map((s) => [s.id, s]));
const scene = (id: string) => byId.get(id)!;
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => `c1-s${a + i}`);
const markup = (s: PlanScene, frame: number, portrait = false) => {
  const c = ctxFor(s, portrait);
  const f = Math.max(0, Math.min(c.dur - 1, frame));
  return renderToStaticMarkup(<svg>{STORY_SHOTS[s.props.shot!]!.render({ frame: f, fps: 30, dur: c.dur, portrait, at: c.at }).world}</svg>);
};
const frames = (s: PlanScene, step = 6) => {
  const { dur } = ctxFor(s, false);
  return Array.from({ length: Math.ceil(dur / step) }, (_, i) => i * step).concat(dur - 1);
};
const attrs = (html: string, name: string) => [...html.matchAll(new RegExp(`${name}="([^"]*)"`, "g"))].map((m) => m[1]!);
const count = (html: string, needle: string) => html.split(needle).length - 1;
const PRE = JSON.parse(fs.readFileSync("channels/balislam/episodes/001-know-the-truth/versions/2026-11-11-a9f06f6d-pre-032/plan.json", "utf8"));
const preScenes = new Map((PRE.chapters as { scenes: PlanScene[] }[]).flatMap((c) => c.scenes).map((s) => [s.id, s]));

/** مشاهد التوقير (تصحيح 032: «نعمة من الله» في c1-s85 لا c1-s88) */
const SACRED = ["c1-s30", "c1-s31", "c1-s67", "c1-s68", "c1-s69", "c1-s70", "c1-s71", "c1-s81", "c1-s85", "c1-s120", "c1-s121"];
/** قصة الأخوين: لا صُرّة عامة في أي موضع منها */
const BROTHERS = [...range(39, 57), "c1-s78", "c1-s79", ...range(105, 107), ...range(109, 111), ...range(125, 132), ...range(134, 139), ...range(142, 147)];
/** حصر إشارات المال التلقائية التي كانت في القصة (منها c1-s79، تصحيح 032) */
const STORY_MONEY = ["c1-s46", "c1-s50", "c1-s55", "c1-s78", "c1-s79", "c1-s136"];

describe("المرحلة الأولى: تسوية المواصفات", () => {
  it("مشاهد التوقير محصورة بنطاقها الصحيح: كل جملة فيها ذكر الله أو دعاء أو آية في القائمة، و c1-s88 ليس منها", () => {
    for (const s of planScenes()) {
      const sacred = s.template === "verse-card" || s.template === "dua-board" || (s.template === "alley-tale" && isSacredSentence(s.narration));
      if (sacred) expect(SACRED, s.id).toContain(s.id);
    }
    expect(scene("c1-s85").narration).toContain("نعمة من الله");
    expect(SACRED).not.toContain("c1-s88");
  });
  it("مشاهد التوقير في الحارة بلا إشارة ولا لقطة ولا شيء في اليد (لا «hold»)", () => {
    for (const id of SACRED.filter((i) => scene(i).template === "alley-tale")) {
      const s = scene(id);
      expect(s.props.cues ?? "", id).toBe("");
      expect(s.props.shot ?? "", id).toBe("");
      expect(s.props.poses ?? "", id).not.toMatch(/hold/);
    }
  });
  it("نص الآيات والدعاء المعروض كما هو حرفًا (يُميَّز عن الرموز الممنوعة: لم يُحذف ولم يُعدَّل)", () => {
    for (const id of SACRED.filter((i) => scene(i).template !== "alley-tale")) expect(scene(id).props, id).toEqual(preScenes.get(id)!.props);
    for (const id of ["c1-s31", "c1-s121"]) expect(scene(id).template).toBe("verse-card");
  });
  it("c1-s89: أُزيلت الصُّرّة بلا رمز بديل، والتكوين باقٍ (الحارة نفسها، بلا شيء في اليد)", () => {
    const s = scene("c1-s89");
    expect(s.props.cues).toBe("");
    expect(s.props.shot ?? "").toBe("");
    expect(s.props.place).toBe(preScenes.get("c1-s89")!.props.place);
    expect(s.props.poses).not.toMatch(/hold/);
  });
  it("إشارات المال التلقائية محصورة: لا «money» في قصة الأخوين، وكل موضع كانت فيه صار لقطة بالقطع أو الظرف", () => {
    for (const id of STORY_MONEY) expect(preScenes.get(id)!.props.cues, id).toMatch(/money/);
    for (const id of BROTHERS) {
      expect(scene(id).props.cues ?? "", id).not.toMatch(/money/);
      expect(scene(id).props.shot, id).toMatch(/^ep001-/);
    }
    // لقطات القصة لا ترسم الصُّرّة العامة أبدًا
    expect(fs.readFileSync("src/remotion/illus/shots/ep001.tsx", "utf8")).not.toMatch(/holding=\{?"coins"/);
  });
  it("السكريبت والنصوص لم تتغير: كل مشهد بنصه ومعرّفه كما كان قبل 032", () => {
    expect(planScenes().map((s) => [s.id, s.narration])).toEqual([...preScenes.values()].map((s) => [s.id, s.narration]));
  });
});

describe("المرحلة الثانية: العناصر المعتمدة", () => {
  it("كل لقطة مستعملة في الخطة موجودة، وخريطة المشاهد هي ما في الخطة", () => {
    for (const [id, shot] of Object.entries(EP001_SCENE_SHOTS)) {
      expect(scene(id).props.shot, id).toBe(shot);
      expect(EP001_SHOTS[shot], shot).toBeDefined();
    }
    expect(shotScenes().map((s) => s.id).sort()).toEqual(Object.keys(EP001_SCENE_SHOTS).sort());
  });
  it("الميزان: حالة واحدة في الواقعة والتذكّر، ولا مؤشر", () => {
    for (const id of [...range(2, 5), ...range(148, 150)])
      for (const f of frames(scene(id), 15)) {
        const html = markup(scene(id), f);
        const tilts = attrs(html, "data-tilt");
        expect(tilts.length, id).toBeGreaterThan(0);
        for (const t of tilts) expect(Number(t), `${id}@${f}`).toBe(SCALE_TILT);
        expect(html).not.toMatch(/needle|pointer/);
      }
  });
  it("الحجب في لقطة الأول: الكيس يغطي الكفة اليسرى والثقل المختوم", () => {
    const inEllipse = (x: number, y: number) => ((x - OCCLUDER.cx) / OCCLUDER.rx) ** 2 + ((y - OCCLUDER.cy) / OCCLUDER.ry) ** 2 <= 1;
    const b = WEIGHT_PAN_BOX;
    for (const [x, y] of [[b.lo, b.top], [b.hi, b.top], [b.lo, b.bottom], [b.hi, b.bottom]] as const) expect(inEllipse(x, y), `${x},${y}`).toBe(true);
    expect(markup(scene("c1-s3"), 30)).toContain('data-prop="occluder"');
    expect(markup(scene("c1-s4"), 30)).not.toContain('data-prop="occluder"');
  });
  it("الكرسي: أربع أرجل، الأمامية اليسرى والخلفية اليمنى على الأرض دائمًا، ولا رجل تحت الأرض؛ القصيرة تلمس عند الميل والإسفين يملأ الفجوة", () => {
    for (let r = 0; r <= 1.0001; r += 0.05) {
      const f = chairFeet(r, 0);
      expect(Math.abs(f.fl)).toBeLessThan(1e-9);
      expect(Math.abs(f.br)).toBeLessThan(1e-9);
      expect(f.fr).toBeGreaterThanOrEqual(-1e-6);
      expect(f.bl).toBeGreaterThanOrEqual(-1e-6);
      // واحدة فقط من القطر الآخر مرفوعة في كل لحظة
      expect(Math.min(f.fr, f.bl)).toBeLessThan(CHAIR_SHORT * 0.5 + 1e-6);
    }
    expect(chairFeet(0).fr).toBeCloseTo(CHAIR_SHORT, 6);
    expect(chairFeet(1).fr).toBeCloseTo(0, 6);
    const shimmed = chairFeet(1, 1);
    expect(shimmed.fr).toBeCloseTo(CHAIR_SHORT, 6);
    expect(shimmed.shim).toBeCloseTo(CHAIR_SHORT, 6);
  });
  it("الكرسي في اللقطات: يهتز في c1-s93 وحده، والإسفين يدخل في c1-s97 فيستقر", () => {
    const rocks = (id: string) => frames(scene(id), 3).map((f) => Number(attrs(markup(scene(id), f), "data-rock")[0]));
    expect(Math.max(...rocks("c1-s93"))).toBeGreaterThan(0.5);
    for (const id of ["c1-s91", "c1-s92", "c1-s94", "c1-s95", "c1-s96", "c1-s97"]) expect(Math.max(...rocks(id)), id).toBe(0);
    const s97 = scene("c1-s97");
    expect(Number(attrs(markup(s97, 0), "data-shim")[0])).toBe(0);
    expect(Number(attrs(markup(s97, 10_000), "data-shim")[0])).toBe(1);
  });
  it("حافة التمزيق واحدة: الدفتر (بقيتا الصفحتين) والورقة يرسمانها من الثابت TEAR نفسه", () => {
    const steps = (d: string) => {
      const pts = [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
      return pts.slice(1).map((p, i) => [p[0]! - pts[i]![0]!, p[1]! - pts[i]![1]!].join(",")).join(";");
    };
    const want = steps(TEAR.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" "));
    const edge = (html: string) => [...html.matchAll(/data-tear-edge="shared"[^>]*?d="([^"]+)"|d="([^"]+)"[^>]*data-tear-edge/g)].map((m) => m[1] ?? m[2]!);
    const nb = renderToStaticMarkup(<svg><StoryNotebook x={0} y={0} tear={1} /></svg>);
    const leaf = renderToStaticMarkup(<svg><TornLeaf x={0} y={0} /></svg>);
    const nbEdges = edge(nb);
    expect(nbEdges.length).toBe(2);
    for (const d of nbEdges) expect(steps(d)).toContain(want);
    expect(steps(leaf.match(/<path d="([^"]+)"/)![1]!)).toContain(want);
  });
  it("الخدوش: باهتة في الظهور الأول (c1-s39، c1-s40) وواضحة عند القطة والمقارنة (c1-s49، c1-s50)", () => {
    for (const id of ["c1-s39", "c1-s40"]) {
      const all = frames(scene(id), 10).flatMap((f) => attrs(markup(scene(id), f), "data-claws"));
      expect(all, id).toContain("faint");
      expect(all, id).not.toContain("clear");
    }
    for (const id of ["c1-s49", "c1-s50"]) expect(frames(scene(id), 10).flatMap((f) => attrs(markup(scene(id), f), "data-claws")), id).toContain("clear");
    expect(markup(scene("c1-s50"), 0)).toContain('data-prop="compare-insert"');
  });
  it("القطع: ثلاث في كل ظهور، ومجموعة واحدة فقط في الإطار", () => {
    for (const s of shotScenes())
      for (const f of frames(s, 9)) {
        const html = markup(s, f);
        const sets = count(html, 'data-prop="three-coins"');
        expect(sets, `${s.id}@${f}`).toBeLessThanOrEqual(1);
        expect(count(html, 'data-prop="coin"'), `${s.id}@${f}`).toBe(3 * sets);
      }
  });
  it("الظرف: يُغلق خلال c1-s55 وحالته النهائية مغلقة، ويبقى مغلقًا حتى يُفتح أول مرة في c1-s136", () => {
    const opens = (id: string) => frames(scene(id), 3).map((f) => attrs(markup(scene(id), f), "data-open").map(Number));
    const s55 = opens("c1-s55");
    expect(s55.some((o) => o.some((v) => v > 0.5))).toBe(true);
    expect(s55.at(-1)).toEqual([0]);
    const closedUntil = ["c1-s56", "c1-s57", "c1-s78", "c1-s79", ...range(105, 107), ...range(109, 111), ...range(125, 132), "c1-s134", "c1-s135"];
    for (const id of closedUntil) for (const o of opens(id)) for (const v of o) expect(v, id).toBe(0);
    for (const id of closedUntil) expect(opens(id).flat().length, `${id}: الظرف ظاهر`).toBeGreaterThan(0);
    expect(opens("c1-s136").flat().some((v) => v > 0.5)).toBe(true);
    // بعد الرد يداه فارغتان: لا ظرف في الاعتذار
    expect(opens("c1-s136").at(-1)).toEqual([]);
    for (const id of ["c1-s137", "c1-s138", "c1-s139"]) expect(opens(id).flat(), id).toEqual([]);
  });
  it("c1-s78: الظرف مغلق ولا قطعة خارجه", () => {
    for (const f of frames(scene("c1-s78"), 3)) {
      const html = markup(scene("c1-s78"), f);
      expect(attrs(html, "data-coins-out")).toEqual(["0"]);
      expect(count(html, 'data-prop="coin"')).toBe(0);
    }
  });
  it("الهاتف: القص نافذة على الصورة الأصلية نفسها في كل درجة، ولا نص مقروء", () => {
    for (let f = 0; f <= 1.0001; f += 0.05) {
      const c = phoneCrop(f);
      expect(c.x).toBeGreaterThanOrEqual(PHONE_IMAGE.x);
      expect(c.y).toBeGreaterThanOrEqual(PHONE_IMAGE.y);
      expect(c.x + c.w).toBeLessThanOrEqual(PHONE_IMAGE.x + PHONE_IMAGE.w);
      expect(c.y + c.h).toBeLessThanOrEqual(PHONE_IMAGE.y + PHONE_IMAGE.h);
    }
    const html = renderToStaticMarkup(<svg><StoryPhone x={0} y={0} full={0.5} people={null} /></svg>);
    expect(html).not.toMatch(/<text/);
    expect(count(html, 'data-image="original"')).toBe(1);
    // (033) لا تعليم فوق الصورة: الكشف هو اتساع الصورة الأصلية وحده
    for (const f of frames(scene("c1-s118"), 6)) expect(markup(scene("c1-s118"), f)).not.toMatch(/data-reveal/);
    // الكشف في c1-s118 يتسع من القص حتى الأصل (يزيد ولا ينقص)
    const fulls = frames(scene("c1-s118"), 6).map((f) => Number(attrs(markup(scene("c1-s118"), f), "data-full")[0]));
    expect(fulls[0]).toBe(0);
    expect(fulls.at(-1)).toBe(1);
    for (let i = 1; i < fulls.length; i++) expect(fulls[i]!).toBeGreaterThanOrEqual(fulls[i - 1]!);
  });
  it("الرد والاعتذار: المخطئ وحده يعتذر، والأخ لا ينحني أبدًا", () => {
    for (const id of range(136, 139))
      for (const f of frames(scene(id), 6)) {
        const html = markup(scene(id), f);
        const bro = html.match(/data-actor="brother" data-pose="([^"]+)"/)?.[1];
        if (bro) expect(["apologize", "head-down"], `${id}@${f}`).not.toContain(bro);
      }
    const s137 = frames(scene("c1-s137"), 6).map((f) => markup(scene("c1-s137"), f).match(/data-actor="hero" data-pose="([^"]+)"/)?.[1]);
    expect(s137).toContain("apologize");
  });
});

describe("المرحلة الثالثة: اللقطات الممتدة", () => {
  const seqOf = (s: PlanScene) => STORY_SHOTS[s.props.shot!]!.seq;
  const story = planScenes().filter((s) => s.props.shot && STORY_SHOTS[s.props.shot]?.seq);
  it("المشاهد المتتالية في لقطة ممتدة: مكان واحد فتُقطع بلا إظلام، والمعرّفات والنصوص كما هي", () => {
    const all = planScenes();
    for (let i = 0; i + 1 < all.length; i++) {
      const a = all[i]!, b = all[i + 1]!;
      if (!a.props.shot || !b.props.shot || !STORY_SHOTS[a.props.shot]?.seq || seqOf(a) !== seqOf(b)) continue;
      expect(STORY_SHOTS[a.props.shot]!.place, `${a.id}→${b.id}`).toBe(STORY_SHOTS[b.props.shot]!.place);
    }
    expect(story.length).toBe(Object.keys(EP001_SCENE_SHOTS).length);
  });
  it("كل مشهد يبدأ من حالة نهاية سابقه في اللقطة الممتدة (الدفتر، الظرف، القطع، الكرسي، الهاتف)", () => {
    const state = (html: string) => ({
      tear: attrs(html, "data-tear"),
      open: attrs(html, "data-open"),
      coins: count(html, 'data-prop="three-coins"'),
      shim: attrs(html, "data-shim"),
      full: attrs(html, "data-full").map((v) => (Number(v) > 0.5 ? 1 : 0)),
    });
    const all = planScenes();
    // استثناءات مقصودة على حدود المشاهد مذكورة في تقرير المطابقة
    const allowed: Record<string, (keyof ReturnType<typeof state>)[]> = {
      "c1-s45→c1-s46": [], // القطع في كف الأخ تظهر في c1-s45 وتبقى فيها أول c1-s46
      "c1-s115→c1-s116": ["full"],
    };
    for (let i = 0; i + 1 < all.length; i++) {
      const a = all[i]!, b = all[i + 1]!;
      if (!a.props.shot || !b.props.shot || !STORY_SHOTS[a.props.shot]?.seq || seqOf(a) !== seqOf(b)) continue;
      const end = state(markup(a, 10_000));
      const start = state(markup(b, 0));
      const skip = allowed[`${a.id}→${b.id}`] ?? [];
      for (const k of Object.keys(end) as (keyof typeof end)[]) if (!skip.includes(k)) expect(start[k], `${a.id}→${b.id} ${k}`).toEqual(end[k]);
    }
  });
});

describe("المرحلة الرابعة: التكوين بالاتجاهين", () => {
  it("لا قص ولا طرف مكان: الأفقي", () => {
    expect(shotScenes().flatMap((s) => framingIssues(s, false))).toEqual([]);
  });
  it("لا قص ولا طرف مكان: العمودي (نافذة 608 من العالم، وتُعرض على شاشة 390 بالتكوين نفسه)", () => {
    expect(shotScenes().flatMap((s) => framingIssues(s, true))).toEqual([]);
  });
  it("الميزان في العمودي: لقطتا الشاهدين بالتتابع، لا لقطة الاثنين", () => {
    const s = scene("c1-s5");
    const c = ctxFor(s, true);
    const shot = STORY_SHOTS[s.props.shot!]!.render({ frame: c.dur - 1, fps: 30, dur: c.dur, portrait: true, at: c.at });
    const html = renderToStaticMarkup(<svg>{shot.world}</svg>);
    expect(count(html, ">ظلم<") + count(html, ">عدل<")).toBeGreaterThan(0);
  });
});
