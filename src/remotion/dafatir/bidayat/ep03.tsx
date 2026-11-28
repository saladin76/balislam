/**
 * «دفاتر الزمن 003 — الأجيال الأولى»: لقطات «خط الأفق» الجديدة كما في خطة المشاهد (scenes.md، D214).
 * ليل الدفتر ومواقده (القطعة المخصوصة: كل موقد جيل)، والخيط الأحمر على خط الأفق نفسه، والعقد العشر السوداء بين آدم ونوح.
 * لا تصوير لنبي ولا ملَك ولا لأي إنسان: إدريس عليه السلام اسم بالحبر وحده خارج الخيط (مراجعة المتخصص، الدفعة ٥).
 * الأسماء والأعمار في القوائم أسطر غير مقروءة (لا حروف مخترعة). كل حدث على كلمته (cueKit)، والسكون عند الذكر (reverent).
 */
import React from "react";
import { Books, Fire, GLYPHS, Qalam, Ruler } from "../lib/drawings";
import { DateRibbon } from "../horizon/book";
import {
  Arrow, BlankLine, C, Dot, GOLD_D, GoldSeal, Horizon, Ink, Leaf, NEUTRAL, Q, Ring, Scribble, Seal, Sheet, Stone, Tab, Thread, Txt,
  Write, bounce, cueKit, mix, prog, reverent, rng, type BdProps,
} from "./kit";

const HY = 600;
/** مواضع المواقد على خط الأفق (من اليمين: الأقدم) */
const HX = [1620, 1460, 1300, 1150, 1010, 860, 720, 580, 440, 290];
const COLD = "#6E7FA0";

/** ليل الدفتر: الورق بظل أزرق داكن، وأفق منخفض، ونجوم قليلة ثابتة */
const Night: React.FC<{ p?: number; dark?: number }> = ({ p = 1, dark = 0 }) => {
  const r = rng(303);
  return (
    <g>
      <rect x={140} y={60} width={1640} height={900} fill="#1E2540" opacity={0.2 + 0.12 * dark} />
      <Horizon y={HY} p={p} sky="night" dim={0.6 + 0.4 * dark} ground="#9C927E" texture={0.4} seed={33} />
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx={180 + r() * 1560} cy={120 + r() * 300} r={1.6 + r() * 1.8} fill={C.page} opacity={0.55 * p} />
      ))}
    </g>
  );
};

/** موقد: حلقة حجارة ونار هادئة صغيرة (q اشتعاله، tone لون ناره، dim خبوّه) */
const Hearth: React.FC<{ x: number; y?: number; q: number; t: number; tone?: string; dim?: number; s?: number }> = ({ x, y = HY, q, t, tone = C.ember, dim = 0, s = 1 }) => {
  if (q <= 0) return null;
  const flick = 1 + 0.06 * Math.sin(t * 9 + x);
  const fire = q * (1 - 0.75 * dim) * flick;
  return (
    <g opacity={Math.min(1, q * 1.6)} transform={`translate(${x} ${y - 4}) scale(${s})`}>
      <circle cx={0} cy={-12} r={44 * (1 - 0.6 * dim)} fill={tone} opacity={0.22 * q} />
      <g transform="scale(0.42)">
        <g style={{ filter: "none" }}>
          <Fire q={fire} />
        </g>
      </g>
      {[-26, -15, -4, 7, 18, 28].map((dx, i) => (
        <ellipse key={i} cx={dx} cy={6 + (i % 2) * 2} rx={7} ry={5} fill="#A89C86" stroke={C.ink} strokeWidth={2} />
      ))}
      {tone !== C.ember ? <circle cx={0} cy={-14} r={9} fill={tone} opacity={0.75 * q} /> : null}
    </g>
  );
};

/** قوس الأمة الواحدة فوق المواقد كلها (gap يفتح فيه انكسارًا) */
const ARC = "M1720 612 C1520 360 400 360 200 612";
const Arc: React.FC<{ p: number; gap?: number; c?: string }> = ({ p, gap = 0, c = GOLD_D }) =>
  p <= 0 ? null : (
    <g>
      <path d={ARC} fill="none" stroke={c} strokeWidth={5} strokeLinecap="round" pathLength={1} strokeDasharray={gap > 0 ? `${0.46 - 0.08 * gap} ${0.08 + 0.16 * gap} 1` : "1"} strokeDashoffset={gap > 0 ? 0 : 1 - p} />
    </g>
  );

/** عقد الخيط في هذه الحلقة: ١ آدم، ٢ ابناه، ٣ الأجيال الأولى (فارغة حتى تُشد)، ونوح رمادية */
const K1 = 1700, K2 = 1540, K3 = 760, KN = 300;

