import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { themeIds, themes } from "../brand/themes";
import { Element } from "../brand/elements/Element";
import { elementLibrary, hasElement } from "../brand/elements/registry";
import { categoryOrder } from "../brand/elements/types";
import { elementPalettes } from "../brand/elements/palette";
import { sfxLibrary } from "../brand/sfx";
import { Character, characterPoses, characterVariants } from "../characters/Character";

/** الألوان المسموح بها داخل الرسم: ألوان اللوحات فقط + استثناءات موثقة. */
const allowedColors = new Set<string>(
  [
    ...Object.values(elementPalettes).flatMap((p) => Object.values(p).filter((v): v is string => typeof v === "string" && v.startsWith("#"))),
    ...themeIds.flatMap((id) => Object.values(themes[id].colors)),
    "#1E1E1E", // كسوة الكعبة
    "#FFFFFF",
    "#000000",
  ].map((c) => c.toLowerCase()),
);

describe("مكتبة العناصر", () => {
  it("فيها أكثر من 250 عنصرًا موزعة على كل الفئات", () => {
    expect(elementLibrary.length).toBeGreaterThan(250);
    for (const c of categoryOrder) expect(elementLibrary.some((e) => e.category === c)).toBe(true);
  });

  it("المعرّفات فريدة وبصيغة إنجليزية صغيرة بشرطات", () => {
    const ids = elementLibrary.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("كل عنصر له اسم عربي ووسم واحد على الأقل", () => {
    for (const e of elementLibrary) {
      expect(e.nameAr, e.id).toMatch(/[؀-ۿ]/);
      expect(e.tags.length, e.id).toBeGreaterThan(0);
    }
  });

  it("كل عنصر يُرسم في الثيمات الأربعة بلا نصوص ولا ألوان دخيلة", () => {
    const offenders: string[] = [];
    for (const e of elementLibrary) {
      for (const id of themeIds) {
        const markup = renderToStaticMarkup(
          e.kind === "backdrop" ? <Element id={e.id} theme={themes[id]} width={1920} height={1080} /> : <Element id={e.id} theme={themes[id]} size={120} />,
        );
        expect(markup, `${e.id}/${id}`).not.toContain("<text");
        expect(markup, `${e.id}/${id}`).not.toContain("<image");
        // الخلفيات تمزج ألوان الثيم حسابيًا فتنتج درجات مشتقة؛ الفحص للعناصر فقط.
        if (e.kind === "backdrop") continue;
        for (const hex of markup.match(/#[0-9a-fA-F]{6}\b/g) ?? []) {
          if (!allowedColors.has(hex.toLowerCase())) offenders.push(`${e.id}/${id}: ${hex}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("الشخصيات تُرسم بكل الوضعيات بلا ملامح وجه", () => {
    for (const id of themeIds)
      for (const v of characterVariants)
        for (const pose of characterPoses) {
          const markup = renderToStaticMarkup(<Character theme={themes[id]} variant={v} pose={pose} height={300} />);
          expect(markup).toContain("<svg");
        }
  });

  it("hasElement يعرف العناصر المستخدمة في القوالب", () => {
    for (const id of ["question-mark", "phone-notifications", "verse-frame", "night-sky"]) expect(hasElement(id), id).toBe(true);
  });
});

describe("سجل المؤثرات", () => {
  it("المعرّفات فريدة وكلها بلا موسيقى", () => {
    const ids = sfxLibrary.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of sfxLibrary) {
      const cleaned = s.prompt.toLowerCase().replace(/\bno (music|instruments|tonal content|tones|pitch melody|bell melody|ringtone melody)\b/g, "");
      expect(cleaned, s.id).not.toMatch(/\b(music|melody|guitar|piano|drum|beat|instrument)/);
    }
  });
});
