/**
 * «دفاتر الزمن 004 — كيف بدأ الشرك؟»: لقطات «خط الأفق» الجديدة كما في خطة المشاهد (scenes.md، D214).
 * لا تصوير لنبي ولا لأي إنسان ولا وجوه: نوح عليه السلام نقطة ضوء على الخيط واسم بالحبر. الأنصاب حجارة صمّاء بلا هيئة،
 * ولا ضوء موجّه إليها ولا سجود يُرى ولا قرابين؛ المعنى تحذير لا تمجيد. المقاعد خالية بلا أشخاص.
 * العقدة الرابعة داكنة (عقدة انحراف) والخيط ينحرف بعدها ثم يستقيم نحو نقطة الضوء.
 */
import React from "react";
import { FindAt, GLYPHS, Hatch, Qalam } from "../lib/drawings";
import { DateRibbon, Pin } from "../horizon/book";
import {
  Arrow, C, DotFrame, Dot, EMBER, Field, GOLD_D, Globe, GoldSeal, Horizon, Ink, Leaf, NEUTRAL, Q, Ring, Scribble, Seal,
  Sheet, Sun, Tab, Thread, Txt, Write, bounce, cueKit, mix, prog, reverent, rng, type BdProps, type KnotDef,
} from "./kit";

// ─── عناصر الحلقة المشتركة ───
const HZ_Y = 560;
const TY = 800;
const K1 = 1640, K2 = 1380, K3 = 1120, K4 = 760, NOAH = 330;
const STELE = "#A9A196";

/** الخيط بعقده ١–٤ (الرابعة داكنة)، والانحراف بعدها، والاستقامة نحو نقطة الضوء */
const Line04: React.FC<{
  p?: number; k123?: number; labels?: number; k3label?: number; k4?: number; glow4?: number; glow123?: number;
  veer?: number; straight?: number; light?: number; lightLabel?: number; adam?: number; tie5?: number; ring5?: number;
}> = ({ p = 1, k123 = 1, labels = 1, k3label, k4 = 0, glow4 = 0, glow123 = 0, veer = 0, straight = 0, light = 0, lightLabel = 0, adam = 0, tie5, ring5 = 0 }) => {
  const knots: KnotDef[] = [
    { x: K1, kind: "tied", q: k123, glow: glow123, label: "خلق آدم", lq: labels },
    { x: K2, kind: "tied", q: k123, glow: glow123, label: "ابنا آدم", lq: labels },
    { x: K3, kind: "tied", q: k123, glow: glow123, label: "الأجيال الأولى", lq: k3label ?? labels },
    { x: K4, kind: "dark", q: k4, glow: glow4 },
  ];
  return (
    <g>
      <Thread x1={1760} x2={K4} y={TY} p={p} knots={knots} sag={3} labelSize={26} labelDy={56} />
      <Ink d={`M${K4} ${TY} C${K4 - 160} ${TY + 6} ${K4 - 330} ${TY + 34} 180 ${TY + 70}`} p={veer} w={6} c={C.ribbon} opacity={1 - 0.65 * straight} />
      <Ink d={`M${K4} ${TY} H${NOAH + 20}`} p={straight} w={6} c={C.ribbon} />
      {light > 0 ? (
        <g opacity={light}>
          <circle cx={NOAH} cy={TY} r={30} fill={C.gold} opacity={0.3} />
          <circle cx={NOAH} cy={TY} r={13} fill={C.gold} stroke={GOLD_D} strokeWidth={3} />
        </g>
      ) : null}
      {ring5 > 0 ? <circle cx={NOAH} cy={TY} r={26 - 8 * (tie5 ?? 0)} fill="none" stroke={C.ribbon} strokeWidth={5} opacity={ring5} /> : null}
      <Txt x={NOAH} y={TY + 58} size={26} q={lightLabel} color={C.ink}>نوح عليه السلام</Txt>
      <Txt x={K1} y={TY - 40} size={26} q={adam} color={C.ink}>آدم عليه السلام</Txt>
    </g>
  );
};

