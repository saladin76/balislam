/**
 * «مكتب الرحّالة» — عالم «دفاتر الزمن» الواحد (توصية المنسّق بعد رفض المالك مستوى النماذج الأولى، ٢٢ نوفمبر):
 * الاتجاهات الثلاثة على مكتب واحد وتحت ضوء نافذة واحد. الإسطرلاب للتاريخ (٢–٤ ث)، والدفتر أساس الحكاية (خريطة
 * على طريقة مدرسة البلخي، الجنوب في الأعلى، يرسمها الحبر بنفسه ويُغسل لونها، بعنوان مذهّب وحاشية برقعة حمراء)،
 * والوثيقة والختم عند المصدر. خامات المكتب والجلد من Poly Haven (CC0، materials.ts). كل ما يُقرأ يُقرأ على هاتف ٦ بوصات.
 * الألوان من «دفتر الأفق» المعتمدة؛ اللازورد التاريخي ليس فيها (قرار هوية للمالك)، فالبحر بدرجتها البنفسجية الفاتحة.
 */
import React, { useMemo } from "react";
import { continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useBrandFonts } from "../../useBrandFonts";
import { Stage3D, assetFile, camAt, ease, lightsAt, type Cam, type Light } from "../../three";

export const WORLD_FPS = 30;
const TEXT = "سنة مئة وخمس وأربعين للهجرة، بدأ أبو جعفر المنصور بناء بغداد على دجلة، وسمّاها مدينة السلام.";
export const WORLD_WORDS = (() => {
  let t = 0.5;
  return TEXT.split(" ").map((w) => { const x = { w, s: t, e: t + 0.38 }; t += 0.44 + (/[،.]$/.test(w) ? 0.3 : 0); return x; });
})();
export const wAt = (w: string) => WORLD_WORDS.find((x) => x.w.replace(/[،.]/g, "") === w)!.s;
export const WORLD_SEC = Math.ceil(WORLD_WORDS[WORLD_WORDS.length - 1]!.e + 2.4);
export const worldFrames = () => WORLD_SEC * WORLD_FPS;

/** ألوان «دفتر الأفق» المعتمدة ودرجاتها */
export const WORLD_COLORS = {
  parchment: "#F1E4CB", parchmentDeep: "#EADBC0", ink: "#4A2E1F", inkDark: "#2B1E14", vermilion: "#D7372B", gold: "#C8A15A",
  goldLight: "#F3C98B", sea: "#A399B4", seaDeep: "#35284D", verdigris: "#7A7F4E", dusk: "#2A1E3F", silver: "#F3E9DA", brassDark: "#5A4632",
} as const;
const K = WORLD_COLORS;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const span = (t: number, a: number, d: number) => clamp01((t - a) / d);

/** خط بالحبر يُرسم بنسبة p من طوله (الحبر يرسم نفسه) */
const partial = (g: CanvasRenderingContext2D, pts: [number, number][], p: number) => {
  if (p <= 0) return;
  const segs = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i]![0], q[1] - pts[i]![1]));
  let left = segs.reduce((a, b) => a + b, 0) * p;
  g.beginPath(); g.moveTo(...pts[0]!);
  for (let i = 1; i < pts.length && left > 0; i++) {
    const d = segs[i - 1]!, k = Math.min(1, left / d);
    g.lineTo(pts[i - 1]![0] + (pts[i]![0] - pts[i - 1]![0]) * k, pts[i - 1]![1] + (pts[i]![1] - pts[i - 1]![1]) * k);
    left -= d;
  }
  g.stroke();
};