// ─── c2-s1: مواقد الليل ───
const ORDER = [0, 4, 7, 1, 2, 3, 5, 6, 8, 9];
const Hearths = reverent((q) => {
  const k = cueKit(q, ["واسعة"]);
  const { t } = k;
  const line = k.draw(0, "أرض", 1.2);
  const first = k.on(0, "يشتعل", 0.7);
  const second = k.on(0, "ثان", 0.6), third = k.on(0, "ثالث", 0.6);
  const ten = prog(t, k.at("عشرة", 1.4) - 0.05, k.at("عشرة", 1.4) + 1.4, (x) => x);
  const lit = ORDER.map((_, j) => (j === 0 ? first : j === 1 ? second : j === 2 ? third : prog(ten, (j - 3) / 7, (j - 2) / 7)));
  const qOf = (i: number) => lit[ORDER.indexOf(i)]!;
  const cam = k.cam({ cx: 1480, cy: 560, s: 1.35 }, [
    [0, "ثان", { cx: 1150, cy: 560, s: 1.2 }, 1.2],
    [0, "ثالث", { cx: 900, cy: 560, s: 1.12 }, 1.0],
    [0, "عشرة", NEUTRAL, 1.4],
  ]);
  const both = (
    <g>
      <Night p={line} />
      {HX.map((x, i) => <Hearth key={i} x={x} q={qOf(i)} t={t} />)}
    </g>
  );
  return <Leaf q={q} id="b3h" cam={cam} L={both} R={both} />;
});

/** مسكن بسيط بخط الحبر حول موقد (قبة خفيفة وباب) */
const Dwelling: React.FC<{ x: number; p: number; s?: number; o?: number }> = ({ x, p, s = 1, o = 1 }) =>
  p <= 0 ? null : (
    <g opacity={o} transform={`translate(${x} ${HY}) scale(${s})`}>
      <Ink d="M-110 0 C-110 -120 110 -120 110 0" p={p} w={4} />
      <Ink d="M-30 0 V-46 C-30 -62 30 -62 30 -46 V0" p={prog(p, 0.5, 1)} w={3} c={C.inkSoft} />
    </g>
  );

// ─── c2-s2: الموقد بيت ───
const HearthHouse = reverent((q) => {
  const k = cueKit(q, ["موقد"]);
  const { t } = k;
  const house = k.draw(0, "بيت", 1.0);
  const gen = prog(t, k.at("جيل", 1.4) - 0.05, k.at("جيل", 1.4) + 1.4);
  const sons = k.draw(0, "أبناء", 1.0);
  const cam = k.cam({ cx: 1300, cy: 560, s: 1.55 }, [[0, "جيل", { cx: 1060, cy: 580, s: 1.12 }, 1.4]]);
  const both = (
    <g>
      <Night />
      {HX.map((x, i) => <Hearth key={i} x={x} q={1} t={t} />)}
      <Dwelling x={1300} p={house} />
      {[1150, 1010, 860].map((x, i) => <Dwelling key={i} x={x} p={prog(gen, i / 3, (i + 1) / 3)} s={0.85 - i * 0.1} o={0.6 - i * 0.12} />)}
    </g>
  );
  return <Leaf q={q} id="b3hh" cam={cam} L={both} R={<g>{both}<Write id="b3hh-w" x={1150} y={720} size={42} p={sons} label="أبناء آدم عليه السلام" font="tajawal" color={C.page} /></g>} />;
});

// ─── c2-s7: أصل واحد ───
const OneOrigin = reverent((q) => {
  const k = cueKit(q, ["أصل"]);
  const { t } = k;
  const scatter = k.on(0, "الناس", 1.0);
  const root = k.on(0, "أصل", 0.5);
  const back = prog(t, k.at("واحد", 1.2) - 0.05, k.at("واحد", 1.2) + 1.2);
  const r = rng(71);
  const OX = 1180, OY = 480;
  const dots = Array.from({ length: 44 }, () => [mix(1720, 200, r()), mix(180, 860, r())] as const).filter(([x, y]) => Math.hypot(x - OX, y - OY) > 120);
  const cam = k.cam(NEUTRAL, [[0, "أصل", { cx: OX, cy: OY, s: 1.25 }, 1.0], [0, "واحد", NEUTRAL, 1.2]]);
  const both = (
    <g>
      {dots.map(([x, y], i) => {
        const s = prog(scatter, (i / dots.length) * 0.6, (i / dots.length) * 0.6 + 0.4);
        const b = prog(back, (i / dots.length) * 0.5, (i / dots.length) * 0.5 + 0.5);
        return (
          <g key={i}>
            <Ink d={`M${x} ${y} L${OX} ${OY}`} p={b} w={1.5} c={C.inkSoft} opacity={0.7} />
            <Dot x={mix(OX, x, s)} y={mix(OY, y, s)} q={s} r={7} />
          </g>
        );
      })}
    </g>
  );
  return <Leaf q={q} id="b3oo" cam={cam} L={both} R={<g>{both}<Ring x={OX} y={OY} r={30} p={root} c={GOLD_D} fill={C.gold} fillO={0.3} /><Dot x={OX} y={OY} q={root} r={15} /></g>} />;
});