/** نصب حجري أصمّ: لا ملمح ولا هيئة، وظل يقع (len يطيله) */
const Stele: React.FC<{ x: number; y: number; q: number; h?: number; w?: number; len?: number; dotted?: boolean; fill?: string }> = ({ x, y, q, h = 170, w = 66, len = 1, dotted, fill = STELE }) =>
  q <= 0 ? null : (
    <g opacity={Math.min(1, q * 1.4)} transform={`translate(${x} ${y})`}>
      {!dotted ? <path d={`M${w / 2} 0 L${w / 2 + 70 * len} -8 L${w / 2 + 70 * len} 6 L${-w / 2} 8 Z`} fill="#2B1E14" opacity={0.25} /> : null}
      <path
        d={`M${-w / 2} 0 V${-h * q + 22} C${-w / 2} ${-h * q - 6} ${w / 2} ${-h * q - 6} ${w / 2} ${-h * q + 22} V0 Z`}
        fill={dotted ? "none" : fill}
        stroke={dotted ? C.inkSoft : C.ink}
        strokeWidth={4}
        strokeDasharray={dotted ? "10 8" : undefined}
      />
    </g>
  );

/** بطاقة صغيرة تحت النصب، و«ذكرى» تُكتب أو تُمحى (memo من ١ إلى ٠ = محو من الطرف) */
const Card: React.FC<{ id: string; x: number; y: number; q: number; memo: number; qm?: number; dim?: number }> = ({ id, x, y, q, memo, qm = 0, dim = 1 }) =>
  q <= 0 ? null : (
    <g opacity={Math.min(1, q * 1.4) * dim}>
      <rect x={x - 60} y={y - 26} width={120} height={52} rx={6} fill={C.page} stroke={C.ink} strokeWidth={3} />
      <Write id={id} x={x} y={y + 12} size={30} p={memo} label="ذكرى" font="tajawal" />
      <Q x={x} y={y + 16} size={40} q={qm} color={C.inkSoft} />
    </g>
  );

// ─── c1-s2: المزولة ───
const ShadowDial = reverent((q) => {
  const k = cueKit(q, ["يحدث"]);
  const { t } = k;
  const arc = k.draw(0, "يوم", 1.0);
  const sunMove = prog(t, k.at("يوم") - 0.05, k.end("واحد") + 0.8);
  const turn = prog(t, k.at("واحد") - 0.05, k.at("واحد") + 1.4);
  const fade = k.on(0, "يبدأ", 0.8);
  const frame = k.on(0, "بحجر", 0.6);
  const ang = mix(80, 10, turn);
  const len = mix(40, 300, turn);
  const sx = mix(560, 220, sunMove), sy = 260 - 90 * Math.sin(Math.PI * mix(0.5, 0.95, sunMove));
  const cam = k.cam(NEUTRAL, [[0, "واحد", { cx: 640, cy: 560, s: 1.25 }, 1.2]]);
  const both = <Horizon y={HZ_Y} p={1} sky="noon" texture={0.5} />;
  return (
    <Leaf q={q} id="b4sd" cam={cam} R={both}
      L={<g>{both}
        <path d="M800 300 Q500 80 200 300" fill="none" stroke={C.inkSoft} strokeWidth={3} strokeDasharray="8 10" opacity={arc} />
        <Sun x={sx} y={sy} r={30} q={1} c={C.sand} />
        <g opacity={1 - fade}>
          <path d={`M600 ${HZ_Y + 20} L${600 + len * Math.cos((ang * Math.PI) / 180)} ${HZ_Y + 20 + 0.25 * len * Math.sin((ang * Math.PI) / 180)}`} stroke="#2B1E14" strokeWidth={14} strokeLinecap="round" opacity={0.3} />
          <Stele x={600} y={HZ_Y + 20} q={1} h={120} w={90} len={0} />
        </g>
        <Stele x={600} y={HZ_Y + 20} q={fade} h={120} w={90} dotted />
        <DotFrame x={600} y={HZ_Y - 40} w={170} h={180} q={frame} c={C.ink} />
      </g>} />
  );
});

