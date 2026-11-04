/**
 * دفاتر الزمن 001 — اختبار «خط الأفق»: المشاهد غير القرآنية من ستوري بورد اللقطات الست
 * (`channels/dafatir-alzaman/episodes/001-adam-beginning/six-shots-storyboard.md`).
 * لا آية هنا ولا إطار آية: البقرة 30 (اللقطة 3) وآية اللقطة 5 تنتظران نصهما وتلاوتهما من Quran Foundation.
 * كل حركة مربوطة بكلمتها في التوقيت (at/end)؛ والسكون عند ذكر الله مقصود.
 */
import React from "react";
import { at, buildTimeline, end, type Timeline } from "./timeline";
import { BookShadow, C, Camera, Defs, Ink, Page, Spine, FlipLeaf, Words, easeOut, mix, prog, rng, W } from "./kit";

export type ShotDef = { id: string; label: string; tl: Timeline; dur: number; note?: string; noteCorner?: "tl2" | "br"; Comp: React.FC<{ t: number; tl: Timeline }>; tail?: React.FC<{ t: number; tl: Timeline }> };

/** كاميرا بمفاتيح متتالية: كل مفتاح ينتقل إلى (cx,cy,s) بين a وb بثوانٍ، بتسارع ناعم */
type Key = { a: number; b: number; cx: number; cy: number; s: number };
const camAt = (t: number, start: Omit<Key, "a" | "b">, keys: Key[]) => {
  let c = { ...start };
  for (const k of keys) {
    const p = prog(t, k.a, k.b);
    c = { cx: mix(c.cx, k.cx, p), cy: mix(c.cy, k.cy, p), s: mix(c.s, k.s, p) };
  }
  return c;
};

const mk = (sentences: string[], lead: number, tail: number) => {
  const tl = buildTimeline(sentences, lead);
  return { tl, dur: tl.end + tail };
};

const Amiri = "'Amiri', serif";
const Tajawal = "'Tajawal', sans-serif";

/** غروب مرسوم بغسل حبر خفيف على الصفحة اليمنى: سماء جمرية تخف للأعلى، وأرض رملية تحت خط y */
const Sunset: React.FC<{ y: number; o: number }> = ({ y, o }) => (
  <g opacity={o}>
    <defs>
      <linearGradient id={`sky-${y}`} x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor={C.ember} stopOpacity={0.26} />
        <stop offset="1" stopColor={C.ember} stopOpacity={0} />
      </linearGradient>
    </defs>
    <rect x={960} y={y - 330} width={820} height={330} fill={`url(#sky-${y})`} />
    <rect x={960} y={y} width={820} height={260} fill="#D9C29A" opacity={0.45} />
    {Array.from({ length: 9 }, (_, i) => (
      <path key={i} d={`M${1010 + i * 82} ${y + 22 + (i % 3) * 14} h${40 + (i % 2) * 18}`} stroke={C.ink} strokeWidth={2} opacity={0.18} />
    ))}
  </g>
);

/** تظليل بخطوط مائلة داخل مستطيل (ظل عمود أو برج) */
const Hatch: React.FC<{ x: number; y: number; w: number; h: number; o: number }> = ({ x, y, w, h, o }) => (
  <g opacity={0.28 * o}>
    <clipPath id={`h-${x}-${y}`}>
      <rect x={x} y={y} width={w} height={h} />
    </clipPath>
    <g clipPath={`url(#h-${x}-${y})`}>
      {Array.from({ length: Math.ceil((h + w) / 12) }, (_, i) => (
        <path key={i} d={`M${x} ${y + i * 12} l${w} ${-w}`} stroke={C.ink} strokeWidth={2} />
      ))}
    </g>
  </g>
);

// ─────────────────────────── اللقطة 1: العودة إلى البداية ───────────────────────────
const RUINS = [
  "M1050 700 C1200 696 1500 704 1690 698",
  "M1120 700 V500 L1132 488 L1141 497 L1150 481 L1160 492 V700",
  "M1133 690 V512 M1147 690 V506",
  "M1210 700 V575 L1222 560 L1236 572 L1250 566 V700",
  "M1500 700 V452 H1540 V700 M1488 452 H1552 V434 H1488 Z M1513 690 V462 M1527 690 V462",
  "M1590 700 V570 C1590 512 1634 486 1676 500 L1668 520 C1640 512 1612 530 1612 572 V700",
  "M1300 700 V652 H1362 V700 M1362 700 V666 H1424 V700 M1300 652 L1330 640 L1352 652",
  "M1424 700 C1424 680 1474 680 1474 700 M1436 700 C1436 690 1462 690 1462 700",
  "M1080 700 L1088 692 L1098 700 M1270 700 L1280 690 L1292 700 M1640 700 L1650 693 L1660 700",
];
const GATE = [
  "M1060 722 H1660",
  "M1120 722 V380 H1240 V722 M1120 380 V352 H1146 V380 M1167 380 V352 H1193 V380 M1214 380 V352 H1240 V380",
  "M1480 722 V380 H1600 V722 M1480 380 V352 H1506 V380 M1527 380 V352 H1553 V380 M1574 380 V352 H1600 V380",
  "M1240 722 V470 H1480 V722 M1300 722 V602 C1300 520 1420 520 1420 602 V722",
  "M1180 452 V496 M1540 452 V496 M1340 500 H1380",
  "M1290 722 V736 H1430 V722",
];
const S1 = mk(["ولكن رحلتنا هذه لا تبدأ من مدينة قديمة، ولا من مملكة نسي الناس اسمها.", "إننا نبدأ من أبي البشر، | آدم عليه السلام."], 1.2, 1.5);

