/**
 * D228 (قاعدة ثابتة): لا قالب جديد في الإنتاج قبل اعتماد المالك لنموذجه من الستوري بورد.
 * يتأكد أن البوابة تعمل: المقترح والمجهول يُرفضان، والمعتمد بسجله يمر، والقديم قبل D228 يمر،
 * وأن الرندر نفسه يمر بالبوابة، وأن أي قالب يُضاف للسجل دون تسجيله يُسقط الاختبار.
 */
import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  OWNER_APPROVED, PROPOSED, approveTemplate, assertTemplatesApproved, keyApproved, loadApprovals, proposeTemplate, unapprovedScenes, type ApprovalsFile,
} from "../src/plan/templateApproval";
import { registryTemplateKeys } from "../src/plan/templateRegistryKeys";

const planOf = (...scenes: { id: string; template: string; props?: Record<string, unknown> }[]) => ({ chapters: [{ scenes: scenes.map((s) => ({ props: {}, ...s })) }] }) as never;
const tmpRoot = (a: ApprovalsFile) => {
  const root = mkdtempSync(path.join(os.tmpdir(), "d228-"));
  mkdirSync(path.join(root, "templates"));
  writeFileSync(path.join(root, "templates", "approvals.json"), JSON.stringify(a));
  return root;
};
const base = (): ApprovalsFile => ({ version: 1, legacy: ["ink-shot", "horizon-shot", "horizon-shot/lib-term"], templates: {} });

describe("D228: بوابة اعتماد القوالب", () => {
  it("القالب القديم قبل D228 يمر", () => {
    expect(() => assertTemplatesApproved(planOf({ id: "s1", template: "ink-shot" }), base())).not.toThrow();
    expect(() => assertTemplatesApproved(planOf({ id: "s1", template: "horizon-shot", props: { shot: "lib-term" } }), base())).not.toThrow();
  });

  it("القالب المجهول (غير مسجَّل) يوقف الرندر", () => {
    expect(() => assertTemplatesApproved(planOf({ id: "s1", template: "reader-notebook" }), base())).toThrow(/D228.*\n- s1: reader-notebook \(غير مسجَّل\)/);
  });

  it("اللقطة الجديدة داخل قالب قديم تحتاج اعتمادًا هي أيضًا", () => {
    const bad = unapprovedScenes(planOf({ id: "s2", template: "horizon-shot", props: { shot: "lib-thread" } }), base());
    expect(bad).toEqual([{ sceneId: "s2", key: "horizon-shot/lib-thread", status: "غير مسجَّل" }]);
  });

  it("المقترح يُرفض، ثم يمر بعد اعتماد المالك لنموذج من نماذجه بسجل (من، متى، أي نموذج)", () => {
    const root = tmpRoot(base());
    proposeTemplate("reader-notebook", { channel: "zubdat-alkutub", nameAr: "دفتر القارئ", storyboard: "زبدة-الكتب-001", variants: ["مشهد-1-نموذج-أ", "مشهد-1-نموذج-ب"] }, root);
    let a = loadApprovals(root);
    expect(a.templates["reader-notebook"]!.status).toBe(PROPOSED);
    expect(() => assertTemplatesApproved(planOf({ id: "s1", template: "reader-notebook" }), a)).toThrow(/reader-notebook \(مقترح\)/);
    expect(() => approveTemplate("reader-notebook", "نموذج-غريب", "المالك", root)).toThrow(/ليس من نماذج/);
    expect(() => approveTemplate("reader-notebook", "", "المالك", root)).toThrow();
    const rec = approveTemplate("reader-notebook", "مشهد-1-نموذج-ب", "المالك", root, new Date("2026-11-27T10:00:00Z"));
    expect(rec).toMatchObject({ status: OWNER_APPROVED, approval: { by: "المالك", at: "2026-11-27T10:00:00.000Z", variant: "مشهد-1-نموذج-ب" } });
    a = loadApprovals(root);
    expect(() => assertTemplatesApproved(planOf({ id: "s1", template: "reader-notebook" }), a)).not.toThrow();
  });

  it("حالة «معتمد» بلا سجل اعتماد كامل لا تكفي", () => {
    const a = base();
    a.templates["x-new"] = { status: OWNER_APPROVED, channel: "balislam", nameAr: "س" };
    expect(keyApproved(a, "x-new")).toBe(false);
  });

  it("الرندر نفسه يمر بالبوابة قبل التجميع (renderComposition)", () => {
    const src = readFileSync(path.join(__dirname, "..", "src", "render", "episode.ts"), "utf8");
    const body = src.slice(src.indexOf("export const renderComposition"));
    expect(body.indexOf("assertTemplatesApproved(plan)")).toBeGreaterThan(0);
    expect(body.indexOf("assertTemplatesApproved(plan)")).toBeLessThan(body.indexOf("createIsolatedRenderBundle"));
  });

  it("كل قالب ولقطة في السجل قديمة (legacy) أو مسجَّلة في approvals.json: لا يُضاف قالب دون المرور بالقاعدة", () => {
    const a = loadApprovals();
    const missing = registryTemplateKeys().filter((k) => !a.legacy.includes(k) && !a.templates[k]);
    expect(missing).toEqual([]);
  });

  it("legacy لقطة مجمَّدة قبل D228 لا تُوسَّع (٣٥٩ مفتاحًا)", () => {
    expect(loadApprovals().legacy.length).toBe(359);
  });

  it("لا تُحجب أي حلقة قائمة في المستودع", () => {
    const a = loadApprovals();
    const root = path.join(__dirname, "..", "channels");
    for (const ch of readdirSync(root)) {
      const eps = path.join(root, ch, "episodes");
      if (!existsSync(eps)) continue;
      for (const e of readdirSync(eps)) {
        const f = path.join(eps, e, "plan.json");
        if (!existsSync(f)) continue;
        const plan = JSON.parse(readFileSync(f, "utf8"));
        if (plan.chapters) expect(unapprovedScenes(plan, a).map((x) => `${e}:${x.key}`)).toEqual([]);
      }
    }
  });
});

