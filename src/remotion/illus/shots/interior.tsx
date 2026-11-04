import React from "react";
import { ID, darken, lighten, mix } from "../palette";
import { Glow, GROUND, archPath, rand } from "../world";
import { Texture, LightPool, Beam } from "../texture";
import { Figure, LOOKS, POSES } from "../Figure";
import { Steam } from "./kit";

/**
 * أماكن داخلية مرسومة بطبقات وملمس ومصادر ضوء: البيت (مجلس بمكتبة وصور وصندوق رسائل ونافذة)،
 * والمقهى (أقواس وطاولات وفوانيس وروّاد)، والورشة (أدوات ومنضدة وكرسي قيد الصنع)،
 * والنافذة الملوّنة (مشربية بزجاج ملوّن يطل على الشارع)، ونافذة الليل التي تعكس صاحبها.
 */
const INK = darken(ID.night, 0.55);

const Room: React.FC<{ wall: string; floor: string; x0?: number; x1?: number; wains?: boolean }> = ({ wall, floor, x0 = -300, x1 = 2220, wains = true }) => (
  <g>
    <rect x={x0} y={-300} width={x1 - x0} height={GROUND + 300} fill={wall} />
    <rect x={x0} y={-300} width={x1 - x0} height={340} fill="#000" opacity={0.12} />
    {wains ? (
      <g>
        <rect x={x0} y={GROUND - 210} width={x1 - x0} height={210} fill={darken(wall, 0.14)} />
        <rect x={x0} y={GROUND - 216} width={x1 - x0} height={12} fill={darken(ID.copper, 0.45)} />
        {Array.from({ length: Math.ceil((x1 - x0) / 120) }, (_, i) => (
          <rect key={i} x={x0 + i * 120 + 16} y={GROUND - 186} width={88} height={160} fill="none" stroke={darken(wall, 0.24)} strokeWidth={3} />
        ))}
      </g>
    ) : null}
    <Texture kind="plaster" x={x0} y={-300} w={x1 - x0} h={GROUND + 300} opacity={0.6} />
    <rect x={x0} y={GROUND} width={x1 - x0} height={500} fill={floor} />
    {Array.from({ length: Math.ceil((x1 - x0) / 90) }, (_, i) => (
      <line key={i} x1={x0 + i * 90} y1={GROUND} x2={x0 + i * 90 - 60} y2={GROUND + 300} stroke={darken(floor, 0.18)} strokeWidth={2} />
    ))}
    <rect x={x0} y={GROUND} width={x1 - x0} height={10} fill={darken(floor, 0.3)} />
    <Texture kind="plaster" x={x0} y={GROUND} w={x1 - x0} h={300} opacity={0.35} />
  </g>
);

const Rug: React.FC<{ cx: number; w: number }> = ({ cx, w }) => (
  <g transform={`translate(${cx} ${GROUND + 70}) scale(1 0.3)`}>
    <rect x={-w / 2} y={-200} width={w} height={400} rx={10} fill={darken(ID.seal, 0.3)} stroke={INK} strokeWidth={8} />
    <rect x={-w / 2 + 30} y={-170} width={w - 60} height={340} fill="none" stroke={ID.copper} strokeWidth={12} />
    {Array.from({ length: Math.floor(w / 200) }, (_, i) => (
      <g key={i} transform={`translate(${-w / 2 + 130 + i * 200} 0)`}>
        <rect x={-50} y={-50} width={100} height={100} fill="none" stroke={ID.dawn} strokeWidth={10} />
        <rect x={-50} y={-50} width={100} height={100} fill="none" stroke={ID.dawn} strokeWidth={10} transform="rotate(45)" />
      </g>
    ))}
  </g>
);

export const Bookshelf: React.FC<{ x: number; glow?: number }> = ({ x, glow = 0 }) => {
  const r = rand(x);
  const wood = darken(ID.copper, 0.5);
  return (
    <g>
      <Glow cx={x + 140} cy={GROUND - 380} r={360} opacity={glow * 0.9} />
      <rect x={x} y={GROUND - 640} width={280} height={640} fill={darken(wood, 0.25)} stroke={INK} strokeWidth={3} />
      {[0, 1, 2, 3].map((k) => {
        const sy = GROUND - 620 + k * 150;
        let bx = x + 16;
        const books: React.ReactNode[] = [];
        while (bx < x + 250) {
          const bw = 14 + r() * 14;
          const bh = 90 + r() * 40;
          const col = [ID.seal, ID.copper, mix(ID.night, ID.paper, 0.4), ID.paper, darken(ID.seal, 0.3)][Math.floor(r() * 5)]!;
          books.push(<rect key={bx} x={bx} y={sy + 130 - bh} width={bw} height={bh} fill={mix(col, ID.dawn, glow * 0.25)} stroke={INK} strokeWidth={1.6} />);
          bx += bw + 2;
        }
        return (
          <g key={k}>
            {books}
            <rect x={x} y={sy + 130} width={280} height={12} fill={wood} />
          </g>
        );
      })}
    </g>
  );
};

