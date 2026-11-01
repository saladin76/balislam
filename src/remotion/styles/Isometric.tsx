import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { fontFamilies } from "../../../brand/fonts";
import { CamelShape, DemoText, clamp, rnd } from "./common";

/**
 * نموذج «إيزومتري مجسّم»: بغداد من زاوية علوية كألعاب الاستراتيجية: أسوار ومبانٍ مجسّمة بثلاثة أوجه وظلال،
 * مسجد بقبة ومئذنتين، نخيل، طريق تدخل منه قافلة نحو البوابة، وسهم المسار يُرسم فوق الأرض.
 */
const U = 34;
const O = { x: 960, y: 250 };
const iso = (x: number, y: number, z = 0) => ({ x: O.x + (x - y) * 0.866 * U, y: O.y + (x + y) * 0.5 * U - z * U });
const pts = (a: { x: number; y: number }[]) => a.map((q) => `${q.x},${q.y}`).join(" ");

type Box = { x: number; y: number; w: number; d: number; h: number; c: [string, string, string]; dome?: number; kind?: "minaret" | "palm" };

const shade = (hex: string, k: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
};

const BoxShape: React.FC<{ b: Box; t: number }> = ({ b, t }) => {
  const { x, y, w, d, h } = b;
  if (b.kind === "palm") {
    const base = iso(x, y, 0);
    const top = iso(x, y, h);
    return (
      <g>
        <path d={`M${base.x - 4} ${base.y} Q${base.x + 6} ${(base.y + top.y) / 2} ${top.x} ${top.y} L${top.x + 5} ${top.y} Q${base.x + 12} ${(base.y + top.y) / 2} ${base.x + 4} ${base.y} Z`} fill="#7A5232" />
        {[0, 60, 120, 180, 240, 300].map((a, i) => <ellipse key={i} cx={top.x + Math.cos((a * Math.PI) / 180) * 26} cy={top.y + Math.sin((a * Math.PI) / 180) * 12} rx={30} ry={8} transform={`rotate(${a + Math.sin(t * 1.5 + i) * 4} ${top.x} ${top.y})`} fill={i % 2 ? "#4E8A4A" : "#3E7A3E"} />)}
      </g>
    );
  }
  const T = [iso(x, y, h), iso(x + w, y, h), iso(x + w, y + d, h), iso(x, y + d, h)];
  const L = [iso(x, y + d, 0), iso(x + w, y + d, 0), iso(x + w, y + d, h), iso(x, y + d, h)];
  const R = [iso(x + w, y, 0), iso(x + w, y + d, 0), iso(x + w, y + d, h), iso(x + w, y, h)];
  const dome = b.dome ? (() => {
    const c = iso(x + w / 2, y + d / 2, h);
    const r = b.dome * U * 0.866;
    return (
      <g>
        <ellipse cx={c.x} cy={c.y} rx={r} ry={r * 0.5} fill={shade(b.c[0], 0.85)} />
        <path d={`M${c.x - r} ${c.y} A${r} ${r * 1.15} 0 0 1 ${c.x + r} ${c.y} A${r} ${r * 0.5} 0 0 1 ${c.x - r} ${c.y} Z`} fill="url(#iso-dome)" />
        <line x1={c.x} y1={c.y - r * 1.15} x2={c.x} y2={c.y - r * 1.15 - 18} stroke="#E8C46A" strokeWidth={3} />
      </g>
    );
  })() : null;
  return (
    <g>
      <polygon points={pts(L)} fill={b.c[1]} />
      <polygon points={pts(R)} fill={b.c[2]} />
      <polygon points={pts(T)} fill={b.c[0]} />
      {/* نوافذ صغيرة مضيئة على الوجهين */}
      {h > 1.2 && b.kind !== "minaret"
        ? Array.from({ length: Math.max(1, Math.floor(w)) }, (_, i) => {
            const q = iso(x + 0.5 + i, y + d, h * 0.55);
            return <rect key={i} x={q.x - 4} y={q.y - 8} width={8} height={12} rx={4} fill="#FFD27A" opacity={0.5 + 0.5 * Math.abs(Math.sin(t * 0.7 + x + i))} />;
          })
        : null}
      {dome}
    </g>
  );
};

