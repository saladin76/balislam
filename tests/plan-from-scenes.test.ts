import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parseScript } from "../src/script/parse";
import { planFromScenes, parseScenesTable, rowFields } from "../src/plan/fromScenes";
import { generatePlan } from "../src/plan/generate";
import { scriptPlanDivergence, isDesignedPlan } from "../src/plan/designed";
import { unapprovedScenes, loadApprovals } from "../src/plan/templateApproval";
import { quranFromScript } from "../src/quran/scriptText";
import { loadChannel } from "../src/channel";
import { HZ_META } from "../src/remotion/dafatir/horizon/meta";
import { libAnchors } from "../src/remotion/dafatir/lib/scenes";
import { normalizeArabic } from "../src/script/quranMeta";
import { earlyPlanErrors } from "../src/plan/validate";
import type { Plan } from "../src/plan/types";

/**
 * الخطة المصمَّمة لحلقات «البدايات» من scenes.md (`bal plan-from-scenes`): الخطة المتتبَّعة في Git هي ما يبنيه الأمر
 * الآن من السكريبت والجدول (لا خطة متأخرة عن السكريبت)، وكل نص في السكريبت يقوله مشهد، وكل لقطة معتمدة ومعروفة،
 * وكل مرسى لمشهد مكتبة كلمة منطوقة في جملته، وبنية الخطة كخطة 001 (horizon-shot، بلا افتتاحية ولا شاشة نهاية عامة).
 */
const DIR = "channels/dafatir-alzaman/episodes";
const EPS = ["002", "004", "006", "008"];
const dirOf = (e: string) => path.join(DIR, readdirSync(DIR).find((d) => d.startsWith(`${e}-`))!);
const channel = loadChannel("dafatir-alzaman");
const build = (e: string) => {
  const parsed = parseScript(readFileSync(`${dirOf(e)}/script.md`, "utf8"));
  const tracked = JSON.parse(readFileSync(`${dirOf(e)}/plan.json`, "utf8")) as Plan;
  const { plan, report } = planFromScenes({
    parsed, scenesMd: readFileSync(`${dirOf(e)}/scenes.md`, "utf8"), channel,
    quran: quranFromScript(parsed).texts, series: tracked.series, shorts: tracked.shorts, now: tracked.updatedAt,
  });
  return { parsed, plan, report, tracked };
};
const norm = (w: string) => normalizeArabic(w.replace(/[،,.:؛«»"()؟?!]/g, "")).replace(/[أإآ]/g, "ا");

describe.each(EPS)("الخطة المصمَّمة من scenes.md — %s", (ep) => {
  const { parsed, plan, report, tracked } = build(ep);
  const scenes = plan.chapters.flatMap((c) => c.scenes);

  it("الخطة المتتبَّعة هي ما يبنيه الأمر الآن (بلا نصوص الآيات، كما تُكتب)", () => {
    const strip = (p: Plan) => JSON.parse(JSON.stringify({ ...p, updatedAt: "" }, (k, v) => (k === "text" && typeof v === "string" ? "" : v)));
    const scrub = (p: Plan) => { const x = strip(p); for (const s of x.chapters.flatMap((c: Plan["chapters"][number]) => c.scenes)) if (s.template === "hadith-card") delete s.props.text; return x; };
    expect(scrub(tracked)).toEqual(scrub(plan));
  });

  it("لا نص في السكريبت بلا مشهد، ولا مشهد بنص ليس في السكريبت (مقارنة «اعتمد التجهيز»)", () => {
    expect(report.unplaced).toEqual([]);
    expect(report.cardMismatch).toEqual([]);
    const d = scriptPlanDivergence(plan, generatePlan(parsed, null, quranFromScript(parsed).texts, channel));
    expect(d).toEqual({ scenes: [], unplaced: [] });
  });

  it("بنية 001: كل مشهد متكلَّم horizon-shot بلقطة معروفة، وبطاقات الآية والحديث، بلا افتتاحية ولا شاشة نهاية عامة", () => {
    expect(isDesignedPlan(plan)).toBe(true);
    expect(plan.intro).toBe(false);
    expect(plan.chapters).toHaveLength(1);
    expect(scenes.some((s) => s.template === "end-screen")).toBe(false);
    for (const s of scenes) {
      expect(["horizon-shot", "verse-card", "hadith-card"], s.id).toContain(s.template);
      if (s.template === "horizon-shot") expect(HZ_META[s.props.shot!], `${s.id} ${s.props.shot}`).toBeTruthy();
    }
    expect(new Set(scenes.map((s) => s.id)).size).toBe(scenes.length);
    expect(report.unknownShots).toEqual([]);
    expect(report.wordsOnly).toEqual([]);
  });

  it("كل لقطة معتمدة (بوابة D228)، ولا خطأ خطة مبكر", () => {
    expect(unapprovedScenes(plan, loadApprovals())).toEqual([]);
    expect(earlyPlanErrors(plan, channel)).toEqual([]);
  });

  it("كل مرسى لمشهد مكتبة كلمة منطوقة في جملته", () => {
    const bad: string[] = [];
    for (const s of scenes) {
      if (s.template !== "horizon-shot" || String(s.props.shot).startsWith("bd")) continue;
      const words = s.narration.split(/\s+/).map(norm);
      for (const a of libAnchors(s.props.shot!, s.props)) if (!words.includes(norm(a.split("#")[0]!))) bad.push(`${s.id} ${s.props.shot}: «${a}»`);
    }
    expect(bad).toEqual([]);
  });
});

describe("قراءة حقول الصف", () => {
  it("«`key` «value»» و«`key`: «value»» للحقول المعلنة وحدها، وتُترك الحواشي التاريخية", () => {
    const [row] = parseScenesTable("## خطة المشاهد بشكل «خط الأفق»\n| c1-s1 | «نص» | `lib-term` (مكتبة) | (المراجعة العلمية: كان `term` «قديم») `term`: «جديد»، `termWord` «نص»، `foo` «لا» |\n");
    expect(rowFields(row!, "lib-term")).toEqual({ term: "جديد", termWord: "نص" });
  });
});
