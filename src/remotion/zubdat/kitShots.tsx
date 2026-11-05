import React from "react";
import type { CamKey } from "../illus/shots/kit";
import { Cross, Mark, Stroke, Write, fam, measure, prog, type Font } from "./inkKit";
import type { InkCtx, InkShotDef } from "./shots";

/**
 * أدوات الاستوديو القابلة لإعادة الاستعمال (زبدة الكتب): مشاهد حبر عامة تُخصَّص لكل كتاب
 * من حقلي «العبارات» و«التوقيت» في المشهد، دون كتابة رسم جديد لكل حلقة.
 * القواعد نفسها: كل عبارة على الشاشة منطوقة في جملة المشهد وتظهر لحظة نطقها،
 * والفسفوري للفكرة وحدها، والبرتقالي للشطب، ولا تُرسم عبارة فيها ذكر لله.
 * يفحصها آليًا `npx bal zubdat check <الحلقة>`.
 */
const C = (t: number, x: number, y: number, z: number): CamKey => ({ t, x, y, z });
const wp = (frame: number, a: number, b: number) => prog(frame, a - 2, Math.max(a + 10, b), (t) => t);

/** ذكر الله: لا يُكتب ولا يُظلَّل (توقير)؛ العبارة التي فيه تُترك للصوت وحده */
export const SACRED_LABEL = /الله|لله|ربنا|ربه|ربك|سبحانه|تعالى|تعالي/;
const plain = (s: string) => s.replace(/[ً-ْٰـ]/g, "");
const isSacred = (s: string) => SACRED_LABEL.test(plain(s));

const firstWord = (s: string) => s.trim().split(/\s+/)[0] ?? "";
const lastWord = (s: string) => s.trim().split(/\s+/).at(-1) ?? "";
const parseCue = (s: string): [string, number] => {
  const [w, n] = s.split("#");
  return [(w ?? "").trim(), n ? Math.max(1, Number(n) || 1) : 1];
};

/** حقلا المشهد: العبارات (مفصولة بـ |) والتوقيت (سطر لكل مفتاح: المفتاح | الكلمة#الظهور) */
export type InkArgs = { labels: string[]; cues: Record<string, string> };
export const parseInkArgs = (labels?: string, cues?: string): InkArgs => ({
  labels: (labels ?? "").split("|").map((s) => s.trim()).filter(Boolean),
  cues: Object.fromEntries(
    (cues ?? "")
      .split(/\n/)
      .map((l) => l.split("|").map((s) => s.trim()))
      .filter((p): p is [string, string] => p.length >= 2 && Boolean(p[0]) && Boolean(p[1])),
  ),
});

