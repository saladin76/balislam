import React from "react";
import { Easing, interpolate, spring, useVideoConfig } from "remotion";
import { usePalette, useTheme } from "../../../brand/identity/index";
import { fontFamilies } from "../../../brand/fonts";
import { Element } from "../../../brand/elements/Element";
import { hasElement } from "../../../brand/elements/registry";
import { SceneShell } from "./SceneShell";
import { isPerson, People } from "./People";
import { useLang } from "../../i18n/context";
import { clamp, seeded, useSceneFrame } from "./motion";
import { localDigits } from "../../i18n/packs";
import { estimateTimings, type WordTiming } from "./timing";
import { parseBeats, sentenceGroups, wordElement, type Beat } from "../../plan/beats";
import type { SceneBase, StringFields } from "./types";

/**
 * «القصة المتحركة»: نسخة حديثة احترافية من الشرح المرسوم.
 * - خلفية بعمق: تدرج ليلي، بقع ضوء تنجرف، نقش هندسي إسلامي خافت يتحرك ببطء، حُبيبات وتعتيم أطراف.
 * - كل جملة = «لحظة»: أيقونة على قرص زجاجي بحلقة ذهبية تُرسم، وعنوان كبير يُبنى كلمة كلمة.
 * - اللحظات السابقة تنكمش إلى شريط صغير أعلى الشاشة (يتابع المشاهد تسلسل الفكرة).
 * - ترجمة حركية متزامنة مع الصوت: الكلمة المنطوقة تتوهج بالذهبي.
 * - دفعة كاميرا خفيفة عند الكلمة المفتاحية، وسؤال «؟» يأخذ معاملة خاصة (نبض حلقات).
 * بلا وجوه وبلا موسيقى.
 */
export type MotionStoryProps = SceneBase & StringFields<"beats" | "accent">;


/** أرقام بحسب اللغة. */