// ─── c2-s10: المواقد تتكاثر ───
const SPREAD = [...HX, 1700, 1380, 1080, 790, 510, 220].map((x, i) => ({ x, y: i < 10 ? HY : HY + 110, s: i < 10 ? 1 : 0.75 }));
const HearthsSpread = reverent((q) => {
  const k = cueKit(q, ["انتشر"]);
  const { t } = k;
  const line = k.draw(0, "أب", 1.4);
  const spread = prog(t, k.at("انتشر") - 0.05, k.end("البشر") + 0.4);
  const all = prog(t, k.at("كلهم") - 0.05, k.at("كلهم") + 0.9);
  const seal = k.on(0, "ثابت");
  const gold = k.on(0, "القرآن");
  const O = 1150;
  const cam = k.cam({ cx: 1150, cy: 560, s: 1.3 }, [[0, "انتشر", NEUTRAL, 1.6], [0, "ثابت", { cx: 1500, cy: 420, s: 1.15 }, 1.0]]);
  const both = (
    <g>
      <Night />
      {SPREAD.map((h, i) => {
        const d = Math.abs(h.x - O) / 1000;
        const qq = i < 10 ? prog(spread, d * 0.8, d * 0.8 + 0.2) : prog(all, (i - 10) / 6, (i - 9) / 6);
        return <Hearth key={i} x={h.x} y={h.y} q={qq} t={t} s={h.s} />;
      })}
    </g>
  );
  return (
    <Leaf q={q} id="b3hs" cam={cam} L={both}
      R={<g>{both}
        <Write id="b3hs-l" x={1365} y={230} size={46} p={line} label="من أب واحد وأم واحدة" color={C.page} />
        <Seal x={1440} y={400} q={seal} kind="ثابت" s={0.55} />
        <GoldSeal x={1650} y={390} q={gold} label="النساء ١" s={0.85} />
      </g>} />
  );
});

// ─── c2-s11: أمة واحدة ───
const OneUmma = reverent((q) => {
  const k = cueKit(q, ["أمرهم"]);
  const { t } = k;
  const warm = k.on(0, "الناس", 0.8);
  const arc = k.draw(0, "أمة", 1.4);
  const word = k.draw(0, "أمة", 1.0);
  const cam = k.cam(NEUTRAL, [[0, "أول", { cx: 1500, cy: 560, s: 1.3 }, 1.0], [0, "أمة", NEUTRAL, 1.2]]);
  const both = (
    <g>
      <Night />
      {HX.map((x, i) => <Hearth key={i} x={x} q={1} t={t} tone={warm > 0.5 ? C.gold : C.ember} s={1 + 0.1 * warm} />)}
      <Arc p={arc} />
    </g>
  );
  return <Leaf q={q} id="b3ou" cam={cam} L={both} R={<g>{both}<Write id="b3ou-w" x={1365} y={300} size={60} p={word} label="أمة واحدة" color={C.page} /></g>} />;
});

/** الليل بالمواقد والقوس على الصفحة (خلفية الحاشية) */
const NightArc: React.FC<{ t: number; arc?: number; gap?: number; mixed?: number; dim?: number }> = ({ t, arc = 1, gap = 0, mixed = 0, dim = 0 }) => (
  <g>
    <Night dark={dim} />
    {HX.map((x, i) => <Hearth key={i} x={x} q={1} t={t} tone={mixed > 0 && i % 3 === 1 ? COLD : C.ember} dim={i % 3 === 2 ? 0.8 * dim : 0} />)}
    <Arc p={arc} gap={gap} />
  </g>
);

// ─── c2-s14 / c2-s15: ورقة الحاشية (أثر ابن عباس بنص المراجعة العلمية، الدفعة ٥ البند ١١٢: بلا «ثم اختلفوا» في القول) ───
const MarginNote = reverent((q) => {
  const k = cueKit(q, ["شيء", "وجاء"]);
  const { t } = k;
  const ask = k.draw(0, "شيء", 1.0);
  const sheet = k.on(1, "وجاء", 0.7);
  const tab = k.on(1, "عباس");
  // الدفعة ١٨ البند ٣٩٧: «وجاء في أثرٍ عن ابن عباس رضي الله عنهما أن بين نوح وآدم عليهما السلام عشرة قرون…» بلا «قال»: السطر المسطّر على «أثر»
  const line = k.draw(1, "أثر", 0.9);
  const l1 = k.draw(1, "عشرة", 0.9), l2 = k.draw(1, "شريعة", 1.0);
  const cam = k.cam(NEUTRAL, [
    [0, "شيء", { cx: 1300, cy: 420, s: 1.2 }, 1.0],
    [1, "وجاء", { cx: 600, cy: 480, s: 1.15 }, 1.0],
    [1, "شريعة", { cx: 580, cy: 520, s: 1.25 }, 1.2],
  ]);
  const bg = <NightArc t={t} />;
  return (
    <Leaf q={q} id="b3mn" cam={cam}
      L={<g>{bg}
        <Sheet x={560} y={520} w={660} h={640} q={sheet} rot={-1.5}>
          <BlankLine x={0} y={-150} w={480} p={line} />
          <Write id="b3mn-1" x={0} y={-60} size={50} p={l1} label="عشرة قرون" />
          <Write id="b3mn-2" x={0} y={40} size={50} p={l2} label="على شريعة من الحق" />
        </Sheet>
        <Tab x={880} y={196} q={tab} label="ابن عباس رضي الله عنهما" />
      </g>}
      R={<g>{bg}<Write id="b3mn-q" x={1365} y={300} size={54} p={ask} label="على أي شيء؟" color={C.page} /></g>} />
  );
});

