import React from "react";
import { interpolate } from "remotion";
import { Figure, type FigureProps } from "./Figure";
import type { LightKind, LightState, ShadowMode } from "../../plan/lighting";
export { LIGHT_PRESET_IDS, LIGHT_PRESETS, lightAt, parseLighting, parseLightingLines, type LightRig, type LightState } from "../../plan/lighting";
import { darken, ID, lighten, mix } from "./palette";
import { GROUND, WallLamp, WW, WH, clampOpt, useSvgId } from "./world";

/**
 * الإضاءة والظلال والعمق (الأمر 008): نظام اختياري مشترك على مستوى المحرك.
 * لا يعمل إلا إذا كتبت خطة المشهد حقل `lighting`؛ وبدونه يُرسم المشهد كما كان حرفيًا.
 *
 * صيغة الحقل: سطر لكل إعداد، ويجوز أن يبدأ باسم إعداد جاهز ثم تُعدَّل قيمه:
 *   night-lamp | dawn-sun | day-sun | interior-lamp | interior-window   (إعداد جاهز)
 *   key lamp 1400 430            مصدر موضعي (مصباح) في العالم، أو: key sun 300 -200 (اتجاهي)
 *   key off                      بلا مصدر رئيسي (إضاءة عامة فقط)
 *   intensity 0.8                شدة المصدر (0..1.5)
 *   ambient 0.6                  الإضاءة العامة (1 = كما رُسم المكان، أقل = أعتم)
 *   warmth 0.4                   دفء الضوء: -1 بارد … 0 محايد … 1 دافئ
 *   back 0.5                     ضوء خلفي يفصل الشخصية عن الخلفية (حافة مضيئة وهالة خلفها)
 *   shadow soft 1                الظل: soft أو hard أو off، ثم معامل الطول (0.3..2.5)
 *   depth dof 0.4 fog 0.3 parallax 1 fg
 *                                عمق المجال (ضبابية الخلفية 0..1)، والضباب الجوي، ومعامل المنظور، وطبقة مقدمة
 *   fade 0.3 1 الحقيقة 40         تغيّر تدريجي لشدة المصدر من 0.3 إلى 1 عند الكلمة (أو رقم إطار) خلال 40 إطارًا
 *   move 400 380 الباب 90         يتحرك المصدر إلى (400، 380) عند الكلمة خلال 90 إطارًا (تغير اتجاه الضوء)
 */

/** لون الضوء من الدفء: دافئ = فجر/نحاس، بارد = ورق مائل إلى الزمردي (بلا لون خارج الهوية) */
export const lightColor = (warmth: number) => (warmth >= 0 ? mix(lighten(ID.paper, 0.1), ID.dawn, Math.min(1, warmth)) : mix(lighten(ID.paper, 0.1), mix(ID.paper, ID.night, 0.45), Math.min(1, -warmth)));
/** لون الظل: ليل زمردي عميق لا أسود، فلا تبدو الرسوم بلاستيكية */
const SHADOW_COL = darken(ID.night, 0.55);

/**
 * هندسة الظل الملقى على الأرض لشخصية قدماها عند x:
 * skew = الإزاحة الأفقية لكل وحدة ارتفاع (بعيدًا عن المصدر)، flat = انبساط الظل على الأرض،
 * fade = شفافيته (الظل الطويل والبعيد عن المصباح أخف)، blur = نعومته.
 */