/** إطار صورة معلّق، بداخله أشخاص بلا ملامح (من نحبهم) */
export const PhotoFrame: React.FC<{ x: number; y: number; w?: number; glow?: number; people?: number }> = ({ x, y, w = 150, glow = 0, people = 2 }) => (
  <g>
    <Glow cx={x + w / 2} cy={y + w * 0.6} r={w * 1.3} opacity={glow * 0.8} />
    <rect x={x} y={y} width={w} height={w * 1.2} fill={darken(ID.copper, 0.35)} stroke={INK} strokeWidth={3} />
    <rect x={x + 12} y={y + 12} width={w - 24} height={w * 1.2 - 24} fill={mix(ID.paper, ID.dawn, 0.2 + glow * 0.4)} />
    <svg x={x + 12} y={y + 12} width={w - 24} height={w * 1.2 - 24} viewBox="-160 -330 320 330" preserveAspectRatio="xMidYMax meet">
      <Figure x={people > 1 ? -50 : 0} y={0} scale={0.95} pose={POSES.stand} look={LOOKS.woman} shadow={false} />
      {people > 1 ? <Figure x={60} y={0} scale={0.62} pose={POSES.stand} look={LOOKS.boy} flip shadow={false} /> : null}
    </svg>
  </g>
);

/** صندوق رسائل قديم ينفتح فيضيء ما فيه (تجاربنا) */
export const LetterBox: React.FC<{ x: number; open?: number }> = ({ x, open = 0 }) => {
  const wood = darken(ID.copper, 0.4);
  const y = GROUND - 230;
  return (
    <g>
      <Glow cx={x + 70} cy={y - 10} r={200} opacity={open} />
      <rect x={x} y={y} width={140} height={70} fill={wood} stroke={INK} strokeWidth={3} />
      {[0, 1, 2].map((k) => (
        <rect key={k} x={x + 18 + k * 34} y={y - 22 * open - k * 6 * open} width={56} height={36} fill={ID.paper} stroke={INK} strokeWidth={2} transform={`rotate(${(k - 1) * 10 * open} ${x + 46 + k * 34} ${y})`} opacity={open} />
      ))}
      <path d={`M${x} ${y} L${x + 140} ${y}`} stroke={INK} strokeWidth={3} />
      <rect x={x} y={y - 16} width={140} height={16} fill={lighten(wood, 0.1)} stroke={INK} strokeWidth={3} transform={`rotate(${-70 * open} ${x} ${y})`} />
    </g>
  );
};

export const Sideboard: React.FC<{ x: number; w?: number }> = ({ x, w = 360 }) => (
  <g>
    <rect x={x} y={GROUND - 160} width={w} height={160} fill={darken(ID.copper, 0.5)} stroke={INK} strokeWidth={3} />
    <rect x={x - 10} y={GROUND - 172} width={w + 20} height={14} fill={darken(ID.copper, 0.38)} stroke={INK} strokeWidth={3} />
    {[0, 1].map((k) => (
      <rect key={k} x={x + 20 + k * (w / 2)} y={GROUND - 140} width={w / 2 - 40} height={120} fill="none" stroke={darken(ID.copper, 0.65)} strokeWidth={3} />
    ))}
  </g>
);

