/**
 * Verse reference shape used for optional offline/human-supplied comparison.
 * Studio never contacts or provisions a Quran text provider.
 * The owner's script is the only production text authority.
 */
export type Verse = { key: string; number: number; text: string; meaning?: string };
export type QuranClient = {
  verse: (key: string, options?: { translationId?: number }) => Promise<Verse>;
};
export const cleanTranslation = (html: string): string =>
  html.replace(/<sup\\b[^>]*>.*?<\\/sup>/gis, "").replace(/<[^>]+>/g, "").trim();
