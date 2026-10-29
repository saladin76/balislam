import identity from "../identity.json";
import type { Domain, Theme, ThemeId } from "./types";

/**
 * الثيمات تُقرأ من brand/identity.json (يعدّلها الاستوديو أو المحرر).
 * للمعاينة الحية داخل React استخدم useTheme من brand/identity.
 */
export const themeIds: ThemeId[] = ["paper", "family", "night", "warm"];

export const buildThemes = (src: Record<ThemeId, Omit<Theme, "id">>): Record<ThemeId, Theme> =>
  Object.fromEntries(themeIds.map((id) => [id, { id, ...src[id] }])) as Record<ThemeId, Theme>;

export const themes: Record<ThemeId, Theme> = buildThemes(identity.themes as unknown as Record<ThemeId, Omit<Theme, "id">>);

const domainToTheme: Record<Domain, ThemeId> = {
  psychology: "paper",
  family: "family",
  money: "night",
  knowledge: "warm",
};

export const themeIdForDomain = (domain: Domain): ThemeId => domainToTheme[domain];

/** الثيم يُختار تلقائيًا من مجال الحلقة. */
export const themeForDomain = (domain: Domain): Theme => themes[domainToTheme[domain]];

/** النسخة الأساسية لصورة القناة (الأقواس الدافئة). */
export const masterTheme = themes.warm;

export type { Domain, Theme, ThemeId } from "./types";
