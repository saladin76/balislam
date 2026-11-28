/**
 * «البدايات» (دفاتر الزمن 002–009) — أدوات لقطات «خط الأفق» الجديدة (bdNN-…) المشتركة بين الحلقات.
 * التوثيق: docs/dafatir-alzaman/03-tools.md (قسم «البدايات»)، والخطط: channels/dafatir-alzaman/episodes/00N-…/scenes.md.
 *
 * 1) التوقير (D214): كل لقطة تُلف بـ reverent: رسمها يأخذ «الزمن المرئي» الذي لا يتقدم من قبل كلمة الذكر بربع ثانية
 *    إلى ما بعدها بربع ثانية؛ فلا يبدأ عنصر ولا يتحرك شيء ولا الكاميرا داخل النافذة، ثم يكمل من حيث وقف. في الرندر الفعلي
 *    يمرر HorizonShot الزمن المرئي نفسه (كلمات الذكر فيه منطبقة بلا طول)، فلا يُطبَّق السكون مرتين.
 *    وكل حدث يقع على كلمة ملاصقة لنافذة الذكر يتأخر إلى ما بعدها (safe)، فلا يقف عنصر نصف ظاهر طوال النافذة.
 * 2) المراحل: اللقطة الواحدة تخدم عدة مشاهد متتالية (جمل مختلفة). لكل مشهد «كلمة توقيع» من جملته؛ ما قُدِّم في مشهد سابق
 *    حاضر من البداية، وما يخص المشهد الحالي يظهر لحظة نطق كلمته، وما بعده غائب. كلمة غائبة عن نص مشهدها ترمي
 *    MissingWordError فيعرض الاستوديو المشهد بالكلمات وحدها وينبّه (M4)، كمشاهد 001.
 * 3) العناصر: الخيط الأحمر بعُقده (ثابت السلسلة، بانتظار اعتماد المالك)، وأختام درجة الثبوت، والقصاصة، والأفق،
 *    ونقطة الحبر، والحجر، والغراب، والريشة… كلها حبر على ورق الدفتر بلوحة «دفتر الأفق»، بلا وجوه ولا هيئات بشرية.
 */
import React from "react";
import { C, Ink, easeOut, mix, prog, rng } from "../horizon/kit";
import { Book, ChapterHead, NEUTRAL, SText, SceneCloseContext, WriteIn, camPath, type Cam, type CamKey, type Exit } from "../horizon/book";
import { MissingWordError, type Timeline } from "../horizon/timeline";
import { activeTime, type Win } from "../horizon/breath";
import { muteCues, recordCue } from "../horizon/cueTrace";
import { SACRED_WORD, duaRanges } from "../../../render/stillnessSpans";
import { normalizeArabic } from "../../../script/quranMeta";
import { Stamp } from "../lib/compare";

export type BdProps = { t: number; tl: Timeline; dur: number; exit: Exit; from?: Cam; p: Record<string, string | undefined> };
export { C, Ink, easeOut, mix, prog, rng, Book, ChapterHead, NEUTRAL, SText, WriteIn, camPath, type Cam, type CamKey };

export const GOLD_D = "#A8803A";
export const EMBER = "#B23A1E";
export const CLAY = "#8A5A3C";
/** ماء بحبر أزرق مطفأ (007/008): لون واحد للماء في السلسلة */
export const WATER = "#4A6E7E";
export const STONE = "#B9AE98";
export const GREEN = "#6F7F45";

// ───────────────────────── التوقير: الزمن المرئي ─────────────────────────

/** نوافذ الذكر بزمن المشهد لكلمات لم تنطبق بعد (طولها > 0): ± ربع ثانية، كما في breathStill وstillness.ts */
export const rawSacred = (tl: Timeline, dur: number): Win[] => {
  const out: Win[] = [];
  for (const w of tl.words) if (w.e - w.s > 0.02 && SACRED_WORD.test(normalizeArabic(w.w))) out.push([w.s - 0.25, w.e + 0.25]);
  for (const [a, b] of duaRanges(tl.words.map((w) => w.w))) if (tl.words[b]!.e - tl.words[a]!.s > 0.02) out.push([tl.words[a]!.s - 0.25, tl.words[b]!.e + 0.25]);
  return out.map(([a, b]) => [Math.max(0, a), Math.min(dur, b)] as Win).filter(([a, b]) => b > a);
};

const remap = (tl: Timeline, v: (x: number) => number): Timeline => ({
  words: tl.words.map((w) => ({ ...w, s: v(w.s), e: v(w.e) })),
  sentences: tl.sentences.map((x) => ({ ...x, s: v(x.s), e: v(x.e) })),
  end: v(tl.end),
});

const RemapClose: React.FC<{ wins: Win[]; children: React.ReactNode }> = ({ wins, children }) => {
  const close = React.useContext(SceneCloseContext);
  return <SceneCloseContext.Provider value={close === undefined ? undefined : activeTime(close, wins)}>{children}</SceneCloseContext.Provider>;
};

/**
 * يلف رسم اللقطة بالزمن المرئي (انظر رأس الملف). الرسم الداخلي دالة نقية بلا خطافات تُستدعى مباشرة،
 * فتصل كلمة غائبة (MissingWordError) إلى فحص الخطة (src/plan/shotWords.ts) كما في مشاهد 001.
 */
export const reverent = (inner: (q: BdProps) => React.ReactElement): React.FC<BdProps> => {
  const Shot = (q: BdProps) => {
    const wins = rawSacred(q.tl, q.dur);
    if (!wins.length) return inner(q);
    const v = (x: number) => activeTime(x, wins);
    return <RemapClose wins={wins}>{inner({ ...q, t: v(q.t), tl: remap(q.tl, v), dur: v(q.dur) })}</RemapClose>;
  };
  return Shot as React.FC<BdProps>;
};

// ───────────────────────── المراحل والمراسي ─────────────────────────

