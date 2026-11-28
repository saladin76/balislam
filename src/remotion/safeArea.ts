/**
 * D243 — المنطقة الآمنة للشورتس في الإطار العمودي 1080×1920 (يوتيوب شورتس وتيك توك وريلز إنستغرام معًا).
 *
 * كل نص على الشاشة في العمودي (الترجمة، وسطر الكلام العلوي، وعنوان الفصل، والشعار، وعنوان الشورت، وبطاقات الآية
 * والحديث) يقع داخل هذا المستطيل، فلا تغطيه أزرار المنصات أعلى الإطار وأسفله وعلى جانبه الأيمن.
 *
 * المصادر (بكسلات على 1080×1920، والمأخوذ هو الأشد من الثلاث على كل جهة):
 * - Meta (إعلانات Reels، «Safe zones» في Meta Ads Guide): أعلى 14% (269 بكسل)، وأسفل 35% (672)، وكل جانب 6% (65).
 * - TikTok (ملف «safe zone» لإعلانات In-Feed في TikTok Ads Help Center، كما قيس من الملف): أعلى 240، وأسفل 660،
 *   وكل جانب 120؛ وعمود الأزرار (الإعجاب والتعليق والمشاركة والملف) بعرض 180 على اليمين.
 * - YouTube Shorts: لا أرقام رسمية منشورة؛ واجهته (العنوان والقناة أسفلًا، والأزرار يمينًا) داخل أشد القيم أعلاه.
 * تنبيه: الأرقام كما نقلتها أدلة المنصات ومقاييس ملفاتها في ٢٨ نوفمبر ٢٠٢٦؛ إن تغيّرت واجهة منصة تُحدَّث هنا وحدها،
 * واختبار tests/vertical-safe-area.test.tsx يفحص كل صندوق نص عمودي عليها.
 */

/** الإطار العمودي الأساسي (config.json ← video.short) قبل أي تكبير */
export const PORTRAIT_FRAME = { width: 1080, height: 1920 } as const;

/** الهوامش الممنوعة على النص (بكسل على 1080×1920) */
export const SHORTS_SAFE_AREA = {
  /** max(Meta 14% = 269 → 270، TikTok 240) */
  top: 270,
  /** max(Meta 35% = 672، TikTok 660) */
  bottom: 672,
  /** max(Meta 6% = 65، TikTok 120) */
  left: 120,
  /** عمود أزرار تيك توك (180) أعرض من هامشه (120) ومن Meta (65) */
  right: 180,
} as const;

/** الهامش لعنصر يتموضع بجهة البداية أو النهاية (يمين أو يسار حسب اتجاه اللغة): الأشد من الجانبين */
export const SAFE_INLINE = Math.max(SHORTS_SAFE_AREA.left, SHORTS_SAFE_AREA.right);

export type Rect = { left: number; top: number; right: number; bottom: number };

/** المستطيل الآمن بإحداثيات الإطار (يمين/أسفل = الحافة لا الهامش)، بمقياس k (1 لـ1080×1920) */
export const safeRect = (k = 1): Rect => ({
  left: SHORTS_SAFE_AREA.left * k,
  top: SHORTS_SAFE_AREA.top * k,
  right: (PORTRAIT_FRAME.width - SHORTS_SAFE_AREA.right) * k,
  bottom: (PORTRAIT_FRAME.height - SHORTS_SAFE_AREA.bottom) * k,
});
export const SAFE_WIDTH = PORTRAIT_FRAME.width - SHORTS_SAFE_AREA.left - SHORTS_SAFE_AREA.right;
export const SAFE_HEIGHT = PORTRAIT_FRAME.height - SHORTS_SAFE_AREA.top - SHORTS_SAFE_AREA.bottom;

/** هل الصندوق كله داخل المنطقة الآمنة؟ */
export const insideSafe = (r: Rect, k = 1) => {
  const s = safeRect(k);
  const eps = 1e-6;
  return r.left >= s.left - eps && r.top >= s.top - eps && r.right <= s.right + eps && r.bottom <= s.bottom + eps;
};

/**
 * مواضع النص العمودي المشتركة (بكسل على 1080×1920): المكوّنات تقرأ منها، والاختبار يفحصها بأسوأ ارتفاع ممكن.
 * - caption: الترجمة (CaptionBar) مثبتة من الأسفل عند حد المنطقة، وتنمو أسطرها إلى الأعلى.
 * - topLine: سطر الكلام العلوي في «بالإسلام» (TopCaption) وعنوان الشورت (ShortTitle) يبدآن عند حد الأعلى.
 * - inline: عنوان الفصل والشعار وشريط التاريخ: من جهتهما بهامش SAFE_INLINE وتحت حد الأعلى.
 */
export const PORTRAIT_TEXT = {
  caption: { bottom: SHORTS_SAFE_AREA.bottom, left: SHORTS_SAFE_AREA.left, right: SHORTS_SAFE_AREA.right, maxWidth: SAFE_WIDTH },
  topLine: { top: SHORTS_SAFE_AREA.top, left: SHORTS_SAFE_AREA.left, right: SHORTS_SAFE_AREA.right },
  inline: { top: SHORTS_SAFE_AREA.top, inset: SAFE_INLINE },
} as const;

/** صندوق الترجمة الأسوأ: n أسطر بخط حجمه size وتباعد 1.5 وحشوة 12 أعلى وأسفل */
export const captionBox = (lines: number, size: number): Rect => {
  const c = PORTRAIT_TEXT.caption;
  const h = lines * size * 1.5 + 24;
  return { left: c.left, right: PORTRAIT_FRAME.width - c.right, bottom: PORTRAIT_FRAME.height - c.bottom, top: PORTRAIT_FRAME.height - c.bottom - h };
};
/** صندوق سطر يبدأ من الأعلى: n أسطر بخط size وتباعد 1.35 وحشوة pad */
export const topLineBox = (lines: number, size: number, pad = 20): Rect => {
  const t = PORTRAIT_TEXT.topLine;
  return { left: t.left, right: PORTRAIT_FRAME.width - t.right, top: t.top, bottom: t.top + lines * size * 1.35 + pad };
};
