/**
 * D234 (قاعدة ثابتة): مسودة ← محرر المحتوى ← المراجعة العلمية بطبقتيها ← اعتماد المالك ← صوت ← رندر.
 * يتأكد أن: الجمل تُتتبَّع جملةً جملة (المتغيّرة وحدها تعود للمحرر)، والحالة بالترتيب الثابت، و«اعتمدت السكريبت» لا يُقبل
 * قبل المحرر والمراجعة، والبوابة ترفض الصوت والرندر برسالة تسمي الحالة، وآلية الاستثناء الصريح (فارغة اليوم: D229 أُلغي بـ D235؛ صوت مشاهد بعينها
 * من «بالإسلام» 001)، وأن كل مدخل صوت ورندر يستدعي البوابة.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  EDITOR_GATE_EXCEPTIONS, STATUS_EDITOR, STATUS_OWNER, STATUS_READY, STATUS_SCHOLARLY, editorGateException, editorReviewIssues, editorState,
  ownerApprovalRefusal, scriptPipeline, scriptSentences, sentenceHash, type EditorReview,
} from "../src/studio/scriptPipeline";
import { isOwnerContentPath } from "../scripts/contentPaths.mjs";

const root = path.join(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");
const SCRIPT = `---
title: "عنوان"
status: "مسودة"
---

<!--
ملاحظة إنتاج لا تُقرأ.
-->

كيف يبدأ هذا؟ لا نعلم. لكن نعلم شيئًا واحدًا.

[آية: نوح 23 | وَقَالُوا۟ لَا تَذَرُنَّ ءَالِهَتَكُمْ]

جملة أخيرة <!-- تعليق داخل السطر --> بلا علامة
`;
const recordFor = (text: string, extra: Partial<EditorReview> = {}): EditorReview => ({
  version: 1, channel: "balislam", episode: "010", sentences: scriptSentences(text).map((s) => s.hash),
  passes: [{ at: "2026-11-26T00:00:00.000Z", by: "محرر المحتوى", recordedBy: "المنسّق", scriptSha256: "a".repeat(64), sentences: 5, reviewed: 5 }], ...extra,
});

describe("D234: الجمل وبصماتها", () => {
  it("الجمل بعد الترويسة وخارج التعليقات، مقسومة عند علامات الوقف، والتوجيه وحدة واحدة، بأرقام أسطر المحرر", () => {
    const s = scriptSentences(SCRIPT);
    expect(s.map((x) => x.text)).toEqual(["كيف يبدأ هذا؟", "لا نعلم.", "لكن نعلم شيئًا واحدًا.", "[آية: نوح 23 | وَقَالُوا۟ لَا تَذَرُنَّ ءَالِهَتَكُمْ]", "جملة أخيرة  بلا علامة"]); // owner-pin-ok: بيانات مصطنعة في الاختبار أو قرار المالك نفسه
    expect(s[0]!.line).toBe(10); // owner-pin-ok: بيانات مصطنعة في الاختبار أو قرار المالك نفسه
    expect(s[3]!.line).toBe(12); // owner-pin-ok: بيانات مصطنعة في الاختبار أو قرار المالك نفسه
  });
  it("التشكيل والمسافات لا تغيّر البصمة (تصحيح النطق لا يعيد الجملة للمحرر)، وتغيير كلمة يغيّرها", () => {
    expect(sentenceHash("لا نعلم.")).toBe(sentenceHash("لَا  نَعْلَمُ."));
    expect(sentenceHash("لا نعلم.")).not.toBe(sentenceHash("لا ندري."));
  });
});

describe("D234: حالة السكريبت بالترتيب الثابت", () => {
  const passedEditor = editorState(SCRIPT, recordFor(SCRIPT));
  it("بلا مرور: كل الجمل تنتظر المحرر", () => {
    const e = editorState(SCRIPT, null);
    expect(e).toMatchObject({ reviewed: false, partial: false, total: 5 });
    expect(e.pending).toHaveLength(5); // owner-pin-ok: بيانات مصطنعة في الاختبار أو قرار المالك نفسه
    expect(scriptPipeline({ editor: e, specialist: [], draft: true, approval: { approved: true } }).status).toBe(STATUS_EDITOR);
  });
  it("تغيّرت جملة بعد مرور المحرر (مثلًا بالمراجعة العلمية): تعود وحدها", () => {
    const changed = SCRIPT.replace("لا نعلم.", "لا نعلم بيقين.");
    const e = editorState(changed, recordFor(SCRIPT));
    expect(e.partial).toBe(true);
    expect(e.pending.map((x) => [x.line, x.text])).toEqual([[10, "لا نعلم بيقين."]]);
    expect(scriptPipeline({ editor: e, specialist: [], draft: true, approval: { approved: false } }).status).toBe(STATUS_EDITOR);
  });
  it("المحرر ← المراجعة العلمية ← اعتمادك ← جاهز للإنتاج", () => {
    const at = (specialist: string[] | null, approval: { approved: boolean; stale?: boolean }) => scriptPipeline({ editor: passedEditor, specialist, draft: true, approval }).status;
    expect(at(["البخاري ١٨٩٩"], { approved: true })).toBe(STATUS_SCHOLARLY);
    expect(at(null, { approved: false })).toBe(STATUS_SCHOLARLY); // خارج ترتيب النشر: لا سجل مراجعة
    expect(at([], { approved: false })).toBe(STATUS_OWNER);
    expect(at([], { approved: true, stale: true })).toBe(STATUS_OWNER);
    expect(at([], { approved: true })).toBe(STATUS_READY);
  });
  it("«اعتمدت السكريبت» لا يُقبل قبل المحرر والمراجعة العلمية، والرسالة تسمي الحالة", () => {
    expect(ownerApprovalRefusal(scriptPipeline({ editor: editorState(SCRIPT, null), specialist: [], draft: true, approval: { approved: false } }))).toMatch(/«بانتظار المحرر»/);
    expect(ownerApprovalRefusal(scriptPipeline({ editor: passedEditor, specialist: ["بند"], draft: true, approval: { approved: false } }))).toMatch(/«بانتظار المراجعة العلمية»/);
    expect(ownerApprovalRefusal(scriptPipeline({ editor: passedEditor, specialist: [], draft: true, approval: { approved: false } }))).toBeNull();
  });
  it("المرور الموروث (حلقة منشورة قبل القاعدة) صريح، ويسقط عن أي جملة تتغيّر بعده", () => {
    const rec = recordFor(SCRIPT);
    rec.passes[0]!.grandfathered = "D234: منشورة قبل القاعدة";
    expect(scriptPipeline({ editor: editorState(SCRIPT, rec), specialist: ["بند"], draft: false, approval: { approved: false } }).status).toBe(STATUS_READY);
    expect(scriptPipeline({ editor: editorState(SCRIPT + "\nجملة جديدة.\n", rec), specialist: ["بند"], draft: false, approval: { approved: false } }).status).toBe(STATUS_EDITOR);
  });
  it("السجل الناقص لا يُقبل", () => {
    expect(editorReviewIssues({ version: 1, channel: "balislam", episode: "010", sentences: ["x"], passes: [] }, "balislam", "010").length).toBeGreaterThan(0);
    expect(editorReviewIssues(recordFor(SCRIPT), "balislam", "010")).toEqual([]);
    expect(editorReviewIssues(recordFor(SCRIPT), "balislam", "011")).toEqual(["سجل المحرر: رقم الحلقة لا يطابق مجلدها."]); // owner-pin-ok: بيانات مصطنعة في الاختبار أو قرار المالك نفسه
  });
});

describe("D234: الاستثناءات الصريحة (آلية بلا استثناء اليوم؛ D229 أُلغي بـ D235)", () => {
  const voiceOnly = [{ episode: "001", scenes: ["c1-s1", "c1-s2"], decision: "D229" }];
  const one = [{ channel: "balislam", episode: "001", decision: "D229" }];
  it("لا استثناء مسجّل: صوت أي مشهد يمر بالمحرر", () => {
    expect(EDITOR_GATE_EXCEPTIONS).toEqual([]);
    expect(editorGateException({ channel: "balislam", episode: "001", voiceScenes: ["c1-s1"], voiceOnly })).toBeNull();
  });
  it("الآلية: صوت مشاهد استثناء مسجّل وحدها؛ لا رندر، ولا مشهد آخر، ولا قناة أو حلقة أخرى، ولا قرار آخر", () => {
    expect(editorGateException({ channel: "balislam", episode: "001", voiceScenes: ["c1-s1", "c1-s2"], voiceOnly }, one)).toBe("D229"); // owner-pin-ok: بيانات مصطنعة
    expect(editorGateException({ channel: "balislam", episode: "001", voiceScenes: null, voiceOnly }, one)).toBeNull(); // رندر أو صوت الحلقة كلها
    expect(editorGateException({ channel: "balislam", episode: "001", voiceScenes: ["c1-s1", "c2-s1"], voiceOnly }, one)).toBeNull();
    expect(editorGateException({ channel: "balislam", episode: "002", voiceScenes: ["c1-s1"], voiceOnly: [{ ...voiceOnly[0]!, episode: "002" }] }, one)).toBeNull();
    expect(editorGateException({ channel: "zubdat-alkutub", episode: "001", voiceScenes: ["c1-s1"], voiceOnly }, one)).toBeNull();
    expect(editorGateException({ channel: "balislam", episode: "001", voiceScenes: ["c1-s1"], voiceOnly: [{ ...voiceOnly[0]!, decision: "D999" }] }, one)).toBeNull();
  });
  it("في المستودع: «بالإسلام» مجمّدة كاملًا (D235) بلا استثناء صوت", () => {
    const stock = JSON.parse(read("channels/balislam/stock.json"));
    expect(stock.frozen).toBeTruthy();
    expect(stock.frozen.voiceOnly ?? []).toEqual([]);
    expect(stock.frozen.editorialPause).toBe(true); // D235: إعادة الهيكلة توقف التحرير أيضًا، فلا تُرسل للمحرر
    // «زبدة الكتب» مجمّدة إنتاجًا وحده (D211): الكتابة والتحرير مستمران، فتبقى في دفعات المحرر (D236)
    expect(JSON.parse(read("channels/zubdat-alkutub/stock.json")).frozen?.editorialPause).toBeFalsy();
  });
});

describe("D234: البوابة وسجل المحرر (ملفات مؤقتة)", () => {
  const tmp = mkdtempSync(path.join(os.tmpdir(), "d234-"));
  const prev = process.env.BAL_CHANNELS_DIR;
  const ep = path.join(tmp, "balislam", "episodes", "001-x");
  const script = path.join(ep, "script.md");
  const ep2 = path.join(tmp, "balislam", "episodes", "010-y");
  beforeAll(() => {
    process.env.BAL_CHANNELS_DIR = tmp;
    mkdirSync(ep, { recursive: true });
    mkdirSync(ep2, { recursive: true });
    writeFileSync(path.join(tmp, "balislam", "channel.json"), "{}");
    writeFileSync(script, SCRIPT);
    writeFileSync(path.join(ep2, "script.md"), SCRIPT.replace("كيف يبدأ", "متى يبدأ"));
    writeFileSync(path.join(tmp, "balislam", "stock.json"), JSON.stringify({ version: 1, phase: 1,
      slots: [{ week: 1, title: "س", batch: 2, episode: "001" }, { week: 2, title: "ص", batch: 1, episode: "010", specialist: [] }] }));
    // قناة موقوفة تحريريًا صراحة: سكريبتاتها لا تذهب للمحرر إلا بـ --include-paused
    mkdirSync(path.join(tmp, "zubdat-alkutub", "episodes", "002-z"), { recursive: true });
    writeFileSync(path.join(tmp, "zubdat-alkutub", "channel.json"), "{}");
    writeFileSync(path.join(tmp, "zubdat-alkutub", "episodes", "002-z", "script.md"), SCRIPT);
    writeFileSync(path.join(tmp, "zubdat-alkutub", "stock.json"), JSON.stringify({ version: 1, phase: 1, frozen: { decision: "D235", editorialPause: true }, slots: [] }));
  });
  afterAll(() => {
    if (prev === undefined) delete process.env.BAL_CHANNELS_DIR; else process.env.BAL_CHANNELS_DIR = prev;
    rmSync(tmp, { recursive: true, force: true });
  });

  it("ترفض الصوت والرندر قبل المحرر برسالة تسمي الحالة، بلا استثناء", async () => {
    const st = await import("../src/studio/scriptPipelineStore");
    await expect(st.assertEditorPassed(script)).rejects.toThrow(/«بانتظار المحرر» \(D234\).*لم يراجعه بعد \(5 جملة\)/);
    await expect(st.assertEditorPassed(script, { voiceScenes: ["c1-s2"] })).rejects.toThrow(/بانتظار المحرر/);
    await expect(st.assertEditorPassed(script, { voiceScenes: ["c1-s1"] })).rejects.toThrow(/بانتظار المحرر/);
    await expect(st.assertEditorPassed(path.join(tmp, "balislam", "episodes", "999-none", "script.md"))).rejects.toThrow(/لا سكريبت/); // يُغلق ولا يُفتح
  });

  it("بعد مرور المحرر تمر؛ وجملة متغيّرة بعده ترفضها وحدها؛ والدفعة القديمة لا تُسجَّل على نص تغيّر", async () => {
    const st = await import("../src/studio/scriptPipelineStore");
    const sent = (await st.editorQueue()).find((x) => x.episode === "001")!.scriptSha256;
    const r = await st.recordEditorPass(script, { by: "محرر المحتوى", recordedBy: "المنسّق", batch: 1, expectSha: sent.slice(0, 12) });
    expect(r.reviewed).toBe(5); // owner-pin-ok: بيانات مصطنعة في الاختبار أو قرار المالك نفسه
    expect(isOwnerContentPath(path.relative(path.dirname(tmp), r.file).replace(/^[^/]+\//, "channels/"))).toBe(true);
    await expect(st.assertEditorPassed(script)).resolves.toBeUndefined();
    writeFileSync(script, SCRIPT.replace("لا نعلم.", "لا نعلم بيقين."));
    await expect(st.assertEditorPassed(script)).rejects.toThrow(/1 جملة تغيّرت بعد مراجعته تنتظره/);
    await expect(st.recordEditorPass(script, { by: "م", recordedBy: "ن", expectSha: sent.slice(0, 12) })).rejects.toThrow(/تغيّر السكريبت بعد إرسال الدفعة/);
    const again = await st.recordEditorPass(script, { by: "م", recordedBy: "ن" });
    expect(again.reviewed).toBe(1); // owner-pin-ok: بيانات مصطنعة في الاختبار أو قرار المالك نفسه
    expect(again.record.passes).toHaveLength(2); // owner-pin-ok: بيانات مصطنعة في الاختبار أو قرار المالك نفسه
    await expect(st.assertEditorPassed(script)).resolves.toBeUndefined();
  });

  it("الرندر يعرف السكريبت من وصف وسائطه", async () => {
    const st = await import("../src/studio/scriptPipelineStore");
    expect(st.scriptPathFromRenderMedia("_render/balislam/001-x/0123456789abcdef01234567/")).toBe(script);
    expect(st.scriptPathFromRenderMedia("/etc/passwd")).toBeNull();
  });

  it("دفعة المحرر: الجمل المتغيّرة وحدها لمن راجعه، ورابط GitHub، وبيان بالبصمة، ولا تكرار لما أُرسل", async () => {
    const st = await import("../src/studio/scriptPipelineStore");
    writeFileSync(script, SCRIPT.replace("لا نعلم.", "لا نعلم أبدًا."));
    const dir = path.join(tmp, "batches");
    const r = await st.writeEditorBatch({ dir, now: new Date("2026-11-26T12:00:00Z") });
    expect(r.n).toBe(1); // owner-pin-ok: بيانات مصطنعة في الاختبار أو قرار المالك نفسه
    expect(r.items.map((x) => x.episode)).toEqual(["010", "001"]); // owner-pin-ok: الدفعة ١ (رمضان) أولًا
    const md = readFileSync(r.file!, "utf8");
    expect(md).toContain("https://github.com/saladin76/balislam/blob/main/channels/balislam/episodes/001-x/script.md");
    expect(md).toContain("الجمل المتغيّرة وحدها (١ من ٥)");
    expect(md).toContain("السطر ١٠: لا نعلم أبدًا.");
    expect(md).toContain("السكريبت كاملًا (٥ جملة)");
    expect(md).not.toContain("كيف يبدأ هذا؟"); // جملة مرّت بالمحرر لا تُعاد
    expect(existsSync(path.join(dir, "دفعة-المحرر-01.json"))).toBe(true);
    const again = await st.writeEditorBatch({ dir });
    expect(again.file).toBeNull();
    expect(st.sentShaFor(dir, 1, "balislam", "001")).toBe(r.items[1]!.scriptSha256);
  });

  it("الموقوفة تحريريًا (editorialPause) خارج دفعة المحرر افتراضيًا وتدخل بـ --include-paused؛ والمجمّدة إنتاجًا وحده (D211) تبقى فيها", async () => {
    const st = await import("../src/studio/scriptPipelineStore");
    expect((await st.editorQueue()).some((x) => x.channel === "zubdat-alkutub")).toBe(false);
    expect((await st.editorQueue(undefined, { includePaused: true })).map((x) => `${x.channel}/${x.episode}`)).toContain("zubdat-alkutub/002"); // owner-pin-ok: بيانات مصطنعة
    const r = await st.writeEditorBatch({ dir: path.join(tmp, "batches-paused"), includePaused: true });
    expect(r.items.some((x) => x.channel === "zubdat-alkutub")).toBe(true);
    writeFileSync(path.join(tmp, "zubdat-alkutub", "stock.json"), JSON.stringify({ version: 1, phase: 1, frozen: { decision: "D211" }, slots: [] }));
    expect((await st.editorQueue()).map((x) => `${x.channel}/${x.episode}`)).toContain("zubdat-alkutub/002"); // owner-pin-ok: بيانات مصطنعة
  });
});

describe("D234: كل مدخل صوت ورندر يستدعي البوابة (فحص المصدر)", () => {
  const body = (file: string, start: string, end?: string) => {
    const src = read(file);
    const from = src.indexOf(start);
    expect(from, `${file}: ${start}`).toBeGreaterThanOrEqual(0);
    const rest = src.slice(from);
    return end ? rest.slice(0, rest.indexOf(end) > 0 ? rest.indexOf(end) : undefined) : rest;
  };
  it("الصوت: الجملة (التوليد وإعادة نطق الكلمة وإعادة توليد المشهد)، والمشهد، وترقية النبرة", () => {
    const gates = body("src/voice/sentenceGenerate.ts", "export const voiceGates", "export const newSeed");
    expect(gates).toContain("assertEditorPassed(ctx.scriptPath, { voiceScenes: [scene.id] })");
    expect(gates.indexOf("assertEditorPassed")).toBeLessThan(gates.indexOf("opts.client.voiceInfo"));
    expect(body("src/voice/sentenceGenerate.ts", "export const generateOne", "export const fixWord")).toContain("await voiceGates(");
    expect(body("src/voice/sentenceGenerate.ts", "export const fixWord")).toContain("await voiceGates(");
    const gen = body("src/voice/generate.ts", "const generateVoiceLocked");
    expect(gen).toContain("assertEditorPassed(scriptPath, { voiceScenes:");
    expect(gen.indexOf("assertEditorPassed")).toBeLessThan(gen.indexOf("opts.client!.tts("));
    expect(body("src/voice/toneUpgrade.ts", "export const upgradeTones")).toContain("assertEditorPassed(");
  });
  it("الرندر: كل رندر حلقة (معاينة المشهد والتجميع والنسخة النهائية)، وقلب الرندر على الماك والعامل، والمعاينة الصامتة، ومهمة العامل", () => {
    const ep = body("src/render/episode.ts", "export const renderEpisode", "export type RenderCompositionOptions");
    expect(ep.indexOf("await assertEditorPassed(scriptPath)")).toBeGreaterThan(0);
    expect(ep.indexOf("await assertEditorPassed(scriptPath)")).toBeLessThan(ep.indexOf("prepareRenderMedia"));
    const core = body("src/render/episode.ts", "export const renderComposition");
    expect(core.indexOf("await assertEditorPassed(editorScript)")).toBeGreaterThan(0);
    expect(core.indexOf("await assertEditorPassed(editorScript)")).toBeLessThan(core.indexOf("createIsolatedRenderBundle"));
    const motion = body("src/render/storyboardMotion.ts", "export const measureStoryboardMotion");
    expect(motion.indexOf("assertEditorPassed(")).toBeLessThan(motion.indexOf("createIsolatedRenderBundle"));
    const submit = body("src/render/worker/macSide.ts", "export const submitWorkerShorts", "export const verifyWorkerOutput");
    expect(submit.indexOf("assertEditorPassed(ctx.scriptPath)")).toBeGreaterThan(0);
    expect(submit.indexOf("assertEditorPassed(ctx.scriptPath)")).toBeLessThan(submit.indexOf("publishSnapshot("));
  });
  it("الخادم وأوامر bal: البوابة العامة للإنتاج تمر بالمحرر، و«اعتمدت السكريبت» يُرفض قبل المحرر والمراجعة", () => {
    expect(body("src/studio/stockStore.ts", "export const productionBlockFor", "const episodeOfScript")).toContain("editorGateRefusal(scriptPath, { voiceScenes })");
    expect(body("src/studio/stockStore.ts", "export const approveDraftScript", "export const productionBlockFor")).toContain("await draftApprovalRefusal(ch, num)");
    const route = body("app/server/routes/stock.ts", 'parts[3] === "approve-script"');
    expect(route.indexOf("draftApprovalRefusal")).toBeLessThan(route.indexOf("approveDraftScript"));
    expect(read("src/cli/index.ts")).toContain("productionBlockFor(currentChannelId()");
  });
  it("«بانتظارك»: حالة لكل سكريبت، والزر بعد المحرر والمراجعة وحدهما", () => {
    const ui = read("app/src/tabs/Awaiting.tsx");
    expect(ui).toContain("data-status={p.status}");
    expect(ui).toContain('{p.status === "بانتظار اعتمادك" && <button');
    expect(ui.match(/اعتمدت السكريبت<\/button>/g)).toHaveLength(1); // owner-pin-ok: بيانات مصطنعة في الاختبار أو قرار المالك نفسه
  });
});

describe("D234: البذور في المستودع", () => {
  const eps = (ch: string) => readdirSync(path.join(root, "channels", ch, "episodes")).filter((d) => existsSync(path.join(root, "channels", ch, "episodes", d, "script.md")));
  it("كل سجل محرر في المستودع صالح ويخص مجلده، ومحتوى يُحفظ في main", () => {
    for (const ch of ["balislam", "dafatir-alzaman", "zubdat-alkutub"])
      for (const d of eps(ch)) {
        const f = `channels/${ch}/episodes/${d}/editor-review.json`;
        if (!existsSync(path.join(root, f))) continue;
        expect(editorReviewIssues(JSON.parse(read(f)), ch, d.slice(0, 3)), f).toEqual([]);
        expect(isOwnerContentPath(f)).toBe(true);
      }
  });
  it("«دفاتر الزمن» 001 المنشورة موروثة صراحة (D234)؛ و«بالإسلام» 001 بلا مرور", () => {
    const rec = JSON.parse(read("channels/dafatir-alzaman/episodes/001-adam-beginning/editor-review.json")) as EditorReview;
    expect(rec.passes[0]!.grandfathered).toMatch(/D234/);
    expect(existsSync(path.join(root, "channels/balislam/episodes/001-know-the-truth/editor-review.json"))).toBe(false);
  });
});
