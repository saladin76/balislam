/**
 * مظهر الكرة الأرضية في «دفاتر الزمن» (هوية «دفتر الأفق»): كرة من ورق الدفتر في سماء الغسق.
 * يابسة رَقّ، وبحر غسق فاتح، وسواحل بالحبر البني، والحد بأحمر شريط التاريخ، والنهر غسقًا داكنًا، والمدينة ذهبًا.
 * كل لون من لوحة الهوية المعتمدة أو درجاتها المشتقة (اختبار tests/geo3d.test.ts).
 * خاص بالقناة: لا يُستورد في قناة أخرى (لكل قناة مظهرها في مجلدها).
 */
import type { GlobeLook } from "../../scenes/Globe3D";
import { C } from "../horizon/kit";

export const DAFATIR_GLOBE: GlobeLook = {
  sea: "#BFB3C9",
  land: C.parchment,
  grid: C.ink,
  coast: C.ink,
  border: C.ribbon,
  borderFill: C.ribbon,
  route: C.ribbon,
  river: "#35284D",
  city: C.gold,
  shade: 0.55,
};
