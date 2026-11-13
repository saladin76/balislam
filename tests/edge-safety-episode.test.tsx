import { describe, expect, it, vi } from "vitest";

/**
 * الحلقة 001 كلها: في كل إطار (كل 3 إطارات) من كل مشهد «حكايات الحارة» بالكاميرا التلقائية، بالاتجاهين،
 * التأطير الفعلي لا يقص شخصًا عند حافة الإطار ولا يُظهر ما وراء طرف المكان (قرار صاحب المشروع، ٩ نوفمبر).
 * الاتجاهان في ملفين يعملان بالتوازي (tests/helpers/edgeEpisode.ts): هذا الملف للاتجاه landscape.
 */
vi.mock("remotion", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  const h = await import("./helpers/edgeEpisode");
  return { ...m, useCurrentFrame: () => h.edgeState.F, useVideoConfig: h.mockedVideoConfig };
});
const { badFrames, edgeChunks, episodeScenes } = await import("./helpers/edgeEpisode");
const { heavyTimeout } = await import("./helpers/heavyTimeout");

describe("حافة الإطار في الحلقة 001", () => {
  const chunks = edgeChunks();
  it("الأجزاء تغطي كل مشاهد حكايات الحارة مرة واحدة", () => {
    expect(chunks.flat().map((s) => s.id)).toEqual(episodeScenes().map((s) => s.id));
    expect(chunks.length).toBeGreaterThan(0);
  });
  chunks.forEach((part, i) => {
    it(`مشاهد حكايات الحارة · landscape · الجزء ${i + 1} من ${chunks.length} (${part[0]!.id} … ${part.at(-1)!.id})`, async () => {
      expect(await badFrames("landscape", part)).toEqual([]);
    }, heavyTimeout(120_000));
  });
});
