import { describe, expect, it, vi } from "vitest";
import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { parseScript } from "../src/script/parse";
import { generatePlan } from "../src/plan/generate";
import { templateById } from "../src/plan/templates";
import { templateExclusion } from "../src/channel/library";
import { planIssues } from "../src/plan/validate";
import type { ChannelConfig } from "../src/channel/types";
import type { Plan } from "../src/plan/types";
import { BASE_FEATURE_IDS, ENGINE_FEATURES, applyEngineDefaults, channelEngineFeatures, engineDefaultsIssues, engineEnabled, engineStatus } from "../src/plan/engine";

let F = 0;
vi.mock("remotion", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  return { ...m, useCurrentFrame: () => F, useVideoConfig: () => ({ fps: 30, width: 1920, height: 1080, durationInFrames: 300, id: "t", defaultProps: {}, props: {}, defaultCodec: null }) };
});
const { LightStage } = await import("../src/remotion/scenes/LightStage");
const { activeTransition } = await import("../src/remotion/scenes/Episode");

const channel = (id: string) => JSON.parse(readFileSync(`channels/${id}/channel.json`, "utf8")) as ChannelConfig;
const BAL = channel("balislam");
const allowed = (c: ChannelConfig) => (t: string) => !templateExclusion(c, t);
const EP = "channels/balislam/episodes/001-know-the-truth";
const script = parseScript(readFileSync(`${EP}/script.md`, "utf8"));
const oldPlan = JSON.parse(readFileSync(`${EP}/plan.json`, "utf8")) as Plan;
const strip = (p: Plan) => ({ ...p, updatedAt: "" });
const approved = (ids = BASE_FEATURE_IDS): ChannelConfig => ({ ...BAL, production: { defaults: [...ids] } });

describe("التوجيه الدائم — كل أداة لها مكان في الإنتاج الفعلي لـ«بالإسلام»", () => {
  it("كل قالب تعلن أداة دعمه موجود في مكتبة «بالإسلام» ومبني", () => {
    for (const f of ENGINE_FEATURES)
      for (const t of f.templates ?? []) {
        expect(templateById(t)?.implemented, `${f.id} ← ${t}`).toBe(true);
        expect(templateExclusion(BAL, t), `${f.id} ← ${t}`).toBeNull();
      }
  });
  it("كل حقل يكتبه أساس معتمد له أداة تحكم في محرر المشهد", () => {
    for (const f of ENGINE_FEATURES)
      for (const [t, sets] of Object.entries(f.sets ?? {}))
        for (const k of Object.keys(sets)) expect(templateById(t)!.fields.some((x) => x.key === k), `${t}.${k}`).toBe(true);
  });
  it("أدوات المحرك التي تقرؤها قوالب القناة المصوَّرة كلها ظاهرة في المحرر (لا شيء خفي لا يُضبط إلا بتعديل JSON)", () => {
    const need: Record<string, string[]> = {
      "alley-tale": ["cameraMode", "cameraPlan", "cameraPlanPortrait", "gait", "poseTimeline", "lighting"],
      "road-journey": ["motion", "gait", "lighting"],
      "light-stage": ["motion", "gait"],
    };
    for (const [t, keys] of Object.entries(need)) for (const k of keys) expect(templateById(t)!.fields.some((x) => x.key === k), `${t}.${k}`).toBe(true);
  });
  it("الحالة واضحة: البنية مفعّلة دائمًا، والمؤثرات متاحة ولا تُفرض، والأساس ينتظر الاعتماد ما لم يُعتمد", () => {
    const st = Object.fromEntries(channelEngineFeatures("balislam").map((f) => [f.id, engineStatus(f, BAL, allowed(BAL))]));
    expect(st).toMatchObject({ "render-queue": "always", gate: "always", lighting: "available", transitions: "available" });
    for (const id of BASE_FEATURE_IDS) expect(st[id], id).toBe(BAL.production?.defaults?.includes(id) ? "default" : "awaiting-approval");
    expect(engineStatus(ENGINE_FEATURES.find((f) => f.id === "composed-camera")!, approved(), allowed(BAL))).toBe("default");
  });
});

