/**
 * دفاتر الزمن 001 — اختبار «خط الأفق»: المشاهد غير القرآنية من ستوري بورد اللقطات الست
 * (`channels/dafatir-alzaman/episodes/001-adam-beginning/six-shots-storyboard.md`).
 * لا آية هنا ولا إطار آية: البقرة 30 (اللقطة 3) وآية اللقطة 5 تنتظران نصهما من السكريبت والتلاوة البشرية التي يرفعها المالك.
 * كل حركة مربوطة بكلمتها في التوقيت (at/end)؛ والسكون عند ذكر الله مقصود.
 */
import React from "react";
import { VerseRefPanel } from "./verseRef";
import { at, buildTimeline, end, type Timeline } from "./timeline";
import { BookShadow, C, Camera, CoverLeaf, Defs, Ink, LightPool, Page, PageStack, Spine, FlipLeaf, VerseCard, Words, easeOut, mix, prog, rng, verseRef as verseRefLabel, W } from "./kit";
import { timelineFromWords } from "./timeline";
import { FINDS, GATE, Hatch, RUINS, Sunset, stone, type FindDef as Find } from "../lib/drawings";
export { FINDS, GATE, Hatch, RUINS, Sunset };

/** آية تظهر في لقطة: نصها من السكريبت، والتلاوة البشرية المرفوعة تُحدد توقيت اللقطة (ث)، وword لكلمة مأخوذة منها */
export type QuranView = { key: string; text: string; reciter: string; start: number; dur: number; word?: string };
type ShotProps = { t: number; tl: Timeline; q?: QuranView };
export type ShotDef = {
  id: string;
  label: string;
  tl: Timeline;
  dur: number;
  note?: string;
  noteCorner?: "tl2" | "br";
  Comp: React.FC<ShotProps>;
  q?: QuranView;
  /** في المعاينة الصوتية: ملف صوت الراوي ولحظة بدئه، وأجزاء التلاوة ولحظة بدئها */
  voice?: { file: string; at: number };
  recitation?: { parts: { file: string; duration: number }[]; at: number };
};

/** وسائط المعاينة الصوتية (inputProps): مجلد public النسبي، وصوت كل لقطة بتوقيت كلماته، والآيات بنصها وتلاوتها */
export type HorizonAudio = {
  base: string;
  voice: Record<string, { file: string; duration: number; words: { word: string; start: number; end: number }[] }>;
  verses: Record<string, { text: string; reciter: string; parts: { file: string; duration: number }[] }>;
};

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
  return { tl, dur: tl.end + tail, sentences, lead, tail };
};

const Amiri = "'Amiri', serif";
const Tajawal = "'Tajawal', sans-serif";

/** غروب مرسوم بغسل حبر خفيف على الصفحة اليمنى: سماء جمرية تخف للأعلى، وأرض رملية تحت خط y */

/** تظليل بخطوط مائلة داخل مستطيل (ظل عمود أو برج) */

// ─────────────────────────── اللقطة 1: العودة إلى البداية ───────────────────────────
const S1 = mk(["ولكن رحلتنا هذه لا تبدأ من مدينة قديمة، ولا من مملكة نسي الناس اسمها.", "إننا نبدأ من أبي البشر، | آدم عليه السلام."], 2.3, 1.4);