/** غسيل لوني كالألوان المائية: طبقات شفافة متراكبة بحواف غير منتظمة، تنتشر بنسبة p */
const wash = (g: CanvasRenderingContext2D, poly: [number, number][], color: string, p: number, seed: number) => {
  if (p <= 0) return;
  const cx = poly.reduce((a, q) => a + q[0], 0) / poly.length, cy = poly.reduce((a, q) => a + q[1], 0) / poly.length;
  g.save(); g.fillStyle = color;
  for (let k = 0; k < 5; k++) {
    g.globalAlpha = 0.11 * p;
    g.beginPath();
    poly.forEach(([x, y], i) => {
      const j = Math.sin(seed * 7 + i * 3.1 + k * 1.7) * 9, s = 0.55 + 0.45 * p;
      const X = cx + (x - cx) * s + j, Y = cy + (y - cy) * s + Math.cos(seed + i * 2.3 + k) * 9;
      i ? g.lineTo(X, Y) : g.moveTo(X, Y);
    });
    g.closePath(); g.fill();
  }
  g.restore();
};

const fibre = (g: CanvasRenderingContext2D, w: number, h: number, seed: number) => {
  g.fillStyle = K.parchment; g.fillRect(0, 0, w, h);
  g.save(); g.globalAlpha = 0.06; g.strokeStyle = K.ink;
  for (let i = 0; i < 900; i++) {
    const x = ((Math.sin(i * 12.9898 + seed) * 43758.5453) % 1 + 1) % 1 * w, y = ((Math.sin(i * 78.233 + seed) * 12543.13) % 1 + 1) % 1 * h;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18 * Math.cos(i), y + 6 * Math.sin(i)); g.stroke();
  }
  // حواف الرّق أغمق قليلًا من القدم
  const r = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  r.addColorStop(0, "rgba(0,0,0,0)"); r.addColorStop(1, "rgba(74,46,31,0.22)");
  g.globalAlpha = 1; g.fillStyle = r; g.fillRect(0, 0, w, h);
  g.restore();
};

const canvas = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")!] as const; };
const tex = (c: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };

