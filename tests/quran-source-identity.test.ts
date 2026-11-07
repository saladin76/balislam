import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseAyahRef } from "../src/script/quranMeta";
import { composeVerses } from "../src/quran/sync";

describe("Single-owner Quran text source integrity",()=>{
  it("preserves the complete Arabic Unicode and tashkeel of one supplied verse",()=>{
    const text="إِنَّ ٱللَّهَ غَفُورٌ رَّحِيمٌ";
    expect(composeVerses([{key:"1:1",number:1,text}])).toBe(text);
  });
  it("retains source verse numbering and ordering in multi-ayah segments",()=>{
    const text=composeVerses([
      {key:"1:1",number:1,text:"نصٌّ تجريبيٌّ ١"},
      {key:"1:2",number:2,text:"نصٌّ تجريبيٌّ ٢"},
    ]);
    expect(text).toContain("۝١");
    expect(text).toContain("۝٢");
    expect(text.indexOf("۝١")).toBeLessThan(text.indexOf("۝٢"));
  });
  it("parses script ayah refs locally without opening Quran Foundation URLs",()=>{
    const ref=parseAyahRef("النجم 39");
    expect(ref.ok).toBe(true);
    if(ref.ok)expect(ref.ref.key).toBe("53:39");
    const legacy=readFileSync(path.join(import.meta.dirname,"..","src","quran","client.ts"),"utf8");
    expect(legacy).not.toContain("quran.foundation");
    expect(legacy).not.toContain("oauth2/token");
    expect(legacy).not.toContain("createQuranClient");
    expect(legacy).not.toContain("quranClientFromEnv");
  });
});
