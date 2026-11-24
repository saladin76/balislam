/**
 * تصحيح D217 (مراجعة «دفاتر الزمن 001» قبل النهائية v17، ٢٤ نوفمبر، إطار كل ثانيتين):
 * - الترجمة فوق ما يُرسم: c1-s9 (لقطة قديمة بكاميرتها، لم تكن تحت تقييد الترجمة) «جيلًا بعد جيل» فوق شريط الأرض والتهشير؛
 * - عناوين تخرج من أعلى الإطار: تقييد الترجمة كان يرفع الكادر وحده مهما كبر الرفع، فالمشهد المكبَّر على أعلى الصفحة يُدفع ما
 *   ينظر إليه خارج الإطار (عنوان الصفحة في c1-s19 وc1-s23 وc1-s24 وc1-s45، ورأس بطاقة الفهرسة c1-s29، وعنوان c1-s35 وc1-s36،
 *   وختم الأعراف c1-s38، وإطار السؤال c1-s45) فتبقى صفحة شبه فارغة والراوي يتكلم (c1-s19 3:08.8، c1-s38 6:53.2).
 * يُرسم كل مشهد «خط أفق» في الخطة بتوقيت صوته الحقيقي وبالكاميرا الحية نفسها التي يركّبها HorizonShot، كل عُشر ثانية، ويُقرأ
 * تحويل كاميرا الدفتر من الرسم نفسه، فيُتحقق على الشاشة من حدود ما يُحفظ.
 */
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HZ_SCENES } from "../src/remotion/dafatir/horizon/episode001";
import { HZ_META, hzSentences, verseWindow } from "../src/remotion/dafatir/horizon/meta";
import { timelineFromWords } from "../src/remotion/dafatir/horizon/timeline";
import { activeTime, breathAt, breathBeats, breathStill, DRIFT, FRAMES } from "../src/remotion/dafatir/horizon/breath";
import { SceneCloseContext } from "../src/remotion/dafatir/horizon/book";
import { CAPTION_TOP, CONTENT_BOTTOM, LiveFrameContext, PageHeadContext, SAFE_LIFT, SAFE_SHIFT, TOP_MARGIN, VerseWindowContext, frameSafeCam, pageHeadTop } from "../src/remotion/dafatir/horizon/kit";
import { SHOT4_KEEP } from "../src/remotion/dafatir/horizon/shots";
import { settlePose, visualClock } from "../src/remotion/scenes/HorizonShot";
import { sceneFrames } from "../src/plan/duration";
import { SACRED_WORD } from "../src/render/stillness";
import type { EpisodeMedia } from "../src/plan/media";
import type { Plan, PlanScene } from "../src/plan/types";

const EP = "channels/dafatir-alzaman/episodes/001-adam-beginning";
const plan = JSON.parse(readFileSync(`${EP}/plan.json`, "utf8")) as Plan;
const voice = (JSON.parse(readFileSync("tests/fixtures/dafatir-001-voice-timing.json", "utf8")) as { voice: EpisodeMedia["voice"] }).voice;
const media: EpisodeMedia = { mode: "url", base: "", voice, sfx: [], recitations: {} };
const scenes = plan.chapters.flatMap((c) => c.scenes).filter((s) => s.template === "horizon-shot" && voice[s.id]);
const EPS = 0.5;

/** المشهد كما يركّبه HorizonShot عند t: الكاميرا الحية بعد رفع المشهد، ورسم اللقطة في سياقاتها */
const rig = (s: PlanScene) => {
  const p = s.props as Record<string, string | undefined>;
  const shot = String(p.shot);
  const meta = HZ_META[shot]!;
  const tl = timelineFromWords(hzSentences(s.narration), voice[s.id]!.words, 0);
  const dur = sceneFrames(s, media, 30) / 30;
  const vw = verseWindow(p, tl);
  const last = tl.words.at(-1)!.e;
  const close = !meta.minEnd ? Math.max(last, vw ? vw[1] : 0) : undefined;
  const wins = breathStill(tl, dur, meta.still === "dhikr", vw);
  const beats = breathBeats(tl, dur, wins);
  const total = activeTime(dur, wins);
  const vis = visualClock(tl, dur, close, wins);
  const head = p.pageHead?.trim() && !/الله|لله/.test(p.pageHead) ? { text: p.pageHead.trim(), side: p.pageHeadSide === "r" ? "r" as const : "l" as const, y: Number(p.pageHeadY) || 190 } : null;
  const Comp = HZ_SCENES[shot]!;
  const at = (t: number) => {
    const live = breathAt(t, beats, total > 0.5 ? activeTime(t, wins) / total : undefined);
    const cam = vw ? settlePose(live, activeTime(t, wins), [activeTime(vw[0], wins), activeTime(vw[1], wins)]) : live;
    const html = renderToStaticMarkup(
      <SceneCloseContext.Provider value={vis.close}>
        <VerseWindowContext.Provider value={vw ? [activeTime(vw[0], wins), activeTime(vw[1], wins)] : null}>
          <LiveFrameContext.Provider value={{ s: cam.s, y: cam.y - SAFE_LIFT }}>
            <PageHeadContext.Provider value={head}>
              <Comp t={activeTime(t, wins)} tl={vis.tl} dur={vis.dur} exit={meta.exit} p={p} />
            </PageHeadContext.Provider>
          </LiveFrameContext.Provider>
        </VerseWindowContext.Provider>
      </SceneCloseContext.Provider>,
    );
    // كاميرا الدفتر (Camera: transform-origin 0 0) كما رُسمت؛ ثم الكاميرا الحية حول وسط الإطار
    const m = /transform-origin:0 0;transform:translate\((-?[\d.e-]+)px, (-?[\d.e-]+)px\) scale\((-?[\d.e-]+)\)/.exec(html);
    const S = m ? Number(m[3]) : 1, ty = m ? Number(m[2]) : 0, tx = m ? Number(m[1]) : 0;
    const screenY = (y: number) => (y * S + ty - 540) * cam.s + 540 + cam.y - SAFE_LIFT;
    const screenX = (x: number) => (x * S + tx - 960) * cam.s + 960 + cam.x;
    return { html, screenY, screenX, live: cam, found: Boolean(m) };
  };
  return { tl, dur, head, at, shot };
};

