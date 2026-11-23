/**
 * «دفاتر الزمن» — سلسلة «البدايات»: عالمها الخاص بثري دي (قرار المالك ٢٣ نوفمبر، D203). اختار المالك الاتجاه ٢
 * «خطوط على الأرض» عالمًا أساسيًا، وأدمج فيه فكرة الاتجاه ٣ (طبقات الأرض تحت رمل المكان نفسه بختم «درجة الثبوت» لكل طبقة)،
 * وترك الاتجاه ١ («أرض من طين»).
 * المرجع الملزم: «عمود السلاسل» (المرجع الملزم، D202) (سادسًا: «الأرض البكر: طين وماء وسماء وحجر، ضوء فجر، ومجسمات أرض
 * تتشكل؛ صامتة اللون قليلة العناصر»). نماذج صامتة لا تُنشر ولا تُستعمل في حلقة، على عدّة الثري دي المشتركة (D166) وبمعايير
 * «الحِرفة» (D189). المشترك بين الثلاثة كما في المرجع (ثالثًا ورابعًا): خيط الزمن الأحمر بعقدته، وختم «درجة الثبوت».
 * التوقير (خامسًا/٤): لا تصوير لنبي ولا ملَك ولا صحابي بأي شكل (لا وجه ولا ظل ولا هيئة)؛ القصة بالأماكن والأشياء.
 * والجملة الثالثة ذكر لله: يسكن عندها كل شيء (السكون المقصود)، ولا يُضاف شيء قبلها أو بعدها لتعويضها.
 */
import React from "react";
import { AbsoluteFill, staticFile } from "remotion";
import * as THREE from "three";
import { ease, noise1, type Window } from "../../three";
import { CAPTION_GEOMETRY } from "../../three/captionProbe";
import { CAPTION_TONES, type CaptionTone } from "../../three/anchors";
import { useBrandFonts } from "../../useBrandFonts";
import { useCanvasFont } from "../archive/ArchiveLab";

/** خط أميري للختم والترجمة قبل تصوير أي إطار */
export const useBidFont = () => useCanvasFont(useBrandFonts());

export const BID_FPS = 30;
/**
 * نص النموذج من سكريبت 001 نفسه: c1-s39، ثم جملة «ما ثبت وما لا نعلم» من c1-s40 (تنزل عندها الكاميرا تحت الرمل)، ثم c1-s46،
 * ثم جملة ذكر لله (c1-s13) وفيها القطعة المخصوصة: حفنة طين مبلل على الشاطئ بسكون تام.
 */
export const BID_SENTENCES = [
  "ومن هنا تتصل قصة آدم عليه السلام بتاريخ البشرية على الأرض.",
  "لقد اشتهرت في ذلك روايات مختلفة، ولا نعلم نصًا صحيحًا صريحًا يحدد لنا موضع هبوطه على وجه الجزم.",
  "ثم نمضي معًا إلى حياة المجتمعات البشرية القديمة، ونشأة القرى والمدن.",
  "خلق اللهُ آدمَ من طين.",
];
/** رقم جملة الذكر (الأخيرة) */
export const BID_SACRED = BID_SENTENCES.length - 1;
export const BID_WORDS: { w: string; s: number; e: number; si: number }[] = (() => {
  const out: { w: string; s: number; e: number; si: number }[] = [];
  // إيقاع راوٍ هادئ: نصف ثانية للكلمة، ووقفة أطول قبل جملة الذكر
  let t = 0.9;
  BID_SENTENCES.forEach((sentence, si) => {
    for (const w of sentence.split(" ")) { out.push({ w, s: t, e: t + 0.42, si }); t += 0.5; }
    t += si === BID_SACRED - 1 ? 1.3 : 0.6;
  });
  return out;
})();
const bare = (w: string) => w.replace(/[،.:]/g, "").replace(/[ً-ْ]/g, "");
/** زمن أول ظهور للكلمة (أو ظهورها رقم n) */
export const wordAt = (w: string, n = 1) => {
  const x = BID_WORDS.filter((y) => bare(y.w) === bare(w))[n - 1];
  if (!x) throw Error(`كلمة ليست في النموذج: ${w}`);
  return x.s;
};
/** مدة ظهور سطر الترجمة (تلاشٍ قصير) */
export const CAPTION_FADE = 0.13;
/**
 * جملة الذكر كلها سكون مقصود تام (قرار المالك: لا يتحرك شيء فيها، ولا الماء ولا الشمس ولا ظهور الترجمة): النافذة من قبلها
 * بربع ثانية إلى ما بعدها، وسطرها يكتمل ظهوره قبل النافذة، فالإطار فيها واحد بايتًا ببايت.
 */
