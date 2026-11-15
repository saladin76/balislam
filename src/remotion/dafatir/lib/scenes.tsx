/**
 * مشاهد المكتبة العامة لـ«دفاتر الزمن»: تُضبط كلها من حقول الخطة (لا نص حلقة بعينها في الكود)،
 * وكل حدث فيها يقع لحظة نطق كلمته (حقول «…Word»)، وتتأخر الأحداث وحركة الكاميرا تلقائيًا عن نافذة ذكر الله.
 * التوثيق وحدود الاستعمال: docs/dafatir-alzaman/03-tools.md. مشاهد الحلقة 001 الخاصة بها في horizon/episode001*.tsx.
 */
import React from "react";
import { at as atStrict, end as endStrict, type Timeline } from "../horizon/timeline";
import { C, Ink, easeOut, mix, prog } from "../horizon/kit";
import { Book, ChapterHead, NEUTRAL, SText, TafsirTab, WriteIn, camPath, fonts, type Cam, type CamKey, type Exit } from "../horizon/book";
import { VerseRefPanel } from "../horizon/verseRef";
import { FINDS, FindAt } from "./drawings";
import { Stamp } from "./compare";
import { Flow, letterCount } from "./text";
import { LIB_SACRED } from "./meta";

export type ShotProps = { t: number; tl: Timeline; dur: number; exit: Exit; from?: Cam; p: Record<string, string | undefined> };
const { Tajawal, Amiri } = fonts;
const pop = (t: number, a: number, d = 0.45) => prog(t, a - 0.05, a - 0.05 + d, easeOut);

// ───────────────────────── التوقيت الآمن ─────────────────────────

const norm = (w: string) => w.replace(/[ً-ْٰـ]/g, "").replace(/[ىی]/g, "ي").replace(/[أإآ]/g, "ا");
const firstWord = (s?: string) => (s ?? "").trim().split(/\s+/)[0] ?? "";

/** نوافذ ذكر الله في التوقيت: من قبل الكلمة بربع ثانية إلى ما بعدها بربع ثانية (القاعدة نفسها في stillness.ts) */
export const sacredWindows = (tl: Timeline): [number, number][] => tl.words.filter((w) => LIB_SACRED.test(norm(w.w))).map((w) => [w.s - 0.25, w.e + 0.25]);

/**
 * مرسى الحدث: «كلمة» أو «كلمة#2» (الورود الثاني). إن غابت الكلمة عن النص يُستعمل البديل، ويُسجَّل الغياب
 * (فحص المكتبة يرفض أي مرسى غائب في الخطة). safe يؤخر أي حركة تتقاطع مع نافذة ذكر الله إلى ما بعدها.
 */
/**
 * حدود الكاميرا في مشاهد المكتبة (الأمر 019): لا يُظهر الكادر المقرَّب ما وراء حدود الكادر المحايد (فلا يتسع ما خلف الصفحة)،
 * ومع رأس الصفحة (keepTop) لا يُقص الرأس من الأعلى.
 */
export const boundCam = (c: Cam, keepTop = false): Cam => {
  if (c.s <= 1) return c;
  const hw = 960 / c.s;
  const hh = 540 / c.s;
  let cy = Math.min(Math.max(c.cy, hh), 1080 - hh);
  if (keepTop) cy = Math.min(cy, 60 + hh);
  return { cx: Math.min(Math.max(c.cx, hw), 1920 - hw), cy, s: c.s };
};

export const cues = (tl: Timeline, opts: { keepTop?: boolean } = {}) => {
  const wins = sacredWindows(tl);
  const missing: string[] = [];
  const parse = (a: string) => {
    const [w, n] = a.split("#");
    return { w: w!.trim(), n: Number(n) || 1 };
  };
  const safe = (a: number, len = 0.6) => {
    let s = a;
    for (let guard = 0; guard < 8; guard++) {
      const hit = wins.find(([x, y]) => s < y && s + len > x);
      if (!hit) break;
      s = hit[1] + 0.02;
    }
    return s;
  };
  const at = (anchor: string | undefined, fallback: number) => {
    if (!anchor) return fallback;
    const { w, n } = parse(anchor);
    try {
      return atStrict(tl, w, n);
    } catch {
      missing.push(anchor);
      return fallback;
    }
  };
  const end = (anchor: string | undefined, fallback: number) => {
    if (!anchor) return fallback;
    const { w, n } = parse(anchor);
    try {
      return endStrict(tl, w, n);
    } catch {
      missing.push(anchor);
      return fallback;
    }
  };
  /** كاميرا بمفاتيح آمنة: كل مفتاح يتأخر عن نافذة ذكر الله إن تقاطع معها */
  const cam = (t: number, start: Cam, keys: CamKey[]) =>
    camPath(
      t,
      boundCam(start, opts.keepTop),
      keys
        .map((k) => {
          const a = safe(k.a, k.b - k.a);
          return { ...k, ...boundCam(k, opts.keepTop), a, b: a + (k.b - k.a) };
        })
        .sort((x, y) => x.a - y.a),
    );
  return { at, end, safe, cam, missing, last: tl.words.length ? tl.words[tl.words.length - 1]!.e : 0.3 };
};

/** «مرسى = نص» سطرًا سطرًا (أو مفصولة بـ |) */
export const parseItems = (v?: string) =>
  (v ?? "")
    .split(/\n|\|/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf("=");
      const anchor = i < 0 ? line : line.slice(0, i).trim();
      const text = i < 0 ? line : line.slice(i + 1).trim();
      const uncertain = anchor.startsWith("?") || anchor.startsWith("؟");
      return { anchor: anchor.replace(/^[?؟]/, ""), text, uncertain };
    });

