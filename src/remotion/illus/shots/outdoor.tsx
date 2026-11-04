import React from "react";
import { ID, MOODS, darken, lighten, mix, type Mood } from "../palette";
import { Glow, GROUND, Sky, archPath, rand } from "../world";
import { Texture, LightPool } from "../texture";
import { Figure, LOOKS } from "../Figure";
import { walkPose, POSES } from "../Figure";

const INK = darken(ID.night, 0.55);

/** صحن دار بنافورة وأقواس ونباتات، ليلًا */
export const Courtyard: React.FC<{ frame: number }> = ({ frame }) => {
  const wall = mix(darken(ID.copper, 0.35), ID.night, 0.45);
  const tile = mix(darken(ID.copper, 0.5), ID.night, 0.35);
  return (
    <g>
      <Sky mood="night" frame={frame} />
      <rect x={-300} y={140} width={2520} height={GROUND - 140} fill={wall} />
      {[-200, 260, 720, 1180, 1640, 2100].map((ax, i) => (
        <g key={i}>
          <rect x={ax - 30} y={140} width={60} height={GROUND - 140} fill={darken(wall, 0.18)} />
          <path d={archPath(ax + 30, GROUND - 40, 400, 520)} fill={mix(darken(ID.night, 0.45), ID.copper, 0.08)} />
          {i % 2 ? <Glow cx={ax + 230} cy={GROUND - 300} r={220} opacity={0.4} /> : null}
          {i % 2 ? <path d={archPath(ax + 200, GROUND - 260, 60, 80)} fill={ID.dawn} opacity={0.8} /> : null}
        </g>
      ))}
      <rect x={-300} y={130} width={2520} height={20} fill={darken(wall, 0.3)} />
      <Texture kind="plaster" x={-300} y={130} w={2520} h={GROUND - 130} opacity={0.5} />
      <rect x={-300} y={GROUND - 40} width={2520} height={500} fill={tile} />
      {Array.from({ length: 30 }, (_, i) => (
        <path key={i} d={`M${-300 + i * 90} ${GROUND - 40} L${-340 + i * 90} ${GROUND + 400}`} stroke={darken(tile, 0.25)} strokeWidth={2} />
      ))}
      {/* النافورة: ماء ينبجس ويتساقط */}
      <g>
        <ellipse cx={960} cy={GROUND + 20} rx={260} ry={46} fill={darken(ID.copper, 0.4)} stroke={INK} strokeWidth={3} />
        <ellipse cx={960} cy={GROUND + 10} rx={230} ry={34} fill={mix(ID.night, "#3E7C78", 0.4)} />
        <rect x={944} y={GROUND - 120} width={32} height={130} fill={darken(ID.copper, 0.35)} stroke={INK} strokeWidth={3} />
        <ellipse cx={960} cy={GROUND - 120} rx={80} ry={16} fill={darken(ID.copper, 0.3)} stroke={INK} strokeWidth={3} />
        {Array.from({ length: 8 }, (_, i) => {
          const p = ((frame * 1.5 + i * 12) % 40) / 40;
          const dir = i % 2 ? 1 : -1;
          const xx = 960 + dir * (20 + p * 70);
          const yy = GROUND - 150 - 40 * Math.sin(p * Math.PI) + p * 120;
          return <circle key={i} cx={xx} cy={yy} r={4} fill={lighten(ID.paper, 0.1)} opacity={0.7 * (1 - p)} />;
        })}
        <path d={`M960 ${GROUND - 128} q-6 -40 0 -60 q6 20 0 60`} fill={lighten(ID.paper, 0.1)} opacity={0.6 + 0.2 * Math.sin(frame / 6)} />
        {Array.from({ length: 3 }, (_, i) => {
          const p = ((frame + i * 20) % 60) / 60;
          return <ellipse key={i} cx={960} cy={GROUND + 12} rx={40 + p * 180} ry={6 + p * 26} fill="none" stroke={ID.paper} strokeWidth={2} opacity={0.4 * (1 - p)} />;
        })}
      </g>
      {/* نباتات في أصص */}
      {[300, 1560].map((px, i) => (
        <g key={i}>
          <path d={`M${px - 40} ${GROUND - 40} L${px + 40} ${GROUND - 40} L${px + 30} ${GROUND + 30} L${px - 30} ${GROUND + 30} Z`} fill={mix(ID.seal, ID.copper, 0.4)} stroke={INK} strokeWidth={3} />
          {Array.from({ length: 7 }, (_, k) => (
            <path key={k} d={`M${px} ${GROUND - 40} q${(k - 3) * 30} -120 ${(k - 3) * 44} -${150 + (k % 3) * 30}`} stroke={mix(ID.night, "#4A7A4E", 0.55)} strokeWidth={9} fill="none" strokeLinecap="round" transform={`rotate(${Math.sin(frame / 40 + k) * 1.5} ${px} ${GROUND - 40})`} />
          ))}
        </g>
      ))}
      <LightPool cx={960} cy={GROUND + 30} rx={700} ry={80} color={ID.dawn} opacity={0.3} />
    </g>
  );
};

