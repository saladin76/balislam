import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { designedScenes, DesignedPlanError, isDesignedPlan, scriptPlanDivergence } from "../src/plan/designed";
import { planAfterScriptSave, planPathFor, regeneratePlan } from "../src/plan/io";
import { generatePlan } from "../src/plan/generate";
import { parseScript } from "../src/script/parse";
import { loadChannel } from "../src/channel";
import { SCENES, countAr } from "../src/i18n/count";
import { confirmRegenerate, DESIGNED_PLAN_KEPT, scriptSaveMessage } from "../app/src/planGuard";
import type { Plan } from "../src/plan/types";

/**
 * حادثة دفاتر الزمن 001 (٨ نوفمبر ٢٠٢٦): حفظ السكريبت أعاد توليد plan.json من القالب العام فمحا 81 مشهدًا
 * مصمَّمًا. الخطة المصمَّمة لا تُكتب ضمنيًا أبدًا؛ والمحو الصريح يكتب نسخة احتياطية أولًا.
 */
const REAL = [
  ["balislam", "001-know-the-truth"],
  ["dafatir-alzaman", "001-adam-beginning"],
  ["zubdat-alkutub", "001-awwal-marra-osalli"],
] as const;
const real = (ch: string, ep: string) => path.join(__dirname, "..", "channels", ch, "episodes", ep);
const readPlan = (dir: string) => JSON.parse(readFileSync(path.join(dir, "plan.json"), "utf8")) as Plan;

describe("كشف الخطة المصمَّمة على الخطط القائمة بلا ترحيل", () => {
  it.each(REAL)("%s/%s: الحلقة 001 مصمَّمة ومحمية", (ch, ep) => {
    const plan = readPlan(real(ch, ep));
    expect(isDesignedPlan(plan)).toBe(true);
    expect(designedScenes(plan).length).toBeGreaterThan(0);
  });

  it("المختبرات المصمَّمة محمية أيضًا، والإعلانات بلا لقطات ليست مصمَّمة", () => {
    expect(isDesignedPlan(readPlan(real("dafatir-alzaman", "900-library-lab")))).toBe(true);
    expect(isDesignedPlan(readPlan(real("zubdat-alkutub", "980-kit-lab")))).toBe(true);
    expect(isDesignedPlan(readPlan(real("dafatir-alzaman", "000-trailer")))).toBe(false);
    expect(isDesignedPlan(readPlan(real("zubdat-alkutub", "000-trailer")))).toBe(false);
  });

  it("المولِّد لا ينتج لقطة مصمَّمة إلا إن سمّاها السكريبت نفسه (زبدة الكتب)، والعلم الصريح يكفي", () => {
    for (const [ch, ep] of REAL) {
      const dir = real(ch, ep);
      const script = readFileSync(path.join(dir, "script.md"), "utf8");
      const gen = generatePlan(parseScript(script), null, {}, loadChannel(ch));
      expect(isDesignedPlan(gen), ch).toBe(/shot=/.test(script));
    }
    expect(isDesignedPlan({ chapters: [], designed: true } as never)).toBe(true);
    expect(isDesignedPlan(null)).toBe(false);
  });

  // D142 (بعد KI-070/KI-071): كان هذا الاختبار يثبّت أن السكريبت والخطة متطابقان اليوم، فحمّر main حين صحّح المالك كلمة في
  // السكريبت (بوابة المحتوى لا تشغّل الاختبارات). الاختلاف حالة يعالجها الاستوديو (يمنع إنتاج المشهد المختلف)،
  // فالعقد هنا أن الكشف صادق على الحلقات الحقيقية: لا يُبلَّغ عن مشهد يقوله السكريبت حرفيًا، ولا عن نص تقوله الخطة.
  const flat = (x: string) => x.replace(/\s+/g, " ").trim();
  it.each(REAL)("%s/%s: كشف اختلاف السكريبت والخطة صادق (لا إنذار كاذب)", (ch, ep) => {
    const dir = real(ch, ep);
    const script = readFileSync(path.join(dir, "script.md"), "utf8");
    const plan = readPlan(dir);
    const d = scriptPlanDivergence(plan, generatePlan(parseScript(script), null, {}, loadChannel(ch)));
    const scriptText = flat(script);
    for (const s of d.scenes) expect(scriptText.includes(flat(s.narration)), s.id).toBe(false);
    const planText = flat(plan.chapters.flatMap((c) => c.scenes).map((s) => s.narration).join(" "));
    for (const u of d.unplaced) expect(planText.includes(flat(u.text)), `line ${u.line}`).toBe(false);
  });
});

