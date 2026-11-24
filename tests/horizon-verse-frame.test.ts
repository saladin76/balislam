/**
 * D217 (ملاحظة المالك على «دفاتر الزمن 001» v15: بطاقة البقرة ٣٤ تخرج من الكادر فتظهر الآية مقطوعة):
 * لا تظهر آية ناقصة أبدًا — الدفتر يعود إلى الكادر العام قبل البطاقة ويثبت عليه طوال ظهورها، وكل بطاقة آية في خطة الحلقة
 * داخل الإطار كاملة تحت أي وضع للكاميرا الحية (إطارات إعادة التأطير والانجراف الدائم).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NEUTRAL, VERSE_SETTLE, verseSettle } from "../src/remotion/dafatir/horizon/book";
import { DRIFT, FRAMES } from "../src/remotion/dafatir/horizon/breath";
import { settlePose } from "../src/remotion/scenes/HorizonShot";
import { CAPTION_TOP, CONTENT_BOTTOM, SAFE_LIFT, captionSafeCy, verseCardHeight, verseCardY } from "../src/remotion/dafatir/horizon/kit";

type Scene = { id: string; template: string; props?: Record<string, string> };
const plan = JSON.parse(readFileSync("channels/dafatir-alzaman/episodes/001-adam-beginning/plan.json", "utf8")) as { chapters: { scenes: Scene[] }[] };
const verses = plan.chapters.flatMap((c) => c.scenes).filter((s) => s.template === "horizon-shot" && s.props?.verseKey && s.props?.verseText);

/** مستطيل البطاقة في عالم الدفتر كما يرسمها VerseCard (place="page") بعد قصّ موضعها الرأسي */
const cardRect = (p: Record<string, string>) => {
  const h = verseCardHeight(p.verseText!), cy = verseCardY(p.verseText!, p.verseY ? Number(p.verseY) : 510);
  const x = p.verseSide === "l" ? 165 : 975;
  return { x0: x, x1: x + 780, y0: cy - h / 2, y1: cy + h / 2 };
};
/** عالم الدفتر → الشاشة: كاميرا الدفتر (الكادر العام) ثم الكاميرا الحية حول وسط الإطار */
const toScreen = (x: number, y: number, pose: { s: number; x: number; y: number }) => {
  const sx = (x - NEUTRAL.cx) * NEUTRAL.s + 960, sy = (y - NEUTRAL.cy) * NEUTRAL.s + 540;
  return [(sx - 960) * pose.s + 960 + pose.x, (sy - 540) * pose.s + 540 + pose.y - SAFE_LIFT] as const;
};
/** كل أوضاع الكاميرا الحية الممكنة (إطارات إعادة التأطير مع أقصى انجراف)، بعد عودتها لحظة ظهور البطاقة */
const LIVE = [{ s: 1, x: 0, y: 0 }, ...FRAMES.flatMap((f) => [f, { s: f.s + DRIFT.s, x: f.x + DRIFT.x, y: f.y + DRIFT.y }])];
const POSES = LIVE.map((p) => settlePose({ ...p, bg: 0 }, 10, [10, 16]));

describe("بطاقة الآية كاملة في الإطار دائمًا (D217)", () => {
  it("في الخطة بطاقات آيات تُفحص", () => expect(verses.length).toBeGreaterThanOrEqual(5));
  it.each(verses.map((s) => [s.id, s] as const))("%s: البطاقة داخل الإطار طوال ظهورها مهما كان وضع الكاميرا الحية قبلها", (_id, s) => {
    const r = cardRect(s.props!);
    for (const pose of POSES)
      for (const [x, y] of [[r.x0, r.y0], [r.x1, r.y0], [r.x0, r.y1], [r.x1, r.y1]] as const) {
        const [X, Y] = toScreen(x, y, pose);
        expect(X).toBeGreaterThanOrEqual(0); expect(X).toBeLessThanOrEqual(1920);
        expect(Y).toBeGreaterThanOrEqual(0); expect(Y).toBeLessThanOrEqual(CAPTION_TOP + 1e-6); // لا تدخل شريط الترجمة
      }
  });
  it("كاميرا المشهد تعود إلى الكادر العام قبل ظهور البطاقة وتثبت عليه طوال ظهورها", () => {
    const zoomed = { cx: 1400, cy: 420, s: 1.26 };
    const vwin: [number, number] = [5, 11];
    for (const t of [5 - 0.05, 5, 7.5, 11]) expect(verseSettle(zoomed, t, vwin)).toEqual(NEUTRAL);
    // قبلها بأكثر من مدة العودة: كادر المشهد كما هو؛ وبعد اختفاء البطاقة يتحرر الكادر من جديد
    expect(verseSettle(zoomed, 5 - VERSE_SETTLE - 0.1, vwin)).toEqual(zoomed);
    expect(verseSettle(zoomed, 11 + VERSE_SETTLE + 0.05, vwin)).toEqual(zoomed);
  });
  it("منطقة الترجمة: أسفل نص الصفحة لا ينزل تحت أعلى الترجمة مهما كان تأطير المشهد والكاميرا الحية", () => {
    for (const s of [1, 1.1, 1.26, 1.4]) for (const cy0 of [380, 520, 640, 760]) for (const p of LIVE) {
      const live = { s: p.s, y: p.y - SAFE_LIFT };
      const cy = Math.max(cy0, captionSafeCy(s, live));
      const screen = ((CONTENT_BOTTOM - cy) * s) * live.s + 540 + live.y;
      expect(screen).toBeLessThanOrEqual(CAPTION_TOP + 1e-6);
    }
  });
});