/** صفحة الخريطة: الجنوب فوق. بحر فارس نصف دائرة، ودجلة والفرات خطان مستقيمان، والمدن دوائر */
const drawMap = (g: CanvasRenderingContext2D, w: number, h: number, t: number) => {
  fibre(g, w, h, 3);
  // الإطار: خطان بالحبر وبينهما خط مذهّب
  g.lineWidth = 6; g.strokeStyle = K.ink; g.strokeRect(70, 70, w - 140, h - 140);
  g.lineWidth = 14; g.strokeStyle = K.gold; g.strokeRect(96, 96, w - 192, h - 192);
  g.lineWidth = 3; g.strokeStyle = K.ink; g.strokeRect(118, 118, w - 236, h - 236);
  // العنوان المذهّب في خرطوشة
  g.fillStyle = K.dusk; g.fillRect(w / 2 - 380, 150, 760, 170);
  g.strokeStyle = K.gold; g.lineWidth = 8; g.strokeRect(w / 2 - 368, 162, 736, 146);
  g.fillStyle = K.goldLight; g.font = "bold 112px Amiri"; g.textAlign = "center"; g.direction = "rtl"; g.fillText("صورة العراق", w / 2, 272);
  // بحر فارس: نصف دائرة في الأعلى (الجنوب)
  const sea: [number, number][] = Array.from({ length: 33 }, (_, i) => [w / 2 + 520 * Math.cos(Math.PI * (i / 32)), 360 + 400 * Math.sin(Math.PI * (i / 32))]);
  wash(g, [...sea, [w / 2 - 520, 360]], K.sea, 1, 1);
  g.lineWidth = 7; g.strokeStyle = K.ink; partial(g, sea, 1);
  g.fillStyle = K.seaDeep; g.font = "bold 104px Amiri"; g.fillText("بحر فارس", w / 2, 580);
  // الفرات (يُرسم عند «بدأ») ودجلة (عند «دجلة»)، مستقيمان من الشمال (أسفل) إلى البحر
  const euph: [number, number][] = [[w / 2 - 420, h - 200], [w / 2 - 150, 760]];
  const tigris: [number, number][] = [[w / 2 + 380, h - 200], [w / 2 + 120, 760]];
  const pE = ease(span(t, wAt("بدأ") - 0.1, 1.2)), pT = ease(span(t, wAt("دجلة") - 0.5, 0.9));
  // الأرض بين النهرين تُغسل بالزنجار مع رسم النهرين
  wash(g, [[w / 2 - 400, h - 230], [w / 2 + 360, h - 230], [w / 2 + 130, 790], [w / 2 - 140, 790]], K.verdigris, ease(span(t, wAt("بدأ"), 2.6)), 4);
  g.lineCap = "round"; g.strokeStyle = K.ink; g.lineWidth = 14; partial(g, euph, pE); partial(g, tigris, pT);
  g.font = "bold 92px Amiri"; g.fillStyle = K.ink;
  if (pE > 0.6) { g.save(); g.globalAlpha = span(pE, 0.6, 0.4); g.translate(w / 2 - 360, 1400); g.rotate(-1.33); g.fillText("الفرات", 0, 0); g.restore(); }
  if (pT > 0.6) { g.save(); g.globalAlpha = span(pT, 0.6, 0.4); g.translate(w / 2 + 330, 1400); g.rotate(-1.805); g.fillText("دجلة", 0, 0); g.restore(); }
  // البصرة والكوفة موجودتان، وبغداد تُرسم عند «بغداد» دائرةً تُملأ بالزنجفر بإطار ذهبي
  const city = (x: number, y: number, name: string, p: number, main = false) => {
    if (p <= 0) return;
    g.save(); g.globalAlpha = Math.min(1, p * 1.5);
    if (main) { g.fillStyle = K.vermilion; g.beginPath(); g.arc(x, y, 58 * ease(p), 0, Math.PI * 2); g.fill(); g.strokeStyle = K.gold; g.lineWidth = 12; g.beginPath(); g.arc(x, y, 70, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); g.stroke(); }
    else { g.strokeStyle = K.ink; g.lineWidth = 8; g.beginPath(); g.arc(x, y, 34, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = main ? K.vermilion : K.ink; g.font = `bold ${main ? 118 : 80}px Amiri`; g.fillText(name, x + (main ? 0 : 0), y + (main ? 190 : 120));
    g.restore();
  };
  city(w / 2 - 40, 830, "البصرة", 1);
  city(w / 2 - 330, 1700, "الكوفة", 1);
  city(w / 2 + 290, 1600, "بغداد", ease(span(t, wAt("بغداد") - 0.1, 0.8)), true);
};

/** الصفحة اليسرى: متن مكتوب فعلًا ورأس مذهّب، فلا مساحة فارغة */
const drawText = (g: CanvasRenderingContext2D, w: number, h: number, t: number) => {
  fibre(g, w, h, 9);
  g.lineWidth = 6; g.strokeStyle = K.ink; g.strokeRect(70, 70, w - 140, h - 140);
  g.fillStyle = K.gold; g.fillRect(150, 150, w - 300, 26); g.fillStyle = K.vermilion; g.fillRect(150, 186, w - 300, 8);
  g.direction = "rtl"; g.textAlign = "right"; g.fillStyle = K.vermilion; g.font = "bold 96px Amiri"; g.fillText("ذكر مدينة السلام", w - 170, 330);
  g.fillStyle = K.ink; g.font = "68px Amiri";
  ["وكان المنصور قد خرج يرتاد موضعًا", "يبني فيه مدينته، فنزل على دجلة", "عند قرية تُعرف ببغداد، فاستطاب", "هواءها، وقال: هذا موضع معسكر", "صالح، وهذه دجلة ليس بيننا وبين", "الصين شيء، يأتينا فيها كل ما", "في البحر، وتأتينا الميرة من الجزيرة.", "", "فخطّها، وجعل لها أربعة أبواب."]
    .forEach((l, i) => g.fillText(l, w - 170, 470 + i * 112));
  g.fillStyle = K.ink; g.globalAlpha = 0.7; g.font = "56px 'Aref Ruqaa'"; g.fillText("— بتصرّف عن تاريخ الطبري", w - 170, 470 + 10 * 112); g.globalAlpha = 1;
  // حاشية برقعة حمراء في الهامش الأيسر بجوار «ببغداد»، تُكتب مع «بغداد… دجلة» ويشير إليها خط
  const pm = span(t, wAt("بغداد") - 0.1, 1.5);
  if (pm > 0) {
    g.save(); g.strokeStyle = K.vermilion; g.lineWidth = 5; partial(g, [[600, 700], [440, 760]], Math.min(1, pm * 3));
    g.translate(420, 820); g.rotate(-0.2); g.fillStyle = K.vermilion; g.textAlign = "right"; g.font = "104px 'Aref Ruqaa'";
    g.beginPath(); g.rect(-420, -110, 420 * Math.min(1, pm * 1.6), 380); g.clip();
    g.fillText("بُنيت", 0, 0); g.fillText("سنة ١٤٥", 0, 130); g.fillText("على دجلة", 0, 260);
    g.restore();
  }
};

/** وثيقة الأرشيف: سطور حقيقية، والسطر المنطوق يُكتب، والختم يُطبع عند «السلام» */
const drawDoc = (g: CanvasRenderingContext2D, w: number, h: number, t: number) => {
  fibre(g, w, h, 17);
  g.direction = "rtl"; g.textAlign = "right";
  g.fillStyle = K.ink; g.font = "bold 84px 'Aref Ruqaa'"; g.fillText("سِجلّ البناء", w - 110, 190);
  g.fillStyle = K.ink; g.font = "60px Amiri";
  ["أمر أمير المؤمنين أبو جعفر", "ببناء المدينة المدوّرة", "على الجانب الغربي من دجلة"].forEach((l, i) => g.fillText(l, w - 110, 330 + i * 92));
  // السطر المنطوق يُكتب مع «وسمّاها مدينة السلام»
  const p = span(t, wAt("وسمّاها") - 0.1, 1.2);
  if (p > 0) { g.save(); g.beginPath(); g.rect(w - 110 - 1000 * p, 560, 1000 * p, 140); g.clip(); g.fillStyle = K.ink; g.font = "bold 86px Amiri"; g.fillText("وسمّاها مدينة السلام", w - 110, 660); g.restore(); }
  // الختم: دائرتان ونص، أحمر بحواف غير منتظمة كطبعة حقيقية
  const s = span(t, wAt("السلام") + 0.15, 0.08);
  if (s > 0) {
    g.save(); g.translate(w * 0.36, h * 0.72); g.rotate(-0.18); g.globalAlpha = 0.88 * s; g.strokeStyle = K.vermilion; g.fillStyle = K.vermilion;
    g.lineWidth = 16; g.beginPath(); g.arc(0, 0, 230, 0, Math.PI * 2); g.stroke(); g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 186, 0, Math.PI * 2); g.stroke();
    g.textAlign = "center"; g.font = "bold 110px Amiri"; g.fillText("سنة", 0, -20); g.font = "bold 140px Amiri"; g.fillText("١٤٥", 0, 120);
    g.restore();
  }
};

/** الإسطرلاب: نحاس محفور، والنقش مطعّم بالفضة بتباين واضح؛ السنون الهجرية على الحافة */
const drawAstro = (g: CanvasRenderingContext2D, n: number, yearShown: number) => {
  const c = n / 2;
  const brass = g.createRadialGradient(c, c, 60, c, c, c);
  brass.addColorStop(0, K.goldLight); brass.addColorStop(0.7, K.gold); brass.addColorStop(1, K.brassDark);
  g.fillStyle = brass; g.beginPath(); g.arc(c, c, c - 4, 0, Math.PI * 2); g.fill();
  // الحفر داكن، والفضة تملؤه (خط فضي على خط داكن أعرض)
  const inlay = (draw: () => void, wDark: number, wSilver: number) => { g.strokeStyle = K.inkDark; g.lineWidth = wDark; draw(); g.strokeStyle = K.silver; g.lineWidth = wSilver; draw(); };
  inlay(() => { g.beginPath(); g.arc(c, c, c - 40, 0, Math.PI * 2); g.stroke(); }, 14, 7);
  inlay(() => { g.beginPath(); g.arc(c, c, c - 190, 0, Math.PI * 2); g.stroke(); }, 12, 6);
  for (let y = 100; y <= 200; y += 5) {
    const a = ((y - 100) / 100) * Math.PI * 1.6 - Math.PI * 0.8 - Math.PI / 2, long = y % 25 === 0;
    inlay(() => { g.beginPath(); g.moveTo(c + (c - 40) * Math.cos(a), c + (c - 40) * Math.sin(a)); g.lineTo(c + (c - (long ? 120 : 80)) * Math.cos(a), c + (c - (long ? 120 : 80)) * Math.sin(a)); g.stroke(); }, long ? 12 : 8, long ? 6 : 4);
    if (long) {
      g.save(); g.translate(c + (c - 158) * Math.cos(a), c + (c - 158) * Math.sin(a)); g.rotate(a + Math.PI / 2);
      g.fillStyle = K.inkDark; g.font = "bold 78px Amiri"; g.textAlign = "center"; g.fillText(y.toLocaleString("ar-EG"), 3, 30);
      g.fillStyle = K.silver; g.fillText(y.toLocaleString("ar-EG"), 0, 27); g.restore();
    }
  }
  // خطوط الأفق المطعّمة في الوسط
  for (let k = 1; k <= 4; k++) inlay(() => { g.beginPath(); g.ellipse(c, c + 40 * k, 90 * k, 60 * k, 0, Math.PI, Math.PI * 2); g.stroke(); }, 8, 4);
  // السنة تُطعَّم بالفضة حين يقف المؤشر عليها
  if (yearShown > 0) {
    g.save(); g.globalAlpha = yearShown; g.textAlign = "center"; g.font = "bold 104px Amiri";
    // بين الحلقة (نصف قطرها ١٢٨) وأرقام الحافة السفلى (١٠٠ و٢٠٠ عند ±٢٠٨، +٢٨٦)
    g.fillStyle = K.inkDark; g.fillText("١٤٥ هـ", c + 3, c + 248); g.fillStyle = K.silver; g.fillText("١٤٥ هـ", c, c + 245); g.restore();
  }
};

/** خامات CC0 من القرص: الرندر ينتظرها (delayRender) فلا يخرج إطار بلا مكتب */
const cache = new Map<string, THREE.Texture>();
const useAssetTextures = (ids: string[], color: string[]) => {
  const ready = ids.every((i) => cache.has(i));
  // delayRender أثناء الرسم نفسه (لا في useEffect)، فلا يُلتقط إطار قبل وصول الخامات
  const [handle] = React.useState(() => (ready ? null : delayRender(`خامات ${ids.join("، ")}`)));
  const [list, setList] = React.useState<THREE.Texture[] | null>(() => (ready ? ids.map((i) => cache.get(i)!) : null));
  React.useEffect(() => {
    if (list) return;
    Promise.all(ids.map((id) => cache.get(id) ?? new THREE.TextureLoader().loadAsync(staticFile(assetFile(id))).then((t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      if (color.includes(id)) t.colorSpace = THREE.SRGBColorSpace;
      cache.set(id, t); return t;
    }))).then((ts) => { setList(ts); if (handle !== null) continueRender(handle); });
  }, [list]); // eslint-disable-line react-hooks/exhaustive-deps
  return list;
};

const useCanvasTex = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, deps: unknown[]) =>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => { const [c, g] = canvas(w, h); draw(g); return tex(c); }, deps);

