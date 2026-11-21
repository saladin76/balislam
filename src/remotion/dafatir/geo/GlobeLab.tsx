/**
 * نموذج المالك الأول لأداة الخرائط ثلاثية الأبعاد (قرار ٢١ نوفمبر): كرة أرضية تدور وتقترب، وحد يتغير سنة بسنة،
 * ومدينة تظهر، ونهر يُرسم، والمصدر على الشاشة عند المعلومة («كما حدثت»). كل حدث عند كلمته.
 *
 * مختبر لا يُنشر: توقيت تقديري بلا صوت، والحد **تجريبي بلا مصدر تاريخي** (prototypeOnly) ليرى المالك
 * الآلية وحدها؛ يرفضه فحص الإنتاج. الحقائق المكتوبة: قيام الدولة سنة 132هـ/750م، وبناء المنصور بغداد
 * على دجلة سنة 145هـ/762م (الطبري، حوادث سنة 145).
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { useBrandFonts } from "../../useBrandFonts";
import { C, Caption, Dusk, Tag, easeOut, prog } from "../horizon/kit";
import { at, buildTimeline, end, type Timeline } from "../horizon/timeline";
import { LIB_SACRED } from "../lib/meta";
import { Globe3D } from "../../scenes/Globe3D";
import { camAt, safeKeys, sacredWindowsOf, type GlobeCam, type GlobeCamKey } from "../../scenes/globeCamera";
import { borderAt, assertSourced, type BorderLayer } from "../../scenes/globeLayers";
import { screenOf } from "../../scenes/globeProject";
import { places, rivers } from "../../../geo/places";
import { DAFATIR_GLOBE } from "./look";

export const GLOBE_LAB_FPS = 30;
export const GLOBE_LAB_SENTENCES = ["سنة مئة واثنتين وثلاثين للهجرة، قامت دولة جديدة.", "وبعد ثلاث عشرة سنة، بنى المنصور بغداد على دجلة."];

export const globeLabTimeline = (): Timeline => buildTimeline(GLOBE_LAB_SENTENCES, 0.6);
/** عشر ثوانٍ على الأقل (مقياس الأداء في رسالة التكليف: مشهد خريطة ١٠ ث بـ4K) */
export const globeLabFrames = () => Math.ceil(Math.max(10, globeLabTimeline().end + 1.4) * GLOBE_LAB_FPS);

/** حد تجريبي: ليس حدًا تاريخيًا، يرى به المالك التحوّل سنة بسنة وحده */
export const LAB_BORDER: BorderLayer = {
  id: "lab-border",
  label: "حد تجريبي",
  source: { label: "حد تجريبي للنموذج — ليس حدًا تاريخيًا", license: "رسم يدوي للمختبر", approximate: true, prototypeOnly: true },
  states: [
    { year: 750, ring: [[38, 37], [48, 38.5], [60, 37], [62, 31], [52, 27], [48, 29.5], [44, 30], [38.5, 32], [38, 37]] },
    { year: 762, ring: [[33, 38], [45, 41], [62, 40], [70, 36], [64, 27], [52, 25], [44, 27], [36, 29], [33, 33], [33, 38]] },
  ],
};

const START: GlobeCam = { lon: -18, lat: 16, dist: 4.6 };
const BAGHDAD = places["بغداد"]!;
const TIGRIS = rivers.find((r) => r.name === "دجلة")!.points;