describe("الافتراضي المعتمد للحلقات الجديدة فقط", () => {
  it("بلا اعتماد: الخطة الجديدة كما كانت حرفيًا", () => {
    const a = strip(generatePlan(script, null, {}, { ...BAL, production: undefined }));
    const b = strip(generatePlan(script, null, {}, { ...BAL, production: { defaults: [] } }));
    expect(b).toEqual(a);
    expect(a.engineDefaults).toBeUndefined();
  });
  it("بالاعتماد: يُختم في الخطة الجديدة ويُكتب في مشاهد قوالبه (لا فوق قيمة موجودة ولا على لقطة مصمَّمة)", () => {
    const p = generatePlan(script, null, {}, approved());
    expect(p.engineDefaults).toEqual(BASE_FEATURE_IDS);
    const alley = p.chapters.flatMap((c) => c.scenes).filter((s) => s.template === "alley-tale");
    expect(alley.length).toBeGreaterThan(0);
    for (const s of alley) expect(s.props.cameraMode, s.id).toBe(s.props.shot ? undefined : "composed");
    const sc = { template: "alley-tale", props: { cameraMode: "directed" } as Record<string, string> };
    applyEngineDefaults(sc, ["composed-camera"]);
    expect(sc.props.cameraMode).toBe("directed");
    const st = { template: "light-stage", props: {} as Record<string, string> };
    applyEngineDefaults(st, BASE_FEATURE_IDS);
    expect(st.props.motion).toBe("natural");
  });
  it("الخطة الجديدة المعتمدة تجتاز فحص الخطة بلا خطأ جديد", () => {
    const base = planIssues(generatePlan(script, null, {}, BAL), BAL).filter((i) => i.level === "error").map((i) => i.message);
    const withDefaults = planIssues(generatePlan(script, null, {}, approved()), BAL).filter((i) => i.level === "error").map((i) => i.message);
    expect(withDefaults).toEqual(base);
  });
  it("الحلقة القائمة (001) لا تتغير بإعادة التوليد بعد أي اعتماد", () => {
    expect(strip(generatePlan(script, oldPlan, {}, approved()))).toEqual(strip(generatePlan(script, oldPlan, {}, BAL)));
    expect(oldPlan.engineDefaults).toBeUndefined();
  });
  it("الخطة المختومة تحتفظ بختمها وإن أُلغي الاعتماد لاحقًا (إعادة إنتاج النسخة نفسها)", () => {
    const p = generatePlan(script, null, {}, approved(["composed-camera"]));
    const again = generatePlan(script, p, {}, BAL);
    expect(again.engineDefaults).toEqual(["composed-camera"]);
    expect(strip(again)).toEqual(strip(generatePlan(script, p, {}, approved())));
  });
  it("الاستوديو لا يقبل افتراضيًا غير أساس، ولا أداة غير مفعّلة للقناة", () => {
    expect(engineDefaultsIssues(["composed-camera"], allowed(BAL), "balislam")).toEqual([]);
    expect(engineDefaultsIssues(["lighting"], allowed(BAL), "balislam")).toHaveLength(1);
    expect(engineDefaultsIssues(["nope"], allowed(BAL), "balislam")).toHaveLength(1);
    expect(engineDefaultsIssues("x", allowed(BAL), "balislam")).toHaveLength(1);
    const dz = channel("dafatir-alzaman");
    expect(engineDefaultsIssues(["composed-camera"], allowed(dz), "dafatir-alzaman").length).toBeGreaterThan(0);
  });
});

