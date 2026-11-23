/**
 * «البدايات» — عالم السلسلة: «خطوط على الأرض» (D203؛ اختاره المالك ٢٣ نوفمبر عالمًا أساسيًا، وأدمج فيه فكرة «مقطع الأرض»).
 * المراجع: «الحاجز الحلزوني» لروبرت سميثسون (Spiral Jetty، ١٩٧٠: حجارة في ماء ضحل تُرى من علٍ)، و«خط صنعه المشي» ودوائر
 * الحجارة لريتشارد لونغ (A Line Made by Walking، ١٩٦٧؛ Circles)، و«مناظر البحر» لهيروشي سوغيموتو (Seascapes: أفق واحد
 * بين ماء وسماء). ومن «مقطع الأرض»: خريطة ويليام سميث الجيولوجية (١٨١٥: الزمن طبقات تُقرأ من أعلى إلى أسفل).
 * العالم: شاطئ بكر وماء ضحل يعكس السماء، والشمس تشرق على مدار الحلقة من الفجر إلى الضحى (زمن فعّال يقف في السكون).
 * - الحجر يُوضع حجرًا حجرًا: خطٌّ يبدأ «من هنا» ويلتف حلزونًا في الماء، وخيط الزمن الأحمر عليه وعقدته عند «البشرية»،
 *   و«ثابت» على بلاطة عند «قصة».
 * - «ما ثبت وما لا نعلم» (قرار المالك): عند «لقد» تنزل الكاميرا تحت رمل المكان نفسه فتظهر طبقات الأرض، وبجوار كل طبقة ختمها:
 *   «ثابت» (أعلى، مختوم من قبل)، و«رواية» عند «روايات»، و«لا نعلم» عند «نعلم». ثم تصعد إلى الشاطئ الخالي عند «موضع».
 * - الماء يفيض حول الحلزون عند «حياة»، ودوائر الحجارة قرى عند «القرى»، والكبيرة ببابها عند «المدن»، و«تقدير» عند «القديمة».
 * - جملة الذكر «خلق اللهُ آدمَ من طين»: حفنة طين مبلل على حافة الماء (القطعة المخصوصة)، بسكون تام: لا يتحرك فيها شيء، ولا
 *   الماء ولا الموج ولا الشمس ولا الترجمة، فالإطار فيها واحد بايتًا ببايت.
 * الخامات: Poly Haven (CC0): حجر «Dry Riverbed Rock» و«Rock Boulder Dry» و«Rock Boulder Cracked»، ورمل «Coast Sand 01» (مُفتَّح إلى
 * رمل شاطئ شاحب، الجولة ٣)، ورمل مبلول «Damp Sand»، وطبقات «Excavated Soil Wall».
 * الجولة ٣ (قرار المالك): رمل فاتح لا بني ترابي، وحجارة شاطئ ونهر حقيقية (مسطحة ومزوّاة ومكسورة الحواف ومشقوقة، بعضها نصف
 * مدفون بظل تلامس، ولا حجران متشابهان)، وحفنة طين مبلل تُقرأ طينًا: كومة غير منتظمة بأثر أصابع وطيات، ولمعة بلل، وحافة أجفّ
 * أفتح، وحلقة رطوبة داكنة في الرمل تحتها، وفتات صغير حولها.
 * لا تصوير لأحد (المرجع، خامسًا/٤).
 */
import React, { useMemo } from "react";
import { Audio, Sequence, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Reflector } from "three/examples/jsm/objects/Reflector.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { DepthOfField, Stage3D, ease, lightsAt, noise1, orbit, safeKeys, useAssetTextures, type Light } from "../../three";
import { CaptionProbe, captionRows, measureCaption, wordTones, type ProbeGrid } from "../../three/captionProbe";
import { RedrawWhenReady } from "../archive/ArchiveLab";
import { BID_SEC, BID_STILL, BidCaption, K, ProofStamp, RedThread, SFX, bidLine, camOf, effTime, n2, shotBounds, span, useBidFont, useStampFace, wordAt, type BidShot, type V3 } from "./common";

