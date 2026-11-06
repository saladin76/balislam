import { describe, expect, it } from "vitest";
import { boardHtml } from "../src/render/storyboardBoard";
import { captionGradient } from "../src/remotion/scenes/AlleyTale";

/** أدوات المطوّر في التوجيه 019: تخطيط v3 للوحة، وخلفية الكابشن الاختيارية (بلاها لا يتغير شيء) */
const scene = (change?: { status: "changed" | "same" | "new"; against?: string; reasons: string[] }) => ({
  id: "c1-s7", chapter: 1, chapterTitle: "ف", order: 7, template: "alley-tale", kind: "حكايات الحارة", narration: "جملة.", start: 0, frames: 90, seconds: 3,
  shots: [30, 72], composition: [], camera: "", transition: "", onScreen: "", captions: "", feeling: "", constraints: [], issues: [], notes: [],
  hash: "abc", images: { landscape: ["l1.jpg", "l2.jpg"], portrait: ["p1.jpg", "p2.jpg"] }, ...(change ? { change } : {}),
});
const meta = { episode: "001", title: "ع", version: "v3", createdAt: "", note: "" };

describe("لوحة v3", () => {
  it("صفحة عريضة لكل مشهد، وكل لحظة زوج أفقي وعمودي متجاوران", () => {
    const html = boardHtml({ ...meta, scenes: [scene() as never] }, ".", []);
    expect(html).toMatch(/@page\{size:2400px 1500px/);
    expect(html.match(/class="pair"/g)!.length).toBe(2);
    expect(html).toMatch(/<img class="l"[^>]*src="\.\/l1\.jpg"><img class="p"[^>]*src="\.\/p1\.jpg">/);
  });
  it("شارة التغيير وأسبابه من بيانات المقارنة، لا افتراضًا", () => {
    const changed = boardHtml({ ...meta, scenes: [scene({ status: "changed", against: "v2", reasons: ["الأفقي: الصورة مختلفة في الإطار 72"] }) as never] }, ".", []);
    expect(changed).toContain("معدّل عن v2");
    expect(changed).toContain('<h4 class="hot">ما تغيّر</h4>');
    expect(changed).toContain("الإطار 72");
    const same = boardHtml({ ...meta, scenes: [scene({ status: "same", against: "v2", reasons: [] }) as never] }, ".", []);
    expect(same).toContain("دون تغيير عن v2");
    expect(same).not.toContain('<h4 class="hot">');
  });
  it("الخطوط: Tajawal بمجموعتيه العربية واللاتينية فلا يسقط رقم أو علامة إلى خط بديل", () => {
    const html = boardHtml({ ...meta, scenes: [] }, ".", []);
    expect(html).toContain("Tajawal-latin-400.woff2");
    expect(html.match(/unicode-range/g)!.length).toBe(4);
  });
  it("خلفية الكابشن: بلا captionBackdrop التدرّج القائم حرفيًا، ومعها أعمق وأطول", () => {
    expect(captionGradient(false, 0)).toBe("linear-gradient(180deg, rgba(0,0,0,.5) 0%, rgba(0,0,0,0) 20%)");
    expect(captionGradient(true, 0)).toBe("linear-gradient(180deg, rgba(0,0,0,.5) 0%, rgba(0,0,0,0) 20%)");
    expect(captionGradient(true, 1)).toBe("linear-gradient(180deg, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.80) 20.0%, rgba(0,0,0,0) 32.0%)");
  });
});