/** نقش النجمة الثمانية (خاتم) بلاطةً قابلة للتكرار. */
const starTile = (color: string) => {
  const s = 120;
  const c = s / 2;
  const r = 34;
  const sq = (rot: number) =>
    Array.from({ length: 4 }, (_, k) => {
      const a = ((rot + k * 90) * Math.PI) / 180;
      return `${(c + r * Math.cos(a)).toFixed(1)},${(c + r * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'><g fill='none' stroke='${color}' stroke-width='1.4'><polygon points='${sq(0)}'/><polygon points='${sq(45)}'/><circle cx='${c}' cy='${c}' r='12'/><path d='M0 ${c} H${c - r} M${c + r} ${c} H${s} M${c} 0 V${c - r} M${c} ${c + r} V${s}'/></g></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
};

/** حُبيبات فيلم ثابتة (بلاطة صغيرة تتحرك عشوائيًا كل إطارين). */
const grainTile = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='220' height='220' filter='url(#n)'/></svg>",
)}")`;

/** دفعات الترجمة: تنكسر عند علامات الوقف أو بعد max كلمات. */
const chunksOf = (ws: WordTiming[], max: number) => {
  const out: { from: number; to: number }[] = [];
  let from = 0;
  ws.forEach((w, i) => {
    const n = i - from + 1;
    const stop = /[.،,؟?!:؛]$/.test(w.word);
    if (n >= max || (stop && n >= 2) || i === ws.length - 1) {
      out.push({ from, to: i });
      from = i + 1;
    }
  });
  return out;
};

const strip = (s: string) => s.replace(/[ً-ْٰـ؟?!.,،:؛«»"]/g, "").replace(/^(ال|وال|فال|بال|و|ف)/, "");

export const MotionStory: React.FC<MotionStoryProps> = (props) => {
  const { orientation, narration = "", narrationTimings } = props;
  const frame = useSceneFrame();
  const { width: W, height: H, durationInFrames, fps } = useVideoConfig();
  const lang = useLang();
  const rtl = lang.dir === "rtl";
  const portrait = orientation === "portrait";

  const night = useTheme("night");
  const pal = usePalette("night");
  const c = night.colors;
  const gold = props.accent || c.primary;
  const teal = c.secondary;

  const beats: Beat[] = parseBeats(props.beats ?? "").slice(0, 3);
  const timings: WordTiming[] = narration ? (narrationTimings ?? estimateTimings(narration, 6, durationInFrames - 12)) : [];

  // بداية كل لحظة: أول كلمة من جملتها
  const groups = sentenceGroups(narration, Math.max(1, beats.length));
  const starts: number[] = [];
  let wi = 0;
  for (const g of groups) {
    starts.push(Math.max(0, (timings[wi]?.start ?? 0) - 6));
    wi += g.split(/\s+/).filter(Boolean).length;
  }
  while (starts.length < beats.length) starts.push((starts[starts.length - 1] ?? 0) + 60);
  starts[0] = 0;
  const active = Math.max(0, starts.filter((s) => frame >= s).length - 1);

  // لحظة «الضربة»: نطق الكلمة المفتاحية من العنوان (أو بعد بداية اللحظة بقليل)
  const punches = beats.map((b, i) => {
    const keys = b.label.split(/\s+/).map(strip).filter((x) => x.length >= 3);
    const from = starts[i] ?? 0;
    const to = starts[i + 1] ?? durationInFrames;
    const hit = timings.find((w) => w.start >= from && w.start < to && keys.some((k) => strip(w.word).includes(k) || k.includes(strip(w.word))) && strip(w.word).length >= 3);
    return hit ? hit.start : from + 14;
  });

  // الكاميرا: دفع بطيء مستمر + نبضة عند كل ضربة
  const push = interpolate(frame, [0, durationInFrames], [1, 1.045], clamp);
  const punch = punches.reduce((acc, p) => {
    const s = spring({ frame: frame - p, fps, config: { damping: 14, stiffness: 160, mass: 0.6 } });
    const decay = interpolate(frame - p, [0, 26], [1, 0], clamp);
    return acc + 0.022 * s * decay;
  }, 0);
  const cam = push + punch;
  const driftX = Math.sin(frame / 110) * 10;
  const driftY = Math.cos(frame / 140) * 6;

  // ——— الخلفية ———
  const orbs = [
    { x: 0.22, y: 0.28, r: 0.55, col: gold, a: 0.16, sp: 170 },
    { x: 0.82, y: 0.72, r: 0.6, col: teal, a: 0.14, sp: 210 },
    { x: 0.6, y: 0.15, r: 0.35, col: "#7A8CFF", a: 0.08, sp: 150 },
  ];
  const grainPos = `${Math.floor(seeded(Math.floor(frame / 2)) * 220)}px ${Math.floor(seeded(Math.floor(frame / 2) + 9) * 220)}px`;
  const bg = (
    <>
      <div style={{ position: "absolute", inset: 0, background: `radial-gradient(120% 90% at 50% 35%, #17304F 0%, ${c.bg} 55%, #070E19 100%)` }} />
      {orbs.map((o, i) => {
        const x = (o.x + Math.sin(frame / o.sp + i) * 0.05) * W;
        const y = (o.y + Math.cos(frame / o.sp + i * 2) * 0.05) * H;
        const r = o.r * Math.max(W, H);
        return <div key={i} style={{ position: "absolute", left: x - r / 2, top: y - r / 2, width: r, height: r, borderRadius: "50%", background: `radial-gradient(circle, ${o.col} 0%, transparent 65%)`, opacity: o.a }} />;
      })}
      <div
        style={{
          position: "absolute",
          inset: -240,
          backgroundImage: starTile(c.ink),
          backgroundSize: "120px 120px",
          opacity: 0.045,
          transform: `translate(${(frame * 0.35) % 120}px, ${(frame * 0.18) % 120}px) rotate(0deg)`,
          maskImage: "radial-gradient(70% 70% at 50% 45%, black 20%, transparent 85%)",
          WebkitMaskImage: "radial-gradient(70% 70% at 50% 45%, black 20%, transparent 85%)",
        }}
      />
      {/* ذرات ضوء صغيرة تصعد ببطء */}
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        {Array.from({ length: 26 }, (_, i) => {
          const x = seeded(i) * W + Math.sin((frame + i * 40) / 60) * 14;
          const y = (((seeded(i + 50) * H - frame * (0.4 + seeded(i + 7) * 0.8)) % H) + H) % H;
          const tw = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin((frame + i * 17) / 20));
          return <circle key={i} cx={x} cy={y} r={1.2 + seeded(i + 3) * 2.2} fill={i % 3 ? c.ink : gold} opacity={tw * 0.55} />;
        })}
      </svg>
    </>
  );

  // ——— المقاسات ———
  const disc = portrait ? 560 : 500;
  const discX = portrait ? W / 2 : rtl ? W * 0.72 : W * 0.28;
  const discY = portrait ? 700 : 500;
  const headX = portrait ? W / 2 : rtl ? W * 0.31 : W * 0.69;
  const headY = portrait ? 1130 : 470;
  const headW = portrait ? 920 : 820;

  const enterOf = (st: number, delay = 0, stiff = 120, damp = 14) => spring({ frame: frame - st - delay, fps, config: { damping: damp, stiffness: stiff, mass: 0.8 } });

  // ——— اللحظة الحالية والخارجة ———
  const beatView = (i: number) => {
    const b = beats[i]!;
    const st = starts[i] ?? 0;
    const next = starts[i + 1];
    const isQ = /[؟?]\s*$/.test(b.label);
    const inS = enterOf(st, 0, 110, 13);
    // الخروج: تنكمش وتصعد نحو الشريط
    const outT = next !== undefined ? interpolate(frame, [next - 4, next + 12], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) }) : 0;
    if (outT >= 1) return null;
    const ring = interpolate(frame, [st + 4, st + 30], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
    const sweep = interpolate(frame, [st + 10, st + 40], [-1, 1.4], clamp);
    const floatY = Math.sin((frame - st) / 26) * 8;
    const scale = (0.6 + 0.4 * inS) * (1 - 0.5 * outT);
    const ty = (1 - inS) * 80 + floatY - outT * (portrait ? 340 : 260);
    const opacity = Math.min(1, inS * 1.6) * (1 - outT);
    const iconS = enterOf(st, 6, 140, 11);
    const rot = (frame - st) * 0.25;

    // كلمات العنوان تُبنى واحدة واحدة
    const words = b.label.split(/\s+/).filter(Boolean);
    const lastIdx = words.length - 1;
    const headSize = (portrait ? 108 : 112) * (Array.from(b.label).length > 14 ? 0.78 : 1);
    const ul = interpolate(frame, [st + 16 + words.length * 5, st + 34 + words.length * 5], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

    // ——— عناصر مساندة: كل كلمة لها رسمة تظهر وقت نطقها حول القرص (حتى 4 لكل لحظة) ———
    const until = next ?? durationInFrames;
    const seen = new Set<string>([b.draw]);
    const sats: { id: string; word: string; at: number }[] = [];
    for (const w of timings) {
      if (w.start < st + 8 || w.start >= until - 10 || sats.length >= 4) continue;
      const id = wordElement(w.word);
      if (!id || seen.has(id) || (isPerson(b.draw) && isPerson(id)) || !(isPerson(id) || hasElement(id))) continue;
      if (sats.length && w.start - sats[sats.length - 1]!.at < 24) continue;
      seen.add(id);
      sats.push({ id, word: w.word.replace(/[«»"؟?!.,،:؛…]/g, ""), at: w.start });
    }
    // نبضات على كلمات المعنى الطويلة بين العناصر (إيقاع مرئي مع الصوت، كل ثانية ونصف على الأكثر)
    const beatsAt: number[] = [];
    let lastEv = st + 20;
    for (const w of timings) {
      if (w.start < st + 20 || w.start >= until - 8) continue;
      const near = sats.some((x) => Math.abs(x.at - w.start) < 30) || beatsAt.some((x) => Math.abs(x - w.start) < 30);
      if (!near && w.word.replace(/[^\p{L}]/gu, "").length >= 4 && w.start - lastEv >= 54) {
        beatsAt.push(w.start);
        lastEv = w.start;
      }
    }
    const events = [...sats.map((x) => x.at), ...beatsAt];
    const bump = events.reduce((acc, at) => acc + 0.06 * Math.max(0, Math.sin(Math.min(1, Math.max(0, (frame - at) / 14)) * Math.PI)), 0);
    const bursts = events.map((at, k) => {
      const t = (frame - at) / 26;
      if (t < 0 || t > 1) return null;
      const col = k % 2 ? teal : gold;
      return (
        <React.Fragment key={`b${k}`}>
          <div style={{ position: "absolute", left: discX - disc / 2, top: discY - disc / 2 + ty, width: disc, height: disc, borderRadius: "50%", background: `radial-gradient(circle, ${col}55 0%, transparent 70%)`, transform: `scale(${1 + t * 0.35})`, opacity: (1 - t) * (1 - outT) }} />
          <div style={{ position: "absolute", left: discX - disc / 2, top: discY - disc / 2 + ty, width: disc, height: disc, borderRadius: "50%", border: `6px solid ${col}`, transform: `scale(${1 + t * 0.6})`, opacity: (1 - t) * 0.8 * (1 - outT) }} />
        </React.Fragment>
      );
    });
    const R = disc * (portrait ? 0.78 : 0.8);
    // مواضع تتجنب العنوان وشريط الأفكار أعلى الشاشة والترجمة أسفلها
    const angles = portrait ? [-150, -30, 150, 30] : rtl ? [-35, 40, 115, -80] : [-145, 140, 65, -100];
    const satNodes = sats.map((x, k) => {
      const sIn = spring({ frame: frame - x.at, fps, config: { damping: 11, stiffness: 150, mass: 0.6 } });
      if (sIn <= 0.001) return null;
      const a = ((angles[k % angles.length]! + Math.sin((frame - x.at) / 40 + k) * 4) * Math.PI) / 180;
      const r = R * (0.75 + 0.25 * sIn);
      const sx = discX + Math.cos(a) * r;
      const sy = discY + ty + Math.sin(a) * r * (portrait ? 0.9 : 0.82) + Math.sin((frame + k * 20) / 22) * 6;
      const size = portrait ? 150 : 132;
      const line = interpolate(frame, [x.at + 4, x.at + 18], [0, 1], clamp);
      const ex = discX + Math.cos(a) * (disc / 2 + 10);
      const ey = discY + ty + Math.sin(a) * (disc / 2 + 10) * (portrait ? 0.9 : 0.82);
      return (
        <React.Fragment key={`s${k}`}>
          <svg width={W} height={H} style={{ position: "absolute", inset: 0, overflow: "visible", opacity: (1 - outT) * 0.6 }}>
            <line x1={ex} y1={ey} x2={ex + (sx - ex) * line} y2={ey + (sy - ey) * line} stroke={gold} strokeWidth={2} strokeDasharray="4 8" />
          </svg>
          <div style={{ position: "absolute", left: sx - size / 2, top: sy - size / 2, width: size, height: size, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.16), rgba(255,255,255,0.05) 55%, rgba(10,20,36,0.6))", border: `1.5px solid ${k % 2 ? teal : gold}88`, boxShadow: "0 18px 40px rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${sIn * (1 - 0.6 * outT)}) rotate(${(1 - sIn) * 25}deg)`, opacity: Math.min(1, sIn * 1.5) * (1 - outT) }}>
            {isPerson(x.id) ? <People draw={x.id} t={night} height={size * 0.62} gap={4} /> : <Element id={x.id} theme={night} size={size * 0.62} palette={pal} />}
          </div>
          <div style={{ position: "absolute", left: sx - 160, width: 320, top: sy + size / 2 + 6, textAlign: "center", fontFamily: fontFamilies.heading, fontWeight: 700, fontSize: portrait ? 36 : 30, color: c.ink, opacity: interpolate(frame, [x.at + 6, x.at + 16], [0, 0.9], clamp) * (1 - outT), textShadow: "0 4px 14px rgba(0,0,0,0.8)" }}>{x.word}</div>
        </React.Fragment>
      );
    });

    const pulse = isQ
      ? [0, 1, 2].map((k) => {
          const t = (((frame - st - 10) / 50 + k / 3) % 1 + 1) % 1;
          return frame - st > 10 ? (
            <div key={k} style={{ position: "absolute", left: discX - disc / 2, top: discY - disc / 2, width: disc, height: disc, borderRadius: "50%", border: `3px solid ${gold}`, transform: `scale(${1 + t * 0.45})`, opacity: (1 - t) * 0.45 * (1 - outT) }} />
          ) : null;
        })
      : null;

    return (
      <React.Fragment key={i}>
        {pulse}
        {bursts}
        {/* القرص الزجاجي */}
        <div style={{ position: "absolute", left: discX - disc / 2, top: discY - disc / 2, width: disc, height: disc, transform: `translateY(${ty}px) scale(${scale})`, opacity }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              background: `radial-gradient(circle at 35% 28%, rgba(255,255,255,0.16), rgba(255,255,255,0.04) 45%, rgba(10,20,36,0.55) 100%)`,
              boxShadow: `0 40px 90px rgba(0,0,0,0.55), inset 0 0 0 1.5px rgba(255,255,255,0.10), 0 0 120px ${gold}22`,
              overflow: "hidden",
            }}
          >
            {/* لمعة تعبر القرص مرة عند الدخول */}
            <div style={{ position: "absolute", top: "-20%", bottom: "-20%", width: "38%", left: `${sweep * 100}%`, background: "linear-gradient(100deg, transparent, rgba(255,255,255,0.18), transparent)", transform: "skewX(-18deg)" }} />
          </div>
          <svg width={disc} height={disc} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            <circle cx={disc / 2} cy={disc / 2} r={disc / 2 - 4} fill="none" stroke={gold} strokeWidth={4} strokeLinecap="round" pathLength={1} strokeDasharray={`${ring} 1`} transform={`rotate(-90 ${disc / 2} ${disc / 2})`} />
            <g transform={`rotate(${rot} ${disc / 2} ${disc / 2})`} opacity={0.5 * ring}>
              <circle cx={disc / 2} cy={disc / 2} r={disc / 2 + 26} fill="none" stroke={c.ink} strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="2 14" />
              <circle cx={disc / 2} cy={-26} r={6} fill={gold} />
            </g>
          </svg>
          <div style={{ position: "absolute", inset: disc * 0.14, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${(0.4 + 0.6 * iconS) * (1 + bump)}) rotate(${(1 - iconS) * -12 + bump * 40}deg)`, filter: "drop-shadow(0 18px 24px rgba(0,0,0,0.45))" }}>
            {isPerson(b.draw) ? <People draw={b.draw} t={night} height={disc * 0.66} gap={disc * 0.04} /> : hasElement(b.draw) ? <Element id={b.draw} theme={night} size={disc * 0.68} palette={pal} /> : null}
          </div>
        </div>

        {satNodes}
        {/* رقم اللحظة الكبير المفرَّغ + العنوان */}
        <div style={{ position: "absolute", left: headX - headW / 2, width: headW, top: headY - (portrait ? 40 : 170), textAlign: "center", opacity: 1 - outT, transform: `translateY(${-outT * 60}px)` }}>
          <div
            style={{
              fontFamily: fontFamilies.heading,
              fontSize: portrait ? 150 : 190,
              fontWeight: 700,
              lineHeight: 1,
              color: "transparent",
              WebkitTextStroke: `2px ${gold}55`,
              opacity: interpolate(frame, [st, st + 14], [0, 1], clamp),
              transform: `translateY(${(1 - enterOf(st, 2)) * 30}px)`,
              marginBottom: portrait ? -60 : -80,
            }}
          >
            {lang.digits === "arab" ? localDigits(i + 1, lang) : String(i + 1).padStart(2, "0")}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: `0 ${headSize * 0.26}px`, direction: lang.dir }}>
            {words.map((w, k) => {
              const s = enterOf(st, 8 + k * 5, 150, 12);
              const key = k === lastIdx;
              return (
                <span
                  key={k}
                  style={{
                    display: "inline-block",
                    fontFamily: fontFamilies.heading,
                    fontWeight: 700,
                    fontSize: headSize,
                    lineHeight: 1.35,
                    color: key ? gold : c.ink,
                    opacity: Math.min(1, s * 1.5),
                    transform: `translateY(${(1 - s) * 50}px) scale(${0.85 + 0.15 * s})`,
                    filter: `blur(${(1 - Math.min(1, s)) * 8}px)`,
                    textShadow: key ? `0 0 40px ${gold}66` : "0 6px 24px rgba(0,0,0,0.5)",
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>
          <div style={{ height: 8, width: headW * 0.42, margin: "10px auto 0", borderRadius: 8, background: `linear-gradient(${rtl ? 270 : 90}deg, ${gold}, ${teal})`, transform: `scaleX(${ul})`, transformOrigin: rtl ? "right" : "left", boxShadow: `0 0 24px ${gold}88` }} />
        </div>
      </React.Fragment>
    );
  };

  // ——— الشريط: اللحظات السابقة مصغّرة ———
  const trail = beats.length > 1 ? (
    <div style={{ position: "absolute", top: portrait ? 330 : 150, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 18, direction: lang.dir }}>
      {beats.map((b, i) => {
        const st = starts[i + 1];
        const shown = st !== undefined ? spring({ frame: frame - st - 6, fps, config: { damping: 14, stiffness: 140 } }) : 0;
        const current = i === active;
        const pending = i > active;
        if (pending && i !== active) {
          return <div key={i} style={{ width: 14, height: 14, borderRadius: 7, alignSelf: "center", background: c.ink, opacity: 0.22 }} />;
        }
        if (current) return <div key={i} style={{ width: 46, height: 14, borderRadius: 7, alignSelf: "center", background: gold, boxShadow: `0 0 18px ${gold}` }} />;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "8px 20px 8px 10px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
              transform: `translateY(${(1 - shown) * 40}px) scale(${0.7 + 0.3 * shown})`,
              opacity: shown,
            }}
          >
            <div style={{ width: 54, height: 54, borderRadius: 27, background: "rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
              {isPerson(b.draw) ? <People draw={b.draw} t={night} height={44} gap={3} /> : hasElement(b.draw) ? <Element id={b.draw} theme={night} size={42} palette={pal} /> : null}
            </div>
            <span style={{ fontFamily: fontFamilies.heading, fontWeight: 700, fontSize: portrait ? 34 : 32, color: c.ink, opacity: 0.85, whiteSpace: "nowrap" }}>{b.label}</span>
          </div>
        );
      })}
    </div>
  ) : null;

  // ——— الترجمة الحركية ———
  const chunks = chunksOf(timings, portrait ? 5 : 7);
  const first = timings[0];
  const last = timings[timings.length - 1];
  let ci = chunks.findIndex((k) => frame < (timings[k.to]?.end ?? 0) + 2);
  if (ci < 0) ci = chunks.length - 1;
  const chunk = chunks[ci];
  const showSubs = first && last && frame >= first.start - 2 && frame <= last.end + 10;
  const subs =
    chunk && showSubs ? (
      <div style={{ position: "absolute", left: 0, right: 0, bottom: portrait ? 480 : 86, display: "flex", justifyContent: "center", padding: "0 80px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0 22px", maxWidth: portrait ? 940 : 1560, direction: lang.dir }}>
          {timings.slice(chunk.from, chunk.to + 1).map((w, k) => {
            const s = spring({ frame: frame - w.start + 3, fps, config: { damping: 16, stiffness: 200, mass: 0.5 } });
            const speaking = frame >= w.start && frame < w.end + 2;
            const said = frame >= w.end + 2;
            return (
              <span
                key={chunk.from + k}
                style={{
                  display: "inline-block",
                  fontFamily: fontFamilies.body,
                  fontWeight: 700,
                  fontSize: portrait ? 58 : 52,
                  lineHeight: 1.45,
                  color: speaking ? gold : c.ink,
                  opacity: Math.max(0.28, Math.min(1, s)) * (said || speaking ? 1 : 0.55),
                  transform: `translateY(${(1 - s) * 16}px) scale(${speaking ? 1.05 : 1})`,
                  textShadow: speaking ? `0 0 26px ${gold}AA, 0 4px 14px rgba(0,0,0,0.9)` : "0 4px 14px rgba(0,0,0,0.9)",
                }}
              >
                {w.word}
              </span>
            );
          })}
        </div>
      </div>
    ) : null;

  // شريط تقدّم المشهد الرفيع أسفل الشاشة
  const prog = interpolate(frame, [0, durationInFrames - 1], [0, 1], clamp);

  return (
    <SceneShell {...props} themeId="night" motif={false} captions={false} background={c.bg} eyebrowColors={{ text: c.inkSoft, border: `${gold}99` }} durationInFrames={durationInFrames}>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${driftX * 0.4}px, ${driftY * 0.4}px) scale(${1 + (cam - 1) * 0.5})` }}>{bg}</div>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${driftX}px, ${driftY}px) scale(${cam})` }}>
        {beats.map((_, i) => (i <= active + 0 || frame >= (starts[i] ?? 0) ? beatView(i) : null))}
      </div>
      {trail}
      {subs}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 5, background: "rgba(255,255,255,0.06)" }}>
        <div style={{ position: "absolute", top: 0, bottom: 0, [rtl ? "right" : "left"]: 0, width: `${prog * 100}%`, background: `linear-gradient(${rtl ? 270 : 90}deg, ${gold}, ${teal})` }} />
      </div>
      {/* تعتيم الأطراف والحبيبات */}
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: grainTile, backgroundPosition: grainPos, opacity: 0.06, mixBlendMode: "overlay", pointerEvents: "none" }} />
    </SceneShell>
  );
};

export const motionStorySample: Omit<MotionStoryProps, "themeId" | "orientation"> = {
  eyebrow: "الفصل 1 · هل ترى الحقيقة فعلًا؟",
  narration: "تخيل شخصين يشاهدان الموقف نفسه. الأول يراه ظلمًا، والثاني يراه عدلًا. كل واحد منهما مقتنع أنه يرى الحقيقة.",
  beats: "people | الموقف نفسه\nscale-brass-tilted | ظلمٌ أم عدل؟\nmagnifier-brass | الحقيقة",
};
export const motionStorySampleEn: Omit<MotionStoryProps, "themeId" | "orientation"> = {
  eyebrow: "Chapter 1 · Do you really see the truth?",
  narration: "Imagine two people watching the same situation. One sees injustice, the other sees justice. Each is sure he sees the truth.",
  beats: "people | same situation\nscale-brass-tilted | unjust or just?\nmagnifier-brass | the truth",
};
export const motionStorySeconds = 9;