describe("حفظ السكريبت وإعادة التوليد على خطة مصمَّمة (مجلد مؤقت)", () => {
  let tmp = "";
  let epDir = "";
  let scriptFile = "";
  let planFile = "";
  let originalScript = "";

  beforeAll(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "bal-designed-"));
    cpSync(path.join(__dirname, "..", "channels", "balislam"), path.join(tmp, "balislam"), { recursive: true, filter: (s) => !/[\\/](episodes|voice|out|recitations)([\\/]|$)/.test(s) });
    mkdirSync(path.join(tmp, "balislam", "episodes"), { recursive: true });
    epDir = path.join(tmp, "balislam", "episodes", "000-demo");
    cpSync(path.join(__dirname, "fixtures", "episodes", "000-demo"), epDir, { recursive: true });
    scriptFile = path.join(epDir, "script.md");
    planFile = planPathFor(scriptFile);
    originalScript = readFileSync(scriptFile, "utf8");
    process.env.BAL_CHANNELS_DIR = tmp;
    process.env.BAL_CHANNEL = "balislam";
  });
  afterAll(() => {
    delete process.env.BAL_CHANNELS_DIR;
    delete process.env.BAL_CHANNEL;
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  const backups = () => readdirSync(epDir).filter((f) => /^plan\.backup-.*\.json$/.test(f));
  /** يبني خطة عادية من السكريبت ثم يصمّم مشهدها الأول يدويًا (كما يفعل محرر المشهد). */
  const designFirstScene = async () => {
    for (const f of backups()) rmSync(path.join(epDir, f));
    writeFileSync(scriptFile, originalScript);
    if (existsSync(planFile)) rmSync(planFile);
    await regeneratePlan("000");
    const plan = JSON.parse(readFileSync(planFile, "utf8")) as Plan;
    const first = plan.chapters.flatMap((c) => c.scenes).find((s) => s.narration.trim())!;
    first.props = { ...first.props, shot: "designed-test-shot" };
    first.edited = true;
    plan.updatedAt = "2000-01-01T00:00:00.000Z";
    writeFileSync(planFile, JSON.stringify(plan, null, 2) + "\n");
    return { bytes: readFileSync(planFile), first };
  };
  beforeEach(() => { writeFileSync(scriptFile, originalScript); });

  it("حفظ السكريبت لا يلمس plan.json (بايتًا ببايت) ويذكر المشهد الذي اختلف نصه", async () => {
    const { bytes, first } = await designFirstScene();
    const sentence = first.narration.trim().split(/\s+/).slice(0, 3).join(" ");
    writeFileSync(scriptFile, originalScript.replace(sentence, `${sentence} تعديل`));
    const r = await planAfterScriptSave("000");
    expect(readFileSync(planFile).equals(bytes)).toBe(true);
    expect(r.designed).toBe(true);
    if (!r.designed) return;
    expect(r.designedCount).toBe(1);
    expect(r.divergence.scenes.map((s) => s.id)).toEqual([first.id]);
    expect(r.divergence.unplaced.length).toBeGreaterThan(0);
    expect(backups()).toEqual([]);
  });

  it("حفظ سكريبت بلا تغيير في النص: لا اختلاف، والخطة كما هي", async () => {
    const { bytes } = await designFirstScene();
    const r = await planAfterScriptSave("000");
    expect(readFileSync(planFile).equals(bytes)).toBe(true);
    expect(r.designed && r.divergence).toEqual({ scenes: [], unplaced: [] });
  });

  it("إعادة التوليد تُرفض بلا تأكيد صريح، ولا تُكتب نسخة احتياطية", async () => {
    const { bytes } = await designFirstScene();
    await expect(regeneratePlan("000")).rejects.toBeInstanceOf(DesignedPlanError);
    await expect(regeneratePlan("000")).rejects.toMatchObject({ code: "designed-plan", designedCount: 1 });
    expect(readFileSync(planFile).equals(bytes)).toBe(true);
    expect(backups()).toEqual([]);
  });

  it("مع التأكيد الصريح: نسخة احتياطية بالبايتات الأصلية أولًا ثم الكتابة", async () => {
    const { bytes } = await designFirstScene();
    const seen: string[] = [];
    const plan = await regeneratePlan("000", { forceOverwriteDesigned: true, onBackup: (f) => {
      seen.push(f);
      // تُكتب النسخة قبل أن تُلمس الخطة
      expect(readFileSync(planFile).equals(bytes)).toBe(true);
    } });
    expect(seen).toHaveLength(1);
    expect(backups()).toEqual([path.basename(seen[0]!)]);
    expect(readFileSync(seen[0]!).equals(bytes)).toBe(true);
    expect(plan.updatedAt).not.toBe("2000-01-01T00:00:00.000Z");
    expect(readFileSync(planFile).equals(bytes)).toBe(false);
  });

  it("خطة عادية: حفظ السكريبت يعيد التوليد كما كان، بلا نسخة احتياطية", async () => {
    for (const f of backups()) rmSync(path.join(epDir, f));
    if (existsSync(planFile)) rmSync(planFile);
    await regeneratePlan("000");
    const before = readFileSync(planFile, "utf8");
    writeFileSync(scriptFile, `${originalScript.trimEnd()}\n\nفقرة جديدة في آخر السكريبت للاختبار.\n`);
    const r = await planAfterScriptSave("000");
    expect(r.designed).toBe(false);
    expect(readFileSync(planFile, "utf8")).not.toBe(before);
    expect(readFileSync(planFile, "utf8")).toContain("فقرة جديدة في آخر السكريبت للاختبار.");
    expect(backups()).toEqual([]);
  });
});

