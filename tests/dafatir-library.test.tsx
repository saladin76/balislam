import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync } from "node:fs";
import { HZ_SCENES } from "../src/remotion/dafatir/horizon/episode001";
import { EP001_META, HZ_LEAD, HZ_META, hzSentences } from "../src/remotion/dafatir/horizon/meta";
import { at, buildTimeline } from "../src/remotion/dafatir/horizon/timeline";
import { WriteIn } from "../src/remotion/dafatir/horizon/book";
import { LIB_META, LIB_SACRED } from "../src/remotion/dafatir/lib/meta";
import { LIB_SCENES, boundCam, cues, libAnchors, parseItems, sacredWindows } from "../src/remotion/dafatir/lib/scenes";
import { TERM_HOLD, termMinEnd } from "../src/remotion/dafatir/lib/meta";
import { FINDS } from "../src/remotion/dafatir/lib/drawings";
import { sceneSeconds } from "../src/plan/duration";
import { SACRED_WORD } from "../src/render/stillness";
import type { Plan } from "../src/plan/types";

/**
 * مكتبة «دفتر الأفق» (الأمر 015): مشاهدها عامة تُضبط من الخطة، وتُختبر على حلقة مختبر بنصوص مختلفة عن الحلقة 001
 * (مصطلحات بتشكيل وبدونه، أصل غير قرآني، مرجع قرآني بلا نص، حاشية، مقارنات، خط زمني بفجوة، شواهد، وذكر الله).
 */
const LAB = "channels/dafatir-alzaman/episodes/900-library-lab";
const lab = JSON.parse(readFileSync(`${LAB}/plan.json`, "utf8")) as Plan;
const labScenes = lab.chapters.flatMap((c) => c.scenes);

const draw = (shot: string, narration: string, props: Record<string, string>, t: number) => {
  const tl = buildTimeline(hzSentences(narration), HZ_LEAD);
  const Comp = HZ_SCENES[shot]!;
  return renderToStaticMarkup(<Comp t={t} tl={tl} dur={99} exit="none" p={props} />);
};

describe("مكتبة دفتر الأفق — التسجيل والفصل", () => {
  it("كل مشهد مكتبة مسجل ببياناته، ولا يتداخل مع مشاهد الحلقة 001", () => {
    for (const k of Object.keys(LIB_META)) {
      expect(LIB_SCENES[k], k).toBeTruthy();
      expect(HZ_SCENES[k]).toBe(LIB_SCENES[k]);
      expect(HZ_META[k]).toBe(LIB_META[k]);
    }
    for (const k of Object.keys(LIB_SCENES)) expect(LIB_META[k], k).toBeTruthy();
    for (const k of Object.keys(EP001_META)) expect(LIB_META[k], `${k} مكرر في المكتبة والحلقة`).toBeUndefined();
  });

  it("قاعدة ذكر الله في المكتبة هي نفسها قاعدة القياس", () => {
    expect(LIB_SACRED.source).toBe(SACRED_WORD.source);
  });

  it("المكتبة لا تستورد من قناة أخرى ولا من كود الرندر", () => {
    for (const f of readdirSync("src/remotion/dafatir/lib")) {
      const src = readFileSync(`src/remotion/dafatir/lib/${f}`, "utf8");
      for (const m of src.matchAll(/from "([^"]+)"/g)) expect(m[1], `${f}: ${m[1]}`).toMatch(/^(react|remotion|\.\/|\.\.\/horizon\/)/);
    }
  });
});

