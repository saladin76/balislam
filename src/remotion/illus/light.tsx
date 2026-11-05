import React from "react";
import { getInputProps, interpolate } from "remotion";
import { Figure, type FigureProps } from "./Figure";
import type { LightKind, LightState, ShadowMode } from "../../plan/lighting";
export { LIGHT_PRESET_IDS, LIGHT_PRESETS, lightAt, parseLighting, parseLightingLines, type LightRig, type LightState } from "../../plan/lighting";
import { darken, ID, lighten, mix } from "./palette";
import { GROUND, WallLamp, WW, WH, archPath, clampOpt, useSvgId } from "./world";

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

/**
 * ألوان الإضاءة لكل قناة (الأمر 009): الحسابات مشتركة، والمظهر من هوية القناة.
 * الافتراضي هوية «بالإسلام» (ليل زمردي وفجر وورق)؛ وأي قناة أخرى تمرر ألوانها عبر LightPaletteContext
 * دون نسخ النظام ودون تفعيله عندها (لا يعمل إلا بحقل lighting في خطة المشهد).
 */
export type LightPalette = { shadow: string; neutral: string; warm: string; cool: string; fog: string };
export const BALISLAM_LIGHT: LightPalette = {
  shadow: darken(ID.night, 0.55),
  neutral: lighten(ID.paper, 0.1),
  warm: ID.dawn,
  cool: mix(ID.paper, ID.night, 0.45),
  fog: ID.night,
};
export const LightPaletteContext = React.createContext<LightPalette>(BALISLAM_LIGHT);
const usePal = () => React.useContext(LightPaletteContext);
/** لون الضوء من الدفء: دافئ = فجر/نحاس، بارد = ورق مائل إلى الزمردي (بلا لون خارج الهوية) */
export const lightColor = (warmth: number, pal: LightPalette = BALISLAM_LIGHT) => (warmth >= 0 ? mix(pal.neutral, pal.warm, Math.min(1, warmth)) : mix(pal.neutral, pal.cool, Math.min(1, -warmth)));
/**
 * حدود ما قد تُظهره الكاميرا من العالم (الأمر 009): الطبقات الممتدة على الإطار كله تُرسم بهذا القدر
 * لا أكبر. الهامش يغطي ابتعاد الكاميرا (0.9) وتحرك طبقات المنظور، وما وراءه لا يظهر أبدًا.
 */
const VIEW = { x: -240, y: -160, w: WW + 480, h: WH + 320 };
/**
 * مستوى جودة الإضاءة (الأمر 009): "final" (الافتراضي، المظهر الكامل) أو "draft" للمعاينة السريعة،
 * يُمرَّر من أمر الرندر: --props='{"lightQuality":"draft"}'. المسودة تلغي الضبابيتين الأغلى
 * (عمق المجال وتنعيم الظل الملقى) وتبقي كل ما عداهما كما هو. لا تُستعمل للنسخة النهائية أبدًا.
 */
export const lightQuality = (): "final" | "draft" => {
  try {
    return (getInputProps() as { lightQuality?: string }).lightQuality === "draft" ? "draft" : "final";
  } catch {
    return "final";
  }
};


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

/**
 * حسابات إضاءة الشخصية (الأمر 009): دالة خالصة بلا رسم، مشتركة بين القوالب.
 * تعطي هندسة الظل الملقى، وجهة الضوء على الجسد، ومقدار الحافة المضيئة، وظل التماس.
 * الرسم (LitFigure) يقرأها فقط، فيمكن لقالب أو قناة رسمها بأسلوب آخر دون إعادة الحساب.
 */
export const figureLight = (light: LightState, fig: { x: number; scale: number; facing?: number; flip?: boolean }, rim = 0, castShadow = true) => {
  const { key, intensity, ambient, back, rig } = light;
  const facing = fig.facing ?? (fig.flip ? -1 : 1);
  const geo = key && rig.shadow.mode !== "off" && castShadow ? shadowGeometry(fig.x, key, intensity, rig.shadow.mode, rig.shadow.length) : null;
  // جهة الضوء على الشاشة: -1 من اليسار، 1 من اليمين
  const side = key ? Math.sign((key.kind === "sun" ? key.x - WW / 2 : key.x - fig.x) || 1) : 0;
  // الضوء أمام الشخصية أم خلفها (بالنسبة لوجهها): الخلفي يرسم حافة مضيئة أقوى
  const behind = key ? side !== Math.sign(facing) : false;
  const rimAmt = Math.min(1, back * (behind ? 1 : 0.45) * (key ? Math.min(1, intensity) : 0.6) + rim * 0.6);
  const contact = rig.shadow.mode !== "off" ? { strength: 0.55 + 0.25 * (1 - ambient), offset: geo ? -side * 6 : 6 } : null;
  return { geo, side, behind, rimAmt, H: 560 * fig.scale, contact };
};

