/**
 * الدفتر بطبقاته لمشاهد «خط الأفق» في الحلقة: صفحة يمنى ويسرى وما فوقهما، بكاميرا، وخروج من المشهد
 * بقلب صفحة إلى الأمام (كتاب عربي: الصفحة اليسرى ترتفع وتنقلب فوق الكعب إلى اليمين) أو بخفوت الحبر.
 * كل مشهد يبدأ من دفتر فارغ أو من الحال التي انتهى عليها المشهد قبله، فلا قفز بين المشاهد.
 */
import React from "react";
import { BookShadow, C, Camera, Defs, GUTTER, LEFT_PAGE, LightPool, LiveFrameContext, PAGE_TOP, Page, PageHeadContext, PageStack, RIGHT_PAGE, Spine, VersePageContext, VerseWindowContext, W, captionSafeCy, mix, prog, easeIO } from "./kit";

export type Cam = { cx: number; cy: number; s: number };
export const NEUTRAL: Cam = { cx: 960, cy: 520, s: 1 };

/** كاميرا بمفاتيح متتالية: كل مفتاح ينتقل إلى (cx,cy,s) بين a وb بالثواني */
export type CamKey = { a: number; b: number } & Cam;
export const camPath = (t: number, start: Cam, keys: CamKey[]): Cam => {
  let c = { ...start };
  for (const k of keys) {
    const p = prog(t, k.a, k.b);
    c = { cx: mix(c.cx, k.cx, p), cy: mix(c.cy, k.cy, p), s: mix(c.s, k.s, p) };
  }
  return c;
};
const blend = (a: Cam, b: Cam, p: number): Cam => ({ cx: mix(a.cx, b.cx, p), cy: mix(a.cy, b.cy, p), s: mix(a.s, b.s, p) });
export const parseCam = (v?: string): Cam | undefined => {
  const n = (v ?? "").split(",").map(Number);
  return n.length === 3 && n.every(Number.isFinite) ? { cx: n[0]!, cy: n[1]!, s: n[2]! } : undefined;
};

export type Exit = "turn" | "fade" | "none";
export type Leaf = {
  cam: Cam;
  /** محتوى الصفحتين بإحداثيات العالم (SVG) */
  L?: React.ReactNode;
  R?: React.ReactNode;
  /** فوق الصفحتين وتحت الكعب (أوراق تُقلب، شريط) — يُعامل جزءًا من الصفحة اليمنى عند القلب */
  top?: React.ReactNode;
  /** نصوص HTML على كل صفحة (تنقلب اليسرى مع الورقة، وتختفي اليمنى تحتها) */
  htmlL?: React.ReactNode;
  htmlR?: React.ReactNode;
  /** الصفحة اليسرى غير ظاهرة (الدفتر مغلق) */
  noLeft?: boolean;
  /** تحت الدفتر (سطح المكتب) وفوقه خارج الصفحات (أدوات على المكتب) — بإحداثيات العالم، بلا قص */
  under?: React.ReactNode;
  over?: React.ReactNode;
  tintL?: string;
  light?: number;
};

/** قلب صفحة إلى الأمام: الورقة اليسرى (بوجهها front) تنقلب إلى اليمين، فيظهر ظهرها الفارغ على اليمين */
const FwdLeaf: React.FC<{ id: string; p: number; front: React.ReactNode }> = ({ id, p, front }) => {
  if (p <= 0 || p >= 1) return null;
  const sx = Math.cos(Math.PI * p);
  const sxSafe = Math.abs(sx) < 0.01 ? 0.01 * Math.sign(sx || 1) : sx;
  const lift = Math.sin(Math.PI * p);
  return (
    <g>
      <path d={sx > 0 ? LEFT_PAGE : RIGHT_PAGE} fill="#2B1E14" opacity={0.18 * lift} />
      <g transform={`translate(${GUTTER} ${PAGE_TOP}) skewY(${5 * lift * Math.sign(sx || 1)}) scale(${sxSafe} 1) translate(${-GUTTER} ${-PAGE_TOP})`}>
        {sx > 0 ? <Page id={id} side="l">{front}</Page> : <Page id={id} side="l" tint="rgba(74,46,31,0.05)" />}
        <path d={LEFT_PAGE} fill="#FFF6E0" opacity={sx > 0 ? 0.22 * lift : 0} />
        <path d={LEFT_PAGE} fill="#2B1E14" opacity={0.32 * (1 - Math.abs(sx))} />
      </g>
    </g>
  );
};

export const leafTransform = (p: number) => {
  const sx = Math.cos(Math.PI * p);
  const lift = Math.sin(Math.PI * p);
  return { sx, css: `translate(${GUTTER}px, ${PAGE_TOP}px) skewY(${5 * lift}deg) scale(${Math.max(0.01, sx)}, 1) translate(${-GUTTER}px, ${-PAGE_TOP}px)` };
};