// ─── c1-s3: الخيط تحت الأفق ───
const ThreadNoon = reverent((q) => {
  const k = cueKit(q, ["الماضية"]);
  const { t } = k;
  const thread = prog(t, 0.05, k.at("الحلقة") + 0.6);
  const k12 = k.on(0, "الحلقة", 0.6);
  const k3 = k.on(0, "الأجيال", 0.6);
  const many = k.on(0, "يكثرون", 0.8);
  const spread = k.on(0, "وينتشرون", 1.2);
  const r = rng(43);
  const dots = Array.from({ length: 18 }, () => r() - 0.5);
  const cam = k.cam(NEUTRAL, [[0, "الأجيال", { cx: 1250, cy: 720, s: 1.3 }, 1.1], [0, "وينتشرون", NEUTRAL, 1.4]]);
  const both = (
    <g>
      <Horizon y={HZ_Y} p={1} sky="noon" texture={0.5} />
      <Line04 p={thread} k123={k12} labels={k12} k3label={k3} />
      {dots.map((d, i) => <Dot key={i} x={K3 + d * (80 + 1100 * spread)} y={HZ_Y - 8 - (i % 3) * 6} q={prog(many, i / 18, i / 18 + 0.3)} r={6} />)}
    </g>
  );
  return <Leaf q={q} id="b4tn" cam={cam} L={both} R={both} />;
});

// ─── c1-s4: العقدة الداكنة ───
const DarkKnot = reverent((q) => {
  const k = cueKit(q, ["نتابع"]);
  const knot = k.on(0, "نتابع", 0.7);
  const veer = k.draw(0, "الانحراف", 1.2);
  const cam = k.cam({ cx: 1100, cy: 720, s: 1.2 }, [[0, "نتابع", { cx: 820, cy: 720, s: 1.4 }, 1.1], [0, "الانحراف", { cx: 640, cy: 740, s: 1.15 }, 1.2]]);
  const both = (
    <g>
      <Horizon y={HZ_Y} p={1} sky="noon" texture={0.4} />
      <Line04 k4={knot} veer={veer} />
    </g>
  );
  return (
    <Leaf q={q} id="b4dk" cam={cam} R={both} L={both} />
  );
});

// ─── c1-s5 / c1-s6 (bd04-between وbd04-ten-centuries): بين عقدتين ───
const BetweenScene: React.FC<{ q: BdProps; id: string; adam: number; noah: number; arc: number; ribbon: number; unk: number; tab?: number; ten?: number; ruler?: number; cam: { cx: number; cy: number; s: number } }> = ({ q, id, adam, noah, arc, ribbon, unk, tab = 0, ten = 0, ruler = 0, cam }) => {
  const both = (
    <g>
      <Horizon y={HZ_Y} p={1} sky="noon" texture={0.4} />
      <Line04 k4={1} veer={1} light={noah} lightLabel={noah} adam={adam} labels={0.5} />
      <Ink d={`M${K1} ${TY - 70} Q${(K1 + NOAH) / 2} ${TY - 400} ${NOAH} ${TY - 70}`} p={arc} w={4} c={C.ink} />
      {Array.from({ length: 10 }, (_, i) => {
        const x = mix(K1 - 120, NOAH + 120, i / 9);
        return <path key={i} d={`M${x} ${TY - 200} v-40`} stroke={C.ink} strokeWidth={5} strokeLinecap="round" opacity={prog(ten, i / 10, (i + 1) / 10)} />;
      })}
      <Ink d={`M${K1 - 140} ${TY - 180} H${NOAH + 100}`} p={ruler} w={4} c={GOLD_D} />
    </g>
  );
  return (
    <Leaf q={q} id={id} cam={cam} L={both}
      R={<g>{both}
        <DateRibbon x={1200} y={150} s={0.9} o={ribbon} />
        <Seal x={1200} y={260} q={unk} kind="لا نعلم" s={0.45} />
        <Tab x={1740} y={130} q={tab} label="أثر عن ابن عباس" />
        <Txt x={1500} y={210} size={24} q={tab} color={C.inkSoft} font="tajawal">صححه الحاكم والألباني</Txt>
      </g>} />
  );
};
const Between = reverent((q) => {
  const k = cueKit(q, ["بينهما"]);
  const cam = k.cam(NEUTRAL, [[0, "الخيط", { cx: 1000, cy: 700, s: 1.1 }, 1.2], [0, "السنين", { cx: 1200, cy: 300, s: 1.25 }, 1.0], [0, "نعلم", NEUTRAL, 1.2]]);
  return <BetweenScene q={q} id="b4bt" adam={k.on(0, "آدم")} noah={k.on(0, "ونوح", 0.7)} arc={k.draw(0, "بينهما", 1.2)} ribbon={k.on(0, "السنين")} unk={k.on(0, "نعلم")} cam={cam} />;
});
const TenCenturies = reverent((q) => {
  const k = cueKit(q, ["قرون"]);
  const { t } = k;
  const ten = prog(t, k.at("عشرة") - 0.05, k.end("قرون") + 0.6);
  const cam = k.cam(NEUTRAL, [[0, "عشرة", { cx: 1000, cy: 620, s: 1.12 }, 1.2]]);
  // أثر صحيح عن ابن عباس (المراجعة العلمية، الدفعة ٥ البند ١٢٠): «أثر عن ابن عباس، صححه الحاكم والألباني»، وعدد السنين خانة فارغة
  return <BetweenScene q={q} id="b4tc" adam={1} noah={1} arc={1} ribbon={k.on(0, "السنوات")} unk={0} tab={k.on(0, "وجاء")} ten={ten} ruler={k.draw(0, "الحق", 1.0)} cam={cam} />;
});