describe("الاستوديو والأوامر", () => {
  it("الخادم: حفظ السكريبت لا يعيد التوليد مباشرة، وإعادة التوليد تشترط رقم الحلقة مكتوبًا", () => {
    const api = readFileSync(path.join(__dirname, "..", "app", "server", "api.ts"), "utf8");
    const save = api.slice(api.indexOf('parts[2] === "script" && req.method === "PUT"'), api.indexOf('parts[2] === "plan" && parts[3] === "regenerate"'));
    expect(save).toContain("io.planAfterScriptSave(ep)");
    expect(save).not.toContain("regeneratePlan");
    expect(api).toContain('b?.overwriteDesigned === true && String(b?.confirmEpisode ?? "").trim() === ep');
  });

  it("الأمر bal plan يعرض --force-overwrite-designed، وbal make لا يعيد كتابة خطة مصمَّمة", () => {
    const cli = readFileSync(path.join(__dirname, "..", "src", "cli", "index.ts"), "utf8");
    expect(cli).toContain("--force-overwrite-designed");
    const make = readFileSync(path.join(__dirname, "..", "src", "package", "make.ts"), "utf8");
    expect(make).toContain("isDesignedPlan(existing) ? existing : await regeneratePlan(ep)");
  });

  it("تأكيد الواجهة: يذكر عدد المشاهد المصمَّمة ويشترط كتابة رقم الحلقة", () => {
    const plan = readPlan(real("dafatir-alzaman", "001-adam-beginning"));
    let asked = "";
    expect(confirmRegenerate("001", plan, (m) => { asked = m; return "002"; })).toBeNull();
    expect(asked).toContain(`ستُمحى المشاهد المصمَّمة (${countAr(designedScenes(plan).length, SCENES)})`);
    expect(asked).not.toMatch(/[0-9]/);
    expect(confirmRegenerate("001", plan, () => null)).toBeNull();
    expect(confirmRegenerate("001", plan, () => " 001 ")).toEqual({ overwriteDesigned: true, confirmEpisode: "001" });
    expect(confirmRegenerate("001", plan, () => "٠٠١")).toEqual({ overwriteDesigned: true, confirmEpisode: "001" });
    expect(confirmRegenerate("001", { chapters: [] } as never, () => { throw new Error("لا يُسأل"); })).toEqual({});
  });

  it("رسالة حفظ السكريبت: سطر واحد على الخطة المصمَّمة، مع المشاهد المختلفة إن وُجدت", () => {
    expect(scriptSaveMessage({}).msg).toBe("حُفظ السكريبت وتحدّثت المشاهد مع إبقاء تعديلاتك");
    expect(scriptSaveMessage({ planUnchanged: true, divergence: { scenes: [], unplaced: [] } })).toEqual({ msg: DESIGNED_PLAN_KEPT, warn: false });
    const r = scriptSaveMessage({ planUnchanged: true, divergence: { scenes: [{ id: "c1-s3" }], unplaced: [{ line: 17 }] } }, ["c1-s1", "c1-s2", "c1-s3"]);
    expect(r.warn).toBe(true);
    // QA 12 Nov: the scene by its number, Arabic-Indic digits
    expect(r.msg).toContain("مشاهد نصها في السكريبت يختلف عن الخطة: المشهد ٣");
    expect(r.msg).toContain("السطر ١٧");
    expect(r.msg).not.toMatch(/c1-s|[0-9]/);
  });
});
