import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { easeOf, EASES, parseTransition, transitionIssues, TRANSITION_KINDS, carryReady } from "../src/plan/transitions";
import type { Plan, PlanScene } from "../src/plan/types";
import { planIssues } from "../src/plan/validate";
import { sceneHash as sceneFingerprint } from "../src/plan/sceneReview";
import { fitFrames, locomote, withCarry } from "../src/remotion/illus/gait";

let F = 0;
vi.mock("remotion", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return { ...m, useCurrentFrame: () => F, useVideoConfig: () => ({ fps: 30, width: 1920, height: 1080, durationInFrames: 300, id: "t", defaultProps: {}, props: {}, defaultCodec: null }) };
});
const { TransitionIn, TransitionContext, useTransition } = await import("../src/remotion/scenes/transitions");

const sc = (id: string, over: Partial<PlanScene> = {}): PlanScene =>
  ({ id, template: "alley-tale", narration: "يمشي في الطريق مساء.", props: { place: "alley", cameraMode: "composed", cast: "solo" }, ...over }) as PlanScene;

describe("الانتقالات — صيغة الخطة", () => {
  it("بلا حقل لا انتقال (السلوك القائم)", () => {
    expect(parseTransition(undefined)).toBeNull();
    expect(parseTransition("  ")).toBeNull();
  });
  it("كل نوع يُقرأ بمعاملاته ومدته ومنحناه", () => {
    const ok = ["cut", "fade", "push left", "zoom in 0.3 0.6", "mask arch 0.5 0.6", "mask wipe up", "through 0.6 0.5 0.4 0.5", "morph arch star", "light 0.5 0.3", "carry right"];
    for (const t of ok) expect(parseTransition(t)?.ok, t).toBe(true);
    const r = parseTransition("push right dur 40 ease spring");
    expect(r).toEqual({ ok: true, t: { kind: "push", dir: "right", dur: 40, ease: "spring" } });
    expect(new Set(ok.map((t) => t.split(" ")[0]))).toEqual(new Set(TRANSITION_KINDS));
  });
  it("يرفض بنص واضح: نوع مجهول، مدة خارج الحد، منحنى مجهول، نقطة خارج الإطار، مدة للقطع", () => {
    for (const t of ["slide", "fade dur 3", "fade dur 200", "push left ease bounce", "zoom in 1.4 0.5", "push", "morph arch hexagon", "cut dur 10", "carry up", "fade 0.5"]) {
      const r = parseTransition(t);
      expect(r?.ok, t).toBe(false);
      if (r && !r.ok) expect(r.error.length).toBeGreaterThan(8);
    }
  });
  it("منحنيات التسارع تبدأ من 0 وتنتهي عند 1 تمامًا", () => {
    for (const e of EASES) {
      expect(easeOf(e)(0), e).toBeCloseTo(0, 6);
      expect(easeOf(e)(1), e).toBe(1);
    }
  });
});