/** ما يُعلن حفظه أعلى الصفحة في لقطات بعينها (رأس البطاقة، العنوان المكتوب) */
const DECLARED_TOP: Record<string, number> = { species: 296, stances: 178 };

describe("الإطار الآمن لمشاهد «خط الأفق» (تصحيح D217، v17)", () => {
  it("frameSafeCam: أسفل ما يُرسم فوق الترجمة دائمًا، وما يُحفظ أعلاها داخل الإطار، والرفع وحده لا يتجاوز SAFE_SHIFT إلا بالدفتر كله", () => {
    const LIVE = [{ s: 1, x: 0, y: 0 }, ...FRAMES.flatMap((f) => [f, { s: f.s + DRIFT.s, x: f.x + DRIFT.x, y: f.y + DRIFT.y }])];
    for (const s of [0.9, 1, 1.1, 1.26, 1.45, 1.8]) for (const cy of [250, 300, 380, 520, 640, 760]) for (const p of LIVE) for (const top of [undefined, 128, 250, 296]) {
      const live = { s: p.s, y: p.y - SAFE_LIFT };
      const c = frameSafeCam({ cx: 960, cy, s }, live, { top });
      const k = c.s * live.s;
      const Y = (y: number) => (y - c.cy) * k + 540 + live.y;
      expect(Y(CONTENT_BOTTOM)).toBeLessThanOrEqual(CAPTION_TOP + 1e-6);
      if (top !== undefined) expect(Y(top)).toBeGreaterThanOrEqual(TOP_MARGIN - 1e-6);
      // لا تكبير فوق المطلوب، والتنازل لا ينزل تحت الدفتر كله إلا ليحفظ ما أُعلن
      expect(k).toBeLessThanOrEqual(s * live.s + 1e-9);
      if (top === undefined && c.cy - cy > SAFE_SHIFT + 1e-6) expect(k).toBeLessThanOrEqual(1 + 1e-9);
    }
  });

  it("frameSafeCam متصلة: تغيّر صغير في الكاميرا لا يقفز بالكادر", () => {
    const live = { s: 1.07, y: -54 };
    for (const top of [undefined, 128]) {
      let prev = frameSafeCam({ cx: 960, cy: 200, s: 1.5 }, live, { top });
      for (let cy = 200.5; cy < 800; cy += 0.5) {
        const c = frameSafeCam({ cx: 960, cy, s: 1.5 }, live, { top });
        expect(Math.abs(c.cy - prev.cy)).toBeLessThan(1);
        expect(Math.abs(c.s - prev.s)).toBeLessThan(0.01);
        prev = c;
      }
    }
  });

  it.each(scenes.map((s) => [s.id, s] as const))("%s: لا يدخل أسفل الصفحة شريط الترجمة، ولا يخرج عنوانها ولا ما أعلنته اللقطة من أعلى الإطار", (_id, s) => {
    const r = rig(s);
    const bottom = r.shot === "interpreters" ? SHOT4_KEEP.bottom : CONTENT_BOTTOM;
    const tops = [r.head ? pageHeadTop(r.head.y) : undefined, DECLARED_TOP[r.shot], r.shot === "interpreters" ? SHOT4_KEEP.top : undefined,
      r.shot === "lib-timeline" && s.props.title ? 250 : undefined].filter((x): x is number => x !== undefined);
    // اللقطات القديمة الأخرى (no-date، return-line) بكاميرتها كما كانت
    if (r.shot === "no-date" || r.shot === "return-line") return;
    const bad: string[] = [];
    for (let t = 0; t < r.dur; t += 0.1) {
      const f = r.at(t);
      expect(f.found).toBe(true);
      if (f.screenY(bottom) > CAPTION_TOP + EPS) bad.push(`@${t.toFixed(1)} أسفل ${bottom} على ${f.screenY(bottom).toFixed(0)}`);
      for (const top of tops) if (f.screenY(top) < TOP_MARGIN - EPS) bad.push(`@${t.toFixed(1)} أعلى ${top} على ${f.screenY(top).toFixed(0)}`);
    }
    expect(bad.slice(0, 6)).toEqual([]);
  }, 60_000);

  it("المواضع الفارغة في v17: «السجود» في c1-s19 (3:08.8–3:10.4) وختم الأعراف في c1-s38 (6:53.2) داخل مساحة المشهد المقيسة", () => {
    // مساحة المشهد في مقياس الإطار الفارغ: ١٢٪–٧٦٪ من الارتفاع (130–821)
    // عقد على المحتوى: المشهدان إن بقيا في الخطة بلقطتيهما (يحرّر المالك الخطة)
    const f19 = scenes.find((s) => s.id === "c1-s19" && s.props.shot === "honor");
    const f38 = scenes.find((s) => s.id === "c1-s38" && s.props.shot === "earth-words");
    if (!f19 || !f38) return;
    const s19 = rig(f19);
    for (let t = 7.6; t <= 9.2; t += 0.1) {
      const f = s19.at(t);
      expect(f.screenY(340 - 100), `c1-s19 @${t.toFixed(1)}`).toBeGreaterThanOrEqual(0); // أعلى «السجود» (حجم ١٠٠)
      expect(f.screenY(340), `c1-s19 @${t.toFixed(1)}`).toBeGreaterThanOrEqual(130);
    }
    const s38 = rig(f38);
    const first = s38.tl.words[0]!.s;
    for (let t = first + 0.45; t <= 2.9; t += 0.1) {
      const f = s38.at(t);
      expect(f.screenY(250 - 44), `c1-s38 @${t.toFixed(1)}`).toBeGreaterThanOrEqual(0);
      expect(f.screenY(250), `c1-s38 @${t.toFixed(1)}`).toBeGreaterThanOrEqual(130);
      expect(f.html.includes("الأعراف ٢٤–٢٥"), `c1-s38 @${t.toFixed(1)}`).toBe(true);
    }
  });

  it("c1-s38: الختم يبدأ مع أول كلمة لا مع «الأعراف»، وخارج نافذة لفظ الجلالة", () => {
    const f38 = scenes.find((s) => s.props.shot === "earth-words");
    if (!f38) return;
    const r = rig(f38);
    const first = r.tl.words[0]!.s;
    expect(r.at(first + 0.1).html.includes("الأعراف ٢٤–٢٥")).toBe(true);
  });

  it.each(scenes.map((s) => [s.id, s] as const))("%s: توقير — لا يتغير الكادر ولا الرسم حول لفظ الجلالة (±٠٫٢٥ ث) بالكاميرا الحية والإطار الآمن", (_id, s) => {
    const r = rig(s);
    const bad: string[] = [];
    for (const w of r.tl.words) {
      if (!SACRED_WORD.test(w.w)) continue;
      const a = Math.max(0, w.s - 0.25), b = Math.min(r.dur, w.e + 0.25);
      const ref = r.at(a);
      for (let t = a + 1 / 30; t <= b; t += 1 / 30) {
        const f = r.at(t);
        if (f.html !== ref.html || f.live.s !== ref.live.s || f.live.y !== ref.live.y || f.live.x !== ref.live.x) {
          bad.push(`«${w.w}» @${t.toFixed(2)}`);
          break;
        }
      }
    }
    expect(bad).toEqual([]);
  }, 120_000);

  // تفاعلية v18 (٩٤٫٣٪ بعد تنازل التكبير): مواضع كانت ساكنة صار فيها انتقال للكادر يتبع الجملة. عقد على المحتوى: يُفحص المشهد إن بقي
  // بلقطته وكلماته. الحد: ١٢٠ بكسل على الشاشة بين الكلمتين (الانجراف والحركات التي قاسها freezedetect ساكنة كانت دون ٢ بكسل للإطار).
  it.each([
    ["scale", "وخلق", "طين"], ["scale", "طين", "إبليس"], ["scale", "مفاضلة", "والطين"],
    ["honor", "له", "السجود"], ["enmity", "يمهله", "البعث"],
    ["sources", "فلا", "ننسب"], ["sources", "اكتشاف", "شخصية"], ["sources", "القرآن", "يثبت"],
  ] as const)("%s: الكادر يتحرك بين «%s» و«%s»", (shot, from, to) => {
    const s = scenes.find((x) => x.props.shot === shot);
    if (!s) return;
    const r = rig(s);
    const w0 = r.tl.words.find((w) => w.w.startsWith(from)), w1 = r.tl.words.find((w) => w.w.startsWith(to) && (!w0 || w.s > w0.s));
    if (!w0 || !w1) return;
    let path = 0, prev = r.at(w0.s);
    for (let t = w0.s + 1 / 30; t <= w1.e; t += 1 / 30) {
      const f = r.at(t);
      path += Math.hypot(f.screenX(960) - prev.screenX(960), f.screenY(520) - prev.screenY(520));
      prev = f;
    }
    expect(path).toBeGreaterThanOrEqual(120);
  });
});
