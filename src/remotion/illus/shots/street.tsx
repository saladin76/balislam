import React from "react";
import { ID, darken, lighten, mix } from "../palette";
import { Glow, GROUND, archPath, rand } from "../world";
import { Texture, LightPool, Beam } from "../texture";

/**
 * «سوق الحارة» عصرًا: واجهات دكاكين بأقواس ومظلات قماش، وبضائع، وشرفات مشربية في الأعلى،
 * وحبل مصابيح يتمايل فوق الشارع، وعربة فاكهة. يمتد عرضه من -300 إلى 2220 لتتحرك الكاميرا بحرية.
 */
export const STREET_X0 = -300;
export const STREET_X1 = 2220;

const Facade: React.FC<{ x: number; w: number; h: number; wall: string; seed: number; frame: number; awning: string; goods: "fruit" | "spice" | "cloth" | "pots" }> = ({ x, w, h, wall, seed, frame, awning, goods }) => {
  const r = rand(seed);
  const top = GROUND - h;
  const ink = darken(ID.night, 0.55);
  const doorW = w * 0.62;
  const doorX = x + (w - doorW) / 2;
  const doorTop = GROUND - 300;
  const sway = Math.sin(frame / 26 + seed) * 2.5;
  return (
    <g>
      {/* الجدار وحافته */}
      <rect x={x} y={top} width={w + 1} height={h} fill={wall} />
      <rect x={x} y={top} width={w + 1} height={16} fill={darken(wall, 0.18)} />
      <rect x={x + w - 14} y={top} width={14} height={h} fill="#000" opacity={0.14} />
      {/* شرفة مشربية في الطابق العلوي */}
      <g>
        <rect x={x + w * 0.22} y={top + 50} width={w * 0.56} height={150} fill={darken(ID.copper, 0.55)} stroke={ink} strokeWidth={3} />
        {Array.from({ length: 7 }, (_, i) => (
          <line key={`v${i}`} x1={x + w * 0.22 + ((i + 1) * w * 0.56) / 8} y1={top + 58} x2={x + w * 0.22 + ((i + 1) * w * 0.56) / 8} y2={top + 192} stroke={darken(ID.copper, 0.3)} strokeWidth={3} />
        ))}
        {Array.from({ length: 5 }, (_, j) => (
          <line key={`h${j}`} x1={x + w * 0.22 + 6} y1={top + 64 + j * 28} x2={x + w * 0.78 - 6} y2={top + 64 + j * 28} stroke={darken(ID.copper, 0.3)} strokeWidth={3} />
        ))}
        <rect x={x + w * 0.2} y={top + 196} width={w * 0.6} height={14} fill={darken(ID.copper, 0.62)} />
        {r() > 0.4 ? <rect x={x + w * 0.22 + 8} y={top + 60} width={w * 0.56 - 16} height={130} fill={ID.dawn} opacity={0.18} /> : null}
      </g>
      {/* لوحة الدكان (بلا كتابة) */}
      <rect x={doorX + 20} y={doorTop - 120} width={doorW - 40} height={46} rx={4} fill={darken(ID.copper, 0.4)} stroke={ink} strokeWidth={3} />
      <rect x={doorX + 34} y={doorTop - 108} width={doorW - 68} height={22} rx={3} fill={darken(ID.copper, 0.25)} />
      {/* فتحة الدكان المقوسة وداخلها المعتم */}
      <path d={archPath(doorX - 14, GROUND, doorW + 28, 314)} fill={darken(wall, 0.25)} />
      <path d={archPath(doorX, GROUND, doorW, 300)} fill={mix(darken(ID.night, 0.3), ID.copper, 0.12)} />
      <Glow cx={doorX + doorW / 2} cy={doorTop + 60} r={160} opacity={0.35} />
      {/* رفوف داخل الدكان */}
      {[0, 1, 2].map((k) => (
        <rect key={k} x={doorX + 18} y={doorTop + 50 + k * 70} width={doorW - 36} height={6} fill={darken(ID.copper, 0.45)} />
      ))}
      {Array.from({ length: 9 }, (_, k) => (
        <rect key={`j${k}`} x={doorX + 26 + (k % 3) * ((doorW - 60) / 3) + r() * 12} y={doorTop + 22 + Math.floor(k / 3) * 70} width={22 + r() * 14} height={28} rx={4} fill={[ID.copper, mix(ID.seal, ID.copper, 0.4), ID.paper][k % 3]} opacity={0.75} />
      ))}
      {/* المظلة القماشية */}
      <g transform={`translate(0 ${sway * 0.3})`}>
        <path d={`M${doorX - 40} ${doorTop - 64} L${doorX + doorW + 40} ${doorTop - 64} L${doorX + doorW + 70} ${doorTop + 10} L${doorX - 70} ${doorTop + 10} Z`} fill={awning} stroke={ink} strokeWidth={3} />
        {Array.from({ length: 6 }, (_, k) => {
          const sx = doorX - 70 + (k * (doorW + 140)) / 6;
          return <path key={k} d={`M${sx + 6} ${doorTop + 10} L${doorX - 40 + (k * (doorW + 80)) / 6 + 6} ${doorTop - 64} L${doorX - 40 + ((k + 0.5) * (doorW + 80)) / 6} ${doorTop - 64} L${sx + (doorW + 140) / 12} ${doorTop + 10} Z`} fill={lighten(awning, 0.22)} opacity={0.7} />;
        })}
        {Array.from({ length: 9 }, (_, k) => {
          const sx = doorX - 70 + (k * (doorW + 140)) / 9;
          return <path key={`s${k}`} d={`M${sx} ${doorTop + 10} q${(doorW + 140) / 18} 22 ${(doorW + 140) / 9} 0`} fill={darken(awning, 0.15)} stroke={ink} strokeWidth={2.4} />;
        })}
      </g>
      {/* البضائع أمام الدكان */}
      <g>
        <rect x={doorX - 30} y={GROUND - 92} width={doorW + 60} height={92} fill={darken(ID.copper, 0.5)} stroke={ink} strokeWidth={3} />
        {Array.from({ length: 4 }, (_, k) => (
          <line key={k} x1={doorX - 30} y1={GROUND - 92 + k * 23} x2={doorX + doorW + 30} y2={GROUND - 92 + k * 23} stroke={darken(ID.copper, 0.62)} strokeWidth={2} />
        ))}
        {goods === "fruit"
          ? Array.from({ length: 14 }, (_, k) => <circle key={k} cx={doorX - 14 + k * ((doorW + 30) / 13)} cy={GROUND - 104 - (k % 2) * 12} r={15} fill={k % 3 ? mix(ID.dawn, ID.seal, 0.35) : mix(ID.seal, ID.copper, 0.2)} stroke={ink} strokeWidth={2} />)
          : goods === "spice"
            ? Array.from({ length: 5 }, (_, k) => (
                <g key={k}>
                  <path d={`M${doorX - 20 + k * (doorW / 4)} ${GROUND - 92} q0 -54 34 -60 q34 6 34 60 z`} fill={[ID.seal, ID.copper, mix(ID.dawn, ID.seal, 0.2), darken(ID.copper, 0.2), mix(ID.seal, ID.night, 0.3)][k]} stroke={ink} strokeWidth={2.4} />
                  <ellipse cx={doorX + 14 + k * (doorW / 4)} cy={GROUND - 150} rx={30} ry={8} fill={lighten([ID.seal, ID.copper, ID.dawn, ID.copper, ID.seal][k]!, 0.2)} />
                </g>
              ))
            : goods === "cloth"
              ? Array.from({ length: 6 }, (_, k) => <rect key={k} x={doorX - 18 + k * (doorW / 5.2)} y={GROUND - 132} width={doorW / 6} height={40} rx={18} fill={[ID.seal, ID.paper, ID.copper, mix(ID.night, ID.paper, 0.4), ID.dawn, mix(ID.seal, ID.paper, 0.4)][k]} stroke={ink} strokeWidth={2.4} />)
              : Array.from({ length: 5 }, (_, k) => <path key={k} d={`M${doorX - 4 + k * (doorW / 4.6)} ${GROUND - 92} q-14 -30 4 -50 h24 q18 20 4 50 z`} fill={mix(ID.copper, ID.seal, 0.3 + (k % 2) * 0.2)} stroke={ink} strokeWidth={2.4} />)}
      </g>
    </g>
  );
};