/**
 * لحظة إغلاق الراوي لفكرة المشهد (نهاية آخر كلمة بالثواني من بداية المشهد)، يضعها غلاف «مشهد خط الأفق».
 * بها يبدأ قلب الصفحة أو خفوت الحبر بعد آخر كلمة بنَفَس (EXIT_BEAT) بدل ذيل ساكن ثم خروج متأخر.
 * بلا قيمة (الاختبارات والمختبرات القديمة) يبقى الخروج كما كان: قلب عند dur−0.95 وخفوت عند dur−0.75.
 */
export const SceneCloseContext = React.createContext<number | undefined>(undefined);
export const EXIT_BEAT = 0.3;
/** ثوانٍ يعود فيها الكادر إلى الدفتر كله قبل ظهور بطاقة آية */
export const VERSE_SETTLE = 0.9;

/**
 * الدفتر: from = كاميرا المشهد السابق (يبدأ منها ثم ينتقل في أول ثانية)، exit = خروج المشهد.
 * عند الخروج بالقلب تعود الكاميرا إلى الوضع العام قبله، فالمشهد التالي يبدأ من دفتر فارغ بالكادر نفسه.
 */
/** D217: الكادر يعود إلى الدفتر كله قبل بطاقة الآية ويثبت عليه طوال ظهورها (يُختبر في tests/horizon-verse-frame.test.ts) */
export const verseSettle = (cam: Cam, t: number, vwin: [number, number]): Cam => blend(cam, NEUTRAL, prog(t, vwin[0] - VERSE_SETTLE, vwin[0] - 0.05, easeIO));

/** D217: عنوان الصفحة بالحبر وتحته خط ذهبي قصير (يصل مع الصفحة) */
const HeadInk: React.FC<{ id: string; head: { text: string; side: "l" | "r"; y: number } }> = ({ id, head }) => {
  const x = head.side === "l" ? 555 : 1365;
  return (
    <g>
      <WriteIn id={`${id}-ph`} x={x} y={head.y} size={54} p={1} label={head.text} color={C.inkSoft} />
      <path d={`M${x + 90} ${head.y + 28} H${x - 90}`} stroke={C.gold} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
    </g>
  );
};

/** الخيط الأحمر في الخروج: يُمدّ من الكعب إلى الحافتين ثم يبهت */
const ExitThread: React.FC<{ p: number }> = ({ p }) => {
  const draw = Math.min(1, p * 1.6), o = 0.9 * (1 - Math.max(0, (p - 0.7) / 0.3));
  return (
    <g opacity={o}>
      <path d={`M${GUTTER} 892 C ${GUTTER - 260} 884 ${GUTTER - 520} 900 ${GUTTER - 780} 890`} fill="none" stroke={C.ribbon} strokeWidth={5} strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - draw} />
      <path d={`M${GUTTER} 892 C ${GUTTER + 260} 900 ${GUTTER + 520} 884 ${GUTTER + 780} 894`} fill="none" stroke={C.ribbon} strokeWidth={5} strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - draw} />
    </g>
  );
};