/** نافذة مقوّسة بإطار خشبي، يرى منها لون الوقت */
export const ArchWindow: React.FC<{ x: number; w?: number; h?: number; sky: [string, string]; light?: number; bars?: boolean }> = ({ x, w = 300, h = 420, sky, light = 0.5, bars = true }) => {
  const y = GROUND - 280;
  return (
    <g>
      <path d={archPath(x - 22, y + 14, w + 44, h + 30)} fill={darken(ID.copper, 0.5)} stroke={INK} strokeWidth={3} />
      <path d={archPath(x, y, w, h)} fill={sky[0]} />
      <path d={archPath(x, y, w, h * 0.6)} fill={sky[1]} opacity={0.7} />
      {bars ? (
        <g stroke={darken(ID.copper, 0.5)} strokeWidth={8}>
          <line x1={x + w / 2} y1={y - h + 10} x2={x + w / 2} y2={y} />
          <line x1={x} y1={y - h * 0.45} x2={x + w} y2={y - h * 0.45} />
        </g>
      ) : null}
      <rect x={x - 30} y={y} width={w + 60} height={18} fill={darken(ID.copper, 0.45)} stroke={INK} strokeWidth={3} />
      <Beam d={`M${x} ${y - h} L${x + w} ${y - h} L${x + w + 380} ${GROUND + 120} L${x + 120} ${GROUND + 120} Z`} color={sky[1]} opacity={0.18 * light} />
    </g>
  );
};

export const DoorFrame: React.FC<{ x: number; light?: number; w?: number }> = ({ x, light = 0, w = 200 }) => (
  <g>
    <Glow cx={x + w / 2} cy={GROUND - 200} r={360} opacity={light * 0.8} />
    <path d={archPath(x - 20, GROUND, w + 40, 470)} fill={darken(ID.copper, 0.45)} stroke={INK} strokeWidth={3} />
    <path d={archPath(x, GROUND, w, 450)} fill={mix(darken(ID.night, 0.35), ID.dawn, light * 0.75)} />
  </g>
);

export const HangingLamp: React.FC<{ x: number; y: number; frame: number; on?: number; len?: number }> = ({ x, y, frame, on = 1, len = 120 }) => {
  const sw = Math.sin(frame / 34 + x) * 3;
  const fl = 0.9 + 0.1 * Math.sin(frame / 4 + x) * Math.sin(frame / 11);
  return (
    <g transform={`rotate(${sw} ${x} ${y - len})`}>
      <line x1={x} y1={y - len} x2={x} y2={y} stroke={INK} strokeWidth={3} />
      <Glow cx={x} cy={y + 30} r={220} opacity={on * fl * 0.85} />
      <path d={`M${x - 26} ${y + 12} L${x + 26} ${y + 12} L${x + 18} ${y + 54} L${x - 18} ${y + 54} Z`} fill={mix(ID.copper, ID.dawn, on * fl)} stroke={INK} strokeWidth={2.4} />
      <path d={`M${x - 30} ${y + 12} Q${x} ${y - 16} ${x + 30} ${y + 12} Z`} fill={darken(ID.copper, 0.2)} stroke={INK} strokeWidth={2.4} />
    </g>
  );
};

/** بيت دافئ: مجلس بمكتبة وصور وصندوق رسائل ونافذة الغروب */
export const HomeRoom: React.FC<{ frame: number; mood?: "dusk" | "night"; shelf?: number; frames?: number; box?: number; door?: number }> = ({ frame, mood = "dusk", shelf = 0, frames = 0, box = 0, door = 0 }) => {
  const wall = mood === "dusk" ? mix(mix(ID.copper, ID.paper, 0.45), ID.seal, 0.12) : mix(darken(ID.copper, 0.35), ID.night, 0.45);
  const floor = mix(darken(ID.copper, 0.5), ID.seal, 0.1);
  const sky: [string, string] = mood === "dusk" ? [mix(ID.seal, ID.dawn, 0.5), ID.dawn] : [darken(ID.night, 0.3), mix(ID.night, ID.copper, 0.2)];
  return (
    <g>
      <Room wall={wall} floor={floor} />
      <ArchWindow x={1440} sky={sky} light={mood === "dusk" ? 1 : 0.4} />
      <DoorFrame x={-120} light={door} />
      <Bookshelf x={180} glow={shelf} />
      <PhotoFrame x={560} y={GROUND - 600} glow={frames} people={2} />
      <PhotoFrame x={760} y={GROUND - 560} w={120} glow={frames} people={1} />
      <Sideboard x={1000} w={340} />
      <LetterBox x={1100} open={box} />
      <HangingLamp x={900} y={60} frame={frame} on={mood === "dusk" ? 0.6 : 1} />
      <Rug cx={960} w={1300} />
      <LightPool cx={1300} cy={GROUND + 60} rx={600} ry={80} color={sky[1]} opacity={mood === "dusk" ? 0.5 : 0.25} />
    </g>
  );
};

