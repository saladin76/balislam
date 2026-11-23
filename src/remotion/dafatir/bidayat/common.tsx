/**
 * «دفاتر الزمن» — سلسلة «البدايات»: ثلاثة اتجاهات لعالمها الخاص بثري دي (قرار المالك ٢٣ نوفمبر، D203).
 * المرجع الملزم: «عمود السلاسل» (المرجع الملزم، D202) (سادسًا: «الأرض البكر: طين وماء وسماء وحجر، ضوء فجر، ومجسمات أرض
 * تتشكل؛ صامتة اللون قليلة العناصر»). نماذج صامتة لا تُنشر ولا تُستعمل في حلقة، على عدّة الثري دي المشتركة (D166) وبمعايير
 * «الحِرفة» (D189). المشترك بين الثلاثة كما في المرجع (ثالثًا ورابعًا): خيط الزمن الأحمر بعقدته، وختم «درجة الثبوت».
 * التوقير (خامسًا/٤): لا تصوير لنبي ولا ملَك ولا صحابي بأي شكل (لا وجه ولا ظل ولا هيئة)؛ القصة بالأماكن والأشياء.
 * والجملة الثالثة ذكر لله: يسكن عندها كل شيء (السكون المقصود)، ولا يُضاف شيء قبلها أو بعدها لتعويضها.
 */
import React from "react";
import { AbsoluteFill, staticFile } from "remotion";
import * as THREE from "three";
import { CAPTION_SHADOW, CAPTION_SHADOW_LIGHT, ease, noise1, type Window } from "../../three";
import { useBrandFonts } from "../../useBrandFonts";
import { useCanvasFont } from "../archive/ArchiveLab";

/** خط أميري للختم والترجمة قبل تصوير أي إطار */
export const useBidFont = () => useCanvasFont(useBrandFonts());

export const BID_FPS = 30;
/** نص النموذج من سكريبت 001 نفسه (c1-s39، وc1-s46، وc1-s13): جملتان ثم جملة ذكر لله */
export const BID_SENTENCES = [
  "ومن هنا تتصل قصة آدم عليه السلام بتاريخ البشرية على الأرض.",
  "ثم نمضي معًا إلى حياة المجتمعات البشرية القديمة، ونشأة القرى والمدن.",
  "خلق اللهُ آدمَ من طين.",
];
export const BID_WORDS: { w: string; s: number; e: number; si: number }[] = (() => {
  const out: { w: string; s: number; e: number; si: number }[] = [];
  // إيقاع راوٍ هادئ: نصف ثانية للكلمة، ووقفة أطول قبل جملة الذكر
  let t = 0.9;
  BID_SENTENCES.forEach((sentence, si) => {
    for (const w of sentence.split(" ")) { out.push({ w, s: t, e: t + 0.42, si }); t += 0.5; }
    t += si === 1 ? 1.3 : 0.6;
  });
  return out;
})();
const bare = (w: string) => w.replace(/[،.:]/g, "").replace(/[ً-ْ]/g, "");
export const wordAt = (w: string) => {
  const x = BID_WORDS.find((y) => bare(y.w) === bare(w));
  if (!x) throw Error(`كلمة ليست في النموذج: ${w}`);
  return x.s;
};
/** الجملة الثالثة كلها (ذكر الله) سكون مقصود، من قبلها بربع ثانية إلى ما بعدها */
export const BID_STILL: Window[] = (() => {
  const s3 = BID_WORDS.filter((w) => w.si === 2);
  return [[s3[0]!.s - 0.25, s3[s3.length - 1]!.e + 0.25]];
})();
export const BID_SEC = Math.ceil(BID_WORDS[BID_WORDS.length - 1]!.e + 2.2);
export const bidFrames = () => BID_SEC * BID_FPS;

