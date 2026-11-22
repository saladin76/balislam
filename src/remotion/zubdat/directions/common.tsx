/**
 * «زبدة الكتب» — اتجاهات المقارنة الثلاثة بثري دي (مراجع المنسّق ٢١ نوفمبر، قرار المالك: ثلاثة اتجاهات قبل أي قالب).
 * نماذج صامتة لا تُنشر، على عدّة الثري دي المشتركة (D166). الجملة نفسها في الثلاثة، والفكرة كلمة واحدة («الحضور»)
 * وحدها بالفسفوري (هوية «القلم المميِّز»: الفسفوري للفكرة فقط). وجملة ذكر الله يسكن عندها كل شيء.
 */
import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import type { Window } from "../../three";

export const ZDIR_FPS = 30;
const SENTENCES = ["كثيرٌ منّا يصلّي ولا يشعر،", "لأنّه ينتظر الشعور قبل الحضور.", "واللهُ أقربُ إلينا ممّا نظن."];
export const ZSTARTS = [0, 5, 10];
export const ZWORDS: { w: string; s: number; e: number }[] = (() => {
  const out: { w: string; s: number; e: number }[] = [];
  // إيقاع راوٍ هادئ، ووقفة قبل جملة الذكر
  let t = 0.8;
  SENTENCES.forEach((sentence, i) => {
    for (const w of sentence.split(" ")) { out.push({ w, s: t, e: t + 0.42 }); t += 0.5; }
    t += i === 1 ? 1.4 : 0.6;
  });
  return out;
})();
export const zAt = (w: string) => ZWORDS.find((x) => x.w.replace(/[،.:]/g, "") === w)!.s;
export const Z_STILL: Window[] = [[zAt("واللهُ") - 0.25, ZWORDS[ZWORDS.length - 1]!.e + 0.25]];
export const Z_SEC = Math.ceil(ZWORDS[ZWORDS.length - 1]!.e + 2.0);
export const zFrames = () => Z_SEC * ZDIR_FPS;
export const IDEA = "الحضور";

export const ZB = { paper: "#FFFFFF", ink: "#111111", fluo: "#E8F542", alert: "#FF6B4A", grey: "#4A4A4A", warm: "#F1EDE4", line: "#BDBDBD", dark: "#1E1E1E" } as const;

/** صفحة نص مطبوعة على قماش (canvas) بخط الجسم، وتظليل الفكرة بالفسفوري بنسبة hi (٠–١)؛ تُعاد حين تُحمّل الخطوط */
export const usePageTexture = (ready: boolean, opts: { lines: string[]; hi: number; ink?: number; ruled?: boolean; font?: string; colophon?: boolean }) => useMemo(() => {
  const w = 1024, h = 1400, c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = ZB.warm; g.fillRect(0, 0, w, h);
  if (opts.ruled) { g.strokeStyle = ZB.line; g.lineWidth = 2; for (let y = 210; y < h - 80; y += 96) { g.beginPath(); g.moveTo(80, y); g.lineTo(w - 80, y); g.stroke(); } }
  g.direction = "rtl"; g.textAlign = "right"; g.font = `64px ${opts.font ?? "Tajawal"}`;
  opts.lines.forEach((line, i) => {
    const y = 190 + i * 96, x = w - 90;
    const at = line.indexOf(IDEA);
    if (at >= 0 && opts.hi > 0) {
      // تظليل الفكرة: من بداية الكلمة (يمينها) بنسبة hi
      const before = g.measureText(line.slice(0, at)).width, word = g.measureText(IDEA).width;
      g.fillStyle = ZB.fluo; g.fillRect(x - before - word * opts.hi, y - 56, word * opts.hi, 74);
    }
    g.globalAlpha = opts.ink ?? 1; g.fillStyle = ZB.ink; g.fillText(line, x, y); g.globalAlpha = 1;
  });
  if (opts.colophon) {
    // ذيل الصفحة كما في مطبوعات بولاق: سطر زخرفة من معيّنات وخط تحته (بلا رقم صفحة: يقع تحت الترجمة)
    g.globalAlpha = opts.ink ?? 1; g.fillStyle = ZB.ink;
    const top = 190 + opts.lines.length * 96 + 90; // تحت آخر سطر مباشرة
    for (let k = -5; k <= 5; k++) { const x = w / 2 + k * 58, y = top; g.beginPath(); g.moveTo(x, y - 18); g.lineTo(x + 14, y); g.lineTo(x, y + 18); g.lineTo(x - 14, y); g.closePath(); k % 2 ? g.fill() : g.stroke(); }
    g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2 - 340, top + 40); g.lineTo(w / 2 + 340, top + 40); g.stroke();
    g.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [ready, opts.hi, opts.ink, opts.ruled, opts.font, opts.colophon, opts.lines.join("|")]);

export const PAGE_LINES = ["كثيرٌ منّا يصلّي ولا يشعر،", "لأنّه ينتظر الشعور", "قبل الحضور.", "", "والحضورُ يُطلب،", "ثم يأتي الشعور."];

export const ZFrame: React.FC<{ t: number; name: string; tone?: "light" | "dark" }> = ({ t, name, tone = "dark" }) => {
  const si = Math.max(0, ZSTARTS.filter((x) => ZWORDS[x]!.s - 0.2 <= t).length - 1);
  const words = ZWORDS.slice(ZSTARTS[si], ZSTARTS[si + 1] ?? ZWORDS.length);
  const [on, off] = tone === "dark" ? [ZB.ink, "rgba(17,17,17,0.3)"] : [ZB.paper, "rgba(255,255,255,0.35)"];
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div style={{ position: "absolute", top: 22, right: 28, padding: "5px 14px 7px", borderRadius: 8, background: "rgba(17,17,17,0.7)", color: ZB.paper,
        fontFamily: "Tajawal", fontWeight: 500, fontSize: 20, direction: "rtl" }}>اتجاه للمقارنة · {name} · لا يُنشر</div>
      <div style={{ position: "absolute", bottom: 64, left: 0, right: 0, textAlign: "center", direction: "rtl", fontFamily: "Tajawal", fontWeight: 700, fontSize: 56 }}>
        {t >= ZWORDS[0]!.s - 0.2 && words.map((w, i) => (
          <span key={i} style={{ color: t >= w.s ? on : off, margin: "0 6px", ...(w.w.startsWith(IDEA) && t >= w.s ? { background: ZB.fluo, color: ZB.ink, padding: "0 6px" } : {}) }}>{w.w}</span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
