import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SHOTS } from "../src/remotion/illus/shots";
import { camAt, makeAt } from "../src/remotion/illus/shots/kit";
import {
  DONE_BEATS,
  FIRST_ANGLE,
  LEVEL_FRAMES,
  MAX_TILT,
  SCALE_SIZES,
  SCALE_TAG_SIZE,
  SECOND_SIL_PORTRAIT_DX,
  headColumn,
  firstAngleMap,
  scaleAngleAt,
  scaleBounds,
  scaleEventBeats,
  scaleEventCast,
  scaleLayout,
  scaleState,
  scaleVerdictBeats,
  scaleVerdictCast,
  verdictTagDx,
  verdictTagRect,
  witnessHead,
} from "../src/remotion/illus/shots/scale";
import { figureSpan } from "../src/remotion/illus/framing";
import { GROUND } from "../src/remotion/illus/world";
import { spokenTimings } from "../src/remotion/scenes/Episode";
import { sceneFrames } from "../src/plan/duration";
import { POSES } from "../src/remotion/illus/Figure";

/**
 * الحلقة 001 · حدث الميزان (c1-s1 وc1-s2): فحص هندسي لكل إطار بالاتجاهين، بالحساب نفسه الذي يُرندر به:
 * لا شخص مقصوص نصف قص، ولا رأس ولا بطاقة تحت السطر المكتوب، ولا بطاقة خارج الإطار أو فوق رأس،
 * والحجب في زاوية الشاهد الأول، واستمرار الحالة بين المشهدين.
 */
const plan = JSON.parse(fs.readFileSync(path.join(__dirname, "../channels/balislam/episodes/001-know-the-truth/plan.json"), "utf8"));
const scene = (id: string) => plan.chapters.flatMap((c: { scenes: unknown[] }) => c.scenes).find((s: { id: string }) => s.id === id);
const s1 = scene("c1-s1");
const s2 = scene("c1-s2");

/** أسفل السطر المكتوب بوحدات المشهد، بأسوأ حالة (سطران): أفقي 34 + 2×54×1.35؛ عمودي (250 + 2×62×1.35) ÷ 1.776 */
const CAPTION_BOTTOM = { landscape: 34 + 2 * 54 * 1.35, portrait: (250 + 2 * 62 * 1.35) / (1920 / 1080) };

type Person = { name: string; x: number; scale: number; poses: (keyof typeof POSES)[]; facing: "left" | "right"; back?: number; reach?: number; recoil?: number };
/** وضعيات كل شخص في كل مشهد كما في scaleEventCast وscaleVerdictCast (غلاف حدوده عبرها).
 * ردة فعل الأول (كفان إلى الصدر، ميل -3) داخل غلاف «cross» (خلف 67، أمام 116) فيُحسب به. */
const POSES_OF = {
  "souq-scale-event": { first: ["stand", "listen", "cross"], second: ["stand", "listen", "nod"], customer: ["stand"] },
  // الأول: «cross» ثم تراجع الجذع (lean -9، ميل 6° فوق الورك ≈ 180×1.75×sin6° ≈ 33 وحدة إلى الخلف، ونحسب 36)؛ الثانية: nod ثم sincere برأس مائل
  "souq-scale-verdicts": { first: ["cross"], second: ["nod", "sincere"], customer: ["stand"] },
} as const;
const people = (shotId: keyof typeof POSES_OF, portrait: boolean, second: boolean, vendorReach: number): Person[] => {
  const lay = scaleLayout(portrait);
  const S = SCALE_SIZES;
  const P = POSES_OF[shotId];
  return [
    { name: "الشاهد الأول", x: lay.first, scale: S.first, poses: [...P.first], facing: "right", ...(shotId === "souq-scale-verdicts" ? { recoil: 36 } : {}) },
    // الزبون يحمل كيسه على ظهره (نحو 84 وحدة خلفه بمقياس 1)
    { name: "الزبون", x: lay.customer, scale: S.customer, poses: [...P.customer], facing: "right", back: 84 * S.customer },
    // البائع ممتلئ (build 1.3) وذراعه تمتد إلى الكفة: أبعد ما تبلغه كفه من scaleState
    { name: "البائع", x: lay.vendor, scale: S.vendor * 1.3, poses: ["stand"], facing: "left", reach: vendorReach },
    ...(second ? [] : [{ name: "الشاهدة الثانية", x: lay.second, scale: S.second, poses: [...P.second] as (keyof typeof POSES)[], facing: "left" as const }]),
  ];
};
const headTop = (p: Person) => GROUND + 6 - 330 * (p.name === "البائع" ? SCALE_SIZES.vendor : p.scale);

