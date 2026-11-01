/**
 * أوامر توليد الصور الواقعية (Midjourney / Flux / Ideogram…) لقالب «لوحة وثائقية».
 * صاحب القناة يكتب (أو نكتب له) وصف المشهد بالإنجليزية في حقل prompt، والاستوديو يضيف تلقائيًا:
 * أسلوب القناة الثابت (حتى تبدو كل الحلقات من عالم واحد)، وقواعد المحتوى (لا وجوه للأنبياء والصحابة،
 * والشخصيات من الخلف أو ظلال أو من بعيد)، ونسبة الأبعاد.
 */

export type PromptLook = "scene" | "archive";

/** أسلوب كل قناة: ثابت عبر الحلقات (بصمة بصرية) */
export const channelImageStyle: Record<string, string> = {
  "dafatir-alzaman":
    "cinematic historical documentary still, photorealistic, shot on 35mm film, anamorphic lens, natural volumetric light, atmospheric haze, rich warm earth tones with deep shadows, subtle film grain, historically accurate architecture, clothing and materials, epic scale, matte painting quality",
  "zubdat-alkutub": "cinematic editorial still, photorealistic, soft window light, shallow depth of field, calm muted teal and amber palette, subtle film grain, minimal composition",
  balislam: "cinematic still, photorealistic, soft natural light, warm calm palette, peaceful atmosphere, subtle film grain, no people's faces visible",
};

/** أسلوب الأرشيف: مخطوطات وخرائط ولوحات قديمة */
export const archiveStyle =
  "high resolution museum scan of an authentic-looking medieval Islamic-era manuscript page or map, aged parchment, faded ink, gold leaf details, visible paper texture and edges, flat even lighting, no modern elements";

/** قواعد ثابتة: الشخصيات بلا وجوه واضحة، ولا كتابة مولّدة (تخرج حروفًا مشوّهة) */
export const figureRule =
  "people only as silhouettes, seen from behind, or distant small figures, faces not visible, no close-up portraits";
export const negativeRule = "no text, no letters, no captions, no watermark, no logo, no modern objects";

export type ImagePromptInput = { channel: string; prompt: string; look?: PromptLook; orientation?: "landscape" | "portrait" };

/** الوصف كاملًا: المشهد + أسلوب القناة + القواعد. */
export const fullImagePrompt = ({ channel, prompt, look = "scene" }: ImagePromptInput) => {
  const subject = prompt.trim().replace(/\s+/g, " ").replace(/[.,;\s]+$/, "");
  if (!subject) return "";
  const style = look === "archive" ? archiveStyle : (channelImageStyle[channel] ?? channelImageStyle["dafatir-alzaman"]!);
  const parts = look === "archive" ? [subject, style] : [subject, style, figureRule];
  return `${parts.join(", ")}. ${negativeRule}.`;
};

/** نسخة Midjourney: نفس الوصف مع نسبة الأبعاد والأسلوب الخام (لواقعية أكثر). */
export const midjourneyPrompt = (input: ImagePromptInput) => {
  const base = fullImagePrompt(input);
  if (!base) return "";
  const ar = input.orientation === "portrait" ? "9:16" : "16:9";
  return `${base.replace(/\.\s*no text.*$/, "")} --ar ${ar} --style raw --v 7 --no text, letters, watermark, logo, modern objects`;
};