/** كل المراسي التي تطلبها حقول مشهد مكتبة (لفحص الخطة) */
export const libAnchors = (shot: string, p: Record<string, string | undefined>): string[] => {
  const f = (k: string) => (p[k] ? [p[k]!] : []);
  switch (shot) {
    case "lib-term":
      return [p.termWord || firstWord(p.term), ...f("subWord"), ...f("sourceWord"), ...f("noteWord")].filter(Boolean);
    case "lib-gloss":
      return [...f("matnWord"), ...f("tafsirWord"), ...f("noteWord")];
    case "lib-compare":
      return [...(p.title ? [p.titleWord || firstWord(p.title)] : []), ...f("aWord"), ...f("bWord"), ...f("verdictWord")];
    case "verse-tag":
      return [...f("tagWord"), ...(p.lead ? [p.leadWord || firstWord(p.lead)] : [])];
    case "lib-names":
      return [...f("wordWord"), ...f("allWord"), ...f("emptyWord"), ...f("toWord")];
    case "lib-descent":
      return [...f("fallWord"), ...f("landWord"), ...f("pathWord"), ...(p.term ? [p.termWord || firstWord(p.term)] : []), ...f("safeWord")];
    case "lib-timeline":
    case "lib-evidence":
      return [...parseItems(p.items).map((x) => x.anchor), ...f("limitWord")];
    default:
      return [];
  }
};