/** عربة فاكهة خشبية */
export const FruitCart: React.FC<{ x: number; missing?: number }> = ({ x, missing = 0 }) => {
  const ink = darken(ID.night, 0.55);
  const wood = darken(ID.copper, 0.42);
  const fruit: [number, number][] = [];
  for (let row = 0; row < 4; row++) for (let i = 0; i < 7 - row; i++) fruit.push([x + 26 + row * 14 + i * 28, GROUND - 168 - row * 22]);
  return (
    <g>
      <rect x={x} y={GROUND - 150} width={230} height={70} fill={wood} stroke={ink} strokeWidth={3} />
      <rect x={x - 8} y={GROUND - 158} width={246} height={12} fill={lighten(wood, 0.1)} stroke={ink} strokeWidth={3} />
      {fruit.slice(0, fruit.length - missing).map(([fx, fy], i) => (
        <circle key={i} cx={fx} cy={fy} r={13} fill={i % 4 ? mix(ID.dawn, ID.seal, 0.3) : mix(ID.seal, ID.copper, 0.25)} stroke={ink} strokeWidth={2} />
      ))}
      <circle cx={x + 60} cy={GROUND - 44} r={42} fill="none" stroke={ink} strokeWidth={9} />
      <circle cx={x + 60} cy={GROUND - 44} r={42} fill="none" stroke={darken(ID.copper, 0.25)} strokeWidth={5} />
      {Array.from({ length: 6 }, (_, k) => (
        <line key={k} x1={x + 60} y1={GROUND - 44} x2={x + 60 + 40 * Math.cos((k * Math.PI) / 3)} y2={GROUND - 44 + 40 * Math.sin((k * Math.PI) / 3)} stroke={darken(ID.copper, 0.3)} strokeWidth={4} />
      ))}
      <path d={`M${x + 230} ${GROUND - 120} L${x + 330} ${GROUND - 70}`} stroke={wood} strokeWidth={10} strokeLinecap="round" />
      <rect x={x + 190} y={GROUND - 80} width={10} height={80} fill={wood} />
    </g>
  );
};