/** ألوان «دفتر الأفق» المعتمدة وحدها (brand/identity/approved.ts)؛ اللازورد للماء والخرائط فقط */
export const K = {
  dusk: "#2A1E3F", sun: "#E07A3F", parchment: "#F1E4CB", ink: "#4A2E1F", ribbon: "#D7372B", sand: "#C8A15A", light: "#F3C98B",
  clay: "#B4583A", soil: "#2B1E14", earth: "#5A4632", pale: "#EADBC0", paper: "#F4E9D4", haze: "#BFB3C9", mist: "#A399B4",
  olive: "#7A7F4E", water: "#26619C", deep: "#120C18", night: "#1A1424",
} as const;

/** ضوضاء ثنائية البعد حتمية (التواء المجال): لا خطوط متوازية كضوضاء البعد الواحد على مزيج خطي */
export const n2 = (s: number, x: number, z: number) => 0.5 * noise1(s, x + 1.7 * noise1(s + 101, z * 0.8)) + 0.5 * noise1(s + 7, z + 1.9 * noise1(s + 103, x * 0.7));
/** خامة نتوء حبيبية (bumpMap) بذرتها ثابتة: أثر الزمن على السطح */
export const useWearBump = (seed: number, repeat: [number, number] = [2, 2], streaks = false) => React.useMemo(() => {
  const S = 512, c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d")!, img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const v = 128 + 70 * n2(seed, x / 23, (streaks ? y / 90 : y / 23)) + 30 * n2(seed + 9, x / 5, y / 5);
    const i = (y * S + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, v)); img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); return t;
}, [seed, repeat[0], repeat[1], streaks]); // eslint-disable-line react-hooks/exhaustive-deps
export const span = (t: number, a: number, d: number) => Math.min(1, Math.max(0, (t - a) / d));
export const SFX = (f: string) => staticFile(`three/sfx/${f}.mp3`);

/** لقطة: حجمها وزمنها وكاميرتها من وإلى وفتحة العدسة؛ الأخيرة تبدأ قبل جملة الذكر ولا تتحرك فيها */
export type V3 = [number, number, number];
export type ShotCam = { target: V3; yaw: number; pitch: number; dist: number; fov: number };
export type BidShot = { id: string; size: "wide" | "medium" | "close" | "detail"; a: number; b: number; from: ShotCam; to: ShotCam; aperture: number };
/** حدود اللقطات الأربع على الكلام: الأولى حتى «بتاريخ»، والثانية حتى «ثم»، والثالثة حتى قبيل جملة الذكر */
export const shotBounds = () => {
  const s3 = BID_STILL[0]![0] - 0.05;
  return { s1: wordAt("بتاريخ") - 0.1, s2: wordAt("ثم") - 0.15, s3 };
};
export const camOf = (s: BidShot, t: number) => {
  // اللقطة الأخيرة: الكاميرا ساكنة في نافذة الذكر، وتتحرك بعدها فقط
  const [a, b] = s.b > BID_STILL[0]![1] && s.a <= BID_STILL[0]![0] ? [BID_STILL[0]![1] + 0.1, s.b] : [s.a, s.b];
  const p = ease(span(t, a, b - a));
  const L = (x: number, y: number) => x + (y - x) * p;
  return {
    target: [L(s.from.target[0], s.to.target[0]), L(s.from.target[1], s.to.target[1]), L(s.from.target[2], s.to.target[2])] as V3,
    yaw: L(s.from.yaw, s.to.yaw), pitch: L(s.from.pitch, s.to.pitch), dist: L(s.from.dist, s.to.dist), fov: L(s.from.fov, s.to.fov),
  };
};

