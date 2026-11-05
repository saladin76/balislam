import { describe, expect, it } from "vitest";
import { createAlQuranClient, AlQuranError } from "../src/quran/alquranCloud";
import { filterRecitersByRights, validCommercialEvidence, verifiedCommercialEditions } from "../app/src/workspace/recitationRights";
import { filterAudioEditions, previewReciterKey, previewEditionFor } from "../app/src/workspace/AlQuranCloudBrowser";

const edition = { identifier: "ar.alafasy", name: "مشاري العفاسي" };
const text = { surah: { number: 1 }, numberInSurah: 1, number: 1, text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ" };
const audio = { surah: { number: 1 }, numberInSurah: 1, number: 1, edition: { identifier: "ar.alafasy" }, audio: "https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3" };
const mock = (override: Partial<typeof audio> = {}) => (async (url: string) => {
  const data = url.includes("/edition/") ? [edition, { identifier: "evil/path", name: "unsafe" }] :
    url.includes("/quran-uthmani") ? text : { ...audio, ...override };
  return new Response(JSON.stringify({ code: 200, status: "OK", data }));
}) as typeof fetch;

describe("AlQuran Cloud read-only ayah integration", () => {
  it("lists audio editions and returns matching Uthmani text and single-ayah sound", async () => {
    const c = createAlQuranClient(mock());
    expect(await c.editions()).toEqual([edition]);
    expect(await c.ayah(1, 1, "ar.alafasy")).toEqual({
      surah: 1, ayah: 1, text: text.text, audio: audio.audio, reciter: "ar.alafasy",
      rightsVerified: false, publicationAllowed: false,
    });
    expect(Object.keys(c).sort()).toEqual(["ayah", "editions"]);
  });
  it("rejects unsupported references and unsafe audio domains", async () => {
    const c = createAlQuranClient(mock());
    await expect(c.ayah(0, 1, "ar.alafasy")).rejects.toThrow(AlQuranError);
    await expect(c.ayah(1, 1, "../../evil")).rejects.toThrow(AlQuranError);
    for (const bad of ["http://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3",
      "https://localhost/quran/audio/128/ar.alafasy/1.mp3",
      "https://cdn.islamic.network.evil.com/quran/audio/128/ar.alafasy/1.mp3"]) {
      await expect(createAlQuranClient(mock({ audio: bad })).ayah(1, 1, "ar.alafasy")).rejects.toThrow(AlQuranError);
    }
  });
  it("rejects mismatched ayah responses before previewing", async () => {
    await expect(createAlQuranClient(mock({ numberInSurah: 2 })).ayah(1, 1, "ar.alafasy")).rejects.toThrow(/يطابق/);
  });
  it("rejects different reciter and global verse audio, even on trusted CDN", async () => {
    await expect(createAlQuranClient(mock({ audio: "https://cdn.islamic.network/quran/audio/128/ar.husary/1.mp3" }))
      .ayah(1, 1, "ar.alafasy")).rejects.toThrow(/يطابق/);
    await expect(createAlQuranClient(mock({ audio: "https://cdn.islamic.network/quran/audio/128/ar.alafasy/2.mp3" }))
      .ayah(1, 1, "ar.alafasy")).rejects.toThrow(/يطابق/);
    await expect(createAlQuranClient(mock({ edition: { identifier: "ar.husary" } }))
      .ayah(1, 1, "ar.alafasy")).rejects.toThrow(/لا تطابق القارئ أو الآية/);
  });

  it("uses the channel's AlQuran preview reciter unless the episode overrides it", () => {
    expect(previewEditionFor(null, "ar.husary")).toBe("ar.husary");
    expect(previewEditionFor("ar.minshawi", "ar.husary")).toBe("ar.minshawi");
    expect(previewEditionFor(null, "../../bad")).toBe("ar.alafasy");
    expect(previewEditionFor("wrong", "ar.husary")).toBe("ar.husary");
  });

  it("does not misrepresent all available audio editions as licensed for commercial reuse", () => {
    const voices = [edition, { identifier: "ar.husary", name: "محمود خليل الحصري" }];
    expect(verifiedCommercialEditions).toEqual([]);
    expect(filterRecitersByRights(voices, "all")).toEqual(voices);
    expect(filterRecitersByRights(voices, "verified")).toEqual([]);
    expect(filterRecitersByRights(voices, "review")).toEqual(voices);
  });

  it("recognizes only edition-specific evidence with commercial YouTube scope", () => {
    const voices = [edition, { identifier: "ar.husary", name: "محمود خليل الحصري" }];
    const proof = {
      edition: "ar.husary", holder: "Rights holder",
      evidenceUrl: "https://example.org/licence", scope: "Commercial YouTube publication",
      reviewedAt: "2026-11-05T14:00:00Z",
    };
    expect(validCommercialEvidence(proof)).toBe(true);
    expect(filterRecitersByRights(voices, "verified", [proof])).toEqual([voices[1]]);
    expect(filterRecitersByRights(voices, "review", [proof])).toEqual([voices[0]]);
    expect(filterRecitersByRights(voices, "verified", [{ ...proof, scope: "Personal listening only" }])).toEqual([]);
    expect(filterRecitersByRights(voices, "verified", [{ ...proof, evidenceUrl: "http://example.org/licence" }])).toEqual([]);
  });

  it("filters multiple reciters and keeps preview selection scoped to channel and episode", () => {
    const voices = [edition, { identifier: "ar.husary", name: "محمود خليل الحصري" },
      { identifier: "ar.minshawi", name: "محمد صديق المنشاوي" }];
    expect(filterAudioEditions(voices, "الحصري")).toEqual([voices[1]]);
    expect(filterAudioEditions(voices, "MIN")).toEqual([voices[2]]);
    expect(filterAudioEditions(voices, "")).toEqual(voices);
    expect(previewReciterKey("balislam", "001")).not.toBe(previewReciterKey("dafatir-alzaman", "001"));
    expect(previewReciterKey("balislam", "001")).not.toBe(previewReciterKey("balislam", "002"));
  });
});