// ─── c2-s16: من واحد إلى اختلاف (أثر موقوف عن ابن عباس رضي الله عنهما: لا ختم «رواية» ولا لسان «للمتخصص»، الدفعة ٥) ───
// الدفعة ١٨ البند ٣٩٧: الجملة «ومعناه: أن البشر بدؤوا على التوحيد، ثم جاء الاختلاف بعد ذلك.» (حُذف من الصوت «وهذا أثر عن ابن عباس، صححه الحاكم والألباني.»):
// لسان «أثر موقوف عن ابن عباس رضي الله عنهما» على «ومعناه»، وحُذف سطر «صححه الحاكم والألباني»، والورقة تنسحب بعد «البشر»
const OneThenMany = reverent((q) => {
  const k = cueKit(q, ["ومعناه"]);
  const { t } = k;
  const athar = k.on(0, "ومعناه");
  const away = prog(t, k.end("البشر") + 0.2, k.end("البشر") + 1.0);
  const one = k.on(0, "التوحيد", 0.8);
  const split = k.on(0, "الاختلاف", 0.9);
  const cam = k.cam({ cx: 600, cy: 500, s: 1.15 }, [[0, "ومعناه", NEUTRAL, 1.2], [0, "الاختلاف", { cx: 960, cy: 520, s: 1.05 }, 1.0]]);
  const bg = <g><NightArc t={t} gap={split} mixed={split} />{one > 0 && split <= 0 ? <path d={ARC} fill="none" stroke={C.gold} strokeWidth={10} opacity={0.35 * bounce(one, 0, 1) + 0.2 * one} /> : null}</g>;
  return (
    <Leaf q={q} id="b3om" cam={cam}
      L={<g>{bg}
        <g opacity={1 - away} transform={`translate(${-500 * away} 0)`}>
          <Sheet x={560} y={520} w={660} h={640} q={1} rot={-1.5}>
            <Txt x={0} y={-60} size={50} q={1} font="amiri">عشرة قرون</Txt>
            <Txt x={0} y={40} size={50} q={1} font="amiri">على شريعة من الحق</Txt>
          </Sheet>
          <Tab x={880} y={196} q={1} label="ابن عباس رضي الله عنهما" />
          <Tab x={880} y={760} q={athar} label="أثر موقوف عن ابن عباس رضي الله عنهما" color={C.ink} />
        </g>
      </g>}
      R={<g>{bg}<Txt x={1365} y={300} size={44} q={one * (1 - 0.6 * split)} color={C.page} font="amiri">التوحيد</Txt></g>} />
  );
});

