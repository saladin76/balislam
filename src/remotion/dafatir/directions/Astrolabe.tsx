/**
 * اتجاه «نقش وزمن» (مراجع المنسّق ٢١ نوفمبر، دفاتر الزمن ٣): إسطرلاب نحاسي بثري دي.
 * المرجع: نقوش الإسطرلاب العربي، وتطعيم المعادن المملوكية بالفضة. المشهد يُحفر خطًا خطًا على الصفيحة،
 * والحلقة المدرّجة بالسنين الهجرية تدور حتى تقف السنة تحت المؤشر، والعنكبوت (الشبكة) يدور فوقها،
 * واسم المدينة يُحفر ثم يُطعَّم بالفضة. لا تصوير للأنبياء: الأدوات والأماكن تحمل القصة.
 * كادرات للمقارنة لا قالب (لا قالب قبل اختيار المالك).
 */
import React, { useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useBrandFonts } from "../../useBrandFonts";
import { C, Tag, prog, easeIO, easeOut } from "../horizon/kit";
import { at, buildTimeline, end, type Timeline } from "../horizon/timeline";
import { RedrawWhenReady, useCanvasFont } from "../archive/ArchiveLab";

export const ASTRO_FPS = 30;
export const ASTRO_SENTENCES = ["سنة مئة وخمس وأربعين للهجرة، | بنى المنصور بغداد."];
export const astroTimeline = (): Timeline => buildTimeline(ASTRO_SENTENCES, 0.7);
export const astroFrames = () => Math.ceil((astroTimeline().end + 1.8) * ASTRO_FPS);

/** نحاس وفضة وأسود عميق، من لوحة الهوية المعتمدة ودرجاتها */
export const ASTRO_COLORS = { brass: C.gold, engrave: "#2B1E14", silver: "#BFB3C9", night: "#120C18", deep: "#1A1424" };
const A = ASTRO_COLORS;

const N = 1400;
/** السنة الهجرية تحت المؤشر: الحلقة تدور من ١٠٠ إلى ١٤٥ مع «مئة وخمس وأربعين» */
export const yearAt = (t: number, tl: Timeline) => 100 + 45 * prog(t, at(tl, "مئة") - 0.1, end(tl, "وأربعين"), easeIO);
const toArabic = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);

/** صفيحة الإسطرلاب: المقنطرات وخطوط الساعات تُحفر خطًا خطًا (خط داكن وحافة مضيئة كالحفر الحقيقي) */
const drawPlate = (ctx: CanvasRenderingContext2D, t: number, tl: Timeline, ready: boolean) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = A.brass;
  ctx.fillRect(0, 0, N, N);
  const c = N / 2;
  const carve = (draw: () => void, p: number, w: number) => {
    if (p <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, N, N * p);
    ctx.clip();
    ctx.lineWidth = w;
    ctx.strokeStyle = A.engrave;
    ctx.globalAlpha = 0.85;
    draw();
    ctx.translate(1.5, 1.5);
    ctx.strokeStyle = "#F8EEDB";
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = w * 0.5;
    draw();
    ctx.restore();
  };
  const engraveP = prog(t, 0.2, at(tl, "للهجرة"), easeOut);
  carve(() => {
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.ellipse(c, c + 40 + i * 22, 120 + i * 62, 90 + i * 55, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }, engraveP, 3);
  carve(() => {
    for (let i = 0; i < 12; i++) {
      const a = Math.PI * 0.08 + (i / 11) * Math.PI * 0.84;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.lineTo(c + Math.cos(a) * 640, c + Math.sin(a) * 640);
      ctx.stroke();
    }
  }, prog(t, at(tl, "وخمس"), at(tl, "بنى"), easeOut), 2);
  if (!ready) return;
  // اسم المدينة: يُحفر ثم يُطعَّم بالفضة
  const s = at(tl, "بغداد");
  const e = end(tl, "بغداد");
  const cut = prog(t, s, e);
  const fill = prog(t, e, e + 0.8, easeOut);
  if (cut > 0) {
    ctx.save();
    ctx.font = "700 150px Amiri";
    ctx.textAlign = "center";
    ctx.direction = "rtl";
    const w = ctx.measureText("بغداد").width;
    ctx.beginPath();
    ctx.rect(c + w / 2 - w * cut - 10, c - 220, w * cut + 20, 300);
    ctx.clip();
    ctx.lineWidth = 6;
    ctx.strokeStyle = A.engrave;
    ctx.strokeText("بغداد", c, c - 40);
    ctx.fillStyle = A.engrave;
    ctx.globalAlpha = 0.55 * (1 - fill);
    ctx.fillText("بغداد", c, c - 40);
    ctx.globalAlpha = fill;
    ctx.fillStyle = A.silver;
    ctx.fillText("بغداد", c, c - 40);
    ctx.restore();
  }
};