// ─── c1-s8: العالم بلا أضواء ───
const WorldUnlit = reverent((q) => {
  const k = cueKit(q, ["ننسبها"]);
  const { t } = k;
  const globe = k.draw(0, "العالم", 1.3);
  const cities = k.on(0, "مدن", 0.8);
  const names = k.on(0, "أسماءها", 0.7);
  const finds = k.on(0, "آثار", 0.7);
  const pinIn = k.on(0, "ننسبها", 0.6);
  const rise = k.on(0, "بدليل", 1.2);
  const hover = Math.sin(t * 3) * 10;
  const cam = k.cam(NEUTRAL, [[0, "العالم", { cx: 600, cy: 480, s: 1.2 }, 1.2], [0, "آثار", { cx: 1300, cy: 520, s: 1.15 }, 1.1]]);
  const glyphPos = [[360, 330], [770, 330], [330, 600], [800, 610]] as const;
  return (
    <Leaf q={q} id="b4wu" cam={cam}
      L={<g>
        <Globe x={560} y={470} r={200} p={globe} spin={t} washC="#7A6A5A" wash={0.4 * globe} />
        {glyphPos.map(([x, y], i) => (
          <path key={i} d={GLYPHS[i % GLYPHS.length]} transform={`translate(${x} ${y})`} fill="none" stroke={C.inkSoft} strokeWidth={3} strokeDasharray="6 6" opacity={prog(cities, i / 4, i / 4 + 0.5)} />
        ))}
      </g>}
      R={<g>
        {[0, 1, 2].map((i) => (
          <g key={i} opacity={prog(names, i / 3, i / 3 + 0.5)}>
            <rect x={1500} y={220 + i * 80} width={200} height={56} rx={6} fill={C.page} stroke={C.ink} strokeWidth={3} />
            <path d={`M1680 ${256 + i * 80} H1520`} stroke={C.inkSoft} strokeWidth={2} strokeDasharray="8 8" />
          </g>
        ))}
        <g opacity={0.45 * finds}><FindAt k="tool" x={1150} y={640} s={0.9} p={finds} /></g>
        <DotFrame x={1150} y={640} w={210} h={210} q={finds} />
        <g opacity={0.45 * finds}><FindAt k="art" x={1440} y={660} s={0.8} p={finds} /></g>
        <DotFrame x={1440} y={660} w={250} h={190} q={finds} />
        <Pin x={1300} y={520 + hover - 260 * rise} o={pinIn * (1 - 0.6 * rise)} />
      </g>} />
  );
});

// ─── c1-s10: الخط المستقيم ───
const StraightLineScene: React.FC<{ line: number; seal: number; word: number }> = ({ line, seal, word }) => (
  <g>
    <Ink d="M1760 520 H160" p={line} w={6} c={C.ink} />
    <Write id="b4sl-w" x={1300} y={480} size={64} p={word} label="التوحيد" />
    <Seal x={1600} y={380} q={seal} kind="ثابت" s={0.55} />
  </g>
);
const StraightLine = reverent((q) => {
  const k = cueKit(q, ["بدأوا"]);
  const { t } = k;
  const line = 0.25 * k.draw(0, "نعلمه", 0.8) + 0.75 * prog(t, k.at("بدأوا") - 0.05, k.at("بدأوا") + 1.4);
  const cam = k.cam({ cx: 1400, cy: 520, s: 1.25 }, [[0, "بدأوا", NEUTRAL, 1.4]]);
  const g = <StraightLineScene line={line} seal={k.on(0, "يقينا")} word={k.draw(0, "التوحيد", 0.9)} />;
  return <Leaf q={q} id="b4sl" cam={cam} L={g} R={g} />;
});