const Shot1: React.FC<{ t: number; tl: Timeline }> = ({ t, tl }) => {
  // الدفتر مغلق ثم يُفتح غلافه: بداية الرحلة
  const cover = prog(t, 0.25, 1.45);
  const f1 = end(tl, "قديمة") + 0.05;
  const f2 = end(tl, "اسمها") + 0.1;
  const flip1 = prog(t, f1, f1 + 1.1);
  const flip2 = prog(t, f2, f2 + 1.15);
  const forget = prog(t, at(tl, "نسي"), end(tl, "اسمها"));
  const horizon = prog(t, at(tl, "إننا"), at(tl, "آدم") - 0.25, easeOut);
  const wash = prog(t, 1.2, 2.3);
  const ruins = (
    <g>
      <Sunset y={700} o={wash} />
      <g transform="translate(1368 700) scale(1.15) translate(-1368 -700)">
        {RUINS.map((d, i) => (
          <Ink key={i} d={d} w={4} p={prog(t, 1.25 + i * 0.12, 1.75 + i * 0.12)} />
        ))}
        <Hatch x={1124} y={510} w={34} h={186} o={prog(t, 2.1, 2.7)} />
        <Hatch x={1503} y={466} w={34} h={230} o={prog(t, 2.2, 2.8)} />
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
      <Sunset y={640} o={horizon * 0.8} />
      <Ink d="M1720 640 C1500 636 1220 642 1010 638" w={4} p={horizon} />
    </g>
  );
  const under = t < f1 ? ruins : t < f2 ? gate(1 - 0.72 * forget) : finalPage;
  const open = prog(t, 0.4, 1.6);
  const { cx, cy, s: sc } = camAt(t, { cx: 1370, cy: 520, s: 1.06 }, [
    { a: 0.4, b: 1.7, cx: 980, cy: 520, s: 1.0 },
    { a: 1.8, b: tl.end + 1.4, cx: 1250, cy: 520, s: 1.1 },
  ]);
  return (
    <Camera cx={cx} cy={cy} s={sc}>
      <svg width={W} height={1080} style={{ position: "absolute", overflow: "visible" }}>
        <Defs id="s1" />
        <ellipse cx={mix(1370, 960, open)} cy={968} rx={mix(440, 860, open)} ry={40} fill="#000" opacity={0.35} />
        {cover >= 1 ? <Page id="s1" side="l" tint={`rgba(200,161,90,${0.12 + 0.05 * (flip1 >= 1 ? 1 : 0) + 0.04 * (flip2 >= 1 ? 1 : 0)})`} /> : null}
        <Page id="s1" side="r">{under}</Page>
        <PageStack />
        <FlipLeaf id="s1" p={flip1} front={ruins} />
        <FlipLeaf id="s1" p={flip2} front={gate(1 - 0.72 * forget)} />
        <CoverLeaf p={cover} />
        <Spine />
        <LightPool o={open} />
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
const S2 = mk(["ولا نملك تاريخا ثابتا لخلق آدم عليه السلام.", "فلم يخبرنا القرآن الكريم بالسنة التي خلق فيها، ولا بالزمن الذي يفصله عن أقدم الحضارات التي وصلت إلينا آثارها."], 0.8, 1.2);

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

export const Shot2: React.FC<{ t: number; tl: Timeline }> = ({ t, tl }) => {
  const drop = prog(t, at(tl, "تاريخا") - 0.2, at(tl, "تاريخا") + 0.7, easeOut);
  // غطاء الخانة يرتفع عند «بالسنة» فتظهر فارغة، ثم تُحاط بدائرة لا تُغلق
  const flap = prog(t, at(tl, "بالسنة") - 0.05, at(tl, "بالسنة") + 0.55, easeOut);
  const circle = prog(t, at(tl, "بالسنة") + 0.45, at(tl, "بالسنة") + 1.5) * 0.86;
  const lineR = prog(t, at(tl, "بالزمن"), at(tl, "بالزمن") + 1.0, easeOut);
  const nameR = prog(t, at(tl, "يفصله"), at(tl, "يفصله") + 0.6, easeOut);
  const lineL = prog(t, at(tl, "عن"), at(tl, "عن") + 1.0, easeOut);
  const sherd = prog(t, at(tl, "أقدم"), at(tl, "أقدم") + 0.9);
  const label = prog(t, at(tl, "آثارها") - 0.1, at(tl, "آثارها") + 0.5);
  return (
    <Camera
      {...camAt(t, { cx: 1300, cy: 400, s: 1.5 }, [
        { a: at(tl, "لخلق") - 0.1, b: at(tl, "بالسنة") + 0.3, cx: 1300, cy: 445, s: 1.95 },
        { a: at(tl, "بالزمن") - 0.3, b: at(tl, "بالزمن") + 1.3, cx: 1250, cy: 560, s: 1.15 },
        { a: at(tl, "أقدم") - 0.4, b: at(tl, "أقدم") + 1.4, cx: 670, cy: 560, s: 1.15 },
        { a: end(tl, "آثارها") + 0.2, b: end(tl, "آثارها") + 1.4, cx: 960, cy: 520, s: 1.0 },
      ])}
    >
      <svg width={W} height={1080} style={{ position: "absolute", overflow: "visible" }}>
        <Defs id="s2" />
        <BookShadow />
        <defs>
          <linearGradient id="s2-fadeR" gradientUnits="userSpaceOnUse" x1="1730" y1="0" x2="990" y2="0">
            <stop offset="0" stopColor={C.ink} />
            <stop offset="0.65" stopColor={C.ink} stopOpacity={0.8} />
            <stop offset="1" stopColor={C.ink} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="s2-fadeL" gradientUnits="userSpaceOnUse" x1="190" y1="0" x2="930" y2="0">
            <stop offset="0" stopColor={C.ink} />
            <stop offset="0.65" stopColor={C.ink} stopOpacity={0.8} />
            <stop offset="1" stopColor={C.ink} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Page id="s2" side="l">
          <Ink d="M930 700 C720 704 420 696 190 700" w={4} p={lineL} c="url(#s2-fadeL)" />
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
          <Ink d="M1730 700 C1500 696 1200 704 990 700" w={4} p={lineR} c="url(#s2-fadeR)" />
        </Page>
        <Spine />
        <g transform={`translate(0 ${mix(-560, 0, drop)})`}>
          <path d="M1265 62 H1335 V560 L1300 530 L1265 560 Z" fill={C.ribbon} />
          <path d="M1265 62 H1335 V92 H1265 Z" fill="#000" opacity={0.15} />
          <rect x={1272} y={398} width={56} height={94} rx={4} fill={C.page} stroke={C.ink} strokeWidth={2} />
          {flap < 1 ? (
            <g transform={`translate(0 398) scale(1 ${1 - flap}) translate(0 -398)`}>
              <rect x={1270} y={396} width={60} height={98} rx={4} fill="#A92A20" stroke={C.ink} strokeWidth={2} />
              <path d="M1276 420 H1324" stroke="#000" strokeOpacity={0.25} strokeWidth={2} />
            </g>
          ) : null}
        </g>
        <Ink d={SLOT_CIRCLE} w={6} p={circle} />
      </svg>
      <div style={{ position: "absolute", right: W - 1726, top: 596, fontFamily: Amiri, fontWeight: 700, fontSize: 60, lineHeight: 1.3, color: C.ink, direction: "rtl", opacity: nameR, transform: `translateY(${(1 - nameR) * 10}px)` }}>آدم عليه السلام</div>
      <div style={{ position: "absolute", left: 760, width: 400, top: 722, display: "flex", justifyContent: "center", opacity: prog(t, at(tl, "عن") - 0.1, at(tl, "عن") + 0.5) }}>
        <div style={{ padding: "2px 16px 6px", borderRadius: 8, background: "rgba(248,238,219,0.97)", border: "2px solid rgba(74,46,31,0.25)", fontFamily: Tajawal, fontWeight: 500, fontSize: 36, color: C.inkSoft, direction: "rtl", whiteSpace: "nowrap" }}>زمن لا نعلم قدره</div>
      </div>
      <div style={{ position: "absolute", left: 215, width: 170, top: 712, textAlign: "center", fontFamily: Tajawal, fontWeight: 500, fontSize: 44, color: C.inkText, opacity: label, direction: "rtl" }}>آثار</div>
    </Camera>
  );
};

// ─────────────────────────── اللقطة 3: البقرة 30 ───────────────────────────
// التمهيد فيه ذكر الله: الصفحة ساكنة. ثم تظهر الآية كاملة قبل بدء التلاوة بقليل، وتبقى ساكنة حتى نهايتها.
const S3 = mk(["قبل أن نتحدث عن حياة آدم عليه السلام، نقف عند ما أخبرنا الله به في سورة البقرة."], 0.7, 1.5);

const Shot3: React.FC<ShotProps> = ({ t, q }) => (
  <>
    <Camera cx={960} cy={500} s={1.0}>
      <svg width={W} height={1080} style={{ position: "absolute", overflow: "visible" }}>
        <Defs id="s3" />
        <BookShadow />
        <Page id="s3" side="l" />
        <Page id="s3" side="r">
          <path d="M1700 72 H1736 V156 L1718 142 L1700 156 Z" fill={C.ribbon} />
        </Page>
        <Spine />
      </svg>
      <div style={{ position: "absolute", right: W - 1680, top: 104, fontFamily: Amiri, fontWeight: 700, fontSize: 40, color: C.ink, direction: "rtl" }}>الفصل الثاني</div>
    </Camera>
    {q ? <VerseCard show={prog(t, q.start - 0.7, q.start - 0.1)} text={q.text} refKey={q.key} reciter={q.reciter} /> : null}
  </>
);

// ─────────────────────────── اللقطة 4 (جزئية): أقوال المفسرين ───────────────────────────
const S4 = mk(["أخبر الله ملائكته أنه جاعل في الأرض خليفة.", "وقد ذكر المفسرون في معنى الخلافة أقوالا، منها أن البشر يخلف بعضهم بعضا في عمارة الأرض والحياة عليها."], 0.8, 1.2);
const LINEAGE = [830, 724, 618, 512, 406, 300];
const CARD = { x: 245, y: 240, w: 620, h: 320 };

/** refText (الأمر 019، E1): لوحة مرجع الآية ثابتة على الصفحة اليمنى من الإطار الأول، بلا نص آية ولا حركة؛ والكادر يحفظها مع الحاشية */
export const Shot4: React.FC<ShotProps & { refText?: string }> = ({ t, tl, q, refText }) => {
  const framed = Boolean(q?.word || refText);
  // «المفسرون»: حزمة حواشٍ تدخل · «أقوالًا»: تنفرج ثلاثًا (تعدد الأقوال) · «منها»: تتقدم واحدة وتُكتب، والباقيتان تتراجعان دون أن تختفيا
  const enter = prog(t, at(tl, "المفسرون") - 0.15, at(tl, "المفسرون") + 0.75, easeOut);
  const fan = prog(t, at(tl, "أقوالا") - 0.1, at(tl, "أقوالا") + 0.7, easeOut);
  const pick = prog(t, at(tl, "منها") - 0.1, at(tl, "منها") + 0.6, easeOut);
  const attr = prog(t, end(tl, "بعضا"), end(tl, "بعضا") + 0.6);
  const m0 = at(tl, "يخلف");
  const ground = prog(t, at(tl, "عمارة") - 0.15, at(tl, "عمارة") + 0.7, easeOut);
  const homes = prog(t, at(tl, "الأرض", 2) - 0.1, at(tl, "الأرض", 2) + 0.8);
  const life = prog(t, at(tl, "والحياة") - 0.1, at(tl, "والحياة") + 0.8);
  const line1 = ["البشر", "يخلف", "بعضهم", "بعضا"].map((k, i) => ({ w: ["البشر", "يخلف", "بعضهم", "بعضا"][i]!, t: at(tl, k) }));
  const line2 = [
    { w: "في", t: at(tl, "في", 3) },
    { w: "عمارة", t: at(tl, "عمارة") },
    { w: "الأرض", t: at(tl, "الأرض", 2) },
    { w: "والحياة", t: at(tl, "والحياة") },
    { w: "عليها", t: at(tl, "عليها") },
  ];
  const fanPose = [
    { r: -9, x: -150, y: 26 },
    { r: 7, x: 150, y: 30 },
    { r: -1.2, x: 0, y: 0 },
  ];
  const ruled = "repeating-linear-gradient(180deg, transparent 0 46px, rgba(74,46,31,0.13) 46px 48px)";
  return (
    <Camera
      {...camAt(t, framed ? { cx: 960, cy: 500, s: 1.0 } : { cx: 590, cy: 500, s: 1.12 }, [
        // مع إطار لفظ الآية أو لوحة مرجعها: يبقى الإطار والحاشية معًا في الكادر (الفصل بينهما هو موضوع اللقطة)
        { a: at(tl, "المفسرون") - 0.2, b: at(tl, "المفسرون") + 1.0, cx: framed ? 900 : 555, cy: framed ? 440 : 410, s: framed ? 1.12 : 1.26 },
        { a: at(tl, "يخلف") - 0.35, b: at(tl, "يخلف") + 0.9, cx: framed ? 880 : 555, cy: 575, s: framed ? 1.08 : 1.12 },
        // «في عمارة الأرض والحياة عليها»: النظر ينزل إلى الأرض والمسكنين والنبتة لحظة رسمها، ثم يعود إلى كادر الحاشية مع الخفوت
        ...(framed
          ? [
              { a: at(tl, "عمارة") - 0.25, b: at(tl, "عليها") + 0.2, cx: 600, cy: 720, s: 1.24 },
              { a: end(tl, "عليها") + 0.3, b: end(tl, "عليها") + 1.5, cx: 555, cy: 575, s: 1.12 },
            ]
          : []),
      ])}
    >
      <svg width={W} height={1080} style={{ position: "absolute", overflow: "visible" }}>
        <Defs id="s4" />
        <BookShadow />
        <Page id="s4" side="r">
          <path d="M1700 72 H1736 V156 L1718 142 L1700 156 Z" fill={C.ribbon} />
          {refText && !q?.word ? <VerseRefPanel refText={refText} o={1} /> : null}
        </Page>
        <Page id="s4" side="l">
          {/* تعاقب: حلقة تتصل بالتي قبلها، والسابقة تخفت */}
          {LINEAGE.map((x, i) => {
            const s0 = m0 + i * 0.36;
            const on = prog(t, s0, s0 + 0.32, easeOut);
            const passed = i < LINEAGE.length - 1 ? prog(t, s0 + 0.36, s0 + 0.8) : 0;
            return (
              <g key={x}>
                {i > 0 ? <Ink d={`M${LINEAGE[i - 1]! - 22} 720 H${x + 22}`} w={4.5} p={on} opacity={1 - 0.5 * passed} /> : null}
                <circle cx={x} cy={720} r={22 * on} fill={passed > 0 ? C.page : C.ink} stroke={C.ink} strokeWidth={4.5} opacity={1 - 0.55 * passed} />
              </g>
            );
          })}
          {/* «عمارة الأرض»: أرض وحقل ومسكنان · «والحياة»: نبتة */}
          <rect x={250} y={852} width={640} height={60} fill="#D9C29A" opacity={0.5 * ground} />
          <Ink d="M890 852 C720 848 470 856 250 850" w={4} p={ground} />
          {[0, 1, 2, 3, 4, 5, 6].map((k) => (
            <Ink key={k} d={`M${870 - k * 30} 866 l-20 30`} w={3} p={prog(t, at(tl, "عمارة") + 0.2 + k * 0.06, at(tl, "عمارة") + 0.5 + k * 0.06)} />
          ))}
          <g transform="translate(620 852) scale(1.6) translate(-620 -852)">
            <Ink d="M600 852 V826 L620 810 L640 826 V852 M613 852 V836 H627 V852" w={3} p={homes} fill="#E8D6B3" fillP={homes} />
          </g>
          <g transform="translate(500 852) scale(1.6) translate(-500 -852)">
            <Ink d="M484 852 V832 L500 820 L516 832 V852" w={3} p={prog(t, at(tl, "الأرض", 2) + 0.25, at(tl, "الأرض", 2) + 1.05)} fill="#E8D6B3" fillP={homes} />
          </g>
          <g transform="translate(350 852) scale(1.7) translate(-350 -852)">
            <Ink d="M350 852 C350 830 348 812 354 796 M352 828 C336 818 328 808 330 798 M353 814 C368 806 376 796 376 786" w={3} p={life} c="#5B6B3A" />
          </g>
        </Page>
        <Spine />
      </svg>
      <div style={{ position: "absolute", right: W - 1680, top: 104, fontFamily: Amiri, fontWeight: 700, fontSize: 40, color: C.ink, direction: "rtl" }}>الفصل الثاني</div>
      {q?.word ? (
        // لفظ الآية من نص السكريبت المعتمد نفسه، في إطار على الصفحة المقابلة: ساكن طوال اللقطة، ولا يلتقي بالحاشية
        <div style={{ position: "absolute", left: 1170, top: 330, width: 390, padding: "18px 20px 16px", background: "#FBF4E6", border: "3px double rgba(74,46,31,0.65)", borderRadius: 8, textAlign: "center", direction: "rtl", boxShadow: "0 10px 24px rgba(43,30,20,0.18)" }}>
          <div style={{ fontFamily: Tajawal, fontWeight: 500, fontSize: 24, color: C.inkSoft }}>لفظ الآية</div>
          <div style={{ fontFamily: Amiri, fontSize: 88, lineHeight: 1.7, color: C.inkText }}>﴿{q.word}﴾</div>
          <div style={{ fontFamily: Tajawal, fontWeight: 500, fontSize: 24, color: C.inkSoft }}>{verseRefLabel(q.key)}</div>
        </div>
      ) : null}
      {fanPose.map((pose, k) => {
        const front = k === 2;
        const dim = front ? 0 : pick;
        const tx = mix(-170 + k * 8, 0, enter) + pose.x * fan * (front ? 0 : 1) * (1 - 0.15 * pick);
        const ty = k * 6 * (1 - fan) + pose.y * fan + (front ? -14 * pick : 10 * pick);
        const rot = mix(-1.2 - k * 1.2, pose.r, fan);
        const sc = front ? 1 + 0.06 * pick : 1 - 0.06 * pick;
        return (
          <div
            key={k}
            style={{
              position: "absolute",
              left: CARD.x,
              top: CARD.y,
              width: CARD.w,
              height: CARD.h,
              background: front ? "#FFFAF0" : "#F8EEDC",
              backgroundImage: front ? undefined : ruled,
              backgroundPosition: "0 70px",
              border: `3px solid rgba(74,46,31,${front ? 0.7 : 0.45})`,
              borderRadius: 8,
              boxShadow: `0 ${14 + 10 * pick * (front ? 1 : 0)}px ${30 + 16 * pick * (front ? 1 : 0)}px rgba(43,30,20,${front ? 0.3 : 0.18})`,
              transform: `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(${sc})`,
              opacity: enter * (1 - 0.45 * dim),
            }}
          >
            {front ? (
              <>
                <div style={{ position: "absolute", right: 24, top: -40, padding: "4px 18px 8px", background: C.ribbon, color: C.page, fontFamily: Tajawal, fontWeight: 700, fontSize: 28, borderRadius: "6px 6px 0 0", direction: "rtl" }}>من أقوال المفسرين</div>
                <div style={{ position: "absolute", right: 36, top: 26, fontFamily: Tajawal, fontWeight: 700, fontSize: 30, color: C.ribbon, direction: "rtl", opacity: pick }}>منها:</div>
                <Words now={t} items={line1} style={{ right: 36, top: 76, fontFamily: Tajawal, fontWeight: 500, fontSize: 46, lineHeight: 1.45, color: C.inkText }} />
                <Words now={t} items={line2} style={{ right: 36, top: 146, fontFamily: Tajawal, fontWeight: 500, fontSize: 46, lineHeight: 1.45, color: C.inkText }} />
                <div style={{ position: "absolute", right: 36, top: 240, fontFamily: Tajawal, fontWeight: 500, fontSize: 30, color: C.inkSoft, direction: "rtl", opacity: attr }}>الطبري · ابن كثير</div>
              </>
            ) : null}
          </div>
        );
      })}
    </Camera>
  );
};

// ─────────────────────────── اللقطة 5 (قبل الآية): التوبة ───────────────────────────
const S5 = mk(["ولكن آدم عليه السلام لم يصر على معصيته، بل رجع إلى ربه.", "وقد حكى الله عن آدم وزوجه دعاءهما:"], 0.9, 1.9);

export const Shot5: React.FC<ShotProps> = ({ t, tl, q }) => {
  const dot = prog(t, 0.2, 0.7, easeOut);
  const away = prog(t, at(tl, "ولكن"), end(tl, "معصيته"), easeOut);
  const back = prog(t, at(tl, "بل"), end(tl, "رجع") - 0.02);
  // بعد «دعاءهما:» صمت قصير ثم تخلو الصفحة للآية (في الحلقة يدخل إطار الآية هنا)
  const fade = prog(t, tl.end + 0.6, tl.end + 1.3);
  return (
    <>
    <Camera
      {...camAt(t, { cx: 1400, cy: 505, s: 1.22 }, [
        // الكاميرا تتبع الخط وهو يبتعد ثم وهو يعود، وتسكن قبل «إلى ربه»
        { a: at(tl, "ولكن"), b: end(tl, "معصيته"), cx: 1300, cy: 505, s: 1.22 },
        { a: at(tl, "بل"), b: end(tl, "رجع"), cx: 1405, cy: 500, s: 1.24 },
      ])}
    >
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
    {q ? <VerseCard show={prog(t, q.start - 0.7, q.start - 0.1)} text={q.text} refKey={q.key} reciter={q.reciter} /> : null}
    </>
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
  1.4,
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

/** مواضع الآثار على ترتيب نطقها من اليمين إلى اليسار، لتتبعها الكاميرا (الرسوم مصممة حول مواضعها الأصلية cx,cy وتُنقل إلى هنا) */
const PLACE: Record<string, [number, number]> = { tool: [1720, 1570], home: [1330, 1190], food: [1290, 1580], settle: [720, 1190], burial: [860, 1590], art: [380, 1580] };

const K6 = 1.3;
const ORDER = ["tool", "home", "food", "settle", "burial", "art"];

export const Shot6: React.FC<{ t: number; tl: Timeline; noHead?: boolean }> = ({ t, tl, noHead }) => {
  const hz = prog(t, 0.05, 0.8, easeOut);
  const words = ORDER.map((k) => FINDS.find((f) => f.key === k)!);
  // نافذة الوصول إلى كل أثر: تبدأ بعد نطق السابق، وتنتهي عند نطق اسمه
  const arrive = words.map((f, i) => {
    const T = at(tl, f.word);
    const a = i === 0 ? T - 0.7 : Math.max(T - 0.55, end(tl, words[i - 1]!.word) - 0.05);
    return { a, T };
  });
  const { cx, cy, s } = camAt(t, { cx: 960, cy: 520, s: 1.0 }, [
    // نزول عبر الأفق عند «شواهد»
    { a: at(tl, "شواهد") - 0.1, b: at(tl, "شواهد") + 1.6, cx: 1500, cy: 1380, s: 1.15 },
    // زيارة كل أثر لحظة نطق اسمه، على ترتيب الذكر من اليمين إلى اليسار
    // «حياة المجتمعات البشرية القديمة»: الكادر ينزل في الطبقات المدفونة (الأقدم أعمق) قبل أول أثر
    { a: at(tl, "حياة") - 0.2, b: at(tl, "القديمة") + 0.4, cx: 1320, cy: 1540, s: 1.26 },
    ...words.map((f, i) => ({ a: arrive[i]!.a, b: arrive[i]!.T + 0.35, cx: PLACE[f.key]![0], cy: PLACE[f.key]![1] - 30, s: 1.38 })),
    // «وتساعدنا…»: رجوع لرؤية الأدلة معًا
    { a: at(tl, "وتساعدنا") - 0.3, b: at(tl, "وتساعدنا") + 1.3, cx: 1010, cy: 1390, s: 0.88 },
    // «ولكنها لا تخبرنا بكل شيء»: تراجع أوسع والعتمة تنتشر
    { a: at(tl, "ولكنها") - 0.2, b: at(tl, "شيء") + 0.4, cx: 1010, cy: 1300, s: 0.8 },
    // «ربط…»: صعود مع الخيط نحو حد المعرفة
    { a: at(tl, "ربط") - 0.3, b: end(tl, "بشخصية") + 0.2, cx: 1380, cy: 1240, s: 1.1 },
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
                <ellipse key={f.key} cx={PLACE[f.key]![0]} cy={PLACE[f.key]![1]} rx={f.rx * K6 + 40} ry={f.ry * K6 + 40} fill="black" />
              ))}
            </g>
          </mask>
        </defs>
        <rect x={-800} y={-300} width={3600} height={HZ + 300} fill={C.parchment} />
        <rect x={-800} y={-300} width={3600} height={HZ + 300} filter="url(#s6-grain)" />
        {BANDS.map((_, i) => (
          <path key={i} d={bandPath(i)} fill={BANDS[i]!.c} />
        ))}
        {/* «في أزمنة مختلفة»: الطبقات تضيء واحدة بعد أخرى من الأعلى إلى الأسفل */}
        {BANDS.map((_, i) => {
          const s0 = at(tl, "أزمنة") - 0.1 + i * 0.2;
          const pulse = Math.sin(Math.PI * prog(t, s0, s0 + 0.7, (x) => x));
          return pulse > 0 ? <path key={`pulse-${i}`} d={bandPath(i)} fill="#FFF3DC" opacity={0.42 * pulse} /> : null;
        })}
        {STIPPLE.map((d, i) => (d.peb ? <ellipse key={i} cx={d.x} cy={d.y} rx={d.s * 2.2} ry={d.s * 1.4} fill="#4A2E1F" opacity={d.o} /> : <circle key={i} cx={d.x} cy={d.y} r={d.s} fill="#2B1E14" opacity={d.o} />))}
        {/* مسار الباحث: نقاط تصل كل خندق بالذي قبله، تُرسم والكاميرا تنتقل */}
        {words.map((f, i) => {
          if (i === 0) return null;
          const [x0, y0] = PLACE[words[i - 1]!.key]!;
          const [x1, y1] = PLACE[f.key]!;
          const p = prog(t, arrive[i]!.a, arrive[i]!.T - 0.05, (x) => x);
          return Array.from({ length: 16 }, (_, j) => {
            const u = (j + 0.5) / 16;
            return <circle key={`${i}-${j}`} cx={mix(x0, x1, u)} cy={mix(y0, y1, u) + Math.sin(u * Math.PI) * 40} r={5.5} fill="#2B1E14" opacity={u <= p ? 0.62 : 0} />;
          });
        })}
        {words.map((f, i) => {
          const { a, T } = arrive[i]!;
          const [nx, ny] = PLACE[f.key]!;
          const tw = f.rx * K6 * 2 + 70;
          const th = f.ry * K6 * 2 + 60;
          const box = `M${nx + tw / 2} ${ny - th / 2} H${nx - tw / 2} V${ny + th / 2} H${nx + tw / 2} Z`;
          const trench = prog(t, a, T - 0.05);
          const scrape = prog(t, T - 0.3, T + 0.15);
          const p = prog(t, T - 0.05, T + 0.75);
          return (
            <g key={f.key}>
              {/* خندق الحفر: يُحدَّد، ثم تُكشط تربته، ثم يظهر الأثر */}
              <path d={box} fill="#FFF3DC" opacity={0.28 * scrape + 0.34 * Math.sin(Math.PI * study(i))} />
              <Ink d={box} w={2.5} p={trench} c="#2B1E14" opacity={0.7} />
              {[-1, 1].flatMap((sx) => [-1, 1].map((sy) => <rect key={`${sx}${sy}`} x={nx + (sx * tw) / 2 - 5} y={ny + (sy * th) / 2 - 5} width={10} height={10} fill={C.ribbon} opacity={trench >= 1 ? 1 : 0} />))}
              <g transform={`translate(${nx} ${ny}) scale(${K6}) translate(${-f.cx} ${-f.cy})`}>{f.draw(p)}</g>
              <Ink d={`M${nx} ${ny - f.ry * K6 - 8} a${f.rx * K6 + 8} ${f.ry * K6 + 8} 0 1 1 -0.1 0`} w={3.5} p={study(i)} c={C.inkText} />
            </g>
          );
        })}
        <rect x={-800} y={HZ} width={3600} height={1400} fill="#1E140E" opacity={0.55 * dark} mask="url(#s6-holes)" />
        <Ink d={`M-760 ${HZ} H2680`} w={6} p={hz} />
        <Ink d="M1720 1420 C1770 1330 1670 1250 1716 1160 C1744 1100 1700 1064 1708 1030" w={5} p={thread} c={C.ribbon} />
        <circle cx={1708} cy={1030} r={7} fill={C.ribbon} opacity={thread >= 0.99 ? 1 : 0} />
      </svg>
      {noHead ? null : <div style={{ position: "absolute", right: W - 1820, top: 110, fontFamily: Amiri, fontWeight: 700, fontSize: 44, color: C.ink, direction: "rtl" }}>الفصل السابع</div>}
      {words.map((f, i) => {
        const o = prog(t, arrive[i]!.T + 0.25, arrive[i]!.T + 0.65);
        const [nx, ny] = PLACE[f.key]!;
        const th = f.ry * K6 * 2 + 60;
        return (
          <div key={f.key} style={{ position: "absolute", left: nx - 160, top: ny - th / 2 - 62, width: 320, display: "flex", justifyContent: "center", opacity: o, transform: `translateY(${(1 - o) * 8}px)` }}>
            <div style={{ padding: "2px 16px 6px", borderRadius: 8, background: "rgba(248,238,219,0.95)", fontFamily: Tajawal, fontWeight: 500, fontSize: 32, color: C.inkText, direction: "rtl", whiteSpace: "nowrap" }}>{f.label}</div>
          </div>
        );
      })}
    </Camera>
  );
};

type Spec = ReturnType<typeof mk>;
const SILENT_LABELS: Record<string, string> = { "1": "١ · الافتتاح", "2": "٢ · حد المعرفة", "4": "٤ · أقوال المفسرين (جزئية)", "5": "٥ · التوبة (قبل الآية)", "6": "٦ · الأثر وحدوده" };
const AUDIO_LABELS: Record<string, string> = { "1": "١ · الافتتاح", "2": "٢ · حد المعرفة", "3": "٣ · البقرة 30", "4": "٤ · النص والتفسير", "5": "٥ · التوبة", "6": "٦ · الأثر وحدوده" };
const COMPS: Record<string, React.FC<ShotProps>> = { "1": Shot1, "2": Shot2, "3": Shot3, "4": Shot4, "5": Shot5, "6": Shot6 };
/** نص كل لقطة (جملها كما في السكريبت المعتمد) وبدء الصوت فيها وذيلها */
export const SHOT_SPECS: Record<string, Spec> = { "1": S1, "2": S2, "3": S3, "4": S4, "5": S5, "6": S6 };
const NOTES: Record<string, Pick<ShotDef, "note" | "noteCorner">> = { "6": { note: "رسم توضيحي", noteCorner: "br" } };

/** كلمة الآية التي يُشار إليها (مثل «خليفة») كما هي في النص القرآني المكتوب بالسكريبت، بحروفها وتشكيلها */
export const pickQuranWord = (text: string, stem: string) =>
  text.split(/\s+/).find((w) => w.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, "").includes(stem));

/**
 * اللقطات: بلا وسائط = المعاينة الصامتة (أزمنة تقديرية، بلا آيات). مع وسائط = اللقطات الست بصوت الراوي الحقيقي
 * والآيات وتلاواتها: توقيت كل لقطة من كلماتها، والتلاوة بعد التمهيد بوقفة، والسكون بعدها.
 */
export const buildShots = (audio?: HorizonAudio): ShotDef[] => {
  if (!audio) {
    return ["1", "2", "4", "5", "6"].map((id) => {
      const sp = SHOT_SPECS[id]!;
      const base: ShotDef = { id, label: SILENT_LABELS[id]!, tl: sp.tl, dur: sp.dur, Comp: COMPS[id]!, ...NOTES[id] };
      return id === "4" ? { ...base, note: "إطار لفظ الآية لا يُعرض في هذه المعاينة: لا نص قرآني فيها", noteCorner: "tl2" } : base;
    });
  }
  const verse = (key: string, start: number): QuranView => {
    const v = audio.verses[key];
    if (!v) throw new Error(`نص الآية ${key} أو تلاوتها غير موجودين في الوسائط.`);
    return { key, text: v.text, reciter: v.reciter, start, dur: v.parts.reduce((n, p) => n + p.duration, 0) };
  };
  return ["1", "2", "3", "4", "5", "6"].map((id) => {
    const sp = SHOT_SPECS[id]!;
    const clip = audio.voice[id];
    if (!clip) throw new Error(`صوت الراوي للقطة ${id} غير موجود في الوسائط.`);
    const tl = timelineFromWords(sp.sentences, clip.words, sp.lead);
    const voiceEnd = Math.max(tl.end, sp.lead + clip.duration);
    const def: ShotDef = { id, label: AUDIO_LABELS[id]!, tl, dur: voiceEnd + sp.tail, Comp: COMPS[id]!, voice: { file: clip.file, at: sp.lead }, ...NOTES[id] };
    if (id === "3" || id === "5") {
      // وقفة قبل التلاوة: بعد «سورة البقرة» ثانية واحدة؛ وبعد «دعاءهما:» يخفت الخط أولًا (1.6 ث)
      const q = verse(id === "3" ? "2:30" : "7:23", voiceEnd + (id === "3" ? 1.0 : 1.6));
      return { ...def, q, recitation: { parts: audio.verses[q.key]!.parts, at: q.start }, dur: q.start + q.dur + (id === "3" ? 1.5 : 2.0) };
    }
    if (id === "4") {
      const v = audio.verses["2:30"];
      const word = v ? pickQuranWord(v.text, "خليف") : undefined;
      if (!v || !word) throw new Error("لفظ «خليفة» غير موجود في نص البقرة 30 المجلوب.");
      return { ...def, q: { key: "2:30", text: v.text, reciter: v.reciter, start: 0, dur: 0, word } };
    }
    return def;
  });
};

export const SHOTS: ShotDef[] = buildShots();
