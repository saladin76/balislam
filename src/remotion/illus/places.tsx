import React from "react";
import { ID, MOODS, darken, lighten, mix, stoneFor, type Mood } from "./palette";
import { Bench, Cobbles, GROUND, Glow, HouseRow, Skyline, Sky, WallLamp, WW, WH, archPath, rand } from "./world";

/**
 * أماكن «بالإسلام» المصوَّرة: الحارة والسوق والبيت (حكايات الحارة)، والطريق بأربع بيئات (الطريق)، والمسرح (ظل ونور).
 * تُستعمل في القوالب وفي معرض «أماكن التصوير» بالاستوديو، فما يراه صاحب القناة في المكتبة هو ما يُرندر.
 */
export const Market: React.FC<{ mood: Mood; frame: number; lit: number }> = ({ mood, frame, lit }) => {
  const awnings = [ID.seal, ID.copper, mix(ID.night, ID.paper, 0.3), mix(ID.seal, ID.copper, 0.5)];
  const wall = stoneFor(mood, 0.05);
  return (
    <g>
      <rect x={-200} y={GROUND - 520} width={WW + 400} height={520} fill={wall} />
      {Array.from({ length: 6 }, (_, i) => {
        const x = -60 + i * 340;
        const col = awnings[i % awnings.length]!;
        return (
          <g key={i}>
            <path d={archPath(x + 20, GROUND, 280, 380)} fill={darken(wall, 0.32)} />
            <path d={`M${x + 4} ${GROUND - 290} L${x + 316} ${GROUND - 290} L${x + 300} ${GROUND - 230} L${x + 20} ${GROUND - 230} Z`} fill={col} />
            {Array.from({ length: 5 }, (_, k) => (
              <path key={k} d={`M${x + 20 + k * 56} ${GROUND - 230} q28 26 56 0`} fill={darken(col, 0.18)} />
            ))}
            <rect x={x + 40} y={GROUND - 150} width={240} height={150} fill={darken(ID.copper, 0.5)} />
            {Array.from({ length: 6 }, (_, k) => (
              <circle key={k} cx={x + 66 + k * 38} cy={GROUND - 162} r={17} fill={[ID.seal, ID.dawn, mix(ID.copper, ID.paper, 0.2)][k % 3]} />
            ))}
            <line x1={x + 160} y1={GROUND - 520} x2={x + 160} y2={GROUND - 420} stroke={darken(ID.copper, 0.4)} strokeWidth={3} />
            <WallLamp x={x + 160} y={GROUND - 420} on={0.55 + 0.45 * lit} frame={frame + i * 7} />
          </g>
        );
      })}
    </g>
  );
};

export const Home: React.FC<{ mood: Mood; frame: number; lit: number }> = ({ mood, frame, lit }) => {
  const wall = mix(stoneFor(mood, -0.05), ID.paper, 0.15);
  const win = MOODS[mood].sky;
  return (
    <g>
      <rect x={-200} y={-200} width={WW + 400} height={GROUND + 200} fill={wall} />
      <rect x={-200} y={GROUND - 40} width={WW + 400} height={40} fill={darken(wall, 0.15)} />
      {/* نافذة المحراب: منها يدخل مزاج المشهد */}
      <path d={archPath(1180, GROUND - 260, 360, 470)} fill={darken(wall, 0.25)} />
      <path d={archPath(1200, GROUND - 270, 320, 440)} fill={win[1]} />
      <path d={archPath(1200, GROUND - 270, 320, 440)} fill={win[2]} opacity={0.5} />
      <rect x={1356} y={GROUND - 710} width={8} height={440} fill={darken(wall, 0.25)} />
      <rect x={1200} y={GROUND - 500} width={320} height={8} fill={darken(wall, 0.25)} />
      <rect x={1170} y={GROUND - 272} width={380} height={18} fill={darken(wall, 0.3)} />
      <Glow cx={1360} cy={GROUND - 500} r={520} color={MOODS[mood].light} opacity={0.25 + 0.5 * lit} />
      <WallLamp x={520} y={GROUND - 520} on={0.7 + 0.3 * lit} frame={frame} />
      {/* سجادة بنقش النجمة الثمانية */}
      <g transform={`translate(${WW / 2} ${GROUND + 110}) scale(1 0.28)`}>
        <rect x={-560} y={-300} width={1120} height={600} rx={20} fill={darken(ID.seal, 0.35)} />
        <rect x={-520} y={-260} width={1040} height={520} rx={14} fill="none" stroke={ID.copper} strokeWidth={10} />
        {Array.from({ length: 5 }, (_, i) => (
          <g key={i} transform={`translate(${-400 + i * 200} 0)`}>
            <rect x={-46} y={-46} width={92} height={92} fill="none" stroke={ID.dawn} strokeWidth={8} />
            <rect x={-46} y={-46} width={92} height={92} fill="none" stroke={ID.dawn} strokeWidth={8} transform="rotate(45)" />
          </g>
        ))}
      </g>
    </g>
  );
};


