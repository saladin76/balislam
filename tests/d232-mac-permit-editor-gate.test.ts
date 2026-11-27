/**
 * D232 (سارٍ، اعتمده المالك ٢٧ نوفمبر: «ادمج فرعه بشرط المحرر (D234) وقاعدة الجهاز الواحد (D233). الماك احتياطي للطوارئ
 * بس، وبإذني كل مرة»):
 * - كل مسار رندر يُرفض قبل محرر المحتوى (D234): مهام الويندوز (المشهد والوصل وMaster والتجربة) قبل أي نسخ أو إرسال،
 *   والعامل نفسه بسجل المحرر في commit المهمة (ويشمل الوصل الذي لا يمر بـrenderComposition)، ورندر الماك ووصله.
 * - الماك لا يرندر إلا بإذن المالك لمرة واحدة (src/render/macRenderPermit.ts): يُستهلك مع كل رندر ويُرفض بعده.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  consumeMacRenderPermit, grantMacRenderPermit, MAC_RENDER_REFUSED, permitFile, readMacRenderPermit, revokeMacRenderPermit,
} from "../src/render/macRenderPermit";

const root = path.join(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");
const body = (file: string, start: string, end?: string) => {
  const src = read(file);
  const from = src.indexOf(start);
  expect(from, `${file}: ${start}`).toBeGreaterThanOrEqual(0);
  const rest = src.slice(from);
  return end ? rest.slice(0, rest.indexOf(end) > 0 ? rest.indexOf(end) : undefined) : rest;
};
const before = (src: string, a: string, b: string) => {
  expect(src.indexOf(a), a).toBeGreaterThan(0);
  expect(src.indexOf(b), b).toBeGreaterThan(0);
  expect(src.indexOf(a), `${a} قبل ${b}`).toBeLessThan(src.indexOf(b));
};

describe("D232: إذن المالك لمرة واحدة قبل أي رندر على الماك", () => {
  const mac = { platform: "darwin" as const };
  beforeAll(async () => { await revokeMacRenderPermit(); });
  afterAll(async () => { await revokeMacRenderPermit(); });

  it("ملف الإذن في الاختبارات مؤقت، لا في مستودع المالك", () => {
    expect(permitFile().startsWith(os.tmpdir()) || permitFile().startsWith("/var/") || permitFile().startsWith("/tmp/")).toBe(true);
    expect(permitFile()).not.toContain(path.join(root, "renders"));
  });

  it("جهاز الرندر (ويندوز) لا يحتاج إذنًا؛ والماك بلا إذن يُرفض برسالة عربية", async () => {
    await expect(consumeMacRenderPermit("قطعة مشهد", { platform: "win32" })).resolves.toBeUndefined();
    await expect(consumeMacRenderPermit("قطعة مشهد", mac)).rejects.toThrow(MAC_RENDER_REFUSED);
    await expect(consumeMacRenderPermit("قطعة مشهد", mac)).rejects.toThrow(/لا إذن الآن/);
  });

  it("الإذن يتطلب نص المالك، ويُستهلك مرة واحدة ثم يُرفض الرندر التالي", async () => {
    await expect(grantMacRenderPermit({ ownerWords: "" })).rejects.toThrow(/نص إذن المالك/);
    await grantMacRenderPermit({ ownerWords: "اسمح بالرندر على الماك هذه المرة" });
    await expect(consumeMacRenderPermit("تجميع المشاهد", { ...mac, episode: "001-x" })).resolves.toBeUndefined();
    expect(existsSync(permitFile())).toBe(false);
    await expect(consumeMacRenderPermit("تجميع المشاهد", mac)).rejects.toThrow(MAC_RENDER_REFUSED);
    const log = readFileSync(path.join(path.dirname(permitFile()), "mac-render-permits.log.jsonl"), "utf8");
    expect(log).toContain("\"event\":\"used\"");
    expect(log).toContain("اسمح بالرندر على الماك هذه المرة");
  });

  it("عدة مرات: يتناقص العدد؛ والمنتهي والحلقة الأخرى يُرفضان", async () => {
    await grantMacRenderPermit({ ownerWords: "مرتان للحلقة 001", uses: 2, episode: "001" });
    await expect(consumeMacRenderPermit("قطعة", { ...mac, episode: "002-y" })).rejects.toThrow(/لحلقة أخرى/);
    await grantMacRenderPermit({ ownerWords: "مرتان للحلقة 001", uses: 2, episode: "001" });
    await consumeMacRenderPermit("قطعة", { ...mac, episode: "001-x" });
    expect((await readMacRenderPermit())?.uses).toBe(1);
    await consumeMacRenderPermit("قطعة", { ...mac, episode: "001-x" });
    expect(await readMacRenderPermit()).toBeNull();
    await grantMacRenderPermit({ ownerWords: "مرة قديمة", minutes: 1, now: new Date(Date.now() - 5 * 60_000) });
    await expect(consumeMacRenderPermit("قطعة", mac)).rejects.toThrow(/انتهت صلاحية الإذن/);
  });

  it("رندران متزامنان لا يستهلكان المرة نفسها", async () => {
    await grantMacRenderPermit({ ownerWords: "مرة واحدة" });
    const r = await Promise.allSettled([consumeMacRenderPermit("أ", mac), consumeMacRenderPermit("ب", mac)]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  });

  it("كل رندر فيديو على الماك يستهلك الإذن قبل أن يبدأ (فحص المصدر)", () => {
    before(body("src/render/episode.ts", "export const renderComposition"), "consumeMacRenderPermit(", "createIsolatedRenderBundle");
    before(body("src/render/storyboardMotion.ts", "export const measureStoryboardMotion"), "consumeMacRenderPermit(", "createIsolatedRenderBundle");
    before(body("src/render/previews.ts", "export const renderPreviews"), "consumeMacRenderPermit(", "createIsolatedRenderBundle");
    before(body("src/render/horizonAudio.ts", "export const renderHorizonAudio"), "consumeMacRenderPermit(", "createIsolatedRenderBundle");
    before(body("src/studio/assembleScenes.ts", "export const assemblePreFinalPreview", "export const assembleApprovedSceneAv"), "consumeMacRenderPermit(", "joinSceneCuts(");
    before(body("src/studio/assembleScenes.ts", "export const assembleApprovedSceneAv"), "consumeMacRenderPermit(", "joinSceneCuts(");
  });
});

describe("D234 على كل مسار رندر D232 (فحص المصدر)", () => {
  it("مهام الويندوز: المشهد والوصل وMaster والتجربة قبل أي حساب أو نسخ أو إرسال", () => {
    before(body("src/render/worker/macJobs.ts", "export const buildSceneJob", "export const fullEpisodeInputs"), "assertEditorPassed(", "shotsRenderInputs(");
    // الوصل وMaster يأخذان مدخلاتهما من fullEpisodeInputs وحدها
    before(body("src/render/worker/macJobs.ts", "export const fullEpisodeInputs", "export const buildJoinJob"), "assertEditorPassed(", "prepareRenderMedia(");
    before(body("src/render/worker/macJobs.ts", "export const submitTrial", "export type TrialRow"), "assertEditorPassed(", "enqueue(");
    before(body("src/render/worker/macJobs.ts", "export const submitTrial", "export type TrialRow"), "assertEditorPassed(", "buildSceneJob(");
  });
  it("العامل: قبل لقطة الوسائط، للرندر والوصل معًا", () => {
    const w = body("src/render/worker/untrustedRender.ts", "export const renderWorkerJobV2");
    before(w, "await assertEditorPassed(scriptPath)", "installSnapshot(");
    before(w, "await assertEditorPassed(scriptPath)", "joinSceneCuts(");
  });
  it("وصل الماك (التجميع و«قبل النهائية») والمعاينة الصوتية القديمة", () => {
    before(body("src/studio/assembleScenes.ts", "export const assemblePreFinalPreview", "export const assembleApprovedSceneAv"), "assertEditorPassed(scriptPath)", "joinSceneCuts(");
    before(body("src/studio/assembleScenes.ts", "export const assembleApprovedSceneAv"), "assertEditorPassed(scriptPath)", "joinSceneCuts(");
    before(body("src/render/horizonAudio.ts", "export const renderHorizonAudio"), "assertEditorPassed(scriptPath)", "createIsolatedRenderBundle");
  });
});

describe("D234 على مهام الويندوز (ملفات مؤقتة): لا مهمة ولا طابور قبل المحرر", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "bal-d232-editor-"));
  const share = path.join(tmp, "share");
  const prev = process.env.BAL_CHANNELS_DIR;
  const ep = path.join(tmp, "dafatir-alzaman", "episodes", "007-x");
  beforeAll(() => {
    process.env.BAL_CHANNELS_DIR = tmp;
    mkdirSync(ep, { recursive: true });
    writeFileSync(path.join(tmp, "dafatir-alzaman", "channel.json"), "{}");
    writeFileSync(path.join(ep, "script.md"), `---\ntitle: "ع"\nstatus: "مسودة"\n---\n\nجملة لم يراجعها المحرر.\n`);
  });
  afterAll(() => {
    if (prev === undefined) delete process.env.BAL_CHANNELS_DIR; else process.env.BAL_CHANNELS_DIR = prev;
    rmSync(tmp, { recursive: true, force: true });
  });
  it("المشهد وMaster والتجربة تُرفض «بانتظار المحرر»، ولا يُنشأ طابور", async () => {
    const { runWithChannel } = await import("../src/channel");
    const jobs = await import("../src/render/worker/macJobs");
    const base = { channel: "dafatir-alzaman", episodeFolder: "007-x", commit: "a".repeat(40), purpose: "trial" as const, trial: "t", createdAt: new Date().toISOString() };
    await runWithChannel("dafatir-alzaman", async () => {
      await expect(jobs.buildSceneJob("007", "c1-s1", base, share)).rejects.toThrow(/بانتظار المحرر/);
      await expect(jobs.fullEpisodeInputs("007", { requireApprovedQuran: false })).rejects.toThrow(/بانتظار المحرر/);
      await expect(jobs.submitTrial("007", share, { tag: "t", outDir: path.join(tmp, "out") })).rejects.toThrow(/بانتظار المحرر/);
    });
    expect(existsSync(path.join(share, "render-queue"))).toBe(false);
    expect(existsSync(path.join(tmp, "out"))).toBe(false);
  });
});