const Desk: React.FC<{ ts: THREE.Texture[] }> = ({ ts }) => {
  const [diff, nor, rough] = ts.map((x) => { const c = x.clone(); c.repeat.set(4, 2.6); c.needsUpdate = true; return c; });
  return <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[14, 9]} /><meshStandardMaterial map={diff} normalMap={nor} roughnessMap={rough} color="#c9b49a" /></mesh>;
};

/** كتاب مغلق بجلد حقيقي، وعلى غلافه جامة مزخرفة بارزة (bumpMap) ومذهّبة */
const LeatherBook: React.FC<{ ts: THREE.Texture[] }> = ({ ts }) => {
  const emboss = useCanvasTex(512, 640, (g) => {
    g.fillStyle = "#000"; g.fillRect(0, 0, 512, 640);
    g.strokeStyle = "#fff"; g.lineWidth = 10; g.strokeRect(36, 36, 440, 568);
    g.save(); g.translate(256, 320);
    for (let k = 0; k < 16; k++) { g.rotate(Math.PI / 8); g.beginPath(); g.moveTo(0, 30); g.quadraticCurveTo(40, 90, 0, 140); g.quadraticCurveTo(-40, 90, 0, 30); g.stroke(); }
    g.beginPath(); g.arc(0, 0, 150, 0, Math.PI * 2); g.stroke(); g.restore();
  }, []);
  const [diff, nor] = ts;
  const cover = <meshStandardMaterial map={diff} normalMap={nor} bumpMap={emboss} bumpScale={4} color="#B4583A" roughness={0.6} />;
  return (
    <group position={[2.35, 0, -1.35]} rotation={[0, -0.35, 0]}>
      <mesh position={[0, 0.13, 0]} castShadow receiveShadow><boxGeometry args={[1.25, 0.26, 1.65]} /><meshStandardMaterial color={K.parchmentDeep} roughness={0.9} /></mesh>
      <mesh position={[0, 0.27, 0]} castShadow>{<boxGeometry args={[1.3, 0.03, 1.7]} />}{cover}</mesh>
      <mesh position={[0, -0.0, 0]}><boxGeometry args={[1.3, 0.03, 1.7]} />{cover}</mesh>
      <mesh position={[-0.66, 0.13, 0]}><boxGeometry args={[0.04, 0.3, 1.7]} />{cover}</mesh>
      {/* الجامة المذهّبة */}
      <mesh position={[0, 0.288, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.3, 48]} /><meshStandardMaterial color={K.gold} metalness={0.7} roughness={0.35} bumpMap={emboss} bumpScale={3} transparent opacity={0.85} /></mesh>
    </group>
  );
};

