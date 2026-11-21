/**
 * الأغلفة الثلاثة (قرار المالك ٢١ نوفمبر ٢٠٢٦، المرحلة ٢ البند ١): عنوان، مشهد، سؤال؛ ≤ ٣ كلمات؛ لا تكرر العنوان.
 * لا يقرأ هذا الاختبار حلقة حية ولا publish.json لمالك (KI-068): كل المدخلات مكتوبة هنا.
 */
import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  conceptOrder, frameTimeFor, isSacredScene, suggestThumbnails, thumbnailIssues, thumbnailWords, type ThumbnailConcept,
} from "../src/package/thumbnails";
import { kitIssues } from "../src/package/quality";
import { kitToMarkdown, type PublishKit } from "../src/package/social";
import { frameArgs, sceneFrameDataUri } from "../src/package/thumbnailFrame";
import { rebindThumbnails } from "../src/package/package";
import { QuestionThumb, SceneThumb } from "../src/remotion/Thumbnail";

const TITLE = "خلق آدم عليه السلام وبداية البشرية";
const scenes = [
  { id: "c1-s1", sacred: false },
  { id: "c1-s2", sacred: true },
  { id: "c1-s3", sacred: false },
];
const good: ThumbnailConcept[] = [
  { kind: "title", text: "أول إنسان" },
  { kind: "scene", text: "أبو البشر", sceneId: "c1-s3" },
  { kind: "question", text: "متى كانت البداية؟" },
];
const ctx = { titles: [TITLE], scenes };
const errors = (c: ThumbnailConcept[] | undefined) => thumbnailIssues(c, ctx).filter((i) => i.level === "error");
const edit = (patch: (c: ThumbnailConcept[]) => void) => { const c = structuredClone(good); patch(c); return c; };

describe("الأغلفة الثلاثة: القواعد", () => {
  it("ثلاثة مختلفة الفكرة بثلاث كلمات على الأكثر ولا تكرر العنوان: بلا مشكلة", () => {
    expect(thumbnailIssues(good, ctx)).toEqual([]);
  });
  it("أكثر من ثلاث كلمات على الصورة: خطأ", () => {
    expect(errors(edit((c) => (c[0]!.text = "أول إنسان على الأرض"))).map((i) => i.message).join()).toMatch(/4 كلمات؛ الحد 3/);
  });
  it("علامات الترقيم لا تُعد كلمة", () => {
    expect(thumbnailWords("متى كانت البداية ؟")).toHaveLength(3);
    expect(thumbnailWords("«أول» إنسان!")).toHaveLength(2);
  });
  it("الغلاف يكرر العنوان (كل كلماته من عنوان واحد، أصليًا كان أو بديلًا): خطأ", () => {
    expect(errors(edit((c) => (c[0]!.text = "خلق آدم"))).some((i) => /يكرر العنوان/.test(i.message))).toBe(true);
    // كلمة مشتركة واحدة مع كلمة جديدة ليست تكرارًا
    expect(errors(edit((c) => (c[0]!.text = "آدم الأول")))).toEqual([]);
  });
  it("ينقص نوع أو يتكرر: خطأ «ثلاثة بالضبط»", () => {
    expect(errors(edit((c) => (c[2]!.kind = "title"))).some((i) => i.where === "الأغلفة الثلاثة")).toBe(true);
    expect(errors(good.slice(0, 2)).some((i) => i.where === "الأغلفة الثلاثة")).toBe(true);
  });
  it("السؤال بلا «؟»: خطأ ومعه اقتراح", () => {
    const i = errors(edit((c) => (c[2]!.text = "متى كانت البداية"))).find((x) => /ينتهي بـ«؟»/.test(x.message));
    expect(i?.suggestion).toBe("متى كانت البداية؟");
  });
  it("نصان متطابقان في غلافين: خطأ", () => {
    expect(errors(edit((c) => (c[1]!.text = "أول إنسان"))).some((i) => /النص نفسه/.test(i.message))).toBe(true);
  });
  it("العنوان والسؤال بلا كلمات: خطأ؛ والمشهد بلا كلمات مقبول", () => {
    expect(errors(edit((c) => (c[0]!.text = " "))).some((i) => /بلا كلمات/.test(i.message))).toBe(true);
    expect(errors(edit((c) => (c[1]!.text = "")))).toEqual([]);
  });
  it("غلاف المشهد: يُختار مشهد من الخطة، وليس مشهد آية", () => {
    expect(errors(edit((c) => delete c[1]!.sceneId)).some((i) => /اختر المشهد/.test(i.message))).toBe(true);
    expect(errors(edit((c) => (c[1]!.sceneId = "c9-s9"))).some((i) => /ليس في خطة/.test(i.message))).toBe(true);
    expect(errors(edit((c) => (c[1]!.sceneId = "c1-s2"))).some((i) => /مشهد آية/.test(i.message))).toBe(true);
  });
  it("أثر أدوات الإنتاج على الصورة: خطأ (القاعدة الأولى)", () => {
    expect(errors(edit((c) => (c[0]!.text = "بصوت ElevenLabs"))).some((i) => /أثر أدوات/.test(i.message))).toBe(true);
  });
  it("مشاهد الآية والبسملة والدعاء لا تصلح غلافًا", () => {
    expect(isSacredScene({ template: "horizon-shot", props: { verseKey: "2:30" } })).toBe(true);
    expect(isSacredScene({ template: "verse-card", props: {} })).toBe(true);
    expect(isSacredScene({ template: "dua-board", props: {} })).toBe(true);
    expect(isSacredScene({ template: "horizon-shot", props: { shot: "lineage" } })).toBe(false);
  });
});