/** الخط: من القريب نحو الماء ثم حلزون في الماء (لفّتان ونصف إلى الداخل عكس عقارب الساعة كالأصل) */
export const stonePath = (): [number, number][] => {
  const out: [number, number][] = [];
  for (let i = 0; i <= 10; i++) out.push([-3.2 + i * 0.32, 4.2 - i * 0.42]);
  const [cx, cz] = [0.6, -1.6];
  for (let i = 1; i <= 46; i++) {
    const a = -Math.PI / 2 - i * 0.34, r = 1.9 * (1 - i / 56);
    out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return out;
};
const CIRCLES: { x: number; z: number; r: number; n: number; gap?: number }[] = [
  { x: -3.4, z: 1.4, r: 0.38, n: 11 }, { x: -2.5, z: 0.4, r: 0.32, n: 9 }, { x: -4.0, z: 0.2, r: 0.3, n: 9 },
  { x: -5.2, z: -1.0, r: 0.9, n: 26, gap: 0.5 },
];

/** الأرض البكر: تنحدر نحو الماء ببطء مع تموج ثنائي البعد، فيرسم سطح الماء خط شاطئ غير مستقيم؛ الحلزون في ماء ضحل */
export const groundH = (x: number, z: number) => 0.05 + 0.022 * (z + 0.4) + 0.05 * n2(61, x * 0.45, z * 0.45) + 0.008 * n2(63, x * 3, z * 3);
/** مستوى الماء: منخفض ثم يفيض عند «حياة» */
export const waterLevel = (p: number) => -0.02 + 0.07 * p;
/** الموج الخفيف: ارتفاع وانخفاض بضعة مليمترات بزمن فعّال (يقف في السكون)، فيتقدم الماء على الشاطئ المنحدر ويتراجع */
export const swash = (te: number) => 0.006 * Math.sin(te * 1.25) + 0.0025 * Math.sin(te * 2.9 + 1.1);
/** شروق الشمس على مدار الحلقة (٠ فجر، ١ ضحى) بالزمن الفعّال */
export const sunAt = (t: number) => effTime(Math.min(t, BID_SEC)) / effTime(BID_SEC);

/** عتبة الحبر الداكن في هذا العالم: ما فوقها خلفية فاتحة (الرمل والسماء الفاتحة) */
export const SAND_INK = 0.5;
/** حفنة الطين المبلل (القطعة المخصوصة): على حافة الماء بعد الفيضان، موجودة من أول الحلقة فلا تظهر في جملة الذكر */
export const CLAY_AT: [number, number] = [2.35, -0.05];

/** أنواع الحجارة (الجولة ٣): مسطح، ومزوّى، ونهري مستدير، ومستطيل، ومشقوق نصفين؛ يتناوب النوع فلا يتجاور حجران متشابهان */
export const STONE_KINDS = ["flat", "angular", "river", "long", "split"] as const;
export type StoneKind = (typeof STONE_KINDS)[number];
export const RING_KINDS: readonly StoneKind[] = ["angular", "river", "long"];
/**
 * حجر شاطئ حقيقي: شبكة كثيفة تُزاح بضوضاء متعددة الطبقات، ثم «تُكسر» حوافه بمستويات قطع (وجوه مسطحة كالحجر المكسور)،
 * ومقياس وشكل مختلفان لكل نوع وكل حجر؛ والمشقوق نصف حجر بوجه مستوٍ. بذرة ثابتة: الحجر نفسه في كل إطار.
 */
export const stoneGeometry = (i: number, seed: number, kinds: readonly StoneKind[] = STONE_KINDS) => {
  const r = (k: number) => (noise1(seed + k, i * 1.37 + 0.5) + 1) / 2;
  const kind: StoneKind = kinds[(i * 3 + Math.floor(r(1) * 2)) % kinds.length]!;
  let g: THREE.BufferGeometry = new THREE.SphereGeometry(1, 72, 48);
  g.deleteAttribute("normal");
  g = mergeVertices(g);
  const [ax, ay, az] = kind === "flat" ? [1.05 + 0.4 * r(2), 0.32 + 0.14 * r(3), 0.85 + 0.3 * r(4)]
    : kind === "long" ? [1.45 + 0.35 * r(2), 0.45 + 0.15 * r(3), 0.6 + 0.15 * r(4)]
    : kind === "river" ? [1.0 + 0.2 * r(2), 0.55 + 0.15 * r(3), 0.85 + 0.2 * r(4)]
    : [0.9 + 0.3 * r(2), 0.6 + 0.25 * r(3), 0.8 + 0.3 * r(4)];
  // مستويات الكسر: المزوّى ٤–٥، والمشقوق مستوى عمودي يقطعه نصفين، وغيرها ١–٢ (حافة مثلومة)
  const chips: { n: THREE.Vector3; d: number }[] = [];
  const nChips = kind === "angular" ? 4 + Math.floor(r(5) * 2) : kind === "split" ? 1 : 1 + Math.floor(r(6) * 2);
  for (let c = 0; c < nChips; c++) {
    const th = r(10 + c) * Math.PI * 2, ph = (r(20 + c) - 0.35) * 1.4;
    chips.push({ n: new THREE.Vector3(Math.cos(th) * Math.cos(ph), Math.sin(ph), Math.sin(th) * Math.cos(ph)).normalize(), d: kind === "angular" ? 0.55 + 0.2 * r(30 + c) : 0.72 + 0.15 * r(30 + c) });
  }
  if (kind === "split") chips[0] = { n: new THREE.Vector3(Math.cos(r(40) * 6.28), 0, Math.sin(r(40) * 6.28)), d: 0.05 + 0.15 * r(41) };
  const pos = g.attributes.position!, v = new THREE.Vector3();
  const smooth = kind === "river" ? 0.5 : 1;
  for (let k = 0; k < pos.count; k++) {
    v.set(pos.getX(k), pos.getY(k), pos.getZ(k));
    const f = 1 + smooth * (0.2 * n2(seed + i * 3, v.x * 1.1 + v.y, v.z * 1.1 - v.y) + 0.07 * n2(seed + i * 5 + 1, v.x * 3.2, v.z * 3.2 + v.y * 2) + 0.02 * n2(seed + i * 7 + 2, v.x * 9, v.z * 9 + v.y * 5));
    v.multiplyScalar(f);
    for (const ch of chips) { const s = v.dot(ch.n); if (s > ch.d) v.addScaledVector(ch.n, -(s - ch.d) * 0.97); }
    pos.setXYZ(k, v.x * ax, Math.max(-0.42 * ay, v.y * ay), v.z * az);
  }
  g.computeVertexNormals();
  g.computeBoundingBox();
  return { g, kind, minY: g.boundingBox!.min.y, maxY: g.boundingBox!.max.y };
};
/** خامة الحجر (٣ مجموعات Poly Haven) ولونه وميله ودفنه: لا حجران متطابقان */
const useStones = (n: number, seed: number, maxSink = 0.45, kinds: readonly StoneKind[] = STONE_KINDS) => useMemo(() => Array.from({ length: n }, (_, i) => {
  const r = (k: number) => (noise1(seed + 60 + k, i * 2.11 + 0.3) + 1) / 2;
  const { g, kind, minY, maxY } = stoneGeometry(i, seed, kinds);
  const s = (kind === "flat" ? 0.1 : 0.075) + 0.075 * r(0);
  // ألوان حجر حقيقية: رمادي بارد، ومغرة، وداكن، وكريمي، حول خامته (مضاعِف خفيف)
  const base = [new THREE.Color(K.haze).lerp(new THREE.Color(K.paper), 0.45), new THREE.Color(K.light), new THREE.Color(K.earth).lerp(new THREE.Color(K.sand), 0.45), new THREE.Color(K.paper)][Math.floor(r(1) * 4) % 4]!;
  const tint = base.clone().lerp(new THREE.Color(K.pale), 0.2 * r(2)).multiplyScalar(1.05 + 0.25 * r(3));
  // نصف مدفون أحيانًا (٢٠–٤٥٪ من ارتفاعه تحت الرمل)، وإلا يستقر على سطحه
  const sink = Math.min(maxSink, r(4) > 0.55 ? 0.2 + 0.25 * r(5) : 0.04);
  return { g, s, tex: i % 3, rot: noise1(seed + 70, i) * Math.PI, tilt: [(r(6) - 0.5) * 0.35, (r(7) - 0.5) * 0.35] as [number, number], tint, minY, height: maxY - minY, sink };
}), [n, seed, maxSink, kinds]);
/** ظل التلامس تحت الحجر: قرص داكن متدرج على الرمل (يثبّت الحجر في الأرض) */
const useContactShadow = () => useMemo(() => {
  const S = 128, c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d")!, gr = g.createRadialGradient(S / 2, S / 2, 4, S / 2, S / 2, S / 2);
  gr.addColorStop(0, "rgba(42,30,20,0.75)"); gr.addColorStop(0.55, "rgba(42,30,20,0.35)"); gr.addColorStop(1, "rgba(42,30,20,0)");
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}, []);

/** الطبقات تحت الرمل (من الأعلى): سمكها ولونها، وختم «درجة الثبوت» بجوار كل طبقة */
export const LAYERS: { h: number; tint: string; word: "ثابت" | "رواية" | "لا نعلم" }[] = [
  { h: 0.3, tint: K.paper, word: "ثابت" }, { h: 0.34, tint: K.light, word: "رواية" }, { h: 0.42, tint: K.clay, word: "لا نعلم" },
];
/** مكان المقطع: تحت رمل بداية الخط نفسه (حيث يبدأ «من هنا»)، والوجه المكشوف نحو الكاميرا */
const CUT = { x0: -6, x1: 2, z0: 1.8, z1: 4.6 };
/** أعلى الطبقات تحت أخفض نقطة من الرمل فوق المقطع، فلا يبرز منها شيء فوق السطح */
export const cutTop = () => {
  let m = Infinity;
  for (let x = CUT.x0; x <= CUT.x1; x += 0.05) for (let z = CUT.z0; z <= CUT.z1; z += 0.05) m = Math.min(m, groundH(x, z));
  return m - 0.04;
};

export const stoneShots = (): BidShot[] => {
  const { s1, s2, s3, s4, s5 } = shotBounds();
  const aerial = { target: [-1.2, 0, -0.4] as V3, yaw: 18, pitch: 72, dist: 11.5, fov: 34 };
  const [cx, cz] = CLAY_AT;
  return [
    // سوغيموتو: الكاميرا منخفضة والأفق في المنتصف، والخط يمتد نحوه
    { id: "horizon", size: "wide", a: 0, b: s1, aperture: 0.0015, from: { target: [0.4, 0.6, -6], yaw: -6, pitch: 3, dist: 11.5, fov: 36 }, to: { target: [0.4, 0.55, -6], yaw: -2, pitch: 4, dist: 10.6, fov: 36 } },
    // العقدة: الكاميرا تتبع الخيط على الأرض حتى عقدته ثم تدور حولها
    { id: "knot", size: "detail", a: s1, b: s2, aperture: 0.03, from: { target: [-1.3, 0.12, 1.9], yaw: 62, pitch: 12, dist: 1.75, fov: 30 }, to: { target: [-0.75, 0.12, 1.2], yaw: 18, pitch: 20, dist: 1.3, fov: 30 } },
    // «لقد اشتهرت…»: من سطح المكان نفسه تنزل الكاميرا تحت الرمل إلى وجه الطبقات (سميث ١٨١٥)
    { id: "strata", size: "close", a: s2, b: s3, aperture: 0.012, move: 1.8, from: { target: [-2.2, 0.0, CUT.z1], yaw: 0, pitch: 38, dist: 3.2, fov: 34 }, to: { target: [-1.9, cutTop() - 0.6, CUT.z1], yaw: 4, pitch: 4, dist: 2.2, fov: 34 } },
    // «موضع هبوطه»: تصعد إلى الشاطئ الخالي على حافة الماء
    { id: "shore", size: "medium", a: s3, b: s4, aperture: 0.006, from: { target: [1.2, 0.05, 0.4], yaw: -24, pitch: 12, dist: 4.6, fov: 34 }, to: { target: [1.6, 0.05, 0.1], yaw: -34, pitch: 14, dist: 4.2, fov: 34 } },
    { id: "circles", size: "close", a: s4, b: s5, aperture: 0.014, from: { target: [-3.4, 0.15, 0.6], yaw: 70, pitch: 20, dist: 4.4, fov: 32 }, to: { target: [-4.0, 0.15, 0.2], yaw: 58, pitch: 22, dist: 4.0, fov: 32 } },
    // حفنة الطين: تبدأ قبل جملة الذكر وتسكن فيها كلها، وبعدها تنسحب إلى الحلزون من علٍ (سميثسون)
    { id: "clay", size: "detail", a: s5, b: BID_SEC, aperture: 0.035, from: { target: [cx, groundH(cx, cz) + 0.05, cz], yaw: -28, pitch: 16, dist: 1.05, fov: 30 }, to: { ...aerial, dist: 10.6, pitch: 70 } },
  ];
};

/** ماء بانعكاس: مرآة مستوية (Reflector) تحت سطح شفاف بلون الماء ونسيج موج يتحرك بالزمن الفعّال */
const useWaterNormals = () => useMemo(() => {
  const S = 256, c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d")!, img = g.createImageData(S, S);
  const h = (x: number, y: number) => 0.6 * Math.sin((x / S) * Math.PI * 2 * 3 + 2 * Math.sin((y / S) * Math.PI * 2)) + 0.4 * Math.sin((y / S) * Math.PI * 2 * 5 + 1.3 * Math.sin((x / S) * Math.PI * 2 * 2));
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1);
    const n = new THREE.Vector3(-dx * 0.6, -dy * 0.6, 1).normalize(), i = (y * S + x) * 4;
    img.data[i] = (n.x * 0.5 + 0.5) * 255; img.data[i + 1] = (n.y * 0.5 + 0.5) * 255; img.data[i + 2] = (n.z * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 7); return t;
}, []);
const Mirror: React.FC<{ y: number; width: number; height: number }> = ({ y, width, height }) => {
  const m = useMemo(() => {
    const r = new Reflector(new THREE.PlaneGeometry(90, 44), { textureWidth: Math.round(width / 2), textureHeight: Math.round(height / 2), color: new THREE.Color(K.mist), clipBias: 0.003 });
    r.rotation.x = -Math.PI / 2; return r;
  }, [width, height]);
  m.position.set(0, y - 0.004, -10);
  return <primitive object={m} />;
};