/** أدوات مشتركة لكل مشهد عام */
const tools = (c: InkCtx) => {
  const { frame, z, at, end } = c;
  const args = c.args ?? { labels: [], cues: {} };
  /** لحظة مفتاح: من حقل التوقيت إن وُجد، وإلا الكلمة الافتراضية */
  const cue = (key: string, fallback: string, frac: number) => {
    const [w, n] = parseCue(args.cues[key] ?? fallback);
    return at(w, frac, n);
  };
  const cueEnd = (key: string, fallback: string, frac: number) => {
    const [w, n] = parseCue(args.cues[`${key}.end`] ?? args.cues[key] ?? fallback);
    return end(w, frac, n);
  };
  /** حجم يتسع فيه النص لعرض محدد، بلا تجاوز الحجم الأقصى ولا النزول عن حد القراءة على الهاتف */
  const fit = (text: string, max: number, width: number, font: Font = "hand") => {
    const w = measure(text, max, fam(font));
    return Math.max(MIN_TEXT, Math.min(max, (max * width) / Math.max(1, w)));
  };
  /** نص يُكتب من لحظة إلى لحظة، ويُسجَّل للكاميرا */
  const T = (id: string, x: number, y: number, text: string, size: number, a: number, b: number, o: { font?: Font; weight?: number; color?: string; opacity?: number; anchor?: "middle" | "start" } = {}) => {
    if (isSacred(text)) return null;
    const tw = measure(text, size, fam(o.font ?? "hand")) * 1.1;
    const anchor = o.anchor ?? "middle";
    const x0 = anchor === "middle" ? x - tw / 2 : x - tw;
    const x1 = anchor === "middle" ? x + tw / 2 : x;
    c.reg([x0, y - size * 0.95, x1, y + size * 0.4], a);
    return <Write id={id} x={x} y={y} text={text} size={size} p={wp(frame, a, b)} c={o.color ?? z.ink} font={o.font ?? "hand"} weight={o.weight} opacity={o.opacity} anchor={anchor} z={z} />;
  };
  /**
   * شريط فسفوري خلف العبارة المنطوقة الآن (الفكرة وحدها): يُسحب من اليمين عند نطقها، ويُرفع حين تنتقل الفكرة.
   * هو الحدث الأوضح على الورقة (يراه المشاهد ويقيسه مقياس الحركة)، فلا حاجة إلى زخرفة.
   */
  const Band = (x: number, y: number, text: string, size: number, a: number, off = Infinity, o: { font?: Font; anchor?: "middle" | "start" } = {}) => {
    if (isSacred(text)) return null;
    const tw = measure(text, size, fam(o.font ?? "hand")) * 1.08 + size * 0.5;
    const x0 = (o.anchor ?? "middle") === "middle" ? x - tw / 2 : x - tw + size * 0.25;
    const pin = prog(frame, a - 2, a + 12);
    const pout = Number.isFinite(off) ? prog(frame, off - 4, off + 8) : 0;
    return <Mark x={x0} y={y - size * 0.82} w={tw} h={size * 1.12} p={pin * (1 - pout)} z={z} />;
  };
  /** لحظة كلمة إن نُطقت في الجملة، وإلا null (فحص الاستوديو لا يعدّها توقيتًا مفقودًا لأن نسبتها سالبة) */
  const probe = (word: string) => { const t = at(word, -1); return t >= 0 ? t : null; };
  return { frame, z, args, cue, cueEnd, fit, T, Band, probe, P: (a: number, b: number) => prog(frame, a, b) };
};

/** أصغر حجم نص في الأدوات العامة (على عرض 1920): يبقى مقروءًا على شاشة هاتف عرضها 390 */
export const MIN_TEXT = 52;

/** سهم واضح الاتجاه: جسم بالحبر يُخطّ ثم رأس مثلث مصمت (الأمر 017: «قوِّ وضوح السهم واتجاهه») */
const Arrow2: React.FC<{ x1: number; y1: number; x2: number; y2: number; p: number; c: string; w?: number; bend?: number }> = ({ x1, y1, x2, y2, p, c, w = 10, bend = 0 }) => {
  if (p <= 0) return null;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - bend;
  const a = Math.atan2(y2 - my, x2 - mx);
  const hs = w * 3.6;
  // الجسم يقف قبل الرأس بقليل فلا يبرز من تحته
  const ex = x2 - Math.cos(a) * hs * 0.6, ey = y2 - Math.sin(a) * hs * 0.6;
  const head = `M${x2} ${y2} L${x2 - hs * Math.cos(a - 0.42)} ${y2 - hs * Math.sin(a - 0.42)} L${x2 - hs * Math.cos(a + 0.42)} ${y2 - hs * Math.sin(a + 0.42)} Z`;
  const hp = prog(p, 0.82, 1);
  return (
    <g>
      <Stroke d={`M${x1} ${y1} Q${mx} ${my} ${ex} ${ey}`} p={Math.min(1, p * 1.2)} c={c} w={w} />
      {hp > 0 ? <path d={head} fill={c} opacity={hp} /> : null}
    </g>
  );
};

/** كلمات العدد في التمهيد («ثلاث فكر»، «أربعة أمور»…): لحظة ظهور خانات العدّاد فارغة، بلا كشف للأفكار */
const COUNT_WORDS = ["فكرتين", "فكرتان", "اثنتين", "اثنتان", "ثلاث", "ثلاثة", "أربع", "أربعة", "خمس", "خمسة"];