// ─── c2-s17 / c2-s18: العقد العشر ───
const TEN = Array.from({ length: 10 }, (_, i) => 1540 - i * 112);
const TenKnots = reverent((q) => {
  const k = cueKit(q, ["تعني", "رقما"]);
  const { t, S } = k;
  const tie = S === 0 ? prog(t, k.at("عشرة") - 0.05, k.at("عشرة") + 1.6, (x) => x) : 1;
  const qm = k.on(0, "تعني", 0.6);
  const hundred = k.on(0, "مئة"), gen = k.on(0, "جيلا");
  const seal = k.on(0, "نعرف");
  const box = k.draw(1, "رقما", 0.8);
  const pen = S === 1 ? bounce(t, k.at("رقما") + 0.4, k.at("رقما") + 1.8) : 0;
  const measure = k.draw(1, "المسافة", 1.4);
  const shine = S === 1 ? prog(t, k.at("عشر") - 0.05, k.at("عشر") + 1.2, (x) => x) : 0;
  const dash = k.on(1, "تاريخ", 0.7);
  const cam = k.cam(NEUTRAL, [
    [0, "مئة", { cx: 1227, cy: 560, s: 1.35 }, 1.0],
    [0, "نعرف", { cx: 1150, cy: 600, s: 1.15 }, 1.0],
    [1, "رقما", { cx: 1500, cy: 380, s: 1.25 }, 1.0],
    [1, "المسافة", NEUTRAL, 1.2],
  ]);
  const both = (
    <g>
      <Night />
      <Thread x1={1760} x2={160} y={HY} p={1} sag={3} knots={[
        { x: K1, kind: "tied", q: 1 },
        { x: KN, kind: "grey", q: 1 },
      ]} />
      {TEN.map((x, i) => {
        const qq = prog(tie, i / 10, (i + 1) / 10);
        const g = S === 1 ? bounce(shine, i / 10, i / 10 + 0.25) : 0;
        return (
          <g key={i}>
            {g > 0 ? <circle cx={x} cy={HY} r={20} fill={C.gold} opacity={0.5 * g} /> : null}
            {qq > 0 ? <circle cx={x} cy={HY} r={9 * (0.5 + 0.5 * qq)} fill="#141015" stroke={C.page} strokeWidth={1.5} /> : null}
            <path d={`M${x - 12} ${HY + 34} h24`} stroke={C.page} strokeWidth={3} opacity={dash} />
          </g>
        );
      })}
      <Q x={960} y={330} size={150} q={qm} color={C.page} />
      <path d={`M${K1} ${HY - 30} C${K1 - 300} 400 ${KN + 300} 400 ${KN} ${HY - 30}`} fill="none" stroke={C.gold} strokeWidth={3} strokeDasharray="10 8" opacity={measure} />
    </g>
  );
  const GX = (TEN[2]! + TEN[3]!) / 2;
  return (
    <Leaf q={q} id="b3tk" cam={cam}
      L={<g>{both}<Txt x={KN} y={HY + 70} size={28} q={1} color={C.page}>نوح عليه السلام</Txt></g>}
      R={<g>{both}
        <Txt x={K1 - 30} y={HY + 70} size={28} q={1} color={C.page}>آدم عليه السلام</Txt>
        <Txt x={GX} y={HY - 50} size={36} q={hundred} color={C.page}>مئة سنة؟</Txt>
        <Txt x={GX} y={HY + 80} size={36} q={gen} color={C.page}>جيل؟</Txt>
        <Seal x={GX} y={HY + 190} q={seal} kind="لا نعلم" s={0.45} />
        <rect x={1460} y={330} width={150} height={90} rx={8} fill={C.page} stroke={C.ink} strokeWidth={3} strokeDasharray="10 8" opacity={box} />
        {pen > 0 ? <g opacity={pen} transform={`translate(${1610 + 40 * (1 - pen)} ${300 - 30 * (1 - pen)}) rotate(-40) scale(0.32)`}><g transform="translate(-330 0)"><Qalam /></g></g> : null}
      </g>} />
  );
});

/** لفافة: عمودان من أسطر غير مقروءة (الأسماء يمينًا، والأعمار يسارًا) */
const Scroll: React.FC<{ open: number; c1: number; c2: number; long: number; fold2: number; half: number; seal: number; tab: number }> = ({ open, c1, c2, long, fold2, half, seal, tab }) => {
  if (open <= 0) return null;
  const h = (380 + 280 * long) * open * (1 - 0.5 * half);
  const top = 200;
  return (
    <g>
      <rect x={340} y={top} width={460} height={h} fill="#FBF3E2" stroke={C.ink} strokeWidth={3} />
      <rect x={330} y={top - 16} width={480} height={22} rx={11} fill="#E4D2AE" stroke={C.ink} strokeWidth={3} />
      <rect x={330} y={top + h - 6} width={480} height={22} rx={11} fill="#E4D2AE" stroke={C.ink} strokeWidth={3} />
      <clipPath id="b3ls-clip"><rect x={340} y={top} width={460} height={h} /></clipPath>
      <g clipPath="url(#b3ls-clip)">
        <Scribble x={780} y={top + 40} w={170} n={9 + Math.round(7 * long)} p={c1} gap={36} seed={31} c={C.ink} o={0.6} />
        <g opacity={1 - fold2} transform={`translate(${560} 0) scale(${1 - fold2} 1) translate(-560 0)`}>
          <Scribble x={560} y={top + 40} w={150} n={9 + Math.round(7 * long)} p={c2} gap={36} seed={37} c={C.inkSoft} o={0.6} />
        </g>
        <Seal x={700} y={top + 150} q={seal} kind="رواية" s={0.5} />
      </g>
      <Tab x={800} y={top - 70} q={tab} label="من أخبار أهل الكتاب" />
    </g>
  );
};