// ─── c1-s11 / c1-s42: رأس الحديث (نص المراجعة العلمية، الدفعة ٥) ───
const HadithLead = reverent((q) => {
  const k = cueKit(q, ["قدسي", "هدي"]);
  const { S } = k;
  const name = S === 0 ? k.draw(0, "النبي", 0.9) : k.draw(1, "النبي", 0.9);
  const tab = S === 0 ? k.on(0, "قدسي", 0.6) : k.on(1, "قال", 0.6);
  const warn = k.draw(1, "ونجتنب", 0.8);
  const cam = k.cam(NEUTRAL, [[0, "النبي", { cx: 1365, cy: 420, s: 1.2 }, 1.0], [1, "ونجتنب", { cx: 1300, cy: 420, s: 1.2 }, 1.0]]);
  return (
    <Leaf q={q} id="b4hl" cam={cam}
      L={S === 0 ? <Ink d="M960 620 H160" p={1} w={6} c={C.ink} /> : null}
      R={<g>
        {S === 0 ? <Ink d="M1760 620 H960" p={1} w={6} c={C.ink} /> : null}
        <Write id="b4hl-n" x={1365} y={400} size={66} p={name} label="النبي ﷺ" />
        <Tab x={1760} y={250} q={tab} label={S === 0 ? "حديث قدسي · مسلم ٢٨٦٥" : "صحيح البخاري ٣٤٤٥"} />
        {S === 1 ? (
          <g>
            <Ink d="M1700 320 V480" p={warn} w={6} c={C.ribbon} />
            <Ink d="M1716 320 V480" p={warn} w={6} c={C.ribbon} />
          </g>
        ) : null}
      </g>} />
  );
});

// ─── c1-s13 / c1-s14: الميل والصرف (نص المراجعة العلمية، الدفعة ٥: «واجتالتهم، أي صرفتهم عن دينهم»؛ بلا سلّم خطوات) ───
const Veer = reverent((q) => {
  const k = cueKit(q, ["واجتالتهم", "ننتقل"]);
  const { t, S } = k;
  const dashes = k.open(0, 0.8);
  const lean = k.on(0, "واجتالتهم", 1.0);
  const glow = S === 0 ? bounce(t, k.at("دينهم"), k.at("دينهم") + 1.2) : 0;
  const branch = k.draw(0, "صرفتهم", 1.2);
  const leave = k.on(1, "ننتقل", 0.9);
  const people = k.draw(1, "قوم", 0.9);
  const r = rng(14);
  const ds = Array.from({ length: 34 }, () => [mix(200, 1720, r()), r() > 0.5 ? mix(260, 460, r()) : mix(580, 780, r()), r() * 60 - 30] as const);
  const cam = k.cam(NEUTRAL, [[0, "صرفتهم", { cx: 640, cy: 620, s: 1.2 }, 1.2], [1, "ننتقل", { cx: 560, cy: 560, s: 1.2 }, 1.2]]);
  const g = (
    <g>
      <path d="M1760 520 H160" stroke={C.gold} strokeWidth={18} opacity={0.35 * glow} />
      <Ink d="M1760 520 H160" p={1} w={6} c={C.ink} />
      {ds.map(([x, y, a], i) => {
        const off = i % 5 === 0 && x < 900 ? branch : 0;
        const to = y < 520 ? 1 : -1;
        const ang = mix(a + 90, 90 + 35 * to * (x > 960 ? 1 : -1) * 0.3 + 20 * to, lean);
        const yy = mix(y, y + (y < 520 ? 70 : 140), off);
        return <path key={i} d="M0 -18 V18" stroke={C.inkSoft} strokeWidth={4} strokeLinecap="round" transform={`translate(${x - 60 * off} ${yy}) rotate(${ang - 90})`} opacity={prog(dashes, i / 34, i / 34 + 0.3) * (1 - 0.4 * off)} />;
      })}
      <path d="M760 520 C640 560 520 640 300 720" fill="none" stroke={C.inkSoft} strokeWidth={4} strokeDasharray="10 10" opacity={branch * (1 - 0.7 * leave)} />
    </g>
  );
  return <Leaf q={q} id="b4vr" cam={cam} L={<g>{g}<Write id="b4vr-q" x={560} y={420} size={44} p={people} label="قوم نوح عليه السلام" /></g>} R={g} />;
});

