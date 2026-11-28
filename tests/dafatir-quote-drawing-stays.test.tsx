/**
 * تصحيح D246 «أ» (رندر «دفاتر الزمن» 002 على الويندوز، main 2cbee110): قرار المالك أن يرسم المشهد أول فكرة ثم تنزل البطاقة على
 * الصفحة المقابلة **والرسم باقٍ ساكنًا بجوارها** طوال ظهورها. في الرندر كان الرسم يخفت (أو تُقلب الصفحة) لحظة نزول البطاقة،
 * فتبقى البطاقة على دفتر فارغ (c1-s38 «يحفر في التراب»، وc1-s8 وc1-s51 وc2-s36)، والمشهد الذي تستمر إليه البطاقة (c1-s40،
 * c1-s10…) فارغًا من أوله.
 * السبب: نافذة البطاقة ساكنة (breathStill) فتنطبق في الزمن المرئي إلى نقطة؛ فإن امتدت إلى آخر المشهد صار dur المرئي عند
 * ظهورها، وخروج الدفتر (dur − 0.75 للخفوت، dur − 0.95 للقلب) قبلها، فيقف الحبر خافتًا طوال البطاقة؛ والمستمر إليه يقف على
 * أول إطار (لا شيء مرسوم بعد) وخروجه قبل الصفر.
 * هنا يُرسم HorizonShot كاملًا (renderToStaticMarkup بإطار محدد، بلا رندر فيديو) بخصائص الخطة المتتبَّعة وتوقيتها التقديري.
 */
import { describe, expect, it, vi } from "vitest";
import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

const clock = vi.hoisted(() => ({ frame: 0, duration: 600 }));
vi.mock("remotion", async (orig) => ({
  ...(await orig<typeof import("remotion")>()),
  useCurrentFrame: () => clock.frame,
  useVideoConfig: () => ({ fps: 30, durationInFrames: clock.duration, width: 1920, height: 1080, id: "t", defaultProps: {}, props: {}, defaultCodec: null }),
}));

import { Providers } from "../src/remotion/Providers";
import { loadChannel, loadChannelIdentity } from "../src/channel";
import { channelInfo } from "../src/channel/types";
import { HorizonShot, type HorizonShotProps } from "../src/remotion/scenes/HorizonShot";
import { Book, EXIT_AFTER_CARD, NEUTRAL, exitSpan } from "../src/remotion/dafatir/horizon/book";
import { hzQuote, verseWindow } from "../src/remotion/dafatir/horizon/meta";
import { sceneSeconds } from "../src/plan/duration";
import { sceneTimeline } from "../src/plan/quoteCarry";
import { emptyMedia } from "../src/plan/media";
import { inkElements } from "../src/plan/quotePlacement";
import type { Plan, PlanScene } from "../src/plan/types";

const FPS = 30;
const CH = "dafatir-alzaman";
const plan = JSON.parse(readFileSync(`channels/${CH}/episodes/002-ibna-adam/plan.json`, "utf8")) as Plan;
const scenes = plan.chapters.flatMap((c) => c.scenes);
const byId = (id: string) => scenes.find((s) => s.id === id)!;
const within = (node: React.ReactNode) => renderToStaticMarkup(<Providers identity={loadChannelIdentity(CH)} channel={channelInfo(loadChannel(CH))}>{node}</Providers>);

/** رسم الدفتر (أول svg بعرض الإطار) من HTML المشهد: البطاقة HTML خارجه، والترجمة كذلك */
const bookSvg = (html: string) => {
  const a = html.indexOf('<svg width="1920"');
  return a < 0 ? "" : html.slice(a, html.indexOf("</svg>", a) + 6);
};
const BLANK = inkElements(bookSvg(within(<Book id="blank" t={0} dur={5} cam={NEUTRAL} />)));
const blankOn = (side: "l" | "r") => BLANK.filter((e) => (e.cx < 960) === (side === "l")).length;

const sceneAt = (s: PlanScene, t: number) => {
  const dur = sceneSeconds(s);
  clock.duration = Math.round(dur * FPS);
  clock.frame = Math.min(clock.duration - 1, Math.round(t * FPS));
  const props = { ...s.props, narration: s.narration, themeId: plan.themeId ?? "warm", orientation: "landscape" } as unknown as HorizonShotProps;
  return bookSvg(within(<HorizonShot {...props} />));
};
const cardSide = (s: PlanScene): "l" | "r" => {
  const p = s.props;
  const q = hzQuote(p)!;
  const v = q.carried ? p.carrySide : q.kind === "hadith" ? p.hadithSide ?? p.verseSide : p.verseSide;
  return v === "l" ? "l" : "r";
};
/** عناصر الحبر الظاهرة فوق الدفتر الفارغ: كلها، وعلى الصفحة المقابلة للبطاقة */
const drawn = (svg: string, side: "l" | "r") => {
  const els = inkElements(svg);
  const opp = side === "l" ? "r" : "l";
  return { all: els.length - BLANK.length, opposite: els.filter((e) => (e.cx < 960) === (opp === "l")).length - blankOn(opp) };
};
const windowOf = (s: PlanScene) => verseWindow(s.props, sceneTimeline(s, emptyMedia), sceneSeconds(s))!;