/** خيط الزمن الأحمر (المرجع، ثالثًا/١): خيط حقيقي بسُمك يُمدّ على مسار حتى p، وعقدة تُعقد في سنة الحلقة */
export const RedThread: React.FC<{ points: V3[]; p: number; knotAt?: number; knot: number; radius?: number }> = ({ points, p, knotAt = 0.62, knot, radius = 0.018 }) => {
  const curve = React.useMemo(() => new THREE.CatmullRomCurve3(points.map((q) => new THREE.Vector3(...q))), [points]);
  const geo = React.useMemo(() => {
    if (p <= 0.001) return null;
    const pts = curve.getPoints(160).slice(0, Math.max(2, Math.round(160 * p) + 1));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(4, pts.length * 2), radius, 8, false);
  }, [curve, p, radius]);
  const kp = curve.getPoint(knotAt);
  return (
    <group>
      {geo && <mesh geometry={geo} castShadow><meshStandardMaterial color={K.ribbon} roughness={0.85} /></mesh>}
      {/* العقدة: حلقتان متعامدتان تنعقدان (تكبر من الصفر) لا كرة لامعة */}
      {knot > 0 && p >= knotAt && (
        <group position={kp} scale={knot}>
          <mesh rotation={[Math.PI / 2, 0, 0]} castShadow><torusGeometry args={[radius * 3.2, radius * 1.1, 8, 24]} /><meshStandardMaterial color={K.ribbon} roughness={0.85} /></mesh>
          <mesh rotation={[0, Math.PI / 2, 0.5]} castShadow><torusGeometry args={[radius * 2.6, radius * 1.1, 8, 24]} /><meshStandardMaterial color={K.ribbon} roughness={0.85} /></mesh>
        </group>
      )}
    </group>
  );
};