/** ختم على وجه طبقة: بطاقة على الوجه، وختم خشبي يقترب أفقيًا ويُضغط ويعود، ويبقى الأثر. pressed: مختوم من قبل */
const WallStamp: React.FC<{ word: "ثابت" | "رواية" | "لا نعلم"; at: V3; p: number; ready: boolean; pressed?: boolean }> = ({ word, at, p, ready, pressed = false }) => {
  const seal = useStampFace(word, word === "ثابت" ? K.ribbon : K.ink, ready, K.paper);
  const press = pressed ? 1 : span(p, 0, 0.45), lift = pressed ? 1 : span(p, 0.55, 0.45);
  const z = (1 - Math.sin(Math.min(1, press) * Math.PI / 2)) * 0.45, up = ease(lift) * 1.1;
  return (
    <group position={at}>
      <mesh position={[0, 0, 0.004]}><planeGeometry args={[0.34, 0.34]} /><meshStandardMaterial color={K.paper} roughness={0.9} /></mesh>
      {press >= 1 && <mesh position={[0, 0, 0.006]}><planeGeometry args={[0.32, 0.32]} /><meshStandardMaterial map={seal} roughness={1} /></mesh>}
      {lift < 1 && press > 0 && (
        <group position={[0, up, 0.06 + z]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow><cylinderGeometry args={[0.13, 0.13, 0.05, 32]} /><meshStandardMaterial color={K.ink} roughness={0.75} /></mesh>
          <mesh position={[0, 0.14, 0]} castShadow><cylinderGeometry args={[0.06, 0.04, 0.2, 16]} /><meshStandardMaterial color={K.ink} roughness={0.6} /></mesh>
        </group>
      )}
    </group>
  );
};

/**
 * حفنة طين مبلل (القطعة المخصوصة، الجولة ٣): كومة مسطحة غير منتظمة الحافة، عليها أثر ثلاث أصابع متوازية وإبهام، وطيات حيث
 * انضغط الطين، ولون رطب داكن في أعلاها يفتح نحو حافة أجفّ؛ ولمعة بلل (طبقة لامعة) في المادة. ساكنة كلها.
 */
export const clayGeometry = () => {
  // قطبا الكرة إلى الجانبين (لا انقباض في أعلى الكومة حيث تتلاقى خطوط الشبكة)
  let g: THREE.BufferGeometry = new THREE.SphereGeometry(1, 256, 128).rotateZ(Math.PI / 2);
  // الإحداثيات تبقى (خامة الطين)، ودمج الرؤوس لا يدمج حواف الخياطة فلا شق في الشبكة لأن الإزاحة دالة في الموضع
  g.deleteAttribute("normal");
  g = mergeVertices(g);
  const pos = g.attributes.position!, v = new THREE.Vector3();
  const fingers = [-0.26, 0, 0.26];
  // طين رطب: لون الطين نفسه أعمق قليلًا (لا بني الشوكولاتة)، وحافة أجفّ أفتح مائلة إلى الرمل
  // لون الطين من خامته (Poly Haven)، ورؤوس الشبكة تُعتمه رطبًا في الأعلى وتفتحه أجفّ عند الحافة
  const wet = new THREE.Color(1.15, 0.92, 0.8), dry = new THREE.Color(1.55, 1.3, 1.1);
  // شقوق الحافة الجافة: أخاديد شعاعية رفيعة عند أسفل الكومة (بذرة ثابتة)
  const cracks = Array.from({ length: 11 }, (_, i) => (noise1(181, i * 2.7) + 1) * Math.PI);
  const col = new Float32Array(pos.count * 3);
  for (let k = 0; k < pos.count; k++) {
    v.set(pos.getX(k), pos.getY(k), pos.getZ(k));
    const ang = Math.atan2(v.z, v.x);
    // حافة غير منتظمة، وطيات حول الكومة
    let f = 1 + 0.16 * n2(171, Math.cos(ang) * 1.6, Math.sin(ang) * 1.6) + 0.05 * Math.sin(ang * 5 + v.y * 6) * (1 - Math.abs(v.y)) + 0.03 * n2(173, v.x * 6, v.z * 6 + v.y * 3) + 0.012 * n2(177, v.x * 22, v.z * 22 + v.y * 9);
    // أثر الأصابع: أخاديد طويلة متوازية على الأعلى (عرضها ٠٫١٢، طولها ٠٫٥)، والإبهام غمازة على الجانب
    if (v.y > 0) for (const off of fingers) { const along = v.x * 0.94 + v.z * 0.34 - 0.05, across = -v.x * 0.34 + v.z * 0.94 - off; f -= 0.34 * v.y * Math.exp(-((along / 0.55) ** 2 + (across / 0.085) ** 2)); }
    { const d2 = (v.x + 0.7) ** 2 + (v.y - 0.25) ** 2 + (v.z - 0.35) ** 2; f -= 0.22 * Math.exp(-d2 / 0.06); }
    // الطين المعصور يبرز بين الأصابع وعند طرف الكفّ: انتفاخ غير متماثل
    { const d2 = (v.x - 0.75) ** 2 + (v.y - 0.1) ** 2 + (v.z + 0.3) ** 2; f += 0.14 * Math.exp(-d2 / 0.12); }
    { const rim = Math.max(0, 1 - Math.abs(v.y + 0.05) / 0.35);
      for (const c of cracks) { let d = Math.abs(ang - c); d = Math.min(d, Math.PI * 2 - d); f -= 0.07 * rim * Math.exp(-((d / 0.022) ** 2)); } }
    v.multiplyScalar(f);
    const y = Math.max(-0.12, v.y * 0.48);
    pos.setXYZ(k, v.x * 1.25, y, v.z * 1.05);
    // رطب داكن في الأعلى، وأجفّ أفتح عند الحافة السفلى
    const dryness = Math.min(1, Math.max(0, (0.1 - y) / 0.2));
    const c = wet.clone().lerp(dry, dryness * 0.85);
    col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
};
const useClayHandful = () => useMemo(clayGeometry, []);
/** فتات الطين حول الكومة: كتل صغيرة غير منتظمة (بذرة ثابتة) */
export const CLAY_CRUMBS: [number, number, number][] = [[0.17, -0.05, 0.016], [-0.15, 0.11, 0.012], [0.05, 0.19, 0.01], [-0.2, -0.12, 0.014], [0.22, 0.12, 0.009]];
const useCrumbs = () => useMemo(() => CLAY_CRUMBS.map((_, i) => {
  let g: THREE.BufferGeometry = new THREE.SphereGeometry(1, 18, 12); g.deleteAttribute("normal"); g = mergeVertices(g);
  const pos = g.attributes.position!;
  for (let k = 0; k < pos.count; k++) { const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k), f = 1 + 0.3 * n2(191 + i, x * 2 + y, z * 2); pos.setXYZ(k, x * f, Math.max(-0.3, y * f * 0.6), z * f); }
  g.computeVertexNormals(); return g;
}), []);
/** حلقة الرطوبة تحت الطين: الرمل حولها أدكن (ماء الطين يتشربه الرمل) */
const useDampRing = () => useMemo(() => {
  const S = 256, c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d")!, gr = g.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2);
  gr.addColorStop(0, "rgba(70,44,30,0.8)"); gr.addColorStop(0.6, "rgba(70,44,30,0.6)"); gr.addColorStop(1, "rgba(70,44,30,0)");
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  // حافة غير منتظمة (بذرة ثابتة)
  g.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 90; i++) { const a = (i * 137.5 * Math.PI) / 180, rr = 95 + ((i * 37) % 30); g.globalAlpha = 0.25; g.beginPath(); g.arc(S / 2 + Math.cos(a) * rr, S / 2 + Math.sin(a) * rr, 8 + (i % 7), 0, Math.PI * 2); g.fill(); }
  return new THREE.CanvasTexture(c);
}, []);

