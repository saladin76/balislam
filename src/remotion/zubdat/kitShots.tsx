import React from "react";
import type { CamKey } from "../illus/shots/kit";
import { Arrow, Cross, Mark, Stroke, Write, fam, measure, prog, type Font } from "./inkKit";
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
  return { frame, z, args, cue, cueEnd, fit, T, Band, P: (a: number, b: number) => prog(frame, a, b) };
};

/** أصغر حجم نص في الأدوات العامة (على عرض 1920): يبقى مقروءًا على شاشة هاتف عرضها 390 */
export const MIN_TEXT = 52;

export const KIT_SHOTS: Record<string, InkShotDef> = {
  // ── عدّاد الأفكار: الأفكار تُكتب واحدة واحدة، والفسفوري ينتقل إلى الفكرة المنطوقة الآن ──
  "kit-ideas": {
    nameAr: "أداة: عدّاد الأفكار (العبارات = الأفكار بترتيب نطقها، من ٢ إلى ٥)",
    render: (c) => {
      const { z, args, cue, cueEnd, fit, T, Band, P } = tools(c);
      const ideas = args.labels.slice(0, 5);
      const n = Math.max(1, ideas.length);
      const row = Math.min(150, 600 / n);
      const y0 = 540 - (row * (n - 1)) / 2 - 20;
      const ts = ideas.map((s, i) => cue(`idea${i + 1}`, firstWord(s), (i + 0.5) / (n + 0.5)));
      const te = ideas.map((s, i) => cueEnd(`idea${i + 1}`, lastWord(s), (i + 0.9) / (n + 0.5)));
      const xr = 1540;
      const xt = 1450;
      return {
        cam: [C(0, 960, 500, 1.0)],
        focus: ideas.map((_, i) => [ts[i]!, 1100, y0 + i * row] as [number, number, number]),
        world: (
          <g>
            {/* سكة العدّاد تمتد مع كل فكرة جديدة */}
            {n > 1 ? <Stroke d={`M${xr} ${y0} L${xr} ${y0 + (n - 1) * row}`} p={P(ts[0]! - 6, (ts[n - 1] ?? 0) + 6)} c={z.ink} w={5} opacity={0.5} /> : null}
            {ideas.map((s, i) => {
              const y = y0 + i * row;
              const size = fit(s, 76, 1050, "head");
              return (
                <g key={i}>
                  <circle cx={xr} cy={y - size * 0.3} r={30} fill={z.paper} stroke={z.ink} strokeWidth={6} opacity={P(ts[i]! - 8, ts[i]! + 2)} />
                  <circle cx={xr} cy={y - size * 0.3} r={16 * P(ts[i]!, ts[i]! + 10)} fill={z.ink} />
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

  // ── من… إلى…: حال تُشطب أو تخفت، وسهم إلى الحال الجديدة وهي وحدها بالفسفوري ──
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
      const sA = fit(from, 84, 620, "head");
      const sB = fit(to, 92, 620, "head");
      const wA = measure(from, sA, fam("head")) * 1.1;
      const wB = measure(to, sB, fam("head")) * 1.1;
      const fade = hasCross ? 0 : 0.45 * P(tB - 4, tB + 12);
      return {
        cam: [C(0, 1180, 480, 1.08), C(tB - 10, 960, 480, 1.0)],
        focus: [[tA, 1340, 470], [tB, 600, 470]],
        world: (
          <g>
            {Band(1340, 500, from, sA, tA, tB, { font: "head" })}
            <g opacity={1 - fade}>{T("fa", 1340, 500, from, sA, tA, tAe, { font: "head" })}</g>
            {hasCross ? <Cross x1={1340 - wA / 2 - 10} x2={1340 + wA / 2 + 10} y={500 - sA * 0.32} p={P(tX, tX + 12)} z={z} /> : null}
            <Arrow x1={1340 - Math.min(wA / 2, 300) - 40} y1={470} x2={600 + Math.min(wB / 2, 300) + 50} y2={470} p={P(tB - 12, tB + 4)} c={z.ink} w={8} bend={60} />
            {Band(600, 500, to, sB, tB, Infinity, { font: "head" })}
            {T("fb", 600, 500, to, sB, tB, tBe, { font: "head" })}
          </g>
        ),
      };
    },
  },

  // ── سلسلة السبب والنتيجة: صناديق من اليمين إلى اليسار، يصلها سهم عند نطق التالي، والنتيجة بالفسفوري ──
  "kit-chain": {
    nameAr: "أداة: سلسلة السبب والنتيجة (العبارات: الحلقات بترتيبها، من ٢ إلى ٤، والأخيرة هي النتيجة)",
    render: (c) => {
      const { z, args, cue, cueEnd, fit, T, P } = tools(c);
      const items = args.labels.slice(0, 4);
      const n = Math.max(1, items.length);
      const span = 1360;
      const gap = 90;
      const bw = (span - gap * (n - 1)) / n;
      const xs = items.map((_, i) => 1640 - bw / 2 - i * (bw + gap));
      const ts = items.map((s, i) => cue(`step${i + 1}`, firstWord(s), (i + 0.4) / (n + 0.3)));
      const te = items.map((s, i) => cueEnd(`step${i + 1}`, lastWord(s), (i + 0.8) / (n + 0.3)));
      return {
        cam: [C(0, 1400, 470, 1.06), C((ts[1] ?? 60) - 10, 960, 470, 1.0)],
        focus: items.map((_, i) => [ts[i]!, xs[i]!, 470] as [number, number, number]),
        world: (
          <g>
            {items.map((s, i) => {
              const x = xs[i]!;
              const size = fit(s, 70, bw - 60, "body");
              const last = i === n - 1 && n > 1;
              const pb = P(ts[i]! - 8, ts[i]! + 6);
              return (
                <g key={i}>
                  {/* الحلقة المنطوقة الآن بالفسفوري، وينتقل إلى التالية؛ والنتيجة تبقى */}
                  <rect x={x - bw / 2} y={380} width={bw} height={170} rx={18} fill={z.hl} opacity={P(ts[i]! - 2, ts[i]! + 10) * (last ? 1 : 1 - P(ts[i + 1]! - 4, ts[i + 1]! + 8)) * (last ? 1 : 0.85)} style={{ mixBlendMode: "multiply" }} />
                  <Stroke d={`M${x + bw / 2} 380 L${x - bw / 2} 380 L${x - bw / 2} 550 L${x + bw / 2} 550 Z`} p={pb} c={z.ink} w={6} />
                  {T(`kc${i}`, x, 488, s, size, ts[i]!, te[i]!, { font: "body", weight: 700 })}
                  {i > 0 ? <Arrow x1={xs[i - 1]! - bw / 2 - 8} y1={465} x2={x + bw / 2 + 12} y2={465} p={P(ts[i]! - 14, ts[i]! - 2)} c={z.ink} w={7} bend={0} /> : null}
                </g>
              );
            })}
          </g>
        ),
      };
    },
  },

  // ── مقياس المستوى: أنبوب يمتلئ بالفسفوري عند كلمة الارتفاع ويفرغ عند كلمة الهبوط ──
  "kit-meter": {
    nameAr: "أداة: مقياس المستوى (العبارتان اختيارية: الأدنى | الأعلى؛ التوقيت: rise وfall وpeak)",
    render: (c) => {
      const { frame, z, args, cue, cueEnd, T, Band, P } = tools(c);
      const [low = "", high = ""] = args.labels;
      const tR = cue("rise", high ? firstWord(high) : "", 0.35);
      const tRe = Math.max(tR + 24, cueEnd("rise", high ? lastWord(high) : "", 0.5));
      const hasFall = Boolean(args.cues.fall);
      const tF = hasFall ? cue("fall", "", 0.75) : Infinity;
      const tL = low ? cue("low", firstWord(low), 0.12) : -1;
      const tLe = low ? cueEnd("low", lastWord(low), 0.2) : -1;
      const tH = high ? cue("high", firstWord(high), 0.4) : -1;
      const tHe = high ? cueEnd("high", lastWord(high), 0.5) : -1;
      const hasPeak = Boolean(args.cues.peak);
      const tP = hasPeak ? cue("peak", "", 0.6) : -1;
      const lvl = 0.12 + 0.74 * prog(frame, tR, tRe) - (hasFall ? 0.62 * prog(frame, tF, tF + 30) : 0);
      const top = 250, bot = 780, x = 1180, w = 170;
      const yL = bot - (bot - top) * lvl;
      const pulse = hasPeak ? Math.sin(Math.PI * prog(frame, tP, tP + 20)) : 0;
      c.reg([x - w, top - 40, x + w, bot + 30], 0);
      return {
        cam: [C(0, 960, 500, 1.0)],
        focus: [[tR, x, 520], ...(hasFall ? [[tF, x, 640] as [number, number, number]] : [])],
        world: (
          <g>
            <rect x={x - w / 2} y={yL} width={w} height={bot - yL} rx={16} fill={z.hl} opacity={P(0, 10)} />
            <Stroke d={`M${x - w / 2} ${top} L${x - w / 2} ${bot} L${x + w / 2} ${bot} L${x + w / 2} ${top}`} p={P(0, 18)} c={z.ink} w={7} />
            {[0.25, 0.5, 0.75].map((f) => (
              <line key={f} x1={x + w / 2} x2={x + w / 2 + 34} y1={bot - (bot - top) * f} y2={bot - (bot - top) * f} stroke={z.ink} strokeWidth={5} strokeLinecap="round" opacity={P(10, 24)} />
            ))}
            {pulse > 0 ? <circle cx={x} cy={yL} r={70 + 40 * pulse} fill="none" stroke={z.ink} strokeWidth={5} opacity={pulse} /> : null}
            {low ? Band(860, bot - 10, low, 68, tL, Infinity, { font: "head" }) : null}
            {low ? T("ml", 860, bot - 10, low, 68, tL, tLe, { font: "head" }) : null}
            {high ? Band(860, top + 50, high, 68, tH, hasFall ? tF : Infinity, { font: "head" }) : null}
            {high ? T("mh", 860, top + 50, high, 68, tH, tHe, { font: "head" }) : null}
          </g>
        ),
      };
    },
  },

  // ── بطاقة الكتاب: كتاب بالحبر (بلا غلاف واقعي) يُكتب عليه عنوانه، والمؤلف تحته، وورقة لاصقة بسؤاله ──
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
      const bx = note ? 1240 : 960, by = 470, bw = 420, bh = 540;
      const sT = fit(title, 84, bw - 80, "head");
      const pb = P(tT - 16, tT);
      const noteLines = note ? splitTwo(note) : [];
      const sN = note ? Math.min(...noteLines.map((l) => fit(l, 64, 400, "hand"))) : 0;
      c.reg([bx - bw / 2, by - bh / 2, bx + bw / 2, by + bh / 2], tT - 16);
      return {
        cam: [C(0, bx, 480, 1.08), ...(note ? [C(tN - 10, 960, 480, 1.0)] : [])],
        focus: [[tT, bx, by], ...(note ? [[tN, 620, 430] as [number, number, number]] : [])],
        world: (
          <g>
            <Stroke d={`M${bx + bw / 2} ${by - bh / 2} L${bx - bw / 2} ${by - bh / 2} L${bx - bw / 2} ${by + bh / 2} L${bx + bw / 2} ${by + bh / 2} Z`} p={pb} c={z.ink} w={8} />
            <Stroke d={`M${bx + bw / 2 - 40} ${by - bh / 2} L${bx + bw / 2 - 40} ${by + bh / 2}`} p={prog(pb, 0.5, 1)} c={z.ink} w={6} />
            <rect x={bx - bw / 2 + 50} y={by - 70} width={bw - 140} height={14} rx={7} fill={z.hl} opacity={P(tTe, tTe + 12)} />
            {T("bt", bx - 20, by - 100, title, sT, tT, tTe, { font: "head" })}
            {author ? Band(bx, by + bh / 2 + 80, author, 60, tA, note ? tN : Infinity, { font: "body" }) : null}
            {author ? T("ba", bx, by + bh / 2 + 80, author, 60, tA, tAe, { font: "body", weight: 700 }) : null}
            {note ? (
              <g transform={`rotate(-4 620 430)`} opacity={P(tN - 10, tN)}>
                <rect x={620 - 250} y={430 - 170} width={500} height={340} rx={10} fill={z.hl} stroke={z.ink} strokeWidth={5} />
                {noteLines.map((l, i) => (
                  <React.Fragment key={i}>{T(`bn${i}`, 620, 430 - (noteLines.length - 1) * sN * 0.65 + i * sN * 1.3 + sN * 0.3, l, sN, i === 0 ? tN : (tN + tNe) / 2, i === 0 ? (tN + tNe) / 2 : tNe)}</React.Fragment>
                ))}
              </g>
            ) : null}
          </g>
        ),
      };
    },
  },
};

/** يقسم عبارة طويلة سطرين متقاربين (للورقة اللاصقة) */
const splitTwo = (s: string): string[] => {
  const w = s.trim().split(/\s+/);
  if (w.length < 4) return [s.trim()];
  const half = Math.ceil(w.length / 2);
  return [w.slice(0, half).join(" "), w.slice(half).join(" ")];
};