export const shadowGeometry = (x: number, key: { kind: LightKind; x: number; y: number }, intensity: number, mode: ShadowMode, length: number) => {
  const H = Math.max(80, GROUND - key.y);
  const dx = key.kind === "sun" ? WW / 2 - key.x : x - key.x;
  // المصدر على الجدار أو في عمق المشهد: الظل يسقط على الأرض نحو الناظر (إلى أسفل الإطار)،
  // ويميل بعيدًا عن المصدر بقدر بعد الشخصية عنه أفقيًا
  const raw = (dx / H) * length * 0.55;
  const skew = Math.max(-1.6, Math.min(1.6, raw));
  // المصدر المنخفض يلقي ظلًا أطول؛ والعالي (شمس الظهيرة) ظلًا قصيرًا مجتمعًا تحت القدمين
  const low = interpolate(H, [150, 900], [1, 0.35], clampOpt);
  const flat = Math.max(0.14, Math.min(0.55, 0.2 + 0.32 * low * length));
  const dist = key.kind === "sun" ? 0 : Math.abs(x - key.x);
  const fall = key.kind === "sun" ? 1 : interpolate(dist, [0, 1400], [1, 0.5], clampOpt);
  const fade = Math.max(0, Math.min(1, intensity)) * fall * (mode === "hard" ? 0.9 : 0.82) * (1 - Math.min(0.35, Math.abs(skew) * 0.15));
  const blur = mode === "hard" ? 1.5 : 3.5 + flat * 6 + Math.abs(skew) * 2;
  return { skew, flat, fade, blur };
};

type FigureBase = Omit<FigureProps, "shadow" | "rim" | "rimColor">;

/** ظل التماس: عتمة ناعمة تحت القدمين (يثبّت الشخصية على الأرض) */
const ContactShadow: React.FC<{ x: number; y: number; scale: number; strength: number; offset: number }> = ({ x, y, scale, strength, offset }) => {
  const id = useSvgId("contact");
  return (
    <g>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor={SHADOW_COL} stopOpacity={0.75} />
          <stop offset="0.6" stopColor={SHADOW_COL} stopOpacity={0.28} />
          <stop offset="1" stopColor={SHADOW_COL} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={x + offset * scale} cy={y + 1} rx={52 * scale} ry={9 * scale} fill={`url(#${id})`} opacity={strength} />
    </g>
  );
};

/**
 * الشخصية مضاءة: ظل تماس + ظل ملقى بحسب المصدر وموضع الشخصية (يتحرك ويطول معها)،
 * وتظليل جانبي من جهة الضوء، وحافة مضيئة من الضوء الخلفي، ودرجة دفء على الجسد.
 * كل ذلك أقنعة من صورة الشخصية نفسها، فيتبع الوضعية والمشية والالتفاتة إطارًا بإطار.
 */
