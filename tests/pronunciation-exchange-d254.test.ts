import { describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { buildRequest, checkReply, exchangeRows, importReply, parseReply, parseSharedLexicon, serializeSharedLexicon } from "../src/voice/pronunciationExchange";
import type { Plan } from "../src/plan/types";

/** D254: طلب النطق ورده: بلا آيات، والمعرّفات ثابتة، والفحوص قبل القبول، والقاموس الثابت */
const plan = {
  version: 1, episode: "006", title: "", domain: "", themeId: "", channel: "dafatir-alzaman", lang: "ar", overlays: {}, updatedAt: "",
  chapters: [{ number: 1, title: "", scenes: [
    { id: "c1-s1", template: "horizon-shot", narration: "حين مرّ كبار قومه سخروا منه. فكيف ردّ عليهم؟", props: {}, sfx: [] },
    { id: "c1-s2", template: "verse-card", narration: "", props: {}, sfx: [] },
    { id: "c1-s3", template: "horizon-shot", narration: "قال تعالى: ﴿وَٱصْنَعِ ٱلْفُلْكَ﴾ وبنى السفينة.", props: {}, sfx: [] },
  ] }],
} as unknown as Plan;

describe("D254 الطلب", () => {
  const rows = exchangeRows(plan, null, []).filter((r) => r.id.startsWith("c1-s1."));
  const allRows = exchangeRows(plan, null, []);
  it("جملة في كل سطر بمعرّف المشهد وترتيبها، ولا آية ولا جملة فيها ﴿ ﴾", () => {
    expect(allRows.map((r) => r.id).slice(0, 2)).toEqual(["c1-s1.1", "c1-s1.2"]);
    expect(allRows.every((r) => !/[﴿﴾]/.test(r.text))).toBe(true);
    const md = buildRequest("dafatir-alzaman", "006", allRows, [{ word: "قومه", say: "قَوْمِهِ", at: "" }]);
    expect(md).toContain("## تعليمات الرد");
    expect(md).toContain("c1-s1.1 | حين مرّ كبار قومه سخروا منه. |");
    expect(md).not.toMatch(/﴿|ٱلْفُلْكَ/);
    expect(md).toContain("| قومه | قَوْمِهِ |");
  });

  it("الرد السليم يُقبل، والحروف المتغيرة أو العدد أو المعرّف تُرفض برسالة السطور الخطأ وحدها", () => {
    const good = parseReply(`## السطور\nc1-s1.1 | حين مرّ كبار قومه سخروا منه. | حِينَ مَرَّ كِبَارُ قَوْمِهِ سَخِرُوا مِنْهُ.\nc1-s1.2 | فكيف ردّ عليهم؟ | فَكَيْفَ رَدَّ عَلَيْهِمْ؟\n`);
    expect(checkReply(rows, good)).toEqual({ lineErrors: [], global: [] });
    const bad = parseReply(`c1-s1.1 | حين مرّ كبار قومه سخروا منه. | حِينَ مَرَّ كُبَرَاءُ قَوْمِهِ سَخِرُوا مِنْهُ.\nc1-s1.2 | فكيف ردّ عليهم؟ | فَكَيْفَ رَدَّ عَلَيْهِمْ؟\n`);
    const r = checkReply(rows, bad);
    expect(r.lineErrors.map((e) => e.id)).toEqual(["c1-s1.1"]);
    expect(checkReply(rows, parseReply("c1-s1.1 | حين مرّ كبار قومه سخروا منه. | حِينَ\n")).global[0]).toMatch(/عدد السطور/);
  });

  it("الكتابة البديلة المسجلة في الجدول تُقبل وتذهب للقاموس الثابت، وtashkeel.md يبقى بكلمة السكريبت", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "pron-"));
    const ep = path.join(root, "ep"); await mkdir(ep); const scriptPath = path.join(ep, "script.md"); await writeFile(scriptPath, "x");
    const md = `c1-s1.1 | حين مرّ كبار قومه سخروا منه. | حِينَ مَرَّ كِبَارُ قَوْمِهِ سَخِرُو مِنْهُ.\nc1-s1.2 | فكيف ردّ عليهم؟ | فَكَيْفَ رَدَّ عَلَيْهِمْ؟\n\n## كتابات بديلة\n| الكلمة في السكريبت | الكتابة البديلة |\n|---|---|\n| سخروا | سخرو |\n\n## إضافات القاموس\n| الكلمة | النطق | ملاحظة |\n|---|---|---|\n| السفينة | السَّفِينَة | عامة |\n`;
    const res = await importReply({ root, channel: "dafatir-alzaman", episode: "006", scriptPath, req: rows, replyMd: md });
    expect(res.ok).toBe(true);
    const tk = await readFile(path.join(ep, "tashkeel.md"), "utf8");
    expect(tk.split("\n")[0]).toBe("حِينَ مَرَّ كِبَارُ قَوْمِهِ سخروا مِنْهُ.");
    const lex = parseSharedLexicon(await readFile(path.join(root, "pronunciation", "قاموس-النطق.md"), "utf8"));
    expect(lex.map((e) => e.word).sort()).toEqual(["السفينة", "سخروا"]);
  });

  it("القاموس الثابت يُقرأ ويُكتب بلا كلمة من آية", () => {
    const md = serializeSharedLexicon([{ word: "نوح", say: "نُوح", at: "" }]) + "| ﴿الفلك﴾ | x | |\n";
    expect(parseSharedLexicon(md).map((e) => e.word)).toEqual(["نوح"]);
  });
});
