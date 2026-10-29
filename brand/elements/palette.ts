import identity from "../identity.json";
import { themes, themeIds, type ThemeId } from "../themes";
import type { ElementPalette } from "./types";

type StoredPalette = Omit<ElementPalette, "themeId" | "bg" | "surface" | "ink">;

/** يركّب لوحة العناصر من بيانات الهوية + ألوان المشهد للثيم. */
export const buildPalette = (id: ThemeId, stored: StoredPalette, colors: { bg: string; surface: string; ink: string }): ElementPalette => ({
  ...stored,
  themeId: id,
  bg: colors.bg,
  surface: colors.surface,
  ink: colors.ink,
});

/** القيم من brand/identity.json. */
export const elementPalettes: Record<ThemeId, ElementPalette> = Object.fromEntries(
  themeIds.map((id) => [id, buildPalette(id, (identity.palettes as unknown as Record<ThemeId, StoredPalette>)[id], themes[id].colors)]),
) as Record<ThemeId, ElementPalette>;

export type { StoredPalette };
