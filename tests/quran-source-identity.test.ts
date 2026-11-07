import { describe, expect, it } from "vitest";
import { parseAyahRef } from "../src/script/quranMeta";
import { composeVerses } from "../src/quran/sync";
import { cleanTranslation } from "../src/quran/client";

/** Verse text is authored in script.md; these tests never contact a provider. */
describe("Local Quran source and reference identity", () => {
  it("rejects invalid verse references and identifies exact requested ranges", () => {
    expect(parseAyahRef("غير موجود 100").ok).toBe(false);
    const one = parseAyahRef("طه 14");
    expect(one.ok && one.ref.key).toBe("20:14");
    const range = parseAyahRef("البقرة 255-256");
    expect(range.ok && range.ref.key).toBe("2:255-256");
  });

  it("never changes locally authored verse text while formatting single verses", () => {
    const text = "نَصٌّ تَجْرِيبِيٌّ";
    expect(composeVerses([{ key: "20:14", number: 14, text }])).toBe(text);
  });

  it("keeps per-verse order and local numbers when composing ranges", () => {
    expect(composeVerses([
      { key: "2:255", number: 255, text: "أ" },
      { key: "2:256", number: 256, text: "ب" },
    ])).toBe("أ ۝٢٥٥ ب ۝٢٥٦");
  });

  it("sanitizes locally supplied translation notes without a network client", () => {
    expect(cleanTranslation("A<sup foot_note=1>1</sup> B")).toBe("A B");
  });
});