export const KIT_SHOTS: Record<string, InkShotDef> = {
  // ── عدّاد الأفكار: خانات بعدد الأفكار عند ذكر عددها، ثم تُكتب الأفكار واحدة واحدة والفسفوري على المنطوقة الآن ──
  "kit-ideas": {
    nameAr: "أداة: عدّاد الأفكار (العبارات = الأفكار بترتيب نطقها، من ٢ إلى ٥؛ «count» لكلمة العدد في التمهيد)",
    render: (c) => {
      const { z, args, cue, cueEnd, fit, T, Band, P, probe } = tools(c);
      const ideas = args.labels.slice(0, 5);
      const n = Math.max(1, ideas.length);
      const row = Math.min(150, 620 / n);
      const ts = ideas.map((s, i) => cue(`idea${i + 1}`, firstWord(s), (i + 0.5) / (n + 0.5)));
      const te = ideas.map((s, i) => cueEnd(`idea${i + 1}`, lastWord(s), (i + 0.9) / (n + 0.5)));
      // خانات العدّاد عند كلمة العدد المنطوقة في التمهيد (أو مفتاح count)، وإلا مع الفكرة الأولى
      const tCount = Math.min(ts[0]!, args.cues.count ? cue("count", "", 0.05) : COUNT_WORDS.map(probe).filter((t): t is number => t !== null && t < ts[0]!)[0] ?? ts[0]!);
      const sizes = ideas.map((s) => fit(s, 76, 980, "head"));
      const widths = ideas.map((s, i) => measure(s, sizes[i]!, fam("head")) * 1.08);
      // المجموعة (العدّاد على اليمين والنص يمتد يسارًا) متوسطة أفقيًا داخل المنطقة الآمنة، ومتوسطة رأسيًا فوق الترجمة
      const G = Math.max(...widths, 300) + 110;
      const xr = 960 + G / 2 - 30;
      const xt = xr - 80;
      const y0 = 494 - (row * (n - 1)) / 2 + 20;
      return {
        cam: [C(0, 960, 494, 1.0)],
        // الكاميرا تميل إلى الفكرة لحظة كتابتها (كاميرا فوق الدفتر تتبع القلم، D04)
        focus: [[tCount, xr - G / 2, y0 + ((n - 1) * row) / 2] as [number, number, number], ...ideas.map((_, i) => [ts[i]!, xt - widths[i]! / 2, y0 + i * row] as [number, number, number])],
        world: (
          <g>
            {n > 1 ? <Stroke d={`M${xr} ${y0 - 24} L${xr} ${y0 + (n - 1) * row - 24}`} p={P(tCount, tCount + 16)} c={z.ink} w={5} opacity={0.5} /> : null}
            {ideas.map((s, i) => {
              const y = y0 + i * row;
              const size = sizes[i]!;
              const slot = P(tCount + i * 4, tCount + i * 4 + 10);
              return (
                <g key={i}>
                  {/* خانة فارغة تنتظر فكرتها: دائرة وسطر متقطع خافت، بلا نص قبل نطقه */}
                  <circle cx={xr} cy={y - 24} r={30} fill={z.paper} stroke={z.ink} strokeWidth={6} opacity={slot} />
                  <line x1={xt} x2={xt - Math.min(widths[i]!, 420)} y1={y + 14} y2={y + 14} stroke={z.ink} strokeWidth={4} strokeDasharray="10 14" strokeLinecap="round" opacity={0.3 * slot * (1 - P(ts[i]! - 2, ts[i]! + 6))} />
                  <circle cx={xr} cy={y - 24} r={16 * P(ts[i]!, ts[i]! + 10)} fill={z.ink} />
                  {Band(xt, y, s, size, ts[i]!, i + 1 < n ? ts[i + 1]! : Infinity, { font: "head", anchor: "start" })}
                  {T(`ki${i}`, xt, y, s, size, ts[i]!, te[i]!, { font: "head", anchor: "start" })}
                </g>
              );
            })}
          </g>
        ),
      };
    },
  },

  // ── من… إلى…: الحال الأولى أعلى اليمين، وسهم مائل صريح الاتجاه إلى الحال الجديدة أسفل اليسار (اتجاه القراءة) ──
  "kit-shift": {
    nameAr: "أداة: من… إلى… (العبارتان: الحال الأولى | الحال الجديدة؛ «cross» للشطب عند كلمة النفي)",
    render: (c) => {
      const { z, args, cue, cueEnd, fit, T, Band, P } = tools(c);
      const [from = "", to = ""] = args.labels;
      const tA = cue("from", firstWord(from), 0.15);
      const tAe = cueEnd("from", lastWord(from), 0.3);
      const tB = cue("to", firstWord(to), 0.6);
      const tBe = cueEnd("to", lastWord(to), 0.8);
      const hasCross = Boolean(args.cues.cross);
      // الشطب لا يسبق ما يُشطب: إن جاءت كلمة النفي قبل العبارة (مثل «ليس») يقع بعد اكتمال كتابتها (المراجعة البصرية، الأمر 016)
      const tX = hasCross ? Math.max(cue("cross", "", 0.45), tAe + 4) : -1;
      const sA = fit(from, 96, 640, "head");
      const sB = fit(to, 104, 640, "head");
      const wA = measure(from, sA, fam("head")) * 1.1;
      const wB = measure(to, sB, fam("head")) * 1.1;
      const [ax, ay] = [1290, 380];
      const [bx, by] = [640, 640];
      const fade = hasCross ? 0 : 0.45 * P(tB - 4, tB + 12);
      return {
        cam: [C(0, 1150, 440, 1.06), C(tB - 12, 960, 494, 1.0)],
        focus: [[tA, ax, ay - 30], [tB, bx, by - 30], ...(hasCross ? [[tX, ax, ay - 30] as [number, number, number]] : [])],
        world: (
          <g>
            {Band(ax, ay, from, sA, tA, tB, { font: "head" })}
            <g opacity={1 - fade}>{T("fa", ax, ay, from, sA, tA, tAe, { font: "head" })}</g>
            {hasCross ? <Cross x1={ax - wA / 2 - 10} x2={ax + wA / 2 + 10} y={ay - sA * 0.32} p={P(tX, tX + 12)} z={z} /> : null}
            {/* السهم يخرج من أسفل الحال الأولى وينتهي فوق الجديدة، منحنيًا نحو اليسار */}
            <Arrow2 x1={ax - Math.min(wA / 2, 260)} y1={ay + 40} x2={bx + Math.min(wB / 2, 260) * 0.35} y2={by - sB - 10} p={P(tB - 14, tB + 2)} c={z.ink} w={11} bend={-90} />
            {Band(bx, by, to, sB, tB, Infinity, { font: "head" })}
            {T("fb", bx, by, to, sB, tB, tBe, { font: "head" })}
          </g>
        ),
      };
    },
  },

  // ── سلسلة السبب والنتيجة: صناديق من اليمين إلى اليسار، يصلها سهم برأس مصمت عند نطق التالي، والنتيجة بالفسفوري ──
  "kit-chain": {
    nameAr: "أداة: سلسلة السبب والنتيجة (العبارات: الحلقات بترتيبها، من ٢ إلى ٤، والأخيرة هي النتيجة)",
    render: (c) => {
      const { z, args, cue, cueEnd, fit, T, P } = tools(c);
      const items = args.labels.slice(0, 4);
      const n = Math.max(1, items.length);
      const span = 1400;
      const gap = 120;
      const bw = (span - gap * (n - 1)) / n;
      const xs = items.map((_, i) => 960 + span / 2 - bw / 2 - i * (bw + gap));
      const ts = items.map((s, i) => cue(`step${i + 1}`, firstWord(s), (i + 0.4) / (n + 0.3)));
      const te = items.map((s, i) => cueEnd(`step${i + 1}`, lastWord(s), (i + 0.8) / (n + 0.3)));
      const yT = 400, yB = 580, yM = (yT + yB) / 2;
      return {
        cam: [C(0, xs[0]! - 120, 480, 1.06), C((ts[1] ?? 60) - 10, 960, 494, 1.0)],
        focus: items.map((_, i) => [ts[i]!, xs[i]!, yM] as [number, number, number]),
        world: (
          <g>
            {items.map((s, i) => {
              const x = xs[i]!;
              const size = fit(s, 72, bw - 70, "body");
              const last = i === n - 1 && n > 1;
              const pb = P(ts[i]! - 8, ts[i]! + 6);
              return (
                <g key={i}>
                  {/* الحلقة المنطوقة الآن بالفسفوري، وينتقل إلى التالية؛ والنتيجة تبقى */}
                  <rect x={x - bw / 2} y={yT} width={bw} height={yB - yT} rx={18} fill={z.hl} opacity={P(ts[i]! - 2, ts[i]! + 10) * (last ? 1 : 1 - P(ts[i + 1]! - 4, ts[i + 1]! + 8)) * (last ? 1 : 0.85)} style={{ mixBlendMode: "multiply" }} />
                  <Stroke d={`M${x + bw / 2} ${yT} L${x - bw / 2} ${yT} L${x - bw / 2} ${yB} L${x + bw / 2} ${yB} Z`} p={pb} c={z.ink} w={6} />
                  {T(`kc${i}`, x, yM + size * 0.35, s, size, ts[i]!, te[i]!, { font: "body", weight: 700 })}
                  {i > 0 ? <Arrow2 x1={xs[i - 1]! - bw / 2 - 18} y1={yM} x2={x + bw / 2 + 18} y2={yM} p={P(ts[i]! - 14, ts[i]! - 2)} c={z.ink} w={9} /> : null}
                </g>
              );
            })}
          </g>
        ),
      };
    },
  },

  // ── مقياس المستوى: عمود بلا تدريج ولا أرقام (لا يوحي بقياس حقيقي)، يرتفع ما يُقاس فيه عند كلمة الارتفاع وينخفض عند كلمة الانخفاض ──
  "kit-meter": {
    nameAr: "أداة: مقياس المستوى، لجملة تقول صراحةً إن شيئًا يرتفع أو ينخفض (العبارات: الأدنى | الأعلى | ما يُقاس؛ التوقيت: rise وfall)",
    render: (c) => {
      const { frame, z, args, cue, cueEnd, T, Band, P } = tools(c);
      const [low = "", high = "", subject = ""] = args.labels;
      const tR = cue("rise", high ? firstWord(high) : "", 0.35);
      const tRe = Math.max(tR + 24, cueEnd("rise", high ? lastWord(high) : "", 0.5));
      const hasFall = Boolean(args.cues.fall);
      const tF = hasFall ? cue("fall", "", 0.75) : Infinity;
      const tL = low ? cue("low", firstWord(low), 0.7) : -1;
      const tLe = low ? cueEnd("low", lastWord(low), 0.8) : -1;
      const tH = high ? cue("high", firstWord(high), 0.4) : -1;
      const tHe = high ? cueEnd("high", lastWord(high), 0.5) : -1;
      const tS = subject ? cue("subject", firstWord(subject), 0.3) : -1;
      const tSe = subject ? cueEnd("subject", lastWord(subject), 0.4) : -1;
      const lvl = 0.14 + 0.72 * prog(frame, tR, tRe) - (hasFall ? 0.6 * prog(frame, tF, tF + 30) : 0);
      const top = 220, bot = 780, x = 1000, w = 160;
      const yL = bot - (bot - top) * lvl;
      const xr = x + w / 2;
      c.reg([x - w / 2 - 420, top - 40, x + w / 2 + 420, bot + 30], 0);
      const up = P(tR - 2, tR + 12) * (hasFall ? 1 - P(tF - 4, tF + 6) : 1);
      const down = hasFall ? P(tF, tF + 14) : 0;
      return {
        cam: [C(0, 960, 494, 1.0)],
        focus: [[tR, x, top + 160], ...(hasFall ? [[tF, x, bot - 160] as [number, number, number]] : []), ...(low ? [[tL, xr + 200, bot] as [number, number, number]] : [])],
        world: (
          <g>
            <rect x={x - w / 2} y={yL} width={w} height={bot - yL} rx={14} fill={z.hl} opacity={P(0, 10)} />
            <Stroke d={`M${x - w / 2} ${top} L${x - w / 2} ${bot} L${x + w / 2} ${bot} L${x + w / 2} ${top}`} p={P(0, 18)} c={z.ink} w={7} />
            {/* ما يُقاس: اسمه معلّق بسطح الامتلاء نفسه، فيصعد معه وينزل */}
            {subject ? (
              <g>
                <Stroke d={`M${x - w / 2 - 14} ${yL} L${x - w / 2 - 110} ${yL}`} p={P(tS - 2, tS + 10)} c={z.ink} w={5} />
                <g transform={`translate(0 ${yL - 520})`}>{T("ms", x - w / 2 - 130, 540, subject, 64, tS, tSe, { font: "head", anchor: "start" })}</g>
              </g>
            ) : null}
            {/* اتجاه الحركة: سهم صاعد عند الارتفاع، ونازل عند الانخفاض */}
            <g opacity={up}><Arrow2 x1={xr + 70} y1={bot - 60} x2={xr + 70} y2={top + 90} p={P(tR - 2, tR + 18)} c={z.ink} w={9} /></g>
            <g opacity={down}><Arrow2 x1={xr + 70} y1={top + 90} x2={xr + 70} y2={bot - 60} p={P(tF, tF + 18)} c={z.alert} w={9} /></g>
            {/* طرفا المقياس: تسمية كل طرف موصولة بحافته بخط قصير */}
            {high ? <Stroke d={`M${xr + 6} ${top} L${xr + 150} ${top}`} p={P(tH - 4, tH + 8)} c={z.ink} w={5} /> : null}
            {high ? Band(xr + 170 + measure(high, 68, fam("head")) * 1.1, top + 22, high, 68, tH, hasFall ? tF : Infinity, { font: "head", anchor: "start" }) : null}
            {high ? T("mh", xr + 170 + measure(high, 68, fam("head")) * 1.1, top + 22, high, 68, tH, tHe, { font: "head", anchor: "start" }) : null}
            {low ? <Stroke d={`M${xr + 6} ${bot} L${xr + 150} ${bot}`} p={P(tL - 4, tL + 8)} c={z.ink} w={5} /> : null}
            {low ? Band(xr + 170 + measure(low, 68, fam("head")) * 1.1, bot + 22, low, 68, tL, Infinity, { font: "head", anchor: "start" }) : null}
            {low ? T("ml", xr + 170 + measure(low, 68, fam("head")) * 1.1, bot + 22, low, 68, tL, tLe, { font: "head", anchor: "start" }) : null}
          </g>
        ),
      };
    },
  },

  // ── بطاقة الكتاب: غلاف بنسبة كتاب حقيقية (2:3) وكعب على اليمين، تخطيط طباعي فقط (عنوان، خط، مؤلف) بلا زخرفة، وورقة لاصقة بالسؤال ──
  "kit-book": {
    nameAr: "أداة: بطاقة الكتاب (العبارات: العنوان | المؤلف | سؤال الورقة اللاصقة اختياريًا)",
    render: (c) => {
      const { z, args, cue, cueEnd, fit, T, Band, P } = tools(c);
      const [title = "", author = "", note = ""] = args.labels;
      const tT = cue("title", firstWord(title), 0.15);
      const tTe = cueEnd("title", lastWord(title), 0.3);
      const tA = author ? cue("author", firstWord(author), 0.4) : -1;
      const tAe = author ? cueEnd("author", lastWord(author), 0.5) : -1;
      const tN = note ? cue("note", firstWord(note), 0.65) : -1;
      const tNe = note ? cueEnd("note", lastWord(note), 0.85) : -1;
      const bw = 380, bh = 570;
      const bx = note ? 1180 : 960, by = 494;
      const L = bx - bw / 2, R = bx + bw / 2, Tp = by - bh / 2, B = by + bh / 2;
      const spine = 44;
      // العنوان في الثلث الأعلى من الغلاف (سطران إن طال)، والمؤلف في أسفله: تخطيط غلاف طباعي يملأ المساحة بلا زخرفة
      const tLines = splitTwo(title, 3);
      const sT = Math.min(...tLines.map((l) => fit(l, 88, bw - spine - 70, "head")));
      const sA = author ? fit(author, 58, bw - spine - 70, "body") : 0;
      const cx = L + (bw - spine) / 2;
      const pb = P(tT - 16, tT);
      const noteLines = note ? splitTwo(note, 4) : [];
      const sN = note ? Math.min(...noteLines.map((l) => fit(l, 64, 420, "body"))) : 0;
      const [nx, ny] = [700, 470];
      c.reg([L, Tp, R, B], tT - 16);
      return {
        cam: [C(0, bx, 494, 1.04), ...(note ? [C(tN - 10, 940, 494, 1.0)] : [])],
        focus: [[tT, cx, Tp + 150], ...(author ? [[tA, cx, B - 70] as [number, number, number]] : []), ...(note ? [[tN, nx, ny] as [number, number, number]] : [])],
        world: (
          <g>
            <Stroke d={`M${R} ${Tp} L${L} ${Tp} L${L} ${B} L${R} ${B} Z`} p={pb} c={z.ink} w={8} />
            <Stroke d={`M${R - spine} ${Tp} L${R - spine} ${B}`} p={prog(pb, 0.5, 1)} c={z.ink} w={6} />
            {tLines.map((l, i) => (
              <React.Fragment key={i}>{T(`bt${i}`, cx, Tp + 150 + i * sT * 1.15, l, sT, i === 0 ? tT : (tT + tTe) / 2, i === 0 ? (tLines.length > 1 ? (tT + tTe) / 2 : tTe) : tTe, { font: "head" })}</React.Fragment>
            ))}
            {Band(cx, Tp + 150 + (tLines.length - 1) * sT * 1.15, tLines[tLines.length - 1] ?? "", sT, tT, author ? tA : Infinity, { font: "head" })}
            <Stroke d={`M${cx + 70} ${Tp + 150 + (tLines.length - 1) * sT * 1.15 + 46} L${cx - 70} ${Tp + 150 + (tLines.length - 1) * sT * 1.15 + 46}`} p={P(tTe, tTe + 10)} c={z.ink} w={5} />
            {author ? Band(cx, B - 70, author, sA, tA, note ? tN : Infinity, { font: "body" }) : null}
            {author ? T("ba", cx, B - 70, author, sA, tA, tAe, { font: "body", weight: 700 }) : null}
            {note ? (
              <g transform={`rotate(-3 ${nx} ${ny})`} opacity={P(tN - 6, tN + 2)}>
                <rect x={nx - 260} y={ny - 160} width={520} height={320} rx={10} fill={z.hl} stroke={z.ink} strokeWidth={5} />
                {noteLines.map((l, i) => (
                  <React.Fragment key={i}>{T(`bn${i}`, nx, ny - (noteLines.length - 1) * sN * 0.7 + i * sN * 1.4 + sN * 0.32, l, sN, i === 0 ? tN : (tN + tNe) / 2, i === 0 ? (tN + tNe) / 2 : tNe, { font: "body", weight: 700 })}</React.Fragment>
                ))}
              </g>
            ) : null}
          </g>
        ),
      };
    },
  },
};

/** يقسم عبارة طويلة سطرين متقاربين (minWords: أقل عدد كلمات يُقسم عنده) */
const splitTwo = (s: string, minWords = 4): string[] => {
  const w = s.trim().split(/\s+/);
  if (w.length < minWords) return [s.trim()];
  const half = Math.ceil(w.length / 2);
  return [w.slice(0, half).join(" "), w.slice(half).join(" ")];
};