export const GlobeLab: React.FC = () => {
  useBrandFonts();
  assertSourced([LAB_BORDER], "lab");
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const dur = durationInFrames / fps;
  const tl = globeLabTimeline();

  // مراسي الأحداث: كلمات الراوي
  const tYear = at(tl, "سنة");
  const tState = at(tl, "دولة");
  const tAfter = at(tl, "ثلاث");
  const tYears = end(tl, "سنة", 2);
  const tBuilt = at(tl, "بنى");
  const tCity = at(tl, "بغداد");
  const tRiver = at(tl, "دجلة");

  const keys: GlobeCamKey[] = safeKeys(
    [
      { a: tYear - 0.2, b: tState + 0.6, lon: 47, lat: 30, dist: 2.9 },
      { a: tBuilt - 0.15, b: tCity + 0.7, lon: 44.6, lat: 32.4, dist: 2.0 },
      { a: tRiver + 0.9, b: dur - 0.2, lon: 46, lat: 31.4, dist: 2.25 },
    ],
    sacredWindowsOf(tl.words.map((w) => ({ w: w.w, s: w.s, e: w.e })), LIB_SACRED),
  );
  const cam = camAt(t, START, keys);

  // السنة: 750 عند «سنة»، وتعدّ إلى 762 بين «ثلاث» ونهاية «سنة» الثانية، والحد يتحوّل معها
  const yp = prog(t, tAfter, tYears + 0.4);
  const year = Math.round(750 + 12 * yp);
  const hijri = Math.round(132 + 13 * yp);
  const ring = borderAt(LAB_BORDER, 750 + 12 * yp);
  const draw = prog(t, tState - 0.05, tState + 0.9, easeOut);
  const fill = 0.32 * prog(t, tState + 0.5, tState + 1.1);

  const city = prog(t, tCity - 0.05, tCity + 0.35, easeOut);
  const pulse = prog(t, tCity - 0.05, tCity + 1.2);
  const river = prog(t, tRiver - 0.05, tRiver + 1.0, easeOut);

  const yearO = prog(t, tYear - 0.1, tYear + 0.35, easeOut);
  const srcO = prog(t, tCity + 0.2, tCity + 0.6, easeOut);
  const borderTagO = prog(t, tState + 0.6, tState + 1.0) * (1 - prog(t, tBuilt - 0.3, tBuilt));

  const lbl = screenOf(BAGHDAD, cam, width, height);
  const cur = tl.sentences.filter((s) => s.s - 0.2 <= t).pop();
  const capO = cur ? prog(t, cur.s - 0.2, cur.s + 0.05) * (1 - prog(t, cur.e + 0.25, cur.e + 0.55)) : 0;
  const fadeIn = prog(t, 0, 0.4);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Dusk warm={0.6} />
      <AbsoluteFill style={{ opacity: fadeIn }}>
        <Globe3D
          width={width}
          height={height}
          cam={cam}
          look={DAFATIR_GLOBE}
          borders={[{ ring, draw, fill }]}
          rivers={river > 0 ? [{ pts: TIGRIS, p: river }] : []}
          cities={[{ at: BAGHDAD, size: 0.006 + 0.004 * city, pulse, o: city }]}
        />
        {/* اسم المدينة بخط العناوين، يُكتب من اليمين عند نطقه، ويختفي إن دارت خلف الأفق */}
        {city > 0 ? (
          <div style={{ position: "absolute", left: lbl.x - 360, top: lbl.y - 34, width: 330, textAlign: "right", direction: "rtl", opacity: city * lbl.visible, fontFamily: "'Amiri', serif", fontWeight: 700, fontSize: 64, color: C.page, textShadow: `0 2px 0 ${C.ink}, 0 0 18px rgba(13,10,20,0.6)`, clipPath: `inset(-30% 0 -30% ${(1 - city) * 100}%)` }}>
            بغداد
          </div>
        ) : null}
        {/* شريط التاريخ الأحمر: السنة بخط السنوات IBM Plex Mono */}
        <div style={{ position: "absolute", right: 64, top: 86, opacity: yearO, transform: `translateY(${(1 - yearO) * -14}px)`, display: "flex", alignItems: "baseline", gap: 18, padding: "10px 26px 14px", background: C.ribbon, color: C.page, borderRadius: 6, boxShadow: "0 6px 18px rgba(0,0,0,0.35)", direction: "rtl" }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500, fontSize: 58 }}>{hijri}</span>
          <span style={{ fontFamily: "'Amiri', serif", fontWeight: 700, fontSize: 36 }}>هـ</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 500, fontSize: 34, opacity: 0.85 }}>{year}</span>
          <span style={{ fontFamily: "'Amiri', serif", fontWeight: 700, fontSize: 26, opacity: 0.85 }}>م</span>
        </div>
        {/* «كما حدثت»: مصدر المعلومة عند ذكرها */}
        <div style={{ position: "absolute", left: 64, bottom: 140, opacity: srcO, transform: `translateY(${(1 - srcO) * 12}px)`, display: "flex", direction: "rtl", boxShadow: "0 6px 18px rgba(0,0,0,0.35)" }}>
          <div style={{ background: C.ribbon, color: C.page, fontFamily: "'Tajawal', sans-serif", fontWeight: 700, fontSize: 24, padding: "10px 16px", borderRadius: "0 6px 6px 0" }}>المصدر</div>
          <div style={{ background: C.page, color: C.inkText, fontFamily: "'Amiri', serif", fontWeight: 700, fontSize: 30, padding: "6px 20px 10px", borderRadius: "6px 0 0 6px" }}>الطبري · تاريخ الرسل والملوك · حوادث سنة 145</div>
        </div>
        <Tag corner="tl" tone="dark" opacity={borderTagO} text={LAB_BORDER.source.label} />
        {cur ? <Caption text={cur.text} opacity={capO} /> : null}
        <Tag corner="tr" text="نموذج تقني · الخرائط ثلاثية الأبعاد · بلا صوت · لا يُنشر" />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
