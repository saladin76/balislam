import { describe, expect, it } from "vitest";
import { createQuranClient } from "../src/quran/client";

const source = (verse: { verse_key?: string; verse_number?: number; text_uthmani?: string }) => {
  const requests: string[] = [];
  const fetchImpl = async (input: RequestInfo | URL) => {
    const url = String(input);
    requests.push(url);
    if (url.includes("/oauth2/token")) return new Response(JSON.stringify({ access_token: "safe-test-token", expires_in: 3600 }), { status: 200 });
    return new Response(JSON.stringify({ verse }), { status: 200 });
  };
  return { client: createQuranClient({ clientId: "test-client", clientSecret: "test-secret", fetchImpl: fetchImpl as typeof fetch }), requests };
};
describe("Quran text-only API source identity", () => {
  it("never caches a different verse returned for the requested Quran key", async () => {
    const { client } = source({ verse_key: "20:15", verse_number: 15, text_uthmani: "نص ليس للمرجع المطلوب" });
    await expect(client.verse("20:14")).rejects.toThrow(/لا يطابق/);
  });
  it("rejects a wrong verse number even if the verse key is correct", async () => {
    const { client } = source({ verse_key: "20:14", verse_number: 15, text_uthmani: "نص خاطئ" });
    await expect(client.verse("20:14")).rejects.toThrow(/لا يطابق/);
  });
  it("accepts source text as-is only with matching ayah key and number", async () => {
    const { client, requests } = source({ verse_key: "20:14", verse_number: 14, text_uthmani: "نص اختباري غير قرآني" });
    expect(await client.verse("20:14")).toMatchObject({ key: "20:14", number: 14, text: "نص اختباري غير قرآني" });
    expect(requests.some((url) => url.includes("/verses/by_key/20:14"))).toBe(true);
  });
});