const Shot1: React.FC<{ t: number; tl: Timeline }> = ({ t, tl }) => {
  const f1 = end(tl, "قديمة") + 0.05;
  const f2 = end(tl, "اسمها") + 0.1;
  const flip1 = prog(t, f1, f1 + 1.1);
  const flip2 = prog(t, f2, f2 + 1.15);
  const forget = prog(t, at(tl, "نسي"), end(tl, "اسمها"));
  const horizon = prog(t, at(tl, "إننا"), at(tl, "آدم") - 0.25, easeOut);
  const cam = prog(t, 0, S1.dur);
  const wash = prog(t, 0.1, 1.4);
  const ruins = (
    <g>
      <Sunset y={700} o={wash} />
      <g transform="translate(1368 700) scale(1.15) translate(-1368 -700)">
        {RUINS.map((d, i) => (
          <Ink key={i} d={d} w={4} p={prog(t, 0.05 + i * 0.12, 0.65 + i * 0.12)} />
        ))}
        <Hatch x={1124} y={510} w={34} h={186} o={prog(t, 0.9, 1.5)} />
        <Hatch x={1503} y={466} w={34} h={230} o={prog(t, 1.0, 1.6)} />
      </g>
    </g>
  );
  const gate = (o: number) => (
    <g opacity={o}>
      <Sunset y={722} o={1} />
      <g transform="translate(1360 722) scale(1.08) translate(-1360 -722)">
        {GATE.map((d, i) => (
          <Ink key={i} d={d} w={4} p={1} />
        ))}
        <Hatch x={1124} y={384} w={50} h={334} o={1} />
        <Hatch x={1484} y={384} w={50} h={334} o={1} />
        <path d="M1304 722 V604 C1304 526 1416 526 1416 604 V722 Z" fill={C.ink} opacity={0.14} />
      </g>
    </g>
  );
  const finalPage = (
    <g>
      <Ink d="M1720 640 C1500 636 1220 642 1010 638" w={4} p={horizon} />
    </g>
  );
  const under = t < f1 ? ruins : t < f2 ? gate(1 - 0.72 * forget) : finalPage;
  return (
    <Camera cx={mix(960, 1250, cam)} cy={520} s={mix(1.0, 1.1, cam)}>
      <svg width={W} height={1080} style={{ position: "absolute", overflow: "visible" }}>
        <Defs id="s1" />
        <BookShadow />
        <Page id="s1" side="l" tint={`rgba(74,46,31,${0.05 * (flip1 >= 1 ? 1 : 0) + 0.04 * (flip2 >= 1 ? 1 : 0)})`} />
        <Page id="s1" side="r">{under}</Page>
        <FlipLeaf id="s1" p={flip1} front={ruins} />
        <FlipLeaf id="s1" p={flip2} front={gate(1 - 0.72 * forget)} />
        <Spine />
      </svg>
      <Words
        now={t}
        dur={0.5}
        items={[{ w: "آدم", t: at(tl, "آدم") }, { w: "عليه", t: at(tl, "عليه") }, { w: "السلام", t: at(tl, "السلام") }]}
        style={{ right: W - 1700, top: 486, width: 660, textAlign: "center", fontFamily: Amiri, fontWeight: 700, fontSize: 104, lineHeight: 1.25, color: C.ink }}
      />
    </Camera>
  );
};

// ─────────────────────────── اللقطة 2: حد المعرفة ───────────────────────────
const S2 = mk(["ولا نملك تاريخًا ثابتًا لخلق آدم عليه السلام.", "فلم يخبرنا القرآن الكريم بالسنة التي خلق فيها، ولا بالزمن الذي يفصله عن أقدم الحضارات التي وصلت إلينا آثارها."], 0.8, 1.8);