/** أسطح المدينة: خزانات ماء وحبال غسيل وسور السطح، والمدينة خلفها بقبة ومئذنة؛ الليل يتحول فجرًا، والضباب يزحف */
export const Rooftops: React.FC<{ frame: number; mood: Mood; to?: Mood; t?: number; fog?: number; streetPeople?: boolean }> = ({ frame, mood, to, t = 0, fog = 0, streetPeople = false }) => {
  const sky = MOODS[t > 0.5 && to ? to : mood].sky;
  const lightT = to === "dawn" ? t : 0;
  const far = mix(mix(sky[1], darken(ID.night, 0.4), 0.55), ID.copper, 0.1 + 0.2 * lightT);
  const mid = mix(mix(sky[1], darken(ID.night, 0.5), 0.7), ID.copper, 0.12 + 0.2 * lightT);
  const near = mix(mix(darken(ID.copper, 0.5), ID.night, 0.45), ID.copper, 0.25 * lightT);
  const r = rand(21);
  const blocks = Array.from({ length: 22 }, (_, i) => ({ x: -300 + i * 120 + r() * 30, w: 100 + r() * 90, h: 80 + r() * 160, lit: r() }));
  return (
    <g>
      <Sky mood={mood} to={to} t={t} frame={frame} />
      {/* شمس الفجر تطلع خلف المدينة */}
      {lightT > 0.01 ? (
        <g opacity={Math.min(1, lightT * 1.4)}>
          <Glow cx={1250} cy={GROUND - 420 - 260 * lightT} r={520} color={ID.dawn} opacity={0.8} />
          <circle cx={1250} cy={GROUND - 420 - 260 * lightT} r={90} fill={lighten(ID.dawn, 0.3)} />
        </g>
      ) : null}
      {/* المدينة البعيدة */}
      <g fill={far}>
        {blocks.map((b, i) => (
          <rect key={i} x={b.x} y={GROUND - 420 - b.h} width={b.w} height={b.h + 400} />
        ))}
        <rect x={1120} y={GROUND - 640} width={260} height={200} />
        <path d="M1140 220 Q1140 40 1250 25 Q1360 40 1360 220 Z" />
        <rect x={1246} y={-30} width={8} height={60} />
        <rect x={1500} y={GROUND - 900} width={34} height={500} />
        <rect x={1490} y={GROUND - 780} width={54} height={14} />
        <path d={`M1500 ${GROUND - 900} L1517 ${GROUND - 950} L1534 ${GROUND - 900} Z`} />
      </g>
      {blocks.map((b, i) =>
        b.lit > 0.45 ? <rect key={`w${i}`} x={b.x + 20} y={GROUND - 400 - b.h + 30} width={16} height={22} fill={ID.dawn} opacity={0.55 * (1 - lightT * 0.7)} /> : null,
      )}
      {/* أسطح أقرب: خزانات وغسيل */}
      <g>
        <rect x={-300} y={GROUND - 300} width={2520} height={400} fill={mid} />
        {[80, 640, 1180, 1720].map((tx, i) => (
          <g key={i}>
            <rect x={tx} y={GROUND - 420} width={120} height={100} rx={10} fill={darken(mid, 0.12)} stroke={INK} strokeWidth={3} />
            <rect x={tx + 10} y={GROUND - 320} width={10} height={24} fill={darken(mid, 0.2)} />
            <rect x={tx + 100} y={GROUND - 320} width={10} height={24} fill={darken(mid, 0.2)} />
          </g>
        ))}
        {[300, 1400].map((lx, i) => {
          const y0 = GROUND - 380;
          return (
            <g key={i}>
              <line x1={lx} y1={y0} x2={lx} y2={GROUND - 300} stroke={INK} strokeWidth={4} />
              <line x1={lx + 300} y1={y0} x2={lx + 300} y2={GROUND - 300} stroke={INK} strokeWidth={4} />
              <path d={`M${lx} ${y0} Q${lx + 150} ${y0 + 30} ${lx + 300} ${y0}`} stroke={INK} strokeWidth={2} fill="none" />
              {Array.from({ length: 4 }, (_, k) => {
                const cx = lx + 40 + k * 66;
                const sw = Math.sin(frame / 18 + k + i) * 5;
                return <path key={k} d={`M${cx} ${y0 + 12} l46 0 l${4 + sw} 70 l-54 0 z`} fill={[ID.paper, ID.seal, mix(ID.night, ID.paper, 0.5), ID.copper][(k + i) % 4]} stroke={INK} strokeWidth={2} opacity={0.9} />;
              })}
            </g>
          );
        })}
      </g>
      {/* الشارع في الأسفل بين الأسطح: ناس صغار يمشون */}
      {streetPeople ? (
        <g opacity={0.85}>
          <rect x={300} y={GROUND - 300} width={700} height={70} fill={mix(darken(ID.night, 0.3), ID.copper, 0.2)} />
          <LightPool cx={650} cy={GROUND - 250} rx={380} ry={40} color={ID.dawn} opacity={0.6} />
          {[0, 1, 2, 3].map((k) => {
            const p = ((frame * 0.8 + k * 90) % 520) / 520;
            const x = k % 2 ? 380 + p * 520 : 900 - p * 520;
            return <Figure key={k} x={x} y={GROUND - 236} scale={0.3} pose={walkPose(POSES.stand, frame / 5 + k)} look={[LOOKS.woman, LOOKS.elder, LOOKS.friend, LOOKS.stranger][k]!} flip={!(k % 2)} shadow={false} frame={frame} />;
          })}
        </g>
      ) : null}
      {/* سطحنا: سور بفتحات وأرضية */}
      <rect x={-300} y={GROUND - 120} width={2520} height={600} fill={near} />
      {Array.from({ length: 24 }, (_, i) => (
        <rect key={i} x={-300 + i * 110} y={GROUND - 160} width={70} height={44} fill={near} stroke={INK} strokeWidth={2.4} />
      ))}
      <rect x={-300} y={GROUND - 124} width={2520} height={8} fill={darken(near, 0.3)} />
      <Texture kind="plaster" x={-300} y={GROUND - 160} w={2520} h={700} opacity={0.5} />
      {/* ضوء الفجر من الخلف */}
      <LightPool cx={1250} cy={GROUND - 420} rx={1000} ry={260} color={ID.dawn} opacity={0.5 * lightT} />
      {/* الضباب يزحف فيمحو الحدود */}
      {fog > 0.01 ? (
        <g opacity={fog} filter="url(#fog-soft)">
          <defs>
            <filter id="fog-soft" x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur stdDeviation="38" />
            </filter>
          </defs>
          {Array.from({ length: 6 }, (_, i) => {
            const dx = ((frame * (0.6 + i * 0.15) + i * 400) % 3200) - 900;
            return <ellipse key={i} cx={dx} cy={GROUND - 340 + (i % 3) * 90} rx={760} ry={120} fill={mix(ID.paper, sky[2], 0.4)} opacity={0.32} />;
          })}
          <rect x={-300} y={GROUND - 500} width={2520} height={400} fill={mix(ID.paper, sky[2], 0.5)} opacity={0.22} />
        </g>
      ) : null}
    </g>
  );
};

/** سور السطح في المقدمة: يقف البطل خلفه فيظهر نصفه الأعلى ويتكئ عليه */
export const RoofWall: React.FC<{ frame: number }> = () => {
  const c = mix(darken(ID.copper, 0.45), ID.night, 0.4);
  const top = GROUND - 150;
  return (
    <g>
      <rect x={-300} y={top} width={2520} height={600} fill={c} />
      <rect x={-300} y={top - 14} width={2520} height={18} fill={lighten(c, 0.1)} stroke={INK} strokeWidth={3} />
      {Array.from({ length: 26 }, (_, i) => (
        <rect key={i} x={-300 + i * 100 + 30} y={top + 40} width={40} height={60} rx={20} fill={darken(c, 0.25)} />
      ))}
      <Texture kind="plaster" x={-300} y={top - 14} w={2520} h={620} opacity={0.5} />
    </g>
  );
};
