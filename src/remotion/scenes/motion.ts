import { Easing, interpolate, spring } from "remotion";

/**
 * حركات القناة الموحّدة. كل القوالب تستخدم هذه الدوال فقط حتى يبقى الإيقاع واحدًا.
 * القاعدة: دخول هادئ بلا ارتداد مبالغ، وخروج أسرع من الدخول.
 */
export const FPS = 30;

/** دخول بنابض ناعم (0 → 1) يبدأ عند delay. */
export const enter = (frame: number, delay = 0, fps = FPS, stiffness = 120) =>
  spring({ frame: frame - delay, fps, config: { damping: 18, stiffness, mass: 0.9 } });

/** ظهور تدريجي خطي مع تسهيل. */
export const fade = (frame: number, from: number, length = 12) =>
  interpolate(frame, [from, from + length], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

/** خروج في آخر المشهد (1 → 0). */
export const exit = (frame: number, duration: number, length = 10) =>
  interpolate(frame, [duration - length, duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.cubic),
  });

/** طفو خفيف مستمر لعنصر ثابت (بالبكسل). */
export const float = (frame: number, amp = 6, period = 90, phase = 0) => Math.sin(((frame + phase) / period) * Math.PI * 2) * amp;

/**
 * «غليان الحبر»: اهتزاز صغير يتبدل كل 4 إطارات، يعطي ثيم حبر وورق إحساس الرسم باليد.
 * يُستخدم في الثيم الخطي فقط.
 */
export const boil = (frame: number, seed = 0, amount = 0.7) => {
  const step = Math.floor(frame / 4);
  const r = Math.sin((step + 1) * 12.9898 + seed * 78.233) * 43758.5453;
  const n = (r - Math.floor(r)) * 2 - 1;
  return `rotate(${(n * amount).toFixed(2)}deg)`;
};