/** الطريق: تلال بطبقتين وطريق ممتد، وبيئة لكل فصل (أطراف المدينة، الحقول، الصحراء، التلة) */
export type Biome = "city" | "fields" | "desert" | "hill";
export const RoadLand: React.FC<{ mood: Mood; biome: Biome; shift?: number; frame: number }> = ({ mood, biome, shift = 0, frame }) => {
  const sky = MOODS[mood].sky;
  const far = mix(mix(sky[1], darken(ID.night, 0.3), 0.4), ID.copper, 0.12);
  const mid = mix(mix(sky[1], darken(ID.night, 0.45), 0.6), ID.copper, 0.16);
  const near = mix(darken(ID.night, 0.5), stoneFor(mood, 0.5), 0.35);
    const P = 2880;
  // المنظر يتحرك يمينًا لأن المسافر يمشي يسارًا (اتجاه القراءة)، ونمط التلال دوري فلا قفزة عند التكرار
  const sx = (k: number) => ((shift * k) % P) - P;
  const hills = (y: number, amp: number, col: string, k: number, seed: number) => {
    const rr = rand(seed);
    const pts = Array.from({ length: 12 }, () => [rr(), rr()] as const);
    let d = "";
    for (let tile = 0; tile < 3; tile++) {
      const o = tile * P;
      d += `M${o} ${WH} L${o} ${y}`;
      pts.forEach(([a, b], i) => {
        const x = o + i * 240;
        const end = i === pts.length - 1 ? y : y - amp * 0.3 * b;
        d += ` Q${x + 120} ${y - amp * a} ${x + 240} ${end}`;
      });
      d += ` L${o + P} ${WH} Z `;
    }
    return <path d={d} fill={col} transform={`translate(${sx(k)} 0)`} />;
  };
  const W2 = P * 3;
  void frame;
  return (
    <g>
      {biome === "city" ? <g transform={`translate(${sx(0.15) + P} 0)`}><Skyline mood={mood} base={GROUND - 210} dome={1300} minaret={1650} seed={8} w={WW} /></g> : null}
      {hills(GROUND - 230, biome === "desert" ? 160 : 90, far, 0.25, 3)}
      {hills(GROUND - 120, biome === "hill" ? 200 : 70, mid, 0.5, 5)}
      {biome === "fields"
        ? Array.from({ length: 60 }, (_, i) => {
            const x = (i % 20) * 144 + Math.floor(i / 20) * P + (i % 3) * 9;
            return <path key={i} transform={`translate(${sx(0.5)} 0)`} d={`M${x} ${GROUND - 70} q8 -60 2 -110 q16 40 10 110 z`} fill={mix(mid, ID.copper, 0.25)} />;
          })
        : null}
      {biome === "desert"
        ? Array.from({ length: 12 }, (_, i) => {
            const x = (i % 4) * 720 + 180 + Math.floor(i / 4) * P;
            return (
              <g key={i} transform={`translate(${sx(0.5)} 0)`}>
                <rect x={x} y={GROUND - 230} width={14} height={160} fill={mid} />
                {Array.from({ length: 5 }, (_, k) => (
                  <path key={k} d={`M${x + 7} ${GROUND - 228} q${-70 + k * 35} -30 ${-90 + k * 45} 20`} stroke={mid} strokeWidth={10} fill="none" strokeLinecap="round" />
                ))}
              </g>
            );
          })
        : null}
      {/* أعمدة قناديل على جانب الطريق تمر بالمسافر: تعطي الرحلة إيقاع خطواتها */}
      {Array.from({ length: 8 }, (_, i) => {
        const x = ((i * 560 + shift * 1.0) % (560 * 8)) - 560;
        const pole = mix(near, ID.copper, 0.25);
        return (
          <g key={`post${i}`}>
            <Glow cx={x} cy={GROUND - 330} r={170} opacity={mood === "day" ? 0.2 : 0.7} />
            <rect x={x - 6} y={GROUND - 320} width={12} height={306} fill={pole} />
            <path d={archPath(x - 16, GROUND - 302, 32, 46)} fill={lighten(ID.dawn, 0.1)} />
            <rect x={x - 22} y={GROUND - 302} width={44} height={8} fill={pole} />
          </g>
        );
      })}
      <rect x={-200} y={GROUND - 14} width={WW + 400} height={WH} fill={near} />
      <rect x={-200} y={GROUND - 22} width={WW + 400} height={22} fill={mix(near, ID.copper, 0.18)} />
      {Array.from({ length: 30 }, (_, i) => (
        <rect key={i} x={((i * 160 + shift) % (WW + 320)) - 160} y={GROUND + 30} width={80} height={6} rx={3} fill={ID.copper} opacity={0.3} />
      ))}
    </g>
  );
};