/** محبرة خزف مزجّج، وقلم قصب مسند إليها */
const Inkwell: React.FC = () => (
  <group position={[-2.55, 0, -1.2]}>
    <mesh position={[0, 0.17, 0]} castShadow><cylinderGeometry args={[0.2, 0.27, 0.34, 48]} /><meshPhysicalMaterial color={K.dusk} roughness={0.15} clearcoat={1} clearcoatRoughness={0.08} /></mesh>
    <mesh position={[0, 0.35, 0]}><torusGeometry args={[0.12, 0.035, 16, 48]} /><meshPhysicalMaterial color={K.dusk} roughness={0.15} clearcoat={1} /></mesh>
    <mesh position={[0, 0.345, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.1, 32]} /><meshStandardMaterial color={K.inkDark} roughness={0.05} /></mesh>
    <mesh position={[0.25, 0.45, 0.12]} rotation={[0.25, 0, -0.55]} castShadow><cylinderGeometry args={[0.02, 0.012, 1.05, 12]} /><meshStandardMaterial color={K.gold} roughness={0.7} /></mesh>
  </group>
);

/** إطار النافذة: لا تراه الكاميرا، ويلقي ظل أعمدته على المكتب */
const WindowGobo: React.FC = () => {
  // إطار نافذة بصليب واحد، بعيد عن المكتب فيقع ظله واسعًا على الحافة لا على الدفتر
  const bars: [number, number, number, number][] = [[0, 2.3, 5, 0.6], [0, -2.3, 5, 0.6], [2.4, 0, 0.6, 5], [-2.4, 0, 0.6, 5]];
  return (
    <group position={[-4.6, 4.8, -3.4]} rotation={[0, 0.9, 0.35]} scale={1.6}>
      {bars.map(([x, y, w, h], i) => <mesh key={i} position={[x, y, 0]} castShadow><boxGeometry args={[w, h, 0.05]} /><meshBasicMaterial colorWrite={false} depthWrite={false} /></mesh>)}
    </group>
  );
};