export const BID_STILL: Window[] = (() => {
  const s3 = BID_WORDS.filter((w) => w.si === BID_SACRED);
  return [[s3[0]!.s - 0.25, s3[s3.length - 1]!.e + 0.25]];
})();
/** الزمن «الفعّال»: لا يتقدم داخل نوافذ السكون (الشمس والماء والموج يقفون فيها ويكملون بعدها بلا قفزة) */
export const effTime = (t: number, still: Window[] = BID_STILL) => {
  let lost = 0;
  for (const [s, e] of still) lost += Math.max(0, Math.min(t, e) - s);
  return t - lost;
};
export const BID_SEC = Math.ceil(BID_WORDS[BID_WORDS.length - 1]!.e + 3.2);
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
/** move: مدة حركة الكاميرا من بداية اللقطة (إن غابت فاللقطة كلها)، ثم تثبت */
export type BidShot = { id: string; size: "wide" | "medium" | "close" | "detail"; a: number; b: number; from: ShotCam; to: ShotCam; aperture: number; move?: number };
/**
 * حدود اللقطات على الكلام: الأفق حتى «بتاريخ»، والعقدة حتى «لقد»، وتحت الرمل حتى «موضع»، والشاطئ حتى «ثم»، والقرى حتى
 * قبيل جملة الذكر بـ٠٫٩ ث، ثم حفنة الطين (تبدأ قبل النافذة وتسكن فيها كلها).
 */