/** نص الختم على وجه دائري (كانفاس): الكلمة في حلقتين، بحبر واحد كالختم الحقيقي */
export const useStampFace = (word: "ثابت" | "رواية" | "تقدير" | "لا نعلم", ink: string, ready: boolean, ground = "rgba(0,0,0,0)") =>
  React.useMemo(() => {
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const g = c.getContext("2d")!;
    g.fillStyle = ground; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = ink; g.fillStyle = ink;
    g.lineWidth = 22; g.beginPath(); g.arc(256, 256, 226, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 7; g.beginPath(); g.arc(256, 256, 186, 0, Math.PI * 2); g.stroke();
    g.font = "700 132px Amiri"; g.textAlign = "center"; g.textBaseline = "middle"; g.direction = "rtl";
    g.fillText(word, 256, 268);
    // أثر الختم: حواف غير تامة (بذرة ثابتة)
    g.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 260; i++) { const a = (i * 137.5 * Math.PI) / 180, r = 150 + ((i * 53) % 90); g.globalAlpha = 0.08 + ((i * 31) % 10) / 60; g.beginPath(); g.arc(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 3 + (i % 5), 0, Math.PI * 2); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [word, ink, ground, ready]);

/**
 * ختم «درجة الثبوت» (المرجع، رابعًا): ختم خشبي يهبط على السطح عند p (٠–١) ويرتفع، ويبقى أثره.
 * press: ٠ فوق، ١ على السطح؛ mark: ظهور الأثر بعد الضغط.
 */
export const ProofStamp: React.FC<{ word: "ثابت" | "رواية" | "تقدير" | "لا نعلم"; at: V3; press: number; lift: number; ready: boolean; size?: number; ink?: string; tilt?: number }> =
  ({ word, at, press, lift, ready, size = 0.32, ink = K.ribbon, tilt = 0 }) => {
    const seal = useStampFace(word, ink, ready);
    const down = Math.sin(Math.min(1, press) * Math.PI / 2);
    const y = (1 - down) * 1.2 + lift * 1.6;
    return (
      <group position={at} rotation={[0, tilt, 0]}>
        {/* الأثر على السطح */}
        {press >= 1 && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
            <planeGeometry args={[size * 2, size * 2]} /><meshStandardMaterial map={seal} transparent roughness={1} depthWrite={false} />
          </mesh>
        )}
        {/* الختم نفسه: قرص خشب ومقبض */}
        {lift < 1 && press > 0 && (
          <group position={[0, y, 0]}>
            <mesh position={[0, size * 0.18, 0]} castShadow><cylinderGeometry args={[size, size, size * 0.36, 40]} /><meshStandardMaterial color={K.earth} roughness={0.75} /></mesh>
            <mesh position={[0, size * 0.75, 0]} castShadow><cylinderGeometry args={[size * 0.22, size * 0.32, size * 0.9, 24]} /><meshStandardMaterial color={K.ink} roughness={0.6} /></mesh>
          </group>
        )}
      </group>
    );
  };

/** الترجمة سطر هادئ بلا مستطيل (D187، D192): حبر داكن على فاتح، أو فاتح على داكن، ووسم «للمقارنة» */
export const BidLine: React.FC<{ t: number; name: string; tone: "ink" | "light" }> = ({ t, name, tone }) => {
  const si = Math.max(0, ...BID_WORDS.filter((w) => w.s - 0.15 <= t).map((w) => w.si));
  const words = BID_WORDS.filter((w) => w.si === si);
  const show = t >= BID_WORDS[0]!.s - 0.15;
  const fade = Math.min(1, Math.max(0, (t - words[0]!.s + 0.15) / 0.13));
  const [color, shadow] = tone === "ink" ? [K.ink, CAPTION_SHADOW_LIGHT] : [K.paper, CAPTION_SHADOW];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 22, right: 28, padding: "5px 14px 7px", borderRadius: 8, background: "rgba(42,30,63,0.55)", color: K.paper,
        fontFamily: "IBM Plex Sans Arabic", fontWeight: 500, fontSize: 20, direction: "rtl" }}>اتجاه للمقارنة · البدايات · {name} · لا يُنشر</div>
      {show && (
        <div style={{ position: "absolute", bottom: 56, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <div style={{ opacity: fade, color, textShadow: shadow, padding: "8px 28px", fontFamily: "Amiri", fontWeight: 700, fontSize: 54, direction: "rtl" }}>
            {words.map((w) => w.w).join(" ")}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};

/** مجرى ماء مسطح على السطح (شريط بعرض w يتبع المنحنى حتى p): ماء لا أنبوب. h(x,z) ارتفاع السطح تحته */
export const Stream: React.FC<{ path: [number, number][]; p: number; w: number; h: (x: number, z: number) => number; color?: string }> = ({ path, p, w, h, color = K.water }) => {
  const geo = React.useMemo(() => {
    if (p <= 0.001) return null;
    const curve = new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, 0, z)));
    const n = Math.max(2, Math.round(140 * p)), pts = curve.getPoints(140).slice(0, n + 1);
    const pos: number[] = [], idx: number[] = [];
    pts.forEach((q, i) => {
      const a = pts[Math.max(0, i - 1)]!, b = pts[Math.min(pts.length - 1, i + 1)]!;
      const tx = b.x - a.x, tz = b.z - a.z, L = Math.hypot(tx, tz) || 1;
      // يضيق عند المنبع ويتسع نحو المصب
      const half = (w / 2) * (0.45 + 0.55 * (i / 140));
      const sx = (-tz / L) * half, sz = (tx / L) * half;
      for (const s of [-1, 1]) { const x = q.x + sx * s, z = q.z + sz * s; pos.push(x, h(x, z) + 0.008, z); }
      if (i) { const k = i * 2; idx.push(k - 2, k - 1, k, k - 1, k + 1, k); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }, [path, p, w, h]);
  return geo ? <mesh geometry={geo} receiveShadow><meshStandardMaterial color={color} roughness={0.45} side={THREE.DoubleSide} /></mesh> : null;
};

/** سور مدينة منخفض: قطع جدار متتابعة على دائرة وباب مفتوح، يرتفع من الأرض بنسبة q */
export const WallRing: React.FC<{ at: V3; r: number; q: number; color: string; bump?: THREE.Texture; h?: number }> = ({ at, r, q, color, bump, h = 0.09 }) => {
  if (q <= 0) return null;
  const n = 28;
  return (
    <group position={at}>
      {Array.from({ length: n }, (_, k) => {
        const a = (k / n) * Math.PI * 2;
        if (k === 0 || k === 1) return null; // الباب
        const len = (2 * Math.PI * r) / n + 0.004;
        return (
          <mesh key={k} position={[Math.cos(a) * r, (h * q) / 2, Math.sin(a) * r]} rotation={[0, -a + Math.PI / 2, 0]} scale={[1, Math.max(0.001, q), 1]} castShadow receiveShadow>
            <boxGeometry args={[len, h, h * 0.45]} /><meshStandardMaterial color={color} bumpMap={bump} bumpScale={0.4} roughness={0.95} />
          </mesh>
        );
      })}
    </group>
  );
};