const LIGHTS: Light[] = [
  { kind: "ambient", kelvin: 7500, intensity: 0.75, position: [0, 0, 0] },
  // ضوء النافذة الواحد: دافئ مائل من الخلف اليسار
  { kind: "key", kelvin: 4100, intensity: 3.1, position: [-7, 8, -5] },
];

const WIDE: Cam = { target: [0, 0, -0.1], yaw: -8, pitch: 52, dist: 7.6, fov: 34 };
const ASTRO_AT: [number, number, number] = [0.95, 0.06, -1.35];
const ATLAS_AT: [number, number, number] = [-0.65, 0, 0.25];
const DOC_AT: [number, number, number] = [2.05, 0, 0.55];

export const DeskWorldLab: React.FC = () => {
  const ready = useBrandFonts();
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const t = frame / fps;
  // الخامات تُحمّل هنا خارج لوحة Three، فينتظرها Remotion قبل التقاط الإطار (داخلها يُركَّب متأخرًا)
  const wood = useAssetTextures(["dafatir-walnut-diff", "dafatir-walnut-nor", "dafatir-walnut-rough"], ["dafatir-walnut-diff"]);
  const leather = useAssetTextures(["dafatir-leather-diff", "dafatir-leather-nor"], ["dafatir-leather-diff"]);
  const mapTex = useCanvasTex(1536, 2048, (g) => drawMap(g, 1536, 2048, t), [ready, frame]);
  const textTex = useCanvasTex(1536, 2048, (g) => drawText(g, 1536, 2048, t), [ready, frame]);
  const docTex = useCanvasTex(1200, 1560, (g) => drawDoc(g, 1200, 1560, t), [ready, frame]);
  const yearShown = span(t, wAt("للهجرة") + 0.15, 0.35);
  const astroTex = useCanvasTex(1024, 1024, (g) => drawAstro(g, 1024, yearShown), [ready, Math.round(yearShown * 20)]);
  // الشبكة (العنكبوت) تدور حتى يقف المؤشر على ١٤٥ مع «للهجرة»
  const year = 100 + 45 * ease(span(t, wAt("سنة"), wAt("للهجرة") + 0.3 - wAt("سنة")));
  const pointer = ((year - 100) / 100) * Math.PI * 1.6 - Math.PI * 0.8;
  // الختم الخشبي ينزل عند «السلام» ويرتفع
  const sd = span(t, wAt("السلام") - 0.05, 0.2), su = span(t, wAt("السلام") + 0.35, 0.4);
  const stampY = 0.9 - 0.82 * ease(sd) * (1 - ease(su));
  const cam = camAt(t, { target: ASTRO_AT, yaw: 10, pitch: 64, dist: 2.3, fov: 32 }, [
    // الإسطرلاب ٢٫٧ ث للتاريخ، ثم الدفتر، ثم الوثيقة والختم، ثم المكتب كله
    { a: wAt("بدأ") - 0.35, b: wAt("جعفر"), to: { target: [ATLAS_AT[0] + 0.55, 0, ATLAS_AT[2] - 0.1], yaw: -4, pitch: 70, dist: 3.0, fov: 32 } },
    { a: wAt("بغداد") - 0.2, b: wAt("دجلة") + 0.2, to: { target: [ATLAS_AT[0] + 0.85, 0, ATLAS_AT[2] - 0.05], yaw: 6, pitch: 74, dist: 2.55, fov: 32 } },
    { a: wAt("وسمّاها") - 0.35, b: wAt("مدينة"), to: { target: [DOC_AT[0], 0, DOC_AT[2]], yaw: 4, pitch: 70, dist: 2.3, fov: 32 } },
    { a: wAt("السلام") + 0.9, b: wAt("السلام") + 2.3, to: WIDE },
  ], { shake: { amp: 0.004, rate: 0.5, seed: 31 } });
  // لا تُركَّب لوحة Three قبل الخامات: هي تنتظر أول رسم لها بنفسها، فيخرج كل إطار بمكتبه
  if (!wood || !leather) return null;
  return (
    <Stage3D width={width} height={height} cam={cam} lights={lightsAt(t, LIGHTS)} background={K.dusk}>
      <Desk ts={wood} />
      <LeatherBook ts={leather} />
      <WindowGobo />
      {/* جدار الغرفة خلف المكتب: غسق داكن، فلا فراغ خلف الحافة */}
      <mesh position={[0, 3, -4.4]} receiveShadow><planeGeometry args={[24, 10]} /><meshStandardMaterial color={K.dusk} roughness={1} /></mesh>
      <Inkwell />
      {/* الدفتر المفتوح: صفحتان منحنيتان قليلًا عند الكعب */}
      <group position={ATLAS_AT}>
        <mesh position={[0, 0.02, 0]} receiveShadow castShadow><boxGeometry args={[2.62, 0.04, 1.86]} /><meshStandardMaterial color={K.brassDark} roughness={0.7} /></mesh>
        <mesh position={[0.64, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[1.26, 1.68]} /><meshStandardMaterial map={mapTex} roughness={0.92} /></mesh>
        <mesh position={[-0.64, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[1.26, 1.68]} /><meshStandardMaterial map={textTex} roughness={0.92} /></mesh>
        <mesh position={[0, 0.05, 0]}><boxGeometry args={[0.03, 0.02, 1.7]} /><meshStandardMaterial color={K.inkDark} /></mesh>
      </group>
      {/* الوثيقة على المكتب، والختم الخشبي فوقها */}
      <group position={DOC_AT} rotation={[0, -0.12, 0]}>
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow><planeGeometry args={[1.15, 1.5]} /><meshStandardMaterial map={docTex} roughness={0.95} /></mesh>
        <group position={[-0.2, stampY, 0.3]}>
          <mesh castShadow><cylinderGeometry args={[0.24, 0.24, 0.12, 40]} /><meshStandardMaterial color={K.inkDark} roughness={0.6} /></mesh>
          <mesh position={[0, 0.2, 0]} castShadow><cylinderGeometry args={[0.06, 0.09, 0.32, 24]} /><meshStandardMaterial color={K.brassDark} roughness={0.5} /></mesh>
          <mesh position={[0, 0.4, 0]} castShadow><sphereGeometry args={[0.1, 24, 16]} /><meshStandardMaterial color={K.brassDark} roughness={0.5} /></mesh>
        </group>
      </group>
      {/* الإسطرلاب على المكتب: الأم والصفيحة، والعنكبوت والمؤشر يدوران */}
      <group position={ASTRO_AT}>
        <mesh position={[0, 0.03, 0]} castShadow receiveShadow><cylinderGeometry args={[0.62, 0.62, 0.06, 96]} /><meshStandardMaterial color={K.brassDark} metalness={0.8} roughness={0.35} /></mesh>
        <mesh position={[0, 0.062, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.6, 96]} /><meshStandardMaterial map={astroTex} metalness={0.55} roughness={0.38} /></mesh>
        <group position={[0, 0.075, 0]} rotation={[0, -pointer, 0]}>
          <mesh position={[0, 0, -0.27]} castShadow><boxGeometry args={[0.035, 0.012, 0.56]} /><meshStandardMaterial color={K.silver} metalness={0.9} roughness={0.2} /></mesh>
          <mesh castShadow rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[0.15, 0.012, 12, 64]} /><meshStandardMaterial color={K.gold} metalness={0.85} roughness={0.3} /></mesh>
        </group>
        <mesh position={[0, 0.09, 0]}><cylinderGeometry args={[0.04, 0.04, 0.04, 24]} /><meshStandardMaterial color={K.gold} metalness={0.9} roughness={0.25} /></mesh>
      </group>
    </Stage3D>
  );
};