// ─── c2-s19..s21: القائمة الطويلة ───
const LongScroll = reverent((q) => {
  const k = cueKit(q, ["قوائم", "وقاعدتنا", "الأعمار"]);
  const { S } = k;
  const books = k.on(0, "كتب", 0.6);
  const open = k.draw(0, "قوائم", 1.0);
  const c2 = k.draw(0, "وبأعمار", 1.2);
  const long = k.draw(0, "مئات", 1.2);
  const tab = k.on(0, "الكتاب");
  const rule = k.draw(1, "وقاعدتنا", 0.9);
  const a = k.draw(1, "نصدقهم", 0.9), b = k.draw(1, "نكذبهم", 0.9);
  // D242 (c2-s20 الحركة ٨٨٪، الحد ٩٥٪): مرجع القاعدة يظهر على «علّمنا» (مصدر التعليم لحظة ذكره) لا مع «نكذّبهم»، فيملأ
  // فجوة «فيها ما علّمنا النبي» بحدث من معناها؛ وسطر تحته يُمدّ على «النبي» (الحدث يتأخر آليًا عن نافذة لفظ الجلالة بعدها)
  const ref = S >= 1 ? k.on(1, "علمنا", 0.8) : 0;
  const refLine = S >= 1 ? k.draw(1, "النبي", 0.7) : 0;
  const fold2 = k.on(2, "الأعمار", 0.8);
  const seal = k.on(2, "الأسماء");
  const half = k.on(2, "شيئا", 0.9);
  const cam = k.cam(NEUTRAL, [
    [0, "قوائم", { cx: 580, cy: 460, s: 1.15 }, 1.0],
    [0, "الكتاب", { cx: 600, cy: 300, s: 1.3 }, 1.0],
    [1, "وقاعدتنا", { cx: 1365, cy: 340, s: 1.2 }, 1.0],
    [2, "الأعمار", { cx: 580, cy: 480, s: 1.1 }, 1.0],
  ]);
  return (
    <Leaf q={q} id="b3ls" cam={cam}
      L={<g>
        <g opacity={books} transform="translate(250 760) rotate(-8) scale(0.26)"><Books /></g>
        <Scroll open={open} c1={open} c2={c2} long={long} fold2={fold2} half={half} seal={seal} tab={tab} />
      </g>}
      R={<g>
        <BlankLine x={1365} y={330} w={620} p={rule} />
        <Write id="b3ls-a" x={1520} y={310} size={42} p={a} label="لا نصدّقهم" />
        <path d="M1365 270 V340" stroke={C.inkSoft} strokeWidth={3} opacity={b} />
        <Write id="b3ls-b" x={1205} y={310} size={42} p={b} label="ولا نكذّبهم" />
        <Txt x={1365} y={400} size={28} q={ref} color={C.inkSoft}>البخاري ٤٤٨٥</Txt>
        <Ink d="M1460 420 H1270" w={3} p={refLine} c={C.gold} />
      </g>} />
  );
});

/** الخيط بعُقده الثلاث (والثالثة «الأجيال الأولى») ونوح رمادية؛ إدريس عليه السلام ليس على الخيط */
const BaseThread: React.FC<{ tie3?: number; glow3?: number; noah?: boolean; p?: number; x2?: number }> = ({ tie3 = 1, glow3 = 0, noah = true, p = 1, x2 = 160 }) => (
  <g>
    <Thread x1={1760} x2={x2} y={HY} p={p} sag={3} knots={[
      { x: K1, kind: "tied", q: 1 },
      { x: K2, kind: "tied", q: 1 },
      { x: K3, kind: "ring", q: 1, tie: tie3, glow: glow3 },
      ...(noah ? [{ x: KN, kind: "grey" as const, q: 1 }] : []),
    ]} />
  </g>
);

// ─── c2-s24: العقدة الثالثة ───
const ThirdKnot = reverent((q) => {
  // مراجعة المتخصص (الدفعة ٥): اسم إدريس عليه السلام يقف خارج الخيط، بلا عقدة ولا نقطة ولا موضع بين آدم ونوح
  const k = cueKit(q, ["ونقف"]);
  const { t } = k;
  const gold = k.on(0, "القرآن");
  const name = k.draw(0, "إدريس", 1.0);
  const glow = bounce(t, k.at("إدريس"), k.at("إدريس") + 1.6);
  const cam = k.cam({ cx: 1300, cy: 560, s: 1.1 }, [[0, "ونقف", { cx: 1365, cy: 360, s: 1.3 }, 1.6]]);
  const both = (
    <g>
      <Night />
      {HX.map((x, i) => <Hearth key={i} x={x} q={1} t={t} s={0.85} />)}
      <BaseThread noah={false} />
    </g>
  );
  return (
    <Leaf q={q} id="b3k3" cam={cam} L={both}
      R={<g>{both}
        <ellipse cx={1365} cy={250} rx={230} ry={60} fill={C.gold} opacity={0.18 * glow} />
        <GoldSeal x={1650} y={240} q={gold} s={0.7} />
        <Write id="b3k3-n" x={1365} y={262} size={48} p={name} label="إدريس عليه السلام" font="tajawal" color={C.page} />
      </g>} />
  );
});

