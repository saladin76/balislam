import { afterEach, describe, expect, it, vi } from "vitest";
import { previewKey, previewNotice, readPreview } from "../app/src/preview";

afterEach(() => vi.unstubAllGlobals());

describe("static studio preview", () => {
  it("isolates channels even when episode numbers are equal", () => {
    expect(previewKey("/api/episodes/001?channel=balislam", "zubdat-alkutub")).toBe("balislam:/api/episodes/001");
    expect(previewKey("/api/episodes/001?channel=dafatir-alzaman", "balislam")).toBe("dafatir-alzaman:/api/episodes/001");
    expect(previewKey("/api/identity", "zubdat-alkutub")).toBe("zubdat-alkutub:/api/identity");
  });
  it("rejects every mutation before fetching anything", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "post"]) {
      await expect(readPreview("/api/episodes/001/status?channel=balislam", method)).rejects.toThrow(previewNotice);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("retries a failed snapshot and does not silently serve absent endpoints", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValue({
      ok: true, json: async () => ({ defaultChannel: "balislam", records: {
        "balislam:/api/identity": { status: 200, data: { identity: { name: "بالإسلام" } } },
        "dafatir-alzaman:/api/identity": { status: 200, data: { identity: { name: "دفاتر الزمن" } } },
        "balislam:/api/episodes/999": { status: 404, data: { error: "غير موجودة" } },
      } }),
    });
    vi.stubGlobal("fetch", fetcher);
    await expect(readPreview("/api/identity")).rejects.toThrow("تعذّر تحميل بيانات المعاينة");
    const a = await readPreview<any>("/api/identity"); a.identity.name = "تعديل محلي";
    expect((await readPreview<any>("/api/identity")).identity.name).toBe("بالإسلام");
    expect((await readPreview<any>("/api/identity?channel=dafatir-alzaman")).identity.name).toBe("دفاتر الزمن");
    await expect(readPreview("/api/episodes/999")).rejects.toThrow("غير موجودة");
    await expect(readPreview("/api/alquran-cloud/editions")).rejects.toThrow("تحتاج الاستوديو المحلي");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
