import { describe, expect, it } from "vitest";
import path from "node:path";
import { timelineFromWords } from "../src/remotion/dafatir/horizon/timeline";
import { SHOT_SPECS, buildShots, pickQuranWord, type HorizonAudio } from "../src/remotion/dafatir/horizon/shots";
import { horizonPreflight, renderHorizonAudio } from "../src/render/horizonAudio";

const EP = path.resolve("channels/dafatir-alzaman/episodes/001-adam-beginning/script.md");

const fakeAudio = (): HorizonAudio => {
  const voice: HorizonAudio["voice"] = {};
  for (const id of ["1", "2", "3", "4", "5", "6"]) {
    const sp = SHOT_SPECS[id]!;
    const words = sp.tl.words.map((w) => ({ word: w.w, start: w.s - sp.lead, end: w.e - sp.lead }));
    voice[id] = { file: `${id}.mp3`, duration: words[words.length - 1]!.end + 0.2, words };
  }
  return {
    base: "_render/test/",
    voice,
    verses: {
      "2:30": { text: "كلمة أولى خَلِيفَةً كلمة أخيرة", reciter: "الشيخ القارئ", parts: [{ file: "a.mp3", duration: 30 }] },
      "7:23": { text: "نص قصير", reciter: "الشيخ القارئ", parts: [{ file: "b.mp3", duration: 12 }] },
    },
  };
};

describe("دفاتر الزمن 001 — المعاينة المتكاملة", () => {
  it("يبني التوقيت من كلمات الصوت ويرفض عددًا لا يطابق النص", () => {
    const tl = timelineFromWords(["أهلا بكم.", "في | الدفتر."], [
      { word: "أهلا", start: 0, end: 0.4 },
      { word: "بكم", start: 0.45, end: 0.8 },
      { word: "في", start: 1.2, end: 1.3 },
      { word: "الدفتر", start: 1.35, end: 1.9 },
    ], 2);
    expect(tl.sentences.map((s) => [s.s, s.e])).toEqual([[2, 2.8], [3.2, 3.9]]);
    expect(tl.sentences[1]!.text).toBe("في الدفتر.");
    expect(() => timelineFromWords(["كلمة واحدة."], [{ word: "كلمة", start: 0, end: 1 }], 0)).toThrow(/لا يطابق/);
  });

  it("يأخذ لفظ «خليفة» من نص الآية نفسه بتشكيله", () => {
    expect(pickQuranWord("إِنِّى جَاعِلٌ فِى ٱلْأَرْضِ خَلِيفَةً ۖ قَالُوٓا۟", "خليف")).toBe("خَلِيفَةً");
    expect(pickQuranWord("نص بلا اللفظ", "خليف")).toBeUndefined();
  });

  it("المعاينة الصامتة بلا آيات: خمس لقطات كما هي", () => {
    const shots = buildShots();
    expect(shots.map((s) => s.id)).toEqual(["1", "2", "4", "5", "6"]);
    expect(shots.every((s) => !s.q && !s.voice && !s.recitation)).toBe(true);
  });

  it("المعاينة المتكاملة: ست لقطات، والتلاوة بعد التمهيد بوقفة، ولفظ الآية في اللقطة 4", () => {
    const shots = buildShots(fakeAudio());
    expect(shots.map((s) => s.id)).toEqual(["1", "2", "3", "4", "5", "6"]);
    const s3 = shots.find((s) => s.id === "3")!;
    expect(s3.q!.key).toBe("2:30");
    // التلاوة بعد انتهاء ملف صوت الراوي (لا آخر كلمة فقط) بثانية
    const a = fakeAudio();
    expect(s3.q!.start).toBeCloseTo(SHOT_SPECS["3"]!.lead + a.voice["3"]!.duration + 1.0, 5);
    expect(s3.dur).toBeCloseTo(s3.q!.start + 30 + 1.5, 5);
    const s5 = shots.find((s) => s.id === "5")!;
    expect(s5.q!.key).toBe("7:23");
    expect(s5.recitation!.at).toBe(s5.q!.start);
    expect(shots.find((s) => s.id === "4")!.q!.word).toBe("خَلِيفَةً");
    expect(shots.every((s) => s.voice)).toBe(true);
  });

  it("لا تُبنى لقطة آية بلا نصها أو تلاوتها", () => {
    const a = fakeAudio();
    delete a.verses["7:23"];
    expect(() => buildShots(a)).toThrow(/7:23/);
  });

  it("نص اللقطات الست يطابق السكريبت المعتمد حرفيًا، والنقص يُذكر بعينه", async () => {
    const problems = await horizonPreflight(EP, { voice: null });
    expect(problems.filter((p) => p.includes("لا يطابق"))).toEqual([]);
    expect(problems.some((p) => p.includes("ElevenLabs"))).toBe(true);
    expect(problems.some((p) => p.includes("تلاوة") || p.includes("نص الآية"))).toBe(true);
  });

  it("خانة المعاينة الصوتية يجب أن تنتهي بـ -audio", async () => {
    await expect(renderHorizonAudio(EP, { slot: "six-shots", voiceClient: null })).rejects.toThrow(/-audio/);
  });
});