export const LitFigure: React.FC<FigureBase & { light: LightState; rim?: number; rimColor?: string; castShadow?: boolean }> = ({ light, rim = 0, rimColor, castShadow = true, ...fig }) => {
  const sid = useSvgId("cast");
  const mid = useSvgId("litmask");
  const rid = useSvgId("rimmask");
  const gid = useSvgId("litgrad");
  const fid = useSvgId("castfade");
  const s = fig.scale ?? 1;
  const { key, intensity, ambient, warmth, back, rig } = light;
  const col = lightColor(warmth);
  const facing = fig.facing ?? (fig.flip ? -1 : 1);
  const geo = key && rig.shadow.mode !== "off" && castShadow ? shadowGeometry(fig.x, key, intensity, rig.shadow.mode, rig.shadow.length) : null;
  // جهة الضوء على الشاشة: -1 من اليسار، 1 من اليمين
  const side = key ? Math.sign((key.kind === "sun" ? key.x - WW / 2 : key.x - fig.x) || 1) : 0;
  const H = 560 * s;
  // الضوء أمام الشخصية أم خلفها (بالنسبة لوجهها): الخلفي يرسم حافة مضيئة أقوى
  const behind = key ? side !== Math.sign(facing) : false;
  const rimAmt = Math.min(1, back * (behind ? 1 : 0.45) * (key ? Math.min(1, intensity) : 0.6) + rim * 0.6);
  const sil = (color: string, dx = 0, dy = 0) => <Figure {...fig} x={fig.x + dx} y={fig.y + dy} silhouette={color} shadow={false} rim={0} />;
  const box = { x: fig.x - 150 * s, y: fig.y - H - 40 * s, w: 300 * s, h: H + 60 * s };
  return (
    <g>
      {rig.shadow.mode !== "off" ? <ContactShadow x={fig.x} y={fig.y} scale={s} strength={0.55 + 0.25 * (1 - ambient)} offset={geo ? -side * 6 : 6} /> : null}
      {geo ? (
        <g opacity={geo.fade}>
          <defs>
            <filter id={sid} x="-15%" y="-15%" width="130%" height="130%">
              <feGaussianBlur stdDeviation={geo.blur} />
            </filter>
            {/* يخف الظل كلما ابتعد عن القدمين */}
            <linearGradient id={`${fid}g`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={-H}>
              <stop offset="0" stopColor="#fff" stopOpacity={1} />
              <stop offset="1" stopColor="#fff" stopOpacity={0.25} />
            </linearGradient>
            {/* منطقة القناع بحجم الظل نفسه (لا مساحة ضخمة تُرسم في كل إطار) */}
            <mask id={fid} maskUnits="userSpaceOnUse" x={-170 * s} y={-H - 40 * s} width={340 * s} height={H + 80 * s}>
              <rect x={-170 * s} y={-H - 40 * s} width={340 * s} height={H + 80 * s} fill={`url(#${fid}g)`} />
            </mask>
          </defs>
          <g transform={`translate(${fig.x} ${fig.y}) matrix(1 0 ${-geo.skew} ${-geo.flat} 0 0)`} mask={`url(#${fid})`}>
            <g filter={`url(#${sid})`}>
              <Figure {...fig} x={0} y={0} silhouette={SHADOW_COL} shadow={false} rim={0} />
            </g>
          </g>
        </g>
      ) : null}
      <Figure {...fig} shadow={false} rim={0} />
      {/* التظليل من جهة الضوء: الجانب المقابل للمصدر أعتم، والقريب منه أدفأ */}
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={fig.x - side * 90 * s} y1={0} x2={fig.x + side * 90 * s} y2={0}>
          <stop offset="0" stopColor={SHADOW_COL} stopOpacity={key ? 0.5 * (1.15 - ambient) : 0.3 * (1.1 - ambient)} />
          <stop offset="0.55" stopColor={SHADOW_COL} stopOpacity={0} />
          <stop offset="1" stopColor={col} stopOpacity={key ? 0.55 * Math.min(1, intensity) : 0} />
        </linearGradient>
        <mask id={mid} maskUnits="userSpaceOnUse" x={box.x} y={box.y} width={box.w} height={box.h}>
          {sil("#fff")}
        </mask>
        <mask id={rid} maskUnits="userSpaceOnUse" x={box.x} y={box.y} width={box.w} height={box.h}>
          {sil("#fff")}
          {sil("#000", -side * 3.2 * s, 1.5 * s)}
        </mask>
      </defs>
      <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={`url(#${gid})`} opacity={0.55} mask={`url(#${mid})`} />
      {/* درجة اللون العامة على الجسد (الدفء أو البرودة) */}
      {Math.abs(warmth) > 0.05 ? <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={col} opacity={0.06 * Math.abs(warmth)} mask={`url(#${mid})`} /> : null}
      {rimAmt > 0.02 && side !== 0 ? <rect x={box.x} y={box.y} width={box.w} height={box.h} fill={rimColor ?? col} opacity={rimAmt * 0.4} mask={`url(#${rid})`} /> : null}
    </g>
  );
};

/**
 * ضوء العالم: يُرسم داخل طبقة المكان (بإحداثياتها)، قبل الشخصيات.
 * بقعة ضوء المصباح على الجدار والأرض، وتدرج اتجاهي من جهة الشمس، وعتمة تتزايد بعيدًا عن المصدر.
 */
export const WorldLight: React.FC<{ light: LightState; frame: number; drawLamp?: boolean }> = ({ light, frame, drawLamp = false }) => {
  const g1 = useSvgId("wlpool");
  const g2 = useSvgId("wldark");
  const g3 = useSvgId("wlsun");
  const { key, intensity, ambient, warmth } = light;
  if (!key) return null;
  const col = lightColor(warmth);
  const I = Math.max(0, Math.min(1.5, intensity));
  if (key.kind === "lamp") {
    // ضوء المصباح يقع على الجدران والأرض لا على السماء: قناع يتلاشى فوق خط السطوح
    const roof = Math.min(key.y - 60, GROUND - 470);
    return (
      <g pointerEvents="none">
        <defs>
          <radialGradient id={g1} gradientUnits="userSpaceOnUse" cx={key.x} cy={key.y} r={760}>
            <stop offset="0" stopColor={col} stopOpacity={0.5} />
            <stop offset="0.3" stopColor={col} stopOpacity={0.16} />
            <stop offset="1" stopColor={col} stopOpacity={0} />
          </radialGradient>
          <linearGradient id={`${g1}m`} gradientUnits="userSpaceOnUse" x1={0} y1={roof - 160} x2={0} y2={roof + 40}>
            <stop offset="0" stopColor="#fff" stopOpacity={0} />
            <stop offset="1" stopColor="#fff" stopOpacity={1} />
          </linearGradient>
          <mask id={`${g1}k`} maskUnits="userSpaceOnUse" x={-600} y={-400} width={WW + 1200} height={WH + 800}>
            <rect x={-600} y={-400} width={WW + 1200} height={WH + 800} fill={`url(#${g1}m)`} />
          </mask>
          <radialGradient id={g2} gradientUnits="userSpaceOnUse" cx={key.x} cy={key.y} r={1500}>
            <stop offset="0.2" stopColor={SHADOW_COL} stopOpacity={0} />
            <stop offset="1" stopColor={SHADOW_COL} stopOpacity={0.55 * (1.1 - ambient)} />
          </radialGradient>
        </defs>
        <rect x={-600} y={-400} width={WW + 1200} height={WH + 800} fill={`url(#${g2})`} />
        <rect x={-600} y={-400} width={WW + 1200} height={WH + 800} fill={`url(#${g1})`} opacity={I * 0.6} mask={`url(#${g1}k)`} />
        {/* بقعة على الأرض تحت المصدر: تدرج ناعم بلا حافة */}
        <defs>
          <radialGradient id={`${g1}f`}>
            <stop offset="0" stopColor={col} stopOpacity={0.7} />
            <stop offset="0.6" stopColor={col} stopOpacity={0.32} />
            <stop offset="1" stopColor={col} stopOpacity={0} />
          </radialGradient>
        </defs>
        {/* بركة الضوء على الأرض: يقع عليها الظل الملقى فيُقرأ */}
        <ellipse cx={key.x} cy={GROUND + 60} rx={820} ry={170} fill={`url(#${g1}f)`} opacity={0.4 * I} />
        {drawLamp ? <WallLamp x={key.x} y={key.y} on={Math.min(1, I)} frame={frame} /> : null}
      </g>
    );
  }
  // الشمس: تدرج من جهتها، أقوى قرب الأفق عند الفجر
  const fromLeft = key.x < WW / 2;
  return (
    <g pointerEvents="none">
      <defs>
        <linearGradient id={g3} x1={fromLeft ? 0 : 1} y1={0} x2={fromLeft ? 1 : 0} y2={0.3}>
          <stop offset="0" stopColor={col} stopOpacity={0.4} />
          <stop offset="0.6" stopColor={col} stopOpacity={0.06} />
          <stop offset="1" stopColor={SHADOW_COL} stopOpacity={0.25 * (1.1 - ambient)} />
        </linearGradient>
      </defs>
      <rect x={-600} y={-400} width={WW + 1200} height={WH + 800} fill={`url(#${g3})`} opacity={I * 0.5} />
    </g>
  );
};

/** درجة الإضاءة العامة فوق الإطار كله: العتمة العامة (ambient) ودفء الضوء أو برودته */
export const AmbientGrade: React.FC<{ light: LightState; w?: number; h?: number }> = ({ light, w = WW, h = WH }) => {
  const { ambient, warmth } = light;
  const dark = Math.max(0, 1 - ambient);
  return (
    <g pointerEvents="none">
      {dark > 0.01 ? <rect x={-400} y={-400} width={w + 800} height={h + 800} fill={SHADOW_COL} opacity={dark * 0.55} /> : null}
      {Math.abs(warmth) > 0.02 ? <rect x={-400} y={-400} width={w + 800} height={h + 800} fill={lightColor(warmth)} opacity={0.1 * Math.abs(warmth)} /> : null}
    </g>
  );
};

/** هالة خلف الشخصية من الضوء الخلفي: تفصلها عن الخلفية دون حافة حادة */
export const BackHalo: React.FC<{ x: number; y: number; scale: number; light: LightState }> = ({ x, y, scale, light }) => {
  const id = useSvgId("halo");
  if (light.back <= 0.02) return null;
  return (
    <g pointerEvents="none">
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor={lightColor(light.warmth)} stopOpacity={0.35} />
          <stop offset="1" stopColor={lightColor(light.warmth)} stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={x} cy={y - 300 * scale} rx={260 * scale} ry={380 * scale} fill={`url(#${id})`} opacity={light.back * 0.6} />
    </g>
  );
};

/**
 * العمق: ضبابية وضباب للطبقة بحسب عمقها (0 أبعد … 1 مستوى الشخصيات).
 * المقدمة (عمق > 1) تُضبَّب أيضًا كأنها خارج مستوى التركيز. لا شيء إلزامي: dof = 0 وfog = 0 يعيدان الطبقة كما هي.
 */
export const DepthLayer: React.FC<{ depth: number; light: LightState | null; children: React.ReactNode }> = ({ depth, light, children }) => {
  const id = useSvgId("dof");
  const d = light?.rig.depth;
  if (!d || (d.dof <= 0 && d.fog <= 0)) return <>{children}</>;
  const away = depth <= 1 ? 1 - depth : Math.min(1, (depth - 1) * 2.5);
  // المقدمة أقرب إلى العدسة فتخرج عن التركيز أكثر من الخلفية بنفس القدر
  // السماء (العمق 0) تدرج بلا تفاصيل: تضبيبها لا يُرى ويكلف الرندر كثيرًا، فتُستثنى
  const blur = depth <= 0.05 ? 0 : depth > 1 ? d.dof * away * 22 : d.dof * away * 7;
  // الضباب الجوي على المباني البعيدة والوسطى؛ السماء نفسها بعيدة أصلًا فلا تُغطّى (كي لا تبدو حليبية)
  const fog = depth > 0.05 && depth < 1 ? d.fog * (1 - depth) * 0.5 : 0;
  return (
    <g>
      {blur > 0.2 ? (
        <defs>
          <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation={blur} />
          </filter>
        </defs>
      ) : null}
      <g filter={blur > 0.2 ? `url(#${id})` : undefined}>{children}</g>
      {fog > 0.01 ? <rect x={-600} y={-400} width={WW + 1200} height={WH + 800} fill={mix(ID.night, lightColor(light!.warmth), 0.22)} opacity={fog} pointerEvents="none" /> : null}
    </g>
  );
};

/** طبقة المقدمة: حافة عمود محراب داكنة على طرف الإطار تتحرك أسرع من البطل (عمق حقيقي) */
export const ForegroundFrame: React.FC<{ light: LightState }> = ({ light }) => {
  if (!light.rig.depth.fg) return null;
  const c = darken(ID.night, 0.5);
  return (
    <g pointerEvents="none">
      {/* حافة عمود بقوس محراب: خط واحد ناعم (تاج، ثم بدن العمود، ثم قاعدة) */}
      <path
        d={`M-300 -200 L190 -200 L190 ${GROUND - 560} Q190 ${GROUND - 470} 150 ${GROUND - 430} Q120 ${GROUND - 400} 150 ${GROUND - 370} L150 ${GROUND - 30} Q150 ${GROUND - 6} 200 ${GROUND + 4} L200 ${WH + 300} L-300 ${WH + 300} Z`}
        fill={c}
      />
      <path d={`M${WW - 60} ${WH + 200} L${WW - 60} ${GROUND + 120} Q${WW - 40} ${GROUND + 90} ${WW + 40} ${GROUND + 86} L${WW + 300} ${GROUND + 86} L${WW + 300} ${WH + 200} Z`} fill={c} opacity={0.85} />
    </g>
  );
};

/** معامل المنظور: 1 كما هو، 0 بلا اختلاف بين الطبقات، 2 ضعف الاختلاف */
export const parallaxDepth = (depth: number, light: LightState | null) => {
  const p = light?.rig.depth.parallax ?? 1;
  return depth >= 1 ? depth : 1 - (1 - depth) * p;
};