const check = (shotId: string, sc: { narration: string }, durFrames: number, portrait: boolean) => {
  const at = makeAt(spokenTimings(sc.narration, durFrames), durFrames);
  const capBottom = portrait ? CAPTION_BOTTOM.portrait : CAPTION_BOTTOM.landscape;
  const bad: string[] = [];
  for (let frame = 0; frame < durFrames; frame++) {
    const shot = SHOTS[shotId]!.render({ frame, fps: 30, dur: durFrames, portrait, at });
    const c = camAt(frame, shot.cam);
    // أثناء انتقال الكاميرا بين تأطيرين يعبر الناس حافة الإطار طبيعيًا؛ الفحص على الإطارات المستقرة
    const moving = shot.cam.some((k) => !k.cut && k.t > 0 && frame >= k.t && frame < k.t + 22);
    if (moving) continue;
    const Z = c.z * (1 + 0.045 * (frame / durFrames));
    const half = (portrait ? 304 : 960) / Z;
    const vx0 = c.x - half;
    const vx1 = c.x + half;
    const sy = (y: number) => 540 + (y - c.y) * Z;
    // الزاوية (لزاويتي الشاهدين أشخاص مقصودون في المقدمة يُستثنون)
    const e = scaleEventBeats(at);
    const angle = shotId === "souq-scale-event" ? scaleAngleAt(frame, e.b) : "main";
    if (angle === "first") continue;
    const heads: { x0: number; x1: number; y0: number; y1: number }[] = [];
    const reach = shotId === "souq-scale-event" ? Math.min(...Array.from({ length: durFrames }, (_, f) => scaleState(f, e.b).hand.x)) - 16 : Infinity;
    for (const p of people(shotId as keyof typeof POSES_OF, portrait, angle === "second", reach)) {
      const sp0 = figureSpan(p.x, p.poses, p.facing, p.scale);
      const sp = { lo: Math.min(sp0.lo, p.reach ?? Infinity), hi: sp0.hi };
      const lo0 = p.back && p.facing === "right" ? Math.min(sp.lo, p.x - p.back) : sp.lo;
      const lo = lo0 - (p.recoil ?? 0);
      const inside = sp.hi > vx0 && lo < vx1;
      if (!inside) continue;
      if (lo < vx0 - 1 || sp.hi > vx1 + 1) bad.push(`${frame}: ${p.name} مقصوص على حافة الإطار`);
      const top = headTop(p);
      if (sy(top) < capBottom) bad.push(`${frame}: رأس ${p.name} تحت السطر المكتوب (${Math.round(sy(top))} < ${Math.round(capBottom)})`);
      const hw = 34 * p.scale;
      heads.push({ x0: p.x - hw, x1: p.x + hw, y0: top, y1: top + 75 * p.scale });
    }
    if (shotId === "souq-scale-verdicts") {
      const v = scaleVerdictBeats(at);
      const cast = scaleVerdictCast(frame, v);
      for (const [who, side, text, t] of [["first", -1, "ظلمًا", cast.tags!.first], ["second", 1, "عدلًا", cast.tags!.second]] as const) {
        if (t < 0.05) continue;
        const size = SCALE_TAG_SIZE(portrait);
        const r = verdictTagRect(witnessHead(who, portrait), side, text, size, verdictTagDx(who, portrait, text, size));
        // البطاقة لا تمتد فوق رأس جار صاحبها (الزبون للأول، والبائع للثانية)
        const n = headColumn(who === "first" ? "customer" : "vendor");
        if (r.x1 > n.x0 - 8 && r.x0 < n.x1 + 8) bad.push(`${frame}: بطاقة «${text}» فوق عمود رأس غير صاحبها`);
        if (r.x0 < vx0 + 4 || r.x1 > vx1 - 4) bad.push(`${frame}: بطاقة «${text}» خارج الإطار أفقيًا`);
        if (sy(r.y0) < capBottom) bad.push(`${frame}: بطاقة «${text}» تحت السطر المكتوب`);
        if (sy(r.y1) > 1080) bad.push(`${frame}: بطاقة «${text}» خارج الإطار رأسيًا`);
        for (const h of heads) if (r.x1 > h.x0 && r.x0 < h.x1 && r.y1 > h.y0 && r.y0 < h.y1) bad.push(`${frame}: بطاقة «${text}» فوق رأس`);
      }
    }
  }
  return bad;
};

