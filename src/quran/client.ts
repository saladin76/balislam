/** Offline-only verse reference types.
 * All remote Quran Foundation authentication, content endpoints, downloads,
 * environment credentials and caches have been removed from Studio.
 * AlQuran Cloud preview is independently implemented in alquranCloud.ts.
 */
export type Verse = { key: string; number: number; text: string; meaning?: string };
/** Optional injected reference for offline/explicit audit tests; never network-backed here. */
export type QuranClient = { verse: (key: string, options?: { translationId?: number }) => Promise<Verse>; env?: string };
