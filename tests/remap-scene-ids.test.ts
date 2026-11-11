import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readIdMap, remapKeys, remapLocalVoice } from "../src/plan/remapIds";
import type { Plan } from "../src/plan/types";

// نقل ملفات الصوت المحلية إلى المعرّفات الجديدة بعد جعل الخطة قسمًا واحدًا (D87)
const plan = (ids: [string, string][]): Plan => ({
  version: 1, episode: "001", title: "", domain: "general", themeId: "warm", channel: "x", lang: "ar", updatedAt: "",
  chapters: [{ number: 1, title: "", scenes: ids.map(([id, narration]) => ({ id, template: "t", narration, line: 1, props: {}, sfx: [] })) }],
} as unknown as Plan);
const map = { "c1-s1": "c1-s1", "c2-s1": "c1-s2", "c2-s2": "c1-s3", "c2-end": "c1-end" };
const p = plan([["c1-s1", "أ"], ["c1-s2", "بَ ب"], ["c1-s3", "ج"], ["c1-end", ""]]);

describe("remapKeys", () => {
  it("ينقل المفتاح إلى مقابله إن طابق النص (بلا اعتبار للتشكيل)، ويبقي غير المتغير كما هو", () => {
    const r = remapKeys({ "c1-s1": { text: "أ" }, "c2-s1": { text: "ب ب" }, "c2-s2": { text: "ج" } }, map, p, (v) => v.text);
    expect(r.next).toEqual({ "c1-s1": { text: "أ" }, "c1-s2": { text: "ب ب" }, "c1-s3": { text: "ج" } });
    expect(r.moved).toEqual([["c2-s1", "c1-s2"], ["c2-s2", "c1-s3"]]);
    expect(r.skipped).toEqual([]);
  });
  it("لا ينقل نصًا لا يطابق ولا مدخلًا بلا نص، ولا يكرر النقل بعد تطبيقه", () => {
    const r = remapKeys({ "c2-s1": { text: "غير" }, "c2-s2": {} as { text?: string } }, map, p, (v) => v.text ?? null);
    expect(r.moved).toEqual([]);
    expect(r.skipped.map((x) => x.id)).toEqual(["c2-s1", "c2-s2"]);
    const done = remapKeys({ "c1-s2": { text: "ب ب" }, "c1-s3": { text: "ج" } }, map, p, (v) => v.text);
    expect(done.moved).toEqual([]);
    expect(done.next).toEqual({ "c1-s2": { text: "ب ب" }, "c1-s3": { text: "ج" } });
  });
  it("--with-changed-text (D89): ينقل ما تغيّر نص مشهده بعد تسجيله ويذكره، ولا يغيّر محتواه", () => {
    const r = remapKeys({ "c2-s1": { text: "نص أقدم" }, "c2-s2": { text: "ج" } }, map, p, (v) => v.text, { withChangedText: true });
    expect(r.moved).toEqual([["c2-s1", "c1-s2"], ["c2-s2", "c1-s3"]]);
    expect(r.changed).toEqual(["c2-s1"]);
    expect(r.next["c1-s2"]).toEqual({ text: "نص أقدم" });
    expect(remapKeys({ "c2-s1": { text: "نص أقدم" } }, map, p, (v) => v.text).skipped[0]!.reason).toContain("--with-changed-text");
  });
  it("لا يكتب فوق مدخل باقٍ، ويُبلغ عن المدخل الذي يضيع", () => {
    const m = { "c1-s2": "c1-s3", "c1-s3": "c1-s3" };
    const r = remapKeys({ "c1-s2": { text: "ج" }, "c1-s3": { text: "ج" } }, m, p, (v) => v.text);
    expect(r.moved).toEqual([]);
    expect(r.skipped[0]!.reason).toContain("له مدخل قائم");
  });
});

