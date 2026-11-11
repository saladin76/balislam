import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { versesAreCitations } from "../src/quran/citation";
import { versesWithoutRecitation } from "../src/render/episode";

// D68 (صاحب القناة، ١١ نوفمبر): في زبدة الكتب الآية استشهاد مكتوب — «كما في سورة كذا» وبطاقة الآية صامتة — بلا تلاوة.
const channel = (id: string) => JSON.parse(readFileSync(`channels/${id}/channel.json`, "utf8"));

describe("الآية استشهاد مكتوب بلا تلاوة (D68)", () => {
  it("زبدة الكتب وحدها اختارت ذلك؛ بالإسلام ودفاتر الزمن تبقى التلاوة فيهما مطلوبة", () => {
    expect(versesAreCitations(channel("zubdat-alkutub"))).toBe(true);
    expect(versesAreCitations(channel("balislam"))).toBe(false);
    expect(versesAreCitations(channel("dafatir-alzaman"))).toBe(false);
    expect(versesAreCitations(null)).toBe(false);
    expect(versesAreCitations({ verse: {} })).toBe(false);
  });
  it("بوابة Master لا تطلب تلاوة لبطاقة الآية في قناة الاستشهاد، وتطلبها في غيرها", () => {
    const plan = { chapters: [{ scenes: [{ id: "v", template: "verse-card", ayahKey: "20:14" }, { id: "n", template: "ink-shot" }] }] };
    const ids = new Set(["v", "n"]);
    expect(versesWithoutRecitation(plan, { recitations: {} }, ids, !versesAreCitations(channel("zubdat-alkutub")))).toEqual([]);
    expect(versesWithoutRecitation(plan, { recitations: {} }, ids, !versesAreCitations(channel("balislam")))).toEqual(["v"]);
  });
  it("الحارس لا يتغير: الصوت المستنسخ لا يتلو الآية في قناة الاستشهاد أيضًا", () => {
    const guard = readFileSync("src/voice/quranGuard.ts", "utf8");
    expect(guard).not.toMatch(/versesAreCitations|recitation === "none"/);
  });
});