describe("الانتقالات — فحص الخطة يرفض ما لا يدعمه القالب", () => {
  const msgs = (s: PlanScene, p?: PlanScene) => transitionIssues(s, p).filter((i) => i.level === "error").map((i) => i.message);
  it("أول مشهد في الفصل", () => expect(msgs(sc("a", { transition: "fade" }))).toHaveLength(1));
  it("السبورة (لها انتقالها الخاص) في أي طرف", () => {
    expect(msgs(sc("b", { transition: "fade" }), sc("a", { template: "dua-board" })).join()).toMatch(/dua-board/);
    expect(msgs(sc("b", { template: "dua-board", transition: "cut" }), sc("a", { props: { place: "market" } })).join()).toMatch(/dua-board/);
  });
  it("الآية وذكر الله: القطع والمزج فقط", () => {
    const verse = sc("a", { template: "verse-card", narration: "" });
    expect(msgs(sc("b", { transition: "mask arch" }), verse).join()).toMatch(/آية/);
    expect(msgs(sc("b", { transition: "fade" }), verse)).toEqual([]);
    expect(msgs(sc("b", { transition: "light", narration: "الحمد لله على كل حال." }), sc("a", { props: { place: "market" } }))).not.toEqual([]);
  });
  it("الحارة في المكان نفسه: قطع أو استمرار حركة فقط", () => {
    expect(msgs(sc("b", { transition: "push left" }), sc("a"))).not.toEqual([]);
    expect(msgs(sc("b", { transition: "push left", props: { ...sc("b").props, place: "market" } }), sc("a"))).toEqual([]);
    expect(msgs(sc("b", { transition: "cut" }), sc("a"))).toEqual([]);
  });
  it("carry يشترط الكاميرا المؤلَّفة وبطلًا وحده يمشي في الطرفين", () => {
    expect(msgs(sc("b", { transition: "carry left", props: { place: "market", cameraMode: "composed" } }), sc("a"))).toEqual([]);
    expect(carryReady(sc("a", { props: { place: "alley" } }))).toMatch(/composed/);
    expect(carryReady(sc("a", { props: { cameraMode: "composed", cast: "companion" } }))).toMatch(/solo/);
    expect(carryReady(sc("a", { props: { cameraMode: "composed", poses: "sit" } }))).toMatch(/جالس/);
    expect(carryReady(sc("a", { template: "light-stage" }))).toBeTruthy();
    expect(msgs(sc("b", { transition: "carry left", props: { place: "market", cameraMode: "composed" } }), sc("a", { props: { place: "alley" } })).join()).toMatch(/السابق/);
  });
  it("المراجعة: بصمة المشهد لا تتغير لمشهد بلا انتقال، وتتغير بإضافته", () => {
    const s = sc("a");
    expect(sceneFingerprint({ ...s, transition: undefined })).toBe(sceneFingerprint(s));
    expect(sceneFingerprint({ ...s, transition: "fade" })).not.toBe(sceneFingerprint(s));
  });
  it("الخطط القائمة في كل القنوات: لا رسالة انتقال جديدة (لا حقل فيها)", () => {
    for (const ch of ["balislam", "dafatir-alzaman", "zubdat-alkutub"]) {
      const dir = `channels/${ch}/episodes`;
      if (!existsSync(dir)) continue;
      for (const ep of readdirSync(dir)) {
        const f = `${dir}/${ep}/plan.json`;
        if (!existsSync(f)) continue;
        const plan = JSON.parse(readFileSync(f, "utf8")) as Plan;
        const info = JSON.parse(readFileSync(`channels/${ch}/channel.json`, "utf8"));
        const ts = planIssues(plan, info).filter((i) => /الانتقال/.test(i.message));
        expect(ts, `${ch}/${ep}`).toEqual([]);
      }
    }
  });
});