// ─── c1-s15 / c1-s17 / c1-s18: الخانات الخمس (بعد المراجعة العلمية، الدفعة ٥ البند ١١٩: نقف عند القرآن، والأثر المختلف في إسناده لا يُروى) ───
const SLOT_X = [1660, 1510, 1365, 1220, 1070];
const FiveSlots = reverent((q) => {
  const k = cueKit(q, ["يوصي", "يتواصون", "نشأت"]);
  const { t, S } = k;
  const seal = k.on(0, "القرآن");
  const boxes = S === 0 ? prog(t, k.at("خمسة") - 0.05, k.at("خمسة") + 1.2) : 1;
  const lines = S === 0 ? k.draw(0, "أسماء", 1.0) : 1;
  const blink = S === 1 ? bounce(t, k.at("أسماء"), k.at("أسماء") + 1.0) : 0;
  const shine = S === 1 ? bounce(t, k.at("القرآن"), k.at("القرآن") + 1.0) : S === 2 ? bounce(t, k.at("القرآن"), k.at("القرآن") + 1.2) : 0;
  const label = k.on(0, "قوم");
  const qm = k.on(2, "كيف");
  const arrow = k.draw(2, "أثر", 1.0);
  const tab = k.on(2, "إسناده", 0.6);
  const halt = k.on(2, "فنقف", 0.6);
  const cam = k.cam(NEUTRAL, [[0, "خمسة", { cx: 1365, cy: 520, s: 1.25 }, 1.0], [2, "كيف", { cx: 1365, cy: 460, s: 1.2 }, 1.0], [2, "فنقف", NEUTRAL, 1.2]]);
  return (
    <Leaf q={q} id="b4fs" cam={cam}
      R={<g>
        {shine > 0 ? <circle cx={1650} cy={220} r={110} fill={C.gold} opacity={0.25 * shine} /> : null}
        <GoldSeal x={1650} y={220} q={seal} label="نوح · ٢٣" s={0.9} />
        <Txt x={1365} y={420} size={34} q={label} color={C.inkSoft}>قوم نوح</Txt>
        {SLOT_X.map((x, i) => {
          const b = prog(boxes, i / 5, (i + 1) / 5);
          return (
            <g key={i}>
              <Ink d={`M${x + 60} 470 H${x - 60} V620 H${x + 60} Z`} p={b} w={4} />
              <path d={`M${x + 40} 570 H${x - 40}`} stroke={blink > 0 ? C.gold : C.inkSoft} strokeWidth={3 + 3 * blink} opacity={prog(lines, i / 5, (i + 1) / 5)} />
            </g>
          );
        })}
        <Q x={1365} y={330} size={90} q={qm} />
        <g opacity={1 - 0.6 * halt}><Arrow d="M1365 650 C1365 740 1440 780 1560 800" p={arrow} hx={1560} hy={800} ang={8} dashed /></g>
        <path d="M1590 770 V830" stroke={C.ink} strokeWidth={6} strokeLinecap="round" opacity={halt} />
        <Tab x={1760} y={860} q={tab} label="أثر · في إسناده خلاف" color={C.inkSoft} />
      </g>} />
  );
});