/** ظل التماس: عتمة ناعمة تحت القدمين (يثبّت الشخصية على الأرض) */
const ContactShadow: React.FC<{ x: number; y: number; scale: number; strength: number; offset: number }> = ({ x, y, scale, strength, offset }) => {
  const pal = usePal();
  const id = useSvgId("contact");
  return (
    <g>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor={pal.shadow} stopOpacity={0.75} />
          <stop offset="0.6" stopColor={pal.shadow} stopOpacity={0.28} />
          <stop offset="1" stopColor={pal.shadow} stopOpacity={0} />
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
  const pal = usePal();
  const sid = useSvgId("cast");
  const mid = useSvgId("litmask");
  const rid = useSvgId("rimmask");
  const gid = useSvgId("litgrad");
  const fid = useSvgId("castfade");
  const s = fig.scale ?? 1;
  const { key, intensity, ambient, warmth } = light;
  const col = lightColor(warmth, pal);
  const { geo, side, rimAmt, H, contact } = figureLight(light, { x: fig.x, scale: s, facing: fig.facing, flip: fig.flip }, rim, castShadow);
  const draft = lightQuality() === "draft";
  const sil = (color: string, dx = 0, dy = 0) => <Figure {...fig} x={fig.x + dx} y={fig.y + dy} silhouette={color} shadow={false} rim={0} />;
  const box = { x: fig.x - 150 * s, y: fig.y - H - 40 * s, w: 300 * s, h: H + 60 * s };
  return (
    <g>
      {contact ? <ContactShadow x={fig.x} y={fig.y} scale={s} strength={contact.strength} offset={contact.offset} /> : null}
      {geo ? (
        <g opacity={geo.fade}>
          <defs>
            <filter id={sid} x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
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
            <g filter={draft ? undefined : `url(#${sid})`}>
              <Figure {...fig} x={0} y={0} silhouette={pal.shadow} shadow={false} rim={0} />
            </g>
          </g>
        </g>
      ) : null}
      <Figure {...fig} shadow={false} rim={0} />
      {/* التظليل من جهة الضوء: الجانب المقابل للمصدر أعتم، والقريب منه أدفأ */}
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={fig.x - side * 90 * s} y1={0} x2={fig.x + side * 90 * s} y2={0}>
          <stop offset="0" stopColor={pal.shadow} stopOpacity={key ? 0.5 * (1.15 - ambient) : 0.3 * (1.1 - ambient)} />
          <stop offset="0.55" stopColor={pal.shadow} stopOpacity={0} />
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
 * نقطة التبديل الواحدة لأي شخصية في أي قالب (الأمر 009): بإضاءة المشهد تُرسم مضاءة،
 * وبدونها الشخصية العادية كما كانت حرفيًا. القوالب لا تكرر الشرط ولا تنسخ النظام.
 * الأشباح والذكريات (شخصيات بشفافية أو صورة ظلية) تبقى بلا إضاءة عمدًا: هي ليست في ضوء المكان.
 */
export const SceneFigure: React.FC<FigureProps & { light: LightState | null }> = ({ light, shadow, rimColor, ...fig }) =>
  light ? <LitFigure light={light} {...fig} {...(rimColor ? { rimColor } : {})} castShadow={shadow !== false} /> : <Figure {...fig} {...(shadow !== undefined ? { shadow } : {})} {...(rimColor ? { rimColor } : {})} />;

/**
 * ضوء العالم: يُرسم داخل طبقة المكان (بإحداثياتها)، قبل الشخصيات.
 * بقعة ضوء المصباح على الجدار والأرض، وتدرج اتجاهي من جهة الشمس، وعتمة تتزايد بعيدًا عن المصدر.
 */
export const WorldLight: React.FC<{ light: LightState; frame: number; drawLamp?: boolean; room?: boolean; window?: { x: number; w: number; h: number } }> = ({ light, frame, drawLamp = false, room = false, window }) => {
  const pal = usePal();
  const g1 = useSvgId("wlpool");
  const g2 = useSvgId("wldark");
  const g3 = useSvgId("wlsun");
  const { key, intensity, ambient, warmth } = light;
  if (!key) return null;
  const col = lightColor(warmth, pal);
  const I = Math.max(0, Math.min(1.5, intensity));
  if (key.kind === "lamp" && room) return <RoomLight light={light} keyPos={key} I={I} col={col} ambient={ambient} window={window} ids={[g1, g2, g3]} />;
  if (key.kind === "lamp") {
    // ضوء المصباح يقع على الجدران والأرض لا على السماء: قناع يتلاشى فوق خط السطوح
    const roof = Math.min(key.y - 60, GROUND - 470);
    // بقعة المصباح لا تتجاوز نصف قطر تدرجها (760)؛ خارجها شفافة أصلًا، فتُرسم وقناعها بحدودها فقط
    const pool = { x: key.x - 760, y: Math.max(roof - 160, key.y - 760), w: 1520, h: 0 };
    pool.h = Math.min(VIEW.y + VIEW.h, key.y + 760) - pool.y;
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
          <mask id={`${g1}k`} maskUnits="userSpaceOnUse" x={pool.x} y={pool.y} width={pool.w} height={pool.h}>
            <rect x={pool.x} y={pool.y} width={pool.w} height={pool.h} fill={`url(#${g1}m)`} />
          </mask>
          <radialGradient id={g2} gradientUnits="userSpaceOnUse" cx={key.x} cy={key.y} r={1500}>
            <stop offset="0.2" stopColor={pal.shadow} stopOpacity={0} />
            <stop offset="1" stopColor={pal.shadow} stopOpacity={0.55 * (1.1 - ambient)} />
          </radialGradient>
        </defs>
        <rect x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} fill={`url(#${g2})`} />
        <rect x={pool.x} y={pool.y} width={pool.w} height={pool.h} fill={`url(#${g1})`} opacity={I * 0.6} mask={`url(#${g1}k)`} />
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
        {/* بإحداثيات العالم المكافئة تمامًا لما كان (المستطيل القديم -600..WW+600)، فيصغر المستطيل دون تغير التدرج */}
        <linearGradient id={g3} gradientUnits="userSpaceOnUse" x1={fromLeft ? -600 : WW + 600} y1={-400} x2={fromLeft ? WW + 600 : -600} y2={-400 + 0.3 * (WH + 800)}>
          <stop offset="0" stopColor={col} stopOpacity={0.4} />
          <stop offset="0.6" stopColor={col} stopOpacity={0.06} />
          <stop offset="1" stopColor={pal.shadow} stopOpacity={0.25 * (1.1 - ambient)} />
        </linearGradient>
      </defs>
      <rect x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} fill={`url(#${g3})`} opacity={I * 0.5} />
    </g>
  );
};

/**
 * ضوء الغرفة (الأمر 009): داخل المكان المغلق لا سماء، فالضوء يغسل الجدار كله حول المصدر.
 * رسوم ثنائية الأبعاد بتدرجات فقط (بلا ضبابية ولا محاكاة):
 * - غسلة على الجدار: قوس ناعم أطول أسفل المصدر (ضوء القنديل يسقط إلى أسفل أكثر)،
 * - تلاشٍ أسرع من الخارج مع عتمة السقف والأركان، فيتباين المضاء والمظلل،
 * - بركة ضوء دافئة على الأرض تحت المصدر،
 * - وإن كان المصدر النافذة: بقعة بشكل قوسها على الأرض تمتد نحو الداخل.
 * التوهج محدود الشدة (لا يبيضّ الجدار) لأن كل الطبقات تحت سقف شفافية.
 */
const RoomLight: React.FC<{ light: LightState; keyPos: { x: number; y: number }; I: number; col: string; ambient: number; window?: { x: number; w: number; h: number }; ids: string[] }> = ({ light, keyPos, I, col, ambient, window, ids }) => {
  const pal = usePal();
  const [g1, g2, g3] = ids as [string, string, string];
  const { x, y } = keyPos;
  const dim = Math.max(0, 1.1 - ambient);
  // هل المصدر النافذة نفسها؟ (المصدر داخل عرض قوسها)
  const fromWindow = !!window && x >= window.x - 40 && x <= window.x + window.w + 40;
  const wash = Math.min(0.66, 0.5 * I);
  return (
    <g pointerEvents="none">
      <defs>
        {/* غسلة الجدار: تدرج بيضاوي ممدود رأسيًا، مركزه تحت المصدر قليلًا */}
        <radialGradient id={g1} gradientUnits="userSpaceOnUse" cx={x} cy={y + 120} r={620} gradientTransform={`translate(${x} ${y + 120}) scale(0.75 1.15) translate(${-x} ${-(y + 120)})`}>
          <stop offset="0" stopColor={col} stopOpacity={wash} />
          <stop offset="0.35" stopColor={col} stopOpacity={wash * 0.45} />
          <stop offset="0.75" stopColor={col} stopOpacity={wash * 0.08} />
          <stop offset="1" stopColor={col} stopOpacity={0} />
        </radialGradient>
        {/* العتمة: تبدأ أقرب من الخارج (الغرفة تُظلم سريعًا بعيدًا عن القنديل) */}
        <radialGradient id={g2} gradientUnits="userSpaceOnUse" cx={x} cy={y + 160} r={1250}>
          <stop offset="0.12" stopColor={pal.shadow} stopOpacity={0} />
          <stop offset="0.55" stopColor={pal.shadow} stopOpacity={0.38 * dim} />
          <stop offset="1" stopColor={pal.shadow} stopOpacity={0.78 * dim} />
        </radialGradient>
        {/* السقف والأرض البعيدة أعتم من مستوى المصدر */}
        <linearGradient id={g3} gradientUnits="userSpaceOnUse" x1={0} y1={-160} x2={0} y2={WH + 160}>
          <stop offset="0" stopColor={pal.shadow} stopOpacity={0.5 * dim} />
          <stop offset="0.32" stopColor={pal.shadow} stopOpacity={0} />
          <stop offset="0.78" stopColor={pal.shadow} stopOpacity={0} />
          <stop offset="1" stopColor={pal.shadow} stopOpacity={0.4 * dim} />
        </linearGradient>
        <radialGradient id={`${g1}f`}>
          <stop offset="0" stopColor={col} stopOpacity={0.55} />
          <stop offset="0.55" stopColor={col} stopOpacity={0.2} />
          <stop offset="1" stopColor={col} stopOpacity={0} />
        </radialGradient>
        {fromWindow ? (
          <linearGradient id={`${g1}w`} gradientUnits="userSpaceOnUse" x1={0} y1={GROUND - 10} x2={0} y2={GROUND + 150}>
            <stop offset="0" stopColor={col} stopOpacity={0.32} />
            <stop offset="1" stopColor={col} stopOpacity={0} />
          </linearGradient>
        ) : null}
      </defs>
      <rect x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} fill={`url(#${g2})`} />
      <rect x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} fill={`url(#${g3})`} />
      <rect x={x - 620 * 0.75} y={Math.max(VIEW.y, y + 120 - 620 * 1.15)} width={620 * 1.5} height={620 * 2.3} fill={`url(#${g1})`} opacity={Math.min(1, I)} />
      <ellipse cx={x + 60} cy={GROUND + 70} rx={560} ry={120} fill={`url(#${g1}f)`} opacity={Math.min(1, 0.75 * I)} />
      {fromWindow && window ? (
        // بقعة ضوء النافذة على الأرض: قوسها نفسه مقلوبًا ومنبسطًا نحو الداخل (إسقاط بسيط)
        // تحت النافذة نفسها: القوس يسقط على الأرض ممدودًا نحو الناظر، ويتلاشى كلما ابتعد عن الجدار
        <path d={archPath(window.x, 0, window.w, window.h)} transform={`translate(0 ${GROUND - 4}) matrix(1 0 -0.18 -0.34 0 0)`} fill={`url(#${g1}w)`} opacity={Math.min(1, I)} />
      ) : null}
    </g>
  );
};