const clean = (w: string) => w.replace(/[،,.:؛«»"()؟?!]/g, "").replace(/[ً-ْٰـ]/g, "");
const norm = (w: string) => clean(w).replace(/[أإآٱ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه");

/**
 * أدوات المشهد: s = رقم المرحلة الحالية (من كلمات التوقيع بالترتيب)، ودوال تقدّم العناصر.
 * المرسى «كلمة» أو «كلمة#2» (الورود الثاني)، ويطابق بداية الكلمة المنطوقة بعد حذف الحركات والترقيم وتوحيد الهمزات.
 */
export const cueKit = (q: BdProps, sigs: string[]) => {
  const { t, tl } = q;
  // نقاط الذكر بالزمن المرئي: كلمات الذكر منطبقة (طولها صفر) بعد reverent أو في الرندر
  const pts = tl.words.filter((w) => SACRED_WORD.test(normalizeArabic(w.w))).map((w) => [w.s, w.e] as Win);
  const find = (anchor: string) => {
    const [w, n] = anchor.split("#");
    const p = norm(w!.trim());
    return tl.words.filter((x) => norm(x.w).startsWith(p))[(Number(n) || 1) - 1];
  };
  // المرحلة = آخر توقيع موجود في النص (جملة متأخرة قد تعيد كلمة جملة سابقة، والعكس لا يقع في الخطط)
  let S = -1;
  sigs.forEach((g, i) => { if (find(g)) S = i; });
  if (sigs.length && S < 0) throw new MissingWordError(sigs[0]!, 1);
  /** يؤخر حدثًا يبدأ عند a ويدوم len عن أي نقطة ذكر يمر بها (يبدأ بعدها بقليل) */
  const safe = (a: number, len = 0.5) => {
    let s = a;
    for (let g = 0; g < 8; g++) {
      const hit = pts.find(([x, y]) => s - 0.06 < y + 0.02 && s + len > x - 0.02);
      if (!hit) break;
      s = hit[1] + 0.06;
    }
    return s;
  };
  const need = (anchor: string) => {
    const hit = find(anchor);
    if (!hit) {
      const [w, n] = anchor.split("#");
      throw new MissingWordError(w!, Number(n) || 1);
    }
    return hit;
  };
  /** بداية كلمة المرسى (آمنة من نوافذ الذكر) */
  const at = (anchor: string, len = 0.5) => {
    const hit = need(anchor);
    recordCue(tl.words.indexOf(hit), len);
    return safe(hit.s, len);
  };
  const end = (anchor: string) => need(anchor).e;
  const has = (anchor: string) => Boolean(find(anchor));
  /** ظهور عنصر قُدِّم في المرحلة sc عند كلمته */
  const on = (sc: number, anchor: string, d = 0.45) => (S > sc ? 1 : S < sc ? 0 : prog(t, at(anchor, d) - 0.05, at(anchor, d) - 0.05 + d, easeOut));
  /** رسم خط (أبطأ من الظهور) */
  const draw = (sc: number, anchor: string, d = 0.9) => on(sc, anchor, d);
  /** تقدّم من كلمة إلى نهاية كلمة أخرى (حركة ممتدة على عبارة) */
  const span = (sc: number, a: string, b: string, min = 0.6) => {
    if (S !== sc) return S > sc ? 1 : 0;
    const x = at(a, 0.2) - 0.05;
    return prog(t, x, Math.max(x + min, end(b)));
  };
  /** ظهور من بداية المشهد (عنصر المكان نفسه) */
  const open = (sc: number, d = 0.7) => (S > sc ? 1 : S < sc ? 0 : prog(t, 0.05, 0.05 + d, easeOut));
  /** تقدّم يصل إلى المرحلة sc ويبقى بعدها (لحالات يتغير فيها عنصر قائم) */
  const step = (sc: number, anchor: string, d = 0.6) => on(sc, anchor, d);
  /** كاميرا: مفاتيح المرحلة الحالية وحدها، كل مفتاح عند كلمته (يتأخر عن نوافذ الذكر) */
  const cam = (start: Cam, keys: [number, string, Cam, number?][]) => muteCues(() =>
    camPath(
      t,
      start,
      keys
        .filter(([sc]) => sc === S)
        .map(([, w, c, d = 1.1]) => {
          const a = at(w, d) - 0.2;
          return { a, b: a + d, ...c };
        })
        .sort((x, y) => x.a - y.a),
    ));
  const last = tl.words.length ? tl.words[tl.words.length - 1]!.e : 0.3;
  return { S, t, at, end, has, on, draw, span, open, step, cam, safe, last };
};
export type Cue = ReturnType<typeof cueKit>;

/** ظهور ناعم عند a */
export const pop = (t: number, a: number, d = 0.45) => prog(t, a - 0.05, a - 0.05 + d, easeOut);

/** صورة المراجعة الثابتة (أداة الصور للمالك): الدفتر كله بلا تأطير الكاميرا، فيُرى التكوين كاملًا. لا أثر له في الرندر */
export const StillViewContext = React.createContext(false);

/** دفتر اللقطة: رأس الفصل إن وُجد في الحقول، والصفحتان، والكاميرا */
const LeafBook: React.FC<{ q: BdProps; id: string; cam: Cam; L?: React.ReactNode; R?: React.ReactNode; top?: React.ReactNode; over?: React.ReactNode; tintL?: string; light?: number }> = ({ q, id, cam, L, R, top, over, tintL, light }) => {
  const still = React.useContext(StillViewContext);
  return (
    <Book id={id} t={q.t} dur={q.dur} exit={q.exit} from={still ? undefined : q.from} cam={still ? NEUTRAL : cam} L={L} R={<g>{q.p.head ? <ChapterHead label={q.p.head} /> : null}{R}</g>} top={top} over={over} tintL={tintL} light={light} />
  );
};
export const Leaf = LeafBook;

// ───────────────────────── نصوص ─────────────────────────

/** كلمة بالحبر تظهر بصعود خفيف */
export const Txt: React.FC<{ x: number; y: number; size?: number; q: number; color?: string; font?: "amiri" | "tajawal"; weight?: number; anchor?: "middle" | "start" | "end"; children: React.ReactNode }> = ({ x, y, size = 44, q, color = C.inkText, font = "tajawal", weight = 700, anchor = "middle", children }) =>
  q <= 0 ? null : (
    <SText x={x} y={y} size={size} o={q} dy={(1 - q) * 10} font={font} weight={weight} color={color} anchor={anchor}>
      {children}
    </SText>
  );

/** «؟» بالحبر */
export const Q: React.FC<{ x: number; y: number; size?: number; q: number; color?: string }> = ({ x, y, size = 110, q, color = C.ink }) =>
  q <= 0 ? null : (
    <g opacity={q} transform={`translate(${x} ${y}) scale(${0.7 + 0.3 * q})`}>
      <SText x={0} y={0} size={size} font="amiri" weight={700} color={color}>
        ؟
      </SText>
    </g>
  );

// ───────────────────────── أختام درجة الثبوت ─────────────────────────

/** أختام القناة: ثابت (ذهبي ممتلئ)، رواية (أحمر)، تقدير (حبر)، لا نعلم (حبر باهت)، لا يصح (أحمر ممتلئ)، حديث صحيح (ذهبي) */
const SEAL: Record<string, { color: string; filled?: boolean }> = {
  ثابت: { color: GOLD_D, filled: true },
  رواية: { color: C.ribbon },
  تقدير: { color: C.ink },
  "لا نعلم": { color: C.inkSoft },
  "لا يصح": { color: C.ribbon, filled: true },
  "حديث صحيح": { color: GOLD_D },
  شاهد: { color: C.ink },
};
export const Seal: React.FC<{ x: number; y: number; q: number; kind: string; s?: number; w?: number; dim?: number }> = ({ x, y, q, kind, s = 0.62, w, dim = 1 }) =>
  q <= 0 ? null : (
    <g opacity={dim} transform={`translate(${x} ${y}) scale(${s}) translate(${-x} ${-y})`}>
      <Stamp x={x} y={y} q={q} label={kind} color={SEAL[kind]?.color ?? C.ink} filled={SEAL[kind]?.filled} w={w ?? Math.max(220, 64 * kind.length * 0.62 + 70)} />
    </g>
  );

/** ختم ذهبي دائري صغير بمرجع (ما ورد في القرآن): المرجع وحده، بلا نص آية */
export const GoldSeal: React.FC<{ x: number; y: number; q: number; label?: string; s?: number }> = ({ x, y, q, label, s = 1 }) =>
  q <= 0 ? null : (
    <g opacity={q} transform={`translate(${x} ${y}) scale(${s * (0.85 + 0.15 * q)})`}>
      <circle r={40} fill={C.gold} stroke={C.ink} strokeWidth={2.5} />
      <circle r={32} fill="none" stroke={C.page} strokeWidth={1.5} strokeDasharray="3 5" />
      <SText x={0} y={8} size={21} font="tajawal" weight={700} color={C.page}>
        القرآن
      </SText>
      {label ? (
        <SText x={0} y={76} size={27} font="tajawal" weight={700} color={C.ink}>
          {label}
        </SText>
      ) : null}
    </g>
  );

/** لسان أحمر صغير بعنوان (مصدر أو تصنيف) — الحافة اليمنى عند x */
export const Tab: React.FC<{ x: number; y: number; q: number; label: string; w?: number; color?: string }> = ({ x, y, q, label, w, color = C.ribbon }) => {
  if (q <= 0) return null;
  const ww = w ?? 30 * label.length * 0.62 + 60;
  return (
    <g opacity={q} transform={`translate(${(1 - q) * 30} 0)`}>
      <path d={`M${x} ${y} h${-ww} v42 h${ww} l-12 -21 Z`} fill={color} />
      <SText x={x - 22} y={y + 30} size={24} font="tajawal" weight={700} color={C.page} anchor="start">
        {label}
      </SText>
    </g>
  );
};

// ───────────────────────── الخيط الأحمر (ثابت السلسلة — بانتظار اعتماد المالك) ─────────────────────────

export type KnotKind = "tied" | "ring" | "dark" | "stone" | "plank" | "light" | "grey";
export type KnotDef = { x: number; kind: KnotKind; q: number; label?: string; lq?: number; glow?: number; mark?: number; sym?: React.ReactNode; tie?: number };

/**
 * خيط الزمن الأحمر: يُمدّ من اليمين إلى اليسار (p)، وعقده على مواضعها. «ring» حلقة فارغة تتشكل، و«tie» يشدها عقدة،
 * و«mark» استفهام فوق العقدة الفارغة، و«glow» لمعة ذهبية، و«label» اسم الحلقة تحتها بالحبر.
 * y ثابت أو منحنى خفيف (sag). vertical يجعله منسدلًا (005) بتدوير المجموعة حول (x1,y).
 */
export const Thread: React.FC<{ x1: number; x2: number; y: number; p: number; knots?: KnotDef[]; sag?: number; w?: number; labelDy?: number; labelSize?: number }> = ({ x1, x2, y, p, knots = [], sag = 6, w = 6, labelDy = 62, labelSize = 30 }) => {
  const yAt = (x: number) => y + Math.sin(((x - x2) / (x1 - x2 || 1)) * Math.PI) * sag;
  const d = `M${x1} ${y} Q${(x1 + x2) / 2} ${y + 2 * sag} ${x2} ${y}`;
  const reach = x1 - (x1 - x2) * p;
  return (
    <g>
      <Ink d={d} p={p} w={w} c={C.ribbon} />
      <Ink d={d} p={p} w={1.6} c="#8E1F17" opacity={0.5} />
      {knots.map((k, i) => {
        if (k.q <= 0 || k.x < reach - 4) return null;
        const ky = yAt(k.x);
        return (
          <g key={i}>
            {k.glow ? <circle cx={k.x} cy={ky} r={30 + 16 * k.glow} fill={C.gold} opacity={0.35 * k.glow} /> : null}
            <Knot x={k.x} y={ky} kind={k.kind} q={k.q} tie={k.tie ?? 1} sym={k.sym} />
            {k.mark ? <Q x={k.x} y={ky - 46} size={64} q={k.mark} color={C.ribbon} /> : null}
            {k.label ? <Txt x={k.x} y={ky + labelDy} size={labelSize} q={k.lq ?? k.q} color={C.ink} weight={700}>{k.label}</Txt> : null}
          </g>
        );
      })}
    </g>
  );
};

/** عقدة واحدة: حلقة فارغة (ring) تُشد (tie) إلى عقدة ممتلئة؛ والأنواع الخاصة: حصاة، لوح، داكنة، نقطة ضوء، رمادية */
export const Knot: React.FC<{ x: number; y: number; kind: KnotKind; q: number; tie?: number; sym?: React.ReactNode }> = ({ x, y, kind, q, tie = 1, sym }) => {
  if (q <= 0) return null;
  const sc = 0.6 + 0.4 * q;
  const body = (() => {
    switch (kind) {
      case "ring":
        return (
          <g>
            <circle r={22 - 12 * tie} fill={tie > 0.9 ? C.ribbon : "none"} stroke={C.ribbon} strokeWidth={5} />
            {tie > 0 ? <path d={`M-${14 * tie} -6 C-4 ${-16 * tie} 4 ${16 * tie} ${14 * tie} 6`} stroke="#8E1F17" strokeWidth={4} fill="none" opacity={tie} /> : null}
          </g>
        );
      case "dark":
        return <path d="M-16 -4 C-16 -18 16 -18 16 -4 C16 10 -16 10 -16 -4 Z M-10 6 L-18 16 M10 6 L18 16" fill="#5A1410" stroke={C.ink} strokeWidth={3} />;
      case "grey":
        return <circle r={14} fill="#9A8F86" stroke={C.ink} strokeWidth={3} />;
      case "stone":
        return <path d="M-22 4 C-24 -12 -8 -20 6 -18 C20 -16 26 -4 22 8 C18 18 -14 20 -22 4 Z" fill={STONE} stroke={C.ink} strokeWidth={3.5} />;
      case "plank":
        return (
          <g>
            <rect x={-30} y={-11} width={60} height={22} rx={3} fill="#C9A06A" stroke={C.ink} strokeWidth={3} />
            <path d="M-12 -11 V11 M12 -11 V11" stroke={C.ribbon} strokeWidth={5} />
          </g>
        );
      case "light":
        return (
          <g>
            <circle r={26} fill={C.gold} opacity={0.3} />
            <circle r={12} fill={C.gold} stroke={GOLD_D} strokeWidth={3} />
          </g>
        );
      default:
        return <path d="M-14 -2 C-14 -16 14 -16 14 -2 C14 12 -14 12 -14 -2 Z M-8 8 L-15 17 M8 8 L15 17" fill={C.ribbon} stroke="#8E1F17" strokeWidth={3} />;
    }
  })();
  return (
    <g opacity={Math.min(1, q * 1.5)} transform={`translate(${x} ${y}) scale(${sc})`}>
      {body}
      {sym ? <g transform="translate(0 -52)">{sym}</g> : null}
    </g>
  );
};

// ───────────────────────── عناصر الحبر ─────────────────────────

/** نقطة حبر (رمز مجرد بلا هيئة) */
export const Dot: React.FC<{ x: number; y: number; q: number; r?: number; c?: string }> = ({ x, y, q, r = 14, c = C.ink }) => (q <= 0 ? null : <circle cx={x} cy={y} r={r * (0.4 + 0.6 * q)} fill={c} opacity={Math.min(1, q * 1.4)} />);

/** هالة/دائرة حبر حول موضع (تُرسم بالتدريج) */
export const Ring: React.FC<{ x: number; y: number; r: number; p: number; c?: string; w?: number; dash?: boolean; fill?: string; fillO?: number }> = ({ x, y, r, p, c = C.ink, w = 4, dash, fill, fillO = 0 }) =>
  p <= 0 ? null : (
    <g>
      {fill ? <circle cx={x} cy={y} r={r} fill={fill} opacity={fillO * p} /> : null}
      {dash ? <circle cx={x} cy={y} r={r} fill="none" stroke={c} strokeWidth={w} strokeDasharray="10 10" opacity={p} /> : <Ink d={`M${x} ${y - r} a${r} ${r} 0 1 1 -0.1 0`} p={p} w={w} c={c} />}
    </g>
  );

/** إطار منقّط (ما لم يكن، أو ما لا نعلم هيئته) */
export const DotFrame: React.FC<{ x: number; y: number; w: number; h: number; q: number; r?: number; c?: string }> = ({ x, y, w, h, q, r = 10, c = C.inkSoft }) =>
  q <= 0 ? null : <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={r} fill="none" stroke={c} strokeWidth={4} strokeDasharray="12 10" opacity={q} />;

/** خانة «عنوان: ـــ» (قيمة فارغة أو مكتوبة) */
export const Field: React.FC<{ x: number; y: number; label: string; q: number; value?: string; vq?: number; w?: number; size?: number; dash?: boolean }> = ({ x, y, label, q, value, vq = 0, w = 240, size = 40, dash = true }) =>
  q <= 0 ? null : (
    <g opacity={q}>
      <SText x={x} y={y} size={size} font="tajawal" weight={700} color={C.inkText} anchor="start">
        {label}
      </SText>
      <path d={`M${x - size * 0.5 * label.length - 18} ${y + 8} h${-w}`} stroke={C.inkSoft} strokeWidth={3} strokeDasharray={dash ? "14 10" : undefined} />
      {value ? <Txt x={x - size * 0.5 * label.length - 18 - w / 2} y={y - 4} size={size} q={vq} color={C.ink}>{value}</Txt> : null}
    </g>
  );

/** قصاصة ورق بلسان أحمر؛ fold يطويها جانبًا (تنكمش وتنزاح وتبهت)، والمحتوى children بإحداثيات مركزها */
export const Slip: React.FC<{ x: number; y: number; w?: number; h?: number; q: number; fold?: number; tab?: string; rot?: number; dx?: number; children?: React.ReactNode; tone?: string }> = ({ x, y, w = 360, h = 220, q, fold = 0, tab, rot = -3, dx = 180, children, tone = "#FBF3E2" }) => {
  if (q <= 0 || fold >= 1) return null;
  const sx = 1 - 0.85 * fold;
  return (
    <g opacity={Math.min(1, q * 1.4) * (1 - 0.6 * fold)} transform={`translate(${x + (1 - q) * 60 - dx * fold} ${y}) rotate(${rot + 8 * fold}) scale(${sx} ${1 - 0.25 * fold})`}>
      <rect x={-w / 2 + 6} y={-h / 2 + 8} width={w} height={h} rx={6} fill="#000" opacity={0.12} />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={6} fill={tone} stroke={C.ink} strokeWidth={3} />
      {tab ? (
        <g>
          <path d={`M${w / 2 - 14} ${-h / 2 - 30} h${-(26 * tab.length * 0.6 + 48)} v38 h${26 * tab.length * 0.6 + 48} Z`} fill={C.ribbon} />
          <SText x={w / 2 - 30} y={-h / 2 - 4} size={24} font="tajawal" weight={700} color={C.page} anchor="start">
            {tab}
          </SText>
        </g>
      ) : null}
      {children}
    </g>
  );
};

/** سطور غير مقروءة (خربشة حبر بلا حروف مخترعة): n أسطر بعرض w تبدأ من (x,y) يمينًا */
export const Scribble: React.FC<{ x: number; y: number; w: number; n: number; p: number; gap?: number; seed?: number; c?: string; o?: number }> = ({ x, y, w, n, p, gap = 30, seed = 3, c = C.inkSoft, o = 0.8 }) => {
  const r = rng(seed);
  return (
    <g opacity={o}>
      {Array.from({ length: n }, (_, i) => {
        const len = w * (0.65 + 0.35 * r());
        const yy = y + i * gap;
        let d = `M${x} ${yy}`;
        for (let k = 1; k <= 10; k++) d += ` L${x - (len * k) / 10} ${yy + (r() - 0.5) * 6}`;
        return <Ink key={i} d={d} p={prog(p, i / n, (i + 1) / n)} w={3} c={c} />;
      })}
    </g>
  );
};

/** شق حبر متعرج من (x1,y1) إلى (x2,y2) بنسبة p (ثابت الشكل بالبذرة) */
export const crackPath = (x1: number, y1: number, x2: number, y2: number, seed = 5, n = 9, amp = 14) => {
  const r = rng(seed);
  let d = `M${x1} ${y1}`;
  for (let i = 1; i <= n; i++) {
    const f = i / n;
    const jitter = i === n ? 0 : (r() - 0.5) * 2 * amp;
    d += ` L${mix(x1, x2, f) + jitter * 0.4} ${mix(y1, y2, f) + jitter}`;
  }
  return d;
};

/** حجر مسطح بظله */
export const Stone: React.FC<{ x: number; y: number; w?: number; h?: number; q: number; shade?: number; fill?: string }> = ({ x, y, w = 200, h = 60, q, shade = 0.25, fill = STONE }) =>
  q <= 0 ? null : (
    <g opacity={Math.min(1, q * 1.5)} transform={`translate(${x} ${y + (1 - q) * 14})`}>
      <ellipse cx={8} cy={h * 0.35} rx={w * 0.55} ry={h * 0.28} fill="#2B1E14" opacity={shade} />
      <path d={`M${-w / 2} 0 C${-w / 2} ${-h * 0.7} ${-w * 0.2} ${-h} ${w * 0.05} ${-h * 0.95} C${w * 0.35} ${-h * 0.9} ${w / 2} ${-h * 0.6} ${w / 2} 0 C${w * 0.3} ${h * 0.25} ${-w * 0.3} ${h * 0.25} ${-w / 2} 0 Z`} fill={fill} stroke={C.ink} strokeWidth={4} strokeLinejoin="round" />
      <path d={`M${-w * 0.3} ${-h * 0.45} C${-w * 0.1} ${-h * 0.6} ${w * 0.15} ${-h * 0.55} ${w * 0.3} ${-h * 0.4}`} stroke={C.ink} strokeWidth={2} fill="none" opacity={0.35} />
    </g>
  );

/** قربان مغطى بقماش خشن (لا أيدٍ): wind يحرك حافة القماش، t للتموج */
export const Cloth: React.FC<{ x: number; y: number; w?: number; q: number; wind?: number; t?: number; fill?: string }> = ({ x, y, w = 150, q, wind = 0, t = 0, fill = "#C9B48A" }) => {
  if (q <= 0) return null;
  const f = wind * Math.sin(t * 7) * 14;
  const g = wind * Math.sin(t * 5 + 1) * 9;
  return (
    <g opacity={Math.min(1, q * 1.5)} transform={`translate(${x} ${y - (1 - q) * 30})`}>
      <path d={`M${-w / 2} 0 C${-w / 2 + 6} ${-60} ${-w * 0.15} ${-86} 0 ${-88} C${w * 0.18} ${-86} ${w / 2 - 8} ${-58} ${w / 2 + f} ${-4 + g} C${w * 0.2} ${10} ${-w * 0.25} ${8} ${-w / 2} 0 Z`} fill={fill} stroke={C.ink} strokeWidth={4} strokeLinejoin="round" />
      {[-0.25, 0, 0.22].map((k, i) => (
        <path key={i} d={`M${w * k} ${-80 + i * 4} C${w * k + 6} ${-50} ${w * k + (i === 2 ? f * 0.6 : 0)} ${-20} ${w * k + 4 + (i === 2 ? f : 0)} ${2}`} stroke={C.ink} strokeWidth={2} fill="none" opacity={0.45} />
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <path key={i} d={`M${-w / 2 + 14 + i * (w / 7)} -30 l8 -6`} stroke={C.ink} strokeWidth={1.6} opacity={0.3} />
      ))}
    </g>
  );
};

/** غراب بالحبر الأسود (طائر، رسم مجرد لا هيئة بشرية). pose: وقوف / نبش (رأس منخفض) / طيران؛ flap 0..1 لجناحيه */
export const Crow: React.FC<{ x: number; y: number; s?: number; q: number; pose?: "stand" | "peck" | "fly"; flap?: number; flip?: boolean; bob?: number }> = ({ x, y, s = 1, q, pose = "stand", flap = 0, flip, bob = 1 }) => {
  if (q <= 0) return null;
  const head = pose === "peck" ? 26 * bob : 0;
  const wingUp = pose === "fly" ? -60 + 90 * flap : 0;
  return (
    <g opacity={Math.min(1, q * 1.4)} transform={`translate(${x} ${y}) scale(${s * (flip ? -1 : 1)} ${s})`}>
      {pose !== "fly" ? <ellipse cx={0} cy={6} rx={70} ry={9} fill="#2B1E14" opacity={0.2} /> : null}
      {/* الذيل */}
      <path d="M58 -48 L112 -34 L104 -24 L114 -14 L56 -28 Z" fill="#141015" stroke="#141015" strokeWidth={3} strokeLinejoin="round" />
      {/* الجسم */}
      <path d={`M-40 ${-52 + head * 0.4} C-30 -84 30 -86 62 -46 C40 -22 -10 -16 -36 -30 Z`} fill="#1B1520" stroke="#141015" strokeWidth={3} />
      {/* الرأس والمنقار */}
      <g transform={`translate(-44 ${-64 + head}) rotate(${pose === "peck" ? -24 * bob : 0})`}>
        <circle r={20} fill="#1B1520" />
        <path d="M-16 -4 L-52 4 L-16 10 Z" fill="#2A2228" stroke="#141015" strokeWidth={2} />
        <circle cx={-4} cy={-5} r={3.4} fill={C.page} />
      </g>
      {/* الجناح */}
      <path d={`M-8 -58 C14 ${-96 + wingUp} 52 ${-88 + wingUp} 70 ${-52 + wingUp * 0.4} C40 -50 10 -44 -8 -58 Z`} fill="#26202C" stroke="#141015" strokeWidth={3} strokeLinejoin="round" />
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M${18 + i * 14} ${-66 + wingUp * 0.5} l18 ${8 - wingUp * 0.1}`} stroke={C.page} strokeWidth={1.5} opacity={0.25} />
      ))}
      {/* الساقان */}
      {pose !== "fly" ? <path d="M-6 -24 L-12 0 M-12 0 L-26 2 M-12 0 L-2 2 M14 -24 L12 0 M12 0 L-2 2 M12 0 L24 2" stroke="#141015" strokeWidth={4} strokeLinecap="round" /> : null}
    </g>
  );
};

/** ريشة سوداء (القطعة المخصوصة لـ 002) */
export const Feather: React.FC<{ x: number; y: number; s?: number; q: number; rot?: number }> = ({ x, y, s = 1, q, rot = -20 }) =>
  q <= 0 ? null : (
    <g opacity={Math.min(1, q * 1.4)} transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M0 -110 C34 -80 40 -20 18 40 L4 92 L-4 92 L-18 40 C-40 -20 -34 -80 0 -110 Z" fill="#1E1822" stroke="#141015" strokeWidth={3} />
      <path d="M0 -104 V112" stroke="#4E4452" strokeWidth={3} strokeLinecap="round" />
      {Array.from({ length: 8 }, (_, i) => (
        <path key={i} d={`M0 ${-80 + i * 18} l${i % 2 ? 20 : -20} -14`} stroke="#4E4452" strokeWidth={1.6} opacity={0.7} />
      ))}
    </g>
  );

/** كرة أرضية بالحبر (خطوط طول وعرض تدور ببطء: spin بالثواني)، wash غسل يملؤها */
export const Globe: React.FC<{ x: number; y: number; r?: number; p: number; spin?: number; wash?: number; washC?: string }> = ({ x, y, r = 190, p, spin = 0, wash = 0, washC = "#C9B48A" }) => {
  if (p <= 0) return null;
  const off = (spin * 0.35) % 1;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={washC} opacity={0.45 * wash} />
      <Ink d={`M${x} ${y - r} a${r} ${r} 0 1 1 -0.1 0`} p={p} w={5} />
      <g opacity={prog(p, 0.5, 1)}>
        <clipPath id={`gl-${x}-${y}`}>
          <circle cx={x} cy={y} r={r} />
        </clipPath>
        <g clipPath={`url(#gl-${x}-${y})`}>
          {[-0.6, -0.3, 0, 0.3, 0.6].map((k) => (
            <ellipse key={k} cx={x} cy={y + k * r} rx={r * Math.sqrt(1 - k * k)} ry={r * 0.1} fill="none" stroke={C.ink} strokeWidth={2} opacity={0.4} />
          ))}
          {[0, 0.25, 0.5, 0.75].map((k) => {
            const ph = ((k + off) % 1) * Math.PI;
            const rx = Math.abs(Math.cos(ph)) * r;
            return <ellipse key={k} cx={x} cy={y} rx={Math.max(1, rx)} ry={r} fill="none" stroke={C.ink} strokeWidth={2} opacity={0.4} />;
          })}
        </g>
      </g>
    </g>
  );
};

/** خط مسطّر فارغ بقلم صغير فوقه (سؤال التعليقات) */
export const BlankLine: React.FC<{ x: number; y: number; w: number; p: number; pen?: number; touch?: number }> = ({ x, y, w, p, pen = 0, touch = 0 }) => (
  <g>
    <Ink d={`M${x + w / 2} ${y} H${x - w / 2}`} p={p} w={3} c={C.inkSoft} />
    {touch > 0 ? <circle cx={x + w / 2 - 30} cy={y - 4} r={7 * touch} fill={C.ink} /> : null}
    {pen > 0 ? (
      <g opacity={pen} transform={`translate(${x + w / 2 - 30 + 20 * (1 - touch)} ${y - 14 - 40 * (1 - pen) - 10 * (1 - touch)}) rotate(-35) scale(0.34)`}>
        <path d="M-300 -16 L230 -16 C262 -16 290 -8 330 0 C290 8 262 16 230 16 L-300 16 C-312 16 -318 8 -318 0 C-318 -8 -312 -16 -300 -16 Z" transform="translate(-330 0)" fill="#C9A06A" stroke={C.ink} strokeWidth={8} />
        <path d="M-100 -16 C-68 -16 -40 -8 0 0 C-40 8 -68 16 -100 16 Z" fill="#2B1E14" />
      </g>
    ) : null}
  </g>
);

/** سهم حبر (متقطع اختياريًا) على مسار d، رأسه عند نهايته (hx,hy) باتجاه ang بالدرجات */
export const Arrow: React.FC<{ d: string; p: number; hx: number; hy: number; ang: number; dashed?: boolean; c?: string; w?: number; cut?: number }> = ({ d, p, hx, hy, ang, dashed, c = C.ink, w = 4, cut = 0 }) =>
  p <= 0 ? null : (
    <g opacity={1 - cut}>
      {dashed ? <path d={d} fill="none" stroke={c} strokeWidth={w} strokeDasharray="12 10" opacity={p} /> : <Ink d={d} p={p} w={w} c={c} />}
      {p > 0.9 ? <path d="M0 0 L-18 -9 L-18 9 Z" fill={c} transform={`translate(${hx} ${hy}) rotate(${ang})`} opacity={(p - 0.9) * 10} /> : null}
    </g>
  );

// ───────────────────────── الأفق والمكان ─────────────────────────

export type Sky = "dusk" | "night" | "noon" | "morning" | "plain" | "dark" | "rain";
const SKY: Record<Sky, [string, number]> = {
  dusk: [C.ember, 0.28],
  night: ["#2A1E3F", 0.32],
  noon: ["#F3C98B", 0.3],
  morning: ["#B9C7C2", 0.32],
  plain: ["#D9C29A", 0.18],
  dark: ["#3A2C3A", 0.38],
  rain: ["#7F8F98", 0.3],
};

/**
 * أفق على الصفحتين (يُرسم في L وR معًا): غسل سماء خفيف فوق الخط، وأرض بلون الورق المغبر تحته، وخط الأفق يُخطّ (p).
 * sky يحدد لون الجو، وdim يُظلم السماء درجة (للغروب أو الحزن)، وground لون الأرض.
 */
export const Horizon: React.FC<{ y: number; p: number; sky?: Sky; dim?: number; ground?: string; texture?: number; seed?: number; skyO?: number }> = ({ y, p, sky = "plain", dim = 0, ground = "#D9C29A", texture = 1, seed = 11, skyO = 1 }) => {
  const [c, o] = SKY[sky];
  const r = rng(seed);
  const id = `hz-${sky}-${y}`;
  return (
    <g>
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor={c} stopOpacity={o * skyO} />
          <stop offset="1" stopColor={c} stopOpacity={0.02} />
        </linearGradient>
      </defs>
      <rect x={140} y={60} width={1640} height={y - 60} fill={`url(#${id})`} opacity={prog(p, 0, 0.6)} />
      {dim > 0 ? <rect x={140} y={60} width={1640} height={y - 60} fill="#2A1E3F" opacity={0.2 * dim} /> : null}
      <rect x={140} y={y} width={1640} height={900 - y + 60} fill={ground} opacity={0.42 * prog(p, 0.2, 0.9)} />
      <Ink d={`M1780 ${y} C1500 ${y - 6} 1260 ${y + 5} 960 ${y} C660 ${y - 5} 420 ${y + 6} 140 ${y}`} p={p} w={4} />
      {texture > 0
        ? Array.from({ length: 22 }, (_, i) => {
            const x = 1740 - i * 74 - r() * 30;
            const yy = y + 30 + r() * (900 - y - 60);
            return <path key={i} d={`M${x} ${yy} h${-(24 + r() * 40)}`} stroke={C.ink} strokeWidth={2} opacity={0.16 * texture * prog(p, 0.5, 1)} />;
          })
        : null}
    </g>
  );
};

/** شمس دائرية (تغيب بنزولها تحت خط set) */
export const Sun: React.FC<{ x: number; y: number; r?: number; q: number; c?: string; set?: number; line?: number }> = ({ x, y, r = 46, q, c = C.ember, set = 0, line }) => {
  if (q <= 0) return null;
  const yy = y + set * (r * 2.4);
  const clip = line ?? y + r * 1.2;
  return (
    <g opacity={q}>
      <clipPath id={`sun-${x}-${y}`}>
        <rect x={x - r * 2} y={0} width={r * 4} height={clip} />
      </clipPath>
      <g clipPath={`url(#sun-${x}-${y})`}>
        <circle cx={x} cy={yy} r={r * 1.6} fill={c} opacity={0.18} />
        <circle cx={x} cy={yy} r={r} fill={c} opacity={0.75} stroke={C.ink} strokeWidth={3} />
      </g>
    </g>
  );
};

/** عشب يميل بريح (sway بالثواني × wind) */
export const Grass: React.FC<{ x: number; y: number; n?: number; spread?: number; q: number; t?: number; wind?: number; seed?: number; h?: number }> = ({ x, y, n = 9, spread = 160, q, t = 0, wind = 0.3, seed = 4, h = 46 }) => {
  if (q <= 0) return null;
  const r = rng(seed);
  return (
    <g opacity={q}>
      {Array.from({ length: n }, (_, i) => {
        const bx = x - spread / 2 + (i / Math.max(1, n - 1)) * spread + (r() - 0.5) * 10;
        const hh = h * (0.6 + 0.6 * r());
        const lean = -10 - 18 * wind * (0.7 + 0.3 * Math.sin(t * 2.4 + i));
        return <path key={i} d={`M${bx} ${y} Q${bx + lean * 0.3} ${y - hh * 0.6} ${bx + lean} ${y - hh * q}`} stroke={GREEN} strokeWidth={3} fill="none" strokeLinecap="round" />;
      })}
    </g>
  );
};

/** قمة جبل بالحبر (تُخطّ بنسبة p)، وتهشير على سفحها */
export const Peak: React.FC<{ x: number; y: number; w?: number; h?: number; p: number; fill?: string; snow?: boolean }> = ({ x, y, w = 360, h = 220, p, fill = "#CDBB98" }) => {
  if (p <= 0) return null;
  const d = `M${x - w / 2} ${y} L${x - w * 0.18} ${y - h * 0.7} L${x - w * 0.05} ${y - h * 0.62} L${x + w * 0.06} ${y - h} L${x + w / 2} ${y}`;
  return (
    <g>
      <path d={`${d} Z`} fill={fill} opacity={0.6 * prog(p, 0.5, 1)} />
      <Ink d={d} p={p} w={4} />
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M${x + w * 0.08 + i * 18} ${y - h * 0.8 + i * 30} l${26} ${30}`} stroke={C.ink} strokeWidth={2} opacity={0.3 * prog(p, 0.7, 1)} />
      ))}
    </g>
  );
};

/** خطوط ماء أفقية متموجة من x1 إلى x2 حول y (amp ارتفاع الموج، t للتموج البطيء) */
export const Waterline: React.FC<{ x1?: number; x2?: number; y: number; p: number; t?: number; amp?: number; rows?: number; fill?: number; c?: string }> = ({ x1 = 1780, x2 = 140, y, p, t = 0, amp = 8, rows = 3, fill = 0.25, c = WATER }) => {
  if (p <= 0) return null;
  const wave = (yy: number, ph: number, a: number) => {
    let d = `M${x1} ${yy}`;
    for (let x = x1; x >= x2; x -= 40) d += ` L${x} ${yy + Math.sin(x / 70 + t * 1.6 + ph) * a}`;
    return d;
  };
  return (
    <g>
      <rect x={Math.min(x1, x2)} y={y} width={Math.abs(x1 - x2)} height={980 - y} fill={c} opacity={fill * prog(p, 0.3, 1)} />
      {Array.from({ length: rows }, (_, i) => (
        <Ink key={i} d={wave(y + i * 46, i * 1.3, amp * (1 - i * 0.2))} p={prog(p, i * 0.15, 1)} w={i ? 2.5 : 4} c={c} opacity={1 - i * 0.25} />
      ))}
    </g>
  );
};

/** مطر مائل بخطوط قصيرة (t يحركها، q كثافتها) داخل مستطيل */
export const Rain: React.FC<{ x: number; y: number; w: number; h: number; q: number; t?: number; c?: string; seed?: number }> = ({ x, y, w, h, q, t = 0, c = WATER, seed = 8 }) => {
  if (q <= 0) return null;
  const r = rng(seed);
  return (
    <g opacity={0.75 * q}>
      {Array.from({ length: 46 }, (_, i) => {
        const bx = x + r() * w;
        const by = y + ((r() * h + t * 420) % h);
        return <path key={i} d={`M${bx} ${by} l-12 34`} stroke={c} strokeWidth={2.6} strokeLinecap="round" />;
      })}
    </g>
  );
};

/** لوح خشب بعروقه */
export const Plank: React.FC<{ x: number; y: number; w?: number; h?: number; q: number; rot?: number; o?: number }> = ({ x, y, w = 300, h = 34, q, rot = 0, o = 1 }) =>
  q <= 0 ? null : (
    <g opacity={Math.min(1, q * 1.5) * o} transform={`translate(${x} ${y - (1 - q) * 30}) rotate(${rot})`}>
      <rect x={-w / 2 + 6} y={-h / 2 + 8} width={w} height={h} rx={4} fill="#2B1E14" opacity={0.18} />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4} fill="#C9A06A" stroke={C.ink} strokeWidth={4} />
      <path d={`M${-w / 2 + 20} ${-h / 6} C${-w / 6} ${-h / 3} ${w / 6} 0 ${w / 2 - 20} ${-h / 8} M${-w / 2 + 40} ${h / 5} C${-w / 8} ${h / 10} ${w / 8} ${h / 3} ${w / 2 - 50} ${h / 6}`} stroke="#8B6A3E" strokeWidth={2.4} fill="none" />
      <circle cx={w * 0.18} cy={0} r={4} fill="#8B6A3E" />
    </g>
  );

/** سطر نص يُكتب بالحبر (WriteIn) بمعرّف ثابت */
export const Write: React.FC<{ id: string; x: number; y: number; size?: number; p: number; label: string; color?: string; font?: "amiri" | "tajawal" }> = ({ id, x, y, size = 54, p, label, color = C.ink, font = "amiri" }) => <WriteIn id={id} x={x} y={y} size={size} p={p} label={label} color={color} font={font} />;

/** إطار ورقة فاتحة فوق الصفحة (حاشية/سجل) */
export const Sheet: React.FC<{ x: number; y: number; w: number; h: number; q: number; rot?: number; children?: React.ReactNode; tone?: string }> = ({ x, y, w, h, q, rot = 0, children, tone = "#FBF4E6" }) =>
  q <= 0 ? null : (
    <g opacity={Math.min(1, q * 1.4)} transform={`translate(${x} ${y + (1 - q) * 24}) rotate(${rot})`}>
      <rect x={-w / 2 + 8} y={-h / 2 + 10} width={w} height={h} rx={8} fill="#000" opacity={0.12} />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={8} fill={tone} stroke={C.ink} strokeWidth={3} />
      {children}
    </g>
  );

/** قيمة بدء/انتهاء: حركة يمر بها عنصر (حلقة ذهاب وإياب لا تستقر) — 0→1→0 بين a وb */
export const bounce = (t: number, a: number, b: number) => {
  const x = prog(t, a, b, (v) => v);
  return Math.sin(Math.PI * x);
};
