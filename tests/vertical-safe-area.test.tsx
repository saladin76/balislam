import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * D242: كل نص عمودي داخل المنطقة الآمنة للشورتس (يوتيوب شورتس وتيك توك وريلز): الترجمة، وسطر الكلام العلوي، وعنوان
 * الشورت، وعنوان الفصل والشعار. الثوابت ومصادرها في src/remotion/safeArea.ts.
 */
vi.mock("remotion", async (orig) => ({ ...((await orig()) as Record<string, unknown>), useCurrentFrame: () => 40, useVideoConfig: () => ({ fps: 30, width: 1080, height: 1920, durationInFrames: 300 }) }));

const { SHORTS_SAFE_AREA, PORTRAIT_FRAME, PORTRAIT_TEXT, SAFE_INLINE, captionBox, insideSafe, safeRect, topLineBox } = await import("../src/remotion/safeArea");
const { CaptionBar, CAPTION_MAX_WORDS } = await import("../src/remotion/scenes/CaptionBar");
const { TopCaption } = await import("../src/remotion/illus/TopCaption");
const { ShortTitle } = await import("../src/remotion/scenes/ShortTitle");
const { estimateTimings } = await import("../src/remotion/scenes/timing");

const root = path.resolve(import.meta.dirname, "..");
const src = (f: string) => readFileSync(path.join(root, f), "utf8");
/** أحجام الترجمة العمودية في هويات القنوات الثلاث (الأكبر هو الأسوأ) */
const captionSizes = ["balislam", "dafatir-alzaman", "zubdat-alkutub"].map((c) => (JSON.parse(src(`channels/${c}/identity.json`)) as { typography: { caption: { portrait: number } } }).typography.caption.portrait);
const px = (style: string, prop: string) => { const m = new RegExp(`(?:^|;)${prop}:(-?[0-9.]+)px`).exec(style); return m ? Number(m[1]) : null; };
const styleOf = (html: string, attr: string) => { const m = new RegExp(`${attr}[^>]*style="([^"]*)"|style="([^"]*)"[^>]*${attr}`).exec(html); return (m?.[1] ?? m?.[2] ?? "").replace(/\s/g, ""); };

describe("المنطقة الآمنة للشورتس (D242)", () => {
  it("الأرقام: الأشد من Meta (14%/35%/6%) وTikTok (240/660/120 وعمود الأزرار 180)، على 1080×1920", () => {
    expect(PORTRAIT_FRAME).toEqual({ width: 1080, height: 1920 });
    expect(SHORTS_SAFE_AREA).toEqual({ top: 270, bottom: 672, left: 120, right: 180 });
    expect(SHORTS_SAFE_AREA.top).toBeGreaterThanOrEqual(Math.max(Math.ceil(0.14 * 1920), 240));
    expect(SHORTS_SAFE_AREA.bottom).toBeGreaterThanOrEqual(Math.max(Math.round(0.35 * 1920), 660));
    expect(SHORTS_SAFE_AREA.left).toBeGreaterThanOrEqual(Math.max(Math.round(0.06 * 1080), 120));
    expect(SHORTS_SAFE_AREA.right).toBeGreaterThanOrEqual(180);
    expect(safeRect()).toEqual({ left: 120, top: 270, right: 900, bottom: 1248 });
    expect(safeRect(2)).toEqual({ left: 240, top: 540, right: 1800, bottom: 2496 });
    expect(SAFE_INLINE).toBe(180);
  });

  it("الترجمة: أسوأ حالة (ثلاثة أسطر بأكبر خط قناة) داخل المنطقة، والسطر بعرض المنطقة وحدها", () => {
    for (const size of captionSizes) for (const lines of [1, 2, 3]) expect(insideSafe(captionBox(lines, size)), `size ${size} × ${lines}`).toBe(true);
    expect(PORTRAIT_TEXT.caption.maxWidth).toBe(1080 - 120 - 180);
    expect(CAPTION_MAX_WORDS.portrait).toBeLessThanOrEqual(6);
  });

  it("الترجمة كما تُرسم في العمودي: مثبتة عند حد الأسفل وبين الهامشين؛ والأفقي كما كان", () => {
    const timings = estimateTimings("ثم جاء الليل على القرية كلها فسكنت البيوت.", 6, 200);
    const portrait = renderToStaticMarkup(<CaptionBar theme={{} as never} timings={timings} portrait />);
    const box = styleOf(portrait, 'data-caption-box="portrait"');
    expect(px(box, "bottom")).toBe(SHORTS_SAFE_AREA.bottom);
    expect(px(box, "left")).toBe(SHORTS_SAFE_AREA.left);
    expect(px(box, "right")).toBe(SHORTS_SAFE_AREA.right);
    expect(portrait.replace(/\s/g, "")).toContain(`max-width:${PORTRAIT_TEXT.caption.maxWidth}px`);
    const landscape = styleOf(renderToStaticMarkup(<CaptionBar theme={{} as never} timings={timings} portrait={false} />), 'data-caption-box="landscape"');
    expect(px(landscape, "bottom")).toBe(64);
  });

  it("سطر الكلام العلوي (بالإسلام) وعنوان الشورت يبدآن عند حد الأعلى وبين الهامشين، وأسوأ ارتفاع لهما داخل المنطقة", () => {
    const timings = estimateTimings("ورآها تشد صفحة أخرى فتمزقها عند النافذة المضيئة.", 6, 160);
    const top = styleOf(renderToStaticMarkup(<TopCaption frame={120} fps={30} timings={timings} keys={[]} portrait />), 'data-top-line="portrait"');
    expect([px(top, "top"), px(top, "left"), px(top, "right")]).toEqual([270, 120, 180]);
    const title = styleOf(renderToStaticMarkup(<ShortTitle text="متى بدأت قصة الإنسان على الأرض؟" quiet={[]} />), "data-short-title");
    expect([px(title, "top"), px(title, "left"), px(title, "right")]).toEqual([270, 120, 180]);
    // سطران بخط 62 (سطر الكلام) وثلاثة أسطر بخط 60 (عنوان الشورت)
    expect(insideSafe(topLineBox(2, 62, 20))).toBe(true);
    expect(insideSafe(topLineBox(3, 60, 0))).toBe(true);
  });

  it("غلاف المشهد (عنوان الفصل وشريط التاريخ والشعار) والترجمة تقرأ مواضعها من المنطقة الآمنة لا أرقامًا ثابتة", () => {
    const shell = src("src/remotion/scenes/SceneShell.tsx");
    expect(shell.match(/PORTRAIT_TEXT\.inline\.top/g)?.length).toBe(3);
    expect(shell.match(/PORTRAIT_TEXT\.inline\.inset/g)?.length).toBe(3);
    expect(shell).not.toMatch(/portrait \? (220|244|250|72|64) :/);
    expect(src("src/remotion/scenes/CaptionBar.tsx")).not.toMatch(/bottom: portrait \? 470/);
    expect(src("src/remotion/scenes/ShortTitle.tsx")).not.toMatch(/top: 150 \* k/);
  });
});
