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
  Arrow, BlankLine, C, DotFrame, Dot, EMBER, Field, GOLD_D, Globe, GoldSeal, Horizon, Ink, Leaf, NEUTRAL, Q, Ring, Scribble, Seal,
  Sheet, Slip, Sun, Tab, Thread, Txt, Write, bounce, cueKit, mix, prog, reverent, rng, type BdProps, type KnotDef,
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

const STELAE_X = [1640, 1500, 1365, 1230, 1090];
const SEAT = (i: number): [number, number] => {
  const a = ((200 + i * 35) * Math.PI) / 180;
  return [1365 + 260 * Math.cos(a), 470 - 170 * Math.sin(a)];
};

/** كتاب صغير مفتوح بسطور حبر (lines) أو مغلق (close) */
const SmallBook: React.FC<{ x: number; y: number; q: number; lines?: number; close?: number; dust?: number; s?: number }> = ({ x, y, q, lines = 0, close = 0, dust = 0, s = 1 }) => {
  if (q <= 0) return null;
  const k = 1 - close;
  return (
    <g opacity={Math.min(1, q * 1.4)} transform={`translate(${x} ${y}) scale(${s * (0.8 + 0.2 * q)})`}>
      <path d={`M0 -10 C${-60 * k} -30 ${-150 * k} -30 ${-150 * k - 4} -14 V100 C${-150 * k} 86 ${-60 * k} 86 0 104 Z`} fill={C.page} stroke={C.ink} strokeWidth={4} />
      <path d="M0 -10 C60 -30 150 -30 154 -14 V100 C150 86 60 86 0 104 Z" fill={close > 0.95 ? "#6B4A2E" : C.page} stroke={C.ink} strokeWidth={4} />
      {close < 0.5
        ? [0, 1, 2, 3].map((i) => (
            <g key={i}>
              <Ink d={`M130 ${10 + i * 20} H24`} p={prog(lines, i / 4, (i + 1) / 4)} w={2.5} c={C.inkSoft} />
              <Ink d={`M-24 ${10 + i * 20} H-130`} p={prog(lines, i / 4, (i + 1) / 4)} w={2.5} c={C.inkSoft} />
            </g>
          ))
        : null}
      <path d="M0 -10 V104" stroke={C.ink} strokeWidth={3} />
      {dust > 0 ? <Hatch x={0} y={-20} w={160} h={124} o={dust * 2.4} /> : null}
    </g>
  );
};

/** سلّم الخطوات الثلاث على الصفحة اليسرى (درجات نازلة بخانات) */
const STEP = (i: number) => ({ x: 720 - i * 200, y: 380 + i * 150 });
const Stairs: React.FC<{ p: number; fill?: number[]; nums?: number; small?: boolean }> = ({ p, fill = [0, 0, 0], nums = 0 }) => (
  <g>
    {[0, 1, 2].map((i) => {
      const { x, y } = STEP(i);
      const q = prog(p, i / 3, (i + 1) / 3);
      return (
        <g key={i}>
          <Ink d={`M${x + 110} ${y} H${x - 110} V${y + 150}`} p={q} w={5} />
          <rect x={x - 100} y={y - 70} width={200} height={62} rx={6} fill={i === 2 ? "#4A2E1F" : C.ink} opacity={0.12 * (fill[i] ?? 0) * (i === 2 ? 2 : 1)} stroke={C.inkSoft} strokeWidth={2} strokeDasharray="8 6" strokeOpacity={q} />
          <Txt x={x + 130} y={y - 20} size={34} q={nums} font="amiri" color={C.ink}>{["١", "٢", "٣"][i]}</Txt>
        </g>
      );
    })}
  </g>
);