/** درجة الإضاءة العامة فوق الإطار كله: العتمة العامة (ambient) ودفء الضوء أو برودته */
export const AmbientGrade: React.FC<{ light: LightState; w?: number; h?: number }> = ({ light, w = WW, h = WH }) => {
  const pal = usePal();
  const { ambient, warmth } = light;
  const dark = Math.max(0, 1 - ambient);
  const a1 = dark > 0.01 ? dark * 0.55 : 0;
  const a2 = Math.abs(warmth) > 0.02 ? 0.1 * Math.abs(warmth) : 0;
  if (!a1 && !a2) return null;
  // طبقتان متتاليتان (عتمة ثم دفء) = طبقة واحدة بلون وشفافية مكافئين رياضيًا، بنصف عمل التركيب
  const a = 1 - (1 - a1) * (1 - a2);
  const color = !a2 ? pal.shadow : !a1 ? lightColor(warmth, pal) : mix(pal.shadow, lightColor(warmth, pal), a2 / a);
  const m = w === WW && h === WH ? VIEW : { x: -240, y: -160, w: w + 480, h: h + 320 };
  return <rect x={m.x} y={m.y} width={m.w} height={m.h} fill={color} opacity={a} pointerEvents="none" />;
};

/** هالة خلف الشخصية من الضوء الخلفي: تفصلها عن الخلفية دون حافة حادة */
export const BackHalo: React.FC<{ x: number; y: number; scale: number; light: LightState }> = ({ x, y, scale, light }) => {
  const pal = usePal();
  const id = useSvgId("halo");
  if (light.back <= 0.02) return null;
  return (
    <g pointerEvents="none">
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor={lightColor(light.warmth, pal)} stopOpacity={0.35} />
          <stop offset="1" stopColor={lightColor(light.warmth, pal)} stopOpacity={0} />
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
  const pal = usePal();
  const id = useSvgId("dof");
  const d = light?.rig.depth;
  if (!d || (d.dof <= 0 && d.fog <= 0)) return <>{children}</>;
  const away = depth <= 1 ? 1 - depth : Math.min(1, (depth - 1) * 2.5);
  // المقدمة أقرب إلى العدسة فتخرج عن التركيز أكثر من الخلفية بنفس القدر
  // السماء (العمق 0) تدرج بلا تفاصيل: تضبيبها لا يُرى ويكلف الرندر كثيرًا، فتُستثنى
  const blur = depth <= 0.05 || lightQuality() === "draft" ? 0 : depth > 1 ? d.dof * away * 22 : d.dof * away * 7;
  // الضباب الجوي على المباني البعيدة والوسطى؛ السماء نفسها بعيدة أصلًا فلا تُغطّى (كي لا تبدو حليبية)
  const fog = depth > 0.05 && depth < 1 ? d.fog * (1 - depth) * 0.5 : 0;
  return (
    <g>
      {blur > 0.2 ? (
        <defs>
          <filter id={id} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation={blur} />
          </filter>
        </defs>
      ) : null}
      <g filter={blur > 0.2 ? `url(#${id})` : undefined}>{children}</g>
      {fog > 0.01 ? <rect x={VIEW.x} y={VIEW.y} width={VIEW.w} height={VIEW.h} fill={mix(pal.fog, lightColor(light!.warmth, pal), 0.22)} opacity={fog} pointerEvents="none" /> : null}
    </g>
  );
};

/** طبقة المقدمة: حافة عمود محراب داكنة على طرف الإطار تتحرك أسرع من البطل (عمق حقيقي) */
/** x0 وw: حافتا الإطار الظاهر بإحداثيات الطبقة (الأفقي 0..WW، والعمودي شريحته حول البطل) */
export const ForegroundFrame: React.FC<{ light: LightState; x0?: number; w?: number }> = ({ light, x0 = 0, w = WW }) => {
  if (!light.rig.depth.fg) return null;
  const c = darken(ID.night, 0.5);
  // العمودي أضيق: العمود أنحف بنسبة عرض الإطار كي لا يحجب البطل
  const k = Math.min(1, w / WW + 0.35);
  const X = (dx: number) => x0 + dx * k;
  const R = x0 + w;
  return (
    <g pointerEvents="none">
      {/* حافة عمود بقوس محراب: خط واحد ناعم (تاج، ثم بدن العمود، ثم قاعدة) */}
      <path
        d={`M${X(-300)} -200 L${X(190)} -200 L${X(190)} ${GROUND - 560} Q${X(190)} ${GROUND - 470} ${X(150)} ${GROUND - 430} Q${X(120)} ${GROUND - 400} ${X(150)} ${GROUND - 370} L${X(150)} ${GROUND - 30} Q${X(150)} ${GROUND - 6} ${X(200)} ${GROUND + 4} L${X(200)} ${WH + 300} L${X(-300)} ${WH + 300} Z`}
        fill={c}
      />
      <path d={`M${R - 60 * k} ${WH + 200} L${R - 60 * k} ${GROUND + 120} Q${R - 40 * k} ${GROUND + 90} ${R + 40 * k} ${GROUND + 86} L${R + 300} ${GROUND + 86} L${R + 300} ${WH + 200} Z`} fill={c} opacity={0.85} />
    </g>
  );
};

/** معامل المنظور: 1 كما هو، 0 بلا اختلاف بين الطبقات، 2 ضعف الاختلاف */
export const parallaxDepth = (depth: number, light: LightState | null) => {
  const p = light?.rig.depth.parallax ?? 1;
  return depth >= 1 ? depth : 1 - (1 - depth) * p;
};