describe("الانتقالات — الرسم", () => {
  const draw = (t: string, frame: number) => {
    F = frame;
    const r = parseTransition(t);
    if (!r?.ok) throw new Error(t);
    return renderToStaticMarkup(
      <TransitionIn t={r.t} outgoing={<i>OUTGOING</i>} colors={{ bg: "#0B1F1C", light: "#F2B35B" }}>
        <b>INCOMING</b>
      </TransitionIn>,
    );
  };
  it("كل نوع ذي مدة: المشهدان معًا داخل النافذة، والداخل وحده بعدها كما هو حرفيًا", () => {
    for (const t of ["fade", "push left", "zoom in", "zoom out 0.2 0.8", "mask arch", "mask circle 0.3 0.4", "mask wipe right", "through 0.6 0.5 0.4 0.5", "morph arch star", "morph circle square 0.7 0.3", "light 0.5 0.3"]) {
      const dur = (parseTransition(t) as { t: { dur: number } }).t.dur;
      for (const f of [0, Math.floor(dur / 2), dur - 1]) {
        const html = draw(t, f);
        if (t.startsWith("light")) {
          // الضوء: في نصفه الأول يُرى الخارج وحده يخبو نحو النقطة، ثم يظهر الداخل منها (لا يُرسمان معًا)
          const firstHalf = f < dur / 2 - 1;
          if (firstHalf) expect(html, `${t} @${f}`).toMatch(/OUTGOING/);
          else expect(html, `${t} @${f}`).toMatch(/INCOMING/);
          expect(/OUTGOING/.test(html) && /INCOMING/.test(html), `${t} @${f}`).toBe(false);
          continue;
        }
        expect(html, `${t} @${f}`).toMatch(/INCOMING/);
        expect(html, `${t} @${f}`).toMatch(/OUTGOING/);
      }
      expect(draw(t, dur)).toBe("<b>INCOMING</b>");
      expect(draw(t, dur + 30)).toBe("<b>INCOMING</b>");
    }
  });
  it("القطع واستمرار الحركة بلا طبقة انتقال", () => {
    expect(draw("cut", 0)).toBe("<b>INCOMING</b>");
    expect(draw("carry left", 0)).toBe("<b>INCOMING</b>");
  });
  it("المنحنى يغير الإطار الأوسط ولا يغير النهاية", () => {
    expect(draw("push left dur 20 ease linear", 6)).not.toBe(draw("push left dur 20 ease in", 6));
    expect(draw("push left dur 20 ease linear", 20)).toBe(draw("push left dur 20 ease in", 20));
  });
  it("سياق الانتقال فارغ افتراضيًا (المشاهد القديمة لا تتأثر)", () => {
    let seen: unknown = null;
    const Probe = () => {
      seen = useTransition();
      return null;
    };
    renderToStaticMarkup(<Probe />);
    expect(seen).toEqual({});
    renderToStaticMarkup(
      <TransitionContext.Provider value={{ holdExit: true }}>
        <Probe />
      </TransitionContext.Provider>,
    );
    expect(seen).toEqual({ holdExit: true });
  });
});

describe("استمرار الحركة (carry) — خطة المشي", () => {
  const base = { x0: 1060, facing0: -1 as const, moves: [{ start: 40, dx: -300, gait: "walk" as const }], turns: [], gait: "walk" as const, dur: 300, fps: 30, scale: 1.75, worldW: 1920 };
  const at = (plan: ReturnType<typeof withCarry>, f: number) => locomote(f, { ...plan, turns: [], scale: 1.75, fps: 30 });
  it("بلا carry الخطة كما هي حرفيًا", () => {
    const r = withCarry(base);
    expect(r.moves).toBe(base.moves);
    expect(r.x0).toBe(1060);
  });
  it("الدخول: خارج الإطار في الإطار 0 وماشٍ بالسرعة الكاملة منذه، ثم يقف في موضعه المعتاد", () => {
    const r = withCarry({ ...base, carryIn: "left" });
    const s0 = at(r, 0);
    const s1 = at(r, 1);
    expect(s0.x).toBeGreaterThan(1920 + 40);
    expect(s0.amount).toBeCloseTo(1, 2);
    expect(s1.amount).toBeCloseTo(1, 2);
    expect(s0.dip).toBe(0);
    expect(s0.v).toBeLessThan(0);
    const end = fitFrames("walk", 1920 + 60 - 1060, 1.75, 30, true, false);
    expect(at(r, Math.ceil(end) + 2).x).toBeCloseTo(1060, 0);
    expect(r.moves.some((m) => m.start === 40)).toBe(false);
  });
  it("الخروج: يغادر الإطار مع آخر إطار ماشيًا بلا تباطؤ", () => {
    const r = withCarry({ ...base, carryOut: "left" });
    const last = at(r, base.dur - 1);
    expect(last.x).toBeLessThan(-40);
    expect(last.amount).toBeGreaterThan(0.95);
    // قبل الخروج يكمل حركة سطره كما كانت
    expect(at(r, 150).x).toBeCloseTo(at(withCarry(base), 150).x, 0);
  });
  it("السرعة متصلة عبر الحد: سرعة الخروج = سرعة الدخول", () => {
    const out = at(withCarry({ ...base, carryOut: "right" }), base.dur - 1);
    const inn = at(withCarry({ ...base, carryIn: "right" }), 0);
    expect(Math.sign(out.v)).toBe(1);
    expect(Math.sign(inn.v)).toBe(1);
    expect(inn.v).toBeCloseTo(out.v, 3);
  });
});