export const shotBounds = () => {
  const clay = BID_STILL[0]![0] - 0.9;
  return { s1: wordAt("بتاريخ") - 0.1, s2: wordAt("لقد") - 0.15, s3: wordAt("موضع") - 0.1, s4: wordAt("ثم") - 0.15, s5: clay };
};
export const camOf = (s: BidShot, t: number) => {
  // اللقطة الأخيرة: الكاميرا ساكنة في نافذة الذكر، وتتحرك بعدها فقط
  const [a, b] = s.b > BID_STILL[0]![1] && s.a <= BID_STILL[0]![0] ? [BID_STILL[0]![1] + 0.1, s.b] : [s.a, s.b];
  const p = ease(span(t, a, Math.min(b - a, s.move ?? b - a)));
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
/** كلمات الأختام: درجات الثبوت الأربع (العمود، رابعًا)، و«ظن» لحكم إبليس على الميزان (كنسخة الـ2D المعتمدة) */
export type StampWord = "ثابت" | "رواية" | "تقدير" | "لا نعلم" | "ظن";
export const useStampFace = (word: StampWord, ink: string, ready: boolean, ground = "rgba(0,0,0,0)") =>
  React.useMemo(() => {
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const g = c.getContext("2d")!;
    g.fillStyle = ground; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = ink; g.fillStyle = ink;
    g.lineWidth = 22; g.beginPath(); g.arc(256, 256, 226, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 7; g.beginPath(); g.arc(256, 256, 186, 0, Math.PI * 2); g.stroke();
    g.font = `700 ${word.length > 4 ? 128 : 150}px Amiri`; g.textAlign = "center"; g.textBaseline = "middle"; g.direction = "rtl";
    g.fillText(word, 256, 268);
    // الجولة ٤: حروف أثقل (خط محيط بالحبر نفسه): حروف الأميري الرفيعة كانت تذوب في الرمل عن بعد
    g.lineWidth = 9; g.lineJoin = "round"; g.strokeText(word, 256, 268);
    // أثر الختم: حواف غير تامة (بذرة ثابتة)
    g.globalCompositeOperation = "destination-out";
    // الجولة ٤: أثر أخف (كان يطمس حروف «تقدير» فلا تُقرأ)، وعلى الحلقة الخارجية وحدها لا على الكلمة
    for (let i = 0; i < 160; i++) { const a = (i * 137.5 * Math.PI) / 180, r = 200 + ((i * 53) % 40); g.globalAlpha = 0.06 + ((i * 31) % 10) / 90; g.beginPath(); g.arc(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 3 + (i % 5), 0, Math.PI * 2); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [word, ink, ground, ready]);

/**
 * ختم «درجة الثبوت» (المرجع، رابعًا): ختم خشبي يهبط على السطح عند p (٠–١) ويرتفع، ويبقى أثره.
 * press: ٠ فوق، ١ على السطح؛ mark: ظهور الأثر بعد الضغط.
 */
export const ProofStamp: React.FC<{ word: StampWord; at: V3; press: number; lift: number; ready: boolean; size?: number; ink?: string; tilt?: number }> =
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

/**
 * سطر الترجمة عند t: جملة جملة، يظهر بتلاشٍ قصير قبل أول كلماتها. سطر جملة الذكر يكتمل ظهوره قبل نافذة السكون نفسها،
 * فلا يتغير بكسل واحد داخلها (قرار المالك ٢٣ نوفمبر).
 */
export const bidLine = (t: number): { text: string; fade: number; si: number } | null => {
  const startOf = (si: number) => {
    const w0 = BID_WORDS.find((w) => w.si === si)!.s - 0.15;
    // نصف إطار احتياطًا: يكتمل الظهور قبل أول إطار في النافذة
    return si === BID_SACRED ? Math.min(w0, BID_STILL[0]![0] - CAPTION_FADE - 1 / 60) : w0;
  };
  let si = -1;
  for (let k = 0; k < BID_SENTENCES.length; k++) if (t >= startOf(k)) si = k;
  if (si < 0) return null;
  return { text: BID_SENTENCES[si]!, fade: Math.min(1, Math.max(0, (t - startOf(si)) / CAPTION_FADE)), si };
};

/**
 * الترجمة سطر هادئ بلا مستطيل (D187، D192)، وكل كلمة بنبرة ما خلفها فعلًا في الإطار (captionProbe، قرار المالك ٢٣ نوفمبر:
 * «الترجمة مقروءة على الرمل الفاتح»): حبر داكن بهالة فاتحة على الرمل والسماء الفاتحة، ونص فاتح بحد داكن على الماء والطين
 * والظل. ووسم «للمقارنة» في الأعلى.
 */
/** ظل أقوى للرمل متوسط الإضاءة (قرار المالك: «حبر داكن أو ظل أقوى»): هالة أعرض تحت الحد الرفيع، تُقرأ على هاتف ٦ بوصات */
export const BID_SHADOW: Record<CaptionTone, string> = {
  light: "0 0 10px rgba(26,20,36,0.9), 0 0 24px rgba(26,20,36,0.75), 0 2px 4px rgba(26,20,36,0.95)",
  ink: "0 0 8px rgba(244,233,212,0.95), 0 0 18px rgba(244,233,212,0.85), 0 0 34px rgba(244,233,212,0.6)",
};
/** حبر الترجمة على الرمل (الجولة ٤): أدكن من حبر الدفتر، فيُقرأ على هاتف ٦ بوصات فوق الرمل الذهبي الفاتح */
export const BID_CAPTION_INK = K.soil;
export const BidCaption: React.FC<{ line: { text: string; fade: number } | null; tones: CaptionTone[]; name?: string; bottom: number }> = ({ line, tones, name, bottom }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    {/* وسم «للمقارنة» في نماذج الاتجاهات وحدها؛ لا وسم في قوالب الحلقة */}
    {name && <div style={{ position: "absolute", top: 22, right: 28, padding: "5px 14px 7px", borderRadius: 8, background: "rgba(42,30,63,0.55)", color: K.paper,
      fontFamily: "IBM Plex Sans Arabic", fontWeight: 500, fontSize: 20, direction: "rtl" }}>عالم السلسلة · البدايات · {name} · لا يُنشر</div>}
    {line && (
      <div style={{ position: "absolute", bottom, left: CAPTION_GEOMETRY.side, right: CAPTION_GEOMETRY.side, display: "flex", justifyContent: "center" }}>
        <div style={{ opacity: line.fade, padding: `${CAPTION_GEOMETRY.padY}px ${CAPTION_GEOMETRY.padX}px`, fontFamily: "Tajawal", fontWeight: 700, fontSize: CAPTION_GEOMETRY.fontSize, lineHeight: `${CAPTION_GEOMETRY.lineHeight}px`, direction: "rtl", textAlign: "center" }}>
          {line.text.split(" ").filter(Boolean).map((w, i) => {
            const tone = tones[i] ?? "ink";
            return <React.Fragment key={i}>{i ? " " : ""}<span style={{ color: tone === "ink" ? BID_CAPTION_INK : K.paper, textShadow: `${CAPTION_TONES[tone].textShadow}, ${BID_SHADOW[tone]}` }}>{w}</span></React.Fragment>;
          })}
        </div>
      </div>
    )}
  </AbsoluteFill>
);