describe("العزل: تطوير «بالإسلام» لا يدخل استوديو القنوات الأخرى", () => {
  it("لا لوحة أدوات ولا انتقالات ولا افتراضيات لغير «بالإسلام»", () => {
    for (const id of ["dafatir-alzaman", "zubdat-alkutub"]) {
      expect(channelEngineFeatures(id), id).toEqual([]);
      expect(engineEnabled("transitions", id)).toBe(false);
      expect(channel(id).production, id).toBeUndefined();
    }
    expect(engineEnabled("transitions", "balislam")).toBe(true);
    expect(engineEnabled("render-queue", "zubdat-alkutub")).toBe(true);
  });
  it("حقل انتقال في خطة قناة أخرى يُرفض ولا يُطبَّق", () => {
    const scenes = [
      { id: "a", template: "kinetic-text", narration: "أ", line: 1, props: {}, sfx: [] },
      { id: "b", template: "kinetic-text", narration: "ب", line: 2, props: {}, sfx: [], transition: "fade" },
    ];
    const plan = { version: 1, episode: "x", title: "t", domain: "general", themeId: "paper", channel: "zubdat-alkutub", updatedAt: "", chapters: [{ number: 1, title: "", scenes }] } as unknown as Plan;
    expect(planIssues(plan).some((i) => i.level === "error" && /غير مفعّلة/.test(i.message))).toBe(true);
    expect(activeTransition(scenes[1] as never, scenes[0] as never, "zubdat-alkutub")).toBeNull();
    expect(activeTransition(scenes[1] as never, scenes[0] as never, "balislam")?.kind).toBe("fade");
  });
});

describe("«ظل ونور» — المشي الطبيعي (اختياري)", () => {
  const props = { themeId: "night", orientation: "landscape", narration: "يقف وحده في الظلام. ثم يمشي نحو الضوء. ويعرف الحقيقة أخيرًا.", mood: "night", poses: "stand,stand,look-up", cues: "truth | الحقيقة" } as const;
  const draw = (frame: number, extra: Record<string, string> = {}) => {
    F = frame;
    return renderToStaticMarkup(React.createElement(LightStage, { ...props, ...extra } as never));
  };
  it("بلا الحقل كما هو حرفيًا، وmotion = legacy مثله", () => {
    for (const f of [0, 80, 150]) expect(draw(f, { motion: "legacy" })).toBe(draw(f));
  });
  it("الطبيعية تغيّر الحركة بين العلامات وتبقى في أول إطار كما هي", () => {
    expect(draw(0, { motion: "natural" })).toBe(draw(0));
    const differs = [90, 110, 130, 180, 220].some((f) => draw(f, { motion: "natural" }) !== draw(f));
    expect(differs).toBe(true);
  });
  it("الفحص يرفض قيمة مجهولة وينبه للمشية بلا الحركة الطبيعية", () => {
    const sc = (p: Record<string, string>) => ({ version: 1, episode: "x", title: "t", domain: "general", themeId: "night", channel: "balislam", updatedAt: "", chapters: [{ number: 1, title: "", scenes: [{ id: "a", template: "light-stage", narration: "نص.", line: 1, props: p, sfx: [] }] }] }) as unknown as Plan;
    expect(planIssues(sc({ motion: "fly" })).some((i) => i.level === "error")).toBe(true);
    expect(planIssues(sc({ gait: "walk" })).some((i) => i.level === "warning" && /natural/.test(i.message))).toBe(true);
    expect(planIssues(sc({ motion: "natural", gait: "brisk" })).filter((i) => /المشية|حركة البطل/.test(i.message))).toEqual([]);
  });
});

describe("الكاميرا المؤلَّفة — الكلمة داخل الإطار", () => {
  it("الكلمة لا تُقص على حافة الإطار الظاهر في العمودي والأفقي", async () => {
    const { pillInView } = await import("../src/remotion/scenes/AlleyTale");
    for (const portrait of [true, false])
      for (const z of [1, 1.28, 1.6])
        for (const x of [-400, 200, 960, 1700, 2400]) {
          const c = { x: 960, y: 540, z };
          const px = pillInView(x, "باطل", c, portrait);
          const half = (portrait ? 304 : 960) / z;
          const w = "باطل".length * 46 * 0.58 + 64;
          expect(px - w / 2, `${portrait} ${z} ${x}`).toBeGreaterThanOrEqual(c.x - half);
          expect(px + w / 2, `${portrait} ${z} ${x}`).toBeLessThanOrEqual(c.x + half);
        }
  });
});