describe("D228: الستوري بورد في «بانتظارك»", () => {
  it("يقرأ النماذج وينبه إلى نقص المشاهد والصور، ولا يخرج من مجلده", async () => {
    const { listStoryboards, storyboardImage } = await import("../src/studio/storyboards");
    const root = mkdtempSync(path.join(os.tmpdir(), "d228sb-"));
    mkdirSync(path.join(root, "زبدة-الكتب-001"));
    writeFileSync(path.join(root, "زبدة-الكتب-001", "مشهد-1-نموذج-أ.png"), "x");
    writeFileSync(path.join(root, "زبدة-الكتب-001", "storyboard.json"), JSON.stringify([
      { scene: 1, variant: "مشهد-1-نموذج-أ", file: "مشهد-1-نموذج-أ.png", motion: "الخط يُكتب" },
      { scene: 1, variant: "مشهد-1-نموذج-ب", file: "مشهد-1-نموذج-ب.png", motion: "الدائرة تُرسم" },
      { scene: 2, variant: "x", file: "../../etc/passwd" },
    ]));
    const [sb] = listStoryboards(root);
    expect(sb!.variants).toHaveLength(2);
    expect(sb!.issues.join("|")).toMatch(/فيه 1 مشاهد، والقاعدة أول ستة/);
    expect(sb!.issues.join("|")).toMatch(/الصورة ناقصة: مشهد-1-نموذج-ب.png/);
    expect(storyboardImage("زبدة-الكتب-001", "مشهد-1-نموذج-أ.png", root)).toMatch(/مشهد-1-نموذج-أ\.png$/);
    expect(storyboardImage("..", "passwd", root)).toBeNull();
    expect(storyboardImage("زبدة-الكتب-001", "storyboard.json", root)).toBeNull();
  });
});