/** الشارع كاملًا (خلفية وأرض)؛ الشخصيات تضيفها اللقطة */
export const SouqStreet: React.FC<{ frame: number; warm?: number }> = ({ frame, warm = 1 }) => {
  const wallA = mix(mix(ID.copper, ID.paper, 0.38), ID.seal, 0.08);
  const wallB = mix(mix(ID.copper, ID.paper, 0.28), ID.night, 0.08);
  const wallC = mix(mix(ID.copper, ID.paper, 0.45), ID.dawn, 0.12);
  const sky = [mix(ID.dawn, ID.paper, 0.35), mix(ID.dawn, ID.seal, 0.25)];
  const shops: { w: number; wall: string; aw: string; goods: "fruit" | "spice" | "cloth" | "pots" }[] = [
    { w: 520, wall: wallA, aw: mix(ID.seal, ID.copper, 0.15), goods: "spice" },
    { w: 470, wall: wallB, aw: mix(ID.night, ID.paper, 0.35), goods: "cloth" },
    { w: 560, wall: wallC, aw: ID.seal, goods: "fruit" },
    { w: 500, wall: wallA, aw: mix(ID.copper, ID.dawn, 0.4), goods: "pots" },
    { w: 520, wall: wallB, aw: mix(ID.seal, ID.night, 0.25), goods: "spice" },
  ];
  let x = STREET_X0;
  const ink = darken(ID.night, 0.55);
  return (
    <g>
      <rect x={STREET_X0 - 200} y={-300} width={2900} height={GROUND + 300} fill={sky[0]} />
      <rect x={STREET_X0 - 200} y={-300} width={2900} height={200} fill={sky[1]} opacity={0.4} />
      {/* مبانٍ خلفية بقبة ومئذنة بعيدة */}
      <g fill={mix(sky[0]!, ID.copper, 0.35)} opacity={0.8}>
        <rect x={300} y={-60} width={30} height={260} />
        <path d="M296 -60 L315 -110 L334 -60 Z" />
        <rect x={1300} y={-10} width={240} height={200} />
        <path d="M1320 -10 Q1320 -150 1420 -160 Q1520 -150 1520 -10 Z" />
      </g>
      {shops.map((s, i) => {
        const el = <Facade key={i} x={x} w={s.w} h={720 + (i % 2) * 70} wall={s.wall} seed={i * 3 + 1} frame={frame} awning={s.aw} goods={s.goods} />;
        x += s.w;
        return el;
      })}
      <Texture kind="plaster" x={STREET_X0} y={-100} w={2600} h={GROUND + 100} opacity={0.55} />
      {/* حبل المصابيح يتمايل */}
      {[0, 1].map((k) => {
        const x0 = k ? 980 : -120;
        const x1 = k ? 2120 : 1040;
        const sag = 70 + Math.sin(frame / 30 + k) * 6;
        const y0 = 120;
        return (
          <g key={k}>
            <path d={`M${x0} ${y0} Q${(x0 + x1) / 2} ${y0 + sag * 2} ${x1} ${y0}`} stroke={ink} strokeWidth={3} fill="none" />
            {Array.from({ length: 9 }, (_, i) => {
              const t = (i + 1) / 10;
              const bx = x0 + (x1 - x0) * t;
              const by = y0 + 2 * sag * 2 * t * (1 - t);
              return (
                <g key={i}>
                  <Glow cx={bx} cy={by + 16} r={60} opacity={0.5 * warm} />
                  <line x1={bx} y1={by} x2={bx} y2={by + 10} stroke={ink} strokeWidth={2} />
                  <path d={archPath(bx - 9, by + 34, 18, 24)} fill={lighten(ID.dawn, 0.15)} stroke={ink} strokeWidth={2} />
                </g>
              );
            })}
          </g>
        );
      })}
      {/* الأرض والرصيف */}
      <rect x={STREET_X0 - 200} y={GROUND} width={2900} height={500} fill={mix(darken(ID.copper, 0.45), ID.night, 0.35)} />
      <rect x={STREET_X0 - 200} y={GROUND} width={2900} height={14} fill={darken(ID.copper, 0.6)} />
      {Array.from({ length: 5 }, (_, j) =>
        Array.from({ length: 48 }, (_, i) => <rect key={`${i}-${j}`} x={STREET_X0 + i * 56 + (j % 2) * 28} y={GROUND + 24 + j * 40} width={44} height={8} rx={4} fill={lighten(mix(darken(ID.copper, 0.45), ID.night, 0.35), 0.08)} opacity={0.7 - j * 0.1} />),
      )}
      <Texture kind="plaster" x={STREET_X0} y={GROUND} w={2600} h={400} opacity={0.4} />
      {/* شمس العصر من اليمين */}
      <Beam d={`M2300 -200 L2500 -200 L1100 ${GROUND + 200} L700 ${GROUND + 200} Z`} color={ID.dawn} opacity={0.22 * warm} />
      <LightPool cx={1200} cy={GROUND + 40} rx={700} ry={90} color={ID.dawn} opacity={0.35 * warm} />
    </g>
  );
};
