/**
 * نموذج المالك لقالب «اللوح – خزانة الأرشيف» (D185؛ رسالة التكليف C، دفاتر الزمن ١).
 * المرجع الفني: طاولة كاتب ديوان: سجل (دفتر) يُكتب فيه بالحبر، ووثيقة يُضغط عليها ختم، وصحيفة خريطة،
 * وقصاصة مصدر. كل ظهور عند كلمته، والكاميرا دولي فوق الطاولة بين محطات مختلفة التكوين.
 *
 * قرار المالك (٢١ نوفمبر) في القوالب: لا تدرّج خلف عنوان، ولا بطاقات زجاجية، ولا وهج، ولا جسيمات، ولا لمعة،
 * ولا كلام قافز، ولا أيقونات جاهزة، ولا الظل الجاهز، ولا خطوط الواجهات الشائعة، ولا انتقالات جاهزة (اختبار tests/dafatir-archive.test.ts).
 * الظلال من ضوء نافذة واحد بارتفاع كل وثيقة، والحبر يُكتب ويجف، والختم يُضغط فيتشرب الورق حبره.
 *
 * مختبر لا يُنشر: توقيت تقديري بلا صوت. صحيفة الخريطة **موضع مادة أرشيفية** لم تُختر بعد (تنتظر مراجعة الرخصة)،
 * والنهر والمدينة مرسومان بحبر القناة فوقها. الحقائق: بدأ المنصور بناء بغداد سنة 145هـ وسمّاها مدينة السلام.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useBrandFonts } from "../../useBrandFonts";
import { C, Tag, prog, easeOut } from "../horizon/kit";
import { at, buildTimeline, end, type Timeline } from "../horizon/timeline";
import { rivers, places } from "../../../geo/places";
import { textureUrl } from "./texture";
import { DESK, deskCamAt, inkAt, shadowOf, stampAt, type Station, type StationKey } from "./desk";

export const ARCHIVE_LAB_FPS = 30;
export const ARCHIVE_LAB_SENTENCES = ["سنة مئة وخمس وأربعين للهجرة، بدأ أبو جعفر المنصور بناء بغداد على دجلة.", "| | وسمّاها مدينة السلام."];
export const archiveLabTimeline = (): Timeline => buildTimeline(ARCHIVE_LAB_SENTENCES, 0.8);
export const archiveLabFrames = () => Math.ceil((archiveLabTimeline().end + 2.2) * ARCHIVE_LAB_FPS);

/** ألوان المادة: كلها من هوية «دفتر الأفق» المعتمدة أو درجاتها المشتقة (اختبار) */
export const ARCHIVE_COLORS = { wood: "#2B1E14", woodGrain: "#5A4632", paper: C.parchment, paperLight: "#F4E9D4", paperOld: "#EADBC0", ink: C.ink, inkWet: "#2B1E14", seal: C.ribbon, sealDry: "#B4583A", rule: "#A399B4" };
const K = ARCHIVE_COLORS;

type Doc = { id: string; seed: number; x: number; y: number; w: number; h: number; rot: number; lift: number; tone: string };
export const DOCS: Doc[] = [
  { id: "register", seed: 31, x: 640, y: 210, w: 1120, h: 1480, rot: -1.2, lift: 1, tone: K.paper },
  { id: "deed", seed: 38, x: 1880, y: 260, w: 860, h: 760, rot: 2.6, lift: 0.4, tone: K.paperOld },
  { id: "map", seed: 45, x: 1780, y: 1080, w: 1160, h: 680, rot: -1.8, lift: 0, tone: K.paperLight },
  { id: "slip", seed: 52, x: 2420, y: 1540, w: 660, h: 330, rot: -4.5, lift: 2.2, tone: K.paperLight },
];

export const START: Station = { id: "desk", x: 1640, y: 980, z: 0.56, shot: "wide" };