/** الحلقة المدرّجة (الحجرة): أقسام وأرقام السنين الهجرية محفورة */
const drawLimb = (ctx: CanvasRenderingContext2D, ready: boolean) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, N, N);
  const c = N / 2;
  ctx.fillStyle = A.brass;
  ctx.beginPath();
  ctx.arc(c, c, 700, 0, Math.PI * 2);
  ctx.arc(c, c, 590, 0, Math.PI * 2, true);
  ctx.fill();
  ctx.strokeStyle = A.engrave;
  for (let y = 0; y < 360; y++) {
    const a = (y / 360) * Math.PI * 2 - Math.PI / 2;
    const len = y % 10 === 0 ? 44 : y % 5 === 0 ? 30 : 16;
    ctx.lineWidth = y % 10 === 0 ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a) * 690, c + Math.sin(a) * 690);
    ctx.lineTo(c + Math.cos(a) * (690 - len), c + Math.sin(a) * (690 - len));
    ctx.stroke();
  }
  if (!ready) return;
  ctx.fillStyle = A.engrave;
  ctx.font = "700 38px Amiri";
  ctx.textAlign = "center";
  // كل درجة سنة: الأرقام كل عشر سنين
  for (let y = 0; y < 360; y += 10) {
    const a = (y / 360) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.translate(c + Math.cos(a) * 620, c + Math.sin(a) * 620);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(toArabic(y), 0, 12);
    ctx.restore();
  }
};

const useCanvasTex = (draw: (ctx: CanvasRenderingContext2D) => void, key: string, transparent = false) => {
  const ref = useRef<{ cv: HTMLCanvasElement; tex: THREE.CanvasTexture; key: string } | null>(null);
  if (!ref.current) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = N;
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    ref.current = { cv, tex, key: "" };
  }
  if (ref.current.key !== key) {
    draw(ref.current.cv.getContext("2d")!);
    ref.current.tex.needsUpdate = true;
    ref.current.key = key;
  }
  void transparent;
  return ref.current.tex;
};

const Rig: React.FC<{ az: number; el: number; d: number; ty: number }> = ({ az, el, d, ty }) => {
  const { camera } = useThree();
  camera.position.set(Math.sin(az) * Math.cos(el) * d, ty + Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d);
  camera.lookAt(0, ty, 0);
  camera.updateMatrixWorld();
  return null;
};

