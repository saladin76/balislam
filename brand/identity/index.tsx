import React, { createContext, useContext, useMemo } from "react";
import identityJson from "../identity.json";
import { buildThemes, themeIds, type Theme, type ThemeId } from "../themes";
import { buildPalette, type StoredPalette } from "../elements/palette";
import type { ElementPalette } from "../elements/types";

export type Orientation = "landscape" | "portrait";
export type SizePair = { landscape: number; portrait: number };

/** كل ما يمكن تعديله في الهوية من الاستوديو. يُحفظ في brand/identity.json. */
export type Identity = {
  version: number;
  themes: Record<ThemeId, Omit<Theme, "id">>;
  palettes: Record<ThemeId, StoredPalette>;
  typography: {
    question: SizePair;
    bubble: SizePair;
    verse: SizePair;
    reference: SizePair;
    caption: SizePair;
    eyebrow: SizePair;
  };
  motion: {
    /** مضاعف سرعة كل الحركات (1 = الطبيعي) */
    speed: number;
    /** إطارات بين ظهور كلمة والتي بعدها */
    wordInterval: number;
    /** عدد كلمات سطر الترجمة */
    captionWords: number;
    /** اهتزاز الحبر في الثيم الخطي */
    boil: boolean;
    boilAmount: number;
    /** مضاعف طفو العناصر */
    float: number;
  };
};

export const defaultIdentity = identityJson as unknown as Identity;

type Resolved = {
  identity: Identity;
  themes: Record<ThemeId, Theme>;
  palettes: Record<ThemeId, ElementPalette>;
};

const resolve = (identity: Identity): Resolved => {
  const themes = buildThemes(identity.themes);
  const palettes = Object.fromEntries(themeIds.map((id) => [id, buildPalette(id, identity.palettes[id], themes[id].colors)])) as Record<ThemeId, ElementPalette>;
  return { identity, themes, palettes };
};

const defaultResolved = resolve(defaultIdentity);
const Ctx = createContext<Resolved>(defaultResolved);

/** يلفّ المعاينة بهوية معدّلة (من الاستوديو) قبل حفظها. بدونه تُستخدم الهوية المحفوظة. */
export const IdentityProvider: React.FC<{ identity: Identity; children: React.ReactNode }> = ({ identity, children }) => {
  const value = useMemo(() => resolve(identity), [identity]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useIdentity = () => useContext(Ctx).identity;
export const useTheme = (id: ThemeId): Theme => useContext(Ctx).themes[id];
export const usePalette = (id: ThemeId): ElementPalette => useContext(Ctx).palettes[id];
export const useSize = (key: keyof Identity["typography"], orientation: Orientation) => useContext(Ctx).identity.typography[key][orientation];
export const useMotionSettings = () => useContext(Ctx).identity.motion;
