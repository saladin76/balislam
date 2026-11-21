/**
 * المرحلة A (خطة «احترافية بلا مثيل»)، المهمة ٢: بطاقة الجودة — كل بند، والمنع («اصنع النسخة النهائية» وإذن النشر)،
 * والقياس على ملفات حقيقية يصنعها ffmpeg. الحلقات هنا مؤقتة (KI-068: لا يثبت اختبار محتوى يحرره المالك).
 */
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runWithChannel } from "../src/channel";
import type { Plan, PlanScene } from "../src/plan/types";
import { parseEbur128, measureLoudness } from "../src/studio/quality/audio";
import { audioItems, buildCard, cardRefusal, hookIn, is4k, scriptItems, type FileMeasurements } from "../src/studio/quality/card";
import { assertQualityForFinal, assertQualityForPublish, measureTarget, qualityCard, qualityGateOn, readMeasurement } from "../src/studio/quality/measure";

const root = path.join(import.meta.dirname, "..");
const scene = (id: string, narration: string, extra: Partial<PlanScene> = {}): PlanScene =>
  ({ id, template: "kinetic-text", narration, line: 0, props: { stage: id }, sfx: [], durationSec: 5, ...extra });
const planOf = (...scenes: PlanScene[]): Plan => ({ version: 1, episode: "001", title: "t", domain: "faith" as Plan["domain"], themeId: "x" as Plan["themeId"],
  updatedAt: "", channel: "balislam", chapters: [{ number: 1, title: "", scenes }] });
const good: FileMeasurements = { loudness: { integrated: -14.3, truePeak: -1.5 }, headSilence: 0.2,
  interactivity: { percent: 91, counted: 100, exempt: 10, still: [], ok: true }, video: { width: 3840, height: 2160 } };
const stamp = { file: { size: 1, mtimeMs: 1 }, at: "2026-11-21T00:00:00Z" };
const status = (c: ReturnType<typeof buildCard>, id: string) => c.sections.flatMap((s) => s.items).find((i) => i.id === id)!.status;