// ─── c2-s27 / c2-s28: ما نعرفه يقينًا ───
const ThreeWords = reverent((q) => {
  // نص المراجعة العلمية (الدفعة ٥): «فوصفه بالصدق العظيم والنبوة، وأخبر برفعه مكانًا عليًّا»
  const k = cueKit(q, ["وأثنى", "الصابرين"]);
  const seal = k.on(0, "إدريس");
  const w1 = k.draw(0, "بالصدق", 0.9), w2 = k.draw(0, "والنبوة", 0.9), w3 = k.draw(0, "برفعه", 1.0);
  const w4 = k.draw(1, "الصابرين", 1.0);
  const cam = k.cam(NEUTRAL, [[0, "بالصدق", { cx: 1450, cy: 640, s: 1.2 }, 1.0], [0, "برفعه", { cx: 1300, cy: 480, s: 1.15 }, 1.0], [1, "الصابرين", { cx: 1365, cy: 640, s: 1.1 }, 1.0]]);
  const STEP = "M1720 760 H1540 V640 H1340 V520 H1120 V400 H1000";
  const line = Math.max(0.05 * seal, w1 * 0.33, w2 * 0.66, w3);
  return (
    <Leaf q={q} id="b3tw" cam={cam}
      R={<g>
        <Seal x={1620} y={230} q={seal} kind="ثابت" s={0.5} />
        <Txt x={1620} y={295} size={28} q={seal} color={C.ink}>مريم ٥٦–٥٧</Txt>
        <Ink d={STEP} p={line} w={4} c={GOLD_D} />
        <Write id="b3tw-1" x={1630} y={740} size={48} p={w1} label="الصدق العظيم" />
        <Write id="b3tw-2" x={1440} y={620} size={48} p={w2} label="النبوة" />
        <Write id="b3tw-3" x={1220} y={380} size={48} p={w3} label="مكانًا عليًّا" />
        <Write id="b3tw-4" x={1300} y={850} size={46} p={w4} label="مع الصابرين" font="tajawal" color={C.inkSoft} />
      </g>} />
  );
});

// ─── c2-s31: شاهد من الحديث ───
// الدفعة ١٨ البند ٣٩٨: «وفي حديث المعراج الصحيح أن النبي صلى الله عليه وسلم لقي إدريس عليه السلام في السماء الرابعة. وأما موضع إدريس على خطّ الأجيال، فلا نعلمه على التعيين.»: الكلمات نفسها، والبطاقة خارج الخيط
const HadithNote = reverent((q) => {
  // «وأما موضع إدريس…»: الكاميرا تتراجع على «موضع» فتظهر البطاقة وحدها خارج الخيط (لا عنصر جديد)
  const k = cueKit(q, ["المعراج"]);
  const title = k.draw(0, "حديث", 1.0);
  const seal = k.on(0, "الصحيح");
  const words = k.on(0, "السماء", 0.7);
  const cam = k.cam(NEUTRAL, [[0, "حديث", { cx: 1365, cy: 360, s: 1.2 }, 1.0], [0, "موضع", NEUTRAL, 1.2]]);
  return (
    <Leaf q={q} id="b3hn" cam={cam}
      R={<g>
        <Write id="b3hn-t" x={1365} y={270} size={60} p={title} label="حديث المعراج" />
        <Seal x={1365} y={420} q={seal} kind="حديث صحيح" s={0.6} />
        <Txt x={1365} y={500} size={28} q={seal} color={C.inkSoft}>مسلم ١٦٢</Txt>
        <Txt x={1365} y={650} size={46} q={words} color={C.inkSoft} font="amiri">السماء الرابعة</Txt>
      </g>} />
  );
});

// ─── c2-s36: ما بقي في اليد ───
const WhatRemains = reverent((q) => {
  const k = cueKit(q, ["أيدينا"]);
  const { t } = k;
  const frame = k.draw(0, "بقي", 0.8);
  const root = k.on(0, "أصل");
  const arc = k.draw(0, "التوحيد", 1.0);
  const glow = bounce(t, k.at("صادق"), k.at("صادق") + 1.4);
  const rise = k.draw(0, "منزلته", 0.9);
  const cam = k.cam({ cx: 960, cy: 540, s: 1.02 }, [[0, "بقي", { cx: 1450, cy: 380, s: 1.2 }, 1.0], [0, "صادق", { cx: 820, cy: 560, s: 1.2 }, 1.0]]);
  const both = (
    <g>
      <Night />
      {HX.map((x, i) => <Hearth key={i} x={x} q={1} t={t} s={0.8} />)}
      <BaseThread />
    </g>
  );
  return (
    <Leaf q={q} id="b3wr" cam={cam}
      L={both}
      R={<g>{both}
        <rect x={1360} y={210} width={360} height={170} rx={10} fill={C.page} stroke={C.ink} strokeWidth={3} opacity={frame} />
        <Dot x={1660} y={300} q={root} r={11} />
        <g transform="translate(1480 330) scale(0.16)"><Arc p={arc} /></g>
        {[0, 1, 2].map((i) => <circle key={i} cx={1450 + i * 30} cy={325} r={4} fill={C.ember} opacity={arc} />)}
        <Dot x={1395} y={300} q={glow > 0 || rise > 0 ? 1 : 0} r={7} c={C.gold} />
        <Arrow d="M1395 285 L1395 232" p={rise} hx={1395} hy={232} ang={-90} c={C.gold} />
      </g>} />
  );
});