/** مقهى الحارة ليلًا: أقواس وطاولات وكؤوس شاي يتصاعد بخارها وروّاد في الخلف */
export const Cafe: React.FC<{ frame: number }> = ({ frame }) => {
  const wall = mix(darken(ID.copper, 0.25), ID.night, 0.35);
  const floor = mix(darken(ID.copper, 0.55), ID.night, 0.3);
  return (
    <g>
      <Room wall={wall} floor={floor} wains={false} />
      {[-160, 380, 920, 1460, 2000].map((ax, i) => (
        <g key={i}>
          <path d={archPath(ax - 12, GROUND - 120, 344, 560)} fill={darken(wall, 0.25)} />
          <path d={archPath(ax, GROUND - 120, 320, 540)} fill={mix(darken(ID.night, 0.4), ID.copper, 0.12)} />
          <Glow cx={ax + 160} cy={GROUND - 360} r={240} opacity={0.35} />
        </g>
      ))}
      <Texture kind="plaster" x={-300} y={-300} w={2520} h={GROUND + 300} opacity={0.45} />
      {/* روّاد في الخلف (ظلال دافئة) */}
      {[
        [520, LOOKS.elder, "sit"],
        [640, LOOKS.vendor, "talk"],
        [1560, LOOKS.friend, "sit"],
        [1690, LOOKS.stranger, "nod"],
      ].map(([x, l, p], i) => (
        <g key={i} opacity={0.55}>
          <rect x={(x as number) - 30} y={GROUND - 240} width={150} height={10} fill={darken(ID.copper, 0.6)} />
          <Figure x={x as number} y={GROUND - 120} scale={0.82} pose={POSES[(p as "sit") ?? "sit"]} look={l as typeof LOOKS.elder} flip={i % 2 === 1} silhouette={mix(ID.night, ID.copper, 0.35)} shadow={false} frame={frame + i * 13} />
        </g>
      ))}
      {[260, 800, 1340, 1880].map((lx, i) => (
        <HangingLamp key={i} x={lx} y={70 + (i % 2) * 30} frame={frame} len={160} />
      ))}
      <LightPool cx={960} cy={GROUND + 40} rx={900} ry={90} color={ID.dawn} opacity={0.4} />
    </g>
  );
};

/** طاولة مقهى بكأسي شاي وبخار */
export const CafeTable: React.FC<{ x: number; frame: number }> = ({ x, frame }) => (
  <g>
    <ellipse cx={x} cy={GROUND - 170} rx={130} ry={18} fill={darken(ID.copper, 0.35)} stroke={INK} strokeWidth={3} />
    <rect x={x - 8} y={GROUND - 165} width={16} height={160} fill={darken(ID.copper, 0.5)} />
    <ellipse cx={x} cy={GROUND - 4} rx={60} ry={8} fill={darken(ID.copper, 0.5)} />
    {[-40, 30].map((dx, i) => (
      <g key={i}>
        <path d={`M${x + dx - 12} ${GROUND - 214} L${x + dx + 12} ${GROUND - 214} L${x + dx + 9} ${GROUND - 178} L${x + dx - 9} ${GROUND - 178} Z`} fill={mix(ID.paper, ID.dawn, 0.3)} stroke={INK} strokeWidth={2} opacity={0.9} />
        <rect x={x + dx - 9} y={GROUND - 200} width={18} height={20} fill={darken(ID.seal, 0.2)} opacity={0.8} />
        <Steam frame={frame + i * 17} x={x + dx - 3} y={GROUND - 222} />
      </g>
    ))}
  </g>
);

/** كرسي (للجلوس إلى طاولة) */
export const Chair: React.FC<{ x: number; flip?: boolean }> = ({ x, flip = false }) => (
  <g transform={flip ? `translate(${2 * x} 0) scale(-1 1)` : undefined}>
    <rect x={x - 50} y={GROUND - 90} width={100} height={12} fill={darken(ID.copper, 0.4)} stroke={INK} strokeWidth={2.4} />
    <rect x={x - 46} y={GROUND - 80} width={8} height={80} fill={darken(ID.copper, 0.5)} />
    <rect x={x + 38} y={GROUND - 80} width={8} height={80} fill={darken(ID.copper, 0.5)} />
    <rect x={x - 50} y={GROUND - 230} width={10} height={150} fill={darken(ID.copper, 0.45)} stroke={INK} strokeWidth={2} />
  </g>
);