describe("الأغلفة الثلاثة: حزمة النشر", () => {
  const kit = (thumbnails?: ThumbnailConcept[]): PublishKit => ({
    version: 1, generatedBy: "edited", updatedAt: "2026-11-21T00:00:00.000Z",
    long: { titles: [{ text: TITLE, angle: "العنوان الأساسي" }], description: "عرفت الأرض أممًا كثيرة وتعاقبت عليها الأجيال.\n\n#دفاتر_الزمن",
      tags: ["دفاتر_الزمن", "التاريخ"], hashtags: ["#دفاتر_الزمن"], pinnedComment: "ما الفكرة التي توقفت عندها أكثر؟", thumbnailTexts: [], facebook: "عرفت الأرض أممًا كثيرة. ما رأيك؟", ...(thumbnails ? { thumbnails } : {}) },
    shorts: [],
  });
  it("أغلفة لا تحقق القواعد تمنع الحزمة كباقي نصوص النشر", () => {
    const issues = kitIssues(kit(edit((c) => (c[0]!.text = "خلق آدم"))), { title: TITLE, scenes });
    expect(issues.some((i) => i.level === "error" && /يكرر العنوان/.test(i.message))).toBe(true);
  });
  it("الحلقة القديمة بلا أغلفة: تنبيه لا يمنع صنع النسخة النهائية", () => {
    const issues = kitIssues(kit()).filter((i) => i.where === "الأغلفة الثلاثة");
    expect(issues.map((i) => i.level)).toEqual(["warning"]);
  });
  it("social.md يكتب الأغلفة بترتيب ملفاتها", () => {
    const md = kitToMarkdown(kit([good[2]!, good[0]!, good[1]!]), TITLE);
    expect(md).toContain("1. عنوان: أول إنسان\n2. مشهد: أبو البشر — لقطة من c1-s3\n3. سؤال: متى كانت البداية؟");
    expect(conceptOrder([good[2]!, good[1]!, good[0]!]).map((c) => c.kind)).toEqual(["title", "scene", "question"]);
  });
});

describe("الأغلفة الثلاثة: الاقتراح الأولي", () => {
  const s = (id: string, narration: string, sacred = false) => ({ id, narration, sacred });
  it("أقصر سؤال يُقرأ وحده (بلا واو/فاء العطف)، ومشهد ليس آية، والعنوان يكتبه المالك", () => {
    const r = suggestThumbnails({ titles: [TITLE], scenes: [
      s("a", "عرفت الأرض أممًا كثيرة."), s("b", "فمتى كانت تلك البداية الأولى للبشر؟ وأين كانت؟"),
      s("c", "وما معنى ذلك؟", true), s("d", "أول إنسان خلقه الله."), s("e", "ثم نمضي معًا."),
    ] });
    expect(r.find((c) => c.kind === "question")?.text).toBe("أين كانت؟");
    expect(r.find((c) => c.kind === "title")?.text).toBe("");
    expect(["a", "b", "d", "e"]).toContain(r.find((c) => c.kind === "scene")?.sceneId);
  });
});