export const IsometricDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { ...clamp, easing: Easing.inOut(Easing.sin) });

  const wall: [string, string, string] = ["#E9CFA0", "#C9A574", "#A88556"];
  const house: [string, string, string] = ["#F2DDB6", "#D6B58A", "#B8925E"];
  const blue: [string, string, string] = ["#CFE3E6", "#9CC2C8", "#7AA4AC"];
  const boxes: Box[] = [];
  // الأسوار مع فتحة البوابة في الجهة الأمامية
  for (let i = 0; i < 14; i++) {
    boxes.push({ x: i, y: 0, w: 1, d: 0.5, h: 1.4, c: wall });
    boxes.push({ x: 0, y: i, w: 0.5, d: 1, h: 1.4, c: wall });
    boxes.push({ x: 13.5, y: i, w: 0.5, d: 1, h: 1.4, c: wall });
    if (i < 6 || i > 7) boxes.push({ x: i, y: 13.5, w: 1, d: 0.5, h: 1.4, c: wall });
  }
  [[0, 0], [13, 0], [0, 13], [13, 13], [5.5, 13], [8, 13]].forEach(([x, y]) => boxes.push({ x: x!, y: y!, w: 1, d: 1, h: 2.4, c: wall }));
  // المسجد الكبير ومئذنتاه
  boxes.push({ x: 5, y: 4.5, w: 4, d: 4, h: 2, c: house, dome: 1.6 });
  boxes.push({ x: 4.3, y: 4, w: 0.6, d: 0.6, h: 5.2, c: house, kind: "minaret", dome: 0.35 });
  boxes.push({ x: 9.2, y: 4, w: 0.6, d: 0.6, h: 5.2, c: house, kind: "minaret", dome: 0.35 });
  // بيوت متفرقة
  for (let i = 0; i < 26; i++) {
    const x = 1 + rnd(i) * 11.5;
    const y = 1 + rnd(i + 40) * 11.5;
    if (x > 3.8 && x < 10.2 && y > 3.5 && y < 9) continue;
    if (x > 5 && x < 9 && y > 10) continue;
    boxes.push({ x, y, w: 0.9 + rnd(i + 5) * 0.8, d: 0.9 + rnd(i + 6) * 0.8, h: 0.8 + rnd(i + 7) * 1.4, c: i % 6 === 0 ? blue : house, dome: i % 5 === 0 ? 0.45 : undefined });
  }
  // نخيل خارج السور وعلى الطريق
  [[16, 10], [17, 13], [15.5, 16], [-2, 6], [-2.5, 10], [18, 6], [4, 17], [10, 18]].forEach(([x, y]) => boxes.push({ x: x!, y: y!, w: 0, d: 0, h: 2.6, c: house, kind: "palm" }));
  boxes.sort((a, b) => a.x + a.y + a.w / 2 + a.d / 2 - (b.x + b.y + b.w / 2 + b.d / 2));

  // الطريق والقافلة: من بعيد نحو البوابة (x≈7، y≈14)
  const road = [iso(6.4, 26), iso(7.6, 26), iso(7.6, 13.8), iso(6.4, 13.8)];
  const draw = interpolate(frame, [10, 120], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const arrowFrom = iso(7, 25);
  const arrowTo = iso(7, 25 - 10 * draw);

  return (
    <AbsoluteFill style={{ background: "#2A1A2E" }}>
      <svg viewBox="0 0 1920 1080" style={{ width: "100%", height: "100%" }}>
        <defs>
          <linearGradient id="iso-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3A2240" /><stop offset="1" stopColor="#E59A6A" /></linearGradient>
          <linearGradient id="iso-dome" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7FD6CF" /><stop offset="1" stopColor="#1E7C8A" /></linearGradient>
          <radialGradient id="iso-light" cx="0.65" cy="0.2" r="0.8"><stop offset="0" stopColor="#FFD9A0" stopOpacity={0.35} /><stop offset="1" stopColor="#FFD9A0" stopOpacity={0} /></radialGradient>
        </defs>
        <rect width={1920} height={1080} fill="url(#iso-sky)" />
        <g transform={`translate(${interpolate(p, [0, 1], [40, -60])} ${interpolate(p, [0, 1], [-10, -60])}) translate(960 560) scale(${interpolate(p, [0, 1], [0.95, 1.12])}) translate(-960 -560)`}>
          {/* الأرض */}
          <polygon points={pts([iso(-12, -12), iso(30, -12), iso(30, 30), iso(-12, 30)])} fill="#E2B678" />
          {Array.from({ length: 30 }, (_, i) => {
            const q = iso(-10 + rnd(i) * 38, -10 + rnd(i + 3) * 38);
            return <ellipse key={i} cx={q.x} cy={q.y} rx={60 + rnd(i + 5) * 80} ry={14} fill="#D3A266" opacity={0.6} />;
          })}
          <polygon points={pts([iso(-0.3, -0.3), iso(14.3, -0.3), iso(14.3, 14.3), iso(-0.3, 14.3)])} fill="#D9B98C" />
          {/* الطريق وسهم المسار */}
          <polygon points={pts(road)} fill="#C9955C" />
          <line x1={arrowFrom.x} y1={arrowFrom.y} x2={arrowTo.x} y2={arrowTo.y} stroke="#B4382F" strokeWidth={6} strokeDasharray="16 12" strokeDashoffset={-frame * 2} strokeLinecap="round" />
          {draw > 0.05 ? <polygon points={`${arrowTo.x},${arrowTo.y - 4} ${arrowTo.x + 22},${arrowTo.y + 14} ${arrowTo.x - 22},${arrowTo.y + 14}`} fill="#B4382F" transform={`rotate(-30 ${arrowTo.x} ${arrowTo.y})`} /> : null}
          {/* الظلال */}
          {boxes.map((b, i) => {
            if (b.kind === "palm") {
              const q = iso(b.x + 1.2, b.y - 0.3);
              return <ellipse key={`s${i}`} cx={q.x} cy={q.y} rx={34} ry={10} fill="#5A3A2A" opacity={0.25} />;
            }
            const k = b.h * 0.55;
            return <polygon key={`s${i}`} points={pts([iso(b.x + b.w, b.y), iso(b.x + b.w + k, b.y - k * 0.3), iso(b.x + b.w + k, b.y + b.d - k * 0.3), iso(b.x + b.w, b.y + b.d)])} fill="#5A3A2A" opacity={0.22} />;
          })}
          {/* القافلة تمشي على الطريق نحو البوابة */}
          {Array.from({ length: 5 }, (_, i) => {
            const yy = interpolate(frame, [0, durationInFrames], [27 + i * 1.6, 17.5 + i * 1.6]);
            const q = iso(7, yy);
            return (
              <g key={`c${i}`}>
                <ellipse cx={q.x + 8} cy={q.y + 4} rx={26} ry={8} fill="#5A3A2A" opacity={0.3} />
                <g transform={`translate(${q.x} ${q.y - 30}) scale(-0.28 0.28)`}>
                  <CamelShape t={t} phase={i * 1.5} fill={i % 2 ? "#8A5A3A" : "#7A4E30"} load="#B4382F" />
                </g>
              </g>
            );
          })}
          {boxes.map((b, i) => <BoxShape key={i} b={b} t={t} />)}
          {/* علامة المدينة */}
          {(() => {
            const q = iso(7, 6.5, 6.4);
            const a = interpolate(frame, [30, 50], [0, 1], clamp);
            return (
              <g opacity={a} transform={`translate(0 ${(1 - a) * 12 + Math.sin(t * 2) * 4})`}>
                <rect x={q.x - 80} y={q.y - 54} width={160} height={50} rx={25} fill="#2A1A2E" opacity={0.85} />
                <text x={q.x} y={q.y - 20} textAnchor="middle" fontFamily={fontFamilies.heading} fontSize={30} fontWeight={700} fill="#F6EBDD">بغداد</text>
                <path d={`M${q.x - 10} ${q.y - 4} L${q.x} ${q.y + 10} L${q.x + 10} ${q.y - 4} Z`} fill="#2A1A2E" opacity={0.85} />
              </g>
            );
          })()}
        </g>
        <rect width={1920} height={1080} fill="url(#iso-light)" style={{ mixBlendMode: "screen" }} />
      </svg>
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 85% 80% at 50% 50%, transparent 60%, rgba(30,15,30,0.5) 100%)" }} />
      <DemoText title="بغداد" date="القرن التاسع الميلادي" font={fontFamilies.heading} accent="#7FD6CF" captionBg="rgba(42,26,46,0.6)" panel="rgba(42,26,46,0.72)" />
    </AbsoluteFill>
  );
};