/** ورشة نجارة: لوح أدوات، ألواح خشب، منضدة، وكرسي قيد الصنع */
export const Workshop: React.FC<{ frame: number; chairTilt?: number }> = ({ frame, chairTilt = 0 }) => {
  const wall = mix(mix(ID.copper, ID.paper, 0.3), ID.night, 0.18);
  const floor = mix(darken(ID.copper, 0.38), ID.paper, 0.05);
  const wood = darken(ID.copper, 0.35);
  return (
    <g>
      <Room wall={wall} floor={floor} wains={false} />
      <ArchWindow x={1500} w={260} h={360} sky={[mix(ID.dawn, ID.paper, 0.4), lighten(ID.dawn, 0.2)]} light={1} />
      {/* لوح الأدوات: مطرقة ومنشار وزاوية وأزاميل معلّقة */}
      <rect x={140} y={GROUND - 640} width={560} height={300} fill={darken(wood, 0.3)} stroke={INK} strokeWidth={3} />
      <g transform={`translate(0 ${GROUND})`} stroke={INK} strokeWidth={2.4}>
        <rect x={190} y={-600} width={12} height={150} fill={darken(ID.copper, 0.15)} />
        <rect x={168} y={-612} width={56} height={26} rx={4} fill={mix(ID.paper, ID.night, 0.45)} />
        <path d="M262 -600 L392 -600 L392 -540 L262 -510 Z" fill={mix(ID.paper, ID.night, 0.3)} />
        <rect x={392} y={-608} width={46} height={40} rx={10} fill={darken(ID.copper, 0.15)} />
        <path d="M470 -610 L486 -610 L486 -500 L560 -500 L560 -484 L470 -484 Z" fill={mix(ID.paper, ID.copper, 0.3)} />
        {[0, 1, 2].map((k) => (
          <g key={k}>
            <rect x={590 + k * 30} y={-610} width={14} height={60} rx={4} fill={darken(ID.copper, 0.1)} />
            <rect x={593 + k * 30} y={-550} width={8} height={70} fill={mix(ID.paper, ID.night, 0.4)} />
          </g>
        ))}
      </g>
      {/* ألواح خشب مسنودة */}
      {Array.from({ length: 6 }, (_, i) => (
        <rect key={i} x={1820 + i * 34} y={GROUND - 520 + (i % 2) * 20} width={26} height={520} fill={mix(wood, ID.paper, 0.1 + (i % 3) * 0.08)} stroke={INK} strokeWidth={2.4} transform={`rotate(${-6 + i} ${1820 + i * 34} ${GROUND})`} />
      ))}
      <Texture kind="plaster" x={-300} y={-300} w={2520} h={GROUND + 300} opacity={0.4} />
      {/* المنضدة */}
      <rect x={1060} y={GROUND - 210} width={420} height={26} fill={lighten(wood, 0.1)} stroke={INK} strokeWidth={3} />
      <rect x={1080} y={GROUND - 186} width={22} height={186} fill={wood} />
      <rect x={1438} y={GROUND - 186} width={22} height={186} fill={wood} />
      {/* كرسي قيد الصنع: ساق قصيرة فيميل */}
      <g transform={`rotate(${chairTilt} 1250 ${GROUND - 210})`}>
        <rect x={1180} y={GROUND - 330} width={140} height={14} fill={lighten(wood, 0.2)} stroke={INK} strokeWidth={2.4} />
        <rect x={1190} y={GROUND - 316} width={10} height={100} fill={lighten(wood, 0.15)} />
        <rect x={1300} y={GROUND - 316} width={10} height={86} fill={lighten(wood, 0.15)} />
        <rect x={1180} y={GROUND - 470} width={12} height={140} fill={lighten(wood, 0.2)} stroke={INK} strokeWidth={2} />
      </g>
      <LightPool cx={1300} cy={GROUND + 40} rx={600} ry={80} color={ID.dawn} opacity={0.4} />
      {/* نشارة خشب تتطاير ببطء في شعاع الشمس */}
      {Array.from({ length: 16 }, (_, i) => {
        const p = ((frame * 0.6 + i * 37) % 300) / 300;
        return <circle key={i} cx={1500 + i * 12 - p * 260} cy={GROUND - 520 + p * 400 + Math.sin(frame / 20 + i) * 10} r={2.4} fill={ID.dawn} opacity={0.5 * (1 - p)} />;
      })}
    </g>
  );
};

