/** القاعدة الأولى في publish.json (٢٣ نوفمبر): بوابة المحتوى رفضت حفظ الاستوديو لأن مصدر الحزمة كان «claude». */
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { kitTraceHits, savedKitSource } from "../src/package/social";

describe("مصدر حزمة النشر بلا اسم أداة", () => {
  it("الحفظ يحوّل الآلية إلى «معدّلة»، والقيم القديمة أو المجهولة إلى «مكتوبة»", () => {
    expect(savedKitSource("auto")).toBe("edited");
    expect(savedKitSource("edited")).toBe("edited");
    expect(savedKitSource("written")).toBe("written");
    expect(savedKitSource("claude")).toBe("written");
    expect(savedKitSource(undefined)).toBe("written");
  });
  it("أي أثر في أي حقل يُذكر بمساره، والحزمة النظيفة بلا شيء", () => {
    const kit = { version: 1, generatedBy: "claude", long: { titles: [{ text: "بداية الإنسان" }], description: "كتبه ChatGPT" }, shorts: [] };
    const hits = kitTraceHits(kit);
    expect(hits.some((h) => h.startsWith("generatedBy"))).toBe(true);
    expect(hits.some((h) => h.startsWith("long.description"))).toBe(true);
    expect(kitTraceHits({ ...kit, generatedBy: savedKitSource(kit.generatedBy), long: { titles: [{ text: "بداية الإنسان" }], description: "" } })).toEqual([]);
  });
  it("الاستوديو لا يكتب اسم الأداة في شارة المصدر ولا في نوع الحزمة", async () => {
    const root = path.join(import.meta.dirname, "..");
    for (const f of ["app/src/tabs/SocialKit.tsx", "src/package/social.ts"]) {
      const code = await readFile(path.join(root, f), "utf8");
      expect(code).not.toMatch(/generatedBy === "claude"|"claude" \|/);
    }
    expect(await readFile(path.join(root, "app/server/routes/publish.ts"), "utf8")).toContain("kitTraceHits(saved)");
  });
});