/** محطات الكاميرا مربوطة بالكلمات */
export const archiveStations = (tl: Timeline): StationKey[] => {
  const k = (a: number, d: number, s: Station): StationKey => ({ ...s, a, b: a + d });
  return [
    k(at(tl, "سنة") - 0.5, 0.8, { id: "register-top", x: 1180, y: 560, z: 1.12, shot: "medium" }),
    k(at(tl, "مئة"), 1.25, { id: "seal", x: 2410, y: 790, z: 1.95, shot: "detail" }),
    k(at(tl, "بدأ") - 0.45, 1.45, { id: "register-line", x: 1170, y: 700, z: 1.4, shot: "close" }),
    k(at(tl, "بغداد") - 0.75, 1.25, { id: "map", x: 2330, y: 1410, z: 1.3, shot: "medium" }),
    k(end(tl, "دجلة") + 0.15, 0.65, { id: "slip", x: 2750, y: 1700, z: 1.75, shot: "detail" }),
    k(at(tl, "مدينة") - 0.35, 1.3, { id: "register-wide", x: 1260, y: 930, z: 0.8, shot: "wide" }),
    // بعد آخر كلمة: دفع بطيء نحو «مدينة السلام» حتى نهاية المشهد، فلا سكون أطول من ثانيتين
    k(tl.end + 0.2, 2.0, { id: "register-push", x: 1200, y: 1060, z: 1.15, shot: "medium" }),
  ];
};

const mixHex = (a: string, b: string, p: number) => {
  const h = (s: string, i: number) => parseInt(s.slice(1 + 2 * i, 3 + 2 * i), 16);
  return `rgb(${[0, 1, 2].map((i) => Math.round(h(a, i) + (h(b, i) - h(a, i)) * p)).join(",")})`;
};

/** كلمة تُكتب بالحبر من اليمين إلى اليسار، طرية أغمق ثم تجف */
const InkWord: React.FC<{ w: string; t: number; s: number; e: number; size: number }> = ({ w, t, s, e, size }) => {
  const { write, wet } = inkAt(t, s, e);
  if (write <= 0) return <span style={{ display: "inline-block", visibility: "hidden", fontSize: size }}>{w}&nbsp;</span>;
  return (
    <span style={{ display: "inline-block", fontSize: size, color: mixHex(K.ink, K.inkWet, wet), clipPath: `inset(-30% 0 -30% ${(1 - write) * 100}%)` }}>
      {w}&nbsp;
    </span>
  );
};

const Paper: React.FC<{ d: Doc; blur: number; children?: React.ReactNode }> = ({ d, blur, children }) => {
  const sh = shadowOf(d.lift);
  return (
    <div style={{ position: "absolute", left: d.x, top: d.y, width: d.w, height: d.h, transform: `rotate(${d.rot}deg)`, filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined }}>
      {/* ظل من ضوء النافذة: إزاحته ونعومته بارتفاع الوثيقة عن الطاولة */}
      <div style={{ position: "absolute", inset: 0, transform: `translate(${sh.x}px, ${sh.y}px)`, background: `rgba(18,12,24,${sh.alpha})`, filter: `blur(${sh.blur}px)`, borderRadius: 3 }} />
      {/* ألياف الورق وحبيباته: خامة محسوبة مرة واحدة (texture.ts)، لكل وثيقة بذرة */}
      <div style={{ position: "absolute", inset: 0, background: d.tone, backgroundImage: `url(${textureUrl("paper", [74, 46, 31], 0.1, d.seed)})`, backgroundSize: "512px 512px" }} />
      <svg width={d.w} height={d.h} style={{ position: "absolute", inset: 0 }}>
        {/* حافة أقدم من الوسط: أثر الأيدي والرطوبة */}
        <rect x={3} y={3} width={d.w - 6} height={d.h - 6} fill="none" stroke={K.woodGrain} strokeOpacity={0.12} strokeWidth={10} />
      </svg>
      <div style={{ position: "absolute", inset: 0 }}>{children}</div>
    </div>
  );
};

/** الكلمات كما كُتبت في النص (بتشكيلها وعلامات ترقيمها)، بترتيب كلمات التوقيت نفسه */
export const writtenTokens = () => ARCHIVE_LAB_SENTENCES.join(" ").split(/\s+/).filter((w) => w && w !== "|");
const lineWords = (tl: Timeline, from: number, to: number) => tl.words.slice(from, to).map((w, i) => ({ ...w, w: writtenTokens()[from + i] ?? w.w }));

