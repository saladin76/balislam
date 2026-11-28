/**
 * D247: ستوري بورد «مكتب القارئ» (زبدة الكتب) ومهمة «stills» على جهاز الرندر.
 * - اللوحات: ٦ مشاهد أولى + مشهد البطاقة، ٢–٣ نماذج لكل مشهد، مسجَّلة «مقترح» في templates/approvals.json.
 * - لا تصل إلى الإنتاج: «reader-desk» مقترح فيرفضه assertTemplatesApproved، ولا قالب ولا مدخل كتالوج بها.
 * - مهمة stills: قائمة مسموحة من الكود، لا تكوين حلقة، والاستلام يتحقق من كل صورة ويحذف نصها المضمَّن.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DESK_BOARDS, TAHA_14, boardVariantName } from "../src/remotion/zubdat/desk/boards";
import { assertTemplatesApproved, loadApprovals, PROPOSED } from "../src/plan/templateApproval";
import { registryTemplateKeys } from "../src/plan/templateRegistryKeys";
import {
  STORYBOARD_SETS, buildStillsJob, collectStills, completeStillsJob, findStillsDone, pngSize, stripPngText, validateStillsJob, writeStillsJob,
} from "../src/render/worker/stillsProtocol";
import { queuePaths, validateEnvelope } from "../src/render/worker/protocol";

const root = path.resolve(__dirname, "..");
const COMMIT = "a".repeat(40);

const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  return Buffer.concat([len, Buffer.from(type, "latin1"), data, Buffer.alloc(4)]);
};
const png = (w: number, h: number, text = true) => {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr),
    ...(text ? [chunk("tEXt", Buffer.from("Software\0Remotion", "latin1"))] : []), chunk("IDAT", Buffer.from([1, 2, 3])), chunk("IEND", Buffer.alloc(0))]);
};

describe("D247: لوحات «مكتب القارئ»", () => {
  it("أول ستة مشاهد ومشهد البطاقة، ٢–٣ نماذج لكل مشهد، بمعرّفات storyboard- فريدة", () => {
    const scenes = [...new Set(DESK_BOARDS.map((b) => b.scene))];
    expect(scenes).toEqual([1, 2, 3, 4, 5, 6, 7]); // owner-pin-ok: ترقيم لوحات الستوري بورد في الكود (boards.ts)، لا محتوى المالك
    for (const s of scenes) expect(DESK_BOARDS.filter((b) => b.scene === s).length).toBeGreaterThanOrEqual(2);
    for (const s of scenes) expect(DESK_BOARDS.filter((b) => b.scene === s).length).toBeLessThanOrEqual(3);
    expect(new Set(DESK_BOARDS.map((b) => b.composition)).size).toBe(DESK_BOARDS.length);
    for (const b of DESK_BOARDS) expect(b.composition).toMatch(/^storyboard-zubdat-desk-s\d-[abc]$/);
    expect(DESK_BOARDS.filter((b) => b.scene <= 6).map((b) => b.sceneId)).toEqual(expect.arrayContaining(["c1-s1", "c1-s2", "c1-s3", "c1-s4", "c1-s5", "c1-s6"]));
  });

  it("المشاهد الستة بنص خطة 001 نفسها، ومشهد البطاقة مشهد آية فيها", () => {
    const plan = JSON.parse(readFileSync(path.join(root, "channels/zubdat-alkutub/episodes/001-awwal-marra-osalli/plan.json"), "utf8"));
    const ids = plan.chapters.flatMap((c: { scenes: { id: string; template: string }[] }) => c.scenes);
    for (const b of DESK_BOARDS) expect(ids.some((s: { id: string }) => s.id === b.sceneId)).toBe(true);
    expect(ids.find((s: { id: string }) => s.id === "c1-s14").template).toBe("verse-card"); // owner-pin-ok: عقد: مشهد البطاقة مشهد آية في الخطة
  });

  it("نص آية البطاقة هو نص السكريبت حرفًا (طه ١٤)", () => {
    const script = readFileSync(path.join(root, "channels/zubdat-alkutub/episodes/001-awwal-marra-osalli/script.md"), "utf8");
    expect(script).toContain(`[آية: طه 14 | ${TAHA_14}]`);
  });

  it("مسجَّلة «مقترح» في approvals.json بالنماذج نفسها، ولا اعتماد قبل اختيار المالك", () => {
    const a = loadApprovals();
    expect(a.templates["reader-desk"]?.status).toBe(PROPOSED);
    for (const s of [1, 2, 3, 4, 5, 6, 7]) {
      const t = a.templates[`storyboard:زبدة-مكتب-القارئ/مشهد-${s}`];
      expect(t?.status).toBe(PROPOSED);
      expect(t?.storyboard).toBe("زبدة-مكتب-القارئ"); // owner-pin-ok: اسم مجلد الستوري بورد من الكود
      expect(t?.variants).toEqual(DESK_BOARDS.filter((b) => b.scene === s).map(boardVariantName));
      expect(t?.approval).toBeUndefined();
    }
  });

  it("لا تصل إلى الإنتاج: بوابة D228 ترفض قالب «reader-desk» ولقطاته، ولا قالب ولا مدخل كتالوج بها", () => {
    const plan = (template: string, shot?: string) => ({ chapters: [{ scenes: [{ id: "s1", template, props: shot ? { shot } : {} }] }] }) as never;
    expect(() => assertTemplatesApproved(plan("reader-desk"))).toThrow(/reader-desk \(مقترح\)/);
    expect(() => assertTemplatesApproved(plan("reader-desk", "s1-a"))).toThrow(/D228/);
    expect(() => assertTemplatesApproved(plan("storyboard-zubdat-desk-s1-a"))).toThrow(/غير مسجَّل/);
    expect(registryTemplateKeys().some((k) => /reader-desk|zubdat-desk/.test(k))).toBe(false);
    expect(readFileSync(path.join(root, "src/remotion/scenes/catalog.ts"), "utf8")).not.toMatch(/ReaderDesk|zubdat\/desk/);
    expect(readFileSync(path.join(root, "src/plan/templates.ts"), "utf8")).not.toMatch(/reader-desk|zubdat\/desk/);
  });

  it("Root يسجّل كل لوحة صورةً ثابتة (Still) وحدها", () => {
    const src = readFileSync(path.join(root, "src/remotion/Root.tsx"), "utf8");
    expect(src).toMatch(/DESK_STILLS\.map\(\(s\) => <Still key=\{s\.id\} id=\{s\.id\} component=\{ReaderDeskBoard\}/);
  });
});

describe("D247: مهمة stills على جهاز الرندر", () => {
  it("المهمة للمجموعة كاملة، بغلاف يقبله العامل الجاري، وفحصها الكامل صارم", () => {
    const job = buildStillsJob("zubdat-desk", COMMIT, new Date("2026-11-28T08:00:00Z"));
    expect(job.id).toMatch(/^stills-zubdat-desk-aaaaaaaa-[a-f0-9]{8}$/);
    expect(job.stills).toHaveLength(DESK_BOARDS.length);
    expect(validateEnvelope(job).kind).toBe("stills"); // owner-pin-ok: مهمة مصطنعة
    const bad = (patch: Record<string, unknown>) => () => validateStillsJob({ ...job, ...patch });
    expect(bad({ stills: [{ composition: "episode-landscape", file: "x.png" }] })).toThrow(/تكوين غير صالح/);
    expect(bad({ stills: [{ composition: "storyboard-other-s1-a", file: "other-s1-a.png" }] })).toThrow(/ليس من المجموعة/);
    expect(bad({ stills: [{ composition: job.stills[0]!.composition, file: "../x.png" }] })).toThrow();
    expect(bad({ set: "nope" })).toThrow(/غير مسجَّلة/);
    expect(bad({ width: 3840 })).toThrow(/أبعاد/);
    expect(bad({ id: "trial-x" })).toThrow(/stills-/);
    expect(bad({ plan: {} })).toThrow(/حقل غير معروف/);
    expect(bad({ channel: "balislam" })).toThrow(/القناة/);
    expect(() => buildStillsJob("nope", COMMIT)).toThrow(/غير مسجَّلة/);
  });

  it("PNG: الأبعاد من الرأس، وحذف النص المضمَّن دون لمس الصورة", () => {
    const p = png(1920, 1080);
    expect(pngSize(p)).toEqual({ width: 1920, height: 1080 });
    const s = stripPngText(p);
    expect(s.includes(Buffer.from("tEXt"))).toBe(false);
    expect(s.includes(Buffer.from("IDAT"))).toBe(true);
    expect(pngSize(Buffer.from("nope"))).toBeNull();
  });

  it("دورة كاملة: إرسال ← نتيجة العامل ← استلام بأسماء عربية وstoryboard.json، والعبث يُرفض", async () => {
    const share = mkdtempSync(path.join(os.tmpdir(), "d247-share-"));
    const job = buildStillsJob("zubdat-desk", COMMIT);
    expect((await writeStillsJob(share, job)).already).toBe(false);
    expect((await writeStillsJob(share, job)).already).toBe(true);
    const q = queuePaths(share);
    // العامل: أخذ المهمة ورندرها (صور مزيفة بالأبعاد الصحيحة)
    await writeFile(path.join(q.running, `${job.id}.json`), readFileSync(path.join(q.jobs, `${job.id}.json`)));
    const local = mkdtempSync(path.join(os.tmpdir(), "d247-local-"));
    const rendered = [];
    for (const s of job.stills) { const f = path.join(local, s.file); await writeFile(f, png(1920, 1080)); rendered.push({ ...s, path: f }); }
    await completeStillsJob(share, job, rendered, { commit: COMMIT, worker: "test", startedAt: "2026-11-28T08:00:00Z", finishedAt: "2026-11-28T08:05:00Z", logTail: "" });
    expect(await findStillsDone(share, "zubdat-desk")).toBe(job.id);
    const out = mkdtempSync(path.join(os.tmpdir(), "d247-out-"));
    const r = await collectStills(share, job.id, out);
    expect(r.written).toBe(DESK_BOARDS.length);
    const names = readdirSync(out);
    expect(names).toContain("مشهد-1-نموذج-أ.png");
    expect(names).toContain("مشهد-7-نموذج-ب.png");
    expect(readFileSync(path.join(out, "مشهد-1-نموذج-أ.png")).includes(Buffer.from("tEXt"))).toBe(false);
    const manifest = JSON.parse(readFileSync(path.join(out, "storyboard.json"), "utf8"));
    expect(manifest[0]).toMatchObject({ scene: 1, variant: "مشهد-1-نموذج-أ", file: "مشهد-1-نموذج-أ.png" });
    expect(existsSync(path.join(out, "اقرأني.md"))).toBe(false);
    // صورة مستبدلة بعد العامل: بصمتها لا تطابق، فلا يُكتب شيء
    await writeFile(path.join(q.done, job.id, job.stills[0]!.file), png(1920, 1080, false));
    await expect(collectStills(share, job.id, mkdtempSync(path.join(os.tmpdir(), "d247-out2-")))).rejects.toThrow(/بصمة/);
  });

  it("أبعاد خاطئة تُرفض عند الاستلام", async () => {
    const share = mkdtempSync(path.join(os.tmpdir(), "d247-dim-"));
    const job = buildStillsJob("zubdat-desk", COMMIT);
    const q = queuePaths(share);
    await mkdir(q.running, { recursive: true });
    await writeFile(path.join(q.running, `${job.id}.json`), JSON.stringify(job));
    const local = mkdtempSync(path.join(os.tmpdir(), "d247-l2-"));
    const rendered = [];
    for (const s of job.stills) { const f = path.join(local, s.file); await writeFile(f, png(640, 360)); rendered.push({ ...s, path: f }); }
    await completeStillsJob(share, job, rendered, { commit: COMMIT, worker: "test", startedAt: "x", finishedAt: "2026-11-28T08:05:00Z", logTail: "" });
    await expect(collectStills(share, job.id, mkdtempSync(path.join(os.tmpdir(), "d247-o3-")))).rejects.toThrow(/1920×1080/);
  });

  it("العامل يوجّه stills- إلى renderStillsJob، وهو لا يمر بـrenderComposition ولا يقرأ خطة ولا وسائط", () => {
    const src = readFileSync(path.join(root, "src/render/worker/untrustedRender.ts"), "utf8");
    const head = src.slice(src.indexOf("export const renderWorkerJob"), src.indexOf("const job = await runningJob(share, id);"));
    expect(head).toMatch(/stills-/);
    expect(head).toContain("renderStillsJob(share, validateStillsJob(raw), log)");
    const body = src.slice(src.indexOf("export const renderStillsJob"));
    expect(body).not.toMatch(/renderComposition|installSnapshot|inputs\.plan|narrationGain/);
    expect(body).toContain("createIsolatedRenderBundle(emptyMedia)");
    expect(Object.keys(STORYBOARD_SETS)).toEqual(["zubdat-desk"]); // owner-pin-ok: سجل المجموعات في الكود
  });
});
