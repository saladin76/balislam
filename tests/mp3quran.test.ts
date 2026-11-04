import { describe, expect, it } from "vitest";
import { createMp3QuranClient, Mp3QuranError } from "../src/quran/mp3quran";

const reciter = { id: 9, name: "قارئ تجريبي", moshaf: [{
  id: 17, name: "حفص", server: "https://server6.mp3quran.net/test/", surah_total: 2, surah_list: "1,18",
}] };
const mock = (reciters: unknown[] = [reciter]) => (async (url: string) => {
  if (url.includes("reciters")) return new Response(JSON.stringify({ reciters }));
  if (url.includes("suwar")) return new Response(JSON.stringify({ suwar: [
    { id: 1, name: "الفاتحة" }, { id: 18, name: "الكهف" }, { id: 115, name: "غير صالح" },
  ] }));
  return new Response("", { status: 404 });
}) as typeof fetch;

describe("MP3Quran optional catalogue", () => {
  it("reads the official v3 catalogue and exposes surah-level audio preview", async () => {
    const client = createMp3QuranClient(mock());
    const list = await client.reciters();
    const suwar = await client.suwar();
    expect(list).toHaveLength(1);
    expect(suwar.map((x) => x.id)).toEqual([1, 18]);
    expect(client.preview(list[0]!.moshaf[0]!, 18)).toBe("https://server6.mp3quran.net/test/018.mp3");
    expect(() => client.preview(list[0]!.moshaf[0]!, 2)).toThrow(Mp3QuranError);
  });

  it("rejects foreign and insecure server URLs instead of offering them to the audio player", async () => {
    const unsafe = ["http://server6.mp3quran.net/x/", "https://localhost/", "https://mp3quran.net.evil.com/",
      "https://server6.mp3quran.net.evil.com/", "https://server6.mp3quran.net:444/x/", "https://127.0.0.1/"];
    for (const server of unsafe) {
      const c = createMp3QuranClient(mock([{ ...reciter, moshaf: [{ ...reciter.moshaf[0], server }] }]));
      expect((await c.reciters())[0]?.moshaf).toEqual([]);
    }
  });
  it("does not expose downloading or publishing operations", () => {
    const c = createMp3QuranClient(mock());
    expect(Object.keys(c).sort()).toEqual(["preview", "reciters", "suwar"]);
  });
});
