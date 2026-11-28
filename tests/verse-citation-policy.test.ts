import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { versesAreCitations } from "../src/quran/citation";
import { versesWithoutRecitation } from "../src/render/episode";

// D68 (صاحب القناة، ١١ نوفمبر): في زبدة الكتب الآية استشهاد مكتوب — «كما في سورة كذا» وبطاقة الآية صامتة — بلا تلاوة.
// D237 (٢٧ نوفمبر، يُلغي بوابة التلاوة D35): القنوات الثلاث كلها كذلك؛ الآية تظهر مكتوبة ومشهدها يُعتمد عادي.
const channel = (id: string) => JSON.parse(readFileSync(`channels/${id}/channel.json`, "utf8"));

describe("الآية استشهاد مكتوب بلا تلاوة (D68)", () => {
  it("D237: القنوات الثلاث بلا تلاوة — الآية مكتوبة في زبدة الكتب وبالإسلام ودفاتر الزمن", () => {
    for (const id of ["zubdat-alkutub", "balislam", "dafatir-alzaman"]) expect(versesAreCitations(channel(id))).toBe(true);
    // الآلية بالحقل لا بالمعرّف: قناة بلا الحقل أو تطلب التلاوة صراحةً تبقى على البوابة القديمة (كامنة، لا قناة عليها اليوم)
    expect(versesAreCitations(null)).toBe(false);
    expect(versesAreCitations({ verse: {} })).toBe(false);
  });
  it("بوابة Master لا تطلب تلاوة لبطاقة الآية في أي قناة (D237)، والآلية الكامنة تطلبها لقناة تختار «required»", () => {
    const plan = { chapters: [{ scenes: [{ id: "v", template: "verse-card", ayahKey: "20:14" }, { id: "n", template: "ink-shot" }] }] };
    const ids = new Set(["v", "n"]);
    expect(versesWithoutRecitation(plan, { recitations: {} }, ids, !versesAreCitations(channel("zubdat-alkutub")))).toEqual([]);
    for (const id of ["balislam", "dafatir-alzaman"])
      expect(versesWithoutRecitation(plan, { recitations: {} }, ids, !versesAreCitations(channel(id)))).toEqual([]);
    expect(versesWithoutRecitation(plan, { recitations: {} }, ids, !versesAreCitations({ verse: { recitation: "required" } }))).toEqual(["v"]);
  });
  it("الحارس لا يتغير: الصوت المستنسخ لا يتلو الآية في قناة الاستشهاد أيضًا", () => {
    const guard = readFileSync("src/voice/quranGuard.ts", "utf8");
    expect(guard).not.toMatch(/versesAreCitations|recitation === "none"/);
  });
});