describe("exitSpan: الخروج لا يبدأ قبل نهاية نافذة البطاقة", () => {
  it("بلا بطاقة، أو بطاقة تنتهي قبل الخروج: كما كان", () => {
    expect(exitSpan("fade", 6, 4, null)).toEqual([4.3, 5.85]); // owner-pin-ok: بيانات مصطنعة
    expect(exitSpan("turn", 6, 4, null)).toEqual([4.3, 5.85]); // owner-pin-ok: بيانات مصطنعة
    expect(exitSpan("fade", 6, 4, [2, 3])).toEqual([4.3, 5.85]); // owner-pin-ok: بيانات مصطنعة
  });
  it("النافذة تمتد إلى آخر المشهد (المستمرة أو quoteHold): لا خروج، والرسم باقٍ إلى القطع", () => {
    // الزمن المرئي: النافذة منطبقة عند ١٫٨ والمشهد ينتهي عندها
    expect(exitSpan("fade", 1.8, 1.8, [1.8, 1.8])).toBeNull();
    expect(exitSpan("turn", 1.8, 1.8, [1.8, 1.8])).toBeNull();
  });
  it("باقٍ قصير بعد البطاقة: يُضغط الخروج فيه إن اتسع لأقصره، وإلا قطع", () => {
    expect(exitSpan("turn", 3, 2.2, [2.2, 2.2])).toEqual([2.2, 2.85]); // owner-pin-ok: بيانات مصطنعة
    expect(exitSpan("fade", 2.6, 2.2, [2.2, 2.2])).toBeNull();
    for (const kind of ["turn", "fade"] as const) for (let d = 2; d < 4; d += 0.05) {
      const x = exitSpan(kind, d, 2, [2, 2]);
      if (x) { expect(x[0]).toBeGreaterThanOrEqual(2); expect(x[1] - x[0]).toBeGreaterThanOrEqual(EXIT_AFTER_CARD[kind] - 1e-9); }
    }
  });
});

describe("002: الرسم باقٍ ساكنًا بجوار البطاقة طوال ظهورها (HorizonShot كاملًا)", () => {
  const HOSTS = ["c1-s38", "c1-s8", "c1-s51", "c2-s36"];

  it.each(HOSTS)("%s: قبل البطاقة رسم، وطوالها الرسم نفسه ساكنًا على الصفحة المقابلة، وبلا خروج قبل نهايتها", (id) => {
    const s = byId(id);
    const [a, b] = windowOf(s);
    const side = cardSide(s);
    const at = (t: number) => sceneAt(s, t);
    const first = at(a + 0.1);
    const d = drawn(first, side);
    // (c1-s51 المثبَّتة بقرار المالك: فكرتها الأولى نقطة «النفس» وحدها على اليمنى، والهالة على «عظيمة» بعد البطاقة)
    expect(d.all, `${id}: الدفتر ليس فارغًا عند نزول البطاقة`).toBeGreaterThanOrEqual(1);
    expect(d.opposite, `${id}: الصفحة المقابلة للبطاقة فيها الرسم`).toBeGreaterThanOrEqual(1);
    // ساكن: الدفتر نفسه حرفًا في كل لحظة من النافذة حتى آخر إطار فيها (لا خفوت ولا قلب ولا خيط خروج ولا حركة)
    for (let t = a + 0.1; t < b - 1 / FPS; t += 0.5) expect(at(t), `${id} @${t.toFixed(2)}`).toBe(first);
    expect(at(b - 1.5 / FPS)).toBe(first);
    // ولا شيء مما رُسم قبلها يختفي: كل عنصر قبل البطاقة بلحظة باقٍ عند نزولها
    const before = inkElements(at(Math.max(0, a - 0.05))).length;
    expect(inkElements(first).length, `${id}: لا يخفت الحبر لحظة نزول البطاقة`).toBeGreaterThanOrEqual(before);
  });

  it("c1-s38 (الغراب، المائدة ٣١ من «ليريه» مستمرة إلى c1-s40): الغراب وخطوط الحفر على الصفحة المقابلة عند ٢٫٥ ث، ولا خيط خروج أحمر", () => {
    const s = byId("c1-s38");
    const svg = sceneAt(s, 2.5);
    expect(drawn(svg, cardSide(s)).opposite).toBeGreaterThanOrEqual(5);
    expect(svg).not.toMatch(/stroke="#D7372B"[^>]*stroke-dashoffset/);
    expect(svg).not.toMatch(/<g opacity="0">/);
  });

  it.each(scenes.filter((s) => s.template === "horizon-shot" && s.props.carryText && s.props.carryRef).map((s) => [s.id, s] as const))(
    "%s (مستمرة إليه البطاقة): الرسم على حال فكرته الأولى من أول إطار، ساكنًا طوال البطاقة، والصفحة ليست فارغة", (id, s) => {
      const [a, b] = windowOf(s);
      expect(a).toBe(0);
      const first = sceneAt(s, 0);
      const d = drawn(first, cardSide(s));
      expect(d.all, `${id}: الدفتر ليس فارغًا خلف البطاقة`).toBeGreaterThanOrEqual(2);
      for (let t = 0.25; t < b - 1 / FPS; t += 0.5) expect(sceneAt(s, t), `${id} @${t.toFixed(2)}`).toBe(first);
    });

  it("c1-s40: حال الغراب بعد «فتساءل» (الأرض وخطوط الحفر) على الصفحة المقابلة للبطاقة", () => {
    const s = byId("c1-s40");
    expect(drawn(sceneAt(s, 1), cardSide(s)).opposite).toBeGreaterThanOrEqual(5);
  });
});