/** أوقات كلمات نص معروض: كل كلمة لحظة نطقها إن وردت في الكلام بعد البداية، وإلا بعد سابقتها بقليل */
const wordTimes = (text: string, tl: Timeline, start: number, step = 0.16) => {
  let prev = start - step;
  let k = tl.words.findIndex((w) => w.s >= start - 0.01);
  if (k < 0) k = tl.words.length;
  return text.split(/\s+/).filter(Boolean).map((w) => {
    const c = norm(w.replace(/[،,.:؛«»"()؟]/g, ""));
    const j = tl.words.findIndex((x, i) => i >= k && norm(x.w) === c);
    if (j >= 0 && tl.words[j]!.s - prev < 2.5) {
      k = j + 1;
      prev = tl.words[j]!.s;
    } else prev += step;
    return { w, t: prev };
  });
};

const Head: React.FC<{ p: ShotProps["p"] }> = ({ p }) => (p.head ? <ChapterHead label={p.head} /> : null);

// ───────────────────── مشاهد عامة نُقلت من الحلقة 001 كما هي ─────────────────────

// عنوان الفصل (بلا كلام): يُكتب كبيرًا ثم يصغر إلى رأس الصفحة
const Chapter: React.FC<ShotProps> = ({ t, dur, exit, p }) => {
  const label = p.label ?? "";
  const big = prog(t, 0.05, 0.7, easeOut);
  const shrink = prog(t, 2.0, 2.8);
  const orn = prog(t, 0.0, 0.5);
  const rule = prog(t, 0.35, 1.1);
  const title = p.title ?? "";
  const R = (
    <g>
      <g opacity={1 - shrink} transform={`translate(${shrink * 200} ${-shrink * 280}) translate(1365 470) scale(${1 - 0.55 * shrink}) translate(-1365 -470)`}>
        <Ink d="M1345 330 H1385 L1371 360 L1385 390 H1345 L1359 360 Z" w={3} p={orn} c={C.gold} fill={C.gold} fillP={0.35 * orn} />
        <SText x={1365} y={500} size={118} o={big} dy={(1 - big) * 16} color={C.ink}>
          {label}
        </SText>
        {title ? (
          <SText x={1365} y={600} size={60} o={prog(t, 0.4, 1.0)} color={C.inkSoft}>
            {title}
          </SText>
        ) : null}
        <Ink d={`M1520 ${title ? 650 : 560} H1210`} w={3} p={rule} c={C.gold} />
      </g>
      <g transform={`translate(0 ${(1 - prog(t, 0.3, 0.9, easeOut)) * -90})`}>
        <path d="M1700 72 H1736 V156 L1718 142 L1700 156 Z" fill={C.ribbon} />
      </g>
      <SText x={1680} y={140} size={40} anchor="start" color={C.ink} o={prog(t, 2.3, 2.9)}>
        {label}
      </SText>
    </g>
  );
  // الكاميرا تقترب من العنوان وهو يُكتب، ثم تعود إلى الصفحة كاملة وهو يصغر إلى رأسها: تبدأ وتنتهي على الكادر العام
  // فلا قفز من قلب صفحة الفصل السابق ولا إلى المشهد التالي
  const cam = camPath(t, NEUTRAL, [
    { a: 0.0, b: 1.7, cx: 1300, cy: 480, s: 1.14 },
    { a: 1.9, b: Math.min(dur, 3.2) - 0.15, ...NEUTRAL },
  ]);
  return <Book id="ch" t={t} dur={dur} exit={exit} cam={cam} R={R} />;
};

// تمهيد آية: صفحة ساكنة عليها مرجع الآية القادمة (لا نصّها)
const VerseIntro: React.FC<ShotProps> = ({ t, dur, exit, p }) => (
  <Book id="vi" t={t} dur={dur} exit={exit} cam={NEUTRAL} R={<g><ChapterHead label={p.head ?? ""} />{p.ref ? <VerseRefPanel refText={p.ref} o={prog(t, 0, 0.25)} /> : null}</g>} />
);

// تمهيد آية بمرجعها: صفحة ساكنة، يظهر عليها ختم السورة لحظة ذكرها فقط
const VerseTag: React.FC<ShotProps> = ({ t, tl, dur, exit, p }) => {
  const seal = p.tagWord ? pop(t, atStrict(tl, p.tagWord)) : 0;
  // سطر تمهيد اختياري (V8، ١١ نوفمبر): يُكتب على الصفحة اليسرى لحظة نطق كلمته، بعيدًا عن نافذة ذكر الله
  const q = cues(tl);
  const leadA = p.lead ? q.safe(q.at(p.leadWord || firstWord(p.lead), 0.4) - 0.05, 0.9) : Infinity;
  const lead = prog(t, leadA, leadA + 0.9);
  const leadRule = prog(t, leadA + 0.7, leadA + 1.3);
  return (
    <Book
      id="vt"
      t={t}
      dur={dur}
      exit={exit}
      cam={NEUTRAL}
      L={p.lead ? (
        <g>
          <WriteIn id="vtl" x={555} y={520} size={72} p={lead} label={p.lead} color={C.ink} />
          <Ink d="M740 565 H370" w={4} p={leadRule} c={C.gold} />
        </g>
      ) : undefined}
      R={
        <g>
          {p.head ? <ChapterHead label={p.head} /> : null}
          {p.ref ? <VerseRefPanel refText={p.ref} o={seal} /> : null}
        </g>
      }
    />
  );
};

// ───────────────────────── بطاقات الأسماء (V8، ١١ نوفمبر) ─────────────────────────
/**
 * «علّم آدم الأسماء» ثم «عرض المسميات» ثم «أنبئهم بأسمائها»: بطاقات ورق صغيرة على الصفحة اليسرى، سطورها حبر مجرد
 * (لا أسماء مخترعة ولا حروف). mode: learn = تُكتب السطور لحظة «wordWord» وتتكاثر عند «allWord» ·
 * present = تدخل فارغة لحظة كلمتها، وسطورها منقّطة فارغة عند «emptyWord» · name = فارغة منقّطة ثم تمتلئ بالحبر واحدة واحدة لحظة كلمتها.
 * ومرجع الآية (ref) لوحة على اليمنى. لا ملائكة مرسومة ولا شخص: البطاقات وحدها.
 */
const CARDS = [
  { x: 330, y: 330, r: -4 },
  { x: 560, y: 300, r: 3 },
  { x: 300, y: 560, r: 2 },
  { x: 540, y: 540, r: -3 },
  { x: 420, y: 760, r: 4 },
  { x: 660, y: 740, r: -2 },
];
const NameCard: React.FC<{ x: number; y: number; r: number; o: number; ink: number; dashed: number }> = ({ x, y, r, o, ink, dashed }) =>
  o <= 0 ? null : (
    <g opacity={o} transform={`translate(${x} ${y}) rotate(${r}) scale(${0.92 + 0.08 * o})`}>
      <rect x={-105} y={-62} width={210} height={124} rx={10} fill="#FFFAF0" stroke={C.ink} strokeWidth={3} />
      <rect x={-95} y={-52} width={190} height={104} rx={6} fill="none" stroke={C.gold} strokeWidth={1.5} />
      <circle cx={78} cy={-34} r={6} fill={C.gold} />
      {dashed > 0 ? <g opacity={dashed * (1 - ink)}>{[-10, 24].map((dy) => <line key={dy} x1={-70} x2={60} y1={dy} y2={dy} stroke={C.inkSoft} strokeWidth={3} strokeDasharray="8 9" />)}</g> : null}
      <Ink d="M62 -6 C30 -12 0 -2 -28 -8 C-44 -11 -58 -6 -70 -8" w={5} p={Math.min(1, ink * 1.6)} />
      <Ink d="M62 26 C36 22 6 30 -36 24" w={4} p={Math.max(0, ink * 1.6 - 0.6)} c={C.inkSoft} />
    </g>
  );
const Names: React.FC<ShotProps> = ({ t, tl, dur, exit, from, p }) => {
  const q = cues(tl);
  const mode = p.mode ?? "learn";
  const wA = q.safe(q.at(p.wordWord, 0.5) - 0.05, 0.8);
  const allA = p.allWord ? q.safe(q.at(p.allWord, wA + 0.8) - 0.05, 0.8) : Infinity;
  const emA = p.emptyWord ? q.safe(q.at(p.emptyWord, wA + 1) - 0.05, 0.6) : Infinity;
  // toWord: «عرضها على…» — البطاقات تُقدَّم نحو الصفحة اليمنى لحظة كلمتها
  const toA = p.toWord ? q.safe(q.at(p.toWord, wA + 0.8) - 0.05, 0.7) : Infinity;
  const shift = prog(t, toA, toA + 0.7, easeOut) * 70;
  const n = mode === "learn" ? (t < allA ? 2 : 6) : 6;
  const cards = CARDS.map((c, i) => {
    // learn: بطاقتان عند الكلمة، والبقية تنفرج عند «كلها» · present/name: كلها تدخل عند الكلمة متتابعة
    const t0 = mode === "learn" ? (i < 2 ? wA + i * 0.25 : allA + (i - 2) * 0.12) : wA + i * 0.1;
    // pop يبدأ قبل مرساه بـ0.05؛ المرسى هنا وقت آمن محسوب، فيبدأ عنده تمامًا (لا يدخل نافذة ذكر الله)
    const o = mode === "learn" && i >= 2 && !Number.isFinite(allA) ? 0 : pop(t, t0 + 0.05, 0.45);
    const ink = mode === "learn" ? prog(t, t0 + 0.2, t0 + 1.1) : mode === "name" ? prog(t, wA + 0.25 + i * 0.18, wA + 1.0 + i * 0.18) : 0;
    const dashed = mode === "present" ? prog(t, emA, emA + 0.5) : mode === "name" ? 1 : 0;
    return { ...c, o: i < n || mode !== "learn" ? o : 0, ink, dashed };
  });
  // name: البطاقات فارغة من أول المشهد (كما انتهى العرض) ثم تمتلئ
  if (mode === "name") for (const c of cards) c.o = Math.max(c.o, prog(t, 0, 0.4));
  const cam = q.cam(t, { cx: 960, cy: 540, s: 1 }, [{ a: wA, b: wA + 1.0, cx: 760, cy: 540, s: 1.12 }]);
  return (
    <Book id="lnm" t={t} dur={dur} exit={exit} from={from} cam={cam}
      L={<g transform={`translate(${shift} 0)`}>{cards.map((c, i) => <NameCard key={i} {...c} />)}</g>}
      R={<g>{p.head ? <ChapterHead label={p.head} /> : null}{p.ref ? <VerseRefPanel refText={p.ref} o={prog(t, 0, 0.3)} /> : null}</g>} />
  );
};

// ───────────────────────── الهبوط إلى الأرض (V8، ١١ نوفمبر؛ أُعيد بعد ملاحظة المالك n5e4cc7da30، D138) ─────────────────────────
/**
 * «هبطا إلى الأرض… ومن اتبع هداية الله نال وعده بالأمن…». لا يُمثَّل آدم ولا زوجه بشيء: لا نقطة ولا قوس هبوط
 * («حركة الهبوط غير مناسبة ابدا»). الصفحة ترسم المكان الذي هبطا إليه: خط الأرض وتلالها لحظة fallWord، وشمس الأفق
 * (بصمة «دفتر الأفق») لحظة landWord، ثم طريق ذهبي إلى الضوء لحظة pathWord، وكلمة term ذهبًا عند termWord،
 * ثم يتسع ضوء الأفق على الأرض لحظة safeWord («بالأمن»). الكادر ثابت على الصفحتين فلا تُقص بطاقة الآية.
 */
const Descent: React.FC<ShotProps> = ({ t, tl, dur, exit, from, p }) => {
  const q = cues(tl);
  const fA = q.safe(q.at(p.fallWord, 0.8) - 0.1, 1.2);
  const lA = q.safe(Math.max(q.at(p.landWord, fA + 0.9) - 0.1, fA + 0.5), 0.8);
  const pA = p.pathWord ? q.safe(q.at(p.pathWord, lA + 1) - 0.05, 1.1) : Infinity;
  const tA = p.term ? q.safe(q.at(p.termWord || firstWord(p.term), pA + 0.8) - 0.05, 0.9) : Infinity;
  const sA = p.safeWord ? q.safe(q.at(p.safeWord, tA + 1) - 0.05, 1.2) : Infinity;
  const ground = prog(t, fA, fA + 1.0, easeOut);
  const hills = prog(t, fA + 0.3, fA + 1.4, easeOut);
  const sun = prog(t, lA, lA + 0.8, easeOut);
  const road = prog(t, pA, pA + 1.1, easeOut);
  const term = prog(t, tA, tA + 0.9);
  const glow = prog(t, sA, sA + 1.2, easeOut);
  const cam = q.cam(t, { cx: 960, cy: 540, s: 1 }, []);
  return (
    <Book id="lds" t={t} dur={dur} exit={exit} from={from} cam={cam}
      L={
        <g>
          <defs>
            <radialGradient id="lds-glow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor={C.gold} stopOpacity={0.5} />
              <stop offset="1" stopColor={C.gold} stopOpacity={0} />
            </radialGradient>
          </defs>
          <ellipse cx={700} cy={600} rx={120 + 200 * glow} ry={70 + 110 * glow} fill="url(#lds-glow)" opacity={sun * (0.35 + 0.65 * glow)} />
          <Ink d="M654 600 A46 46 0 0 1 746 600" w={6} p={sun} c={C.gold} />
          <Ink d="M220 600 H880" w={5} p={ground} />
          <Ink d="M240 600 C300 566 360 560 430 600 M480 600 C540 556 600 552 640 590 M760 594 C800 572 840 574 870 600" w={4} p={hills} c={C.inkSoft} />
          <Ink d="M430 900 C500 790 600 690 686 606" w={6} p={road} c={C.gold} />
          <Ink d="M640 900 C660 800 690 700 712 606" w={6} p={road} c={C.gold} />
          {p.term ? <WriteIn id="ldt" x={560} y={420} size={64} p={term} label={p.term} color={C.gold} /> : null}
        </g>
      }
      R={<g>{p.head ? <ChapterHead label={p.head} /> : null}{p.ref ? <VerseRefPanel refText={p.ref} o={prog(t, 0, 0.3)} /> : null}</g>} />
  );
};

// قيد التصميم: مكان المشهد في الخطة، بفكرته المكتوبة
const Pending: React.FC<ShotProps> = ({ t, dur, exit, p }) => (
  <>
    <Book id="pd" t={t} dur={dur} exit={exit} cam={NEUTRAL} R={p.head ? <ChapterHead label={p.head} /> : undefined} />
    <div style={{ position: "absolute", left: 360, right: 360, top: 330, padding: "28px 40px 32px", border: "3px dashed rgba(241,228,203,0.7)", borderRadius: 14, background: "rgba(13,10,20,0.78)", color: C.parchment, direction: "rtl", textAlign: "center", fontFamily: Tajawal }}>
      <div style={{ fontSize: 30, fontWeight: 700, color: C.sand }}>قيد التصميم{p.batch ? ` — الدفعة ${p.batch}` : ""}</div>
      <div style={{ marginTop: 14, fontSize: 34, fontWeight: 500, lineHeight: 1.5 }}>{p.idea ?? ""}</div>
    </div>
  </>
);

// ───────────────────────── شارة المصدر (فصل المصادر) ─────────────────────────

/**
 * شارة المرجع القرآني في المكتبة (الأمر 019، L1b): ختم أكبر على ورق فاتح بحد ذهبي، و«القرآن» بالحبر الداكن (تباين عالٍ)،
 * والمرجع بالأميري بحجم يُقرأ في المشغّل وعلى عرض هاتف. بلا نص آية أبدًا. لا يغيّر ختم الحلقة 001 (QuranSeal).
 */
export const QuranRefBadge: React.FC<{ x: number; y: number; o: number; refText: string }> = ({ x, y, o, refText }) => {
  if (o <= 0) return null;
  const ref = refText.replace(" · ", ": ");
  const w = Math.max(320, 34 * letterCount(ref) + 210);
  return (
    <g opacity={o} transform={`translate(${x} ${y}) scale(${0.94 + 0.06 * o}) translate(${-x} ${-y})`}>
      <rect x={x - w / 2} y={y - 50} width={w} height={100} rx={50} fill="#FFFAF0" stroke={C.gold} strokeWidth={4} />
      <circle cx={x + w / 2 - 56} cy={y} r={44} fill="#F3E3BC" stroke={C.gold} strokeWidth={4} />
      <SText x={x + w / 2 - 56} y={y + 10} size={29} font="tajawal" weight={800} color={C.ink}>
        القرآن
      </SText>
      <SText x={x - 40} y={y + 18} size={54} color={C.ink}>
        {ref}
      </SText>
    </g>
  );
};

/** quran: ختم ذهبي بمرجعه (بلا نص آية) · tafsir: لسان أحمر باسم المفسر · note: تعليق القناة بحبر خفيف */
const SourceBadge: React.FC<{ kind?: string; source?: string; o: number; x: number; y: number }> = ({ kind, source, o, x, y }) => {
  if (o <= 0 || !kind) return null;
  if (kind === "quran") return <QuranRefBadge x={x} y={y} o={o} refText={source ?? ""} />;
  if (kind === "tafsir") return <TafsirTab x={x + 290} y={y - 30} o={o} label={source ?? "تفسير"} w={Math.max(220, 26 * letterCount(source ?? "تفسير") + 70)} />;
  return (
    <SText x={x} y={y} size={30} font="tajawal" weight={500} color={C.inkSoft} o={o}>
      {source ?? ""}
    </SText>
  );
};

// ───────────────────────── مصطلح يُكتب بالحبر ─────────────────────────
/**
 * lib-term: كلمة أو كلمتان يدوّنهما الكاتب على الصفحة اليمنى بالحبر لحظة نطقهما، وخط ذهبي تحتهما،
 * ثم سطر شرح يُكتب كلمة كلمة، وشارة المصدر، وتعليق اختياري في هامش الصفحة اليسرى. الكاميرا تقترب عند الكتابة وتتراجع عند الشرح.
 */
const Term: React.FC<ShotProps> = ({ t, tl, dur, exit, from, p }) => {
  const q = cues(tl, { keepTop: Boolean(p.head) });
  const term = p.term ?? "";
  const n = letterCount(term);
  const len = Math.min(1.4, 0.4 + 0.08 * n);
  const tA = q.safe(q.at(p.termWord || firstWord(term), 0.4) - 0.05, len);
  const write = prog(t, tA, tA + len);
  const rule = prog(t, tA + len - 0.1, tA + len + 0.5);
  const size = n <= 7 ? 132 : n <= 12 ? 104 : 84;
  const sA = p.sub ? q.safe(q.at(p.subWord || firstWord(p.sub), tA + len + 0.3) - 0.05, 0.4) : Infinity;
  const badge = p.kind ? pop(t, q.safe(q.at(p.sourceWord, tA + len + 0.2), 0.5)) : 0;
  const nA = p.note ? q.safe(q.at(p.noteWord || firstWord(p.note), Math.max(sA, tA) + 1.2) - 0.05, 0.6) : Infinity;
  const noteBox = prog(t, nA, nA + 0.6);
  const cam = q.cam(t, { cx: 1365, cy: 520, s: 1.04 }, [
    { a: tA - 0.25, b: tA + len, cx: 1365, cy: 470, s: 1.2 },
    ...(Number.isFinite(sA) ? [{ a: sA - 0.2, b: sA + 0.6, cx: 1365, cy: 540, s: 1.06 }] : []),
    ...(Number.isFinite(nA) ? [{ a: nA - 0.3, b: nA + 0.6, cx: 960, cy: 520, s: 1 }] : []),
  ]);
  const R = (
    <g>
      <Head p={p} />
      <SourceBadge kind={p.kind} source={p.source} o={badge} x={1365} y={p.kind === "tafsir" ? 260 : 250} />
      <WriteIn id="lt" x={1365} y={480} size={size} p={write} label={term} color={p.color === "clay" ? "#8A5A3C" : C.ink} />
      <Ink d="M1560 530 H1170" w={4} p={rule} c={C.gold} />
    </g>
  );
  const htmlR = p.sub ? <Flow now={t} items={wordTimes(p.sub, tl, sA + 0.05)} style={{ left: 1030, top: 575, width: 670, fontFamily: Tajawal, fontWeight: 500, fontSize: 46, color: C.inkText }} /> : null;
  const htmlL = p.note ? (
    <div style={{ position: "absolute", left: 250, top: 300, width: 600, padding: "26px 30px 30px", border: `3px dashed ${C.inkSoft}`, borderRadius: 10, opacity: noteBox, direction: "rtl" }}>
      <div style={{ fontFamily: Tajawal, fontWeight: 700, fontSize: 26, color: C.inkSoft }}>تعليق</div>
      <Flow now={t} items={wordTimes(p.note, tl, nA + 0.1)} style={{ position: "relative", marginTop: 8, fontFamily: Amiri, fontWeight: 700, fontSize: 44, color: C.inkSoft, textAlign: "right" }} />
    </div>
  ) : null;
  return <Book id="lt" t={t} dur={dur} exit={exit} from={from} cam={cam} R={R} htmlR={htmlR} htmlL={htmlL} />;
};

// ───────────────────────── متن وحاشية وتعليق ─────────────────────────
/**
 * lib-gloss: ثلاث طبقات لا تختلط. الصفحة اليمنى للأصل: مرجع قرآني (ref: ختم وإطار ذهبي، بلا نص آية أبدًا)
 * أو نص مصدر غير قرآني قصير (matn) في إطار حبر بمصدره. الصفحة اليسرى للحاشية (tafsir) بلسانها الأحمر ومصدرها،
 * وتحتها تعليق القناة (note) بإطار متقطع وحبر خفيف. الكاميرا تتبع القراءة من الأصل إلى الحاشية إلى التعليق.
 */
const Gloss: React.FC<ShotProps> = ({ t, tl, dur, exit, from, p }) => {
  const q = cues(tl, { keepTop: Boolean(p.head) });
  const mA = q.safe(q.at(p.matnWord, 0.4) - 0.05, 0.6);
  const tA = p.tafsir ? q.safe(q.at(p.tafsirWord || firstWord(p.tafsir), mA + 1.6) - 0.1, 0.6) : Infinity;
  const nA = p.note ? q.safe(q.at(p.noteWord || firstWord(p.note), Math.min(tA, 99) + 2) - 0.1, 0.6) : Infinity;
  const matn = prog(t, mA, mA + 0.6, easeOut);
  const card = prog(t, tA, tA + 0.6, easeOut);
  const note = prog(t, nA, nA + 0.6, easeOut);
  const cam = q.cam(t, { cx: 1365, cy: 500, s: 1.08 }, [
    ...(Number.isFinite(tA) ? [{ a: tA - 0.3, b: tA + 0.7, cx: 560, cy: 480, s: 1.1 }] : []),
    ...(Number.isFinite(nA) ? [{ a: nA - 0.3, b: nA + 0.6, cx: 560, cy: 600, s: 1.1 }] : []),
    { a: q.last + 0.2, b: q.last + 1.1, cx: 960, cy: 520, s: 1 },
  ]);
  const R = (
    <g>
      <Head p={p} />
      {p.ref ? <VerseRefPanel refText={p.ref} o={matn} /> : null}
      {!p.ref && p.matn ? <Ink d="M1690 300 H1040 V620 H1690 Z" w={3.5} p={matn} c={C.ink} /> : null}
    </g>
  );
  const htmlR =
    !p.ref && p.matn ? (
      <div style={{ position: "absolute", left: 1040, top: 300, width: 650, height: 320, direction: "rtl" }}>
        <div style={{ position: "absolute", right: 24, top: -40, padding: "4px 18px 8px", background: C.ink, color: C.page, fontFamily: Tajawal, fontWeight: 700, fontSize: 26, borderRadius: "6px 6px 0 0", opacity: matn }}>{p.matnLabel ?? "النص"}</div>
        <Flow now={t} items={wordTimes(p.matn, tl, mA + 0.1)} style={{ left: 30, top: 70, width: 590, fontFamily: Amiri, fontWeight: 700, fontSize: 52, color: C.inkText, lineHeight: 1.6 }} />
        <div style={{ position: "absolute", right: 30, bottom: 22, fontFamily: Tajawal, fontWeight: 500, fontSize: 26, color: C.inkSoft, opacity: prog(t, mA + 0.8, mA + 1.3) }}>{p.matnSource ?? ""}</div>
      </div>
    ) : null;
  const htmlL = (
    <>
      {p.tafsir ? (
        <div style={{ position: "absolute", left: 250, top: 230, width: 620, minHeight: 300, padding: "54px 34px 60px", boxSizing: "border-box", background: "#FFFAF0", border: "3px solid rgba(74,46,31,0.6)", borderRadius: 8, boxShadow: "0 16px 32px rgba(43,30,20,0.25)", opacity: card, transform: `translate(${(1 - card) * -40}px, 0) rotate(${-1.2 + 1.2 * card}deg)`, direction: "rtl" }}>
          <div style={{ position: "absolute", right: 24, top: -42, padding: "4px 18px 8px", background: C.ribbon, color: C.page, fontFamily: Tajawal, fontWeight: 700, fontSize: 28, borderRadius: "6px 6px 0 0" }}>{p.tafsirLabel ?? "حاشية"}</div>
          <Flow now={t} items={wordTimes(p.tafsir, tl, tA + 0.15)} style={{ position: "relative", fontFamily: Tajawal, fontWeight: 500, fontSize: 44, lineHeight: 1.45, color: C.inkText, textAlign: "right" }} />
          <div style={{ position: "absolute", right: 34, bottom: 20, fontFamily: Tajawal, fontWeight: 500, fontSize: 26, color: C.inkSoft, opacity: prog(t, tA + 0.9, tA + 1.4) }}>{p.tafsirSource ?? ""}</div>
        </div>
      ) : null}
      {p.note ? (
        <div style={{ position: "absolute", left: 270, top: 690, width: 580, padding: "18px 26px 22px", boxSizing: "border-box", border: `3px dashed ${C.inkSoft}`, borderRadius: 10, opacity: note, direction: "rtl" }}>
          <span style={{ fontFamily: Tajawal, fontWeight: 700, fontSize: 24, color: C.inkSoft }}>تعليق · </span>
          <Flow now={t} items={wordTimes(p.note, tl, nA + 0.1)} style={{ position: "relative", display: "inline", fontFamily: Amiri, fontWeight: 700, fontSize: 38, color: C.inkSoft }} />
        </div>
      ) : null}
    </>
  );
  return <Book id="lg2" t={t} dur={dur} exit={exit} from={from} cam={cam} R={R} htmlR={htmlR} htmlL={htmlL} />;
};

// ───────────────────────── مقارنة ─────────────────────────
/**
 * lib-compare: طرف أول على اليمين (يُقرأ أولًا) وثانٍ على اليسار، لكل منهما إطار يُرسم لحظة ذكره ونصه كلمة كلمة.
 * الحكم (verdict): a أو b ختم على الراجح ويخفت الآخر · both قوس ذهبي يجمعهما · open علامة سؤال بين الصفحتين (مسألة مفتوحة).
 */
const COMPARE_BOX = { R: { x: 1040, cx: 1365 }, L: { x: 230, cx: 555 } };
const Compare: React.FC<ShotProps> = ({ t, tl, dur, exit, from, p }) => {
  const q = cues(tl, { keepTop: Boolean(p.head) });
  // موضوع المقارنة (اختياري، الأمر 019): قصاصة فوق الكعب تُكتب عند كلمتها، فلا تبقى جملة التمهيد بلا عنصر
  const tiA = p.title ? q.safe(q.at(p.titleWord || firstWord(p.title), 0.3) - 0.05, 0.5) : Infinity;
  const ti = prog(t, tiA, tiA + 0.5, easeOut);
  const aA = q.safe(q.at(p.aWord, 0.4) - 0.1, 0.7);
  const bA = q.safe(q.at(p.bWord, aA + 2) - 0.1, 0.7);
  const vA = p.verdict ? q.safe(q.at(p.verdictWord, bA + 2) - 0.05, 0.6) : Infinity;
  const a = prog(t, aA, aA + 0.7);
  const b = prog(t, bA, bA + 0.7);
  const v = prog(t, vA, vA + 0.5, easeOut);
  const verdict = p.verdict ?? "";
  const dimA = verdict === "b" ? mix(1, 0.45, v) : 1;
  const dimB = verdict === "a" ? mix(1, 0.45, v) : 1;
  const cam = q.cam(t, { cx: 1365, cy: 500, s: 1.1 }, [
    { a: bA - 0.3, b: bA + 0.6, cx: 555, cy: 500, s: 1.1 },
    ...(Number.isFinite(vA) ? [{ a: vA - 0.35, b: vA + 0.4, cx: 960, cy: 520, s: 1 }] : []),
  ]);
  const box = (side: "R" | "L", pr: number, dim: number) => {
    const { x } = COMPARE_BOX[side];
    return (
      <g opacity={dim}>
        <Ink d={`M${x + 650} 300 H${x} V580 H${x + 650} Z`} w={4} p={pr} c={C.ink} />
      </g>
    );
  };
  const label = (side: "R" | "L", text: string | undefined, pr: number, dim: number) =>
    text ? (
      <div style={{ position: "absolute", left: COMPARE_BOX[side].x + 650 - 24 - 220, width: 220, top: 262, textAlign: "center", padding: "4px 0 8px", background: C.ink, color: C.page, fontFamily: Tajawal, fontWeight: 700, fontSize: 28, borderRadius: "6px 6px 0 0", opacity: pr * dim, direction: "rtl" }}>{text}</div>
    ) : null;
  const text = (side: "R" | "L", s: string | undefined, start: number, dim: number) =>
    s ? <Flow now={t} items={wordTimes(s, tl, start + 0.2)} style={{ left: COMPARE_BOX[side].x + 30, top: 330, height: 230, display: "flex", flexWrap: "wrap", alignContent: "center", justifyContent: "center", columnGap: "0.28em", width: 590, fontFamily: Amiri, fontWeight: 700, fontSize: 52, lineHeight: 1.55, color: C.inkText, opacity: dim }} /> : null;
  const stampX = verdict === "a" ? 1365 : 555;
  const R = (
    <g>
      <Head p={p} />
      {box("R", a, dimA)}
      {verdict === "a" ? <Stamp x={stampX} y={690} q={v} label={p.verdictText ?? "الراجح"} color={C.ribbon} /> : null}
      {verdict === "both" ? <Ink d="M1365 590 C1300 720 620 720 555 590" w={5} p={v} c={C.gold} /> : null}
    </g>
  );
  const L = (
    <g>
      {box("L", b, dimB)}
      {verdict === "b" ? <Stamp x={stampX} y={690} q={v} label={p.verdictText ?? "الراجح"} color={C.ribbon} /> : null}
      {verdict === "both" ? <Ink d="M1365 590 C1300 720 620 720 555 590" w={5} p={v} c={C.gold} /> : null}
    </g>
  );
  // الحكم المشترك يُكتب على قصاصة ورق موضوعة فوق الكعب، فلا يُقطع النص بالكعب
  const slipW = Math.max(260, 30 * (p.verdictText ?? "").length + 80);
  const titleW = Math.max(300, 30 * letterCount(p.title ?? "") + 110);
  const titleSlip = p.title ? (
    <g opacity={ti} transform={`translate(0 ${(1 - ti) * -10}) rotate(1 960 196)`}>
      <rect x={960 - titleW / 2} y={154} width={titleW} height={80} rx={6} fill="#FFFAF0" stroke={C.ink} strokeWidth={2.5} />
      <SText x={960} y={208} size={42} font="tajawal" weight={700} color={C.ink}>
        {p.title}
      </SText>
    </g>
  ) : null;
  const verdictLayer =
    verdict === "open" || verdict === "both" ? (
      <g opacity={v} transform={`translate(0 ${(1 - v) * 12})`}>
        {verdict === "open" ? (
          <g>
            <circle cx={960} cy={440} r={62} fill={C.page} stroke={C.inkSoft} strokeWidth={3} />
            <SText x={960} y={478} size={100} color={C.inkSoft}>
              ؟
            </SText>
          </g>
        ) : null}
        {p.verdictText ? (
          <g transform={`rotate(-1.5 960 ${verdict === "open" ? 660 : 760})`}>
            <rect x={960 - slipW / 2} y={(verdict === "open" ? 660 : 760) - 44} width={slipW} height={76} rx={6} fill="#FFFAF0" stroke={verdict === "open" ? C.inkSoft : C.gold} strokeWidth={2.5} strokeDasharray={verdict === "open" ? "10 8" : undefined} />
            <SText x={960} y={(verdict === "open" ? 660 : 760) + 10} size={40} font="tajawal" weight={700} color={verdict === "open" ? C.inkSoft : C.ink}>
              {p.verdictText}
            </SText>
          </g>
        ) : null}
      </g>
    ) : null;
  const over = titleSlip || verdictLayer ? (
    <g>
      {titleSlip}
      {verdictLayer}
    </g>
  ) : undefined;
  const htmlR = (
    <>
      {label("R", p.aLabel, a, dimA)}
      {text("R", p.aText, aA, dimA)}
    </>
  );
  const htmlL = (
    <>
      {label("L", p.bLabel, b, dimB)}
      {text("L", p.bText, bA, dimB)}
    </>
  );
  return <Book id="lc" t={t} dur={dur} exit={exit} from={from} cam={cam} R={R} L={L} over={over} htmlR={htmlR} htmlL={htmlL} />;
};

// ───────────────────────── خط زمني ─────────────────────────
/**
 * lib-timeline: الأفق نفسه خطًّا زمنيًّا يمتد من اليمين (الأقدم) إلى اليسار، يتقدم إلى كل علامة لحظة نطق مرساها،
 * والكاميرا تتتبعه ثم تتراجع لترى الخط كله. العلامة المسبوقة بـ «؟» فجوة بلا سجل: قطعة متقطعة ودائرة جوفاء بحبر خفيف.
 */
const TL_Y = 600;
const Timeline_: React.FC<ShotProps> = ({ t, tl, dur, exit, from, p }) => {
  const q = cues(tl, { keepTop: Boolean(p.head) });
  const items = parseItems(p.items).slice(0, 7);
  const n = Math.max(1, items.length);
  // لا تقع علامة على الكعب نفسه
  const xs = items.map((_, i) => (n === 1 ? 1365 : 1640 - (i * 1360) / (n - 1))).map((x) => (Math.abs(x - 960) < 150 ? (x >= 960 ? 1110 : 810) : x));
  const times = items.map((it, i) => q.safe(q.at(it.anchor, 0.5 + i * 1.2) - 0.35, 0.6));
  const end = times.length ? times[times.length - 1]! + 1.2 : 1;
  const keys: CamKey[] = items.map((_, i) => ({ a: times[i]! - 0.1, b: times[i]! + 0.6, cx: Math.min(1500, Math.max(420, xs[i]!)), cy: TL_Y - 40, s: 1.3 }));
  keys.push({ a: q.safe(Math.max(end, q.last + 0.2), 0.9), b: q.safe(Math.max(end, q.last + 0.2), 0.9) + 0.9, cx: 960, cy: 520, s: 1 });
  const cam = q.cam(t, { cx: Math.min(1500, xs[0] ?? 1365) + 60, cy: TL_Y - 40, s: 1.22 }, keys);
  const segs = items.map((it, i) => {
    const x0 = i === 0 ? 1720 : xs[i - 1]!;
    const pr = prog(t, times[i]! - 0.1, times[i]! + 0.35);
    // Ink يرسم بطول مسار 1، فالتقطيع بنسبة من طول القطعة
    const L = Math.max(1, Math.abs(x0 - xs[i]!));
    return <Ink key={`s${i}`} d={`M${x0} ${TL_Y} H${xs[i]}`} w={it.uncertain ? 3 : 5} p={pr} c={it.uncertain ? C.inkSoft : C.ink} dash={it.uncertain ? `${14 / L} ${12 / L}` : undefined} />;
  });
  const tail = prog(t, end, end + 0.8);
  const marks = items.map((it, i) => {
    const pr = pop(t, times[i]! + 0.35);
    const up = i % 2 === 0;
    const x = xs[i]!;
    return (
      <g key={`m${i}`} opacity={pr}>
        {it.uncertain ? <circle cx={x} cy={TL_Y} r={13} fill={C.page} stroke={C.inkSoft} strokeWidth={3.5} /> : <circle cx={x} cy={TL_Y} r={13} fill={C.ink} />}
        <path d={`M${x} ${TL_Y + (up ? -20 : 20)} V${TL_Y + (up ? -46 : 46)}`} stroke={it.uncertain ? C.inkSoft : C.ink} strokeWidth={3} />
        <SText x={x} y={up ? TL_Y - 64 : TL_Y + 98} size={44} dy={(1 - pr) * (up ? 10 : -10)} color={it.uncertain ? C.inkSoft : C.inkText}>
          {it.text}
        </SText>
        {it.uncertain ? (
          <SText x={x + 34} y={TL_Y - 18} size={30} font="tajawal" weight={700} color={C.inkSoft}>
            ؟
          </SText>
        ) : null}
      </g>
    );
  });
  // الخط يعبر الكعب: يُرسم فوق الصفحتين معًا
  const over = (
    <g>
      {segs}
      <Ink d={`M${xs[xs.length - 1] ?? 960} ${TL_Y} H200`} w={3} p={tail} c={C.inkSoft} dash={`${6 / Math.max(1, (xs[xs.length - 1] ?? 960) - 200)} ${14 / Math.max(1, (xs[xs.length - 1] ?? 960) - 200)}`} />
      {marks}
      {p.title ? (
        <SText x={960} y={300} size={50} font="tajawal" weight={700} color={C.ink} o={prog(t, 0.1, 0.6)}>
          {p.title}
        </SText>
      ) : null}
    </g>
  );
  return <Book id="ltl" t={t} dur={dur} exit={exit} from={from} cam={cam} R={<Head p={p} />} over={over} />;
};

// ───────────────────────── شواهد أثرية ─────────────────────────
/**
 * lib-evidence: بطاقات فهرس لشواهد من رسوم المكتبة (FINDS: tool, home, food, settle, burial, art)، كل شاهد يُرسم لحظة ذكره
 * والكاميرا تقترب منه، ثم عند limitWord تتراجع ويُحاط الكل بإطار متقطع: ما يقوله الشاهد وما لا يقوله (limit).
 */
const SLOTS: Record<number, [number, number][]> = {
  1: [[1365, 470]],
  2: [[1540, 470], [1190, 470]],
  3: [[1540, 380], [1190, 380], [1365, 650]],
};
const Evidence: React.FC<ShotProps> = ({ t, tl, dur, exit, from, p }) => {
  const q = cues(tl, { keepTop: Boolean(p.head) });
  const items = parseItems(p.items)
    .map((it) => {
      const [key, lbl] = it.text.split("=").map((s) => s.trim());
      const f = FINDS.find((x) => x.key === key);
      return f ? { ...it, f, label: lbl || f.label } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .slice(0, 6);
  const nR = Math.ceil(items.length / 2);
  const nL = items.length - nR;
  const pos = [...(SLOTS[nR] ?? []), ...(SLOTS[nL] ?? []).map(([x, y]) => [x - 810, y] as [number, number])];
  const times = items.map((it, i) => q.safe(q.at(it.anchor, 0.5 + i * 1.1) - 0.1, 0.8));
  const lA = p.limit ? q.safe(q.at(p.limitWord || firstWord(p.limit), (times[times.length - 1] ?? 0) + 1.5) - 0.1, 0.8) : Infinity;
  const lim = prog(t, lA, lA + 0.8);
  const keys: CamKey[] = items.map((_, i) => ({ a: times[i]! - 0.25, b: times[i]! + 0.55, cx: pos[i]![0], cy: pos[i]![1] + 20, s: 1.28 }));
  keys.push({ a: Number.isFinite(lA) ? lA - 0.3 : q.last + 0.2, b: (Number.isFinite(lA) ? lA - 0.3 : q.last + 0.2) + 0.9, cx: 960, cy: 520, s: 1 });
  const cam = q.cam(t, { cx: 1365, cy: 500, s: 1.06 }, keys);
  const card = (i: number) => {
    const it = items[i]!;
    const [x, y] = pos[i]!;
    const pr = prog(t, times[i]!, times[i]! + 0.8);
    const s = Math.min(1.25, Math.max(0.55, 105 / Math.max(it.f.rx, it.f.ry)));
    return (
      <g key={i}>
        <Ink d={`M${x + 160} ${y - 120} H${x - 160} V${y + 130} H${x + 160} Z`} w={2.5} p={pr} c={C.inkSoft} />
        {/* نسخة البطاقة إن وُجدت (الأمر 019، L2)، وإلا الرسم الأصلي مصغرًا */}
        {it.f.card ? <g transform={`translate(${x} ${y - 20})`}>{it.f.card(pr)}</g> : <FindAt k={it.f.key} x={x} y={y - 10} s={s} p={pr} />}
        <SText x={x} y={y + 108} size={32} font="tajawal" weight={700} color={C.inkText} o={prog(t, times[i]! + 0.4, times[i]! + 0.8)}>
          {it.label}
        </SText>
      </g>
    );
  };
  const R = (
    <g>
      <Head p={p} />
      {items.slice(0, nR).map((_, i) => card(i))}
    </g>
  );
  const L = <g>{items.slice(nR).map((_, i) => card(nR + i))}</g>;
  const over = p.limit ? (
    <g opacity={lim}>
      <rect x={200} y={220} width={1520} height={590} rx={18} fill="none" stroke={C.ribbon} strokeWidth={3.5} strokeDasharray="18 14" />
      <rect x={560} y={780} width={800} height={70} rx={10} fill={C.page} opacity={0.95} />
      <SText x={960} y={828} size={36} font="tajawal" weight={700} color={C.ribbon}>
        {p.limit}
      </SText>
    </g>
  ) : undefined;
  return <Book id="lev" t={t} dur={dur} exit={exit} from={from} cam={cam} R={R} L={L} over={over} />;
};

export const LIB_SCENES: Record<string, React.FC<ShotProps>> = {
  chapter: Chapter,
  "verse-intro": VerseIntro,
  "verse-tag": VerseTag,
  pending: Pending,
  "lib-term": Term,
  "lib-gloss": Gloss,
  "lib-compare": Compare,
  "lib-timeline": Timeline_,
  "lib-evidence": Evidence,
  "lib-names": Names,
  "lib-descent": Descent,
};