/** مشربية بزجاج ملوّن يُنظر منها إلى الشارع: كل لوح يلوّن ما وراءه */
export const TintedLattice: React.FC<{ frame: number; tint: string; tintAmount: number; outside: React.ReactNode }> = ({ frame, tint, tintAmount, outside }) => {
  const wall = mix(darken(ID.copper, 0.3), ID.night, 0.25);
  const wood = darken(ID.copper, 0.55);
  const x = 520;
  const y = 120;
  const w = 880;
  const h = 640;
  const panes = [ID.seal, ID.dawn, mix(ID.night, ID.paper, 0.45), ID.copper];
  return (
    <g>
      <rect x={-300} y={-300} width={2520} height={1500} fill={wall} />
      <Texture kind="plaster" x={-300} y={-300} w={2520} h={1500} opacity={0.5} />
      <defs>
        <clipPath id="lattice-view">
          <rect x={x} y={y} width={w} height={h} />
        </clipPath>
      </defs>
      <g clipPath="url(#lattice-view)">
        {outside}
        <rect x={x} y={y} width={w} height={h} fill={tint} opacity={tintAmount * 0.5} style={{ mixBlendMode: "multiply" }} />
        <rect x={x} y={y} width={w} height={h} fill={tint} opacity={tintAmount * 0.25} />
      </g>
      {/* الشبكة الخشبية وألواح الزجاج الملوّن */}
      {Array.from({ length: 4 }, (_, i) =>
        Array.from({ length: 3 }, (_, j) => (
          <rect key={`${i}-${j}`} x={x + i * (w / 4) + 8} y={y + j * (h / 3) + 8} width={w / 4 - 16} height={h / 3 - 16} fill={panes[(i + j) % 4]} opacity={0.14} />
        )),
      )}
      <g stroke={wood} strokeWidth={18}>
        {[1, 2, 3].map((i) => (
          <line key={`v${i}`} x1={x + (i * w) / 4} y1={y} x2={x + (i * w) / 4} y2={y + h} />
        ))}
        {[1, 2].map((j) => (
          <line key={`h${j}`} x1={x} y1={y + (j * h) / 3} x2={x + w} y2={y + (j * h) / 3} />
        ))}
      </g>
      <rect x={x - 30} y={y - 30} width={w + 60} height={h + 60} fill="none" stroke={wood} strokeWidth={40} />
      <rect x={x - 50} y={y + h + 20} width={w + 100} height={30} fill={darken(wood, 0.2)} stroke={INK} strokeWidth={3} />
      <Beam d={`M${x} ${y} L${x + w} ${y} L${x + w + 300} 1200 L${x - 200} 1200 Z`} color={tint} opacity={0.12 + tintAmount * 0.18} />
      <Glow cx={x + w / 2} cy={y + h / 2} r={700} color={tint} opacity={0.15 + 0.2 * tintAmount + 0.03 * Math.sin(frame / 20)} />
    </g>
  );
};

/** نافذة الليل: زجاج داكن يعكس صاحبه؛ والانعكاس قد يختلف عنه (ما يتمناه) */
export const NightWindow: React.FC<{ frame: number }> = ({ frame }) => {
  const wall = mix(darken(ID.copper, 0.45), ID.night, 0.55);
  return (
    <g>
      <Room wall={wall} floor={mix(darken(ID.copper, 0.6), ID.night, 0.4)} wains />
      <rect x={760} y={60} width={760} height={GROUND - 120} fill={darken(ID.night, 0.5)} stroke={darken(ID.copper, 0.5)} strokeWidth={30} />
      <g opacity={0.5}>
        {Array.from({ length: 30 }, (_, i) => {
          const r = rand(i + 3);
          return <circle key={i} cx={790 + r() * 700} cy={90 + r() * 300} r={r() * 1.8 + 0.6} fill={ID.paper} opacity={0.4 + 0.3 * Math.sin(frame / 15 + i)} />;
        })}
        <rect x={790} y={GROUND - 360} width={700} height={240} fill={mix(darken(ID.night, 0.3), ID.copper, 0.1)} />
        {Array.from({ length: 9 }, (_, i) => (
          <rect key={i} x={810 + i * 76} y={GROUND - 330 + (i % 3) * 40} width={20} height={26} fill={ID.dawn} opacity={i % 2 ? 0.7 : 0.25} />
        ))}
      </g>
      <line x1={1140} y1={60} x2={1140} y2={GROUND - 60} stroke={darken(ID.copper, 0.5)} strokeWidth={16} />
      <HangingLamp x={420} y={80} frame={frame} on={1} len={140} />
      <LightPool cx={420} cy={GROUND + 40} rx={500} ry={80} color={ID.dawn} opacity={0.45} />
    </g>
  );
};
