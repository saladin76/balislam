/**
 * صوت واحد في الصفحة (D62، D105): حين يبدأ مشغّل الجمل يطلب من كل مشغّل معاينة (Remotion Player) أن يتوقف هو نفسه،
 * لا عناصر الصوت داخله فقط. المشغّل الذي يبقى «يعمل» يعيد تشغيل عنصر صوته فورًا بعد إيقافه، فيصل حدث «play»
 * إلى مشغّل الجمل فيوقف الجملة قبل أن تُسمع (بلاغ المالك ١٢ نوفمبر: «لما أولّد جملة وأعيد تشغيلها مش بتشتغل»).
 */
export const SOLO_AUDIO_EVENT = "studio:solo-audio";

/** يطلب من كل مشغّل معاينة في الصفحة أن يتوقف */
export const requestSoloAudio = (doc: Document | null | undefined) => {
  if (!doc || typeof doc.dispatchEvent !== "function" || typeof CustomEvent === "undefined") return;
  doc.dispatchEvent(new CustomEvent(SOLO_AUDIO_EVENT));
};

/** يستمع لطلب التوقف (للمشغّلات) ويعيد دالة الإلغاء */
export const onSoloAudio = (doc: Document | null | undefined, f: () => void) => {
  if (!doc || typeof doc.addEventListener !== "function") return () => {};
  doc.addEventListener(SOLO_AUDIO_EVENT, f);
  return () => doc.removeEventListener(SOLO_AUDIO_EVENT, f);
};