// ─── c1-s35 / c1-s36: موضع العقدة ───
const KnotPlaced = reverent((q) => {
  const k = cueKit(q, ["تقع", "الطوفان"]);
  const { t, S } = k;
  const knots = k.on(0, "خيط", 0.8);
  const blink = S === 0 ? bounce(t, k.at("خيط"), k.at("خيط") + 1.2) : 0;
  const seal = k.on(1, "القرآن");
  const people = k.draw(1, "قوم", 0.8);
  const flood = k.on(1, "الطوفان", 0.8);
  const ribbon = k.on(1, "بالسنة");
  const pin = k.on(1, "بالمكان", 0.6);
  const unk = k.on(1, "نعلم#2");
  const hover = Math.sin(t * 3) * 14;
  const cam = k.cam(NEUTRAL, [
    [0, "تقع", { cx: 1100, cy: 740, s: 1.2 }, 1.2],
    [1, "القرآن", { cx: 760, cy: 700, s: 1.3 }, 1.0],
    [1, "بالسنة", NEUTRAL, 1.2],
  ]);
  const both = (
    <g>
      <Line04 k123={S === 0 ? knots : 1} labels={S === 0 ? knots : 1} k4={S === 0 ? knots : 1} glow4={blink} veer={1} />
      <path d={`M300 ${TY + 60} v-60`} stroke={C.ribbon} strokeWidth={4} strokeDasharray="6 6" opacity={0.6 * flood} />
    </g>
  );
  return (
    <Leaf q={q} id="b4kp" cam={cam}
      L={<g>{both}
        <Seal x={K4} y={TY - 90} q={seal} kind="ثابت" s={0.45} />
        <Write id="b4kp-q" x={K4} y={TY + 70} size={30} p={people} label="قوم نوح" font="tajawal" />
        <Txt x={300} y={TY - 70} size={30} q={flood} color={C.inkSoft}>الطوفان</Txt>
        <DateRibbon x={500} y={230} s={0.9} o={ribbon} />
        <Pin x={720} y={420 + hover} o={pin} />
        <Seal x={600} y={560} q={unk} kind="لا نعلم" s={0.5} />
      </g>}
      R={both} />
  );
});

// ─── c1-s39..s41: ماذا بقي؟ ───
const WhatRemains = reverent((q) => {
  const k = cueKit(q, ["العقدة", "الانحراف", "محبة"]);
  const { t, S } = k;
  const title = k.draw(0, "بقي", 0.9);
  const knot = k.on(0, "العقدة", 0.6);
  // نص المراجعة العلمية (الدفعة ٥): «أن الإنسان خُلق على الحق، وأن الانحراف يأتي بعد ذلك ممن يصرفه عنه»
  const one = k.on(1, "أولا");
  const haqq = S === 1 ? bounce(t, k.at("الحق"), k.at("الحق") + 1.0) : 0;
  const wide = k.on(1, "الانحراف", 1.0);
  const circ = k.draw(1, "يصرفه", 0.8);
  const l2 = k.draw(2, "محبة", 0.9);
  const ok = k.draw(2, "حق", 0.6);
  const mub = k.draw(2, "المبالغة", 0.8);
  const red = k.draw(2, "خطير", 0.7);
  const ang = 3 + 32 * wide;
  const cam = k.cam(NEUTRAL, [[1, "الانحراف", { cx: 1365, cy: 440, s: 1.25 }, 1.0], [2, "محبة", { cx: 1365, cy: 640, s: 1.2 }, 1.0]]);
  return (
    <Leaf q={q} id="b4wr" cam={cam}
      R={<g>
        <Write id="b4wr-t" x={1365} y={190} size={58} p={title} label="ماذا بقي؟" />
        <g transform="translate(1700 860) scale(0.8)"><circle r={14} fill="#5A1410" stroke={C.ink} strokeWidth={3} opacity={knot} /></g>
        <Txt x={1690} y={420} size={44} q={one} font="amiri">١</Txt>
        {S >= 1 ? (
          <g>
            {haqq > 0 ? <path d="M1620 440 H1100" stroke={C.gold} strokeWidth={14} opacity={0.35 * haqq} /> : null}
            <Ink d="M1620 440 H1100" p={one} w={3} c={C.inkSoft} />
            <path d={`M1620 440 L${1620 - 520 * Math.cos((ang * Math.PI) / 180)} ${440 + 520 * Math.sin((ang * Math.PI) / 180)}`} stroke={C.ink} strokeWidth={5} opacity={one} />
            <Ring x={1620} y={440} r={70} p={circ} c={C.ribbon} />
          </g>
        ) : null}
        <Txt x={1690} y={640} size={44} q={l2} font="amiri">٢</Txt>
        <Write id="b4wr-2" x={1420} y={640} size={42} p={l2} label="محبة الصالحين" font="tajawal" />
        <Ink d="M1210 620 L1226 640 L1256 604" p={ok} w={6} c={GOLD_D} />
        <Write id="b4wr-3" x={1440} y={740} size={42} p={mub} label="المبالغة" font="tajawal" color={EMBER} />
        <Ink d="M1530 760 H1350" p={red} w={4} c={C.ribbon} />
      </g>} />
  );
});