describe("الحلقة 001 · حدث الميزان: الخطة", () => {
  it("c1-s1 وc1-s2 على اللقطتين الجديدتين بمعرّفيهما ونصيهما كما هما", () => {
    expect(s1.props.shot).toBe("souq-scale-event");
    expect(s2.props.shot).toBe("souq-scale-verdicts");
    expect(s1.narration).toBe("قد يشاهد شخصان الموقف نفسه، ثم يخرجان منه بحكمين مختلفين تمامًا.");
    expect(s2.narration).toBe("الأول يراه ظلمًا، والثاني يراه عدلًا.");
  });
  it("المدة تتسع للواقعة بعد آخر كلمة", () => {
    const d1 = sceneFrames(s1);
    const at = makeAt(spokenTimings(s1.narration, d1), d1);
    const e = scaleEventBeats(at);
    expect(d1).toBeGreaterThanOrEqual(e.end);
    const d2 = sceneFrames(s2);
    const v = scaleVerdictBeats(makeAt(spokenTimings(s2.narration, d2), d2));
    // اللقطة الرابطة تبقى ثانية ونصفًا على الأقل
    expect(d2 - (v.link + 22)).toBeGreaterThanOrEqual(45);
  });
});

describe("الحلقة 001 · حدث الميزان: التأطير والنص في كل إطار", () => {
  for (const portrait of [false, true])
    for (const [id, sc] of [["souq-scale-event", s1], ["souq-scale-verdicts", s2]] as const)
      it(`${id} · ${portrait ? "عمودي" : "أفقي"}`, () => {
        expect(check(id, sc, sceneFrames(sc), portrait)).toEqual([]);
      });
});