describe("مكتبة دفتر الأفق — حلقة المختبر 900", () => {
  it("كل مشاهد المختبر من المكتبة العامة، وكل مرسى موجود في كلام مشهده", () => {
    const missing: string[] = [];
    for (const s of labScenes) {
      expect(s.template).toBe("horizon-shot");
      const shot = String(s.props.shot);
      expect(LIB_SCENES[shot], `${s.id}: ${shot} ليس من المكتبة`).toBeTruthy();
      const tl = buildTimeline(hzSentences(s.narration), HZ_LEAD);
      for (const a of libAnchors(shot, s.props as Record<string, string>)) {
        const [w, n] = a.split("#");
        try {
          at(tl, w!, Number(n) || 1);
        } catch {
          missing.push(`${s.id}: ${a}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("كل مشهد يُرسم في كل لحظاته بلا خطأ، ويتغير الكادر فعلًا (ليس صفحة ساكنة)", () => {
    for (const s of labScenes) {
      const shot = String(s.props.shot);
      const dur = sceneSeconds(s);
      const frames = new Set<string>();
      for (let t = 0; t < dur; t += 0.5) frames.add(draw(shot, s.narration, s.props as Record<string, string>, t));
      expect(frames.size, s.id).toBeGreaterThan(Math.min(6, dur));
    }
  }, 120_000);

  it("لا تغيير في الكادر حول كل لفظ جلالة في مشاهد المختبر", () => {
    const bad: string[] = [];
    let checked = 0;
    for (const s of labScenes) {
      const shot = String(s.props.shot);
      const tl = buildTimeline(hzSentences(s.narration), HZ_LEAD);
      const dur = sceneSeconds(s);
      const Comp = HZ_SCENES[shot]!;
      const f = (t: number) => renderToStaticMarkup(<Comp t={t} tl={tl} dur={dur} exit={HZ_META[shot]!.exit} p={s.props as Record<string, string>} />);
      for (const [a0, b0] of sacredWindows(tl)) {
        checked++;
        const a = Math.max(0, a0);
        const ref = f(a);
        for (let t = a + 1 / 30; t <= Math.min(dur, b0); t += 1 / 30) {
          if (f(t) !== ref) {
            bad.push(`${s.id} @${t.toFixed(2)}`);
            break;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
    expect(bad).toEqual([]);
  }, 120_000);
});

describe("مكتبة دفتر الأفق — أدوات", () => {
  it("المرسى الآمن يؤخر الحدث عن نافذة ذكر الله، والغائب يُسجَّل", () => {
    const tl = buildTimeline(["ويدعونا الله إلى النظر في الأرض."], 0.3);
    const q = cues(tl);
    const [x, y] = sacredWindows(tl)[0]!;
    const a = q.safe(x - 0.2, 0.6);
    expect(a >= y || a + 0.6 <= x).toBe(true);
    q.at("غير-موجود", 1);
    expect(q.missing).toEqual(["غير-موجود"]);
    expect(q.at("الأرض#1", 0)).toBeCloseTo(at(tl, "الأرض"));
  });

  it("عناصر «مرسى = نص» تقرأ الفجوات وسطورًا أو فواصل", () => {
    expect(parseItems("القرى = القرى الأولى\n؟قرون = قرون بلا سجل | المدن")).toEqual([
      { anchor: "القرى", text: "القرى الأولى", uncertain: false },
      { anchor: "قرون", text: "قرون بلا سجل", uncertain: true },
      { anchor: "المدن", text: "المدن", uncertain: false },
    ]);
  });

  it("الكتابة بالحبر: التشكيل لا يغيّر عرض الكلمة ولا يقسمها (عنصر نص واحد)", () => {
    const plain = renderToStaticMarkup(<svg><WriteIn id="a" x={500} y={500} size={100} p={0.5} label="الحضارة" /></svg>);
    const shakl = renderToStaticMarkup(<svg><WriteIn id="a" x={500} y={500} size={100} p={0.5} label="الحَضَارَة" /></svg>);
    const rect = (m: string) => m.match(/<rect[^>]*>/)![0];
    expect(rect(shakl)).toBe(rect(plain));
    expect(shakl.match(/<text/g)!.length).toBe(1);
    expect(shakl).toContain("الحَضَارَة");
  });

  it("المصطلح المتأخر يبقى مقروءًا: مدة lib-term تتسع لإمساك القراءة قبل الخروج، دون تقديم الكتابة عن كلمتها (الأمر 019، L1)", () => {
    for (const s of labScenes.filter((x) => x.props.shot === "lib-term")) {
      const tl = buildTimeline(hzSentences(s.narration), HZ_LEAD);
      const dur = sceneSeconds(s);
      const p = s.props as Record<string, string>;
      const [w] = (p.termWord || p.term!.split(/\s+/)[0]!).split("#");
      const writeEnd = at(tl, w!) + Math.min(1.4, 0.4 + 0.08 * p.term!.replace(/[\u064B-\u0652\u0670\u0640\s]/g, "").length);
      const exitLen = p.exit === "turn" ? 1.0 : 0.8;
      expect(dur - exitLen - writeEnd, s.id).toBeGreaterThanOrEqual(TERM_HOLD - 0.06);
      expect(termMinEnd(p, tl)).toBeGreaterThan(0);
    }
  });

  it("كاميرا المكتبة لا تُظهر ما وراء الكادر المحايد، وتحفظ رأس الصفحة (الأمر 019)", () => {
    for (const c of [{ cx: 1600, cy: 600, s: 1.3 }, { cx: 300, cy: 900, s: 1.2 }, { cx: 1365, cy: 470, s: 1.2 }]) {
      const b = boundCam(c, true);
      expect(b.cx - 960 / b.s).toBeGreaterThanOrEqual(-0.01);
      expect(b.cx + 960 / b.s).toBeLessThanOrEqual(1920.01);
      expect(b.cy - 540 / b.s).toBeLessThanOrEqual(60.01);
    }
    expect(boundCam({ cx: 960, cy: 520, s: 1 })).toEqual({ cx: 960, cy: 520, s: 1 });
  });

  it("«آثار مساكن» لها نسخة بطاقة تُستعمل في lib-evidence (الأمر 019، L2)", () => {
    expect(FINDS.find((f) => f.key === "home")?.card).toBeTruthy();
    const s = labScenes.find((x) => x.props.shot === "lib-evidence")!;
    const tl = buildTimeline(hzSentences(s.narration), HZ_LEAD);
    const html = renderToStaticMarkup(React.createElement(LIB_SCENES["lib-evidence"]!, { t: sceneSeconds(s) - 1.5, tl, dur: sceneSeconds(s), exit: "none", p: s.props as Record<string, string> }));
    expect(html).toContain("آثار مساكن");
  });
});

