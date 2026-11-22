/**
 * شخصية مسطحة بلا وجه (قاعدة «بالإسلام»: بلا وجوه): ثوب ورأس بعمامة وذراع بمفصلين، أشكال THREE.Shape
 * بوحدة «ارتفاع الشخصية = ١». تُستعمل دميةَ جلد في «خيال الظل» وقصاصةَ ورق في «حكايات الحارة».
 */
import * as THREE from "three";

const rounded = (w: number, h: number, r: number) => {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, 0); s.lineTo(w / 2 - r, 0); s.quadraticCurveTo(w / 2, 0, w / 2, r);
  s.lineTo(w / 2, h - r); s.quadraticCurveTo(w / 2, h, w / 2 - r, h); s.lineTo(-w / 2 + r, h);
  s.quadraticCurveTo(-w / 2, h, -w / 2, h - r); s.lineTo(-w / 2, r); s.quadraticCurveTo(-w / 2, 0, -w / 2 + r, 0);
  return s;
};

export type FigureVariant = { robe: number; cap: "turban" | "kufiya"; stoop: number };

/** الثوب من القدم (y=0) إلى الكتف (0.68)، والرأس فوقه؛ الذراع يتدلى من الكتف (مفصل الكتف عند 0,0 في شكله) */
export const figureShapes = (v: FigureVariant) => {
  const robe = new THREE.Shape();
  const hem = 0.17 * v.robe, sh = 0.1;
  robe.moveTo(-hem, 0); robe.lineTo(hem, 0);
  robe.bezierCurveTo(hem * 0.9, 0.3, sh * 1.15, 0.5, sh, 0.66);
  robe.quadraticCurveTo(0, 0.7, -sh, 0.66);
  robe.bezierCurveTo(-sh * 1.15, 0.5, -hem * 0.9, 0.3, -hem, 0);
  // ثقوب الزخرفة في الجلد (كما في دمى الظل): نجوم صغيرة على الثوب
  for (const [x, y] of [[0, 0.18], [-0.05, 0.34], [0.05, 0.34], [0, 0.5]] as const) {
    const h = new THREE.Path();
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, r = k % 2 ? 0.012 : 0.026; k ? h.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)) : h.moveTo(x + r, y); }
    robe.holes.push(h);
  }
  // نطاق الحزام: صف ثقوب بيضاوية، وخط ثقوب صغيرة في الوسط، وقوس عند الياقة (تخريم جلد خيال الظل)
  for (let k = 0; k < 6; k++) { const h = new THREE.Path(); h.absellipse(-0.075 + k * 0.03, 0.42, 0.009, 0.014, 0, Math.PI * 2, true, 0); robe.holes.push(h); }
  for (let k = 0; k < 5; k++) { const h = new THREE.Path(); h.absarc(0, 0.1 + k * 0.05, 0.006, 0, Math.PI * 2, true); if (Math.abs(0.1 + k * 0.05 - 0.18) > 0.03 && Math.abs(0.1 + k * 0.05 - 0.34) > 0.03) robe.holes.push(h); }
  for (let k = 0; k < 7; k++) { const a = Math.PI * (0.15 + (k / 6) * 0.7), h = new THREE.Path(); h.absarc(0.06 * Math.cos(a), 0.6 - 0.035 * Math.sin(a), 0.006, 0, Math.PI * 2, true); robe.holes.push(h); }
  // دانتيل الحاشية: صف ثقوب صغيرة فوق الذيل
  for (let k = 0; k < 7; k++) {
    const x = -hem * 0.8 + (k / 6) * hem * 1.6, h = new THREE.Path();
    h.absarc(x, 0.05, 0.011, 0, Math.PI * 2, false);
    robe.holes.push(h);
  }
  const head = new THREE.Shape();
  head.absellipse(0, 0.77, 0.062, 0.075, 0, Math.PI * 2, false, 0);
  const cap = new THREE.Shape();
  if (v.cap === "turban") {
    cap.moveTo(-0.075, 0.8); cap.quadraticCurveTo(-0.085, 0.9, 0, 0.93); cap.quadraticCurveTo(0.085, 0.9, 0.075, 0.8);
    cap.quadraticCurveTo(0, 0.83, -0.075, 0.8);
  } else {
    cap.moveTo(-0.07, 0.8); cap.quadraticCurveTo(0, 0.9, 0.07, 0.8); cap.lineTo(0.09, 0.62); cap.lineTo(0.06, 0.62); cap.lineTo(0.05, 0.78); cap.lineTo(-0.05, 0.78); cap.lineTo(-0.06, 0.62); cap.lineTo(-0.09, 0.62);
  }
  const upper = rounded(0.05, 0.2, 0.022);
  const fore = rounded(0.044, 0.19, 0.02);
  return { robe, head, cap, upper, fore, shoulder: new THREE.Vector2(0.075, 0.64) };
};