export const AstrolabeLab: React.FC = () => {
  const ready = useCanvasFont(useBrandFonts(), ["700 150px Amiri", "700 38px Amiri"]);
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const tl = astroTimeline();
  const plate = useCanvasTex((ctx) => drawPlate(ctx, t, tl, ready), `${ready}:${frame}`);
  const limb = useCanvasTex((ctx) => drawLimb(ctx, ready), `${ready}`, true);
  const year = yearAt(t, tl);
  // الكاميرا: تبدأ مائلة بعيدة، تقترب من الحلقة عند السنة، ثم تنزل إلى اسم المدينة على الصفيحة
  const p1 = prog(t, 0, at(tl, "وأربعين"), easeIO);
  const p2 = prog(t, at(tl, "بنى") - 0.3, end(tl, "بغداد") + 0.4, easeIO);
  const az = -0.55 + 0.4 * p1 + 0.12 * p2 + 0.03 * t;
  const el = 0.12 - 0.05 * p2;
  const d = 4.8 - 1.5 * p1 - 0.9 * p2;
  const ty = 0.1 + 0.4 * p1 * (1 - p2) + 0.05 * p2;
  const metal = useMemo(() => ({ metalness: 0.55, roughness: 0.42 }), []);
  return (
    <AbsoluteFill style={{ background: A.night }}>
      <ThreeCanvas width={width} height={height} shadows camera={{ fov: 30, near: 0.05, far: 40 }} gl={{ antialias: true }}>
        <Rig az={az} el={el} d={d} ty={ty} />
        <RedrawWhenReady ready={ready} />
        <color attach="background" args={[A.night]} />
        <hemisphereLight args={["#F8EEDB", A.deep, 1.1]} />
        <directionalLight position={[-2.2, 2.8, 3.2]} intensity={2.4} color="#F8EEDB" castShadow />
        <group rotation={[0, 0, 0]}>
          {/* الأم: قرص نحاسي سميك */}
          <mesh position={[0, 0, -0.04]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[1.02, 1.02, 0.07, 96]} />
            <meshStandardMaterial color={A.brass} {...metal} />
          </mesh>
          {/* الصفيحة المحفورة */}
          <mesh position={[0, 0, 0.0]}>
            <circleGeometry args={[0.84, 96]} />
            <meshStandardMaterial map={plate} {...metal} side={THREE.DoubleSide} />
          </mesh>
          {/* الحجرة: الحلقة المدرّجة بالسنين، تدور حتى تقف السنة تحت المؤشر */}
          <mesh position={[0, 0, 0.012]} rotation={[0, 0, (year / 360) * Math.PI * 2]}>
            <ringGeometry args={[0.84, 1.0, 128]} />
            <meshStandardMaterial map={limb} transparent {...metal} side={THREE.DoubleSide} />
          </mesh>
          {/* العنكبوت: حلقة وأذرع مفرّغة تدور ببطء فوق الصفيحة */}
          <group position={[0, 0, 0.03]} rotation={[0, 0, -0.25 * t]}>
            <mesh castShadow>
              <torusGeometry args={[0.6, 0.012, 12, 96]} />
              <meshStandardMaterial color={A.brass} {...metal} />
            </mesh>
            {[0, 1, 2, 3, 4].map((i) => (
              <mesh key={i} rotation={[0, 0, (i / 5) * Math.PI * 2]} position={[Math.cos((i / 5) * Math.PI * 2) * 0.33, Math.sin((i / 5) * Math.PI * 2) * 0.33, 0]} castShadow>
                <boxGeometry args={[0.56, 0.014, 0.012]} />
                <meshStandardMaterial color={A.brass} {...metal} />
              </mesh>
            ))}
          </group>
          {/* المؤشر في الأعلى، والكرسي والحلقة */}
          <mesh position={[0, 0.93, 0.05]}>
            <boxGeometry args={[0.03, 0.2, 0.02]} />
            <meshStandardMaterial color={A.engrave} roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.12, -0.04]} castShadow>
            <boxGeometry args={[0.32, 0.16, 0.07]} />
            <meshStandardMaterial color={A.brass} {...metal} />
          </mesh>
          <mesh position={[0, 1.3, -0.04]} castShadow>
            <torusGeometry args={[0.08, 0.018, 12, 48]} />
            <meshStandardMaterial color={A.brass} {...metal} />
          </mesh>
        </group>
      </ThreeCanvas>
      <Tag corner="tr" text="اتجاه للمقارنة · نقش وزمن · لا يُنشر" />
    </AbsoluteFill>
  );
};
