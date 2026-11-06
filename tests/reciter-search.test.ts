import { describe, expect, it } from "vitest";
import { searchFoundationReciters } from "../app/src/workspace/reciterSearch";

const voices = [
  { id: 5, name: "محمود خليل الحصري", style: "Murattal" },
  { id: 6, name: "مشاري العفاسي", style: "Murattal" },
  { id: 7, name: "محمد صديق المنشاوي", style: "Mujawwad" },
];
describe("Full Quran Foundation reciter discovery", () => {
  it("shows every provider voice rather than a short hardcoded list", () => {
    expect(searchFoundationReciters(voices, "")).toHaveLength(3);
  });
  it("searches Arabic names with or without hamzas and Latin recitation styles", () => {
    expect(searchFoundationReciters(voices, "المنشاوي").map((v) => v.id)).toEqual([7]);
    expect(searchFoundationReciters(voices, "مجود").map((v) => v.id)).toEqual([7]);
    expect(searchFoundationReciters(voices, "mujawwad").map((v) => v.id)).toEqual([7]);
    expect(searchFoundationReciters(voices, "6").map((v) => v.id)).toEqual([6]);
  });
  it("keeps duplicate reciter names when their styles and recording IDs differ", () => {
    expect(searchFoundationReciters([...voices, { id: 17, name: voices[0]!.name, style: "Mujawwad" }], "الحصري")).toHaveLength(2);
  });
});
