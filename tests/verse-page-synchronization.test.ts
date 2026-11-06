import { describe, expect, it } from "vitest";
import { verseChunks, verseTextOpacity } from "../src/remotion/scenes/VerseCard";

describe("Quran page remains fully readable throughout real recitation", () => {
  const longVerse = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ إِنَّ الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ وَأَقَامُوا الصَّلَاةَ وَآتَوُا الزَّكَاةَ وَهُمْ بِالْآخِرَةِ هُمْ يُوقِنُونَ";
  it("renders all chunks, opening and closing Quran brackets at full opacity on frame zero", () => {
    const chunks = verseChunks(longVerse, 5);
    expect(chunks.length).toBeGreaterThan(1);
    const start = 0, end = 150, step = (end - start) / chunks.length;
    for (const frame of [0, 1, 42, 149, 150]) {
      for (const [i] of chunks.entries())
        expect(verseTextOpacity(frame, start + i * step, 20, true)).toBe(1);
      expect(verseTextOpacity(frame, 10, 14, true)).toBe(1); // ﴿
      expect(verseTextOpacity(frame, start + (chunks.length - 1) * step, 20, true)).toBe(1); // ﴾
    }
  });
  it("retains gradual line reveal only for technical scenes without recitation audio", () => {
    expect(verseTextOpacity(0, 42, 20, false)).toBe(0);
    expect(verseTextOpacity(42, 42, 20, false)).toBe(0);
    expect(verseTextOpacity(62, 42, 20, false)).toBe(1);
  });
  it("does not change Quran characters while dividing readable text", () => {
    const chunks = verseChunks(longVerse, 5);
    expect(chunks.join(" ")).toBe(longVerse);
  });
});