describe("الأغلفة الثلاثة: لقطة المشهد", () => {
  it("لحظة اللقطة: ٦٠٪ من المشهد آليًا، أو ما حدده المالك، داخل حدوده دائمًا", () => {
    expect(frameTimeFor(10)).toBe(6);
    expect(frameTimeFor(10, 2.5)).toBe(2.5);
    expect(frameTimeFor(10, 99)).toBe(9.9);
    expect(frameTimeFor(0)).toBe(0);
  });
  it("إطار واحد بلا بيانات وصفية", () => {
    expect(frameArgs("in.mp4", 1.2, "o.jpg")).toEqual(expect.arrayContaining(["-ss", "1.200", "-frames:v", "1", "-map_metadata", "-1"]));
  });
  it("اللقطة من فيديو المشهد نفسه، وبلا فيديو لا شيء (الغلاف بعنصر الحلقة)", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "thumb-frame-"));
    try {
      await mkdir(path.join(root, "previews"));
      const script = path.join(root, "script.md");
      execFileSync("ffmpeg", ["-nostdin", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=25:duration=2", "-pix_fmt", "yuv420p", path.join(root, "previews", "scene-c1-s3-av.mp4")]);
      const f = await sceneFrameDataUri(script, "c1-s3");
      expect(f?.uri.startsWith("data:image/jpeg;base64,")).toBe(true);
      expect(f!.at).toBeCloseTo(1.2, 1);
      expect(await sceneFrameDataUri(script, "c1-s4")).toBeNull();
      expect(await sceneFrameDataUri(script, "../x")).toBeNull();
    } finally { await rm(root, { recursive: true, force: true }); }
  }, 30_000);
});

describe("الأغلفة الثلاثة: التسليم إلى Drive", () => {
  const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
  it("الأغلفة الجديدة تُربط بمجموعة Master الحالي بعينه، ولا تُمس مجموعة Master آخر", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "thumb-set-"));
    try {
      await writeFile(path.join(dir, "001-episode.mp4"), "MASTER");
      await writeFile(path.join(dir, "001-thumbnail-1.png"), "NEW1");
      const setFile = path.join(dir, "001-handoff-set.json");
      const set = { version: 1, master: "001-episode.mp4", masterSha256: sha("MASTER"), files: { "001-episode.ar.srt": "s", "001-thumbnail-1.png": "old", "001-thumbnail-3.png": "old3" } };
      await writeFile(setFile, JSON.stringify(set));
      expect(await rebindThumbnails(dir, "001", ["001-thumbnail-1.png"])).toBe(true);
      expect(JSON.parse(await readFile(setFile, "utf8")).files).toEqual({ "001-episode.ar.srt": "s", "001-thumbnail-1.png": sha("NEW1") });
      await writeFile(setFile, JSON.stringify({ ...set, masterSha256: sha("OTHER") }));
      expect(await rebindThumbnails(dir, "001", ["001-thumbnail-1.png"])).toBe(false);
      expect(JSON.parse(await readFile(setFile, "utf8")).files["001-thumbnail-1.png"]).toBe("old");
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});

describe("الأغلفة الثلاثة: الرسم", () => {
  it("«سؤال»: السؤال وحده وعلامة الاستفهام، بلا العنوان", () => {
    const html = renderToStaticMarkup(<QuestionThumb style="horizon" themeId="warm" text="متى كانت البداية؟" />);
    expect(html).toContain("متى كانت");
    expect(html).toContain("البداية؟");
    expect(html).not.toContain(TITLE);
  });
  it("«مشهد»: اللقطة بملء الصورة وكلماته فوقها", () => {
    const html = renderToStaticMarkup(<SceneThumb style="circle" themeId="warm" text="أبو البشر" frame="data:image/jpeg;base64,AAAA" />);
    expect(html).toContain('src="data:image/jpeg;base64,AAAA"');
    expect(html).toContain("البشر");
  });
});