describe("بطاقة الجودة: البنود", () => {
  it("العلو −14 LUFS ±1، والذروة ≤ −1 dBTP، وسكوت البداية ≤ ٠٫٦ ث (الحدود نفسها تنجح)", () => {
    const ok = audioItems({ ...good, loudness: { integrated: -15, truePeak: -1 }, headSilence: 0.6 });
    expect(ok.filter((i) => ["loudness", "true-peak", "head-silence"].includes(i.id)).map((i) => i.status)).toEqual(["pass", "pass", "pass"]);
    const bad = audioItems({ ...good, loudness: { integrated: -16.2, truePeak: -0.4 }, headSilence: 1.1 });
    expect(bad.slice(0, 3).map((i) => i.status)).toEqual(["fail", "fail", "fail"]);
    expect(bad[0]!.reason).toContain("أخفض");
  });

  it("الخلط (الراوي فوق الجو ≥ ١٥ dB وفوق المؤثر ≥ ٦ dB) مؤجل للمهمة ٦ ولا يمنع", () => {
    const mix = audioItems(good).filter((i) => i.id.startsWith("narrator-"));
    expect(mix.map((i) => [i.status, i.need])).toEqual([["later", "≥ ١٥ dB"], ["later", "≥ ٦ dB"]]);
  });

  it("4K للنسخة النهائية وحدها (أفقي وعمودي)، والمجمّعة 1080p لا تُحاسب عليه", () => {
    expect([is4k({ width: 3840, height: 2160 }), is4k({ width: 2160, height: 3840 }), is4k({ width: 1920, height: 1080 })]).toEqual([true, true, false]);
    const p = planOf(scene("a", "كيف تعرف؟"));
    expect(status(buildCard({ target: "assembly", plan: p, measured: { ...good, video: { width: 1920, height: 1080 }, ...stamp } }), "resolution")).toBe("later");
    expect(status(buildCard({ target: "master", plan: p, measured: { ...good, video: { width: 1920, height: 1080 }, ...stamp } }), "resolution")).toBe("fail");
  });

  it("التفاعلية تحت ٨٠٪ تمنع وتسمّي المقاطع الساكنة", () => {
    const c = buildCard({ target: "assembly", plan: planOf(scene("a", "لماذا؟")), measured: { ...good, interactivity: { percent: 71.2, counted: 100, exempt: 0, still: [{ from: 62, to: 66.5 }], ok: false }, ...stamp } });
    const i = c.sections[1]!.items.find((x) => x.id === "interactivity")!;
    expect([i.status, i.reason]).toEqual(["fail", expect.stringContaining("1:02–1:06")]);
  });

  it("الخطاف: سؤال يبدأ نطقه في أول ١٥ ث (موضعه في مشهد طويل بنسبة حروفه)", () => {
    expect(hookIn(planOf(scene("a", "في سوق صغير وقف رجلان."), scene("b", "كيف تعرف أنك على حق؟")))).toMatchObject({ ok: true, at: 5 });
    const late = planOf(scene("a", "جملة أولى طويلة. ".repeat(10), { durationSec: 20 }), scene("b", "لماذا؟"));
    expect(hookIn(late).ok).toBe(false);
    const inside = planOf(scene("a", `${"كلام ".repeat(30)}أليس كذلك؟ ${"كلام ".repeat(30)}`, { durationSec: 30 }));
    expect(hookIn(inside).ok).toBe(true); // يبدأ عند نحو ١٥٫٠ ث من ٣٠
  });

  it("التوثيق ودعوة التعليق والإحالة للعلم ولا تمنع (قرار المالك ١٠ نوفمبر حتى يقرر غيره)", () => {
    const items = scriptItems(planOf(scene("a", "لماذا؟")), undefined, { total: 5, open: 2 });
    expect(items.map((i) => [i.id, i.status])).toEqual([["hook", "pass"], ["arabic", "later"], ["citations", "warn"], ["comment-cta", "warn"], ["referral", "warn"]]);
    const withCta = scriptItems(planOf(scene("a", "لماذا؟"), scene("end", "", { template: "end-screen", props: { prompt: "شاركنا رأيك في التعليقات" } }), scene("b", "نلتقي في الحلقة القادمة")));
    expect(withCta.filter((i) => ["comment-cta", "referral"].includes(i.id)).map((i) => i.status)).toEqual(["pass", "pass"]);
  });

  it("ما يمنع: ✗ أو «لم يُقس»؛ والتنبيه والمؤجل لا يمنعان، والرفض يسمّي كل بند", () => {
    const p = planOf(scene("a", "لماذا؟"));
    const none = buildCard({ target: "assembly", plan: p, measured: null });
    expect(none.blocks).toBe(true);
    expect(none.blockers.some((b) => b.includes("لم يُقس"))).toBe(true);
    const pass = buildCard({ target: "assembly", plan: p, measured: { ...good, ...stamp } });
    expect([pass.blocks, pass.blockers]).toEqual([false, []]);
    const noHook = buildCard({ target: "master", plan: planOf(scene("a", "جملة بلا سؤال.")), measured: { ...good, ...stamp } });
    expect(cardRefusal(noHook, "publish")).toMatch(/لا يُمنح إذن النشر[\s\S]*السكريبت — خطاف/);
  });

  it("البوابة على جهاز المالك دائمًا؛ في الاختبار تُطفأ إلا بطلب صريح", () => {
    expect(qualityGateOn({})).toBe(true);
    expect(qualityGateOn({ BAL_QUALITY_GATE: "off" } as NodeJS.ProcessEnv)).toBe(true);
    expect(qualityGateOn({ VITEST: "true" } as NodeJS.ProcessEnv)).toBe(false);
    expect(qualityGateOn({ BAL_E2E: "1", BAL_QUALITY_GATE: "on" } as NodeJS.ProcessEnv)).toBe(true);
  });
});

