import { describe, expect, it, vi } from "vitest";

/**
 * الحلقة 001 كلها: في كل إطار (كل 3 إطارات) من كل مشهد «حكايات الحارة» بالكاميرا التلقائية، بالاتجاهين،
 * التأطير الفعلي لا يقص شخصًا عند حافة الإطار ولا يُظهر ما وراء طرف المكان (قرار صاحب المشروع، ٩ نوفمبر).
 * الاتجاهان في ملفين يعملان بالتوازي (tests/helpers/edgeEpisode.ts): هذا الملف للاتجاه portrait.
 */
vi.mock("remotion", async (orig) => {
  const m = (await orig()) as Record<string, unknown>;
  const h = await import("./helpers/edgeEpisode");
  return { ...m, useCurrentFrame: () => h.edgeState.F, useVideoConfig: h.mockedVideoConfig };
});
const { badFrames } = await import("./helpers/edgeEpisode");

describe("حافة الإطار في الحلقة 001", () => {
  it("كل مشاهد حكايات الحارة · portrait", async () => {
    expect(await badFrames("portrait")).toEqual([]);
  }, 240_000);
});