export const StoneLinesLab: React.FC = () => {
  const ready = useBidFont();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  const still = BID_STILL;
  const te = effTime(t);
  const path = useMemo(stonePath, []);
  // الخط والحلزون في الماء الضحل: دفن خفيف فلا يغرق الحلزون تحت الماء ويبقى مقروءًا من علٍ (سميثسون)
  const lineStones = useStones(path.length, 31, 0.1);
  // دوائر القرى: لا مشقوق ولا مسطح (كانا يبدوان أصدافًا، ملاحظة المالك)؛ حجارة كتلية متنوعة
  const ringStones = useStones(CIRCLES.reduce((n, c) => n + c.n, 0), 57, 0.45, RING_KINDS);
  const stoneTex1 = useAssetTextures(["dafatir-bid-stone-diff", "dafatir-bid-stone-nor", "dafatir-bid-stone-rough"], [0.22, 0.22]);
  const stoneTex2 = useAssetTextures(["dafatir-bid-stone2-diff", "dafatir-bid-stone2-nor", "dafatir-bid-stone2-rough"], [0.3, 0.3]);
  const stoneTex3 = useAssetTextures(["dafatir-bid-stone3-diff", "dafatir-bid-stone3-nor", "dafatir-bid-stone3-rough"], [0.3, 0.3]);
  const stoneTex = stoneTex1 && stoneTex2 && stoneTex3 ? [stoneTex1, stoneTex2, stoneTex3] : null;
  const contact = useContactShadow(), damp = useDampRing(), crumbs = useCrumbs();
  const clayTex = useAssetTextures(["dafatir-bid-clay-diff", "dafatir-bid-clay-nor", "dafatir-bid-clay-rough"], [4, 2]);
  const sandTex = useAssetTextures(["dafatir-bid-sand-diff", "dafatir-bid-sand-nor", "dafatir-bid-sand-rough"], [28, 18]);
  const wetTex = useAssetTextures(["dafatir-bid-wetsand-diff", "dafatir-bid-wetsand-nor", "dafatir-bid-wetsand-rough"], [32, 20]);
  const strataTex = useAssetTextures(["dafatir-bid-strata-diff", "dafatir-bid-strata-nor", "dafatir-bid-strata-rough"], [8, 0.35]);
  const waterNor = useWaterNormals();
  const clay = useClayHandful();
  const key = (w: string, d: number, lead = 0.1) => safeKeys([{ a: wordAt(w) - lead, b: wordAt(w) - lead + d, to: 1 }], still)[0]!;
  const lineK = key("ومن", 4.4), stampK = key("قصة", 0.5), knotK = key("البشرية", 0.6);
  const rewK = key("روايات", 0.9), unkK = key("نعلم", 0.9);
  const waterK = key("حياة", 1.4), proofK = key("القديمة", 0.5), villageK = key("القرى", 0.9), cityK = key("والمدن", 1.0);
  const p = (k: { a: number; b: number }) => ease(span(t, k.a, k.b - k.a));
  const line = span(t, lineK.a, lineK.b - lineK.a), water = p(waterK);
  const level = waterLevel(water) + swash(te);
  // الشمس (قرار المالك): من الفجر إلى الضحى على مدار الحلقة، بالزمن الفعّال
  const sp = sunAt(t);
  const elev = -0.02 + 0.6 * ease(sp), az = 0.35 - 0.55 * sp;
  const sunDir: V3 = [Math.sin(az) * Math.cos(elev), Math.sin(elev), -Math.cos(az) * Math.cos(elev)];
  const mixC = (a: string, b: string, q: number) => `#${new THREE.Color(a).lerp(new THREE.Color(b), q).getHexString()}`;
  const skyQ = Math.round(sp * 120) / 120;
  const sky = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 8; c.height = 512;
    const g = c.getContext("2d")!, gr = g.createLinearGradient(0, 0, 0, 512);
    // قبة: أعلى اللوحة سمت السماء، ومنتصفها الأفق، وما تحته بلون الأفق
    gr.addColorStop(0, mixC(K.dusk, K.haze, skyQ)); gr.addColorStop(0.3, mixC(K.mist, K.pale, skyQ)); gr.addColorStop(0.46, mixC(K.light, K.paper, skyQ)); gr.addColorStop(0.5, mixC(K.sun, K.paper, skyQ)); gr.addColorStop(1, mixC(K.sun, K.paper, skyQ));
    g.fillStyle = gr; g.fillRect(0, 0, 8, 512);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx;
  }, [skyQ]); // eslint-disable-line react-hooks/exhaustive-deps
  // الأرض: رمل الشاطئ (Poly Haven)، والرمل المبلول طبقة فوقه تظهر حتى فوق خط الماء الحالي بقليل (تتبع الفيضان والموج)
  const ground = useMemo(() => {
    const g = new THREE.PlaneGeometry(80, 52, 560, 360), pos = g.attributes.position!;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = -pos.getY(i); pos.setZ(i, groundH(x, z)); }
    g.computeVertexNormals(); return g;
  }, []);
  // الجولة ٣ (قرار المالك): رمل شاطئ شاحب فاتح بخامته الحقيقية: لون الخامة يُعاد إلى الشحوب حول متوسطها (تبقى حبيباتها
  // ونتوؤها)، بدل ضرب لونها الأوسط البني في لون الورق
  const sandMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ roughness: 0.97, side: THREE.DoubleSide });
    m.onBeforeCompile = (sh) => {
      // ذهبي فاتح (ملاحظة المالك على v2: لا أبيض رمادي ولا بني ترابي)
      sh.uniforms.uPale = { value: new THREE.Color(K.light).lerp(new THREE.Color(K.pale), 0.3) };
      sh.uniforms.uMean = { value: new THREE.Color(0x83725d) };
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform vec3 uPale;\nuniform vec3 uMean;")
        .replace("#include <map_fragment>", "#ifdef USE_MAP\nvec4 sd = texture2D( map, vMapUv );\ndiffuseColor.rgb *= uPale * mix( vec3( 1.0 ), sd.rgb / uMean, 0.55 );\n#endif");
    };
    return m;
  }, []);
  if (sandTex) { sandMat.map = sandTex[0]!; sandMat.normalMap = sandTex[1]!; sandMat.needsUpdate = !sandMat.userData.ok; sandMat.userData.ok = true; }
  // ثقب في الرمل فوق المقطع ليُرى من تحته (يُخفى من أعلى بلوح الرمل نفسه: الكاميرا لا تنظر إليه من فوق إلا في اللقطة الثالثة قبل النزول)
  const wetUniform = useMemo(() => ({ value: 0 }), []);
  wetUniform.value = level;
  const wetMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ transparent: true, roughness: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uLevel = wetUniform;
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying float vWY;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vWY;\nuniform float uLevel;").replace("#include <alphamap_fragment>", "#include <alphamap_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(uLevel + 0.006, uLevel + 0.055, vWY);");
    };
    return m;
  }, [wetUniform]);
  if (wetTex) { wetMat.map = wetTex[0]!; wetMat.normalMap = wetTex[1]!; wetMat.roughnessMap = wetTex[2]!; wetMat.needsUpdate = !wetMat.userData.ok; wetMat.userData.ok = true; }
  // نسيج الموج يتحرك بالزمن الفعّال (يقف في السكون)
  waterNor.offset.set(te * 0.012, te * 0.007);
  const shots = stoneShots();
  const shot = shots.find((s) => t >= s.a && t < s.b) ?? shots[shots.length - 1]!;
  const c = camOf(shot, t);
  const cam = { position: orbit(c), target: c.target, fov: c.fov };
  const under = shot.id === "strata";
  const topY = useMemo(cutTop, []);
  const lights: Light[] = [
    { kind: "ambient", kelvin: 7500, intensity: 0.4 + 0.45 * sp, position: [0, 0, 0] },
    // الشمس: ضوء مائل من خلف الماء يرتفع ويدفأ ثم يبيضّ (٢٢٠٠ إلى ٥٢٠٠ كلفن)، فتقصر الظلال
    { kind: "key", kelvin: 2200 + 3000 * sp, intensity: 1.2 + 2.0 * Math.max(0, sunDir[1]) + 0.6 * sp, position: [sunDir[0] * 16, Math.max(0.6, sunDir[1] * 16), sunDir[2] * 16] },
    { kind: "fill", kelvin: 8500, intensity: 0.3 + 0.2 * sp, position: [-4, 6, 8] },
    // تحت الرمل: مصباح عمل دافئ أمام وجه المقطع (من موضع الكاميرا) يكشف الطبقات
    // عدد الأضواء ثابت في كل اللقطات (تغيّره يعيد تجميع المواد فيخطئ أول إطار بعده): مصباح العمل وملؤه صفر فوق الرمل
    { kind: "practical", kelvin: 3400, intensity: under ? 4.8 : 0, position: [-1.2, topY - 0.2, CUT.z1 + 1.6] },
    { kind: "fill", kelvin: 6500, intensity: under ? 0.7 : 0, position: [-1.9, topY - 0.6, CUT.z1 + 6] },
  ];
  // الترجمة: كل كلمة بنبرة ما خلفها في الإطار نفسه (يُنتظر قياس هذا الإطار قبل تصويره)
  const lineNow = bidLine(t);
  const captionBottom = 56;
  const rows = useMemo(() => captionRows(height, captionBottom), [height]);
  const [probe, setProbe] = React.useState<ProbeGrid | null>(null);
  const onProbe = React.useCallback((g: ProbeGrid) => setProbe((q) => (q?.frame === g.frame ? q : g)), []);
  const waiting = React.useRef<{ frame: number; h: number } | null>(null);
  const texReady = Boolean(stoneTex && sandTex && wetTex && strataTex && clayTex);
  if (lineNow && ready && texReady && probe?.frame !== frame && waiting.current?.frame !== frame) {
    if (waiting.current) continueRender(waiting.current.h);
    waiting.current = { frame, h: delayRender(`قياس ما خلف الترجمة ${frame}`) };
  }
  React.useEffect(() => {
    if (waiting.current && (!lineNow || probe?.frame === waiting.current.frame)) { continueRender(waiting.current.h); waiting.current = null; }
  });
  // الرمل متوسط الإضاءة (حول ٠٫٥): كل خلية أعلى من ٠٫٣٨ فاتحة، والأغلبية تقرر نبرة الكلمة؛ فلا تتقلب النبرة بين رندرين
  // لفرق ضئيل في لحظة القراءة، ويأخذ الرمل حبرًا داكنًا بهالة فاتحة (قرار المالك: «حبر داكن على الرمل الفاتح»)
  const tones = useMemo(() => (lineNow && ready && probe?.frame === frame
    ? wordTones(lineNow.text, { bin: probe.bin, lum: probe.lum.map((r) => r.map((v) => (v > SAND_INK ? 0.9 : 0.1))) }, width, measureCaption) : []), [lineNow?.text, probe, frame, width, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const stoneMat = (tint: THREE.Color, set = 0) => {
    if (!stoneTex) return <meshStandardMaterial color={tint} roughness={0.9} />;
    const tx = stoneTex[set]!;
    return <meshStandardMaterial color={tint} map={tx[0]!} normalMap={tx[1]!} normalScale={new THREE.Vector2(0.8, 0.8)} roughnessMap={tx[2]!} />;
  };
  // حجر في مكانه: نصف مدفون أو مستقر، بميله، وظل تلامس تحته
  const stoneAt = (key: string, st: ReturnType<typeof useStones>[number], x: number, z: number, scale: number, drop: number) => (
    <group key={key}>
      <mesh geometry={st.g} position={[x, groundH(x, z) + (-st.minY - st.sink * st.height) * scale + drop, z]} rotation={[st.tilt[0], st.rot, st.tilt[1]]} scale={scale} castShadow={drop < 0.12} receiveShadow>{stoneMat(st.tint, st.tex)}</mesh>
      {drop < 0.02 && <mesh position={[x, groundH(x, z) + 0.008, z]} rotation={[-Math.PI / 2, 0, st.rot]} renderOrder={1}><planeGeometry args={[scale * 2.9, scale * 2.3]} /><meshBasicMaterial map={contact} transparent depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-4} /></mesh>}
    </group>
  );
  // الطبقات: ارتفاع أعلاها تحت سطح المقطع
  let ly = topY;
  let ri = 0;
  return (
    <>
      <Stage3D width={width} height={height} cam={cam} lights={lightsAt(t, lights, still)} background={mixC(K.dusk, K.haze, skyQ)} shadows="soft">
        <RedrawWhenReady ready={ready && texReady} />
        {/* عمق ميدان معتدل: الحد الأقصى للتمويه أقل من الافتراضي، فلا تتحول لمعات الماء والحجر القريب إلى أقراص */}
        <DepthOfField focus={c.dist} aperture={shot.aperture} maxblur={0.005} />
        {/* لا يُرسم المشهد قبل اكتمال الخامات كلها: كل مادة تُنشأ بخامتها من أول مرة (إضافة خامة لمادة مرسومة قد لا تظهر في الإطار الملتقط) */}
        {texReady && (<>
        {/* قبة السماء من كل الجهات (لا حافة لوح في اللقطات الجانبية) */}
        <mesh><sphereGeometry args={[90, 48, 24]} /><meshBasicMaterial map={sky} side={THREE.BackSide} toneMapped={false} depthWrite={false} /></mesh>
        {/* قرص الشمس يرتفع على مدار الحلقة، بلا وهج */}
        <mesh position={[sunDir[0] * 29 / Math.max(0.2, -sunDir[2]), -0.6 + 9 * Math.max(0, sunDir[1]) + 0.6, -29]}><circleGeometry args={[1.0, 48]} /><meshBasicMaterial color={mixC(K.sun, K.paper, sp)} toneMapped={false} /></mesh>
        {/* الرمل الجاف، ثم المبلول فوقه عند الحافة */}
        <mesh geometry={ground} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          {/* الرمل الجاف مطفأ (بلا خريطة خشونة): لا لمعات على حبيباته؛ والخامة تبقى في اللون والنتوء */}
          {sandTex ? <primitive object={sandMat} attach="material" /> : <meshStandardMaterial color={K.pale} roughness={0.95} />}
        </mesh>
        <mesh geometry={ground} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0015, 0]} material={wetMat} receiveShadow />
        {/* الماء: مرآة بانعكاس السماء والحجارة، وسطح شفاف بلون الماء ونسيج موج */}
        <Mirror y={level} width={width} height={height} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, level, -10]} receiveShadow>
          <planeGeometry args={[90, 44]} /><meshStandardMaterial color={K.water} transparent opacity={0.64} roughness={0.12} metalness={0.1} normalMap={waterNor} normalScale={new THREE.Vector2(0.35, 0.35)} depthWrite={false} />
        </mesh>
        {/* المقطع تحت رمل بداية الخط: طبقات بخامة تربة حقيقية، ووجهها نحو الكاميرا، وبجوار كل طبقة ختمها */}
        {LAYERS.map((L, i) => {
          const y = ly - L.h / 2; ly -= L.h;
          return (
            <group key={L.word}>
              <mesh position={[(CUT.x0 + CUT.x1) / 2, y, (CUT.z0 + CUT.z1) / 2]} receiveShadow castShadow>
                <boxGeometry args={[CUT.x1 - CUT.x0, L.h, CUT.z1 - CUT.z0]} />
                {strataTex ? <meshStandardMaterial map={strataTex[0]!} normalMap={strataTex[1]!} normalScale={new THREE.Vector2(1.6, 1.6)} roughness={1} color={L.tint} /> : <meshStandardMaterial color={L.tint} roughness={0.95} />}
              </mesh>
              <WallStamp word={L.word} at={[-1.35, y, CUT.z1]} ready={ready} pressed={i === 0} p={i === 1 ? span(t, rewK.a, 0.9) : i === 2 ? span(t, unkK.a, 0.9) : 1} />
            </group>
          );
        })}
        {/* ما تحت الطبقات: صخر الأساس، فلا فراغ تحت المقطع */}
        <mesh position={[(CUT.x0 + CUT.x1) / 2, ly - 1.0, (CUT.z0 + CUT.z1) / 2]} receiveShadow>
          <boxGeometry args={[CUT.x1 - CUT.x0, 2.0, CUT.z1 - CUT.z0]} />
          {strataTex ? <meshStandardMaterial map={strataTex[0]!} normalMap={strataTex[1]!} roughness={1} color={K.soil} /> : <meshStandardMaterial color={K.soil} roughness={0.95} />}
        </mesh>
        {/* الخط ثم الحلزون: يوضع حجرًا حجرًا (يهبط ويستقر) */}
        {path.map(([x, z], i) => {
          const q = ease(span(line * path.length, i, 1.4));
          const st = lineStones[i]!;
          return q > 0 ? stoneAt(`l${i}`, st, x, z, st.s, (1 - q) * 0.6) : null;
        })}
        {/* دوائر الحجارة: ثلاث قرى عند «القرى»، والكبيرة ببابها عند «المدن» */}
        {CIRCLES.map((cc, ci) => Array.from({ length: cc.n }, (_, k) => {
          const st = ringStones[ri++]!;
          const a = (k / cc.n) * Math.PI * 2;
          if (cc.gap && Math.abs(((a + Math.PI) % (Math.PI * 2)) - Math.PI) < cc.gap / 2) return null;
          const prog = ci < 3 ? ease(span(t, villageK.a + ci * 0.15 + k * 0.02, 0.4)) : ease(span(t, cityK.a + k * 0.025, 0.4));
          const x = cc.x + Math.cos(a) * cc.r, z = cc.z + Math.sin(a) * cc.r;
          return prog > 0 ? stoneAt(`${ci}-${k}`, st, x, z, st.s * (ci < 3 ? 0.8 : 1.1), (1 - prog) * 0.5) : null;
        }))}
        <RedThread points={path.slice(0, 12).map(([x, z], i) => { const ox = 0.16 + 0.07 * Math.sin(i * 1.7); return [x + ox, groundH(x + ox, z) + 0.012, z + 0.06] as V3; })} p={Math.min(1, line * 1.9)} knot={p(knotK)} knotAt={0.5} radius={0.012} />
        {/* بلاطتان من حجر حقيقي عليهما الختمان */}
        {/* الختمان يُضغطان في الرمل نفسه (أُزيلت البلاطتان: كانتا صندوقًا غير مفهوم، ملاحظة المالك على v2) */}
        <ProofStamp word="ثابت" at={[-1.9, groundH(-1.9, 3.2) + 0.012, 3.2]} press={span(t, stampK.a, 0.3)} lift={span(t, stampK.a + 0.35, 0.4)} ready={ready} size={0.3} tilt={0.3} />
        <ProofStamp word="تقدير" at={[-3.0, groundH(-3.0, -0.4) + 0.012, -0.4]} press={span(t, proofK.a, 0.3)} lift={span(t, proofK.a + 0.35, 0.4)} ready={ready} size={0.27} ink={K.ink} tilt={-0.2} />
        {/* حفنة الطين المبلل على حافة الماء (القطعة المخصوصة): موجودة من البداية، ساكنة كلها */}
        {(() => {
          const [x, z] = CLAY_AT, y = groundH(x, z);
          return (
            <group>
              <mesh position={[x, y + 0.014, z]} rotation={[-Math.PI / 2, 0, 0.4]} renderOrder={1}><planeGeometry args={[0.66, 0.56]} /><meshStandardMaterial map={damp} transparent roughness={0.22} depthWrite={false} polygonOffset polygonOffsetFactor={-4} /></mesh>
              <mesh geometry={clay} position={[x, y + 0.012, z]} rotation={[0, 0.6, 0]} scale={0.13} castShadow receiveShadow>
                {/* لمعة البلل: طبقة لامعة فوق طين خشن قليلًا، ولون الرطوبة من رؤوس الشبكة */}
                <meshPhysicalMaterial vertexColors map={clayTex?.[0]} normalMap={clayTex?.[1]} normalScale={new THREE.Vector2(0.5, 0.5)} roughnessMap={clayTex?.[2]} roughness={0.75} clearcoat={0.55} clearcoatRoughness={0.3} clearcoatRoughnessMap={clayTex?.[2]} />
              </mesh>
              {CLAY_CRUMBS.map(([dx, dz, r], i) => (
                <mesh key={i} geometry={crumbs[i]!} position={[x + dx, y + r * 0.35, z + dz]} rotation={[0, i * 1.3, 0]} scale={r} castShadow receiveShadow>
                  <meshStandardMaterial map={clayTex?.[0]} color={mixC(K.paper, K.light, 0.3)} roughness={0.8} />
                </mesh>
              ))}
            </group>
          );
        })()}
        </>)}
        {/* القياس بعد اكتمال الخطوط والخامات وحده: قراءة إطار بألوان بديلة قبل تحميل الخامات تقلب نبرة الترجمة */}
        {ready && texReady ? <CaptionProbe frame={frame} rows={rows} onProbe={onProbe} /> : null}
      </Stage3D>
      {/* صوت المكان، ومع كل حركة صوتها (D158): وضع الحجر، والختم، والماء */}
      <Audio src={SFX("silence-room")} volume={0.3} loop />
      <Sequence from={Math.round(lineK.a * fps)} durationInFrames={20}><Audio src={SFX("drop-soft")} volume={0.3} /></Sequence>
      <Sequence from={Math.round((stampK.a + 0.28) * fps)} durationInFrames={20}><Audio src={SFX("stamp")} volume={0.45} /></Sequence>
      <Sequence from={Math.round((rewK.a + 0.38) * fps)} durationInFrames={20}><Audio src={SFX("stamp")} volume={0.35} /></Sequence>
      <Sequence from={Math.round((unkK.a + 0.38) * fps)} durationInFrames={20}><Audio src={SFX("stamp")} volume={0.35} /></Sequence>
      <Sequence from={Math.round(waterK.a * fps)} durationInFrames={30}><Audio src={SFX("water-drop")} volume={0.35} /></Sequence>
      <Sequence from={Math.round((proofK.a + 0.28) * fps)} durationInFrames={20}><Audio src={SFX("stamp")} volume={0.35} /></Sequence>
      <Sequence from={Math.round(villageK.a * fps)} durationInFrames={20}><Audio src={SFX("drop-soft")} volume={0.3} /></Sequence>
      <Sequence from={Math.round(cityK.a * fps)} durationInFrames={20}><Audio src={SFX("drop-soft")} volume={0.3} /></Sequence>
      <BidCaption line={lineNow} tones={tones} name="خطوط على الأرض" bottom={captionBottom} />
    </>
  );
};