const circlePath = (cx: number, cy: number, rx: number, ry: number) => {
  const r = rng(11);
  const pts: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const a = -Math.PI / 2 + (i / 40) * Math.PI * 2 * 0.98;
    const k = 1 + (r() - 0.5) * 0.04;
    pts.push(`${(cx + Math.cos(a) * rx * k).toFixed(1)} ${(cy + Math.sin(a) * ry * k).toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
};
const SLOT_CIRCLE = circlePath(1300, 445, 74, 86);

const Shot2: React.FC<{ t: number; tl: Timeline }> = ({ t, tl }) => {
  const drop = prog(t, at(tl, "تاريخا") - 0.2, at(tl, "تاريخا") + 0.7, easeOut);
  const circle = prog(t, at(tl, "بالسنة"), at(tl, "بالسنة") + 1.1) * 0.86;
  const lineR = prog(t, at(tl, "بالزمن"), at(tl, "بالزمن") + 1.0, easeOut);
  const nameR = prog(t, at(tl, "يفصله"), at(tl, "يفصله") + 0.6, easeOut);
  const lineL = prog(t, at(tl, "عن"), at(tl, "عن") + 1.0, easeOut);
  const sherd = prog(t, at(tl, "أقدم"), at(tl, "أقدم") + 0.9);
  const label = prog(t, at(tl, "آثارها") - 0.1, at(tl, "آثارها") + 0.5);
  return (
    <Camera
      {...camAt(t, { cx: 1300, cy: 400, s: 1.5 }, [
        { a: at(tl, "بالسنة") - 0.25, b: at(tl, "بالسنة") + 0.9, cx: 1300, cy: 445, s: 1.95 },
        { a: at(tl, "بالزمن") - 0.3, b: at(tl, "بالزمن") + 1.3, cx: 1250, cy: 560, s: 1.15 },
        { a: at(tl, "أقدم") - 0.4, b: at(tl, "أقدم") + 1.4, cx: 670, cy: 560, s: 1.15 },
        { a: end(tl, "آثارها") + 0.2, b: end(tl, "آثارها") + 1.4, cx: 960, cy: 520, s: 1.0 },
      ])}
    >
      <svg width={W} height={1080} style={{ position: "absolute", overflow: "visible" }}>
        <Defs id="s2" />
        <BookShadow />
        <Page id="s2" side="l">
          <Ink d="M920 700 C720 704 420 696 190 700" w={4} p={lineL} />
          <g transform="translate(300 698) scale(1.7) translate(-300 -698)">
            <g opacity={sherd}>
              <path d="M230 690 L250 620 C275 600 330 598 360 612 L372 684 C340 696 270 698 230 690 Z" fill="#E3CFA8" />
            </g>
            <Ink d="M230 690 L250 620 C275 600 330 598 360 612 L372 684 C340 696 270 698 230 690 Z" w={2.5} p={sherd} />
            <Ink d="M252 628 C285 614 330 612 358 622" w={1.8} p={sherd} />
            <Ink d="M262 652 L280 642 L298 652 L316 642 L334 652 L352 642" w={1.8} p={prog(t, at(tl, "أقدم") + 0.4, at(tl, "أقدم") + 1.1)} />
          </g>
        </Page>
        <Page id="s2" side="r">
          <Ink d="M1730 700 C1500 696 1200 704 1000 700" w={4} p={lineR} />
        </Page>
        <Spine />
        <g transform={`translate(0 ${mix(-560, 0, drop)})`}>
          <path d="M1265 62 H1335 V560 L1300 530 L1265 560 Z" fill={C.ribbon} />
          <path d="M1265 62 H1335 V92 H1265 Z" fill="#000" opacity={0.15} />
          <rect x={1272} y={398} width={56} height={94} rx={4} fill={C.page} stroke={C.ink} strokeWidth={2} />
        </g>
        <Ink d={SLOT_CIRCLE} w={6} p={circle} />
      </svg>
      <div style={{ position: "absolute", right: W - 1726, top: 596, fontFamily: Amiri, fontWeight: 700, fontSize: 60, lineHeight: 1.3, color: C.ink, direction: "rtl", opacity: nameR, transform: `translateY(${(1 - nameR) * 10}px)` }}>آدم عليه السلام</div>
      <div style={{ position: "absolute", left: 215, width: 170, top: 712, textAlign: "center", fontFamily: Tajawal, fontWeight: 500, fontSize: 44, color: C.inkText, opacity: label, direction: "rtl" }}>آثار</div>
    </Camera>
  );
};

// ─────────────────────────── اللقطة 4 (جزئية): أقوال المفسرين ───────────────────────────
const S4 = mk(["أخبر الله ملائكته أنه جاعل في الأرض خليفة.", "وقد ذكر المفسرون في معنى الخلافة أقوالًا، منها أن البشر يخلف بعضهم بعضًا في عمارة الأرض والحياة عليها."], 0.8, 1.8);
const LINEAGE = [800, 706, 612, 518, 424, 330];

const Shot4: React.FC<{ t: number; tl: Timeline }> = ({ t, tl }) => {
  const cardIn = prog(t, at(tl, "المفسرون") - 0.1, at(tl, "المفسرون") + 0.8, easeOut);
  const behind = (k: number) => prog(t, at(tl, "أقوالا") + k * 0.15, at(tl, "أقوالا") + 0.5 + k * 0.15, easeOut);
  const attr = prog(t, end(tl, "بعضا"), end(tl, "بعضا") + 0.6);
  const m0 = at(tl, "يخلف");
  const ground = prog(t, at(tl, "عمارة") - 0.1, at(tl, "عمارة") + 0.8, easeOut);
  const homes = prog(t, at(tl, "الأرض", 2), at(tl, "الأرض", 2) + 0.9);
  const life = prog(t, at(tl, "والحياة"), at(tl, "والحياة") + 0.9);
  const line1 = ["البشر", "يخلف", "بعضهم", "بعضا"].map((k, i) => ({ w: ["البشر", "يخلف", "بعضهم", "بعضًا"][i]!, t: at(tl, k) }));
  const line2 = [
    { w: "في", t: at(tl, "في", 3) },
    { w: "عمارة", t: at(tl, "عمارة") },
    { w: "الأرض", t: at(tl, "الأرض", 2) },
    { w: "والحياة", t: at(tl, "والحياة") },
    { w: "عليها", t: at(tl, "عليها") },
  ];
  return (
    <Camera
      {...camAt(t, { cx: 720, cy: 510, s: 1.0 }, [
        { a: at(tl, "المفسرون") - 0.2, b: at(tl, "المفسرون") + 1.2, cx: 560, cy: 420, s: 1.32 },
        { a: at(tl, "يخلف") - 0.3, b: at(tl, "يخلف") + 0.9, cx: 560, cy: 610, s: 1.22 },
      ])}
    >
      <svg width={W} height={1080} style={{ position: "absolute", overflow: "visible" }}>
        <Defs id="s4" />
        <BookShadow />
        <Page id="s4" side="r" />
        <Page id="s4" side="l">
          <path d="M868 72 H904 V156 L886 142 L868 156 Z" fill={C.ribbon} />
          {/* تعاقب الأجيال: حلقة تتصل بالتي قبلها، والسابقة تخفت */}
          {LINEAGE.map((x, i) => {
            const s0 = m0 + i * 0.36;
            const on = prog(t, s0, s0 + 0.32, easeOut);
            const passed = i < LINEAGE.length - 1 ? prog(t, s0 + 0.36, s0 + 0.8) : 0;
            return (
              <g key={x}>
                {i > 0 ? <Ink d={`M${LINEAGE[i - 1]! - 18} 640 H${x + 18}`} w={4} p={on} opacity={1 - 0.5 * passed} /> : null}
                <circle cx={x} cy={640} r={18 * on} fill={passed > 0 ? C.page : C.ink} stroke={C.ink} strokeWidth={4} opacity={1 - 0.55 * passed} />
              </g>
            );
          })}
          {/* عمارة الأرض: أرض وحقل ومسكنان، ثم نبتة عند «والحياة» */}
          <Ink d="M860 770 C700 766 480 774 290 768" w={3.5} p={ground} />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <Ink key={k} d={`M${840 - k * 24} 782 l-16 22`} w={2.5} p={prog(t, at(tl, "عمارة") + 0.25 + k * 0.07, at(tl, "عمارة") + 0.55 + k * 0.07)} />
          ))}
          <Ink d="M640 770 V738 L662 720 L684 738 V770 M654 770 V752 H670 V770" w={3.5} p={homes} />
          <Ink d="M556 770 V744 L574 730 L592 744 V770" w={3.5} p={prog(t, at(tl, "الأرض", 2) + 0.3, at(tl, "الأرض", 2) + 1.2)} />
          <Ink d="M420 770 C420 744 418 726 424 708 M422 742 C406 732 398 722 400 712 M423 728 C438 720 446 710 446 700" w={3} p={life} />
        </Page>
        <Spine />
      </svg>
      <div style={{ position: "absolute", right: W - 836, top: 104, fontFamily: Amiri, fontWeight: 700, fontSize: 40, color: C.ink, direction: "rtl" }}>الفصل الثاني</div>
      {[2, 1].map((k) => (
        <div key={k} style={{ position: "absolute", left: 252 + k * 16, top: 232 + k * 14, width: 600, height: 300, background: "#F6EBD6", border: `2px solid rgba(74,46,31,0.35)`, borderRadius: 6, transform: `rotate(${-1.2 - k * 1.8}deg)`, opacity: behind(k - 1) }} />
      ))}
      <div style={{ position: "absolute", left: 252, top: 232, width: 600, height: 300, background: "#FFFAF0", border: `3px solid rgba(74,46,31,0.7)`, borderRadius: 6, boxShadow: "0 14px 34px rgba(43,30,20,0.3)", transform: `translateX(${mix(-90, 0, cardIn)}px) rotate(-1.2deg)`, opacity: cardIn }}>
        <div style={{ position: "absolute", right: 22, top: -36, padding: "4px 16px 8px", background: C.ribbon, color: C.page, fontFamily: Tajawal, fontWeight: 700, fontSize: 26, borderRadius: "6px 6px 0 0", direction: "rtl" }}>من أقوال المفسرين</div>
        <Words now={t} items={line1} style={{ right: 34, top: 48, fontFamily: Tajawal, fontWeight: 500, fontSize: 42, lineHeight: 1.5, color: C.inkText }} />
        <Words now={t} items={line2} style={{ right: 34, top: 116, fontFamily: Tajawal, fontWeight: 500, fontSize: 42, lineHeight: 1.5, color: C.inkText }} />
        <div style={{ position: "absolute", right: 34, top: 214, fontFamily: Tajawal, fontWeight: 500, fontSize: 28, color: C.inkSoft, direction: "rtl", opacity: attr }}>الطبري · ابن كثير</div>
      </div>
    </Camera>
  );
};

// ─────────────────────────── اللقطة 5 (قبل الآية): التوبة ───────────────────────────
const S5 = mk(["ولكن آدم عليه السلام لم يصر على معصيته، بل رجع إلى ربه.", "وقد حكى الله عن آدم وزوجه دعاءهما:"], 0.9, 3.4);

const Shot5: React.FC<{ t: number; tl: Timeline }> = ({ t, tl }) => {
  const dot = prog(t, 0.2, 0.7, easeOut);
  const away = prog(t, at(tl, "ولكن"), end(tl, "معصيته"), easeOut);
  const back = prog(t, at(tl, "بل"), end(tl, "رجع") - 0.02);
  const fade = prog(t, tl.end + 1.0, tl.end + 1.8);
  return (
    <Camera cx={1365} cy={505} s={1.22}>
      <svg width={W} height={1080} style={{ position: "absolute", overflow: "visible" }}>
        <Defs id="s5" />
        <defs>
          <radialGradient id="s5-glow" cx="0.5" cy="1.05" r="0.7">
            <stop offset="0" stopColor={C.ember} stopOpacity={0.38} />
            <stop offset="1" stopColor={C.ember} stopOpacity={0} />
          </radialGradient>
        </defs>
        <BookShadow />
        <Page id="s5" side="l" tint="rgba(224,122,63,0.06)" />
        <Page id="s5" side="r" tint="rgba(224,122,63,0.06)">
          <g opacity={1 - fade}>
            <circle cx={1580} cy={430} r={10 * dot} fill={C.ink} />
            <Ink d="M1580 430 C1470 428 1340 434 1190 440" w={8} p={away} />
            <Ink d="M1190 440 C1110 444 1090 520 1178 530 C1300 542 1430 522 1546 500" w={8} p={back} />
          </g>
        </Page>
        <Spine />
        <rect x={150} y={60} width={1620} height={900} fill="url(#s5-glow)" />
      </svg>
    </Camera>
  );
};

// ─────────────────────────── اللقطة 6: الأثر وحدوده ───────────────────────────
const S6 = mk(
  [
    "فإلى جانب ما أخبرنا الله به، هناك شواهد مادية درسها الباحثون للتعرف إلى حياة المجتمعات البشرية القديمة.",
    "منها أدوات صنعت من الحجر، وآثار مساكن، وبقايا أطعمة، ومواقع استيطان، ومدافن، ونقوش ورسوم تركتها مجتمعات في أزمنة مختلفة.",
    "وتساعدنا هذه الآثار على دراسة جوانب من حياة أصحابها.",
    "ولكنها لا تخبرنا بكل شيء، ولا تمكننا من ربط كل اكتشاف بشخصية ورد ذكرها في القرآن الكريم.",
  ],
  0.9,
  1.8,
);

const HZ = 900;
const BANDS = [
  { y: HZ, c: "#DCC6A0" },
  { y: 1010, c: "#CDB088" },
  { y: 1180, c: "#B9966E" },
  { y: 1350, c: "#A07B58" },
  { y: 1530, c: "#866247" },
  { y: 1720, c: "#6E4F3A" },
];
const wave = (y: number, k: number) => {
  const pts: string[] = [];
  for (let x = -780; x <= 2700; x += 60) pts.push(`${x} ${(y + 9 * Math.sin(x / 170 + k) + 5 * Math.sin(x / 61 + k * 2)).toFixed(1)}`);
  return pts;
};
const bandPath = (i: number) => {
  const top = i === 0 ? [`-780 ${HZ}`, `2700 ${HZ}`] : wave(BANDS[i]!.y, i);
  const bottom = i === BANDS.length - 1 ? [`2700 2200`, `-780 2200`] : wave(BANDS[i + 1]!.y, i + 1).reverse();
  return `M${[...top, ...bottom].join(" L")} Z`;
};
const STIPPLE = (() => {
  const r = rng(42);
  return Array.from({ length: 760 }, () => ({ x: -700 + r() * 3320, y: HZ + 20 + r() * 1260, s: 1.5 + r() * 3.5, o: 0.12 + r() * 0.2, peb: r() > 0.9 }));
})();

type Find = { key: string; word: string; label: string; lx: number; ly: number; ax: number; ay: number; cx: number; cy: number; rx: number; ry: number; draw: (p: number) => React.ReactNode };
/** مواضع الآثار على ترتيب نطقها من اليمين إلى اليسار، لتتبعها الكاميرا (الرسوم مصممة حول مواضعها الأصلية cx,cy وتُنقل إلى هنا) */
const PLACE: Record<string, [number, number]> = { tool: [1700, 1560], home: [1360, 1250], food: [1040, 1460], settle: [740, 1120], burial: [520, 1640], art: [230, 1500] };
const stone = "#CFC4B0";
const FINDS: Find[] = [
  {
    key: "tool", word: "أدوات", label: "أدوات من الحجر", lx: 1400, ly: 1520, ax: 1528, ay: 1612, cx: 1562, cy: 1646, rx: 80, ry: 92,
    draw: (p) => (
      <g>
        <path d="M1560 1578 C1592 1598 1606 1650 1592 1690 C1582 1714 1540 1714 1530 1690 C1514 1650 1528 1600 1560 1578 Z" fill={stone} opacity={p} />
        <Ink d="M1560 1578 C1592 1598 1606 1650 1592 1690 C1582 1714 1540 1714 1530 1690 C1514 1650 1528 1600 1560 1578 Z" w={3.5} p={p} c="#2B1E14" />
        <Ink d="M1560 1592 L1548 1630 L1562 1660 L1550 1700 M1572 1606 L1585 1650 M1540 1642 L1562 1660 L1582 1676" w={2} p={p} c="#2B1E14" />
      </g>
    ),
  },
  {
    key: "home", word: "مساكن", label: "آثار مساكن", lx: 1260, ly: 1118, ax: 1220, ay: 1196, cx: 1215, cy: 1240, rx: 210, ry: 72,
    draw: (p) => (
      <g>
        <Ink d="M1050 1200 H1330" w={3} p={p} c="#2B1E14" />
        {[1080, 1150, 1220, 1290].map((x, i) => (
          <rect key={x} x={x - 9} y={1200} width={18} height={56} rx={9} fill="#3A2418" opacity={0.8 * prog(p, i * 0.15, 0.4 + i * 0.15)} />
        ))}
        {Array.from({ length: 9 }, (_, i) => {
          const a = Math.PI + (i / 8) * Math.PI;
          return <circle key={i} cx={1380 + Math.cos(a) * 34} cy={1206 - Math.sin(a) * 16} r={8} fill={stone} stroke="#2B1E14" strokeWidth={2} opacity={prog(p, 0.4 + i * 0.05, 0.6 + i * 0.05)} />;
        })}
        <ellipse cx={1380} cy={1208} rx={24} ry={9} fill="#2B1E14" opacity={0.75 * prog(p, 0.8, 1)} />
      </g>
    ),
  },
  {
    key: "food", word: "أطعمة", label: "بقايا أطعمة", lx: 900, ly: 1318, ax: 840, ay: 1406, cx: 810, cy: 1446, rx: 96, ry: 58,
    draw: (p) => {
      const r = rng(5);
      return (
        <g>
          {Array.from({ length: 9 }, (_, i) => {
            const x = 790 + (i % 3) * 30 + r() * 10;
            const y = 1428 + Math.floor(i / 3) * 18 + r() * 6;
            const a = r() * 60 - 30;
            const o = prog(p, i * 0.06, 0.3 + i * 0.06);
            return (
              <g key={i} transform={`rotate(${a} ${x} ${y})`} opacity={o}>
                <ellipse cx={x} cy={y} rx={12} ry={7} fill="#5A3A26" />
                <path d={`M${x - 8} ${y} H${x + 8}`} stroke="#E3CFA8" strokeWidth={1.5} />
              </g>
            );
          })}
          <g transform="translate(740 1450) scale(1.5) translate(-740 -1450)">
            <path d="M716 1462 C716 1432 756 1422 771 1452 C776 1472 746 1482 716 1462 Z" fill="#E8DCC6" opacity={p} />
            <Ink d="M716 1462 C716 1432 756 1422 771 1452 C776 1472 746 1482 716 1462 Z M728 1458 L750 1440 M736 1466 L762 1450" w={2} p={p} c="#2B1E14" />
          </g>
        </g>
      );
    },
  },
  {
    key: "settle", word: "استيطان", label: "مواقع استيطان", lx: 480, ly: 1018, ax: 440, ay: 1068, cx: 420, cy: 1110, rx: 150, ry: 60,
    draw: (p) => (
      <g>
        {[0, 1, 2].map((row) =>
          Array.from({ length: row === 2 ? 3 : 6 - row }, (_, i) => {
            const x = 300 + row * 18 + i * 42;
            return <rect key={`${row}-${i}`} x={x} y={1124 - row * 24} width={38} height={21} rx={6} fill={stone} stroke="#2B1E14" strokeWidth={2} opacity={prog(p, row * 0.3 + i * 0.04, row * 0.3 + 0.35 + i * 0.04)} />;
          }),
        )}
      </g>
    ),
  },
  {
    key: "burial", word: "ومدافن", label: "مدافن", lx: 1020, ly: 1548, ax: 1000, ay: 1596, cx: 1000, cy: 1640, rx: 120, ry: 66,
    draw: (p) => (
      <g>
        <rect x={926} y={1606} width={148} height={66} rx={8} fill="#5A3E2C" opacity={0.85 * prog(p, 0.5, 1)} />
        {Array.from({ length: 16 }, (_, i) => {
          const per = i / 16;
          const [x, y] = per < 0.3 ? [920 + (per / 0.3) * 160, 1598] : per < 0.5 ? [1080, 1598 + ((per - 0.3) / 0.2) * 82] : per < 0.8 ? [1080 - ((per - 0.5) / 0.3) * 160, 1680] : [920, 1680 - ((per - 0.8) / 0.2) * 82];
          return <rect key={i} x={x - 11} y={y - 7} width={22} height={14} rx={5} fill={stone} stroke="#2B1E14" strokeWidth={2} opacity={prog(p, i * 0.03, 0.25 + i * 0.03)} />;
        })}
      </g>
    ),
  },
  {
    key: "art", word: "ونقوش", label: "نقوش ورسوم", lx: 380, ly: 1470, ax: 400, ay: 1530, cx: 405, cy: 1600, rx: 140, ry: 90,
    draw: (p) => (
      <g>
        <path d="M300 1540 L500 1530 L520 1660 L290 1670 Z" fill="#9C8A74" opacity={p} />
        <Ink d="M300 1540 L500 1530 L520 1660 L290 1670 Z" w={3} p={p} c="#2B1E14" />
        <Ink d="M340 1590 L360 1570 L380 1590 L400 1570 L420 1590 M450 1580 C470 1560 490 1600 460 1610 C440 1615 445 1590 460 1592" w={3} p={prog(p, 0.4, 1)} c="#B4583A" />
        {[0, 1, 2, 3, 4].map((k) => (
          <circle key={k} cx={350 + k * 26} cy={1630 - (k % 2) * 8} r={4.5} fill="#2B1E14" opacity={prog(p, 0.5 + k * 0.08, 0.6 + k * 0.08)} />
        ))}
      </g>
    ),
  },
];

const Shot6: React.FC<{ t: number; tl: Timeline }> = ({ t, tl }) => {
  const hz = prog(t, 0.05, 0.8, easeOut);
  // نزول عبر الأفق عند «شواهد»، ثم تتبع كل أثر لحظة نطقه (يمين ← يسار)، ثم رجوع لرؤية الكل، ثم صعود مع الخيط نحو الأفق
  const visit = (k: string, word: string, prev: string): Key => {
    const [x, y] = PLACE[k]!;
    return { a: Math.max(at(tl, word) - 0.45, end(tl, prev) - 0.1), b: at(tl, word) + 0.35, cx: Math.min(1412, Math.max(560, x)), cy: Math.min(1450, Math.max(1330, y)), s: 1.25 };
  };
  const { cx, cy, s } = camAt(t, { cx: 960, cy: 520, s: 1.0 }, [
    { a: at(tl, "شواهد") - 0.1, b: at(tl, "شواهد") + 1.6, cx: 1240, cy: 1360, s: 1.12 },
    visit("tool", "أدوات", "القديمة"),
    visit("home", "مساكن", "الحجر"),
    visit("food", "أطعمة", "مساكن"),
    visit("settle", "استيطان", "أطعمة"),
    visit("burial", "ومدافن", "استيطان"),
    visit("art", "ونقوش", "ومدافن"),
    { a: at(tl, "وتساعدنا") - 0.3, b: at(tl, "وتساعدنا") + 1.2, cx: 960, cy: 1390, s: 1.0 },
    { a: at(tl, "ربط") - 0.3, b: end(tl, "بشخصية") + 0.2, cx: 1280, cy: 1250, s: 1.12 },
  ]);
  const study = (i: number) => prog(t, at(tl, "دراسة") + i * 0.2, at(tl, "دراسة") + 0.55 + i * 0.2);
  const dark = prog(t, at(tl, "بكل"), at(tl, "بكل") + 1.0);
  const thread = prog(t, at(tl, "ربط"), end(tl, "بشخصية"));
  return (
    <Camera cx={cx} cy={cy} s={s} h={2200}>
      <svg width={W} height={2200} style={{ position: "absolute", overflow: "visible" }}>
        <Defs id="s6" />
        <defs>
          <filter id="s6-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={34} />
          </filter>
          <mask id="s6-holes">
            <rect x={-800} y={HZ} width={3600} height={1400} fill="white" />
            <g filter="url(#s6-soft)">
              {FINDS.map((f) => (
                <ellipse key={f.key} cx={PLACE[f.key]![0]} cy={PLACE[f.key]![1]} rx={f.rx + 30} ry={f.ry + 30} fill="black" />
              ))}
            </g>
          </mask>
        </defs>
        <rect x={-800} y={-300} width={3600} height={HZ + 300} fill={C.parchment} />
        <rect x={-800} y={-300} width={3600} height={HZ + 300} filter="url(#s6-grain)" />
        {BANDS.map((_, i) => (
          <path key={i} d={bandPath(i)} fill={BANDS[i]!.c} />
        ))}
        {STIPPLE.map((d, i) => (d.peb ? <ellipse key={i} cx={d.x} cy={d.y} rx={d.s * 2.2} ry={d.s * 1.4} fill="#4A2E1F" opacity={d.o} /> : <circle key={i} cx={d.x} cy={d.y} r={d.s} fill="#2B1E14" opacity={d.o} />))}
        <rect x={-800} y={HZ} width={3600} height={1400} fill="#1E140E" opacity={0.55 * dark} mask="url(#s6-holes)" />
        <Ink d={`M-760 ${HZ} H2680`} w={6} p={hz} />
        {FINDS.map((f, i) => {
          const p = prog(t, at(tl, f.word) - 0.05, at(tl, f.word) + 0.75);
          const [nx, ny] = PLACE[f.key]!;
          return (
            <g key={f.key}>
              <g transform={`translate(${nx - f.cx} ${ny - f.cy})`}>{f.draw(p)}</g>
              <Ink d={`M${nx} ${ny - f.ry} L${nx} ${ny - f.ry - 34}`} w={2} p={prog(t, at(tl, f.word) + 0.3, at(tl, f.word) + 0.7)} c="#2B1E14" />
              <Ink d={`M${nx} ${ny - f.ry} a${f.rx} ${f.ry} 0 1 1 -0.1 0`} w={3} p={study(i)} c={C.inkText} />
            </g>
          );
        })}
        <Ink d="M1700 1490 C1740 1380 1630 1270 1680 1160 C1706 1100 1664 1066 1672 1030" w={4.5} p={thread} c={C.ribbon} />
        <circle cx={1672} cy={1030} r={6} fill={C.ribbon} opacity={thread >= 0.99 ? 1 : 0} />
      </svg>
      <div style={{ position: "absolute", right: W - 1820, top: 110, fontFamily: Amiri, fontWeight: 700, fontSize: 44, color: C.ink, direction: "rtl" }}>الفصل السابع</div>
      {FINDS.map((f) => {
        const o = prog(t, at(tl, f.word) + 0.3, at(tl, f.word) + 0.7);
        const [nx, ny] = PLACE[f.key]!;
        return (
          <div key={f.key} style={{ position: "absolute", left: nx - 140, top: ny - f.ry - 88, width: 280, display: "flex", justifyContent: "center", opacity: o }}>
            <div style={{ padding: "2px 14px 6px", borderRadius: 8, background: "rgba(248,238,219,0.94)", fontFamily: Tajawal, fontWeight: 500, fontSize: 30, color: C.inkText, direction: "rtl", whiteSpace: "nowrap" }}>{f.label}</div>
          </div>
        );
      })}
    </Camera>
  );
};

export const SHOTS: ShotDef[] = [
  { id: "1", label: "١ · الافتتاح", ...S1, Comp: Shot1 },
  { id: "2", label: "٢ · حد المعرفة", ...S2, Comp: Shot2 },
  { id: "4", label: "٤ · أقوال المفسرين (جزئية)", ...S4, Comp: Shot4, note: "إطار لفظ الآية لا يُعرض في هذه المعاينة: لا نص قرآني فيها", noteCorner: "tl2" },
  { id: "5", label: "٥ · التوبة (قبل الآية)", ...S5, Comp: Shot5 },
  { id: "6", label: "٦ · الأثر وحدوده", ...S6, Comp: Shot6, note: "رسم توضيحي", noteCorner: "br" },
];
