import identity from "../../channels/balislam/identity.json";
import type { Domain, Theme, ThemeId } from "./types";

/**
 * القيم الافتراضية من هوية القناة الأساسية channels/balislam/identity.json.
 * هوية القناة الحالية تمر للرندر والاستوديو عبر IdentityProvider.
 * للمعاينة الحية داخل React استخدم useTheme من brand/identity.
 */
export const themeIds: ThemeId[] = ["paper", "family", "night", "warm"];

export const buildThemes = (src: Record<ThemeId, Omit<Theme, "id">>): Record<ThemeId, Theme> =>
  Object.fromEntries(themeIds.map((id) => [id, { id, ...src[id] }])) as Record<ThemeId, Theme>;

export const themes: Record<ThemeId, Theme> = buildThemes(identity.themes as unknown as Record<ThemeId, Omit<Theme, "id">>);

/** النسخة الأساسية لصورة القناة (الأقواس الدافئة). */
export const masterTheme = themes.warm;

export type { Domain, Theme, ThemeId } from "./types";