describe("الحلقة 001 · حدث الميزان: منطق الواقعة واستمرارها", () => {
  const d1 = sceneFrames(s1);
  const e = scaleEventBeats(makeAt(spokenTimings(s1.narration, d1), d1));
  it("أخف ← أثقل ← مستوٍ، والحبة تُعاد إلى الصندوق", () => {
    expect(scaleState(e.b.add - 12, e.b)).toMatchObject({ goods: 4 });
    expect(scaleState(e.b.add - 12, e.b).tilt).toBeLessThan(-10);
    expect(scaleState(e.b.add + 30, e.b).goods).toBe(6);
    expect(scaleState(e.b.lift - 12, e.b).tilt).toBeGreaterThan(10);
    const end = scaleState(d1 - 1, e.b);
    expect(end.goods).toBe(5);
    expect(end.crate).toBe(5);
    expect(Math.abs(end.tilt)).toBeLessThan(0.2);
    expect(end.carried).toBe(0);
  });
  it("الزاويتان في لحظة الرفع نفسها، بترتيب ثابت ولا إعادة", () => {
    const seq = Array.from({ length: d1 }, (_, f) => scaleAngleAt(f, e.b)).filter((a, i, xs) => i === 0 || a !== xs[i - 1]);
    expect(seq).toEqual(["main", "first", "second", "main"]);
    // الحبة مرفوعة في كف البائع قبل القطع من زاوية الأول
    const firstEnd = e.b.lift + 28;
    const inHand = Array.from({ length: 28 }, (_, i) => firstEnd - 28 + i).filter((f) => scaleState(f, e.b).carried);
    expect(inHand.length).toBeGreaterThanOrEqual(12);
  });
  it("زاوية الأول: الزبون وكيسه يحجبان الميزان كله، واليد بالحبة ظاهرة بجانبه قبل القطع", () => {
    const k = FIRST_ANGLE.customerScale;
    const torso = { x0: FIRST_ANGLE.customerX - 29 * 0.9 * k, x1: FIRST_ANGLE.customerX + 29 * 0.9 * k };
    const bag = { x0: FIRST_ANGLE.customerX - 84 * k, x1: FIRST_ANGLE.customerX - 18 * k };
    const yShoulder = GROUND + FIRST_ANGLE.customerDy - 256 * k;
    const yHip = GROUND + FIRST_ANGLE.customerDy - 144 * k;
    const sb = scaleBounds();
    const a = firstAngleMap({ x: sb.x0, y: sb.y0 });
    const z = firstAngleMap({ x: sb.x1, y: sb.y1 });
    // الميزان في المدى الأفقي المغطى (الكيس ثم الجذع)، وبين الكتف والورك
    expect(a.x).toBeGreaterThanOrEqual(bag.x0);
    expect(z.x).toBeLessThanOrEqual(torso.x1);
    expect(bag.x1).toBeGreaterThanOrEqual(torso.x0);
    expect(a.y).toBeGreaterThanOrEqual(yShoulder);
    expect(z.y).toBeLessThanOrEqual(yHip + 4);
    // اليد بالحبة خارج جسد الزبون في لحظة ما قبل القطع
    const visible = Array.from({ length: 38 }, (_, i) => e.b.lift - 10 + i).filter((f) => {
      const st = scaleState(f, e.b);
      if (!st.carried) return false;
      const h = firstAngleMap(st.hand);
      return h.x > torso.x1 + 6 || h.y < yShoulder - 70 * k;
    });
    expect(visible.length).toBeGreaterThanOrEqual(8);
  });
  it("قراءة الميزان: فرق واضح قبل رفع الحبة، والاستواء تدريجي يُرى في زاوية الثانية والحبة في اليد", () => {
    expect(MAX_TILT).toBeGreaterThanOrEqual(16);
    expect(scaleState(e.b.add - 12, e.b).tilt).toBeLessThan(-(MAX_TILT - 0.5));
    expect(scaleState(e.b.lift - 12, e.b).tilt).toBeGreaterThan(MAX_TILT - 1.5);
    const start = e.b.lift + 28;
    // عند القطع إلى زاوية الثانية ما زال العاتق مائلًا ميلًا ظاهرًا، والحبة في اليد
    expect(scaleState(start, e.b).tilt).toBeGreaterThan(6);
    expect(scaleState(start, e.b).carried).toBe(1);
    // ينخفض بلا قفز (لا يتغير أكثر من درجة في الإطار) حتى يستوي قبل العودة إلى الرئيسية
    for (let f = start; f < e.back; f++) expect(Math.abs(scaleState(f + 1, e.b).tilt - scaleState(f, e.b).tilt)).toBeLessThan(1);
    expect(Math.abs(scaleState(e.back, e.b).tilt)).toBeLessThan(1.5);
    expect(e.b.lift + 4 + LEVEL_FRAMES).toBeLessThan(e.back);
  });
  it("عمودي، زاوية الثانية: اليد والحبة والصندوق والكفتان داخل الإطار حتى تستقر الحبة، وظلها لا يحجب الصندوق", () => {
    const sc = SHOTS["souq-scale-event"]!;
    const at = makeAt(spokenTimings(s1.narration, d1), d1);
    const sb = scaleBounds();
    for (let f = e.b.lift + 28; f < e.back; f++) {
      const c = camAt(f, sc.render({ frame: f, fps: 30, dur: d1, portrait: true, at }).cam);
      const Z = c.z * (1 + 0.045 * (f / d1));
      const vx0 = c.x - 304 / Z;
      const vx1 = c.x + 304 / Z;
      const capY = c.y + ((CAPTION_BOTTOM.portrait - 540) / Z);
      const st = scaleState(f, e.b);
      expect(sb.x0).toBeGreaterThanOrEqual(vx0);
      expect(sb.x1).toBeLessThanOrEqual(vx1);
      // الصندوق (1174..1298)
      expect(1236 + 62).toBeLessThanOrEqual(vx1 - 4);
      if (st.carried) {
        expect(st.hand.x + 20).toBeLessThanOrEqual(vx1);
        expect(st.hand.y - 30).toBeGreaterThan(capY);
      }
    }
    // الظل يبدأ يمين الصندوق
    expect(1020 + SECOND_SIL_PORTRAIT_DX - 29 * 2.9).toBeGreaterThan(1236 + 62);
  });
  it("القطع: لا تتغير حالة الواقعة عند أي قطع (الحبة، الميل، العدد)", () => {
    const cuts = [e.b.lift - 10, e.b.lift + 28, e.back];
    for (const f of cuts) {
      const a = scaleState(f - 1, e.b);
      const z = scaleState(f, e.b);
      // خطوة اليد عند القطع مثل خطوتيها قبله وبعده (حركة متصلة لا قفز ولا إعادة)
      const step = (g: number) => {
        const p0 = scaleState(g - 1, e.b).hand;
        const p1 = scaleState(g, e.b).hand;
        return Math.hypot(p1.x - p0.x, p1.y - p0.y);
      };
      expect(step(f)).toBeLessThanOrEqual(Math.max(step(f - 1), step(f + 1)) * 1.25 + 1);
      expect(Math.abs(z.tilt - a.tilt)).toBeLessThan(1);
      expect(z.goods).toBe(a.goods);
      expect(z.crate).toBe(a.crate);
      expect(z.carried).toBe(a.carried);
    }
  });
  it("الحكمان: الأول يتراجع ووجهه إلى الدكان، والثانية تنظر إلى الكفتين وتومئ مرة واحدة", () => {
    const d2 = sceneFrames(s2);
    const v = scaleVerdictBeats(makeAt(spokenTimings(s2.narration, d2), d2));
    const after = scaleVerdictCast(v.firstSay + 12, v).first;
    expect(after.lean).toBeLessThan(-6);
    // وجهه إلى الدكان: لا التفات ولا رفع للرأس
    expect(Math.abs(after.head)).toBeLessThan(6);
    const heads = Array.from({ length: d2 }, (_, f) => scaleVerdictCast(f, v).second.head);
    expect(Math.min(...heads)).toBeGreaterThanOrEqual(15);
    // إيماءة واحدة: صعود ثم نزول واحد
    const ups = heads.filter((h, i) => i > 0 && h > heads[i - 1]! + 1e-6 && (i === 1 || heads[i - 1]! <= heads[i - 2]! + 1e-6)).length;
    expect(ups).toBe(1);
  });
  it("c1-s1 العمودي ينتهي بتأطير أول c1-s2 (بعد تعويض الانجراف)", () => {
    const at = makeAt(spokenTimings(s1.narration, d1), d1);
    const c = camAt(d1 - 1, SHOTS["souq-scale-event"]!.render({ frame: d1 - 1, fps: 30, dur: d1, portrait: true, at }).cam);
    const endZ = c.z * (1 + 0.045 * ((d1 - 1) / d1));
    const d2 = sceneFrames(s2);
    const at2 = makeAt(spokenTimings(s2.narration, d2), d2);
    const c2 = camAt(0, SHOTS["souq-scale-verdicts"]!.render({ frame: 0, fps: 30, dur: d2, portrait: true, at: at2 }).cam);
    expect(Math.abs(c.x - c2.x)).toBeLessThan(1);
    expect(Math.abs(c.y - c2.y)).toBeLessThan(1);
    expect(Math.abs(endZ - c2.z) / c2.z).toBeLessThan(0.01);
  });
  it("c1-s2 يبدأ من حالة آخر c1-s1: الميزان مستوٍ، والشاهدان بوضعيتي آخر الجملة", () => {
    const end = scaleState(d1 - 1, e.b);
    const start = scaleState(0, DONE_BEATS);
    expect(start.goods).toBe(end.goods);
    expect(start.crate).toBe(end.crate);
    expect(Math.abs(start.tilt - end.tilt)).toBeLessThan(0.2);
    const castEnd = scaleEventCast(d1 - 1, e);
    const d2 = sceneFrames(s2);
    const castStart = scaleVerdictCast(0, scaleVerdictBeats(makeAt(spokenTimings(s2.narration, d2), d2)));
    expect(castStart.first).toEqual(castEnd.first);
    expect(castStart.second).toEqual(castEnd.second);
    expect(castStart.customer).toEqual(castEnd.customer);
  });
});