export const Book: React.FC<Leaf & { id: string; t: number; dur: number; exit?: Exit; turnAt?: number; from?: Cam }> = ({ id, t, dur, exit = "none", turnAt, from, ...leaf }) => {
  const close = React.useContext(SceneCloseContext);
  const verse = React.useContext(VersePageContext);
  const vwin = React.useContext(VerseWindowContext);
  const live = React.useContext(LiveFrameContext);
  const head = React.useContext(PageHeadContext);
  // الخروج يبدأ حين يُغلق الراوي الفكرة (بعد آخر كلمة بنَفَس قصير) لا بعد ذيل ساكن، ولا يقصر عن مدته الأصلية
  const turnStart = turnAt ?? (close !== undefined ? Math.min(dur - 0.95, close + EXIT_BEAT) : dur - 0.95);
  const turnLen = turnAt === undefined && close !== undefined ? Math.max(0.8, dur - 0.15 - turnStart) : 0.8;
  const p = exit === "turn" ? prog(t, turnStart, turnStart + turnLen, easeIO) : 0;
  const fadeStart = close !== undefined ? Math.min(dur - 0.75, close + EXIT_BEAT) : dur - 0.75;
  const fade = exit === "fade" ? prog(t, fadeStart, dur - 0.15) : 0;
  let cam = leaf.cam;
  if (from) cam = blend(from, cam, prog(t, 0, 1.0));
  // رجوع الكادر قبل القلب: لا يبدأ قبل انتهاء آخر كلمة (فلا يتحرك على كلمة الختام، ومنها ذكر الله)
  const backStart = close !== undefined && turnAt === undefined ? Math.max(turnStart - 0.7, Math.min(close + 0.05, turnStart - 0.2)) : turnStart - 0.7;
  if (exit === "turn") cam = blend(cam, NEUTRAL, prog(t, backStart, turnStart));
  // خفوت الحبر بعد إغلاق الفكرة: يتراجع الكادر معه إلى الصفحتين كاملتين، فيبدأ المشهد التالي من الدفتر كله لا من قطع
  if (exit === "fade" && close !== undefined) cam = blend(cam, NEUTRAL, prog(t, fadeStart, dur - 0.15));
  // D217: بطاقة الآية لا تظهر ناقصة أبدًا — الكادر يعود إلى الدفتر كله في الثانية التي قبلها ويثبت عليه طوال ظهورها
  if (vwin) cam = verseSettle(cam, t, vwin);
  // D217: منطقة الترجمة الآمنة — لا ينزل نص الصفحة تحت أعلى الترجمة مهما كان تأطير المشهد أو الكاميرا الحية
  if (live) cam = { ...cam, cy: Math.max(cam.cy, captionSafeCy(cam.s, live)) };
  const { sx, css } = leafTransform(p);
  const turning = p > 0 && p < 1;
  const crossed = p > 0 && sx <= 0;
  const ink = 1 - fade;
  return (
    <Camera {...cam}>
      <svg width={W} height={1080} style={{ position: "absolute", overflow: "visible" }}>
        <Defs id={id} />
        {leaf.under}
        <BookShadow />
        {leaf.noLeft ? null : <Page id={id} side="l" tint={leaf.tintL}>{p > 0 ? null : <g opacity={ink}>{leaf.L}{head?.side === "l" ? <HeadInk id={id} head={head} /> : null}</g>}</Page>}
        <Page id={id} side="r">{p >= 1 ? null : <g opacity={ink}>{leaf.R}{head?.side === "r" ? <HeadInk id={id} head={head} /> : null}</g>}</Page>
        <PageStack />
        {p >= 1 || crossed ? null : <g opacity={ink}>{leaf.top}</g>}
        {turning ? <FwdLeaf id={id} p={p} front={leaf.L} /> : null}
        <Spine />
        <LightPool o={leaf.light ?? 1} />
        {leaf.over ? <g opacity={ink * (1 - Math.min(1, p * 4))}>{leaf.over}</g> : null}
        {/* D217: تفاعل في التنقل — الخيط الأحمر يُمدّ عبر الصفحتين مع الخروج (قلبًا أو خفوتًا) */}
        {exit !== "none" && (p > 0 || fade > 0) && p < 1 ? <ExitThread p={exit === "turn" ? p : fade} /> : null}
      </svg>
      {leaf.htmlR && !crossed && p < 1 ? <div style={{ position: "absolute", inset: 0, opacity: ink }}>{leaf.htmlR}</div> : null}
      {leaf.htmlL && !crossed && p < 1 ? <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 1080, opacity: ink, transformOrigin: "0 0", transform: turning ? css : undefined }}>{leaf.htmlL}</div> : null}
      {verse && !crossed && p < 1 ? verse : null}
    </Camera>
  );
};

/** دفتر فارغ بكاميرا ثابتة يغطي ما تحته تدريجيًا (لخروج اللقطات المصممة قبل هذا البناء بخفوت الحبر) */
export const BlankBookOver: React.FC<{ id: string; cam: Cam; o: number }> = ({ id, cam, o }) =>
  o <= 0 ? null : (
    <div style={{ position: "absolute", inset: 0, opacity: o }}>
      <Camera {...cam}>
        <svg width={W} height={1080} style={{ position: "absolute", overflow: "visible" }}>
          <Defs id={id} />
          <Page id={id} side="l" />
          <Page id={id} side="r" />
          <PageStack />
          <Spine />
          <LightPool />
        </svg>
      </Camera>
    </div>
  );

const Amiri = "'Amiri', serif";
const Tajawal = "'Tajawal', sans-serif";

/** نص SVG عربي (يتصل حرفه ويُقلب مع الورقة). anchor: middle للتوسيط، start = محاذاة إلى اليمين */
export const SText: React.FC<{ x: number; y: number; size: number; o?: number; dy?: number; font?: "amiri" | "tajawal"; weight?: number; color?: string; anchor?: "middle" | "start" | "end"; children: React.ReactNode }> = ({ x, y, size, o = 1, dy = 0, font = "amiri", weight = 700, color = C.inkText, anchor = "middle", children }) =>
  o <= 0 ? null : (
    <text x={x} y={y + dy} fontFamily={font === "amiri" ? Amiri : Tajawal} fontWeight={weight} fontSize={size} fill={color} textAnchor={anchor} direction="rtl" opacity={o}>
      {children}
    </text>
  );