describe("remapLocalVoice", () => {
  const setup = () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "remap-"));
    mkdirSync(path.join(dir, "voice"));
    writeFileSync(path.join(dir, "voice", "index.json"), JSON.stringify({ "c1-s1": { file: "a.wav", hash: "h1", text: "أ" }, "c2-s1": { file: "b.wav", hash: "h2", text: "ب ب" } }));
    writeFileSync(path.join(dir, "voice", "sentences.json"), JSON.stringify({ version: 1, scenes: { "c2-s2": { sentences: [{ id: "x", sceneId: "c2-s2", text: "ج" }], createdAt: "", import: { state: "none" } } } }));
    return dir;
  };
  it("تجربة افتراضيًا: لا يكتب شيئًا", async () => {
    const dir = setup();
    const before = readFileSync(path.join(dir, "voice", "index.json"), "utf8");
    const r = await remapLocalVoice(dir, p, map);
    expect(r.map((x) => [x.file, x.moved, x.written])).toEqual([["voice/index.json", [["c2-s1", "c1-s2"]], false], ["voice/sentences.json", [["c2-s2", "c1-s3"]], false]]);
    expect(readFileSync(path.join(dir, "voice", "index.json"), "utf8")).toBe(before);
  });
  it("مع apply: ينقل المفاتيح وsceneId بلا تغيير في المحتوى، ويحفظ نسخة قبلها", async () => {
    const dir = setup();
    await remapLocalVoice(dir, p, map, { apply: true });
    expect(JSON.parse(readFileSync(path.join(dir, "voice", "index.json"), "utf8"))).toEqual({ "c1-s1": { file: "a.wav", hash: "h1", text: "أ" }, "c1-s2": { file: "b.wav", hash: "h2", text: "ب ب" } });
    const s = JSON.parse(readFileSync(path.join(dir, "voice", "sentences.json"), "utf8"));
    expect(s.scenes["c1-s3"].sentences).toEqual([{ id: "x", sceneId: "c1-s3", text: "ج" }]);
    expect(existsSync(path.join(dir, "voice", "index.before-remap.json"))).toBe(true);
    expect(existsSync(path.join(dir, "voice", "sentences.before-remap.json"))).toBe(true);
  });
});

describe("خرائط المعرّفات المحفوظة للحلقات 001", () => {
  const eps = [
    ["channels/balislam/episodes/001-know-the-truth", "versions/2026-11-11-574ec242-headings"],
    ["channels/zubdat-alkutub/episodes/001-awwal-marra-osalli", "versions/2026-11-11-cfed78ed-headings"],
    // دفاتر الزمن: الخطة بعد إعادة الربط محفوظة plan.v9.1.json؛ الأمر 031 غيّر بعدها نص مشهدين وأضاف c1-s48
    ["channels/dafatir-alzaman/episodes/001-adam-beginning", "versions/2026-11-11-4a9cc3b0-sections", "plan.v9.1.json"],
  ];
  it.each(eps)("%s: الخطة الحالية قسم واحد، وكل مشهد قديم = مقابله في الخطة الحالية إلا معرّفه وسطره", async (ep, v, curPlan = "plan.json") => {
    const m = await readIdMap(path.join(ep, v, "id-map.json"));
    type P = { chapters: { number: number; title: string; scenes: Record<string, unknown>[] }[] };
    const cur = JSON.parse(readFileSync(path.join(ep, curPlan!), "utf8")) as P;
    const old = JSON.parse(readFileSync(path.join(ep, v, "plan.json"), "utf8")) as P;
    expect(cur.chapters.map((c) => [c.number, c.title])).toEqual([[1, ""]]);
    const before = old.chapters.flatMap((c) => c.scenes);
    const after = cur.chapters[0]!.scenes;
    expect(after.map((s) => s.id)).toEqual(before.map((s) => m[s.id as string]));
    const strip = (s: Record<string, unknown>) => { const { id: _i, line: _l, ...rest } = s; return rest; };
    after.forEach((s, i) => expect(strip(s)).toEqual(strip(before[i]!)));
  });
});