/** المسرح: ظلام زمردي وأرض يلمع عليها الضوء */
export const StageFloor: React.FC = () => (
  <g>
    <rect x={-200} y={-200} width={WW + 400} height={WH + 400} fill={darken(ID.night, 0.62)} />
    <rect x={-200} y={GROUND} width={WW + 400} height={WH} fill={darken(ID.night, 0.5)} />
  </g>
);

/** الحارة كاملة للمعرض والقوالب */
export const AlleyView: React.FC<{ mood: Mood; frame: number; lit?: (i: number) => number; seed?: number }> = ({ mood, frame, lit = (i) => (i % 5 === 1 ? 1 : 0), seed = 4 }) => (
  <g>
    <Sky mood={mood} frame={frame} />
    <Skyline mood={mood} dome={760} minaret={1260} seed={5} />
    <HouseRow mood={mood} seed={seed} lit={lit} />
    <Cobbles mood={mood} />
  </g>
);

/** معاينة مكان ثابتة (معرض «أماكن التصوير») */
export const PLACE_IDS = ["alley", "market", "home", "road-city", "road-fields", "road-desert", "road-hill", "stage"] as const;
export type PlaceId = (typeof PLACE_IDS)[number];
export const placeNamesAr: Record<PlaceId, string> = {
  alley: "حارة قديمة",
  market: "سوق",
  home: "بيت بنافذة محراب",
  "road-city": "الطريق: أطراف المدينة",
  "road-fields": "الطريق: الحقول",
  "road-desert": "الطريق: الصحراء",
  "road-hill": "الطريق: تلة الفجر",
  stage: "مسرح الضوء",
};
export const PlacePreview: React.FC<{ id: PlaceId; mood?: Mood; width?: number }> = ({ id, mood = "night", width = 480 }) => (
  <svg viewBox={`0 0 ${WW} ${WH}`} width={width} height={(width * WH) / WW} style={{ display: "block", borderRadius: 8 }}>
    {id === "alley" ? <AlleyView mood={mood} frame={0} /> : null}
    {id === "market" ? (
      <g>
        <Sky mood={mood} frame={0} />
        <Market mood={mood} frame={0} lit={0.4} />
        <Cobbles mood={mood} />
      </g>
    ) : null}
    {id === "home" ? <Home mood={mood} frame={0} lit={0.4} /> : null}
    {id.startsWith("road-") ? (
      <g>
        <Sky mood={id === "road-hill" ? "dawn" : mood} frame={0} />
        <RoadLand mood={id === "road-hill" ? "dawn" : mood} biome={id.slice(5) as Biome} frame={0} />
      </g>
    ) : null}
    {id === "stage" ? (
      <g>
        <StageFloor />
        <Glow cx={WW / 2} cy={GROUND - 200} r={500} color={ID.paper} opacity={0.35} />
      </g>
    ) : null}
  </svg>
);
void Bench;