/** رأس الفصل الصغير أعلى الصفحة اليمنى، وشريطه الأحمر */
export const ChapterHead: React.FC<{ label: string; o?: number }> = ({ label, o = 1 }) => (
  <g opacity={o}>
    <SText x={1680} y={140} size={40} anchor="start" color={C.ink}>
      {label}
    </SText>
    <path d="M1700 72 H1736 V156 L1718 142 L1700 156 Z" fill={C.ribbon} />
  </g>
);

/** دبوس مكان صغير (حبر) */
export const Pin: React.FC<{ x: number; y: number; s?: number; o?: number }> = ({ x, y, s = 1, o = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o}>
    <path d="M0 0 C-14 -20 -22 -30 -22 -44 A22 22 0 1 1 22 -44 C22 -30 14 -20 0 0 Z" fill={C.ribbon} stroke={C.ink} strokeWidth={3} />
    <circle cx={0} cy={-44} r={8} fill={C.page} stroke={C.ink} strokeWidth={2} />
  </g>
);

/** شريط التاريخ الأحمر بخانة سنة فارغة (عنصر الهوية) */
export const DateRibbon: React.FC<{ x: number; y: number; s?: number; o?: number }> = ({ x, y, s = 1, o = 1 }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`} opacity={o}>
    <path d="M-35 0 H35 V200 L0 170 L-35 200 Z" fill={C.ribbon} stroke={C.ink} strokeWidth={2} />
    <rect x={-28} y={70} width={56} height={84} rx={4} fill={C.page} stroke={C.ink} strokeWidth={2} />
  </g>
);

export const fonts = { Amiri, Tajawal };

/** ختم ذهبي: ما ورد في القرآن الكريم (مرجعه تحته) */
export const QuranSeal: React.FC<{ x: number; y: number; o?: number; refText?: string; s?: number }> = ({ x, y, o = 1, refText, s = 1 }) =>
  o <= 0 ? null : (
    <g opacity={o} transform={`translate(${x} ${y}) scale(${s * (0.85 + 0.15 * o)})`}>
      <circle r={44} fill={C.gold} stroke={C.ink} strokeWidth={2.5} />
      <circle r={36} fill="none" stroke={C.page} strokeWidth={1.5} strokeDasharray="3 5" />
      <SText x={0} y={9} size={22} font="tajawal" weight={700} color={C.page}>
        القرآن
      </SText>
      {refText ? (
        <SText x={0} y={82} size={28} font="tajawal" weight={700} color={C.ink}>
          {refText}
        </SText>
      ) : null}
    </g>
  );

/** لسان أحمر: ما ذكره المفسرون (المصدر عليه) */
export const TafsirTab: React.FC<{ x: number; y: number; o?: number; label: string; w?: number }> = ({ x, y, o = 1, label, w = 300 }) =>
  o <= 0 ? null : (
    <g opacity={o}>
      <path d={`M${x} ${y} h${-w} v44 h${w} l-14 -22 Z`} fill={C.ribbon} />
      <SText x={x - 26} y={y + 31} size={24} font="tajawal" weight={700} color={C.page} anchor="start">
        {label}
      </SText>
    </g>
  );

/**
 * كتابة بالحبر: الكلمة تنكشف من اليمين إلى اليسار خلف سنّ قلم صغير، كأنها تُكتب الآن على الصفحة.
 * تُستعمل للمصطلحات التي يدوّنها الكاتب (عنوان فكرة)، بدل الظهور والارتفاع، ولكلمة واحدة أو كلمتين فقط.
 */
export const WriteIn: React.FC<{ id: string; x: number; y: number; size: number; p: number; label: string; color?: string; font?: "amiri" | "tajawal"; weight?: number }> = ({ id, x, y, size, p, label, color = C.ink, font = "amiri", weight = 700 }) => {
  if (p <= 0) return null;
  // العرض بعدد الحروف المرسومة: الحركات والتطويل لا تزيد العرض (الحلقة 001 بلا تشكيل، فلا يتغير شيء فيها)
  const w = size * (font === "amiri" ? 0.44 : 0.52) * label.replace(/[\u064B-\u0652\u0670\u0640]/g, "").length + 30;
  const right = x + w / 2;
  const front = right - Math.min(1, p) * w;
  return (
    <g>
      <defs>
        <clipPath id={`wi-${id}`}>
          <rect x={front} y={y - size * 1.25} width={right - front + 6} height={size * 1.8} />
        </clipPath>
      </defs>
      <g clipPath={`url(#wi-${id})`}>
        <SText x={x} y={y} size={size} font={font} weight={weight} color={color}>
          {label}
        </SText>
      </g>
      {p < 1 ? <circle cx={front} cy={y - size * 0.3} r={Math.max(4, size * 0.06)} fill={C.ink} opacity={0.8} /> : null}
    </g>
  );
};