export const ArchiveLab: React.FC = () => {
  useBrandFonts();
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const tl = archiveLabTimeline();
  const cam = deskCamAt(t, START, archiveStations(tl));
  // التركيز على أعلى وثيقة تحت مركز الكاميرا (العين ترى الأقرب)
  const focusLift = Math.max(0, ...DOCS.filter((d) => cam.x >= d.x && cam.x <= d.x + d.w && cam.y >= d.y && cam.y <= d.y + d.h).map((d) => d.lift));
  const dof = (d: Doc) => (cam.z > 1 ? Math.min(2.4, Math.abs(d.lift - focusLift) * 1.1 * (cam.z - 0.9)) : 0);

  // أسطر السجل: السطر الأول إلى «للهجرة»، ثم بقية الجملة الأولى في سطرين، ثم الجملة الثانية بخط كبير
  const nS1 = ARCHIVE_LAB_SENTENCES[0]!.split(/\s+/).filter(Boolean).length;
  const iHijra = tl.words.findIndex((w) => w.w.startsWith("للهجرة")) + 1;
  const iMansur = tl.words.findIndex((w) => w.w.startsWith("المنصور")) + 1;
  const tSeal = at(tl, "للهجرة");
  const stamp = stampAt(t, tSeal);
  const tCity = at(tl, "بغداد");
  const tRiver = at(tl, "دجلة");
  const river = prog(t, tRiver - 0.05, tRiver + 1.1, easeOut);
  const cityInk = inkAt(t, tCity, end(tl, "بغداد"));
  const slipStart = end(tl, "دجلة") + 0.1;

  // الخريطة: إسقاط خطي بسيط لمنطقة العراق على الصحيفة (خط طول ٤٢–٤٩، عرض ٢٩–٣٧)
  const map = DOCS[2]!;
  const P = ([lon, lat]: [number, number]) => [80 + ((lon - 42) / 7) * (map.w - 160), 60 + ((37 - lat) / 8) * (map.h - 120)] as const;
  const tigris = rivers.find((r) => r.name === "دجلة")!.points.map((p) => P(p as [number, number]));
  const tigrisD = `M${tigris.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")}`;
  const [bx, by] = P(places["بغداد"] as [number, number]);

  const write = (from: number, to: number, size: number) =>
    lineWords(tl, from, to).map((w, i) => <InkWord key={from + i} w={w.w} t={t} s={w.s} e={w.e} size={size} />);

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: K.wood }}>
      <div style={{ position: "absolute", inset: 0, perspective: 2600, perspectiveOrigin: "50% 30%" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: DESK.w, height: DESK.h, transformOrigin: "0 0", transform: `translate(${width / 2 - cam.x * cam.z}px, ${height / 2 - cam.y * cam.z}px) scale(${cam.z}) rotateX(7deg)` }}>
          {/* خشب الطاولة: ألياف ممتدة بعرضها */}
          <div style={{ position: "absolute", left: -800, top: -600, width: DESK.w + 1600, height: DESK.h + 1200, background: K.wood, backgroundImage: `url(${textureUrl("wood", [90, 70, 50], 0.7, 19)})`, backgroundSize: "1600px 800px" }} />

          {/* الخريطة (أسفل الكومة) */}
          <Paper d={map} blur={dof(map)}>
            <svg width={map.w} height={map.h} style={{ position: "absolute", inset: 0 }}>
              <rect x={40} y={34} width={map.w - 80} height={map.h - 68} fill="none" stroke={K.ink} strokeWidth={3} strokeOpacity={0.75} />
              <rect x={52} y={46} width={map.w - 104} height={map.h - 92} fill="none" stroke={K.seal} strokeWidth={1.6} strokeOpacity={0.6} />
              <path d={tigrisD} fill="none" stroke={K.ink} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - river} />
              {cityInk.write > 0 ? <circle cx={bx} cy={by} r={9 * Math.min(1, cityInk.write * 2)} fill={mixHex(K.ink, K.inkWet, cityInk.wet)} /> : null}
            </svg>
            <div style={{ position: "absolute", left: bx - 330, top: by - 44, width: 300, textAlign: "right", direction: "rtl", fontFamily: "'Amiri', serif", fontWeight: 700 }}>
              {write(tl.words.findIndex((w) => w.w.startsWith("بغداد")), tl.words.findIndex((w) => w.w.startsWith("بغداد")) + 1, 58)}
            </div>
            <div style={{ position: "absolute", left: 70, bottom: 60, fontFamily: "'Amiri', serif", fontSize: 22, color: K.rule, direction: "rtl" }}>موضع مادة أرشيفية · تنتظر مراجعة الرخصة</div>
          </Paper>

          {/* الوثيقة والختم */}
          <Paper d={DOCS[1]!} blur={dof(DOCS[1]!)}>
            <svg width={DOCS[1]!.w} height={DOCS[1]!.h} style={{ position: "absolute", inset: 0 }}>
              {Array.from({ length: 9 }, (_, i) => (
                <line key={i} x1={90} x2={DOCS[1]!.w - 90 - (i % 3) * 60} y1={110 + i * 52} y2={110 + i * 52} stroke={K.ink} strokeOpacity={0.22} strokeWidth={6} strokeLinecap="round" />
              ))}
              <defs>
                <filter id="seal-ink" x="-10%" y="-10%" width="120%" height="120%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves={2} seed={5} result="n" />
                  <feDisplacementMap in="SourceGraphic" in2="n" scale={6} result="d" />
                  <feComponentTransfer in="n" result="m"><feFuncA type="discrete" tableValues="0.55 1 1 0.8" /></feComponentTransfer>
                  <feComposite in="d" in2="m" operator="in" />
                </filter>
              </defs>
              {stamp.ink > 0 ? (
                <g filter="url(#seal-ink)" opacity={stamp.ink} transform={`translate(540 560) scale(${1 + 0.05 * stamp.press}) rotate(-8)`}>
                  <circle r={118} fill="none" stroke={mixHex(K.seal, K.sealDry, 1 - stamp.press)} strokeWidth={9} />
                  <circle r={98} fill="none" stroke={K.seal} strokeWidth={3} />
                  <text y={-8} textAnchor="middle" fontFamily="'Amiri', serif" fontWeight={700} fontSize={50} fill={K.seal}>سنة</text>
                  <text y={52} textAnchor="middle" fontFamily="'Amiri', serif" fontWeight={700} fontSize={56} fill={K.seal}>١٤٥</text>
                </g>
              ) : null}
            </svg>
          </Paper>

          {/* السجل: كلام الراوي يُكتب فيه سطرًا سطرًا */}
          <Paper d={DOCS[0]!} blur={dof(DOCS[0]!)}>
            <svg width={DOCS[0]!.w} height={DOCS[0]!.h} style={{ position: "absolute", inset: 0 }}>
              <rect x={80} y={90} width={DOCS[0]!.w - 160} height={DOCS[0]!.h - 180} fill="none" stroke={K.seal} strokeOpacity={0.55} strokeWidth={2} />
              {Array.from({ length: 11 }, (_, i) => <line key={i} x1={100} x2={DOCS[0]!.w - 100} y1={330 + i * 110} y2={330 + i * 110} stroke={K.rule} strokeOpacity={0.35} strokeWidth={1.5} />)}
            </svg>
            <div style={{ position: "absolute", right: 120, left: 120, top: 200, direction: "rtl", textAlign: "right", fontFamily: "'Amiri', serif", fontWeight: 700, lineHeight: "110px" }}>
              <div>{write(0, iHijra, 70)}</div>
              <div>{write(iHijra, iMansur, 70)}</div>
              <div>{write(iMansur, nS1, 70)}</div>
              <div style={{ marginTop: 100, textAlign: "center", lineHeight: "180px" }}>{write(nS1, tl.words.length, 112)}</div>
            </div>
          </Paper>

          {/* قصاصة المصدر («كما حدثت») تُكتب بعد ذكر المكان */}
          <Paper d={DOCS[3]!} blur={dof(DOCS[3]!)}>
            <div style={{ position: "absolute", inset: "40px 50px", direction: "rtl", textAlign: "right", fontFamily: "'Amiri', serif", fontWeight: 700, lineHeight: "78px" }}>
              {["المصدر: الطبري", "تاريخ الرسل والملوك", "حوادث سنة ١٤٥"].map((line, i) => (
                <div key={i}>
                  <InkWord w={line} t={t} s={slipStart + i * 0.45} e={slipStart + i * 0.45 + 0.42} size={i === 0 ? 50 : 42} />
                </div>
              ))}
            </div>
          </Paper>

          {/* ضوء النافذة: من أعلى اليسار، يخفت نحو الزاوية البعيدة (إضاءة للمكان، لا خلفية لعنوان) */}
          <svg width={DESK.w + 1600} height={DESK.h + 1200} style={{ position: "absolute", left: -800, top: -600, pointerEvents: "none" }}>
            <defs>
              <radialGradient id="window" cx="0.12" cy="0.05" r="1.15">
                <stop offset="0" stopColor="#F8EEDB" stopOpacity={0.1} />
                <stop offset="0.55" stopColor="#120C18" stopOpacity={0} />
                <stop offset="1" stopColor="#120C18" stopOpacity={0.42} />
              </radialGradient>
            </defs>
            <rect width={DESK.w + 1600} height={DESK.h + 1200} fill="url(#window)" />
          </svg>
        </div>
      </div>
      <Tag corner="tr" text="نموذج تقني · اللوح: خزانة الأرشيف · بلا صوت · لا يُنشر" />
    </AbsoluteFill>
  );
};