// ─── c1-s1: حجر الظهيرة ───
const NoonStone = reverent((q) => {
  const k = cueKit(q, ["حجرا"]);
  const { t } = k;
  const line = prog(t, 0.05, k.end("يعبد"));
  const sun = prog(t, 0.05, 0.7);
  const stone = k.on(0, "حجرا", 0.6);
  const cam = k.cam(NEUTRAL, [[0, "حجرا", { cx: 600, cy: 560, s: 1.3 }, 1.2]]);
  const both = <Horizon y={HZ_Y} p={line} sky="noon" texture={0.5} />;
  return (
    <Leaf q={q} id="b4ns" cam={cam} R={both}
      L={<g>{both}<Sun x={360} y={220} r={36} q={sun} c={C.sand} />
        <Stele x={600} y={HZ_Y + 20} q={stone} h={120} w={90} len={0.35} />
      </g>} />
  );
});

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
  const k = cueKit(q, ["مختلفة"]);
  const { t } = k;
  const knot = k.on(0, "نعقد", 0.7);
  const w1 = bounce(t, k.at("اكتشاف"), k.at("اكتشاف") + 1.4);
  const w2 = bounce(t, k.at("بناء"), k.at("بناء") + 1.4);
  const veer = k.draw(0, "انحراف", 1.2);
  const cam = k.cam({ cx: 1100, cy: 720, s: 1.2 }, [[0, "نعقد", { cx: 820, cy: 720, s: 1.4 }, 1.1], [0, "انحراف", { cx: 640, cy: 740, s: 1.15 }, 1.2]]);
  const both = (
    <g>
      <Horizon y={HZ_Y} p={1} sky="noon" texture={0.4} />
      <Line04 k4={knot} veer={veer} />
    </g>
  );
  return (
    <Leaf q={q} id="b4dk" cam={cam} R={both}
      L={<g>{both}
        <Txt x={760} y={680} size={40} q={w1} color={C.inkSoft}>اكتشاف</Txt>
        <Txt x={560} y={680} size={40} q={w2} color={C.inkSoft}>بناء</Txt>
      </g>} />
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
        <Tab x={1740} y={130} q={tab} label="رواية · ابن عباس" />
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
  return <BetweenScene q={q} id="b4tc" adam={1} noah={1} arc={1} ribbon={0} unk={0} tab={k.on(0, "وروي")} ten={ten} ruler={k.draw(0, "الحق", 1.0)} cam={cam} />;
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

// ─── c1-s9: ثلاثة عدّادات ───
const Counter = reverent((q) => {
  const k = cueKit(q, ["عداد"]);
  const box = k.draw(0, "عداد", 0.9);
  const under = k.draw(0, "صادقا", 0.8);
  const past = k.on(0, "الحلقتين", 0.7);
  const seal = k.on(0, "نعلم");
  const cam = k.cam(NEUTRAL, [[0, "عداد", { cx: 1365, cy: 420, s: 1.25 }, 1.0], [0, "الحلقتين", { cx: 1365, cy: 560, s: 1.1 }, 1.0]]);
  return (
    <Leaf q={q} id="b4ct" cam={cam}
      R={<g>
        <Ink d="M1165 330 H1565 V480 H1165 Z" p={box} w={5} />
        <Txt x={1365} y={380} size={32} q={box} color={C.inkSoft}>عدّاد الحلقة ٠٠٤</Txt>
        <Ink d="M1180 500 H1550" p={under} w={4} c={C.gold} />
        <Seal x={1365} y={440} q={seal} kind="لا نعلم" s={0.5} />
        {[[1250, "٠٠٢"], [1480, "٠٠٣"]].map(([x, n], i) => (
          <g key={i} opacity={prog(past, i * 0.3, i * 0.3 + 0.7)}>
            <rect x={(x as number) - 100} y={600} width={200} height={110} rx={8} fill="none" stroke={C.inkSoft} strokeWidth={3} />
            <Txt x={x as number} y={636} size={26} q={1} color={C.inkSoft}>{`الحلقة ${n}`}</Txt>
            <Seal x={x as number} y={680} q={1} kind="لا نعلم" s={0.35} />
          </g>
        ))}
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

// ─── c1-s11 / c1-s42: رأس الحديث ───
const HadithLead = reverent((q) => {
  const k = cueKit(q, ["يرويه", "حذر"]);
  const { S } = k;
  const name = S === 0 ? k.draw(0, "النبي", 0.9) : k.draw(1, "النبي", 0.9);
  const tab = S === 0 ? k.on(0, "يرويه", 0.6) : k.on(1, "أمته", 0.6);
  const warn = k.draw(1, "حذر", 0.8);
  const cam = k.cam(NEUTRAL, [[0, "النبي", { cx: 1365, cy: 420, s: 1.2 }, 1.0], [1, "حذر", { cx: 1300, cy: 420, s: 1.2 }, 1.0]]);
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

// ─── c1-s13: الميل والصرف ───
const Veer = reverent((q) => {
  const k = cueKit(q, ["مائلين"]);
  const { t } = k;
  const dashes = k.on(0, "خلقوا", 0.8);
  const lean = k.on(0, "مائلين", 1.0);
  const glow = bounce(t, k.at("الحق"), k.at("الحق") + 1.2);
  const branch = k.draw(0, "يصرفهم", 1.2);
  const r = rng(14);
  const ds = Array.from({ length: 34 }, () => [mix(200, 1720, r()), r() > 0.5 ? mix(260, 460, r()) : mix(580, 780, r()), r() * 60 - 30] as const);
  const cam = k.cam(NEUTRAL, [[0, "يصرفهم", { cx: 640, cy: 620, s: 1.2 }, 1.2]]);
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
      <path d="M760 520 C640 560 520 640 300 720" fill="none" stroke={C.inkSoft} strokeWidth={4} strokeDasharray="10 10" opacity={branch} />
    </g>
  );
  return <Leaf q={q} id="b4vr" cam={cam} L={g} R={g} />;
});

// ─── c1-s14 / c1-s21 / c1-s33: سلّم الخطوات الثلاث ───
const ThreeSteps = reverent((q) => {
  const k = cueKit(q, ["صرفهم", "تأمل", "محبة"]);
  const { S } = k;
  const branch = S === 0 ? 1 : 0;
  const stairs = S === 0 ? k.draw(0, "الخطوة", 1.4) : 1;
  const ring1 = k.draw(0, "الأولى", 0.8) * (S === 0 ? 1 : 0);
  const nums = k.on(1, "الخطوات", 0.8);
  const tab = k.on(1, "رواها") * (S === 1 ? 1 : 0);
  const w = [k.draw(2, "محبة", 0.8), k.draw(2, "مبالغة", 0.8), k.draw(2, "نسيانا", 0.8)];
  const cam = k.cam(NEUTRAL, [
    [0, "الخطوة", { cx: 560, cy: 540, s: 1.15 }, 1.2],
    [1, "تأمل", { cx: 540, cy: 540, s: 1.25 }, 1.2],
    [2, "يقل", { cx: 720, cy: 360, s: 1.4 }, 1.2],
    [2, "مبالغة", { cx: 540, cy: 540, s: 1.15 }, 1.2],
  ]);
  return (
    <Leaf q={q} id="b4st" cam={cam}
      L={<g>
        <Stairs p={stairs} fill={S === 2 ? w : [0, 0, 0]} nums={nums} />
        <Ring x={STEP(0).x} y={STEP(0).y - 40} r={120} p={ring1} c={C.ribbon} />
        {S === 2 ? (["محبة", "مبالغة", "نسيان"] as const).map((lab, i) => (
          <Write key={i} id={`b4st-${i}`} x={STEP(i).x} y={STEP(i).y - 26} size={40} p={w[i]!} label={lab} font="tajawal" color={i === 2 ? "#2B1408" : C.ink} />
        )) : null}
        <Tab x={940} y={300} q={tab} label="ابن عباس" />
      </g>}
      R={<path d="M1760 520 H960" stroke={C.ink} strokeWidth={6} opacity={branch} />} />
  );
});

// ─── c1-s15 / c1-s17: الخانات الخمس ───
const SLOT_X = [1660, 1510, 1365, 1220, 1070];
const FiveSlots = reverent((q) => {
  const k = cueKit(q, ["يوصي", "جاءت"]);
  const { t, S } = k;
  const seal = k.on(0, "القرآن");
  const boxes = S === 0 ? prog(t, k.at("خمسة") - 0.05, k.at("خمسة") + 1.2) : 1;
  const lines = S === 0 ? k.draw(0, "أسماء", 1.0) : 1;
  const blink = S === 1 ? bounce(t, k.at("أسماء"), k.at("أسماء") + 1.0) : 0;
  const label = k.on(0, "قوم");
  const qm = k.on(1, "أين");
  const arrow = k.draw(1, "جاءت", 1.0);
  const cam = k.cam(NEUTRAL, [[0, "خمسة", { cx: 1365, cy: 520, s: 1.25 }, 1.0], [1, "أين", { cx: 1365, cy: 460, s: 1.2 }, 1.0]]);
  return (
    <Leaf q={q} id="b4fs" cam={cam}
      R={<g>
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
        <Q x={1365} y={430} size={90} q={qm} />
        <Arrow d="M1365 650 C1365 760 1500 800 1720 820" p={arrow} hx={1720} hy={820} ang={8} dashed />
      </g>} />
  );
});

// ─── c1-s22 / c1-s23: المجلس الخالي ───
const Majlis = reverent((q) => {
  const k = cueKit(q, ["صالحون", "ماتوا"]);
  const { t, S } = k;
  const step1 = k.on(0, "الأولى", 0.6);
  const seats = S === 0 ? prog(t, k.at("رجال") - 0.05, k.end("صالحون") + 0.6) : 1;
  const warm = S === 0 ? prog(t, k.at("أحبهم") - 0.05, k.end("لصلاحهم") + 0.3) : 1;
  const die = S === 1 ? prog(t, k.at("ماتوا") - 0.05, k.at("ماتوا") + 1.4) : 0;
  const cold = k.on(1, "فحزن", 1.2);
  const cam = k.cam(NEUTRAL, [[0, "رجال", { cx: 1365, cy: 470, s: 1.2 }, 1.2], [1, "فحزن", { cx: 1200, cy: 500, s: 1.05 }, 1.4]]);
  return (
    <Leaf q={q} id="b4mj" cam={cam} tintL={cold > 0 ? `rgba(90,110,130,${0.12 * cold})` : undefined}
      L={<g transform="translate(300 160) scale(0.45) translate(-300 -160)" opacity={0.9}><Stairs p={1} fill={[step1, 0, 0]} /></g>}
      R={<g>
        {cold > 0 ? <rect x={960} y={60} width={820} height={900} fill="rgba(90,110,130,1)" opacity={0.12 * cold} /> : null}
        {[0, 1, 2, 3, 4].map((i) => {
          const [x, y] = SEAT(i);
          const w = warm * (1 - prog(die, i / 5, (i + 1) / 5));
          return (
            <g key={i} opacity={prog(seats, i / 5, (i + 1) / 5)}>
              <ellipse cx={x} cy={y} rx={78} ry={56} fill={C.ember} opacity={0.3 * w} />
              <path d={`M${x + 26 + 30 * cold} ${y + 14} L${x + 70 + 80 * cold} ${y + 30}`} stroke="#2B1E14" strokeWidth={16} strokeLinecap="round" opacity={0.18 + 0.1 * cold} />
              <rect x={x - 46} y={y - 26} width={92} height={52} rx={14} fill={STELE} stroke={C.ink} strokeWidth={4} />
            </g>
          );
        })}
      </g>} />
  );
});

// ─── c1-s24 / c1-s25: الأنصاب الخمسة الصمّاء ───
const STELE_Y = 640;
const FiveStelae = reverent((q) => {
  const k = cueKit(q, ["فكرة", "ففعلوا"]);
  const { t, S } = k;
  const step2 = k.on(0, "الثانية", 0.6);
  const sketch = S === 0 ? k.draw(0, "فكرة", 1.0) * (1 - k.on(0, "علامات", 0.8)) : 0;
  const rise = S === 0 ? prog(t, k.at("علامات") - 0.05, k.at("علامات") + 1.6) : 1;
  const cards = k.on(0, "وسموها", 0.7);
  const memo = k.draw(0, "لتتذكروهم", 1.0);
  const settle = S === 1 ? k.on(1, "ففعلوا", 1.0) : S > 1 ? 1 : 0.4;
  const clear = k.draw(1, "يعبدها", 0.9);
  const cam = k.cam(NEUTRAL, [[0, "علامات", { cx: 1365, cy: 560, s: 1.2 }, 1.2], [1, "يعبدها", { cx: 1365, cy: 640, s: 1.25 }, 1.0]]);
  return (
    <Leaf q={q} id="b4fst" cam={cam}
      L={<g transform="translate(300 160) scale(0.45) translate(-300 -160)" opacity={0.9}><Stairs p={1} fill={[1, step2, 0]} /></g>}
      R={<g>
        <Horizon y={STELE_Y} p={1} sky="noon" texture={0} />
        {STELAE_X.map((x, i) => (
          <g key={i}>
            <path d={`M${x - 40} ${STELE_Y - 10} C${x - 30} ${STELE_Y - 60} ${x + 30} ${STELE_Y - 60} ${x + 40} ${STELE_Y - 10}`} fill="none" stroke={C.inkSoft} strokeWidth={2} opacity={0.6 * sketch} />
            <Stele x={x} y={STELE_Y} q={prog(rise, i / 5, (i + 1) / 5)} len={i === 4 ? settle : 1} />
            <Card id={`b4fst-c${i}`} x={x} y={STELE_Y + 70} q={cards} memo={memo} />
            <path d={`M${x - 46} ${STELE_Y + 104} H${x + 46}`} stroke={C.ink} strokeWidth={3} opacity={clear} />
          </g>
        ))}
      </g>} />
  );
});

// ─── c1-s26: الكتاب المفتوح والممر ───
const PATH = "M1760 820 C1600 800 1500 760 1365 760 C1220 760 1120 800 980 830";
const OpenBookPath = reverent((q) => {
  const k = cueKit(q, ["يمر"]);
  const { t } = k;
  const book = k.on(0, "جيل", 0.7);
  const lines = k.draw(0, "يعرف", 1.0);
  const path = prog(t, k.at("يمر") - 0.05, k.end("يسجد") + 0.6);
  const memo = 0.7 + 0.3 * k.on(0, "ويتذكر", 0.6);
  const cam = k.cam(NEUTRAL, [[0, "جيل", { cx: 1000, cy: 520, s: 1.15 }, 1.0], [0, "يمر", { cx: 1365, cy: 680, s: 1.15 }, 1.4]]);
  return (
    <Leaf q={q} id="b4ob" cam={cam}
      L={<g>
        <SmallBook x={640} y={460} q={book} lines={lines} s={1.3} />
        <path d="M960 830 C860 840 760 850 640 850" fill="none" stroke={C.inkSoft} strokeWidth={4} strokeDasharray="10 12" opacity={prog(path, 0.8, 1)} />
      </g>}
      R={<g>
        <Horizon y={STELE_Y} p={1} sky="noon" texture={0} />
        {STELAE_X.map((x, i) => (
          <g key={i}>
            <Stele x={x} y={STELE_Y} q={1} />
            <Card id={`b4ob-c${i}`} x={x} y={STELE_Y + 70} q={1} memo={1} dim={memo} />
          </g>
        ))}
        <clipPath id="b4ob-clip"><rect x={1780 - 820 * path} y={700} width={820 * path} height={200} /></clipPath>
        <path d={PATH} fill="none" stroke={C.inkSoft} strokeWidth={4} strokeDasharray="10 12" clipPath="url(#b4ob-clip)" opacity={path > 0 ? 1 : 0} />
      </g>} />
  );
});

// ─── c1-s27: الكتاب يُغلق ───
const ClosedBook = reverent((q) => {
  const k = cueKit(q, ["الأخطر"]);
  const step3 = k.on(0, "الثالثة", 0.6);
  const red = k.draw(0, "الأخطر", 0.8);
  const gone = k.on(0, "مات", 1.2);
  const close = k.on(0, "ونسي", 0.8);
  const dust = k.on(0, "العلم", 1.0);
  const cam = k.cam(NEUTRAL, [[0, "ونسي", { cx: 700, cy: 500, s: 1.25 }, 1.0]]);
  return (
    <Leaf q={q} id="b4cb" cam={cam} tintL={gone > 0 ? `rgba(224,122,63,${0.1 * gone})` : undefined}
      L={<g>
        <g transform="translate(300 160) scale(0.45) translate(-300 -160)"><Stairs p={1} fill={[1, 1, step3]} /></g>
        <Ink d={`M${STEP(2).x * 0.45 + 165 + 50} ${(STEP(2).y + 10) * 0.45 + 88} h-110`} p={red} w={3} c={C.ribbon} />
        <SmallBook x={640} y={460} q={1} lines={1} close={close} dust={dust} s={1.3} />
      </g>}
      R={<g>
        {gone > 0 ? <rect x={960} y={60} width={820} height={900} fill={C.ember} opacity={0.08 * gone} /> : null}
        <Horizon y={STELE_Y} p={1} sky="dusk" texture={0} skyO={gone} />
        {STELAE_X.map((x, i) => (
          <g key={i}>
            <Stele x={x} y={STELE_Y} q={1} len={1 + gone} />
            <Card id={`b4cb-c${i}`} x={x} y={STELE_Y + 70} q={1} memo={1} />
          </g>
        ))}
        <path d={PATH} fill="none" stroke={C.inkSoft} strokeWidth={4} strokeDasharray="10 12" opacity={1 - gone} />
      </g>} />
  );
});

// ─── c1-s28 / c1-s29: الذكرى تُمحى ───
const SteleErode = reverent((q) => {
  const k = cueKit(q, ["أبناء", "عبدت"]);
  const { t, S } = k;
  const path = k.draw(0, "أبناء", 1.2);
  const erase = S === 0 ? prog(t, k.at("يعرفون") - 0.05, k.at("يعرفون") + 1.4) : 1;
  const qm = k.on(0, "لماذا", 0.6);
  const deep = k.on(0, "الحجارة", 0.8);
  const longer = k.on(1, "ثم", 1.0);
  const wash = k.on(1, "عبدت", 1.2);
  const cam = k.cam(NEUTRAL, [[0, "يعرفون", { cx: 1365, cy: 680, s: 1.3 }, 1.0], [0, "الحجارة", { cx: 1365, cy: 560, s: 1.2 }, 1.2]]);
  return (
    <Leaf q={q} id="b4se" cam={cam} tintL={`rgba(224,122,63,0.08)`}
      R={<g>
        <rect x={960} y={60} width={820} height={900} fill={C.ember} opacity={0.08} />
        <Horizon y={STELE_Y} p={1} sky="dusk" texture={0} />
        <ellipse cx={1365} cy={STELE_Y - 60} rx={420} ry={200} fill="#4A4448" opacity={0.3 * wash} />
        {STELAE_X.map((x, i) => (
          <g key={i}>
            <Stele x={x} y={STELE_Y} q={1} len={2 + 0.4 * deep + 1.2 * longer} fill={mix(0, 1, deep) > 0.5 ? "#9C9488" : STELE} />
            <Card id={`b4se-c${i}`} x={x} y={STELE_Y + 70} q={1} memo={1 - prog(erase, i * 0.1, i * 0.1 + 0.6)} qm={qm} />
          </g>
        ))}
        <path d="M1760 860 C1600 840 1500 800 1365 800" fill="none" stroke={C.inkSoft} strokeWidth={4} strokeDasharray="10 12" opacity={path} />
      </g>} />
  );
});

// ─── c1-s30: الهيئة المجهولة ───
const UnknownForm = reverent((q) => {
  const k = cueKit(q, ["منصوبة"]);
  const stele = k.on(0, "حجارة", 0.7);
  const frame = k.draw(0, "شكلها", 0.8);
  const tab = k.on(0, "والرواية");
  const seal = k.on(0, "تصف");
  const cam = k.cam(NEUTRAL, [[0, "حجارة", { cx: 1365, cy: 520, s: 1.2 }, 1.0]]);
  return (
    <Leaf q={q} id="b4uf" cam={cam}
      R={<g>
        <Stele x={1520} y={640} q={stele} h={220} w={80} />
        <DotFrame x={1520} y={520} w={170} h={290} q={stele} />
        <DotFrame x={1220} y={520} w={220} h={290} q={frame} c={C.ink} />
        <Seal x={1220} y={520} q={seal} kind="لا نعلم" s={0.5} />
        <Tab x={1740} y={200} q={tab} label="رواية" />
      </g>} />
  );
});

// ─── c1-s34 / c1-s44: العلم الحارس ───
const KnowledgeGuard = reverent((q) => {
  const k = cueKit(q, ["تتكرر", "حارس"]);
  const { t, S } = k;
  const word = S === 0 ? k.draw(0, "العلم", 0.9) : 1;
  const right = k.on(0, "بقي", 0.7);
  const clear = k.draw(0, "تعبد", 0.8);
  const left = k.on(0, "نسي", 0.7);
  const dark = k.on(0, "عبدت", 1.0);
  const reopen = k.on(1, "العلم", 0.9);
  const guard = k.draw(1, "حارس", 0.9);
  const fadeR = S === 1 ? prog(t, k.at("ينسى") - 0.05, k.at("ينسى") + 1.0) : 0;
  const qm = k.on(1, "معناه", 0.6);
  const cam = k.cam(NEUTRAL, [
    [0, "بقي", { cx: 1365, cy: 560, s: 1.15 }, 1.0],
    [0, "نسي", { cx: 560, cy: 560, s: 1.15 }, 1.0],
    [1, "حارس", { cx: 560, cy: 560, s: 1.15 }, 1.0],
    [1, "ينسى", { cx: 1365, cy: 600, s: 1.15 }, 1.0],
  ]);
  return (
    <Leaf q={q} id="b4kg" cam={cam}
      L={<g>
        <rect x={150} y={300} width={810} height={600} fill="#3A3438" opacity={0.18 * dark * (1 - 0.6 * reopen)} />
        <SmallBook x={400} y={600} q={left} lines={1} close={1 - reopen} dust={left * (1 - reopen) * 0.8} />
        <Stele x={680} y={720} q={left} />
        <Card id="b4kg-l" x={680} y={790} q={left} memo={0} />
        <Ring x={420} y={640} r={130} p={guard} c={GOLD_D} />
        <Txt x={420} y={820} size={34} q={guard} color={GOLD_D}>حارس</Txt>
      </g>}
      R={<g>
        <Write id="b4kg-w" x={1365} y={240} size={90} p={word} label="العلم" />
        <SmallBook x={1200} y={600} q={right} lines={1} />
        <Stele x={1520} y={720} q={right} />
        <Card id="b4kg-r" x={1520} y={790} q={right} memo={1 - fadeR} qm={qm} />
        <path d="M1460 826 H1580" stroke={C.ink} strokeWidth={3} opacity={clear * (1 - fadeR)} />
      </g>} />
  );
});

// ─── c1-s35 / c1-s36: موضع العقدة ───
const KnotPlaced = reverent((q) => {
  const k = cueKit(q, ["نضع", "الطوفان"]);
  const { t, S } = k;
  const knots = k.on(0, "خيط", 0.8);
  const blink = S === 0 ? bounce(t, k.at("خيط"), k.at("خيط") + 1.2) : 0;
  const seal = k.on(1, "القرآن");
  const people = k.draw(1, "قوم", 0.8);
  const flood = k.on(1, "الطوفان", 0.8);
  const tab = k.on(1, "رواية");
  const ribbon = k.on(1, "بالسنة");
  const pin = k.on(1, "بالمكان", 0.6);
  const unk = k.on(1, "نعلم#2");
  const hover = Math.sin(t * 3) * 14;
  const cam = k.cam(NEUTRAL, [
    [0, "نضع", { cx: 1100, cy: 740, s: 1.2 }, 1.2],
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
      R={<g>{both}<Tab x={1740} y={200} q={tab} label="رواية · ابن عباس" /></g>} />
  );
});

// ─── c1-s37 / c1-s38: السهم البعيد ───
const FarArrow = reverent((q) => {
  const k = cueKit(q, ["انتقلت", "جزيرة"]);
  const { t, S } = k;
  const tab = k.on(0, "ابن");
  const arrow = k.draw(0, "انتقلت", 1.3);
  const far = k.on(0, "قبائل", 0.7);
  const long = k.draw(0, "طويل", 1.2);
  const mark = k.on(1, "باب", 0.9);
  const settle = k.on(1, "موضعه", 0.8);
  const name = k.draw(1, "جزيرة", 1.0);
  const cam = k.cam(NEUTRAL, [
    [0, "قبائل", { cx: 420, cy: 700, s: 1.3 }, 1.4],
    [1, "باب", { cx: 400, cy: 640, s: 1.3 }, 1.0],
    [1, "الإسلام", { cx: 760, cy: 720, s: 1.2 }, 1.2],
  ]);
  void t;
  const both = (
    <g>
      <Line04 k4={1} veer={1} />
      <path d={`M${K4 - 40} ${TY - 40} C600 ${TY - 120} 400 ${TY - 120} 240 ${TY - 60}`} fill="none" stroke={C.inkSoft} strokeWidth={4} strokeDasharray="10 10" opacity={arrow} />
      <path d={`M240 ${TY - 60} l20 -14 l-2 20 z`} fill={C.inkSoft} opacity={prog(arrow, 0.9, 1)} />
    </g>
  );
  return (
    <Leaf q={q} id="b4fa" cam={cam}
      L={<g>{both}
        <Dot x={240} y={TY - 60} q={far} r={12} />
        <path d={`M${K4} ${TY + 100} C600 ${TY + 90} 400 ${TY + 96} 220 ${TY + 92}`} fill="none" stroke={C.ribbon} strokeWidth={3} strokeDasharray="4 8" opacity={long} />
        <g opacity={mark} transform={`translate(240 ${mix(150, 260, settle)})`}>
          <path d="M-22 -120 H22 V140 L0 118 L-22 140 Z" fill={C.ribbon} stroke={C.ink} strokeWidth={2} />
        </g>
        <Write id="b4fa-n" x={360} y={TY - 130} size={30} p={name} label="جزيرة العرب قبل الإسلام" font="tajawal" />
      </g>}
      R={<g>{both}<Tab x={1740} y={200} q={tab} label="رواية · ابن عباس" /></g>} />
  );
});

// ─── c1-s39..s41: ماذا بقي؟ ───
const WhatRemains = reverent((q) => {
  const k = cueKit(q, ["العقدة", "الانحراف", "محبة"]);
  const { t, S } = k;
  const title = k.draw(0, "بقي", 0.9);
  const knot = k.on(0, "العقدة", 0.6);
  const one = k.on(1, "أولا");
  const wide = S === 1 ? bounce(t, k.at("الانحراف"), k.at("خطوة") + 0.4) : 0;
  const small = k.on(1, "خطوة", 0.8);
  const circ = k.draw(1, "بريئة", 0.8);
  const l2 = k.draw(2, "محبة", 0.9);
  const ok = k.draw(2, "حق", 0.6);
  const mub = k.draw(2, "المبالغة", 0.8);
  const red = k.draw(2, "خطير", 0.7);
  const ang = 3 + 32 * wide * (1 - small) + (S === 1 && small < 1 ? 0 : 0);
  const cam = k.cam(NEUTRAL, [[1, "الانحراف", { cx: 1365, cy: 440, s: 1.25 }, 1.0], [2, "محبة", { cx: 1365, cy: 640, s: 1.2 }, 1.0]]);
  return (
    <Leaf q={q} id="b4wr" cam={cam}
      R={<g>
        <Write id="b4wr-t" x={1365} y={190} size={58} p={title} label="ماذا بقي؟" />
        <g transform="translate(1700 860) scale(0.8)"><circle r={14} fill="#5A1410" stroke={C.ink} strokeWidth={3} opacity={knot} /></g>
        <Txt x={1690} y={420} size={44} q={one} font="amiri">١</Txt>
        {S >= 1 ? (
          <g>
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

// ─── c1-s47 / c1-s48: العقدة الخامسة ───
const NextKnot = reverent((q) => {
  const k = cueKit(q, ["لبث", "نعقده"]);
  const { S } = k;
  const box = k.draw(0, "لبث", 0.8);
  const calls = k.draw(0, "يدعوهم", 1.0);
  const qm = k.on(0, "ردوا");
  const ring = k.on(1, "نعقده", 0.8);
  const ribbon = k.on(1, "القادمة", 0.7);
  const t1 = k.on(1, "نوح", 0.6);
  const t2 = k.on(1, "ألف", 0.6);
  const cam = k.cam({ cx: 520, cy: 640, s: 1.3 }, [[1, "نعقده", { cx: 480, cy: 620, s: 1.25 }, 1.0]]);
  void S;
  const both = (
    <g>
      <Horizon y={HZ_Y} p={1} sky="noon" texture={0.3} />
      <Line04 k4={1} veer={1} straight={1} light={1} lightLabel={1} ring5={ring} tie5={0.5 * ring} />
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
        <DateRibbon x={620} y={180} s={0.9} o={ribbon} />
        <Txt x={620} y={450} size={30} q={t1} color={C.ink}>نوح عليه السلام:</Txt>
        <Txt x={620} y={500} size={30} q={t2} color={C.ink}>ألف سنة إلا خمسين عامًا</Txt>
      </g>} />
  );
});

// ─── c1-s49: ورقة السؤال ───
const ClosingSlip = reverent((q) => {
  const k = cueKit(q, ["العادة"]);
  const slip = k.on(0, "العادة", 0.7);
  const fade = k.on(0, "نسيته", 1.0);
  const alone = k.on(0, "بقيت", 0.8);
  const pen = k.on(0, "اكتبها", 0.6);
  const line = k.draw(0, "اكتبها", 1.0);
  const cam = k.cam(NEUTRAL, [[0, "العادة", { cx: 560, cy: 520, s: 1.2 }, 1.0]]);
  return (
    <Leaf q={q} id="b4cs" cam={cam}
      L={<g>
        <Slip x={480} y={500} w={420} h={260} q={slip} rot={-2} dx={0}>
          <BlankLine x={0} y={30} w={320} p={line} pen={pen} touch={pen > 0.9 ? 1 : 0} />
        </Slip>
        <Stele x={800} y={680} q={1} dotted h={170} />
        <Card id="b4cs-c" x={800} y={750} q={1 - fade} memo={1} />
        <Ring x={800} y={600} r={110} p={alone} dash c={C.inkSoft} />
      </g>} />
  );
});

void Field; void Sheet; void Scribble; void Qalam;

export const BD04_SCENES: Record<string, React.FC<BdProps>> = {
  "bd04-noon-stone": NoonStone,
  "bd04-shadow-dial": ShadowDial,
  "bd04-thread-noon": ThreadNoon,
  "bd04-dark-knot": DarkKnot,
  "bd04-between": Between,
  "bd04-ten-centuries": TenCenturies,
  "bd04-world-unlit": WorldUnlit,
  "bd04-counter": Counter,
  "bd04-straight-line": StraightLine,
  "bd04-hadith-lead": HadithLead,
  "bd04-veer": Veer,
  "bd04-three-steps": ThreeSteps,
  "bd04-five-slots": FiveSlots,
  "bd04-majlis": Majlis,
  "bd04-five-stelae": FiveStelae,
  "bd04-open-book-path": OpenBookPath,
  "bd04-closed-book": ClosedBook,
  "bd04-stele-erode": SteleErode,
  "bd04-unknown-form": UnknownForm,
  "bd04-knowledge-guard": KnowledgeGuard,
  "bd04-knot-placed": KnotPlaced,
  "bd04-far-arrow": FarArrow,
  "bd04-what-remains": WhatRemains,
  "bd04-thread-forward": ThreadForward,
  "bd04-next-knot": NextKnot,
  "bd04-closing-slip": ClosingSlip,
};

/** مشهد الصورة الثابتة للمراجعة لكل لقطة (المعرّف في الخطة)؛ الغائب = آخر مشهد يستعمل اللقطة، عند نهاية آخر كلمة */
export const BD04_STILLS: Record<string, string> = {
  "bd04-five-stelae": "c1-s24",
  "bd04-three-steps": "c1-s33",
  "bd04-knowledge-guard": "c1-s34",
};