// ─── c1-s45 / c1-s46: الخيط يستقيم ───
const ThreadForward = reverent((q) => {
  const k = cueKit(q, ["الضلال", "أرسل"]);
  const { t, S } = k;
  const straight = S === 0 ? k.draw(0, "يترك", 1.4) : 1;
  const behind = k.on(0, "الضلال", 0.8);
  const light = k.on(1, "أرسل", 0.7);
  const name = k.on(1, "رسول", 0.7);
  const wide = k.draw(1, "أهل", 1.2);
  const glow = S === 1 ? bounce(t, k.at("آباؤهم"), k.at("آباؤهم") + 1.4) : 0;
  const one = k.draw(1, "وحده", 1.0);
  const cam = k.cam({ cx: 760, cy: 740, s: 1.3 }, [[1, "أرسل", { cx: 560, cy: 740, s: 1.2 }, 1.0], [1, "أهل", NEUTRAL, 1.4]]);
  const both = (
    <g>
      <Horizon y={HZ_Y} p={S === 1 ? Math.max(0.3, wide) : 0.3} sky="noon" texture={0.3} />
      <Line04 k4={1} veer={1} straight={straight * (S === 0 ? 1 : 1)} glow123={glow} light={light} lightLabel={name} />
      {behind > 0 && S === 0 ? <circle cx={K4 - 200} cy={TY + 24} r={34} fill="none" stroke={C.inkSoft} strokeWidth={2} strokeDasharray="6 6" opacity={behind} /> : null}
      <Ink d={`M1760 ${TY - 3} H${NOAH}`} p={one} w={3} c={C.gold} />
    </g>
  );
  return <Leaf q={q} id="b4tf" cam={cam} L={both} R={both} />;
});

// ─── c1-s47: خانة المدة عند نقطة الضوء (دمج الحلقتين ٢٧ نوفمبر: حُذف c1-s48 «هذا ما نعقده…» بعقدته الخامسة وشريط عنوانه؛ يعقدها الجزء الثاني في bd05-thread-knot) ───
const NextKnot = reverent((q) => {
  const k = cueKit(q, ["لبث"]);
  const box = k.draw(0, "لبث", 0.8);
  const calls = k.draw(0, "يدعوهم", 1.0);
  const qm = k.on(0, "ردوا");
  const cam = k.cam({ cx: 520, cy: 640, s: 1.3 }, []);
  const both = (
    <g>
      <Horizon y={HZ_Y} p={1} sky="noon" texture={0.3} />
      <Line04 k4={1} veer={1} straight={1} light={1} lightLabel={1} />
    </g>
  );
  return (
    <Leaf q={q} id="b4nk" cam={cam} R={both}
      L={<g>{both}
        <Ink d={`M${NOAH + 70} ${TY - 170} H${NOAH - 70} V${TY - 100} H${NOAH + 70} Z`} p={box} w={4} />
        <Txt x={NOAH} y={TY - 125} size={26} q={box} color={C.inkSoft}>المدة: —</Txt>
        {[-50, -20, 20, 50].map((a, i) => (
          <path key={i} d={`M${NOAH} ${TY - 20} L${NOAH + Math.sin((a * Math.PI) / 180) * 220} ${HZ_Y + 10}`} stroke={C.gold} strokeWidth={3} strokeDasharray="6 8" opacity={prog(calls, i / 4, i / 4 + 0.4)} />
        ))}
        <Q x={NOAH} y={TY - 190} size={70} q={qm} />
      </g>} />
  );
});

void Field; void Sheet; void Scribble; void Qalam;

export const BD04_SCENES: Record<string, React.FC<BdProps>> = {
  "bd04-shadow-dial": ShadowDial,
  "bd04-thread-noon": ThreadNoon,
  "bd04-dark-knot": DarkKnot,
  "bd04-between": Between,
  "bd04-ten-centuries": TenCenturies,
  "bd04-world-unlit": WorldUnlit,
  "bd04-straight-line": StraightLine,
  "bd04-hadith-lead": HadithLead,
  "bd04-veer": Veer,
  "bd04-five-slots": FiveSlots,
  "bd04-knot-placed": KnotPlaced,
  "bd04-what-remains": WhatRemains,
  "bd04-thread-forward": ThreadForward,
  "bd04-next-knot": NextKnot,
};

/** مشهد الصورة الثابتة للمراجعة لكل لقطة (المعرّف في الخطة)؛ الغائب = آخر مشهد يستعمل اللقطة، عند نهاية آخر كلمة */
export const BD04_STILLS: Record<string, string> = {
};