// ─── c2-s37: المسافة الفارغة ───
const Gap = reverent((q) => {
  const k = cueKit(q, ["مسافة"]);
  const { t } = k;
  const broken = k.on(0, "مسافة", 0.9);
  const ruler = prog(t, k.at("طولها", 1.4) - 0.05, k.at("طولها", 1.4) + 1.4);
  const pen = bounce(t, k.at("نملأها"), k.at("نملأها") + 1.6);
  const cam = k.cam(NEUTRAL, [[0, "مسافة", { cx: 560, cy: 580, s: 1.3 }, 1.0]]);
  const both = (
    <g>
      <Night />
      <Thread x1={1760} x2={K3} y={HY} p={1} sag={0} knots={[{ x: K1, kind: "tied", q: 1 }, { x: K2, kind: "tied", q: 1 }, { x: K3, kind: "tied", q: 1 }]} />
      <path d={`M${K3} ${HY} H${KN}`} stroke={C.ribbon} strokeWidth={6} strokeLinecap="round" opacity={1 - broken} />
      <path d={`M${K3} ${HY} H${KN}`} stroke={C.ribbon} strokeWidth={6} strokeDasharray="14 18" opacity={broken} />
      <Thread x1={KN} x2={160} y={HY} p={1} sag={0} knots={[{ x: KN, kind: "grey", q: 1 }]} />
    </g>
  );
  return (
    <Leaf q={q} id="b3gp" cam={cam} R={both}
      L={<g>{both}
        {ruler > 0 ? <g opacity={Math.min(1, ruler * 4)} transform={`translate(${mix(860, 530, ruler)} ${HY + 70}) scale(0.55)`}><Ruler /></g> : null}
        {pen > 0 ? <g opacity={pen} transform={`translate(${560} ${HY - 40 - 90 * (1 - pen)}) rotate(-60) scale(0.3)`}><g transform="translate(-330 0)"><Qalam /></g></g> : null}
      </g>} />
  );
});

// ─── c2-s38: الأمة لم تبق واحدة ───
const Dimming = reverent((q) => {
  const k = cueKit(q, ["تبق"]);
  const { t } = k;
  const pulse = bounce(t, k.at("الأمة"), k.at("الأمة") + 1.0);
  const split = k.on(0, "تبق", 1.2);
  const k4 = k.on(0, "القادمة", 0.7);
  const ask = k.draw(0, "الشرك", 1.0);
  const K4 = 440;
  const cam = k.cam(NEUTRAL, [[0, "القادمة", { cx: 520, cy: 520, s: 1.3 }, 1.0]]);
  const both = (
    <g>
      <NightArc t={t} gap={split} dim={split} />
      <Thread x1={1760} x2={160} y={HY} p={1} sag={3} knots={[
        { x: K1, kind: "tied", q: 1 }, { x: K2, kind: "tied", q: 1 }, { x: K3, kind: "tied", q: 1 },
        { x: K4, kind: "ring", q: k4, tie: 0 },
      ]} />
      {pulse > 0 ? <path d={ARC} fill="none" stroke={C.gold} strokeWidth={10} opacity={0.4 * pulse} /> : null}
    </g>
  );
  return (
    <Leaf q={q} id="b3dm" cam={cam}
      L={<g>{both}
        <Write id="b3dm-q" x={K4} y={470} size={44} p={ask} label="كيف بدأ الشرك؟" color={C.page} />
      </g>}
      R={both} />
  );
});

export const BD03_SCENES: Record<string, React.FC<BdProps>> = {
  "bd03-hearths": Hearths,
  "bd03-hearth-house": HearthHouse,
  "bd03-one-origin": OneOrigin,
  "bd03-hearths-spread": HearthsSpread,
  "bd03-one-umma": OneUmma,
  "bd03-margin-note": MarginNote,
  "bd03-one-then-many": OneThenMany,
  "bd03-ten-knots": TenKnots,
  "bd03-long-scroll": LongScroll,
  "bd03-third-knot": ThirdKnot,
  "bd03-three-words": ThreeWords,
  "bd03-hadith-note": HadithNote,
  "bd03-what-remains": WhatRemains,
  "bd03-gap": Gap,
  "bd03-dimming": Dimming,
};

/** مشهد الصورة الثابتة للمراجعة لكل لقطة (المعرّف في الخطة)؛ الغائب = آخر مشهد يستعمل اللقطة، عند نهاية آخر كلمة */
export const BD03_STILLS: Record<string, string> = {
  "bd03-ten-knots": "c2-s17",
  "bd03-margin-note": "c2-s15",
  "bd03-long-scroll": "c2-s19",
};