describe("بطاقة الجودة: القياس على ملفات حقيقية والمنع", () => {
  let tmp = "";
  const env = { channels: process.env.BAL_CHANNELS_DIR, gate: process.env.BAL_QUALITY_GATE };
  const ff = (args: string[]) => execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "pipe", "pipe"] });
  let ep = "";
  beforeAll(async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), "quality-card-"));
    process.env.BAL_CHANNELS_DIR = tmp;
    process.env.BAL_QUALITY_GATE = "on";
    await mkdir(path.join(tmp, "balislam"), { recursive: true });
    for (const f of ["channel.json", "identity.json", "identity.default.json", "pronunciation.json"])
      await copyFile(path.join(root, "channels", "balislam", f), path.join(tmp, "balislam", f));
    ep = path.join(tmp, "balislam", "episodes", "001-quality");
    await mkdir(path.join(ep, "previews"), { recursive: true });
    await mkdir(path.join(ep, "out", "package"), { recursive: true });
    await writeFile(path.join(ep, "script.md"), "---\ntitle: \"اختبار\"\ndomain: faith\nepisode: \"001\"\n---\n## الفصل 1 · تجربة\n\nكيف تعرف أنك على حق؟\n");
    await writeFile(path.join(ep, "plan.json"), JSON.stringify(planOf(scene("c1-s1", "كيف تعرف أنك على حق؟", { durationSec: 4 }), scene("c1-s2", "تأمل الميزان.", { durationSec: 4 }))));
  });
  afterAll(async () => {
    if (env.channels === undefined) delete process.env.BAL_CHANNELS_DIR; else process.env.BAL_CHANNELS_DIR = env.channels;
    if (env.gate === undefined) delete process.env.BAL_QUALITY_GATE; else process.env.BAL_QUALITY_GATE = env.gate;
    await rm(tmp, { recursive: true, force: true });
  });
  const inChannel = <T,>(f: () => Promise<T>) => runWithChannel("balislam", f);
  /** فيديو متحرك ٨ ث بصوت: علوه وسكوته من الوسيطات */
  const make = (file: string, size: string, volume: string, silentHead = 0) => ff([
    "-f", "lavfi", "-i", `testsrc2=s=${size}:r=30:d=8`,
    "-f", "lavfi", "-i", `sine=frequency=440:sample_rate=48000:duration=${8 - silentHead}`,
    "-filter_complex", `[1:a]adelay=${silentHead * 1000}:all=1,apad=whole_dur=8,volume=${volume}[a]`,
    "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", file]);

  it("ebur128 على ملف حقيقي: قراءة الملخص", async () => {
    const f = path.join(tmp, "tone.mp4");
    make(f, "320x180", "0.25");
    const l = await measureLoudness(f);
    expect(l.integrated).toBeGreaterThan(-45);
    expect(l.integrated).toBeLessThan(-5);
    expect(l.truePeak).toBeLessThan(0);
    expect(() => parseEbur128("no summary")).toThrow(/علو الصوت/);
  }, 60_000);

  it("«اصنع النسخة النهائية»: يقيس المجمّعة ثم يمنع بالأسباب؛ ويمر حين يُصلح الملف", async () => {
    await inChannel(async () => {
      const assembly = path.join(ep, "previews", "episode.mp4");
      // خافت ويبدأ بثانيتين صامتتين
      make(assembly, "640x360", "0.02", 2);
      expect((await qualityCard("001", "assembly")).blocks).toBe(true); // لم يُقس
      const err = await assertQualityForFinal("001").then(() => null, (e: Error) => e.message);
      expect(err).toMatch(/لا تُصنع النسخة النهائية/);
      expect(err).toContain("علو الحلقة");
      expect(err).toContain("سكوت البداية");
      expect(await readMeasurement(path.join(ep, "script.md"), "assembly")).not.toBeNull();
      // ملف جديد بعلو −14 تقريبًا (loudnorm) ويبدأ بالصوت: يمر
      const loud = path.join(tmp, "loud.mp4");
      make(loud, "640x360", "0.3");
      ff(["-i", loud, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-2:LRA=7", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", assembly]);
      expect(await readMeasurement(path.join(ep, "script.md"), "assembly")).toBeNull(); // القياس القديم لا يصلح لملف جديد
      await expect(assertQualityForFinal("001")).resolves.toBeUndefined();
      const card = await qualityCard("001", "assembly");
      expect(card.sections.flatMap((s) => s.items).filter((i) => i.status === "pass").map((i) => i.id)).toEqual(expect.arrayContaining(["loudness", "true-peak", "head-silence", "interactivity", "hook"]));
    });
  }, 120_000);

  it("إذن النشر: بطاقة النسخة النهائية نفسها؛ ملف ليس 4K يمنع", async () => {
    await inChannel(async () => {
      const master = path.join(ep, "out", "package", "001-episode.mp4");
      make(master, "640x360", "0.3");
      ff(["-i", master, "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-2:LRA=7", "-ar", "48000", "-c:a", "aac", "-b:a", "192k", `${master}.n.mp4`]);
      execFileSync("mv", [`${master}.n.mp4`, master]);
      await expect(assertQualityForPublish("001")).rejects.toThrow(/لم يُقس/);
      await measureTarget("001", "master");
      await expect(assertQualityForPublish("001")).rejects.toThrow(/دقة 4K/);
      expect((await qualityCard("001")).target).toBe("master");
    });
  }, 120_000);
});
